import { z } from "zod";
import {
  ANALYSIS_DOMAINS,
  CHANGE_STATUSES,
} from "@/lib/analysis/types";
import {
  EVAL_SCENARIOS,
  EVAL_SPLITS,
  REVIEW_STATUSES,
} from "@/lib/eval/types";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export const expectedStatusSchema = z.object({
  meal: z.enum(CHANGE_STATUSES),
  mobility: z.enum(CHANGE_STATUSES),
  health: z.enum(CHANGE_STATUSES),
  environment: z.enum(CHANGE_STATUSES),
});

export const evalCaseSchema = z.object({
  id: z.string().min(1).max(64),
  legacy_id: z.string().min(1).max(64).optional(),
  split: z.enum(EVAL_SPLITS),
  family_id: z.string().min(1).max(64),
  scenarios: z.array(z.enum(EVAL_SCENARIOS)).min(1),
  description: z.string().min(1).max(300),
  previous: z.object({
    occurred_on: z.string().regex(dateRe),
    body: z.string().min(1).max(2000),
  }),
  current: z.object({
    occurred_on: z.string().regex(dateRe),
    body: z.string().min(1).max(2000),
  }),
  expected_status: expectedStatusSchema,
  label_rationale: z.string().min(1).max(1000),
  expected_quotes: z
    .array(
      z.object({
        domain: z.enum(ANALYSIS_DOMAINS),
        side: z.enum(["previous", "current"]),
        quote: z.string().min(1).max(200),
      }),
    )
    .optional(),
  review_status: z.enum(REVIEW_STATUSES),
  author: z.string().min(1).max(120),
  synthetic_source: z.string().min(1).max(120),
  creation_method: z.string().min(1).max(120),
});

export const evalDatasetSchema = z.object({
  dataset_version: z.string().min(1),
  schema_version: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  language: z.literal("ko"),
  synthetic_only: z.literal(true),
  expert_reviewed: z.literal(false),
  split_policy: z.string().min(1),
  cases: z.array(evalCaseSchema).min(1),
});

export const predictionCaseSchema = z.object({
  case_id: z.string().min(1),
  predicted_status: expectedStatusSchema,
  evidence: z
    .array(
      z.object({
        domain: z.enum(ANALYSIS_DOMAINS),
        side: z.enum(["previous", "current"]),
        note_id: z.string().optional(),
        quote: z.string().min(1).max(200),
      }),
    )
    .optional(),
});

export const predictionFileSchema = z.object({
  prediction_source: z.enum([
    "fixture",
    "replay",
    "live",
    "manual",
    "synthetic_stub",
  ]),
  model_id: z.string().nullable(),
  prompt_version: z.string().nullable(),
  schema_version: z.string().min(1),
  dataset_version: z.string().min(1),
  predictions: z.array(predictionCaseSchema),
});
