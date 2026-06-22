"use client";

import { useUser } from "@clerk/nextjs";
import { Loader2, Pencil, Square, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ExcalidrawCanvas } from "@/components/excalidraw-canvas";
import { useRoom, type Participant, type SnapshotBundle } from "@/components/collab/use-room";
import { LogoMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COLLAB_COLORS, colorForId } from "@/lib/collab/colors";
import { loadGuestIdentity, saveGuestIdentity, type CollabIdentity } from "@/lib/collab/identity";
import { cn } from "@/lib/utils";
import type { SceneBundle } from "@/lib/domain";

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function Avatar({ participant }: { participant: Participant }) {
  return (
    <div
      className="flex size-8 items-center justify-center rounded-full border-2 border-background text-xs font-semibold text-white shadow-sm"
      style={{ backgroundColor: participant.color }}
      title={participant.isSelf ? `${participant.name} (you)` : participant.name}
    >
      {initials(participant.name)}
    </div>
  );
}

function StatusPill({ status, count }: { status: string; count: number }) {
  const live = status === "ready";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur",
        live ? "text-[var(--chart-3)]" : "text-muted-foreground",
      )}
      aria-live="polite"
    >
      {live ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
      {live ? `Live · ${count}` : status === "error" ? "Offline" : "Connecting…"}
    </span>
  );
}

function GuestIdentityEditor({
  identity,
  onChange,
}: {
  identity: CollabIdentity;
  onChange: (next: CollabIdentity) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(identity.name);
  const [color, setColor] = useState(identity.color);

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        className="gap-1.5 bg-card/90 shadow-sm backdrop-blur"
        onClick={() => {
          setName(identity.name);
          setColor(identity.color);
          setOpen(true);
        }}
      >
        <span className="size-3 rounded-full" style={{ backgroundColor: identity.color }} />
        <span className="max-w-28 truncate">{identity.name}</span>
        <Pencil className="size-3" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Your collaborator identity</DialogTitle>
            <DialogDescription>
              How you appear to others in this room. Visible to everyone with the link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="guest-name">Display name</Label>
              <Input
                id="guest-name"
                value={name}
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cursor color</Label>
              <div className="flex flex-wrap gap-2">
                {COLLAB_COLORS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-label={`Pick color ${option}`}
                    className={cn(
                      "size-7 rounded-full border-2 transition",
                      color === option ? "border-foreground" : "border-transparent",
                    )}
                    style={{ backgroundColor: option }}
                    onClick={() => setColor(option)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onChange({ name: name.trim() || "Guest", color });
                setOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CollaborativeCanvas(props: CollaborativeCanvasProps) {
  const { user, isSignedIn } = useUser();
  const onStopped = props.onStopped;
  const [guest, setGuest] = useState<CollabIdentity>(() => loadGuestIdentity());
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  const identity: CollabIdentity = useMemo(() => {
    if (isSignedIn && user) {
      return {
        name: user.fullName ?? user.firstName ?? user.username ?? "You",
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
              This collaboration link was disabled or reset. Ask the owner for a new one.
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
      <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2">
        <div className="pointer-events-auto">
          <StatusPill status={room.status} count={room.participants.length} />
        </div>
        <div className="pointer-events-auto flex -space-x-2">
          {sortedParticipants.slice(0, 5).map((participant) => (
            <Avatar key={participant.id} participant={participant} />
          ))}
          {sortedParticipants.length > 5 ? (
            <div className="flex size-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold">
              +{sortedParticipants.length - 5}
            </div>
          ) : null}
        </div>
        {!isSignedIn ? (
          <div className="pointer-events-auto">
            <GuestIdentityEditor
              identity={guest}
              onChange={(next) => {
                setGuest(next);
                saveGuestIdentity(next);
              }}
            />
          </div>
        ) : null}
        {room.canStop ? (
          <div className="pointer-events-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5 shadow-sm"
              disabled={stopping}
              onClick={async () => {
                setStopping(true);
                setStopError(null);
                try {
                  await room.stopRoom();
                  onStopped?.();
                } catch (err) {
                  setStopError(err instanceof Error ? err.message : "Could not stop room");
                } finally {
                  setStopping(false);
                }
              }}
            >
              {stopping ? <Loader2 className="animate-spin" /> : <Square />}
              Stop room
            </Button>
            {stopError ? (
              <span className="max-w-48 truncate rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                {stopError}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
