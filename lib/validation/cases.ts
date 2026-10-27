import { z } from "zod";
import { ApiError } from "@/lib/api/errors";

export const CASE_ALIAS_PATTERN = /^합성-[0-9]{3}$/;

export const createCaseBodySchema = z
  .object({
    alias: z
      .string()
      .regex(CASE_ALIAS_PATTERN, "별칭은 합성-000 형식이어야 합니다."),
  })
  .strict();

export type CreateCaseBody = z.infer<typeof createCaseBodySchema>;

export function parseCreateCaseBody(input: unknown): CreateCaseBody {
  const result = createCaseBodySchema.safeParse(input);
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
