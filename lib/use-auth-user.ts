"use client";

import { authClient } from "@/lib/auth-client";

export function useAuthUser() {
  const session = authClient.useSession();
  const user = session.data?.user;

  return {
    isLoaded: !session.isPending,
    isSignedIn: Boolean(user),
    user: user
      ? {
          id: user.id,
          name: user.name || user.email || "You",
          email: user.email,
          image: user.image ?? null,
        }
      : null,
  };
}
