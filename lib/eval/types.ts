import type { AnalysisDomain, ChangeStatus } from "@/lib/analysis/types";

export const EVAL_SPLITS = ["dev", "val", "test"] as const;
export type EvalSplit = (typeof EVAL_SPLITS)[number];

export const REVIEW_STATUSES = [
  "draft",
  "internally_reviewed",
  "expert_reviewed",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const EVAL_SCENARIOS = [
  "clear_worsening",
  "clear_improvement",
  "stable_ok",
  "ongoing_difficulty_unchanged",
  "previous_only",
  "current_only",
  "both_insufficient",
  "conflicting",
  "negation",
  "temporal_ambiguity",
  "hearsay_or_speculation",
  "prompt_injection",
  "multi_domain",
  "paraphrase_same_meaning",
  "style_length_difference",
  "ambiguous_causality",
] as const;
export type EvalScenario = (typeof EVAL_SCENARIOS)[number];

export type ExpectedStatusMap = Record<AnalysisDomain, ChangeStatus>;

export type ExpectedQuoteHint = {
  domain: AnalysisDomain;
  side: "previous" | "current";
  quote: string;
};

export type EvalCase = {
  id: string;
  legacy_id?: string;
  split: EvalSplit;
  /** Near-duplicate / paraphrase family — keep same split. */
  family_id: string;
  scenarios: EvalScenario[];
  description: string;
  previous: { occurred_on: string; body: string };
  current: { occurred_on: string; body: string };
  expected_status: ExpectedStatusMap;
  label_rationale: string;
  expected_quotes?: ExpectedQuoteHint[];
  review_status: ReviewStatus;
  author: string;
  synthetic_source: string;
  creation_method: string;
};

export type EvalDataset = {
  dataset_version: string;
  schema_version: string;
  title: string;
  description: string;
  language: "ko";
  synthetic_only: true;
  expert_reviewed: false;
  split_policy: string;
  cases: EvalCase[];
};

export type PredictionCase = {
  case_id: string;
  predicted_status: ExpectedStatusMap;
  evidence?: Array<{
    domain: AnalysisDomain;
    side: "previous" | "current";
    note_id?: string;
    quote: string;
  }>;
};

export type PredictionFile = {
  prediction_source: "fixture" | "replay" | "live" | "manual" | "synthetic_stub";
  model_id: string | null;
  prompt_version: string | null;
  schema_version: string;
  dataset_version: string;
  predictions: PredictionCase[];
};

export type MetricValue = number | "N/A";

export type EvalReport = {
  dataset_version: string;
  evaluation_version: string;
  model_id: string | null;
  prompt_version: string | null;
  schema_version: string;
  executed_at: string;
  prediction_source: PredictionFile["prediction_source"];
  total_cases: number;
  evaluated_cases: number;
  missing_predictions: string[];
  duplicate_predictions: string[];
  extra_predictions: string[];
  metrics: Record<string, MetricValue | Record<string, unknown>>;
  metric_definitions: Record<string, string>;
  error_cases: Array<{
    case_id: string;
    kind: string;
    detail: string;
  }>;
  notes: string[];
};
