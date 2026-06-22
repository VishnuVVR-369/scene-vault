import { colorForId, guestNameForId } from "./colors";

// Collaborator identity. Signed-in users derive name/color from Clerk; guests
// get a per-tab seed (sessionStorage) and an editable name/color (localStorage).

export type CollabIdentity = { name: string; color: string };

const SEED_KEY = "scenevault:collab-seed";
const GUEST_NAME_KEY = "scenevault:collab-guest-name";
const GUEST_COLOR_KEY = "scenevault:collab-guest-color";

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `seed-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function readStorage(storage: "session" | "local", key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return (
      storage === "session" ? window.sessionStorage : window.localStorage
    ).getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(
  storage: "session" | "local",
  key: string,
  value: string,
) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    (storage === "session"
      ? window.sessionStorage
      : window.localStorage
    ).setItem(key, value);
  } catch {
    // ignore (private mode / disabled storage)
  }
}

/** Stable per-tab seed, used to derive a default guest name + color. */
export function getCollabSeed(): string {
  const existing = readStorage("session", SEED_KEY);
  if (existing) {
    return existing;
  }
  const seed = randomId();
  writeStorage("session", SEED_KEY, seed);
  return seed;
}

export function loadGuestIdentity(): CollabIdentity {
  const seed = getCollabSeed();
  return {
    name: readStorage("local", GUEST_NAME_KEY) ?? guestNameForId(seed),
    color: readStorage("local", GUEST_COLOR_KEY) ?? colorForId(seed),
  };
}

export function saveGuestIdentity(identity: CollabIdentity) {
  writeStorage("local", GUEST_NAME_KEY, identity.name);
  writeStorage("local", GUEST_COLOR_KEY, identity.color);
}
