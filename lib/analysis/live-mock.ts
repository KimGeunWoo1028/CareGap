import {
  formatRecommendationsMessage,
  matchWelfarePrograms,
} from "@/lib/matching/match-programs";
import type {
  AnalysisEngineResult,
  AnalysisNote,
  WelfareProgram,
} from "@/lib/analysis/types";
import { validateAnalysisOutput } from "@/lib/analysis/validate";

/** Exact substring for citation checks — never invent text outside the note body. */
export function exactQuoteSnippet(body: string, maxChars = 24): string {
  if (body.length === 0) return body;
  return body.length <= maxChars ? body : body.slice(0, maxChars);
}

/**
 * Deterministic Live-path stand-in for web/API tests.
 * Does not call OpenAI. Still runs live+matching validation.
 * Enabled only when CARE_GAP_LIVE_MOCK=1 with ANALYSIS_MODE=live.
 */
export function buildMockLiveRawAnalysis(
  previous: AnalysisNote,
  current: AnalysisNote,
): unknown {
  const prevQuote = exactQuoteSnippet(previous.body);
  const currQuote = exactQuoteSnippet(current.body);
  const worsened =
    /불편|거르|어렵|위험|넘어|아프/.test(current.body) &&
    current.body !== previous.body;
  const bothEvidence =
    prevQuote && currQuote
      ? {
          evidence_previous: {
            note_id: previous.note_id,
            quote: prevQuote,
          },
          evidence_current: {
            note_id: current.note_id,
            quote: currQuote,
          },
        }
      : { evidence_previous: null, evidence_current: null };

  return {
    schema_version: "1.0",
    summary:
      "모의 Live 경로로 생성한 합성 비교 요약입니다. 실제 OpenAI 호출이 아닙니다.",
    changes: [
      {
        domain: "meal",
        status: worsened ? "worsened" : "unknown",
        explanation: worsened
          ? "현재 기록에서 식사·장보기 관련 어려움이 확인됩니다."
          : "식사 관련 변화를 확정하기 어렵습니다.",
        ...(worsened
          ? bothEvidence
          : { evidence_previous: null, evidence_current: null }),
      },
      {
        domain: "mobility",
        status: worsened ? "worsened" : "unknown",
        explanation: worsened
          ? "현재 기록에서 거동 관련 불편이 언급됩니다."
          : "거동 변화를 확정하기 어렵습니다.",
        ...(worsened
          ? bothEvidence
          : { evidence_previous: null, evidence_current: null }),
      },
      {
        domain: "health",
        status: "unknown",
        explanation: "건강 관련 정보가 부족합니다.",
        evidence_previous: null,
        evidence_current: null,
      },
      {
        domain: "environment",
        status: "unknown",
        explanation: "생활환경 관련 정보가 부족합니다.",
        evidence_previous: null,
        evidence_current: null,
      },
    ],
    questions: ["모의 분석입니다. 원문을 직접 확인해 주세요."],
  };
}

export function runMockLiveAnalysis(input: {
  previous: AnalysisNote;
  current: AnalysisNote;
  programs: readonly WelfareProgram[];
}): AnalysisEngineResult {
  const raw = buildMockLiveRawAnalysis(input.previous, input.current);
  const analysis = validateAnalysisOutput(raw, input.previous, input.current);
  const recommendations = matchWelfarePrograms(analysis, input.programs);
  return {
    mode: "live",
    model: "caregap-live-mock",
    analysis,
    recommendations,
    recommendations_message: formatRecommendationsMessage(recommendations),
  };
}

export function isLiveMockEnabled(
  source: NodeJS.ProcessEnv = process.env,
): boolean {
  return source.CARE_GAP_LIVE_MOCK === "1";
}
