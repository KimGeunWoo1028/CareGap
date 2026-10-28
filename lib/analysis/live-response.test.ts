import { describe, expect, it } from "vitest";
import {
  extractResponsesOutputText,
  extractResponsesUsage,
} from "@/lib/analysis/live-response";
import replayFixture from "@/fixtures/replay-analysis.json";

describe("extractResponsesOutputText (Responses API REST shape)", () => {
  it("reads assistant output_text after a leading reasoning item", () => {
    const extracted = extractResponsesOutputText({
      status: "completed",
      output: [
        {
          id: "rs_1",
          type: "reasoning",
          content: [],
          summary: [],
        },
        {
          id: "msg_1",
          type: "message",
          status: "completed",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(replayFixture),
              annotations: [],
            },
          ],
        },
      ],
    });
    expect(extracted.kind).toBe("text");
    if (extracted.kind === "text") {
      expect(JSON.parse(extracted.text)).toMatchObject({
        schema_version: "1.0",
      });
    }
  });

  it("falls back to top-level output_text when present", () => {
    const extracted = extractResponsesOutputText({
      status: "completed",
      output_text: '{"ok":true}',
      output: [{ type: "reasoning", content: [] }],
    });
    expect(extracted).toEqual({ kind: "text", text: '{"ok":true}' });
  });

  it("prefers message content over empty top-level convenience field", () => {
    const extracted = extractResponsesOutputText({
      status: "completed",
      output_text: "",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: '{"from":"message"}' }],
        },
      ],
    });
    expect(extracted).toEqual({ kind: "text", text: '{"from":"message"}' });
  });

  it("surfaces refusal content without inventing JSON", () => {
    const extracted = extractResponsesOutputText({
      status: "completed",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "refusal", refusal: "I cannot help with that." }],
        },
      ],
    });
    expect(extracted).toEqual({
      kind: "refusal",
      refusal: "I cannot help with that.",
    });
  });

  it("returns empty when only reasoning is present", () => {
    expect(
      extractResponsesOutputText({
        status: "completed",
        output: [{ type: "reasoning", content: [], summary: [] }],
      }),
    ).toEqual({ kind: "empty" });
  });

  it("extracts usage with reasoning as subset of output_tokens", () => {
    expect(
      extractResponsesUsage({
        usage: {
          input_tokens: 75,
          output_tokens: 1186,
          total_tokens: 1261,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 1024 },
        },
      }),
    ).toEqual({
      input_tokens: 75,
      output_tokens: 1186,
      total_tokens: 1261,
      reasoning_tokens: 1024,
      cached_input_tokens: 0,
    });
  });
});
