import {
  ANALYSIS_DOMAINS,
  CHANGE_STATUSES,
  type AnalysisDomain,
  type ChangeStatus,
} from "@/lib/analysis/types";
import type {
  ExpectedStatusMap,
  MetricValue,
} from "@/lib/eval/types";

export const EVALUATION_VERSION = "1.1.0";

export const METRIC_DEFINITIONS: Record<string, string> = {
  overall_status_accuracy:
    "Fraction of (case, domain) pairs where predicted status equals gold.",
  macro_f1:
    "Unweighted mean of per-status F1 over worsened/improved/unchanged/unknown.",
  worsened_precision:
    "TP_worsened / (TP_worsened + FP_worsened); N/A if denominator 0.",
  worsened_recall:
    "TP_worsened / (TP_worsened + FN_worsened); N/A if denominator 0.",
  false_worsening_rate:
    "Predictions of worsened when gold is not worsened, over non-worsened gold cells.",
  missed_worsening_rate:
    "Gold worsened predicted as something else (incl. unknown), over gold worsened cells.",
  false_reassurance_rate:
    "Gold worsened predicted as unchanged or improved (excludes unknown), over gold worsened.",
  unknown_usage_rate: "Share of predictions that are unknown.",
  unknown_detection_rate:
    "Recall of gold unknown (pred unknown / gold unknown); N/A if no gold unknown.",
  coverage:
    "evaluated_cases / total_cases in dataset after matching predictions.",
  citation_presence_rate:
    "Share of provided evidence quotes that are non-empty (structural only).",
  citation_id_consistency_rate:
    "Share of evidence items whose note_id matches the case side when note_id given.",
  semantic_citation_review_items:
    "Count of cases flagged for manual semantic citation review — never auto-PASS.",
};

export type Confusion = Record<ChangeStatus, Record<ChangeStatus, number>>;

export function emptyConfusion(): Confusion {
  const m = {} as Confusion;
  for (const g of CHANGE_STATUSES) {
    m[g] = {} as Record<ChangeStatus, number>;
    for (const p of CHANGE_STATUSES) {
      m[g][p] = 0;
    }
  }
  return m;
}

export type PairObservation = {
  case_id: string;
  domain: AnalysisDomain;
  gold: ChangeStatus;
  pred: ChangeStatus;
};

export function collectObservations(
  pairs: Array<{
    case_id: string;
    gold: ExpectedStatusMap;
    pred: ExpectedStatusMap;
  }>,
): PairObservation[] {
  const out: PairObservation[] = [];
  for (const row of pairs) {
    for (const domain of ANALYSIS_DOMAINS) {
      out.push({
        case_id: row.case_id,
        domain,
        gold: row.gold[domain],
        pred: row.pred[domain],
      });
    }
  }
  return out;
}

export function buildConfusion(obs: PairObservation[]): {
  overall: Confusion;
  by_domain: Record<AnalysisDomain, Confusion>;
} {
  const overall = emptyConfusion();
  const by_domain = Object.fromEntries(
    ANALYSIS_DOMAINS.map((d) => [d, emptyConfusion()]),
  ) as Record<AnalysisDomain, Confusion>;
  for (const o of obs) {
    overall[o.gold][o.pred] += 1;
    by_domain[o.domain][o.gold][o.pred] += 1;
  }
  return { overall, by_domain };
}

function safeDiv(num: number, den: number): MetricValue {
  if (den === 0) return "N/A";
  return num / den;
}

function f1(precision: MetricValue, recall: MetricValue): MetricValue {
  if (precision === "N/A" || recall === "N/A") return "N/A";
  const den = precision + recall;
  if (den === 0) return "N/A";
  return (2 * precision * recall) / den;
}

export function computeStatusMetrics(obs: PairObservation[]): {
  overall_status_accuracy: MetricValue;
  macro_f1: MetricValue;
  worsened_precision: MetricValue;
  worsened_recall: MetricValue;
  false_worsening_rate: MetricValue;
  missed_worsening_rate: MetricValue;
  false_reassurance_rate: MetricValue;
  unknown_usage_rate: MetricValue;
  unknown_detection_rate: MetricValue;
  per_status: Record<
    ChangeStatus,
    { precision: MetricValue; recall: MetricValue; f1: MetricValue; support: number }
  >;
} {
  const total = obs.length;
  const correct = obs.filter((o) => o.gold === o.pred).length;

  const per_status = {} as Record<
    ChangeStatus,
    { precision: MetricValue; recall: MetricValue; f1: MetricValue; support: number }
  >;

  for (const st of CHANGE_STATUSES) {
    const tp = obs.filter((o) => o.gold === st && o.pred === st).length;
    const fp = obs.filter((o) => o.gold !== st && o.pred === st).length;
    const fn = obs.filter((o) => o.gold === st && o.pred !== st).length;
    const precision = safeDiv(tp, tp + fp);
    const recall = safeDiv(tp, tp + fn);
    const support = tp + fn;
    // Supported class with no positive predictions → F1 0 (not dropped from macro).
    let f1Value = f1(precision, recall);
    if (f1Value === "N/A" && support > 0) f1Value = 0;
    per_status[st] = {
      precision,
      recall,
      f1: f1Value,
      support,
    };
  }

  const f1s = CHANGE_STATUSES.map((st) => per_status[st].f1).filter(
    (v): v is number => typeof v === "number",
  );
  const macro_f1 =
    f1s.length === 0 ? ("N/A" as const) : f1s.reduce((a, b) => a + b, 0) / f1s.length;

  const goldWorsened = obs.filter((o) => o.gold === "worsened");
  const nonWorsenedGold = obs.filter((o) => o.gold !== "worsened");
  const falseWorsening = nonWorsenedGold.filter((o) => o.pred === "worsened");
  const missedWorsening = goldWorsened.filter((o) => o.pred !== "worsened");
  const falseReassurance = goldWorsened.filter(
    (o) => o.pred === "unchanged" || o.pred === "improved",
  );
  const goldUnknown = obs.filter((o) => o.gold === "unknown");
  const detectedUnknown = goldUnknown.filter((o) => o.pred === "unknown");

  return {
    overall_status_accuracy: safeDiv(correct, total),
    macro_f1,
    worsened_precision: per_status.worsened.precision,
    worsened_recall: per_status.worsened.recall,
    false_worsening_rate: safeDiv(falseWorsening.length, nonWorsenedGold.length),
    missed_worsening_rate: safeDiv(missedWorsening.length, goldWorsened.length),
    false_reassurance_rate: safeDiv(falseReassurance.length, goldWorsened.length),
    unknown_usage_rate: safeDiv(
      obs.filter((o) => o.pred === "unknown").length,
      total,
    ),
    unknown_detection_rate: safeDiv(detectedUnknown.length, goldUnknown.length),
    per_status,
  };
}

export type EvidenceItem = {
  case_id: string;
  domain: AnalysisDomain;
  side: "previous" | "current";
  note_id?: string;
  quote: string;
  expected_note_id?: string;
};

export function computeCitationMetrics(items: EvidenceItem[]): {
  citation_presence_rate: MetricValue;
  citation_id_consistency_rate: MetricValue;
  semantic_citation_review_items: number;
} {
  if (items.length === 0) {
    return {
      citation_presence_rate: "N/A",
      citation_id_consistency_rate: "N/A",
      semantic_citation_review_items: 0,
    };
  }
  const present = items.filter((i) => i.quote.trim().length > 0).length;
  const withId = items.filter((i) => i.note_id && i.expected_note_id);
  const idOk = withId.filter((i) => i.note_id === i.expected_note_id).length;
  return {
    citation_presence_rate: present / items.length,
    citation_id_consistency_rate:
      withId.length === 0 ? "N/A" : idOk / withId.length,
    // Structural checks never certify semantic appropriateness.
    semantic_citation_review_items: items.length,
  };
}
