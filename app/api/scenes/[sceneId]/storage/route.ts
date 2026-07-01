import { deleteSceneObject } from "@/lib/r2";
import {
  noStoreJson,
  requireSceneStorageAccess,
} from "@/lib/scene-storage-access";

type SceneRouteContext = {
  params: Promise<{ sceneId: string }>;
};

export async function DELETE(_request: Request, ctx: SceneRouteContext) {
  const { sceneId } = await ctx.params;
  const authResult = await requireSceneStorageAccess(sceneId);
  if (!authResult.ok) {
    return authResult.response;
  }
  const target = await deleteSceneObject({
    profileId: authResult.access.storageProfileId,
    sceneId,
  });
  return noStoreJson(target);
}
