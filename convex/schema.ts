import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { tables as betterAuthTables } from "./betterAuth/schema";

export default defineSchema({
  ...betterAuthTables,

  userOwnerAliases: defineTable({
    authUserId: v.string(),
    ownerId: v.string(),
    source: v.union(v.literal("legacy-clerk"), v.literal("manual")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_auth_user", ["authUserId"])
    .index("by_owner", ["ownerId"])
    .index("by_pair", ["authUserId", "ownerId"]),

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
    // Pinned scenes surface in a dedicated dashboard section. Optional so rows
    // created before this field still validate (treated as unpinned).
    pinned: v.optional(v.boolean()),
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

  sceneShares: defineTable({
    sceneId: v.id("scenes"),
    ownerId: v.string(),
    mode: v.union(v.literal("view"), v.literal("edit")),
    token: v.string(),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_scene_mode", ["sceneId", "mode"])
    .index("by_owner", ["ownerId"]),

  // One active live collaboration room per scene. Created only when the owner
  // explicitly starts live editing. `epoch` is bumped to force every member to
  // resync or to revoke access. Snapshot bookkeeping (`snapshot*`) lets a cron
  // safely garbage-collect the live working set only once it has been persisted
  // back to R2 — so a browser crash can never lose edits (they live in Convex).
  liveRooms: defineTable({
    sceneId: v.id("scenes"),
    ownerId: v.string(),
    // "empty"      — no durable scene yet, ready to edit from scratch
    // "needsHydration" — has a durable R2 snapshot that must seed the room
    // "hydrating"  — a joiner has claimed seeding the room from R2
    // "ready"      — live working set is authoritative
    status: v.union(
      v.literal("empty"),
      v.literal("needsHydration"),
      v.literal("hydrating"),
      v.literal("ready"),
    ),
    hydratingSessionId: v.union(v.string(), v.null()),
    hydratingStartedAt: v.union(v.number(), v.null()),
    startedByUserId: v.optional(v.union(v.string(), v.null())),
    startedAt: v.optional(v.number()),
    stoppedAt: v.optional(v.union(v.number(), v.null())),
    epoch: v.number(),
    // Max `updatedAt` across roomElements captured by the last successful R2
    // snapshot, plus the content hash that was written. The room is "dirty"
    // (needs a fresh snapshot) when a live element is newer than this.
    snapshotMaxUpdatedAt: v.union(v.number(), v.null()),
    snapshotHash: v.union(v.string(), v.null()),
    snapshotAt: v.union(v.number(), v.null()),
    createdAt: v.number(),
  }).index("by_scene", ["sceneId"]),

  // Live working set: one row per (scene, element). Per-element last-write-wins
  // using Excalidraw's version/versionNonce reconciliation. Tombstones
  // (isDeleted elements) are kept so deletes converge; the cron GCs them.
  roomElements: defineTable({
    sceneId: v.id("scenes"),
    elementId: v.string(),
    data: v.any(),
    version: v.number(),
    versionNonce: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scene", ["sceneId"])
    .index("by_scene_element", ["sceneId", "elementId"]),

  // Server-issued session identity. The cleartext `sessionSecret` is returned
  // once by joinRoom; only its hash is stored. Every mutating call must present
  // a matching (roomSessionId, sessionSecret), which prevents guests from
  // spoofing each other's presence or session.
  roomSessions: defineTable({
    sceneId: v.id("scenes"),
    roomSessionId: v.string(),
    sessionSecretHash: v.string(),
    userId: v.union(v.string(), v.null()),
    createdAt: v.number(),
  })
    .index("by_scene", ["sceneId"])
    .index("by_room_session", ["sceneId", "roomSessionId"]),

  // Ephemeral presence (cursor, selection, who's online). Denormalized name and
  // color so getPresence is a single index read with no joins. Swept by TTL.
  presence: defineTable({
    sceneId: v.id("scenes"),
    roomSessionId: v.string(),
    userId: v.union(v.string(), v.null()),
    name: v.string(),
    color: v.string(),
    cursorX: v.union(v.number(), v.null()),
    cursorY: v.union(v.number(), v.null()),
    button: v.union(v.literal("up"), v.literal("down")),
    selectedIds: v.array(v.string()),
    lastSeenAt: v.number(),
  })
    .index("by_scene", ["sceneId"])
    .index("by_room_session", ["sceneId", "roomSessionId"]),

  // Token-bucket rate limiting per (session, action) to throttle abuse of the
  // public, token-gated collab mutations. Isolated to its own row so it never
  // contends with element/presence writes.
  collabRateLimits: defineTable({
    sceneId: v.id("scenes"),
    roomSessionId: v.string(),
    action: v.string(),
    tokens: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["sceneId", "roomSessionId", "action"]),
});
