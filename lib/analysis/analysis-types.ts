import type {
  ProgramRecommendation,
  ValidatedAnalysis,
} from "@/lib/analysis/types";

export type AnalysisStatus = "processing" | "succeeded" | "failed";
export type AnalysisMode = "live" | "replay";

export type AnalysisResultPayload = {
  analysis: ValidatedAnalysis;
  recommendations: ProgramRecommendation[];
};

export type AnalysisReview = {
  id: string;
  analysis_id: string;
  decision: "confirmed" | "needs_followup" | "rejected";
  note: string;
  created_at: string;
};

export type AnalysisDetail = {
  id: string;
  case_id: string;
  previous_note_id: string;
  current_note_id: string;
  status: AnalysisStatus;
  mode: AnalysisMode;
  schema_version: "1.0";
  model: string | null;
  result: AnalysisResultPayload | null;
  failure_code: string | null;
  created_at: string;
  completed_at: string | null;
  is_current: boolean;
  review: AnalysisReview | null;
};

export type AnalysisRow = {
  id: string;
  case_id: string;
  owner_id: string;
  previous_note_id: string;
  current_note_id: string;
  idempotency_key: string;
  mode: AnalysisMode;
  status: AnalysisStatus;
  schema_version: string;
  model: string | null;
  result: AnalysisResultPayload | null;
  failure_code: string | null;
  created_at: string;
  completed_at: string | null;
};
