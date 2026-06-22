import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/dashboard");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("creates nested folders and searches by folder name", async ({ page }) => {
  await page.getByLabel("Create folder").click();
  await page.getByLabel("Name").fill("Product");
  await page.getByRole("dialog").getByRole("button", { name: "Create folder" }).click();

  await page.getByRole("button", { name: "Open folder Product" }).click();
  await page.getByLabel("Create folder").click();
  await page.getByLabel("Name").fill("Flows");
  await page.getByRole("dialog").getByRole("button", { name: "Create folder" }).click();

  await page.getByRole("button", { name: "Open folder Flows" }).click();
  await page.getByRole("button", { name: "New scene" }).first().click();
  await page.getByLabel("Title").fill("Checkout map");
  await page.getByRole("dialog").getByRole("button", { name: "Create scene" }).click();

  await page.getByLabel("Back to library").click();
  await page.getByRole("button", { name: "All scenes" }).click();
  await page.getByLabel("Search scenes and folders").fill("flows");

  await expect(
    page.getByRole("link", { name: "Checkout map", exact: true }),
  ).toBeVisible();
});

test("edits and autosaves a scene bundle", async ({ page }) => {
  await page.getByRole("button", { name: "New scene" }).first().click();
  await page.getByLabel("Title").fill("System sketch");
  await page.getByRole("dialog").getByRole("button", { name: "Create scene" }).click();
  await expect(page.getByLabel("Scene title")).toHaveValue("System sketch");

  await page.getByTestId("e2e-add-shape").click();
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });
  await page.getByLabel("Scene title").fill("System sketch v2");
  await page.getByLabel("Back to library").click();

  await expect(
    page.getByRole("link", { name: "System sketch v2", exact: true }),
  ).toBeVisible();
});
