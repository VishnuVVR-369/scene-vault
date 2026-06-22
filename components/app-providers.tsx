"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { type ReactNode, useMemo } from "react";

import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

function ConvexBoundary({ children }: { children: ReactNode }) {
  const convex = useMemo(() => {
    if (!convexUrl || !hasClerk) {
      return null;
    }
    return new ConvexReactClient(convexUrl);
  }, []);

  if (!convex) {
    return children;
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
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

  if (!hasClerk) {
    return content;
  }

  return <ClerkProvider>{content}</ClerkProvider>;
}
