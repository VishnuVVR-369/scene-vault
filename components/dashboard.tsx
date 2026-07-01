"use client";

import {
  ChevronRight,
  FilePlus2,
  PanelLeft,
  Pin,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { Wordmark } from "@/components/brand";
import { AiDiagramDialog } from "@/components/ai-diagram-dialog";
import { AccountControls } from "@/components/dashboard/account-controls";
import { FolderDialog, SceneDialog } from "@/components/dashboard/dialogs";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FolderTree } from "@/components/dashboard/folder-tree";
import { SceneCard } from "@/components/dashboard/scene-card";
import { SortControl } from "@/components/dashboard/sort-control";
import { sortScenes, type SortKey } from "@/components/dashboard/utils";
import { LibraryProvider, useLibrary } from "@/components/library-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { filterScenes, getFolderPath } from "@/lib/library-state";

// The library navigation (All scenes + folder tree), shared by the desktop
// sidebar and the mobile drawer. `onSelect` lets the caller close the drawer
// after a pick on mobile while plain selecting on desktop.
function LibraryNav({
  activeFolderId,
  onSelect,
  sceneCounts,
}: {
  activeFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  sceneCounts: Map<string, number>;
}) {
  const library = useLibrary();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
          Library
        </p>
        <FolderDialog
          parentFolderId={activeFolderId}
          onCreate={library.createFolder}
        />
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <nav className="space-y-1 p-3">
          <Button
            className="w-full justify-start gap-2"
            variant={activeFolderId === null ? "secondary" : "ghost"}
            onClick={() => onSelect(null)}
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
            onSelect={onSelect}
            sceneCounts={sceneCounts}
          />
          {library.folders.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No folders yet. Make one to start organizing.
            </p>
          ) : null}
        </nav>
      </ScrollArea>
    </div>
  );
}

function DashboardContent() {
  const library = useLibrary();
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
      profileId: "ui",
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

  // Pinned scenes break out into their own section above the rest, scoped to
  // whatever the user is currently looking at (active folder + search).
  const pinnedScenes = useMemo(
    () => visibleScenes.filter((scene) => scene.pinned),
    [visibleScenes],
  );
  const unpinnedScenes = useMemo(
    () => visibleScenes.filter((scene) => !scene.pinned),
    [visibleScenes],
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-40" />
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

      {/* Mobile: the library lives in a slide-in drawer instead of stacking
          on top of the scenes and shoving them off-screen. */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[300px] max-w-[85vw] gap-0 bg-sidebar p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Library</SheetTitle>
            <SheetDescription>Browse your folders and scenes.</SheetDescription>
          </SheetHeader>
          <LibraryNav
            activeFolderId={activeFolderId}
            onSelect={(folderId) => {
              setActiveFolderId(folderId);
              setMobileNavOpen(false);
            }}
            sceneCounts={sceneCounts}
          />
        </SheetContent>
      </Sheet>

      <main className="grid flex-1 grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside className="hidden border-border bg-sidebar md:block md:border-r">
          <div className="sticky top-16 h-[calc(100dvh-4rem)]">
            <LibraryNav
              activeFolderId={activeFolderId}
              onSelect={setActiveFolderId}
              sceneCounts={sceneCounts}
            />
          </div>
        </aside>

        <section className="bg-paper-dots min-w-0">
          <header className="sticky top-16 z-20 flex min-h-16 flex-col gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="Browse folders"
                className="shrink-0 md:hidden"
                onClick={() => setMobileNavOpen(true)}
              >
                <PanelLeft />
              </Button>
              <div className="min-w-0">
                {folderPath.length > 1 ? (
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
                ) : null}
                <div className="flex items-baseline gap-2">
                  <h1 className="truncate font-display text-xl font-bold sm:text-2xl">
                    {activeFolderId ? folderPath.at(-1) : "All scenes"}
                  </h1>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {visibleScenes.length}{" "}
                    {visibleScenes.length === 1 ? "scene" : "scenes"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
              <div className="flex items-center gap-2">
                <SortControl value={sort} onChange={setSort} />
                <AiDiagramDialog
                  folderId={activeFolderId}
                  className="flex-1 sm:flex-initial"
                />
                <SceneDialog
                  folderId={activeFolderId}
                  onCreate={library.createScene}
                  className="flex-1 sm:flex-initial"
                />
              </div>
            </div>
          </header>

          <div className="space-y-8 p-4 sm:p-6">
            {visibleScenes.length === 0 ? (
              query ? (
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
                    <div className="flex flex-wrap justify-center gap-2">
                      <AiDiagramDialog folderId={activeFolderId} />
                      <SceneDialog
                        folderId={activeFolderId}
                        onCreate={library.createScene}
                      />
                    </div>
                  }
                />
              )
            ) : (
              <>
                {pinnedScenes.length ? (
                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <Pin className="size-4 text-primary" />
                      <h2 className="text-sm font-semibold">Pinned</h2>
                      <Badge variant="secondary" className="font-mono">
                        {pinnedScenes.length}
                      </Badge>
                    </div>
                    <div
                      className={`grid gap-3 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
                        isFiltering ? "opacity-60" : "opacity-100"
                      }`}
                    >
                      {pinnedScenes.map((scene, index) => (
                        <SceneCard
                          key={scene.id}
                          scene={scene}
                          index={index}
                          thumbnailSrc={library.thumbnails[scene.id]}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {unpinnedScenes.length ? (
                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <h2 className="text-sm font-semibold">Scenes</h2>
                      <Badge variant="secondary" className="font-mono">
                        {unpinnedScenes.length}
                      </Badge>
                    </div>
                    <div
                      className={`grid gap-3 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
                        isFiltering ? "opacity-60" : "opacity-100"
                      }`}
                    >
                      {unpinnedScenes.map((scene, index) => (
                        <SceneCard
                          key={scene.id}
                          scene={scene}
                          index={index}
                          thumbnailSrc={library.thumbnails[scene.id]}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            )}
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
