"use client";

import {
  Copy,
  Loader2,
  MoreHorizontal,
  Pin,
  PinOff,
  Share2,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { useLibrary } from "@/components/library-provider";
import { ShareSceneDialog } from "@/components/share-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";

export function SceneActions({
  sceneId,
  pinned,
}: {
  sceneId: string;
  pinned: boolean;
}) {
  const library = useLibrary();
  const toast = useToast();
  const [shareOpen, setShareOpen] = useState(false);
  // Duplicating can be slow in remote mode (download, copy, re-upload), so we
  // surface a spinner on the trigger and a toast on completion.
  const [busy, setBusy] = useState(false);

  async function togglePin() {
    try {
      await library.updateScene(sceneId, { pinned: !pinned });
      toast({
        variant: "success",
        title: pinned ? "Scene unpinned" : "Scene pinned",
      });
    } catch {
      toast({
        variant: "error",
        title: pinned ? "Couldn't unpin scene" : "Couldn't pin scene",
        description: "Please try again.",
      });
    }
  }

  async function duplicate() {
    setBusy(true);
    try {
      await library.duplicateScene(sceneId);
      toast({ variant: "success", title: "Scene duplicated" });
    } catch {
      toast({
        variant: "error",
        title: "Couldn't duplicate scene",
        description: "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      await library.deleteScene(sceneId);
      toast({ variant: "success", title: "Scene deleted" });
    } catch {
      toast({
        variant: "error",
        title: "Couldn't delete scene",
        description: "Please try again.",
      });
    }
  }

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Scene actions"
            size="icon-sm"
            variant="ghost"
            disabled={busy}
            className="opacity-60 group-hover:opacity-100 aria-expanded:opacity-100"
          >
            {busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void togglePin()}>
            {pinned ? <PinOff /> : <Pin />}
            {pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setShareOpen(true);
            }}
          >
            <Share2 />
            Share
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void duplicate()}>
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
          <AlertDialogAction onClick={() => void remove()}>
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
