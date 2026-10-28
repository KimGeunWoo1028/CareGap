/**
 * Compatibility entry: always dry-run. Paid path is scripts/run-live-smoke-live.ts.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const result = spawnSync(process.execPath, ["scripts/run-live-smoke-dry-run.mjs"], {
  cwd: ROOT,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
