# Refinement Feature - Convex Feasibility Review

## ✅ **YES, This is Fully Possible with Convex!**

Convex is perfectly suited for this feature. Here's why:

### 1. **Real-time Updates** ✅
- Convex automatically provides real-time subscriptions via `useConvexQuery`
- When any user adds/updates a refinement, all connected clients receive updates instantly
- No WebSocket management needed - Convex handles it automatically
- Works seamlessly with React Query integration already in place

### 2. **Shared & Collaborative** ✅
- Convex queries can filter by `taskId` to show refinements for specific tasks
- Multiple users can read/write simultaneously
- Convex handles concurrency and conflict resolution automatically

### 3. **User Authentication** ✅
- Already using `ctx.auth.getUserIdentity()` in existing mutations
- Can identify owner vs collaborator based on `task.userId`
- Can tag users with their email/name from session

## Implementation Plan

### **Step 1: Database Schema** (convex/schema.ts)

Add a new table for task refinements:

```typescript
taskRefinements: defineTable({
  taskId: v.id("tasks"),
  authorId: v.string(), // userId of the person who created this refinement
  authorEmail: v.string(), // email for display
  authorName: v.optional(v.string()), // display name if available
  role: v.string(), // "owner" | "collaborator"
  type: v.string(), // "note" | "question" | "answer" | "update"
  content: v.string(), // the actual note/question/answer text
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
  parentId: v.optional(v.id("taskRefinements")), // for threading questions/answers
})
  .index('by_task', ['taskId'])
  .index('by_task_created', ['taskId', 'createdAt'])
  .index('by_author', ['authorId'])
```

### **Step 2: Backend Functions** (convex/tasks.ts or new convex/refinements.ts)

#### Query: Get refinements for a task
```typescript
export const getTaskRefinements = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    
    // Verify user has access (either owner or collaborator)
    const task = await ctx.db.get(args.taskId)
    if (!task) throw new Error("Task not found")
    
    const isOwner = task.userId === identity.subject
    const sharedEmails = task.sharedWith ? JSON.parse(task.sharedWith) : []
    const userEmail = identity.email || identity.name || ""
    const isCollaborator = sharedEmails.includes(userEmail)
    
    if (!isOwner && !isCollaborator) {
      throw new Error("Not authorized to view refinements")
    }
    
    return await ctx.db
      .query("taskRefinements")
      .withIndex("by_task_created", (q) => q.eq("taskId", args.taskId))
      .collect()
  },
})
```

#### Mutation: Add refinement (note/question)
```typescript
export const addTaskRefinement = mutation({
  args: {
    taskId: v.id("tasks"),
    type: v.union(v.literal("note"), v.literal("question")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    
    const task = await ctx.db.get(args.taskId)
    if (!task) throw new Error("Task not found")
    
    const isOwner = task.userId === identity.subject
    const sharedEmails = task.sharedWith ? JSON.parse(task.sharedWith) : []
    const userEmail = identity.email || identity.name || ""
    const isCollaborator = sharedEmails.includes(userEmail)
    
    if (!isOwner && !isCollaborator) {
      throw new Error("Not authorized to add refinements")
    }
    
    // Get user display name if available
    const user = await ctx.db
      .query("user")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first()
    
    const refinementId = await ctx.db.insert("taskRefinements", {
      taskId: args.taskId,
      authorId: identity.subject,
      authorEmail: userEmail,
      authorName: user?.name || user?.displayUsername || undefined,
      role: isOwner ? "owner" : "collaborator",
      type: args.type,
      content: args.content,
      createdAt: Date.now(),
    })
    
    return { success: true, refinementId }
  },
})
```

#### Mutation: Answer question (owner only)
```typescript
export const answerQuestion = mutation({
  args: {
    questionId: v.id("taskRefinements"),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    
    const question = await ctx.db.get(args.questionId)
    if (!question) throw new Error("Question not found")
    
    const task = await ctx.db.get(question.taskId)
    if (!task) throw new Error("Task not found")
    
    // Only task owner can answer questions
    if (task.userId !== identity.subject) {
      throw new Error("Only task owner can answer questions")
    }
    
    const userEmail = identity.email || identity.name || ""
    const user = await ctx.db
      .query("user")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first()
    
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
    })
    
    return { success: true }
  },
})
```

#### Mutation: Update task (owner only)
```typescript
export const updateTaskFromRefinement = mutation({
  args: {
    taskId: v.id("tasks"),
    updates: v.object({
      text: v.optional(v.string()),
      details: v.optional(v.string()),
      status: v.optional(v.string()),
      priority: v.optional(v.string()),
      // ... other task fields
    }),
    note: v.optional(v.string()), // Optional note explaining the update
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    
    const task = await ctx.db.get(args.taskId)
    if (!task) throw new Error("Task not found")
    
    // Only owner can update task
    if (task.userId !== identity.subject) {
      throw new Error("Only task owner can update the task")
    }
    
    // Update the task
    await ctx.db.patch(args.taskId, {
      ...args.updates,
      updatedAt: Date.now(),
    })
    
    // Optionally add a note about the update
    if (args.note) {
      const userEmail = identity.email || identity.name || ""
      const user = await ctx.db
        .query("user")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .first()
      
      await ctx.db.insert("taskRefinements", {
        taskId: args.taskId,
        authorId: identity.subject,
        authorEmail: userEmail,
        authorName: user?.name || user?.displayUsername || undefined,
        role: "owner",
        type: "update",
        content: args.note,
        createdAt: Date.now(),
      })
    }
    
    return { success: true }
  },
})
```

### **Step 3: Frontend Component** (src/components/app/task-refinement-section.tsx)

Create a new component that:
- Uses `useConvexQuery(api.refinements.getTaskRefinements, { taskId })` for real-time updates
- Shows a list of refinements (notes/questions/answers)
- Has input fields for:
  - Collaborators: Add note/question
  - Owners: Add note/question/answer/update task
- Displays author tag at the end of each refinement
- Groups questions with their answers (using `parentId`)

### **Step 4: Integration**

Add the refinement section to:
- `TaskCard` component (expandable section)
- Or as a separate component next to each task in the Review page

## Key Benefits

1. **Real-time**: Updates appear instantly for all users viewing the task
2. **Secure**: Authorization checks ensure only authorized users can read/write
3. **Scalable**: Convex handles all the backend infrastructure
4. **Type-safe**: Full TypeScript support with generated types
5. **Simple**: No complex WebSocket management or polling needed

## Next Steps

1. ✅ Add schema for `taskRefinements` table
2. ✅ Create backend queries/mutations
3. ✅ Build frontend refinement component
4. ✅ Integrate into Review page TaskCard
5. ✅ Add UI for different user roles (owner vs collaborator)

## Estimated Complexity

- **Backend**: Medium (similar to existing task sharing logic)
- **Frontend**: Medium (new component, but straightforward)
- **Real-time**: Easy (automatic with Convex)

---

**Conclusion**: This feature is not only possible but will be straightforward to implement with Convex's real-time capabilities and existing authentication system.

