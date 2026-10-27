import { randomUUID } from "node:crypto";
import { ApiError, isApiError, type ApiErrorCode } from "@/lib/api/errors";

const NO_STORE = "no-store";

export function createRequestId(): string {
  return randomUUID();
}

function baseHeaders(requestId: string): HeadersInit {
  return {
    "Cache-Control": NO_STORE,
    "Content-Type": "application/json; charset=utf-8",
    "X-Request-Id": requestId,
  };
}

export function jsonOk<T>(
  data: T,
  init?: { status?: number; requestId?: string },
): Response {
  const requestId = init?.requestId ?? createRequestId();
  return Response.json(
    { data, meta: { request_id: requestId } },
    { status: init?.status ?? 200, headers: baseHeaders(requestId) },
  );
}

export function jsonCreated<T>(data: T, requestId?: string): Response {
  return jsonOk(data, { status: 201, requestId });
}

export function jsonAccepted<T>(data: T, requestId?: string): Response {
  return jsonOk(data, { status: 202, requestId });
}

export function jsonError(
  code: ApiErrorCode,
  options?: {
    message?: string;
    details?: Record<string, unknown>;
    requestId?: string;
    headers?: HeadersInit;
  },
): Response {
  const error = new ApiError(code, options?.message, options?.details ?? {});
  const requestId = options?.requestId ?? createRequestId();
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        request_id: requestId,
        details: error.details,
      },
    },
    {
      status: error.status,
      headers: {
        ...baseHeaders(requestId),
        ...(options?.headers ?? {}),
      },
    },
  );
}

export function jsonFromUnknownError(
  error: unknown,
  requestId?: string,
): Response {
  if (isApiError(error)) {
    return jsonError(error.code, {
      message: error.message,
      details: error.details,
      requestId,
      headers:
        error.code === "RATE_LIMITED" ? { "Retry-After": "60" } : undefined,
    });
  }
  return jsonError("SERVICE_UNAVAILABLE", { requestId });
}
