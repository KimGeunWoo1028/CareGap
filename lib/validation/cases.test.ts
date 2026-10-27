import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { parseCreateCaseBody } from "@/lib/validation/cases";

describe("case alias validation (T02)", () => {
  it("accepts 합성-000 style aliases", () => {
    expect(parseCreateCaseBody({ alias: "합성-001" })).toEqual({
      alias: "합성-001",
    });
  });

  it("rejects invalid aliases and extra fields", () => {
    expect(() => parseCreateCaseBody({ alias: "홍길동" })).toThrow(ApiError);
    expect(() => parseCreateCaseBody({ alias: "합성-1" })).toThrow(ApiError);
    expect(() =>
      parseCreateCaseBody({ alias: "합성-001", owner_id: "x" }),
    ).toThrow(ApiError);
  });
});
