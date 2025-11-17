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
import { ImageUpload } from "~/components/ui/image-upload";
import { AlertCircle, Sparkles } from "lucide-react";
import { Id } from "convex/_generated/dataModel";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { useConvexAction } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { ImageAnalysisResults } from "~/components/app/image-analysis-results";
import { DEFAULT_ANALYSIS_PRIORITY, type ImageAnalysisResult, type ExtractedTask } from "~/types/task";

interface ImageAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: Id<"projects">;
  projectName?: string;
  onTasksCreated?: (count: number) => void;
}

export function ImageAnalyticsModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  onTasksCreated,
}: ImageAnalyticsModalProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [contextNotes, setContextNotes] = useState("");
  const [defaultPriority, setDefaultPriority] = useState<"low" | "medium" | "high">(DEFAULT_ANALYSIS_PRIORITY);
  const [defaultHours, setDefaultHours] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<"upload" | "analyzing" | "results">("upload");
  const [analysis, setAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isCreatingSelected, setIsCreatingSelected] = useState(false);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);

  const analyzeTaskImage = useConvexAction((api.ai as any).analyzeTaskImage);
  const createTasksFromImage = useConvexAction((api.ai as any).createTasksFromImage);
  const createTaskFromImage = useConvexAction((api.ai as any).createTaskFromImage);

  useEffect(() => {
    if (!isOpen) {
      setSelectedImage(null);
      setImageDataUrl(null);
      setContextNotes("");
      setDefaultPriority(DEFAULT_ANALYSIS_PRIORITY);
      setDefaultHours(1);
      setErrorMessage(null);
      setPhase("upload");
      setAnalysis(null);
      setSelectedTaskIds([]);
      setCreatingTaskId(null);
      setIsCreatingSelected(false);
    }
  }, [isOpen]);

  const projectContext = useMemo(() => {
    if (!projectName) return contextNotes.trim() || undefined;
    const extra = contextNotes.trim();
    return extra ? `${projectName} — ${extra}` : projectName;
  }, [projectName, contextNotes]);

  const handleImageSelect = useCallback((file: File) => {
    setSelectedImage(file);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setImageDataUrl(result);
      }
    };
    reader.onerror = () => {
      setErrorMessage("We couldn't read that file. Please try a different image.");
    };
    reader.readAsDataURL(file);
  }, []);

  const handleImageRemove = useCallback(() => {
    setSelectedImage(null);
    setImageDataUrl(null);
    setErrorMessage(null);
  }, []);

  const normalizeAnalysisResult = useCallback(
    (result: ImageAnalysisResult): ImageAnalysisResult => {
      return {
        summary: result.summary ?? "",
        totalEstimatedHours: result.totalEstimatedHours ?? undefined,
        confidence: result.confidence ?? undefined,
        tasks: (result.tasks ?? []).map((task, index) => ({
          ...task,
          id: task.id || `task-${index + 1}`,
          priority: task.priority ?? DEFAULT_ANALYSIS_PRIORITY,
        })),
      };
    },
    [],
  );

  const handleAnalyzeImage = useCallback(async () => {
    if (!imageDataUrl) {
      setErrorMessage("Upload an image before analyzing.");
      return;
    }
    setErrorMessage(null);
    setPhase("analyzing");
    try {
      const result = (await analyzeTaskImage({
        imageDataUrl,
        context: projectContext,
      })) as ImageAnalysisResult;
      const normalized = normalizeAnalysisResult(result);
      setAnalysis(normalized);
      setSelectedTaskIds(normalized.tasks.map((task) => task.id));
      setPhase("results");
    } catch (error) {
      console.error("Failed to analyze image", error);
      const message = error instanceof Error ? error.message : "Image analysis failed";
      setErrorMessage(message);
      toast.error(message);
      setPhase("upload");
    }
  }, [analyzeTaskImage, imageDataUrl, projectContext, normalizeAnalysisResult]);

  const handleSelectAll = useCallback(() => {
    if (!analysis) return;
    setSelectedTaskIds(analysis.tasks.map((task) => task.id));
  }, [analysis]);

  const handleDeselectAll = useCallback(() => {
    setSelectedTaskIds([]);
  }, []);

  const handleToggleTask = useCallback((taskId: string) => {
    setSelectedTaskIds((current) => (current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]));
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
      onTasksCreated?.(count);
      onClose();
    } catch (error) {
      console.error("Failed to create tasks", error);
      const message = error instanceof Error ? error.message : "Unable to create tasks";
      toast.error(message);
    } finally {
      setIsCreatingSelected(false);
    }
  }, [analysis, selectedTaskIds, createTasksFromImage, projectId, defaultPriority, defaultHours, onTasksCreated, onClose]);

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
        onTasksCreated?.(1);
        setSelectedTaskIds((current) => current.filter((id) => id !== task.id));
      } catch (error) {
        console.error("Failed to create task", error);
        const message = error instanceof Error ? error.message : "Unable to create task";
        toast.error(message);
      } finally {
        setCreatingTaskId(null);
      }
    },
    [analysis, createTaskFromImage, projectId, defaultPriority, defaultHours, onTasksCreated],
  );

  const isAnalyzeDisabled = !selectedImage || !imageDataUrl;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden border border-border/60 bg-white dark:bg-slate-900 dark:border-slate-800 backdrop-blur-xl supports-[backdrop-filter]:bg-white/90">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Analyze Image for Tasks
          </DialogTitle>
          <DialogDescription>
            Upload a screenshot, whiteboard, or hand-written plan. We'll hand it off to the AI session to extract tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-0 py-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Workflow</p>
            <ol className="mt-2 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
              <li className="font-semibold text-primary">1. Upload image</li>
              <li>2. AI review</li>
              <li>3. Create tasks</li>
            </ol>
          </div>

          {phase !== "results" && (
            <div className="space-y-4">
            <ImageUpload
              selectedImage={selectedImage}
              onImageSelect={handleImageSelect}
              onImageRemove={handleImageRemove}
            />

            <div className="space-y-2">
              <Label htmlFor="analysis-context" className="text-sm font-medium">
                Additional context <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="analysis-context"
                placeholder="Describe what the image contains or desired outcomes"
                value={contextNotes}
                onChange={(event) => setContextNotes(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1 space-y-2">
                <Label htmlFor="default-priority" className="text-sm font-medium">
                  Default priority
                </Label>
                <Select value={defaultPriority} onValueChange={(value) => setDefaultPriority(value as typeof defaultPriority)}>
                  <SelectTrigger id="default-priority" className="capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="default-hours" className="text-sm font-medium">
                  Default estimate (hrs)
                </Label>
                <Input
                  id="default-hours"
                  type="number"
                  min="0"
                  step="0.25"
                  value={defaultHours}
                  onChange={(event) => setDefaultHours(Number(event.target.value) || 0)}
                />
              </div>
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{errorMessage}</span>
              </div>
            )}
            </div>
          )}

          {phase === "analyzing" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Sparkles className="h-8 w-8 animate-pulse text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing your image…</p>
            </div>
          )}

          {phase === "results" && analysis && (
            <div className="px-2">
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
          )}
        </div>

        <DialogFooter className="flex-shrink-0 flex items-center justify-between gap-3 pt-4">
          {phase === "results" && (
            <Button
              variant="ghost"
              onClick={() => {
                setPhase("upload");
                setAnalysis(null);
                setSelectedTaskIds([]);
              }}
            >
              Start over
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {phase !== "results" && (
              <Button onClick={handleAnalyzeImage} disabled={isAnalyzeDisabled || phase === "analyzing"}>
                {phase === "analyzing" ? "Analyzing…" : isAnalyzeDisabled ? "Upload an image" : "Analyze image"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
