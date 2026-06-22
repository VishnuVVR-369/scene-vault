"use client";

import { ArrowLeft, Check, CloudUpload, Copy, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LogoMark } from "@/components/brand";
import { ExcalidrawCanvas } from "@/components/excalidraw-canvas";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createEmptySceneBundle,
  sharedSceneMetadataSchema,
  signedStorageTargetSchema,
  type SceneBundle,
  type SharedSceneMetadata,
} from "@/lib/domain";
import { normalizeSceneBundle } from "@/lib/excalidraw-scene";
import { sha256Hex } from "@/lib/hash";
import { renderSceneThumbnailBlob } from "@/lib/thumbnail";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

type SharedEditorMode = "view" | "edit";
type SaveState = "idle" | "saving" | "saved" | "error";

function SaveStatus({ state }: { state: SaveState }) {
  const config = {
    idle: { icon: CloudUpload, label: "Ready", className: "text-muted-foreground" },
    saving: { icon: Loader2, label: "Saving...", className: "text-muted-foreground" },
    saved: { icon: Check, label: "Saved", className: "text-[var(--chart-3)]" },
    error: { icon: TriangleAlert, label: "Save failed", className: "text-destructive" },
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

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error("Request failed");
  }
  return response.json();
}

export function SharedEditor({
  token,
  mode,
}: {
  token: string;
  mode: SharedEditorMode;
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [metadata, setMetadata] = useState<SharedSceneMetadata | null>(null);
  const [bundle, setBundle] = useState<SceneBundle | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveState>("idle");
  const [duplicating, setDuplicating] = useState(false);
  const lastSavedHashRef = useRef<string | null>(null);
  const shareBase = useMemo(() => `/api/share/${encodeURIComponent(token)}`, [token]);
  const canEdit = mode === "edit";

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
    async (nextBundle: SceneBundle) => {
      try {
        const blob = await renderSceneThumbnailBlob(nextBundle);
        if (!blob) {
          return null;
        }
        const target = signedStorageTargetSchema.parse(
          await fetchJson(`${shareBase}/thumbnail/upload`, { method: "POST" }),
        );
        const response = await fetch(target.url, {
          method: "PUT",
          headers: { "content-type": "image/png" },
          body: blob,
        });
        return response.ok ? target.key : null;
      } catch {
        return null;
      }
    },
    [shareBase],
  );

  const save = useCallback(
    async (nextBundle: SceneBundle) => {
      if (!canEdit) {
        return;
      }
      setSaveStatus("saving");
      try {
        const parsed = normalizeSceneBundle(nextBundle);
        const serialized = JSON.stringify(parsed);
        const contentHash = await sha256Hex(serialized);
        if (lastSavedHashRef.current === contentHash) {
          setSaveStatus("saved");
          return;
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
        const uploadResponse = await fetch(target.url, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: serialized,
        });
        if (!uploadResponse.ok) {
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
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    },
    [canEdit, shareBase, uploadThumbnail],
  );

  async function duplicate() {
    if (duplicating) return;
    setDuplicating(true);
    try {
      const response = await fetch(`${shareBase}/duplicate`, { method: "POST" });
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
            <h1 className="font-display text-xl font-bold">Share link unavailable</h1>
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
          {canEdit ? <SaveStatus state={saveStatus} /> : null}
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
        <ExcalidrawCanvas
          initialBundle={bundle}
          onBundleChange={canEdit ? save : undefined}
          mode={canEdit ? "edit" : "view"}
          theme={resolvedTheme}
        />
      </section>
    </main>
  );
}
