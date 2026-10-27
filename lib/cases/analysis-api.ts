import { apiRequest, type ApiResult } from "@/lib/api/client";
import type {
  AnalysisDetail,
  AnalysisReviewRecord,
} from "@/lib/cases/types";

export async function createCaseAnalysis(
  caseId: string,
  token: string,
  idempotencyKey: string,
): Promise<ApiResult<AnalysisDetail>> {
  return apiRequest<AnalysisDetail>(`/api/cases/${caseId}/analyses`, {
    method: "POST",
    token,
    body: {},
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export async function fetchAnalysisDetail(
  analysisId: string,
  token: string,
): Promise<ApiResult<AnalysisDetail>> {
  return apiRequest<AnalysisDetail>(`/api/analyses/${analysisId}`, {
    method: "GET",
    token,
  });
}

export async function submitAnalysisReview(
  analysisId: string,
  token: string,
  decision: AnalysisReviewRecord["decision"],
  note: string,
): Promise<ApiResult<AnalysisReviewRecord>> {
  return apiRequest<AnalysisReviewRecord>(
    `/api/analyses/${analysisId}/reviews`,
    {
      method: "POST",
      token,
      body: { decision, note },
    },
  );
}
