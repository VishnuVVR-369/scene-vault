import { type SceneBundle } from "@/lib/domain";

const DEFAULT_BACKGROUND = "#ffffff";

// Caps the longest edge of the exported PNG. Big enough to stay crisp on a
// retina dashboard card, small enough to keep R2 objects (and local-mode
// data URLs) tiny.
const REMOTE_MAX_EDGE = 640;
const LOCAL_MAX_EDGE = 400;

function visibleElements(bundle: SceneBundle): unknown[] {
  return bundle.elements.filter(
    (element) =>
      Boolean(element) &&
      (element as { isDeleted?: boolean }).isDeleted !== true,
  );
}

/**
 * Render a PNG preview of a scene's real content with Excalidraw's export
 * helper. Returns null for empty scenes (nothing worth previewing) and never
 * throws — thumbnailing is best-effort and must not break a save.
 *
 * Excalidraw's export module is imported dynamically so the heavy code only
 * loads where a save actually happens (the editor). The dashboard pulls in the
 * same library provider but never calls this, so it stays out of that bundle.
 */
export async function renderSceneThumbnailBlob(
  bundle: SceneBundle,
  maxWidthOrHeight = REMOTE_MAX_EDGE,
): Promise<Blob | null> {
  const elements = visibleElements(bundle);
  if (elements.length === 0) {
    return null;
  }
  try {
    const { exportToBlob } = await import("@excalidraw/excalidraw");
    return await exportToBlob({
      elements: elements as never,
      files: (bundle.files ?? null) as never,
      appState: {
        ...bundle.appState,
        exportBackground: true,
        exportWithDarkMode: false,
        viewBackgroundColor:
          (bundle.appState.viewBackgroundColor as string | undefined) ??
          DEFAULT_BACKGROUND,
      },
      mimeType: "image/png",
      maxWidthOrHeight,
      exportPadding: 16,
    });
  } catch {
    return null;
  }
}

/**
 * Local-mode variant: returns a PNG data URL suitable for localStorage, or null
 * for an empty scene / on any failure.
 */
export async function renderSceneThumbnailDataUrl(
  bundle: SceneBundle,
): Promise<string | null> {
  const blob = await renderSceneThumbnailBlob(bundle, LOCAL_MAX_EDGE);
  if (!blob) {
    return null;
  }
  try {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
