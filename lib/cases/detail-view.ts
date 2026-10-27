import type { AnalysisSummary, ConsultationRecord } from "@/lib/cases/types";

export type CompareRole = "previous" | "current";

export type ComparePair = {
  previous: ConsultationRecord;
  current: ConsultationRecord;
};

/** API returns consultations newest-first; first two are the compare pair when ready. */
export function pickLatestComparePair(
  consultations: ConsultationRecord[],
): ComparePair | null {
  if (consultations.length < 2) return null;
  const [current, previous] = consultations;
  return { previous, current };
}

export type CompareGuidance = {
  ready: boolean;
  count: number;
  title: string;
  detail: string;
  nextAction: string;
};

export function compareGuidance(
  consultations: ConsultationRecord[],
): CompareGuidance {
  const count = consultations.length;
  if (count === 0) {
    return {
      ready: false,
      count,
      title: "비교할 기록이 없습니다",
      detail: "서로 다른 날짜의 상담 기록이 2건 필요합니다.",
      nextAction: "아래 합성 상담 기록 등록에서 첫 기록을 저장해 주세요.",
    };
  }
  if (count === 1) {
    return {
      ready: false,
      count,
      title: "비교할 기록이 한 건 더 필요합니다",
      detail: "서로 다른 날짜의 상담 기록이 2건 필요합니다.",
      nextAction:
        "이미 저장된 날짜와 다른 상담 날짜로 한 건을 더 등록해 주세요.",
    };
  }
  return {
    ready: true,
    count,
    title: "최신 두 상담 기록",
    detail:
      "날짜가 다른 최신 상담 기록 두 건을 비교 대상으로 사용합니다. 원문은 저장 후 수정·삭제할 수 없습니다.",
    nextAction: "",
  };
}

export function consultationListCaption(count: number): string {
  return `표시 중 ${count}건 · 최신 날짜 순 · 최대 50건 조회(초과분은 보이지 않을 수 있음) · 수정·삭제 없음`;
}

export function analysisListCaption(count: number): string {
  return `표시 중 ${count}건 · 최신 생성 순 · 최대 50건 조회(초과분은 보이지 않을 수 있음)`;
}

export function analysisCurrencyLabel(item: AnalysisSummary): string {
  if (item.is_current) return "최신 두 기록과 일치";
  return "새 상담 기록이 추가된 이전 분석";
}

export function analysisModeLabel(mode: AnalysisSummary["mode"]): string {
  return mode === "live"
    ? "live · 실시간 AI 분석"
    : "replay · 사전 준비 시연(실시간 아님)";
}

export type ConsultationFormField =
  | "occurred_on"
  | "channel"
  | "body"
  | "form";

export function consultationErrorField(
  code: string | undefined,
  message: string,
): ConsultationFormField {
  if (code === "DUPLICATE_DATE") return "occurred_on";
  if (code === "VALIDATION_ERROR") {
    if (/날짜|미래/.test(message)) return "occurred_on";
    if (/채널/.test(message)) return "channel";
    return "body";
  }
  if (/날짜|미래/.test(message)) return "occurred_on";
  if (/채널/.test(message)) return "channel";
  if (/원문|공백|코드포인트|식별|2,000|2000/.test(message)) return "body";
  return "form";
}
