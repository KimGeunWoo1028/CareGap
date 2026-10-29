import { describe, expect, it } from "vitest";
import { mapCaseRecord } from "@/lib/cases/case-record";

describe("mapCaseRecord", () => {
  it("defaults consultation_count to 0 when nested count is absent", () => {
    expect(
      mapCaseRecord({
        id: "c1",
        alias: "합성-001",
        created_at: "2026-10-10T01:00:00.000Z",
      }).consultation_count,
    ).toBe(0);
  });

  it("reads Supabase nested consultations(count) array shape", () => {
    expect(
      mapCaseRecord({
        id: "c1",
        alias: "합성-001",
        created_at: "2026-10-10T01:00:00.000Z",
        consultations: [{ count: 2 }],
      }).consultation_count,
    ).toBe(2);
  });

  it("prefers an explicit consultation_count", () => {
    expect(
      mapCaseRecord({
        id: "c1",
        alias: "합성-001",
        created_at: "2026-10-10T01:00:00.000Z",
        consultations: [{ count: 9 }],
        consultation_count: 0,
      }).consultation_count,
    ).toBe(0);
  });
});
