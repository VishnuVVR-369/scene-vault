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
