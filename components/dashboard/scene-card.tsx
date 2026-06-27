"use client";

import { Clock3 } from "lucide-react";
import Link from "next/link";

import { SceneActions } from "@/components/dashboard/scene-actions";
import { SceneThumbnail } from "@/components/scene-thumbnail";
import { type SceneMetadata } from "@/lib/domain";
import { formatRelativeTime } from "@/lib/relative-time";

// A single scene tile, shared by the dashboard's Pinned and Scenes sections.
// `index` only drives the staggered entrance animation and the alternating
// hover tilt, so the two sections each restart from 0 for a tidy cascade.
export function SceneCard({
  scene,
  index,
  thumbnailSrc,
}: {
  scene: SceneMetadata;
  index: number;
  thumbnailSrc?: string;
}) {
  return (
    <article
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
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
          src={thumbnailSrc}
          className="h-full w-full"
        />
      </Link>
      <div className="flex items-start justify-between gap-2 p-2.5">
        <div className="min-w-0">
          <Link
            href={`/scenes/${scene.id}`}
            className="block truncate text-sm font-medium hover:text-primary"
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
        <SceneActions sceneId={scene.id} pinned={scene.pinned} />
      </div>
    </article>
  );
}
