import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

// Get base URL dynamically for both client and server-side rendering
function getBaseURL(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.SITE_URL || process.env.CONVEX_SITE_URL || "http://localhost:3000";
}

// Create the auth client with Convex integration
export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [convexClient()],
});

// Export as default for convenience
export default authClient;