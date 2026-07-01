import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexSiteUrl =
  process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

export const hasAuthConfig = Boolean(
  process.env.NEXT_PUBLIC_LOCAL_DATA !== "1" && convexUrl && convexSiteUrl,
);

function getAuthServer() {
  if (!convexUrl || !convexSiteUrl) {
    throw new Error("Better Auth is not configured");
  }

  return convexBetterAuthNextJs({
    convexUrl,
    convexSiteUrl,
  });
}

export async function getConvexAuthToken() {
  if (!hasAuthConfig) {
    return undefined;
  }
  return getAuthServer().getToken();
}

export async function isAuthenticated() {
  if (!hasAuthConfig) {
    return false;
  }
  return getAuthServer().isAuthenticated();
}

export const authHandler = {
  GET(request: Request) {
    return getAuthServer().handler.GET(request);
  },
  POST(request: Request) {
    return getAuthServer().handler.POST(request);
  },
};
