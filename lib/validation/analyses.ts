import { z } from "zod";
import { ApiError } from "@/lib/api/errors";

/** Practical UUID shape used across CareGap path/header params. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuidParam(
  value: string | undefined,
  asNotFound = true,
): string {
  if (!value || !UUID_RE.test(value)) {
    throw new ApiError(asNotFound ? "NOT_FOUND" : "VALIDATION_ERROR");
  }
  return value;
}

export function parseIdempotencyKey(header: string | null): string {
  if (!header || !UUID_RE.test(header.trim())) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Idempotency-Key는 UUID여야 합니다.",
    );
  }
  return header.trim();
}

const emptyBodySchema = z.object({}).strict();

export function parseEmptyAnalysisBody(input: unknown): Record<string, never> {
  const result = emptyBodySchema.safeParse(input);
  if (!result.success) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "분석 요청 본문은 빈 객체 {} 만 허용됩니다.",
    );
  }
  return result.data;
}
