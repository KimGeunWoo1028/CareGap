/**
 * Estimated (not billed) cost helpers for Live pilot planning.
 * Rates must match the approved OpenAI list prices used at approval time.
 */

export type ModelRateCard = {
  model_id: string;
  input_usd_per_1m_tokens: number;
  output_usd_per_1m_tokens: number;
  source_note: string;
};

/** Previous placeholder card kept for audit diffs only — do not use for Live spend gates. */
export const LEGACY_PLACEHOLDER_RATE_CARD: ModelRateCard = {
  model_id: "gpt-5.4-mini-2026-03-17",
  input_usd_per_1m_tokens: 0.25,
  output_usd_per_1m_tokens: 2.0,
  source_note:
    "Superseded placeholder (input $0.25 / output $2.00 per 1M). Not for Live gating.",
};

/**
 * Official list prices confirmed for this pilot planning slice:
 * input $0.75 / 1M tokens, output $4.50 / 1M tokens (gpt-5.4-mini-2026-03-17).
 */
export const DEFAULT_PILOT_RATE_CARD: ModelRateCard = {
  model_id: "gpt-5.4-mini-2026-03-17",
  input_usd_per_1m_tokens: 0.75,
  output_usd_per_1m_tokens: 4.5,
  source_note:
    "User-confirmed OpenAI list rates for gpt-5.4-mini-2026-03-17 (input $0.75 / output $4.50 per 1M). Estimate ≠ invoice.",
};

export function compareRateCards(
  current: ModelRateCard = DEFAULT_PILOT_RATE_CARD,
  previous: ModelRateCard = LEGACY_PLACEHOLDER_RATE_CARD,
): {
  model_id: string;
  input_multiplier: number;
  output_multiplier: number;
  previous: ModelRateCard;
  current: ModelRateCard;
} {
  return {
    model_id: current.model_id,
    input_multiplier:
      current.input_usd_per_1m_tokens / previous.input_usd_per_1m_tokens,
    output_multiplier:
      current.output_usd_per_1m_tokens / previous.output_usd_per_1m_tokens,
    previous,
    current,
  };
}

export type LiveCostEstimate = {
  model_id: string;
  cases: number;
  max_attempts_per_case: number;
  estimated_input_tokens_per_call: number;
  estimated_output_tokens_per_call: number;
  estimated_calls_including_retries: number;
  estimated_input_tokens_total: number;
  estimated_output_tokens_total: number;
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
  const estimated_input_tokens_total =
    estimated_calls_including_retries * estimated_input_tokens_per_call;
  const estimated_output_tokens_total =
    estimated_calls_including_retries * estimated_output_tokens_per_call;
  const inputCost =
    (estimated_input_tokens_total / 1_000_000) * rate.input_usd_per_1m_tokens;
  const outputCost =
    (estimated_output_tokens_total / 1_000_000) * rate.output_usd_per_1m_tokens;
  const estimated_usd = inputCost + outputCost;
  return {
    model_id: rate.model_id,
    cases: input.cases,
    max_attempts_per_case,
    estimated_input_tokens_per_call,
    estimated_output_tokens_per_call,
    estimated_calls_including_retries,
    estimated_input_tokens_total,
    estimated_output_tokens_total,
    estimated_usd,
    hard_max_usd: input.hard_max_usd,
    within_hard_max: estimated_usd <= input.hard_max_usd,
    estimate_vs_invoice_note:
      "estimated_usd is a planner upper bound, not the OpenAI invoice. Account billing limits are separate.",
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
