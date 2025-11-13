import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { components } from "./_generated/api";

// Get refinements for a task
export const getTaskRefinements = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify user has access (either owner or collaborator)
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const isOwner = task.userId === identity.subject;
    const sharedEmails = task.sharedWith ? JSON.parse(task.sharedWith) : [];
    const userEmail = identity.email || identity.name || "";

    if (!isOwner && !sharedEmails.includes(userEmail)) {
      throw new Error("Not authorized to view refinements");
    }

    // Get all refinements for this task, ordered by creation time
    const refinements = await ctx.db
      .query("taskRefinements")
      .withIndex("by_task_created", (q) => q.eq("taskId", args.taskId))
      .collect();

    return refinements.sort((a, b) => a.createdAt - b.createdAt);
  },
});

// Add a refinement (note or question)
export const addTaskRefinement = mutation({
  args: {
    taskId: v.id("tasks"),
    type: v.union(v.literal("note"), v.literal("question")),
    content: v.string(),
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

    const isOwner = task.userId === identity.subject;
    const sharedEmails = task.sharedWith ? JSON.parse(task.sharedWith) : [];
    const userEmail = identity.email || identity.name || "";
    const isCollaborator = sharedEmails.includes(userEmail);

    if (!isOwner && !isCollaborator) {
      throw new Error("Not authorized to add refinements");
    }

    // Get user display name if available
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [
        {
          field: "userId",
          operator: "eq",
          value: identity.subject,
        },
      ],
    });

    const refinementId = await ctx.db.insert("taskRefinements", {
      taskId: args.taskId,
      authorId: identity.subject,
      authorEmail: userEmail,
      authorName: user?.name || user?.displayUsername || undefined,
      role: isOwner ? "owner" : "collaborator",
      type: args.type,
      content: args.content,
      createdAt: Date.now(),
    });

    return { success: true, refinementId };
  },
});

// Answer a question (owner only)
export const answerQuestion = mutation({
  args: {
    questionId: v.id("taskRefinements"),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new Error("Question not found");
    }

    if (question.type !== "question") {
      throw new Error("Can only answer questions");
    }

    const task = await ctx.db.get(question.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    // Only task owner can answer questions
    if (task.userId !== identity.subject) {
      throw new Error("Only task owner can answer questions");
    }

    const userEmail = identity.email || identity.name || "";
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [
        {
          field: "userId",
          operator: "eq",
          value: identity.subject,
        },
      ],
    });

    await ctx.db.insert("taskRefinements", {
      taskId: question.taskId,
      authorId: identity.subject,
      authorEmail: userEmail,
      authorName: user?.name || user?.displayUsername || undefined,
      role: "owner",
      type: "answer",
      content: args.answer,
      parentId: args.questionId, // Link to the question
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// Update task from refinement (owner only)
export const updateTaskFromRefinement = mutation({
  args: {
    taskId: v.id("tasks"),
    updates: v.object({
      text: v.optional(v.string()),
      details: v.optional(v.string()),
      status: v.optional(v.string()),
      priority: v.optional(v.string()),
      hrs: v.optional(v.number()),
    }),
    note: v.optional(v.string()), // Optional note explaining the update
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

    // Only owner can update task
    if (task.userId !== identity.subject) {
      throw new Error("Only task owner can update the task");
    }

    // Update the task
    const updateData: any = {
      updatedAt: Date.now(),
    };

    if (args.updates.text !== undefined) updateData.text = args.updates.text;
    if (args.updates.details !== undefined) updateData.details = args.updates.details;
    if (args.updates.status !== undefined) updateData.status = args.updates.status;
    if (args.updates.priority !== undefined) updateData.priority = args.updates.priority;
    if (args.updates.hrs !== undefined) updateData.hrs = args.updates.hrs;

    await ctx.db.patch(args.taskId, updateData);

    // Optionally add a note about the update
    if (args.note) {
      const userEmail = identity.email || identity.name || "";
      const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [
          {
            field: "userId",
            operator: "eq",
            value: identity.subject,
          },
        ],
      });

      await ctx.db.insert("taskRefinements", {
        taskId: args.taskId,
        authorId: identity.subject,
        authorEmail: userEmail,
        authorName: user?.name || user?.displayUsername || undefined,
        role: "owner",
        type: "update",
        content: args.note,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

