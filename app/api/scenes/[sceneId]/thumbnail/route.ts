import { getSceneThumbnailObject } from "@/lib/r2";
import {
  noStoreJson,
  requireSceneStorageAccess,
} from "@/lib/scene-storage-access";

type SceneRouteContext = {
  params: Promise<{ sceneId: string }>;
};

// Serves a scene's PNG preview to the dashboard. The dashboard appends the
// scene version as `?v=<n>`, so a given URL's bytes never change — hence the
// long, immutable cache. A new save bumps the version and busts the cache.
export async function GET(_request: Request, ctx: SceneRouteContext) {
  const { sceneId } = await ctx.params;
  const authResult = await requireSceneStorageAccess(sceneId);
  if (!authResult.ok) {
    return authResult.response;
  }
  if (!authResult.access.thumbnailObjectKey) {
    return noStoreJson({ error: "Scene thumbnail not found" }, { status: 404 });
  }
  const object = await getSceneThumbnailObject({
    profileId: authResult.access.storageProfileId,
    sceneId,
  });
  if (!object) {
    return new Response(null, { status: 404 });
  }
  return new Response(object.body as BodyInit, {
    headers: {
      "content-type": object.contentType,
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
