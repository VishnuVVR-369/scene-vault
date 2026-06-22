import { describe, expect, it } from "vitest";

import {
  collectFileIds,
  elementsSignature,
  reconcileRemote,
  roomRowsToElements,
  type SceneElementLike,
} from "./room-elements";

describe("roomRowsToElements", () => {
  it("returns the stored element data", () => {
    const rows = [
      { elementId: "a", data: { id: "a", version: 1 }, version: 1, versionNonce: 1 },
    ];
    expect(roomRowsToElements(rows)).toEqual([{ id: "a", version: 1 }]);
  });
});

describe("elementsSignature", () => {
  it("captures id, version, nonce and order", () => {
    const a: SceneElementLike = { id: "a", version: 1, versionNonce: 2 };
    const b: SceneElementLike = { id: "b", version: 3, versionNonce: 4 };
    expect(elementsSignature([a, b])).toBe("a@1:2,b@3:4");
    expect(elementsSignature([b, a])).not.toBe(elementsSignature([a, b]));
  });
});

describe("reconcileRemote", () => {
  it("reports changed when reconciliation differs from local", () => {
    const local: SceneElementLike[] = [{ id: "a", version: 1, versionNonce: 1 }];
    const remote: SceneElementLike[] = [{ id: "a", version: 2, versionNonce: 1 }];
    const result = reconcileRemote({
      localElements: local,
      remoteElements: remote,
      appState: {},
      reconcile: (_l, r) => r as SceneElementLike[],
    });
    expect(result.changed).toBe(true);
    expect(result.elements).toEqual(remote);
  });

  it("reports no change when reconciliation equals local", () => {
    const local: SceneElementLike[] = [{ id: "a", version: 2, versionNonce: 1 }];
    const result = reconcileRemote({
      localElements: local,
      remoteElements: local,
      appState: {},
      reconcile: (l) => l as SceneElementLike[],
    });
    expect(result.changed).toBe(false);
  });
});

describe("collectFileIds", () => {
  it("collects image file ids, skipping deleted and non-image elements", () => {
    const elements: SceneElementLike[] = [
      { id: "a", version: 1, type: "image", fileId: "file-1" },
      { id: "b", version: 1, type: "rectangle" },
      { id: "c", version: 1, type: "image", fileId: "file-2", isDeleted: true },
      { id: "d", version: 1, type: "image", fileId: "file-1" },
    ];
    expect(collectFileIds(elements)).toEqual(["file-1"]);
  });
});
