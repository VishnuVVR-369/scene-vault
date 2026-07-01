import { NextResponse, type NextRequest } from "next/server";

// /share/e is intentionally public. Shared write routes and scene storage
// routes still re-check auth/ownership server-side.
const protectedPrefixes = ["/dashboard", "/scenes", "/api/scenes"];

function hasBetterAuthSession(req: NextRequest) {
  return req.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("session_token"));
}

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function proxy(req: NextRequest) {
  if (
    process.env.NEXT_PUBLIC_LOCAL_DATA === "1" ||
    !process.env.NEXT_PUBLIC_CONVEX_URL
  ) {
    return;
  }

  const signedIn = hasBetterAuthSession(req);

  if (req.nextUrl.pathname === "/" && signedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isProtectedPath(req.nextUrl.pathname) && !signedIn) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
