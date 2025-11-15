// Server-side Sentry initialization
// This file should only be imported/executed on the server side

export function initServerSentry() {
  // Only initialize on server (Cloudflare Workers or Node.js)
  if (typeof window === 'undefined') {
    const sentryDsn = process.env.SENTRY_DSN || (globalThis as any).SENTRY_DSN;
    
    if (sentryDsn) {
      import('@sentry/tanstackstart-react').then((Sentry) => {
        Sentry.init({
          dsn: sentryDsn,
          // Adds request headers and IP for users
          sendDefaultPii: true,
          // Set tracesSampleRate to 1.0 to capture 100%
          // of transactions for tracing.
          // We recommend adjusting this value in production
          tracesSampleRate: 1.0,
        });
      }).catch(() => {
        // Silently fail if Sentry can't be imported
      });
    }
  }
}

// Auto-initialize when this module is imported on the server
initServerSentry();

