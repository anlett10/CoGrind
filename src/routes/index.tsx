import { createFileRoute } from '@tanstack/react-router'
import authClient from '~/lib/auth-client'
import { Button } from '~/components/ui/button'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <main>
        <h1>Loading...</h1>
      </main>
    )
  }

  return (
    <main>
      <h1>Hello world!</h1>
      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Button>Default Button</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </div>
      {session ? (
        <div style={{ marginTop: '2rem', padding: '1rem', background: '#1a1a1a', borderRadius: '8px' }}>
          <h2>Welcome back!</h2>
          <p>Email: {session.user.email}</p>
          <p>Name: {session.user.name || 'Not set'}</p>
          <button
            onClick={async () => {
              await authClient.signOut()
            }}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#ef4444',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
            }}
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div style={{ marginTop: '2rem' }}>
          <p>You are not signed in.</p>
          <a href="/login" style={{ color: '#60a5fa' }}>Sign in here</a>
        </div>
      )}
    </main>
  )
}
