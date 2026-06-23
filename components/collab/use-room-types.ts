import type { CollabIdentity } from "@/lib/collab/identity";
import type { SceneElementLike } from "@/lib/collab/room-elements";

import type {
  BinaryFileData,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

// Public types and the Excalidraw module loader for `useRoom`, kept apart from
// the hook so the hook file reads as a single (intricate) state machine.

// Lazily loaded so the editor's SSR pass never touches Excalidraw (which needs
// the DOM). The component bundle has already imported the module by the time we
// have an API, so this resolves from cache immediately.
export type ExcalidrawModule = typeof import("@excalidraw/excalidraw");
let excalidrawModulePromise: Promise<ExcalidrawModule> | null = null;
export function loadExcalidraw(): Promise<ExcalidrawModule> {
  excalidrawModulePromise ??= import("@excalidraw/excalidraw");
  return excalidrawModulePromise;
}

export type RoomStatus =
  | "idle"
  | "connecting"
  | "hydrating"
  | "ready"
  | "ended"
  | "revoked"
  | "error";

export type Participant = {
  id: string;
  name: string;
  color: string;
  isSelf: boolean;
};

export type SnapshotBundle = {
  elements: SceneElementLike[];
  appState: Record<string, unknown>;
  files: BinaryFiles;
};

export type UseRoomArgs = {
  enabled: boolean;
  sceneId: string;
  /** Edit share token (shared editor); omit for the signed-in owner. */
  token?: string;
  identity: CollabIdentity;
  /** Elements loaded from R2 by the caller; used to seed a fresh room. */
  initialElements: readonly SceneElementLike[];
  contentHash: string | null;
  /** Whether this client may persist to R2 (signed in). Guests cannot. */
  canSnapshot: boolean;
  /** Persist the live scene to R2; returns the content hash, or null on failure. */
  onSnapshot: (bundle: SnapshotBundle) => Promise<string | null>;
  /** Fetch missing image blobs (by id) so they can be added to the scene. */
  onLoadFiles?: (fileIds: string[]) => Promise<BinaryFileData[]>;
};

export type UseRoomResult = {
  status: RoomStatus;
  participants: Participant[];
  isSnapshotter: boolean;
  canStop: boolean;
  stopRoom: () => Promise<void>;
  onApi: (api: ExcalidrawImperativeAPI) => void;
  onSceneChange: (
    elements: readonly SceneElementLike[],
    appState: { selectedElementIds?: Record<string, unknown> },
    files: BinaryFiles,
  ) => void;
  onPointerUpdate: (payload: {
    pointer: { x: number; y: number };
    button: "down" | "up";
  }) => void;
};
