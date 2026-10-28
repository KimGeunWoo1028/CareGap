import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditEvalDataset } from "@/lib/eval/audit";
import { scoreAllBaselines } from "@/lib/eval/baselines";
import { validateEvalDataset } from "@/lib/eval/validate-dataset";
import { planLiveDryRun } from "@/lib/eval/live-dry-run";
import { DEFAULT_LIVE_EVAL_BUDGET } from "@/lib/eval/live-prep";
import { EVALUATION_VERSION } from "@/lib/eval/metrics";

describe("calibration artifacts", () => {
  it("writes baseline + audit + dry-run reports without Live calls", () => {
    const raw = JSON.parse(
      readFileSync(resolve(process.cwd(), "fixtures/eval/dataset.v1.json"), "utf8"),
    );
    const v = validateEvalDataset(raw);
    expect(v.ok).toBe(true);
    const dataset = v.dataset!;
    const audit = auditEvalDataset(dataset);
    const baselines = scoreAllBaselines(dataset, 42);
    const dryRun = planLiveDryRun({
      dataset,
      config: {
        mode: "dry_run",
        opt_in: false,
        budget: DEFAULT_LIVE_EVAL_BUDGET,
        model_id: "gpt-5.4-mini-2026-03-17",
        prompt_version: "ai_spec_system_v1",
        dataset_version: dataset.dataset_version,
        schema_version: "1.0",
        estimated_usd_per_call: 0.02,
        checkpoint_path: "fixtures/eval/checkpoints/example.json",
        allow_service_db: false,
      },
    });

    const outDir = resolve(process.cwd(), "fixtures/eval/reports");
    mkdirSync(outDir, { recursive: true });
    const payload = {
      evaluation_version: EVALUATION_VERSION,
      dataset_version: dataset.dataset_version,
      executed_at: "2026-10-28T15:00:00.000Z",
      prediction_source: "synthetic_stub",
      note: "Calibration baselines only — not Live model accuracy.",
      audit: {
        case_count: audit.case_count,
        cell_count: audit.cell_count,
        unknown_share: audit.unknown_share,
        split_counts: audit.split_counts,
        review_status_counts: audit.review_status_counts,
        family_split_violations: audit.family_split_violations,
        label_distribution: audit.label_distribution,
        interpretation_limits: audit.interpretation_limits,
        ambiguity_flag_count: audit.ambiguity_flags.length,
      },
      baselines,
      live_dry_run: dryRun,
      quality_gate_template: {
        overall_status_accuracy: "report but do not promote alone",
        macro_f1: "required",
        worsened_precision: "required",
        worsened_recall: "required",
        missed_worsening_rate: "required",
        false_worsening_rate: "required",
        false_reassurance_rate: "required",
        unknown_detection_rate: "required",
        citation_presence_rate: "structural only",
        citation_semantic_review: "manual — never auto PASS",
        model_failure_rate: "Live only",
        vs_baselines: "must beat worsened recall of always_unknown (0) and improve macro-F1 with evidence",
      },
    };
    writeFileSync(
      resolve(outDir, "calibration-baselines.v1.json"),
      `${JSON.stringify(payload, null, 2)}\n`,
    );
    expect(baselines[0]!.name).toBe("always_unknown");
    expect(dryRun.would_call_openai).toBe(false);
  });
});
