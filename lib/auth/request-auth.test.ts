import { describe, expect, it } from "vitest";
import { extractBearerToken } from "@/lib/auth/request-auth";

describe("Bearer token extraction (T01)", () => {
  it("reads a Bearer access token", () => {
    expect(extractBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("rejects missing or malformed Authorization headers", () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken("")).toBeNull();
    expect(extractBearerToken("Basic abc")).toBeNull();
    expect(extractBearerToken("Bearer")).toBeNull();
    expect(extractBearerToken("Bearer   ")).toBeNull();
  });
});
