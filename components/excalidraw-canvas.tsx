"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef } from "react";

import "@excalidraw/excalidraw/index.css";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

import { Button } from "@/components/ui/button";
import { type SceneBundle } from "@/lib/domain";
import {
  normalizeSceneBundle,
  sceneContentSignature,
} from "@/lib/excalidraw-scene";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false },
);

type ExcalidrawCanvasProps = {
  initialBundle: SceneBundle;
  onBundleDraftChange?: (bundle: SceneBundle) => void;
  onBundleChange?: (bundle: SceneBundle) => void;
  theme?: "light" | "dark";
  mode?: "view" | "edit";
  // Live-collaboration hooks. When provided the canvas streams raw changes and
  // pointer moves instead of (or alongside) the debounced single-user save.
  onApi?: (api: ExcalidrawImperativeAPI) => void;
  onSceneChange?: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => void;
  onPointerUpdate?: (payload: {
    pointer: { x: number; y: number; tool: "pointer" | "laser" };
    button: "down" | "up";
  }) => void;
};

export function ExcalidrawCanvas({
  initialBundle,
  onBundleDraftChange,
  onBundleChange,
  theme,
  mode = "edit",
  onApi,
  onSceneChange,
  onPointerUpdate,
}: ExcalidrawCanvasProps) {
  const parsedInitialBundle = useMemo(
    () => normalizeSceneBundle(initialBundle),
    [initialBundle],
  );
  const bundleRef = useRef(parsedInitialBundle);
  const lastSignatureRef = useRef(sceneContentSignature(parsedInitialBundle));
  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const e2eMode = process.env.NEXT_PUBLIC_E2E_MODE === "1" && mode === "edit";

  const handleApi = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api;
      if (
        process.env.NEXT_PUBLIC_E2E_MODE === "1" &&
        typeof window !== "undefined"
      ) {
        (
          window as unknown as { __excalidrawApi?: ExcalidrawImperativeAPI }
        ).__excalidrawApi = api;
      }
      onApi?.(api);
    },
    [onApi],
  );

  // Drop any pending save if the component unmounts so a late timer can't fire
  // `onBundleChange` after the editor has navigated away.
  useEffect(
    () => () => {
      if (emitTimer.current) {
        clearTimeout(emitTimer.current);
      }
    },
    [],
  );

  const initialData = useMemo<ExcalidrawInitialDataState>(
    () => ({
      elements: parsedInitialBundle.elements as never[],
      appState: parsedInitialBundle.appState,
      files: parsedInitialBundle.files as BinaryFiles,
      scrollToContent: true,
    }),
    [parsedInitialBundle],
  );

  return (
    <div className="relative h-full min-h-0">
      {e2eMode ? (
        <Button
          className="absolute right-3 top-3 z-10"
          data-testid="e2e-add-shape"
          size="sm"
          variant="secondary"
          onClick={() => {
            const shape = {
              id: `shape-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
              type: "rectangle",
              x: 100 + Math.floor(Math.random() * 200),
              y: 100 + Math.floor(Math.random() * 200),
              width: 120,
              height: 80,
              angle: 0,
              strokeColor: "#1e1e1e",
              backgroundColor: "transparent",
              fillStyle: "hachure",
              strokeWidth: 2,
              strokeStyle: "solid",
              roughness: 1,
              opacity: 100,
              groupIds: [],
              frameId: null,
              roundness: null,
              seed: Math.floor(Math.random() * 1e6),
              version: 1,
              versionNonce: Math.floor(Math.random() * 1e6),
              isDeleted: false,
              boundElements: null,
              updated: Date.now(),
              link: null,
              locked: false,
              index: "a0",
            };
            // Collaboration: add via the real API so onChange -> live sync fires.
            const api = apiRef.current;
            if (onSceneChange && api) {
              api.updateScene({
                elements: [
                  ...api.getSceneElementsIncludingDeleted(),
                  shape as never,
                ],
              });
              return;
            }
            // Single-user fallback: drive the debounced save directly.
            const next = normalizeSceneBundle({
              ...bundleRef.current,
              elements: [...bundleRef.current.elements, shape],
            });
            bundleRef.current = next;
            lastSignatureRef.current = sceneContentSignature(next);
            onBundleDraftChange?.(next);
            onBundleChange?.(next);
          }}
        >
          Add test shape
        </Button>
      ) : null}
      <Excalidraw
        initialData={initialData}
        theme={theme}
        viewModeEnabled={mode === "view"}
        excalidrawAPI={handleApi}
        onPointerUpdate={
          onPointerUpdate
            ? (payload) =>
                onPointerUpdate({
                  pointer: payload.pointer,
                  button: payload.button,
                })
            : undefined
        }
        onChange={(elements, appState, files) => {
          if (mode !== "edit") {
            return;
          }
          // Live collaboration: forward every change immediately.
          onSceneChange?.(elements, appState, files);
          if (!onBundleChange && !onBundleDraftChange) {
            return;
          }
          const next = normalizeSceneBundle({
            type: "excalidraw",
            version: 2,
            source: "scenevault",
            elements: [...elements],
            appState,
            files,
          });
          // Excalidraw fires `onChange` on every re-render and on cosmetic-only
          // changes (cursor, selection, scroll, zoom). Persisting the scene also
          // re-renders this component, so without this guard a single edit would
          // loop forever. Only schedule a save when the persistable content
          // actually changed.
          const signature = sceneContentSignature(next);
          if (signature === lastSignatureRef.current) {
            return;
          }
          lastSignatureRef.current = signature;
          bundleRef.current = next;
          onBundleDraftChange?.(next);
          if (!onBundleChange) {
            return;
          }
          if (emitTimer.current) {
            clearTimeout(emitTimer.current);
          }
          emitTimer.current = setTimeout(() => onBundleChange(next), 5000);
        }}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
          },
        }}
      />
    </div>
  );
}
