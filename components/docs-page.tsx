"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  Clock,
  CloudUpload,
  Copy,
  Database,
  Download,
  FileCode2,
  FolderTree,
  Hash,
  KeyRound,
  Layers,
  Lock,
  Menu,
  MousePointer2,
  Network,
  PenLine,
  Radio,
  RefreshCw,
  Rocket,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Timer,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Navigation model — ids must match the section anchors below.               */
/* -------------------------------------------------------------------------- */

type NavItem = { id: string; label: string };
type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "Getting started",
    items: [
      { id: "overview", label: "Overview" },
      { id: "quickstart", label: "Quickstart" },
      { id: "features", label: "Features" },
    ],
  },
  {
    title: "Architecture",
    items: [
      { id: "stack", label: "Tech stack" },
      { id: "architecture", label: "How it fits together" },
      { id: "data-flows", label: "Request & data flows" },
      { id: "data-model", label: "Data model" },
      { id: "storage", label: "Scene storage & R2" },
      { id: "consistency", label: "Consistency model" },
    ],
  },
  {
    title: "Security & sharing",
    items: [
      { id: "auth", label: "Trust boundaries" },
      { id: "sharing", label: "Share links" },
      { id: "live-collab", label: "Live collaboration" },
    ],
  },
  {
    title: "Operations",
    items: [
      { id: "failure-modes", label: "Failure modes" },
      { id: "modes", label: "Local vs production" },
      { id: "production", label: "Production setup" },
      { id: "structure", label: "Project structure" },
    ],
  },
  {
    title: "Reference",
    items: [
      { id: "api-routes", label: "API routes" },
      { id: "env", label: "Environment variables" },
      { id: "scripts", label: "Scripts & testing" },
    ],
  },
];

const ALL_IDS = NAV.flatMap((group) => group.items.map((item) => item.id));

/* -------------------------------------------------------------------------- */
/*  Small presentational primitives                                            */
/* -------------------------------------------------------------------------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
      {children}
    </p>
  );
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-border/60 py-14">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Lead({ children }: { children: React.ReactNode }) {
  return <p className="max-w-2xl text-base text-foreground/80">{children}</p>;
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-2 font-display text-lg font-bold text-foreground">
      {children}
    </h3>
  );
}

function CodeBlock({
  code,
  filename,
  language = "bash",
}: {
  code: string;
  filename?: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <div className="not-prose group relative overflow-hidden rounded-xl border border-border bg-[oklch(0.22_0.006_285)] shadow-sketch-sm dark:bg-[oklch(0.18_0.006_285)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-mono text-xs text-white/55">
          {filename ?? language}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] text-white/55 transition-colors hover:bg-white/10 hover:text-white/90"
        >
          {copied ? (
            <>
              <Check className="size-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 text-[13px] leading-relaxed">
        <code className="font-mono text-[oklch(0.92_0.02_90)]">{code}</code>
      </pre>
    </div>
  );
}

function Callout({
  variant = "note",
  title,
  children,
}: {
  variant?: "note" | "warn" | "tip";
  title: string;
  children: React.ReactNode;
}) {
  const tone = {
    note: { color: "var(--chart-5)", icon: Sparkles },
    tip: { color: "var(--chart-3)", icon: Rocket },
    warn: { color: "var(--chart-2)", icon: KeyRound },
  }[variant];
  const Icon = tone.icon;
  return (
    <div
      className="flex gap-3 rounded-xl border border-border bg-card p-4"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: tone.color,
      }}
    >
      <Icon
        className="mt-0.5 size-4.5 shrink-0"
        style={{ color: tone.color }}
      />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-secondary/70 px-2.5 py-0.5 font-mono text-[11px] font-medium text-secondary-foreground">
      {children}
    </span>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.82em] text-foreground">
      {children}
    </code>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section content data                                                       */
/* -------------------------------------------------------------------------- */

const FEATURES = [
  {
    icon: FolderTree,
    color: "var(--chart-1)",
    title: "Nested folders",
    body: "Organise scenes into folders nested as deep as you like. Move and rename freely — cycle-safe moves are enforced server-side.",
  },
  {
    icon: CloudUpload,
    color: "var(--chart-3)",
    title: "Cloud autosave",
    body: "Every edit streams to Cloudflare R2 and a content hash skips no-op writes, so the version only bumps when the drawing truly changes.",
  },
  {
    icon: PenLine,
    color: "var(--chart-2)",
    title: "The real editor",
    body: "The full @excalidraw/excalidraw canvas is embedded — not a clone. All native tools, libraries, and exports work as expected.",
  },
  {
    icon: Search,
    color: "var(--chart-5)",
    title: "Instant search",
    body: "Filter the whole library by scene title or folder name in a keystroke, entirely client-side over a live Convex subscription.",
  },
  {
    icon: Share2,
    color: "var(--chart-1)",
    title: "Share links",
    body: "Mint view-only or editable links per scene. Tokens are rotatable and revocable, and gate access without exposing your account.",
  },
  {
    icon: Users,
    color: "var(--chart-3)",
    title: "Live collaboration",
    body: "Start a real-time room on any scene. Per-element last-write-wins reconciliation, live cursors, and presence — durable in Convex.",
  },
  {
    icon: Layers,
    color: "var(--chart-2)",
    title: "Thumbnails & previews",
    body: "Scenes render a PNG thumbnail on save, served through an authenticated, cache-friendly proxy route for a fast dashboard grid.",
  },
  {
    icon: Lock,
    color: "var(--chart-5)",
    title: "Validated boundaries",
    body: "Zod schemas guard every app, storage, and client-data boundary, so malformed payloads are rejected before they reach storage.",
  },
];

const STACK = [
  {
    name: "Next.js 16",
    role: "App Router, route handlers, proxy",
    color: "var(--chart-1)",
  },
  {
    name: "React 19",
    role: "Server & client components",
    color: "var(--chart-5)",
  },
  {
    name: "Excalidraw 0.18",
    role: "The embedded drawing canvas",
    color: "var(--chart-2)",
  },
  {
    name: "Better Auth",
    role: "Authentication & session management",
    color: "var(--chart-3)",
  },
  {
    name: "Convex",
    role: "Reactive metadata database & live rooms",
    color: "var(--chart-1)",
  },
  {
    name: "Cloudflare R2",
    role: "Scene bundle & thumbnail object storage",
    color: "var(--chart-5)",
  },
  {
    name: "Tailwind CSS v4",
    role: "Styling + shadcn / Radix UI primitives",
    color: "var(--chart-2)",
  },
  {
    name: "Zod v4",
    role: "Runtime validation at every boundary",
    color: "var(--chart-3)",
  },
];

const SCHEMA = [
  {
    name: "profiles",
    desc: "SceneVault app profile keyed by the Better Auth subject. Created lazily on first write.",
    fields: "authSubject · timestamps",
    indexes: ["by_auth_subject"],
  },
  {
    name: "folders",
    desc: "Nested folder tree, profile-scoped. Self-referential parentFolderId; moves are cycle-checked server-side.",
    fields: "profileId · name · parentFolderId · timestamps",
    indexes: ["by_profile", "by_profile_parent"],
  },
  {
    name: "scenes",
    desc: "Scene metadata and the authoritative pointer to current bytes: title, folder, monotonic version, R2 object keys, byte size, and content hash.",
    fields:
      "profileId · title · folderId · version · currentObjectKey · contentHash",
    indexes: ["by_profile_folder", "by_profile_updated"],
  },
  {
    name: "sceneShares",
    desc: "View / edit share tokens per scene. Enable, disable, or rotate without touching the scene. At most one row per (scene, mode).",
    fields: "sceneId · profileId · mode · token · enabled",
    indexes: ["by_token", "by_scene_mode", "by_profile"],
  },
  {
    name: "liveRooms",
    desc: "At most one live room per scene. Tracks lifecycle status, epoch, hydration claim, and snapshot watermark/hash for safe GC.",
    fields: "sceneId · status · epoch · snapshotMaxUpdatedAt · snapshotHash",
    indexes: ["by_scene"],
  },
  {
    name: "roomElements",
    desc: "Live working set — one row per element. Per-element last-write-wins via version / versionNonce. Tombstones converge deletes.",
    fields: "sceneId · elementId · data · version · versionNonce",
    indexes: ["by_scene", "by_scene_element"],
  },
  {
    name: "roomSessions",
    desc: "Server-issued session identity. The cleartext secret is returned once by joinRoom; only its SHA-256 hash is stored.",
    fields: "sceneId · roomSessionId · sessionSecretHash · userId",
    indexes: ["by_scene", "by_room_session"],
  },
  {
    name: "presence",
    desc: "Ephemeral cursor / selection presence. Name and colour are denormalised so getPresence is a single index read, no joins. Swept by TTL.",
    fields: "sceneId · cursorX · cursorY · selectedIds · color · lastSeenAt",
    indexes: ["by_scene", "by_room_session"],
  },
  {
    name: "collabRateLimits",
    desc: "Token-bucket rate limiting per (session, action). Isolated to its own row so it never contends with element or presence writes.",
    fields: "sceneId · roomSessionId · action · tokens",
    indexes: ["by_key"],
  },
];

const DATA_FLOWS = [
  {
    icon: Upload,
    color: "var(--chart-3)",
    title: "Save",
    summary: "Editor → presigned PUT → R2 → commit mutation → fan-out",
    steps: [
      "The editor debounces changes and serialises the scene to Excalidraw JSON, computing a SHA-256 content hash.",
      "Client POSTs /api/scenes/[id]/upload; the handler resolves ownership via Convex and mints a presigned R2 PUT URL.",
      "Client uploads the bundle bytes (and, separately, a rendered PNG thumbnail) straight to R2.",
      "commitSceneSave records the object key, byte size, and content hash — recomputing the expected key and rejecting any mismatch.",
      "If the content hash is unchanged the mutation is a no-op; otherwise version++ and the reactive getLibrary subscription pushes to every tab.",
    ],
  },
  {
    icon: Download,
    color: "var(--chart-1)",
    title: "Load",
    summary: "getLibrary pointer → presigned GET → R2",
    steps: [
      "The editor reads the current object key from the profile-scoped getLibrary subscription.",
      "Client GETs /api/scenes/[id]/download; the route re-checks access with getSceneStorageAccess and mints a presigned R2 GET URL.",
      "Client fetches the bundle bytes directly from R2 and hydrates the canvas — bytes never pass through the Next.js server.",
    ],
  },
  {
    icon: Layers,
    color: "var(--chart-2)",
    title: "Thumbnail",
    summary: "Rendered client-side → presigned PUT → authenticated proxy",
    steps: [
      "On save the client renders a PNG preview and uploads it via a presigned PUT to a deterministic thumbnail key.",
      "The dashboard requests /api/scenes/[id]/thumbnail?v=<version> — an authenticated proxy that streams the PNG with an immutable cache header.",
      "Because the URL carries the scene version, a new save busts the cache automatically; a failed thumbnail upload never wipes the existing one.",
    ],
  },
];

const TRUST_LAYERS = [
  {
    icon: ShieldCheck,
    title: "Edge — Better Auth proxy",
    body: "proxy.ts gates /dashboard, /scenes, and /api/scenes by checking for a Better Auth session cookie. /share/e is deliberately public so guests can join an edit room by token. In local demo mode the proxy short-circuits entirely.",
    accent: "var(--chart-1)",
  },
  {
    icon: KeyRound,
    title: "Route handler — server-derived identity",
    body: "Each storage route re-derives the Better Auth session server-side, mints a fresh Convex JWT, and asks Convex which profile owns the scene. The profile id used to build the R2 key comes back from Convex — never from the request.",
    accent: "var(--chart-3)",
  },
  {
    icon: Database,
    title: "Convex — profile-scoped data layer",
    body: "Every query and mutation independently resolves the caller via ctx.auth, maps the Better Auth subject to a SceneVault profile, and filters by profileId. Commit mutations recompute the expected object key and reject mismatches, so a forged key can't escape the caller's namespace.",
    accent: "var(--chart-5)",
  },
];

const ROOM_STATES = [
  {
    state: "empty",
    desc: "Room started on a scene with no durable bytes yet — ready to edit from scratch.",
  },
  {
    state: "needsHydration",
    desc: "A durable R2 snapshot exists and must seed the working set before edits begin.",
  },
  {
    state: "hydrating",
    desc: "The first joiner has claimed seeding from R2. A stale claim (>15s) can be re-claimed.",
  },
  {
    state: "ready",
    desc: "The live working set in Convex is authoritative; clients reconcile against it in real time.",
  },
];

const COLLAB_SPEC = [
  {
    name: "PRESENCE_TTL_MS",
    value: "15 s",
    desc: "Presence older than this is offline.",
  },
  {
    name: "HEARTBEAT_INTERVAL_MS",
    value: "5 s",
    desc: "Client presence heartbeat cadence.",
  },
  {
    name: "CURSOR_THROTTLE_MS",
    value: "100 ms",
    desc: "Outbound cursor update throttle (~10/s).",
  },
  {
    name: "ELEMENT_FLUSH_MS",
    value: "250 ms",
    desc: "Element-broadcast debounce.",
  },
  {
    name: "SNAPSHOT_DEBOUNCE_MS",
    value: "4 s",
    desc: "Snapshot-to-R2 debounce.",
  },
  {
    name: "ROOM_IDLE_GRACE_MS",
    value: "60 s",
    desc: "Idle grace before a clean room is GC-eligible.",
  },
  {
    name: "MAX_ELEMENTS_PER_SCENE",
    value: "10,000",
    desc: "Above this, live mode falls back to single-user save.",
  },
  {
    name: "MAX_BATCH_ELEMENTS",
    value: "256",
    desc: "Elements per push / hydration batch.",
  },
  {
    name: "MAX_ELEMENT_BYTES",
    value: "128 KB",
    desc: "Per-element serialised cap (images live in R2).",
  },
  {
    name: "MAX_SESSIONS_PER_ROOM",
    value: "64",
    desc: "Hard cap on simultaneous room sessions.",
  },
];

const RATE_LIMITS = [
  {
    action: "joinRoom",
    rate: "2 / s",
    burst: "12",
    desc: "Caps how fast a session can (re)join, blunting reconnect storms.",
  },
  {
    action: "pushElements",
    rate: "12 / s",
    burst: "24",
    desc: "Bounds element-broadcast throughput per session.",
  },
  {
    action: "updatePresence",
    rate: "20 / s",
    burst: "40",
    desc: "Absorbs cursor bursts while still throttling sustained spam.",
  },
];

const VALIDATION_BOUNDS = [
  {
    name: "MAX_ELEMENT_BYTES",
    value: "128 KB",
    desc: "Per element, serialised — images live in R2, not the row.",
  },
  {
    name: "MAX_BATCH_ELEMENTS",
    value: "256",
    desc: "Elements per push / hydration batch.",
  },
  {
    name: "MAX_SELECTED_IDS",
    value: "1,000",
    desc: "Selection ids carried in a presence update.",
  },
  {
    name: "MAX_NAME_LENGTH",
    value: "40",
    desc: "Collaborator display name, trimmed server-side.",
  },
  {
    name: "MAX_ELEMENT_ID_LENGTH",
    value: "255",
    desc: "Rejects oversized element identifiers.",
  },
];

const FAILURE_MODES = [
  {
    icon: Network,
    title: "Browser crash mid-edit",
    body: "The live working set lives in Convex, and the sweep cron never collects a dirty room — so unsnapshotted edits survive even if every tab disconnects. On rejoin the room rehydrates from the R2 head plus the live set.",
  },
  {
    icon: RefreshCw,
    title: "Snapshotter disconnects",
    body: "The snapshotter is the lexicographically lowest active signed-in session, so re-election is deterministic. A pagehide handler also fires a final flush + snapshot before the tab closes.",
  },
  {
    icon: Hash,
    title: "Save commit never lands",
    body: "Bytes are written to R2 before the commit mutation. If the commit is lost, the orphaned bytes are simply never referenced; the next save overwrites the same head key. Readers always follow Convex, never half-written state.",
  },
  {
    icon: Layers,
    title: "Thumbnail upload fails",
    body: "commitSceneSave only advances the thumbnail pointer when a new one was uploaded, so a stale-but-valid preview is preserved. The proxy returns 404 when none exists and the grid falls back gracefully.",
  },
  {
    icon: Clock,
    title: "Hydration claimer vanishes",
    body: "A hydration claim older than 15s is treated as stale and re-claimed by the next joiner, so a room can never get wedged in the hydrating state.",
  },
  {
    icon: Trash2,
    title: "Stale presence & sessions",
    body: "Heartbeats run every 5s against a 15s TTL. The sweep cron removes stale presence, sessions, and rate-limit rows every 60s, and GCs rooms that are both idle and fully snapshotted.",
  },
];

const API_ROUTES = [
  {
    method: "POST",
    path: "/api/scenes/[sceneId]/upload",
    desc: "Mint a presigned R2 PUT URL for the owner's scene bundle.",
  },
  {
    method: "GET",
    path: "/api/scenes/[sceneId]/download",
    desc: "Presigned R2 GET URL to load a scene's current bundle.",
  },
  {
    method: "DELETE",
    path: "/api/scenes/[sceneId]/storage",
    desc: "Delete the owner's scene bundle and thumbnail objects from R2.",
  },
  {
    method: "GET",
    path: "/api/scenes/[sceneId]/thumbnail",
    desc: "Authenticated, cache-friendly proxy serving the PNG preview.",
  },
  {
    method: "POST",
    path: "/api/scenes/[sceneId]/thumbnail/upload",
    desc: "Presigned PUT URL for the rendered thumbnail.",
  },
  {
    method: "GET",
    path: "/api/share/[token]/metadata",
    desc: "Resolve a share token to scene metadata (view or edit).",
  },
  {
    method: "GET",
    path: "/api/share/[token]/download",
    desc: "Token-gated presigned R2 GET URL for a shared scene bundle.",
  },
  {
    method: "POST",
    path: "/api/share/[token]/upload",
    desc: "Signed-in edit-link user gets a presigned R2 PUT URL.",
  },
  {
    method: "POST",
    path: "/api/share/[token]/commit",
    desc: "Signed-in edit-link user commits the uploaded shared scene bundle.",
  },
  {
    method: "GET",
    path: "/api/share/[token]/thumbnail",
    desc: "Token-gated shared thumbnail proxy with no referrer leakage.",
  },
  {
    method: "POST",
    path: "/api/share/[token]/thumbnail/upload",
    desc: "Signed-in edit-link user gets a presigned thumbnail PUT URL.",
  },
  {
    method: "POST",
    path: "/api/share/[token]/duplicate",
    desc: "Copy a shared scene into the signed-in user's own library.",
  },
];

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export function DocsPage() {
  const [activeId, setActiveId] = useState(ALL_IDS[0]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Scroll-spy: highlight the section nearest the top of the viewport.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    for (const id of ALL_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-paper-dots min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Toggle navigation"
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              {mobileNavOpen ? <X /> : <Menu />}
            </Button>
            <Wordmark />
            <span className="hidden items-center rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline-flex">
              docs
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden sm:flex"
            >
              <Link href="/">Home</Link>
            </Button>
            <ThemeToggle />
            <Button asChild size="sm" className="shadow-sketch-sm">
              <Link href="/dashboard">
                Open app
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-8 px-4 sm:px-6">
        {/* Sidebar */}
        <Sidebar
          activeId={activeId}
          mobileOpen={mobileNavOpen}
          onNavigate={() => setMobileNavOpen(false)}
        />

        {/* Content */}
        <main className="min-w-0 flex-1 pb-24 lg:max-w-3xl">
          {/* Hero */}
          <div className="border-b border-border/60 py-14">
            <span className="animate-float-up inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sketch-sm">
              <Sparkles className="size-3.5 text-primary" />
              Documentation
            </span>
            <h1 className="animate-float-up mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              SceneVault{" "}
              <span className="text-primary">developer&nbsp;docs</span>
            </h1>
            <p className="animate-float-up mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              SceneVault is a personal Excalidraw library service — nested
              folders, unlimited scenes, cloud autosave, shareable links, and
              real-time collaboration. This guide covers the architecture in
              depth: the data flows, the trust boundaries, the consistency
              model, and how every failure mode is handled.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Button asChild className="shadow-sketch-sm">
                <Link href="#quickstart">
                  Quickstart
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="#architecture">Architecture</Link>
              </Button>
            </div>
          </div>

          {/* Overview */}
          <Section id="overview" eyebrow="Introduction" title="Overview">
            <Lead>
              Your Excalidraw drawings keep ending up in a folder called
              Downloads. SceneVault gives them a real home: a tidy, searchable
              library where every scene autosaves to the cloud and the full
              editor is one click away.
            </Lead>
            <p>
              It is a single Next.js App Router application that stitches
              together four services: <Code>Better Auth</Code> for
              authentication, <Code>Convex</Code> as a reactive metadata
              database, <Code>Cloudflare R2</Code> for scene-bundle storage, and
              the embedded <Code>@excalidraw/excalidraw</Code> editor. The
              guiding principle is a clean split: scene <em>metadata</em>{" "}
              (titles, folders, versions, object keys, content hashes) lives in
              Convex and is strongly consistent and reactive; the heavy scene{" "}
              <em>bundles</em> live in R2 and are accessed only through
              short-lived presigned URLs that never touch the Next.js server.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: FolderTree, label: "Folders & library" },
                { icon: CloudUpload, label: "Cloud autosave" },
                { icon: Users, label: "Live collaboration" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="sketch-edge flex items-center gap-2.5 bg-card px-3.5 py-3 text-sm font-medium text-foreground"
                >
                  <Icon className="size-4 text-primary" />
                  {label}
                </div>
              ))}
            </div>
          </Section>

          {/* Quickstart */}
          <Section id="quickstart" eyebrow="Get running" title="Quickstart">
            <Lead>
              The fastest way to try SceneVault is{" "}
              <strong className="text-foreground">local demo mode</strong>,
              which needs no Better Auth, Convex, or R2 credentials. Scenes are
              stored in your browser&apos;s <Code>localStorage</Code>.
            </Lead>
            <CodeBlock
              language="bash"
              code={`# 1. Install dependencies
pnpm install

# 2. Run in local demo mode (no external services)
NEXT_PUBLIC_LOCAL_DATA=1 pnpm dev

# 3. Open the dashboard
open http://localhost:3000/dashboard`}
            />
            <Callout variant="tip" title="No sign-in required">
              In demo mode Better Auth proxy is bypassed and the dashboard loads
              straight away. It is also the mode the end-to-end Playwright suite
              runs against. Live collaboration needs Convex, so it is only
              available in the full stack.
            </Callout>
            <p>
              Ready to wire up real services and persist scenes across devices?
              Jump to{" "}
              <Link href="#production" className="text-primary hover:underline">
                Production setup
              </Link>
              .
            </p>
          </Section>

          {/* Features */}
          <Section id="features" eyebrow="Capabilities" title="Features">
            <Lead>
              Everything you need to keep a growing pile of drawings calm,
              searchable, and saved.
            </Lead>
            <div className="grid gap-4 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, color, title, body }) => (
                <div
                  key={title}
                  className="sketch-card bg-card p-5 transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <span
                    className="mb-3 inline-flex size-9 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
                    }}
                  >
                    <Icon className="size-4.5" style={{ color }} />
                  </span>
                  <h3 className="font-display text-base font-bold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          {/* Tech stack */}
          <Section id="stack" eyebrow="Architecture" title="Tech stack">
            <Lead>
              A small, modern stack where each service owns one job. Convex
              holds reactive metadata; R2 holds bytes; Better Auth holds
              identity.
            </Lead>
            <div className="grid gap-3 sm:grid-cols-2">
              {STACK.map(({ name, role, color }) => (
                <div
                  key={name}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5"
                >
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div>
                    <p className="font-display text-sm font-bold text-foreground">
                      {name}
                    </p>
                    <p className="text-sm text-muted-foreground">{role}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Architecture */}
          <Section
            id="architecture"
            eyebrow="Architecture"
            title="How it fits together"
          >
            <Lead>
              The browser talks to three planes: Convex for live metadata,
              Next.js route handlers for presigned storage access, and R2
              directly for the actual scene bytes.
            </Lead>
            <ArchitectureDiagram />
            <p>
              The split is deliberate. Convex is the{" "}
              <strong className="text-foreground">control plane</strong> —
              small, reactive, strongly consistent rows that every client
              subscribes to. R2 is the{" "}
              <strong className="text-foreground">data plane</strong> — large,
              opaque blobs the server never reads on the hot path. The Next.js
              route handlers are a thin{" "}
              <strong className="text-foreground">brokerage layer</strong>: they
              authorise a request, then hand the browser a presigned URL so the
              bytes flow browser&nbsp;↔&nbsp;R2 directly. That keeps
              multi-megabyte scene payloads off both the database and the
              serverless function.
            </p>
          </Section>

          {/* Data flows */}
          <Section
            id="data-flows"
            eyebrow="Architecture"
            title="Request & data flows"
          >
            <Lead>
              Three flows carry every byte in the app. Each keeps large payloads
              off the database and routes them browser-to-R2 over short-lived
              presigned URLs.
            </Lead>
            {DATA_FLOWS.map((flow) => (
              <FlowCard key={flow.title} flow={flow} />
            ))}
            <Callout
              variant="note"
              title="The content hash earns its keep on every save"
            >
              <code className="font-mono text-[0.85em]">commitSceneSave</code>{" "}
              compares the incoming content hash to the stored one and returns
              early when they match. That skips a version bump that would
              otherwise re-fire the <Code>getLibrary</Code> subscription and
              re-render every open tab — so an idle autosave costs nothing.
            </Callout>
          </Section>

          {/* Data model */}
          <Section id="data-model" eyebrow="Architecture" title="Data model">
            <Lead>
              All metadata lives in Convex, profile-scoped and indexed for the
              exact access patterns the app needs. Eight tables, no joins on the
              hot path.
            </Lead>
            <div className="space-y-3">
              {SCHEMA.map(({ name, desc, fields, indexes }) => (
                <div
                  key={name}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-2">
                    <Database className="size-4 text-primary" />
                    <Code>{name}</Code>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground/80">
                    {fields}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      indexes
                    </span>
                    {indexes.map((index) => (
                      <Pill key={index}>{index}</Pill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p>
              Indexes mirror the queries exactly. The dashboard&apos;s{" "}
              <Code>getLibrary</Code> reads folders by <Code>by_profile</Code>{" "}
              and scenes by <Code>by_profile_updated</Code> in parallel; share
              lookups hit the unique <Code>by_token</Code> index; and every
              collab read is a single <Code>by_scene</Code> or{" "}
              <Code>by_room_session</Code> scan.
            </p>
          </Section>

          {/* Storage */}
          <Section
            id="storage"
            eyebrow="Architecture"
            title="Scene storage & R2"
          >
            <Lead>
              Scene bundles and thumbnails are stored as objects in a Cloudflare
              R2 bucket under a deterministic, profile-scoped key layout.
            </Lead>
            <CodeBlock
              language="text"
              filename="R2 object key layout"
              code={`users/{profileId}/scenes/{sceneId}/head/excalidraw.json   # scene bundle
users/{profileId}/scenes/{sceneId}/head/thumbnail.png     # PNG preview`}
            />
            <p>
              Browsers never receive long-lived credentials. Every read and
              write goes through a{" "}
              <strong className="text-foreground">presigned URL</strong> minted
              server-side with a 5-minute (<Code>300s</Code>) expiry, scoped to
              one exact object key and HTTP method. Because the key is{" "}
              <em>derived</em> from <Code>profileId</Code> +{" "}
              <Code>sceneId</Code> rather than supplied by the client, and the
              commit mutations recompute and re-check it, a client can never
              read or write outside its own namespace.
            </p>
            <p>
              Object operations are kept simple and idempotent. Deletes remove
              the bundle and thumbnail unconditionally (a no-op if absent), and
              the <Code>duplicate</Code> flow uses a server-side R2{" "}
              <Code>CopyObject</Code> so a shared scene&apos;s bytes are cloned
              without round-tripping through the browser.
            </p>
            <Callout
              variant="warn"
              title="CORS is required for browser uploads"
            >
              R2 must allow browser <Code>PUT</Code> requests from your app
              origin. Configure the bucket&apos;s CORS policy before autosave
              will work in production.
            </Callout>
          </Section>

          {/* Consistency */}
          <Section
            id="consistency"
            eyebrow="Architecture"
            title="Consistency model"
          >
            <Lead>
              Two stores, two consistency guarantees, one source of truth.
              Convex is authoritative for <em>which</em> bytes are current; R2
              merely holds them.
            </Lead>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sketch-edge bg-card p-4">
                <div className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                  <Database className="size-4 text-primary" /> Convex — strong
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Metadata mutations are transactional and reactive. The{" "}
                  <Code>version</Code>, <Code>contentHash</Code>, and{" "}
                  <Code>currentObjectKey</Code> on a scene are the single source
                  of truth for the current bytes.
                </p>
              </div>
              <div className="sketch-edge bg-card p-4">
                <div className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                  <Boxes className="size-4 text-primary" /> R2 — pointed-to
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Bytes are written to R2 <em>before</em> the commit mutation
                  records them. Readers always follow the Convex pointer, so
                  they never observe a half-written or orphaned object.
                </p>
              </div>
            </div>
            <p>
              A save is effectively two phases: upload bytes, then commit the
              pointer. If the second phase is lost, the uploaded bytes are
              simply never referenced — the next save overwrites the same{" "}
              <Code>head</Code> key — and no reader is ever exposed to them.
              Identical content short-circuits the commit entirely via the
              content hash, so the version counter only ever moves forward on a
              real change.
            </p>
            <SubHeading>Live convergence: per-element LWW</SubHeading>
            <p>
              In a live room each element converges independently. The server
              applies the same tie-break Excalidraw uses on the client: a higher{" "}
              <Code>version</Code> wins; on a tie the{" "}
              <strong className="text-foreground">lower</strong>{" "}
              <Code>versionNonce</Code> wins; identical means no change.
              Mirroring <Code>reconcileElements</Code> keeps server and clients
              convergent, and deletes propagate as tombstones that the sweep
              cron later garbage-collects.
            </p>
            <CodeBlock
              language="ts"
              filename="convex/collabLogic.ts"
              code={`export function incomingElementWins(incoming, stored) {
  if (!stored) return true;
  if (incoming.version !== stored.version)
    return incoming.version > stored.version;        // higher version wins
  if (incoming.versionNonce !== stored.versionNonce)
    return incoming.versionNonce < stored.versionNonce; // tie: lower nonce wins
  return false;                                       // identical: no change
}`}
            />
          </Section>

          {/* Trust boundaries */}
          <Section id="auth" eyebrow="Security" title="Trust boundaries">
            <Lead>
              Authorization is enforced three times, independently, on every
              storage request — defence in depth so no single bug opens a door.
            </Lead>
            <div className="space-y-3">
              {TRUST_LAYERS.map(({ icon: Icon, title, body, accent }, i) => (
                <div
                  key={title}
                  className="flex gap-3.5 rounded-xl border border-border bg-card p-4"
                  style={{ borderLeftWidth: 3, borderLeftColor: accent }}
                >
                  <span
                    className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${accent} 16%, transparent)`,
                      color: accent,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <Icon className="size-4" style={{ color: accent }} />
                      <p className="font-display text-sm font-bold text-foreground">
                        {title}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <CodeBlock
              language="ts"
              filename="proxy.ts (auth gate)"
              code={`const protectedPrefixes = ["/dashboard", "/scenes", "/api/scenes"];

export default function proxy(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_LOCAL_DATA === "1") return;
  const signedIn = req.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("session_token"));
  if (isProtectedPath(req.nextUrl.pathname) && !signedIn) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
});`}
            />
            <p>
              Beyond the three layers: presigned URLs are scoped to a single key
              and expire in five minutes; share tokens are 24 random bytes
              looked up by a unique index and can be disabled or rotated
              instantly; and collab session secrets are stored only as SHA-256
              hashes, so a database leak can&apos;t be replayed to spoof a
              session.
            </p>
          </Section>

          {/* Sharing */}
          <Section id="sharing" eyebrow="Collaboration" title="Share links">
            <Lead>
              Any scene can be shared with a per-scene, per-mode token —{" "}
              <Pill>view</Pill> or <Pill>edit</Pill> — without exposing your
              account.
            </Lead>
            <p>
              Tokens are 24 random bytes of hex, stored in the{" "}
              <Code>sceneShares</Code> table and looked up by a unique index.
              Owners can rotate a token (invalidating the old link instantly) or
              toggle <Code>enabled</Code> to revoke access without deleting the
              link. A disabled or unknown token resolves to <Code>null</Code>,
              so guests simply see &ldquo;not found.&rdquo;
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sketch-edge bg-card p-4">
                <div className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                  <Search className="size-4 text-primary" /> View links
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Read-only access to the current scene bundle. Served at{" "}
                  <Code>/share/v/[token]</Code>.
                </p>
              </div>
              <div className="sketch-edge bg-card p-4">
                <div className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                  <PenLine className="size-4 text-primary" /> Edit links
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Full editing, optionally as a live room. Served at{" "}
                  <Code>/share/e/[token]</Code>.
                </p>
              </div>
            </div>
            <p>
              Anonymous guests can load the scene and join live editing with an
              edit token, but durable R2 persistence still requires sign-in: the
              upload, commit, thumbnail-upload, and duplicate routes demand a
              Better Auth session. A guest who duplicates a shared scene gets a
              fresh copy under their <em>own</em> profile namespace. The token
              grants entry to the room; it never grants direct write access to
              someone else&apos;s storage.
            </p>
          </Section>

          {/* Live collab */}
          <Section
            id="live-collab"
            eyebrow="Collaboration"
            title="Live collaboration"
          >
            <Lead>
              Start a real-time room on any scene and edit together. The live
              working set lives in Convex so a browser crash can never lose
              edits.
            </Lead>
            <SubHeading>Room lifecycle</SubHeading>
            <p>
              Only the scene&apos;s profile can <Code>startRoom</Code>. The room
              then moves through four states as the first joiner seeds it from
              the durable R2 snapshot:
            </p>
            <div className="not-prose flex flex-col gap-2 sm:flex-row sm:items-stretch">
              {ROOM_STATES.map(({ state, desc }, i) => (
                <div key={state} className="flex flex-1 items-stretch gap-2">
                  <div className="flex-1 rounded-xl border border-border bg-card p-3">
                    <p className="font-mono text-[11px] font-semibold text-primary">
                      {state}
                    </p>
                    <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                      {desc}
                    </p>
                  </div>
                  {i < ROOM_STATES.length - 1 && (
                    <ArrowRight className="hidden size-4 shrink-0 self-center text-muted-foreground/50 sm:block" />
                  )}
                </div>
              ))}
            </div>
            <p>
              Joining issues a session: <Code>joinRoom</Code> returns a one-time
              secret (only its hash is stored) and a presence row. Edits are
              diffed against last-known versions, debounced, and pushed in
              batches; the server reconciles each element with last-write-wins.
              Cursors and selections stream as throttled presence updates,
              denormalised so a single index read renders every collaborator.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: MousePointer2,
                  title: "Live presence",
                  body: "Cursors, selections, and who's online — denormalised for join-free reads, swept by a 15s TTL.",
                },
                {
                  icon: KeyRound,
                  title: "Session identity",
                  body: "joinRoom issues a secret once; only its hash is stored. Every mutation must present a match.",
                },
                {
                  icon: Network,
                  title: "Durable snapshots",
                  body: "An elected snapshotter persists the room to R2; a cron GCs the working set only once it's saved.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <Icon className="size-4.5 text-primary" />
                  <p className="mt-2 font-display text-sm font-bold text-foreground">
                    {title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
            <SubHeading>Snapshots & garbage collection</SubHeading>
            <p>
              Among active <em>signed-in</em> sessions, exactly one is elected
              snapshotter — the lexicographically lowest session id, so the
              choice is deterministic and needs no coordination. It debounces
              the live set back to R2 and calls <Code>markRoomSnapshot</Code>{" "}
              with a watermark. A room is &ldquo;dirty&rdquo; whenever a live
              element is newer than that watermark, and the{" "}
              <strong className="text-foreground">
                sweep cron never collects a dirty room
              </strong>{" "}
              — the guarantee that no edit is lost even if every browser
              disconnects before snapshotting. Guests can never snapshot;
              persistence always requires a signed-in session.
            </p>
            <SubHeading>Timings & caps</SubHeading>
            <SpecTable rows={COLLAB_SPEC} />
            <SubHeading>Rate limiting</SubHeading>
            <p>
              Public, token-gated mutations are throttled by a per-session
              token-bucket limiter persisted in <Code>collabRateLimits</Code>,
              isolated to its own row so it never contends with element or
              presence writes. Each bucket refills continuously at its rate up
              to a burst capacity; a call that can&apos;t spend a token is
              rejected rather than queued.
            </p>
            <RateLimitTable rows={RATE_LIMITS} />
            <SubHeading>Validation bounds</SubHeading>
            <p>
              Every inbound element, batch, and presence payload is validated
              server-side before it touches a row, so a hostile or buggy client
              can&apos;t bloat a room or smuggle oversized data past the working
              set.
            </p>
            <SpecTable
              rows={VALIDATION_BOUNDS.map(({ name, value, desc }) => ({
                name,
                value,
                desc,
              }))}
            />
          </Section>

          {/* Failure modes */}
          <Section
            id="failure-modes"
            eyebrow="Operations"
            title="Failure modes"
          >
            <Lead>
              The design assumes browsers crash, networks drop, and uploads fail
              halfway. Here is what happens when they do.
            </Lead>
            <div className="grid gap-3 sm:grid-cols-2">
              {FAILURE_MODES.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    <p className="font-display text-sm font-bold text-foreground">
                      {title}
                    </p>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
            <p>
              Revocation is reactive too. Disabling a share re-runs the collab
              queries every member is subscribed to, and the client flips to a{" "}
              <Code>revoked</Code> state immediately; bumping a room&apos;s{" "}
              <Code>epoch</Code> forces every member to resync. And when Convex
              isn&apos;t configured, the storage routes return a clean{" "}
              <Code>503</Code> rather than crashing.
            </p>
          </Section>

          {/* Local vs production */}
          <Section id="modes" eyebrow="Operations" title="Local vs production">
            <Lead>
              One codebase, two runtime modes. A single flag,{" "}
              <Code>NEXT_PUBLIC_LOCAL_DATA</Code>, decides whether the app talks
              to real services or stays entirely in the browser.
            </Lead>
            <ModeComparison />
            <p>
              The switch is the exported <Code>shouldUseRemoteData</Code> flag:
              remote mode is on only when <Code>NEXT_PUBLIC_LOCAL_DATA</Code> is
              not <Code>1</Code> <em>and</em> the Convex URL is present. In
              local mode the library provider reads and writes{" "}
              <Code>localStorage</Code>, renders thumbnails as inline PNG data
              URLs, and the auth proxy short-circuits — so the Playwright suite
              runs the full UI with zero external services. Live collaboration
              depends on Convex and is therefore remote-only.
            </p>
            <SubHeading>Running the full stack locally</SubHeading>
            <p>
              Convex&apos;s <Code>_generated</Code> files don&apos;t exist until
              the project is linked, so run the Convex dev server before
              building the backend.
            </p>
            <CodeBlock
              language="bash"
              code={`# Link & run the Convex backend (creates _generated files)
pnpm exec convex dev

# In another terminal, run Next.js against your .env.local
pnpm dev`}
            />
          </Section>

          {/* Production */}
          <Section
            id="production"
            eyebrow="Operations"
            title="Production setup"
          >
            <Lead>
              Wire up the three external services, then deploy. The steps below
              mirror <Code>README.md</Code>.
            </Lead>
            <ol className="space-y-3">
              {[
                <>
                  Copy <Code>.env.example</Code> to <Code>.env.local</Code>.
                </>,
                <>
                  Link and push Convex with{" "}
                  <Code>pnpm exec convex dev --once</Code>.
                </>,
                <>
                  In <Code>.env.local</Code>, set <Code>CONVEX_DEPLOYMENT</Code>{" "}
                  plus <Code>NEXT_PUBLIC_CONVEX_URL</Code>,{" "}
                  <Code>CONVEX_SITE_URL</Code>,{" "}
                  <Code>NEXT_PUBLIC_CONVEX_SITE_URL</Code>, and{" "}
                  <Code>SITE_URL</Code> or <Code>BETTER_AUTH_URL</Code>.
                </>,
                <>
                  In Convex env, set <Code>SITE_URL</Code> or{" "}
                  <Code>BETTER_AUTH_URL</Code>, <Code>BETTER_AUTH_SECRET</Code>,
                  and Google/GitHub OAuth credentials.
                </>,
                <>
                  Create an R2 bucket and S3 API token, then fill the{" "}
                  <Code>CLOUDFLARE_R2_*</Code> variables.
                </>,
                <>
                  Configure R2 CORS to allow browser <Code>PUT</Code> uploads
                  from your app origin.
                </>,
              ].map((step, i) => (
                <li
                  key={i}
                  className="flex gap-3.5 rounded-xl border border-border bg-card p-4"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="self-center text-sm text-muted-foreground">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
            <Callout variant="warn" title="Run Convex dev before deploying">
              The Convex <Code>_generated</Code> files and HTTP actions are not
              created until the project is linked and pushed. Run{" "}
              <Code>pnpm exec convex dev --once</Code> before deploying the
              backend. If <Code>/api/auth/*</Code> returns the Convex HTTP
              actions 404, this is the missing step.
            </Callout>
            <SubHeading>OAuth callbacks</SubHeading>
            <p>
              Better Auth handles all current sign-in and session state. GitHub
              and Google should redirect back to the Next.js app, where{" "}
              <Code>app/api/auth/[...all]/route.ts</Code> forwards the request
              to Convex.
            </p>
            <CodeBlock
              language="text"
              filename="Provider callback URLs"
              code={`GitHub local callback: http://localhost:3000/api/auth/callback/github
Google local callback: http://localhost:3000/api/auth/callback/google

GitHub production callback: https://your-domain.com/api/auth/callback/github
Google production callback: https://your-domain.com/api/auth/callback/google`}
            />
            <p>
              Store <Code>SITE_URL</Code> or <Code>BETTER_AUTH_URL</Code>,{" "}
              <Code>BETTER_AUTH_SECRET</Code>, and the Google/GitHub client
              credentials in Convex env. Keeping them only in{" "}
              <Code>.env.local</Code> is not enough because Convex executes the
              Better Auth handler.
            </p>
          </Section>

          {/* Structure */}
          <Section
            id="structure"
            eyebrow="Operations"
            title="Project structure"
          >
            <Lead>
              A conventional Next.js App Router layout, with Convex functions
              and shared library code split out.
            </Lead>
            <CodeBlock
              language="text"
              filename="directory layout"
              code={`app/            Next.js App Router — pages, layouts, route handlers
  api/          Presigned-URL brokers & share endpoints
  dashboard/    The library UI
  scenes/       The embedded Excalidraw editor
  share/        Public view (v) and edit (e) routes
components/     React components (editor, dashboard, collab, ui/)
convex/         Schema, queries, mutations, collab logic, crons
lib/            Storage access, R2 client, hashing, validation helpers
tests/          Playwright e2e + collab smoke suites`}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {["app", "components", "convex", "lib", "tests", "public"].map(
                (dir) => (
                  <Pill key={dir}>{dir}/</Pill>
                ),
              )}
            </div>
          </Section>

          {/* API routes */}
          <Section id="api-routes" eyebrow="Reference" title="API routes">
            <Lead>
              Route handlers under <Code>app/api</Code> broker presigned storage
              access and shared-scene operations. They never stream scene bytes
              themselves (except the cache-friendly thumbnail proxy).
            </Lead>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-secondary/60">
                    <th className="px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Method
                    </th>
                    <th className="px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Route
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {API_ROUTES.map((route) => (
                    <tr
                      key={route.path}
                      className="border-t border-border align-top"
                    >
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="font-mono text-[11px] font-semibold text-primary">
                          {route.method}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-mono text-[12px] text-foreground">
                          {route.path}
                        </p>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">
                          {route.desc}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Env */}
          <Section id="env" eyebrow="Reference" title="Environment variables">
            <Lead>
              Copy <Code>.env.example</Code> to <Code>.env.local</Code> and fill
              in the values for the services you use. Everything except{" "}
              <Code>NEXT_PUBLIC_LOCAL_DATA</Code> is required for production.
            </Lead>
            <EnvTable />
          </Section>

          {/* Scripts */}
          <Section id="scripts" eyebrow="Reference" title="Scripts & testing">
            <Lead>
              The project ships unit tests (Vitest + convex-test), end-to-end
              tests (Playwright, run in local demo mode), and a collaboration
              smoke suite.
            </Lead>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {[
                { cmd: "pnpm dev", desc: "Start the dev server" },
                { cmd: "pnpm build", desc: "Production build" },
                { cmd: "pnpm test", desc: "Run Vitest unit tests" },
                { cmd: "pnpm e2e", desc: "Playwright end-to-end suite" },
                { cmd: "pnpm lint", desc: "ESLint" },
                { cmd: "pnpm typecheck", desc: "tsc --noEmit" },
                { cmd: "pnpm format", desc: "Prettier write" },
                {
                  cmd: "pnpm all",
                  desc: "format · lint · typecheck · test · e2e",
                },
              ].map(({ cmd, desc }) => (
                <div
                  key={cmd}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5"
                >
                  <code className="font-mono text-[13px] font-medium text-foreground">
                    {cmd}
                  </code>
                  <span className="text-right text-xs text-muted-foreground">
                    {desc}
                  </span>
                </div>
              ))}
            </div>
            <Callout variant="note" title="What the E2E suite covers">
              Nested folders, folder-name search, scene creation, editor load,
              autosave, and rename persistence — all driven through local demo
              mode so it needs no external services. The collab logic is
              additionally unit-tested as a pure, dependency-free module.
            </Callout>
          </Section>

          {/* Footer CTA */}
          <div className="py-14">
            <div className="sketch-edge relative overflow-hidden rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground shadow-sketch">
              <div className="bg-paper-dots pointer-events-none absolute inset-0 opacity-20" />
              <div className="relative">
                <h2 className="font-display text-2xl font-bold sm:text-3xl">
                  Ready to draw?
                </h2>
                <p className="mx-auto mt-2 max-w-md text-primary-foreground/80">
                  Open the app and give your next idea a home.
                </p>
                <div className="mt-6 flex justify-center">
                  <Button
                    asChild
                    size="lg"
                    variant="secondary"
                    className="shadow-sketch-sm"
                  >
                    <Link href="/dashboard">
                      Open SceneVault
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sidebar                                                                     */
/* -------------------------------------------------------------------------- */

function Sidebar({
  activeId,
  mobileOpen,
  onNavigate,
}: {
  activeId: string;
  mobileOpen: boolean;
  onNavigate: () => void;
}) {
  return (
    <aside
      className={cn(
        "shrink-0 lg:block lg:w-60",
        mobileOpen
          ? "fixed inset-x-0 top-16 bottom-0 z-40 block overflow-y-auto border-b border-border bg-background/95 px-4 py-6 backdrop-blur-md"
          : "hidden",
      )}
    >
      <nav className="space-y-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:py-14 lg:pr-2">
        {NAV.map((group) => (
          <div key={group.title}>
            <p className="px-2 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground/80">
              {group.title}
            </p>
            <ul className="mt-2 space-y-0.5">
              {group.items.map((item) => {
                const active = activeId === item.id;
                return (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={onNavigate}
                      className={cn(
                        "block rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-primary/12 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="px-2 pt-2">
          <Link
            href="https://github.com"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <FileCode2 className="size-3.5" />
            README & source
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </nav>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/*  Architecture diagram                                                       */
/* -------------------------------------------------------------------------- */

function ArchitectureDiagram() {
  const planes = [
    {
      icon: KeyRound,
      plane: "Identity",
      title: "Better Auth",
      sub: "Sessions & Convex JWTs",
      channel: "identity · JWT",
      color: "var(--chart-3)",
    },
    {
      icon: Database,
      plane: "Control plane",
      title: "Convex",
      sub: "Reactive metadata & live rooms",
      channel: "live subscriptions ↕",
      color: "var(--chart-5)",
    },
    {
      icon: Boxes,
      plane: "Data plane",
      title: "Cloudflare R2",
      sub: "Scene bundles & thumbnails",
      channel: "presigned bytes ↕",
      color: "var(--chart-2)",
    },
  ];
  return (
    <div className="not-prose rounded-2xl border border-border bg-card p-5 shadow-sketch-sm">
      {/* Browser */}
      <div className="sketch-edge mx-auto flex max-w-xs items-center justify-center gap-2.5 bg-background px-4 py-3">
        <span
          className="inline-flex size-9 items-center justify-center rounded-lg"
          style={{
            backgroundColor:
              "color-mix(in oklch, var(--chart-1) 18%, transparent)",
          }}
        >
          <PenLine className="size-4.5" style={{ color: "var(--chart-1)" }} />
        </span>
        <div className="text-left">
          <p className="font-display text-sm font-bold text-foreground">
            Browser
          </p>
          <p className="text-[11px] leading-tight text-muted-foreground">
            Next.js + Excalidraw
          </p>
        </div>
      </div>

      {/* Brokerage layer */}
      <div className="relative my-3 flex flex-col items-center">
        <span className="h-4 w-px bg-border" aria-hidden />
        <div className="flex items-center gap-2 rounded-full border border-dashed border-border bg-secondary/50 px-3 py-1">
          <Network className="size-3.5 text-primary" />
          <span className="font-mono text-[11px] text-muted-foreground">
            Next.js route handlers — authorize & mint presigned URLs
          </span>
        </div>
        <span className="h-4 w-px bg-border" aria-hidden />
      </div>

      {/* Three planes */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {planes.map(({ icon: Icon, plane, title, sub, channel, color }) => (
          <div
            key={title}
            className="sketch-edge flex flex-col gap-1.5 bg-background px-3 py-4"
            style={{ borderTopWidth: 3, borderTopColor: color }}
          >
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {plane}
            </p>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex size-8 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
                }}
              >
                <Icon className="size-4" style={{ color }} />
              </span>
              <p className="font-display text-sm font-bold text-foreground">
                {title}
              </p>
            </div>
            <p className="text-[11px] leading-tight text-muted-foreground">
              {sub}
            </p>
            <p className="mt-1 font-mono text-[10px]" style={{ color }}>
              {channel}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center justify-center gap-2 text-center font-mono text-[11px] text-muted-foreground">
        <TerminalSquare className="size-3.5" />
        metadata via Convex · bytes via presigned R2 URLs · identity via Better
        Auth
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Flow card — numbered steps for a request/data flow                         */
/* -------------------------------------------------------------------------- */

function FlowCard({
  flow,
}: {
  flow: {
    icon: React.ComponentType<{
      className?: string;
      style?: React.CSSProperties;
    }>;
    color: string;
    title: string;
    summary: string;
    steps: string[];
  };
}) {
  const { icon: Icon, color, title, summary, steps } = flow;
  return (
    <div className="not-prose rounded-2xl border border-border bg-card p-5 shadow-sketch-sm">
      <div className="flex items-center gap-3">
        <span
          className="inline-flex size-9 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
          }}
        >
          <Icon className="size-4.5" style={{ color }} />
        </span>
        <div>
          <p className="font-display text-base font-bold text-foreground">
            {title}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {summary}
          </p>
        </div>
      </div>
      <ol className="mt-4 space-y-2.5">
        {steps.map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="font-display text-sm font-bold" style={{ color }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-sm leading-relaxed text-muted-foreground">
              {step}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Spec table — name / value / description rows                               */
/* -------------------------------------------------------------------------- */

function SpecTable({
  rows,
}: {
  rows: { name: string; value: string; desc: string }[];
}) {
  return (
    <div className="not-prose overflow-hidden rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-secondary/60">
            <th className="px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Constant
            </th>
            <th className="px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Value
            </th>
            <th className="hidden px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground sm:table-cell">
              Meaning
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-border align-top">
              <td className="px-3 py-2.5">
                <code className="font-mono text-[11.5px] text-foreground">
                  {row.name}
                </code>
                <p className="mt-0.5 text-[12px] text-muted-foreground sm:hidden">
                  {row.desc}
                </p>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5">
                <span className="inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold text-primary">
                  <Timer className="size-3.5 opacity-70" />
                  {row.value}
                </span>
              </td>
              <td className="hidden px-3 py-2.5 text-[13px] text-muted-foreground sm:table-cell">
                {row.desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Rate-limit table — action / rate / burst / effect                          */
/* -------------------------------------------------------------------------- */

function RateLimitTable({
  rows,
}: {
  rows: { action: string; rate: string; burst: string; desc: string }[];
}) {
  return (
    <div className="not-prose overflow-hidden rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-secondary/60">
            <th className="px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Action
            </th>
            <th className="px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Refill
            </th>
            <th className="px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Burst
            </th>
            <th className="hidden px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground sm:table-cell">
              Effect
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.action} className="border-t border-border align-top">
              <td className="px-3 py-2.5">
                <code className="font-mono text-[11.5px] text-foreground">
                  {row.action}
                </code>
                <p className="mt-0.5 text-[12px] text-muted-foreground sm:hidden">
                  {row.desc}
                </p>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[12px] font-semibold text-primary">
                {row.rate}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[12px] text-muted-foreground">
                {row.burst}
              </td>
              <td className="hidden px-3 py-2.5 text-[13px] text-muted-foreground sm:table-cell">
                {row.desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mode comparison — local demo vs production                                 */
/* -------------------------------------------------------------------------- */

function ModeComparison() {
  const rows: { aspect: string; local: string; remote: string }[] = [
    {
      aspect: "Storage",
      local: "Browser localStorage",
      remote: "Convex + Cloudflare R2",
    },
    { aspect: "Auth", local: "Bypassed", remote: "Better Auth sessions" },
    {
      aspect: "Thumbnails",
      local: "Inline PNG data URLs",
      remote: "Authenticated proxy route",
    },
    {
      aspect: "Live collab",
      local: "Unavailable",
      remote: "Full real-time rooms",
    },
    {
      aspect: "Credentials",
      local: "None required",
      remote: "Better Auth · Convex · R2",
    },
  ];
  return (
    <div className="not-prose overflow-hidden rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-secondary/60">
            <th className="px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground" />
            <th className="px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <TerminalSquare className="size-3.5" /> Local demo
              </span>
            </th>
            <th className="px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-primary">
              <span className="inline-flex items-center gap-1.5">
                <Radio className="size-3.5" /> Production
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.aspect} className="border-t border-border align-top">
              <td className="px-3 py-2.5 font-medium text-foreground">
                {row.aspect}
              </td>
              <td className="px-3 py-2.5 text-[13px] text-muted-foreground">
                {row.local}
              </td>
              <td className="px-3 py-2.5 text-[13px] text-foreground/90">
                {row.remote}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Env var table                                                              */
/* -------------------------------------------------------------------------- */

function EnvTable() {
  const rows: { name: string; required: boolean; desc: string }[] = [
    {
      name: "CONVEX_DEPLOYMENT",
      required: true,
      desc: "Convex deployment selected by the CLI.",
    },
    {
      name: "NEXT_PUBLIC_CONVEX_URL",
      required: true,
      desc: "Convex deployment URL.",
    },
    {
      name: "CONVEX_SITE_URL",
      required: true,
      desc: "Server-side Convex site URL used by the auth proxy.",
    },
    {
      name: "NEXT_PUBLIC_CONVEX_SITE_URL",
      required: true,
      desc: "Convex site URL for Better Auth.",
    },
    {
      name: "SITE_URL",
      required: true,
      desc: "Public app URL used by Better Auth callbacks.",
    },
    {
      name: "BETTER_AUTH_URL",
      required: false,
      desc: "Alternative to SITE_URL using Better Auth's standard env name.",
    },
    {
      name: "BETTER_AUTH_SECRET",
      required: true,
      desc: "Better Auth secret key (server).",
    },
    {
      name: "GITHUB_CLIENT_ID",
      required: true,
      desc: "GitHub OAuth client ID.",
    },
    {
      name: "GITHUB_CLIENT_SECRET",
      required: true,
      desc: "GitHub OAuth client secret.",
    },
    {
      name: "GOOGLE_CLIENT_ID",
      required: true,
      desc: "Google OAuth client ID.",
    },
    {
      name: "GOOGLE_CLIENT_SECRET",
      required: true,
      desc: "Google OAuth client secret.",
    },
    {
      name: "CLOUDFLARE_R2_ACCOUNT_ID",
      required: true,
      desc: "R2 account id.",
    },
    {
      name: "CLOUDFLARE_R2_ACCESS_KEY_ID",
      required: true,
      desc: "R2 S3 API access key id.",
    },
    {
      name: "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
      required: true,
      desc: "R2 S3 API secret access key.",
    },
    {
      name: "CLOUDFLARE_R2_BUCKET",
      required: true,
      desc: "Target R2 bucket name.",
    },
    {
      name: "NEXT_PUBLIC_LOCAL_DATA",
      required: false,
      desc: "Set to 1 for local demo mode (localStorage, no services).",
    },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-secondary/60">
            <th className="px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Variable
            </th>
            <th className="px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-border align-top">
              <td className="px-3 py-3">
                <code className="font-mono text-[11.5px] text-foreground">
                  {row.name}
                </code>
                <div className="mt-1">
                  {row.required ? (
                    <span className="font-mono text-[10px] uppercase tracking-wide text-primary">
                      required
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      optional
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-3 text-[13px] text-muted-foreground">
                {row.desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
