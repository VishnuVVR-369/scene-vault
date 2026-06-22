"use client";

import { SignUp } from "@clerk/nextjs";

import { AuthNotConfigured, AuthShell } from "@/components/auth-shell";
import { useTheme } from "@/components/theme-provider";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  const { resolvedTheme } = useTheme();

  return (
    <AuthShell highlightWord="home">
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
        <SignUp appearance={clerkAppearance(resolvedTheme)} />
      ) : (
        <AuthNotConfigured action="sign-up" />
      )}
    </AuthShell>
  );
}
