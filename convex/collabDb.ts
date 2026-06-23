import type { DatabaseWriter } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Delete every live-collaboration row tied to a scene: the working-set elements,
// presence, sessions, rate-limit buckets, and the room itself. Shared by scene
// deletion (`library.ts`) and room stop/garbage-collection (`collab.ts`) so the
// set of swept tables stays in one place.
export async function deleteCollabRowsForScene(
  db: DatabaseWriter,
  sceneId: Id<"scenes">,
) {
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
