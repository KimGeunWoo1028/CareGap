import replayFixture from "@/fixtures/replay-analysis.json";
import { ApiError } from "@/lib/api/errors";
import {
  formatRecommendationsMessage,
  matchWelfarePrograms,
} from "@/lib/matching/match-programs";
import type {
  AnalysisEngineResult,
  AnalysisNote,
  ValidatedAnalysis,
  WelfareProgram,
} from "@/lib/analysis/types";
import { validateAnalysisOutput } from "@/lib/analysis/validate";

export const REPLAY_CASE_ALIAS = "합성-001";

export const REPLAY_PREVIOUS_NOTE = {
  occurred_on: "2026-09-10",
  body: "혼자 식사도 잘하시고 가까운 가게까지 걸어가 장을 볼 수 있음.",
} as const;

export const REPLAY_CURRENT_NOTE = {
  occurred_on: "2026-10-10",
  body: "최근 다리가 불편해 장을 보기 어렵고 식사를 자주 거르심.",
} as const;

export const REPLAY_FIXTURE_PREVIOUS_NOTE_ID =
  "11111111-1111-4111-8111-111111111111";
export const REPLAY_FIXTURE_CURRENT_NOTE_ID =
  "22222222-2222-4222-8222-222222222222";

export function isReplayEligibleInput(
  caseAlias: string,
  previous: AnalysisNote,
  current: AnalysisNote,
): boolean {
  return (
    caseAlias === REPLAY_CASE_ALIAS &&
    previous.occurred_on === REPLAY_PREVIOUS_NOTE.occurred_on &&
    previous.body === REPLAY_PREVIOUS_NOTE.body &&
    current.occurred_on === REPLAY_CURRENT_NOTE.occurred_on &&
    current.body === REPLAY_CURRENT_NOTE.body
  );
}

function substituteFixtureNoteIds(
  fixture: ValidatedAnalysis,
  previousNoteId: string,
  currentNoteId: string,
): ValidatedAnalysis {
  const replaceId = (value: string): string => {
    if (value === REPLAY_FIXTURE_PREVIOUS_NOTE_ID) return previousNoteId;
    if (value === REPLAY_FIXTURE_CURRENT_NOTE_ID) return currentNoteId;
    return value;
  };

  return {
    ...fixture,
    changes: fixture.changes.map((change) => ({
      ...change,
      evidence_previous: change.evidence_previous
        ? {
            note_id: replaceId(change.evidence_previous.note_id),
            quote: change.evidence_previous.quote,
          }
        : null,
      evidence_current: change.evidence_current
        ? {
            note_id: replaceId(change.evidence_current.note_id),
            quote: change.evidence_current.quote,
          }
        : null,
    })),
  };
}

/**
 * Deterministic replay analysis: no OpenAI call. Only the fixed demo pair
 * (alias + dates + exact bodies) is supported; otherwise REPLAY_UNAVAILABLE.
 */
export function runReplayAnalysis(input: {
  caseAlias: string;
  previous: AnalysisNote;
  current: AnalysisNote;
  programs: readonly WelfareProgram[];
}): AnalysisEngineResult {
  if (
    !isReplayEligibleInput(input.caseAlias, input.previous, input.current)
  ) {
    throw new ApiError("REPLAY_UNAVAILABLE");
  }

  const substituted = substituteFixtureNoteIds(
    replayFixture as ValidatedAnalysis,
    input.previous.note_id,
    input.current.note_id,
  );

  const analysis = validateAnalysisOutput(
    substituted,
    input.previous,
    input.current,
  );
  const recommendations = matchWelfarePrograms(analysis, input.programs);

  return {
    mode: "replay",
    model: null,
    analysis,
    recommendations,
    recommendations_message: formatRecommendationsMessage(recommendations),
  };
}
