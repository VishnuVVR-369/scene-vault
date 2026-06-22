import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

export default function globalTeardown() {
  const fixturePath = path.resolve("tests/e2e-collab/.fixture.json");
  if (!existsSync(fixturePath)) {
    return;
  }
  try {
    const { sceneId } = JSON.parse(readFileSync(fixturePath, "utf8"));
    execSync(`npx convex run testSeed:cleanup '{"sceneId":"${sceneId}"}'`, {
      encoding: "utf8",
    });
    console.log(`[collab e2e] cleaned up scene ${sceneId}`);
  } catch (error) {
    console.error("[collab e2e] cleanup failed", error);
  } finally {
    rmSync(fixturePath, { force: true });
  }
}
