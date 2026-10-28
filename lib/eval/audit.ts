import { ANALYSIS_DOMAINS } from "@/lib/analysis/types";
import { countLabelDistribution } from "@/lib/eval/baselines";
import type { EvalCase, EvalDataset, EvalSplit } from "@/lib/eval/types";

export type DatasetAudit = {
  dataset_version: string;
  case_count: number;
  cell_count: number;
  unknown_share: number;
  label_distribution: ReturnType<typeof countLabelDistribution>;
  split_counts: Record<EvalSplit, number>;
  review_status_counts: Record<string, number>;
  family_split_violations: Array<{ family_id: string; splits: string[] }>;
  ambiguity_flags: Array<{ case_id: string; reason: string }>;
  interpretation_limits: string[];
};

const AMBIGUOUS_SCENARIOS = new Set([
  "conflicting",
  "temporal_ambiguity",
  "hearsay_or_speculation",
  "ambiguous_causality",
]);

export function auditEvalDataset(dataset: EvalDataset): DatasetAudit {
  const label_distribution = countLabelDistribution(dataset);
  const split_counts: Record<EvalSplit, number> = {
    dev: 0,
    val: 0,
    test: 0,
  };
  const review_status_counts: Record<string, number> = {};
  const familySplits = new Map<string, Set<string>>();
  const ambiguity_flags: DatasetAudit["ambiguity_flags"] = [];

  for (const c of dataset.cases) {
    split_counts[c.split] += 1;
    review_status_counts[c.review_status] =
      (review_status_counts[c.review_status] ?? 0) + 1;
    const set = familySplits.get(c.family_id) ?? new Set<string>();
    set.add(c.split);
    familySplits.set(c.family_id, set);

    if (c.scenarios.some((s) => AMBIGUOUS_SCENARIOS.has(s))) {
      ambiguity_flags.push({
        case_id: c.id,
        reason: `ambiguous_scenario:${c.scenarios.join(",")}`,
      });
    }
    if (
      !c.label_rationale.trim() ||
      c.label_rationale.length < 12
    ) {
      ambiguity_flags.push({
        case_id: c.id,
        reason: "thin_label_rationale",
      });
    }
    const nonUnknown = ANALYSIS_DOMAINS.filter(
      (d) => c.expected_status[d] !== "unknown",
    );
    if (
      nonUnknown.length > 0 &&
      (!c.expected_quotes || c.expected_quotes.length === 0) &&
      c.review_status === "draft"
    ) {
      ambiguity_flags.push({
        case_id: c.id,
        reason: "non_unknown_without_quote_hints",
      });
    }
  }

  const family_split_violations = [...familySplits.entries()]
    .filter(([, splits]) => splits.size > 1)
    .map(([family_id, splits]) => ({
      family_id,
      splits: [...splits].sort(),
    }));

  return {
    dataset_version: dataset.dataset_version,
    case_count: dataset.cases.length,
    cell_count: label_distribution.total_cells,
    unknown_share: label_distribution.unknown_share,
    label_distribution,
    split_counts,
    review_status_counts,
    family_split_violations,
    ambiguity_flags,
    interpretation_limits: [
      "Labels are internal synthetic judgments, not expert_reviewed clinical truth.",
      "High overall accuracy is trivial when unknown dominates gold labels.",
      "Judge models primarily on worsened precision/recall, missed worsening, and false reassurance — not overall accuracy alone.",
      "Identity-stub or baseline scores are calibration references, not Live model performance.",
      "Replay single-case fixtures must never be reported as dataset-wide model accuracy.",
    ],
  };
}

export function summarizeCaseGoldQuality(c: EvalCase): {
  case_id: string;
  previous_meaning: string;
  current_meaning: string;
  change_judgment: string;
  insufficiency_reason: string | null;
  citation_structural_ok: boolean;
  citation_semantic_review_required: boolean;
} {
  const nonUnknown = ANALYSIS_DOMAINS.filter(
    (d) => c.expected_status[d] !== "unknown",
  );
  const quotes = c.expected_quotes ?? [];
  const structural =
    quotes.length === 0 ||
    quotes.every((q) => c[q.side].body.includes(q.quote));
  return {
    case_id: c.id,
    previous_meaning: c.previous.body.slice(0, 120),
    current_meaning: c.current.body.slice(0, 120),
    change_judgment: c.label_rationale,
    insufficiency_reason:
      nonUnknown.length === 0
        ? "All domains unknown — insufficient comparable facts or intentional withhold."
        : null,
    citation_structural_ok: structural,
    citation_semantic_review_required: quotes.length > 0 || nonUnknown.length > 0,
  };
}
