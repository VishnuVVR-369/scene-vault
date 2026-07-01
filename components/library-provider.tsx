"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { z } from "zod";

import {
  loadLocalLibraryState,
  persistLocalLibraryState,
} from "@/lib/browser-storage";
import {
  convexLibraryResponseSchema,
  createEmptySceneBundle,
  createFolderInputSchema,
  createSceneInputSchema,
  folderSchema,
  moveFolderInputSchema,
  renameFolderInputSchema,
  saveSceneBundleInputSchema,
  sceneMetadataSchema,
  signedStorageTargetSchema,
  type Folder,
  type LibraryState,
  type SceneBundle,
  type SceneMetadata,
  updateSceneInputSchema,
} from "@/lib/domain";
import { normalizeSceneBundle } from "@/lib/excalidraw-scene";
import { sha256Hex } from "@/lib/hash";
import {
  createFolder as createLocalFolder,
  createScene as createLocalScene,
  deleteFolder as deleteLocalFolder,
  deleteScene as deleteLocalScene,
  duplicateScene as duplicateLocalScene,
  moveFolder as moveLocalFolder,
  renameFolder as renameLocalFolder,
  saveSceneBundle as saveLocalSceneBundle,
  setSceneThumbnail as setLocalSceneThumbnail,
  updateScene as updateLocalScene,
} from "@/lib/library-state";
import {
  putSceneBundleToSignedUrl,
  uploadThumbnailViaSignedUrl,
} from "@/lib/scene-transport";
import { renderSceneThumbnailDataUrl } from "@/lib/thumbnail";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type LibraryContextValue = {
  folders: Folder[];
  scenes: SceneMetadata[];
  ready: boolean;
  // Displayable thumbnail URL per scene id: a proxy route in remote mode, a PNG
  // data URL in local mode. Absent when a scene has no rendered preview yet.
  thumbnails: Record<string, string>;
  createFolder: (name: string, parentFolderId: string | null) => Promise<void>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  moveFolder: (
    folderId: string,
    parentFolderId: string | null,
  ) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  createScene: (title: string, folderId: string | null) => Promise<string>;
  updateScene: (
    sceneId: string,
    patch: { title?: string; folderId?: string | null; pinned?: boolean },
  ) => Promise<void>;
  deleteScene: (sceneId: string) => Promise<void>;
  duplicateScene: (sceneId: string) => Promise<string>;
  loadSceneBundle: (sceneId: string) => Promise<SceneBundle>;
  saveSceneBundle: (
    sceneId: string,
    bundle: SceneBundle,
  ) => Promise<SaveStatus>;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

export const shouldUseRemoteData =
  process.env.NEXT_PUBLIC_LOCAL_DATA !== "1" &&
  Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

const idSchema = z.string().min(1);

const convexRefs = {
  getLibrary: makeFunctionReference<"query", Record<string, never>, unknown>(
    "library:getLibrary",
  ),
  createFolder: makeFunctionReference<
    "mutation",
    { name: string; parentFolderId: string | null },
    string
  >("library:createFolder"),
  renameFolder: makeFunctionReference<
    "mutation",
    { folderId: string; name: string },
    null
  >("library:renameFolder"),
  moveFolder: makeFunctionReference<
    "mutation",
    { folderId: string; parentFolderId: string | null },
    null
  >("library:moveFolder"),
  deleteFolder: makeFunctionReference<"mutation", { folderId: string }, null>(
    "library:deleteFolder",
  ),
  createScene: makeFunctionReference<
    "mutation",
    { title: string; folderId: string | null },
    string
  >("library:createScene"),
  updateScene: makeFunctionReference<
    "mutation",
    {
      sceneId: string;
      title?: string;
      folderId?: string | null;
      pinned?: boolean;
    },
    null
  >("library:updateScene"),
  deleteScene: makeFunctionReference<"mutation", { sceneId: string }, null>(
    "library:deleteScene",
  ),
  duplicateScene: makeFunctionReference<
    "mutation",
    { sceneId: string },
    string
  >("library:duplicateScene"),
  commitSceneSave: makeFunctionReference<
    "mutation",
    {
      sceneId: string;
      objectKey: string;
      byteSize: number;
      contentHash: string;
      thumbnailObjectKey?: string | null;
    },
    null
  >("library:commitSceneSave"),
};

export function LibraryProvider({ children }: { children: ReactNode }) {
  if (shouldUseRemoteData) {
    return <RemoteLibraryProvider>{children}</RemoteLibraryProvider>;
  }

  return <LocalLibraryProvider>{children}</LocalLibraryProvider>;
}

function LocalLibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LibraryState>(() =>
    loadLocalLibraryState(),
  );
  const ready = true;
  const lastSavedHashRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (ready) {
      persistLocalLibraryState(state);
    }
  }, [ready, state]);

  const apply = useCallback((fn: (state: LibraryState) => LibraryState) => {
    setState((current) => fn(current));
  }, []);

  const value = useMemo<LibraryContextValue>(
    () => ({
      folders: state.folders,
      scenes: state.scenes,
      ready,
      thumbnails: state.thumbnails,
      createFolder: async (name, parentFolderId) => {
        apply((current) =>
          createLocalFolder(current, { name, parentFolderId }),
        );
      },
      renameFolder: async (folderId, name) => {
        apply((current) => renameLocalFolder(current, { id: folderId, name }));
      },
      moveFolder: async (folderId, parentFolderId) => {
        apply((current) =>
          moveLocalFolder(current, { id: folderId, parentFolderId }),
        );
      },
      deleteFolder: async (folderId) => {
        apply((current) => deleteLocalFolder(current, folderId));
      },
      createScene: async (title, folderId) => {
        let sceneId = "";
        apply((current) => {
          const next = createLocalScene(current, { title, folderId });
          sceneId = next.scenes[next.scenes.length - 1]?.id ?? "";
          return next;
        });
        return sceneId;
      },
      updateScene: async (sceneId, patch) => {
        apply((current) =>
          updateLocalScene(current, { id: sceneId, ...patch }),
        );
      },
      deleteScene: async (sceneId) => {
        apply((current) => deleteLocalScene(current, sceneId));
      },
      duplicateScene: async (sceneId) => {
        let copyId = "";
        apply((current) => {
          const next = duplicateLocalScene(current, sceneId);
          copyId = next.scenes[next.scenes.length - 1]?.id ?? "";
          return next;
        });
        return copyId;
      },
      loadSceneBundle: async (sceneId) => {
        return normalizeSceneBundle(
          state.bundles[sceneId] ?? createEmptySceneBundle(),
        );
      },
      saveSceneBundle: async (sceneId, bundle) => {
        const parsed = normalizeSceneBundle(bundle);
        const serialized = JSON.stringify(parsed);
        const contentHash = await sha256Hex(serialized);
        if (lastSavedHashRef.current.get(sceneId) === contentHash) {
          return "saved";
        }
        apply((current) =>
          saveLocalSceneBundle(current, {
            sceneId,
            bundle: parsed,
            byteSize: new Blob([serialized]).size,
            contentHash,
          }),
        );
        lastSavedHashRef.current.set(sceneId, contentHash);
        // Best-effort preview render; an empty scene or a failure clears it.
        const thumbnail = await renderSceneThumbnailDataUrl(parsed);
        apply((current) =>
          current.scenes.some((scene) => scene.id === sceneId)
            ? setLocalSceneThumbnail(current, sceneId, thumbnail)
            : current,
        );
        return "saved";
      },
    }),
    [apply, ready, state],
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

function RemoteLibraryProvider({ children }: { children: ReactNode }) {
  const convexAuth = useConvexAuth();
  const rawLibrary = useQuery(
    convexRefs.getLibrary,
    convexAuth.isAuthenticated ? {} : "skip",
  );
  const createFolderMutation = useMutation(convexRefs.createFolder);
  const renameFolderMutation = useMutation(convexRefs.renameFolder);
  const moveFolderMutation = useMutation(convexRefs.moveFolder);
  const deleteFolderMutation = useMutation(convexRefs.deleteFolder);
  const createSceneMutation = useMutation(convexRefs.createScene);
  const updateSceneMutation = useMutation(convexRefs.updateScene);
  const deleteSceneMutation = useMutation(convexRefs.deleteScene);
  const duplicateSceneMutation = useMutation(convexRefs.duplicateScene);
  const commitSceneSaveMutation = useMutation(convexRefs.commitSceneSave);

  // Last content hash successfully persisted per scene, so a save with
  // unchanged content never re-uploads to R2 or re-commits to Convex.
  const lastSavedHashRef = useRef<Map<string, string>>(new Map());

  const assertRemoteAuthenticated = useCallback(() => {
    if (!convexAuth.isAuthenticated) {
      throw new Error("Remote library is not authenticated yet.");
    }
  }, [convexAuth.isAuthenticated]);

  const library = useMemo(() => {
    if (!convexAuth.isAuthenticated || rawLibrary === undefined) {
      return { folders: [], scenes: [], ready: false };
    }

    const parsed = convexLibraryResponseSchema.parse(rawLibrary);
    return {
      folders: parsed.folders.map((folder) =>
        folderSchema.parse({
          ...folder,
          id: folder._id,
        }),
      ),
      scenes: parsed.scenes.map((scene) =>
        sceneMetadataSchema.parse({
          ...scene,
          id: scene._id,
        }),
      ),
      ready: true,
    };
  }, [convexAuth.isAuthenticated, rawLibrary]);

  const deleteRemoteSceneStorage = useCallback(
    async (sceneId: string) => {
      assertRemoteAuthenticated();
      const response = await fetch(
        `/api/scenes/${idSchema.parse(sceneId)}/storage`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) {
        throw new Error("Could not delete the scene object.");
      }
    },
    [assertRemoteAuthenticated],
  );

  const loadRemoteSceneBundle = useCallback(
    async (sceneId: string) => {
      assertRemoteAuthenticated();
      const parsedSceneId = idSchema.parse(sceneId);
      const scene = library.scenes.find(
        (candidate) => candidate.id === parsedSceneId,
      );
      if (!scene) {
        throw new Error("Scene not found.");
      }
      if (!scene.currentObjectKey) {
        return createEmptySceneBundle();
      }

      const signedResponse = await fetch(
        `/api/scenes/${parsedSceneId}/download`,
      );
      if (!signedResponse.ok) {
        throw new Error("Could not create a scene download URL.");
      }
      const target = signedStorageTargetSchema.parse(
        await signedResponse.json(),
      );
      const sceneResponse = await fetch(target.url);
      if (!sceneResponse.ok) {
        throw new Error("Could not download the scene bundle.");
      }
      return normalizeSceneBundle(await sceneResponse.json());
    },
    [assertRemoteAuthenticated, library.scenes],
  );

  // Renders and uploads a PNG preview to R2, returning its object key. Entirely
  // best-effort: any failure (empty scene, render error, network) returns null
  // so the save still commits without a thumbnail.
  const uploadRemoteSceneThumbnail = useCallback(
    (sceneId: string, bundle: SceneBundle): Promise<string | null> =>
      uploadThumbnailViaSignedUrl(
        `/api/scenes/${idSchema.parse(sceneId)}/thumbnail/upload`,
        bundle,
      ),
    [],
  );

  const saveRemoteSceneBundle = useCallback(
    async (sceneId: string, bundle: SceneBundle): Promise<SaveStatus> => {
      assertRemoteAuthenticated();
      const parsed = normalizeSceneBundle(bundle);
      const serialized = JSON.stringify(parsed);
      const input = saveSceneBundleInputSchema.parse({
        sceneId,
        bundle: parsed,
        byteSize: new Blob([serialized]).size,
        contentHash: await sha256Hex(serialized),
      });

      if (lastSavedHashRef.current.get(input.sceneId) === input.contentHash) {
        return "saved";
      }

      const signedResponse = await fetch(
        `/api/scenes/${input.sceneId}/upload`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contentType: "application/json",
            byteSize: input.byteSize,
            contentHash: input.contentHash,
          }),
        },
      );
      if (!signedResponse.ok) {
        throw new Error("Could not create a scene upload URL.");
      }
      const target = signedStorageTargetSchema.parse(
        await signedResponse.json(),
      );

      const uploaded = await putSceneBundleToSignedUrl(target.url, serialized);
      if (!uploaded) {
        throw new Error("Could not upload the scene bundle.");
      }

      const thumbnailObjectKey = await uploadRemoteSceneThumbnail(
        input.sceneId,
        parsed,
      );

      await commitSceneSaveMutation({
        sceneId: input.sceneId,
        objectKey: target.key,
        byteSize: input.byteSize,
        contentHash: input.contentHash,
        ...(thumbnailObjectKey ? { thumbnailObjectKey } : {}),
      });
      lastSavedHashRef.current.set(input.sceneId, input.contentHash);
      return "saved";
    },
    [
      assertRemoteAuthenticated,
      commitSceneSaveMutation,
      uploadRemoteSceneThumbnail,
    ],
  );

  const sceneIdsUnderFolder = useCallback(
    (folderId: string) => {
      const folderIds = new Set([idSchema.parse(folderId)]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const folder of library.folders) {
          if (folder.parentFolderId && folderIds.has(folder.parentFolderId)) {
            if (!folderIds.has(folder.id)) {
              folderIds.add(folder.id);
              changed = true;
            }
          }
        }
      }
      return library.scenes
        .filter((scene) => scene.folderId && folderIds.has(scene.folderId))
        .map((scene) => scene.id);
    },
    [library.folders, library.scenes],
  );

  // Scenes carry a stable thumbnail object key, so the URL only needs the scene
  // version as a cache-buster — a new save bumps it and the dashboard reloads.
  const thumbnails = useMemo(
    () =>
      Object.fromEntries(
        library.scenes
          .filter((scene) => scene.thumbnailObjectKey)
          .map((scene) => [
            scene.id,
            `/api/scenes/${scene.id}/thumbnail?v=${scene.version}`,
          ]),
      ),
    [library.scenes],
  );

  const value = useMemo<LibraryContextValue>(
    () => ({
      folders: library.folders,
      scenes: library.scenes,
      ready: library.ready,
      thumbnails,
      createFolder: async (name, parentFolderId) => {
        assertRemoteAuthenticated();
        const input = createFolderInputSchema.parse({ name, parentFolderId });
        await createFolderMutation(input);
      },
      renameFolder: async (folderId, name) => {
        assertRemoteAuthenticated();
        const input = renameFolderInputSchema.parse({ id: folderId, name });
        await renameFolderMutation({ folderId: input.id, name: input.name });
      },
      moveFolder: async (folderId, parentFolderId) => {
        assertRemoteAuthenticated();
        const input = moveFolderInputSchema.parse({
          id: folderId,
          parentFolderId,
        });
        await moveFolderMutation({
          folderId: input.id,
          parentFolderId: input.parentFolderId,
        });
      },
      deleteFolder: async (folderId) => {
        assertRemoteAuthenticated();
        for (const sceneId of sceneIdsUnderFolder(folderId)) {
          const scene = library.scenes.find(
            (candidate) => candidate.id === sceneId,
          );
          if (scene?.currentObjectKey) {
            await deleteRemoteSceneStorage(sceneId);
          }
        }
        await deleteFolderMutation({ folderId: idSchema.parse(folderId) });
      },
      createScene: async (title, folderId) => {
        assertRemoteAuthenticated();
        const input = createSceneInputSchema.parse({ title, folderId });
        return idSchema.parse(await createSceneMutation(input));
      },
      updateScene: async (sceneId, patch) => {
        assertRemoteAuthenticated();
        const input = updateSceneInputSchema.parse({ id: sceneId, ...patch });
        await updateSceneMutation({
          sceneId: input.id,
          title: input.title,
          folderId: input.folderId,
          pinned: input.pinned,
        });
      },
      deleteScene: async (sceneId) => {
        assertRemoteAuthenticated();
        const parsedSceneId = idSchema.parse(sceneId);
        const scene = library.scenes.find(
          (candidate) => candidate.id === parsedSceneId,
        );
        if (scene?.currentObjectKey) {
          await deleteRemoteSceneStorage(parsedSceneId);
        }
        await deleteSceneMutation({ sceneId: parsedSceneId });
      },
      duplicateScene: async (sceneId) => {
        assertRemoteAuthenticated();
        const parsedSceneId = idSchema.parse(sceneId);
        const bundle = await loadRemoteSceneBundle(parsedSceneId);
        const copyId = idSchema.parse(
          await duplicateSceneMutation({ sceneId: parsedSceneId }),
        );
        await saveRemoteSceneBundle(copyId, bundle);
        return copyId;
      },
      loadSceneBundle: loadRemoteSceneBundle,
      saveSceneBundle: saveRemoteSceneBundle,
    }),
    [
      assertRemoteAuthenticated,
      createFolderMutation,
      createSceneMutation,
      deleteRemoteSceneStorage,
      deleteFolderMutation,
      deleteSceneMutation,
      duplicateSceneMutation,
      library.folders,
      library.ready,
      library.scenes,
      loadRemoteSceneBundle,
      moveFolderMutation,
      renameFolderMutation,
      saveRemoteSceneBundle,
      sceneIdsUnderFolder,
      thumbnails,
      updateSceneMutation,
    ],
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibrary must be used inside LibraryProvider.");
  }
  return context;
}
