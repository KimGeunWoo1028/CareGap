import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatEvalReportMarkdown,
  runEvaluation,
} from "@/lib/eval/pipeline";
import { validateEvalDataset } from "@/lib/eval/validate-dataset";
import type { EvalDataset, PredictionFile } from "@/lib/eval/types";
import { planLiveEval, executeLiveEvalForbidden } from "@/lib/eval/live-prep";

const datasetPath = resolve(process.cwd(), "fixtures/eval/dataset.v1.json");

function loadDataset(): EvalDataset {
  const raw = JSON.parse(readFileSync(datasetPath, "utf8"));
  const v = validateEvalDataset(raw);
  expect(v.ok).toBe(true);
  return v.dataset!;
}

function identityPredictions(dataset: EvalDataset): PredictionFile {
  return {
    prediction_source: "synthetic_stub",
    model_id: null,
    prompt_version: null,
    schema_version: "1.0",
    dataset_version: dataset.dataset_version,
    predictions: dataset.cases.map((c) => ({
      case_id: c.id,
      predicted_status: c.expected_status,
    })),
  };
}

describe("runEvaluation pipeline", () => {
  it("runs identity stub without claiming live accuracy", () => {
    const dataset = loadDataset();
    const predictions = identityPredictions(dataset);
    const report = runEvaluation({
      dataset,
      predictions,
      executed_at: "2026-10-28T00:00:00.000Z",
    });
    expect(report.prediction_source).toBe("synthetic_stub");
    expect(report.evaluated_cases).toBe(dataset.cases.length);
    expect(report.metrics.overall_status_accuracy).toBe(1);
    expect(report.notes.some((n) => /no live model accuracy/i.test(n))).toBe(
      true,
    );

    const outDir = resolve(process.cwd(), "fixtures/eval/reports");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      resolve(outDir, "latest-identity.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    writeFileSync(
      resolve(outDir, "latest-identity.md"),
      formatEvalReportMarkdown(report),
    );
    writeFileSync(
      resolve(process.cwd(), "fixtures/eval/sample-predictions.identity.json"),
      `${JSON.stringify(predictions, null, 2)}\n`,
    );
  });

  it("flags missing, duplicate, and extra predictions", () => {
    const dataset = loadDataset();
    const base = identityPredictions(dataset);
    const broken: PredictionFile = {
      ...base,
      predictions: [
        base.predictions[0]!,
        base.predictions[0]!,
        {
          case_id: "not-a-real-case",
          predicted_status: {
            meal: "unknown",
            mobility: "unknown",
            health: "unknown",
            environment: "unknown",
          },
        },
      ],
    };
    const report = runEvaluation({ dataset, predictions: broken });
    expect(report.duplicate_predictions).toContain(base.predictions[0]!.case_id);
    expect(report.extra_predictions).toContain("not-a-real-case");
    expect(report.missing_predictions.length).toBeGreaterThan(0);
    expect(
      report.error_cases.some((e) => e.kind === "missing_prediction"),
    ).toBe(true);
  });

  it("is deterministic for the same inputs", () => {
    const dataset = loadDataset();
    const predictions = identityPredictions(dataset);
    const a = runEvaluation({
      dataset,
      predictions,
      executed_at: "2026-10-28T00:00:00.000Z",
    });
    const b = runEvaluation({
      dataset,
      predictions,
      executed_at: "2026-10-28T00:00:00.000Z",
    });
    expect(a.metrics).toEqual(b.metrics);
    expect(a.error_cases).toEqual(b.error_cases);
  });

  it("rejects live source without model_id", () => {
    const dataset = loadDataset();
    expect(() =>
      runEvaluation({
        dataset,
        predictions: {
          prediction_source: "live",
          model_id: null,
          prompt_version: "p1",
          schema_version: "1.0",
          dataset_version: dataset.dataset_version,
          predictions: [],
        },
      }),
    ).toThrow(/model_id/);
  });

  it("does not mark replay as full-dataset live accuracy", () => {
    const dataset = loadDataset();
    const one = dataset.cases[0]!;
    const report = runEvaluation({
      dataset,
      predictions: {
        prediction_source: "replay",
        model_id: null,
        prompt_version: null,
        schema_version: "1.0",
        dataset_version: dataset.dataset_version,
        predictions: [
          { case_id: one.id, predicted_status: one.expected_status },
        ],
      },
    });
    expect(report.prediction_source).toBe("replay");
    expect(report.notes.some((n) => /Replay/i.test(n))).toBe(true);
    expect(report.evaluated_cases).toBe(1);
  });
});

describe("live prep gates", () => {
  it("plans opt-in live eval without executing network calls", () => {
    const dataset = loadDataset();
    const plan = planLiveEval(dataset.cases, dataset.dataset_version, {
      max_calls: 5,
      max_estimated_usd: 1,
      require_opt_in_env: "CAREGAP_LIVE_EVAL_OPT_IN",
    });
    expect(plan.selected_case_ids.length).toBeLessThanOrEqual(5);
    expect(() => executeLiveEvalForbidden()).toThrow(/disabled/i);
  });
});
