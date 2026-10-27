import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { codePointLength } from "@/lib/validation/consultations";
import { findSuspiciousIdentity } from "@/lib/validation/suspicious-pii";

const DECISIONS = ["confirmed", "needs_followup", "rejected"] as const;

export const createReviewBodySchema = z
  .object({
    decision: z.enum(DECISIONS),
    note: z.string(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const length = codePointLength(value.note);
    if (length > 500) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "검토 메모는 최대 500자(유니코드 코드포인트)입니다.",
      });
    }

    if (value.decision === "rejected" && value.note.trim().length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "반려 사유를 입력해 주세요.",
      });
    }

    const suspicious = findSuspiciousIdentity(value.note);
    if (suspicious) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "직접 식별정보로 의심되는 내용은 입력할 수 없습니다.",
      });
    }
  });

export type CreateReviewBody = z.infer<typeof createReviewBodySchema>;

export function parseCreateReviewBody(input: unknown): CreateReviewBody {
  const result = createReviewBodySchema.safeParse(input);
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
