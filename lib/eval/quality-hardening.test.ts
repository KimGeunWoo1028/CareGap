import { describe, expect, it } from "vitest";
import { ANALYSIS_SYSTEM_INSTRUCTION } from "@/lib/analysis/prompt";
import { diagnoseAnalysisOutput } from "@/lib/analysis/diagnose";
import { validateAnalysisOutput } from "@/lib/analysis/validate";
import type { AnalysisNote, ValidatedAnalysis } from "@/lib/analysis/types";
import { toNotes } from "@/lib/eval/live-smoke-runner";
import { computeSmokeOperationalMetrics } from "@/lib/eval/smoke-operational-metrics";
import { buildSemanticCitationReviewItems } from "@/lib/eval/semantic-citation-review";
import { syntheticNoteId } from "@/lib/eval/synthetic-note-ids";
import type { EvalCase } from "@/lib/eval/types";

function baseAnalysis(
  overrides: Partial<ValidatedAnalysis> & {
    changes: ValidatedAnalysis["changes"];
  },
): ValidatedAnalysis {
  return {
    schema_version: "1.0",
    summary: "테스트 요약입니다.",
    questions: [],
    ...overrides,
  };
}

function domain(
  domain: ValidatedAnalysis["changes"][number]["domain"],
  status: ValidatedAnalysis["changes"][number]["status"],
  prev: { note_id: string; quote: string } | null,
  curr: { note_id: string; quote: string } | null,
): ValidatedAnalysis["changes"][number] {
  return {
    domain,
    status,
    explanation: "설명 텍스트입니다.",
    evidence_previous: prev,
    evidence_current: curr,
  };
}

describe("quality hardening regressions (no Live network)", () => {
  it("prompt encodes unknown vs unchanged and verbatim note_id rules", () => {
    expect(ANALYSIS_SYSTEM_INSTRUCTION).toMatch(/unchanged/);
    expect(ANALYSIS_SYSTEM_INSTRUCTION).toMatch(/unknown/);
    expect(ANALYSIS_SYSTEM_INSTRUCTION).toMatch(/note_id/);
    expect(ANALYSIS_SYSTEM_INSTRUCTION).toMatch(/추측하지 말/);
    expect(ANALYSIS_SYSTEM_INSTRUCTION).not.toMatch(/eval-v1-004/);
  });

  it("uses UUID-shaped synthetic note ids (not caseId-previous labels)", () => {
    const id = syntheticNoteId("eval-v1-001", "previous");
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(id).not.toContain("eval-v1-001");
    const notes = toNotes({
      id: "eval-v1-001",
      previous: { occurred_on: "2026-09-10", body: "a" },
      current: { occurred_on: "2026-10-10", body: "b" },
    } as EvalCase);
    expect(notes.previous.note_id).toBe(syntheticNoteId("eval-v1-001", "previous"));
  });

  it("accepts clear multi-domain worsening with exact quotes", () => {
    const previous: AnalysisNote = {
      note_id: syntheticNoteId("c-worsen", "previous"),
      occurred_on: "2026-09-01",
      body: "혼자 식사도 잘하시고 가까운 가게까지 걸어가 장을 볼 수 있음.",
    };
    const current: AnalysisNote = {
      note_id: syntheticNoteId("c-worsen", "current"),
      occurred_on: "2026-10-01",
      body: "최근 다리가 불편해 장을 보기 어렵고 식사를 자주 거르심.",
    };
    const raw = baseAnalysis({
      changes: [
        domain(
          "meal",
          "worsened",
          { note_id: previous.note_id, quote: "혼자 식사도 잘하시고" },
          { note_id: current.note_id, quote: "식사를 자주 거르심." },
        ),
        domain(
          "mobility",
          "worsened",
          {
            note_id: previous.note_id,
            quote: "가까운 가게까지 걸어가 장을 볼 수 있음.",
          },
          { note_id: current.note_id, quote: "다리가 불편해 장을 보기 어렵고" },
        ),
        domain("health", "unknown", null, null),
        domain("environment", "unknown", null, null),
      ],
    });
    expect(validateAnalysisOutput(raw, previous, current).changes).toHaveLength(4);
  });

  it("accepts clear improvement and stable unchanged with dual evidence", () => {
    const previous: AnalysisNote = {
      note_id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      occurred_on: "2026-09-01",
      body: "거동이 어려워 외출이 힘들었고 식사는 하루 세 끼 잘 드심.",
    };
    const current: AnalysisNote = {
      note_id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
      occurred_on: "2026-10-01",
      body: "거동이 나아져 가까운 가게에 다녀오시고 식사는 하루 세 끼 잘 드심.",
    };
    const raw = baseAnalysis({
      changes: [
        domain(
          "meal",
          "unchanged",
          { note_id: previous.note_id, quote: "식사는 하루 세 끼 잘 드심." },
          { note_id: current.note_id, quote: "식사는 하루 세 끼 잘 드심." },
        ),
        domain(
          "mobility",
          "improved",
          { note_id: previous.note_id, quote: "거동이 어려워 외출이 힘들었고" },
          {
            note_id: current.note_id,
            quote: "거동이 나아져 가까운 가게에 다녀오시고",
          },
        ),
        domain("health", "unknown", null, null),
        domain("environment", "unknown", null, null),
      ],
    });
    expect(validateAnalysisOutput(raw, previous, current)).toBeTruthy();
  });

  it("allows all-unknown for both-insufficient style notes", () => {
    const previous: AnalysisNote = {
      note_id: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
      occurred_on: "2026-09-05",
      body: "날씨 이야기를 나누고 전화를 종료함.",
    };
    const current: AnalysisNote = {
      note_id: "dddddddd-dddd-4ddd-dddd-dddddddddddd",
      occurred_on: "2026-10-05",
      body: "날씨 이야기를 나누고 전화를 종료함.",
    };
    const raw = baseAnalysis({
      changes: [
        domain("meal", "unknown", null, null),
        domain("mobility", "unknown", null, null),
        domain("health", "unknown", null, null),
        domain("environment", "unknown", null, null),
      ],
    });
    expect(validateAnalysisOutput(raw, previous, current).changes.every((c) => c.status === "unknown")).toBe(
      true,
    );
  });

  it("rejects wrong note_id and non-substring quotes without softening", () => {
    const previous: AnalysisNote = {
      note_id: "eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee",
      occurred_on: "2026-09-01",
      body: "식사를 잘하심.",
    };
    const current: AnalysisNote = {
      note_id: "ffffffff-ffff-4fff-ffff-ffffffffffff",
      occurred_on: "2026-10-01",
      body: "식사를 거르심.",
    };
    const wrongId = baseAnalysis({
      changes: [
        domain(
          "meal",
          "worsened",
          { note_id: previous.note_id, quote: "식사를 잘하심." },
          { note_id: "not-the-current-id", quote: "식사를 거르심." },
        ),
        domain("mobility", "unknown", null, null),
        domain("health", "unknown", null, null),
        domain("environment", "unknown", null, null),
      ],
    });
    const d1 = diagnoseAnalysisOutput(wrongId, previous, current);
    expect(d1.ok).toBe(false);
    if (!d1.ok) expect(d1.code).toBe("note_id_mismatch");

    const paraphrased = baseAnalysis({
      changes: [
        domain(
          "meal",
          "worsened",
          { note_id: previous.note_id, quote: "식사를 잘하심." },
          { note_id: current.note_id, quote: "식사를 자주 거르심." },
        ),
        domain("mobility", "unknown", null, null),
        domain("health", "unknown", null, null),
        domain("environment", "unknown", null, null),
      ],
    });
    const d2 = diagnoseAnalysisOutput(paraphrased, previous, current);
    expect(d2.ok).toBe(false);
    if (!d2.ok) expect(d2.code).toBe("exact_quote");
  });

  it("separates success-only metrics from operational worsened unevaluated", () => {
    const op = computeSmokeOperationalMetrics([
      {
        case_id: "a",
        response_class: "schema_or_evidence_invalid",
        predicted_status: null,
        gold: {
          meal: "worsened",
          mobility: "worsened",
          health: "unknown",
          environment: "unknown",
        },
      },
      {
        case_id: "b",
        response_class: "success",
        predicted_status: {
          meal: "unknown",
          mobility: "unknown",
          health: "unknown",
          environment: "worsened",
        },
        gold: {
          meal: "unknown",
          mobility: "unknown",
          health: "unknown",
          environment: "worsened",
        },
      },
      {
        case_id: "c",
        response_class: "success",
        predicted_status: {
          meal: "unchanged",
          mobility: "unchanged",
          health: "unchanged",
          environment: "unchanged",
        },
        gold: {
          meal: "unknown",
          mobility: "unknown",
          health: "unknown",
          environment: "unknown",
        },
      },
    ]);
    expect(op.valid_response_rate).toBeCloseTo(2 / 3);
    expect(op.validation_failure_rate).toBeCloseTo(1 / 3);
    expect(op.gold_worsened_cells).toBe(3);
    expect(op.gold_worsened_detected_on_valid).toBe(1);
    expect(op.gold_worsened_unevaluated_due_to_validation_failure).toBe(2);
    expect(op.success_only_model_metrics?.worsened_recall).toBe(1);
  });

  it("builds semantic review rows as pending_manual_review only", () => {
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
    const analysis = validateAnalysisOutput(
      {
        schema_version: "1.0",
        summary: "요약",
        questions: [],
        changes: [
          domain(
            "meal",
            "worsened",
            { note_id: previous.note_id, quote: "혼자 식사도 잘하시고" },
            { note_id: current.note_id, quote: "식사를 자주 거르심." },
          ),
          domain("mobility", "unknown", null, null),
          domain("health", "unknown", null, null),
          domain("environment", "unknown", null, null),
        ],
      },
      previous,
      current,
    );
    const items = buildSemanticCitationReviewItems({
      case_id: "x",
      analysis,
      previousBody: previous.body,
      currentBody: current.body,
    });
    expect(items.length).toBe(2);
    expect(items.every((i) => i.semantic_review_status === "pending_manual_review")).toBe(
      true,
    );
    expect(items.every((i) => i.exact_substring_ok)).toBe(true);
  });
});
