import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthenticatedRequest = vi.fn();
const listCases = vi.fn();
const createCase = vi.fn();

vi.mock("@/lib/auth/request-auth", () => ({
  requireAuthenticatedRequest: (...args: unknown[]) =>
    requireAuthenticatedRequest(...args),
}));

vi.mock("@/lib/cases/repository", () => ({
  listCases: (...args: unknown[]) => listCases(...args),
  createCase: (...args: unknown[]) => createCase(...args),
}));

describe("GET/POST /api/cases handlers", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuthenticatedRequest.mockReset();
    listCases.mockReset();
    createCase.mockReset();
  });

  it("returns 401 when Authorization is missing (T01)", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    requireAuthenticatedRequest.mockRejectedValue(new ApiError("UNAUTHENTICATED"));
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/cases"));
    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.error.code).toBe("UNAUTHENTICATED");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("creates a case for the authenticated user (T02 unit path)", async () => {
    requireAuthenticatedRequest.mockResolvedValue({
      user: { id: "user-a" },
      db: {},
      accessToken: "token",
    });
    createCase.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      alias: "합성-001",
      created_at: "2026-10-10T01:00:00Z",
      consultation_count: 0,
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/cases", {
        method: "POST",
        headers: {
          Authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ alias: "합성-001" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createCase).toHaveBeenCalledWith({}, "user-a", "합성-001");
    const payload = await response.json();
    expect(payload.data.alias).toBe("합성-001");
    expect(payload.meta.request_id).toBeTruthy();
  });

  it("maps duplicate alias to 409 DUPLICATE_ALIAS (T02)", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    requireAuthenticatedRequest.mockResolvedValue({
      user: { id: "user-a" },
      db: {},
      accessToken: "token",
    });
    createCase.mockRejectedValue(new ApiError("DUPLICATE_ALIAS"));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/cases", {
        method: "POST",
        headers: {
          Authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ alias: "합성-001" }),
      }),
    );

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error.code).toBe("DUPLICATE_ALIAS");
  });
});
