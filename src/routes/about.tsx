import { createFileRoute } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useConvexQuery } from '@convex-dev/react-query'

export const Route = createFileRoute('/about')({
  component: RouteComponent,
})

type User = {
  _id: string
  name: string
  email: string
  image?: string | null
  emailVerified: boolean
}

function RouteComponent() {
  const users = useConvexQuery(api.auth.listUsers, {}) as User[] | undefined
  
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
          User Directory
        </h1>
        <p style={{ 
          color: '#888', 
          fontSize: '1.1rem',
          fontWeight: '400'
        }}>
          Manage and view all registered users in your application
        </p>
      </div>

      <div style={{ 
        padding: '2.5rem', 
        background: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '16px', 
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)'
      }}>
        {users ? (
          users.length === 0 ? (
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
                👥
              </div>
              <p style={{ 
                fontSize: '1.25rem', 
                fontWeight: '500',
                marginBottom: '0.5rem'
              }}>
                No users yet
              </p>
              <p style={{ fontSize: '0.95rem', color: '#666' }}>
                Users will appear here once they register
              </p>
            </div>
          ) : (
            <div>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem',
                paddingBottom: '1.5rem',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <h2 style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: '600',
                  margin: 0
                }}>
                  All Users
                </h2>
                <div style={{ 
                  padding: '0.5rem 1rem',
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.18)',
                  borderRadius: '8px',
                  color: '#2563eb',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}>
                  {users.length} {users.length === 1 ? 'User' : 'Users'}
                </div>
              </div>

              <div style={{ 
                display: 'grid', 
                gap: '1rem',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))'
              }}>
                {users.map((user) => (
                  <div 
                    key={user._id} 
                    style={{ 
                      padding: '1.75rem', 
                      background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)', 
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#93c5fd'
                      e.currentTarget.style.transform = 'translateY(-3px)'
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
                      gap: '1.25rem'
                    }}>
                      <div style={{ position: 'relative' }}>
                        {user.image ? (
                          <img 
                            src={user.image} 
                            alt={user.name} 
                            style={{ 
                              width: '64px', 
                              height: '64px', 
                              borderRadius: '12px',
                              border: '2px solid #e5e7eb',
                              objectFit: 'cover',
                              background: '#f3f4f6'
                            }} 
                          />
                        ) : (
                          <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '12px',
                            border: '2px solid #e5e7eb',
                            background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.75rem',
                            fontWeight: '700',
                            color: 'white'
                          }}>
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {user.emailVerified && (
                          <div style={{
                            position: 'absolute',
                            bottom: '-4px',
                            right: '-4px',
                            width: '24px',
                            height: '24px',
                            background: '#16a34a',
                            borderRadius: '50%',
                            border: '2px solid #ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem'
                          }}>
                            ✓
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          fontSize: '1.15rem', 
                          fontWeight: '600', 
                          marginBottom: '0.5rem',
                          color: '#111827',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {user.name}
                        </div>
                        <div style={{ 
                          fontSize: '0.9rem', 
                          color: '#6b7280',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: '0.75rem'
                        }}>
                          {user.email}
                        </div>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.35rem 0.85rem',
                          background: user.emailVerified 
                            ? 'rgba(22, 163, 74, 0.1)' 
                            : 'rgba(156, 163, 175, 0.1)',
                          border: `1px solid ${user.emailVerified ? 'rgba(22, 163, 74, 0.2)' : 'rgba(156, 163, 175, 0.2)'}`,
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '500',
                          color: user.emailVerified ? '#4ade80' : '#9ca3af'
                        }}>
                          <span style={{ 
                            width: '6px', 
                            height: '6px', 
                            borderRadius: '50%',
                            background: user.emailVerified ? '#16a34a' : '#6b7280'
                          }}></span>
                          {user.emailVerified ? 'Verified' : 'Unverified'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
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
              Loading users...
            </p>
            <style>
              {`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}
            </style>
          </div>
        )}
      </div>
    </main>
  )
}