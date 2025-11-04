import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all tasks for the current user (owned or shared with)
export const listTasks = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userEmail = identity.email || "";
    
    // Get tasks owned by the user
    const ownedTasks = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    // Get all tasks and filter for shared ones
    const allTasks = await ctx.db.query("tasks").collect();
    const sharedTasks = allTasks.filter((task) => {
      if (task.userId === identity.subject) return false; // Already in ownedTasks
      if (!task.sharedWith) return false;
      try {
        const sharedEmails = JSON.parse(task.sharedWith);
        return Array.isArray(sharedEmails) && sharedEmails.includes(userEmail);
      } catch {
        return false;
      }
    });

    // Combine and return
    return [...ownedTasks, ...sharedTasks];
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
    sharedWith: v.optional(v.string()), // JSON string of email addresses
  },
  handler: async (ctx, args) => {
    const { text, details, priority, status, hrs, sharedWith } = args;
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
      sharedWith: sharedWith || undefined,
    });

    return taskId;
  },
});

// Update an existing task
export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    text: v.optional(v.string()),
    details: v.optional(v.string()),
    priority: v.optional(v.string()),
    status: v.optional(v.string()),
    hrs: v.optional(v.number()),
    sharedWith: v.optional(v.string()), // JSON string of email addresses
  },
  handler: async (ctx, args) => {
    const { taskId, text, details, priority, status, hrs, sharedWith } = args;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify the task belongs to the current user
    const task = await ctx.db.get(taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    if (task.userId !== identity.subject) {
      throw new Error("Not authorized to update this task");
    }

    // Build update object with only provided fields
    const update: any = {};
    if (text !== undefined) update.text = text;
    if (details !== undefined) update.details = details;
    if (priority !== undefined) update.priority = priority;
    if (status !== undefined) update.status = status;
    if (hrs !== undefined) update.hrs = hrs;
    if (sharedWith !== undefined) update.sharedWith = sharedWith || undefined;

    await ctx.db.patch(taskId, update);
    return { success: true };
  },
});

// Toggle task selection for the day
export const toggleTaskSelection = mutation({
  args: {
    taskId: v.id("tasks"),
    selected: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { taskId, selected } = args;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify the task belongs to the current user or is shared with them
    const task = await ctx.db.get(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    // Check if user owns the task
    const isOwner = task.userId === identity.subject;
    
    // Check if task is shared with user
    const userEmail = identity.email || "";
    if (!userEmail) {
      throw new Error("User email not found. Cannot select task.");
    }
    
    let isShared = false;
    if (task.sharedWith) {
      try {
        const sharedEmails = JSON.parse(task.sharedWith);
        isShared = Array.isArray(sharedEmails) && sharedEmails.includes(userEmail);
      } catch {
        // Invalid sharedWith format
      }
    }

    if (!isOwner && !isShared) {
      throw new Error(`Not authorized to select this task. Owner: ${task.userId}, Your ID: ${identity.subject}, Your Email: ${userEmail}`);
    }

    // Parse existing selections
    let selectedBy: Record<string, number> = {};
    if (task.selectedBy) {
      try {
        selectedBy = JSON.parse(task.selectedBy);
      } catch {
        // Invalid selectedBy format, start fresh
        selectedBy = {};
      }
    }

    // Update selection for this user
    if (selected) {
      // Check if selection is for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();
      
      // Only add if not already selected today
      const existingTimestamp = selectedBy[userEmail];
      if (existingTimestamp) {
        const existingDate = new Date(existingTimestamp);
        existingDate.setHours(0, 0, 0, 0);
        if (existingDate.getTime() === todayTimestamp) {
          // Already selected today, no change needed
          return { success: true };
        }
      }
      
      selectedBy[userEmail] = Date.now();
    } else {
      // Remove selection for this user
      delete selectedBy[userEmail];
    }

    // Update selection - also remove old selectedAt field if it exists
    const update: any = {};
    if (Object.keys(selectedBy).length > 0) {
      update.selectedBy = JSON.stringify(selectedBy);
    } else {
      update.selectedBy = undefined;
    }
    // Always remove old selectedAt field if it exists
    update.selectedAt = undefined;

    await ctx.db.patch(taskId, update);
    return { success: true };
  },
});

// Delete a task
export const deleteTask = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const { taskId } = args;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify the task belongs to the current user
    const task = await ctx.db.get(taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    if (task.userId !== identity.subject) {
      throw new Error("Not authorized to delete this task");
    }

    await ctx.db.delete(taskId);
    return { success: true };
  },
});

