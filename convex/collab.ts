import { v } from "convex/values";

import {
  consumeToken,
  incomingElementWins,
  isHydrationClaimStale,
  isPresenceActive,
  MAX_ELEMENTS_PER_SCENE,
  MAX_SESSIONS_PER_ROOM,
  RATE_LIMITS,
  roomIsDirty,
  roomIsCollectable,
  sanitizeColor,
  sanitizeName,
  sanitizeSelectedIds,
  validateElementBatch,
  type BucketState,
} from "./collabLogic";
import { shareTokenSchema } from "./validation";
import {
  internalMutation,
  mutation,
  query,
  type DatabaseReader,
  type DatabaseWriter,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashSecret(secret: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function getUserId(ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

type AuthorizedScene = {
  scene: Doc<"scenes">;
  ownerId: string;
  viaOwner: boolean;
  userId: string | null;
};

/**
 * Authorize edit access to a scene via the signed-in owner OR a valid, enabled
 * edit share token. Reads `sceneShares` on the token path so reactive queries
 * re-run (and revoke) the instant a share is disabled.
 */
async function authorizeEdit(
  ctx: {
    db: DatabaseReader;
    auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
  },
  args: { sceneId: Id<"scenes">; token?: string | null },
): Promise<AuthorizedScene | null> {
  const scene = await ctx.db.get(args.sceneId);
  if (!scene) {
    return null;
  }
  const userId = await getUserId(ctx);
  if (userId && scene.ownerId === userId) {
    return { scene, ownerId: scene.ownerId, viaOwner: true, userId };
  }
  if (args.token) {
    const parsed = shareTokenSchema.safeParse(args.token);
    if (!parsed.success) {
      return null;
    }
    const share = await ctx.db
      .query("sceneShares")
      .withIndex("by_token", (q) => q.eq("token", parsed.data))
      .unique();
    if (
      share &&
      share.enabled &&
      share.mode === "edit" &&
      share.sceneId === args.sceneId &&
      share.ownerId === scene.ownerId
    ) {
      return { scene, ownerId: scene.ownerId, viaOwner: false, userId };
    }
  }
  return null;
}

async function verifySession(
  ctx: { db: DatabaseReader },
  args: { sceneId: Id<"scenes">; roomSessionId: string; sessionSecret: string },
): Promise<Doc<"roomSessions"> | null> {
  const session = await ctx.db
    .query("roomSessions")
    .withIndex("by_room_session", (q) =>
      q.eq("sceneId", args.sceneId).eq("roomSessionId", args.roomSessionId),
    )
    .unique();
  if (!session) {
    return null;
  }
  const hash = await hashSecret(args.sessionSecret);
  return hash === session.sessionSecretHash ? session : null;
}

async function getRoom(ctx: { db: DatabaseReader }, sceneId: Id<"scenes">) {
  return ctx.db
    .query("liveRooms")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .unique();
}

function roomIsActive(room: Doc<"liveRooms"> | null | undefined) {
  return Boolean(room && room.startedByUserId && !room.stoppedAt);
}

async function getMaxElementUpdatedAt(
  ctx: { db: DatabaseReader },
  sceneId: Id<"scenes">,
) {
  const elements = await ctx.db
    .query("roomElements")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .collect();
  let maxElementUpdatedAt: number | null = null;
  for (const element of elements) {
    maxElementUpdatedAt = Math.max(maxElementUpdatedAt ?? 0, element.updatedAt);
  }
  return { elements, maxElementUpdatedAt };
}

async function deleteLiveRoomRows(db: DatabaseWriter, sceneId: Id<"scenes">) {
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
  for (const limit of rateLimits) {
    await db.delete(limit._id);
  }
  const room = await getRoom({ db }, sceneId);
  if (room) {
    await db.delete(room._id);
  }
}

/** Token-bucket rate limit gate for a (session, action). Throws when exceeded. */
async function enforceRateLimit(
  ctx: { db: DatabaseWriter },
  args: { sceneId: Id<"scenes">; roomSessionId: string; action: keyof typeof RATE_LIMITS },
  now: number,
) {
  const config = RATE_LIMITS[args.action];
  const existing = await ctx.db
    .query("collabRateLimits")
    .withIndex("by_key", (q) =>
      q
        .eq("sceneId", args.sceneId)
        .eq("roomSessionId", args.roomSessionId)
        .eq("action", args.action),
    )
    .unique();
  const prev: BucketState = existing
    ? { tokens: existing.tokens, updatedAt: existing.updatedAt }
    : null;
  const result = consumeToken(prev, now, config);
  if (existing) {
    await ctx.db.patch(existing._id, { tokens: result.tokens, updatedAt: result.updatedAt });
  } else {
    await ctx.db.insert("collabRateLimits", {
      sceneId: args.sceneId,
      roomSessionId: args.roomSessionId,
      action: args.action,
      tokens: result.tokens,
      updatedAt: result.updatedAt,
    });
  }
  if (!result.allowed) {
    throw new Error("Rate limit exceeded");
  }
}

// ---------------------------------------------------------------------------
// Join / hydration
// ---------------------------------------------------------------------------

export const startRoom = mutation({
  args: {
    sceneId: v.id("scenes"),
    token: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeEdit(ctx, args);
    if (!auth || !auth.viaOwner || !auth.userId) {
      throw new Error("Only the scene owner can start a room");
    }
    const now = Date.now();
    const existing = await getRoom(ctx, args.sceneId);
    if (roomIsActive(existing)) {
      return {
        active: true,
        startedByUserId: existing!.startedByUserId ?? null,
        status: existing!.status,
      };
    }
    if (existing && !existing.startedByUserId && !existing.stoppedAt) {
      await ctx.db.patch(existing._id, {
        ownerId: auth.ownerId,
        startedByUserId: auth.userId,
        startedAt: now,
        stoppedAt: null,
      });
      return { active: true, startedByUserId: auth.userId, status: existing.status };
    }
    if (existing) {
      await deleteLiveRoomRows(ctx.db, args.sceneId);
    }
    const status = auth.scene.currentObjectKey ? "needsHydration" : "ready";
    await ctx.db.insert("liveRooms", {
      sceneId: args.sceneId,
      ownerId: auth.ownerId,
      status,
      hydratingSessionId: null,
      hydratingStartedAt: null,
      startedByUserId: auth.userId,
      startedAt: now,
      stoppedAt: null,
      epoch: 0,
      snapshotMaxUpdatedAt: null,
      snapshotHash: auth.scene.currentObjectKey ? auth.scene.contentHash : null,
      snapshotAt: null,
      createdAt: now,
    });
    return { active: true, startedByUserId: auth.userId, status };
  },
});

export const joinRoom = mutation({
  args: {
    sceneId: v.id("scenes"),
    token: v.optional(v.union(v.string(), v.null())),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeEdit(ctx, args);
    if (!auth) {
      throw new Error("Not authorized to join this room");
    }
    const now = Date.now();
    const userId = await getUserId(ctx);
    const joinRateKey = userId
      ? `join:user:${userId}`
      : `join:token:${await hashSecret(args.token ?? auth.ownerId)}`;
    await enforceRateLimit(
      ctx,
      { sceneId: args.sceneId, roomSessionId: joinRateKey, action: "joinRoom" },
      now,
    );

    const room = await getRoom(ctx, args.sceneId);
    if (!roomIsActive(room)) {
      throw new Error("Room has not been started");
    }
    const activeRoom = room!;

    const sessionCount = (
      await ctx.db
        .query("roomSessions")
        .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
        .collect()
    ).length;
    if (sessionCount >= MAX_SESSIONS_PER_ROOM) {
      throw new Error("Room is full");
    }

    const roomSessionId = randomHex(12);
    const sessionSecret = randomHex(24);
    await ctx.db.insert("roomSessions", {
      sceneId: args.sceneId,
      roomSessionId,
      sessionSecretHash: await hashSecret(sessionSecret),
      userId,
      createdAt: now,
    });
    await ctx.db.insert("presence", {
      sceneId: args.sceneId,
      roomSessionId,
      userId,
      name: sanitizeName(args.name),
      color: sanitizeColor(args.color),
      cursorX: null,
      cursorY: null,
      button: "up",
      selectedIds: [],
      lastSeenAt: now,
    });

    // Claim hydration if this is the first joiner of a room backed by an R2
    // snapshot, or if a previous claimer stalled.
    let needsHydration = false;
    if (
      activeRoom.status === "needsHydration" ||
      (activeRoom.status === "hydrating" &&
        isHydrationClaimStale(activeRoom.hydratingStartedAt, now))
    ) {
      await ctx.db.patch(activeRoom._id, {
        status: "hydrating",
        hydratingSessionId: roomSessionId,
        hydratingStartedAt: now,
      });
      needsHydration = true;
    }

    return {
      roomSessionId,
      sessionSecret,
      epoch: activeRoom.epoch,
      needsHydration,
      ownerId: auth.ownerId,
      viaOwner: auth.viaOwner,
      title: auth.scene.title,
    };
  },
});

export const completeHydration = mutation({
  args: {
    sceneId: v.id("scenes"),
    roomSessionId: v.string(),
    sessionSecret: v.string(),
    token: v.optional(v.union(v.string(), v.null())),
    elements: v.array(v.any()),
    contentHash: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const session = await verifySession(ctx, args);
    if (!session) {
      return { seeded: false };
    }
    const auth = await authorizeEdit(ctx, args);
    if (!auth) {
      return { seeded: false };
    }
    const room = await getRoom(ctx, args.sceneId);
    if (
      !room ||
      !roomIsActive(room) ||
      room.status !== "hydrating" ||
      room.hydratingSessionId !== args.roomSessionId
    ) {
      return { seeded: false };
    }
    const batch = validateElementBatch(args.elements, MAX_ELEMENTS_PER_SCENE);
    if (!batch.ok) {
      throw new Error(batch.reason);
    }
    const now = Date.now();
    if (batch.elements.length > MAX_ELEMENTS_PER_SCENE) {
      throw new Error("room has too many elements");
    }
    for (const element of batch.elements) {
      const existing = await ctx.db
        .query("roomElements")
        .withIndex("by_scene_element", (q) =>
          q.eq("sceneId", args.sceneId).eq("elementId", element.elementId),
        )
        .unique();
      if (existing) {
        continue;
      }
      await ctx.db.insert("roomElements", {
        sceneId: args.sceneId,
        elementId: element.elementId,
        data: element.data,
        version: element.version,
        versionNonce: element.versionNonce,
        updatedAt: now,
      });
    }
    // The seeded set equals the R2 head, so the room starts clean.
    await ctx.db.patch(room._id, {
      status: "ready",
      hydratingSessionId: null,
      hydratingStartedAt: null,
      snapshotMaxUpdatedAt: now,
      snapshotHash: args.contentHash ?? room.snapshotHash,
      snapshotAt: now,
    });
    return { seeded: true };
  },
});

// ---------------------------------------------------------------------------
// Reactive reads (queries cannot use Date.now — clients filter by their clock)
// ---------------------------------------------------------------------------

export const getRoomView = query({
  args: { sceneId: v.id("scenes"), token: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const auth = await authorizeEdit(ctx, args);
    if (!auth) {
      return { authorized: false as const };
    }
    const room = await getRoom(ctx, args.sceneId);
    const active = roomIsActive(room);
    return {
      authorized: true as const,
      active,
      status: active ? room!.status : ("inactive" as const),
      epoch: room?.epoch ?? 0,
      ownerId: auth.ownerId,
      viaOwner: auth.viaOwner,
      title: auth.scene.title,
      startedByUserId: active ? (room!.startedByUserId ?? null) : null,
      canStart: auth.viaOwner && !active,
      canStop: active && auth.userId !== null && room!.startedByUserId === auth.userId,
    };
  },
});

export const getRoomElements = query({
  args: { sceneId: v.id("scenes"), token: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const auth = await authorizeEdit(ctx, args);
    if (!auth) {
      return null;
    }
    const room = await getRoom(ctx, args.sceneId);
    if (!roomIsActive(room)) {
      return [];
    }
    const rows = await ctx.db
      .query("roomElements")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .collect();
    return rows.map((row) => ({
      elementId: row.elementId,
      data: row.data,
      version: row.version,
      versionNonce: row.versionNonce,
      updatedAt: row.updatedAt,
    }));
  },
});

export const getPresence = query({
  args: { sceneId: v.id("scenes"), token: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const auth = await authorizeEdit(ctx, args);
    if (!auth) {
      return null;
    }
    const room = await getRoom(ctx, args.sceneId);
    if (!roomIsActive(room)) {
      return [];
    }
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .collect();
    return rows.map((row) => ({
      roomSessionId: row.roomSessionId,
      userId: row.userId,
      name: row.name,
      color: row.color,
      cursorX: row.cursorX,
      cursorY: row.cursorY,
      button: row.button,
      selectedIds: row.selectedIds,
      lastSeenAt: row.lastSeenAt,
    }));
  },
});

// ---------------------------------------------------------------------------
// Live writes
// ---------------------------------------------------------------------------

export const pushElements = mutation({
  args: {
    sceneId: v.id("scenes"),
    token: v.optional(v.union(v.string(), v.null())),
    roomSessionId: v.string(),
    sessionSecret: v.string(),
    elements: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const session = await verifySession(ctx, args);
    if (!session) {
      throw new Error("Invalid session");
    }
    const auth = await authorizeEdit(ctx, args);
    if (!auth) {
      throw new Error("Not authorized");
    }
    const room = await getRoom(ctx, args.sceneId);
    if (!roomIsActive(room)) {
      throw new Error("Room is not active");
    }
    const now = Date.now();
    await enforceRateLimit(ctx, { ...args, action: "pushElements" }, now);
    const batch = validateElementBatch(args.elements);
    if (!batch.ok) {
      throw new Error(batch.reason);
    }
    const { elements: existingRows } = await getMaxElementUpdatedAt(ctx, args.sceneId);
    const existingById = new Map(existingRows.map((row) => [row.elementId, row]));
    const newElementIds = new Set<string>();
    for (const element of batch.elements) {
      if (!existingById.has(element.elementId)) {
        newElementIds.add(element.elementId);
      }
    }
    if (existingRows.length + newElementIds.size > MAX_ELEMENTS_PER_SCENE) {
      throw new Error("room has too many elements");
    }
    let applied = 0;
    for (const element of batch.elements) {
      const existing = existingById.get(element.elementId) ?? null;
      if (!incomingElementWins(element, existing)) {
        continue;
      }
      if (existing) {
        const patch = {
          data: element.data,
          version: element.version,
          versionNonce: element.versionNonce,
          updatedAt: now,
        };
        await ctx.db.patch(existing._id, patch);
        existingById.set(element.elementId, { ...existing, ...patch });
      } else {
        const inserted = await ctx.db.insert("roomElements", {
          sceneId: args.sceneId,
          elementId: element.elementId,
          data: element.data,
          version: element.version,
          versionNonce: element.versionNonce,
          updatedAt: now,
        });
        existingById.set(element.elementId, (await ctx.db.get(inserted))!);
      }
      applied += 1;
    }
    return { applied };
  },
});

export const updatePresence = mutation({
  args: {
    sceneId: v.id("scenes"),
    token: v.optional(v.union(v.string(), v.null())),
    roomSessionId: v.string(),
    sessionSecret: v.string(),
    name: v.string(),
    color: v.string(),
    cursorX: v.union(v.number(), v.null()),
    cursorY: v.union(v.number(), v.null()),
    button: v.union(v.literal("up"), v.literal("down")),
    selectedIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await verifySession(ctx, args);
    if (!session) {
      throw new Error("Invalid session");
    }
    const auth = await authorizeEdit(ctx, args);
    if (!auth) {
      throw new Error("Not authorized");
    }
    const room = await getRoom(ctx, args.sceneId);
    if (!roomIsActive(room)) {
      throw new Error("Room is not active");
    }
    const now = Date.now();
    await enforceRateLimit(ctx, { ...args, action: "updatePresence" }, now);
    const fields = {
      name: sanitizeName(args.name),
      color: sanitizeColor(args.color),
      cursorX: args.cursorX,
      cursorY: args.cursorY,
      button: args.button,
      selectedIds: sanitizeSelectedIds(args.selectedIds),
      lastSeenAt: now,
    };
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_room_session", (q) =>
        q.eq("sceneId", args.sceneId).eq("roomSessionId", args.roomSessionId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("presence", {
        sceneId: args.sceneId,
        roomSessionId: args.roomSessionId,
        userId: session.userId,
        ...fields,
      });
    }
    return null;
  },
});

export const leaveRoom = mutation({
  args: {
    sceneId: v.id("scenes"),
    roomSessionId: v.string(),
    sessionSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await verifySession(ctx, args);
    if (!session) {
      return null;
    }
    await deleteSessionRows(ctx, args.sceneId, args.roomSessionId, session._id);
    return null;
  },
});

export const stopRoom = mutation({
  args: {
    sceneId: v.id("scenes"),
    token: v.optional(v.union(v.string(), v.null())),
    roomSessionId: v.string(),
    sessionSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await verifySession(ctx, args);
    if (!session) {
      throw new Error("Invalid session");
    }
    const userId = await getUserId(ctx);
    if (!userId || session.userId !== userId) {
      throw new Error("Only the room starter can stop this room");
    }
    const auth = await authorizeEdit(ctx, args);
    if (!auth) {
      throw new Error("Not authorized");
    }
    const room = await getRoom(ctx, args.sceneId);
    if (!roomIsActive(room)) {
      return null;
    }
    if (room!.startedByUserId !== userId) {
      throw new Error("Only the room starter can stop this room");
    }
    const { maxElementUpdatedAt } = await getMaxElementUpdatedAt(ctx, args.sceneId);
    if (roomIsDirty(maxElementUpdatedAt, room!.snapshotMaxUpdatedAt)) {
      throw new Error("Room has unsaved changes");
    }
    await deleteLiveRoomRows(ctx.db, args.sceneId);
    return null;
  },
});

export const markRoomSnapshot = mutation({
  args: {
    sceneId: v.id("scenes"),
    token: v.optional(v.union(v.string(), v.null())),
    roomSessionId: v.string(),
    sessionSecret: v.string(),
    snapshotHash: v.string(),
    snapshotMaxUpdatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await verifySession(ctx, args);
    if (!session) {
      throw new Error("Invalid session");
    }
    const userId = await getUserId(ctx);
    if (!userId || session.userId !== userId) {
      throw new Error("Snapshot requires a signed-in room session");
    }
    const auth = await authorizeEdit(ctx, args);
    if (!auth) {
      throw new Error("Not authorized");
    }
    if (
      args.snapshotMaxUpdatedAt !== undefined &&
      (!Number.isFinite(args.snapshotMaxUpdatedAt) || args.snapshotMaxUpdatedAt < 0)
    ) {
      throw new Error("Invalid snapshot watermark");
    }
    const room = await getRoom(ctx, args.sceneId);
    if (!roomIsActive(room)) {
      return { marked: false, reason: "inactive" };
    }
    if (auth.scene.contentHash !== args.snapshotHash) {
      return { marked: false, reason: "uncommitted" };
    }
    const { maxElementUpdatedAt } = await getMaxElementUpdatedAt(ctx, args.sceneId);
    const serverWatermark = maxElementUpdatedAt ?? 0;
    if (
      args.snapshotMaxUpdatedAt !== undefined &&
      args.snapshotMaxUpdatedAt > serverWatermark
    ) {
      throw new Error("Snapshot watermark is ahead of the live room");
    }
    if (
      room!.snapshotMaxUpdatedAt !== null &&
      serverWatermark < room!.snapshotMaxUpdatedAt
    ) {
      return { marked: false, reason: "stale" };
    }
    await ctx.db.patch(room!._id, {
      snapshotHash: args.snapshotHash,
      snapshotMaxUpdatedAt: serverWatermark,
      snapshotAt: Date.now(),
    });
    return { marked: true, reason: null };
  },
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function deleteSessionRows(
  ctx: { db: DatabaseWriter },
  sceneId: Id<"scenes">,
  roomSessionId: string,
  sessionDocId: Id<"roomSessions"> | null,
) {
  const presence = await ctx.db
    .query("presence")
    .withIndex("by_room_session", (q) =>
      q.eq("sceneId", sceneId).eq("roomSessionId", roomSessionId),
    )
    .unique();
  if (presence) {
    await ctx.db.delete(presence._id);
  }
  const rateLimits = await ctx.db
    .query("collabRateLimits")
    .withIndex("by_key", (q) => q.eq("sceneId", sceneId).eq("roomSessionId", roomSessionId))
    .collect();
  for (const limit of rateLimits) {
    await ctx.db.delete(limit._id);
  }
  if (sessionDocId) {
    await ctx.db.delete(sessionDocId);
  }
}

/** Periodic sweep: drop stale presence/sessions and GC fully-snapshotted rooms. */
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rooms = await ctx.db.query("liveRooms").collect();
    for (const room of rooms) {
      const presenceRows = await ctx.db
        .query("presence")
        .withIndex("by_scene", (q) => q.eq("sceneId", room.sceneId))
        .collect();

      let lastPresenceAt: number | null = null;
      let hasActivePresence = false;
      for (const presence of presenceRows) {
        lastPresenceAt = Math.max(lastPresenceAt ?? 0, presence.lastSeenAt);
        if (isPresenceActive(presence.lastSeenAt, now)) {
          hasActivePresence = true;
        } else {
          // Stale presence: remove it and its session/rate-limit rows.
          const session = await ctx.db
            .query("roomSessions")
            .withIndex("by_room_session", (q) =>
              q.eq("sceneId", room.sceneId).eq("roomSessionId", presence.roomSessionId),
            )
            .unique();
          await deleteSessionRows(
            ctx,
            room.sceneId,
            presence.roomSessionId,
            session?._id ?? null,
          );
        }
      }

      const elements = await ctx.db
        .query("roomElements")
        .withIndex("by_scene", (q) => q.eq("sceneId", room.sceneId))
        .collect();
      let maxElementUpdatedAt: number | null = null;
      for (const element of elements) {
        maxElementUpdatedAt = Math.max(maxElementUpdatedAt ?? 0, element.updatedAt);
      }

      if (
        roomIsCollectable({
          hasActivePresence,
          lastPresenceAt,
          now,
          maxElementUpdatedAt,
          snapshotMaxUpdatedAt: room.snapshotMaxUpdatedAt,
        })
      ) {
        for (const element of elements) {
          await ctx.db.delete(element._id);
        }
        const sessions = await ctx.db
          .query("roomSessions")
          .withIndex("by_scene", (q) => q.eq("sceneId", room.sceneId))
          .collect();
        for (const session of sessions) {
          await ctx.db.delete(session._id);
        }
        const leftoverPresence = await ctx.db
          .query("presence")
          .withIndex("by_scene", (q) => q.eq("sceneId", room.sceneId))
          .collect();
        for (const presence of leftoverPresence) {
          await ctx.db.delete(presence._id);
        }
        await ctx.db.delete(room._id);
      }
    }
  },
});
