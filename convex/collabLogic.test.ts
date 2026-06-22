import { describe, expect, it } from "vitest";

import {
  buildCollaboratorEntries,
  consumeToken,
  diffElementsForBroadcast,
  extractRoomElement,
  incomingElementWins,
  isHydrationClaimStale,
  isPresenceActive,
  isSnapshotter,
  MAX_BATCH_ELEMENTS,
  MAX_ELEMENT_BYTES,
  RATE_LIMITS,
  roomIsCollectable,
  roomIsDirty,
  sanitizeColor,
  sanitizeName,
  sanitizeSelectedIds,
  validateElementBatch,
  type ElementVersion,
} from "./collabLogic";

describe("incomingElementWins", () => {
  it("accepts when there is no stored element", () => {
    expect(incomingElementWins({ version: 1, versionNonce: 1 }, null)).toBe(
      true,
    );
  });
  it("prefers higher version", () => {
    expect(
      incomingElementWins(
        { version: 2, versionNonce: 9 },
        { version: 1, versionNonce: 1 },
      ),
    ).toBe(true);
    expect(
      incomingElementWins(
        { version: 1, versionNonce: 1 },
        { version: 2, versionNonce: 9 },
      ),
    ).toBe(false);
  });
  it("breaks version ties by lower nonce (matches Excalidraw)", () => {
    expect(
      incomingElementWins(
        { version: 1, versionNonce: 2 },
        { version: 1, versionNonce: 5 },
      ),
    ).toBe(true);
    expect(
      incomingElementWins(
        { version: 1, versionNonce: 5 },
        { version: 1, versionNonce: 2 },
      ),
    ).toBe(false);
  });
  it("treats identical version+nonce as no-op", () => {
    expect(
      incomingElementWins(
        { version: 1, versionNonce: 5 },
        { version: 1, versionNonce: 5 },
      ),
    ).toBe(false);
  });
});

describe("extractRoomElement", () => {
  it("pulls id/version/nonce and defaults a missing nonce", () => {
    expect(
      extractRoomElement({ id: "a", version: 3, versionNonce: 7 }),
    ).toEqual({
      elementId: "a",
      data: { id: "a", version: 3, versionNonce: 7 },
      version: 3,
      versionNonce: 7,
    });
    expect(extractRoomElement({ id: "a", version: 3 })?.versionNonce).toBe(0);
  });
  it("rejects malformed elements", () => {
    expect(extractRoomElement(null)).toBeNull();
    expect(extractRoomElement({ version: 1 })).toBeNull();
    expect(extractRoomElement({ id: "a" })).toBeNull();
    expect(extractRoomElement({ id: "", version: 1 })).toBeNull();
  });
});

describe("validateElementBatch", () => {
  it("normalizes a valid batch", () => {
    const result = validateElementBatch([
      { id: "a", version: 1, versionNonce: 2 },
    ]);
    expect(result.ok).toBe(true);
  });
  it("rejects non-arrays and oversized batches", () => {
    expect(validateElementBatch("nope").ok).toBe(false);
    const tooMany = Array.from({ length: MAX_BATCH_ELEMENTS + 1 }, (_, i) => ({
      id: `e${i}`,
      version: 1,
      versionNonce: 1,
    }));
    expect(validateElementBatch(tooMany).ok).toBe(false);
  });
  it("rejects elements that exceed the byte cap", () => {
    const big = {
      id: "a",
      version: 1,
      versionNonce: 1,
      blob: "x".repeat(MAX_ELEMENT_BYTES),
    };
    expect(validateElementBatch([big]).ok).toBe(false);
  });
});

describe("presence sanitization", () => {
  it("clamps and falls back names", () => {
    expect(sanitizeName("  Sara  ")).toBe("Sara");
    expect(sanitizeName("")).toBe("Guest");
    expect(sanitizeName(123)).toBe("Guest");
    expect(sanitizeName("x".repeat(100)).length).toBe(40);
  });
  it("validates hex colors", () => {
    expect(sanitizeColor("#abc")).toBe("#abc");
    expect(sanitizeColor("#aabbcc")).toBe("#aabbcc");
    expect(sanitizeColor("red")).toBe("#6b7280");
    expect(sanitizeColor(null)).toBe("#6b7280");
  });
  it("filters selected ids", () => {
    expect(sanitizeSelectedIds(["a", "", 5, "b"])).toEqual(["a", "b"]);
    expect(sanitizeSelectedIds("nope")).toEqual([]);
  });
});

describe("isPresenceActive", () => {
  it("uses the TTL window", () => {
    expect(isPresenceActive(1000, 1500)).toBe(true);
    expect(isPresenceActive(1000, 1000 + 60_000)).toBe(false);
  });
});

describe("consumeToken (rate limit)", () => {
  it("allows a burst up to capacity then blocks", () => {
    const config = RATE_LIMITS.pushElements;
    let state: { tokens: number; updatedAt: number } | null = null;
    let allowedCount = 0;
    for (let i = 0; i < config.capacity + 5; i += 1) {
      const result = consumeToken(state, 1000, config); // same instant: no refill
      if (result.allowed) {
        allowedCount += 1;
      }
      state = { tokens: result.tokens, updatedAt: result.updatedAt };
    }
    expect(allowedCount).toBe(config.capacity);
  });
  it("refills over time", () => {
    const config = RATE_LIMITS.pushElements;
    // Drain.
    const state = { tokens: 0, updatedAt: 1000 };
    const blocked = consumeToken(state, 1000, config);
    expect(blocked.allowed).toBe(false);
    // One second later we should have refilled ~ratePerSec tokens.
    const later = consumeToken(state, 1000 + 1000, config);
    expect(later.allowed).toBe(true);
  });
});

describe("snapshotter election", () => {
  it("elects the lexicographically smallest active session", () => {
    expect(isSnapshotter("a", ["a", "b", "c"])).toBe(true);
    expect(isSnapshotter("b", ["a", "b", "c"])).toBe(false);
    expect(isSnapshotter("a", [])).toBe(false);
  });
});

describe("hydration + GC decisions", () => {
  it("flags stale hydration claims", () => {
    expect(isHydrationClaimStale(null, 1000)).toBe(true);
    expect(isHydrationClaimStale(1000, 1000 + 1000)).toBe(false);
    expect(isHydrationClaimStale(1000, 1000 + 60_000)).toBe(true);
  });
  it("computes dirtiness", () => {
    expect(roomIsDirty(null, null)).toBe(false);
    expect(roomIsDirty(100, null)).toBe(true);
    expect(roomIsDirty(100, 100)).toBe(false);
    expect(roomIsDirty(200, 100)).toBe(true);
  });
  it("only collects clean, idle, empty rooms", () => {
    const now = 1_000_000;
    // Active presence -> never.
    expect(
      roomIsCollectable({
        hasActivePresence: true,
        lastPresenceAt: now,
        now,
        maxElementUpdatedAt: 1,
        snapshotMaxUpdatedAt: 1,
      }),
    ).toBe(false);
    // Recently idle -> wait.
    expect(
      roomIsCollectable({
        hasActivePresence: false,
        lastPresenceAt: now - 1000,
        now,
        maxElementUpdatedAt: 1,
        snapshotMaxUpdatedAt: 1,
      }),
    ).toBe(false);
    // Idle past grace but dirty -> keep.
    expect(
      roomIsCollectable({
        hasActivePresence: false,
        lastPresenceAt: now - 5_000_000,
        now,
        maxElementUpdatedAt: 5,
        snapshotMaxUpdatedAt: 1,
      }),
    ).toBe(false);
    // Idle past grace and clean -> collect.
    expect(
      roomIsCollectable({
        hasActivePresence: false,
        lastPresenceAt: now - 5_000_000,
        now,
        maxElementUpdatedAt: 5,
        snapshotMaxUpdatedAt: 5,
      }),
    ).toBe(true);
  });
});

describe("buildCollaboratorEntries", () => {
  it("excludes self and maps cursors + selections", () => {
    const entries = buildCollaboratorEntries(
      [
        {
          roomSessionId: "me",
          name: "Me",
          color: "#111",
          cursorX: 0,
          cursorY: 0,
          button: "up",
          selectedIds: [],
        },
        {
          roomSessionId: "them",
          name: "Them",
          color: "#222",
          cursorX: 5,
          cursorY: 6,
          button: "down",
          selectedIds: ["x"],
        },
        {
          roomSessionId: "nocursor",
          name: "Idle",
          color: "#333",
          cursorX: null,
          cursorY: null,
          button: "up",
          selectedIds: [],
        },
      ],
      "me",
    );
    expect(entries.map((e) => e.id)).toEqual(["them", "nocursor"]);
    const them = entries[0];
    expect(them.pointer).toEqual({ x: 5, y: 6, tool: "pointer" });
    expect(them.selectedElementIds).toEqual({ x: true });
    expect(entries[1].pointer).toBeUndefined();
  });
});

describe("diffElementsForBroadcast", () => {
  it("returns only elements that advanced versus the known map", () => {
    const known = new Map<string, ElementVersion>([
      ["a", { version: 2, versionNonce: 1 }],
    ]);
    const changed = diffElementsForBroadcast(
      [
        { id: "a", version: 2, versionNonce: 1 }, // unchanged
        { id: "a2", version: 3, versionNonce: 1 }, // already? no, new id -> changed
        { id: "b", version: 1, versionNonce: 1 }, // new
      ],
      known,
    );
    expect(changed.map((e) => e.id)).toEqual(["a2", "b"]);
  });
});
