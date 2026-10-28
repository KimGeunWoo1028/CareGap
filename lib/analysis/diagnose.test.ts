import { describe, expect, it } from "vitest";
import replayFixture from "@/fixtures/replay-analysis.json";
import { diagnoseAnalysisOutput } from "@/lib/analysis/diagnose";
import type { AnalysisNote } from "@/lib/analysis/types";

const previous: AnalysisNote = {
  note_id: "11111111-1111-4111-8111-111111111111",
  occurred_on: "2026-09-10",
  body: "혼자 식사도 잘하시고 가까운 가게까지 걸어가 장을 볼 수 있음.",
};
const current: AnalysisNote = {
  note_id: "22222222-2222-4222-8222-222222222222",
  occurred_on: "2026-10-10",
  body: "최근 다리가 불편해 장을 보기 어렵고 식사를 자주 거르심.",
};

describe("diagnoseAnalysisOutput", () => {
  it("returns ok for valid replay fixture", () => {
    expect(
      diagnoseAnalysisOutput(structuredClone(replayFixture), previous, current),
    ).toEqual({ ok: true });
  });

  it("codes note_id_mismatch", () => {
    const bad = structuredClone(replayFixture);
    bad.changes[0].evidence_previous.note_id = "wrong-id";
    const d = diagnoseAnalysisOutput(bad, previous, current);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("note_id_mismatch");
  });

  it("codes exact_quote when paraphrase not in body", () => {
    const bad = structuredClone(replayFixture);
    bad.changes[0].evidence_current.quote = "식사를 자주 거르심!";
    const d = diagnoseAnalysisOutput(bad, previous, current);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("exact_quote");
  });

  it("codes exact_quote for whitespace-altered quote", () => {
    const bad = structuredClone(replayFixture);
    bad.changes[0].evidence_previous.quote = "혼자 식사도  잘하시고";
    const d = diagnoseAnalysisOutput(bad, previous, current);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("exact_quote");
  });

  it("codes schema for invalid enum-like status", () => {
    const bad = structuredClone(replayFixture) as Record<string, unknown>;
    (bad.changes as Array<Record<string, unknown>>)[0].status = "stable";
    const d = diagnoseAnalysisOutput(bad, previous, current);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(["schema", "invalid_enum", "missing_field"]).toContain(d.code);
  });

  it("codes both_evidence_required", () => {
    const bad = structuredClone(replayFixture);
    bad.changes[0].evidence_previous = null;
    const d = diagnoseAnalysisOutput(bad, previous, current);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("both_evidence_required");
  });
});
