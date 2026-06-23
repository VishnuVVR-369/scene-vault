"use client";

import { Folder, FolderOpen } from "lucide-react";

import { useLibrary } from "@/components/library-provider";
import { Button } from "@/components/ui/button";

import { childFoldersOf } from "./utils";

export function FolderTree({
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
  const children = childFoldersOf(folders, parentFolderId);
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
