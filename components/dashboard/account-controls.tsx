"use client";

import { UserButton } from "@clerk/nextjs";

import { useTheme } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { clerkAppearance } from "@/lib/clerk-appearance";

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export function AccountControls() {
  const { resolvedTheme } = useTheme();
  return (
    <div className="flex items-center gap-1.5">
      <ThemeToggle />
      {hasClerk ? (
        <UserButton
          appearance={{ variables: clerkAppearance(resolvedTheme).variables }}
        />
      ) : (
        <Badge variant="outline" className="hidden sm:inline-flex">
          Local mode
        </Badge>
      )}
    </div>
  );
}
