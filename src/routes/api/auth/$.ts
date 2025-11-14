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
    const url = new URL(request.url);
    
    // Log for debugging (remove in production if needed)
    console.log('Auth request:', {
      path: url.pathname,
      method: request.method,
      convexSiteUrl: convexSiteUrl ? 'set' : 'missing',
      origin: request.headers.get('origin'),
    });
    
    if (!convexSiteUrl) {
      console.error('VITE_CONVEX_SITE_URL is not set and could not be derived from VITE_CONVEX_URL');
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error: VITE_CONVEX_SITE_URL is not set. Please set VITE_CONVEX_SITE_URL environment variable.',
          details: {
            hasViteConvexSiteUrl: !!import.meta.env.VITE_CONVEX_SITE_URL,
            hasViteConvexUrl: !!import.meta.env.VITE_CONVEX_URL,
          }
        }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      );
    }
    
    const response = await reactStartHandler(request, { convexSiteUrl });
    
    // Log response details for debugging
    if (response.status >= 400) {
      const responseClone = response.clone();
      const responseText = await responseClone.text();
      console.error('Auth handler error response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText.substring(0, 500), // First 500 chars
      });
    }
    
    // Ensure CORS headers are present
    const headers = new Headers(response.headers);
    if (!headers.has('Access-Control-Allow-Origin')) {
      headers.set('Access-Control-Allow-Origin', '*');
    }
    if (!headers.has('Access-Control-Allow-Methods')) {
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (!headers.has('Access-Control-Allow-Headers')) {
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error('Auth handler error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error',
        type: error instanceof Error ? error.constructor.name : 'Unknown',
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
  }
}

// Handle OPTIONS for CORS preflight
async function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: handleAuthRequest,
      POST: handleAuthRequest,
      OPTIONS: handleOptions,
    },
  },
})