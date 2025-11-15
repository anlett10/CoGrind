import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { QueryClient } from '@tanstack/react-query'
import { DefaultNotFound } from '~/components/app/default-not-found'
import * as Sentry from '@sentry/tanstackstart-react'

export function getRouter() {
  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL!
  if (!CONVEX_URL) {
    throw new Error('missing VITE_CONVEX_URL envar')
  }
  const convex = new ConvexReactClient(CONVEX_URL, {
    unsavedChangesWarning: false,
  })
  const convexQueryClient = new ConvexQueryClient(convex)

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        staleTime: 30000, // Consider data fresh for 30 seconds
        refetchOnWindowFocus: false, // Disable refetch on window focus to reduce updates
        refetchOnReconnect: true, // Still refetch on reconnect
        refetchOnMount: false, // Don't refetch on mount if data exists
      },
    },
  })
  convexQueryClient.connect(queryClient)

  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      defaultPreload: 'intent',
      scrollRestoration: true,
      context: { queryClient, convexClient: convex, convexQueryClient }, 
      Wrap: ({ children }) => (
        <ConvexProvider client={convexQueryClient.convexClient}>
          {children}
        </ConvexProvider>
      ),
      defaultNotFoundComponent: DefaultNotFound,
    }),
    queryClient,
  )

  // Initialize Sentry on the client side
  if (!router.isServer) {
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN
    if (sentryDsn) {
      Sentry.init({
        dsn: sentryDsn,
        // Adds request headers and IP for users
        sendDefaultPii: true,
        integrations: [
          Sentry.tanstackRouterBrowserTracingIntegration(router),
          Sentry.replayIntegration(),
        ],
        // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
        // We recommend adjusting this value in production.
        tracesSampleRate: 1.0,
        // Capture Replay for 10% of all sessions,
        // plus for 100% of sessions with an error.
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
      })
    }
  }

  return router
}