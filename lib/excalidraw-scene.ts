import { sceneBundleSchema, type SceneBundle } from "@/lib/domain";

// Excalidraw's `appState` mixes a small amount of persistent scene state
// (background colour, grid, theme, …) with a large amount of ephemeral
// view/interaction state that changes on cursor moves, selection, panning and
// zooming. Persisting the ephemeral keys is pointless and — because every
// change to them fires `onChange` — it is what turns idle interaction into a
// stream of redundant saves. Strip them so the persisted payload only reflects
// real content and stays byte-stable across cosmetic changes.
const EPHEMERAL_APP_STATE_KEYS = new Set([
  "collaborators",
  "scrollX",
  "scrollY",
  "zoom",
  "scrolledOutside",
  "cursorButton",
  "selectedElementIds",
  "selectedGroupIds",
  "editingGroupId",
  "selectedLinearElement",
  "editingLinearElement",
  "editingTextElement",
  "editingElement",
  "draggingElement",
  "resizingElement",
  "multiElement",
  "newElement",
  "selectionElement",
  "startBoundElement",
  "suggestedBindings",
  "selectedElementsAreBeingDragged",
  "isResizing",
  "isRotating",
  "isBindingEnabled",
  "isLoading",
  "snapLines",
  "contextMenu",
  "openMenu",
  "openPopup",
  "openSidebar",
  "openDialog",
  "pendingImageElementId",
  "userToFollow",
  "followedBy",
  "toast",
  "activeEmbeddable",
  "showHyperlinkPopup",
  "offsetLeft",
  "offsetTop",
  "width",
  "height",
]);

export function sanitizeExcalidrawAppState(
  appState: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(appState).filter(
      ([key]) => !EPHEMERAL_APP_STATE_KEYS.has(key),
    ),
  );
}

export function normalizeSceneBundle(bundle: unknown): SceneBundle {
  const parsed = sceneBundleSchema.parse(bundle);
  return sceneBundleSchema.parse({
    ...parsed,
    appState: sanitizeExcalidrawAppState(parsed.appState),
  });
}

// Wrap the raw {elements, appState, files} captured from a live Excalidraw scene
// (e.g. a collab snapshot) in the persistable bundle envelope. Typed structurally
// so this module stays free of Excalidraw/React imports; callers pass their own
// `SnapshotBundle`. The result still needs `normalizeSceneBundle` before saving.
export function snapshotToSceneBundle(snapshot: {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: unknown;
}): SceneBundle {
  return {
    type: "excalidraw",
    version: 2,
    source: "scenevault",
    elements: snapshot.elements as SceneBundle["elements"],
    appState: snapshot.appState,
    files: snapshot.files as SceneBundle["files"],
  };
}

// Stable string describing only the persistable content of a scene. Two
// normalized bundles with the same signature are byte-identical once saved, so
// callers can use it to skip redundant work (re-render-triggered `onChange`,
// uploads of unchanged data, …). Expects an already-normalized bundle.
export function sceneContentSignature(bundle: SceneBundle): string {
  return JSON.stringify({
    elements: bundle.elements,
    appState: bundle.appState,
    files: bundle.files,
  });
}
