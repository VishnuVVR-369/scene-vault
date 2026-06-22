import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

function loadFixture(): { sceneId: string; token: string } {
  try {
    return JSON.parse(
      readFileSync(path.resolve("tests/e2e-collab/.fixture.json"), "utf8"),
    );
  } catch {
    return { sceneId: "", token: "" };
  }
}

const fixture = loadFixture();

function elementCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const api = (window as unknown as { __excalidrawApi?: { getSceneElements: () => unknown[] } })
      .__excalidrawApi;
    return api ? api.getSceneElements().length : -1;
  });
}

test("two guests edit the same room live", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const a = await contextA.newPage();
  const b = await contextB.newPage();

  const url = `/share/e/${fixture.token}`;
  await a.goto(url);
  await b.goto(url);

  // Both guests reach the live collaborative canvas.
  await a.getByTestId("e2e-add-shape").waitFor({ state: "visible", timeout: 45_000 });
  await b.getByTestId("e2e-add-shape").waitFor({ state: "visible", timeout: 45_000 });

  // Both show the live presence indicator (status reached "ready").
  await expect(a.getByText(/Live/)).toBeVisible({ timeout: 30_000 });

  // Guest A draws a shape; guest B should receive it through the room.
  await expect.poll(() => elementCount(b), { timeout: 20_000 }).toBe(0);
  await a.getByTestId("e2e-add-shape").click();

  await expect.poll(() => elementCount(a), { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
  await expect
    .poll(() => elementCount(b), { timeout: 25_000 })
    .toBeGreaterThanOrEqual(1);

  await contextA.close();
  await contextB.close();
});
