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
