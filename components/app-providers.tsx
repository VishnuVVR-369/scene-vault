"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { AuthClient } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import { type ReactNode, useMemo } from "react";

import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const betterAuthClient = authClient as unknown as AuthClient;

function ConvexBoundary({ children }: { children: ReactNode }) {
  const convex = useMemo(() => {
    if (!convexUrl || process.env.NEXT_PUBLIC_LOCAL_DATA === "1") {
      return null;
    }
    return new ConvexReactClient(convexUrl);
  }, []);

  if (!convex) {
    return children;
  }

  return (
    <ConvexBetterAuthProvider client={convex} authClient={betterAuthClient}>
      {children}
    </ConvexBetterAuthProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  const content = (
    <TooltipProvider delayDuration={300}>
      <ToastProvider>
        <ConvexBoundary>{children}</ConvexBoundary>
      </ToastProvider>
    </TooltipProvider>
  );

  return content;
}
