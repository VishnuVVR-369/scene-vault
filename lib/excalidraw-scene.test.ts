import { describe, expect, it } from "vitest";

import {
  normalizeSceneBundle,
  sceneContentSignature,
} from "@/lib/excalidraw-scene";

const baseBundle = {
  type: "excalidraw" as const,
  version: 2,
  source: "scenevault",
  elements: [],
  appState: { viewBackgroundColor: "#ffffff" },
  files: {},
};

describe("Excalidraw scene normalization", () => {
  it("removes JSON-loaded collaborators app state", () => {
    const bundle = normalizeSceneBundle({
      type: "excalidraw",
      version: 2,
      source: "scenevault",
      elements: [],
      appState: {
        collaborators: {},
        viewBackgroundColor: "#ffffff",
      },
      files: {},
    });

    expect(bundle.appState).toEqual({ viewBackgroundColor: "#ffffff" });
  });

  it("removes Map collaborators before serialization", () => {
    const bundle = normalizeSceneBundle({
      type: "excalidraw",
      version: 2,
      source: "scenevault",
      elements: [],
      appState: {
        collaborators: new Map([["user_1", { username: "Vishnu" }]]),
        viewBackgroundColor: "#ffffff",
      },
      files: {},
    });

    expect(bundle.appState).not.toHaveProperty("collaborators");
    expect(JSON.parse(JSON.stringify(bundle)).appState).not.toHaveProperty(
      "collaborators",
    );
  });

  it("strips ephemeral view/interaction app state but keeps persistent fields", () => {
    const bundle = normalizeSceneBundle({
      ...baseBundle,
      appState: {
        viewBackgroundColor: "#ffffff",
        scrollX: 120,
        scrollY: -40,
        zoom: { value: 2 },
        selectedElementIds: { abc: true },
        cursorButton: "down",
        openMenu: "canvas",
      },
    });

    expect(bundle.appState).toEqual({ viewBackgroundColor: "#ffffff" });
  });
});

describe("Scene content signature", () => {
  it("ignores cosmetic-only app state changes (no redundant save)", () => {
    const a = normalizeSceneBundle({
      ...baseBundle,
      appState: {
        viewBackgroundColor: "#ffffff",
        scrollX: 0,
        zoom: { value: 1 },
      },
    });
    const b = normalizeSceneBundle({
      ...baseBundle,
      appState: {
        viewBackgroundColor: "#ffffff",
        scrollX: 999,
        zoom: { value: 4 },
      },
    });

    expect(sceneContentSignature(a)).toBe(sceneContentSignature(b));
  });

  it("changes when real content changes", () => {
    const empty = normalizeSceneBundle(baseBundle);
    const withBackground = normalizeSceneBundle({
      ...baseBundle,
      appState: { viewBackgroundColor: "#000000" },
    });

    expect(sceneContentSignature(empty)).not.toBe(
      sceneContentSignature(withBackground),
    );
  });
});
