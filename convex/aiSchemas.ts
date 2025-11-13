import { z } from "zod";

export const ExtractedTaskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  notes: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  estimatedHours: z.number().nonnegative().optional(),
});

export type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;

export const ImageAnalysisSchema = z.object({
  summary: z.string().min(1).optional().default(""),
  totalEstimatedHours: z.number().nonnegative().optional(),
  confidence: z.number().min(0).max(1).optional(),
  tasks: z.array(ExtractedTaskSchema).default([]),
});

export type ImageAnalysis = z.infer<typeof ImageAnalysisSchema>;
