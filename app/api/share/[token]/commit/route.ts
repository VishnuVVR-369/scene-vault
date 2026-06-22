import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { z, ZodError } from "zod";

import { noStoreJson } from "@/lib/scene-storage-access";
import {
  referrerSafeHeaders,
  requireSharedSceneAccess,
} from "@/lib/shared-scene-access";

type ShareRouteContext = {
  params: Promise<{ token: string }>;
};

const commitSharedSceneSave = makeFunctionReference<
  "mutation",
  {
    token: string;
    objectKey: string;
    byteSize: number;
    contentHash: string;
    thumbnailObjectKey?: string | null;
  },
  null
>("library:commitSharedSceneSave");

const commitBodySchema = z.object({
  objectKey: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  contentHash: z.string().min(1),
  thumbnailObjectKey: z.union([z.string().min(1), z.null()]).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: ShareRouteContext) {
  const { token } = await ctx.params;
  const accessResult = await requireSharedSceneAccess(token, {
    requiredMode: "edit",
    requireAuth: true,
  });
  if (!accessResult.ok) {
    return accessResult.response;
  }

  let body;
  try {
    body = commitBodySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return noStoreJson({ error: "Invalid commit request" }, { status: 400 });
    }
    throw error;
  }

  const { getToken } = await auth();
  const convexToken = await getToken({ template: "convex" });
  if (!convexToken) {
    return noStoreJson(
      { error: "Storage authorization is not available" },
      { status: 503 },
    );
  }

  await fetchMutation(
    commitSharedSceneSave,
    {
      token,
      ...body,
    },
    { token: convexToken },
  );
  return Response.json(
    { ok: true },
    {
      headers: referrerSafeHeaders({
        "cache-control": "no-store",
      }),
    },
  );
}
