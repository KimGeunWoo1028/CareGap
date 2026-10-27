import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthenticatedRequest = vi.fn();
const getAnalysisDetail = vi.fn();

vi.mock("@/lib/auth/request-auth", () => ({
  requireAuthenticatedRequest: (...args: unknown[]) =>
    requireAuthenticatedRequest(...args),
}));

vi.mock("@/lib/analysis/repository", () => ({
  getAnalysisDetail: (...args: unknown[]) => getAnalysisDetail(...args),
}));

const ANALYSIS_ID = "33333333-3333-4333-8333-333333333333";

describe("GET /api/analyses/{analysis_id}", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuthenticatedRequest.mockReset();
    getAnalysisDetail.mockReset();
  });

  it("returns owned analysis detail", async () => {
    requireAuthenticatedRequest.mockResolvedValue({
      user: { id: "u1" },
      db: {},
      accessToken: "t",
    });
    getAnalysisDetail.mockResolvedValue({
      id: ANALYSIS_ID,
      status: "succeeded",
      is_current: true,
      review: null,
    });
    const { GET } = await import("./route");
    const response = await GET(
      new Request(`http://localhost/api/analyses/${ANALYSIS_ID}`, {
        headers: { Authorization: "Bearer t" },
      }),
      { params: Promise.resolve({ analysis_id: ANALYSIS_ID }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const payload = await response.json();
    expect(payload.data.id).toBe(ANALYSIS_ID);
  });

  it("maps missing analysis to 404", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    requireAuthenticatedRequest.mockResolvedValue({
      user: { id: "u1" },
      db: {},
      accessToken: "t",
    });
    getAnalysisDetail.mockRejectedValue(new ApiError("NOT_FOUND"));
    const { GET } = await import("./route");
    const response = await GET(
      new Request(`http://localhost/api/analyses/${ANALYSIS_ID}`, {
        headers: { Authorization: "Bearer t" },
      }),
      { params: Promise.resolve({ analysis_id: ANALYSIS_ID }) },
    );
    expect(response.status).toBe(404);
  });
});
