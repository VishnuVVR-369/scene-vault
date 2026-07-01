import { createSceneDownloadUrl } from "@/lib/r2";
import {
  noStoreJson,
  requireSceneStorageAccess,
} from "@/lib/scene-storage-access";

type SceneRouteContext = {
  params: Promise<{ sceneId: string }>;
};

export async function GET(_request: Request, ctx: SceneRouteContext) {
  const { sceneId } = await ctx.params;
  const authResult = await requireSceneStorageAccess(sceneId);
  if (!authResult.ok) {
    return authResult.response;
  }
  if (!authResult.access.currentObjectKey) {
    return noStoreJson({ error: "Scene object not found" }, { status: 404 });
  }
  const target = await createSceneDownloadUrl({
    profileId: authResult.access.storageProfileId,
    sceneId,
  });
  return noStoreJson(target);
}
