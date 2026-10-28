/**
 * Offline reinterpretation of an existing Live smoke report.
 * Does not call OpenAI. Does not mutate the source report.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = resolve(
  root,
  "fixtures/eval/artifacts/live-smoke-run-live-1eb98abc380d11a5.json",
);
const manifestPath = resolve(root, "fixtures/eval/live-smoke.v1.manifest.json");
const outPath = resolve(
  root,
  "fixtures/eval/artifacts/live-smoke-run-live-1eb98abc380d11a5.analysis.json",
);

const DOMAINS = ["meal", "mobility", "health", "environment"];
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const gold = Object.fromEntries(
  manifest.cases.map((c) => [c.case_id, c.expected_status]),
);

const VALIDATION_FAIL = new Set([
  "schema_or_evidence_invalid",
  "invalid_json",
  "refusal",
  "incomplete",
]);
const API_FAIL = new Set([
  "http_429",
  "http_5xx",
  "timeout",
  "network",
  "auth_or_model_access",
]);

const rows = report.results.map((r) => ({
  case_id: r.case_id,
  response_class: r.response_class,
  predicted_status: r.predicted_status,
  gold: gold[r.case_id],
}));

const n = rows.length;
const valid = rows.filter((r) => r.response_class === "success");
const validationFails = rows.filter((r) =>
  VALIDATION_FAIL.has(r.response_class),
);
const apiFails = rows.filter((r) => API_FAIL.has(r.response_class));

let gold_worsened_cells = 0;
let gold_worsened_detected_on_valid = 0;
let gold_worsened_unevaluated_due_to_validation_failure = 0;
let false_reassurance = 0;
let gold_worsened_on_valid = 0;

for (const row of rows) {
  for (const d of DOMAINS) {
    if (row.gold[d] !== "worsened") continue;
    gold_worsened_cells += 1;
    if (VALIDATION_FAIL.has(row.response_class)) {
      gold_worsened_unevaluated_due_to_validation_failure += 1;
      continue;
    }
    if (row.response_class !== "success" || !row.predicted_status) continue;
    gold_worsened_on_valid += 1;
    if (row.predicted_status[d] === "worsened") {
      gold_worsened_detected_on_valid += 1;
    }
    if (
      row.predicted_status[d] === "unchanged" ||
      row.predicted_status[d] === "improved"
    ) {
      false_reassurance += 1;
    }
  }
}

const analysis = {
  schema_version: "caregap.eval.live_smoke_analysis.v1",
  source_report: reportPath,
  source_preserved: true,
  generated_at: new Date().toISOString(),
  live_calls_in_this_script: 0,
  case_comparisons: rows,
  metrics_A_success_only: report.metrics,
  metrics_B_operational: {
    valid_response_rate: valid.length / n,
    validation_failure_rate: validationFails.length / n,
    api_failure_rate: apiFails.length / n,
    gold_worsened_cells,
    gold_worsened_detected_on_valid,
    gold_worsened_unevaluated_due_to_validation_failure,
    false_reassurance_on_valid:
      gold_worsened_on_valid === 0
        ? "N/A"
        : false_reassurance / gold_worsened_on_valid,
  },
  root_cause_notes: {
    "eval-v1-001": {
      observed: "schema_or_evidence_invalid after billed completion",
      likely_code: "note_id_mismatch",
      rationale:
        "Case bodies match replay fixture exactly. Smoke sent note_ids like eval-v1-001-previous while replay/demo UUIDs are common model habit; validator rejects non-exact note_id. Raw response was not persisted in this run, so code is inferred — future runs emit validation_diagnosis.",
      remediation:
        "Use deterministic UUID-shaped synthetic note ids; strengthen prompt to copy note_id verbatim; persist diagnosis codes.",
    },
    "eval-v1-004": {
      observed: "all unknown gold → all unchanged pred (validated)",
      cause:
        "Identical non-domain weather/closing text at both times; model treated textual identity as status unchanged for meal/mobility/health/environment.",
      ai_spec:
        "unchanged requires comparable domain status at both times; absence or off-domain chatter must be unknown.",
      remediation:
        "Prompt hardening for unknown vs unchanged; no label hardcoding.",
    },
  },
  semantic_citation_review: {
    structural_items_reported_in_source: report.citation_metrics
      ?.semantic_citation_review_items,
    quotes_persisted_in_source: false,
    items: Array.from({ length: report.citation_metrics?.semantic_citation_review_items ?? 0 }).map(
      (_, i) => ({
        case_id: "unavailable_from_artifact",
        domain: "unavailable_from_artifact",
        predicted_status: "unavailable_from_artifact",
        evidence_source: "unavailable_from_artifact",
        evidence_quote: "",
        semantic_review_status: "pending_manual_review",
        reviewer_note:
          "Historical live artifact did not store evidence quotes; re-run after hardening required for item-level review. Index " +
          i,
      }),
    ),
    note: "Automatic exact-substring pass is not expert semantic approval.",
  },
  fingerprint: createHash("sha256")
    .update(readFileSync(reportPath))
    .digest("hex")
    .slice(0, 16),
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      out: outPath,
      operational: analysis.metrics_B_operational,
      live_calls: 0,
    },
    null,
    2,
  ),
);
