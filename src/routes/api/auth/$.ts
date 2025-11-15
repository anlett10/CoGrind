import { createFileRoute } from '@tanstack/react-router'
import { reactStartHandler } from '@convex-dev/better-auth/react-start'

// Helper to get Convex Site URL from environment variables
function getConvexSiteUrl(): string | null {
  let convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL;
  
  // If not set, derive from VITE_CONVEX_URL (converting WebSocket URL to HTTP)
  if (!convexSiteUrl && import.meta.env.VITE_CONVEX_URL) {
    convexSiteUrl = import.meta.env.VITE_CONVEX_URL.replace(/^wss?:\/\//, 'https://').replace(/\/$/, '');
  }
  
  return convexSiteUrl || null;
}

// Helper to create error response
function createErrorResponse(message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}

// Shared handler for both GET and POST
async function handleAuthRequest({ request }: { request: Request }) {
  try {
    const convexSiteUrl = getConvexSiteUrl();
    
    if (!convexSiteUrl) {
      console.error('VITE_CONVEX_SITE_URL is not set and could not be derived from VITE_CONVEX_URL');
      return createErrorResponse(
        'Server configuration error: VITE_CONVEX_SITE_URL is not set. Please set VITE_CONVEX_SITE_URL environment variable.'
      );
    }
    
    return await reactStartHandler(request, { convexSiteUrl });
  } catch (error) {
    console.error('Auth handler error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: handleAuthRequest,
      POST: handleAuthRequest,
    },
  },
})