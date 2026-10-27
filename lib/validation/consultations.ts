import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { findSuspiciousIdentity } from "@/lib/validation/suspicious-pii";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CHANNELS = ["phone", "visit", "other"] as const;

export function codePointLength(value: string): number {
  return Array.from(value).length;
}

export function seoulTodayIsoDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isValidCalendarIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export const createConsultationBodySchema = z
  .object({
    occurred_on: z.string(),
    channel: z.enum(CHANNELS),
    body: z.string(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!isValidCalendarIsoDate(value.occurred_on)) {
      ctx.addIssue({
        code: "custom",
        path: ["occurred_on"],
        message: "유효한 날짜(YYYY-MM-DD)가 필요합니다.",
      });
      return;
    }

    const today = seoulTodayIsoDate();
    if (value.occurred_on > today) {
      ctx.addIssue({
        code: "custom",
        path: ["occurred_on"],
        message: "서울 기준 미래 날짜는 사용할 수 없습니다.",
      });
    }

    const length = codePointLength(value.body);
    if (length < 1 || length > 2000) {
      ctx.addIssue({
        code: "custom",
        path: ["body"],
        message: "원문은 1~2,000자(유니코드 코드포인트)여야 합니다.",
      });
    }

    if (value.body.trim().length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["body"],
        message: "공백만 있는 원문은 저장할 수 없습니다.",
      });
    }

    const suspicious = findSuspiciousIdentity(value.body);
    if (suspicious) {
      ctx.addIssue({
        code: "custom",
        path: ["body"],
        message: "직접 식별정보로 의심되는 내용은 입력할 수 없습니다.",
      });
    }
  });

export type CreateConsultationBody = z.infer<
  typeof createConsultationBodySchema
>;

export function parseCreateConsultationBody(
  input: unknown,
): CreateConsultationBody {
  const result = createConsultationBodySchema.safeParse(input);
  if (!result.success) {
    throw new ApiError("VALIDATION_ERROR", "입력값을 확인해 주세요.", {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return result.data;
}
