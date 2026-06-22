// Pure, dependency-free logic shared by the Convex collab functions and unit
// tests. It must not import Convex, React, or any runtime-specific module so it
// can run identically on the server, in the browser, and under vitest.

// ---------------------------------------------------------------------------
// Caps & timings
// ---------------------------------------------------------------------------

/** Max elements accepted in a single pushElements / completeHydration batch. */
export const MAX_BATCH_ELEMENTS = 256;
/** Max serialized bytes for a single element (binary image data lives in R2). */
export const MAX_ELEMENT_BYTES = 128 * 1024;
/** Above this element count live mode is disabled and we fall back to single-user save. */
export const MAX_ELEMENTS_PER_SCENE = 10_000;
/** Hard cap on simultaneously tracked room sessions. Stale rows are swept by TTL. */
export const MAX_SESSIONS_PER_ROOM = 64;
/** Max ids reported in a presence selection. */
export const MAX_SELECTED_IDS = 1_000;
export const MAX_NAME_LENGTH = 40;
export const MAX_ELEMENT_ID_LENGTH = 255;

/** A presence row older than this is considered offline. */
export const PRESENCE_TTL_MS = 15_000;
/** Client heartbeat cadence; comfortably under PRESENCE_TTL_MS. */
export const HEARTBEAT_INTERVAL_MS = 5_000;
/** Client cursor throttle (~10/s). */
export const CURSOR_THROTTLE_MS = 100;
/** Client element-broadcast debounce. */
export const ELEMENT_FLUSH_MS = 250;
/** Client snapshot-to-R2 debounce. */
export const SNAPSHOT_DEBOUNCE_MS = 4_000;

/** A hydration claim older than this can be re-claimed (the claimer vanished). */
export const HYDRATION_TIMEOUT_MS = 15_000;
/** A room with no presence for this long is eligible for GC (if snapshot is current). */
export const ROOM_IDLE_GRACE_MS = 60_000;

// ---------------------------------------------------------------------------
// Element reconciliation (mirrors Excalidraw's reconcileElements tie-breaks)
// ---------------------------------------------------------------------------

export type ElementVersion = { version: number; versionNonce: number };

/**
 * Whether `incoming` should replace `stored` under Excalidraw's rule:
 * higher `version` wins; on a tie the LOWER `versionNonce` wins. Identical
 * (version + nonce) means no change. Matches `@excalidraw/excalidraw`'s
 * `shouldDiscardRemoteElement` so the server stays convergent with clients.
 */
export function incomingElementWins(
  incoming: ElementVersion,
  stored: ElementVersion | null | undefined,
): boolean {
  if (!stored) {
    return true;
  }
  if (incoming.version !== stored.version) {
    return incoming.version > stored.version;
  }
  if (incoming.versionNonce !== stored.versionNonce) {
    return incoming.versionNonce < stored.versionNonce;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Element validation
// ---------------------------------------------------------------------------

export type RoomElementInput = {
  elementId: string;
  data: unknown;
  version: number;
  versionNonce: number;
};

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/** Pull a normalized {elementId, version, versionNonce, data} from a raw element. */
export function extractRoomElement(element: unknown): RoomElementInput | null {
  if (typeof element !== "object" || element === null) {
    return null;
  }
  const record = element as Record<string, unknown>;
  const id = record.id;
  const version = record.version;
  const versionNonce = record.versionNonce;
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }
  if (typeof version !== "number" || !Number.isFinite(version)) {
    return null;
  }
  // versionNonce can be absent on freshly hand-built elements; default to 0 so
  // tie-breaks are still deterministic.
  const nonce =
    typeof versionNonce === "number" && Number.isFinite(versionNonce)
      ? versionNonce
      : 0;
  return { elementId: id, data: element, version, versionNonce: nonce };
}

export function validateRoomElement(input: RoomElementInput): ValidationResult {
  if (input.elementId.length > MAX_ELEMENT_ID_LENGTH) {
    return { ok: false, reason: "element id too long" };
  }
  if (!Number.isFinite(input.version) || input.version < 0) {
    return { ok: false, reason: "invalid element version" };
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(input.data);
  } catch {
    return { ok: false, reason: "element not serializable" };
  }
  if (serialized === undefined) {
    return { ok: false, reason: "element not serializable" };
  }
  if (byteLength(serialized) > MAX_ELEMENT_BYTES) {
    return { ok: false, reason: "element too large" };
  }
  return { ok: true };
}

/** Validate and normalize a batch of raw elements; rejects oversized batches. */
export function validateElementBatch(
  elements: unknown,
  maxCount: number = MAX_BATCH_ELEMENTS,
): { ok: true; elements: RoomElementInput[] } | { ok: false; reason: string } {
  if (!Array.isArray(elements)) {
    return { ok: false, reason: "elements must be an array" };
  }
  if (elements.length > maxCount) {
    return { ok: false, reason: "too many elements in one batch" };
  }
  const normalized: RoomElementInput[] = [];
  for (const raw of elements) {
    const extracted = extractRoomElement(raw);
    if (!extracted) {
      return { ok: false, reason: "malformed element" };
    }
    const result = validateRoomElement(extracted);
    if (!result.ok) {
      return result;
    }
    normalized.push(extracted);
  }
  return { ok: true, elements: normalized };
}

// ---------------------------------------------------------------------------
// Presence sanitization
// ---------------------------------------------------------------------------

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const FALLBACK_COLOR = "#6b7280";

export function sanitizeName(name: unknown): string {
  if (typeof name !== "string") {
    return "Guest";
  }
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : "Guest";
}

export function sanitizeColor(color: unknown): string {
  if (typeof color === "string" && HEX_COLOR.test(color.trim())) {
    return color.trim();
  }
  return FALLBACK_COLOR;
}

export function sanitizeSelectedIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }
  const out: string[] = [];
  for (const id of ids) {
    if (
      typeof id === "string" &&
      id.length > 0 &&
      id.length <= MAX_ELEMENT_ID_LENGTH
    ) {
      out.push(id);
    }
    if (out.length >= MAX_SELECTED_IDS) {
      break;
    }
  }
  return out;
}

export function isPresenceActive(lastSeenAt: number, now: number): boolean {
  return now - lastSeenAt < PRESENCE_TTL_MS;
}

// ---------------------------------------------------------------------------
// Token-bucket rate limiting (per session + action)
// ---------------------------------------------------------------------------

export type RateLimitConfig = { ratePerSec: number; capacity: number };

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  joinRoom: { ratePerSec: 2, capacity: 12 },
  pushElements: { ratePerSec: 12, capacity: 24 },
  updatePresence: { ratePerSec: 20, capacity: 40 },
};

export type BucketState = { tokens: number; updatedAt: number } | null;

/**
 * Attempt to consume one token. Returns whether the action is allowed plus the
 * next bucket state to persist. Refills continuously at `ratePerSec` up to
 * `capacity`.
 */
export function consumeToken(
  prev: BucketState,
  now: number,
  config: RateLimitConfig,
): { allowed: boolean; tokens: number; updatedAt: number } {
  const prevTokens = prev ? prev.tokens : config.capacity;
  const prevAt = prev ? prev.updatedAt : now;
  const elapsedSec = Math.max(0, now - prevAt) / 1000;
  const refilled = Math.min(
    config.capacity,
    prevTokens + elapsedSec * config.ratePerSec,
  );
  if (refilled < 1) {
    return { allowed: false, tokens: refilled, updatedAt: now };
  }
  return { allowed: true, tokens: refilled - 1, updatedAt: now };
}

// ---------------------------------------------------------------------------
// Snapshotter election & room GC
// ---------------------------------------------------------------------------

/**
 * The single client responsible for snapshotting the live room to R2 — the
 * lexicographically smallest active session id. Derived reactively on the
 * client from presence, so it needs no server-side election state and
 * re-elects automatically when that client leaves.
 */
export function isSnapshotter(
  mySessionId: string,
  activeSessionIds: string[],
): boolean {
  if (activeSessionIds.length === 0) {
    return false;
  }
  let min = activeSessionIds[0];
  for (const id of activeSessionIds) {
    if (id < min) {
      min = id;
    }
  }
  return mySessionId === min;
}

export function isHydrationClaimStale(
  startedAt: number | null,
  now: number,
): boolean {
  if (startedAt === null) {
    return true;
  }
  return now - startedAt > HYDRATION_TIMEOUT_MS;
}

/**
 * Whether the live working set has edits newer than the last R2 snapshot. A
 * dirty room must never be garbage-collected — that is what guarantees no edit
 * is lost if every browser disconnects before snapshotting.
 */
export function roomIsDirty(
  maxElementUpdatedAt: number | null,
  snapshotMaxUpdatedAt: number | null,
): boolean {
  if (maxElementUpdatedAt === null) {
    return false;
  }
  if (snapshotMaxUpdatedAt === null) {
    return true;
  }
  return maxElementUpdatedAt > snapshotMaxUpdatedAt;
}

/** A room is GC-eligible when nobody is present (past grace) and it isn't dirty. */
export function roomIsCollectable(args: {
  hasActivePresence: boolean;
  lastPresenceAt: number | null;
  now: number;
  maxElementUpdatedAt: number | null;
  snapshotMaxUpdatedAt: number | null;
}): boolean {
  if (args.hasActivePresence) {
    return false;
  }
  if (
    args.lastPresenceAt !== null &&
    args.now - args.lastPresenceAt < ROOM_IDLE_GRACE_MS
  ) {
    return false;
  }
  return !roomIsDirty(args.maxElementUpdatedAt, args.snapshotMaxUpdatedAt);
}

// ---------------------------------------------------------------------------
// Collaborator cursors (for Excalidraw updateScene({ collaborators }))
// ---------------------------------------------------------------------------

export type PresenceRow = {
  roomSessionId: string;
  name: string;
  color: string;
  cursorX: number | null;
  cursorY: number | null;
  button: "up" | "down";
  selectedIds: string[];
};

export type CollaboratorEntry = {
  id: string;
  username: string;
  color: { background: string; stroke: string };
  pointer?: { x: number; y: number; tool: "pointer" | "laser" };
  button: "up" | "down";
  selectedElementIds: Record<string, true>;
};

/**
 * Build the entries Excalidraw renders as remote cursors/selections, excluding
 * our own session and any rows without a known cursor position.
 */
export function buildCollaboratorEntries(
  rows: PresenceRow[],
  selfSessionId: string,
): CollaboratorEntry[] {
  const entries: CollaboratorEntry[] = [];
  for (const row of rows) {
    if (row.roomSessionId === selfSessionId) {
      continue;
    }
    const selectedElementIds: Record<string, true> = {};
    for (const id of row.selectedIds) {
      selectedElementIds[id] = true;
    }
    entries.push({
      id: row.roomSessionId,
      username: row.name,
      color: { background: row.color, stroke: row.color },
      ...(row.cursorX !== null && row.cursorY !== null
        ? {
            pointer: {
              x: row.cursorX,
              y: row.cursorY,
              tool: "pointer" as const,
            },
          }
        : {}),
      button: row.button,
      selectedElementIds,
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Broadcast diffing (client → server): only send elements that advanced
// ---------------------------------------------------------------------------

/**
 * Given the current elements and the last version we broadcast/applied per id,
 * return the elements whose version advanced (or that we've never seen). Used to
 * send minimal deltas and — because applied remote elements are also recorded —
 * to avoid re-broadcasting changes that originated remotely.
 */
export function diffElementsForBroadcast(
  elements: ReadonlyArray<Record<string, unknown>>,
  known: Map<string, ElementVersion>,
): Array<Record<string, unknown>> {
  const changed: Array<Record<string, unknown>> = [];
  for (const element of elements) {
    const extracted = extractRoomElement(element);
    if (!extracted) {
      continue;
    }
    const prev = known.get(extracted.elementId);
    if (!prev || incomingElementWins(extracted, prev)) {
      changed.push(element);
    }
  }
  return changed;
}
