import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ANALYSIS_DOMAINS } from "@/lib/analysis/types";
import { selectLivePilotCases } from "@/lib/eval/pilot-select";
import { validateEvalDataset } from "@/lib/eval/validate-dataset";

describe("selectLivePilotCases", () => {
  const raw = JSON.parse(
    readFileSync(resolve(process.cwd(), "fixtures/eval/dataset.v1.json"), "utf8"),
  );
  const v = validateEvalDataset(raw);
  if (!v.ok) throw new Error("dataset invalid");
  const dataset = v.dataset!;

  it("selects 20–30 Dev/Val cases without Test or family duplicates", () => {
    const manifest = selectLivePilotCases(dataset);
    expect(manifest.test_split_used).toBe(false);
    expect(manifest.cases.length).toBeGreaterThanOrEqual(20);
    expect(manifest.cases.length).toBeLessThanOrEqual(30);
    expect(manifest.cases.every((c) => c.split === "dev" || c.split === "val")).toBe(
      true,
    );
    const families = manifest.cases.map((c) => c.family_id);
    expect(new Set(families).size).toBe(families.length);
    for (const entry of manifest.cases) {
      const full = dataset.cases.find((c) => c.id === entry.case_id)!;
      expect(full.split).not.toBe("test");
    }
  });

  it("covers all four domains with non-unknown cells and all status labels", () => {
    const manifest = selectLivePilotCases(dataset);
    for (const d of ANALYSIS_DOMAINS) {
      expect(manifest.distribution.by_domain_non_unknown[d]).toBeGreaterThan(0);
    }
    expect(manifest.distribution.by_status_cells.worsened).toBeGreaterThan(0);
    expect(manifest.distribution.by_status_cells.improved).toBeGreaterThan(0);
    expect(manifest.distribution.by_status_cells.unchanged).toBeGreaterThan(0);
    expect(manifest.distribution.by_status_cells.unknown).toBeGreaterThan(0);
  });

  it("marks only internally_reviewed as approved for primary scoring", () => {
    const manifest = selectLivePilotCases(dataset);
    for (const c of manifest.cases) {
      expect(c.label_approved_for_scoring).toBe(
        c.review_status === "internally_reviewed",
      );
    }
    // Prefer reviewed labels; drafts only appear if reviewed pool cannot fill.
    expect(
      manifest.distribution.internally_reviewed_count +
        manifest.distribution.draft_count,
    ).toBe(manifest.cases.length);
  });

  it("matches committed live-pilot.v1.manifest.json", () => {
    const committed = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "fixtures/eval/live-pilot.v1.manifest.json"),
        "utf8",
      ),
    );
    const fresh = selectLivePilotCases(dataset);
    expect(fresh.cases.map((c) => c.case_id)).toEqual(
      committed.cases.map((c: { case_id: string }) => c.case_id),
    );
    expect(committed.test_split_used).toBe(false);
  });
});
