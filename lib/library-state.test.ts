import { describe, expect, it } from "vitest";

import {
  createFolder,
  createInitialLibraryState,
  createScene,
  deleteFolder,
  duplicateScene,
  filterScenes,
  getFolderPath,
  moveFolder,
  saveSceneBundle,
} from "@/lib/library-state";

describe("library state", () => {
  it("creates nested folders and resolves folder paths", () => {
    let state = createInitialLibraryState("user_1");
    state = createFolder(
      state,
      { name: "Product", parentFolderId: null },
      { id: "f1", now: 1 },
    );
    state = createFolder(
      state,
      { name: "Auth", parentFolderId: "f1" },
      { id: "f2", now: 2 },
    );

    expect(getFolderPath(state, "f2")).toEqual(["Product", "Auth"]);
  });

  it("prevents moving a folder into one of its descendants", () => {
    let state = createInitialLibraryState("user_1");
    state = createFolder(
      state,
      { name: "A", parentFolderId: null },
      { id: "a", now: 1 },
    );
    state = createFolder(
      state,
      { name: "B", parentFolderId: "a" },
      { id: "b", now: 2 },
    );

    expect(() => moveFolder(state, { id: "a", parentFolderId: "b" })).toThrow(
      "descendants",
    );
  });

  it("permanently deletes nested folders and scenes", () => {
    let state = createInitialLibraryState("user_1");
    state = createFolder(
      state,
      { name: "A", parentFolderId: null },
      { id: "a", now: 1 },
    );
    state = createFolder(
      state,
      { name: "B", parentFolderId: "a" },
      { id: "b", now: 2 },
    );
    state = createScene(
      state,
      { title: "Diagram", folderId: "b" },
      { id: "s1", now: 3 },
    );

    state = deleteFolder(state, "a");

    expect(state.folders).toHaveLength(0);
    expect(state.scenes).toHaveLength(0);
    expect(state.bundles.s1).toBeUndefined();
  });

  it("searches only scene titles and folder paths", () => {
    let state = createInitialLibraryState("user_1");
    state = createFolder(
      state,
      { name: "Hiring", parentFolderId: null },
      { id: "f1", now: 1 },
    );
    state = createScene(
      state,
      { title: "Onboarding", folderId: "f1" },
      { id: "s1", now: 2 },
    );
    state = createScene(
      state,
      { title: "Roadmap", folderId: null },
      { id: "s2", now: 3 },
    );

    expect(
      filterScenes(state, "hiring", null).map((scene) => scene.id),
    ).toEqual(["s1"]);
    expect(filterScenes(state, "road", null).map((scene) => scene.id)).toEqual([
      "s2",
    ]);
  });

  it("duplicates metadata without carrying saved object pointers", () => {
    let state = createInitialLibraryState("user_1");
    state = createScene(
      state,
      { title: "Flow", folderId: null },
      { id: "s1", now: 1 },
    );
    state.scenes[0] = {
      ...state.scenes[0],
      currentObjectKey: "users/u/scenes/s1/head/excalidraw.json",
      version: 4,
    };

    state = duplicateScene(state, "s1", { id: "s2", now: 2 });

    expect(state.scenes.find((scene) => scene.id === "s2")).toMatchObject({
      title: "Flow copy",
      currentObjectKey: null,
      version: 0,
    });
  });

  it("stores scene bundles without Excalidraw collaborators app state", () => {
    let state = createInitialLibraryState("user_1");
    state = createScene(
      state,
      { title: "Flow", folderId: null },
      { id: "s1", now: 1 },
    );

    state = saveSceneBundle(
      state,
      {
        sceneId: "s1",
        bundle: {
          type: "excalidraw",
          version: 2,
          source: "scenevault",
          elements: [],
          appState: {
            collaborators: {},
            viewBackgroundColor: "#ffffff",
          },
          files: {},
        },
        byteSize: 100,
        contentHash: "hash",
      },
      2,
    );

    expect(state.bundles.s1.appState).toEqual({
      viewBackgroundColor: "#ffffff",
    });
  });
});
