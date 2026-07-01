import { defineConfig, devices } from "@playwright/test";

// Live-collaboration e2e: runs the app in REMOTE mode (real Convex/Better Auth/R2 from
// .env.local) and drives two guest browser contexts against a seeded edit-share
// room. Kept separate from the default config, which runs in local-data mode.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e-collab",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  globalSetup: "./tests/e2e-collab/global-setup.ts",
  globalTeardown: "./tests/e2e-collab/global-teardown.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm exec next dev --port ${port}`,
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    // No NEXT_PUBLIC_LOCAL_DATA -> remote mode (Convex). E2E mode exposes the
    // window API + test affordance used to drive a real edit.
    env: { NEXT_PUBLIC_E2E_MODE: "1" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
