import { createFileRoute } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useConvexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Id } from 'convex/_generated/dataModel'
import { useSession } from './route'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { AlertCircle, ArrowUpRight, Github, ListTodo, Loader2, User, Users, MessageSquare, GitBranch, CheckSquare } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { AddTaskModal } from '~/components/app/add-task-modal'
import { TaskCard, type TaskCardTask, type TaskEditForm, type TaskCardProject } from '~/components/app/task-card'
import { toast } from 'sonner'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/(authenticated)/refine')({
  component: RouteComponent,
})

type Task = {
  _id: string
  _creationTime?: number
  userId: string
  text: string
  details: string
  priority?: string
  status?: string
  hrs?: number
  startedAt?: number
  completedAt?: number
  trackedTimeMs?: number
  sharedWith?: string
  selectedBy?: string
  updatedAt?: number
  refLink?: string
  projectId?: Id<'projects'>
}

type PrefillTask = {
  text?: string
  refLink?: string
  projectId?: Id<'projects'>
}

type Project = {
  _id: Id<'projects'>
  name: string
  description?: string
  category?: string
  type?: string
  githubUrl?: string
  githubRepo?: string
}

type Collaborator = {
  _id: Id<'projectCollaborators'>
  projectId: Id<'projects'>
  userId?: string
  email: string
  role: string
  userName?: string
}

type GitHubIssue = {
  id: number
  number: number
  title: string
  html_url: string
  state: string
  created_at: string
  user?: {
    login?: string
  }
  labels?: Array<{
    id?: number
    name: string
  }>
}

type ProjectIssuesState = {
  status: 'idle' | 'loading' | 'success' | 'error'
  issues: GitHubIssue[]
  error?: string
}

const ISSUES_PER_PROJECT = 2

function extractGitHubRepoFromUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('github.com')) {
      return undefined
    }
    const segments = parsed.pathname.replace(/^\/+/, '').split('/')
    if (segments.length < 2) {
      return undefined
    }
    const owner = segments[0]?.trim()
    let repo = segments[1]?.trim() ?? ''
    if (repo.endsWith('.git')) {
      repo = repo.slice(0, -4)
    }
    if (!owner || !repo) {
      return undefined
    }
    return `${owner}/${repo}`
  } catch {
    return undefined
  }
}

function formatRelativeTime(dateInput: string): string {
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const diffInMs = Date.now() - date.getTime()
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24)

  if (diffInDays < 1) {
    const diffInHours = diffInMs / (1000 * 60 * 60)
    if (diffInHours < 1) {
      const diffInMinutes = Math.max(Math.round(diffInMs / (1000 * 60)), 0)
      if (diffInMinutes === 0) return 'just now'
      return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`
    }
    const roundedHours = Math.round(diffInHours)
    return `${roundedHours} hour${roundedHours === 1 ? '' : 's'} ago`
  }

  if (diffInDays < 7) {
    const roundedDays = Math.round(diffInDays)
    return `${roundedDays} day${roundedDays === 1 ? '' : 's'} ago`
  }

  const diffInWeeks = diffInDays / 7
  if (diffInWeeks < 5) {
    const roundedWeeks = Math.round(diffInWeeks)
    return `${roundedWeeks} week${roundedWeeks === 1 ? '' : 's'} ago`
  }

  const diffInMonths = diffInDays / 30
  if (diffInMonths < 12) {
    const roundedMonths = Math.round(diffInMonths)
    return `${roundedMonths} month${roundedMonths === 1 ? '' : 's'} ago`
  }

  const diffInYears = diffInDays / 365
  const roundedYears = Math.round(diffInYears)
  return `${roundedYears} year${roundedYears === 1 ? '' : 's'} ago`
}

function RouteComponent() {
  const session = useSession()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addTaskPrefill, setAddTaskPrefill] = useState<PrefillTask | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTaskForm, setEditTaskForm] = useState<TaskEditForm>({
    text: "",
    details: "",
    priority: "low",
    hrs: 1,
    refLink: "",
    projectId: "" as Id<"projects"> | "",
    sharedWith: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [viewMode, setViewMode] = useState<'owner' | 'collaborator'>('collaborator')
  const queryClient = useQueryClient()

  const updateTask = useConvexMutation(api.tasks.updateTask)
  const deleteTask = useConvexMutation(api.tasks.deleteTask)
  const shareTaskWithCollaborators = useConvexMutation((api.tasks as any).shareTaskWithCollaborators)
  const unshareTaskMutation = useConvexMutation((api.tasks as any).unshareTask)

  const tasks = useConvexQuery(
    api.tasks.listTasks,
    {}
  ) as Task[] | undefined

  const projects = useConvexQuery(
    api.projects.listProjects,
    {}
  ) as Project[] | undefined

  const allCollaborators = useConvexQuery(
    api.projects.getAllCollaborators,
    {}
  ) as Collaborator[] | undefined

  // Build email to userName mapping from all project collaborators
  const emailToNameMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!allCollaborators) return map
    
    allCollaborators.forEach((collaborator) => {
      const email = collaborator.email.toLowerCase().trim()
      if (collaborator.userName) {
        map.set(email, collaborator.userName)
      }
    })
    
    return map
  }, [allCollaborators])
  
  // Helper function to get display name (userName or email)
  const getDisplayName = (email: string): string => {
    const normalizedEmail = email.toLowerCase().trim()
    return emailToNameMap.get(normalizedEmail) || email
  }

  const projectOptions = useMemo<TaskCardProject[]>(() => {
    if (!projects) return []
    return projects.map((project) => ({
      _id: project._id,
      id: String(project._id),
      name: project.name,
      description: project.description,
      type: project.type,
      category: project.category,
      status: '',
      githubUrl: project.githubUrl,
    }))
  }, [projects])

  useEffect(() => {
    // Throttle updates to every 1 minute to reduce re-renders and improve performance
    const interval = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(interval)
  }, [])

  const computeTrackedTime = (task: Task) => {
    const base = task.trackedTimeMs ?? 0
    const normalizedStatus = (task.status || '').toLowerCase()
    const isRunning = normalizedStatus === 'in progress' || normalizedStatus === 'in-progress' || normalizedStatus === 'running'
    const active = task.startedAt && isRunning ? Math.max(0, now - task.startedAt) : 0
    return base + active
  }

  const formatDuration = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
  }

  const getProjectName = (projectId?: Id<"projects">) => {
    if (!projectId || !projects) return null
    return projects.find(p => p._id === projectId)?.name || null
  }

  const githubProjects = useMemo(() => {
    if (!projects) return []
    return projects.filter((project) => {
      const hasRepo = Boolean(project.githubRepo || extractGitHubRepoFromUrl(project.githubUrl))
      return hasRepo
    })
  }, [projects])

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [issueFetchNonce, setIssueFetchNonce] = useState(0)
  const [selectedProjectIssues, setSelectedProjectIssues] = useState<ProjectIssuesState>({
    status: 'idle',
    issues: [],
    error: undefined,
  })

  useEffect(() => {
    if (!githubProjects.length) {
      if (selectedProjectId !== null) {
        setSelectedProjectId(null)
      }
      return
    }

    const exists = githubProjects.some((project) => String(project._id) === selectedProjectId)
    if (!exists) {
      setSelectedProjectId(String(githubProjects[0]!._id))
    }
  }, [githubProjects, selectedProjectId])

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null
    return githubProjects.find((project) => String(project._id) === selectedProjectId) ?? null
  }, [githubProjects, selectedProjectId])

  useEffect(() => {
    if (!selectedProject) {
      setSelectedProjectIssues({ status: 'idle', issues: [], error: undefined })
      return
    }

    let cancelled = false

    const fetchIssues = async () => {
      setSelectedProjectIssues({ status: 'loading', issues: [], error: undefined })

      const repo = selectedProject.githubRepo || extractGitHubRepoFromUrl(selectedProject.githubUrl)
      if (!repo) {
        setSelectedProjectIssues({
          status: 'error',
          issues: [],
          error: 'Repository link missing',
        })
        return
      }

      try {
        // Fetch more issues to account for pull requests mixed in the results
        // GitHub API returns both issues and PRs, so we fetch 10 to ensure we get at least 2 issues
        const response = await fetch(
          `https://api.github.com/repos/${repo}/issues?per_page=10&sort=created&state=open`
        )

        if (!response.ok) {
          setSelectedProjectIssues({
            status: 'error',
            issues: [],
            error: `GitHub responded ${response.status}`,
          })
          return
        }

        const data = await response.json()
        const issues = Array.isArray(data)
          ? (data.filter((issue: any) => !issue.pull_request).slice(0, ISSUES_PER_PROJECT) as GitHubIssue[])
          : []

        if (cancelled) return

        setSelectedProjectIssues({
          status: 'success',
          issues,
          error: undefined,
        })
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Failed to load issues'
        setSelectedProjectIssues({
          status: 'error',
          issues: [],
          error: message,
        })
      }
    }

    fetchIssues()

    return () => {
      cancelled = true
    }
  }, [selectedProject, issueFetchNonce])

  const handleRetry = () => {
    setIssueFetchNonce((prev) => prev + 1)
  }

  // Helper to get shared emails
  const getSharedEmails = (sharedWith?: string): string[] => {
    if (!sharedWith) return []
    try {
      const emails = JSON.parse(sharedWith)
      return Array.isArray(emails) ? emails : []
    } catch {
      return []
    }
  }

  // Filter to show tasks that are either:
  // 1. Shared WITH the current user (so they can edit tasks owned by others)
  // 2. Owned BY the current user AND shared with others (so they can see what others edited)
  const userEmail = session?.user?.email
  const userId = session?.user?.id
  
  const sharedTasks = (tasks || []).filter(task => {
    if (!userEmail || !userId) return false
    
    const isOwnedByMe = task.userId === userId
    const sharedEmails = getSharedEmails(task.sharedWith)
    const isSharedWithMe = sharedEmails.includes(userEmail)
    const isSharedByMe = isOwnedByMe && sharedEmails.length > 0
    
    // Show if: task is shared with me OR I own it and shared it with others
    return isSharedWithMe || isSharedByMe
  })
  
  // Separate into two categories
  const tasksSharedWithMe = sharedTasks.filter(task => {
    if (task.userId === userId) return false
    const status = (task.status || '').toLowerCase()
    return !status || status === 'todo' || status === 'backlog' || status === 'not started'
  })
  const myTasksSharedWithOthers = sharedTasks.filter(task => {
    if (task.userId !== userId) return false
    const status = (task.status || '').toLowerCase()
    return !status || status === 'todo' || status === 'backlog' || status === 'not started'
  })

  const handleCancelEdit = () => {
    setEditingTaskId(null)
    setEditTaskForm({
      text: "",
      details: "",
      priority: "low",
      hrs: 1,
      refLink: "",
      projectId: "" as Id<"projects"> | "",
      sharedWith: "",
    })
  }

  const handleEditTask = (task: Task) => {
    setEditingTaskId(task._id)
    const sharedEmails = getSharedEmails(task.sharedWith)
    setEditTaskForm({
      text: task.text,
      details: task.details || "",
      priority: (task.priority || "low") as "low" | "medium" | "high",
      hrs: task.hrs || 1,
      refLink: task.refLink || "",
      projectId: task.projectId || ("" as Id<"projects"> | ""),
      sharedWith: sharedEmails.join(", "),
    })
  }

  const handleSubmitEdit = async () => {
    if (!editingTaskId || !editTaskForm.text.trim()) {
      return
    }

    const taskId = editingTaskId
    setIsSubmitting(true)
    try {
      const sharedWithJson = editTaskForm.sharedWith
        ? JSON.stringify(editTaskForm.sharedWith.split(",").map((email: string) => email.trim()).filter((email: string) => email))
        : undefined

      await updateTask({
        taskId: taskId as Id<"tasks">,
        text: editTaskForm.text,
        details: editTaskForm.details || "",
        priority: editTaskForm.priority,
        hrs: editTaskForm.hrs,
        refLink: editTaskForm.refLink || "",
        projectId: (editTaskForm.projectId || undefined) as Id<"projects"> | undefined,
        sharedWith: sharedWithJson,
      })
      
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey
        return Array.isArray(key) && key[0] === api.tasks.listTasks
      }})
      
      setEditingTaskId(null)
      setEditTaskForm({
        text: "",
        details: "",
        priority: "low",
        hrs: 1,
        refLink: "",
        projectId: "" as Id<"projects"> | "",
        sharedWith: "",
      })
      toast.success("Task updated successfully!")
    } catch (error) {
      console.error("Failed to update task:", error)
      toast.error("Failed to update task. Please try again.")
      setEditingTaskId(taskId)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleTask = async (task: Task) => {
    const currentStatus = task.status || 'todo'
    const newStatus = currentStatus === 'done' ? 'todo' : 'done'
    try {
      await updateTask({
        taskId: task._id as Id<"tasks">,
        status: newStatus,
      })
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey
        return Array.isArray(key) && key[0] === api.tasks.listTasks
      }})
    } catch (error) {
      console.error('Failed to toggle task:', error)
      toast.error('Failed to update task. Please try again.')
    }
  }

  const handleDeleteTask = async (task: Task) => {
    try {
      await deleteTask({ taskId: task._id as Id<"tasks"> })
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey
        return Array.isArray(key) && key[0] === api.tasks.listTasks
      }})
      toast.success("Task deleted successfully")
    } catch (error) {
      console.error('Failed to delete task:', error)
      toast.error('Failed to delete task. Please try again.')
    }
  }

  const handleShareTask = async (task: Task) => {
    try {
      const result = await shareTaskWithCollaborators({ taskId: task._id as Id<"tasks"> })
      if (!result?.success) {
        toast.info(result?.message || "No collaborators to share with yet")
      } else if (result.added === 0) {
        toast.info(result.message || "Task already shared with collaborators")
      } else {
        toast.success(result.message || "Task shared with project collaborators")
      }
      queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey
        return Array.isArray(key) && key[0] === api.tasks.listTasks
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to share task"
      toast.error(message)
    }
  }

  const handleUnshareTask = async (task: Task) => {
    try {
      await unshareTaskMutation({
        taskId: task._id as Id<"tasks">,
      })
      toast.success("Task unshared from collaborators")
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey
          return Array.isArray(key) && key[0] === api.tasks.listTasks
        },
      })
    } catch (error) {
      console.error('Failed to unshare task:', error)
      toast.error('Failed to unshare task. Please try again.')
    }
  }


  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-6 text-foreground">
            Review Center
        </h1>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <MessageSquare className="h-5 w-5 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <p className="text-base font-semibold leading-relaxed text-blue-700 dark:text-blue-300">
                Task discussion and refinement
              </p>
            </div>
            <div className="flex items-start gap-2">
              <GitBranch className="h-5 w-5 mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <p className="text-base font-semibold leading-relaxed text-emerald-700 dark:text-emerald-300">
                Review new issues from <span className="font-bold text-emerald-800 dark:text-emerald-200">GitHub</span>
              </p>
            </div>
          </div>
        </div>
        {sharedTasks.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white/90 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('collaborator')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                viewMode === 'collaborator'
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              )}
            >
              <Users className="h-4 w-4" />
              Collaborator
            </button>
            <button
              type="button"
              onClick={() => setViewMode('owner')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                viewMode === 'owner'
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              )}
            >
              <User className="h-4 w-4" />
              Owner
            </button>
          </div>
        )}
      </div>

      {sharedTasks.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground text-lg">
            No shared tasks available to refine.
          </p>
          <p className="text-muted-foreground/70 text-sm mt-2">
            Tasks shared with you or tasks you've shared with others will appear here.
          </p>
        </Card>
      ) : (
        <div className="mt-12 pt-10 border-t border-slate-200 dark:border-slate-800">
          {/* Collaborator View - Tasks Shared WITH Me */}
          {viewMode === 'collaborator' && tasksSharedWithMe.length > 0 && (
        <div>
              <h2 className="text-xl font-semibold mb-6 text-foreground flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                From Collaborator ({tasksSharedWithMe.length} task{tasksSharedWithMe.length !== 1 ? 's' : ''})
              </h2>
              <div className="flex flex-col items-center gap-6">
                {tasksSharedWithMe.map((task, index) => {
                  const normalizedStatus = (task.status || '').toLowerCase()
                  const totalTrackedMs = computeTrackedTime(task)
                  const isRunningTask =
                    normalizedStatus === 'in progress' ||
                    normalizedStatus === 'in-progress' ||
                    normalizedStatus === 'running'
                  const runningTimeLabel = totalTrackedMs > 0 ? formatDuration(totalTrackedMs) : null

                  const typedTask: TaskCardTask = {
                    ...task,
                    priority: task.priority ?? undefined,
                    status: task.status,
                    hrs: task.hrs ?? undefined,
                    startedAt: task.startedAt ? new Date(task.startedAt) : null,
                    completedAt: task.completedAt ? new Date(task.completedAt) : null,
                    trackedTimeMs: task.trackedTimeMs ?? undefined,
                  }
                  const projectName = typedTask.projectId ? getProjectName(typedTask.projectId) : null
                  const sharedEmails = getSharedEmails(typedTask.sharedWith)
                  const sharedDisplayNames = sharedEmails.map(email => getDisplayName(email))
                  const isOwner = session?.user?.id === typedTask.userId

                              return (
                    <div
                      key={typedTask._id}
                      className="mx-auto w-full max-w-3xl"
                      style={{ paddingTop: index === 0 ? "12px" : "32px" }}
                    >
                      <TaskCard
                        task={typedTask}
                        projectName={projectName}
                        isOwner={isOwner}
                        sharedEmails={sharedDisplayNames}
                        isEditing={editingTaskId === typedTask._id}
                        editForm={editTaskForm}
                        isSubmitting={isSubmitting}
                        projects={projectOptions}
                        wrapperStyle={{ margin: 0 }}
                        onEdit={() => handleEditTask(task)}
                        onDelete={() => handleDeleteTask(task)}
                        onToggle={() => handleToggleTask(task)}
                        onShare={() => handleShareTask(task)}
                        onUnshare={() => handleUnshareTask(task)}
                        onCancelEdit={handleCancelEdit}
                        onSaveEdit={handleSubmitEdit}
                        onEditFormChange={setEditTaskForm}
                        runningTimeLabel={runningTimeLabel}
                        isRunning={isRunningTask}
                        showRefinement={true}
                        currentUserId={session?.user?.id || ""}
                      />
                          </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Owner View - My Tasks Shared With Others */}
          {viewMode === 'owner' && myTasksSharedWithOthers.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-6 text-foreground flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                To Collaborator ({myTasksSharedWithOthers.length} task{myTasksSharedWithOthers.length !== 1 ? 's' : ''})
              </h2>
              <div className="flex flex-col items-center gap-6">
                {myTasksSharedWithOthers.map((task, index) => {
                  const normalizedStatus = (task.status || '').toLowerCase()
                  const totalTrackedMs = computeTrackedTime(task)
                  const isRunningTask =
                    normalizedStatus === 'in progress' ||
                    normalizedStatus === 'in-progress' ||
                    normalizedStatus === 'running'
                  const runningTimeLabel = totalTrackedMs > 0 ? formatDuration(totalTrackedMs) : null

                  const typedTask: TaskCardTask = {
                    ...task,
                    priority: task.priority ?? undefined,
                    status: task.status,
                    hrs: task.hrs ?? undefined,
                    startedAt: task.startedAt ? new Date(task.startedAt) : null,
                    completedAt: task.completedAt ? new Date(task.completedAt) : null,
                    trackedTimeMs: task.trackedTimeMs ?? undefined,
                  }
                  const projectName = typedTask.projectId ? getProjectName(typedTask.projectId) : null
                  const sharedEmails = getSharedEmails(typedTask.sharedWith)
                  const sharedDisplayNames = sharedEmails.map(email => getDisplayName(email))
                  const isOwner = session?.user?.id === typedTask.userId

                        return (
                    <div
                      key={typedTask._id}
                      className="mx-auto w-full max-w-3xl"
                      style={{ paddingTop: index === 0 ? "12px" : "32px" }}
                    >
                      <TaskCard
                        task={typedTask}
                        projectName={projectName}
                        isOwner={isOwner}
                        sharedEmails={sharedDisplayNames}
                        isEditing={editingTaskId === typedTask._id}
                        editForm={editTaskForm}
                        isSubmitting={isSubmitting}
                        projects={projectOptions}
                        wrapperStyle={{ margin: 0 }}
                        onEdit={() => handleEditTask(task)}
                        onDelete={() => handleDeleteTask(task)}
                        onToggle={() => handleToggleTask(task)}
                        onShare={() => handleShareTask(task)}
                        onUnshare={() => handleUnshareTask(task)}
                        onCancelEdit={handleCancelEdit}
                        onSaveEdit={handleSubmitEdit}
                        onEditFormChange={setEditTaskForm}
                        runningTimeLabel={runningTimeLabel}
                        isRunning={isRunningTask}
                        showRefinement={true}
                        currentUserId={session?.user?.id || ""}
                      />
                    </div>
                  )
                })}
                  </div>
                </div>
          )}

          {/* Empty state for Collaborator view */}
          {viewMode === 'collaborator' && tasksSharedWithMe.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground text-lg">
                No tasks shared with you yet.
              </p>
              <p className="text-muted-foreground/70 text-sm mt-2">
                Tasks that others share with you will appear here.
              </p>
            </Card>
          )}

          {/* Empty state for Owner view */}
          {viewMode === 'owner' && myTasksSharedWithOthers.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground text-lg">
                No tasks shared with others yet.
              </p>
              <p className="text-muted-foreground/70 text-sm mt-2">
                Tasks you share with others will appear here.
              </p>
            </Card>
      )}
        </div>
      )}
      
      <section className="mt-12 pt-10 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold mb-3 text-foreground flex items-center gap-2">
            <Github className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            GitHub Issue Radar
          </h2>
          <p className="text-muted-foreground text-sm max-w-[640px] leading-relaxed">
            We pull the two newest open issues from the project you pick—perfect for spotting what needs attention next.
          </p>
        </div>

        {projects === undefined ? (
          <Card className="p-8 flex items-center justify-center gap-3 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-muted-foreground text-sm font-medium">
              Loading linked projects…
            </span>
          </Card>
        ) : githubProjects.length === 0 ? (
          <Card className="p-8 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <Github className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground text-sm m-0 leading-relaxed">
              Add a GitHub repository URL to one of your projects and it will appear here for quick issue syncing.
            </p>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Github className="h-4 w-4 text-muted-foreground" />
                Project
              </label>
              <div className="min-w-[240px] flex-1">
                <Select
                  value={selectedProjectId ?? undefined}
                  onValueChange={(value) => setSelectedProjectId(value)}
                >
                  <SelectTrigger className="w-full bg-white dark:bg-slate-800">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {githubProjects.map((project) => (
                      <SelectItem key={project._id} value={String(project._id)}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedProject ? (
              <Card className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex flex-col gap-6">
                  <div className="flex justify-between items-start gap-4 flex-wrap pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex-[1_1_320px]">
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <Github className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <h3 className="text-xl font-bold text-foreground m-0">
                          {selectedProject.name}
                        </h3>
                      </div>
                      {(() => {
                        const repoSlug =
                          selectedProject.githubRepo || extractGitHubRepoFromUrl(selectedProject.githubUrl)
                        if (!repoSlug) return null
                        return (
                          <a
                            href={`https://github.com/${repoSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 no-underline hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                          >
                            {repoSlug}
                            <ArrowUpRight size={14} />
                          </a>
                        )
                      })()}
                      {selectedProject.description && selectedProject.description.trim().length > 0 && (
                        <p className="text-muted-foreground text-sm mt-3 mb-0 leading-relaxed">
                          {selectedProject.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                      Latest Issues
                    </Badge>
                  </div>

                  {selectedProjectIssues.status === 'loading' || selectedProjectIssues.status === 'idle' ? (
                    <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium">Syncing GitHub issues…</span>
                    </div>
                  ) : selectedProjectIssues.status === 'error' ? (
                    <div className="flex flex-col gap-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <AlertCircle className="h-5 w-5" />
                        <span className="text-sm font-semibold">We couldn&apos;t load issues for this repository.</span>
                      </div>
                      <div className="flex flex-wrap gap-3 items-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRetry}
                          className="px-4 py-2 text-xs border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40"
                        >
                          Try again
                        </Button>
                        {selectedProjectIssues.error && (
                          <span className="text-red-600 dark:text-red-500 text-xs">
                            {selectedProjectIssues.error}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : selectedProjectIssues.issues.length === 0 ? (
                    <div className="text-center py-8">
                      <Github className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground text-sm font-medium m-0">
                      No open issues found in the latest sync.
                    </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {selectedProjectIssues.issues.map((issue, index) => (
                        <div
                          key={issue.id}
                          className="border border-slate-200 dark:border-slate-800 rounded-lg p-5 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors flex flex-col gap-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <a
                              href={issue.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-start gap-2 text-sm font-semibold text-foreground no-underline flex-[1_1_auto] min-w-0 hover:text-blue-600 dark:hover:text-blue-400 group transition-colors"
                            >
                              <span className="text-muted-foreground font-mono text-xs mt-0.5">#{issue.number}</span>
                              <span className="flex-[1_1_auto] min-w-0 leading-snug">{issue.title}</span>
                              <ArrowUpRight size={16} className="mt-0.5 text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-shrink-0" />
                            </a>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                if (!selectedProject) return
                                setAddTaskPrefill({
                                  text: `${issue.title} #${issue.number}`,
                                  refLink: issue.html_url,
                                  projectId: selectedProject._id,
                                })
                                setIsAddModalOpen(true)
                              }}
                              className="inline-flex items-center gap-1.5 whitespace-nowrap bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/50 border-blue-200 dark:border-blue-800"
                            >
                              <ListTodo size={14} />
                              Add Task
                            </Button>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap text-muted-foreground text-xs">
                            <Badge variant="outline" className="text-[0.65rem] px-2 py-0.5 capitalize bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                              {issue.state}
                            </Badge>
                            {issue.user?.login && (
                              <>
                                <span className="text-slate-400 dark:text-slate-600">•</span>
                                <span className="font-medium">by {issue.user.login}</span>
                              </>
                            )}
                            <span className="text-slate-400 dark:text-slate-600">•</span>
                            <span>{formatRelativeTime(issue.created_at)}</span>
                          </div>
                          {Array.isArray(issue.labels) && issue.labels.length > 0 && (
                            <div className="flex gap-2 flex-wrap pt-1">
                              {issue.labels.slice(0, 3).map((label) => (
                                <Badge
                                  key={`${issue.id}-${label.id ?? label.name}`}
                                  variant="outline"
                                  className="text-[0.65rem] px-2 py-0.5 normal-case bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                >
                                  {label.name}
                                </Badge>
                              ))}
                              {issue.labels.length > 3 && (
                                <Badge variant="outline" className="text-[0.65rem] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700">
                                  +{issue.labels.length - 3} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </section>

      <AddTaskModal
        open={isAddModalOpen}
        onOpenChange={(open) => {
          setIsAddModalOpen(open)
          if (!open) {
            setAddTaskPrefill(null)
            queryClient.invalidateQueries({
              predicate: (query) => {
                const key = query.queryKey
                return Array.isArray(key) && key[0] === api.tasks.listTasks
              }
            })
          }
        }}
        projectId={addTaskPrefill?.projectId}
        initialTask={addTaskPrefill ?? undefined}
      />
    </main>
  )
}

