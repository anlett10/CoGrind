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
    sharedWith: v.optional(v.string()), // JSON string of email addresses
    selectedBy: v.optional(v.string()), // JSON string: {"email@example.com": timestamp, ...}
    selectedAt: v.optional(v.number()), // DEPRECATED: Old field, will be removed after migration
  }).index('by_user', ['userId']),
})