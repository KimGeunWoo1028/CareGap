/**
 * Paid Live Smoke entry (5 cases).
 *
 * SAFETY: Refuses to call OpenAI unless ALL of:
 * - CLI includes --i-approve-live-spend
 * - CAREGAP_LIVE_EVAL_OPT_IN=I_ACCEPT_PAID_SYNTHETIC_EVAL
 * - OPENAI_API_KEY present
 * - OPENAI_MODEL=gpt-5.4-mini-2026-03-17 (or defaults to that id)
 *
 * Usage (only after explicit human APPROVE LIVE SMOKE):
 *   npx vite-node scripts/run-live-smoke-live.ts -- --i-approve-live-spend
 *
 * Never logs API key or note bodies.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  createDefaultSmokeExecuteCase,
  runSmokeDryRun,
  runSmokeLive,
  SMOKE_MODEL_ID,
} from "../lib/eval/live-smoke-runner";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const approve = args.includes("--i-approve-live-spend");
const dryOnly = args.includes("--dry-run") || !approve;
const artifactDirArg = args.find((a) => a.startsWith("--artifact-dir="));
const artifactDirRel = artifactDirArg
  ? artifactDirArg.slice("--artifact-dir=".length)
  : "fixtures/eval/artifacts";

/** Load selected keys from .env.local into process.env without logging values. */
function loadEnvLocalQuiet(): void {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i);
    if (
      key !== "OPENAI_API_KEY" &&
      key !== "OPENAI_MODEL" &&
      key !== "CAREGAP_LIVE_EVAL_OPT_IN"
    ) {
      continue;
    }
    if (process.env[key]) continue;
    process.env[key] = t.slice(i + 1);
  }
}

loadEnvLocalQuiet();

const manifestPath = resolve(ROOT, "fixtures/eval/live-smoke.v1.manifest.json");
const datasetPath = resolve(ROOT, "fixtures/eval/dataset.v1.json");
const outDir = resolve(ROOT, artifactDirRel);

function redactEnvPresence() {
  return {
    OPENAI_API_KEY: Boolean(
      process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 8,
    ),
    OPENAI_MODEL: process.env.OPENAI_MODEL ?? null,
    CAREGAP_LIVE_EVAL_OPT_IN_set:
      process.env.CAREGAP_LIVE_EVAL_OPT_IN ===
      "I_ACCEPT_PAID_SYNTHETIC_EVAL",
  };
}

async function main() {
  if (dryOnly) {
    const report = runSmokeDryRun({ manifestPath, datasetPath, outDir });
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          live_calls_executed: report.live_calls_executed,
          model_accuracy_measured: report.model_accuracy_measured,
          case_count: report.results.length,
          env: redactEnvPresence(),
          report: report.artifact_paths.report,
          note: "Pass --i-approve-live-spend only after explicit user APPROVE LIVE SMOKE.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const model = process.env.OPENAI_MODEL?.trim() || SMOKE_MODEL_ID;

  try {
    const report = await runSmokeLive({
      manifestPath,
      datasetPath,
      outDir,
      explicitApproval: true,
      env: process.env,
      executeCase: createDefaultSmokeExecuteCase({
        apiKey,
        model,
      }),
    });
    console.log(
      JSON.stringify(
        {
          mode: "live",
          live_calls_executed: report.live_calls_executed,
          model_accuracy_measured: report.model_accuracy_measured,
          completion_status: report.completion_status,
          totals: report.totals,
          report: report.artifact_paths.report,
          env: redactEnvPresence(),
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error(
      JSON.stringify(
        {
          mode: "live",
          live_calls_executed: 0,
          model_accuracy_measured: false,
          error: e instanceof Error ? e.message : "unknown",
          env: redactEnvPresence(),
        },
        null,
        2,
      ),
    );
    process.exitCode = 2;
  }
}

main();
