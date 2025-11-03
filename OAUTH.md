# OAuth Authentication with Convex and Better Auth

This guide explains how to set up OAuth authentication (Google and GitHub) using Better Auth with Convex in a TanStack Start application.

## Overview

Better Auth is used as a Convex component to handle authentication. This means that user data is stored in component tables, which are isolated from your main Convex schema. The data is fully functional and can be queried programmatically, but won't appear in the main Convex dashboard.

## Prerequisites

- A Convex account and project set up
- OAuth apps created for Google and GitHub
- TanStack Start project initialized

## Setup Steps

### 1. Install Dependencies

```bash
npm install @convex-dev/better-auth better-auth convex
```

### 2. Configure Convex Component

Create `convex/convex.config.ts`:

```typescript
import { betterAuth } from "@convex-dev/better-auth/component";
import { defineConfig } from "convex/server";

export default defineConfig({
  authComponent: betterAuth,
});
```

Create `convex/schema.ts`:

```typescript
import { defineSchema } from 'convex/server'

// The Better Auth component automatically provides its own schema via convex.config.ts
// We don't need to manually define auth tables here.
// Empty schema is fine if you don't have any custom tables yet.
export default defineSchema({})
```

**Important**: Do NOT manually define `users`, `sessions`, or `accounts` tables in your schema. The Better Auth component provides these automatically.

### 3. Configure Better Auth

Create `convex/auth.ts`:

```typescript
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth";

// SITE_URL is the public URL where your app is hosted (for Better Auth baseURL)
const siteUrl = process.env.SITE_URL || process.env.CONVEX_SITE_URL || 'http://localhost:3000';

// CONVEX_SITE_URL is required for the Convex plugin (sets JWT issuer and OIDC metadata)
if (!process.env.CONVEX_SITE_URL) {
  console.warn('CONVEX_SITE_URL is not set. This is required for the Convex plugin.');
}

const githubClientId = process.env.GITHUB_CLIENT_ID || '';
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || '';
const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

// The component client has methods needed for integrating Convex with Better Auth
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false },
) => {
  return betterAuth({
    logger: {
      disabled: optionsOnly,
    },
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    // Configure OAuth providers
    socialProviders: {
      ...(githubClientId && githubClientSecret ? {
        github: {
          clientId: githubClientId,
          clientSecret: githubClientSecret,
        },
      } : {}),
      ...(googleClientId && googleClientSecret ? {
        google: {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        },
      } : {}),
    },
    plugins: [
      convex(),
    ],
  });
};

// Example function for getting the current user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
```

Create `convex/http.ts`:

```typescript
import { httpRouter } from "convex/server";
import { authComponent } from "./auth";
import { createAuth } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

export default http;
```

### 4. Set Up Environment Variables

#### In Convex Dashboard

Go to your Convex project settings and add these environment variables:

- `CONVEX_SITE_URL`: Your public URL (e.g., `https://your-app.com`)
- `SITE_URL`: Your public URL (same as CONVEX_SITE_URL, fallback)
- `GITHUB_CLIENT_ID`: From your GitHub OAuth app
- `GITHUB_CLIENT_SECRET`: From your GitHub OAuth app
- `GOOGLE_CLIENT_ID`: From your Google OAuth app
- `GOOGLE_CLIENT_SECRET`: From your Google OAuth app

#### In `.env.local` (for local development)

```bash
VITE_CONVEX_URL=wss://your-deployment.convex.cloud
VITE_CONVEX_SITE_URL=https://your-deployment.convex.cloud
```

### 5. Create OAuth Apps

#### GitHub OAuth App

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth app
3. Set "Authorization callback URL" to: `https://your-deployment.convex.cloud/auth/callback/github`
4. Copy the Client ID and Client Secret

#### Google OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Google+ API
4. Create OAuth 2.0 credentials
5. Set "Authorized redirect URIs" to: `https://your-deployment.convex.cloud/auth/callback/google`
6. Copy the Client ID and Client Secret

### 6. Set Up Frontend Auth Client

Create `src/lib/auth-client.ts`:

```typescript
import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  plugins: [convexClient()],
});

const authClientDefault = authClient;
export default authClientDefault;
```

### 7. Set Up API Route Handler

Create `src/routes/api/auth/$.ts`:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { reactStartHandler } from '@convex-dev/better-auth/react-start'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = (import.meta as any).env;
          let convexSiteUrl = env.VITE_CONVEX_SITE_URL;
          if (!convexSiteUrl && env.VITE_CONVEX_URL) {
            const convexUrl = env.VITE_CONVEX_URL;
            convexSiteUrl = convexUrl.replace(/^wss?:\/\//, 'https://').replace(/\/$/, '');
          }
          if (!convexSiteUrl) {
            return new Response(
              JSON.stringify({ error: 'Server configuration error: VITE_CONVEX_SITE_URL is not set' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }
          return await reactStartHandler(request, { convexSiteUrl });
        } catch (error) {
          console.error('Auth handler error:', error);
          return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      },
      POST: async ({ request }) => {
        try {
          const env = (import.meta as any).env;
          let convexSiteUrl = env.VITE_CONVEX_SITE_URL;
          if (!convexSiteUrl && env.VITE_CONVEX_URL) {
            const convexUrl = env.VITE_CONVEX_URL;
            convexSiteUrl = convexUrl.replace(/^wss?:\/\//, 'https://').replace(/\/$/, '');
          }
          if (!convexSiteUrl) {
            return new Response(
              JSON.stringify({ error: 'Server configuration error: VITE_CONVEX_SITE_URL is not set' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }
          return await reactStartHandler(request, { convexSiteUrl });
        } catch (error) {
          console.error('Auth handler error:', error);
          return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      },
    },
  },
})
```

### 8. Configure Router

Update `src/router.tsx`:

```typescript
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { QueryClient } from '@tanstack/react-query'

export function getRouter() {
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL!
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
    }),
    queryClient,
  )

  return router
}
```

Update `src/routes/__root.tsx`:

```typescript
/// <reference types="vite/client" />
import * as React from 'react'
import appCss from '~/styles/app.css?url'
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Link,
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
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  beforeLoad: async (ctx) => {
    const { userId, token } = await fetchAuth()

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
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-neutral-950 text-neutral-50">
        <nav style={{ padding: '1rem', borderBottom: '1px solid #333', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link to="/" style={{ textDecoration: 'none', color: '#fff' }}>Home</Link>
            <Link to="/about" style={{ textDecoration: 'none', color: '#fff' }}>About</Link>
            <Link to="/login" style={{ textDecoration: 'none', color: '#fff' }}>Login</Link>
          </div>
        </nav>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

### 9. Create Login Page

Create `src/routes/login.tsx`:

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import authClient from "~/lib/auth-client";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [oauthLoading, setOAuthLoading] = useState<"google" | "github" | null>(null);
  const hasNavigated = useRef(false);

  useEffect(() => {
    const handleRedirect = async () => {
      if (session && !hasNavigated.current) {
        hasNavigated.current = true;
        navigate({ to: "/", replace: true });
      }
    };
    handleRedirect();
  }, [session, navigate]);

  const handleOAuthSignIn = async (provider: "google" | "github") => {
    setOAuthLoading(provider);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: "/login/callback",
      });
    } catch (error) {
      console.error("OAuth sign-in error:", error);
      alert(`Failed to sign in with ${provider}`);
    } finally {
      setOAuthLoading(null);
    }
  };

  if (isPending || session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl border border-white/20 dark:border-slate-700/50">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent mb-2">
                Welcome
              </h1>
              <p className="text-gray-600 dark:text-slate-400 text-sm">
                Sign in to continue
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleOAuthSignIn("google")}
                disabled={oauthLoading !== null}
                className="flex w-full items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:ring-offset-2 transition-all duration-200 rounded-xl font-medium shadow-lg hover:shadow-xl"
              >
                {oauthLoading === "google" ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700 dark:border-gray-300"></div>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google
                  </>
                )}
              </button>

              <button
                onClick={() => handleOAuthSignIn("github")}
                disabled={oauthLoading !== null}
                className="flex w-full items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:ring-offset-2 transition-all duration-200 rounded-xl font-medium shadow-lg hover:shadow-xl"
              >
                {oauthLoading === "github" ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700 dark:border-gray-300"></div>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                    </svg>
                    GitHub
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 10. Create Callback Handler

Create `src/routes/login/callback.tsx`:

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import authClient from "~/lib/auth-client";

export const Route = createFileRoute("/login/callback")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const hasNavigated = useRef(false);

  useEffect(() => {
    const handleRedirect = async () => {
      if (session && !hasNavigated.current) {
        hasNavigated.current = true;
        navigate({ to: "/", replace: true });
      } else if (!isPending && !session) {
        navigate({ to: "/login", replace: true });
      }
    };
    handleRedirect();
  }, [session, isPending, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        <p className="mt-4">Completing sign in...</p>
      </div>
    </div>
  );
}
```

### 11. Query User Data

To query users in your application, use the adapter methods:

```typescript
import { query } from "./_generated/server";
import { components } from "./_generated/api";

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      paginationOpts: {
        numItems: 100,
        cursor: null,
      },
    });
    return result.page; // Returns array of users
  },
});
```

## Important Notes

### User Data Storage

- User data is stored in **component tables**, not main Convex tables
- Data won't appear in the Convex dashboard main tables view
- You can query and use the data normally in your application

### Environment Variables

Make sure all environment variables are set in:
1. **Convex Dashboard**: For server-side operations
2. **`.env.local`**: For local development (prefixed with `VITE_`)

### Common Issues

1. **500 Internal Server Error**: Check that all environment variables are set correctly
2. **Empty user table in dashboard**: This is expected - data is in component tables
3. **"users.map is not a function"**: Make sure to return `result.page` from paginated queries

## Testing

1. Visit `/login`
2. Click a provider button (Google or GitHub)
3. Complete OAuth flow
4. Check `/about` to see your user data

## Resources

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Convex Documentation](https://docs.convex.dev)
- [TanStack Start Documentation](https://tanstack.com/router)

