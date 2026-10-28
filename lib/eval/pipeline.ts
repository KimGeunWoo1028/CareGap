import {
  buildConfusion,
  collectObservations,
  computeCitationMetrics,
  computeStatusMetrics,
  EVALUATION_VERSION,
  METRIC_DEFINITIONS,
} from "@/lib/eval/metrics";
import { predictionFileSchema } from "@/lib/eval/schema";
import type {
  EvalDataset,
  EvalReport,
  PredictionFile,
} from "@/lib/eval/types";

export function runEvaluation(input: {
  dataset: EvalDataset;
  predictions: unknown;
  evaluation_version?: string;
  executed_at?: string;
}): EvalReport {
  const predParsed = predictionFileSchema.safeParse(input.predictions);
  if (!predParsed.success) {
    throw new Error(
      `Invalid prediction file: ${predParsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  const predictions = predParsed.data as PredictionFile;

  if (
    predictions.prediction_source === "live" &&
    predictions.model_id == null
  ) {
    throw new Error("live prediction_source requires model_id");
  }

  const goldById = new Map(input.dataset.cases.map((c) => [c.id, c]));
  const seen = new Map<string, number>();
  const duplicate_predictions: string[] = [];
  const extra_predictions: string[] = [];
  const matched: Array<{
    case_id: string;
    gold: (typeof input.dataset.cases)[0]["expected_status"];
    pred: PredictionFile["predictions"][0]["predicted_status"];
    evidence: PredictionFile["predictions"][0]["evidence"];
  }> = [];

  for (const p of predictions.predictions) {
    const count = (seen.get(p.case_id) ?? 0) + 1;
    seen.set(p.case_id, count);
    if (count > 1) {
      duplicate_predictions.push(p.case_id);
      continue;
    }
    const gold = goldById.get(p.case_id);
    if (!gold) {
      extra_predictions.push(p.case_id);
      continue;
    }
    matched.push({
      case_id: p.case_id,
      gold: gold.expected_status,
      pred: p.predicted_status,
      evidence: p.evidence,
    });
  }

  const missing_predictions = input.dataset.cases
    .map((c) => c.id)
    .filter((id) => !seen.has(id));

  const obs = collectObservations(
    matched.map((m) => ({
      case_id: m.case_id,
      gold: m.gold,
      pred: m.pred,
    })),
  );
  const confusion = buildConfusion(obs);
  const statusMetrics = computeStatusMetrics(obs);

  const evidenceItems = matched.flatMap((m) => {
    const goldCase = goldById.get(m.case_id)!;
    return (m.evidence ?? []).map((e) => ({
      case_id: m.case_id,
      domain: e.domain,
      side: e.side,
      note_id: e.note_id,
      quote: e.quote,
      expected_note_id:
        e.side === "previous"
          ? `prev:${goldCase.id}`
          : `curr:${goldCase.id}`,
    }));
  });
  const citation = computeCitationMetrics(evidenceItems);

  const error_cases: EvalReport["error_cases"] = [];
  for (const o of obs) {
    if (o.gold === o.pred) continue;
    let kind = "status_mismatch";
    if (o.gold === "worsened" && (o.pred === "unchanged" || o.pred === "improved")) {
      kind = "false_reassurance";
    } else if (o.gold === "worsened" && o.pred !== "worsened") {
      kind = "missed_worsening";
    } else if (o.pred === "worsened" && o.gold !== "worsened") {
      kind = "false_worsening";
    } else if (o.gold === "unknown" && o.pred !== "unknown") {
      kind = "missed_unknown";
    }
    error_cases.push({
      case_id: o.case_id,
      kind,
      detail: `${o.domain}: gold=${o.gold} pred=${o.pred}`,
    });
  }
  for (const id of missing_predictions) {
    error_cases.push({
      case_id: id,
      kind: "missing_prediction",
      detail: "no prediction for gold case",
    });
  }
  for (const id of duplicate_predictions) {
    error_cases.push({
      case_id: id,
      kind: "duplicate_prediction",
      detail: "prediction repeated",
    });
  }
  for (const id of extra_predictions) {
    error_cases.push({
      case_id: id,
      kind: "extra_prediction",
      detail: "prediction for unknown case id",
    });
  }

  const notes: string[] = [
    "Internal synthetic evaluation only — not expert-reviewed clinical accuracy.",
    "Citation presence/ID checks are structural; semantic citation fitness requires manual review.",
  ];
  if (predictions.prediction_source === "replay") {
    notes.push(
      "Replay predictions must not be reported as full-dataset model accuracy.",
    );
  }
  if (predictions.prediction_source !== "live") {
    notes.push(
      `prediction_source=${predictions.prediction_source}: no live model accuracy claim.`,
    );
  }

  const coverage =
    input.dataset.cases.length === 0
      ? ("N/A" as const)
      : matched.length / input.dataset.cases.length;

  return {
    dataset_version: input.dataset.dataset_version,
    evaluation_version: input.evaluation_version ?? EVALUATION_VERSION,
    model_id: predictions.model_id,
    prompt_version: predictions.prompt_version,
    schema_version: predictions.schema_version,
    executed_at: input.executed_at ?? new Date().toISOString(),
    prediction_source: predictions.prediction_source,
    total_cases: input.dataset.cases.length,
    evaluated_cases: matched.length,
    missing_predictions,
    duplicate_predictions: [...new Set(duplicate_predictions)],
    extra_predictions,
    metrics: {
      coverage,
      ...statusMetrics,
      confusion_overall: confusion.overall,
      confusion_by_domain: confusion.by_domain,
      ...citation,
    },
    metric_definitions: METRIC_DEFINITIONS,
    error_cases,
    notes,
  };
}

export function formatEvalReportMarkdown(report: EvalReport): string {
  const lines = [
    `# CareGap AI Evaluation Report`,
    ``,
    `- dataset_version: ${report.dataset_version}`,
    `- evaluation_version: ${report.evaluation_version}`,
    `- prediction_source: ${report.prediction_source}`,
    `- model_id: ${report.model_id ?? "null"}`,
    `- prompt_version: ${report.prompt_version ?? "null"}`,
    `- schema_version: ${report.schema_version}`,
    `- executed_at: ${report.executed_at}`,
    `- total_cases: ${report.total_cases}`,
    `- evaluated_cases: ${report.evaluated_cases}`,
    ``,
    `## Metrics`,
  ];
  for (const [k, v] of Object.entries(report.metrics)) {
    if (typeof v === "object") continue;
    lines.push(`- ${k}: ${formatMetric(v)}`);
  }
  lines.push(``, `## Notes`);
  for (const n of report.notes) lines.push(`- ${n}`);
  lines.push(``, `## Error cases (${report.error_cases.length})`);
  for (const e of report.error_cases.slice(0, 50)) {
    lines.push(`- ${e.case_id}: ${e.kind} — ${e.detail}`);
  }
  if (report.error_cases.length > 50) {
    lines.push(`- … ${report.error_cases.length - 50} more`);
  }
  return `${lines.join("\n")}\n`;
}

function formatMetric(v: unknown): string {
  if (v === "N/A") return "N/A";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(4);
  return String(v);
}
