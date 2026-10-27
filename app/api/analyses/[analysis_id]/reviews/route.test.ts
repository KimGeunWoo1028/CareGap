import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthenticatedRequest = vi.fn();
const createAnalysisReview = vi.fn();

vi.mock("@/lib/auth/request-auth", () => ({
  requireAuthenticatedRequest: (...args: unknown[]) =>
    requireAuthenticatedRequest(...args),
}));

vi.mock("@/lib/analysis/service", () => ({
  createAnalysisReview: (...args: unknown[]) => createAnalysisReview(...args),
}));

const ANALYSIS_ID = "33333333-3333-4333-8333-333333333333";

describe("POST /api/analyses/{analysis_id}/reviews", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuthenticatedRequest.mockReset();
    createAnalysisReview.mockReset();
  });

  it("creates a review (T14)", async () => {
    requireAuthenticatedRequest.mockResolvedValue({
      user: { id: "u1" },
      db: {},
      accessToken: "t",
    });
    createAnalysisReview.mockResolvedValue({
      id: "r1",
      analysis_id: ANALYSIS_ID,
      decision: "confirmed",
      note: "",
      created_at: "2026-10-27T09:00:00Z",
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request(`http://localhost/api/analyses/${ANALYSIS_ID}/reviews`, {
        method: "POST",
        headers: {
          Authorization: "Bearer t",
          "content-type": "application/json",
        },
        body: JSON.stringify({ decision: "confirmed", note: "" }),
      }),
      { params: Promise.resolve({ analysis_id: ANALYSIS_ID }) },
    );
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.data.analysis_id).toBe(ANALYSIS_ID);
  });

  it("maps REVIEW_EXISTS to 409", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    requireAuthenticatedRequest.mockResolvedValue({
      user: { id: "u1" },
      db: {},
      accessToken: "t",
    });
    createAnalysisReview.mockRejectedValue(new ApiError("REVIEW_EXISTS"));
    const { POST } = await import("./route");
    const response = await POST(
      new Request(`http://localhost/api/analyses/${ANALYSIS_ID}/reviews`, {
        method: "POST",
        headers: {
          Authorization: "Bearer t",
          "content-type": "application/json",
        },
        body: JSON.stringify({ decision: "confirmed", note: "" }),
      }),
      { params: Promise.resolve({ analysis_id: ANALYSIS_ID }) },
    );
    expect(response.status).toBe(409);
  });
});
