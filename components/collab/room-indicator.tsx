"use client";

import { GripHorizontal, Loader2, Minimize2, Square } from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Avatar } from "@/components/collab/participant-avatars";
import { GuestIdentityEditor } from "@/components/collab/guest-identity-editor";
import { StatusSummary } from "@/components/collab/status-summary";
import {
  type Participant,
  type RoomStatus,
} from "@/components/collab/use-room";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type CollabIdentity } from "@/lib/collab/identity";

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

export function ActiveRoomIndicator({
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
      left: Math.min(
        Math.max(margin, left),
        window.innerWidth - width - margin,
      ),
      top: Math.min(
        Math.max(margin, top),
        window.innerHeight - height - margin,
      ),
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
