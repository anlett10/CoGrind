import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const INVITATION_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const APP_BASE_URL =
  process.env.SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  process.env.CONVEX_SITE_URL ||
  "http://localhost:3000";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateToken(): string {
  const cryptoGlobal = globalThis.crypto as
    | { randomUUID?: () => string; getRandomValues?: (array: Uint8Array) => Uint8Array }
    | undefined;

  if (cryptoGlobal?.randomUUID) {
    return cryptoGlobal.randomUUID();
  }

  if (cryptoGlobal?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoGlobal.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function sendInvitationEmail({
  to,
  inviterName,
  projectName,
  role,
  token,
}: {
  to: string;
  inviterName: string;
  projectName: string;
  role: string;
  token: string;
}) {
  if (!process.env.PLUNK_API_KEY) {
    console.warn("PLUNK_API_KEY is not set. Skipping invitation email.");
    return;
  }

  const acceptLink = `${APP_BASE_URL}/email/invitation-response?token=${encodeURIComponent(
    token
  )}&action=accept`;
  const declineLink = `${APP_BASE_URL}/email/invitation-response?token=${encodeURIComponent(
    token
  )}&action=decline`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #111827;">You've been invited to collaborate on <em>${projectName}</em></h2>
      <p style="color: #4b5563;">${inviterName} invited you to join the project as <strong>${role}</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${acceptLink}" style="background: #111827; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Accept invitation</a>
        <a href="${declineLink}" style="margin-left: 12px; padding: 12px 24px; border-radius: 6px; border: 1px solid #d1d5db; color: #374151; text-decoration: none;">Decline</a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">If the buttons don't work, copy and paste these links into your browser:</p>
      <p style="color: #6b7280; font-size: 12px;">Accept: <a href="${acceptLink}">${acceptLink}</a></p>
      <p style="color: #6b7280; font-size: 12px;">Decline: <a href="${declineLink}">${declineLink}</a></p>
    </div>
  `;

  await fetch("https://api.useplunk.com/v1/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PLUNK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      subject: `🤝 Invitation to collaborate on "${projectName}"`,
      body: html,
    }),
  });
}

function extractGitHubRepoFromUrl(url?: string | null) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("github.com")) {
      return undefined;
    }
    const segments = parsed.pathname.replace(/^\/+/, "").split("/");
    if (segments.length < 2) {
      return undefined;
    }
    const owner = segments[0]!.trim();
    let repo = segments[1]!.trim();
    if (repo.endsWith(".git")) {
      repo = repo.slice(0, -4);
    }
    if (!owner || !repo) {
      return undefined;
    }
    return `${owner}/${repo}`;
  } catch {
    return undefined;
  }
}

// List all projects for the current user
export const listProjects = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const results = new Map<string, any>();

    const ownedProjects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    for (const project of ownedProjects) {
      results.set(project._id, { ...project, userRole: "owner" });
    }

    const collaboratorRecords = await ctx.db
      .query("projectCollaborators")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    for (const collaborator of collaboratorRecords) {
      const project = await ctx.db.get(collaborator.projectId);
      if (!project) continue;

      if (!results.has(project._id)) {
        results.set(project._id, { ...project, userRole: collaborator.role });
      }
    }

    return Array.from(results.values());
  },
});

// Get a single project by ID
export const getProject = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Verify the user owns this project or is a collaborator
    if (project.userId !== identity.subject) {
      const membership = await ctx.db
        .query("projectCollaborators")
        .withIndex("by_project_user", (q) =>
          q.eq("projectId", args.projectId).eq("userId", identity.subject)
        )
        .collect();

      if (membership.length === 0) {
        throw new Error("Not authorized");
      }
    }

    return project;
  },
});

// Create a new project
export const createProject = mutation({
  args: {
    id: v.string(), // Custom project ID (human-readable)
    name: v.string(),
    description: v.optional(v.string()),
    type: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(v.string()), // 'planning', 'development', 'alpha', 'beta', 'official-release'
    githubUrl: v.optional(v.string()),
    githubStars: v.optional(v.number()),
    githubForks: v.optional(v.number()),
    npmDownloads: v.optional(v.number()),
    githubRepo: v.optional(v.string()),
    npmPackage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    const derivedGithubRepo = args.githubRepo || extractGitHubRepoFromUrl(args.githubUrl);

    const projectId = await ctx.db.insert("projects", {
      id: args.id,
      name: args.name,
      description: args.description || "",
      type: args.type || "saas",
      category: args.category || "commercial",
      status: args.status || "planning",
      websiteUrl: undefined,
      githubUrl: args.githubUrl || undefined,
      githubStars: args.githubStars ?? 0,
      githubForks: args.githubForks ?? 0,
      npmDownloads: args.npmDownloads ?? 0,
      githubRepo: derivedGithubRepo,
      npmPackage: args.npmPackage,
      userId: identity.subject,
      createdAt: now,
      updatedAt: now,
    });

    return projectId;
  },
});

// Update an existing project
export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    githubStars: v.optional(v.number()),
    githubForks: v.optional(v.number()),
    npmDownloads: v.optional(v.number()),
    githubRepo: v.optional(v.string()),
    npmPackage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Verify the user owns this project
    if (project.userId !== identity.subject) {
      throw new Error("Not authorized to update this project");
    }

    // Build update object with only provided fields
    const update: any = {};
    if (args.name !== undefined) update.name = args.name;
    if (args.description !== undefined) update.description = args.description;
    if (args.type !== undefined) update.type = args.type;
    if (args.category !== undefined) update.category = args.category;
    if (args.status !== undefined) update.status = args.status;
    if (args.githubUrl !== undefined) {
      update.githubUrl = args.githubUrl || undefined;
      const derivedGithubRepo = extractGitHubRepoFromUrl(args.githubUrl);
      if (derivedGithubRepo !== undefined) {
        update.githubRepo = derivedGithubRepo;
      }
    }
    // Always clear legacy websiteUrl field
    update.websiteUrl = undefined;
    if (args.githubStars !== undefined) update.githubStars = args.githubStars;
    if (args.githubForks !== undefined) update.githubForks = args.githubForks;
    if (args.npmDownloads !== undefined) update.npmDownloads = args.npmDownloads;
    if (args.githubRepo !== undefined) update.githubRepo = args.githubRepo || undefined;
    if (args.npmPackage !== undefined) update.npmPackage = args.npmPackage || undefined;
    
    // Always update the updatedAt timestamp
    update.updatedAt = Date.now();

    await ctx.db.patch(args.projectId, update);
    return { success: true };
  },
});

export const syncGitHubMetrics = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args): Promise<{
    success: true;
    githubStars: number;
    githubForks: number;
    npmDownloads: number;
    githubRepo: string;
    npmPackage?: string;
  }> => {
    'use node';

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = (await ctx.runQuery((api.projects as any).getProject, {
      projectId: args.projectId,
    })) as {
      userId: string;
      githubRepo?: string;
      githubUrl?: string;
      websiteUrl?: string;
      npmDownloads?: number;
      npmPackage?: string;
      name: string;
    };

    const githubRepo =
      project.githubRepo ||
      extractGitHubRepoFromUrl(project.githubUrl) ||
      extractGitHubRepoFromUrl(project.websiteUrl);
    if (!githubRepo) {
      throw new Error("GitHub repository URL is not set for this project");
    }

    const headers: Record<string, string> = {
      "User-Agent": "start-bare-app",
      Accept: "application/vnd.github+json",
    };
    const githubToken = process.env.GITHUB_TOKEN;
    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    const repoResponse = await fetch(`https://api.github.com/repos/${githubRepo}`, {
      headers,
    });

    if (!repoResponse.ok) {
      throw new Error(`Failed to fetch GitHub repo: ${repoResponse.status} ${repoResponse.statusText}`);
    }

    const repoData: {
      stargazers_count?: number;
      forks_count?: number;
      name?: string;
    } = await repoResponse.json();
    const githubStars = typeof repoData.stargazers_count === "number" ? repoData.stargazers_count : 0;
    const githubForks = typeof repoData.forks_count === "number" ? repoData.forks_count : 0;

    let npmDownloads: number = project.npmDownloads ?? 0;
    let npmPackage = project.npmPackage;

    if (!npmPackage && repoData?.name) {
      npmPackage = repoData.name;
    }

    if (npmPackage) {
      const npmEndpoint = `https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(npmPackage)}`;
      const npmResponse = await fetch(npmEndpoint);
      if (npmResponse.ok) {
        const npmData: { downloads?: number } = await npmResponse.json();
        if (typeof npmData.downloads === "number") {
          npmDownloads = npmData.downloads;
        }
      }
    }

    const updateArgs = {
      projectId: args.projectId,
      githubStars,
      githubForks,
      npmDownloads,
      githubRepo,
      npmPackage,
    };

    await ctx.runMutation((api.projects as any).updateProject, updateArgs);

    return {
      success: true,
      githubStars,
      githubForks,
      npmDownloads,
      githubRepo,
      npmPackage,
    };
  },
});

// Delete a project
export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Verify the user owns this project
    if (project.userId !== identity.subject) {
      throw new Error("Not authorized to delete this project");
    }

    await ctx.db.delete(args.projectId);
    return { success: true };
  },
});

export const inviteProjectCollaboratorMutation = mutation({
  args: {
    projectId: v.id("projects"),
    email: v.string(),
    role: v.optional(v.literal("collaborator")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) {
      throw new Error("You must be signed in with an email address to send invitations.");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }
    if (project.userId !== identity.subject) {
      throw new Error("Only project owners can send invitations.");
    }

    const email = normalizeEmail(args.email);
    const role = args.role ?? "collaborator";
    const inviterName = identity.name || identity.email || "A teammate";
    const now = Date.now();
    const expiresAt = now + INVITATION_EXPIRATION_MS;
    const token = generateToken();

    // Ensure the email isn't already part of the project
    const existingCollaborator = await ctx.db
      .query("projectCollaborators")
      .withIndex("by_project_email", (q) => q.eq("projectId", args.projectId).eq("email", email))
      .collect();

    if (existingCollaborator.length > 0) {
      throw new Error("This email already has access to the project.");
    }

    const existingInvitation = await ctx.db
      .query("projectInvitations")
      .withIndex("by_project_email", (q) => q.eq("projectId", args.projectId).eq("email", email))
      .collect();

    if (existingInvitation.length > 0) {
      await ctx.db.patch(existingInvitation[0]._id, {
        token,
        role,
        status: "pending",
        invitedBy: identity.subject,
        invitedByName: inviterName,
        invitedAt: now,
        expiresAt,
        respondedAt: undefined,
        userId: undefined,
      });
    } else {
      await ctx.db.insert("projectInvitations", {
        projectId: args.projectId,
        email,
        role,
        token,
        status: "pending",
        invitedBy: identity.subject,
        invitedByName: inviterName,
        invitedAt: now,
        expiresAt,
      });
    }

    return {
      success: true,
      message: `Invitation sent to ${email}`,
      invitation: {
        to: email,
        inviterName,
        projectName: project.name,
        role,
        token,
      },
    };
  },
});

export const inviteProjectCollaborator = action({
  args: {
    projectId: v.id("projects"),
    email: v.string(),
    role: v.optional(v.literal("collaborator")),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    message: string;
    invitation?: {
      to: string;
      inviterName: string;
      projectName: string;
      role: string;
      token: string;
    };
  }> => {
    const result = (await ctx.runMutation(
      (api.projects as any).inviteProjectCollaboratorMutation,
      args,
    )) as {
      success: boolean;
      message: string;
      invitation?: {
        to: string;
        inviterName: string;
        projectName: string;
        role: string;
        token: string;
      };
    };
    if (result.invitation) {
      await sendInvitationEmail(result.invitation);
    }
    return result;
  },
});

export const listProjectInvitations = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }
    if (project.userId !== identity.subject) {
      throw new Error("Not authorized");
    }

    const invitations = await ctx.db
      .query("projectInvitations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return invitations;
  },
});

export const getProjectCollaborators = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const isOwner = project.userId === identity.subject;
    if (!isOwner) {
      const membership = await ctx.db
        .query("projectCollaborators")
        .withIndex("by_project_user", (q) =>
          q.eq("projectId", args.projectId).eq("userId", identity.subject)
        )
        .collect();

      if (membership.length === 0) {
        throw new Error("Not authorized to view collaborators");
      }
    }

    const collaborators = await ctx.db
      .query("projectCollaborators")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return {
      owner: {
        userId: project.userId,
        projectId: args.projectId,
      },
      collaborators,
    };
  },
});

// Get all collaborators for all projects the user has access to
export const getAllCollaborators = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get all projects the user owns or is a collaborator on
    const ownedProjects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const collaboratorRecords = await ctx.db
      .query("projectCollaborators")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const projectIds = new Set<string>();
    ownedProjects.forEach((p) => projectIds.add(p._id));
    collaboratorRecords.forEach((c) => projectIds.add(c.projectId));

    // Get all collaborators for all these projects
    const allCollaborators = [];
    for (const projectId of projectIds) {
      const collaborators = await ctx.db
        .query("projectCollaborators")
        .withIndex("by_project", (q) => q.eq("projectId", projectId as Id<"projects">))
        .collect();
      allCollaborators.push(...collaborators);
    }

    return allCollaborators;
  },
});

export const getPendingInvitations = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) {
      return [];
    }

    const email = normalizeEmail(identity.email);
    const invitations = await ctx.db
      .query("projectInvitations")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();

    const pendingInvitations = [];
    const now = Date.now();

    for (const invitation of invitations) {
      if (invitation.status !== "pending") {
        continue;
      }
      if (invitation.expiresAt <= now) {
        continue;
      }
      const project = await ctx.db.get(invitation.projectId);
      pendingInvitations.push({
        id: invitation._id,
        projectId: invitation.projectId,
        projectName: project?.name || "Untitled Project",
        role: invitation.role,
        invitedAt: invitation.invitedAt,
        inviterName: invitation.invitedByName || "A teammate",
        token: invitation.token,
        expiresAt: invitation.expiresAt,
      });
    }

    return pendingInvitations;
  },
});

export const acceptProjectInvitation = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) {
      throw new Error("You must be signed in with an email address to accept invitations.");
    }

    const [invitation] = await ctx.db
      .query("projectInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .collect();

    if (!invitation) {
      throw new Error("Invitation not found.");
    }

    if (invitation.status !== "pending") {
      throw new Error("This invitation has already been processed.");
    }

    if (invitation.expiresAt <= Date.now()) {
      await ctx.db.patch(invitation._id, { status: "expired" });
      throw new Error("This invitation has expired.");
    }

    const email = normalizeEmail(identity.email);
    if (email !== invitation.email.toLowerCase()) {
      throw new Error("This invitation was sent to a different email address.");
    }

    const now = Date.now();

    const existingCollaborator = await ctx.db
      .query("projectCollaborators")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", invitation.projectId).eq("userId", identity.subject)
      )
      .collect();

    if (existingCollaborator.length > 0) {
      await ctx.db.patch(existingCollaborator[0]._id, {
        email,
        userName: identity.name || existingCollaborator[0].userName,
        role: invitation.role,
      });
    } else {
      await ctx.db.insert("projectCollaborators", {
        projectId: invitation.projectId,
        userId: identity.subject,
        email,
        role: invitation.role,
        addedBy: invitation.invitedBy,
        addedAt: now,
        userName: identity.name || undefined,
      });
    }

    await ctx.db.patch(invitation._id, {
      status: "accepted",
      respondedAt: now,
      userId: identity.subject,
      token: generateToken(), // Invalidate previous token
    });

    return {
      success: true,
      projectId: invitation.projectId,
      message: "Invitation accepted",
    };
  },
});

export const declineProjectInvitation = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) {
      throw new Error("You must be signed in to decline invitations.");
    }

    const [invitation] = await ctx.db
      .query("projectInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .collect();

    if (!invitation) {
      throw new Error("Invitation not found.");
    }

    if (invitation.status !== "pending") {
      throw new Error("This invitation has already been processed.");
    }

    const email = normalizeEmail(identity.email);
    if (email !== invitation.email.toLowerCase()) {
      throw new Error("This invitation was sent to a different email address.");
    }

    await ctx.db.patch(invitation._id, {
      status: "declined",
      respondedAt: Date.now(),
      userId: identity.subject,
      token: generateToken(),
    });

    return {
      success: true,
      message: "Invitation declined",
    };
  },
});

export const removeProjectCollaborator = mutation({
  args: {
    projectId: v.id("projects"),
    collaboratorId: v.id("projectCollaborators"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Verify the user owns this project
    if (project.userId !== identity.subject) {
      throw new Error("Only project owners can remove collaborators");
    }

    const collaborator = await ctx.db.get(args.collaboratorId);
    if (!collaborator) {
      throw new Error("Collaborator not found");
    }

    // Verify the collaborator belongs to this project
    if (collaborator.projectId !== args.projectId) {
      throw new Error("Collaborator does not belong to this project");
    }

    // Prevent removing the owner
    if (collaborator.userId === project.userId) {
      throw new Error("Cannot remove the project owner");
    }

    await ctx.db.delete(args.collaboratorId);
    return { success: true };
  },
});

