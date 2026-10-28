/**
 * Live evaluation preparation — no network calls.
 * Opt-in runner must enforce these guards before any OpenAI request.
 */

import type { EvalCase } from "@/lib/eval/types";
import { findSuspiciousIdentity } from "@/lib/validation/suspicious-pii";

export type LiveEvalBudget = {
  max_calls: number;
  max_estimated_usd: number;
  require_opt_in_env: string;
};

export const DEFAULT_LIVE_EVAL_BUDGET: LiveEvalBudget = {
  max_calls: 30,
  max_estimated_usd: 5,
  require_opt_in_env: "CAREGAP_LIVE_EVAL_OPT_IN",
};

export type LiveCaseGate = {
  case_id: string;
  runnable: boolean;
  reasons: string[];
};

export function assertLiveEvalOptIn(env: NodeJS.ProcessEnv = process.env): void {
  const flag = env[DEFAULT_LIVE_EVAL_BUDGET.require_opt_in_env];
  if (flag !== "I_ACCEPT_PAID_SYNTHETIC_EVAL") {
    throw new Error(
      `Live eval blocked: set ${DEFAULT_LIVE_EVAL_BUDGET.require_opt_in_env}=I_ACCEPT_PAID_SYNTHETIC_EVAL`,
    );
  }
}

export function gateCaseForLive(c: EvalCase): LiveCaseGate {
  const reasons: string[] = [];
  if (!c.synthetic_source || c.creation_method.includes("real")) {
    reasons.push("non_synthetic_source");
  }
  for (const side of ["previous", "current"] as const) {
    const pii = findSuspiciousIdentity(c[side].body);
    if (pii) reasons.push(`pii_${side}_${pii}`);
    if (c[side].body.length < 1 || c[side].body.length > 2000) {
      reasons.push(`body_length_${side}`);
    }
  }
  if (c.previous.occurred_on > c.current.occurred_on) {
    reasons.push("date_order");
  }
  return {
    case_id: c.id,
    runnable: reasons.length === 0,
    reasons,
  };
}

export type LiveEvalPlan = {
  dataset_version: string;
  budget: LiveEvalBudget;
  selected_case_ids: string[];
  skipped: LiveCaseGate[];
  restart_policy: string;
  secret_handling: string;
  result_versioning: string;
};

export function planLiveEval(
  cases: EvalCase[],
  dataset_version: string,
  budget: LiveEvalBudget = DEFAULT_LIVE_EVAL_BUDGET,
): LiveEvalPlan {
  const gates = cases.map(gateCaseForLive);
  const runnable = gates.filter((g) => g.runnable).map((g) => g.case_id);
  const selected = runnable.slice(0, budget.max_calls);
  return {
    dataset_version,
    budget,
    selected_case_ids: selected,
    skipped: gates.filter((g) => !g.runnable),
    restart_policy:
      "Resume from last completed case_id checkpoint; do not re-bill successful rows; abort on opt-in clear.",
    secret_handling:
      "API keys only from server env; never log keys, note bodies only if synthetic flag verified.",
    result_versioning:
      "Write predictions JSON with prediction_source=live, model_id, prompt_version, schema_version, executed_at.",
  };
}

/** Placeholder — must not call OpenAI. */
export function executeLiveEvalForbidden(): never {
  throw new Error(
    "Live eval execution is disabled in this foundation slice (no paid OpenAI calls).",
  );
}
