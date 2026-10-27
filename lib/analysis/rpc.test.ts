import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  mapStartAnalysisErrorCode,
  mapStartAnalysisException,
  parseStartAnalysisRpc,
  toStoredFailureCode,
} from "@/lib/analysis/rpc";

describe("start_analysis RPC mapping", () => {
  it("parses created reservation", () => {
    const result = parseStartAnalysisRpc(
      {
        created: true,
        analysis_id: "33333333-3333-4333-8333-333333333333",
        status: "processing",
      },
      null,
    );
    expect(result.created).toBe(true);
    expect(result.status).toBe("processing");
  });

  it("maps JSON error_code whitelist", () => {
    expect(() =>
      parseStartAnalysisRpc({ error_code: "NOT_ENOUGH_RECORDS" }, null),
    ).toThrow(ApiError);
    expect(mapStartAnalysisErrorCode("RATE_LIMITED").status).toBe(429);
    expect(mapStartAnalysisErrorCode("UNKNOWN").code).toBe(
      "SERVICE_UNAVAILABLE",
    );
  });

  it("maps P0001 exception messages", () => {
    expect(mapStartAnalysisException({ message: "NOT_FOUND" }).code).toBe(
      "NOT_FOUND",
    );
    expect(
      mapStartAnalysisException({ message: "something else" }).code,
    ).toBe("SERVICE_UNAVAILABLE");
  });

  it("stores only allowlisted failure codes", () => {
    expect(toStoredFailureCode(new ApiError("INVALID_AI_OUTPUT"))).toBe(
      "INVALID_AI_OUTPUT",
    );
    expect(toStoredFailureCode(new ApiError("DUPLICATE_ALIAS"))).toBe(
      "SERVICE_UNAVAILABLE",
    );
    expect(toStoredFailureCode(new Error("boom"))).toBe("SERVICE_UNAVAILABLE");
  });
});
