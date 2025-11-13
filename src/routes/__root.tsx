/// <reference types="vite/client" />
import * as React from 'react'
import '~/styles/app.css'
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouteContext, 
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { QueryClient } from '@tanstack/react-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexReactClient } from 'convex/react'
import { getCookie, getRequest } from '@tanstack/react-start/server'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { fetchSession, getCookieName } from '@convex-dev/better-auth/react-start'
import { authClient } from "~/lib/auth-client";
import { AppHeader } from "~/components/app/app-header";

// Get auth information for SSR using available cookies
const fetchAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const { createAuth } = await import('../../convex/auth')
  const { session } = await fetchSession(getRequest())
  const sessionCookieName = getCookieName(createAuth)
  const token = getCookie(sessionCookieName)
  return {
    userId: session?.user.id,
    token,
  }
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexClient: ConvexReactClient
  convexQueryClient: ConvexQueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  beforeLoad: async (ctx) => {
    // all queries, mutations and action made with TanStack Query will be
    // authenticated by an identity token.
    const { userId, token } = await fetchAuth()

    // During SSR only (the only time serverHttpClient exists),
    // set the auth token to make HTTP queries with.
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
    }

    return { userId, token }
  },
  component: RootComponent,
})

function RootComponent() {
  const context = useRouteContext({ from: Route.id })
  return (
    <ConvexBetterAuthProvider
      client={context.convexClient}
      authClient={authClient}
    >
      <RootDocument>
        <Outlet />
      </RootDocument>
    </ConvexBetterAuthProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const stored = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const shouldUseDark = stored === 'dark' || (!stored && prefersDark);
                if (shouldUseDark) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
        <HeadContent />
      </head>
      <body className="h-full">
        <AppHeader />
        <main className="w-full">
          {children}
        </main>
        <Scripts />
      </body>
    </html>
  )
}
