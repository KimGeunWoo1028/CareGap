import { ApiError } from "@/lib/api/errors";
import { runLiveAnalysis, type LiveOpenAiConfig } from "@/lib/analysis/live";
import { runReplayAnalysis } from "@/lib/analysis/replay";
import type {
  AnalysisEngineResult,
  AnalysisNote,
  WelfareProgram,
} from "@/lib/analysis/types";

export type RunAnalysisInput = {
  mode: "live" | "replay";
  caseAlias: string;
  previous: AnalysisNote;
  current: AnalysisNote;
  programs: readonly WelfareProgram[];
  openai?: LiveOpenAiConfig;
};

/**
 * Phase 3 analysis entry point for Phase 4 APIs.
 * Chooses live vs replay; both share validator + matching. No silent mode switch.
 */
export async function runAnalysis(
  input: RunAnalysisInput,
): Promise<AnalysisEngineResult> {
  if (input.previous.note_id === input.current.note_id) {
    throw new ApiError("VALIDATION_ERROR", "서로 다른 상담 기록이 필요합니다.");
  }
  if (input.previous.occurred_on === input.current.occurred_on) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "서로 다른 날짜의 상담 기록이 필요합니다.",
    );
  }

  if (input.mode === "replay") {
    return runReplayAnalysis({
      caseAlias: input.caseAlias,
      previous: input.previous,
      current: input.current,
      programs: input.programs,
    });
  }

  if (!input.openai) {
    throw new ApiError("AI_UNAVAILABLE", undefined, {
      reason: "missing_openai_config",
    });
  }

  return runLiveAnalysis({
    previous: input.previous,
    current: input.current,
    programs: input.programs,
    openai: input.openai,
  });
}
