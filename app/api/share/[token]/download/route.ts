import { createSceneDownloadUrl } from "@/lib/r2";
import { noStoreJson } from "@/lib/scene-storage-access";
import { referrerSafeHeaders, requireSharedSceneAccess } from "@/lib/shared-scene-access";

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
  if (!authResult.access.currentObjectKey) {
    return noStoreJson({ error: "Scene object not found" }, { status: 404 });
  }
  const target = await createSceneDownloadUrl({
    ownerId: authResult.access.storageOwnerId,
    sceneId: authResult.access.sceneId,
  });
  return Response.json(target, {
    headers: referrerSafeHeaders({
      "cache-control": "no-store",
    }),
  });
}
