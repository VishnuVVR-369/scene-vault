import { ZodError } from "zod";

import { r2UploadRequestSchema } from "@/lib/domain";
import { createSceneUploadUrl } from "@/lib/r2";
import {
  noStoreJson,
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

  let body;
  try {
    body = r2UploadRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return noStoreJson({ error: "Invalid upload request" }, { status: 400 });
    }
    throw error;
  }

  const target = await createSceneUploadUrl({
    ownerId: authResult.userId,
    sceneId,
    contentType: body.contentType,
  });
  return noStoreJson(target);
}
