import { query, mutation } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";

// Get user profile by userId
export const getUserProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    if (!userId) return null;
    
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [
        {
          field: "userId",
          operator: "eq",
          value: userId,
        },
      ],
    });
    
    return user ? {
      userId: user.userId || user._id,
      username: user.username || null,
      name: user.name,
      email: user.email,
      image: user.image || null,
    } : null;
  },
});

// Update username
export const updateUsername = mutation({
  args: { userId: v.string(), username: v.string() },
  handler: async (ctx, { userId, username }) => {
    if (!userId || !username) {
      throw new Error("userId and username are required");
    }

    // Validate username format (alphanumeric and underscore, 3-20 chars)
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      throw new Error("Username must be 3-20 characters, alphanumeric and underscores only");
    }

    // Check if username is already taken
    const existing = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [
        {
          field: "username",
          operator: "eq",
          value: username,
        },
        {
          connector: "AND",
          field: "userId",
          operator: "ne",
          value: userId,
        },
      ],
    });

    if (existing) {
      throw new Error("Username is already taken");
    }

    // Update the user
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      model: "user",
      where: [
        {
          field: "userId",
          operator: "eq",
          value: userId,
        },
      ],
      update: {
        username,
        displayUsername: username,
      },
    });

    return { success: true };
  },
});

