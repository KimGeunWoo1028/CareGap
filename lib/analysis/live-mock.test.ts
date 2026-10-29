import { describe, expect, it } from "vitest";
import {
  exactQuoteSnippet,
  runMockLiveAnalysis,
} from "@/lib/analysis/live-mock";
import { DEMO_WELFARE_PROGRAMS } from "@/lib/matching/demo-programs";

const previous = {
  note_id: "11111111-1111-4111-8111-111111111111",
  occurred_on: "2026-09-10",
  body: "혼자 식사도 잘하시고 가까운 가게까지 걸어가 장을 볼 수 있음.",
};

const current = {
  note_id: "22222222-2222-4222-8222-222222222222",
  occurred_on: "2026-10-10",
  body: "최근 다리가 불편해 장을 보기 어렵고 식사를 자주 거르심.",
};

describe("live-mock", () => {
  it("keeps quotes as exact substrings", () => {
    const snippet = exactQuoteSnippet(current.body, 10);
    expect(current.body.includes(snippet)).toBe(true);
  });

  it("returns validated live-shaped result without OpenAI", () => {
    const result = runMockLiveAnalysis({
      previous,
      current,
      programs: DEMO_WELFARE_PROGRAMS,
    });
    expect(result.mode).toBe("live");
    expect(result.model).toBe("caregap-live-mock");
    expect(result.analysis.changes).toHaveLength(4);
    const meal = result.analysis.changes.find((c) => c.domain === "meal");
    expect(meal?.status).toBe("worsened");
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
