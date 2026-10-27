import type {
  AnalysisDomain,
  AnalysisReviewRecord,
  ChangeStatus,
} from "@/lib/cases/types";

export const DOMAIN_ORDER: AnalysisDomain[] = [
  "meal",
  "mobility",
  "health",
  "environment",
];

export function domainLabel(domain: AnalysisDomain): string {
  switch (domain) {
    case "meal":
      return "식사";
    case "mobility":
      return "거동";
    case "health":
      return "건강";
    case "environment":
      return "생활환경";
  }
}

export function changeStatusLabel(status: ChangeStatus): string {
  switch (status) {
    case "worsened":
      return "악화 기록";
    case "improved":
      return "개선 기록";
    case "unchanged":
      return "변화 없음";
    case "unknown":
      return "정보 부족";
  }
}

export function analysisModeBanner(mode: "live" | "replay"): string {
  return mode === "live"
    ? "실시간 AI 분석"
    : "사전 준비된 시연 결과 · AI 실시간 분석 아님";
}

export function reviewDecisionLabel(
  decision: AnalysisReviewRecord["decision"],
): string {
  switch (decision) {
    case "confirmed":
      return "확인함";
    case "needs_followup":
      return "추가 확인 필요";
    case "rejected":
      return "결과 부적절";
  }
}

export function matchedDomainsLabel(domains: AnalysisDomain[]): string {
  return domains.map(domainLabel).join("·");
}

export const EMPTY_RECOMMENDATIONS_COPY =
  "확인할 사업 후보가 없습니다. 원문을 검토해 주세요.";

export const POLL_INTERVAL_MS = 3000;
