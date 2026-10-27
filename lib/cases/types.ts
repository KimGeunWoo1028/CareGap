export type CaseRecord = {
  id: string;
  alias: string;
  created_at: string;
};

export type ConsultationRecord = {
  id: string;
  case_id: string;
  occurred_on: string;
  channel: "phone" | "visit" | "other";
  body: string;
  created_at: string;
};

export type AnalysisSummary = {
  id: string;
  case_id: string;
  status: "processing" | "succeeded" | "failed";
  mode: "live" | "replay";
  created_at: string;
  completed_at: string | null;
  is_current: boolean;
};

export type CaseDetail = {
  case: CaseRecord;
  consultations: ConsultationRecord[];
  analyses: AnalysisSummary[];
};

export type AnalysisDomain = "meal" | "mobility" | "health" | "environment";
export type ChangeStatus =
  | "worsened"
  | "improved"
  | "unchanged"
  | "unknown";

export type AnalysisEvidence = {
  note_id: string;
  quote: string;
};

export type DomainChange = {
  domain: AnalysisDomain;
  status: ChangeStatus;
  explanation: string;
  evidence_previous: AnalysisEvidence | null;
  evidence_current: AnalysisEvidence | null;
};

export type ValidatedAnalysisResult = {
  schema_version: "1.0";
  summary: string;
  changes: DomainChange[];
  questions: string[];
};

export type ProgramRecommendation = {
  program_id: string;
  name: string;
  matched_domains: AnalysisDomain[];
  summary: string;
  eligibility_status: "unverified";
  eligibility_checks: string[];
  region: string;
  source_url: string;
  source_checked_on: string;
  catalog_version: string;
};

export type AnalysisReviewRecord = {
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
  status: AnalysisSummary["status"];
  mode: AnalysisSummary["mode"];
  schema_version: "1.0";
  model: string | null;
  result: {
    analysis: ValidatedAnalysisResult;
    recommendations: ProgramRecommendation[];
  } | null;
  failure_code: string | null;
  created_at: string;
  completed_at: string | null;
  is_current: boolean;
  review: AnalysisReviewRecord | null;
};
