import { describe, expect, it } from "vitest";
import evaluationCases from "@/fixtures/evaluation-cases.json";
import replayFixture from "@/fixtures/replay-analysis.json";
import {
  scoreStatusAgreement,
  summarizeStatusScores,
  type ExpectedStatusMap,
} from "@/lib/analysis/evaluate-status";
import type { ValidatedAnalysis } from "@/lib/analysis/types";

describe("scoreStatusAgreement", () => {
  it("scores exact agreement for replay fixture vs eval-01 expectations", () => {
    const eval01 = evaluationCases.find((c) => c.id === "eval-01");
    expect(eval01).toBeTruthy();
    const result = scoreStatusAgreement(
      "eval-01",
      eval01!.expected_status as ExpectedStatusMap,
      structuredClone(replayFixture) as ValidatedAnalysis,
    );
    expect(result.exact_match).toBe(true);
    expect(result.notes).toMatch(/semantic/i);
  });

  it("detects flipped meal status without claiming semantic validator failure", () => {
    const analysis = structuredClone(replayFixture) as ValidatedAnalysis;
    const meal = analysis.changes.find((c) => c.domain === "meal");
    expect(meal).toBeTruthy();
    meal!.status = "improved";
    const result = scoreStatusAgreement(
      "flipped",
      evaluationCases[0].expected_status as ExpectedStatusMap,
      analysis,
    );
    expect(result.exact_match).toBe(false);
    expect(
      result.domain_results.find((r) => r.domain === "meal")?.match,
    ).toBe(false);
  });

  it("summarizes domain accuracy across fixture expectations shape", () => {
    const results = evaluationCases.slice(0, 2).map((c) =>
      scoreStatusAgreement(
        c.id,
        c.expected_status as ExpectedStatusMap,
        structuredClone(replayFixture) as ValidatedAnalysis,
      ),
    );
    const summary = summarizeStatusScores(results);
    expect(summary.total).toBe(2);
    expect(summary.domain_accuracy.meal.total).toBe(2);
  });

  it("loads expanded evaluation fixture set (roadmap seed, not 100–200 yet)", () => {
    expect(evaluationCases.length).toBeGreaterThanOrEqual(12);
    for (const c of evaluationCases) {
      expect(c.expected_status).toMatchObject({
        meal: expect.any(String),
        mobility: expect.any(String),
        health: expect.any(String),
        environment: expect.any(String),
      });
    }
  });
});
