import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm exec next dev --port ${port}`,
    url: baseURL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    env: {
      NEXT_PUBLIC_LOCAL_DATA: "1",
      NEXT_PUBLIC_E2E_MODE: "1",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
