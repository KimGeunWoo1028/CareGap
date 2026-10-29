import { analysisStatusLabel } from "@/lib/format";
import { reviewDecisionLabel } from "@/lib/cases/analysis-labels";
import type {
  AnalysisDetail,
  AnalysisSummary,
  CaseDetail,
  ConsultationRecord,
} from "@/lib/cases/types";

export type CaseOverviewSnapshot = {
  alias: string;
  consultationCount: number;
  latestConsultationOn: string | null;
  latestAnalysisStatus: AnalysisSummary["status"] | null;
  latestAnalysisStatusLabel: string;
  reviewStatusLabel: string;
  compareReady: boolean;
};

function latestConsultation(
  consultations: ConsultationRecord[],
): ConsultationRecord | null {
  return consultations[0] ?? null;
}

function latestAnalysis(
  analyses: AnalysisSummary[],
): AnalysisSummary | null {
  return analyses[0] ?? null;
}

export function buildCaseOverview(
  detail: CaseDetail,
  selected: AnalysisDetail | null,
  compareReady: boolean,
): CaseOverviewSnapshot {
  const latestNote = latestConsultation(detail.consultations);
  const latest = latestAnalysis(detail.analyses);
  const review =
    selected?.review ??
    (selected?.status === "succeeded" ? selected.review : null);

  let reviewStatusLabel = "검토 없음";
  if (selected?.status === "processing") {
    reviewStatusLabel = "분석 처리 중";
  } else if (selected?.status === "failed") {
    reviewStatusLabel = "분석 실패 · 검토 불가";
  } else if (review) {
    reviewStatusLabel = reviewDecisionLabel(review.decision);
  } else if (selected?.status === "succeeded") {
    reviewStatusLabel = "검토 대기";
  } else if (latest?.status === "succeeded") {
    reviewStatusLabel = "이력에 성공 분석 있음";
  }

  return {
    alias: detail.case.alias,
    consultationCount: detail.consultations.length,
    latestConsultationOn: latestNote?.occurred_on ?? null,
    latestAnalysisStatus: latest?.status ?? null,
    latestAnalysisStatusLabel: latest
      ? analysisStatusLabel(latest.status)
      : "분석 없음",
    reviewStatusLabel,
    compareReady,
  };
}
