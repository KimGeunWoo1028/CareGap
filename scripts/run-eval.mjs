/**
 * Offline eval CLI (no OpenAI).
 * Builds identity stub predictions from gold labels and prints a JSON summary
 * by shelling into Vitest (uses project TS path aliases).
 *
 * Usage:
 *   node scripts/run-eval.mjs
 *   node scripts/run-eval.mjs --predictions fixtures/eval/sample-predictions.identity.json
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vitest", "run", "lib/eval/pipeline.test.ts", "lib/eval/validate-dataset.test.ts"],
  { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
);
process.exit(result.status ?? 1);
