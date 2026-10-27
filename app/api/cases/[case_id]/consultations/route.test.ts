import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthenticatedRequest = vi.fn();
const createConsultation = vi.fn();

vi.mock("@/lib/auth/request-auth", () => ({
  requireAuthenticatedRequest: (...args: unknown[]) =>
    requireAuthenticatedRequest(...args),
}));

vi.mock("@/lib/cases/repository", () => ({
  createConsultation: (...args: unknown[]) => createConsultation(...args),
}));

describe("POST /api/cases/{case_id}/consultations", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuthenticatedRequest.mockReset();
    createConsultation.mockReset();
  });

  it("returns 404 for another user's missing case (T22 unit path)", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    requireAuthenticatedRequest.mockResolvedValue({
      user: { id: "user-b" },
      db: {},
      accessToken: "token-b",
    });
    createConsultation.mockRejectedValue(new ApiError("NOT_FOUND"));

    const { POST } = await import("./route");
    const response = await POST(
      new Request(
        "http://localhost/api/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/consultations",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer token-b",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            occurred_on: "2026-10-10",
            channel: "phone",
            body: "합성 상담 원문",
          }),
        },
      ),
      {
        params: Promise.resolve({
          case_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }),
      },
    );

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.error.code).toBe("NOT_FOUND");
  });

  it("rejects invalid body before DB write (T04)", async () => {
    requireAuthenticatedRequest.mockResolvedValue({
      user: { id: "user-a" },
      db: {},
      accessToken: "token",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request(
        "http://localhost/api/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/consultations",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            occurred_on: "2026-10-10",
            channel: "phone",
            body: "이메일 demo@example.com 포함",
          }),
        },
      ),
      {
        params: Promise.resolve({
          case_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(createConsultation).not.toHaveBeenCalled();
  });
});
