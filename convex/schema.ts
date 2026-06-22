import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  folders: defineTable({
    ownerId: v.string(),
    name: v.string(),
    parentFolderId: v.union(v.id("folders"), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_parent", ["ownerId", "parentFolderId"])
    .index("by_owner", ["ownerId"]),

  scenes: defineTable({
    ownerId: v.string(),
    title: v.string(),
    folderId: v.union(v.id("folders"), v.null()),
    version: v.number(),
    currentObjectKey: v.union(v.string(), v.null()),
    thumbnailObjectKey: v.union(v.string(), v.null()),
    byteSize: v.number(),
    contentHash: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastSavedAt: v.union(v.number(), v.null()),
  })
    .index("by_owner_folder", ["ownerId", "folderId"])
    .index("by_owner_updated", ["ownerId", "updatedAt"]),
});
