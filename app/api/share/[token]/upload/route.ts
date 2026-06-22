import { ZodError } from "zod";

import { r2UploadRequestSchema } from "@/lib/domain";
import { createSceneUploadUrl } from "@/lib/r2";
import { noStoreJson } from "@/lib/scene-storage-access";
import { referrerSafeHeaders, requireSharedSceneAccess } from "@/lib/shared-scene-access";

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
    ownerId: authResult.access.storageOwnerId,
    sceneId: authResult.access.sceneId,
    contentType: body.contentType,
  });
  return Response.json(target, {
    headers: referrerSafeHeaders({
      "cache-control": "no-store",
    }),
  });
}
