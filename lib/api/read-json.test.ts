import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { MAX_REQUEST_BYTES, readJsonBody } from "@/lib/api/read-json";

describe("request body size limit", () => {
  it("parses small JSON bodies", async () => {
    const request = new Request("http://localhost/api/cases", {
      method: "POST",
      body: JSON.stringify({ alias: "합성-001" }),
      headers: { "content-type": "application/json" },
    });
    await expect(readJsonBody(request)).resolves.toEqual({ alias: "합성-001" });
  });

  it("rejects bodies larger than 16 KiB", async () => {
    const oversized = "x".repeat(MAX_REQUEST_BYTES + 1);
    const request = new Request("http://localhost/api/cases", {
      method: "POST",
      body: oversized,
      headers: {
        "content-type": "application/json",
        "content-length": String(oversized.length),
      },
    });
    await expect(readJsonBody(request)).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects invalid JSON", async () => {
    const request = new Request("http://localhost/api/cases", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json" },
    });
    await expect(readJsonBody(request)).rejects.toBeInstanceOf(ApiError);
  });
});
