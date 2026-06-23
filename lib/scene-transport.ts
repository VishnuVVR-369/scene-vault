import { signedStorageTargetSchema, type SceneBundle } from "@/lib/domain";
import { renderSceneThumbnailBlob } from "@/lib/thumbnail";

// Client-side helpers for moving scene bytes through short-lived signed R2 URLs.
// Both the owner library (`/api/scenes/...`) and the shared editor
// (`/api/share/...`) drive the same upload shape, differing only in the endpoint
// they hit, so the transport mechanics live here while each caller keeps its own
// auth/commit step and error messaging.

/** PUT the serialized scene JSON to a signed URL. Returns whether it succeeded. */
export async function putSceneBundleToSignedUrl(
  url: string,
  serialized: string,
): Promise<boolean> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: serialized,
  });
  return response.ok;
}

// Render a PNG preview and upload it via a freshly minted signed URL, returning
// its object key. Entirely best-effort: any failure (empty scene, render error,
// network, non-ok response) resolves to null so the save still commits without a
// thumbnail. `uploadEndpoint` is the POST route that mints the signed target.
export async function uploadThumbnailViaSignedUrl(
  uploadEndpoint: string,
  bundle: SceneBundle,
): Promise<string | null> {
  try {
    const blob = await renderSceneThumbnailBlob(bundle);
    if (!blob) {
      return null;
    }
    const signedResponse = await fetch(uploadEndpoint, { method: "POST" });
    if (!signedResponse.ok) {
      return null;
    }
    const target = signedStorageTargetSchema.parse(await signedResponse.json());
    const uploadResponse = await fetch(target.url, {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body: blob,
    });
    return uploadResponse.ok ? target.key : null;
  } catch {
    return null;
  }
}
