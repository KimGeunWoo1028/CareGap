import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { jsonError, jsonFromUnknownError, jsonOk } from "@/lib/api/response";

describe("API response envelope", () => {
  it("returns snake_case success payload with no-store", async () => {
    const response = jsonOk([{ id: "1", alias: "합성-001" }], {
      requestId: "11111111-1111-4111-8111-111111111111",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "1", alias: "합성-001" }],
      meta: { request_id: "11111111-1111-4111-8111-111111111111" },
    });
  });

  it("maps ApiError to the documented error shape", async () => {
    const response = jsonFromUnknownError(new ApiError("UNAUTHENTICATED"), "rid");
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "로그인이 필요합니다. 다시 로그인해 주세요.",
        request_id: "rid",
        details: {},
      },
    });
  });

  it("hides unknown errors as SERVICE_UNAVAILABLE", async () => {
    const response = jsonError("SERVICE_UNAVAILABLE", { requestId: "rid" });
    expect(response.status).toBe(503);
  });
});
