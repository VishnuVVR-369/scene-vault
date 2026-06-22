import { createSceneThumbnailUploadUrl } from "@/lib/r2";
import { referrerSafeHeaders, requireSharedSceneAccess } from "@/lib/shared-scene-access";

type ShareRouteContext = {
  params: Promise<{ token: string }>;
};

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: ShareRouteContext) {
  const { token } = await ctx.params;
  const authResult = await requireSharedSceneAccess(token, {
    requiredMode: "edit",
    requireAuth: true,
  });
  if (!authResult.ok) {
    return authResult.response;
  }
  const target = await createSceneThumbnailUploadUrl({
    ownerId: authResult.access.storageOwnerId,
    sceneId: authResult.access.sceneId,
  });
  return Response.json(target, {
    headers: referrerSafeHeaders({
      "cache-control": "no-store",
    }),
  });
}
