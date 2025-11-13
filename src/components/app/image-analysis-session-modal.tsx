import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Loader2, RefreshCcw, Sparkles } from "lucide-react";
import { useConvexAction } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DEFAULT_ANALYSIS_PRIORITY,
  ImageAnalysisResult,
  ImageAnalysisResultSchema,
  ExtractedTask,
} from "~/types/task";
import { ImageAnalysisResults } from "~/components/app/image-analysis-results";
import { useThreadMessages } from "@convex-dev/agent/react";

interface ImageAnalysisSessionModalProps {
  open: boolean;
  onClose: () => void;
  imageDataUrl: string;
  context?: string;
  defaultPriority: "low" | "medium" | "high";
  defaultHours: number;
  projectId?: Id<"projects">;
  projectName?: string;
  onTasksCreated?: (count: number) => void;
}

function formatMessagePart(part: unknown): string {
  if (!part) return "";
  if (typeof part === "string") {
    return part;
  }
  if (typeof part === "object") {
    const obj = part as Record<string, unknown>;
    if (typeof obj.text === "string") {
      return obj.text;
    }
    if (typeof obj.data === "string") {
      return obj.data;
    }
    if (obj.type === "tool-call") {
      const name = typeof obj.toolName === "string" ? obj.toolName : "tool";
      return `Calling ${name}…`;
    }
    if (obj.type === "tool-result") {
      const toolName = typeof obj.toolName === "string" ? obj.toolName : "tool";
      const output = obj.output as Record<string, unknown> | undefined;
      if (output?.type === "json") {
        return JSON.stringify(output.value, null, 2);
      }
      if (output?.type === "text") {
        return String(output.value ?? "");
      }
      return `Tool result from ${toolName}`;
    }
    if (obj.type === "reasoning" && typeof obj.text === "string") {
      return obj.text;
    }
    if (obj.type === "redacted-reasoning" && typeof obj.data === "string") {
      return obj.data;
    }
    return JSON.stringify(obj);
  }
  return "";
}

function formatMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => formatMessagePart(part))
      .filter(Boolean)
      .join(" ");
  }
  if (content && typeof content === "object") {
    return formatMessagePart(content);
  }
  return "";
}

export function ImageAnalysisSessionModal({
  open,
  onClose,
  imageDataUrl,
  context,
  defaultPriority,
  defaultHours,
  projectId,
  projectName,
  onTasksCreated,
}: ImageAnalysisSessionModalProps) {
  const queryClient = useQueryClient();
  const createImageAnalysisThread = useConvexAction((api.ai as any).createImageAnalysisThread);
  const runImageAnalysisAgent = useConvexAction((api.ai as any).runImageAnalysisAgent);
  const createTasksFromImage = useConvexAction((api.ai as any).createTasksFromImage);
  const createTaskFromImage = useConvexAction((api.ai as any).createTaskFromImage);

  const [threadId, setThreadId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCreatingSelected, setIsCreatingSelected] = useState(false);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setThreadId(null);
      setAnalysis(null);
      setSelectedTaskIds([]);
      setIsAnalyzing(false);
      setIsCreatingSelected(false);
      setCreatingTaskId(null);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;

    async function startSession() {
      try {
        setIsAnalyzing(true);
        setAnalysis(null);
        setSelectedTaskIds([]);
        setErrorMessage(null);

        const { threadId: createdThreadId } = (await createImageAnalysisThread({})) as {
          threadId: string;
        };
        if (cancelled) return;
        setThreadId(createdThreadId);

        const response = (await runImageAnalysisAgent({
          threadId: createdThreadId,
          imageDataUrl,
          context,
        })) as {
          analysis: {
            summary?: string | null;
            totalEstimatedHours?: number | null;
            confidence?: number | null;
            tasks?: ExtractedTask[];
          };
        };
        if (cancelled) return;

        const normalised = ImageAnalysisResultSchema.parse({
          summary: response.analysis?.summary ?? "",
          totalEstimatedHours: response.analysis?.totalEstimatedHours ?? undefined,
          confidence: response.analysis?.confidence ?? undefined,
          tasks: (response.analysis?.tasks ?? []).map((task, index) => ({
            ...task,
            id: task.id ?? `task-${index + 1}`,
            priority: task.priority ?? DEFAULT_ANALYSIS_PRIORITY,
          })),
        });

        if (cancelled) return;
        setAnalysis(normalised);
        setSelectedTaskIds(normalised.tasks.map((task) => task.id));
      } catch (error) {
        console.error("Failed to analyze image", error);
        const message = error instanceof Error ? error.message : "Image analysis failed";
        setErrorMessage(message);
      } finally {
        if (!cancelled) {
          setIsAnalyzing(false);
        }
      }
    }

    startSession();

    return () => {
      cancelled = true;
    };
  }, [open, createImageAnalysisThread, runImageAnalysisAgent, imageDataUrl, context]);

  const threadMessages = useThreadMessages(
    api.ai.listImageAnalysisThreadMessages as any,
    threadId ? { threadId } : "skip",
    {
      initialNumItems: 20,
      stream: true,
    },
  );

  const agentLog = useMemo(() => {
    if (!threadMessages || threadMessages.status === "LoadingFirstPage") {
      return [] as Array<{
        key: string;
        role: string;
        text: string;
        streaming: boolean;
      }>;
    }

    return threadMessages.results.map((entry) => {
      const { message, streaming, key, status } = entry;
      const role = message?.role ?? "assistant";
      const textContent = formatMessageContent(message?.content);
      const text = textContent || (status === "pending" ? "…" : "(no content)");

      return {
        key,
        role,
        text,
        streaming,
      };
    });
  }, [threadMessages]);

  const invalidateTasks = useCallback(async () => {
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === api.tasks.listTasks;
      },
    });
  }, [queryClient]);

  const handleSelectAll = useCallback(() => {
    if (!analysis) return;
    setSelectedTaskIds(analysis.tasks.map((task) => task.id));
  }, [analysis]);

  const handleDeselectAll = useCallback(() => {
    setSelectedTaskIds([]);
  }, []);

  const handleToggleTask = useCallback((taskId: string) => {
    setSelectedTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    );
  }, []);

  const handleCreateSelected = useCallback(async () => {
    if (!analysis || selectedTaskIds.length === 0) {
      toast.info("Select at least one task to create.");
      return;
    }

    setIsCreatingSelected(true);
    try {
      const result = (await createTasksFromImage({
        analysis,
        selectedTaskIds,
        projectId,
        defaultPriority,
        defaultHrs: defaultHours,
      })) as { count: number };

      const count = result?.count ?? selectedTaskIds.length;
      toast.success(count === 1 ? "Created 1 task from the analysis" : `Created ${count} tasks.`);

      await invalidateTasks();
      onTasksCreated?.(count);
      onClose();
    } catch (error) {
      console.error("Failed to create tasks", error);
      const message = error instanceof Error ? error.message : "Unable to create tasks";
      toast.error(message);
    } finally {
      setIsCreatingSelected(false);
    }
  }, [analysis, selectedTaskIds, createTasksFromImage, projectId, defaultPriority, defaultHours, invalidateTasks, onTasksCreated, onClose]);

  const handleCreateSingle = useCallback(
    async (task: ExtractedTask) => {
      if (!analysis) return;
      setCreatingTaskId(task.id);
      try {
        await createTaskFromImage({
          analysis,
          task,
          projectId,
          defaultPriority,
          defaultHrs: defaultHours,
        });
        toast.success(`Created task “${task.title}”`);
        await invalidateTasks();
        onTasksCreated?.(1);
        setSelectedTaskIds((current) => current.filter((id) => id !== task.id));
      } catch (error) {
        console.error("Failed to create single task", error);
        const message = error instanceof Error ? error.message : "Unable to create task";
        toast.error(message);
      } finally {
        setCreatingTaskId(null);
      }
    },
    [analysis, createTaskFromImage, projectId, defaultPriority, defaultHours, invalidateTasks, onTasksCreated],
  );

  const handleRerunAnalysis = useCallback(async () => {
    if (!threadId) return;
    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const response = (await runImageAnalysisAgent({
        threadId,
        imageDataUrl,
        context,
      })) as {
        analysis: {
          summary?: string | null;
          totalEstimatedHours?: number | null;
          confidence?: number | null;
          tasks?: ExtractedTask[];
        };
      };

      const normalised = ImageAnalysisResultSchema.parse({
        summary: response.analysis?.summary ?? "",
        totalEstimatedHours: response.analysis?.totalEstimatedHours ?? undefined,
        confidence: response.analysis?.confidence ?? undefined,
        tasks: (response.analysis?.tasks ?? []).map((task, index) => ({
          ...task,
          id: task.id ?? `task-${index + 1}`,
          priority: task.priority ?? DEFAULT_ANALYSIS_PRIORITY,
        })),
      });

      setAnalysis(normalised);
      setSelectedTaskIds(normalised.tasks.map((task) => task.id));
    } catch (error) {
      console.error("Failed to re-run analysis", error);
      const message = error instanceof Error ? error.message : "Unable to re-run analysis";
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [threadId, runImageAnalysisAgent, imageDataUrl, context]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        } else {
          onClose();
        }
      }}
    >
      <DialogContent className="flex h-[95vh] w-full max-w-5xl flex-col overflow-hidden border border-border/60 bg-white dark:bg-slate-900 dark:border-slate-800 backdrop-blur-xl supports-[backdrop-filter]:bg-white/90">
        <DialogHeader className="flex-shrink-0 px-6 pt-6">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Image Analysis Session
          </DialogTitle>
          <DialogDescription>
            Reviewing tasks generated from your image{projectName ? ` for ${projectName}` : ""}. You can watch the
            agent work in real time and create tasks once you're satisfied.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="flex min-h-full flex-col gap-5">
            {errorMessage && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                {errorMessage}
              </div>
            )}

            <div className="flex flex-col gap-6 overflow-hidden">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Analysis session</p>
                  {threadId && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Thread ID: {threadId}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={handleRerunAnalysis} disabled={isAnalyzing || !threadId}>
                    <RefreshCcw className="mr-2 h-4 w-4" /> Re-run analysis
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-6 overflow-hidden">
                <div className="flex max-h-[40vh] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 flex items-center gap-3">
                    {isAnalyzing ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <Sparkles className="h-5 w-5 text-primary" />
                    )}
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      {isAnalyzing ? "Analyzing image…" : "Latest agent messages"}
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {agentLog.length === 0 ? (
                      <p className="text-slate-500 dark:text-slate-400">Waiting for agent output…</p>
                    ) : (
                      <div className="space-y-3">
                        {agentLog.map((entry) => (
                          <div key={entry.key} className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {entry.role === "user" ? "You" : "Agent"}
                              {entry.streaming ? " (streaming)" : ""}
                            </span>
                            <pre className="whitespace-pre-wrap rounded-md bg-slate-100/70 p-3 text-xs leading-relaxed text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                              {entry.text}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  {analysis ? (
                    <div className="flex-1 overflow-y-auto pr-1">
                      <ImageAnalysisResults
                        analysis={analysis}
                        selectedTaskIds={selectedTaskIds}
                        onToggleTask={handleToggleTask}
                        onSelectAll={handleSelectAll}
                        onDeselectAll={handleDeselectAll}
                        onCreateSelected={handleCreateSelected}
                        onCreateSingle={handleCreateSingle}
                        isCreatingSelected={isCreatingSelected}
                        creatingTaskId={creatingTaskId}
                        imagePreviewUrl={imageDataUrl}
                        defaultPriority={defaultPriority}
                        defaultHours={defaultHours}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-slate-500 dark:text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p>Waiting for the agent to finish analyzing the image…</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 flex items-center justify-end gap-2 px-6 pb-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={handleCreateSelected}
            disabled={selectedTaskIds.length === 0 || isCreatingSelected}
          >
            {isCreatingSelected ? "Creating tasks…" : `Create ${selectedTaskIds.length || 0} selected tasks`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
