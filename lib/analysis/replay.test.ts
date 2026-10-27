import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  REPLAY_CASE_ALIAS,
  REPLAY_CURRENT_NOTE,
  REPLAY_PREVIOUS_NOTE,
  runReplayAnalysis,
} from "@/lib/analysis/replay";
import { DEMO_WELFARE_PROGRAMS } from "@/lib/matching/demo-programs";
import type { AnalysisNote } from "@/lib/analysis/types";

const previous: AnalysisNote = {
  note_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  occurred_on: REPLAY_PREVIOUS_NOTE.occurred_on,
  body: REPLAY_PREVIOUS_NOTE.body,
};

const current: AnalysisNote = {
  note_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  occurred_on: REPLAY_CURRENT_NOTE.occurred_on,
  body: REPLAY_CURRENT_NOTE.body,
};

describe("runReplayAnalysis (T09, T15)", () => {
  it("returns deterministic validated result without calling fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const first = runReplayAnalysis({
      caseAlias: REPLAY_CASE_ALIAS,
      previous,
      current,
      programs: DEMO_WELFARE_PROGRAMS,
    });
    const second = runReplayAnalysis({
      caseAlias: REPLAY_CASE_ALIAS,
      previous,
      current,
      programs: DEMO_WELFARE_PROGRAMS,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(first.mode).toBe("replay");
    expect(first.model).toBeNull();
    expect(first.analysis.changes).toHaveLength(4);
    expect(first.recommendations.map((r) => r.program_id)).toEqual([
      "daegu_integrated",
      "senior_care",
    ]);
    expect(first.analysis).toEqual(second.analysis);
    expect(first.recommendations).toEqual(second.recommendations);

    const meal = first.analysis.changes.find((c) => c.domain === "meal");
    expect(meal?.evidence_previous?.note_id).toBe(previous.note_id);
    expect(meal?.evidence_current?.note_id).toBe(current.note_id);
    fetchSpy.mockRestore();
  });

  it("T15 rejects one-character body drift with REPLAY_UNAVAILABLE", () => {
    expect(() =>
      runReplayAnalysis({
        caseAlias: REPLAY_CASE_ALIAS,
        previous,
        current: { ...current, body: `${current.body}!` },
        programs: DEMO_WELFARE_PROGRAMS,
      }),
    ).toThrow(ApiError);

    try {
      runReplayAnalysis({
        caseAlias: REPLAY_CASE_ALIAS,
        previous,
        current: { ...current, body: `${current.body}!` },
        programs: DEMO_WELFARE_PROGRAMS,
      });
    } catch (error) {
      expect((error as ApiError).code).toBe("REPLAY_UNAVAILABLE");
      expect((error as ApiError).status).toBe(422);
    }
  });

  it("rejects wrong alias or dates", () => {
    expect(() =>
      runReplayAnalysis({
        caseAlias: "합성-002",
        previous,
        current,
        programs: DEMO_WELFARE_PROGRAMS,
      }),
    ).toThrow(/REPLAY_UNAVAILABLE|고정 예시/);

    expect(() =>
      runReplayAnalysis({
        caseAlias: REPLAY_CASE_ALIAS,
        previous: { ...previous, occurred_on: "2026-09-11" },
        current,
        programs: DEMO_WELFARE_PROGRAMS,
      }),
    ).toThrow(ApiError);
  });
});
