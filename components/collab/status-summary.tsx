import { Wifi, WifiOff } from "lucide-react";

import type { RoomStatus } from "@/components/collab/use-room";
import { cn } from "@/lib/utils";

function participantLabel(count: number): string {
  return `${count} ${count === 1 ? "participant" : "participants"}`;
}

function roomStatusLabel(status: RoomStatus): string {
  switch (status) {
    case "ready":
      return "Live room";
    case "hydrating":
      return "Syncing room";
    case "connecting":
      return "Connecting";
    case "error":
      return "Offline";
    case "ended":
      return "Room ended";
    case "revoked":
      return "Access ended";
    case "idle":
      return "Room idle";
  }
}

export function StatusSummary({
  status,
  count,
  compact = false,
}: {
  status: RoomStatus;
  count: number;
  compact?: boolean;
}) {
  const live = status === "ready";
  const Icon = live ? Wifi : WifiOff;

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        compact ? "px-0" : "px-1.5",
      )}
      aria-live="polite"
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
          live && "bg-[var(--chart-3)]/10 text-[var(--chart-3)]",
        )}
      >
        <Icon className="size-4" />
      </span>
      {compact ? null : (
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold leading-tight">
            {roomStatusLabel(status)}
          </span>
          <span className="block truncate text-[11px] leading-tight text-muted-foreground">
            {participantLabel(count)}
          </span>
        </span>
      )}
    </div>
  );
}
