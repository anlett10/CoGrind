import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { QueryClient } from '@tanstack/react-query'
import { DefaultNotFound } from '~/components/app/default-not-found'

export function getRouter() {
  // Try multiple ways to get the Convex URL for Cloudflare Workers compatibility
  const CONVEX_URL = 
    import.meta.env.VITE_CONVEX_URL ||
    (typeof process !== 'undefined' && process.env?.VITE_CONVEX_URL) ||
    null;
  
  if (!CONVEX_URL) {
    const errorMsg = `missing VITE_CONVEX_URL environment variable. Available env vars: ${JSON.stringify({
      hasViteConvexUrl: !!import.meta.env.VITE_CONVEX_URL,
      hasProcessEnv: typeof process !== 'undefined',
      envKeys: typeof process !== 'undefined' && process.env ? Object.keys(process.env).filter(k => k.includes('CONVEX')) : [],
    })}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
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

  return router
}