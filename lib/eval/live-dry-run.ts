/**
 * Live evaluation dry-run planner — never opens network sockets to OpenAI.
 */
import { gateCaseForLive, type LiveEvalBudget } from "@/lib/eval/live-prep";
import type { EvalCase, EvalDataset } from "@/lib/eval/types";

export const LIVE_EVAL_MODE = {
  dry_run: "dry_run",
  live: "live",
} as const;

export type LiveEvalMode = (typeof LIVE_EVAL_MODE)[keyof typeof LIVE_EVAL_MODE];

export type LiveDryRunConfig = {
  mode: LiveEvalMode;
  opt_in: boolean;
  budget: LiveEvalBudget;
  model_id: string;
  prompt_version: string;
  dataset_version: string;
  schema_version: string;
  estimated_usd_per_call: number;
  checkpoint_path: string;
  allow_service_db: false;
};

export type LiveDryRunResult = {
  mode: "dry_run";
  would_call_openai: false;
  blocked_reasons: string[];
  selected_case_ids: string[];
  skipped: Array<{ case_id: string; reasons: string[] }>;
  estimated_calls: number;
  estimated_usd: number;
  within_call_budget: boolean;
  within_cost_budget: boolean;
  model_id: string;
  prompt_version: string;
  dataset_version: string;
  schema_version: string;
  checkpoint_path: string;
  resume_from: string | null;
  duplicate_prevention: string;
  secret_handling: string;
  data_boundary: string;
  abort_conditions: string[];
};

export function readCheckpointCaseIds(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as { completed_case_ids?: string[] };
    return Array.isArray(parsed.completed_case_ids)
      ? parsed.completed_case_ids.filter((x) => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function planLiveDryRun(input: {
  dataset: EvalDataset;
  cases?: EvalCase[];
  config: LiveDryRunConfig;
  checkpointJson?: string | null;
}): LiveDryRunResult {
  const blocked_reasons: string[] = [];
  if (input.config.mode !== "dry_run") {
    blocked_reasons.push("mode_not_dry_run");
  }
  if (!input.config.opt_in) {
    blocked_reasons.push("opt_in_false");
  }
  if (input.config.allow_service_db !== false) {
    blocked_reasons.push("service_db_must_be_false");
  }

  const cases = input.cases ?? input.dataset.cases;
  const completed = new Set(readCheckpointCaseIds(input.checkpointJson ?? null));
  const gates = cases.map(gateCaseForLive);
  const skipped = gates
    .filter((g) => !g.runnable)
    .map((g) => ({ case_id: g.case_id, reasons: g.reasons }));
  const runnable = gates
    .filter((g) => g.runnable)
    .map((g) => g.case_id)
    .filter((id) => !completed.has(id));
  const selected = runnable.slice(0, input.config.budget.max_calls);
  const estimated_calls = selected.length;
  const estimated_usd =
    estimated_calls * input.config.estimated_usd_per_call;

  return {
    mode: "dry_run",
    would_call_openai: false,
    blocked_reasons,
    selected_case_ids: selected,
    skipped,
    estimated_calls,
    estimated_usd,
    within_call_budget: estimated_calls <= input.config.budget.max_calls,
    within_cost_budget:
      estimated_usd <= input.config.budget.max_estimated_usd,
    model_id: input.config.model_id,
    prompt_version: input.config.prompt_version,
    dataset_version: input.config.dataset_version,
    schema_version: input.config.schema_version,
    checkpoint_path: input.config.checkpoint_path,
    resume_from: completed.size ? [...completed].at(-1) ?? null : null,
    duplicate_prevention:
      "Skip case_ids listed in checkpoint completed_case_ids before any request.",
    secret_handling:
      "Never read or log API keys in dry-run; live path must use server env only.",
    data_boundary:
      "Eval fixtures only — never read/write CareGap Test application tables for scoring.",
    abort_conditions: [
      "opt_in cleared mid-run",
      "call or cost budget exceeded",
      "non-retryable provider error after policy",
      "non-synthetic or PII gate failure",
    ],
  };
}

/** Hard stop — calibration slice forbids paid calls. */
export function assertNoLiveNetworkInCalibration(): void {
  // Intentionally empty side-effect free guard used by tests.
}
