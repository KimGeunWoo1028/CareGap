export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "DUPLICATE_ALIAS"
  | "DUPLICATE_DATE"
  | "REVIEW_EXISTS"
  | "IDEMPOTENCY_CONFLICT"
  | "ANALYSIS_IN_PROGRESS"
  | "ANALYSIS_FAILED"
  | "NOT_ENOUGH_RECORDS"
  | "REPLAY_UNAVAILABLE"
  | "RATE_LIMITED"
  | "AI_UNAVAILABLE"
  | "INVALID_AI_OUTPUT"
  | "TIMEOUT"
  | "SERVICE_UNAVAILABLE";

const USER_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: "입력값을 확인해 주세요.",
  UNAUTHENTICATED: "로그인이 필요합니다. 다시 로그인해 주세요.",
  NOT_FOUND: "요청한 자료를 찾을 수 없습니다.",
  DUPLICATE_ALIAS: "같은 별칭의 사례가 이미 있습니다.",
  DUPLICATE_DATE: "같은 날짜의 상담 기록이 이미 있습니다.",
  REVIEW_EXISTS: "이미 검토가 저장된 분석입니다.",
  IDEMPOTENCY_CONFLICT: "같은 멱등키로 다른 요청이 이미 있습니다.",
  ANALYSIS_IN_PROGRESS: "이 사례에서 다른 분석이 진행 중입니다.",
  ANALYSIS_FAILED: "이전 분석이 실패로 끝났습니다. 새 키로 다시 요청해 주세요.",
  NOT_ENOUGH_RECORDS: "서로 다른 날짜의 상담 기록이 2건 필요합니다.",
  REPLAY_UNAVAILABLE:
    "이 시연 모드는 준비된 합성 사례에서만 사용할 수 있습니다.",
  RATE_LIMITED: "요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
  AI_UNAVAILABLE: "분석 서비스에 연결할 수 없습니다.",
  INVALID_AI_OUTPUT: "분석 결과를 검증하지 못했습니다.",
  TIMEOUT: "분석 처리 시간이 초과되었습니다.",
  SERVICE_UNAVAILABLE: "일시적으로 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
};

const HTTP_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  DUPLICATE_ALIAS: 409,
  DUPLICATE_DATE: 409,
  REVIEW_EXISTS: 409,
  IDEMPOTENCY_CONFLICT: 409,
  ANALYSIS_IN_PROGRESS: 409,
  ANALYSIS_FAILED: 409,
  NOT_ENOUGH_RECORDS: 422,
  REPLAY_UNAVAILABLE: 422,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 502,
  INVALID_AI_OUTPUT: 502,
  TIMEOUT: 504,
  SERVICE_UNAVAILABLE: 503,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    message?: string,
    details: Record<string, unknown> = {},
  ) {
    super(message ?? USER_MESSAGES[code]);
    this.name = "ApiError";
    this.code = code;
    this.status = HTTP_STATUS[code];
    this.details = details;
  }
}

/** PostgreSQL unique_violation constraint names from sql/001_schema.sql */
const CONSTRAINT_CODE: Record<string, ApiErrorCode> = {
  cases_owner_id_alias_key: "DUPLICATE_ALIAS",
  consultations_case_id_occurred_on_key: "DUPLICATE_DATE",
  reviews_analysis_id_key: "REVIEW_EXISTS",
  analyses_one_processing: "ANALYSIS_IN_PROGRESS",
};

type DbLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  constraint?: string;
};

function extractConstraint(error: DbLikeError): string | undefined {
  if (error.constraint) return error.constraint;
  const haystack = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`;
  for (const name of Object.keys(CONSTRAINT_CODE)) {
    if (haystack.includes(name)) return name;
  }
  return undefined;
}

export function mapDatabaseError(error: unknown): ApiError {
  const dbError = (error ?? {}) as DbLikeError;
  const constraint = extractConstraint(dbError);

  if (dbError.code === "23505" && constraint && CONSTRAINT_CODE[constraint]) {
    return new ApiError(CONSTRAINT_CODE[constraint]);
  }

  // Never surface SQL or provider internals to clients.
  return new ApiError("SERVICE_UNAVAILABLE");
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
