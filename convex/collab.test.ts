import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import { PRESENCE_TTL_MS, ROOM_IDLE_GRACE_MS } from "./collabLogic";

// convex-test discovers function modules from the convex/ directory.
const modules = import.meta.glob("./**/*.ts");

const OWNER = "owner-1";
const TOKEN = "a".repeat(40);

function setup() {
  return convexTest(schema, modules);
}

type T = ReturnType<typeof setup>;

async function seedScene(
  t: T,
  opts: { currentObjectKey?: string | null; contentHash?: string | null } = {},
) {
  return t.run(async (ctx) =>
    ctx.db.insert("scenes", {
      ownerId: OWNER,
      title: "Test scene",
      folderId: null,
      version: 0,
      currentObjectKey: opts.currentObjectKey ?? null,
      thumbnailObjectKey: null,
      byteSize: 0,
      contentHash: opts.contentHash ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastSavedAt: null,
    }),
  );
}

async function seedEditShare(t: T, sceneId: string, enabled = true) {
  return t.run(async (ctx) =>
    ctx.db.insert("sceneShares", {
      sceneId: sceneId as never,
      ownerId: OWNER,
      mode: "edit",
      token: TOKEN,
      enabled,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

function el(id: string, version: number, versionNonce: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: "rectangle",
    version,
    versionNonce,
    isDeleted: false,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...extra,
  };
}

const owner = (t: T) => t.withIdentity({ subject: OWNER });

async function startRoom(t: T, sceneId: string) {
  return owner(t).mutation(api.collab.startRoom, { sceneId: sceneId as never });
}

async function joinOwner(t: T, sceneId: string) {
  return owner(t).mutation(api.collab.joinRoom, {
    sceneId: sceneId as never,
    name: "Owner",
    color: "#ff0000",
  });
}

describe("collab backend", () => {
  it("keeps live rooms inactive until the owner starts one", async () => {
    const t = setup();
    const sceneId = await seedScene(t);
    await seedEditShare(t, sceneId);

    const ownerView = await owner(t).query(api.collab.getRoomView, { sceneId });
    expect(ownerView.authorized).toBe(true);
    if (ownerView.authorized) {
      expect(ownerView.active).toBe(false);
      expect(ownerView.canStart).toBe(true);
    }

    await expect(
      owner(t).mutation(api.collab.joinRoom, {
        sceneId,
        name: "Owner",
        color: "#ff0000",
      }),
    ).rejects.toThrow("Room has not been started");
    await expect(
      t.mutation(api.collab.joinRoom, {
        sceneId,
        token: TOKEN,
        name: "Guest",
        color: "#00ff00",
      }),
    ).rejects.toThrow("Room has not been started");

    const started = await startRoom(t, sceneId);
    expect(started.active).toBe(true);
    const guestView = await t.query(api.collab.getRoomView, { sceneId, token: TOKEN });
    expect(guestView.authorized).toBe(true);
    if (guestView.authorized) {
      expect(guestView.active).toBe(true);
      expect(guestView.canStart).toBe(false);
    }
  });

  it("claims legacy auto-created rooms without deleting their live data", async () => {
    const t = setup();
    const sceneId = await seedScene(t);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("liveRooms", {
        sceneId: sceneId as never,
        ownerId: OWNER,
        status: "ready",
        hydratingSessionId: null,
        hydratingStartedAt: null,
        epoch: 0,
        snapshotMaxUpdatedAt: null,
        snapshotHash: null,
        snapshotAt: null,
        createdAt: now,
      });
      await ctx.db.insert("roomElements", {
        sceneId: sceneId as never,
        elementId: "legacy",
        data: el("legacy", 1, 1),
        version: 1,
        versionNonce: 1,
        updatedAt: now,
      });
    });

    await startRoom(t, sceneId);
    const room = await t.run(async (ctx) =>
      ctx.db
        .query("liveRooms")
        .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
        .unique(),
    );
    expect(room?.startedByUserId).toBe(OWNER);
    const elements = await owner(t).query(api.collab.getRoomElements, { sceneId });
    expect(elements?.map((element) => element.elementId)).toEqual(["legacy"]);
  });

  it("owner can join, push elements, and read them back", async () => {
    const t = setup();
    const sceneId = await seedScene(t);
    await startRoom(t, sceneId);
    const join = await joinOwner(t, sceneId);
    expect(join.needsHydration).toBe(false);
    expect(join.roomSessionId).toBeTruthy();
    expect(join.sessionSecret).toBeTruthy();

    await owner(t).mutation(api.collab.pushElements, {
      sceneId,
      roomSessionId: join.roomSessionId,
      sessionSecret: join.sessionSecret,
      elements: [el("a", 1, 5)],
    });

    const elements = await owner(t).query(api.collab.getRoomElements, { sceneId });
    expect(elements).not.toBeNull();
    expect(elements!.map((e) => e.elementId)).toEqual(["a"]);
    expect(elements![0].version).toBe(1);
  });

  it("an anonymous guest can join and edit via an enabled edit token", async () => {
    const t = setup();
    const sceneId = await seedScene(t);
    await seedEditShare(t, sceneId);
    await startRoom(t, sceneId);

    const guest = await t.mutation(api.collab.joinRoom, {
      sceneId,
      token: TOKEN,
      name: "Guest",
      color: "#00ff00",
    });
    expect(guest.roomSessionId).toBeTruthy();

    await t.mutation(api.collab.pushElements, {
      sceneId,
      token: TOKEN,
      roomSessionId: guest.roomSessionId,
      sessionSecret: guest.sessionSecret,
      elements: [el("b", 1, 3)],
    });

    const elements = await t.query(api.collab.getRoomElements, { sceneId, token: TOKEN });
    expect(elements!.map((e) => e.elementId)).toContain("b");
  });

  it("reconciles per element: higher version wins, ties break to lower nonce", async () => {
    const t = setup();
    const sceneId = await seedScene(t);
    await startRoom(t, sceneId);
    const join = await joinOwner(t, sceneId);
    const push = (elements: unknown[]) =>
      owner(t).mutation(api.collab.pushElements, {
        sceneId,
        roomSessionId: join.roomSessionId,
        sessionSecret: join.sessionSecret,
        elements,
      });

    await push([el("a", 1, 5)]);
    await push([el("a", 1, 9)]); // equal version, higher nonce -> rejected
    let stored = (await owner(t).query(api.collab.getRoomElements, { sceneId }))![0];
    expect(stored.versionNonce).toBe(5);

    await push([el("a", 1, 2)]); // equal version, lower nonce -> accepted
    stored = (await owner(t).query(api.collab.getRoomElements, { sceneId }))![0];
    expect(stored.versionNonce).toBe(2);

    await push([el("a", 2, 999)]); // higher version -> accepted
    stored = (await owner(t).query(api.collab.getRoomElements, { sceneId }))![0];
    expect(stored.version).toBe(2);
    expect(stored.versionNonce).toBe(999);
  });

  it("guest hydration claim is exclusive and seeds elements", async () => {
    const t = setup();
    const sceneId = await seedScene(t, { currentObjectKey: "key", contentHash: "hash-1" });
    await seedEditShare(t, sceneId);
    await startRoom(t, sceneId);

    const a = await t.mutation(api.collab.joinRoom, {
      sceneId,
      token: TOKEN,
      name: "A",
      color: "#111111",
    });
    const b = await t.mutation(api.collab.joinRoom, {
      sceneId,
      token: TOKEN,
      name: "B",
      color: "#222222",
    });
    expect(a.needsHydration).toBe(true);
    expect(b.needsHydration).toBe(false);

    const seeded = await t.mutation(api.collab.completeHydration, {
      sceneId,
      token: TOKEN,
      roomSessionId: a.roomSessionId,
      sessionSecret: a.sessionSecret,
      elements: [el("x", 3, 7), el("y", 1, 1)],
      contentHash: "hash-1",
    });
    expect(seeded.seeded).toBe(true);

    const elements = await t.query(api.collab.getRoomElements, { sceneId, token: TOKEN });
    expect(elements!.map((e) => e.elementId).sort()).toEqual(["x", "y"]);

    // Room is now ready -> a fresh joiner does not re-hydrate.
    const c = await t.mutation(api.collab.joinRoom, {
      sceneId,
      token: TOKEN,
      name: "C",
      color: "#333333",
    });
    expect(c.needsHydration).toBe(false);
  });

  it("revokes access reactively when the share is disabled", async () => {
    const t = setup();
    const sceneId = await seedScene(t);
    const shareId = await seedEditShare(t, sceneId);
    await startRoom(t, sceneId);
    const guest = await t.mutation(api.collab.joinRoom, {
      sceneId,
      token: TOKEN,
      name: "Guest",
      color: "#00ff00",
    });

    // Disable the share.
    await t.run(async (ctx) => ctx.db.patch(shareId, { enabled: false }));

    const view = await t.query(api.collab.getRoomView, { sceneId, token: TOKEN });
    expect(view.authorized).toBe(false);
    const elements = await t.query(api.collab.getRoomElements, { sceneId, token: TOKEN });
    expect(elements).toBeNull();
    await expect(
      t.mutation(api.collab.pushElements, {
        sceneId,
        token: TOKEN,
        roomSessionId: guest.roomSessionId,
        sessionSecret: guest.sessionSecret,
        elements: [el("z", 1, 1)],
      }),
    ).rejects.toThrow();
  });

  it("does not complete hydration after an edit share is revoked", async () => {
    const t = setup();
    const sceneId = await seedScene(t, { currentObjectKey: "key", contentHash: "hash-1" });
    const shareId = await seedEditShare(t, sceneId);
    await startRoom(t, sceneId);
    const guest = await t.mutation(api.collab.joinRoom, {
      sceneId,
      token: TOKEN,
      name: "Guest",
      color: "#00ff00",
    });

    await t.run(async (ctx) => ctx.db.patch(shareId, { enabled: false }));

    const seeded = await t.mutation(api.collab.completeHydration, {
      sceneId,
      token: TOKEN,
      roomSessionId: guest.roomSessionId,
      sessionSecret: guest.sessionSecret,
      elements: [el("x", 1, 1)],
      contentHash: "hash-1",
    });
    expect(seeded.seeded).toBe(false);
    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("roomElements")
        .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
        .collect(),
    );
    expect(rows).toHaveLength(0);
  });

  it("rejects a forged session secret", async () => {
    const t = setup();
    const sceneId = await seedScene(t);
    await startRoom(t, sceneId);
    const join = await joinOwner(t, sceneId);
    await expect(
      owner(t).mutation(api.collab.pushElements, {
        sceneId,
        roomSessionId: join.roomSessionId,
        sessionSecret: "not-the-secret",
        elements: [el("a", 1, 1)],
      }),
    ).rejects.toThrow();
  });

  it("records and reads presence", async () => {
    const t = setup();
    const sceneId = await seedScene(t);
    await startRoom(t, sceneId);
    const join = await joinOwner(t, sceneId);
    await owner(t).mutation(api.collab.updatePresence, {
      sceneId,
      roomSessionId: join.roomSessionId,
      sessionSecret: join.sessionSecret,
      name: "Owner",
      color: "#ff0000",
      cursorX: 12,
      cursorY: 34,
      button: "down",
      selectedIds: ["a"],
    });
    const presence = await owner(t).query(api.collab.getPresence, { sceneId });
    const mine = presence!.find((p) => p.roomSessionId === join.roomSessionId);
    expect(mine?.cursorX).toBe(12);
    expect(mine?.button).toBe("down");
    expect(mine?.selectedIds).toEqual(["a"]);
  });

  it("rate-limits a flood of pushes", async () => {
    const t = setup();
    const sceneId = await seedScene(t);
    await startRoom(t, sceneId);
    const join = await joinOwner(t, sceneId);
    let threw = false;
    for (let i = 0; i < 60; i += 1) {
      try {
        await owner(t).mutation(api.collab.pushElements, {
          sceneId,
          roomSessionId: join.roomSessionId,
          sessionSecret: join.sessionSecret,
          elements: [el("a", i + 1, i)],
        });
      } catch {
        threw = true;
        break;
      }
    }
    expect(threw).toBe(true);
  });

  it("requires a signed-in session and valid watermark to mark a room snapshot", async () => {
    const t = setup();
    const sceneId = await seedScene(t);
    await seedEditShare(t, sceneId);
    await startRoom(t, sceneId);
    const guest = await t.mutation(api.collab.joinRoom, {
      sceneId,
      token: TOKEN,
      name: "Guest",
      color: "#00ff00",
    });
    await expect(
      t.mutation(api.collab.markRoomSnapshot, {
        sceneId,
        token: TOKEN,
        roomSessionId: guest.roomSessionId,
        sessionSecret: guest.sessionSecret,
        snapshotHash: "guest",
        snapshotMaxUpdatedAt: 0,
      }),
    ).rejects.toThrow();

    const join = await joinOwner(t, sceneId);
    await owner(t).mutation(api.collab.pushElements, {
      sceneId,
      roomSessionId: join.roomSessionId,
      sessionSecret: join.sessionSecret,
      elements: [el("a", 1, 1)],
    });
    const [stored] = (await owner(t).query(api.collab.getRoomElements, { sceneId }))!;
    const uncommitted = await owner(t).mutation(api.collab.markRoomSnapshot, {
      sceneId,
      roomSessionId: join.roomSessionId,
      sessionSecret: join.sessionSecret,
      snapshotHash: "current",
      snapshotMaxUpdatedAt: stored.updatedAt,
    });
    expect(uncommitted).toEqual({ marked: false, reason: "uncommitted" });

    await t.run(async (ctx) => ctx.db.patch(sceneId, { contentHash: "current" }));
    await expect(
      owner(t).mutation(api.collab.markRoomSnapshot, {
        sceneId,
        roomSessionId: join.roomSessionId,
        sessionSecret: join.sessionSecret,
        snapshotHash: "current",
        snapshotMaxUpdatedAt: stored.updatedAt + 1,
      }),
    ).rejects.toThrow();

    const marked = await owner(t).mutation(api.collab.markRoomSnapshot, {
      sceneId,
      roomSessionId: join.roomSessionId,
      sessionSecret: join.sessionSecret,
      snapshotHash: "current",
      snapshotMaxUpdatedAt: stored.updatedAt,
    });
    expect(marked).toEqual({ marked: true, reason: null });
    const room = await t.run(async (ctx) =>
      ctx.db
        .query("liveRooms")
        .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
        .unique(),
    );
    expect(room?.snapshotHash).toBe("current");
    expect(room?.snapshotMaxUpdatedAt).toBe(stored.updatedAt);
  });

  it("only the room starter can stop the room", async () => {
    const t = setup();
    const sceneId = await seedScene(t);
    await seedEditShare(t, sceneId);
    await startRoom(t, sceneId);
    const guest = await t.mutation(api.collab.joinRoom, {
      sceneId,
      token: TOKEN,
      name: "Guest",
      color: "#00ff00",
    });

    await expect(
      t.mutation(api.collab.stopRoom, {
        sceneId,
        token: TOKEN,
        roomSessionId: guest.roomSessionId,
        sessionSecret: guest.sessionSecret,
      }),
    ).rejects.toThrow("Only the room starter can stop this room");

    const view = await owner(t).query(api.collab.getRoomView, { sceneId });
    expect(view.authorized).toBe(true);
    if (view.authorized) {
      expect(view.active).toBe(true);
    }
  });

  it("stops a clean room and removes live-only data", async () => {
    const t = setup();
    const sceneId = await seedScene(t);
    await startRoom(t, sceneId);
    const join = await joinOwner(t, sceneId);
    await owner(t).mutation(api.collab.pushElements, {
      sceneId,
      roomSessionId: join.roomSessionId,
      sessionSecret: join.sessionSecret,
      elements: [el("a", 1, 1)],
    });

    await expect(
      owner(t).mutation(api.collab.stopRoom, {
        sceneId,
        roomSessionId: join.roomSessionId,
        sessionSecret: join.sessionSecret,
      }),
    ).rejects.toThrow("Room has unsaved changes");

    await t.run(async (ctx) => ctx.db.patch(sceneId, { contentHash: "clean" }));
    await owner(t).mutation(api.collab.markRoomSnapshot, {
      sceneId,
      roomSessionId: join.roomSessionId,
      sessionSecret: join.sessionSecret,
      snapshotHash: "clean",
    });
    await owner(t).mutation(api.collab.stopRoom, {
      sceneId,
      roomSessionId: join.roomSessionId,
      sessionSecret: join.sessionSecret,
    });

    const view = await owner(t).query(api.collab.getRoomView, { sceneId });
    expect(view.authorized).toBe(true);
    if (view.authorized) {
      expect(view.active).toBe(false);
      expect(view.canStart).toBe(true);
    }
    expect(await owner(t).query(api.collab.getRoomElements, { sceneId })).toEqual([]);
    await expect(joinOwner(t, sceneId)).rejects.toThrow("Room has not been started");
  });

  it("deleting a scene removes its live collaboration rows", async () => {
    const t = setup();
    const sceneId = await seedScene(t);
    await startRoom(t, sceneId);
    const join = await joinOwner(t, sceneId);
    await owner(t).mutation(api.collab.pushElements, {
      sceneId,
      roomSessionId: join.roomSessionId,
      sessionSecret: join.sessionSecret,
      elements: [el("a", 1, 1)],
    });

    await owner(t).mutation(api.library.deleteScene, { sceneId });

    const leftovers = await t.run(async (ctx) => {
      const [rooms, elements, sessions, presence, limits] = await Promise.all([
        ctx.db
          .query("liveRooms")
          .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
          .collect(),
        ctx.db
          .query("roomElements")
          .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
          .collect(),
        ctx.db
          .query("roomSessions")
          .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
          .collect(),
        ctx.db
          .query("presence")
          .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
          .collect(),
        ctx.db
          .query("collabRateLimits")
          .withIndex("by_key", (q) => q.eq("sceneId", sceneId))
          .collect(),
      ]);
      return { rooms, elements, sessions, presence, limits };
    });
    expect(leftovers.rooms).toHaveLength(0);
    expect(leftovers.elements).toHaveLength(0);
    expect(leftovers.sessions).toHaveLength(0);
    expect(leftovers.presence).toHaveLength(0);
    expect(leftovers.limits).toHaveLength(0);
  });

  it("sweep GCs a clean, idle room but keeps a dirty one", async () => {
    const t = setup();

    // Clean room: snapshot marked current, presence aged out -> collected.
    const cleanScene = await seedScene(t);
    await startRoom(t, cleanScene);
    const cleanJoin = await joinOwner(t, cleanScene);
    await owner(t).mutation(api.collab.pushElements, {
      sceneId: cleanScene,
      roomSessionId: cleanJoin.roomSessionId,
      sessionSecret: cleanJoin.sessionSecret,
      elements: [el("a", 1, 1)],
    });
    await t.run(async (ctx) => ctx.db.patch(cleanScene, { contentHash: "h" }));
    await owner(t).mutation(api.collab.markRoomSnapshot, {
      sceneId: cleanScene,
      roomSessionId: cleanJoin.roomSessionId,
      sessionSecret: cleanJoin.sessionSecret,
      snapshotHash: "h",
      snapshotMaxUpdatedAt: (
        await owner(t).query(api.collab.getRoomElements, { sceneId: cleanScene })
      )![0].updatedAt,
    });

    // Dirty room: never snapshotted.
    const dirtyScene = await seedScene(t);
    await startRoom(t, dirtyScene);
    const dirtyJoin = await joinOwner(t, dirtyScene);
    await owner(t).mutation(api.collab.pushElements, {
      sceneId: dirtyScene,
      roomSessionId: dirtyJoin.roomSessionId,
      sessionSecret: dirtyJoin.sessionSecret,
      elements: [el("b", 1, 1)],
    });

    // Age all presence well past the TTL + idle grace.
    const old = Date.now() - (PRESENCE_TTL_MS + ROOM_IDLE_GRACE_MS + 5_000);
    await t.run(async (ctx) => {
      for (const p of await ctx.db.query("presence").collect()) {
        await ctx.db.patch(p._id, { lastSeenAt: old });
      }
    });

    await t.mutation(internal.collab.sweep, {});

    const rooms = await t.run(async (ctx) => ctx.db.query("liveRooms").collect());
    const sceneIds = rooms.map((r) => r.sceneId);
    expect(sceneIds).toContain(dirtyScene);
    expect(sceneIds).not.toContain(cleanScene);

    const cleanElements = await t.run(async (ctx) =>
      ctx.db
        .query("roomElements")
        .withIndex("by_scene", (q) => q.eq("sceneId", cleanScene as never))
        .collect(),
    );
    expect(cleanElements).toHaveLength(0);
  });
});
