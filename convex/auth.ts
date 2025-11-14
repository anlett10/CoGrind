import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth";

// Configuration helper for environment variables
function getEnvVar(key: string, fallback = ""): string {
  return process.env[key] || fallback;
}

// Get site URL for Better Auth baseURL
// SITE_URL is a custom variable you can set in Convex Dashboard
// CONVEX_SITE_URL is built-in and automatically set by Convex (don't try to override it)
const siteUrl = getEnvVar("SITE_URL") || getEnvVar("CONVEX_SITE_URL") || "http://localhost:3000";

// Log the site URL being used (for debugging)
console.log("Better Auth baseURL:", siteUrl, {
  hasCustomSiteUrl: !!process.env.SITE_URL,
  hasBuiltInConvexSiteUrl: !!process.env.CONVEX_SITE_URL,
});

// OAuth credentials (only used if both ID and secret are provided)
const githubCredentials = {
  id: getEnvVar("GITHUB_CLIENT_ID"),
  secret: getEnvVar("GITHUB_CLIENT_SECRET"),
};

const googleCredentials = {
  id: getEnvVar("GOOGLE_CLIENT_ID"),
  secret: getEnvVar("GOOGLE_CLIENT_SECRET"),
};

// Build social providers object from credentials
function buildSocialProviders() {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {};

  if (githubCredentials.id && githubCredentials.secret) {
    providers.github = {
      clientId: githubCredentials.id,
      clientSecret: githubCredentials.secret,
    };
    console.log('GitHub OAuth provider configured');
  } else {
    console.warn('GitHub OAuth provider not configured - missing credentials');
  }

  if (googleCredentials.id && googleCredentials.secret) {
    providers.google = {
      clientId: googleCredentials.id,
      clientSecret: googleCredentials.secret,
    };
    console.log('Google OAuth provider configured');
  } else {
    console.warn('Google OAuth provider not configured - missing credentials', {
      hasId: !!googleCredentials.id,
      hasSecret: !!googleCredentials.secret,
    });
  }

  console.log('Social providers configured:', Object.keys(providers));
  return providers;
}

// The component client integrates Convex with Better Auth
export const authComponent = createClient<DataModel>(components.betterAuth);

// Create Better Auth instance with Convex integration
export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly = false }: { optionsOnly?: boolean } = {}
) => {
  const socialProviders = buildSocialProviders();
  console.log('Creating Better Auth instance with:', {
    baseURL: siteUrl,
    socialProviders: Object.keys(socialProviders),
    hasEmailPassword: true,
  });
  
  return betterAuth({
    logger: { disabled: optionsOnly },
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders,
    plugins: [convex()],
  });
};

// Get the currently authenticated user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});

// List all users (for admin/debugging)
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      paginationOpts: { numItems: 100, cursor: null },
    });
    return result.page;
  },
});