import { describe, expect, it } from "vitest";

import { COLLAB_COLORS, colorForId, guestNameForId, hashString } from "./colors";

describe("collab colors", () => {
  it("hashString is deterministic and non-negative", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("abc")).toBeGreaterThanOrEqual(0);
    expect(hashString("abc")).not.toBe(hashString("abd"));
  });

  it("colorForId returns a palette color deterministically", () => {
    const color = colorForId("user-123");
    expect(COLLAB_COLORS).toContain(color);
    expect(colorForId("user-123")).toBe(color);
  });

  it("guestNameForId returns a stable two-word name", () => {
    const name = guestNameForId("seed-9");
    expect(name.split(" ")).toHaveLength(2);
    expect(guestNameForId("seed-9")).toBe(name);
  });
});
