/**
 * 5-case Live smoke dry-run — never calls OpenAI.
 * Official rate card: input $0.75 / output $4.50 per 1M tokens.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const RATE = {
  model_id: "gpt-5.4-mini-2026-03-17",
  input_usd_per_1m_tokens: 0.75,
  output_usd_per_1m_tokens: 4.5,
  source_note:
    "User-confirmed OpenAI list rates (input $0.75 / output $4.50 per 1M).",
};
const LEGACY = {
  input_usd_per_1m_tokens: 0.25,
  output_usd_per_1m_tokens: 2.0,
};

const HARD_MAX_USD = 1;
const MAX_CALLS = 10;
const MAX_ATTEMPTS = 2;
const EST_IN = 1200;
const EST_OUT = 800;

const smokePath = resolve(root, "fixtures/eval/live-smoke.v1.manifest.json");
const datasetPath = resolve(root, "fixtures/eval/dataset.v1.json");
const outDir = resolve(root, "fixtures/eval/artifacts");

const smoke = JSON.parse(readFileSync(smokePath, "utf8"));
const dataset = JSON.parse(readFileSync(datasetPath, "utf8"));
const byId = new Map(dataset.cases.map((c) => [c.id, c]));

if (smoke.cases.length !== 5) throw new Error("smoke must be 5 cases");
if (smoke.test_split_used) throw new Error("test split forbidden");
if (smoke.model_id !== RATE.model_id) {
  throw new Error(`model mismatch: ${smoke.model_id}`);
}

const cases = smoke.cases.length;
const estimated_calls = Math.min(cases * MAX_ATTEMPTS, MAX_CALLS);
const estimated_input_tokens_total = estimated_calls * EST_IN;
const estimated_output_tokens_total = estimated_calls * EST_OUT;
const estimated_usd =
  (estimated_input_tokens_total / 1e6) * RATE.input_usd_per_1m_tokens +
  (estimated_output_tokens_total / 1e6) * RATE.output_usd_per_1m_tokens;
const legacy_usd =
  (estimated_input_tokens_total / 1e6) * LEGACY.input_usd_per_1m_tokens +
  (estimated_output_tokens_total / 1e6) * LEGACY.output_usd_per_1m_tokens;

const fp = createHash("sha256")
  .update(JSON.stringify(smoke.cases.map((c) => c.case_id)))
  .digest("hex")
  .slice(0, 16);

const results = smoke.cases.map((entry) => {
  const c = byId.get(entry.case_id);
  if (!c) {
    return {
      case_id: entry.case_id,
      family_id: entry.family_id,
      status: "api_failure",
      error_code: "CASE_NOT_FOUND",
      synthetic_ok: false,
    };
  }
  const synthetic_ok =
    Boolean(c.synthetic_source) && !String(c.creation_method).includes("real");
  return {
    case_id: c.id,
    family_id: c.family_id,
    split: c.split,
    status: "dry_run_skipped",
    error_code: null,
    synthetic_ok,
    review_status: c.review_status,
    expected_status: c.expected_status,
  };
});

if (results.some((r) => r.synthetic_ok === false)) {
  throw new Error("non-synthetic case in smoke cohort");
}

const apiKeyPresent = Boolean(
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 8,
);
const optIn =
  process.env.CAREGAP_LIVE_EVAL_OPT_IN === "I_ACCEPT_PAID_SYNTHETIC_EVAL";

const generated_at = new Date().toISOString();
const report = {
  schema_version: "caregap.eval.live_smoke.v1",
  generated_at,
  mode: "dry-run",
  live_calls_executed: false,
  model_id: RATE.model_id,
  prompt_version: null,
  evaluation_version: "live-smoke-prep-v1",
  case_count: cases,
  case_ids: smoke.cases.map((c) => c.case_id),
  gate: {
    ok: true,
    mode: "dry-run",
    opt_in_env: optIn,
    explicit_approval: false,
    api_key_present: apiKeyPresent,
    model_id_confirmed: RATE.model_id,
    cost_estimate: {
      ...RATE,
      cases,
      max_attempts_per_case: MAX_ATTEMPTS,
      max_calls_including_retries: MAX_CALLS,
      estimated_input_tokens_per_call: EST_IN,
      estimated_output_tokens_per_call: EST_OUT,
      estimated_calls_including_retries: estimated_calls,
      estimated_input_tokens_total,
      estimated_output_tokens_total,
      estimated_usd,
      legacy_placeholder_estimated_usd: legacy_usd,
      rate_card_input_multiplier_vs_placeholder:
        RATE.input_usd_per_1m_tokens / LEGACY.input_usd_per_1m_tokens,
      rate_card_output_multiplier_vs_placeholder:
        RATE.output_usd_per_1m_tokens / LEGACY.output_usd_per_1m_tokens,
      hard_max_usd: HARD_MAX_USD,
      within_hard_max: estimated_usd <= HARD_MAX_USD,
      estimate_vs_invoice_note:
        "estimated_usd is planner upper bound, not invoice. Account payment limits are separate.",
    },
    abort_conditions: [
      "opt_in cleared",
      "explicit approval missing",
      "API key missing",
      "calls_made >= 10",
      "spent_usd_estimate would exceed hard_max_usd $1",
      "non-retryable provider error after policy",
      "non-synthetic or PII gate failure",
      "checkpoint resume skip already-completed case_ids",
    ],
    blockers_for_live: [
      ...(optIn ? [] : ["CAREGAP_LIVE_EVAL_OPT_IN unset"]),
      "explicitApproval required",
      ...(apiKeyPresent ? [] : ["OPENAI_API_KEY missing in this process env"]),
    ],
  },
  results,
  metrics: null,
  metrics_note:
    "No Live model metrics — dry-run only. Do not invent accuracy.",
  safety: {
    caregap_test_db_writes: false,
    replay_contract_unchanged: true,
    synthetic_only: true,
    secrets_in_logs: false,
  },
  proposed_live_command:
    "CAREGAP_LIVE_EVAL_OPT_IN=I_ACCEPT_PAID_SYNTHETIC_EVAL npm run eval:pilot:smoke:live -- --i-approve-live-spend  (NOT ENABLED until approval; script may be wired after approve)",
};

mkdirSync(outDir, { recursive: true });
const reportPath = resolve(outDir, `live-smoke-dry-run-${fp}.json`);
const checkpointPath = resolve(outDir, `live-smoke-checkpoint-${fp}.json`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(
  checkpointPath,
  `${JSON.stringify(
    {
      fingerprint: fp,
      completed_case_ids: [],
      mode: "dry-run",
      hard_max_usd: HARD_MAX_USD,
      max_calls: MAX_CALLS,
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
      case_ids: report.case_ids,
      live_calls_executed: false,
      estimated_calls,
      estimated_input_tokens_total,
      estimated_output_tokens_total,
      estimated_usd,
      legacy_placeholder_estimated_usd: legacy_usd,
      within_hard_max: estimated_usd <= HARD_MAX_USD,
      api_key_present: apiKeyPresent,
      opt_in_env: optIn,
    },
    null,
    2,
  ),
);
