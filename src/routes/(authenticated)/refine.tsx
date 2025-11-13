import { createFileRoute } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useConvexQuery } from '@convex-dev/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Id } from 'convex/_generated/dataModel'
import { useSession } from './route'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { AlertCircle, ArrowUpRight, Github, ListTodo, Loader2, Pencil } from 'lucide-react'
import { Badge } from '~/components/ui/badge'
import { EditTaskModal } from '~/components/app/edit-task-modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { AddTaskModal } from '~/components/app/add-task-modal'

export const Route = createFileRoute('/(authenticated)/refine')({
  component: RouteComponent,
})

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
  updatedAt?: number
  refLink?: string
}

// Type for edit modal
type TaskForEdit = {
  _id: string
  text: string
  details: string
  priority?: string
  status?: string
  hrs?: number
  sharedWith?: string
  refLink?: string
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskForEdit | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addTaskPrefill, setAddTaskPrefill] = useState<PrefillTask | null>(null)
  const queryClient = useQueryClient()

  const tasks = useConvexQuery(
    api.tasks.listTasks,
    {}
  ) as Task[] | undefined

  const projects = useConvexQuery(
    api.projects.listProjects,
    {}
  ) as Project[] | undefined

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
        const response = await fetch(
          `https://api.github.com/repos/${repo}/issues?per_page=${ISSUES_PER_PROJECT * 2}&sort=created&state=open`
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

  // Helper to refetch tasks
  const refetchTasks = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey
        return Array.isArray(key) && key[0] === api.tasks.listTasks
      }
    })
  }


  return (
    <main style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '2rem',
      minHeight: '100vh'
    }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: '700', 
          marginBottom: '0.5rem',
          color: '#111827'
        }}>
          Refine
        </h1>
        <p style={{ 
          color: '#6b7280',
          fontSize: '1rem'
        }}>
          Edit tasks shared with you and review your tasks shared with others
        </p>
      </div>

      {sharedTasks.length === 0 ? (
        <Card style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>
            No shared tasks available to refine.
          </p>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Tasks shared with you or tasks you've shared with others will appear here.
          </p>
        </Card>
      ) : (
        <div>
          {/* Tasks Shared WITH Me */}
          {tasksSharedWithMe.length > 0 && (
            <div style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600', 
                marginBottom: '1rem',
                color: '#111827'
              }}>
                Tasks Shared With Me ({tasksSharedWithMe.length})
              </h2>
              <p style={{ 
                color: '#6b7280',
                fontSize: '0.9rem',
                marginBottom: '1rem'
              }}>
                Edit and update these tasks
              </p>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
                gap: '1.5rem' 
              }}>
                {tasksSharedWithMe.map((task) => (
                  <Card
                    key={task._id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.75rem',
                      padding: '1.5rem',
                      transition: 'all 0.2s',
                      position: 'relative',
                      overflow: 'hidden',
                      backgroundColor: '#ffffff'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#93c5fd'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 10px 24px rgba(59, 130, 246, 0.12)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb'
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <CardContent style={{ padding: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            marginBottom: '0.75rem',
                            flexWrap: 'wrap'
                          }}>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                <h3 style={{ 
                                  fontSize: '1.25rem', 
                                  fontWeight: '600', 
                                  color: '#111827',
                                  wordBreak: 'break-word',
                                  margin: 0
                                }}>
                                  {task.text}
                                </h3>
                                <Badge variant="outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                                  Shared With Me
                                </Badge>
                                {task.updatedAt && (() => {
                                  const updatedTime = new Date(task.updatedAt)
                                  const now = new Date()
                                  const hoursSinceUpdate = (now.getTime() - updatedTime.getTime()) / (1000 * 60 * 60)
                                  // Show "Edited" badge if updated within last hour (for tasks shared WITH me)
                                  if (hoursSinceUpdate < 1) {
                                    return (
                                      <Badge variant="default" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#10b981', color: 'white' }}>
                                        Edited
                                      </Badge>
                                    )
                                  }
                                  return null
                                })()}
                              </div>
                              {getSharedEmails(task.sharedWith).length > 0 && (
                                <p style={{ 
                                  fontSize: '0.75rem', 
                                  color: '#6b7280',
                                  margin: 0,
                                  wordBreak: 'break-word'
                                }}>
                                  Shared with: {getSharedEmails(task.sharedWith).join(", ")}
                                </p>
                              )}
                            </div>
                            <div style={{ 
                              display: 'flex',
                              gap: '0.5rem',
                              flexWrap: 'wrap',
                              alignItems: 'center'
                            }}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingTask({
                                    _id: task._id,
                                    text: task.text,
                                    details: task.details,
                                    priority: task.priority,
                                    status: task.status,
                                    hrs: task.hrs,
                                    sharedWith: task.sharedWith,
                                    refLink: task.refLink
                                  })
                                  setIsEditModalOpen(true)
                                }}
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  padding: 0,
                                  flexShrink: 0
                                }}
                                title="Edit task"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {task.details && (
                            <p style={{ 
                              fontSize: '0.95rem', 
                              color: '#6b7280',
                              marginBottom: '1rem',
                              wordBreak: 'break-word',
                              lineHeight: '1.5'
                            }}>
                              {task.details}
                            </p>
                          )}
                          {task.refLink && (
                            <div style={{ marginBottom: '1rem' }}>
                              <a
                                href={task.refLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: '0.9rem',
                                  color: '#3b82f6',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  wordBreak: 'break-all'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.textDecoration = 'underline'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.textDecoration = 'none'
                                }}
                              >
                                🔗 {task.refLink}
                              </a>
                            </div>
                          )}
                          <div style={{ 
                            display: 'flex',
                            gap: '0.5rem',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            marginBottom: '0.75rem'
                          }}>
                            {task.priority && (() => {
                              const priorityLower = String(task.priority).toLowerCase().trim();
                              let variant: 'destructive' | 'default' | 'secondary' = 'secondary';
                              let className = '';

                              if (priorityLower === 'high') {
                                variant = 'destructive';
                                className = '!bg-red-600 !text-white';
                              } else if (priorityLower === 'medium') {
                                variant = 'default';
                                className = '!bg-blue-600 !text-white';
                              } else if (priorityLower === 'low') {
                                variant = 'secondary';
                                className = '!bg-gray-500 !text-white';
                              }

                              return (
                                <Badge
                                  variant={variant}
                                  className={className}
                                  style={{
                                    textTransform: 'capitalize'
                                  }}
                                >
                                  {task.priority}
                                </Badge>
                              );
                            })()}
                            {task.status && (
                              <Badge 
                                variant={
                                  task.status === 'done' ? 'default' :
                                  task.status === 'in-progress' ? 'secondary' : 'outline'
                                }
                                style={{
                                  textTransform: 'capitalize'
                                }}
                              >
                                {task.status === 'in-progress' ? 'In Progress' : task.status === 'todo' ? 'To Do' : task.status}
                              </Badge>
                            )}
                            {task.hrs && (
                              <Badge variant="outline" style={{ fontSize: '0.75rem' }}>
                                {task.hrs} hrs
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* My Tasks Shared With Others */}
          {myTasksSharedWithOthers.length > 0 && (
            <div>
              <h2 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600', 
                marginBottom: '1rem',
                color: '#111827'
              }}>
                My Tasks Shared With Others ({myTasksSharedWithOthers.length})
              </h2>
              <p style={{ 
                color: '#6b7280',
                fontSize: '0.9rem',
                marginBottom: '1rem'
              }}>
                Review what others have edited in your shared tasks
              </p>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
                gap: '1.5rem' 
              }}>
                {myTasksSharedWithOthers.map((task) => (
            <Card
              key={task._id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#ffffff'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#93c5fd'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 10px 24px rgba(59, 130, 246, 0.12)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <CardContent style={{ padding: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      marginBottom: '0.75rem',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                          <h3 style={{ 
                            fontSize: '1.25rem', 
                            fontWeight: '600', 
                            color: '#111827',
                            wordBreak: 'break-word',
                            margin: 0
                          }}>
                            {task.text}
                          </h3>
                          <Badge variant="outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#fef3c7', borderColor: '#f59e0b' }}>
                            My Task (Shared)
                          </Badge>
                          {task.updatedAt && (() => {
                            const updatedTime = new Date(task.updatedAt)
                            const now = new Date()
                            const hoursSinceUpdate = (now.getTime() - updatedTime.getTime()) / (1000 * 60 * 60)
                            // Show "Updated" badge if updated within last hour
                            if (hoursSinceUpdate < 1) {
                              return (
                                <Badge variant="default" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#10b981', color: 'white' }}>
                                  Updated
                                </Badge>
                              )
                            }
                            return null
                          })()}
                        </div>
                        {getSharedEmails(task.sharedWith).length > 0 && (
                          <p style={{ 
                            fontSize: '0.75rem', 
                            color: '#6b7280',
                            margin: 0,
                            wordBreak: 'break-word'
                          }}>
                            Shared with: {getSharedEmails(task.sharedWith).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    {task.details && (
                      <p style={{ 
                        fontSize: '0.95rem', 
                        color: '#6b7280',
                        marginBottom: '1rem',
                        wordBreak: 'break-word',
                        lineHeight: '1.5'
                      }}>
                        {task.details}
                      </p>
                    )}
                    <div style={{ 
                      display: 'flex',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      marginBottom: '0.75rem'
                    }}>
                      {task.priority && (() => {
                        const priorityLower = String(task.priority).toLowerCase().trim();
                        let variant: 'destructive' | 'default' | 'secondary' = 'secondary';
                        let className = '';

                        if (priorityLower === 'high') {
                          variant = 'destructive';
                          className = '!bg-red-600 !text-white';
                        } else if (priorityLower === 'medium') {
                          variant = 'default';
                          className = '!bg-blue-600 !text-white';
                        } else if (priorityLower === 'low') {
                          variant = 'secondary';
                          className = '!bg-gray-500 !text-white';
                        }

                        return (
                          <Badge
                            variant={variant}
                            className={className}
                            style={{
                              textTransform: 'capitalize'
                            }}
                          >
                            {task.priority}
                          </Badge>
                        );
                      })()}
                      {task.status && (
                        <Badge 
                          variant={
                            task.status === 'done' ? 'default' :
                            task.status === 'in-progress' ? 'secondary' : 'outline'
                          }
                          style={{
                            textTransform: 'capitalize'
                          }}
                        >
                          {task.status === 'in-progress' ? 'In Progress' : task.status === 'todo' ? 'To Do' : task.status}
                        </Badge>
                      )}
                      {task.hrs && (
                        <Badge variant="outline" style={{ fontSize: '0.75rem' }}>
                          {task.hrs} hrs
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      )}
        </div>
      )}
      
      <section
        style={{
          marginTop: '3rem',
          paddingTop: '2.5rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '1.35rem',
              fontWeight: 600,
              marginBottom: '0.5rem',
              color: '#111827'
            }}
          >
            GitHub Issue Radar
          </h2>
          <p
            style={{
              color: '#6b7280',
              fontSize: '0.95rem',
              maxWidth: '640px',
              margin: 0
            }}
          >
            We pull the two newest open issues from the project you pick—perfect for spotting what needs attention next.
          </p>
        </div>

        {projects === undefined ? (
          <Card
            style={{
              padding: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem'
            }}
          >
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            <span style={{ color: '#6b7280', fontSize: '0.95rem' }}>
              Loading linked projects…
            </span>
          </Card>
        ) : githubProjects.length === 0 ? (
          <Card style={{ padding: '2rem' }}>
            <p
              style={{
                color: '#6b7280',
                fontSize: '0.95rem',
                margin: 0
              }}
            >
              Add a GitHub repository URL to one of your projects and it will appear here for quick issue syncing.
            </p>
          </Card>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#4b5563'
                }}
              >
                Project
              </span>
              <div style={{ minWidth: '220px' }}>
                <Select
                  value={selectedProjectId ?? undefined}
                  onValueChange={(value) => setSelectedProjectId(value)}
                >
                  <SelectTrigger className="w-full">
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
              <Card
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.75rem',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff'
                }}
              >
                <CardContent
                  style={{
                    padding: '1.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ flex: '1 1 320px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                          marginBottom: '0.5rem'
                        }}
                      >
                        <Github className="h-4 w-4 text-slate-500" />
                        <h3
                          style={{
                            fontSize: '1.15rem',
                            fontWeight: 600,
                            color: '#111827',
                            margin: 0
                          }}
                        >
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
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontSize: '0.85rem',
                              color: '#3b82f6',
                              textDecoration: 'none'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = 'underline'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = 'none'
                            }}
                          >
                            {repoSlug}
                            <ArrowUpRight size={14} />
                          </a>
                        )
                      })()}
                      {selectedProject.description && selectedProject.description.trim().length > 0 && (
                        <p
                          style={{
                            color: '#6b7280',
                            fontSize: '0.85rem',
                            marginTop: '0.75rem',
                            marginBottom: 0,
                            lineHeight: 1.5
                          }}
                        >
                          {selectedProject.description}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem'
                      }}
                    >
                      Latest Issues
                    </Badge>
                  </div>

                  {selectedProjectIssues.status === 'loading' || selectedProjectIssues.status === 'idle' ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        color: '#6b7280',
                        fontSize: '0.95rem'
                      }}
                    >
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      <span>Syncing GitHub issues…</span>
                    </div>
                  ) : selectedProjectIssues.status === 'error' ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          color: '#ef4444',
                          fontSize: '0.95rem'
                        }}
                      >
                        <AlertCircle className="h-4 w-4" />
                        <span>We couldn&apos;t load issues for this repository.</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          alignItems: 'center'
                        }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRetry}
                          style={{
                            padding: '0.35rem 0.85rem',
                            fontSize: '0.8rem'
                          }}
                        >
                          Try again
                        </Button>
                        {selectedProjectIssues.error && (
                          <span
                            style={{
                              color: '#9ca3af',
                              fontSize: '0.85rem'
                            }}
                          >
                            {selectedProjectIssues.error}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : selectedProjectIssues.issues.length === 0 ? (
                    <p
                      style={{
                        color: '#6b7280',
                        fontSize: '0.95rem',
                        margin: 0
                      }}
                    >
                      No open issues found in the latest sync.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                      }}
                    >
                      {selectedProjectIssues.issues.map((issue) => (
                        <div
                          key={issue.id}
                          style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '0.75rem',
                            padding: '1rem',
                            backgroundColor: '#f9fafb',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem'
                            }}
                          >
                            <a
                              href={issue.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                color: '#1d4ed8',
                                textDecoration: 'none',
                                flex: '1 1 auto',
                                minWidth: 0
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.textDecoration = 'underline'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.textDecoration = 'none'
                              }}
                            >
                              <span style={{ color: '#6b7280' }}>#{issue.number}</span>
                              <span style={{ flex: '1 1 auto', minWidth: 0 }}>{issue.title}</span>
                              <ArrowUpRight size={16} />
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
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <ListTodo size={16} />
                              Add Task
                            </Button>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              flexWrap: 'wrap',
                              color: '#6b7280',
                              fontSize: '0.85rem'
                            }}
                          >
                            <span style={{ textTransform: 'capitalize' }}>{issue.state}</span>
                            {issue.user?.login && (
                              <>
                                <span>•</span>
                                <span>by {issue.user.login}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{formatRelativeTime(issue.created_at)}</span>
                          </div>
                          {Array.isArray(issue.labels) && issue.labels.length > 0 && (
                            <div
                              style={{
                                display: 'flex',
                                gap: '0.5rem',
                                flexWrap: 'wrap'
                              }}
                            >
                              {issue.labels.slice(0, 3).map((label) => (
                                <Badge
                                  key={`${issue.id}-${label.id ?? label.name}`}
                                  variant="outline"
                                  style={{
                                    fontSize: '0.7rem',
                                    textTransform: 'none'
                                  }}
                                >
                                  {label.name}
                                </Badge>
                              ))}
                              {issue.labels.length > 3 && (
                                <Badge
                                  variant="outline"
                                  style={{
                                    fontSize: '0.7rem'
                                  }}
                                >
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

      <EditTaskModal
        open={isEditModalOpen}
        onOpenChange={(open) => {
          setIsEditModalOpen(open)
          if (!open) {
            setEditingTask(null)
            refetchTasks()
          }
        }}
        task={editingTask}
      />
      <AddTaskModal
        open={isAddModalOpen}
        onOpenChange={(open) => {
          setIsAddModalOpen(open)
          if (!open) {
            setAddTaskPrefill(null)
            refetchTasks()
          }
        }}
        projectId={addTaskPrefill?.projectId}
        initialTask={addTaskPrefill ?? undefined}
      />
    </main>
  )
}

