import { z } from "zod";
import { ANALYSIS_DOMAINS, CHANGE_STATUSES } from "@/lib/analysis/types";

const evidenceSchema = z
  .object({
    note_id: z.string(),
    quote: z.string(),
  })
  .strict();

const domainChangeSchema = z
  .object({
    domain: z.enum(ANALYSIS_DOMAINS),
    status: z.enum(CHANGE_STATUSES),
    explanation: z.string(),
    evidence_previous: evidenceSchema.nullable(),
    evidence_current: evidenceSchema.nullable(),
  })
  .strict();

/** Structural Zod shape aligned with schemas/analysis.schema.json (length rules applied later). */
export const analysisOutputSchema = z
  .object({
    schema_version: z.literal("1.0"),
    summary: z.string(),
    changes: z.array(domainChangeSchema),
    questions: z.array(z.string()),
  })
  .strict();

export type AnalysisOutputShape = z.infer<typeof analysisOutputSchema>;
