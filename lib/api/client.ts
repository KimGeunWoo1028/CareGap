"use client";

export type ApiSuccess<T> = {
  ok: true;
  status: number;
  data: T;
  requestId: string | null;
};

export type ApiFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  details: Record<string, unknown>;
  requestId: string | null;
  networkError?: boolean;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

type RequestOptions = {
  method?: "GET" | "POST";
  token: string | null;
  body?: unknown;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions,
): Promise<ApiResult<T>> {
  if (!options.token) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHENTICATED",
      message: "세션이 만료되었습니다. 다시 로그인해 주세요.",
      details: {},
      requestId: null,
    };
  }

  try {
    const response = await fetch(path, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Cache-Control": "no-store",
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.headers ?? {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          data?: T;
          meta?: { request_id?: string };
          error?: {
            code?: string;
            message?: string;
            request_id?: string;
            details?: Record<string, unknown>;
          };
        }
      | null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        code: payload?.error?.code ?? "SERVICE_UNAVAILABLE",
        message:
          payload?.error?.message ??
          "서비스 연결을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        details: payload?.error?.details ?? {},
        requestId: payload?.error?.request_id ?? null,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: payload?.data as T,
      requestId: payload?.meta?.request_id ?? null,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      code: "NETWORK_ERROR",
      message: "네트워크 연결을 확인할 수 없습니다. 다시 시도해 주세요.",
      details: {},
      requestId: null,
      networkError: true,
    };
  }
}

export function userMessageForApiError(failure: ApiFailure): string {
  switch (failure.code) {
    case "UNAUTHENTICATED":
      return "세션이 만료되었습니다. 다시 로그인해 주세요.";
    case "DUPLICATE_ALIAS":
      return "같은 별칭이 있습니다.";
    case "DUPLICATE_DATE":
      return "같은 날짜의 상담 기록이 이미 있습니다.";
    case "NOT_FOUND":
      return "요청한 자료를 찾을 수 없거나 접근할 수 없습니다.";
    case "VALIDATION_ERROR":
      return failure.message || "입력값을 확인해 주세요.";
    case "NOT_ENOUGH_RECORDS":
      return "다른 날짜의 상담 기록이 두 건 필요합니다.";
    case "REPLAY_UNAVAILABLE":
      return "이 시연 모드는 준비된 합성 사례에서만 사용할 수 있습니다.";
    case "ANALYSIS_IN_PROGRESS":
      return "분석이 진행 중입니다. 잠시 후 상태를 확인해 주세요.";
    case "ANALYSIS_FAILED":
      return "이전 분석이 실패로 끝났습니다. 새 분석으로 다시 시도해 주세요.";
    case "IDEMPOTENCY_CONFLICT":
      return "같은 요청 키로 다른 분석이 이미 있습니다. 새 분석을 시작해 주세요.";
    case "REVIEW_EXISTS":
      return "이미 검토가 저장된 분석입니다.";
    case "RATE_LIMITED":
      return "분석 요청이 많습니다. 잠시 후 다시 시도해 주세요.";
    case "INVALID_AI_OUTPUT":
      return "결과의 근거를 확인하지 못해 분석을 저장하지 않았습니다.";
    case "AI_UNAVAILABLE":
    case "TIMEOUT":
      return "분석을 완료하지 못했습니다. 원문은 그대로 보관됩니다.";
    case "SERVICE_UNAVAILABLE":
      return "서비스 연결을 확인할 수 없습니다.";
    case "NETWORK_ERROR":
      return failure.message;
    default:
      return failure.message || "일시적인 오류가 발생했습니다.";
  }
}
