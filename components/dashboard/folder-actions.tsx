"use client";

import { Edit3, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";

import { useLibrary } from "@/components/library-provider";
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

import { RenameFolderDialog } from "./dialogs";

export function FolderActions({ folderId }: { folderId: string }) {
  const library = useLibrary();
  const toast = useToast();
  const [renameOpen, setRenameOpen] = useState(false);
  const folder = library.folders.find((candidate) => candidate.id === folderId);

  async function rename(name: string) {
    try {
      await library.renameFolder(folderId, name);
      toast({ variant: "success", title: "Folder renamed" });
    } catch {
      toast({ variant: "error", title: "Couldn't rename folder" });
    }
  }

  async function remove() {
    try {
      await library.deleteFolder(folderId);
      toast({ variant: "success", title: "Folder deleted" });
    } catch {
      toast({ variant: "error", title: "Couldn't delete folder" });
    }
  }

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Folder actions"
            size="icon-sm"
            variant="ghost"
            className="opacity-100 group-hover:opacity-100 md:opacity-60"
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
        onRename={(name) => void rename(name)}
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
          <AlertDialogAction onClick={() => void remove()}>
            Delete folder
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
