import {
  createEmptySceneBundle,
  createFolderInputSchema,
  createSceneInputSchema,
  libraryStateSchema,
  moveFolderInputSchema,
  renameFolderInputSchema,
  saveSceneBundleInputSchema,
  updateSceneInputSchema,
  type Folder,
  type LibraryState,
  type SceneMetadata,
} from "@/lib/domain";
import { normalizeSceneBundle } from "@/lib/excalidraw-scene";

const DEFAULT_OWNER_ID = "local-user";

export function createInitialLibraryState(
  profileId = DEFAULT_OWNER_ID,
): LibraryState {
  return libraryStateSchema.parse({
    profileId,
    folders: [],
    scenes: [],
    bundles: {},
  });
}

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function createFolder(
  state: LibraryState,
  input: unknown,
  opts: { id?: string; now?: number } = {},
): LibraryState {
  const parsed = createFolderInputSchema.parse(input);
  assertParentFolderExists(state, parsed.parentFolderId);
  const now = opts.now ?? Date.now();
  const folder: Folder = {
    id: opts.id ?? createId("fld"),
    profileId: state.profileId,
    name: parsed.name,
    parentFolderId: parsed.parentFolderId,
    createdAt: now,
    updatedAt: now,
  };
  return libraryStateSchema.parse({
    ...state,
    folders: [...state.folders, folder],
  });
}

export function renameFolder(
  state: LibraryState,
  input: unknown,
  now = Date.now(),
) {
  const parsed = renameFolderInputSchema.parse(input);
  assertFolderExists(state, parsed.id);
  return libraryStateSchema.parse({
    ...state,
    folders: state.folders.map((folder) =>
      folder.id === parsed.id
        ? { ...folder, name: parsed.name, updatedAt: now }
        : folder,
    ),
  });
}

export function moveFolder(
  state: LibraryState,
  input: unknown,
  now = Date.now(),
) {
  const parsed = moveFolderInputSchema.parse(input);
  assertFolderExists(state, parsed.id);
  assertParentFolderExists(state, parsed.parentFolderId);
  if (parsed.parentFolderId === parsed.id) {
    throw new Error("A folder cannot be moved into itself.");
  }
  if (
    parsed.parentFolderId &&
    isDescendantFolder(state, parsed.parentFolderId, parsed.id)
  ) {
    throw new Error("A folder cannot be moved into one of its descendants.");
  }
  return libraryStateSchema.parse({
    ...state,
    folders: state.folders.map((folder) =>
      folder.id === parsed.id
        ? { ...folder, parentFolderId: parsed.parentFolderId, updatedAt: now }
        : folder,
    ),
  });
}

export function deleteFolder(
  state: LibraryState,
  folderId: string,
): LibraryState {
  assertFolderExists(state, folderId);
  const folderIdsToDelete = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of state.folders) {
      if (
        folder.parentFolderId &&
        folderIdsToDelete.has(folder.parentFolderId)
      ) {
        if (!folderIdsToDelete.has(folder.id)) {
          folderIdsToDelete.add(folder.id);
          changed = true;
        }
      }
    }
  }

  const scenesToDelete = new Set(
    state.scenes
      .filter(
        (scene) => scene.folderId && folderIdsToDelete.has(scene.folderId),
      )
      .map((scene) => scene.id),
  );

  return libraryStateSchema.parse({
    ...state,
    folders: state.folders.filter(
      (folder) => !folderIdsToDelete.has(folder.id),
    ),
    scenes: state.scenes.filter((scene) => !scenesToDelete.has(scene.id)),
    bundles: Object.fromEntries(
      Object.entries(state.bundles).filter(
        ([sceneId]) => !scenesToDelete.has(sceneId),
      ),
    ),
    thumbnails: Object.fromEntries(
      Object.entries(state.thumbnails).filter(
        ([sceneId]) => !scenesToDelete.has(sceneId),
      ),
    ),
  });
}

export function createScene(
  state: LibraryState,
  input: unknown,
  opts: { id?: string; now?: number } = {},
): LibraryState {
  const parsed = createSceneInputSchema.parse(input);
  assertParentFolderExists(state, parsed.folderId);
  const now = opts.now ?? Date.now();
  const scene: SceneMetadata = {
    id: opts.id ?? createId("scn"),
    profileId: state.profileId,
    title: parsed.title,
    folderId: parsed.folderId,
    pinned: false,
    version: 0,
    currentObjectKey: null,
    thumbnailObjectKey: null,
    byteSize: 0,
    contentHash: null,
    createdAt: now,
    updatedAt: now,
    lastSavedAt: null,
  };
  return libraryStateSchema.parse({
    ...state,
    scenes: [...state.scenes, scene],
    bundles: {
      ...state.bundles,
      [scene.id]: createEmptySceneBundle(),
    },
  });
}

export function updateScene(
  state: LibraryState,
  input: unknown,
  now = Date.now(),
) {
  const parsed = updateSceneInputSchema.parse(input);
  assertSceneExists(state, parsed.id);
  if (parsed.folderId !== undefined) {
    assertParentFolderExists(state, parsed.folderId);
  }
  return libraryStateSchema.parse({
    ...state,
    scenes: state.scenes.map((scene) =>
      scene.id === parsed.id
        ? {
            ...scene,
            title: parsed.title ?? scene.title,
            folderId:
              parsed.folderId === undefined ? scene.folderId : parsed.folderId,
            pinned: parsed.pinned === undefined ? scene.pinned : parsed.pinned,
            updatedAt: now,
          }
        : scene,
    ),
  });
}

export function deleteScene(
  state: LibraryState,
  sceneId: string,
): LibraryState {
  assertSceneExists(state, sceneId);
  const bundles = { ...state.bundles };
  delete bundles[sceneId];
  const thumbnails = { ...state.thumbnails };
  delete thumbnails[sceneId];
  return libraryStateSchema.parse({
    ...state,
    scenes: state.scenes.filter((scene) => scene.id !== sceneId),
    bundles,
    thumbnails,
  });
}

export function setSceneThumbnail(
  state: LibraryState,
  sceneId: string,
  thumbnail: string | null,
): LibraryState {
  assertSceneExists(state, sceneId);
  const thumbnails = { ...state.thumbnails };
  if (thumbnail) {
    thumbnails[sceneId] = thumbnail;
  } else {
    delete thumbnails[sceneId];
  }
  return libraryStateSchema.parse({ ...state, thumbnails });
}

export function duplicateScene(
  state: LibraryState,
  sceneId: string,
  opts: { id?: string; now?: number } = {},
): LibraryState {
  const source = assertSceneExists(state, sceneId);
  const now = opts.now ?? Date.now();
  const id = opts.id ?? createId("scn");
  const copy: SceneMetadata = {
    ...source,
    id,
    title: `${source.title} copy`,
    pinned: false,
    version: 0,
    currentObjectKey: null,
    thumbnailObjectKey: null,
    byteSize: 0,
    contentHash: null,
    createdAt: now,
    updatedAt: now,
    lastSavedAt: null,
  };
  return libraryStateSchema.parse({
    ...state,
    scenes: [...state.scenes, copy],
    bundles: {
      ...state.bundles,
      [id]: normalizeSceneBundle(
        state.bundles[sceneId] ?? createEmptySceneBundle(),
      ),
    },
    thumbnails: state.thumbnails[sceneId]
      ? { ...state.thumbnails, [id]: state.thumbnails[sceneId] }
      : state.thumbnails,
  });
}

export function saveSceneBundle(
  state: LibraryState,
  input: unknown,
  now = Date.now(),
): LibraryState {
  const parsed = saveSceneBundleInputSchema.parse(input);
  assertSceneExists(state, parsed.sceneId);
  const bundle = normalizeSceneBundle(parsed.bundle);
  return libraryStateSchema.parse({
    ...state,
    scenes: state.scenes.map((scene) =>
      scene.id === parsed.sceneId
        ? {
            ...scene,
            version: scene.version + 1,
            byteSize: parsed.byteSize,
            contentHash: parsed.contentHash,
            updatedAt: now,
            lastSavedAt: now,
          }
        : scene,
    ),
    bundles: {
      ...state.bundles,
      [parsed.sceneId]: bundle,
    },
  });
}

export function getFolderPath(state: LibraryState, folderId: string | null) {
  if (!folderId) {
    return ["All scenes"];
  }
  const foldersById = new Map(
    state.folders.map((folder) => [folder.id, folder]),
  );
  const path: string[] = [];
  let cursor: string | null = folderId;
  while (cursor) {
    const folder = foldersById.get(cursor);
    if (!folder) {
      break;
    }
    path.unshift(folder.name);
    cursor = folder.parentFolderId;
  }
  return path;
}

export function filterScenes(
  state: LibraryState,
  query: string,
  folderId: string | null,
) {
  const normalized = query.trim().toLowerCase();
  return state.scenes.filter((scene) => {
    const matchesFolder = folderId === null || scene.folderId === folderId;
    if (!matchesFolder) {
      return false;
    }
    if (!normalized) {
      return true;
    }
    const folderPath = getFolderPath(state, scene.folderId)
      .join(" / ")
      .toLowerCase();
    return (
      scene.title.toLowerCase().includes(normalized) ||
      folderPath.includes(normalized)
    );
  });
}

export function isDescendantFolder(
  state: LibraryState,
  folderId: string,
  ancestorId: string,
) {
  const foldersById = new Map(
    state.folders.map((folder) => [folder.id, folder]),
  );
  let cursor = foldersById.get(folderId)?.parentFolderId ?? null;
  while (cursor) {
    if (cursor === ancestorId) {
      return true;
    }
    cursor = foldersById.get(cursor)?.parentFolderId ?? null;
  }
  return false;
}

function assertFolderExists(state: LibraryState, folderId: string) {
  const folder = state.folders.find((candidate) => candidate.id === folderId);
  if (!folder) {
    throw new Error("Folder not found.");
  }
  return folder;
}

function assertSceneExists(state: LibraryState, sceneId: string) {
  const scene = state.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) {
    throw new Error("Scene not found.");
  }
  return scene;
}

function assertParentFolderExists(
  state: LibraryState,
  folderId: string | null,
) {
  if (folderId === null) {
    return;
  }
  assertFolderExists(state, folderId);
}
