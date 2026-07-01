"use client";

import { ArrowLeft, CloudUpload, FolderTree, PenLine } from "lucide-react";
import Link from "next/link";

import { OAuthButtons } from "@/components/auth-buttons";
import { ScribbleUnderline, Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

type Mode = "sign-in" | "sign-up";

const COPY: Record<
  Mode,
  {
    /** Emphasised word in the side-panel headline. */
    highlightWord: string;
    title: string;
    subtitle: string;
    action: string;
    switchPrompt: string;
    switchCta: string;
    switchHref: string;
  }
> = {
  "sign-in": {
    highlightWord: "welcome",
    title: "Welcome back",
    subtitle: "Sign in to pick up right where your sketches left off.",
    action: "sign in",
    switchPrompt: "New to SceneVault?",
    switchCta: "Create an account",
    switchHref: "/sign-up",
  },
  "sign-up": {
    highlightWord: "home",
    title: "Create your account",
    subtitle: "Your cozy home for every Excalidraw drawing — free to start.",
    action: "sign up",
    switchPrompt: "Already have an account?",
    switchCta: "Sign in",
    switchHref: "/sign-in",
  },
};

const HIGHLIGHTS = [
  {
    icon: FolderTree,
    color: "var(--chart-1)",
    text: "Tidy folders for every project",
  },
  {
    icon: CloudUpload,
    color: "var(--chart-3)",
    text: "Autosave to the cloud as you draw",
  },
  {
    icon: PenLine,
    color: "var(--chart-2)",
    text: "The full Excalidraw editor, built in",
  },
];

const hasRemoteAuth = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

export function AuthShell({ mode }: { mode: Mode }) {
  const copy = COPY[mode];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Branded showcase panel */}
      <aside className="bg-paper-dots relative hidden flex-col justify-between overflow-hidden border-r border-border bg-sidebar p-10 lg:flex">
        {/* Floating annotation, echoing the landing hero */}
        <div
          className="animate-bob pointer-events-none absolute right-9 top-32 z-0 hidden rotate-[7deg] rounded-xl bg-[var(--chart-4)] px-3 py-2 text-sm font-semibold text-[oklch(0.25_0.04_80)] shadow-sketch-sm xl:block"
          style={{ ["--rot" as string]: "7deg" }}
        >
          autosaved ✏️
        </div>

        <Wordmark />

        <div className="relative z-10 max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight">
            A cozy{" "}
            <span className="relative inline-block text-primary">
              {copy.highlightWord}
              <ScribbleUnderline />
            </span>{" "}
            for your Excalidraw drawings.
          </h1>
          <ul className="mt-8 space-y-3.5">
            {HIGHLIGHTS.map(({ icon: Icon, color, text }) => (
              <li
                key={text}
                className="flex items-center gap-3 text-[0.95rem] text-foreground/80"
              >
                <span
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
                  }}
                >
                  <Icon className="size-4" style={{ color }} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* Warm testimonial, styled as a pinned scene card */}
        <figure className="sketch-edge relative z-10 max-w-sm rotate-[-1.5deg] rounded-2xl bg-card p-5 shadow-sketch">
          <p className="font-display text-lg leading-snug">
            &ldquo;Finally, my sketches aren&apos;t lost in a Downloads
            folder.&rdquo;
          </p>
          <figcaption className="mt-3 flex items-center gap-2.5 text-sm text-muted-foreground">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/15 font-display text-xs font-bold text-primary">
              MK
            </span>
            Maya K.&nbsp;·&nbsp;Product designer
          </figcaption>
        </figure>
      </aside>

      {/* Form column */}
      <main className="bg-paper-dots relative flex flex-col px-5 lg:bg-none">
        <div className="flex h-16 items-center justify-between">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 h-9 px-2.5"
          >
            <Link href="/">
              <ArrowLeft />
              Back home
            </Link>
          </Button>
          <div className="flex items-center gap-1.5">
            <Button asChild variant="ghost" size="sm" className="h-9 px-3.5">
              <Link href="/docs">Docs</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center pb-16">
          <div className="w-full max-w-sm">
            <div className="mb-6 lg:hidden">
              <Wordmark />
            </div>

            <div className="sketch-edge animate-float-up rounded-2xl bg-card p-7 shadow-sketch sm:p-8">
              <h2 className="font-display text-2xl font-bold tracking-tight">
                {copy.title}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {copy.subtitle}
              </p>

              <div className="mt-6">
                {hasRemoteAuth ? (
                  <OAuthButtons />
                ) : (
                  <AuthNotConfigured action={copy.action} />
                )}
              </div>

              {hasRemoteAuth ? (
                <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
                  By continuing, you agree to our{" "}
                  <Link
                    href="/docs"
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    Terms
                  </Link>{" "}
                  &amp;{" "}
                  <Link
                    href="/docs"
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              ) : null}
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {copy.switchPrompt}{" "}
              <Link
                href={copy.switchHref}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                {copy.switchCta}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function AuthNotConfigured({ action }: { action: string }) {
  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground">
        Add your Better Auth and Convex settings to enable {action}. You can
        still explore the app in local mode.
      </p>
      <Button asChild size="lg" className="mt-5 h-11 w-full">
        <Link href="/dashboard">Open the app in local mode</Link>
      </Button>
    </div>
  );
}
