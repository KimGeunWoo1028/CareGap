/**
 * Estimated (not billed) cost helpers for Live pilot planning.
 * Rates are documentation defaults — verify against OpenAI pricing before approval.
 */

export type ModelRateCard = {
  model_id: string;
  input_usd_per_1m_tokens: number;
  output_usd_per_1m_tokens: number;
  source_note: string;
};

/** Conservative placeholder rates for planning — must be re-verified at approval time. */
export const DEFAULT_PILOT_RATE_CARD: ModelRateCard = {
  model_id: "gpt-5.4-mini-2026-03-17",
  input_usd_per_1m_tokens: 0.25,
  output_usd_per_1m_tokens: 2.0,
  source_note:
    "Placeholder planning rates only — confirm current OpenAI list prices before Live approval.",
};

export type LiveCostEstimate = {
  model_id: string;
  cases: number;
  max_attempts_per_case: number;
  estimated_input_tokens_per_call: number;
  estimated_output_tokens_per_call: number;
  estimated_calls_including_retries: number;
  estimated_usd: number;
  hard_max_usd: number;
  within_hard_max: boolean;
  estimate_vs_invoice_note: string;
  rate_card: ModelRateCard;
};

export function estimateLivePilotCost(input: {
  cases: number;
  max_attempts_per_case?: number;
  estimated_input_tokens_per_call?: number;
  estimated_output_tokens_per_call?: number;
  hard_max_usd: number;
  rate_card?: ModelRateCard;
}): LiveCostEstimate {
  const rate = input.rate_card ?? DEFAULT_PILOT_RATE_CARD;
  const max_attempts_per_case = input.max_attempts_per_case ?? 2;
  const estimated_input_tokens_per_call =
    input.estimated_input_tokens_per_call ?? 1200;
  const estimated_output_tokens_per_call =
    input.estimated_output_tokens_per_call ?? 800;
  const estimated_calls_including_retries =
    input.cases * max_attempts_per_case;
  const inputCost =
    (estimated_calls_including_retries * estimated_input_tokens_per_call) /
    1_000_000 *
    rate.input_usd_per_1m_tokens;
  const outputCost =
    (estimated_calls_including_retries * estimated_output_tokens_per_call) /
    1_000_000 *
    rate.output_usd_per_1m_tokens;
  const estimated_usd = inputCost + outputCost;
  return {
    model_id: rate.model_id,
    cases: input.cases,
    max_attempts_per_case,
    estimated_input_tokens_per_call,
    estimated_output_tokens_per_call,
    estimated_calls_including_retries,
    estimated_usd,
    hard_max_usd: input.hard_max_usd,
    within_hard_max: estimated_usd <= input.hard_max_usd,
    estimate_vs_invoice_note:
      "estimated_usd is a planner upper bound, not the OpenAI invoice. Actual billing may differ.",
    rate_card: rate,
  };
}

export type CostGuardState = {
  hard_max_usd: number;
  spent_usd_estimate: number;
  calls_made: number;
  max_calls: number;
};

export function assertWithinCostGuard(
  state: CostGuardState,
  nextCallEstimatedUsd: number,
): void {
  if (state.calls_made >= state.max_calls) {
    throw new Error("COST_GUARD: max_calls exceeded");
  }
  if (state.spent_usd_estimate + nextCallEstimatedUsd > state.hard_max_usd) {
    throw new Error("COST_GUARD: hard_max_usd would be exceeded");
  }
}
