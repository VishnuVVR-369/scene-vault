import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Seeds an empty scene + enabled edit share in the real Convex deployment and
// writes the fixture for the test to consume.
export default function globalSetup() {
  const token = `e2e${"a".repeat(45)}`; // 48 chars, matches the share-token format
  const out = execSync(`npx convex run testSeed:seed '{"token":"${token}"}'`, {
    encoding: "utf8",
  });
  const sceneId = out.trim().split("\n").pop()!.replace(/"/g, "");
  const dir = path.resolve("tests/e2e-collab");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, ".fixture.json"), JSON.stringify({ sceneId, token }));
  console.log(`[collab e2e] seeded scene ${sceneId}`);
}
