import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEmptySceneBundle, type SceneBundle } from "@/lib/domain";

vi.mock("@excalidraw/excalidraw/index.css", () => ({}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockExcalidraw(props: {
      onChange?: (elements: unknown[], appState: Record<string, unknown>, files: Record<string, unknown>) => void;
      viewModeEnabled?: boolean;
    }) {
      return (
        <button
          data-testid="mock-excalidraw"
          data-view-mode={props.viewModeEnabled ? "true" : "false"}
          onClick={() =>
            props.onChange?.(
              [
                {
                  id: "shape",
                  type: "rectangle",
                  isDeleted: false,
                  version: 1,
                },
              ],
              { viewBackgroundColor: "#ffffff" },
              {},
            )
          }
        >
          Canvas
        </button>
      );
    },
}));

import { ExcalidrawCanvas } from "./excalidraw-canvas";

function bundleWithShape(): SceneBundle {
  return {
    ...createEmptySceneBundle(),
    elements: [
      {
        id: "initial",
        type: "rectangle",
        isDeleted: false,
        version: 1,
      },
    ],
  };
}

describe("ExcalidrawCanvas", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not schedule saves in view mode", () => {
    vi.useFakeTimers();
    const onBundleChange = vi.fn();
    render(
      <ExcalidrawCanvas
        initialBundle={bundleWithShape()}
        mode="view"
        onBundleChange={onBundleChange}
      />,
    );

    const canvas = screen.getByTestId("mock-excalidraw");
    expect(canvas).toHaveAttribute("data-view-mode", "true");
    fireEvent.click(canvas);
    vi.advanceTimersByTime(5000);

    expect(onBundleChange).not.toHaveBeenCalled();
  });

  it("schedules saves in edit mode", () => {
    vi.useFakeTimers();
    const onBundleChange = vi.fn();
    render(
      <ExcalidrawCanvas
        initialBundle={bundleWithShape()}
        mode="edit"
        onBundleChange={onBundleChange}
      />,
    );

    const canvas = screen.getByTestId("mock-excalidraw");
    expect(canvas).toHaveAttribute("data-view-mode", "false");
    fireEvent.click(canvas);
    vi.advanceTimersByTime(5000);

    expect(onBundleChange).toHaveBeenCalledOnce();
  });
});
