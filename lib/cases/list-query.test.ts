import { describe, expect, it } from "vitest";
import {
  filterCasesByAlias,
  isValidCaseAlias,
} from "@/lib/cases/list-query";

const sample = [
  {
    id: "a",
    alias: "합성-001",
    created_at: "2026-10-01T00:00:00.000Z",
    consultation_count: 2,
  },
  {
    id: "b",
    alias: "합성-007",
    created_at: "2026-10-02T00:00:00.000Z",
    consultation_count: 0,
  },
  {
    id: "c",
    alias: "합성-010",
    created_at: "2026-10-03T00:00:00.000Z",
    consultation_count: 1,
  },
];

describe("filterCasesByAlias", () => {
  it("returns all cases when the query is blank", () => {
    expect(filterCasesByAlias(sample, "  ")).toEqual(sample);
  });

  it("filters by alias substring within the loaded list only", () => {
    expect(filterCasesByAlias(sample, "007").map((c) => c.alias)).toEqual([
      "합성-007",
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterCasesByAlias(sample, "합성-999")).toEqual([]);
  });
});

describe("isValidCaseAlias", () => {
  it("accepts 합성-NNN", () => {
    expect(isValidCaseAlias("합성-001")).toBe(true);
    expect(isValidCaseAlias(" 합성-099 ")).toBe(true);
  });

  it("rejects other shapes", () => {
    expect(isValidCaseAlias("합성-1")).toBe(false);
    expect(isValidCaseAlias("홍길동")).toBe(false);
  });
});
