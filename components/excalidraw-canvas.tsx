"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";

import "@excalidraw/excalidraw/index.css";
import type {
  BinaryFiles,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";

import { Button } from "@/components/ui/button";
import { type SceneBundle } from "@/lib/domain";
import { normalizeSceneBundle, sceneContentSignature } from "@/lib/excalidraw-scene";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false },
);

type ExcalidrawCanvasProps = {
  initialBundle: SceneBundle;
  onBundleChange?: (bundle: SceneBundle) => void;
  theme?: "light" | "dark";
  mode?: "view" | "edit";
};

export function ExcalidrawCanvas({
  initialBundle,
  onBundleChange,
  theme,
  mode = "edit",
}: ExcalidrawCanvasProps) {
  const parsedInitialBundle = useMemo(
    () => normalizeSceneBundle(initialBundle),
    [initialBundle],
  );
  const bundleRef = useRef(parsedInitialBundle);
  const lastSignatureRef = useRef(sceneContentSignature(parsedInitialBundle));
  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const e2eMode = process.env.NEXT_PUBLIC_E2E_MODE === "1" && mode === "edit";

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
            const currentBundle = bundleRef.current;
            const next = normalizeSceneBundle({
              ...currentBundle,
              elements: [
                ...currentBundle.elements,
                {
                  id: `shape-${Date.now()}`,
                  type: "rectangle",
                  x: 100,
                  y: 100,
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
                  seed: 1,
                  version: 1,
                  versionNonce: 1,
                  isDeleted: false,
                  boundElements: null,
                  updated: Date.now(),
                  link: null,
                  locked: false,
                  index: "a0",
                },
              ],
            });
            bundleRef.current = next;
            lastSignatureRef.current = sceneContentSignature(next);
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
        onChange={(elements, appState, files) => {
          if (mode !== "edit" || !onBundleChange) {
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
