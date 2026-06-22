import { createSceneThumbnailUploadUrl } from "@/lib/r2";
import {
  noStoreJson,
  requireSceneStorageAccess,
} from "@/lib/scene-storage-access";

type SceneRouteContext = {
  params: Promise<{ sceneId: string }>;
};

export async function POST(_request: Request, ctx: SceneRouteContext) {
  const { sceneId } = await ctx.params;
  const authResult = await requireSceneStorageAccess(sceneId);
  if (!authResult.ok) {
    return authResult.response;
  }
  const target = await createSceneThumbnailUploadUrl({
    ownerId: authResult.access.storageOwnerId,
    sceneId,
  });
  return noStoreJson(target);
}
