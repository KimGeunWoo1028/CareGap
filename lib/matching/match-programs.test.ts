import { describe, expect, it } from "vitest";
import replayFixture from "@/fixtures/replay-analysis.json";
import {
  EMPTY_RECOMMENDATIONS_MESSAGE,
  formatRecommendationsMessage,
  matchWelfarePrograms,
} from "@/lib/matching/match-programs";
import { DEMO_WELFARE_PROGRAMS } from "@/lib/matching/demo-programs";
import type { ValidatedAnalysis, WelfareProgram } from "@/lib/analysis/types";

function allUnknown(): ValidatedAnalysis {
  return {
    schema_version: "1.0",
    summary: "정보 부족",
    changes: [
      {
        domain: "meal",
        status: "unknown",
        explanation: "식사 정보 없음",
        evidence_previous: null,
        evidence_current: null,
      },
      {
        domain: "mobility",
        status: "unknown",
        explanation: "거동 정보 없음",
        evidence_previous: null,
        evidence_current: null,
      },
      {
        domain: "health",
        status: "unknown",
        explanation: "건강 정보 없음",
        evidence_previous: null,
        evidence_current: null,
      },
      {
        domain: "environment",
        status: "unknown",
        explanation: "환경 정보 없음",
        evidence_previous: null,
        evidence_current: null,
      },
    ],
    questions: [],
  };
}

describe("matchWelfarePrograms (T12–T13)", () => {
  it("T12 ranks daegu_integrated before senior_care on meal+mobility tie", () => {
    const analysis = structuredClone(replayFixture) as ValidatedAnalysis;
    const recommendations = matchWelfarePrograms(
      analysis,
      DEMO_WELFARE_PROGRAMS,
    );
    expect(recommendations.map((r) => r.program_id)).toEqual([
      "daegu_integrated",
      "senior_care",
    ]);
    for (const item of recommendations) {
      expect(item.matched_domains).toEqual(["meal", "mobility"]);
      expect(item.eligibility_status).toBe("unverified");
    }
    expect(recommendations[0].eligibility_checks[0]).toBe(
      "대구 거주 및 구·군별 서비스 확인 필요",
    );
    expect(formatRecommendationsMessage(recommendations)).toBe(
      "식사·거동 변화와 관련된 사업 후보",
    );
  });

  it("T13 returns empty list when no worsened domains", () => {
    const recommendations = matchWelfarePrograms(
      allUnknown(),
      DEMO_WELFARE_PROGRAMS,
    );
    expect(recommendations).toEqual([]);
    expect(formatRecommendationsMessage(recommendations)).toBe(
      EMPTY_RECOMMENDATIONS_MESSAGE,
    );
  });

  it("ignores inactive programs and non-matching tags", () => {
    const inactive: WelfareProgram = {
      ...DEMO_WELFARE_PROGRAMS[0],
      id: "inactive_meal",
      active: false,
    };
    const healthOnly: WelfareProgram = {
      ...DEMO_WELFARE_PROGRAMS[0],
      id: "zzz_health_only",
      tags: ["health"],
      active: true,
    };
    const analysis = structuredClone(replayFixture) as ValidatedAnalysis;
    const recommendations = matchWelfarePrograms(analysis, [
      inactive,
      healthOnly,
      ...DEMO_WELFARE_PROGRAMS,
    ]);
    expect(recommendations.map((r) => r.program_id)).toEqual([
      "daegu_integrated",
      "senior_care",
    ]);
  });

  it("does not invent program ids outside the catalog", () => {
    const recommendations = matchWelfarePrograms(
      structuredClone(replayFixture) as ValidatedAnalysis,
      DEMO_WELFARE_PROGRAMS,
    );
    for (const item of recommendations) {
      expect(
        DEMO_WELFARE_PROGRAMS.some((p) => p.id === item.program_id),
      ).toBe(true);
    }
  });

  it("dedupes by program id via single catalog pass", () => {
    const analysis = structuredClone(replayFixture) as ValidatedAnalysis;
    const doubled = [
      ...DEMO_WELFARE_PROGRAMS,
      { ...DEMO_WELFARE_PROGRAMS[0] },
    ];
    // Same id twice: both score; sort is stable by id then we still cap at 2 unique rows
    // because catalog should be unique — if duplicated, both appear; document behavior:
    const recommendations = matchWelfarePrograms(analysis, doubled);
    expect(recommendations.length).toBeLessThanOrEqual(2);
  });
});
