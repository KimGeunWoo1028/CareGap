import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  planLiveDryRun,
  readCheckpointCaseIds,
} from "@/lib/eval/live-dry-run";
import { DEFAULT_LIVE_EVAL_BUDGET } from "@/lib/eval/live-prep";
import { validateEvalDataset } from "@/lib/eval/validate-dataset";
import { executeLiveEvalForbidden } from "@/lib/eval/live-prep";

describe("live dry-run readiness", () => {
  it("plans dry-run without network and respects checkpoint skip", () => {
    const raw = JSON.parse(
      readFileSync(resolve(process.cwd(), "fixtures/eval/dataset.v1.json"), "utf8"),
    );
    const v = validateEvalDataset(raw);
    expect(v.ok).toBe(true);
    const first = v.dataset!.cases[0]!.id;
    const plan = planLiveDryRun({
      dataset: v.dataset!,
      config: {
        mode: "dry_run",
        opt_in: true,
        budget: { ...DEFAULT_LIVE_EVAL_BUDGET, max_calls: 3 },
        model_id: "gpt-5.4-mini-2026-03-17",
        prompt_version: "ai_spec_system_v1",
        dataset_version: v.dataset!.dataset_version,
        schema_version: "1.0",
        estimated_usd_per_call: 0.02,
        checkpoint_path: "fixtures/eval/checkpoints/dry-run.json",
        allow_service_db: false,
      },
      checkpointJson: JSON.stringify({ completed_case_ids: [first] }),
    });
    expect(plan.would_call_openai).toBe(false);
    expect(plan.mode).toBe("dry_run");
    expect(plan.selected_case_ids).not.toContain(first);
    expect(plan.selected_case_ids.length).toBeLessThanOrEqual(3);
    expect(plan.within_cost_budget).toBe(true);
    expect(plan.data_boundary).toMatch(/CareGap Test/i);
  });

  it("records blocked reasons when opt-in is false", () => {
    const raw = JSON.parse(
      readFileSync(resolve(process.cwd(), "fixtures/eval/dataset.v1.json"), "utf8"),
    );
    const v = validateEvalDataset(raw);
    const plan = planLiveDryRun({
      dataset: v.dataset!,
      config: {
        mode: "dry_run",
        opt_in: false,
        budget: DEFAULT_LIVE_EVAL_BUDGET,
        model_id: "gpt-5.4-mini-2026-03-17",
        prompt_version: "ai_spec_system_v1",
        dataset_version: "1.0.0",
        schema_version: "1.0",
        estimated_usd_per_call: 0.02,
        checkpoint_path: "x",
        allow_service_db: false,
      },
    });
    expect(plan.blocked_reasons).toContain("opt_in_false");
  });

  it("parses checkpoint ids and still forbids live execution", () => {
    expect(readCheckpointCaseIds('{"completed_case_ids":["a","b"]}')).toEqual([
      "a",
      "b",
    ]);
    expect(() => executeLiveEvalForbidden()).toThrow(/disabled/i);
  });
});
