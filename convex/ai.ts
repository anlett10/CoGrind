import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { Anthropic } from "@anthropic-ai/sdk";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { z } from "zod";
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
