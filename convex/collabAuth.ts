import { shareTokenSchema } from "./validation";
import type { DatabaseReader } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// Authentication / session primitives shared by the collab functions. Kept apart
// from the function definitions in `collab.ts` so the room logic reads as a flat
// list of mutations/queries rather than helpers interleaved with handlers.

export function randomHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function hashSecret(secret: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function getUserId(ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

export type AuthorizedScene = {
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
export async function authorizeEdit(
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

export async function verifySession(
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
