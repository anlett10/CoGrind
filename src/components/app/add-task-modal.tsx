import { useEffect } from "react"
import { useForm } from "@tanstack/react-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query"
import { api } from "convex/_generated/api"
import { Id } from "convex/_generated/dataModel"
import { Label } from "~/components/ui/label"
import { Badge } from "~/components/ui/badge"
import { Clock, Flag, Link2, ListTodo, FileText, FolderKanban } from "lucide-react"

interface AddTaskInitialValues {
  text?: string
  details?: string
  priority?: string
  status?: string
  hrs?: number
  refLink?: string
  projectId?: Id<"projects">
}

interface AddTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: Id<"projects">
  initialTask?: AddTaskInitialValues
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", tone: "text-green-600 bg-green-50 border-green-200" },
  { value: "medium", label: "Medium", tone: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  { value: "high", label: "High", tone: "text-red-600 bg-red-50 border-red-200" },
]

const STATUS_OPTIONS = [
  { value: "todo", label: "To do", tone: "text-slate-600 bg-slate-50 border-slate-200" },
  { value: "in-progress", label: "In progress", tone: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "done", label: "Done", tone: "text-emerald-600 bg-emerald-50 border-emerald-200" },
]

export function AddTaskModal({ open, onOpenChange, projectId, initialTask }: AddTaskModalProps) {
  const createTask = useConvexMutation(api.tasks.createTask)

  const projects = useConvexQuery(api.projects.listProjects, {}) as
    | Array<{ _id: Id<"projects">; name: string; id: string }>
    | undefined

  type AddTaskFormValues = {
    text: string
    details: string
    priority: string
    status: string
    hrs: string
    refLink: string
    projectId: string
  }

  const form = useForm({
    defaultValues: {
      text: "",
      details: "",
      priority: "medium",
      status: "todo",
      hrs: "1",
      refLink: "",
      projectId: "",
    } satisfies AddTaskFormValues,
    onSubmit: async ({ value, formApi }) => {
      if (!value.text.trim()) {
        formApi.setFieldMeta("text", (prev) => ({
          ...prev,
          errors: ["Task name is required"],
        }))
        return
      }

      const resolvedProjectId = (value.projectId
        ? (value.projectId as Id<"projects">)
        : projectId ?? initialTask?.projectId) as Id<"projects"> | undefined

      try {
        await createTask({
          text: value.text.trim(),
          details: value.details.trim(),
          priority: value.priority,
          status: value.status,
          hrs: parseFloat(value.hrs) || 1,
          refLink: value.refLink.trim() || "",
          projectId: resolvedProjectId,
        })

        formApi.reset()
        onOpenChange(false)
      } catch (error) {
        console.error("Failed to create task:", error)
      }
    },
  })

  useEffect(() => {
    if (open) {
      const initialValues: AddTaskFormValues = {
        text: initialTask?.text ?? "",
        details: initialTask?.details ?? "",
        priority: initialTask?.priority ?? "medium",
        status: initialTask?.status ?? "todo",
        hrs:
          initialTask?.hrs !== undefined
            ? String(initialTask.hrs)
            : "1",
        refLink: initialTask?.refLink ?? "",
        projectId: (initialTask?.projectId ?? projectId ?? "") as string,
      }

      form.reset(initialValues)
    }
  }, [open, initialTask, projectId, form])

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && !form.state.isSubmitting) {
      form.reset()
      onOpenChange(false)
      return
    }
    if (nextOpen) {
      onOpenChange(true)
    }
  }

  const renderPriorityTone = (value: string) => {
    const fallback = PRIORITY_OPTIONS.find((option) => option.value === value)
    return fallback?.tone ?? ""
  }

  const renderStatusTone = (value: string) => {
    const fallback = STATUS_OPTIONS.find((option) => option.value === value)
    return fallback?.tone ?? ""
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto px-0 border border-border/60 bg-white dark:bg-slate-800 dark:border-slate-700 backdrop-blur-xl supports-[backdrop-filter]:bg-white/90">
        <DialogHeader className="px-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ListTodo className="h-4 w-4 text-primary" />
            </div>
            <span>Create New Task</span>
          </DialogTitle>
          <DialogDescription className="text-base">
            Add a new task with the details your team needs to stay aligned.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            form.handleSubmit()
          }}
          className="px-6"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <form.Field
                name="text"
                validators={{
                  onChange: ({ value }) => (!value.trim() ? "Task name is required" : undefined),
                  onBlur: ({ value }) => (!value.trim() ? "Task name is required" : undefined),
                  onSubmit: ({ value }) => (!value.trim() ? "Task name is required" : undefined),
                }}
              >
                {(field) => {
                  const errorMessage = field.state.meta.errors?.[0]
                  return (
                    <div className="space-y-2">
                      <Label htmlFor="task-text" className="flex items-center gap-2 text-sm font-semibold">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Task Name
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="task-text"
                        type="text"
                        placeholder="e.g., Complete project documentation"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        required
                        disabled={form.state.isSubmitting}
                        className="h-11 pl-4"
                      />
                      {errorMessage ? (
                        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
                      ) : null}
                    </div>
                  )
                }}
              </form.Field>
            </div>

            <div className="space-y-2">
              <form.Field name="details">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="task-details" className="flex items-center gap-2 text-sm font-semibold">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Details
                      <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <textarea
                      id="task-details"
                      placeholder="Add additional context..."
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      disabled={form.state.isSubmitting}
                      rows={4}
                      className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                )}
              </form.Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <form.Field name="priority">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="task-priority" className="flex items-center gap-2 text-sm font-semibold">
                        <Flag className="h-4 w-4 text-muted-foreground" />
                        Priority
                      </Label>
                      <select
                        id="task-priority"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        disabled={form.state.isSubmitting}
                        className="h-11 w-full rounded-lg border border-input bg-background px-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {PRIORITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${renderPriorityTone(field.state.value)}`}
                      >
                        <Flag className="h-3.5 w-3.5" />
                        {PRIORITY_OPTIONS.find((option) => option.value === field.state.value)?.label ?? field.state.value}
                      </div>
                    </div>
                  )}
                </form.Field>
              </div>

              <div className="space-y-2">
                <form.Field name="status">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="task-status" className="flex items-center gap-2 text-sm font-semibold">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        Status
                      </Label>
                      <select
                        id="task-status"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        disabled={form.state.isSubmitting}
                        className="h-11 w-full rounded-lg border border-input bg-background px-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${renderStatusTone(field.state.value)}`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {STATUS_OPTIONS.find((option) => option.value === field.state.value)?.label ?? field.state.value}
                      </div>
                    </div>
                  )}
                </form.Field>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <form.Field name="hrs">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="task-hrs" className="flex items-center gap-2 text-sm font-semibold">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        Estimated Hours
                      </Label>
                      <Input
                        id="task-hrs"
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        disabled={form.state.isSubmitting}
                        className="h-11 pl-4"
                      />
                    </div>
                  )}
                </form.Field>
              </div>

              <div className="space-y-2">
                <form.Field name="projectId">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="task-project" className="flex items-center gap-2 text-sm font-semibold">
                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                        Project
                        {projectId && (
                          <Badge variant="secondary" className="text-xs">
                            Locked
                          </Badge>
                        )}
                      </Label>
                      <select
                        id="task-project"
                        value={field.state.value || projectId || ""}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        disabled={form.state.isSubmitting || !!projectId}
                        className="h-11 w-full appearance-none rounded-lg border border-input bg-background px-4 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">No Project</option>
                        {projects?.map((project) => (
                          <option key={project._id} value={project._id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </form.Field>
              </div>
            </div>

            <div className="space-y-2">
              <form.Field name="refLink">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="task-ref-link" className="flex items-center gap-2 text-sm font-semibold">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      Reference Link
                      <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="task-ref-link"
                      type="url"
                      placeholder="https://example.com/reference"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      disabled={form.state.isSubmitting}
                      className="h-11 pl-4"
                    />
                  </div>
                )}
              </form.Field>
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={form.state.isSubmitting}
              className="h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.state.isSubmitting || !form.state.values.text.trim()}
              className="h-11"
            >
              {form.state.isSubmitting ? (
                <>
                  <span className="mr-2">Creating...</span>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                </>
              ) : (
                <>
                  <ListTodo className="mr-2 h-4 w-4" />
                  Create Task
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}