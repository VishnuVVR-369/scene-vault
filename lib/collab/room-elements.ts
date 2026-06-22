// Pure helpers for turning Convex room rows into Excalidraw elements, deciding
// when a remote update actually changes the local scene (to avoid render churn
// and cursor jumps), and collecting image file references. Excalidraw's
// `reconcileElements` is injected so this stays dependency-free and testable.

export type SceneElementLike = {
  id: string;
  version: number;
  versionNonce?: number;
  type?: string;
  fileId?: unknown;
  [key: string]: unknown;
};

export type RoomElementRow = {
  elementId: string;
  data: unknown;
  version: number;
  versionNonce: number;
  updatedAt?: number;
};

export type ReconcileFn = (
  localElements: readonly SceneElementLike[],
  remoteElements: readonly SceneElementLike[],
  appState: unknown,
) => SceneElementLike[];

export function roomRowsToElements(
  rows: readonly RoomElementRow[],
): SceneElementLike[] {
  return rows.map((row) => row.data as SceneElementLike);
}

/**
 * Stable signature capturing element identity, version, nonce AND order. Two
 * scenes with the same signature render identically, so callers can skip a
 * redundant `updateScene`.
 */
export function elementsSignature(
  elements: readonly SceneElementLike[],
): string {
  return elements
    .map((el) => `${el.id}@${el.version}:${el.versionNonce ?? 0}`)
    .join(",");
}

/**
 * Reconcile remote rows over the current local scene. Returns the reconciled
 * elements plus whether anything actually changed relative to `localElements`.
 */
export function reconcileRemote(args: {
  localElements: readonly SceneElementLike[];
  remoteElements: readonly SceneElementLike[];
  appState: unknown;
  reconcile: ReconcileFn;
}): { elements: SceneElementLike[]; changed: boolean } {
  const reconciled = args.reconcile(
    args.localElements,
    args.remoteElements,
    args.appState,
  );
  const changed =
    elementsSignature(args.localElements) !== elementsSignature(reconciled);
  return { elements: reconciled, changed };
}

/** File ids referenced by image elements, so peers can lazy-load missing blobs. */
export function collectFileIds(
  elements: readonly SceneElementLike[],
): string[] {
  const ids = new Set<string>();
  for (const el of elements) {
    if (
      el.type === "image" &&
      typeof el.fileId === "string" &&
      el.fileId.length > 0 &&
      !el.isDeleted
    ) {
      ids.add(el.fileId);
    }
  }
  return [...ids];
}
