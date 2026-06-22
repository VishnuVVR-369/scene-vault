import { libraryStateSchema, type LibraryState } from "@/lib/domain";
import { normalizeSceneBundle } from "@/lib/excalidraw-scene";
import { createInitialLibraryState } from "@/lib/library-state";

const STORAGE_KEY = "scenevault.library.v1";

export function loadLocalLibraryState(ownerId = "local-user"): LibraryState {
  if (typeof window === "undefined") {
    return createInitialLibraryState(ownerId);
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createInitialLibraryState(ownerId);
  }
  const parsed = libraryStateSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return createInitialLibraryState(ownerId);
  }
  return libraryStateSchema.parse({
    ...parsed.data,
    bundles: Object.fromEntries(
      Object.entries(parsed.data.bundles).map(([sceneId, bundle]) => [
        sceneId,
        normalizeSceneBundle(bundle),
      ]),
    ),
  });
}

export function persistLocalLibraryState(state: LibraryState) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(libraryStateSchema.parse(state)),
  );
}

export function clearLocalLibraryState() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}
