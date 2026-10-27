import { ApiError, type ApiErrorCode } from "@/lib/api/errors";

const RPC_ERROR_CODES = new Set<ApiErrorCode>([
  "UNAUTHENTICATED",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "IDEMPOTENCY_CONFLICT",
  "ANALYSIS_IN_PROGRESS",
  "NOT_ENOUGH_RECORDS",
  "RATE_LIMITED",
]);

const P0001_MESSAGES = new Set<ApiErrorCode>([
  "UNAUTHENTICATED",
  "VALIDATION_ERROR",
  "NOT_FOUND",
]);

export type StartAnalysisRpcSuccess = {
  created: boolean;
  analysis_id: string;
  status: "processing" | "succeeded" | "failed";
};

export type StartAnalysisRpcResult =
  | StartAnalysisRpcSuccess
  | { error_code: string };

export function isApiErrorCode(value: string): value is ApiErrorCode {
  return RPC_ERROR_CODES.has(value as ApiErrorCode) || value in {
    ANALYSIS_FAILED: true,
    REPLAY_UNAVAILABLE: true,
    AI_UNAVAILABLE: true,
    INVALID_AI_OUTPUT: true,
    TIMEOUT: true,
    SERVICE_UNAVAILABLE: true,
    DUPLICATE_ALIAS: true,
    DUPLICATE_DATE: true,
    REVIEW_EXISTS: true,
  };
}

/** Maps start_analysis JSON error_code (committed transaction path). */
export function mapStartAnalysisErrorCode(code: string): ApiError {
  if (RPC_ERROR_CODES.has(code as ApiErrorCode)) {
    return new ApiError(code as ApiErrorCode);
  }
  return new ApiError("SERVICE_UNAVAILABLE");
}

/** Maps raise exception P0001 messages from start_analysis. */
export function mapStartAnalysisException(error: {
  message?: string;
  code?: string;
}): ApiError {
  const message = (error.message ?? "").trim();
  // PostgREST may prefix: 'UNAUTHENTICATED' or longer text containing it.
  for (const code of P0001_MESSAGES) {
    if (message === code || message.includes(code)) {
      return new ApiError(code);
    }
  }
  return new ApiError("SERVICE_UNAVAILABLE");
}

export function parseStartAnalysisRpc(
  data: unknown,
  error: { message?: string; code?: string } | null,
): StartAnalysisRpcSuccess {
  if (error) {
    throw mapStartAnalysisException(error);
  }
  if (!data || typeof data !== "object") {
    throw new ApiError("SERVICE_UNAVAILABLE");
  }
  const row = data as Record<string, unknown>;
  if (typeof row.error_code === "string") {
    throw mapStartAnalysisErrorCode(row.error_code);
  }
  if (
    typeof row.created !== "boolean" ||
    typeof row.analysis_id !== "string" ||
    typeof row.status !== "string"
  ) {
    throw new ApiError("SERVICE_UNAVAILABLE");
  }
  if (
    row.status !== "processing" &&
    row.status !== "succeeded" &&
    row.status !== "failed"
  ) {
    throw new ApiError("SERVICE_UNAVAILABLE");
  }
  return {
    created: row.created,
    analysis_id: row.analysis_id,
    status: row.status,
  };
}

/** Failure codes allowed on analyses.failure_code (no provider internals). */
export const ANALYSIS_FAILURE_CODES = new Set<ApiErrorCode>([
  "REPLAY_UNAVAILABLE",
  "AI_UNAVAILABLE",
  "INVALID_AI_OUTPUT",
  "TIMEOUT",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
  "NOT_ENOUGH_RECORDS",
]);

export function readErrorCode(error: unknown): string | null {
  if (error instanceof ApiError) return error.code;
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

export function toStoredFailureCode(error: unknown): ApiErrorCode {
  const code = readErrorCode(error);
  if (code && ANALYSIS_FAILURE_CODES.has(code as ApiErrorCode)) {
    return code as ApiErrorCode;
  }
  return "SERVICE_UNAVAILABLE";
}
