import { describe, expect, it } from "vitest";
import {
  analysisCurrencyLabel,
  analysisListCaption,
  analysisModeLabel,
  compareGuidance,
  consultationErrorField,
  consultationListCaption,
  pickLatestComparePair,
} from "@/lib/cases/detail-view";
import type { AnalysisSummary, ConsultationRecord } from "@/lib/cases/types";

function note(
  id: string,
  occurred_on: string,
  body = "합성 원문",
): ConsultationRecord {
  return {
    id,
    case_id: "case-1",
    occurred_on,
    channel: "phone",
    body,
    created_at: `${occurred_on}T01:00:00.000Z`,
  };
}

describe("detail-view helpers", () => {
  it("guides 0 and 1 record cases differently from ready pairs", () => {
    expect(compareGuidance([]).ready).toBe(false);
    expect(compareGuidance([]).detail).toContain("2건");
    expect(compareGuidance([note("a", "2026-10-01")]).count).toBe(1);
    expect(compareGuidance([note("a", "2026-10-01")]).nextAction).toContain(
      "다른 상담 날짜",
    );

    const two = [note("b", "2026-10-10"), note("a", "2026-09-10")];
    expect(compareGuidance(two).ready).toBe(true);
    const pair = pickLatestComparePair(two);
    expect(pair?.current.id).toBe("b");
    expect(pair?.previous.id).toBe("a");
  });

  it("does not treat the 50-item query cap as a total count", () => {
    expect(consultationListCaption(3)).toContain("표시 중 3건");
    expect(consultationListCaption(3)).toContain("최대 50건 조회");
    expect(analysisListCaption(0)).toContain("표시 중 0건");
    expect(analysisListCaption(0)).toContain("초과분은 보이지 않을 수 있음");
  });

  it("keeps stale analyses from reading as current", () => {
    const stale: AnalysisSummary = {
      id: "an-1",
      case_id: "case-1",
      status: "succeeded",
      mode: "replay",
      created_at: "2026-10-01T00:00:00.000Z",
      completed_at: "2026-10-01T00:01:00.000Z",
      is_current: false,
    };
    expect(analysisCurrencyLabel(stale)).toContain("이전 분석");
    expect(analysisModeLabel("replay")).toContain("실시간 아님");
    expect(analysisModeLabel("live")).toContain("실시간");
  });

  it("maps consultation errors to nearby fields", () => {
    expect(consultationErrorField("DUPLICATE_DATE", "")).toBe("occurred_on");
    expect(
      consultationErrorField("VALIDATION_ERROR", "원문 길이를 확인해 주세요."),
    ).toBe("body");
    expect(consultationErrorField("SERVICE_UNAVAILABLE", "서비스")).toBe(
      "form",
    );
  });

  it("preserves leading and trailing whitespace in compare bodies", () => {
    const pair = pickLatestComparePair([
      note("c", "2026-10-10", "  앞공백\n줄바꿈  "),
      note("p", "2026-09-10", "이전"),
    ]);
    expect(pair?.current.body).toBe("  앞공백\n줄바꿈  ");
  });
});
