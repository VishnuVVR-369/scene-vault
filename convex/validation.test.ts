import { describe, expect, it } from "vitest";

import {
  commitSharedSceneSaveArgsSchema,
  setSceneShareEnabledArgsSchema,
  shareTokenSchema,
} from "./validation";

describe("share validation", () => {
  it("accepts opaque base-url-safe share tokens", () => {
    expect(shareTokenSchema.parse("a".repeat(48))).toBe("a".repeat(48));
    expect(shareTokenSchema.parse("abc_DEF-123_45678901234567890")).toBe(
      "abc_DEF-123_45678901234567890",
    );
  });

  it("rejects short or unsafe share tokens", () => {
    expect(() => shareTokenSchema.parse("short")).toThrow();
    expect(() => shareTokenSchema.parse("has/slash".padEnd(24, "x"))).toThrow();
    expect(() => shareTokenSchema.parse("has space".padEnd(24, "x"))).toThrow();
  });

  it("limits share modes to view and edit", () => {
    expect(
      setSceneShareEnabledArgsSchema.parse({
        sceneId: "scene_1",
        mode: "view",
        enabled: true,
      }),
    ).toMatchObject({ mode: "view", enabled: true });
    expect(() =>
      setSceneShareEnabledArgsSchema.parse({
        sceneId: "scene_1",
        mode: "owner",
        enabled: true,
      }),
    ).toThrow();
  });

  it("validates shared commits without requiring a scene id from the client", () => {
    expect(
      commitSharedSceneSaveArgsSchema.parse({
        token: "a".repeat(48),
        objectKey: "users/owner/scenes/scene/head/excalidraw.json",
        byteSize: 123,
        contentHash: "hash",
        thumbnailObjectKey: null,
      }),
    ).toMatchObject({ byteSize: 123, thumbnailObjectKey: null });
  });
});
