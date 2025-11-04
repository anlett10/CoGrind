import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all tasks for the current user
export const listTasks = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    return tasks;
  },
});

// Create a new task
export const createTask = mutation({
  args: {
    text: v.string(),
    details: v.string(),
    priority: v.string(),
    status: v.string(),
    hrs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { text, details, priority, status, hrs } = args;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const taskId = await ctx.db.insert("tasks", {
      userId: identity.subject,
      text,
      details,
      priority,
      status,
      hrs: hrs ?? 1, // Default value
    });

    return taskId;
  },
});

