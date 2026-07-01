import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getConvexAuthToken } from "@/lib/auth-server";
import { copySceneObject, copySceneThumbnailObject } from "@/lib/r2";
import { noStoreJson } from "@/lib/scene-storage-access";
import {
  referrerSafeHeaders,
  requireSharedSceneAccess,
} from "@/lib/shared-scene-access";

type ShareRouteContext = {
  params: Promise<{ token: string }>;
};

const createScene = makeFunctionReference<
  "mutation",
  { title: string; folderId: string | null },
  string
>("library:createScene");

const getCurrentStorageProfileId = makeFunctionReference<
  "query",
  Record<string, never>,
  string
>("library:getCurrentStorageProfileId");

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
  const accessResult = await requireSharedSceneAccess(token, {
    requireAuth: true,
  });
  if (!accessResult.ok) {
    return accessResult.response;
  }
  const convexToken = await getConvexAuthToken();
  if (!convexToken) {
    return noStoreJson(
      { error: "Storage authorization is not available" },
      { status: 503 },
    );
  }

  const sceneId = await fetchMutation(
    createScene,
    { title: `${accessResult.access.title} copy`, folderId: null },
    { token: convexToken },
  );
  const source = accessResult.access;
  const targetProfileId = await fetchQuery(
    getCurrentStorageProfileId,
    {},
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
      sourceProfileId: source.storageProfileId,
      sourceSceneId: source.sceneId,
      targetProfileId,
      targetSceneId: sceneId,
    });
    const copiedThumbnail = source.thumbnailObjectKey
      ? await copySceneThumbnailObject({
          sourceProfileId: source.storageProfileId,
          sourceSceneId: source.sceneId,
          targetProfileId,
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
        ...(copiedThumbnail
          ? { thumbnailObjectKey: copiedThumbnail.targetKey }
          : {}),
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
