import { describe, expect, it } from "vitest";

import {
  buildSceneObjectKey,
  buildSceneThumbnailObjectKey,
  isSceneObjectKeyForProfile,
  isSceneThumbnailObjectKeyForProfile,
} from "@/lib/r2";

describe("R2 object keys", () => {
  it("scopes scene bundles under the owning user", () => {
    expect(buildSceneObjectKey("user_123", "scene_456")).toBe(
      "users/user_123/scenes/scene_456/head/excalidraw.json",
    );
  });

  it("scopes scene thumbnails under the owning user", () => {
    expect(buildSceneThumbnailObjectKey("user_123", "scene_456")).toBe(
      "users/user_123/scenes/scene_456/head/thumbnail.png",
    );
  });

  it("validates object keys against the exact profile and scene", () => {
    expect(
      isSceneObjectKeyForProfile({
        profileId: "user_123",
        sceneId: "scene_456",
        key: "users/user_123/scenes/scene_456/head/excalidraw.json",
      }),
    ).toBe(true);
    expect(
      isSceneObjectKeyForProfile({
        profileId: "user_123",
        sceneId: "scene_456",
        key: "users/user_999/scenes/scene_456/head/excalidraw.json",
      }),
    ).toBe(false);
  });

  it("validates thumbnail keys against the exact profile and scene", () => {
    expect(
      isSceneThumbnailObjectKeyForProfile({
        profileId: "user_123",
        sceneId: "scene_456",
        key: "users/user_123/scenes/scene_456/head/thumbnail.png",
      }),
    ).toBe(true);
    expect(
      isSceneThumbnailObjectKeyForProfile({
        profileId: "user_123",
        sceneId: "scene_456",
        key: "users/user_123/scenes/scene_789/head/thumbnail.png",
      }),
    ).toBe(false);
  });
});
