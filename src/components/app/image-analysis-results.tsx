import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Card } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { ExtractedTask, ImageAnalysisResult } from "~/types/task";
import { cn } from "~/lib/utils";
import { Clock, Sparkles, Check } from "lucide-react";

interface ImageAnalysisResultsProps {
  analysis: ImageAnalysisResult;
  selectedTaskIds: string[];
  onToggleTask: (taskId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCreateSelected: () => void;
  onCreateSingle: (task: ExtractedTask) => void;
  isCreatingSelected: boolean;
  creatingTaskId?: string | null;
  imagePreviewUrl?: string | null;
  defaultPriority?: "low" | "medium" | "high";
  defaultHours?: number;
}

const PRIORITY_COLOR: Record<"low" | "medium" | "high", string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
  high: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200",
};

export function ImageAnalysisResults({
  analysis,
  selectedTaskIds,
  onToggleTask,
  onSelectAll,
  onDeselectAll,
  onCreateSelected,
  onCreateSingle,
  isCreatingSelected,
  creatingTaskId,
  imagePreviewUrl,
  defaultPriority = "medium",
  defaultHours = 1,
}: ImageAnalysisResultsProps) {
  const totalTasks = analysis.tasks.length;
  const selectedCount = selectedTaskIds.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Analysis Summary</h3>
          {analysis.summary ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {analysis.summary}
            </p>
          ) : (
            <p className="text-sm text-slate-500">No summary provided by the AI.</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {analysis.confidence !== undefined && analysis.confidence !== null && (
              <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                <Sparkles className="h-3.5 w-3.5" />
                Confidence: {(analysis.confidence * 100).toFixed(0)}%
              </div>
            )}
            {analysis.totalEstimatedHours !== undefined && analysis.totalEstimatedHours !== null && (
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
                <Clock className="h-3.5 w-3.5" />
                Estimated total: {analysis.totalEstimatedHours.toFixed(1)} hrs
              </div>
            )}
            <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
              Tasks suggested: {totalTasks}
            </div>
          </div>
        </div>
        {imagePreviewUrl && (
          <div className="hidden sm:block w-36 shrink-0 overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-800">
            <img src={imagePreviewUrl} alt="Uploaded reference" className="h-full w-full object-cover" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-900/60">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Checkbox
            id="select-all-tasks"
            checked={
              selectedCount === 0
                ? false
                : selectedCount === totalTasks
                  ? true
                  : "indeterminate"
            }
            onCheckedChange={(checked) => {
              if (checked) {
                onSelectAll();
              } else {
                onDeselectAll();
              }
            }}
          />
          <label htmlFor="select-all-tasks" className="cursor-pointer">
            {selectedCount} of {totalTasks} tasks selected
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onSelectAll} disabled={totalTasks === 0}>
            Select all
          </Button>
          <Button variant="ghost" size="sm" onClick={onDeselectAll} disabled={selectedCount === 0}>
            Clear
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {analysis.tasks.map((task) => {
          const priority = task.priority ?? defaultPriority;
          const hours = task.estimatedHours ?? defaultHours;
          const isSelected = selectedTaskIds.includes(task.id);
          const isCreating = creatingTaskId === task.id;

          return (
            <Card
              key={task.id}
              className={cn(
                "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70",
                isSelected && "border-blue-500 shadow-sm"
              )}
            >
              <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-1 items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleTask(task.id)}
                    className="mt-1"
                  />
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {task.title}
                      </h4>
                      <Badge className={cn("capitalize", PRIORITY_COLOR[priority])}>{priority}</Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {hours.toFixed(1)} hrs
                      </Badge>
                      {isSelected && (
                        <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                          <Check className="mr-1 h-3 w-3" /> Selected
                        </Badge>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {task.description}
                      </p>
                    )}
                    {task.notes && (
                      <p className="text-xs italic text-slate-500 dark:text-slate-400">{task.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onCreateSingle(task)}
                    disabled={isCreatingSelected || isCreating}
                  >
                    {isCreating ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Creating…
                      </span>
                    ) : (
                      "Create task"
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {analysis.tasks.length === 0 && (
          <Card className="border-dashed p-10 text-center">
            <p className="text-sm text-slate-500">The AI did not find any actionable tasks in this image.</p>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <p>
            {selectedCount > 0
              ? `Ready to create ${selectedCount} task${selectedCount === 1 ? "" : "s"}.`
              : "Select the tasks you want to create."}
          </p>
          <p className="text-xs text-slate-500">
            Default priority: {defaultPriority}. Default estimate: {defaultHours.toFixed(1)} hrs.
          </p>
        </div>
        <Button
          size="lg"
          disabled={selectedCount === 0 || isCreatingSelected}
          onClick={onCreateSelected}
          className="sm:min-w-[220px]"
        >
          {isCreatingSelected ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Creating tasks…
            </span>
          ) : (
            `Create ${selectedCount || "selected"} task${selectedCount === 1 ? "" : "s"}`
          )}
        </Button>
      </div>

      {analysis.confidence !== undefined && analysis.confidence !== null && (
        <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
          <p>
            Confidence indicates how certain the AI is about its recommendations. Review tasks before
            creating them to ensure they match your project goals.
          </p>
          {analysis.confidence !== undefined && (
            <Progress value={analysis.confidence * 100} className="h-1.5" />
          )}
        </div>
      )}
    </div>
  );
}
