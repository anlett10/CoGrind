import { createFileRoute } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useConvexMutation, useConvexQuery } from '@convex-dev/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Id } from 'convex/_generated/dataModel'
import { useSession } from './route'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Checkbox } from '~/components/ui/checkbox'
import { toast } from 'sonner'
import { CheckCircle2, Circle, FolderOpen, Play, Search, Square, CheckCircle, CheckSquare } from 'lucide-react'
import { cn } from '~/lib/utils'

const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }

const normalizePriority = (priority?: string) => {
  const value = String(priority ?? 'low').toLowerCase().trim()
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value
  }
  return 'low'
}

const getPriorityBadgeClass = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'bg-red-500/10 text-red-600 border border-red-200 dark:border-red-900/60 dark:text-red-300'
    case 'medium':
      return 'bg-blue-500/10 text-blue-600 border border-blue-200 dark:border-blue-900/60 dark:text-blue-300'
    default:
      return 'bg-zinc-500/10 text-zinc-600 border border-zinc-200 dark:border-zinc-800 dark:text-zinc-300'
  }
}

type Task = {
  _id: string
  userId: string
  text: string
  details: string
  priority?: string
  status?: string
  hrs?: number
  startedAt?: number
  completedAt?: number
  sharedWith?: string
  selectedBy?: string
  refLink?: string
  projectId?: Id<'projects'>
  project?: {
    _id: Id<'projects'>
    id?: string
    name?: string
  } | null
  trackedTimeMs?: number
}

type Project = {
  _id: Id<'projects'>
  id?: string
  name: string
  userId?: string
  sharedWith?: string
  userRole?: string
}

type Collaborator = {
  _id: Id<'projectCollaborators'>
  projectId: Id<'projects'>
  userId?: string
  email: string
  role: string
  userName?: string
}

const formatDuration = (milliseconds: number | undefined) => {
  if (!milliseconds || milliseconds <= 0) {
    return '00:00:00'
  }
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

function RouteComponent() {
  const session = useSession()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sessionActive, setSessionActive] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const tasks = useConvexQuery(api.tasks.listTasks, {}) as Task[] | undefined
  const projects = useConvexQuery(api.projects.listProjects, {}) as Project[] | undefined
  const allCollaborators = useConvexQuery(api.projects.getAllCollaborators, {}) as Collaborator[] | undefined
  
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

  const toggleTaskSelectionMutation = useConvexMutation(api.tasks.toggleTaskSelection)
  const startTaskMutation = useConvexMutation(api.tasks.startTask)
  const stopTaskMutation = useConvexMutation(api.tasks.stopTask)
  const completeTaskMutation = useConvexMutation(api.tasks.completeTask)

  const userProjectIds = useMemo(() => {
    const ownedOrShared = new Set<string>()
    if (!projects) return ownedOrShared
    projects.forEach((project) => {
      ownedOrShared.add(String(project._id))
    })
    return ownedOrShared
  }, [projects])

  const tasksWithProjects = useMemo(() => {
    const userId = session?.user?.id
    const email = session?.user?.email
    return (tasks ?? []).filter((task) => {
      const projectId = task.projectId ? String(task.projectId) : undefined
      if (!projectId || !userProjectIds.has(projectId)) return false
      if (task.userId === userId) return true
      if (!email) return false
      try {
        if (task.sharedWith) {
          const sharedEmails = JSON.parse(task.sharedWith)
          if (Array.isArray(sharedEmails) && sharedEmails.includes(email)) {
            return true
          }
        }
      } catch {
        // ignore parse errors
      }
      return false
    })
  }, [tasks, session?.user?.id, session?.user?.email, userProjectIds])

  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>()

    ;(projects ?? []).forEach((project) => {
      const docId = project._id ? String(project._id) : undefined
      const customId = project.id ? String(project.id) : undefined
      const name = project.name || customId || 'Untitled Project'
      if (docId) {
        map.set(docId, name)
      }
      if (customId) {
        map.set(customId, name)
      }
    })

    ;(tasks ?? []).forEach((task) => {
      if (task.project) {
        const docId = task.project._id ? String(task.project._id) : undefined
        const customId = task.project.id ? String(task.project.id) : undefined
        const name = task.project.name || customId || 'Shared Project'
        if (docId) {
          map.set(docId, name)
        }
        if (customId) {
          map.set(customId, name)
        }
      }
    })

    return map
  }, [projects, tasks])

  const getProjectName = (task: Task) => {
    if (!task.projectId) {
      return 'No Project'
    }
    const key = String(task.projectId)
    const directMatch = projectNameMap.get(key)
    if (directMatch) {
      return directMatch
    }

    if (task.project?.name) {
      return task.project.name
    }

    return 'Unknown Project'
  }

  const projectOptions = useMemo(() => {
    const names = new Set<string>()
    tasksWithProjects.forEach((task) => {
      const name = getProjectName(task)
      if (name && name !== 'Unknown Project' && name !== 'No Project') {
        names.add(name)
      }
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [tasksWithProjects, projectNameMap])

  const filteredTableTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return tasksWithProjects.filter((task) => {
      const statusNormalized = (task.status || '').toLowerCase()
      if (statusNormalized === 'done' || statusNormalized === 'completed') {
        return false
      }

      const projectName = getProjectName(task)
      if (projectFilter !== 'all' && projectName !== projectFilter) {
        return false
      }

      if (priorityFilter !== 'all') {
        const priority = normalizePriority(task.priority)
        if (priority !== priorityFilter) {
          return false
        }
      }

      if (!query) {
        return true
      }

      const textMatch = task.text?.toLowerCase().includes(query)
      const detailsMatch = task.details?.toLowerCase().includes(query)
      const refMatch = task.refLink?.toLowerCase().includes(query)

      return Boolean(textMatch || detailsMatch || refMatch)
    })
  }, [tasksWithProjects, searchQuery, projectFilter, priorityFilter])

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {}
    filteredTableTasks.forEach((task) => {
      const projectName = getProjectName(task)
      if (!groups[projectName]) {
        groups[projectName] = []
      }
      groups[projectName].push(task)
    })
    return groups
  }, [filteredTableTasks])

  const sortedProjectNames = useMemo(
    () => Object.keys(groupedTasks).sort((a, b) => a.localeCompare(b)),
    [groupedTasks]
  )

  const refetchTasks = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey
        return Array.isArray(key) && key[0] === api.tasks.listTasks
      },
    })
  }

  // Helper to check if task is shared (not owned by current user)
  const isTaskShared = (task: Task) => {
    return task.userId !== session?.user?.id
  }

  // Helper to get users who selected the task today
  const getSelectedByToday = (task: Task): Array<{ email: string; timestamp: number }> => {
    if (!task.selectedBy) return []
    
    try {
      const selectedBy = JSON.parse(task.selectedBy)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayTimestamp = today.getTime()
      
      const todaySelections: Array<{ email: string; timestamp: number }> = []
      
      if (typeof selectedBy === 'object' && selectedBy !== null && !Array.isArray(selectedBy)) {
        for (const [email, timestamp] of Object.entries(selectedBy)) {
          if (typeof timestamp === 'number') {
            const selectedDate = new Date(timestamp)
            selectedDate.setHours(0, 0, 0, 0)
            const selectedTimestamp = selectedDate.getTime()
            
            if (selectedTimestamp === todayTimestamp) {
              todaySelections.push({ email, timestamp })
            }
          }
        }
      }
      
      return todaySelections
    } catch (error) {
      console.error('Error parsing selectedBy:', error, task.selectedBy)
      return []
    }
  }

  const isTaskSelectedByMeToday = (task: Task) => {
    if (!session?.user?.email) return false
    const selections = getSelectedByToday(task)
    return selections.some((s) => s.email === session.user.email)
  }

  const isTaskSelectedToday = (task: Task) => {
    return getSelectedByToday(task).length > 0
  }

  const isTaskRunningForMe = (task: Task) => {
    const statusNormalized = (task.status || '').toLowerCase()
    if (statusNormalized !== 'in-progress') {
      return false
    }
    const isOwner = task.userId === session?.user?.id
    if (isOwner) {
      return true
    }
    return isTaskSelectedByMeToday(task)
  }

  const isTaskActiveForMe = (task: Task) => {
    return isTaskSelectedByMeToday(task) || isTaskRunningForMe(task)
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

  // Filter out completed tasks for all calculations
  const activeTasks = useMemo(() => {
    return tasksWithProjects.filter((task) => {
      const statusNormalized = (task.status || '').toLowerCase()
      return statusNormalized !== 'done' && statusNormalized !== 'completed'
    })
  }, [tasksWithProjects])

  // "Engaged overall" = tasks that are either in-progress OR selected today (by anyone)
  const activeOverallCount = useMemo(() => {
    return activeTasks.filter((task) => {
      const statusNormalized = (task.status || '').toLowerCase()
      if (statusNormalized === 'in-progress') {
        return true
      }
      return isTaskSelectedToday(task)
    }).length
  }, [activeTasks])

  // "Selected by you" = tasks that are selected by current user today OR running for current user
  const selectedByMeCount = useMemo(() => {
    return activeTasks.filter((task) => isTaskActiveForMe(task)).length
  }, [activeTasks])

  // "Available" = total active tasks - engaged overall
  const availableCount = activeTasks.length - activeOverallCount

  const handleToggleSelection = async (task: Task) => {
    if (!session?.user?.email) {
      console.error('Cannot toggle selection: user email not found in session')
      return
    }

    const normalizedStatus = (task.status || '').toLowerCase()
    if (normalizedStatus === 'in progress' || normalizedStatus === 'in-progress' || normalizedStatus === 'running') {
      toast.info('Stop the task before changing its selection.')
      return
    }

    const isSelectedByToday = getSelectedByToday(task)
    const isSelectedByCurrentUser = isTaskSelectedByMeToday(task)
    const isSelectedBySomeoneElse = isSelectedByToday.length > 0 && !isSelectedByCurrentUser

    if (isSelectedBySomeoneElse) {
      toast.info('This task is already selected for today by another teammate.')
      return
    }
    
    const isSelected = isSelectedByCurrentUser
    
    try {
      await toggleTaskSelectionMutation({
        taskId: task._id as Id<'tasks'>,
        selected: !isSelected,
      })
      
      // Only invalidate queries - this will trigger a refetch automatically
      // Don't call refetchTasks() separately as it causes race conditions
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey
          return Array.isArray(key) && key[0] === api.tasks.listTasks
        },
      })
    } catch (error) {
      console.error('Failed to toggle task selection:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to toggle selection: ${errorMessage}`)
    }
  }

  const handleStartTaskRun = async (task: Task) => {
    try {
      await startTaskMutation({
        taskId: task._id as Id<'tasks'>,
      })
      await refetchTasks()
      setSessionActive(true)
      toast.success(`Started "${task.text}"`)
    } catch (error) {
      console.error('Failed to start task:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`Unable to start task: ${errorMessage}`)
    }
  }

  const handleStopTaskRun = async (task: Task) => {
    try {
      await stopTaskMutation({
        taskId: task._id as Id<'tasks'>,
      })
      await refetchTasks()
      toast.success(`Stopped "${task.text}"`)
    } catch (error) {
      console.error('Failed to stop task:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`Unable to stop task: ${errorMessage}`)
    }
  }

  const handleCompleteTaskRun = async (task: Task) => {
    try {
      await completeTaskMutation({
        taskId: task._id as Id<'tasks'>,
      })
      await refetchTasks()
      toast.success(`Completed "${task.text}"`)
    } catch (error) {
      console.error('Failed to complete task:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`Unable to complete task: ${errorMessage}`)
    }
  }

  const computeTrackedTime = (task: Task) => {
    const base = task.trackedTimeMs ?? 0
    const active = task.startedAt && task.status === 'in-progress' ? Math.max(0, now - task.startedAt) : 0
    return base + active
  }

  const mySelectedTasks = useMemo(
    () => activeTasks.filter((task) => isTaskActiveForMe(task)),
    [activeTasks, session?.user?.id, session?.user?.email]
  )

  const hasRunningTasks = useMemo(() => {
    return activeTasks.some((task) => {
      const statusNormalized = (task.status || '').toLowerCase()
      if (statusNormalized !== 'in-progress') {
        return false
      }
      const isOwnedByMe = task.userId === session?.user?.id
      const wasSelectedByMeToday = isTaskSelectedByMeToday(task)
      return isOwnedByMe || wasSelectedByMeToday
    })
  }, [activeTasks, session?.user?.id, session?.user?.email])

  const shouldResumeSession = useMemo(() => {
    if (mySelectedTasks.length > 0) {
      return true
    }
    return hasRunningTasks
  }, [hasRunningTasks, mySelectedTasks.length])

  useEffect(() => {
    if (!sessionActive && shouldResumeSession) {
      setSessionActive(true)
    }
  }, [sessionActive, shouldResumeSession])

  useEffect(() => {
    if (sessionActive && !shouldResumeSession) {
      setSessionActive(false)
    }
  }, [sessionActive, shouldResumeSession])

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <section className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-6">Task Workflow</h1>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CheckSquare className="h-5 w-5 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <p className="text-base font-semibold leading-relaxed text-blue-700 dark:text-blue-300">
                Select one or more tasks from <span className="font-bold text-blue-800 dark:text-blue-200">Task List</span> section.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Play className="h-5 w-5 mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <p className="text-base font-semibold leading-relaxed text-emerald-700 dark:text-emerald-300">
                Start running tasks from <span className="font-bold text-emerald-800 dark:text-emerald-200">Live Run</span> section.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition-all hover:shadow-md dark:bg-emerald-900/40 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {selectedByMeCount} selected by you
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm transition-all hover:shadow-md dark:bg-sky-900/40 dark:text-sky-300">
            <Circle className="h-4 w-4" />
            {activeOverallCount} engaged overall
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:shadow-md dark:bg-slate-800 dark:text-slate-300">
            {availableCount} available
          </span>
        </div>
      </section>

      <Card className="border border-slate-200/80 shadow-xl shadow-blue-500/5 dark:border-slate-800 dark:shadow-blue-500/10">
        <CardHeader className="border-b border-blue-100/80 bg-gradient-to-br from-white via-blue-50/30 to-white dark:border-blue-900/40 dark:from-slate-900 dark:via-blue-900/20 dark:to-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-3 text-xl font-bold text-zinc-900 dark:text-zinc-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40">
                  <FolderOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                Task List
              </CardTitle>
              <CardDescription className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-500 dark:text-blue-400">•</span>
                  <span>Show all active tasks including shared tasks.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-500 dark:text-blue-400">•</span>
                  <span>Selection updates sync in real-time across all team members.</span>
                </div>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="relative sm:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search tasks..."
                className="h-11 pl-10 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-all focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-11 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-all focus:ring-2 focus:ring-blue-500">
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <SelectItem value="all">All projects</SelectItem>
                {projectOptions.map((projectName) => (
                  <SelectItem key={projectName} value={projectName}>
                    {projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-11 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-all focus:ring-2 focus:ring-blue-500">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
      </div>

          {(searchQuery || projectFilter !== 'all' || priorityFilter !== 'all') && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setProjectFilter('all')
                  setPriorityFilter('all')
                }}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
              >
                Clear filters
              </Button>
                               </div>
                             )}

          <div className="overflow-hidden rounded-xl border border-blue-100/80 shadow-lg dark:border-blue-900/40">
            <div className="max-h-[480px] overflow-y-auto">
              <table className="min-w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-blue-50/90 backdrop-blur-sm dark:bg-blue-900/50">
                  <tr className="text-left text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-200">
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Shared with</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3 text-center">Select</th>
                  </tr>
                </thead>
                <tbody className="bg-white text-sm dark:bg-slate-900">
                  {filteredTableTasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                            <Search className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No tasks found</p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Try adjusting your search or filters</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedProjectNames.map((projectName) => {
                      const tasksForProject = groupedTasks[projectName] ?? []
                      if (!tasksForProject.length) {
                        return null
                          }

                          return (
                        <Fragment key={projectName}>
                          <tr className="bg-blue-100/80 text-xs font-bold uppercase tracking-wider text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                            <td colSpan={5} className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-200 dark:bg-blue-800">
                                  <FolderOpen className="h-3.5 w-3.5" />
                                </div>
                                <span>{projectName}</span>
                                <span className="rounded-full bg-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-800 dark:text-blue-300">
                                  {tasksForProject.length} task{tasksForProject.length === 1 ? '' : 's'}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {tasksForProject
                            .slice()
                            .sort((a, b) => {
                              const aPriority = priorityOrder[normalizePriority(a.priority)] ?? 3
                              const bPriority = priorityOrder[normalizePriority(b.priority)] ?? 3
                              if (aPriority !== bPriority) {
                                return aPriority - bPriority
                              }
                              return a.text.localeCompare(b.text)
                            })
                            .map((task) => {
                              const priority = normalizePriority(task.priority)
                              const priorityClass = getPriorityBadgeClass(priority)
                              const selectedBy = getSelectedByToday(task)
                              const isSelectedByMe = isTaskSelectedByMeToday(task)
                              const isSelectedByAnyone = selectedBy.length > 0 // Show checked if anyone selected it
                              const sharedEmails = getSharedEmails(task.sharedWith)
                              const isSelectedByOthers = selectedBy.length > 0 && !isSelectedByMe
                              const isSelectionLocked = isSelectedByOthers // Lock if someone else selected it
                              const normalizedStatus = (task.status || '').toLowerCase()
                              const isRunning =
                                normalizedStatus === 'in progress' ||
                                normalizedStatus === 'in-progress' ||
                                normalizedStatus === 'running'
                              const checkboxClasses = cn(
                                'h-5 w-5 rounded-md border-2 transition-all',
                                'data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 data-[state=checked]:text-white',
                                'data-[state=checked]:shadow-sm data-[state=checked]:shadow-blue-500/50',
                                (isSelectionLocked || isRunning) &&
                                  'cursor-not-allowed opacity-60 data-[state=checked]:opacity-100 data-[state=unchecked]:opacity-40 data-[state=unchecked]:border-zinc-200 data-[state=unchecked]:bg-zinc-100 dark:data-[state=unchecked]:border-zinc-800 dark:data-[state=unchecked]:bg-zinc-900'
                              )

                              return (
                                <tr
                key={task._id}
                                  className={cn(
                                    'align-top transition-all duration-200',
                                    isSelectedByMe && 'bg-emerald-50/90 dark:bg-emerald-900/30 border-l-4 border-l-emerald-500',
                                    !isSelectedByMe && selectedBy.length > 0 && 'bg-sky-50/70 dark:bg-sky-900/30 border-l-4 border-l-sky-500',
                                    isRunning
                                      ? 'opacity-70 bg-zinc-100/80 dark:bg-zinc-900/50'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                  )}
                                >
                                  <td className="px-4 py-4 text-sm font-semibold text-blue-800 dark:text-blue-200">
                                    {projectName}
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="space-y-1.5">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{task.text}</span>
                                        {typeof task.hrs === 'number' && (
                                          <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                            {task.hrs}h
                                          </span>
                        )}
                      </div>
                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    {sharedEmails.length > 0 ? (
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {sharedEmails.map((email) => (
                                          <Badge key={email} variant="outline" className="text-xs border-slate-300 dark:border-slate-700">
                                            {getDisplayName(email)}
                                          </Badge>
            ))}
          </div>
                                    ) : (
                                      <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-4">
                                    <span
                                      className={cn(
                                        'inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold capitalize shadow-sm',
                                        priorityClass
                                      )}
                                    >
                                      {priority}
                              </span>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                      <Checkbox
                                        checked={isSelectedByAnyone}
                                        disabled={isSelectionLocked || isRunning}
                                        onCheckedChange={() => {
                                          if (isSelectionLocked || isRunning) {
                                            return
                                          }
                                          handleToggleSelection(task)
                                        }}
                                        className={checkboxClasses}
                                        aria-label={`Toggle selection for ${task.text}`}
                                      />
                                      {selectedBy.length > 0 ? (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          {selectedBy.map((selection, idx) => (
                                <Badge 
                                  key={idx}
                                              variant={selection.email === session?.user?.email ? 'default' : 'outline'}
                                              className={cn(
                                                'text-xs font-semibold shadow-sm transition-all',
                                                selection.email === session?.user?.email
                                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 border-emerald-600'
                                                  : 'border-slate-300 dark:border-slate-700'
                                              )}
                                >
                                  {selection.email === session?.user?.email ? 'You' : getDisplayName(selection.email)}
                                </Badge>
                              ))}
                            </div>
                                      ) : (
                                        <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
                          )}
                        </div>
                                  </td>
                                </tr>
                              )
                            })}
                        </Fragment>
                      )
                    })
                  )}
                </tbody>
              </table>
                      </div>
                    </div>

                </CardContent>
              </Card>

      {sessionActive && (
        <Card className="border border-emerald-200/80 shadow-xl shadow-emerald-500/10 dark:border-emerald-900/40 dark:shadow-emerald-500/20">
          <CardHeader className="border-b border-emerald-100/80 bg-gradient-to-br from-white via-emerald-50/40 to-white dark:border-emerald-900/40 dark:from-slate-900 dark:via-emerald-900/20 dark:to-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                    <Play className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Live Run
                </CardTitle>
                <CardDescription className="text-sm text-emerald-700 dark:text-emerald-300 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-emerald-500 dark:text-emerald-400">•</span>
                    <span>Show all selected tasks from Task List.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-emerald-500 dark:text-emerald-400">•</span>
                    <span>Click on Start to start running a task, and hit Complete when done.</span>
                  </div>
                </CardDescription>
              </div>
              <div className="rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {mySelectedTasks.length} task{mySelectedTasks.length === 1 ? '' : 's'} in focus
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {mySelectedTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 p-8 text-center dark:border-emerald-900 dark:bg-emerald-900/20">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                    <Play className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Select at least one task to begin tracking.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-emerald-100/80 shadow-lg dark:border-emerald-900/40">
                <table className="min-w-full border-collapse">
                  <thead className="bg-emerald-50/90 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
                    <tr>
                      <th className="px-4 py-3 text-left">Task</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Time Logged</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white text-sm dark:bg-slate-900">
                    {mySelectedTasks.map((task) => {
                      const projectName = getProjectName(task)
                      const isRunning = task.status === 'in-progress' && !!task.startedAt
                      const isCompleted = task.status === 'done'
                      const totalTracked = computeTrackedTime(task)
                      const formattedTime = formatDuration(totalTracked)
                      const statusLabel = isCompleted
                        ? 'Completed'
                        : isRunning
                          ? 'In Progress'
                          : 'Ready'
                      const statusBadgeClass = cn(
                        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize',
                        isCompleted
                          ? 'bg-emerald-500 text-white'
                          : isRunning
                            ? 'bg-sky-500 text-white'
                            : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                      )

                      return (
                        <tr
                          key={task._id}
                          className={cn(
                            'border-t border-emerald-100/80 dark:border-emerald-900/40 align-top transition-all duration-200',
                            isRunning && 'bg-emerald-50/70 dark:bg-emerald-900/20',
                            isCompleted && 'bg-emerald-500/10 dark:bg-emerald-900/30',
                            !isCompleted && !isRunning && 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          )}
                        >
                          <td className="px-4 py-4">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{task.text}</span>
                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{projectName}</span>
                                {typeof task.hrs === 'number' && (
                                  <Badge variant="outline" className="text-xs border-slate-300 dark:border-slate-700">
                                    {task.hrs}h
                                  </Badge>
                                )}
          </div>
                              {/* Task details intentionally hidden in this view */}
      </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={cn(statusBadgeClass, 'shadow-sm')}>{statusLabel}</span>
                          </td>
                          <td className="px-4 py-4 font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            {formattedTime}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {!isRunning && !isCompleted && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStartTaskRun(task)}
                                  className="gap-1.5 border-slate-300 dark:border-slate-700 transition-all hover:scale-105"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                  Start
                                </Button>
                              )}
                              {isRunning && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStopTaskRun(task)}
                                  className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-all hover:scale-105"
                                >
                                  <Square className="h-3.5 w-3.5" />
                                  Stop
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleCompleteTaskRun(task)}
                                disabled={isCompleted}
                                className={cn(
                                  'gap-1.5 font-semibold shadow-sm transition-all hover:scale-105 active:scale-100',
                                  isCompleted
                                    ? 'bg-emerald-500/20 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 cursor-default'
                                    : 'bg-emerald-500 text-white hover:bg-emerald-600'
                                )}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                {isCompleted ? 'Completed' : 'Complete'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </main>
  )
}

export const Route = createFileRoute('/(authenticated)/live')({
  component: RouteComponent,
})

