"use client";

import {
  ArrowRight,
  CloudUpload,
  FolderTree,
  PenLine,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { MarkerCircle, ScribbleUnderline, Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/* -------------------------------------------------------------------------- */
/*  Auth-aware calls to action                                                 */
/* -------------------------------------------------------------------------- */

function PrimaryCtaContent() {
  return (
    <>
      Start drawing — free
      <ArrowRight />
    </>
  );
}

function HeroCtas() {
  if (!hasClerk) {
    return (
      <Button asChild size="lg" className="h-11 px-5 text-base shadow-sketch">
        <Link href="/dashboard">
          Open the app
          <ArrowRight />
        </Link>
      </Button>
    );
  }
  return (
    <Button asChild size="lg" className="h-11 px-5 text-base shadow-sketch">
      <Link href="/sign-up">
        <PrimaryCtaContent />
      </Link>
    </Button>
  );
}

function NavAuthLinks() {
  if (!hasClerk) {
    return (
      <Button asChild size="sm" className="h-9 px-3.5">
        <Link href="/dashboard">Open app</Link>
      </Button>
    );
  }
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="h-9 px-3.5">
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild size="sm" className="h-9 px-3.5 shadow-sketch-sm">
        <Link href="/sign-up">Get started</Link>
      </Button>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero product mock                                                          */
/* -------------------------------------------------------------------------- */

const DOODLE_PATHS: Record<string, React.ReactNode> = {
  flow: (
    <>
      <rect x="8" y="10" width="22" height="13" rx="2" />
      <rect x="48" y="10" width="22" height="13" rx="2" />
      <rect x="28" y="34" width="22" height="13" rx="2" />
      <path d="M30 16h18M40 23v11M50 23 39 34" />
    </>
  ),
  wire: (
    <>
      <rect x="9" y="9" width="60" height="40" rx="2" />
      <path d="M9 19h60M16 27h26M16 33h34M16 39h20" />
    </>
  ),
  mind: (
    <>
      <circle cx="39" cy="29" r="9" />
      <circle cx="15" cy="14" r="5" />
      <circle cx="64" cy="16" r="5" />
      <circle cx="60" cy="44" r="5" />
      <path d="m31 24-12-7M47 25l12-7M45 35l12 6" />
    </>
  ),
};

function MiniDoodle({
  variant,
  color,
}: {
  variant: keyof typeof DOODLE_PATHS;
  color: string;
}) {
  return (
    <svg
      viewBox="0 0 78 58"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
      aria-hidden="true"
    >
      {DOODLE_PATHS[variant]}
    </svg>
  );
}

function HeroMock() {
  const scenes: {
    title: string;
    variant: keyof typeof DOODLE_PATHS;
    color: string;
  }[] = [
    { title: "Onboarding flow", variant: "flow", color: "var(--chart-1)" },
    { title: "Mobile wireframe", variant: "wire", color: "var(--chart-5)" },
    { title: "Q3 roadmap", variant: "mind", color: "var(--chart-3)" },
    { title: "Auth states", variant: "flow", color: "var(--chart-2)" },
  ];

  return (
    <div className="relative">
      {/* Floating sticky annotations */}
      <div
        className="animate-bob absolute -left-4 -top-5 z-20 hidden rotate-[-7deg] rounded-xl bg-[var(--chart-4)] px-3 py-2 text-sm font-semibold text-[oklch(0.25_0.04_80)] shadow-sketch-sm sm:block"
        style={{ ["--rot" as string]: "-7deg" }}
      >
        autosaved ✏️
      </div>
      <div
        className="animate-bob absolute -right-3 top-24 z-20 hidden rotate-[6deg] rounded-xl bg-[var(--chart-3)] px-3 py-2 text-sm font-semibold text-[oklch(0.99_0_0)] shadow-sketch-sm md:block"
        style={{ ["--rot" as string]: "6deg", animationDelay: "1.2s" }}
      >
        all in folders
      </div>

      <div className="sketch-edge overflow-hidden rounded-2xl bg-card shadow-sketch">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-3">
          <span className="size-3 rounded-full bg-[var(--chart-2)]" />
          <span className="size-3 rounded-full bg-[var(--chart-4)]" />
          <span className="size-3 rounded-full bg-[var(--chart-3)]" />
          <span className="ml-3 font-mono text-xs text-muted-foreground">
            scenevault.app/dashboard
          </span>
        </div>

        <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[150px_1fr]">
          {/* Sidebar */}
          <div className="hidden flex-col gap-1 border-r border-border bg-sidebar/60 p-3 sm:flex">
            {["All scenes", "Product", "Personal", "Archive"].map(
              (label, i) => (
                <div
                  key={label}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    i === 1
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  <FolderTree className="size-3.5" />
                  {label}
                </div>
              ),
            )}
          </div>

          {/* Scene grid */}
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-sm font-bold">Product</span>
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                4 scenes
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {scenes.map((scene) => (
                <div
                  key={scene.title}
                  className="rounded-xl border border-border bg-background p-2"
                >
                  <div className="bg-paper-dots flex h-16 items-center justify-center rounded-lg border border-border/70 p-2">
                    <div className="h-full w-full max-w-[78px]">
                      <MiniDoodle variant={scene.variant} color={scene.color} />
                    </div>
                  </div>
                  <p className="mt-2 truncate text-[11px] font-medium">
                    {scene.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sections                                                                   */
/* -------------------------------------------------------------------------- */

const FEATURES = [
  {
    icon: FolderTree,
    color: "var(--chart-1)",
    title: "Folders that nest",
    body: "Group scenes by project, client, or whim. Nest folders as deep as your work goes — everything stays one click away.",
  },
  {
    icon: CloudUpload,
    color: "var(--chart-3)",
    title: "Autosave, always",
    body: "Every stroke saves to the cloud as you draw. Close the tab mid-thought and it's exactly where you left it.",
  },
  {
    icon: PenLine,
    color: "var(--chart-2)",
    title: "The real editor",
    body: "Not a lookalike. The full Excalidraw canvas is embedded and ready — the same tools you already love.",
  },
  {
    icon: Search,
    color: "var(--chart-5)",
    title: "Find it instantly",
    body: "Search across every title and folder in a keystroke. The drawing you made last month is never more than a few letters away.",
  },
];

const STEPS = [
  {
    title: "Make a folder",
    body: "Start with a home for the project — a roadmap, a redesign, a class.",
  },
  {
    title: "Open a scene and draw",
    body: "The full Excalidraw canvas opens in one click. Sketch away.",
  },
  {
    title: "Come back any time",
    body: "It's already saved to the cloud. Pick up on any device, anywhere.",
  },
];

function FeatureCard({
  icon: Icon,
  color,
  title,
  body,
}: (typeof FEATURES)[number]) {
  return (
    <div className="sketch-card bg-card p-6 transition-transform duration-200 hover:-translate-y-1 hover:-rotate-1">
      <span
        className="mb-4 inline-flex size-11 items-center justify-center rounded-xl"
        style={{
          backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
        }}
      >
        <Icon className="size-5" style={{ color }} />
      </span>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export function LandingPage() {
  return (
    <div className="bg-paper-dots flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Wordmark />
          <nav className="hidden items-center gap-1 md:flex">
            <Button asChild variant="ghost" size="sm" className="h-9 px-3.5">
              <Link href="#features">Features</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-9 px-3.5">
              <Link href="#how">How it works</Link>
            </Button>
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <NavAuthLinks />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <span
              className="animate-float-up inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sketch-sm"
              style={{ animationDelay: "0ms" }}
            >
              <Sparkles className="size-3.5 text-primary" />
              Built for Excalidraw
            </span>

            <h1
              className="animate-float-up mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
              style={{ animationDelay: "80ms" }}
            >
              Every sketch in one{" "}
              <span className="relative inline-block whitespace-nowrap text-primary">
                place
                <ScribbleUnderline />
              </span>{" "}
              you&apos;ll find again.
            </h1>

            <p
              className="animate-float-up mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
              style={{ animationDelay: "160ms" }}
            >
              Your Excalidraw drawings keep ending up in a folder called
              Downloads. SceneVault gives them a real home: tidy folders,
              autosave to the cloud, and the full editor in one click.
            </p>

            <div
              className="animate-float-up mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "240ms" }}
            >
              <HeroCtas />
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-11 px-5 text-base"
              >
                <Link href="#how">See how it works</Link>
              </Button>
            </div>

            <p
              className="animate-float-up mt-4 text-sm text-muted-foreground"
              style={{ animationDelay: "320ms" }}
            >
              Free to start. Your scenes, your account, no clutter.
            </p>
          </div>

          <div
            className="animate-float-up lg:pl-4"
            style={{ animationDelay: "300ms" }}
          >
            <HeroMock />
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-16"
        >
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
              What you get
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              A library, not a junk drawer
            </h2>
            <p className="mt-3 text-muted-foreground">
              Everything you need to keep a growing pile of drawings calm,
              searchable, and saved.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </section>

        {/* How it works — a genuine 3-step sequence */}
        <section
          id="how"
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-16"
        >
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
              How it works
            </p>
            <h2 className="relative mt-3 inline-block font-display text-3xl font-bold sm:text-4xl">
              Three steps to tidy
              <MarkerCircle />
            </h2>
          </div>
          <ol className="mt-14 grid gap-8 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative">
                <span className="font-display text-5xl font-bold text-primary/30">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 font-display text-xl font-bold">
                  {step.title}
                </h3>
                <p className="mt-2 text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA band */}
        <section className="mx-auto w-full max-w-6xl px-5 py-16">
          <div className="sketch-edge relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground shadow-sketch">
            <div className="bg-paper-dots pointer-events-none absolute inset-0 opacity-20" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold sm:text-4xl">
                Bring order to the chaos
              </h2>
              <p className="mx-auto mt-3 max-w-md text-primary-foreground/80">
                Give your next idea a home before it gets lost. It takes about
                ten seconds to start.
              </p>
              <div className="mt-8 flex justify-center">
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="h-11 px-6 text-base shadow-sketch-sm"
                >
                  <Link href={hasClerk ? "/sign-up" : "/dashboard"}>
                    {hasClerk ? "Create your library" : "Open the app"}
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <Wordmark className="text-base" href={null} iconClassName="size-6" />
          <p className="text-sm text-muted-foreground">
            A cozy home for your Excalidraw drawings.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="#features" className="hover:text-foreground">
              Features
            </Link>
            <Link href="#how" className="hover:text-foreground">
              How it works
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
