import { useEffect, useState } from "react"
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
import { Clock, Flag, Link2 } from "lucide-react"

interface EditTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: {
    _id: string
    text: string
    details: string
    priority?: string
    status?: string
    hrs?: number
    refLink?: string
    projectId?: Id<"projects">
  } | null
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

const STATUS_OPTIONS = [
  { value: "todo", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "done", label: "Done" },
]

export function EditTaskModal({ open, onOpenChange, task }: EditTaskModalProps) {
  const [text, setText] = useState("")
  const [details, setDetails] = useState("")
  const [priority, setPriority] = useState("medium")
  const [status, setStatus] = useState("todo")
  const [hrs, setHrs] = useState("1")
  const [refLink, setRefLink] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState<Id<"projects"> | "">("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateTask = useConvexMutation(api.tasks.updateTask)

  const projects = useConvexQuery(api.projects.listProjects, {}) as
    | Array<{ _id: Id<"projects">; name: string; id: string }>
    | undefined

  useEffect(() => {
    if (!task || !open) return

    setText(task.text || "")
    setDetails(task.details || "")
    setPriority(task.priority || "medium")
    setStatus(task.status || "todo")
    setHrs(task.hrs?.toString() || "1")
    setRefLink(task.refLink || "")
    setSelectedProjectId(task.projectId || "")
  }, [task, open])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!task || !text.trim()) return

    setIsSubmitting(true)
    try {
      await updateTask({
        taskId: task._id as Id<"tasks">,
        text: text.trim(),
        details: details.trim() || "",
        priority,
        status,
        hrs: parseFloat(hrs) || 1,
        refLink: refLink.trim() || "",
        projectId: (selectedProjectId || task.projectId) as Id<"projects"> | undefined,
      })

      onOpenChange(false)
    } catch (error) {
      console.error("Failed to update task:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && !isSubmitting) {
      onOpenChange(false)
      return
    }
    if (nextOpen) {
      onOpenChange(true)
    }
  }

  if (!task) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>Update the task information below.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="edit-task-text" className="text-sm font-medium">
              Task Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-task-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-task-details" className="text-sm font-medium">
              Details
            </Label>
            <textarea
              id="edit-task-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={4}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-task-priority" className="flex items-center gap-2 text-sm font-medium">
                <Flag className="h-4 w-4 text-muted-foreground" />
                Priority
              </Label>
              <select
                id="edit-task-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                disabled={isSubmitting}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-task-status" className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Status
              </Label>
              <select
                id="edit-task-status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                disabled={isSubmitting}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-task-hrs" className="text-sm font-medium">
                Estimated Hours
              </Label>
              <Input
                id="edit-task-hrs"
                type="number"
                min="0.25"
                step="0.25"
                value={hrs}
                onChange={(event) => setHrs(event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-task-project" className="text-sm font-medium">
                Project
              </Label>
              <select
                id="edit-task-project"
                value={selectedProjectId || ""}
                onChange={(event) => {
                  const value = event.target.value
                  setSelectedProjectId(value ? (value as Id<"projects">) : "")
                }}
                disabled={isSubmitting}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">No project</option>
                {projects?.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-task-ref" className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              Reference Link
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="edit-task-ref"
              type="url"
              value={refLink}
              onChange={(event) => setRefLink(event.target.value)}
              disabled={isSubmitting}
              placeholder="https://example.com/reference"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !text.trim()}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
