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

/** Realistic Responses API REST body: reasoning item before message. */
function completedWithMessageText(text: string) {
  return {
    id: "resp_test",
    object: "response",
    status: "completed",
    output: [
      {
        id: "rs_test",
        type: "reasoning",
        content: [],
        summary: [],
      },
      {
        id: "msg_test",
        type: "message",
        status: "completed",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text,
            annotations: [],
            logprobs: [],
          },
        ],
      },
    ],
  };
}

describe("runLiveAnalysis (T16 stub)", () => {
  it("parses message output after reasoning and returns live mode (no replay fallback)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, completedWithMessageText(JSON.stringify(replayFixture))),
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
      jsonResponse(200, completedWithMessageText(JSON.stringify(bad))),
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

  it("rejects refusal content without retry or replay", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "refusal", refusal: "declined" }],
          },
        ],
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
    ).rejects.toMatchObject({
      code: "INVALID_AI_OUTPUT",
      details: { reason: "refusal" },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed JSON in message text without retry", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, completedWithMessageText("{not-json")),
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
    ).rejects.toMatchObject({
      code: "INVALID_AI_OUTPUT",
      details: { reason: "json_parse" },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries once on 429 then succeeds with REST output shape", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: "rate" } }))
      .mockResolvedValueOnce(
        jsonResponse(200, completedWithMessageText(JSON.stringify(replayFixture))),
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

  it("retries once on 503 then fails closed without replay", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { error: { message: "down" } }))
      .mockResolvedValueOnce(jsonResponse(503, { error: { message: "down" } }));

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
    ).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry on incomplete model status", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        status: "incomplete",
        output: [],
        incomplete_details: { reason: "max_output_tokens" },
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
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails on empty completed output without retry", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        status: "completed",
        output: [{ type: "reasoning", content: [], summary: [] }],
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
    ).rejects.toMatchObject({
      code: "AI_UNAVAILABLE",
      details: { reason: "empty_output" },
    });
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
