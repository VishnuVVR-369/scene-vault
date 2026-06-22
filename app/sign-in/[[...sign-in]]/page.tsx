"use client";

import { SignIn } from "@clerk/nextjs";

import { AuthNotConfigured, AuthShell } from "@/components/auth-shell";
import { useTheme } from "@/components/theme-provider";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  const { resolvedTheme } = useTheme();

  return (
    <AuthShell highlightWord="welcome">
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
        <SignIn appearance={clerkAppearance(resolvedTheme)} />
      ) : (
        <AuthNotConfigured action="sign-in" />
      )}
    </AuthShell>
  );
}
