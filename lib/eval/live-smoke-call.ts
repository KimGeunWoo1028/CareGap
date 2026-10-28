/**
 * Eval-only Live Responses call with usage capture.
 * Reuses AI_SPEC structured-output contract from lib/analysis/live.ts.
 * Inject fetchImpl in tests — never call real OpenAI from unit tests.
 */

import analysisSchema from "@/schemas/analysis.schema.json";
import { ApiError } from "@/lib/api/errors";
import {
  extractResponsesOutputText,
  extractResponsesUsage,
  type ResponsesApiPayload,
  type ResponsesUsage,
} from "@/lib/analysis/live-response";
import {
  ANALYSIS_SYSTEM_INSTRUCTION,
  buildAnalysisUserPayload,
} from "@/lib/analysis/prompt";
import type { AnalysisNote, ValidatedAnalysis } from "@/lib/analysis/types";
import { validateAnalysisOutput } from "@/lib/analysis/validate";
import {
  LIVE_CALL_TIMEOUT_MS,
  LIVE_MAX_OUTPUT_TOKENS,
  type LiveOpenAiConfig,
} from "@/lib/analysis/live";
import {
  calculateUsageCostUsd,
  DEFAULT_PILOT_RATE_CARD,
} from "@/lib/eval/live-cost";
import type { ExpectedStatusMap } from "@/lib/eval/types";
import { ANALYSIS_DOMAINS } from "@/lib/analysis/types";

export const SMOKE_PROMPT_VERSION = "ai_spec_system_v1";

export type SmokeResponseClass =
  | "success"
  | "refusal"
  | "incomplete"
  | "timeout"
  | "http_429"
  | "http_5xx"
  | "auth_or_model_access"
  | "invalid_json"
  | "schema_or_evidence_invalid"
  | "network"
  | "unexpected";

export type SmokeCallSuccess = {
  ok: true;
  response_class: "success";
  predicted_status: ExpectedStatusMap;
  analysis: ValidatedAnalysis;
  usage: ResponsesUsage;
  calculated_usage_cost_usd: number | null;
  latency_ms: number;
  provider_status: string | null;
};

export type SmokeCallFailure = {
  ok: false;
  response_class: Exclude<SmokeResponseClass, "success">;
  error_code: string;
  retryable: boolean;
  /** Timeout may still have been billed server-side — do not auto-retry. */
  billing_uncertain: boolean;
  usage: ResponsesUsage | null;
  calculated_usage_cost_usd: number | null;
  latency_ms: number;
  provider_status: string | null;
};

export type SmokeCallResult = SmokeCallSuccess | SmokeCallFailure;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyHttp(status: number): {
  response_class: SmokeCallFailure["response_class"];
  retryable: boolean;
  code: string;
} {
  if (status === 401 || status === 403) {
    return {
      response_class: "auth_or_model_access",
      retryable: false,
      code: `HTTP_${status}`,
    };
  }
  if (status === 404 || status === 400) {
    return {
      response_class: "auth_or_model_access",
      retryable: false,
      code: `HTTP_${status}`,
    };
  }
  if (status === 429) {
    return { response_class: "http_429", retryable: true, code: "HTTP_429" };
  }
  if (status >= 500) {
    return { response_class: "http_5xx", retryable: true, code: `HTTP_${status}` };
  }
  return {
    response_class: "unexpected",
    retryable: false,
    code: `HTTP_${status}`,
  };
}

function predictedFromAnalysis(analysis: ValidatedAnalysis): ExpectedStatusMap {
  const map = {} as ExpectedStatusMap;
  for (const d of ANALYSIS_DOMAINS) {
    const row = analysis.changes.find((c) => c.domain === d);
    map[d] = row?.status ?? "unknown";
  }
  return map;
}

function costFromUsage(usage: ResponsesUsage): number | null {
  if (usage.input_tokens == null || usage.output_tokens == null) return null;
  return calculateUsageCostUsd({
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    rate_card: DEFAULT_PILOT_RATE_CARD,
  });
}

function parseAndValidate(
  payload: ResponsesApiPayload,
  previous: AnalysisNote,
  current: AnalysisNote,
): {
  analysis: ValidatedAnalysis;
  usage: ResponsesUsage;
  provider_status: string | null;
} {
  const usage = extractResponsesUsage(payload);
  const provider_status = payload.status ?? null;

  if (payload.status && payload.status !== "completed") {
    throw Object.assign(new Error("incomplete_or_rejected"), {
      smoke_class: "incomplete" as const,
      usage,
      provider_status,
    });
  }

  const extracted = extractResponsesOutputText(payload);
  if (extracted.kind === "refusal") {
    throw Object.assign(new Error("refusal"), {
      smoke_class: "refusal" as const,
      usage,
      provider_status,
    });
  }
  if (extracted.kind === "empty") {
    throw Object.assign(new Error("empty_output"), {
      smoke_class: "incomplete" as const,
      usage,
      provider_status,
    });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(extracted.text) as unknown;
  } catch {
    throw Object.assign(new Error("json_parse"), {
      smoke_class: "invalid_json" as const,
      usage,
      provider_status,
    });
  }

  try {
    const analysis = validateAnalysisOutput(raw, previous, current);
    return { analysis, usage, provider_status };
  } catch (e) {
    throw Object.assign(
      e instanceof Error ? e : new Error("schema_or_evidence_invalid"),
      {
        smoke_class: "schema_or_evidence_invalid" as const,
        usage,
        provider_status,
      },
    );
  }
}

/**
 * Single Responses attempt (no retry). Caller decides limited retries.
 */
export async function callSmokeResponsesOnce(input: {
  previous: AnalysisNote;
  current: AnalysisNote;
  openai: LiveOpenAiConfig;
}): Promise<SmokeCallResult> {
  const { openai, previous, current } = input;
  const fetchImpl = openai.fetchImpl ?? fetch;
  const userPayload = buildAnalysisUserPayload(previous, current);
  const started = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_CALL_TIMEOUT_MS);

  try {
    const response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openai.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: openai.model,
        store: false,
        max_output_tokens: LIVE_MAX_OUTPUT_TOKENS,
        input: [
          { role: "system", content: ANALYSIS_SYSTEM_INSTRUCTION },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "caregap_analysis_v1",
            strict: true,
            schema: analysisSchema,
          },
        },
      }),
    });

    const latency_ms = Date.now() - started;

    if (!response.ok) {
      const c = classifyHttp(response.status);
      return {
        ok: false,
        response_class: c.response_class,
        error_code: c.code,
        retryable: c.retryable,
        billing_uncertain: false,
        usage: null,
        calculated_usage_cost_usd: null,
        latency_ms,
        provider_status: null,
      };
    }

    const payload = (await response.json()) as ResponsesApiPayload;
    try {
      const { analysis, usage, provider_status } = parseAndValidate(
        payload,
        previous,
        current,
      );
      return {
        ok: true,
        response_class: "success",
        predicted_status: predictedFromAnalysis(analysis),
        analysis,
        usage,
        calculated_usage_cost_usd: costFromUsage(usage),
        latency_ms,
        provider_status,
      };
    } catch (e) {
      const meta = e as {
        smoke_class?: SmokeCallFailure["response_class"];
        usage?: ResponsesUsage;
        provider_status?: string | null;
        message?: string;
      };
      const response_class = meta.smoke_class ?? "unexpected";
      const usage = meta.usage ?? extractResponsesUsage(payload);
      return {
        ok: false,
        response_class,
        error_code: meta.message ?? "INVALID_AI_OUTPUT",
        retryable: false,
        billing_uncertain: false,
        usage,
        calculated_usage_cost_usd: costFromUsage(usage),
        latency_ms,
        provider_status: meta.provider_status ?? payload.status ?? null,
      };
    }
  } catch (error) {
    const latency_ms = Date.now() - started;
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      return {
        ok: false,
        response_class: "timeout",
        error_code: "TIMEOUT",
        retryable: false,
        billing_uncertain: true,
        usage: null,
        calculated_usage_cost_usd: null,
        latency_ms,
        provider_status: null,
      };
    }
    return {
      ok: false,
      response_class: "network",
      error_code: error instanceof Error ? error.message.slice(0, 120) : "network",
      retryable: true,
      billing_uncertain: true,
      usage: null,
      calculated_usage_cost_usd: null,
      latency_ms,
      provider_status: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Up to 2 attempts: retry only http_429 / http_5xx / network once.
 * Timeout is never retried (billing uncertain).
 */
export async function callSmokeResponsesWithLimitedRetry(input: {
  previous: AnalysisNote;
  current: AnalysisNote;
  openai: LiveOpenAiConfig;
  onAttempt?: (n: number, result: SmokeCallResult) => void;
}): Promise<{ result: SmokeCallResult; attempts: number }> {
  let attempts = 0;
  let last: SmokeCallResult | null = null;
  while (attempts < 2) {
    attempts += 1;
    const result = await callSmokeResponsesOnce(input);
    input.onAttempt?.(attempts, result);
    last = result;
    if (result.ok) return { result, attempts };
    if (!result.retryable || attempts >= 2) return { result, attempts };
    await sleep(250);
  }
  return {
    result:
      last ??
      ({
        ok: false,
        response_class: "unexpected",
        error_code: "NO_ATTEMPT",
        retryable: false,
        billing_uncertain: false,
        usage: null,
        calculated_usage_cost_usd: null,
        latency_ms: 0,
        provider_status: null,
      } satisfies SmokeCallFailure),
    attempts,
  };
}

/** Sanity: production live path still rejects missing config the same way. */
export function assertOpenAiConfig(openai: LiveOpenAiConfig): void {
  if (!openai.apiKey.trim() || !openai.model.trim()) {
    throw new ApiError("AI_UNAVAILABLE", undefined, {
      reason: "missing_openai_config",
    });
  }
}

export { LIVE_MAX_OUTPUT_TOKENS, LIVE_CALL_TIMEOUT_MS };
