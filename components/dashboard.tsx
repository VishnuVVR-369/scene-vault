"use client";

import { UserButton } from "@clerk/nextjs";
import {
  ArrowDownUp,
  ChevronRight,
  Clock3,
  Copy,
  Edit3,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Search,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Wordmark } from "@/components/brand";
import { LibraryProvider, useLibrary } from "@/components/library-provider";
import { SceneThumbnail } from "@/components/scene-thumbnail";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { type SceneMetadata } from "@/lib/domain";
import { filterScenes, getFolderPath } from "@/lib/library-state";
import { formatRelativeTime } from "@/lib/relative-time";

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

type SortKey = "recent" | "name" | "created";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently edited" },
  { value: "name", label: "Name (A–Z)" },
  { value: "created", label: "Newest first" },
];

function sceneActivityAt(scene: SceneMetadata) {
  return scene.lastSavedAt ?? scene.updatedAt;
}

function sortScenes(scenes: SceneMetadata[], sort: SortKey) {
  const copy = [...scenes];
  switch (sort) {
    case "name":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case "created":
      return copy.sort((a, b) => b.createdAt - a.createdAt);
    case "recent":
    default:
      return copy.sort((a, b) => sceneActivityAt(b) - sceneActivityAt(a));
  }
}

function AccountControls() {
  const { resolvedTheme } = useTheme();
  return (
    <div className="flex items-center gap-1.5">
      <ThemeToggle />
      {hasClerk ? (
        <UserButton
          appearance={{ variables: clerkAppearance(resolvedTheme).variables }}
        />
      ) : (
        <Badge variant="outline" className="hidden sm:inline-flex">
          Local mode
        </Badge>
      )}
    </div>
  );
}

function SortControl({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (value: SortKey) => void;
}) {
  const current = SORT_OPTIONS.find((option) => option.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 justify-start gap-2">
          <ArrowDownUp />
          <span className="hidden sm:inline">{current?.label}</span>
          <span className="sm:hidden">Sort</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            data-active={value === option.value}
            className="data-[active=true]:font-semibold data-[active=true]:text-primary"
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DashboardContent() {
  const library = useLibrary();
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const searchRef = useRef<HTMLInputElement>(null);

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
    () => sortScenes(filterScenes(syntheticState, query, activeFolderId), sort),
    [activeFolderId, query, sort, syntheticState],
  );

  const folderPath = getFolderPath(syntheticState, activeFolderId);
  const childFolders = useMemo(
    () =>
      library.folders
        .filter((folder) => folder.parentFolderId === activeFolderId)
        .sort((a, b) => a.name.localeCompare(b.name)),
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
        <AccountControls />
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
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleScenes.map((scene, index) => (
                    <article
                      key={scene.id}
                      className={`sketch-card group overflow-hidden bg-card transition-all duration-200 hover:-translate-y-1 ${
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

const FOLDER_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function folderColor(index: number) {
  return FOLDER_COLORS[index % FOLDER_COLORS.length];
}

function FolderTree({
  parentFolderId,
  activeFolderId,
  onSelect,
  sceneCounts,
  depth = 0,
}: {
  parentFolderId: string | null;
  activeFolderId: string | null;
  onSelect: (folderId: string) => void;
  sceneCounts: Map<string, number>;
  depth?: number;
}) {
  const { folders } = useLibrary();
  const children = folders
    .filter((folder) => folder.parentFolderId === parentFolderId)
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      {children.map((folder) => {
        const count = sceneCounts.get(folder.id) ?? 0;
        return (
          <div key={folder.id}>
            <Button
              className="w-full justify-start gap-2"
              style={{ paddingLeft: `${10 + depth * 16}px` }}
              variant={activeFolderId === folder.id ? "secondary" : "ghost"}
              onClick={() => onSelect(folder.id)}
            >
              {activeFolderId === folder.id ? (
                <FolderOpen className="text-primary" />
              ) : (
                <Folder />
              )}
              <span className="truncate">{folder.name}</span>
              {count > 0 ? (
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {count}
                </span>
              ) : null}
            </Button>
            <FolderTree
              parentFolderId={folder.id}
              activeFolderId={activeFolderId}
              onSelect={onSelect}
              sceneCounts={sceneCounts}
              depth={depth + 1}
            />
          </div>
        );
      })}
    </>
  );
}

function FolderDialog({
  parentFolderId,
  onCreate,
}: {
  parentFolderId: string | null;
  onCreate: (name: string, parentFolderId: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function submit() {
    await onCreate(name || "New folder", parentFolderId);
    setName("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="icon-sm"
        variant="outline"
        aria-label="Create folder"
        onClick={() => setOpen(true)}
      >
        <FolderPlus />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">New folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="folder-name">Name</Label>
          <Input
            id="folder-name"
            autoFocus
            placeholder="e.g. Product, Personal, Q3"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
        </div>
        <DialogFooter>
          <Button onClick={submit}>Create folder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SceneDialog({
  folderId,
  onCreate,
}: {
  folderId: string | null;
  onCreate: (title: string, folderId: string | null) => Promise<string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function submit() {
    if (creating) return;
    setCreating(true);
    try {
      const sceneId = await onCreate(title || "Untitled scene", folderId);
      setTitle("");
      setOpen(false);
      // New scenes exist to be drawn — drop straight into the editor.
      router.push(`/scenes/${sceneId}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} className="shadow-sketch-sm">
        <FilePlus2 />
        New scene
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">New scene</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="scene-title">Title</Label>
          <Input
            id="scene-title"
            autoFocus
            placeholder="e.g. Onboarding flow"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={creating}>
            {creating ? "Creating…" : "Create scene"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameFolderDialog({
  open,
  onOpenChange,
  currentName,
  onRename,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(currentName);

  function submit() {
    const trimmed = name.trim();
    if (trimmed) {
      onRename(trimmed);
    }
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setName(currentName);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Rename folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rename-folder">Name</Label>
          <Input
            id="rename-folder"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
        </div>
        <DialogFooter>
          <Button onClick={submit}>Save name</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FolderActions({ folderId }: { folderId: string }) {
  const library = useLibrary();
  const [renameOpen, setRenameOpen] = useState(false);
  const folder = library.folders.find((candidate) => candidate.id === folderId);

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Folder actions"
            size="icon-sm"
            variant="ghost"
            className="opacity-60 group-hover:opacity-100"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              setRenameOpen(true);
            }}
          >
            <Edit3 />
            Rename
          </DropdownMenuItem>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              className="text-destructive"
              onSelect={(event) => event.preventDefault()}
              onClick={(event) => event.stopPropagation()}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameFolderDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentName={folder?.name ?? ""}
        onRename={(name) => void library.renameFolder(folderId, name)}
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">
            Delete this folder?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This also deletes nested folders and every scene inside them. This
            can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => library.deleteFolder(folderId)}>
            Delete folder
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SceneActions({ sceneId }: { sceneId: string }) {
  const library = useLibrary();
  const [shareOpen, setShareOpen] = useState(false);
  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Scene actions"
            size="icon-sm"
            variant="ghost"
            className="opacity-60 group-hover:opacity-100"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setShareOpen(true);
            }}
          >
            <Share2 />
            Share
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => library.duplicateScene(sceneId)}>
            <Copy />
            Duplicate
          </DropdownMenuItem>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              className="text-destructive"
              onSelect={(event) => event.preventDefault()}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">
            Delete this scene?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The latest saved drawing for this scene will be removed. This
            can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => library.deleteScene(sceneId)}>
            Delete scene
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
      <ShareSceneDialog
        sceneId={sceneId}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </AlertDialog>
  );
}

function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="sketch-edge flex flex-col items-center justify-center gap-3 rounded-xl border-dashed bg-card/40 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <div>
        <p className="font-display text-base font-bold">{title}</p>
        {hint ? (
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      {action}
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
