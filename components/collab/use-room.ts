"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  buildCollaboratorEntries,
  CURSOR_THROTTLE_MS,
  diffElementsForBroadcast,
  ELEMENT_FLUSH_MS,
  HEARTBEAT_INTERVAL_MS,
  isPresenceActive,
  isSnapshotter,
  MAX_BATCH_ELEMENTS,
  SNAPSHOT_DEBOUNCE_MS,
  type ElementVersion,
} from "@/convex/collabLogic";
import {
  collectFileIds,
  elementsSignature,
  reconcileRemote,
  roomRowsToElements,
  type SceneElementLike,
} from "@/lib/collab/room-elements";
import type { CollabIdentity } from "@/lib/collab/identity";

import type {
  BinaryFileData,
  BinaryFiles,
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from "@excalidraw/excalidraw/types";

// Lazily loaded so the editor's SSR pass never touches Excalidraw (which needs
// the DOM). The component bundle has already imported the module by the time we
// have an API, so this resolves from cache immediately.
type ExcalidrawModule = typeof import("@excalidraw/excalidraw");
let excalidrawModulePromise: Promise<ExcalidrawModule> | null = null;
function loadExcalidraw(): Promise<ExcalidrawModule> {
  excalidrawModulePromise ??= import("@excalidraw/excalidraw");
  return excalidrawModulePromise;
}

export type RoomStatus =
  | "idle"
  | "connecting"
  | "hydrating"
  | "ready"
  | "ended"
  | "revoked"
  | "error";

export type Participant = {
  id: string;
  name: string;
  color: string;
  isSelf: boolean;
};

export type SnapshotBundle = {
  elements: SceneElementLike[];
  appState: Record<string, unknown>;
  files: BinaryFiles;
};

export type UseRoomArgs = {
  enabled: boolean;
  sceneId: string;
  /** Edit share token (shared editor); omit for the signed-in owner. */
  token?: string;
  identity: CollabIdentity;
  /** Elements loaded from R2 by the caller; used to seed a fresh room. */
  initialElements: readonly SceneElementLike[];
  contentHash: string | null;
  /** Whether this client may persist to R2 (signed in). Guests cannot. */
  canSnapshot: boolean;
  /** Persist the live scene to R2; returns the content hash, or null on failure. */
  onSnapshot: (bundle: SnapshotBundle) => Promise<string | null>;
  /** Fetch missing image blobs (by id) so they can be added to the scene. */
  onLoadFiles?: (fileIds: string[]) => Promise<BinaryFileData[]>;
};

export type UseRoomResult = {
  status: RoomStatus;
  participants: Participant[];
  isSnapshotter: boolean;
  canStop: boolean;
  stopRoom: () => Promise<void>;
  onApi: (api: ExcalidrawImperativeAPI) => void;
  onSceneChange: (
    elements: readonly SceneElementLike[],
    appState: { selectedElementIds?: Record<string, unknown> },
    files: BinaryFiles,
  ) => void;
  onPointerUpdate: (payload: {
    pointer: { x: number; y: number };
    button: "down" | "up";
  }) => void;
};

export function useRoom(args: UseRoomArgs): UseRoomResult {
  const { enabled, sceneId, token, identity, canSnapshot, onSnapshot, onLoadFiles } = args;

  const joinRoom = useMutation(api.collab.joinRoom);
  const completeHydration = useMutation(api.collab.completeHydration);
  const pushElements = useMutation(api.collab.pushElements);
  const updatePresence = useMutation(api.collab.updatePresence);
  const leaveRoom = useMutation(api.collab.leaveRoom);
  const stopRoomMutation = useMutation(api.collab.stopRoom);
  const markRoomSnapshot = useMutation(api.collab.markRoomSnapshot);

  const queryArgs = useMemo(
    () =>
      enabled
        ? ({ sceneId: sceneId as Id<"scenes">, ...(token ? { token } : {}) } as const)
        : "skip",
    [enabled, sceneId, token],
  );
  const roomView = useQuery(api.collab.getRoomView, queryArgs);
  const roomElements = useQuery(api.collab.getRoomElements, queryArgs);
  const presence = useQuery(api.collab.getPresence, queryArgs);

  const [status, setStatus] = useState<RoomStatus>(() => (enabled ? "connecting" : "idle"));
  const [roomSessionId, setRoomSessionId] = useState<string | null>(null);
  // A periodic tick so departed cursors fade even if no one else moves.
  const [nowTick, setNowTick] = useState(() => Date.now());

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const excalRef = useRef<ExcalidrawModule | null>(null);
  const sessionRef = useRef<{ roomSessionId: string; sessionSecret: string } | null>(null);
  const identityRef = useRef(identity);
  const tokenRef = useRef(token);

  // Last version we've sent or applied per element id — drives broadcast diffing
  // and suppresses echoes of our own and remote-origin changes.
  const knownVersionsRef = useRef<Map<string, ElementVersion>>(new Map());
  const pendingRef = useRef<Map<string, SceneElementLike>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushingRef = useRef(false);
  const flushAgainRef = useRef(false);
  const flushPromiseRef = useRef<Promise<void> | null>(null);

  const selectionRef = useRef<string[]>([]);
  const cursorRef = useRef<{ x: number; y: number; button: "up" | "down" } | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshotSigRef = useRef<string>("");
  const isSnapshotterRef = useRef(false);
  const loadedFileIdsRef = useRef<Set<string>>(new Set());
  const flushRef = useRef<() => void>(() => {});

  // Keep latest identity/token available to callbacks without re-subscribing.
  useEffect(() => {
    identityRef.current = identity;
    tokenRef.current = token;
  }, [identity, token]);

  const baseMutationArgs = useCallback(() => {
    const session = sessionRef.current;
    if (!session) {
      return null;
    }
    return {
      sceneId: sceneId as Id<"scenes">,
      ...(tokenRef.current ? { token: tokenRef.current } : {}),
      roomSessionId: session.roomSessionId,
      sessionSecret: session.sessionSecret,
    };
  }, [sceneId]);

  // ---- Load Excalidraw module (for reconcileElements + CaptureUpdateAction) --
  useEffect(() => {
    let active = true;
    void loadExcalidraw().then((mod) => {
      if (active) {
        excalRef.current = mod;
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // ---- Join + (optional) hydrate ------------------------------------------
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setStatus("connecting");
      try {
        const result = await joinRoom({
          sceneId: sceneId as Id<"scenes">,
          ...(token ? { token } : {}),
          name: identityRef.current.name,
          color: identityRef.current.color,
        });
        if (cancelled) {
          void leaveRoom({
            sceneId: sceneId as Id<"scenes">,
            roomSessionId: result.roomSessionId,
            sessionSecret: result.sessionSecret,
          }).catch(() => {});
          return;
        }
        sessionRef.current = {
          roomSessionId: result.roomSessionId,
          sessionSecret: result.sessionSecret,
        };
        setRoomSessionId(result.roomSessionId);
        // Seed knownVersions from the durable base so we don't rebroadcast it.
        for (const el of args.initialElements) {
          knownVersionsRef.current.set(el.id, {
            version: el.version,
            versionNonce: el.versionNonce ?? 0,
          });
        }
        if (result.needsHydration) {
          setStatus("hydrating");
          await completeHydration({
            sceneId: sceneId as Id<"scenes">,
            ...(token ? { token } : {}),
            roomSessionId: result.roomSessionId,
            sessionSecret: result.sessionSecret,
            elements: args.initialElements as unknown[],
            contentHash: args.contentHash,
          });
        }
        if (!cancelled) {
          setStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      const session = sessionRef.current;
      if (session) {
        void leaveRoom({
          sceneId: sceneId as Id<"scenes">,
          roomSessionId: session.roomSessionId,
          sessionSecret: session.sessionSecret,
        }).catch(() => {});
        sessionRef.current = null;
        setRoomSessionId(null);
      }
    };
    // Re-join only when the room target changes, not on identity edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sceneId, token]);

  // Revocation is derived so it can't be missed and needs no extra setState.
  const effectiveStatus: RoomStatus = useMemo(() => {
    if (!enabled) {
      return "idle";
    }
    if ((roomView && roomView.authorized === false) || roomElements === null) {
      if (status === "ready" || status === "hydrating") {
        return "revoked";
      }
    }
    if (roomView?.authorized && roomView.active === false) {
      if (status === "ready" || status === "hydrating") {
        return "ended";
      }
    }
    return status;
  }, [enabled, roomView, roomElements, status]);

  // ---- Apply remote elements ----------------------------------------------
  useEffect(() => {
    const editor = apiRef.current;
    const mod = excalRef.current;
    if (!editor || !mod || !roomElements) {
      return;
    }
    const remote = roomRowsToElements(roomElements);
    // Record remote versions first so the resulting onChange won't rebroadcast.
    for (const row of roomElements) {
      knownVersionsRef.current.set(row.elementId, {
        version: row.version,
        versionNonce: row.versionNonce,
      });
    }
    const local = editor.getSceneElementsIncludingDeleted() as unknown as SceneElementLike[];
    const { elements, changed } = reconcileRemote({
      localElements: local,
      remoteElements: remote,
      appState: editor.getAppState(),
      reconcile: mod.reconcileElements as never,
    });
    if (changed) {
      editor.updateScene({
        elements: elements as never,
        captureUpdate: mod.CaptureUpdateAction.NEVER,
      });
    }
    // Lazy-load any image blobs we don't have yet.
    const have = new Set(Object.keys(editor.getFiles()));
    const missing = collectFileIds(elements).filter(
      (id) => !have.has(id) && !loadedFileIdsRef.current.has(id),
    );
    if (missing.length > 0 && onLoadFiles) {
      for (const id of missing) {
        loadedFileIdsRef.current.add(id);
      }
      void onLoadFiles(missing)
        .then((files) => {
          if (files.length > 0) {
            apiRef.current?.addFiles(files);
          }
        })
        .catch(() => {
          for (const id of missing) {
            loadedFileIdsRef.current.delete(id);
          }
        });
    }
  }, [roomElements, onLoadFiles]);

  // ---- Active participants (derived) --------------------------------------
  const participants = useMemo<Participant[]>(() => {
    if (!presence) {
      return [];
    }
    return presence
      .filter((p) => isPresenceActive(p.lastSeenAt, nowTick))
      .map((p) => ({
        id: p.roomSessionId,
        name: p.name,
        color: p.color,
        isSelf: p.roomSessionId === roomSessionId,
      }));
  }, [presence, nowTick, roomSessionId]);

  // ---- Project presence into Excalidraw collaborator cursors --------------
  useEffect(() => {
    const editor = apiRef.current;
    if (!editor || !presence) {
      return;
    }
    const active = presence.filter((p) => isPresenceActive(p.lastSeenAt, nowTick));
    const entries = buildCollaboratorEntries(active, roomSessionId ?? "");
    const map = new Map<SocketId, Collaborator>();
    for (const entry of entries) {
      map.set(entry.id as SocketId, {
        id: entry.id,
        username: entry.username,
        color: entry.color,
        button: entry.button,
        selectedElementIds: entry.selectedElementIds,
        ...(entry.pointer ? { pointer: entry.pointer } : {}),
      });
    }
    editor.updateScene({ collaborators: map });
  }, [presence, nowTick, roomSessionId]);

  // ---- Snapshotter election (only signed-in sessions may write R2) ----------
  const amSnapshotter = useMemo(() => {
    if (!presence || !roomSessionId || !canSnapshot) {
      return false;
    }
    const active = presence
      .filter((p) => isPresenceActive(p.lastSeenAt, nowTick) && p.userId != null)
      .map((p) => p.roomSessionId);
    return isSnapshotter(roomSessionId, active);
  }, [presence, nowTick, roomSessionId, canSnapshot]);

  useEffect(() => {
    isSnapshotterRef.current = amSnapshotter;
  }, [amSnapshotter]);

  // ---- Periodic tick + heartbeat ------------------------------------------
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const tick = setInterval(() => setNowTick(Date.now()), 3000);
    const heartbeat = setInterval(() => {
      const base = baseMutationArgs();
      if (!base || effectiveStatus !== "ready") {
        return;
      }
      void updatePresence({
        ...base,
        name: identityRef.current.name,
        color: identityRef.current.color,
        cursorX: cursorRef.current?.x ?? null,
        cursorY: cursorRef.current?.y ?? null,
        button: cursorRef.current?.button ?? "up",
        selectedIds: selectionRef.current,
      }).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(heartbeat);
    };
  }, [enabled, effectiveStatus, baseMutationArgs, updatePresence]);

  // ---- Outbound element flush ---------------------------------------------
  const flush = useCallback(async () => {
    if (flushingRef.current) {
      flushAgainRef.current = true;
      await flushPromiseRef.current;
      return;
    }

    const run = async () => {
      flushingRef.current = true;
      try {
        do {
          flushAgainRef.current = false;
          const base = baseMutationArgs();
          if (!base || pendingRef.current.size === 0) {
            return;
          }

          const all = [...pendingRef.current.values()];
          pendingRef.current.clear();
          try {
            for (let i = 0; i < all.length; i += MAX_BATCH_ELEMENTS) {
              const chunk = all.slice(i, i + MAX_BATCH_ELEMENTS);
              await pushElements({ ...base, elements: chunk as unknown[] });
              for (const el of chunk) {
                knownVersionsRef.current.set(el.id, {
                  version: el.version,
                  versionNonce: el.versionNonce ?? 0,
                });
              }
            }
          } catch {
            // Re-queue (unless a newer version was queued meanwhile) and back off.
            for (const el of all) {
              const queued = pendingRef.current.get(el.id);
              if (!queued || (queued.version ?? 0) <= (el.version ?? 0)) {
                pendingRef.current.set(el.id, el);
              }
            }
            flushAgainRef.current = true;
            if (!flushTimerRef.current) {
              flushTimerRef.current = setTimeout(() => {
                flushTimerRef.current = null;
                void flushRef.current();
              }, ELEMENT_FLUSH_MS * 4);
            }
            return;
          }
        } while (flushAgainRef.current || pendingRef.current.size > 0);
      } finally {
        flushingRef.current = false;
        flushPromiseRef.current = null;
        if (flushAgainRef.current || pendingRef.current.size > 0) {
          flushAgainRef.current = false;
          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              flushTimerRef.current = null;
              void flushRef.current();
            }, ELEMENT_FLUSH_MS);
          }
        }
      }
    };

    const promise = Promise.resolve().then(run);
    flushPromiseRef.current = promise;
    await promise;
  }, [baseMutationArgs, pushElements]);

  useEffect(() => {
    flushRef.current = () => void flush();
  }, [flush]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) {
      return;
    }
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      void flush();
    }, ELEMENT_FLUSH_MS);
  }, [flush]);

  const doSnapshotRef = useRef<() => void>(() => {});

  const scheduleSnapshotRetry = useCallback(() => {
    if (snapshotTimerRef.current) {
      return;
    }
    snapshotTimerRef.current = setTimeout(() => {
      snapshotTimerRef.current = null;
      void doSnapshotRef.current();
    }, SNAPSHOT_DEBOUNCE_MS);
  }, []);

  // ---- Snapshot to R2 (snapshotter only) ----------------------------------
  const doSnapshot = useCallback(async (options?: { force?: boolean }) => {
    const editor = apiRef.current;
    if (!editor || !canSnapshot || (!options?.force && !isSnapshotterRef.current)) {
      return;
    }
    const base = baseMutationArgs();
    if (!base) {
      return;
    }
    const elements = editor.getSceneElementsIncludingDeleted() as unknown as SceneElementLike[];
    const sig = elementsSignature(elements);
    if (sig === lastSnapshotSigRef.current) {
      return;
    }
    const maxUpdatedAt = (roomElements ?? []).reduce(
      (max, row) => Math.max(max, row.updatedAt ?? 0),
      0,
    );
    try {
      const hash = await onSnapshot({
        elements,
        appState: editor.getAppState() as unknown as Record<string, unknown>,
        files: editor.getFiles(),
      });
      if (hash) {
        const result = await markRoomSnapshot({
          ...base,
          snapshotHash: hash,
          snapshotMaxUpdatedAt: maxUpdatedAt,
        });
        if (result.marked) {
          lastSnapshotSigRef.current = sig;
        } else {
          scheduleSnapshotRetry();
        }
      } else {
        scheduleSnapshotRetry();
      }
    } catch {
      // Stays dirty -> retried on the next change / by the next snapshotter.
      scheduleSnapshotRetry();
    }
  }, [
    baseMutationArgs,
    canSnapshot,
    onSnapshot,
    markRoomSnapshot,
    roomElements,
    scheduleSnapshotRetry,
  ]);

  useEffect(() => {
    doSnapshotRef.current = () => void doSnapshot();
  }, [doSnapshot]);

  const scheduleSnapshot = useCallback(() => {
    if (snapshotTimerRef.current) {
      clearTimeout(snapshotTimerRef.current);
    }
    snapshotTimerRef.current = setTimeout(() => {
      snapshotTimerRef.current = null;
      void doSnapshot();
    }, SNAPSHOT_DEBOUNCE_MS);
  }, [doSnapshot]);

  // ---- Public handlers -----------------------------------------------------
  const onApi = useCallback((instance: ExcalidrawImperativeAPI) => {
    apiRef.current = instance;
  }, []);

  const onSceneChange = useCallback<UseRoomResult["onSceneChange"]>(
    (_elements, appState, _files) => {
      if (effectiveStatus !== "ready" || !sessionRef.current) {
        return;
      }
      const editor = apiRef.current;
      if (!editor) {
        return;
      }
      selectionRef.current = Object.keys(appState.selectedElementIds ?? {});
      const full = editor.getSceneElementsIncludingDeleted() as unknown as SceneElementLike[];
      const changed = diffElementsForBroadcast(full, knownVersionsRef.current);
      if (changed.length > 0) {
        for (const el of changed) {
          pendingRef.current.set((el as SceneElementLike).id, el as SceneElementLike);
        }
        scheduleFlush();
        scheduleSnapshot();
      }
    },
    [effectiveStatus, scheduleFlush, scheduleSnapshot],
  );

  const sendCursor = useCallback(() => {
    const base = baseMutationArgs();
    const cursor = cursorRef.current;
    if (!base || !cursor || effectiveStatus !== "ready") {
      return;
    }
    void updatePresence({
      ...base,
      name: identityRef.current.name,
      color: identityRef.current.color,
      cursorX: cursor.x,
      cursorY: cursor.y,
      button: cursor.button,
      selectedIds: selectionRef.current,
    }).catch(() => {});
  }, [baseMutationArgs, effectiveStatus, updatePresence]);

  const stopRoom = useCallback(async () => {
    await flush();
    await doSnapshot({ force: true });
    const base = baseMutationArgs();
    if (!base) {
      throw new Error("Room session is not ready");
    }
    await stopRoomMutation(base);
    sessionRef.current = null;
    setRoomSessionId(null);
    setStatus("ended");
  }, [baseMutationArgs, doSnapshot, flush, stopRoomMutation]);

  const onPointerUpdate = useCallback<UseRoomResult["onPointerUpdate"]>(
    (payload) => {
      cursorRef.current = { x: payload.pointer.x, y: payload.pointer.y, button: payload.button };
      if (cursorTimerRef.current) {
        return;
      }
      cursorTimerRef.current = setTimeout(() => {
        cursorTimerRef.current = null;
        sendCursor();
      }, CURSOR_THROTTLE_MS);
    },
    [sendCursor],
  );

  // Flush + final snapshot on unmount/tab close.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onHide = () => {
      void flush();
      if (isSnapshotterRef.current) {
        void doSnapshot();
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      if (snapshotTimerRef.current) {
        clearTimeout(snapshotTimerRef.current);
      }
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
      }
    };
  }, [enabled, flush, doSnapshot]);

  return {
    status: effectiveStatus,
    participants,
    isSnapshotter: amSnapshotter,
    canStop: Boolean(roomView?.authorized && roomView.canStop),
    stopRoom,
    onApi,
    onSceneChange,
    onPointerUpdate,
  };
}
