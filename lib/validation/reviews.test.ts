import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { parseCreateReviewBody } from "@/lib/validation/reviews";
import {
  parseEmptyAnalysisBody,
  parseIdempotencyKey,
} from "@/lib/validation/analyses";

describe("review and analysis request validation", () => {
  it("accepts valid review bodies", () => {
    expect(
      parseCreateReviewBody({
        decision: "needs_followup",
        note: "추가 확인",
      }).decision,
    ).toBe("needs_followup");
    expect(
      parseCreateReviewBody({ decision: "confirmed", note: "" }).note,
    ).toBe("");
  });

  it("rejects rejected without reason and extra fields", () => {
    expect(() =>
      parseCreateReviewBody({ decision: "rejected", note: "   " }),
    ).toThrow(ApiError);
    expect(() =>
      parseCreateReviewBody({
        decision: "confirmed",
        note: "",
        extra: true,
      }),
    ).toThrow(ApiError);
  });

  it("requires empty analysis body and UUID idempotency key", () => {
    expect(parseEmptyAnalysisBody({})).toEqual({});
    expect(() => parseEmptyAnalysisBody({ mode: "live" })).toThrow(ApiError);
    expect(
      parseIdempotencyKey("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    ).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(() => parseIdempotencyKey("not-a-uuid")).toThrow(ApiError);
  });
});
