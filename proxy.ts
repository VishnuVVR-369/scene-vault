import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Note: /share/e is intentionally NOT protected — anonymous guests can join an
// edit room via the share token. The token gates reads, and write routes
// (upload/commit/duplicate) still require sign-in on their own.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/scenes(.*)",
  "/api/scenes(.*)",
]);
const hasClerk = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

export default clerkMiddleware(async (auth, req) => {
  if (!hasClerk || process.env.NEXT_PUBLIC_LOCAL_DATA === "1") {
    return;
  }
  // Signed-in users skip the landing page and go straight to their dashboard.
  if (req.nextUrl.pathname === "/") {
    const { userId } = await auth();
    if (userId) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return;
  }
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
