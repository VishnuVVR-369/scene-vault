"use client";

import { useMutation, useQuery } from "convex/react";
import { Loader2, Radio, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type RoomControlsProps = {
  sceneId: string;
  token?: string;
  allowStart: boolean;
  joined: boolean;
  disabled?: boolean;
  onBeforeStart?: () => Promise<void>;
  onJoin: () => void;
};

export function RoomControls({
  sceneId,
  token,
  allowStart,
  joined,
  disabled,
  onBeforeStart,
  onJoin,
}: RoomControlsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startRoom = useMutation(api.collab.startRoom);
  const queryArgs = useMemo(
    () =>
      ({
        sceneId: sceneId as Id<"scenes">,
        ...(token ? { token } : {}),
      }) as const,
    [sceneId, token],
  );
  const roomView = useQuery(api.collab.getRoomView, queryArgs);

  if (joined) {
    return null;
  }

  const authorizedRoom = roomView?.authorized ? roomView : null;
  const loading = roomView === undefined;
  const active = Boolean(authorizedRoom?.active);
  const canStart = Boolean(allowStart && authorizedRoom?.canStart);
  const canJoin = active;
  const isDisabled = Boolean(
    disabled || busy || loading || (!canStart && !canJoin),
  );
  const label = loading ? "Room..." : canStart ? "Start room" : "Join room";
  const Icon = busy || loading ? Loader2 : canStart ? Radio : Users;
  const title =
    error ??
    (loading
      ? "Checking room"
      : canStart
        ? "Start live collaboration"
        : canJoin
          ? "Join live collaboration"
          : "Room has not been started");

  return (
    <Button
      data-testid={canStart ? "start-room-button" : "join-room-button"}
      size="sm"
      variant={canStart ? "default" : "outline"}
      className="gap-1.5"
      disabled={isDisabled}
      title={title}
      onClick={async () => {
        if (isDisabled) {
          return;
        }
        setBusy(true);
        setError(null);
        try {
          if (canStart) {
            await onBeforeStart?.();
            await startRoom({
              sceneId: sceneId as Id<"scenes">,
              ...(token ? { token } : {}),
            });
          }
          onJoin();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not open room");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Icon className={busy || loading ? "animate-spin" : undefined} />
      {label}
    </Button>
  );
}
