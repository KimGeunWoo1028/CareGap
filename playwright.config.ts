import { defineConfig, devices } from "@playwright/test";

/** Prefer a quiet port; orphaned `next start` on an old port + rebuild causes ChunkLoadError. */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3451);
const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * Minimal E2E harness for Phase 2 UI smoke checks.
 * Uses a dedicated port so a local `npm run dev` on :3000 does not collide.
 * Set PLAYWRIGHT_BASE_URL to attach to an already-running production server
 * (skips webServer). Do not point at a stale process whose `.next` was rebuilt.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT} -H 127.0.0.1`,
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 180_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
