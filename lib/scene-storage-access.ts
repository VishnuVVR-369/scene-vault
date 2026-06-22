import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

type SceneStorageAccess = {
  storageOwnerId: string;
  currentObjectKey: string | null;
  thumbnailObjectKey: string | null;
};

const getSceneStorageAccess = makeFunctionReference<
  "query",
  { sceneId: string },
  SceneStorageAccess | null
>("library:getSceneStorageAccess");

export type SceneStorageAuthResult =
  | { ok: true; userId: string; access: SceneStorageAccess }
  | { ok: false; response: Response };

export async function requireSceneStorageAccess(
  sceneId: string,
): Promise<SceneStorageAuthResult> {
  const { userId, getToken } = await auth();
  if (!userId) {
    return {
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return {
      ok: false,
      response: Response.json(
        { error: "Storage authorization is not configured" },
        { status: 503 },
      ),
    };
  }

  const token = await getToken({ template: "convex" });
  if (!token) {
    return {
      ok: false,
      response: Response.json(
        { error: "Storage authorization is not available" },
        { status: 503 },
      ),
    };
  }

  try {
    const access = await fetchQuery(
      getSceneStorageAccess,
      { sceneId },
      { token },
    );
    if (!access) {
      return {
        ok: false,
        response: Response.json({ error: "Scene not found" }, { status: 404 }),
      };
    }
  return { ok: true, userId, access };
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Scene not found" }, { status: 404 }),
    };
  }
}

export function noStoreJson(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("cache-control", "no-store");
  return Response.json(data, { ...init, headers });
}
