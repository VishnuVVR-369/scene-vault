"use client";

import { useEffect, useMemo, useState } from "react";

import { LogoMark } from "@/components/brand";
import { ActiveRoomIndicator } from "@/components/collab/room-indicator";
import { useRoom, type SnapshotBundle } from "@/components/collab/use-room";
import { ExcalidrawCanvas } from "@/components/excalidraw-canvas";
import { colorForId } from "@/lib/collab/colors";
import {
  loadGuestIdentity,
  saveGuestIdentity,
  type CollabIdentity,
} from "@/lib/collab/identity";
import type { SceneBundle } from "@/lib/domain";
import { useAuthUser } from "@/lib/use-auth-user";

import type { BinaryFileData } from "@excalidraw/excalidraw/types";

type CollaborativeCanvasProps = {
  sceneId: string;
  token?: string;
  initialBundle: SceneBundle;
  contentHash: string | null;
  theme?: "light" | "dark";
  onSnapshot: (bundle: SnapshotBundle) => Promise<string | null>;
  onLoadFiles?: (fileIds: string[]) => Promise<BinaryFileData[]>;
  onBundleDraftChange?: (bundle: SceneBundle) => void;
  onStopped?: () => void;
};

export function CollaborativeCanvas(props: CollaborativeCanvasProps) {
  const { user, isSignedIn } = useAuthUser();
  const onStopped = props.onStopped;
  const [guest, setGuest] = useState<CollabIdentity>(() => loadGuestIdentity());
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  const identity: CollabIdentity = useMemo(() => {
    if (isSignedIn && user) {
      return {
        name: user.name,
        color: colorForId(user.id),
      };
    }
    return guest;
  }, [isSignedIn, user, guest]);

  const room = useRoom({
    enabled: true,
    sceneId: props.sceneId,
    token: props.token,
    identity,
    initialElements: props.initialBundle.elements as never,
    contentHash: props.contentHash,
    canSnapshot: Boolean(isSignedIn),
    onSnapshot: props.onSnapshot,
    onLoadFiles: props.onLoadFiles,
  });

  useEffect(() => {
    if (room.status === "ended") {
      onStopped?.();
    }
  }, [room.status, onStopped]);

  if (room.status === "revoked") {
    return (
      <div className="bg-paper-dots flex h-full items-center justify-center p-6">
        <div className="sketch-card max-w-sm space-y-4 bg-card p-8 text-center">
          <LogoMark className="mx-auto size-10" />
          <div>
            <h1 className="font-display text-xl font-bold">Access ended</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This collaboration link was disabled or reset. Ask the owner for a
              new one.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const sortedParticipants = [...room.participants].sort((a, b) =>
    a.isSelf === b.isSelf ? 0 : a.isSelf ? -1 : 1,
  );

  return (
    <div className="relative h-full min-h-0">
      <ExcalidrawCanvas
        initialBundle={props.initialBundle}
        theme={props.theme}
        mode="edit"
        onApi={room.onApi}
        onBundleDraftChange={props.onBundleDraftChange}
        onSceneChange={(elements, appState, files) =>
          room.onSceneChange(elements as never, appState, files)
        }
        onPointerUpdate={room.onPointerUpdate}
      />
      <ActiveRoomIndicator
        status={room.status}
        participants={sortedParticipants}
        guest={guest}
        isSignedIn={isSignedIn}
        canStop={room.canStop}
        stopping={stopping}
        stopError={stopError}
        onGuestChange={(next) => {
          setGuest(next);
          saveGuestIdentity(next);
        }}
        onStop={async () => {
          setStopping(true);
          setStopError(null);
          try {
            await room.stopRoom();
            onStopped?.();
          } catch (err) {
            setStopError(
              err instanceof Error ? err.message : "Could not stop room",
            );
          } finally {
            setStopping(false);
          }
        }}
      />
    </div>
  );
}
