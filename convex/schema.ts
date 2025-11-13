import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// The Better Auth component automatically provides its own schema via convex.config.ts
export default defineSchema({
  tasks: defineTable({
    userId: v.string(),
    text: v.string(),
    details: v.string(),
    priority: v.optional(v.string()),
    status: v.optional(v.string()),
    hrs: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    trackedTimeMs: v.optional(v.number()),
    sharedWith: v.optional(v.string()), // JSON string of email addresses
    selectedBy: v.optional(v.string()), // JSON string: {"email@example.com": timestamp, ...}
    selectedAt: v.optional(v.number()), // DEPRECATED: Old field, will be removed after migration
    updatedAt: v.optional(v.number()), // Timestamp when task was last updated
    refLink: v.optional(v.string()), // Reference link URL
    projectId: v.optional(v.id("projects")), // Reference to project
    analysisData: v.optional(v.string()), // JSON blob when generated from image analysis
  }).index('by_user', ['userId']).index('by_project', ['projectId']),
  projects: defineTable({
    id: v.string(), // Custom project ID (can be used as a human-readable identifier)
    name: v.string(),
    description: v.string(), // Default: "" (set in mutation)
    type: v.string(), // 'saas', 'mobile', 'web', 'desktop', 'open-source', 'library', 'tool', 'blog', 'course', 'other'
    category: v.string(), // 'commercial', 'open-source', 'personal', 'learning'
    status: v.string(), // 'planning', 'development', 'alpha', 'beta', 'official-release' (default: "planning")
    websiteUrl: v.optional(v.string()), // Legacy field, retained for migration cleanup
    githubUrl: v.optional(v.string()),
    githubStars: v.optional(v.number()),
    githubForks: v.optional(v.number()),
    npmDownloads: v.optional(v.number()),
    githubRepo: v.optional(v.string()),
    npmPackage: v.optional(v.string()),
    userId: v.string(),
    createdAt: v.optional(v.number()), // Timestamp in milliseconds
    updatedAt: v.optional(v.number()), // Timestamp in milliseconds
  }).index('by_user', ['userId']),
  projectCollaborators: defineTable({
    projectId: v.id("projects"),
    userId: v.optional(v.string()),
    email: v.string(),
    role: v.string(),
    addedBy: v.string(),
    addedAt: v.number(),
    userName: v.optional(v.string()),
  })
    .index('by_project', ['projectId'])
    .index('by_project_user', ['projectId', 'userId'])
    .index('by_project_email', ['projectId', 'email'])
    .index('by_user', ['userId']),
  projectInvitations: defineTable({
    projectId: v.id("projects"),
    email: v.string(),
    role: v.string(),
    token: v.string(),
    status: v.string(), // pending | accepted | declined | expired
    invitedBy: v.string(),
    invitedByName: v.optional(v.string()),
    invitedAt: v.number(),
    respondedAt: v.optional(v.number()),
    expiresAt: v.number(),
    userId: v.optional(v.string()),
  })
    .index('by_token', ['token'])
    .index('by_email', ['email'])
    .index('by_project', ['projectId'])
    .index('by_project_email', ['projectId', 'email']),
})