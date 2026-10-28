import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  summarizeLabelDistribution,
  validateEvalDataset,
} from "@/lib/eval/validate-dataset";
import type { EvalDataset } from "@/lib/eval/types";

const datasetPath = resolve(
  process.cwd(),
  "fixtures/eval/dataset.v1.json",
);

describe("validateEvalDataset", () => {
  it("accepts handcrafted v1 dataset", () => {
    const raw = JSON.parse(readFileSync(datasetPath, "utf8"));
    const result = validateEvalDataset(raw);
    if (!result.ok) {
      expect(result.issues, JSON.stringify(result.issues.slice(0, 20))).toEqual(
        [],
      );
    }
    expect(result.ok).toBe(true);
    expect(result.dataset!.cases.length).toBeGreaterThanOrEqual(100);
    expect(result.dataset!.cases.length).toBeLessThanOrEqual(120);
    expect(result.dataset!.expert_reviewed).toBe(false);
    expect(
      result.dataset!.cases.every((c) => c.review_status !== "expert_reviewed"),
    ).toBe(true);
  });

  it("preserves legacy eval-01..12 labels", () => {
    const raw = JSON.parse(readFileSync(datasetPath, "utf8")) as EvalDataset;
    const legacy = Object.fromEntries(
      raw.cases
        .filter((c) => c.legacy_id)
        .map((c) => [c.legacy_id!, c.expected_status]),
    );
    expect(legacy["eval-01"]).toMatchObject({
      meal: "worsened",
      mobility: "worsened",
    });
    expect(legacy["eval-06"]).toMatchObject({
      meal: "unchanged",
      mobility: "unchanged",
    });
    expect(legacy["eval-12"]).toMatchObject({ meal: "improved" });
  });

  it("rejects duplicate ids and expert_reviewed cases", () => {
    const raw = JSON.parse(readFileSync(datasetPath, "utf8")) as EvalDataset;
    const bad = structuredClone(raw);
    bad.cases[0]!.review_status = "expert_reviewed";
    bad.cases.push({ ...bad.cases[0]!, id: bad.cases[0]!.id });
    const result = validateEvalDataset(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "DUP_ID")).toBe(true);
    expect(result.issues.some((i) => i.code === "EXPERT_LABEL")).toBe(true);
  });

  it("rejects quote that is not a substring", () => {
    const raw = JSON.parse(readFileSync(datasetPath, "utf8")) as EvalDataset;
    const bad = structuredClone(raw);
    bad.cases[0]!.expected_quotes = [
      { domain: "meal", side: "previous", quote: "이문구는원문에없음" },
    ];
    const result = validateEvalDataset(bad);
    expect(result.issues.some((i) => i.code === "QUOTE_NOT_SUBSTRING")).toBe(
      true,
    );
  });

  it("rejects PII-looking phone patterns", () => {
    const raw = JSON.parse(readFileSync(datasetPath, "utf8")) as EvalDataset;
    const bad = structuredClone(raw);
    bad.cases[0]!.current.body = "연락처는 010-1234-5678 입니다.";
    const result = validateEvalDataset(bad);
    expect(result.issues.some((i) => i.code === "PII_SUSPECT")).toBe(true);
  });

  it("summarizes label distribution without fabricating percentages", () => {
    const raw = JSON.parse(readFileSync(datasetPath, "utf8")) as EvalDataset;
    const dist = summarizeLabelDistribution(raw);
    expect(dist.meal.worsened).toBeGreaterThan(0);
    expect(dist.meal.unknown).toBeGreaterThan(0);
  });
});
