import { query } from "./_generated/server";

// Simple health check query
export const healthCheck = query({
  args: {},
  handler: async () => {
    // Return true if the query can execute (Convex is connected)
    return true;
  },
});

