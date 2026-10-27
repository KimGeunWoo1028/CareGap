import { describe, expect, it, vi } from "vitest";
import replayFixture from "@/fixtures/replay-analysis.json";
import { ApiError } from "@/lib/api/errors";
import { runLiveAnalysis } from "@/lib/analysis/live";
import {
  REPLAY_CURRENT_NOTE,
  REPLAY_PREVIOUS_NOTE,
} from "@/lib/analysis/replay";
import { DEMO_WELFARE_PROGRAMS } from "@/lib/matching/demo-programs";
import type { AnalysisNote } from "@/lib/analysis/types";

const previous: AnalysisNote = {
  note_id: "11111111-1111-4111-8111-111111111111",
  occurred_on: REPLAY_PREVIOUS_NOTE.occurred_on,
  body: REPLAY_PREVIOUS_NOTE.body,
};

const current: AnalysisNote = {
  note_id: "22222222-2222-4222-8222-222222222222",
  occurred_on: REPLAY_CURRENT_NOTE.occurred_on,
  body: REPLAY_CURRENT_NOTE.body,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("runLiveAnalysis (T16 stub)", () => {
  it("validates provider JSON and returns live mode without falling back to replay", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        status: "completed",
        output_text: JSON.stringify(replayFixture),
      }),
    );

    const result = await runLiveAnalysis({
      previous,
      current,
      programs: DEMO_WELFARE_PROGRAMS,
      openai: {
        apiKey: "test-key",
        model: "gpt-5.4-mini-2026-03-17",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    });

    expect(result.mode).toBe("live");
    expect(result.model).toBe("gpt-5.4-mini-2026-03-17");
    expect(result.recommendations).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      store: boolean;
      model: string;
    };
    expect(body.store).toBe(false);
    expect(body.model).toBe("gpt-5.4-mini-2026-03-17");
  });

  it("rejects invalid AI quotes as INVALID_AI_OUTPUT without retry", async () => {
    const bad = structuredClone(replayFixture);
    bad.changes[0].evidence_current.quote = "존재하지 않는 인용";
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        status: "completed",
        output_text: JSON.stringify(bad),
      }),
    );

    await expect(
      runLiveAnalysis({
        previous,
        current,
        programs: DEMO_WELFARE_PROGRAMS,
        openai: {
          apiKey: "test-key",
          model: "gpt-test",
          fetchImpl: fetchImpl as unknown as typeof fetch,
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_AI_OUTPUT" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries once on 429 then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: "rate" } }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          status: "completed",
          output_text: JSON.stringify(replayFixture),
        }),
      );

    const result = await runLiveAnalysis({
      previous,
      current,
      programs: DEMO_WELFARE_PROGRAMS,
      openai: {
        apiKey: "test-key",
        model: "gpt-test",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    });

    expect(result.mode).toBe("live");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry on incomplete model status", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { status: "incomplete", output_text: "" }),
    );

    await expect(
      runLiveAnalysis({
        previous,
        current,
        programs: DEMO_WELFARE_PROGRAMS,
        openai: {
          apiKey: "test-key",
          model: "gpt-test",
          fetchImpl: fetchImpl as unknown as typeof fetch,
        },
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails closed when API key is missing", async () => {
    await expect(
      runLiveAnalysis({
        previous,
        current,
        programs: DEMO_WELFARE_PROGRAMS,
        openai: { apiKey: "  ", model: "gpt-test" },
      }),
    ).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
  });
});
