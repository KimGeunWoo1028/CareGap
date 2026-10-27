import analysisSchema from "@/schemas/analysis.schema.json";
import { ApiError } from "@/lib/api/errors";
import {
  ANALYSIS_SYSTEM_INSTRUCTION,
  buildAnalysisUserPayload,
} from "@/lib/analysis/prompt";
import {
  formatRecommendationsMessage,
  matchWelfarePrograms,
} from "@/lib/matching/match-programs";
import type {
  AnalysisEngineResult,
  AnalysisNote,
  WelfareProgram,
} from "@/lib/analysis/types";
import { validateAnalysisOutput } from "@/lib/analysis/validate";

export const LIVE_CALL_TIMEOUT_MS = 20_000;
export const LIVE_MAX_OUTPUT_TOKENS = 4000;

export type LiveOpenAiConfig = {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
};

type ResponsesApiJson = {
  status?: string;
  output_text?: string;
  error?: { message?: string; code?: string };
  incomplete_details?: unknown;
};

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function extractOutputText(payload: ResponsesApiJson): string {
  if (typeof payload.output_text === "string" && payload.output_text.length > 0) {
    return payload.output_text;
  }
  invalidProvider("empty_output");
}

function invalidProvider(reason: string, details: Record<string, unknown> = {}): never {
  throw new ApiError("AI_UNAVAILABLE", undefined, { reason, ...details });
}

function timeoutError(details: Record<string, unknown> = {}): never {
  throw new ApiError("TIMEOUT", undefined, details);
}

async function callResponsesOnce(
  config: LiveOpenAiConfig,
  previous: AnalysisNote,
  current: AnalysisNote,
): Promise<unknown> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const userPayload = buildAnalysisUserPayload(previous, current);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_CALL_TIMEOUT_MS);

  try {
    const response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        store: false,
        max_output_tokens: LIVE_MAX_OUTPUT_TOKENS,
        input: [
          {
            role: "system",
            content: ANALYSIS_SYSTEM_INSTRUCTION,
          },
          {
            role: "user",
            content: JSON.stringify(userPayload),
          },
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

    if (!response.ok) {
      const retryable = isRetryableStatus(response.status);
      const err = new ApiError(
        response.status === 429 ? "RATE_LIMITED" : "AI_UNAVAILABLE",
        undefined,
        { http_status: response.status, retryable },
      );
      throw err;
    }

    const payload = (await response.json()) as ResponsesApiJson;

    if (payload.status && payload.status !== "completed") {
      throw new ApiError("INVALID_AI_OUTPUT", undefined, {
        reason: "incomplete_or_rejected",
        status: payload.status,
      });
    }

    const text = extractOutputText(payload);
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ApiError("INVALID_AI_OUTPUT", undefined, {
        reason: "json_parse",
      });
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      timeoutError({ reason: "live_timeout_ms", ms: LIVE_CALL_TIMEOUT_MS });
    }
    invalidProvider("network", {
      message: error instanceof Error ? error.message : "unknown",
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Live OpenAI Responses analysis. Never falls back to replay on failure.
 * Retries once only for 429/5xx/transient network errors (not validation).
 */
export async function runLiveAnalysis(input: {
  previous: AnalysisNote;
  current: AnalysisNote;
  programs: readonly WelfareProgram[];
  openai: LiveOpenAiConfig;
}): Promise<AnalysisEngineResult> {
  const { openai, previous, current, programs } = input;
  if (!openai.apiKey.trim() || !openai.model.trim()) {
    throw new ApiError("AI_UNAVAILABLE", undefined, {
      reason: "missing_openai_config",
    });
  }

  let attempt = 0;
  let lastError: unknown;

  while (attempt < 2) {
    attempt += 1;
    try {
      const raw = await callResponsesOnce(openai, previous, current);
      const analysis = validateAnalysisOutput(raw, previous, current);
      const recommendations = matchWelfarePrograms(analysis, programs);
      return {
        mode: "live",
        model: openai.model,
        analysis,
        recommendations,
        recommendations_message: formatRecommendationsMessage(recommendations),
      };
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof ApiError &&
        (error.code === "RATE_LIMITED" ||
          (error.code === "AI_UNAVAILABLE" &&
            error.details.retryable === true));

      if (!retryable || attempt >= 2) {
        throw error;
      }
      await sleep(250);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ApiError("AI_UNAVAILABLE");
}
