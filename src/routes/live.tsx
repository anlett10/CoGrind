import { createFileRoute } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useConvexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Id } from 'convex/_generated/dataModel'
import authClient from '~/lib/auth-client'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { LogIn, CheckCircle2, Circle } from 'lucide-react'
import { Badge } from '~/components/ui/badge'

export const Route = createFileRoute('/live')({
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

function RouteComponent() {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()

  const tasks = useConvexQuery(
    api.tasks.listTasks,
    {}
  ) as Task[] | undefined
  
  // Helper to refetch tasks
  const refetchTasks = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey
        return Array.isArray(key) && key[0] === api.tasks.listTasks
      }
    })
  }

  const toggleTaskSelectionMutation = useConvexMutation(api.tasks.toggleTaskSelection)

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
      today.setHours(0, 0, 0, 0, 0)
      const todayTimestamp = today.getTime()
      
      const todaySelections: Array<{ email: string; timestamp: number }> = []
      
      // Handle case where selectedBy might be an object with email -> timestamp
      if (typeof selectedBy === 'object' && selectedBy !== null && !Array.isArray(selectedBy)) {
        for (const [email, timestamp] of Object.entries(selectedBy)) {
          if (typeof timestamp === 'number') {
            const selectedDate = new Date(timestamp)
            selectedDate.setHours(0, 0, 0, 0, 0)
            const selectedTimestamp = selectedDate.getTime()
            
            if (selectedTimestamp === todayTimestamp) {
              todaySelections.push({ email, timestamp })
            }
          }
        }
      }
      
      return todaySelections
    } catch (error) {
      console.error("Error parsing selectedBy:", error, task.selectedBy)
      return []
    }
  }

  // Helper to check if current user selected the task today
  const isTaskSelectedByMeToday = (task: Task) => {
    if (!session?.user?.email) return false
    const selections = getSelectedByToday(task)
    return selections.some(s => s.email === session.user.email)
  }

  // Helper to check if task is selected by anyone today
  const isTaskSelectedToday = (task: Task) => {
    return getSelectedByToday(task).length > 0
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

  const handleToggleSelection = async (task: Task) => {
    if (!session?.user?.email) {
      console.error("Cannot toggle selection: user email not found in session")
      return
    }
    
    const isSelected = isTaskSelectedByMeToday(task)
    
    try {
      await toggleTaskSelectionMutation({
        taskId: task._id as Id<"tasks">,
        selected: !isSelected,
      })
      
      // Refetch tasks to update the UI
      await refetchTasks()
      
      // Also invalidate queries as backup
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey
          return Array.isArray(key) && key[0] === api.tasks.listTasks
        }
      })
    } catch (error) {
      console.error("Failed to toggle task selection:", error)
      // Show user-friendly error
      const errorMessage = error instanceof Error ? error.message : String(error)
      alert(`Failed to toggle selection: ${errorMessage}`)
    }
  }

  if (sessionPending) {
    return (
      <main style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem',
        minHeight: '100vh'
      }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Loading...</p>
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem',
        minHeight: '100vh'
      }}>
        <Card style={{ maxWidth: '500px', margin: '2rem auto', padding: '2rem' }}>
          <div style={{ textAlign: 'center' }}>
            <LogIn className="h-12 w-12 mx-auto mb-4" style={{ color: '#6b7280' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Please Sign In
            </h2>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              You need to be signed in to view your live tasks.
            </p>
          </div>
        </Card>
      </main>
    )
  }

  // Separate selected and unselected tasks
  const selectedTasksList = (tasks || []).filter(task => isTaskSelectedToday(task))
  const unselectedTasksList = (tasks || []).filter(task => !isTaskSelectedToday(task))

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
          Live
        </h1>
        <p style={{ 
          color: '#6b7280',
          fontSize: '1rem'
        }}>
          Review and select tasks for today
        </p>
      </div>

      {/* Selected Tasks Section */}
      {selectedTasksList.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            marginBottom: '1rem',
            color: '#111827',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <CheckCircle2 className="h-5 w-5" style={{ color: '#10b981' }} />
            Selected for Today ({selectedTasksList.length})
          </h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '1rem' 
          }}>
            {selectedTasksList.map((task) => (
              <Card
                key={task._id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: '#f0fdf4',
                  borderColor: '#10b981'
                }}
                onClick={() => handleToggleSelection(task)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#10b981'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 10px 24px rgba(16, 185, 129, 0.12)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#10b981'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <CardContent style={{ padding: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ 
                      marginTop: '0.25rem',
                      color: '#10b981',
                      flexShrink: 0
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
                          {getSelectedByToday(task).length > 0 && (
                            <div style={{ 
                              marginTop: '0.5rem',
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                              alignItems: 'center'
                            }}>
                              <span style={{ 
                                fontSize: '0.75rem', 
                                color: '#10b981',
                                fontWeight: '500'
                              }}>
                                Selected by:
                              </span>
                              {getSelectedByToday(task).map((selection, idx) => (
                                <Badge 
                                  key={idx}
                                  variant={selection.email === session?.user?.email ? "default" : "outline"}
                                  style={{ 
                                    fontSize: '0.7rem',
                                    padding: '0.125rem 0.5rem',
                                    backgroundColor: selection.email === session?.user?.email ? '#10b981' : undefined,
                                    color: selection.email === session?.user?.email ? 'white' : undefined
                                  }}
                                >
                                  {selection.email === session?.user?.email ? 'You' : selection.email}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {task.details && (
                        <p style={{ 
                          fontSize: '0.95rem', 
                          color: '#6b7280',
                          marginBottom: '0.75rem',
                          wordBreak: 'break-word'
                        }}>
                          {task.details}
                        </p>
                      )}
                      <div style={{ 
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        alignItems: 'center'
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

      {/* Available Tasks Section */}
      <div>
        <h2 style={{ 
          fontSize: '1.25rem', 
          fontWeight: '600', 
          marginBottom: '1rem',
          color: '#111827',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Circle className="h-5 w-5" style={{ color: '#6b7280' }} />
          Available Tasks ({unselectedTasksList.length})
        </h2>
        {unselectedTasksList.length === 0 ? (
          <Card style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: '#6b7280' }}>
              {selectedTasksList.length > 0 
                ? 'All tasks have been selected for today!' 
                : 'No tasks available. Create tasks to get started.'}
            </p>
          </Card>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '1rem' 
          }}>
            {unselectedTasksList.map((task) => (
              <Card
                key={task._id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onClick={() => handleToggleSelection(task)}
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
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ 
                      marginTop: '0.25rem',
                      color: '#9ca3af',
                      flexShrink: 0
                    }}>
                      <Circle className="h-5 w-5" />
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
                          {getSelectedByToday(task).length > 0 && (
                            <div style={{ 
                              marginTop: '0.5rem',
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                              alignItems: 'center'
                            }}>
                              <span style={{ 
                                fontSize: '0.75rem', 
                                color: '#10b981',
                                fontWeight: '500'
                              }}>
                                Selected by:
                              </span>
                              {getSelectedByToday(task).map((selection, idx) => (
                                <Badge 
                                  key={idx}
                                  variant={selection.email === session?.user?.email ? "default" : "outline"}
                                  style={{ 
                                    fontSize: '0.7rem',
                                    padding: '0.125rem 0.5rem',
                                    backgroundColor: selection.email === session?.user?.email ? '#10b981' : undefined,
                                    color: selection.email === session?.user?.email ? 'white' : undefined
                                  }}
                                >
                                  {selection.email === session?.user?.email ? 'You' : selection.email}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {task.details && (
                        <p style={{ 
                          fontSize: '0.95rem', 
                          color: '#6b7280',
                          marginBottom: '0.75rem',
                          wordBreak: 'break-word'
                        }}>
                          {task.details}
                        </p>
                      )}
                      <div style={{ 
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        alignItems: 'center'
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
        )}
      </div>
    </main>
  )
}

