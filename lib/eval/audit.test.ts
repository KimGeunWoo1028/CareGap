import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditEvalDataset, summarizeCaseGoldQuality } from "@/lib/eval/audit";
import { validateEvalDataset } from "@/lib/eval/validate-dataset";

describe("dataset audit", () => {
  it("flags unknown dominance and forbids over-interpretation", () => {
    const raw = JSON.parse(
      readFileSync(resolve(process.cwd(), "fixtures/eval/dataset.v1.json"), "utf8"),
    );
    const v = validateEvalDataset(raw);
    expect(v.ok).toBe(true);
    const audit = auditEvalDataset(v.dataset!);
    expect(audit.case_count).toBe(101);
    expect(audit.family_split_violations).toEqual([]);
    expect(audit.unknown_share).toBeGreaterThan(0.75);
    expect(audit.interpretation_limits.some((x) => /worsened/i.test(x))).toBe(
      true,
    );
    expect(audit.review_status_counts.expert_reviewed ?? 0).toBe(0);
  });

  it("requires semantic citation review separately from substring checks", () => {
    const raw = JSON.parse(
      readFileSync(resolve(process.cwd(), "fixtures/eval/dataset.v1.json"), "utf8"),
    );
    const c = raw.cases.find((x: { legacy_id?: string }) => x.legacy_id === "eval-01");
    const q = summarizeCaseGoldQuality(c);
    expect(q.citation_structural_ok).toBe(true);
    expect(q.citation_semantic_review_required).toBe(true);
  });
});
