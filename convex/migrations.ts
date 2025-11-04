import { mutation } from "./_generated/server";

// Migration to remove old selectedAt field from all tasks
// Run this once to clean up existing data
export const migrateRemoveSelectedAt = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get all tasks
    const tasks = await ctx.db.query("tasks").collect();
    
    let migrated = 0;
    for (const task of tasks) {
      // Check if task has old selectedAt field (using type assertion to access)
      const taskAny = task as any;
      if (taskAny.selectedAt !== undefined) {
        // Remove the old selectedAt field
        await ctx.db.patch(task._id, { selectedAt: undefined });
        migrated++;
      }
    }
    
    return { migrated, message: `Removed selectedAt from ${migrated} tasks` };
  },
});

