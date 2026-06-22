// Networked end-to-end smoke test of the deployed collab backend.
// Drives two anonymous "guest" clients (token-gated, no Clerk) against the real
// Convex deployment: join an already-started room -> push -> reconcile -> read,
// plus presence.
//
// Run with: node --env-file=.env.local tests/collab-smoke.mjs <startedSceneId> <token>

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const [sceneId, token] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!url || !sceneId || !token) {
  console.error(
    "Usage: node --env-file=.env.local tests/collab-smoke.mjs <sceneId> <token>",
  );
  process.exit(1);
}

function el(id, version, versionNonce) {
  return {
    id,
    type: "rectangle",
    version,
    versionNonce,
    isDeleted: false,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  };
}

function assert(cond, message) {
  if (!cond) {
    throw new Error(`ASSERT FAILED: ${message}`);
  }
  console.log(`  ok: ${message}`);
}

async function main() {
  const a = new ConvexHttpClient(url);
  const b = new ConvexHttpClient(url);

  console.log("1. active room is visible through the edit token");
  const view = await a.query(api.collab.getRoomView, { sceneId, token });
  assert(view?.authorized && view.active, "edit token can see an active room");

  console.log("2. two guests join via edit token");
  const joinA = await a.mutation(api.collab.joinRoom, {
    sceneId,
    token,
    name: "Alice",
    color: "#ef4444",
  });
  const joinB = await b.mutation(api.collab.joinRoom, {
    sceneId,
    token,
    name: "Bob",
    color: "#3b82f6",
  });
  assert(
    joinA.roomSessionId && joinA.sessionSecret,
    "guest A got a server-issued session",
  );
  assert(
    joinB.roomSessionId !== joinA.roomSessionId,
    "guest B got a distinct session",
  );

  console.log("3. guest A pushes an element");
  await a.mutation(api.collab.pushElements, {
    sceneId,
    token,
    roomSessionId: joinA.roomSessionId,
    sessionSecret: joinA.sessionSecret,
    elements: [el("rect-1", 1, 10)],
  });

  console.log("4. guest B sees it");
  const elementsB = await b.query(api.collab.getRoomElements, {
    sceneId,
    token,
  });
  assert(
    elementsB?.some((e) => e.elementId === "rect-1"),
    "guest B received guest A's element",
  );

  console.log(
    "5. reconciliation: stale (lower-version) push is rejected, higher wins",
  );
  await b.mutation(api.collab.pushElements, {
    sceneId,
    token,
    roomSessionId: joinB.roomSessionId,
    sessionSecret: joinB.sessionSecret,
    elements: [el("rect-1", 1, 5)], // same version, lower nonce -> wins
  });
  let stored = (
    await a.query(api.collab.getRoomElements, { sceneId, token })
  ).find((e) => e.elementId === "rect-1");
  assert(stored.versionNonce === 5, "lower nonce won on version tie");
  await a.mutation(api.collab.pushElements, {
    sceneId,
    token,
    roomSessionId: joinA.roomSessionId,
    sessionSecret: joinA.sessionSecret,
    elements: [el("rect-1", 3, 999)], // higher version -> wins
  });
  stored = (await b.query(api.collab.getRoomElements, { sceneId, token })).find(
    (e) => e.elementId === "rect-1",
  );
  assert(stored.version === 3, "higher version won");

  console.log("6. presence");
  await a.mutation(api.collab.updatePresence, {
    sceneId,
    token,
    roomSessionId: joinA.roomSessionId,
    sessionSecret: joinA.sessionSecret,
    name: "Alice",
    color: "#ef4444",
    cursorX: 42,
    cursorY: 24,
    button: "down",
    selectedIds: ["rect-1"],
  });
  const presence = await b.query(api.collab.getPresence, { sceneId, token });
  const alice = presence?.find((p) => p.roomSessionId === joinA.roomSessionId);
  assert(
    alice?.cursorX === 42 && alice?.button === "down",
    "guest B sees guest A's cursor",
  );

  console.log("7. forged secret is rejected");
  let rejected = false;
  try {
    await b.mutation(api.collab.pushElements, {
      sceneId,
      token,
      roomSessionId: joinA.roomSessionId,
      sessionSecret: "wrong",
      elements: [el("rect-2", 1, 1)],
    });
  } catch {
    rejected = true;
  }
  assert(rejected, "forged session secret was rejected");

  console.log("8. guests leave");
  await a.mutation(api.collab.leaveRoom, {
    sceneId,
    roomSessionId: joinA.roomSessionId,
    sessionSecret: joinA.sessionSecret,
  });
  await b.mutation(api.collab.leaveRoom, {
    sceneId,
    roomSessionId: joinB.roomSessionId,
    sessionSecret: joinB.sessionSecret,
  });

  console.log("\nALL SMOKE CHECKS PASSED");
}

main().catch((error) => {
  console.error("\nSMOKE TEST FAILED:", error.message);
  process.exit(1);
});
