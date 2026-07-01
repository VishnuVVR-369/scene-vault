import { r2UploadRequestSchema } from "@/lib/domain";
import { createSceneUploadUrl } from "@/lib/r2";
import { parseJsonBody } from "@/lib/scene-storage-access";
import {
  referrerSafeHeaders,
  requireSharedSceneAccess,
} from "@/lib/shared-scene-access";

type ShareRouteContext = {
  params: Promise<{ token: string }>;
};

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: ShareRouteContext) {
  const { token } = await ctx.params;
  const authResult = await requireSharedSceneAccess(token, {
    requiredMode: "edit",
    requireAuth: true,
  });
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
    sceneId: authResult.access.sceneId,
    contentType: body.contentType,
  });
  return Response.json(target, {
    headers: referrerSafeHeaders({
      "cache-control": "no-store",
    }),
  });
}
