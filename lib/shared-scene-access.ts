import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { noStoreJson } from "@/lib/scene-storage-access";

export type SharedSceneMode = "view" | "edit";

export type SharedSceneAccess = {
  sceneId: string;
  storageOwnerId: string;
  mode: SharedSceneMode;
  title: string;
  version: number;
  currentObjectKey: string | null;
  thumbnailObjectKey: string | null;
  byteSize: number;
  contentHash: string | null;
  updatedAt: number;
  lastSavedAt: number | null;
};

const getSharedSceneByToken = makeFunctionReference<
  "query",
  { token: string; requiredMode?: SharedSceneMode },
  SharedSceneAccess | null
>("library:getSharedSceneByToken");

export type SharedSceneAuthResult =
  | { ok: true; userId: string | null; access: SharedSceneAccess }
  | { ok: false; response: Response };

export async function requireSharedSceneAccess(
  token: string,
  options: {
    requiredMode?: SharedSceneMode;
    requireAuth?: boolean;
    requireAuthForEdit?: boolean;
  } = {},
): Promise<SharedSceneAuthResult> {
  const requireAuthForEdit = options.requireAuthForEdit ?? true;
  let userId: string | null = null;
  if (options.requireAuth) {
    const authResult = await auth();
    userId = authResult.userId;
    if (!userId) {
      return {
        ok: false,
        response: noStoreJson({ error: "Unauthorized" }, { status: 401 }),
      };
    }
  }

  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return {
      ok: false,
      response: noStoreJson(
        { error: "Sharing is not configured" },
        { status: 503 },
      ),
    };
  }

  try {
    const access = await fetchQuery(getSharedSceneByToken, {
      token,
      ...(options.requiredMode ? { requiredMode: options.requiredMode } : {}),
    });
    if (!access) {
      return {
        ok: false,
        response: noStoreJson(
          { error: "Share link not found" },
          { status: 404 },
        ),
      };
    }
    if (requireAuthForEdit && access.mode === "edit" && !userId) {
      const authResult = await auth();
      userId = authResult.userId;
      if (!userId) {
        return {
          ok: false,
          response: noStoreJson({ error: "Unauthorized" }, { status: 401 }),
        };
      }
    }
    return { ok: true, userId, access };
  } catch {
    return {
      ok: false,
      response: noStoreJson({ error: "Share link not found" }, { status: 404 }),
    };
  }
}

export function referrerSafeHeaders(headers?: HeadersInit) {
  const next = new Headers(headers);
  next.set("referrer-policy", "no-referrer");
  return next;
}
