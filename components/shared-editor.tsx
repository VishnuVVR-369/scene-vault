"use client";

import { useUser } from "@clerk/nextjs";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LogoMark } from "@/components/brand";
import { CollaborativeCanvas } from "@/components/collab/collaborative-canvas";
import { RoomControls } from "@/components/collab/room-controls";
import { ExcalidrawCanvas } from "@/components/excalidraw-canvas";
import type { SnapshotBundle } from "@/components/collab/use-room";
import { ThemeToggle } from "@/components/theme-toggle";
import type { BinaryFileData } from "@excalidraw/excalidraw/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_ELEMENTS_PER_SCENE } from "@/convex/collabLogic";
import {
  createEmptySceneBundle,
  sharedSceneMetadataSchema,
  signedStorageTargetSchema,
  type SceneBundle,
  type SharedSceneMetadata,
} from "@/lib/domain";
import {
  normalizeSceneBundle,
  snapshotToSceneBundle,
} from "@/lib/excalidraw-scene";
import { sha256Hex } from "@/lib/hash";
import { fetchJson } from "@/lib/http";
import {
  putSceneBundleToSignedUrl,
  uploadThumbnailViaSignedUrl,
} from "@/lib/scene-transport";
import { useTheme } from "@/components/theme-provider";

type SharedEditorMode = "view" | "edit";

export function SharedEditor({
  token,
  mode,
}: {
  token: string;
  mode: SharedEditorMode;
}) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { resolvedTheme } = useTheme();
  const [metadata, setMetadata] = useState<SharedSceneMetadata | null>(null);
  const [bundle, setBundle] = useState<SceneBundle | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [joinedRoom, setJoinedRoom] = useState(false);
  const lastSavedHashRef = useRef<string | null>(null);
  const shareBase = useMemo(
    () => `/api/share/${encodeURIComponent(token)}`,
    [token],
  );
  const canEdit = mode === "edit";
  const canSingleUserEdit = canEdit && isLoaded && Boolean(isSignedIn);
  const canUseLive =
    canEdit &&
    bundle !== null &&
    bundle.elements.length <= MAX_ELEMENTS_PER_SCENE;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rawMetadata = await fetchJson(`${shareBase}/metadata`);
        const parsedMetadata = sharedSceneMetadataSchema.parse(rawMetadata);
        if (mode === "edit" && parsedMetadata.mode !== "edit") {
          throw new Error("Edit link not found");
        }
        let nextBundle = createEmptySceneBundle();
        if (parsedMetadata.hasScene) {
          const target = signedStorageTargetSchema.parse(
            await fetchJson(`${shareBase}/download`),
          );
          const sceneResponse = await fetch(target.url);
          if (!sceneResponse.ok) {
            throw new Error("Could not download scene");
          }
          nextBundle = normalizeSceneBundle(await sceneResponse.json());
        }
        if (!cancelled) {
          setMetadata(parsedMetadata);
          setBundle(nextBundle);
          lastSavedHashRef.current = parsedMetadata.contentHash;
        }
      } catch {
        if (!cancelled) {
          setLoadError(true);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [mode, shareBase]);

  const uploadThumbnail = useCallback(
    (nextBundle: SceneBundle) =>
      uploadThumbnailViaSignedUrl(`${shareBase}/thumbnail/upload`, nextBundle),
    [shareBase],
  );

  // Persist the live scene to R2 via the share routes (requires sign-in, which
  // the room enforces by only electing signed-in clients as snapshotters).
  const onSnapshot = useCallback(
    async (snapshot: SnapshotBundle): Promise<string | null> => {
      try {
        const parsed = normalizeSceneBundle(snapshotToSceneBundle(snapshot));
        const serialized = JSON.stringify(parsed);
        const contentHash = await sha256Hex(serialized);
        if (lastSavedHashRef.current === contentHash) {
          return contentHash;
        }
        const target = signedStorageTargetSchema.parse(
          await fetchJson(`${shareBase}/upload`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              contentType: "application/json",
              byteSize: new Blob([serialized]).size,
              contentHash,
            }),
          }),
        );
        const uploaded = await putSceneBundleToSignedUrl(target.url, serialized);
        if (!uploaded) {
          throw new Error("Could not upload scene");
        }
        const thumbnailObjectKey = await uploadThumbnail(parsed);
        await fetchJson(`${shareBase}/commit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            objectKey: target.key,
            byteSize: new Blob([serialized]).size,
            contentHash,
            ...(thumbnailObjectKey ? { thumbnailObjectKey } : {}),
          }),
        });
        lastSavedHashRef.current = contentHash;
        return contentHash;
      } catch {
        return null;
      }
    },
    [shareBase, uploadThumbnail],
  );

  const onLoadFiles = useCallback(
    async (fileIds: string[]): Promise<BinaryFileData[]> => {
      try {
        const target = signedStorageTargetSchema.parse(
          await fetchJson(`${shareBase}/download`),
        );
        const response = await fetch(target.url);
        if (!response.ok) {
          return [];
        }
        const downloaded = normalizeSceneBundle(await response.json());
        const files = downloaded.files as Record<string, BinaryFileData>;
        return fileIds.map((id) => files[id]).filter(Boolean);
      } catch {
        return [];
      }
    },
    [shareBase],
  );

  const saveSingleUserEdit = useCallback(
    async (nextBundle: SceneBundle) => {
      await onSnapshot({
        elements: nextBundle.elements as never,
        appState: nextBundle.appState,
        files: nextBundle.files as SnapshotBundle["files"],
      });
    },
    [onSnapshot],
  );

  async function duplicate() {
    if (duplicating) return;
    setDuplicating(true);
    try {
      const response = await fetch(`${shareBase}/duplicate`, {
        method: "POST",
      });
      if (response.status === 401) {
        window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`;
        return;
      }
      if (!response.ok) {
        throw new Error("Could not duplicate scene");
      }
      const result = (await response.json()) as { sceneId: string };
      router.push(`/scenes/${result.sceneId}`);
    } finally {
      setDuplicating(false);
    }
  }

  if (loadError) {
    return (
      <main className="bg-paper-dots flex min-h-screen items-center justify-center p-6">
        <div className="sketch-card max-w-sm space-y-4 bg-card p-8 text-center">
          <LogoMark className="mx-auto size-10" />
          <div>
            <h1 className="font-display text-xl font-bold">
              Share link unavailable
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This link may have been disabled, reset, or deleted.
            </p>
          </div>
          <Button asChild>
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (!metadata || !bundle) {
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

  return (
    <main className="flex h-screen min-h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
        <Button asChild size="icon" variant="ghost" aria-label="Back home">
          <Link href="/">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="h-5 w-px bg-border" />
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-bold">
            {metadata.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {canEdit ? "Shared edit link" : "Shared view link"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {canUseLive ? (
            <RoomControls
              sceneId={metadata.sceneId}
              token={token}
              allowStart={false}
              joined={joinedRoom}
              onJoin={() => setJoinedRoom(true)}
            />
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={duplicate}
            disabled={duplicating}
          >
            {duplicating ? <Loader2 className="animate-spin" /> : <Copy />}
            Duplicate
          </Button>
          <ThemeToggle />
        </div>
      </header>
      <section className="min-h-0 flex-1">
        {canUseLive && joinedRoom ? (
          <CollaborativeCanvas
            sceneId={metadata.sceneId}
            token={token}
            initialBundle={bundle}
            contentHash={metadata.contentHash}
            theme={resolvedTheme}
            onSnapshot={onSnapshot}
            onLoadFiles={onLoadFiles}
            onBundleDraftChange={setBundle}
            onStopped={() => setJoinedRoom(false)}
          />
        ) : (
          <ExcalidrawCanvas
            initialBundle={bundle}
            mode={canSingleUserEdit ? "edit" : "view"}
            onBundleDraftChange={canSingleUserEdit ? setBundle : undefined}
            onBundleChange={canSingleUserEdit ? saveSingleUserEdit : undefined}
            theme={resolvedTheme}
          />
        )}
      </section>
    </main>
  );
}
