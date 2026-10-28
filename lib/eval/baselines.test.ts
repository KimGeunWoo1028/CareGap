import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildBaselinePredictions,
  countLabelDistribution,
  scoreAllBaselines,
  scoreBaseline,
} from "@/lib/eval/baselines";
import { validateEvalDataset } from "@/lib/eval/validate-dataset";
import type { EvalDataset } from "@/lib/eval/types";

function loadV1(): EvalDataset {
  const raw = JSON.parse(
    readFileSync(resolve(process.cwd(), "fixtures/eval/dataset.v1.json"), "utf8"),
  );
  const v = validateEvalDataset(raw);
  expect(v.ok).toBe(true);
  return v.dataset!;
}

describe("baselines under unknown-heavy gold", () => {
  it("documents high unknown share without treating it as model quality", () => {
    const ds = loadV1();
    const dist = countLabelDistribution(ds);
    expect(dist.total_cells).toBe(ds.cases.length * 4);
    expect(dist.unknown_share).toBeGreaterThan(0.7);
  });

  it("always_unknown gets high accuracy but fails worsened recall", () => {
    const ds = loadV1();
    const card = scoreBaseline(ds, "always_unknown");
    expect(card.overall_status_accuracy).not.toBe("N/A");
    expect(card.overall_status_accuracy as number).toBeGreaterThan(0.7);
    expect(card.worsened_recall).toBe(0);
    expect(card.missed_worsening_rate).toBe(1);
    expect(card.note).toMatch(/not a Live model/i);
  });

  it("majority_class mirrors always_unknown when unknown dominates", () => {
    const ds = loadV1();
    const a = scoreBaseline(ds, "always_unknown");
    const m = scoreBaseline(ds, "majority_class");
    expect(m.overall_status_accuracy).toBe(a.overall_status_accuracy);
    expect(m.worsened_recall).toBe(0);
  });

  it("stratified_random is deterministic for a fixed seed", () => {
    const ds = loadV1();
    const a = scoreBaseline(ds, "stratified_random", 42);
    const b = scoreBaseline(ds, "stratified_random", 42);
    expect(a).toEqual(b);
    const p42 = buildBaselinePredictions(ds, "stratified_random", 42);
    const p99 = buildBaselinePredictions(ds, "stratified_random", 99);
    expect(JSON.stringify(p42.predictions)).not.toEqual(
      JSON.stringify(p99.predictions),
    );
  });

  it("scoreAllBaselines returns four cards and never claims live accuracy", () => {
    const cards = scoreAllBaselines(loadV1());
    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(card.note).toMatch(/Baseline stub/i);
    }
  });
});
