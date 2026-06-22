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
  const { access } = authResult;
  return Response.json(
    {
      sceneId: access.sceneId,
      mode: access.mode,
      title: access.title,
      version: access.version,
      hasScene: Boolean(access.currentObjectKey),
      hasThumbnail: Boolean(access.thumbnailObjectKey),
      byteSize: access.byteSize,
      contentHash: access.contentHash,
      updatedAt: access.updatedAt,
      lastSavedAt: access.lastSavedAt,
    },
    {
      headers: referrerSafeHeaders({
        "cache-control": "no-store",
      }),
    },
  );
}
