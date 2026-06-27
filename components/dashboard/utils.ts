import { type Folder, type SceneMetadata } from "@/lib/domain";

export type SortKey = "recent" | "name" | "created";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently edited" },
  { value: "name", label: "Name (A–Z)" },
  { value: "created", label: "Newest first" },
];

export function sceneActivityAt(scene: SceneMetadata) {
  return scene.lastSavedAt ?? scene.updatedAt;
}

export function sortScenes(scenes: SceneMetadata[], sort: SortKey) {
  const copy = [...scenes];
  switch (sort) {
    case "name":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case "created":
      return copy.sort((a, b) => b.createdAt - a.createdAt);
    case "recent":
    default:
      return copy.sort((a, b) => sceneActivityAt(b) - sceneActivityAt(a));
  }
}

// Direct children of a folder (or the roots when `parentFolderId` is null),
// sorted by name — the ordering used by both the sidebar tree and folder cards.
export function childFoldersOf(folders: Folder[], parentFolderId: string | null) {
  return folders
    .filter((folder) => folder.parentFolderId === parentFolderId)
    .sort((a, b) => a.name.localeCompare(b.name));
}
