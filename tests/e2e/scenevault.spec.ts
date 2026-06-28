import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/dashboard");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("creates nested folders and searches by folder name", async ({ page }) => {
  await page.getByLabel("Create folder").click();
  await page.getByLabel("Name").fill("Product");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create folder" })
    .click();

  // Folders are now navigated from the left sidebar tree, not the main view.
  await page.getByRole("button", { name: "Product", exact: true }).click();
  await page.getByLabel("Create folder").click();
  await page.getByLabel("Name").fill("Flows");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create folder" })
    .click();

  await page.getByRole("button", { name: "Flows", exact: true }).click();
  await page.getByRole("button", { name: "New scene" }).first().click();
  await page.getByLabel("Title").fill("Checkout map");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create scene" })
    .click();

  await page.getByLabel("Back to library").click();
  await page.getByRole("button", { name: "All scenes" }).click();
  await page.getByLabel("Search scenes and folders").fill("flows");

  await expect(
    page.getByRole("link", { name: "Checkout map", exact: true }),
  ).toBeVisible();
});

test("pins a scene into its own dashboard section", async ({ page }) => {
  await page.getByRole("button", { name: "New scene" }).first().click();
  await page.getByLabel("Title").fill("Pinned demo");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create scene" })
    .click();
  await page.getByLabel("Back to library").click();

  // No Pinned section until something is pinned.
  await expect(
    page.getByRole("heading", { name: "Pinned", exact: true }),
  ).toBeHidden();

  await page.getByRole("button", { name: "Scene actions" }).first().click();
  await page.getByRole("menuitem", { name: "Pin" }).click();

  await expect(
    page.getByRole("heading", { name: "Pinned", exact: true }),
  ).toBeVisible();
  // The sole scene moved to Pinned, so the "Scenes" section header is gone.
  await expect(
    page.getByRole("heading", { name: "Scenes", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("link", { name: "Pinned demo", exact: true }),
  ).toBeVisible();
});

test("creates an AI-generated diagram scene", async ({ page }) => {
  await page.route("**/api/ai/diagram", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        title: "AI checkout flow",
        mermaid: [
          "flowchart TD",
          "  subgraph Checkout[Checkout]",
          "    Cart[Cart] --> Payment[Payment authorization]",
          "  end",
          "  Payment --> Receipt[Receipt]",
        ].join("\n"),
      }),
    });
  });

  await page.getByRole("button", { name: "AI diagram" }).first().click();
  await page
    .getByLabel("Prompt")
    .fill("Show checkout to payment authorization to receipt.");
  await page.getByRole("button", { name: "Generate diagram" }).click();

  await expect(page.getByLabel("Scene title")).toHaveValue("AI checkout flow", {
    timeout: 10_000,
  });
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 10_000 });
});

test("adds an AI-generated diagram to an existing scene", async ({ page }) => {
  await page.route("**/api/ai/diagram", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        title: "AI checkout flow",
        mermaid: [
          "flowchart TD",
          "  subgraph Checkout[Checkout]",
          "    Cart[Cart] --> Payment[Payment authorization]",
          "  end",
          "  Payment --> Receipt[Receipt]",
        ].join("\n"),
      }),
    });
  });

  await page.getByRole("button", { name: "New scene" }).first().click();
  await page.getByLabel("Title").fill("Mixed scene");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create scene" })
    .click();
  await page.getByTestId("e2e-add-shape").click();
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });

  const readSavedElementCount = () =>
    page.evaluate(() => {
      const raw = window.localStorage.getItem("scenevault.library.v1");
      if (!raw) {
        return 0;
      }
      const state = JSON.parse(raw) as {
        scenes?: Array<{ id: string; title: string }>;
        bundles?: Record<string, { elements?: Array<{ isDeleted?: boolean }> }>;
      };
      const scene = state.scenes?.find(
        (candidate) => candidate.title === "Mixed scene",
      );
      if (!scene) {
        return 0;
      }
      return (
        state.bundles?.[scene.id]?.elements?.filter(
          (element) => !element.isDeleted,
        ).length ?? 0
      );
    });

  await expect.poll(readSavedElementCount).toBeGreaterThan(0);
  const elementCountBefore = await readSavedElementCount();
  expect(elementCountBefore).toBeGreaterThan(0);

  const canvasElementCountBefore = await page.evaluate(() => {
    return (
      (
        window as unknown as {
          __excalidrawApi?: { getSceneElements: () => unknown[] };
        }
      ).__excalidrawApi?.getSceneElements().length ?? 0
    );
  });

  await page.getByRole("button", { name: "AI diagram" }).click();
  await page
    .getByLabel("Prompt")
    .fill("Add a checkout flow beside the current drawing.");
  await page.getByRole("button", { name: "Generate diagram" }).click();

  await expect(page.getByLabel("Scene title")).toHaveValue("Mixed scene");
  await expect.poll(readSavedElementCount).toBeGreaterThan(elementCountBefore);
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        return (
          (
            window as unknown as {
              __excalidrawApi?: { getSceneElements: () => unknown[] };
            }
          ).__excalidrawApi?.getSceneElements().length ?? 0
        );
      });
    })
    .toBeGreaterThan(canvasElementCountBefore);
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 10_000 });
});

test("edits and autosaves a scene bundle", async ({ page }) => {
  await page.getByRole("button", { name: "New scene" }).first().click();
  await page.getByLabel("Title").fill("System sketch");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create scene" })
    .click();
  await expect(page.getByLabel("Scene title")).toHaveValue("System sketch");

  await page.getByTestId("e2e-add-shape").click();
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });
  await page.getByLabel("Scene title").fill("System sketch v2");
  await page.getByLabel("Back to library").click();

  await expect(
    page.getByRole("link", { name: "System sketch v2", exact: true }),
  ).toBeVisible();
});
