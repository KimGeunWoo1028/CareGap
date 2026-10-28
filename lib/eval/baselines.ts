import {
  ANALYSIS_DOMAINS,
  CHANGE_STATUSES,
  type AnalysisDomain,
  type ChangeStatus,
} from "@/lib/analysis/types";
import {
  collectObservations,
  computeStatusMetrics,
  buildConfusion,
  type PairObservation,
} from "@/lib/eval/metrics";
import type {
  EvalDataset,
  ExpectedStatusMap,
  PredictionFile,
} from "@/lib/eval/types";

export type BaselineName =
  | "always_unknown"
  | "majority_class"
  | "majority_per_domain"
  | "stratified_random";

/** Mulberry32 — deterministic RNG for stratified baseline. */
export function createSeededRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function countLabelDistribution(dataset: EvalDataset): {
  overall: Record<ChangeStatus, number>;
  by_domain: Record<AnalysisDomain, Record<ChangeStatus, number>>;
  total_cells: number;
  unknown_share: number;
} {
  const overall = Object.fromEntries(
    CHANGE_STATUSES.map((s) => [s, 0]),
  ) as Record<ChangeStatus, number>;
  const by_domain = Object.fromEntries(
    ANALYSIS_DOMAINS.map((d) => [
      d,
      Object.fromEntries(CHANGE_STATUSES.map((s) => [s, 0])),
    ]),
  ) as Record<AnalysisDomain, Record<ChangeStatus, number>>;

  for (const c of dataset.cases) {
    for (const domain of ANALYSIS_DOMAINS) {
      const st = c.expected_status[domain];
      overall[st] += 1;
      by_domain[domain][st] += 1;
    }
  }
  const total_cells = dataset.cases.length * ANALYSIS_DOMAINS.length;
  return {
    overall,
    by_domain,
    total_cells,
    unknown_share: total_cells === 0 ? 0 : overall.unknown / total_cells,
  };
}

function majorityStatus(counts: Record<ChangeStatus, number>): ChangeStatus {
  let best: ChangeStatus = "unknown";
  let bestN = -1;
  for (const st of CHANGE_STATUSES) {
    if (counts[st] > bestN) {
      best = st;
      bestN = counts[st];
    }
  }
  return best;
}

function sampleStatus(
  rng: () => number,
  counts: Record<ChangeStatus, number>,
): ChangeStatus {
  const total = CHANGE_STATUSES.reduce((a, s) => a + counts[s], 0);
  if (total === 0) return "unknown";
  let r = rng() * total;
  for (const st of CHANGE_STATUSES) {
    r -= counts[st];
    if (r < 0) return st;
  }
  return "unknown";
}

export function buildBaselinePredictions(
  dataset: EvalDataset,
  name: BaselineName,
  seed = 42,
): PredictionFile {
  const dist = countLabelDistribution(dataset);
  const globalMaj = majorityStatus(dist.overall);
  const perDomainMaj = Object.fromEntries(
    ANALYSIS_DOMAINS.map((d) => [d, majorityStatus(dist.by_domain[d])]),
  ) as Record<AnalysisDomain, ChangeStatus>;
  const rng = createSeededRng(seed);

  const predictions = dataset.cases.map((c) => {
    let predicted_status: ExpectedStatusMap;
    if (name === "always_unknown") {
      predicted_status = {
        meal: "unknown",
        mobility: "unknown",
        health: "unknown",
        environment: "unknown",
      };
    } else if (name === "majority_class") {
      predicted_status = {
        meal: globalMaj,
        mobility: globalMaj,
        health: globalMaj,
        environment: globalMaj,
      };
    } else if (name === "majority_per_domain") {
      predicted_status = {
        meal: perDomainMaj.meal,
        mobility: perDomainMaj.mobility,
        health: perDomainMaj.health,
        environment: perDomainMaj.environment,
      };
    } else {
      predicted_status = {
        meal: sampleStatus(rng, dist.by_domain.meal),
        mobility: sampleStatus(rng, dist.by_domain.mobility),
        health: sampleStatus(rng, dist.by_domain.health),
        environment: sampleStatus(rng, dist.by_domain.environment),
      };
    }
    return { case_id: c.id, predicted_status };
  });

  return {
    prediction_source: "synthetic_stub",
    model_id: `baseline:${name}`,
    prompt_version: null,
    schema_version: "1.0",
    dataset_version: dataset.dataset_version,
    predictions,
  };
}

export type BaselineScorecard = {
  name: BaselineName;
  seed: number | null;
  overall_status_accuracy: ReturnType<typeof computeStatusMetrics>["overall_status_accuracy"];
  macro_f1: ReturnType<typeof computeStatusMetrics>["macro_f1"];
  worsened_precision: ReturnType<typeof computeStatusMetrics>["worsened_precision"];
  worsened_recall: ReturnType<typeof computeStatusMetrics>["worsened_recall"];
  missed_worsening_rate: ReturnType<typeof computeStatusMetrics>["missed_worsening_rate"];
  false_worsening_rate: ReturnType<typeof computeStatusMetrics>["false_worsening_rate"];
  false_reassurance_rate: ReturnType<typeof computeStatusMetrics>["false_reassurance_rate"];
  unknown_detection_rate: ReturnType<typeof computeStatusMetrics>["unknown_detection_rate"];
  confusion_overall: ReturnType<typeof buildConfusion>["overall"];
  note: string;
};

export function scoreBaseline(
  dataset: EvalDataset,
  name: BaselineName,
  seed = 42,
): BaselineScorecard {
  const pred = buildBaselinePredictions(dataset, name, seed);
  const pairs = dataset.cases.map((c) => {
    const p = pred.predictions.find((x) => x.case_id === c.id)!;
    return {
      case_id: c.id,
      gold: c.expected_status,
      pred: p.predicted_status,
    };
  });
  const obs: PairObservation[] = collectObservations(pairs);
  const metrics = computeStatusMetrics(obs);
  const { overall } = buildConfusion(obs);
  return {
    name,
    seed: name === "stratified_random" ? seed : null,
    overall_status_accuracy: metrics.overall_status_accuracy,
    macro_f1: metrics.macro_f1,
    worsened_precision: metrics.worsened_precision,
    worsened_recall: metrics.worsened_recall,
    missed_worsening_rate: metrics.missed_worsening_rate,
    false_worsening_rate: metrics.false_worsening_rate,
    false_reassurance_rate: metrics.false_reassurance_rate,
    unknown_detection_rate: metrics.unknown_detection_rate,
    confusion_overall: overall,
    note:
      "Baseline stub only — not a Live model. High accuracy under unknown-heavy gold is expected and not a quality claim.",
  };
}

export function scoreAllBaselines(dataset: EvalDataset, seed = 42): BaselineScorecard[] {
  return (
    [
      "always_unknown",
      "majority_class",
      "majority_per_domain",
      "stratified_random",
    ] as BaselineName[]
  ).map((name) => scoreBaseline(dataset, name, seed));
}
