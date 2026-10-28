/**
 * Extract assistant JSON/text from OpenAI Responses API REST payloads.
 * Prefer message items in `output`; do not assume output[0] is the message
 * (reasoning items may appear first). Top-level `output_text` is an optional
 * convenience when present on the wire.
 */

export type ResponsesApiPayload = {
  status?: string;
  output_text?: string;
  error?: { message?: string; code?: string };
  incomplete_details?: unknown;
  output?: unknown;
};

export type ExtractedResponseText =
  | { kind: "text"; text: string }
  | { kind: "refusal"; refusal: string }
  | { kind: "empty" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Walk Responses `output` items and collect assistant `output_text` parts.
 * Skips `reasoning` (and other non-message) items.
 */
export function extractResponsesOutputText(
  payload: ResponsesApiPayload,
): ExtractedResponseText {
  const parts: string[] = [];
  let refusal: string | null = null;

  if (Array.isArray(payload.output)) {
    for (const item of payload.output) {
      if (!isRecord(item)) continue;
      if (item.type === "reasoning") continue;
      if (item.type !== "message") continue;
      if (!Array.isArray(item.content)) continue;
      for (const block of item.content) {
        if (!isRecord(block)) continue;
        if (block.type === "refusal" && typeof block.refusal === "string") {
          refusal = block.refusal;
          continue;
        }
        if (
          block.type === "output_text" &&
          typeof block.text === "string" &&
          block.text.length > 0
        ) {
          parts.push(block.text);
        }
      }
    }
  }

  if (refusal !== null && parts.length === 0) {
    return { kind: "refusal", refusal };
  }

  if (parts.length > 0) {
    return { kind: "text", text: parts.join("") };
  }

  if (typeof payload.output_text === "string" && payload.output_text.length > 0) {
    return { kind: "text", text: payload.output_text };
  }

  return { kind: "empty" };
}
