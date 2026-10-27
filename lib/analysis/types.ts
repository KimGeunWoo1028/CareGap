export const ANALYSIS_DOMAINS = [
  "meal",
  "mobility",
  "health",
  "environment",
] as const;

export const CHANGE_STATUSES = [
  "worsened",
  "improved",
  "unchanged",
  "unknown",
] as const;

export type AnalysisDomain = (typeof ANALYSIS_DOMAINS)[number];
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

export type AnalysisNote = {
  note_id: string;
  occurred_on: string;
  body: string;
};

export type Evidence = {
  note_id: string;
  quote: string;
};

export type DomainChange = {
  domain: AnalysisDomain;
  status: ChangeStatus;
  explanation: string;
  evidence_previous: Evidence | null;
  evidence_current: Evidence | null;
};

export type ValidatedAnalysis = {
  schema_version: "1.0";
  summary: string;
  changes: DomainChange[];
  questions: string[];
};

export type WelfareProgram = {
  id: string;
  name: string;
  tags: string[];
  summary: string;
  eligibility_checks: string[];
  region: string;
  source_url: string;
  source_checked_on: string;
  catalog_version: string;
  active: boolean;
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

export type AnalysisEngineResult = {
  mode: "live" | "replay";
  model: string | null;
  analysis: ValidatedAnalysis;
  recommendations: ProgramRecommendation[];
  recommendations_message: string;
};
