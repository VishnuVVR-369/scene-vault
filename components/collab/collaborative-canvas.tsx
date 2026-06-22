"use client";

import { useUser } from "@clerk/nextjs";
import {
  GripHorizontal,
  Loader2,
  Minimize2,
  Pencil,
  Square,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ExcalidrawCanvas } from "@/components/excalidraw-canvas";
import {
  useRoom,
  type Participant,
  type RoomStatus,
  type SnapshotBundle,
} from "@/components/collab/use-room";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { COLLAB_COLORS, colorForId } from "@/lib/collab/colors";
import {
  loadGuestIdentity,
  saveGuestIdentity,
  type CollabIdentity,
} from "@/lib/collab/identity";
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
      title={
        participant.isSelf ? `${participant.name} (you)` : participant.name
      }
    >
      {initials(participant.name)}
    </div>
  );
}

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

type FloatingPosition = {
  left: number;
  top: number;
};

function samePosition(a: FloatingPosition, b: FloatingPosition): boolean {
  return (
    Math.round(a.left) === Math.round(b.left) &&
    Math.round(a.top) === Math.round(b.top)
  );
}

function StatusSummary({
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
        <span
          className="size-3 rounded-full"
          style={{ backgroundColor: identity.color }}
        />
        <span className="max-w-28 truncate">{identity.name}</span>
        <Pencil className="size-3" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              Your collaborator identity
            </DialogTitle>
            <DialogDescription>
              How you appear to others in this room. Visible to everyone with
              the link.
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
                      color === option
                        ? "border-foreground"
                        : "border-transparent",
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

type ActiveRoomIndicatorProps = {
  status: RoomStatus;
  participants: Participant[];
  guest: CollabIdentity;
  isSignedIn: boolean | undefined;
  canStop: boolean;
  stopping: boolean;
  stopError: string | null;
  onGuestChange: (next: CollabIdentity) => void;
  onStop: () => Promise<void>;
};

function TooltipIconButton({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ActiveRoomIndicator({
  status,
  participants,
  guest,
  isSignedIn,
  canStop,
  stopping,
  stopError,
  onGuestChange,
  onStop,
}: ActiveRoomIndicatorProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null>(null);

  const clampPosition = useCallback((left: number, top: number) => {
    if (typeof window === "undefined") {
      return { left, top };
    }
    const node = panelRef.current;
    const width = node?.offsetWidth ?? 320;
    const height = node?.offsetHeight ?? 56;
    const margin = 8;

    return {
      left: Math.min(Math.max(margin, left), window.innerWidth - width - margin),
      top: Math.min(Math.max(margin, top), window.innerHeight - height - margin),
    };
  }, []);

  const startDrag = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return;
      }
      const node = panelRef.current;
      if (!node) {
        return;
      }
      const rect = node.getBoundingClientRect();
      const origin = clampPosition(rect.left, rect.top);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originLeft: origin.left,
        originTop: origin.top,
      };
      setPosition(origin);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [clampPosition],
  );

  const moveDrag = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      const next = clampPosition(
        drag.originLeft + event.clientX - drag.startX,
        drag.originTop + event.clientY - drag.startY,
      );
      setPosition((current) =>
        current && samePosition(current, next) ? current : next,
      );
    },
    [clampPosition],
  );

  const endDrag = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  useEffect(() => {
    if (!position || typeof window === "undefined") {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      setPosition((current) => {
        if (!current) {
          return current;
        }
        const next = clampPosition(current.left, current.top);
        return samePosition(current, next) ? current : next;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [collapsed, clampPosition, position]);

  useEffect(() => {
    if (!position || typeof window === "undefined") {
      return;
    }
    const onResize = () => {
      setPosition((current) => {
        if (!current) {
          return current;
        }
        const next = clampPosition(current.left, current.top);
        return samePosition(current, next) ? current : next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPosition, position]);

  const floatingStyle: CSSProperties = position
    ? {
        left: position.left,
        top: position.top,
      }
    : {
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
        left: "50%",
        transform: "translateX(-50%)",
      };

  const dragHandlers = {
    onPointerDown: startDrag,
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  if (collapsed) {
    return (
      <div
        ref={panelRef}
        data-testid="active-room-indicator"
        className="fixed z-40"
        style={floatingStyle}
      >
        <TooltipProvider>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background/95 p-1 shadow-lg backdrop-blur">
            <TooltipIconButton label="Drag room indicator">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                aria-label="Drag room indicator"
                {...dragHandlers}
              >
                <GripHorizontal />
              </Button>
            </TooltipIconButton>
            <TooltipIconButton label="Show room indicator">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="relative"
                aria-label="Show room indicator"
                onClick={() => setCollapsed(false)}
              >
                <StatusSummary
                  status={status}
                  count={participants.length}
                  compact
                />
                <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                  {participants.length > 9 ? "9+" : participants.length}
                </span>
              </Button>
            </TooltipIconButton>
          </div>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      data-testid="active-room-indicator"
      className="fixed z-40 max-w-[calc(100vw-1rem)]"
      style={floatingStyle}
    >
      <TooltipProvider>
        <div className="flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-border bg-background/95 p-2 shadow-lg backdrop-blur">
          <TooltipIconButton label="Drag room indicator">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
              aria-label="Drag room indicator"
              {...dragHandlers}
            >
              <GripHorizontal />
            </Button>
          </TooltipIconButton>
          <StatusSummary status={status} count={participants.length} />
          <div className="flex -space-x-2">
            {participants.slice(0, 5).map((participant) => (
              <Avatar key={participant.id} participant={participant} />
            ))}
            {participants.length > 5 ? (
              <div className="flex size-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold">
                +{participants.length - 5}
              </div>
            ) : null}
          </div>
          {!isSignedIn ? (
            <GuestIdentityEditor identity={guest} onChange={onGuestChange} />
          ) : null}
          {canStop ? (
            <div className="flex min-w-0 items-center gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                disabled={stopping}
                onClick={() => void onStop()}
              >
                {stopping ? <Loader2 className="animate-spin" /> : <Square />}
                Stop room
              </Button>
              {stopError ? (
                <span className="max-w-48 truncate rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                  {stopError}
                </span>
              ) : null}
            </div>
          ) : null}
          <TooltipIconButton label="Hide room indicator">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Hide room indicator"
              onClick={() => setCollapsed(true)}
            >
              <Minimize2 />
            </Button>
          </TooltipIconButton>
        </div>
      </TooltipProvider>
    </div>
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
