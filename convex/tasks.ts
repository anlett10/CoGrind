import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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

    const combinedTasks = [...ownedTasks, ...sharedTasks];

    const uniqueProjectIds = Array.from(
      new Set(
        combinedTasks
          .map((task) => task.projectId)
          .filter((id): id is Id<"projects"> => Boolean(id))
      )
    );

    const projectDocs = await Promise.all(
      uniqueProjectIds.map((projectId) => ctx.db.get(projectId))
    );

    const projectMap = new Map<Id<"projects">, typeof projectDocs[number]>();
    projectDocs.forEach((project, index) => {
      if (project) {
        projectMap.set(uniqueProjectIds[index], project);
      }
    });

    return combinedTasks.map((task) => ({
      ...task,
      project: task.projectId ? projectMap.get(task.projectId) ?? null : null,
    }));
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
    refLink: v.optional(v.string()), // Reference link URL
    projectId: v.optional(v.id("projects")), // Reference to project
    trackedTimeMs: v.optional(v.number()),
    analysisData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { text, details, priority, status, hrs, sharedWith, refLink, projectId, analysisData } = args;
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
      refLink: refLink || "",
      projectId: projectId || undefined,
      trackedTimeMs: 0,
      analysisData: analysisData || undefined,
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
    refLink: v.optional(v.string()), // Reference link URL
    projectId: v.optional(v.id("projects")), // Reference to project
    trackedTimeMs: v.optional(v.number()),
    analysisData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const {
      taskId,
      text,
      details,
      priority,
      status,
      hrs,
      sharedWith,
      refLink,
      projectId,
      trackedTimeMs,
      analysisData,
    } = args;
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
    if (refLink !== undefined) update.refLink = refLink || "";
    if (projectId !== undefined) update.projectId = projectId || undefined;
    if (trackedTimeMs !== undefined) update.trackedTimeMs = trackedTimeMs;
    if (analysisData !== undefined) update.analysisData = analysisData || undefined;
    
    // Always update the updatedAt timestamp when task is modified
    update.updatedAt = Date.now();

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

export const startTask = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const userEmail = identity.email || "";
    const isOwner = task.userId === identity.subject;

    let selectedBy: Record<string, number> = {};
    if (task.selectedBy) {
      try {
        selectedBy = JSON.parse(task.selectedBy);
      } catch {
        selectedBy = {};
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const isSelectedByCurrentUserToday = (() => {
      const timestamp = selectedBy[userEmail];
      if (!timestamp) return false;
      const selectedDate = new Date(timestamp);
      selectedDate.setHours(0, 0, 0, 0);
      return selectedDate.getTime() === todayTimestamp;
    })();

    if (!isOwner && !isSelectedByCurrentUserToday) {
      throw new Error("You must select this task before starting it.");
    }

    if (task.startedAt && task.status === "in-progress") {
      throw new Error("Task is already in progress.");
    }

    const now = Date.now();

    await ctx.db.patch(args.taskId, {
      startedAt: now,
      status: "in-progress",
      updatedAt: now,
    });

    return { success: true, startedAt: now };
  },
});

export const stopTask = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const userEmail = identity.email || "";
    const isOwner = task.userId === identity.subject;

    let selectedBy: Record<string, number> = {};
    if (task.selectedBy) {
      try {
        selectedBy = JSON.parse(task.selectedBy);
      } catch {
        selectedBy = {};
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const isSelectedByCurrentUserToday = (() => {
      const timestamp = selectedBy[userEmail];
      if (!timestamp) return false;
      const selectedDate = new Date(timestamp);
      selectedDate.setHours(0, 0, 0, 0);
      return selectedDate.getTime() === todayTimestamp;
    })();

    if (!isOwner && !isSelectedByCurrentUserToday) {
      throw new Error("You must select this task before stopping it.");
    }

    const now = Date.now();
    let trackedTime = task.trackedTimeMs ?? 0;

    if (task.startedAt) {
      trackedTime += Math.max(0, now - task.startedAt);
    }

    await ctx.db.patch(args.taskId, {
      startedAt: undefined,
      status: "todo",
      trackedTimeMs: trackedTime,
      updatedAt: now,
    });

    return { success: true, trackedTimeMs: trackedTime };
  },
});

export const completeTask = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const userEmail = identity.email || "";
    const isOwner = task.userId === identity.subject;

    let selectedBy: Record<string, number> = {};
    if (task.selectedBy) {
      try {
        selectedBy = JSON.parse(task.selectedBy);
      } catch {
        selectedBy = {};
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const isSelectedByCurrentUserToday = (() => {
      const timestamp = selectedBy[userEmail];
      if (!timestamp) return false;
      const selectedDate = new Date(timestamp);
      selectedDate.setHours(0, 0, 0, 0);
      return selectedDate.getTime() === todayTimestamp;
    })();

    if (!isOwner && !isSelectedByCurrentUserToday) {
      throw new Error("You must select this task before completing it.");
    }

    const now = Date.now();
    let trackedTime = task.trackedTimeMs ?? 0;

    if (task.startedAt) {
      trackedTime += Math.max(0, now - task.startedAt);
    }

    await ctx.db.patch(args.taskId, {
      startedAt: undefined,
      status: "done",
      trackedTimeMs: trackedTime,
      completedAt: now,
      updatedAt: now,
    });

    return { success: true, trackedTimeMs: trackedTime, completedAt: now };
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

export const unshareTask = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const task = await ctx.db.get(args.taskId)
    if (!task) {
      throw new Error("Task not found")
    }

    if (task.userId !== identity.subject) {
      throw new Error("Only the task owner can unshare this task")
    }

    await ctx.db.patch(args.taskId, {
      sharedWith: undefined,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

export const shareTaskWithCollaborators = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const task = await ctx.db.get(args.taskId)
    if (!task) {
      throw new Error("Task not found")
    }

    if (task.userId !== identity.subject) {
      throw new Error("Only the task owner can manage sharing")
    }

    if (!task.projectId) {
      throw new Error("Link this task to a project before sharing")
    }

    const collaborators = await ctx.db
      .query("projectCollaborators")
      .withIndex("by_project", (q) => q.eq("projectId", task.projectId as Id<"projects">))
      .collect()

    const collaboratorEmails = collaborators
      .map((record) => record.email.trim())
      .filter((email) => email && email !== identity.email)

    const emailSet = new Set<string>()
    if (task.sharedWith) {
      try {
        const existing = JSON.parse(task.sharedWith)
        if (Array.isArray(existing)) {
          existing.forEach((email) => {
            if (typeof email === "string" && email.trim()) {
              emailSet.add(email.trim())
            }
          })
        }
      } catch {
        // ignore invalid stored data
      }
    }

    if (collaboratorEmails.length === 0) {
      return {
        success: false,
        added: 0,
        total: emailSet.size,
        message: "No project collaborators available yet",
      }
    }

    let added = 0
    for (const email of collaboratorEmails) {
      if (!emailSet.has(email)) {
        emailSet.add(email)
        added += 1
      }
    }

    await ctx.db.patch(args.taskId, {
      sharedWith: emailSet.size > 0 ? JSON.stringify(Array.from(emailSet)) : undefined,
      updatedAt: Date.now(),
    })

    return {
      success: true,
      added,
      total: emailSet.size,
      message:
        added > 0
          ? `Shared with ${added} collaborator${added === 1 ? "" : "s"}`
          : "Task was already shared with all collaborators",
    }
  },
})

