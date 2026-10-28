/**
 * Split success-only model metrics from end-to-end operational metrics.
 * Validation failures are never imputed as a status prediction.
 */

import { ANALYSIS_DOMAINS } from "@/lib/analysis/types";
import {
  collectObservations,
  computeStatusMetrics,
} from "@/lib/eval/metrics";
import type { ExpectedStatusMap } from "@/lib/eval/types";

export type SmokeCaseMetricRow = {
  case_id: string;
  response_class: string;
  predicted_status: ExpectedStatusMap | null;
  gold: ExpectedStatusMap;
};

export type SmokeOperationalMetrics = {
  valid_response_rate: number;
  validation_failure_rate: number;
  api_failure_rate: number;
  gold_worsened_cells: number;
  gold_worsened_detected_on_valid: number;
  gold_worsened_unevaluated_due_to_validation_failure: number;
  false_reassurance_on_valid: number | "N/A";
  success_only_model_metrics: ReturnType<typeof computeStatusMetrics> | null;
  notes: string[];
};

const API_FAIL = new Set([
  "http_429",
  "http_5xx",
  "timeout",
  "network",
  "auth_or_model_access",
]);

const VALIDATION_FAIL = new Set([
  "schema_or_evidence_invalid",
  "invalid_json",
  "refusal",
  "incomplete",
]);

export function computeSmokeOperationalMetrics(
  rows: SmokeCaseMetricRow[],
): SmokeOperationalMetrics {
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
    for (const d of ANALYSIS_DOMAINS) {
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

  const success_only_model_metrics =
    valid.length > 0
      ? computeStatusMetrics(
          collectObservations(
            valid.map((r) => ({
              case_id: r.case_id,
              gold: r.gold,
              pred: r.predicted_status!,
            })),
          ),
        )
      : null;

  return {
    valid_response_rate: n === 0 ? 0 : valid.length / n,
    validation_failure_rate: n === 0 ? 0 : validationFails.length / n,
    api_failure_rate: n === 0 ? 0 : apiFails.length / n,
    gold_worsened_cells,
    gold_worsened_detected_on_valid,
    gold_worsened_unevaluated_due_to_validation_failure,
    false_reassurance_on_valid:
      gold_worsened_on_valid === 0 ? "N/A" : false_reassurance / gold_worsened_on_valid,
    success_only_model_metrics,
    notes: [
      "success_only_model_metrics ignore validation failures — do not treat as end-to-end recall.",
      "gold_worsened_unevaluated_due_to_validation_failure tracks undelivered worsening signals.",
      "Validation failures are not imputed as status predictions.",
    ],
  };
}
