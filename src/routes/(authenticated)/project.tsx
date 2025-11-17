import { createFileRoute, Link } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useConvexQuery, useConvexMutation, useConvexAction } from '@convex-dev/react-query'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Id } from 'convex/_generated/dataModel'
import { useSession } from './route'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Plus, FolderKanban, Trash2, Users, CheckSquare, FolderOpen, Sparkles, List, LayoutGrid } from 'lucide-react'
import { Badge } from '~/components/ui/badge'
import { AddProjectModal } from '~/components/app/add-project-modal'
import { EditProjectModal } from '~/components/app/edit-project-modal'
import { AddTaskModal } from '~/components/app/add-task-modal'
import { ImageAnalyticsModal } from '~/components/app/image-analytics-modal'
import { TaskCard, type TaskCardTask, type TaskEditForm, type TaskCardProject } from '~/components/app/task-card'
import { SidebarProjectCard } from '~/components/app/sidebar-project-card'
import { useQueryClient } from '@tanstack/react-query'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Dock, DockIcon } from "~/components/magicui/dock"
import { PendingInvitations } from "~/components/app/pending-invitations"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"

// Icon components for Dock
const AddTaskIcon = (props: React.HTMLAttributes<SVGElement>) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

export const Route = createFileRoute('/(authenticated)/project')({
  component: ProjectsPage,
})

type Project = {
  _id: Id<"projects">
  _creationTime: number
  id: string
  name: string
  description: string
  type?: string
  category?: string
  status: string
  websiteUrl?: string
  githubUrl?: string
  githubStars?: number
  githubForks?: number
  npmDownloads?: number
  githubRepo?: string
  npmPackage?: string
  userId: string
  createdAt?: number
  updatedAt?: number
  userRole?: string
}

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
  refLink?: string
  projectId?: Id<"projects">
  analysisData?: string
}

type Collaborator = {
  _id: Id<'projectCollaborators'>
  projectId: Id<'projects'>
  userId?: string
  email: string
  role: string
  userName?: string
}

type TaskForEdit = {
  _id: string
  text: string
  details: string
  priority?: string
  status?: string
  hrs?: number
  sharedWith?: string
  refLink?: string
  projectId?: Id<"projects">
}

function ProjectsPage() {
  const session = useSession()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false)
  const [isImageAnalyticsOpen, setIsImageAnalyticsOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<Id<"projects"> | null>(null)
  const [filterProject, setFilterProject] = useState<'all' | 'none' | Id<"projects">>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'details' | 'brief'>('details')
  const [now, setNow] = useState(() => Date.now())
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [collaborationProject, setCollaborationProject] = useState<Project | null>(null)
  const queryClient = useQueryClient()

  const createDefaultEditForm = (): TaskEditForm => ({
    text: "",
    details: "",
    priority: "low",
    hrs: 1,
    refLink: "",
    projectId: "" as Id<"projects"> | "",
    sharedWith: "",
  })

  const projects = useConvexQuery(
    api.projects.listProjects,
    {}
  ) as Array<Project> | undefined

  const allTasks = useConvexQuery(
    api.tasks.listTasks,
    {}
  ) as Task[] | undefined

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

  const filteredTasks = useMemo(() => {
    const baseTasks =
      filterProject === 'all'
        ? allTasks ?? []
        : filterProject === 'none'
          ? (allTasks ?? []).filter((task) => !task.projectId)
        : (allTasks ?? []).filter((task) => task.projectId === filterProject)

    return baseTasks.filter((task) => {
      const normalizedStatus = (task.status || '').toLowerCase()
      const normalizedPriority = (task.priority || '').toLowerCase()

      if (statusFilter !== 'all' && normalizedStatus !== statusFilter) {
        return false
      }

      if (priorityFilter !== 'all' && normalizedPriority !== priorityFilter) {
        return false
      }

      return true
    })
  }, [allTasks, filterProject, statusFilter, priorityFilter])

  const statusOptions = useMemo(() => {
    const set = new Set<string>()
    if (Array.isArray(allTasks)) {
      allTasks.forEach((task) => {
        const normalized = (task.status || '').toLowerCase()
        if (normalized) {
          set.add(normalized)
        }
      })
    }
    return ['all', ...Array.from(set).sort()]
  }, [allTasks])

  const priorityOptions = useMemo(() => {
    const set = new Set<string>()
    if (Array.isArray(allTasks)) {
      allTasks.forEach((task) => {
        const normalized = (task.priority || '').toLowerCase()
        if (normalized) {
          set.add(normalized)
        }
      })
    }
    return ['all', ...Array.from(set).sort()]
  }, [allTasks])

  const projectFilterOptions = useMemo(() => {
    const items: Array<{ value: 'all' | 'none' | Id<"projects">; label: string }> = [
      { value: 'all', label: 'All Projects' },
      { value: 'none', label: 'No Project' },
    ]
    if (Array.isArray(projects)) {
      projects.forEach((project) => {
        items.push({ value: project._id, label: project.name || 'Untitled Project' })
      })
    }
    return items
  }, [projects])

  const formatFilterLabel = (value: string) => {
    if (value === 'all') return 'All'
    return value
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ')
  }

  const getProjectName = (projectId?: Id<"projects">) => {
    if (!projectId || !projects) return null
    return projects.find(p => p._id === projectId)?.name || null
  }

  const getProject = (projectId?: Id<"projects">): Project | null => {
    if (!projectId || !projects) return null
    return projects.find(p => p._id === projectId) || null
  }

  const isTaskShared = (task: Task) => {
    return task.userId !== session?.user?.id
  }

  const getSharedEmails = (sharedWith?: string): string[] => {
    if (!sharedWith) return []
    try {
      const emails = JSON.parse(sharedWith)
      return Array.isArray(emails) ? emails : []
    } catch {
      return []
    }
  }

  const parseSharedWith = (sharedWith?: string): string[] => {
    if (!sharedWith) return []
    try {
      const emails = JSON.parse(sharedWith)
      return Array.isArray(emails) ? emails : []
    } catch {
      return []
    }
  }

  const deleteProject = useConvexMutation(api.projects.deleteProject)
  const updateTask = useConvexMutation(api.tasks.updateTask)
  const deleteTask = useConvexMutation(api.tasks.deleteTask)
  const updateProject = useConvexMutation(api.projects.updateProject)
  const inviteCollaborator = useConvexAction((api.projects as any).inviteProjectCollaborator)
  const shareTaskWithCollaborators = useConvexMutation((api.tasks as any).shareTaskWithCollaborators)
  const unshareTaskMutation = useConvexMutation((api.tasks as any).unshareTask)
  const removeCollaborator = useConvexMutation((api.projects as any).removeProjectCollaborator)

  // Edit Task Form State
  const [editTaskForm, setEditTaskForm] = useState<TaskEditForm>(createDefaultEditForm)

  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const handleCancelEdit = () => {
    setEditingTaskId(null)
    setEditTaskForm(createDefaultEditForm())
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
      setEditTaskForm(createDefaultEditForm())
      toast.success("Task updated successfully!")
    } catch (error) {
      console.error("Failed to update task:", error)
      toast.error("Failed to update task. Please try again.")
      setEditingTaskId(taskId)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleImageAnalysisTasksCreated = useCallback(async () => {
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey
        return Array.isArray(key) && key[0] === api.tasks.listTasks
      },
    })
  }, [queryClient])

  const handleDeleteProject = async (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
      try {
        await deleteProject({ projectId: project._id })
        if (selectedProjectId === project._id) {
          setSelectedProjectId(null)
          setFilterProject('all')
        }
        queryClient.invalidateQueries({ predicate: (query) => {
          const key = query.queryKey
          return Array.isArray(key) && (key[0] === api.projects.listProjects || key[0] === api.projects.getProject)
        }})
      } catch (error) {
        console.error('Failed to delete project:', error)
        alert('Failed to delete project. Please try again.')
      }
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
      alert('Failed to update task. Please try again.')
    }
  }

  const handleDeleteTask = async (task: Task) => {
    try {
      await deleteTask({ taskId: task._id as Id<"tasks"> })
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey
        return Array.isArray(key) && key[0] === api.tasks.listTasks
      }})
    } catch (error) {
      console.error('Failed to delete task:', error)
      alert('Failed to delete task. Please try again.')
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

  const handleProjectSelect = (projectId: Id<"projects"> | string | null) => {
    if (projectId) {
      const foundProject = projects?.find(p => p.id === projectId || p._id === projectId)
      if (foundProject) {
        setSelectedProjectId(foundProject._id)
        setFilterProject(foundProject._id)
      }
    } else {
      setSelectedProjectId(null)
      setFilterProject('all')
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">Please log in to view projects.</p>
          <Link to="/login">
            <Button size="lg">Log In</Button>
          </Link>
        </div>
      </div>
    )
  }
  const projectOptions = useMemo<TaskCardProject[]>(() => {
    if (!projects) return []
    return projects.map((project) => ({
      _id: project._id,
      id: project.id,
      name: project.name,
      description: project.description,
      type: project.type,
      category: project.category,
      status: project.status,
      githubUrl: project.githubUrl,
      userRole: project.userRole,
    }))
  }, [projects])

  const totalTasks = filteredTasks.length
  const completedTasks = filteredTasks.filter((task) => {
    const normalized = (task.status || '').toLowerCase()
    return normalized === 'done' || normalized === 'completed'
  }).length

  const inProgressTasks = filteredTasks.filter((task) => {
    const normalized = (task.status || '').toLowerCase()
    return normalized === 'in progress' || normalized === 'in-progress' || normalized === 'running'
  }).length

  const backlogTasks = filteredTasks.filter((task) => {
    const normalized = (task.status || '').toLowerCase()
    return (
      !normalized ||
      normalized === 'not started' ||
      normalized === 'todo' ||
      normalized === 'backlog'
    )
  }).length

  const selectedProject =
    filterProject === 'all'
      ? null
      : projects?.find((project) => project._id === filterProject) ?? null

  const ownedProjects = useMemo(() => {
    if (!projects) return []
    return projects.filter((project) => project.userRole === 'owner')
  }, [projects])

  const sharedProjects = useMemo(() => {
    if (!projects) return []
    return projects.filter((project) => project.userRole !== 'owner')
  }, [projects])

  return (
    <TooltipProvider>
      <div className="h-screen bg-white dark:bg-slate-900 flex">
        {/* Left Sidebar */}
        {session && (
          <div className="w-16 sm:w-64 lg:w-[25rem] xl:w-[27rem] bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 shadow-xl flex flex-col">
            {/* Sidebar Header */}
            <div className="pt-1 pl-2 pr-1 pb-0 sm:pt-2 sm:pl-3 sm:pr-1.5 sm:pb-0 lg:pt-3 lg:pl-2 lg:pr-1 lg:pb-0">
              {/* Desktop Dock in Header */}
              <div className="hidden lg:block flex justify-center -mx-2 pb-2 mb-1">
                <Dock iconMagnification={50} iconDistance={80} className="bg-gray-100 dark:bg-slate-800 !mt-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <DockIcon className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 cursor-pointer">
                        <Plus className="w-4 h-4" />
                      </DockIcon>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="center"
                      side="bottom"
                      className="z-50 mt-2 w-48 rounded-xl border border-slate-200/80 bg-white/95 p-1 shadow-2xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-800 dark:ring-slate-700"
                    >
                      <DropdownMenuItem
                        onClick={() => setIsAddTaskModalOpen(true)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-900 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50"
                      >
                        <CheckSquare className="h-4 w-4" />
                        New Task
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-900 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50"
                      >
                        <FolderOpen className="h-4 w-4" />
                        New Project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DockIcon
                        className="bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-white"
                        onClick={() => setIsImageAnalyticsOpen(true)}
                      >
                        <Sparkles className="h-4 w-4" />
                      </DockIcon>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Analyze image</TooltipContent>
                  </Tooltip>
                </Dock>
              </div>
            </div>
            
            {/* Sidebar Controls - Mobile View */}
            <div className="flex-1 p-2 sm:p-3 lg:hidden space-y-2 sm:space-y-3">
              <button
                type="button"
                onClick={() => setIsAddTaskModalOpen(true)}
                className="w-full inline-flex items-center justify-center sm:justify-start gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3.5 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 font-semibold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-xs sm:text-sm transform hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <div className="w-5 h-5 bg-white/20 dark:bg-black/20 rounded-full flex items-center justify-center">
                  <AddTaskIcon className="w-3.5 h-3.5" />
                </div>
                <span className="hidden sm:inline">Add New Task</span>
              </button>

              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="w-full inline-flex items-center justify-center sm:justify-start gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3.5 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 font-semibold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-xs sm:text-sm transform hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <div className="w-5 h-5 bg-white/20 dark:bg-black/20 rounded-full flex items-center justify-center">
                  <FolderOpen className="w-3.5 h-3.5" />
                </div>
                <span className="hidden sm:inline">New Project</span>
              </button>

              <button
                type="button"
                onClick={() => setIsImageAnalyticsOpen(true)}
                className="w-full inline-flex items-center justify-center sm:justify-start gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3.5 bg-sky-600 dark:bg-sky-500 text-white hover:bg-sky-700 dark:hover:bg-sky-400 font-semibold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-xs sm:text-sm transform hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="hidden sm:inline">Analyze Image</span>
              </button>
            </div>

            {/* Projects Section */}
            <div className="flex-1 px-3 sm:px-4 py-2 sm:py-3 space-y-4 overflow-y-auto">
              <div className="mb-4"></div>
              
              {projects && projects.length > 0 ? (
                <div className="hidden sm:flex sm:flex-col sm:gap-10">
                  {ownedProjects.length > 0 && (
                    <div className="flex flex-col gap-6">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        My Projects
                      </p>
                      <div className="flex flex-col gap-6">
                        {ownedProjects.map((project) => (
                          <SidebarProjectCard
                            key={project._id}
                            project={{
                              _id: project._id,
                              id: project.id,
                              name: project.name,
                              description: project.description,
                              status: project.status,
                              githubUrl: project.githubUrl,
                              githubStars: project.githubStars,
                              githubForks: project.githubForks,
                              npmDownloads: project.npmDownloads,
                              userRole: project.userRole,
                            }}
                            isSelected={selectedProjectId === project._id}
                            onSelect={handleProjectSelect}
                            onShowCollaborators={() => {
                              setCollaborationProject(project)
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {sharedProjects.length > 0 && (
                    <div className="mt-8 flex flex-col gap-6 pt-2">
                      <p className="pt-1 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Shared With Me
                      </p>
                      <div className="flex flex-col gap-6">
                        {sharedProjects.map((project) => (
                          <SidebarProjectCard
                            key={project._id}
                            project={{
                              _id: project._id,
                              id: project.id,
                              name: project.name,
                              description: project.description,
                              status: project.status,
                              githubUrl: project.githubUrl,
                              githubStars: project.githubStars,
                              githubForks: project.githubForks,
                              npmDownloads: project.npmDownloads,
                              userRole: project.userRole,
                            }}
                            isSelected={selectedProjectId === project._id}
                            onSelect={handleProjectSelect}
                            onShowCollaborators={() => {
                              setCollaborationProject(project)
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 hidden sm:block">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    </div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-slate-200 mb-2">No projects yet</h3>
                  <p className="text-xs text-gray-600 dark:text-slate-400 mb-4">Create your first project to get started</p>
                  <Button
                    size="sm"
                    className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                    onClick={() => setIsModalOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Project
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content - Tasks */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
          <div className="px-4 pt-3 pb-6 sm:px-6 sm:pt-4 lg:px-8 lg:pt-5">
            <div className="max-w-5xl mx-auto w-full">
              {/* Header Section */}
              <div className="mb-4 flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  {filterProject === 'all'
                    ? 'Task List'
                    : filterProject === 'none'
                      ? 'Unassigned Tasks'
                    : getProjectName(filterProject) || 'Task List'}
                </h1>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white/90 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setViewMode('details')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                      viewMode === 'details'
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                    )}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('brief')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                      viewMode === 'brief'
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                    )}
                  >
                    <List className="h-4 w-4" />
                    Brief
                  </button>
                </div>
              </div>

              <PendingInvitations className="mb-2" />

              {/* Metrics Section */}
              <div className="flex justify-center" style={{ marginTop: "56px", marginBottom: "40px" }}>
                <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                    <p className="text-xs text-muted-foreground dark:text-slate-400">Total Tasks</p>
                    <p className="mt-1 text-2xl font-bold text-foreground dark:text-slate-100">{totalTasks}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/60 p-4 shadow-sm">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">Completed</p>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{completedTasks}</p>
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 whitespace-nowrap">
                        ({totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)}% done)
                    </p>
                  </div>
                  </div>
                  <div className="rounded-2xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/60 p-4 shadow-sm">
                    <p className="text-xs text-blue-700 dark:text-blue-300">In Progress</p>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">{inProgressTasks}</p>
                      <p className="text-xs text-blue-700/80 dark:text-blue-300/80 whitespace-nowrap">
                        ({backlogTasks} waiting to start)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Task Filters */}
              <div className="flex justify-center mb-6">
                <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Project
                    </p>
                    <Select
                      value={filterProject === 'all' ? 'all' : filterProject === 'none' ? 'none' : (filterProject as string)}
                      onValueChange={(value) => {
                        if (value === 'all') {
                          setFilterProject('all')
                        } else if (value === 'none') {
                          setFilterProject('none')
                        } else {
                          setFilterProject(value as Id<"projects">)
                        }
                      }}
                    >
                      <SelectTrigger className="flex h-9 items-center justify-between rounded-lg border border-slate-200/80 bg-white/90 px-3 text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 rounded-xl border border-slate-200/80 bg-white/95 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                        {projectFilterOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value as string}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Status
                    </p>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="flex h-9 items-center justify-between rounded-lg border border-slate-200/80 bg-white/90 px-3 text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 rounded-xl border border-slate-200/80 bg-white/95 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                        {statusOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {formatFilterLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between w-full">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Priority
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setFilterProject('all')
                          setStatusFilter('all')
                          setPriorityFilter('all')
                        }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline-offset-2 hover:underline transition-colors whitespace-nowrap"
                      >
                        Clear Filters
                      </button>
                    </div>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger className="flex h-9 items-center justify-between rounded-lg border border-slate-200/80 bg-white/90 px-3 text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 rounded-xl border border-slate-200/80 bg-white/95 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                        {priorityOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {formatFilterLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {filteredTasks.length === 0 ? (
                <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 shadow-inner">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700/50">
                    <FolderKanban className="h-10 w-10 text-muted-foreground dark:text-slate-400" />
                  </div>
                  <h3 className="text-2xl font-semibold text-foreground mb-3">
                  {filterProject === 'all'
                    ? 'No tasks yet'
                    : filterProject === 'none'
                      ? 'No unassigned tasks yet'
                      : 'No tasks in this project'}
                </h3>
                  <p className="text-muted-foreground dark:text-slate-400 max-w-md mx-auto mb-8">
                  {filterProject === 'all'
                      ? 'Create your first task to get started and stay organized.'
                    : filterProject === 'none'
                      ? 'Assign tasks to a project to organize them better.'
                      : 'Add tasks to this project to track your progress.'}
                </p>
                <Button 
                  onClick={() => setIsAddTaskModalOpen(true)}
                  size="lg"
                    className="shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Task
                </Button>
              </div>
            ) : viewMode === 'brief' ? (
              <div className="mt-8 w-full max-w-6xl mx-auto" style={{ paddingTop: "12px" }}>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            Project Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            Main Task Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            Priority
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            Estimate Hour
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                        {filteredTasks.map((task) => {
                          const projectName = task.projectId ? getProjectName(task.projectId) : 'Unassigned'
                          const priority = task.priority || 'low'
                          const estimateHours = task.hrs || 0
                          const status = task.status || 'todo'
                          
                          const getPriorityBadgeColor = (priority: string) => {
                            switch (priority.toLowerCase()) {
                              case 'high':
                                return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                              case 'medium':
                                return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                              case 'low':
                                return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                              default:
                                return 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300'
                            }
                          }
                          
                          const getStatusBadgeColor = (status: string) => {
                            const normalizedStatus = status.toLowerCase()
                            if (normalizedStatus === 'done' || normalizedStatus === 'completed') {
                              return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            } else if (normalizedStatus === 'in progress' || normalizedStatus === 'in-progress' || normalizedStatus === 'running') {
                              return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            } else {
                              return 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300'
                            }
                          }
                          
                          return (
                            <tr key={task._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                                {projectName}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-100">
                                {task.text}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge className={cn("text-xs", getPriorityBadgeColor(priority))}>
                                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                                {estimateHours} {estimateHours === 1 ? 'hr' : 'hrs'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge className={cn("text-xs", getStatusBadgeColor(status))}>
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
                <div className="mt-8 flex flex-col items-center">
                  {filteredTasks.map((task, index) => {
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
                    const isOwner = session.user.id === typedTask.userId
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
                        />
                      </div>
                    )
                  })}
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Modals */}
        {collaborationProject && (
          <ProjectCollaboratorsModal
            open={Boolean(collaborationProject)}
            onOpenChange={(open) => {
              if (!open) {
                setCollaborationProject(null)
              }
            }}
            projectId={collaborationProject._id}
            projectName={collaborationProject.name}
            isOwner={collaborationProject.userRole === 'owner'}
            ownerEmail={
              collaborationProject.userRole === 'owner'
                ? session.user.email ?? undefined
                : undefined
            }
            ownerName={
              collaborationProject.userRole === 'owner'
                ? session.user.name ?? session.user.email ?? 'You'
                : 'Project Owner'
            }
          />
        )}
        <AddProjectModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
        />
        <AddTaskModal
          open={isAddTaskModalOpen}
          onOpenChange={setIsAddTaskModalOpen}
        />
        <ImageAnalyticsModal
          isOpen={isImageAnalyticsOpen}
          onClose={() => setIsImageAnalyticsOpen(false)}
          projectId={selectedProject?._id ?? undefined}
          projectName={selectedProject?.name}
          onTasksCreated={handleImageAnalysisTasksCreated}
        />
        {editingProject && (
          <EditProjectModal
            open={isEditModalOpen}
            onOpenChange={setIsEditModalOpen}
            project={editingProject}
          />
        )}
      </div>
    </TooltipProvider>
  )
}

type CollaboratorRecord = {
  _id: string
  projectId: Id<"projects">
  userId?: string
  email: string
  role: string
  addedBy: string
  addedAt: number
  userName?: string
}

type InvitationRecord = {
  _id: string
  projectId: Id<"projects">
  email: string
  role: string
  status: string
  invitedAt: number
  invitedByName?: string
  respondedAt?: number
  expiresAt: number
}

interface ProjectCollaborationPanelProps {
  projectId: Id<"projects">
  projectName: string
  ownerName: string
  ownerEmail?: string
  isOwner: boolean
}

function ProjectCollaborationPanel({
  projectId,
  projectName,
  ownerEmail,
  ownerName,
  isOwner,
}: ProjectCollaborationPanelProps) {
  const queryClient = useQueryClient()
  const removeCollaborator = useConvexMutation((api.projects as any).removeProjectCollaborator)
  const collaboratorsResponse = useConvexQuery(api.projects.getProjectCollaborators, {
    projectId,
  }) as { owner: { userId: string; projectId: Id<"projects"> }; collaborators: CollaboratorRecord[] }

  const collaborators = useMemo(
    () =>
      (collaboratorsResponse?.collaborators || []).sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0)),
    [collaboratorsResponse],
  )
  const displayOwnerName = ownerName || "Project Owner"
  const displayOwnerEmail = ownerEmail || "Email hidden"

  const refresh = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey
        if (!Array.isArray(key)) return false
        return (
          key[0] === api.projects.getProjectCollaborators ||
          key[0] === api.projects.listProjectInvitations ||
          key[0] === api.projects.listProjects
        )
      },
    })
  }

  const handleRemoveCollaborator = async (record: CollaboratorRecord) => {
    if (!isOwner) return
    const displayName = record.userName || record.email
    const confirmed = window.confirm(`Remove ${displayName} from this project?`)
    if (!confirmed) return

    try {
      await removeCollaborator({
        projectId,
        collaboratorId: record._id as Id<"projectCollaborators">,
      })
      toast.success(`${displayName} removed`)
      refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove collaborator."
      toast.error(message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          Collaborators
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{projectName}</p>
          <div className="flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
            <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{displayOwnerName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{displayOwnerEmail}</p>
            </div>
            <Badge>Owner</Badge>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Team members</h3>
          {collaborators.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No collaborators have joined this project yet.
            </p>
          ) : (
            <div className="space-y-2">
              {collaborators.map((collaborator) => (
                <div
                  key={collaborator._id}
                  className="flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {collaborator.userName || collaborator.email}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {collaborator.email}
                      {collaborator.addedAt && (
                        <> · joined {new Date(collaborator.addedAt).toLocaleString()}</>
                      )}
                    </p>
                  </div>
                  <Badge variant="secondary" className="uppercase">
                    {collaborator.role}
                  </Badge>
                  {isOwner && collaborator.role !== "owner" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-3 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-900/20"
                      onClick={() => handleRemoveCollaborator(collaborator)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {isOwner && (
          <OwnerInvitationSection projectId={projectId} projectName={projectName} onRefresh={refresh} />
        )}
      </CardContent>
    </Card>
  )
}

interface ProjectCollaboratorsModalProps extends ProjectCollaborationPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProjectCollaboratorsModal({
  open,
  onOpenChange,
  ...panelProps
}: ProjectCollaboratorsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            Project Collaboration
          </DialogTitle>
        </DialogHeader>
        <ProjectCollaborationPanel {...panelProps} />
      </DialogContent>
    </Dialog>
  )
}

function OwnerInvitationSection({
  projectId,
  projectName,
  onRefresh,
}: {
  projectId: Id<"projects">
  projectName: string
  onRefresh: () => void
}) {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

  const inviteCollaborator = useConvexAction((api.projects as any).inviteProjectCollaborator)
  const invitations = useConvexQuery(api.projects.listProjectInvitations, { projectId }) as
    | InvitationRecord[]
    | undefined

  const pendingInvitations = useMemo(
    () => (invitations || []).filter((invitation) => invitation.status === "pending"),
    [invitations],
  )

  const respondedInvitations = useMemo(
    () => (invitations || []).filter((invitation) => invitation.status !== "pending"),
    [invitations],
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      toast.error("Please enter an email address.")
      return
    }

    try {
      setIsSubmitting(true)
      await inviteCollaborator({
        projectId,
        email: normalizedEmail,
        role: "collaborator",
      })
      toast.success(`Invitation sent to ${normalizedEmail}`)
      setEmail("")
      onRefresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send invitation."
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Invite collaborators
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Send an email invitation to add someone to <strong>{projectName}</strong>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Input
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="sm:flex-1"
        />
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          {isSubmitting ? "Sending..." : "Send invite"}
        </Button>
      </form>

      {pendingInvitations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wide">
            Pending
          </h4>
          <div className="space-y-2">
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation._id}
                className="flex items-center justify-between rounded-md border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {invitation.email}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Invited {new Date(invitation.invitedAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant="secondary" className="uppercase">
                  {invitation.role}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {respondedInvitations.length > 0 && (
        <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 pt-4">
          <h4 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wide">
            Recent responses
          </h4>
          <div className="space-y-2">
            {respondedInvitations
              .sort((a, b) => (b.respondedAt ?? 0) - (a.respondedAt ?? 0))
              .slice(0, 4)
              .map((invitation) => (
                <div
                  key={invitation._id}
                  className="flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {invitation.email}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {invitation.status === "accepted"
                        ? "Accepted"
                        : invitation.status === "declined"
                        ? "Declined"
                        : invitation.status}
                      {invitation.respondedAt && <> · {new Date(invitation.respondedAt).toLocaleString()}</>}
                    </p>
                  </div>
                  <Badge variant={invitation.status === "accepted" ? "default" : "secondary"}>
                    {invitation.status}
                  </Badge>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
