import { v } from "convex/values";

import {
  commitSharedSceneSaveArgsSchema,
  commitSceneSaveArgsSchema,
  createFolderArgsSchema,
  createSceneArgsSchema,
  idArgsSchema,
  moveFolderArgsSchema,
  renameFolderArgsSchema,
  sceneShareArgsSchema,
  setSceneShareEnabledArgsSchema,
  shareTokenArgsSchema,
  updateSceneArgsSchema,
} from "./validation";
import { mutation, query, type DatabaseReader, type DatabaseWriter } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function requireOwnerId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity.subject;
}

function buildSceneObjectKey(ownerId: string, sceneId: string) {
  return `users/${encodeURIComponent(ownerId)}/scenes/${encodeURIComponent(sceneId)}/head/excalidraw.json`;
}

function buildSceneThumbnailObjectKey(ownerId: string, sceneId: string) {
  return `users/${encodeURIComponent(ownerId)}/scenes/${encodeURIComponent(sceneId)}/head/thumbnail.png`;
}

function generateShareToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function generateUniqueShareToken(db: DatabaseReader) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateShareToken();
    const existing = await db
      .query("sceneShares")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!existing) {
      return token;
    }
  }
  throw new Error("Could not generate a unique share token");
}

async function deleteSharesForScene(db: DatabaseWriter, sceneId: Id<"scenes">) {
  const shares = await Promise.all([
    db
      .query("sceneShares")
      .withIndex("by_scene_mode", (q) => q.eq("sceneId", sceneId).eq("mode", "view"))
      .collect(),
    db
      .query("sceneShares")
      .withIndex("by_scene_mode", (q) => q.eq("sceneId", sceneId).eq("mode", "edit"))
      .collect(),
  ]);
  for (const share of shares.flat()) {
    await db.delete(share._id);
  }
}

async function deleteCollabRowsForScene(db: DatabaseWriter, sceneId: Id<"scenes">) {
  const elements = await db
    .query("roomElements")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .collect();
  for (const element of elements) {
    await db.delete(element._id);
  }

  const presenceRows = await db
    .query("presence")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .collect();
  for (const presence of presenceRows) {
    await db.delete(presence._id);
  }

  const sessions = await db
    .query("roomSessions")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .collect();
  for (const session of sessions) {
    await db.delete(session._id);
  }

  const rateLimits = await db
    .query("collabRateLimits")
    .withIndex("by_key", (q) => q.eq("sceneId", sceneId))
    .collect();
  for (const rateLimit of rateLimits) {
    await db.delete(rateLimit._id);
  }

  const room = await db
    .query("liveRooms")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .unique();
  if (room) {
    await db.delete(room._id);
  }
}

async function getShareSceneByToken(db: DatabaseReader, token: string) {
  const input = shareTokenArgsSchema.parse({ token });
  const share = await db
    .query("sceneShares")
    .withIndex("by_token", (q) => q.eq("token", input.token))
    .unique();
  if (!share || !share.enabled) {
    return null;
  }
  const scene = await db.get(share.sceneId);
  if (!scene || scene.ownerId !== share.ownerId) {
    return null;
  }
  return { share, scene };
}

export const getLibrary = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    const [folders, scenes] = await Promise.all([
      ctx.db
        .query("folders")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("scenes")
        .withIndex("by_owner_updated", (q) => q.eq("ownerId", ownerId))
        .collect(),
    ]);
    return { folders, scenes };
  },
});

export const getSceneStorageAccess = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const scene = await ctx.db.get(args.sceneId);
    if (!scene || scene.ownerId !== ownerId) {
      return null;
    }
    return {
      storageOwnerId: scene.ownerId,
      currentObjectKey: scene.currentObjectKey,
      thumbnailObjectKey: scene.thumbnailObjectKey,
    };
  },
});

export const getSharesForScene = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    sceneShareArgsSchema.parse({ sceneId: args.sceneId, mode: "view" });
    const scene = await ctx.db.get(args.sceneId);
    if (!scene || scene.ownerId !== ownerId) {
      throw new Error("Scene not found");
    }
    const [viewShare, editShare] = await Promise.all([
      ctx.db
        .query("sceneShares")
        .withIndex("by_scene_mode", (q) =>
          q.eq("sceneId", args.sceneId).eq("mode", "view"),
        )
        .unique(),
      ctx.db
        .query("sceneShares")
        .withIndex("by_scene_mode", (q) =>
          q.eq("sceneId", args.sceneId).eq("mode", "edit"),
        )
        .unique(),
    ]);
    return {
      view: viewShare
        ? {
            token: viewShare.token,
            enabled: viewShare.enabled,
            updatedAt: viewShare.updatedAt,
          }
        : null,
      edit: editShare
        ? {
            token: editShare.token,
            enabled: editShare.enabled,
            updatedAt: editShare.updatedAt,
          }
        : null,
    };
  },
});

export const createOrRotateShare = mutation({
  args: {
    sceneId: v.id("scenes"),
    mode: v.union(v.literal("view"), v.literal("edit")),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const input = sceneShareArgsSchema.parse(args);
    const scene = await ctx.db.get(args.sceneId);
    if (!scene || scene.ownerId !== ownerId) {
      throw new Error("Scene not found");
    }
    const token = await generateUniqueShareToken(ctx.db);
    const now = Date.now();
    const existing = await ctx.db
      .query("sceneShares")
      .withIndex("by_scene_mode", (q) =>
        q.eq("sceneId", args.sceneId).eq("mode", input.mode),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        token,
        enabled: true,
        updatedAt: now,
      });
      return token;
    }
    await ctx.db.insert("sceneShares", {
      sceneId: args.sceneId,
      ownerId,
      mode: input.mode,
      token,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    return token;
  },
});

export const setShareEnabled = mutation({
  args: {
    sceneId: v.id("scenes"),
    mode: v.union(v.literal("view"), v.literal("edit")),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const input = setSceneShareEnabledArgsSchema.parse(args);
    const scene = await ctx.db.get(args.sceneId);
    if (!scene || scene.ownerId !== ownerId) {
      throw new Error("Scene not found");
    }
    const existing = await ctx.db
      .query("sceneShares")
      .withIndex("by_scene_mode", (q) =>
        q.eq("sceneId", args.sceneId).eq("mode", input.mode),
      )
      .unique();
    if (!existing) {
      throw new Error("Share link not found");
    }
    await ctx.db.patch(existing._id, {
      enabled: input.enabled,
      updatedAt: Date.now(),
    });
  },
});

export const getSharedSceneByToken = query({
  args: {
    token: v.string(),
    requiredMode: v.optional(v.union(v.literal("view"), v.literal("edit"))),
  },
  handler: async (ctx, args) => {
    const result = await getShareSceneByToken(ctx.db, args.token);
    if (!result) {
      return null;
    }
    if (args.requiredMode && result.share.mode !== args.requiredMode) {
      return null;
    }
    return {
      sceneId: result.scene._id,
      storageOwnerId: result.scene.ownerId,
      mode: result.share.mode,
      title: result.scene.title,
      version: result.scene.version,
      currentObjectKey: result.scene.currentObjectKey,
      thumbnailObjectKey: result.scene.thumbnailObjectKey,
      byteSize: result.scene.byteSize,
      contentHash: result.scene.contentHash,
      updatedAt: result.scene.updatedAt,
      lastSavedAt: result.scene.lastSavedAt,
    };
  },
});

export const createFolder = mutation({
  args: {
    name: v.string(),
    parentFolderId: v.union(v.id("folders"), v.null()),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const input = createFolderArgsSchema.parse(args);
    if (args.parentFolderId) {
      const parent = await ctx.db.get(args.parentFolderId);
      if (!parent || parent.ownerId !== ownerId) {
        throw new Error("Parent folder not found");
      }
    }
    const now = Date.now();
    return await ctx.db.insert("folders", {
      ownerId,
      name: input.name,
      parentFolderId: args.parentFolderId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const renameFolder = mutation({
  args: {
    folderId: v.id("folders"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const input = renameFolderArgsSchema.parse(args);
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.ownerId !== ownerId) {
      throw new Error("Folder not found");
    }
    await ctx.db.patch(args.folderId, { name: input.name, updatedAt: Date.now() });
  },
});

export const moveFolder = mutation({
  args: {
    folderId: v.id("folders"),
    parentFolderId: v.union(v.id("folders"), v.null()),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    moveFolderArgsSchema.parse(args);
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.ownerId !== ownerId) {
      throw new Error("Folder not found");
    }
    if (args.parentFolderId === args.folderId) {
      throw new Error("A folder cannot be moved into itself.");
    }
    if (args.parentFolderId) {
      const parent = await ctx.db.get(args.parentFolderId);
      if (!parent || parent.ownerId !== ownerId) {
        throw new Error("Parent folder not found");
      }
      const allFolders = await ctx.db
        .query("folders")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect();
      let cursor = parent.parentFolderId;
      while (cursor) {
        if (cursor === args.folderId) {
          throw new Error("A folder cannot be moved into one of its descendants.");
        }
        cursor = allFolders.find((candidate) => candidate._id === cursor)?.parentFolderId ?? null;
      }
    }
    await ctx.db.patch(args.folderId, {
      parentFolderId: args.parentFolderId,
      updatedAt: Date.now(),
    });
  },
});

export const deleteFolder = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    idArgsSchema.parse({ id: args.folderId });
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.ownerId !== ownerId) {
      throw new Error("Folder not found");
    }
    const allFolders = await ctx.db
      .query("folders")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    const folderIds = new Set<typeof args.folderId>([args.folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const candidate of allFolders) {
        if (candidate.parentFolderId && folderIds.has(candidate.parentFolderId)) {
          if (!folderIds.has(candidate._id)) {
            folderIds.add(candidate._id);
            changed = true;
          }
        }
      }
    }
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_owner_updated", (q) => q.eq("ownerId", ownerId))
      .collect();
    for (const scene of scenes) {
      if (scene.folderId && folderIds.has(scene.folderId)) {
        await deleteSharesForScene(ctx.db, scene._id);
        await deleteCollabRowsForScene(ctx.db, scene._id);
        await ctx.db.delete(scene._id);
      }
    }
    for (const id of folderIds) {
      await ctx.db.delete(id);
    }
  },
});

export const createScene = mutation({
  args: {
    title: v.string(),
    folderId: v.union(v.id("folders"), v.null()),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const input = createSceneArgsSchema.parse(args);
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.ownerId !== ownerId) {
        throw new Error("Folder not found");
      }
    }
    const now = Date.now();
    return await ctx.db.insert("scenes", {
      ownerId,
      title: input.title,
      folderId: args.folderId,
      version: 0,
      currentObjectKey: null,
      thumbnailObjectKey: null,
      byteSize: 0,
      contentHash: null,
      createdAt: now,
      updatedAt: now,
      lastSavedAt: null,
    });
  },
});

export const updateScene = mutation({
  args: {
    sceneId: v.id("scenes"),
    title: v.optional(v.string()),
    folderId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const input = updateSceneArgsSchema.parse(args);
    const scene = await ctx.db.get(args.sceneId);
    if (!scene || scene.ownerId !== ownerId) {
      throw new Error("Scene not found");
    }
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.ownerId !== ownerId) {
        throw new Error("Folder not found");
      }
    }
    await ctx.db.patch(args.sceneId, {
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(args.folderId === undefined ? {} : { folderId: args.folderId }),
      updatedAt: Date.now(),
    });
  },
});

export const deleteScene = mutation({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    idArgsSchema.parse({ id: args.sceneId });
    const scene = await ctx.db.get(args.sceneId);
    if (!scene || scene.ownerId !== ownerId) {
      throw new Error("Scene not found");
    }
    await deleteSharesForScene(ctx.db, args.sceneId);
    await deleteCollabRowsForScene(ctx.db, args.sceneId);
    await ctx.db.delete(args.sceneId);
  },
});

export const duplicateScene = mutation({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    idArgsSchema.parse({ id: args.sceneId });
    const scene = await ctx.db.get(args.sceneId);
    if (!scene || scene.ownerId !== ownerId) {
      throw new Error("Scene not found");
    }
    const now = Date.now();
    return await ctx.db.insert("scenes", {
      ownerId,
      title: `${scene.title} copy`,
      folderId: scene.folderId,
      version: 0,
      currentObjectKey: null,
      thumbnailObjectKey: null,
      byteSize: 0,
      contentHash: null,
      createdAt: now,
      updatedAt: now,
      lastSavedAt: null,
    });
  },
});

export const commitSceneSave = mutation({
  args: {
    sceneId: v.id("scenes"),
    objectKey: v.string(),
    byteSize: v.number(),
    contentHash: v.string(),
    thumbnailObjectKey: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const input = commitSceneSaveArgsSchema.parse(args);
    const scene = await ctx.db.get(args.sceneId);
    if (!scene || scene.ownerId !== ownerId) {
      throw new Error("Scene not found");
    }
    if (input.objectKey !== buildSceneObjectKey(ownerId, args.sceneId)) {
      throw new Error("Invalid scene object key");
    }
    if (
      input.thumbnailObjectKey &&
      input.thumbnailObjectKey !==
        buildSceneThumbnailObjectKey(ownerId, args.sceneId)
    ) {
      throw new Error("Invalid scene thumbnail object key");
    }
    // No-op when the content is unchanged: skipping the patch avoids a version
    // bump that would re-fire the getLibrary subscription and re-render clients.
    if (scene.contentHash === input.contentHash) {
      return;
    }
    const now = Date.now();
    await ctx.db.patch(args.sceneId, {
      currentObjectKey: input.objectKey,
      byteSize: input.byteSize,
      contentHash: input.contentHash,
      version: scene.version + 1,
      updatedAt: now,
      lastSavedAt: now,
      // Only touch the thumbnail pointer when the client managed to render and
      // upload one; a failed thumbnail must not wipe an existing preview.
      ...(input.thumbnailObjectKey === undefined
        ? {}
        : { thumbnailObjectKey: input.thumbnailObjectKey }),
    });
  },
});

export const commitSharedSceneSave = mutation({
  args: {
    token: v.string(),
    objectKey: v.string(),
    byteSize: v.number(),
    contentHash: v.string(),
    thumbnailObjectKey: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await requireOwnerId(ctx);
    const input = commitSharedSceneSaveArgsSchema.parse(args);
    const result = await getShareSceneByToken(ctx.db, input.token);
    if (!result || result.share.mode !== "edit") {
      throw new Error("Share link not found");
    }
    const sceneId = result.scene._id;
    const storageOwnerId = result.scene.ownerId;
    if (input.objectKey !== buildSceneObjectKey(storageOwnerId, sceneId)) {
      throw new Error("Invalid scene object key");
    }
    if (
      input.thumbnailObjectKey &&
      input.thumbnailObjectKey !==
        buildSceneThumbnailObjectKey(storageOwnerId, sceneId)
    ) {
      throw new Error("Invalid scene thumbnail object key");
    }
    if (result.scene.contentHash === input.contentHash) {
      return;
    }
    const now = Date.now();
    await ctx.db.patch(sceneId, {
      currentObjectKey: input.objectKey,
      byteSize: input.byteSize,
      contentHash: input.contentHash,
      version: result.scene.version + 1,
      updatedAt: now,
      lastSavedAt: now,
      ...(input.thumbnailObjectKey === undefined
        ? {}
        : { thumbnailObjectKey: input.thumbnailObjectKey }),
    });
  },
});
