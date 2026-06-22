import { v } from "convex/values";

import {
  commitSceneSaveArgsSchema,
  createFolderArgsSchema,
  createSceneArgsSchema,
  idArgsSchema,
  moveFolderArgsSchema,
  renameFolderArgsSchema,
  updateSceneArgsSchema,
} from "./validation";
import { mutation, query } from "./_generated/server";

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
      currentObjectKey: scene.currentObjectKey,
      thumbnailObjectKey: scene.thumbnailObjectKey,
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
