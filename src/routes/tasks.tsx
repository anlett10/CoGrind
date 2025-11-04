import { createFileRoute } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useConvexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useState } from 'react'
import { Id } from 'convex/_generated/dataModel'
import authClient from '~/lib/auth-client'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Link } from '@tanstack/react-router'
import { Plus, CheckCircle2, LogIn, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '~/components/ui/badge'
import { AddTaskModal } from '~/components/app/add-task-modal'
import { EditTaskModal } from '~/components/app/edit-task-modal'

export const Route = createFileRoute('/tasks')({
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
}

// Type for edit modal (needs Id type)
type TaskForEdit = {
  _id: string
  text: string
  details: string
  priority?: string
  status?: string
  hrs?: number
  sharedWith?: string
}

function RouteComponent() {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskForEdit | null>(null)

  const tasks = useConvexQuery(
    api.tasks.listTasks,
    {}
  ) as Task[] | undefined

  const deleteTask = useConvexMutation(api.tasks.deleteTask)

  // Helper to check if task is shared (not owned by current user)
  const isTaskShared = (task: Task) => {
    return task.userId !== session?.user?.id
  }

  // Helper to parse and get shared emails
  const getSharedEmails = (sharedWith?: string): string[] => {
    if (!sharedWith) return []
    try {
      const emails = JSON.parse(sharedWith)
      return Array.isArray(emails) ? emails : []
    } catch {
      return []
    }
  }

  if (sessionPending) {
    return (
      <main style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '3rem 2rem' 
      }}>
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ 
            display: 'inline-block',
            width: '48px',
            height: '48px',
            border: '4px solid #e5e7eb',
            borderTopColor: '#60a5fa',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '1.5rem'
          }}></div>
          <p style={{ 
            color: '#6b7280',
            fontSize: '1.1rem',
            fontWeight: '500'
          }}>
            Loading...
          </p>
          <style>
            {`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '3rem 2rem' 
      }}>
        <Card className="max-w-md mx-auto mt-16">
          <CardHeader>
            <CardTitle className="text-2xl">Login Required</CardTitle>
            <CardDescription>
              You need to be logged in to view and create tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/login">
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '3rem 2rem' 
    }}>
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: '700', 
          marginBottom: '0.5rem',
          background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          My Tasks
        </h1>
        <p style={{ 
          color: '#888', 
          fontSize: '1.1rem',
          fontWeight: '400'
        }}>
          Manage your tasks and stay organized
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div></div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add New Task
        </Button>
      </div>

      <div style={{ display: 'grid', gap: '2rem' }}>
        {/* Tasks List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Tasks</CardTitle>
            <CardDescription>
              {tasks ? `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}` : 'Loading tasks...'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tasks === undefined ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '4rem 2rem' 
              }}>
                <div style={{ 
                  display: 'inline-block',
                  width: '48px',
                  height: '48px',
                  border: '4px solid #e5e7eb',
                  borderTopColor: '#60a5fa',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '1.5rem'
                }}></div>
                <p style={{ 
                  color: '#6b7280',
                  fontSize: '1.1rem',
                  fontWeight: '500'
                }}>
                  Loading tasks...
                </p>
                <style>
                  {`
                    @keyframes spin {
                      to { transform: rotate(360deg); }
                    }
                  `}
                </style>
              </div>
            ) : tasks && tasks.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '4rem 2rem',
                color: '#888'
              }}>
                <div style={{ 
                  fontSize: '3rem', 
                  marginBottom: '1rem',
                  opacity: 0.5
                }}>
                  ✓
                </div>
                <p style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '500',
                  marginBottom: '0.5rem'
                }}>
                  No tasks yet
                </p>
                <p style={{ fontSize: '0.95rem', color: '#666' }}>
                  Create your first task using the form above
                </p>
              </div>
            ) : tasks ? (
              <div style={{ 
                display: 'grid', 
                gap: '1rem'
              }}>
                {tasks.map((task) => {
                  return (
                  <div 
                    key={task._id} 
                    style={{ 
                      padding: '1.5rem', 
                      background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)', 
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      overflow: 'hidden'
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
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '1rem'
                    }}>
                      <div style={{
                        marginTop: '0.25rem',
                        color: '#60a5fa'
                      }}>
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '1rem',
                          marginBottom: '0.5rem',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{ flex: 1, minWidth: '200px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                              <h3 style={{ 
                                fontSize: '1.15rem', 
                                fontWeight: '600', 
                                color: '#111827',
                                wordBreak: 'break-word',
                                margin: 0
                              }}>
                                {task.text}
                              </h3>
                              {isTaskShared(task) && (
                                <Badge variant="outline" style={{ fontSize: '0.7rem', padding: '0.125rem 0.5rem' }}>
                                  Shared
                                </Badge>
                              )}
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
                                  sharedWith: task.sharedWith
                                })
                                setIsEditModalOpen(true)
                              }}
                              style={{
                                width: '32px',
                                height: '32px',
                                padding: 0,
                                flexShrink: 0
                              }}
                              title="Edit task"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to delete "${task.text}"? This action cannot be undone.`)) {
                                  try {
                                    await deleteTask({ taskId: task._id as Id<"tasks"> })
                                  } catch (error) {
                                    console.error('Failed to delete task:', error)
                                    alert('Failed to delete task. Please try again.')
                                  }
                                }
                              }}
                              style={{
                                width: '32px',
                                height: '32px',
                                padding: 0,
                                flexShrink: 0,
                                color: '#ef4444'
                              }}
                              title="Delete task"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
                          </div>
                        </div>
                        {task.details && (
                          <p style={{ 
                            fontSize: '0.95rem', 
                            color: '#6b7280',
                            lineHeight: '1.5',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                            marginBottom: '0.75rem'
                          }}>
                            {task.details}
                          </p>
                        )}
                        <div style={{ 
                          display: 'flex',
                          gap: '1rem',
                          flexWrap: 'wrap',
                          fontSize: '0.875rem',
                          color: '#6b7280'
                        }}>
                          {task.hrs !== undefined && (
                            <span style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
                              <span style={{ fontWeight: '500' }}>Hours:</span>
                              <span>{task.hrs}</span>
                            </span>
                          )}
                          {task.startedAt && (
                            <span style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
                              <span style={{ fontWeight: '500' }}>Started:</span>
                              <span>{new Date(task.startedAt).toLocaleDateString()}</span>
                            </span>
                          )}
                          {task.completedAt && (
                            <span style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              color: '#16a34a'
                            }}>
                              <span style={{ fontWeight: '500' }}>Completed:</span>
                              <span>{new Date(task.completedAt).toLocaleDateString()}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <AddTaskModal open={isModalOpen} onOpenChange={setIsModalOpen} />
      <EditTaskModal 
        open={isEditModalOpen} 
        onOpenChange={(open) => {
          setIsEditModalOpen(open)
          if (!open) {
            setEditingTask(null)
          }
        }}
        task={editingTask}
      />
    </main>
  )
}

