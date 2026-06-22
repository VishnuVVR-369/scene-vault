import { v } from "convex/values";

import { internalMutation } from "./_generated/server";

// Internal-only helpers for end-to-end smoke testing the collab backend over the
// network. Not exposed to the public API (callable only via the Convex CLI /
// admin), so they cannot be invoked by clients.

export const seed = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sceneId = await ctx.db.insert("scenes", {
      ownerId: "smoke-owner",
      title: "Collab smoke",
      folderId: null,
      version: 0,
      currentObjectKey: null,
      thumbnailObjectKey: null,
      byteSize: 0,
      contentHash: null,
      createdAt: now,
      updatedAt: now,
      lastSavedAt: null,
    });
    await ctx.db.insert("sceneShares", {
      sceneId,
      ownerId: "smoke-owner",
      mode: "edit",
      token: args.token,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    return sceneId;
  },
});

export const cleanup = internalMutation({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, args) => {
    const sceneId = args.sceneId;
    for (const table of ["roomElements", "presence", "roomSessions"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
        .collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
    }
    const limits = await ctx.db
      .query("collabRateLimits")
      .withIndex("by_key", (q) => q.eq("sceneId", sceneId))
      .collect();
    for (const row of limits) {
      await ctx.db.delete(row._id);
    }
    const room = await ctx.db
      .query("liveRooms")
      .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
      .unique();
    if (room) {
      await ctx.db.delete(room._id);
    }
    for (const mode of ["view", "edit"] as const) {
      const shares = await ctx.db
        .query("sceneShares")
        .withIndex("by_scene_mode", (q) => q.eq("sceneId", sceneId).eq("mode", mode))
        .collect();
      for (const share of shares) {
        await ctx.db.delete(share._id);
      }
    }
    await ctx.db.delete(sceneId);
  },
});
