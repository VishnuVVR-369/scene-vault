"use client";

import {
  ChevronRight,
  Clock3,
  FilePlus2,
  Folder,
  FolderOpen,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { Wordmark } from "@/components/brand";
import { AccountControls } from "@/components/dashboard/account-controls";
import { FolderDialog, SceneDialog } from "@/components/dashboard/dialogs";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FolderActions } from "@/components/dashboard/folder-actions";
import { FolderTree } from "@/components/dashboard/folder-tree";
import { SceneActions } from "@/components/dashboard/scene-actions";
import { SortControl } from "@/components/dashboard/sort-control";
import {
  childFoldersOf,
  folderColor,
  sortScenes,
  type SortKey,
} from "@/components/dashboard/utils";
import { LibraryProvider, useLibrary } from "@/components/library-provider";
import { SceneThumbnail } from "@/components/scene-thumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { filterScenes, getFolderPath } from "@/lib/library-state";
import { formatRelativeTime } from "@/lib/relative-time";

function DashboardContent() {
  const library = useLibrary();
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const searchRef = useRef<HTMLInputElement>(null);
  // Filtering runs against a deferred copy of the query so typing stays
  // responsive even with a large library; the grid dims slightly while stale.
  const deferredQuery = useDeferredValue(query);
  const isFiltering = deferredQuery !== query;

  // Press "/" anywhere to jump to search — a small power-user nicety.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const syntheticState = useMemo(
    () => ({
      ownerId: "ui",
      folders: library.folders,
      scenes: library.scenes,
      bundles: {},
      thumbnails: {},
    }),
    [library.folders, library.scenes],
  );

  // Direct scene count per folder id, for sidebar + folder card badges.
  const sceneCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const scene of library.scenes) {
      if (scene.folderId) {
        counts.set(scene.folderId, (counts.get(scene.folderId) ?? 0) + 1);
      }
    }
    return counts;
  }, [library.scenes]);

  const visibleScenes = useMemo(
    () =>
      sortScenes(
        filterScenes(syntheticState, deferredQuery, activeFolderId),
        sort,
      ),
    [activeFolderId, deferredQuery, sort, syntheticState],
  );

  const folderPath = getFolderPath(syntheticState, activeFolderId);
  const childFolders = useMemo(
    () => childFoldersOf(library.folders, activeFolderId),
    [activeFolderId, library.folders],
  );

  if (!library.ready) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Wordmark />
          <Skeleton className="size-8 rounded-full" />
        </div>
        <main className="grid flex-1 grid-cols-1 md:grid-cols-[280px_1fr]">
          <Skeleton className="m-4 hidden h-[calc(100vh-6rem)] md:block" />
          <div className="space-y-4 p-4">
            <Skeleton className="h-10 w-full max-w-sm" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md">
        <Wordmark href="/" />
        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost" size="sm" className="h-9 px-3.5">
            <Link href="/docs">Docs</Link>
          </Button>
          <AccountControls />
        </div>
      </div>

      <main className="grid flex-1 grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside className="border-b border-border bg-sidebar md:border-b-0 md:border-r">
          <div className="flex h-14 items-center justify-between px-4">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Library
            </p>
            <FolderDialog
              parentFolderId={activeFolderId}
              onCreate={library.createFolder}
            />
          </div>
          <Separator />
          <ScrollArea className="h-[calc(100vh-7.5rem)]">
            <nav className="space-y-1 p-3">
              <Button
                className="w-full justify-start gap-2"
                variant={activeFolderId === null ? "secondary" : "ghost"}
                onClick={() => setActiveFolderId(null)}
              >
                <Sparkles
                  className={activeFolderId === null ? "text-primary" : ""}
                />
                All scenes
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {library.scenes.length}
                </span>
              </Button>
              <FolderTree
                parentFolderId={null}
                activeFolderId={activeFolderId}
                onSelect={setActiveFolderId}
                sceneCounts={sceneCounts}
              />
              {library.folders.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No folders yet. Make one to start organizing.
                </p>
              ) : null}
            </nav>
          </ScrollArea>
        </aside>

        <section className="bg-paper-dots min-w-0">
          <header className="flex min-h-16 flex-col gap-3 border-b border-border bg-background/70 px-4 py-3 backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {folderPath.map((part, index) => (
                  <span
                    key={`${part}-${index}`}
                    className="inline-flex items-center gap-1"
                  >
                    {index > 0 ? <ChevronRight className="size-3" /> : null}
                    {part}
                  </span>
                ))}
              </div>
              <div className="flex items-baseline gap-2">
                <h1 className="font-display text-2xl font-bold">
                  {activeFolderId ? folderPath.at(-1) : "All scenes"}
                </h1>
                <span className="font-mono text-xs text-muted-foreground">
                  {visibleScenes.length}{" "}
                  {visibleScenes.length === 1 ? "scene" : "scenes"}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  aria-label="Search scenes and folders"
                  className="h-9 w-full pl-8 pr-9 sm:w-64"
                  placeholder="Search title or folder"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query ? null : (
                  <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 font-mono text-[10px] leading-5 text-muted-foreground sm:inline-block">
                    /
                  </kbd>
                )}
              </div>
              <SortControl value={sort} onChange={setSort} />
              <SceneDialog
                folderId={activeFolderId}
                onCreate={library.createScene}
              />
            </div>
          </header>

          <div className="space-y-8 p-4 sm:p-6">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold">Folders</h2>
                <Badge variant="secondary" className="font-mono">
                  {childFolders.length}
                </Badge>
              </div>
              {childFolders.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {childFolders.map((folder, index) => {
                    const count = sceneCounts.get(folder.id) ?? 0;
                    return (
                      <div
                        key={folder.id}
                        className="group flex h-16 items-center gap-3 rounded-2xl border-[1.5px] border-border bg-card px-3 transition-all hover:-translate-y-0.5 hover:border-foreground/60 hover:shadow-sketch-sm"
                      >
                        <button
                          className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none"
                          aria-label={`Open folder ${folder.name}`}
                          onClick={() => setActiveFolderId(folder.id)}
                        >
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:-rotate-6"
                            style={{
                              backgroundColor: `color-mix(in oklch, ${folderColor(index)} 16%, transparent)`,
                            }}
                          >
                            <Folder
                              className="size-5"
                              style={{ color: folderColor(index) }}
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {folder.name}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {count} {count === 1 ? "scene" : "scenes"}
                            </span>
                          </span>
                        </button>
                        <FolderActions folderId={folder.id} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={<FolderOpen className="size-6" />}
                  title="No folders here"
                  hint="Folders keep related scenes together."
                />
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold">Scenes</h2>
                <Badge variant="secondary" className="font-mono">
                  {visibleScenes.length}
                </Badge>
              </div>
              {visibleScenes.length ? (
                <div
                  className={`grid gap-4 transition-opacity duration-200 sm:grid-cols-2 xl:grid-cols-3 ${
                    isFiltering ? "opacity-60" : "opacity-100"
                  }`}
                >
                  {visibleScenes.map((scene, index) => (
                    <article
                      key={scene.id}
                      style={{
                        animationDelay: `${Math.min(index, 12) * 30}ms`,
                      }}
                      className={`sketch-card animate-card-in group overflow-hidden bg-card transition-all duration-200 hover:-translate-y-1 ${
                        index % 2 === 0 ? "hover:-rotate-1" : "hover:rotate-1"
                      }`}
                    >
                      <Link
                        className="bg-paper-dots block aspect-[16/10] border-b-[1.5px] border-border"
                        href={`/scenes/${scene.id}`}
                        aria-label={`Open ${scene.title}`}
                      >
                        <SceneThumbnail
                          seed={scene.id}
                          src={library.thumbnails[scene.id]}
                          className="h-full w-full"
                        />
                      </Link>
                      <div className="flex items-start justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <Link
                            href={`/scenes/${scene.id}`}
                            className="block truncate font-medium hover:text-primary"
                          >
                            {scene.title}
                          </Link>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock3 className="size-3" />
                            {scene.lastSavedAt
                              ? `Edited ${formatRelativeTime(scene.lastSavedAt)}`
                              : "Not saved yet"}
                          </p>
                        </div>
                        <SceneActions sceneId={scene.id} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : query ? (
                <EmptyState
                  icon={<Search className="size-6" />}
                  title="Nothing matches that search"
                  hint="Try a different title or folder name."
                />
              ) : (
                <EmptyState
                  icon={<FilePlus2 className="size-6" />}
                  title="A blank canvas awaits"
                  hint="Create your first scene and start drawing."
                  action={
                    <SceneDialog
                      folderId={activeFolderId}
                      onCreate={library.createScene}
                    />
                  }
                />
              )}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

export function Dashboard() {
  return (
    <LibraryProvider>
      <DashboardContent />
    </LibraryProvider>
  );
}
