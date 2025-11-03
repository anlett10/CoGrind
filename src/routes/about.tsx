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
    <main>
      <h1>Users in Convex Database</h1>
      <div style={{ marginTop: '2rem', padding: '2rem', background: '#1a1a1a', borderRadius: '12px', border: '1px solid #333' }}>
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: '600' }}>
          All Registered Users
        </h2>
        {users ? (
          users.length === 0 ? (
            <p style={{ color: '#888', fontSize: '1rem' }}>No users found yet.</p>
          ) : (
            <div>
              <p style={{ marginBottom: '1.5rem', color: '#aaa', fontSize: '0.9rem' }}>
                Total: {users.length} {users.length === 1 ? 'user' : 'users'}
              </p>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {users.map((user) => (
                  <div 
                    key={user._id} 
                    style={{ 
                      padding: '1.5rem', 
                      background: 'linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%)', 
                      borderRadius: '8px',
                      border: '1px solid #333',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#555'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#333'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    {user.image && (
                      <img 
                        src={user.image} 
                        alt={user.name} 
                        style={{ 
                          width: '60px', 
                          height: '60px', 
                          borderRadius: '50%',
                          border: '2px solid #444',
                          objectFit: 'cover'
                        }} 
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                        {user.name}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#888' }}>
                        {user.email}
                      </div>
                      {user.emailVerified && (
                        <div style={{ 
                          display: 'inline-block',
                          marginTop: '0.5rem',
                          padding: '0.25rem 0.75rem',
                          background: '#16a34a',
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}>
                          ✓ Verified
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ 
              display: 'inline-block',
              width: '40px',
              height: '40px',
              border: '4px solid #333',
              borderTopColor: '#60a5fa',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '1rem'
            }}></div>
            <p style={{ color: '#888' }}>Loading users...</p>
          </div>
        )}
      </div>
    </main>
  )
}
