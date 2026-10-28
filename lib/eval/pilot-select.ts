import {
  ANALYSIS_DOMAINS,
  CHANGE_STATUSES,
  type AnalysisDomain,
  type ChangeStatus,
} from "@/lib/analysis/types";
import type { EvalCase, EvalDataset } from "@/lib/eval/types";

const AMBIGUOUS = new Set([
  "conflicting",
  "temporal_ambiguity",
  "hearsay_or_speculation",
  "ambiguous_causality",
]);

export type PilotCaseEntry = {
  case_id: string;
  split: "dev" | "val";
  family_id: string;
  review_status: string;
  scenarios: string[];
  expected_status: EvalCase["expected_status"];
  label_rationale: string;
  ambiguous: boolean;
  label_approved_for_scoring: boolean;
  selection_reason: string;
};

export type PilotManifest = {
  pilot_id: string;
  pilot_version: string;
  parent_dataset_version: string;
  created_for: "controlled_live_pilot";
  splits_allowed: ["dev", "val"];
  test_split_used: false;
  target_size: { min: number; max: number };
  cases: PilotCaseEntry[];
  distribution: {
    by_status_cells: Record<ChangeStatus, number>;
    by_domain_non_unknown: Record<AnalysisDomain, number>;
    ambiguous_count: number;
    internally_reviewed_count: number;
    draft_count: number;
  };
  notes: string[];
};

function cellStatuses(c: EvalCase): ChangeStatus[] {
  return ANALYSIS_DOMAINS.map((d) => c.expected_status[d]);
}

function hasStatus(c: EvalCase, st: ChangeStatus): boolean {
  return cellStatuses(c).includes(st);
}

function scoreCandidate(
  c: EvalCase,
  needed: Record<ChangeStatus, number>,
): number {
  let score = 0;
  if (c.review_status === "internally_reviewed") score += 5;
  if (c.review_status === "draft") score += 1;
  for (const st of CHANGE_STATUSES) {
    if (needed[st] > 0 && hasStatus(c, st)) score += 3;
  }
  for (const d of ANALYSIS_DOMAINS) {
    if (c.expected_status[d] !== "unknown") score += 1;
  }
  if (c.scenarios.some((s) => AMBIGUOUS.has(s))) score -= 1;
  return score;
}

/**
 * Deterministic Dev/Val pilot selection (no Test). One case per family.
 * Draft labels are included only when marked not approved for scoring.
 */
export function selectLivePilotCases(
  dataset: EvalDataset,
  options?: { min?: number; max?: number },
): PilotManifest {
  const min = options?.min ?? 20;
  const max = options?.max ?? 30;
  const pool = dataset.cases.filter(
    (c) => c.split === "dev" || c.split === "val",
  );
  const needed: Record<ChangeStatus, number> = {
    worsened: 6,
    improved: 4,
    unchanged: 5,
    unknown: 4,
  };

  const selected: EvalCase[] = [];
  const usedFamilies = new Set<string>();

  const take = (
    pred: (c: EvalCase) => boolean,
    reason: string,
    options?: { quota?: ChangeStatus; maxTake?: number },
  ) => {
    const ranked = pool
      .filter(
        (c) =>
          !usedFamilies.has(c.family_id) &&
          !selected.some((s) => s.id === c.id) &&
          pred(c),
      )
      .sort(
        (a, b) =>
          scoreCandidate(b, needed) - scoreCandidate(a, needed) ||
          a.id.localeCompare(b.id),
      );
    let taken = 0;
    for (const c of ranked) {
      if (selected.length >= max) break;
      if (options?.maxTake != null && taken >= options.maxTake) break;
      if (options?.quota != null && needed[options.quota] <= 0) break;
      selected.push(c);
      usedFamilies.add(c.family_id);
      taken += 1;
      // Count one toward the pass quota (case-level), not every domain cell.
      if (options?.quota != null && needed[options.quota] > 0) {
        needed[options.quota] -= 1;
      }
      void reason;
    }
  };

  // Quota-bounded passes so later statuses are not starved by max.
  take((c) => hasStatus(c, "worsened"), "fill_worsened", {
    quota: "worsened",
    maxTake: 8,
  });
  take((c) => hasStatus(c, "improved"), "fill_improved", {
    quota: "improved",
    maxTake: 6,
  });
  take((c) => hasStatus(c, "unchanged"), "fill_unchanged", {
    quota: "unchanged",
    maxTake: 8,
  });
  take(
    (c) =>
      ANALYSIS_DOMAINS.every((d) => c.expected_status[d] === "unknown"),
    "fill_all_unknown",
    { quota: "unknown", maxTake: 6 },
  );
  take(() => true, "fill_remainder");

  while (selected.length > max) selected.pop();
  if (selected.length < min) {
    throw new Error(
      `Pilot selection under-filled: got ${selected.length}, need >= ${min}`,
    );
  }

  selected.sort((a, b) => a.id.localeCompare(b.id));

  const by_status_cells = Object.fromEntries(
    CHANGE_STATUSES.map((s) => [s, 0]),
  ) as Record<ChangeStatus, number>;
  const by_domain_non_unknown = Object.fromEntries(
    ANALYSIS_DOMAINS.map((d) => [d, 0]),
  ) as Record<AnalysisDomain, number>;

  const cases: PilotCaseEntry[] = selected.map((c) => {
    for (const d of ANALYSIS_DOMAINS) {
      by_status_cells[c.expected_status[d]] += 1;
      if (c.expected_status[d] !== "unknown") by_domain_non_unknown[d] += 1;
    }
    const ambiguous = c.scenarios.some((s) => AMBIGUOUS.has(s));
    const label_approved_for_scoring = c.review_status === "internally_reviewed";
    return {
      case_id: c.id,
      split: c.split as "dev" | "val",
      family_id: c.family_id,
      review_status: c.review_status,
      scenarios: c.scenarios,
      expected_status: c.expected_status,
      label_rationale: c.label_rationale,
      ambiguous,
      label_approved_for_scoring,
      selection_reason: label_approved_for_scoring
        ? "internally_reviewed_balanced_pick"
        : "draft_included_not_approved_for_primary_scoring",
    };
  });

  return {
    pilot_id: "live-pilot-v1",
    pilot_version: "1.0.0",
    parent_dataset_version: dataset.dataset_version,
    created_for: "controlled_live_pilot",
    splits_allowed: ["dev", "val"],
    test_split_used: false,
    target_size: { min, max },
    cases,
    distribution: {
      by_status_cells,
      by_domain_non_unknown,
      ambiguous_count: cases.filter((c) => c.ambiguous).length,
      internally_reviewed_count: cases.filter(
        (c) => c.review_status === "internally_reviewed",
      ).length,
      draft_count: cases.filter((c) => c.review_status === "draft").length,
    },
    notes: [
      "Test split excluded.",
      "Draft labels must not be treated as approved gold for primary pass/fail.",
      "Ambiguous cases are scored separately / flagged.",
      "No Live accuracy numbers until an approved paid run completes.",
    ],
  };
}
