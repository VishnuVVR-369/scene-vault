"use client";

import { FilePlus2, FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export function FolderDialog({
  parentFolderId,
  onCreate,
}: {
  parentFolderId: string | null;
  onCreate: (name: string, parentFolderId: string | null) => Promise<void>;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function submit() {
    if (creating) return;
    setCreating(true);
    try {
      await onCreate(name || "New folder", parentFolderId);
      setName("");
      setOpen(false);
    } catch {
      toast({
        variant: "error",
        title: "Couldn't create folder",
        description: "Please try again.",
      });
    } finally {
      setCreating(false);
    }
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
          <Button onClick={submit} disabled={creating}>
            {creating ? "Creating…" : "Create folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SceneDialog({
  folderId,
  onCreate,
}: {
  folderId: string | null;
  onCreate: (title: string, folderId: string | null) => Promise<string>;
}) {
  const router = useRouter();
  const toast = useToast();
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
    } catch {
      toast({
        variant: "error",
        title: "Couldn't create scene",
        description: "Please try again.",
      });
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

export function RenameFolderDialog({
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
