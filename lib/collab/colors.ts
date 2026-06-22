// Deterministic display names and cursor colors for collaborators. Pure and
// dependency-free so it can be unit-tested and shared between client and tests.

export const COLLAB_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
] as const;

const ADJECTIVES = [
  "Swift",
  "Bright",
  "Calm",
  "Bold",
  "Clever",
  "Brave",
  "Quiet",
  "Lucky",
  "Merry",
  "Keen",
  "Witty",
  "Gentle",
];

const ANIMALS = [
  "Otter",
  "Falcon",
  "Panda",
  "Fox",
  "Heron",
  "Lynx",
  "Wren",
  "Bison",
  "Koala",
  "Moth",
  "Crane",
  "Ibex",
];

/** Small stable string hash (FNV-1a style), always non-negative. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function colorForId(id: string): string {
  return COLLAB_COLORS[hashString(id) % COLLAB_COLORS.length];
}

export function guestNameForId(id: string): string {
  const h = hashString(id);
  const adjective = ADJECTIVES[h % ADJECTIVES.length];
  const animal = ANIMALS[Math.floor(h / ADJECTIVES.length) % ANIMALS.length];
  return `${adjective} ${animal}`;
}
