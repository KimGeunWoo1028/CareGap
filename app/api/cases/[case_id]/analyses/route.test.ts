import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthenticatedRequest = vi.fn();
const createOrResumeAnalysis = vi.fn();

vi.mock("@/lib/auth/request-auth", () => ({
  requireAuthenticatedRequest: (...args: unknown[]) =>
    requireAuthenticatedRequest(...args),
}));

vi.mock("@/lib/analysis/service", () => ({
  createOrResumeAnalysis: (...args: unknown[]) =>
    createOrResumeAnalysis(...args),
}));

const CASE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const KEY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("POST /api/cases/{case_id}/analyses", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuthenticatedRequest.mockReset();
    createOrResumeAnalysis.mockReset();
  });

  it("returns 401 without auth", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    requireAuthenticatedRequest.mockRejectedValue(
      new ApiError("UNAUTHENTICATED"),
    );
    const { POST } = await import("./route");
    const response = await POST(
      new Request(`http://localhost/api/cases/${CASE_ID}/analyses`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": KEY,
        },
        body: "{}",
      }),
      { params: Promise.resolve({ case_id: CASE_ID }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns 201 for new completed analysis", async () => {
    requireAuthenticatedRequest.mockResolvedValue({
      user: { id: "u1" },
      db: {},
      accessToken: "t",
    });
    createOrResumeAnalysis.mockResolvedValue({
      httpStatus: 201,
      detail: { id: "a1", status: "succeeded", mode: "replay" },
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request(`http://localhost/api/cases/${CASE_ID}/analyses`, {
        method: "POST",
        headers: {
          Authorization: "Bearer t",
          "content-type": "application/json",
          "Idempotency-Key": KEY,
        },
        body: "{}",
      }),
      { params: Promise.resolve({ case_id: CASE_ID }) },
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const payload = await response.json();
    expect(payload.data.status).toBe("succeeded");
    expect(payload.meta.request_id).toBeTruthy();
  });

  it("rejects non-empty body and missing idempotency key", async () => {
    requireAuthenticatedRequest.mockResolvedValue({
      user: { id: "u1" },
      db: {},
      accessToken: "t",
    });
    const { POST } = await import("./route");
    const badBody = await POST(
      new Request(`http://localhost/api/cases/${CASE_ID}/analyses`, {
        method: "POST",
        headers: {
          Authorization: "Bearer t",
          "content-type": "application/json",
          "Idempotency-Key": KEY,
        },
        body: JSON.stringify({ mode: "live" }),
      }),
      { params: Promise.resolve({ case_id: CASE_ID }) },
    );
    expect(badBody.status).toBe(400);

    const badKey = await POST(
      new Request(`http://localhost/api/cases/${CASE_ID}/analyses`, {
        method: "POST",
        headers: {
          Authorization: "Bearer t",
          "content-type": "application/json",
        },
        body: "{}",
      }),
      { params: Promise.resolve({ case_id: CASE_ID }) },
    );
    expect(badKey.status).toBe(400);
    expect(createOrResumeAnalysis).not.toHaveBeenCalled();
  });

  it("adds Retry-After on RATE_LIMITED", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    requireAuthenticatedRequest.mockResolvedValue({
      user: { id: "u1" },
      db: {},
      accessToken: "t",
    });
    createOrResumeAnalysis.mockRejectedValue(new ApiError("RATE_LIMITED"));
    const { POST } = await import("./route");
    const response = await POST(
      new Request(`http://localhost/api/cases/${CASE_ID}/analyses`, {
        method: "POST",
        headers: {
          Authorization: "Bearer t",
          "content-type": "application/json",
          "Idempotency-Key": KEY,
        },
        body: "{}",
      }),
      { params: Promise.resolve({ case_id: CASE_ID }) },
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });
});
