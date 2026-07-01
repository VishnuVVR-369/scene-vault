"use client";

import { LogOut, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { useAuthUser } from "@/lib/use-auth-user";

export function AccountControls() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useAuthUser();

  return (
    <div className="flex items-center gap-1.5">
      <ThemeToggle />
      {!process.env.NEXT_PUBLIC_CONVEX_URL ? (
        <Badge variant="outline" className="hidden sm:inline-flex">
          Local mode
        </Badge>
      ) : isLoaded && isSignedIn && user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Account">
              <UserCircle />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">
              {user.name}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                await authClient.signOut();
                router.push("/");
                router.refresh();
              }}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
