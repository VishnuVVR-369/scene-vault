import { getSceneThumbnailObject } from "@/lib/r2";
import { noStoreJson } from "@/lib/scene-storage-access";
import {
  referrerSafeHeaders,
  requireSharedSceneAccess,
} from "@/lib/shared-scene-access";

type ShareRouteContext = {
  params: Promise<{ token: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: ShareRouteContext) {
  const { token } = await ctx.params;
  const authResult = await requireSharedSceneAccess(token);
  if (!authResult.ok) {
    return authResult.response;
  }
  if (!authResult.access.thumbnailObjectKey) {
    return noStoreJson({ error: "Scene thumbnail not found" }, { status: 404 });
  }
  const object = await getSceneThumbnailObject({
    ownerId: authResult.access.storageOwnerId,
    sceneId: authResult.access.sceneId,
  });
  if (!object) {
    return new Response(null, {
      status: 404,
      headers: referrerSafeHeaders({ "cache-control": "no-store" }),
    });
  }
  return new Response(object.body as BodyInit, {
    headers: referrerSafeHeaders({
      "content-type": object.contentType,
      "cache-control": "no-store",
    }),
  });
}
