import { action, query } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { Anthropic } from "@anthropic-ai/sdk";
import { Agent, createTool, listMessages, syncStreams } from "@convex-dev/agent";
import { vStreamArgs } from "@convex-dev/agent/validators";
import { anthropic as anthropicModel } from "@ai-sdk/anthropic";
import { z } from "zod";
import { api, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  ExtractedTaskSchema,
  ImageAnalysisSchema,
  type ExtractedTask,
  type ImageAnalysis,
} from "./aiSchemas";

type TaskPriority = "low" | "medium" | "high";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const SUPPORTED_IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type SupportedImageMediaType = (typeof SUPPORTED_IMAGE_MEDIA_TYPES)[number];

const paginationOptsValidator = v.object({
  cursor: v.union(v.string(), v.null()),
  numItems: v.number(),
});

function createRandomId(): string {
  const cryptoGlobal = globalThis.crypto as
    | { randomUUID?: () => string; getRandomValues?: (array: Uint8Array) => Uint8Array }
    | undefined;
  if (cryptoGlobal?.randomUUID) {
    return cryptoGlobal.randomUUID();
  }
  if (cryptoGlobal?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoGlobal.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Anthropic API key is not configured");
  }
  return new Anthropic({ apiKey });
}

function ensurePriority(
  priority?: string,
  fallback: TaskPriority = "medium",
): TaskPriority {
  if (!priority) return fallback;
  const normalized = priority.toLowerCase();
  return ALLOWED_PRIORITIES.has(normalized)
    ? (normalized as TaskPriority)
    : fallback;
}

function parseDataUrl(imageData: string): { mediaType: SupportedImageMediaType; base64Data: string } {
  if (imageData.startsWith("data:")) {
    const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error("Invalid data URL format for image");
    }
    const [, mediaType, base64Data] = match;
    if (!SUPPORTED_IMAGE_MEDIA_TYPES.includes(mediaType as SupportedImageMediaType)) {
      throw new Error("Provided file is not an image");
    }
    return { mediaType: mediaType as SupportedImageMediaType, base64Data };
  }

  throw new Error("Image must be provided as a base64 data URL");
}

function buildTaskDetails(task: ExtractedTask): string {
  const sections: string[] = [];
  if (task.description) {
    sections.push(task.description.trim());
  }
  if (task.notes) {
    sections.push(`Notes: ${task.notes.trim()}`);
  }
  sections.push("Generated via image analysis");
  return sections.join("\n\n");
}

function buildAnalysisMetadata(
  analysis: ImageAnalysis,
  sourceTaskId: string,
  projectId?: Id<"projects">
) {
  return JSON.stringify({
    source: "image-analysis",
    generatedAt: Date.now(),
    sourceTaskId,
    projectId: projectId ? String(projectId) : undefined,
    summary: analysis.summary ?? "",
    confidence: analysis.confidence ?? null,
    totalEstimatedHours: analysis.totalEstimatedHours ?? null,
    tasks: analysis.tasks,
  });
}

async function performImageAnalysis(args: {
  imageDataUrl: string;
  context?: string;
}): Promise<ImageAnalysis> {
  "use node";
    const { mediaType, base64Data } = parseDataUrl(args.imageDataUrl);

  const client = getAnthropicClient();

    const prompt = `You are an expert product manager and technical lead helping break down work from visual inputs.
Analyze the provided image and extract actionable engineering or product tasks.

Return ONLY valid JSON matching this TypeScript type:
{
  "summary": string;
  "totalEstimatedHours"?: number;
  "confidence"?: number; // 0-1 scale
  "tasks": Array<{
    "id": string;
    "title": string;
    "description"?: string;
    "notes"?: string;
    "priority"?: "low" | "medium" | "high";
    "estimatedHours"?: number;
  }>;
}

Guidelines:
- Include 1-8 tasks max.
- Use concise, specific titles.
- Provide best-guess hours if possible (use decimals for partial hours).
- Default priority to "medium" if unsure.
- Confidence reflects your overall certainty (0.0-1.0).
- Never include additional commentary outside the JSON.
${args.context ? `\nProject context: ${args.context}` : ""}`;

    const response = await client.messages.create({
    model: "claude-3-7-sonnet-20250219",
    max_tokens: 1200,
      temperature: 0,
      system: "You convert images of workspaces, whiteboards, or screenshots into structured task plans.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            },
          ],
        },
      ],
    });

    const textResponse = response.content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n");

    if (!textResponse) {
      throw new Error("Anthropic response did not include text content");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(textResponse);
    } catch (error) {
      throw new Error("Failed to parse AI response");
    }

    const analysis = ImageAnalysisSchema.parse(parsed);
    const normalizedTasks = analysis.tasks.map((task, index) => ({
      ...task,
    id: task.id ?? `task-${index + 1}-${createRandomId()}`,
      priority: ensurePriority(task.priority),
    }));

    return {
      summary: analysis.summary ?? "",
    totalEstimatedHours: analysis.totalEstimatedHours ?? undefined,
    confidence: analysis.confidence ?? undefined,
      tasks: normalizedTasks,
  };
}

const SuggestionTaskSchema = z.object({
  text: z.string(),
  priority: z.string().optional(),
  status: z.string().optional(),
});

const TaskAnalysisSchema = z.object({
  suggestedName: z.string().optional(),
  suggestedPriority: z.enum(["low", "medium", "high"]).optional(),
  estimatedTime: z.number().min(0.25).max(8).optional(),
  suggestedSubtasks: z.array(z.string()).optional(),
  suggestedTemplate: z.string().nullable().optional(),
  productivityTips: z.array(z.string()).optional(),
});

const RelatedSubtasksSchema = z.array(z.string()).min(1).max(10);

export const analyzeTaskImage = action({
  args: {
    imageDataUrl: v.string(),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    "use node";
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    return performImageAnalysis({
      imageDataUrl: args.imageDataUrl,
      context: args.context,
    });
  },
});

const analyzeImageTool = createTool({
  description:
    "Analyze an uploaded image that contains planning or task information and return a structured summary of tasks, confidence, and effort estimates.",
  args: z
    .object({
      imageDataUrl: z
        .string()
        .describe("Base64 data URL for the image to analyze. Provide only if storageId is not supplied.")
        .optional(),
      storageId: z
        .string()
        .describe(
          "Identifier for previously uploaded image data stored via ctx.storage. Preferred for large payloads.",
        )
        .optional(),
      context: z.string().describe("Additional project context to guide the analysis.").optional(),
    })
    .refine((value) => Boolean(value.imageDataUrl || value.storageId), {
      message: "Provide either imageDataUrl or storageId.",
    }),
  handler: async (ctx, args) => {
    "use node";
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    let imageDataUrl = args.imageDataUrl;
    if (!imageDataUrl && args.storageId) {
      const stored = await ctx.storage.get(args.storageId as Id<"_storage">);
      if (!stored) {
        throw new Error("Stored image payload not found");
      }
      let arrayBuffer: ArrayBuffer;
      if (stored instanceof ArrayBuffer) {
        arrayBuffer = stored;
      } else if (typeof (stored as Blob).arrayBuffer === "function") {
        arrayBuffer = await (stored as Blob).arrayBuffer();
      } else {
        throw new Error("Unsupported stored payload type");
      }
      imageDataUrl = Buffer.from(arrayBuffer).toString("utf-8");
      await ctx.storage.delete(args.storageId as Id<"_storage">).catch(() => undefined);
    }
    if (!imageDataUrl) {
      throw new Error("Image data missing");
    }
    return performImageAnalysis({
      imageDataUrl,
      context: args.context,
    });
  },
});

const createTaskTool = createTool({
  description:
    "Create a new task in the current workspace. Use this after analyzing an image when the user confirms which tasks to add.",
  args: z.object({
    title: z.string().min(1).describe("Task title"),
    details: z.string().describe("Task details").optional(),
    priority: z.enum(["low", "medium", "high"]).describe("Task priority").optional(),
    hrs: z.number().min(0).describe("Estimated hours").optional(),
    projectId: z.string().describe("Project document ID").optional(),
    refLink: z.string().describe("Reference link to attach to the task").optional(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const projectId = args.projectId
      ? (args.projectId as Id<"projects">)
      : undefined;

    const taskId = await ctx.runMutation(api.tasks.createTask, {
      text: args.title,
      details: args.details ?? "",
      priority: ensurePriority(args.priority, "medium"),
      status: "todo",
      hrs: args.hrs ?? 1,
      sharedWith: undefined,
      refLink: args.refLink ?? "",
      projectId,
      trackedTimeMs: 0,
      analysisData: undefined,
    });

    return {
      taskId,
      projectId: projectId ? String(projectId) : undefined,
    };
  },
});

const shareTaskTool = createTool({
  description:
    "Share an existing task with all collaborators on its project. Use this after creating tasks when sharing is requested.",
  args: z.object({
    taskId: z.string().describe("Task document ID to share"),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const result = await ctx.runMutation(
      (api.tasks as any).shareTaskWithCollaborators,
      {
        taskId: args.taskId as Id<"tasks">,
      },
    );

    return result;
  },
});

const imageAnalysisAgent = new Agent(components.agent, {
  name: "Image Analysis Planner",
  languageModel: anthropicModel("claude-3-7-sonnet-20250219"),
  instructions:
    "You help product teams turn visual plans into actionable tasks. Always use the analyzeImage tool to inspect any provided image data. After analyzing, summarize the findings and return a structured JSON response that matches the requested schema. If the user explicitly asks to create or share tasks, use the createTask tool to add them and shareTask tool to share with collaborators. Do not invent details that the tools do not provide.",
  tools: {
    analyzeImage: analyzeImageTool,
    createTask: createTaskTool,
    shareTask: shareTaskTool,
  },
  maxSteps: 3,
});

export const createImageAnalysisThread = action({
  args: {},
  handler: async (ctx): Promise<{ threadId: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { threadId } = await imageAnalysisAgent.createThread(ctx, {
      userId: identity.subject,
      title: "Image analysis session",
    });

    return { threadId };
  },
});

export const runImageAnalysisAgent = action({
  args: {
    threadId: v.string(),
    imageDataUrl: v.string(),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ analysis: ImageAnalysis }> => {
    "use node";
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { thread } = await imageAnalysisAgent.continueThread(ctx, {
      threadId: args.threadId,
      userId: identity.subject,
    });

    const storageId = await ctx.storage.store(
      new Blob([args.imageDataUrl], { type: "text/plain" }),
    );
    const storageKey = storageId as Id<"_storage">;
    const storageKeyString = storageKey.toString();

    const toolArgs = args.context
      ? { storageId: storageKeyString, context: args.context }
      : { storageId: storageKeyString };

    await imageAnalysisAgent.saveMessage(ctx, {
      threadId: args.threadId,
      userId: identity.subject,
      message: {
        role: "user",
        content: `Please analyze the uploaded image referenced by storageId “${storageKeyString}”${
          args.context ? ` with context: ${args.context}` : ""
        }. Always call the analyzeImage tool using that storageId.`,
      },
    });

    try {
      const result = await thread.generateObject(
        {
          schema: ImageAnalysisSchema,
          system:
            "You orchestrate image analysis for task planning. You must call the analyzeImage tool exactly once to inspect the uploaded image before responding.",
          prompt: `Call the analyzeImage tool with the following arguments and wait for its response before replying. Always return JSON that conforms to the requested schema.\nTool arguments: ${JSON.stringify(
            toolArgs,
          )}`,
        },
        {
          storageOptions: { saveMessages: "promptAndOutput" },
        },
      );

      return {
        analysis: result.object,
      };
    } finally {
      await ctx.storage.delete(storageKey).catch(() => undefined);
    }
  },
});

export const listImageAnalysisThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const messages = await listMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });

    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    });

    return {
      ...messages,
      ...(streams ? { streams } : {}),
    };
  },
});

const extractedTaskArg = v.object({
  id: v.optional(v.string()),
  title: v.string(),
  description: v.optional(v.string()),
  notes: v.optional(v.string()),
  priority: v.optional(v.string()),
  estimatedHours: v.optional(v.number()),
});

const analysisArg = v.object({
  summary: v.optional(v.string()),
  totalEstimatedHours: v.optional(v.number()),
  confidence: v.optional(v.number()),
  tasks: v.array(extractedTaskArg),
});

async function ensureAuthenticated(ctx: { auth: any }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}

async function createTaskFromExtracted(
  ctx: ActionCtx,
  identity: Awaited<ReturnType<typeof ensureAuthenticated>>,
  params: {
    extractedTask: z.infer<typeof ExtractedTaskSchema>;
    analysis: z.infer<typeof ImageAnalysisSchema>;
    projectId?: Id<"projects">;
    fallbackPriority?: TaskPriority;
    fallbackHours?: number;
  }
) : Promise<Id<"tasks">> {
  const { extractedTask, analysis, projectId, fallbackPriority, fallbackHours } = params;
  const priority = ensurePriority(extractedTask.priority, fallbackPriority ?? "medium");
  const hrs = extractedTask.estimatedHours ?? fallbackHours ?? 1;

  const details = buildTaskDetails(extractedTask);
  const analysisData = buildAnalysisMetadata(analysis, extractedTask.id ?? createRandomId(), projectId);

  return ctx.runMutation(api.tasks.createTask, {
    text: extractedTask.title,
    details,
    priority,
    status: "todo",
    hrs,
    refLink: "",
    projectId,
    analysisData,
  });
}

export const createTasksFromImage = action({
  args: {
    analysis: analysisArg,
    selectedTaskIds: v.array(v.string()),
    projectId: v.optional(v.id("projects")),
    defaultPriority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    defaultHrs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    "use node";
    const identity = await ensureAuthenticated(ctx);
    const analysis = ImageAnalysisSchema.parse(args.analysis);

    const selected = analysis.tasks.filter((task) =>
      args.selectedTaskIds.includes(task.id ?? "")
    );

    if (selected.length === 0) {
      throw new Error("No tasks selected");
    }

    const createdTaskIds: Id<"tasks">[] = [];
    for (const task of selected) {
      const taskId = await createTaskFromExtracted(ctx, identity, {
        extractedTask: task,
        analysis,
        projectId: args.projectId,
        fallbackPriority: args.defaultPriority ?? "medium",
        fallbackHours: args.defaultHrs ?? 1,
      });
      createdTaskIds.push(taskId);
    }

    return {
      count: createdTaskIds.length,
      taskIds: createdTaskIds,
    };
  },
});

export const createTaskFromImage = action({
  args: {
    analysis: analysisArg,
    task: extractedTaskArg,
    projectId: v.optional(v.id("projects")),
    defaultPriority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    defaultHrs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    "use node";
    const identity = await ensureAuthenticated(ctx);
    const analysis = ImageAnalysisSchema.parse(args.analysis);
    const task = ExtractedTaskSchema.parse(args.task);

    const taskId = await createTaskFromExtracted(ctx, identity, {
      extractedTask: task,
      analysis,
      projectId: args.projectId,
      fallbackPriority: args.defaultPriority ?? "medium",
      fallbackHours: args.defaultHrs ?? 1,
    });

    return { taskId };
  },
});
