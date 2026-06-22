import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import {
  copySceneObject,
  copySceneThumbnailObject,
} from "@/lib/r2";
import { noStoreJson } from "@/lib/scene-storage-access";
import { referrerSafeHeaders, requireSharedSceneAccess } from "@/lib/shared-scene-access";

type ShareRouteContext = {
  params: Promise<{ token: string }>;
};

const createScene = makeFunctionReference<
  "mutation",
  { title: string; folderId: string | null },
  string
>("library:createScene");

const commitSceneSave = makeFunctionReference<
  "mutation",
  {
    sceneId: string;
    objectKey: string;
    byteSize: number;
    contentHash: string;
    thumbnailObjectKey?: string | null;
  },
  null
>("library:commitSceneSave");

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: ShareRouteContext) {
  const { token } = await ctx.params;
  const accessResult = await requireSharedSceneAccess(token, { requireAuth: true });
  if (!accessResult.ok) {
    return accessResult.response;
  }
  const userId = accessResult.userId;
  if (!userId) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  const { getToken } = await auth();
  const convexToken = await getToken({ template: "convex" });
  if (!convexToken) {
    return noStoreJson(
      { error: "Storage authorization is not available" },
      { status: 503 },
    );
  }

  const source = accessResult.access;
  const sceneId = await fetchMutation(
    createScene,
    { title: `${source.title} copy`, folderId: null },
    { token: convexToken },
  );

  if (source.currentObjectKey) {
    if (!source.contentHash) {
      return noStoreJson(
        { error: "Shared scene metadata is incomplete" },
        { status: 409 },
      );
    }
    const copiedScene = await copySceneObject({
      sourceOwnerId: source.storageOwnerId,
      sourceSceneId: source.sceneId,
      targetOwnerId: userId,
      targetSceneId: sceneId,
    });
    const copiedThumbnail = source.thumbnailObjectKey
      ? await copySceneThumbnailObject({
          sourceOwnerId: source.storageOwnerId,
          sourceSceneId: source.sceneId,
          targetOwnerId: userId,
          targetSceneId: sceneId,
        })
      : null;
    await fetchMutation(
      commitSceneSave,
      {
        sceneId,
        objectKey: copiedScene.targetKey,
        byteSize: source.byteSize,
        contentHash: source.contentHash,
        ...(copiedThumbnail ? { thumbnailObjectKey: copiedThumbnail.targetKey } : {}),
      },
      { token: convexToken },
    );
  }

  return Response.json(
    { sceneId },
    {
      headers: referrerSafeHeaders({
        "cache-control": "no-store",
      }),
    },
  );
}
