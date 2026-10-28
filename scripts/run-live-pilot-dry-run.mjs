/**
 * Live pilot dry-run only — never calls OpenAI.
 * Writes fixtures/eval/artifacts/live-pilot-dry-run-*.json
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

// Cost estimate (mirrors lib/eval/live-cost.ts defaults)
const RATE = {
  model_id: "gpt-5.4-mini-2026-03-17",
  input_usd_per_1m_tokens: 0.75,
  output_usd_per_1m_tokens: 4.5,
};
const HARD_MAX_USD = 5;
const MAX_ATTEMPTS = 2;
const EST_IN = 1200;
const EST_OUT = 800;

const manifestPath = resolve(root, "fixtures/eval/live-pilot.v1.manifest.json");
const datasetPath = resolve(root, "fixtures/eval/dataset.v1.json");
const outDir = resolve(root, "fixtures/eval/artifacts");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const dataset = JSON.parse(readFileSync(datasetPath, "utf8"));
const byId = new Map(dataset.cases.map((c) => [c.id, c]));

const cases = manifest.cases.length;
const estimated_calls = cases * MAX_ATTEMPTS;
const estimated_usd =
  (estimated_calls * EST_IN) / 1e6 * RATE.input_usd_per_1m_tokens +
  (estimated_calls * EST_OUT) / 1e6 * RATE.output_usd_per_1m_tokens;

const fp = createHash("sha256")
  .update(JSON.stringify(manifest.cases.map((c) => c.case_id).sort()))
  .digest("hex")
  .slice(0, 16);

const results = manifest.cases.map((entry) => {
  const c = byId.get(entry.case_id);
  if (!c) {
    return {
      case_id: entry.case_id,
      family_id: entry.family_id,
      status: "api_failure",
      error_code: "CASE_NOT_FOUND",
    };
  }
  return {
    case_id: c.id,
    family_id: c.family_id,
    status: "dry_run_skipped",
    error_code: null,
  };
});

const generated_at = new Date().toISOString();
const report = {
  schema_version: "caregap.eval.live_pilot.v1",
  generated_at,
  mode: "dry-run",
  live_calls_executed: false,
  dataset_version: manifest.parent_dataset_version,
  model_id: null,
  prompt_version: null,
  evaluation_version: "live-pilot-prep-v1",
  case_count: cases,
  gate: {
    ok: true,
    mode: "dry-run",
    opt_in_env: false,
    explicit_approval: false,
    api_key_present: Boolean(process.env.OPENAI_API_KEY),
    cost_estimate: {
      model_id: RATE.model_id,
      cases,
      max_attempts_per_case: MAX_ATTEMPTS,
      estimated_input_tokens_per_call: EST_IN,
      estimated_output_tokens_per_call: EST_OUT,
      estimated_calls_including_retries: estimated_calls,
      estimated_usd,
      hard_max_usd: HARD_MAX_USD,
      within_hard_max: estimated_usd <= HARD_MAX_USD,
      estimate_vs_invoice_note:
        "estimated_usd is a planner upper bound, not the OpenAI invoice.",
      rate_card: {
        ...RATE,
        source_note:
          "User-confirmed OpenAI list rates (input $0.75 / output $4.50 per 1M).",
      },
    },
    blockers: [],
  },
  results,
  metrics: null,
  metrics_note:
    "No Live model metrics — dry-run only. Do not invent accuracy from this report.",
  safety: {
    opt_in_env: "CAREGAP_LIVE_EVAL_OPT_IN=I_ACCEPT_PAID_SYNTHETIC_EVAL",
    explicit_flag: "--i-approve-live-spend",
    caregap_test_db_writes: false,
    synthetic_only: true,
    secrets_in_logs: false,
  },
};

mkdirSync(outDir, { recursive: true });
const reportPath = resolve(outDir, `live-pilot-dry-run-${fp}.json`);
const checkpointPath = resolve(outDir, `live-pilot-checkpoint-${fp}.json`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(
  checkpointPath,
  `${JSON.stringify(
    {
      fingerprint: fp,
      completed_case_ids: [],
      mode: "dry-run",
      updated_at: generated_at,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      report: reportPath,
      checkpoint: checkpointPath,
      case_count: cases,
      live_calls_executed: false,
      estimated_calls,
      estimated_usd,
      within_hard_max: estimated_usd <= HARD_MAX_USD,
    },
    null,
    2,
  ),
);

void require;
