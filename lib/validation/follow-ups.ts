import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import {
  FOLLOW_UP_KINDS,
  FOLLOW_UP_STATUSES,
} from "@/lib/follow-ups/types";

const noteSchema = z.string().max(500);

export function parseCreateFollowUpBody(raw: unknown) {
  const schema = z
    .object({
      case_id: z.string().uuid(),
      analysis_id: z.string().uuid().nullable().optional(),
      kind: z.enum(FOLLOW_UP_KINDS),
      note: noteSchema.default(""),
      due_on: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
    })
    .strict();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("VALIDATION_ERROR", undefined, {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

export function parseUpdateFollowUpBody(raw: unknown) {
  const schema = z
    .object({
      status: z.enum(["done", "cancelled"]),
    })
    .strict();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("VALIDATION_ERROR", undefined, {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

export function parseFollowUpListQuery(url: URL): {
  status?: (typeof FOLLOW_UP_STATUSES)[number];
} {
  const status = url.searchParams.get("status");
  if (!status) return {};
  if (!(FOLLOW_UP_STATUSES as readonly string[]).includes(status)) {
    throw new ApiError("VALIDATION_ERROR", undefined, {
      field: "status",
      reason: "invalid",
    });
  }
  return { status: status as (typeof FOLLOW_UP_STATUSES)[number] };
}
