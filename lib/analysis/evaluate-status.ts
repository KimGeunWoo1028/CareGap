import {
  ANALYSIS_DOMAINS,
  type AnalysisDomain,
  type ChangeStatus,
  type ValidatedAnalysis,
} from "@/lib/analysis/types";

export type ExpectedStatusMap = Record<AnalysisDomain, ChangeStatus>;

export type StatusEvalResult = {
  case_id: string;
  exact_match: boolean;
  domain_results: Array<{
    domain: AnalysisDomain;
    expected: ChangeStatus;
    actual: ChangeStatus | null;
    match: boolean;
  }>;
  /** Citation/schema validity is out of scope for this scorer. */
  notes: string;
};

/**
 * Compares expected domain statuses to a validated analysis.
 * Does not measure whether quotes semantically support the claim —
 * only status label agreement for evaluation fixtures.
 */
export function scoreStatusAgreement(
  caseId: string,
  expected: ExpectedStatusMap,
  analysis: ValidatedAnalysis,
): StatusEvalResult {
  const byDomain = new Map(
    analysis.changes.map((change) => [change.domain, change.status]),
  );
  const domain_results = ANALYSIS_DOMAINS.map((domain) => {
    const actual = byDomain.get(domain) ?? null;
    const want = expected[domain];
    return {
      domain,
      expected: want,
      actual,
      match: actual === want,
    };
  });
  return {
    case_id: caseId,
    exact_match: domain_results.every((row) => row.match),
    domain_results,
    notes:
      "Status label agreement only. Quote substring checks and semantic support of claims are separate.",
  };
}

export function summarizeStatusScores(results: StatusEvalResult[]): {
  total: number;
  exact_matches: number;
  domain_accuracy: Record<AnalysisDomain, { correct: number; total: number }>;
} {
  const domain_accuracy = Object.fromEntries(
    ANALYSIS_DOMAINS.map((domain) => [domain, { correct: 0, total: 0 }]),
  ) as Record<AnalysisDomain, { correct: number; total: number }>;

  for (const result of results) {
    for (const row of result.domain_results) {
      domain_accuracy[row.domain].total += 1;
      if (row.match) domain_accuracy[row.domain].correct += 1;
    }
  }

  return {
    total: results.length,
    exact_matches: results.filter((r) => r.exact_match).length,
    domain_accuracy,
  };
}
