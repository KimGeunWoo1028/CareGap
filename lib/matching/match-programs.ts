import {
  ANALYSIS_DOMAINS,
  type AnalysisDomain,
  type ProgramRecommendation,
  type ValidatedAnalysis,
  type WelfareProgram,
} from "@/lib/analysis/types";

const DOMAIN_LABEL: Record<AnalysisDomain, string> = {
  meal: "식사",
  mobility: "거동",
  health: "건강",
  environment: "생활환경",
};

export const EMPTY_RECOMMENDATIONS_MESSAGE =
  "확인할 사업 후보가 없습니다. 원문을 검토해 주세요.";

const DAEGU_DISPLAY_CHECK = "대구 거주 및 구·군별 서비스 확인 필요";

function worsenedDomains(analysis: ValidatedAnalysis): Set<AnalysisDomain> {
  const set = new Set<AnalysisDomain>();
  for (const change of analysis.changes) {
    if (change.status === "worsened") {
      set.add(change.domain);
    }
  }
  return set;
}

function orderedIntersection(
  tags: string[],
  worsened: Set<AnalysisDomain>,
): AnalysisDomain[] {
  const tagSet = new Set(tags);
  return ANALYSIS_DOMAINS.filter(
    (domain) => worsened.has(domain) && tagSet.has(domain),
  );
}

/** Builds the deterministic match-reason caption from matched domains. */
export function formatRecommendationsMessage(
  recommendations: ProgramRecommendation[],
): string {
  if (recommendations.length === 0) {
    return EMPTY_RECOMMENDATIONS_MESSAGE;
  }

  const domains = new Set<AnalysisDomain>();
  for (const item of recommendations) {
    for (const domain of item.matched_domains) {
      domains.add(domain);
    }
  }
  const labels = ANALYSIS_DOMAINS.filter((d) => domains.has(d)).map(
    (d) => DOMAIN_LABEL[d],
  );
  return `${labels.join("·")} 변화와 관련된 사업 후보`;
}

function eligibilityChecksFor(program: WelfareProgram): string[] {
  const checks = [...program.eligibility_checks];
  if (
    program.region === "daegu" &&
    !checks.includes(DAEGU_DISPLAY_CHECK)
  ) {
    checks.unshift(DAEGU_DISPLAY_CHECK);
  }
  return checks;
}

/**
 * Deterministic welfare-program matching from worsened domains only.
 * AI never invents programs; only active catalog rows are considered.
 */
export function matchWelfarePrograms(
  analysis: ValidatedAnalysis,
  programs: readonly WelfareProgram[],
): ProgramRecommendation[] {
  const worsened = worsenedDomains(analysis);
  if (worsened.size === 0) {
    return [];
  }

  const scored = programs
    .filter((program) => program.active)
    .map((program) => {
      const matched_domains = orderedIntersection(program.tags, worsened);
      return {
        program,
        matched_domains,
        score: matched_domains.length,
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.program.id.localeCompare(b.program.id);
    })
    .slice(0, 2);

  return scored.map(({ program, matched_domains }) => ({
    program_id: program.id,
    name: program.name,
    matched_domains,
    summary: program.summary,
    eligibility_status: "unverified" as const,
    eligibility_checks: eligibilityChecksFor(program),
    region: program.region,
    source_url: program.source_url,
    source_checked_on: program.source_checked_on,
    catalog_version: program.catalog_version,
  }));
}
