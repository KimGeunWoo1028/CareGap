import { describe, expect, it, vi } from "vitest";
import replayFixture from "@/fixtures/replay-analysis.json";
import { runAnalysis } from "@/lib/analysis/run-analysis";
import {
  REPLAY_CASE_ALIAS,
  REPLAY_CURRENT_NOTE,
  REPLAY_PREVIOUS_NOTE,
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

describe("runAnalysis orchestration", () => {
  it("routes replay without OpenAI config", async () => {
    const result = await runAnalysis({
      mode: "replay",
      caseAlias: REPLAY_CASE_ALIAS,
      previous,
      current,
      programs: DEMO_WELFARE_PROGRAMS,
    });
    expect(result.mode).toBe("replay");
    expect(result.model).toBeNull();
  });

  it("does not silently switch live failure to replay", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "boom" } }), {
        status: 500,
      }),
    );

    await expect(
      runAnalysis({
        mode: "live",
        caseAlias: REPLAY_CASE_ALIAS,
        previous,
        current,
        programs: DEMO_WELFARE_PROGRAMS,
        openai: {
          apiKey: "test-key",
          model: "gpt-test",
          fetchImpl: fetchImpl as unknown as typeof fetch,
        },
      }),
    ).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });

    // Still only provider attempts (1 + 1 retry), never a fabricated replay success.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("live success shares matching with replay fixture shape", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: "completed",
          output_text: JSON.stringify(replayFixture),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const live = await runAnalysis({
      mode: "live",
      caseAlias: REPLAY_CASE_ALIAS,
      previous: {
        note_id: "11111111-1111-4111-8111-111111111111",
        occurred_on: previous.occurred_on,
        body: previous.body,
      },
      current: {
        note_id: "22222222-2222-4222-8222-222222222222",
        occurred_on: current.occurred_on,
        body: current.body,
      },
      programs: DEMO_WELFARE_PROGRAMS,
      openai: {
        apiKey: "test-key",
        model: "gpt-test",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    });

    const replay = await runAnalysis({
      mode: "replay",
      caseAlias: REPLAY_CASE_ALIAS,
      previous,
      current,
      programs: DEMO_WELFARE_PROGRAMS,
    });

    expect(live.recommendations.map((r) => r.program_id)).toEqual(
      replay.recommendations.map((r) => r.program_id),
    );
  });
});
