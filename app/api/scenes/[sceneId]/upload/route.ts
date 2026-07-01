import { r2UploadRequestSchema } from "@/lib/domain";
import { createSceneUploadUrl } from "@/lib/r2";
import {
  noStoreJson,
  parseJsonBody,
  requireSceneStorageAccess,
} from "@/lib/scene-storage-access";

type SceneRouteContext = {
  params: Promise<{ sceneId: string }>;
};

export async function POST(request: Request, ctx: SceneRouteContext) {
  const { sceneId } = await ctx.params;
  const authResult = await requireSceneStorageAccess(sceneId);
  if (!authResult.ok) {
    return authResult.response;
  }

  const bodyResult = await parseJsonBody(
    request,
    r2UploadRequestSchema,
    "Invalid upload request",
  );
  if (!bodyResult.ok) {
    return bodyResult.response;
  }
  const body = bodyResult.data;

  const target = await createSceneUploadUrl({
    profileId: authResult.access.storageProfileId,
    sceneId,
    contentType: body.contentType,
  });
  return noStoreJson(target);
}
