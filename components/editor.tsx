"use client";

import {
  ArrowLeft,
  Check,
  CloudUpload,
  Loader2,
  Pencil,
  Share2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { sha256Hex } from "@/lib/hash";
import {
  normalizeSceneBundle,
  snapshotToSceneBundle,
} from "@/lib/excalidraw-scene";

import {
  AiDiagramDialog,
  type GeneratedAiDiagram,
} from "@/components/ai-diagram-dialog";
import { LogoMark } from "@/components/brand";
import { CollaborativeCanvas } from "@/components/collab/collaborative-canvas";
import { RoomControls } from "@/components/collab/room-controls";
import { ExcalidrawCanvas } from "@/components/excalidraw-canvas";
import {
  LibraryProvider,
  shouldUseRemoteData,
  useLibrary,
} from "@/components/library-provider";
import type { SnapshotBundle } from "@/components/collab/use-room";
import { ShareSceneDialog } from "@/components/share-dialog";
import { useTheme } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_ELEMENTS_PER_SCENE } from "@/convex/collabLogic";
import { cn } from "@/lib/utils";
import { type SceneBundle } from "@/lib/domain";
import type {
  BinaryFileData,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

type ElementBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function getElementBounds(elements: unknown[]): ElementBounds | null {
  let bounds: ElementBounds | null = null;

  for (const element of elements) {
    if (
      !element ||
      typeof element !== "object" ||
      ("isDeleted" in element && element.isDeleted === true)
    ) {
      continue;
    }

    const candidate = element as {
      x?: unknown;
      y?: unknown;
      width?: unknown;
      height?: unknown;
    };
    if (
      typeof candidate.x !== "number" ||
      typeof candidate.y !== "number" ||
      typeof candidate.width !== "number" ||
      typeof candidate.height !== "number"
    ) {
      continue;
    }

    const minX = candidate.x;
    const minY = candidate.y;
    const maxX = candidate.x + candidate.width;
    const maxY = candidate.y + candidate.height;
    bounds = bounds
      ? {
          minX: Math.min(bounds.minX, minX),
          minY: Math.min(bounds.minY, minY),
          maxX: Math.max(bounds.maxX, maxX),
          maxY: Math.max(bounds.maxY, maxY),
        }
      : { minX, minY, maxX, maxY };
  }

  return bounds;
}

function translateElements(elements: unknown[], dx: number, dy: number) {
  return elements.map((element) => {
    if (!element || typeof element !== "object") {
      return element;
    }
    const candidate = element as { x?: unknown; y?: unknown };
    if (typeof candidate.x !== "number" || typeof candidate.y !== "number") {
      return element;
    }
    return {
      ...element,
      x: candidate.x + dx,
      y: candidate.y + dy,
    };
  });
}

function appendDiagramToBundle(
  currentBundle: SceneBundle,
  diagramBundle: SceneBundle,
) {
  const current = normalizeSceneBundle(currentBundle);
  const diagram = normalizeSceneBundle(diagramBundle);
  const currentBounds = getElementBounds(current.elements);
  const diagramBounds = getElementBounds(diagram.elements);
  const dx =
    currentBounds && diagramBounds
      ? currentBounds.maxX + 240 - diagramBounds.minX
      : 0;
  const dy =
    currentBounds && diagramBounds
      ? currentBounds.minY - diagramBounds.minY
      : 0;
  const insertedElements = translateElements(diagram.elements, dx, dy);

  return {
    bundle: normalizeSceneBundle({
      ...current,
      elements: [...current.elements, ...insertedElements],
      files: {
        ...current.files,
        ...diagram.files,
      },
    }),
    insertedElements,
  };
}

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveStatus({ state }: { state: SaveState }) {
  const config = {
    idle: {
      icon: CloudUpload,
      label: "Ready",
      className: "text-muted-foreground",
    },
    saving: {
      icon: Loader2,
      label: "Saving…",
      className: "text-muted-foreground",
    },
    saved: { icon: Check, label: "Saved", className: "text-[var(--chart-3)]" },
    error: {
      icon: TriangleAlert,
      label: "Save failed",
      className: "text-destructive",
    },
  }[state];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium",
        config.className,
      )}
      aria-live="polite"
    >
      <Icon className={cn("size-3.5", state === "saving" && "animate-spin")} />
      {config.label}
    </span>
  );
}

function EditorContent({ sceneId }: { sceneId: string }) {
  const library = useLibrary();
  const { resolvedTheme } = useTheme();
  const scene = useMemo(
    () => library.scenes.find((candidate) => candidate.id === sceneId) ?? null,
    [library.scenes, sceneId],
  );
  const [bundle, setBundle] = useState<SceneBundle | null>(null);
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [savedContentHash, setSavedContentHash] = useState<{
    sceneId: string;
    hash: string | null;
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveState>("idle");
  const [shareOpen, setShareOpen] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  // `library` is a fresh object on every Convex update (and every save triggers
  // one), so depending on its identity would re-download the bundle and
  // re-render in a loop. Load each scene's bundle exactly once.
  const loadedSceneIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!library.ready || loadedSceneIdRef.current === sceneId) {
      return;
    }
    loadedSceneIdRef.current = sceneId;
    void library
      .loadSceneBundle(sceneId)
      .then(setBundle)
      .catch(() => {
        loadedSceneIdRef.current = null;
        setSaveStatus("error");
      });
  }, [library, sceneId]);

  const remote = shouldUseRemoteData;
  const canUseLive =
    remote &&
    bundle !== null &&
    bundle.elements.length <= MAX_ELEMENTS_PER_SCENE;

  const contentHash =
    savedContentHash?.sceneId === sceneId
      ? savedContentHash.hash
      : (scene?.contentHash ?? null);

  // `library` is a new object on every Convex update, so keep collab callbacks
  // stable via a ref to avoid re-running the room's effects each render.
  const libraryRef = useRef(library);
  useEffect(() => {
    libraryRef.current = library;
  }, [library]);

  const onSnapshot = useCallback(
    async (snapshot: SnapshotBundle) => {
      const sceneBundle = normalizeSceneBundle(snapshotToSceneBundle(snapshot));
      const hash = await sha256Hex(JSON.stringify(sceneBundle));
      await libraryRef.current.saveSceneBundle(sceneId, sceneBundle);
      setBundle(sceneBundle);
      setSavedContentHash({ sceneId, hash });
      return hash;
    },
    [sceneId],
  );

  const onLoadFiles = useCallback(
    async (fileIds: string[]): Promise<BinaryFileData[]> => {
      const loaded = await libraryRef.current.loadSceneBundle(sceneId);
      const files = loaded.files as Record<string, BinaryFileData>;
      return fileIds.map((id) => files[id]).filter(Boolean);
    },
    [sceneId],
  );

  const handleCanvasApi = useCallback((api: ExcalidrawImperativeAPI) => {
    excalidrawApiRef.current = api;
    setCanvasReady(true);
  }, []);

  if (!library.ready) {
    return (
      <main className="flex h-screen flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-border px-3">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="flex-1 rounded-none" />
      </main>
    );
  }

  if (!scene) {
    return (
      <main className="bg-paper-dots flex min-h-screen items-center justify-center p-6">
        <div className="sketch-card max-w-sm space-y-4 bg-card p-8 text-center">
          <LogoMark className="mx-auto size-10" />
          <div>
            <h1 className="font-display text-xl font-bold">Scene not found</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This scene may have been deleted or moved.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard">Back to library</Link>
          </Button>
        </div>
      </main>
    );
  }

  async function save(nextBundle: SceneBundle): Promise<SaveState> {
    const sceneBundle = normalizeSceneBundle(nextBundle);
    setBundle(sceneBundle);
    setSaveStatus("saving");
    try {
      await library.saveSceneBundle(sceneId, sceneBundle);
      setSavedContentHash({
        sceneId,
        hash: await sha256Hex(JSON.stringify(sceneBundle)),
      });
      setSaveStatus("saved");
      return "saved";
    } catch {
      setSaveStatus("error");
      return "error";
    }
  }

  async function insertAiDiagram(diagram: GeneratedAiDiagram) {
    const api = excalidrawApiRef.current;
    if (!api || !bundle) {
      throw new Error("Canvas is not ready yet.");
    }

    const currentBundle = normalizeSceneBundle({
      ...bundle,
      elements: [...api.getSceneElementsIncludingDeleted()],
      appState: api.getAppState(),
      files: api.getFiles(),
    });
    const { bundle: nextBundle, insertedElements } = appendDiagramToBundle(
      currentBundle,
      diagram.bundle,
    );
    setSaveStatus("saving");

    try {
      await library.saveSceneBundle(sceneId, nextBundle);
      setBundle(nextBundle);
      setSavedContentHash({
        sceneId,
        hash: await sha256Hex(JSON.stringify(nextBundle)),
      });
      setSaveStatus("saved");
      api.updateScene({
        elements: nextBundle.elements as never,
        appState: nextBundle.appState as never,
        captureUpdate: "IMMEDIATELY",
      });
      api.scrollToContent(insertedElements as never, {
        fitToContent: true,
        viewportZoomFactor: 0.8,
      });
    } catch {
      setSaveStatus("error");
      throw new Error("Could not save the AI diagram into this scene.");
    }
  }

  return (
    <main className="flex h-screen min-h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
        <Button
          asChild
          size="icon"
          variant="ghost"
          aria-label="Back to library"
        >
          <Link href="/dashboard">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="h-5 w-px bg-border" />
        <div className="group relative flex min-w-0 items-center">
          <Input
            aria-label="Scene title"
            title="Click to rename"
            className="h-8 max-w-md border-transparent bg-transparent px-2 pr-7 font-display text-base font-bold shadow-none hover:bg-muted/60 focus-visible:bg-muted/60"
            value={scene.title}
            onChange={(event) => {
              void library.updateScene(sceneId, {
                title: event.target.value || "Untitled scene",
              });
            }}
          />
          <Pencil className="pointer-events-none absolute right-1.5 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-0" />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {joinedRoom ? null : <SaveStatus state={saveStatus} />}
          {joinedRoom ? null : (
            <AiDiagramDialog
              disabled={!canvasReady || !bundle}
              onDiagramReady={insertAiDiagram}
              successTitle="AI diagram added"
            />
          )}
          {canUseLive ? (
            <RoomControls
              sceneId={sceneId}
              allowStart
              joined={joinedRoom}
              onBeforeStart={async () => {
                if (bundle) {
                  await save(bundle);
                }
              }}
              onJoin={() => setJoinedRoom(true)}
            />
          ) : null}
          <ThemeToggle />
          <Button
            size="icon"
            variant="ghost"
            aria-label="Share scene"
            onClick={() => setShareOpen(true)}
          >
            <Share2 />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Delete scene">
                <Trash2 />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">
                  Delete this scene?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  The latest saved drawing will be removed. This can&apos;t be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    await library.deleteScene(sceneId);
                    window.location.href = "/dashboard";
                  }}
                >
                  Delete scene
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <ShareSceneDialog
            sceneId={sceneId}
            open={shareOpen}
            onOpenChange={setShareOpen}
          />
        </div>
      </header>
      <section className="min-h-0 flex-1">
        {bundle ? (
          canUseLive && joinedRoom ? (
            <CollaborativeCanvas
              sceneId={sceneId}
              initialBundle={bundle}
              contentHash={contentHash}
              theme={resolvedTheme}
              onSnapshot={onSnapshot}
              onLoadFiles={onLoadFiles}
              onBundleDraftChange={setBundle}
              onStopped={() => setJoinedRoom(false)}
            />
          ) : (
            <ExcalidrawCanvas
              initialBundle={bundle}
              onApi={handleCanvasApi}
              onBundleDraftChange={setBundle}
              onBundleChange={save}
              theme={resolvedTheme}
            />
          )
        ) : (
          <Skeleton className="h-full rounded-none" />
        )}
      </section>
    </main>
  );
}

export function Editor({ sceneId }: { sceneId: string }) {
  return (
    <LibraryProvider>
      <EditorContent sceneId={sceneId} />
    </LibraryProvider>
  );
}
