import { useMemo, useState, type Dispatch, type SetStateAction, type CSSProperties } from "react"
import type { Id } from "convex/_generated/dataModel"
import { Link2, MoreVertical, Pencil, Trash2, Users, Share2, Clock } from "lucide-react"
import { TaskRefinementSection } from "./task-refinement-section"

import { cn } from "~/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

export type TaskCardTask = {
  _id: string
  _creationTime?: number
  userId: string
  text: string
  details: string
  priority?: string
  status?: string
  hrs?: number
  startedAt?: Date | number | null
  completedAt?: Date | number | null
  trackedTimeMs?: number
  sharedWith?: string
  refLink?: string
  projectId?: Id<"projects">
}

export type TaskCardProject = {
  _id: Id<"projects">
  id: string
  name: string
  description?: string
  type?: string
  category?: string
  status?: string
  githubUrl?: string
  websiteUrl?: string
}

export type TaskEditForm = {
  text: string
  details: string
  priority: "low" | "medium" | "high"
  hrs: number
  refLink: string
  projectId: Id<"projects"> | ""
  sharedWith: string
}

interface TaskCardProps {
  task: TaskCardTask
  projectName?: string | null
  isOwner: boolean
  sharedEmails: string[]
  isEditing: boolean
  editForm: TaskEditForm
  isSubmitting: boolean
  projects?: TaskCardProject[]
  wrapperStyle?: CSSProperties
  onEdit: (task: TaskCardTask) => void
  onDelete: (task: TaskCardTask) => void
  onToggle: (task: TaskCardTask) => void
  onShare?: (task: TaskCardTask) => void
  onUnshare?: (task: TaskCardTask) => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onEditFormChange?: Dispatch<SetStateAction<TaskEditForm>>
  runningTimeLabel?: string | null
  isRunning?: boolean
  showRefinement?: boolean
  currentUserId?: string
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-emerald-500 text-white",
}

const hoursOptions = Array.from({ length: 8 }, (_, idx) => idx + 1)

const getStatusTag = (status?: string) => {
  const normalized = (status || '').toLowerCase()

  if (normalized === 'in progress' || normalized === 'in-progress' || normalized === 'running') {
    return {
      label: 'Running',
      icon: '⏱',
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    }
  }

  if (normalized === 'done' || normalized === 'completed') {
    return {
      label: 'Done',
      icon: '✓',
      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    }
  }

  return {
    label: 'Backlog',
    icon: '○',
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300',
  }
}

export function TaskCard({
  task,
  projectName,
  isOwner,
  sharedEmails,
  isEditing,
  editForm,
  isSubmitting,
  projects,
  wrapperStyle,
  onEdit,
  onDelete,
  onToggle,
  onShare,
  onUnshare,
  onCancelEdit,
  onSaveEdit,
  onEditFormChange,
  runningTimeLabel,
  isRunning,
  showRefinement = false,
  currentUserId,
}: TaskCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const statusTag = useMemo(() => getStatusTag(task.status), [task.status])
  const isCompleted = task.status === "done" || task.status === "Completed"
  const isUnassigned = !task.projectId
  const isMarkDoneDisabled = !isCompleted && isUnassigned

  const canShare = isOwner && !!onShare && sharedEmails.length === 0
  const canUnshare = isOwner && !!onUnshare && sharedEmails.length > 0

  const handleEditField = (field: keyof TaskEditForm, value: unknown) => {
    if (!onEditFormChange) return
    onEditFormChange((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const combinedWrapperStyle: CSSProperties = {
    margin: 0,
    ...(wrapperStyle ?? {}),
  }

  if (isEditing) {
    return (
      <div
        style={combinedWrapperStyle}
        className="bg-white dark:bg-slate-800 rounded-2xl border border-blue-200 dark:border-blue-700 shadow-lg p-6 space-y-6 transition-all"
      >
        <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">
            Task Name
          </label>
          <input
            type="text"
            value={editForm.text}
            onChange={(e) => handleEditField("text", e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-100 text-foreground focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="Enter task name..."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">
            Details
          </label>
          <textarea
            value={editForm.details}
            onChange={(e) => handleEditField("details", e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 text-foreground focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            rows={3}
            placeholder="Add more context..."
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2 text-foreground">
              Reference Link
            </label>
            <input
              type="url"
              value={editForm.refLink}
              onChange={(e) => handleEditField("refLink", e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-100 text-foreground focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2 text-foreground">
              Project
            </label>
            <select
              value={editForm.projectId}
              onChange={(e) =>
                handleEditField("projectId", e.target.value as Id<"projects"> | "")
              }
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-100 text-foreground focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">No Project</option>
              {projects?.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2 text-foreground">
              Priority
            </label>
            <div className="flex gap-2">
              {(["low", "medium", "high"] as const).map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => handleEditField("priority", priority)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    editForm.priority === priority
                      ? {
                          high: "bg-red-500 text-white shadow-md",
                          medium: "bg-amber-500 text-white shadow-md",
                          low: "bg-emerald-500 text-white shadow-md",
                        }[priority]
                      : "bg-slate-100 dark:bg-slate-700/50 text-foreground hover:bg-slate-200 dark:hover:bg-slate-600/50",
                  )}
                >
                  {PRIORITY_LABELS[priority]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2 text-foreground">
              Estimated Hours
            </label>
            <select
              value={editForm.hrs}
              onChange={(e) => handleEditField("hrs", Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-100 text-foreground focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              {hoursOptions.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}h
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">
            Share with (emails)
          </label>
          <input
            type="text"
            value={editForm.sharedWith}
            onChange={(e) => handleEditField("sharedWith", e.target.value)}
            placeholder="user@example.com, teammate@example.com"
            className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-100 text-foreground focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancelEdit}
            className="px-4 py-2 text-foreground border border-slate-200 dark:border-slate-600/70 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSaveEdit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={combinedWrapperStyle}
      className={cn(
        "group w-full rounded-2xl border transition-all duration-300",
        isCompleted
          ? "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg hover:-translate-y-0.5",
      )}
    >
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            {task.priority && (
              <div
                className={cn(
                  "mt-1 h-10 w-1 rounded-full transition-all",
                  PRIORITY_COLORS[task.priority.toLowerCase()] ?? "bg-slate-300",
                )}
              />
            )}
            <div className="flex-1 min-w-0">
              <h3
                className={cn(
                  "font-semibold text-lg leading-snug transition-colors line-clamp-2",
                  isCompleted ? "line-through text-slate-500 dark:text-slate-500" : "text-foreground dark:text-slate-100",
                )}
              >
                {task.text}
              </h3>
            </div>
          </div>

          {isOwner && (
            <div className="flex-shrink-0">
              <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <DropdownMenuTrigger asChild>
              <button
                type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 flex-shrink-0"
                aria-label="Task actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="z-50 w-48 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-1"
                >
                  {canShare && (
                    <DropdownMenuItem
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-900 dark:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 focus:bg-slate-100 dark:focus:bg-slate-700/50"
                      onSelect={(event) => {
                        event.preventDefault()
                        onShare?.(task)
                        setIsMenuOpen(false)
                      }}
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800"
                    onSelect={(event) => {
                      event.preventDefault()
                      onEdit(task)
                      setIsMenuOpen(false)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  {canUnshare && (
                    <DropdownMenuItem
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-900 dark:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 focus:bg-slate-100 dark:focus:bg-slate-700/50"
                      onSelect={(event) => {
                        event.preventDefault()
                        onUnshare?.(task)
                        setIsMenuOpen(false)
                      }}
                    >
                      <Share2 className="h-4 w-4" />
                      Unshare
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="my-1 bg-slate-200/80 dark:bg-slate-700/80" />
                  <DropdownMenuItem
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 cursor-pointer rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 focus:bg-red-50 dark:focus:bg-red-950/20 focus:text-red-600 dark:focus:text-red-400"
                    onSelect={(event) => {
                      event.preventDefault()
                      if (window.confirm(`Delete "${task.text}"? This action cannot be undone.`)) {
                        onDelete(task)
                      }
                      setIsMenuOpen(false)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3 mb-4">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
              statusTag.color,
            )}
          >
            <span>{statusTag.icon}</span>
            {statusTag.label}
          </span>

          {task.priority && (
            <span
              className={cn(
                "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold",
                PRIORITY_COLORS[task.priority.toLowerCase()] ?? "bg-slate-200 text-slate-700",
              )}
            >
              {PRIORITY_LABELS[task.priority.toLowerCase()] ?? task.priority}
            </span>
          )}

          {typeof task.hrs === "number" && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              ⏱️ {task.hrs}h
            </span>
          )}

          {runningTimeLabel && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border",
                isRunning
                  ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-200 bg-emerald-50/70 dark:bg-emerald-900/30"
                  : "border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/40"
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              {runningTimeLabel}
            </span>
          )}

          {projectName && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              📁 {projectName}
            </span>
          )}

          {sharedEmails.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-200">
              <Users className="h-3.5 w-3.5" />
              Shared
            </span>
          )}
        </div>

        {task.details && (
          <div
            className="border-b border-slate-200 dark:border-slate-800"
            style={{ paddingTop: "24px", paddingBottom: "24px", margin: 0 }}
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              {task.details}
            </p>
          </div>
        )}

            {sharedEmails.length > 0 && (
          <div
            className={cn(
              "border-b border-slate-200 dark:border-slate-800",
              !task.details && "pt-4"
            )}
            style={{ paddingBottom: "16px", margin: 0 }}
          >
            <p className="text-xs text-muted-foreground">
                Shared with: {sharedEmails.join(", ")}
              </p>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-4 flex-wrap">
            {task.refLink && (
              <a
                href={task.refLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
              >
                <Link2 className="h-3.5 w-3.5" />
                Reference
              </a>
            )}
            <span>
              Created{" "}
              {new Date(task._creationTime || Date.now()).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>

          {isOwner && (
            <button
              type="button"
              onClick={() => onToggle(task)}
              disabled={isMarkDoneDisabled}
              className={cn(
                "inline-flex items-center justify-center px-3 py-1.5 rounded-md font-medium text-xs transition-all hover:shadow-md",
                isCompleted
                  ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700"
                  : "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-800",
                isMarkDoneDisabled && "cursor-not-allowed opacity-60 hover:shadow-none hover:bg-emerald-100 dark:hover:bg-emerald-900",
              )}
              title={isMarkDoneDisabled ? "Assign this task to a project before marking it done." : undefined}
            >
              {isCompleted ? "↺ Reopen Task" : "✓ Mark Done"}
            </button>
          )}
        </div>

        {/* Refinement Section - Only show for shared tasks */}
        {showRefinement && sharedEmails.length > 0 && currentUserId && (
          <TaskRefinementSection
            taskId={task._id as Id<"tasks">}
            isOwner={isOwner}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </div>
  )
}

