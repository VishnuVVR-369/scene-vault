import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { z, ZodError } from "zod";

import { getConvexAuthToken } from "@/lib/auth-server";

type SceneStorageAccess = {
  storageProfileId: string;
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
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return {
      ok: false,
      response: Response.json(
        { error: "Storage authorization is not configured" },
        { status: 503 },
      ),
    };
  }

  const token = await getConvexAuthToken();
  if (!token) {
    return {
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
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
    return { ok: true, userId: access.storageProfileId, access };
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

// Parse and validate a JSON request body against a Zod schema. A malformed body
// (invalid JSON or a schema mismatch) yields a 400 carrying `errorMessage`;
// anything unexpected re-throws. Callers branch on `ok` rather than try/catch.
export async function parseJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  errorMessage: string,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  try {
    return { ok: true, data: schema.parse(await request.json()) };
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return {
        ok: false,
        response: noStoreJson({ error: errorMessage }, { status: 400 }),
      };
    }
    throw error;
  }
}
