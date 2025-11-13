import { z } from "zod";

export const ExtractedTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  notes: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  estimatedHours: z.number().nonnegative().optional(),
});

export type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;

export const ImageAnalysisResultSchema = z.object({
  summary: z.string().default(""),
  totalEstimatedHours: z.number().nonnegative().optional(),
  confidence: z.number().min(0).max(1).optional(),
  tasks: z.array(ExtractedTaskSchema).default([]),
});

export type ImageAnalysisResult = z.infer<typeof ImageAnalysisResultSchema>;

export const DEFAULT_ANALYSIS_PRIORITY: ExtractedTask["priority"] = "medium";

export function stringifyAnalysisData(data: ImageAnalysisResult): string {
  return JSON.stringify(data);
}

export function parseAnalysisData(raw?: string | null): ImageAnalysisResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const safe = ImageAnalysisResultSchema.safeParse(parsed);
    if (!safe.success) {
      return null;
    }
    return {
      ...safe.data,
      tasks: safe.data.tasks.map((task) => ({
        ...task,
        priority: task.priority ?? DEFAULT_ANALYSIS_PRIORITY,
      })),
    };
  } catch {
    return null;
  }
}

export function isTaskFromImageAnalysis(raw?: string | null): boolean {
  return parseAnalysisData(raw) !== null;
}
