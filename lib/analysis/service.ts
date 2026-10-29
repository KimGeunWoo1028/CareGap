import { ApiError, type ApiErrorCode } from "@/lib/api/errors";
import type {
  AnalysisDetail,
  AnalysisReview,
} from "@/lib/analysis/analysis-types";
import { runAnalysis } from "@/lib/analysis/run-analysis";
import {
  ANALYSIS_FAILURE_CODES,
  toStoredFailureCode,
} from "@/lib/analysis/rpc";
import {
  callStartAnalysis,
  finalizeAnalysisFailure,
  finalizeAnalysisSuccess,
  getAnalysisDetail,
  getAnalysisRowForOwner,
  getCaseAlias,
  getConsultationPair,
  insertReview,
  listActiveWelfarePrograms,
} from "@/lib/analysis/repository";
import type { AuthenticatedRequest } from "@/lib/auth/request-auth";
import { getServerEnv } from "@/lib/env";

/** Overall wall-clock budget after a new reservation (ARCHITECTURE.md). */
export const ANALYSIS_OVERALL_TIMEOUT_MS = 45_000;

export type CreateAnalysisOutcome = {
  httpStatus: 200 | 201 | 202;
  detail: AnalysisDetail;
};

function priorDetailsFrom(error: unknown): Record<string, unknown> {
  if (
    error &&
    typeof error === "object" &&
    "details" in error &&
    error.details &&
    typeof error.details === "object"
  ) {
    return error.details as Record<string, unknown>;
  }
  return {};
}

async function withOverallDeadline<T>(
  work: Promise<T>,
  analysisId: string,
  startedAt: number,
): Promise<T> {
  const remaining = ANALYSIS_OVERALL_TIMEOUT_MS - (Date.now() - startedAt);
  if (remaining <= 0) {
    throw new ApiError("TIMEOUT", undefined, {
      reason: "overall_deadline_ms",
      ms: ANALYSIS_OVERALL_TIMEOUT_MS,
      analysis_id: analysisId,
    });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new ApiError("TIMEOUT", undefined, {
              reason: "overall_deadline_ms",
              ms: ANALYSIS_OVERALL_TIMEOUT_MS,
              analysis_id: analysisId,
            }),
          );
        }, remaining);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function persistEngineFailure(input: {
  analysisId: string;
  ownerId: string;
  caseId: string;
  error: unknown;
}): Promise<never> {
  const failureCode = toStoredFailureCode(input.error);
  const priorDetails = priorDetailsFrom(input.error);

  let persisted = false;
  try {
    persisted = await finalizeAnalysisFailure({
      analysisId: input.analysisId,
      ownerId: input.ownerId,
      caseId: input.caseId,
      failureCode,
    });
  } catch {
    throw new ApiError("SERVICE_UNAVAILABLE", undefined, {
      ...priorDetails,
      analysis_id: input.analysisId,
      recovery: "failure_persist_unavailable",
    });
  }

  if (!persisted) {
    throw new ApiError("SERVICE_UNAVAILABLE", undefined, {
      ...priorDetails,
      analysis_id: input.analysisId,
      recovery: "failure_persist_race",
    });
  }

  throw new ApiError(failureCode, undefined, {
    ...priorDetails,
    analysis_id: input.analysisId,
  });
}

/**
 * Reserve via start_analysis, run Phase 3 engine only for newly created rows,
 * and conditionally persist with the service role.
 */
export async function createOrResumeAnalysis(
  auth: AuthenticatedRequest,
  caseId: string,
  idempotencyKey: string,
): Promise<CreateAnalysisOutcome> {
  const env = getServerEnv();
  const mode = env.ANALYSIS_MODE;
  const reservation = await callStartAnalysis(
    auth.db,
    caseId,
    idempotencyKey,
    mode,
  );

  if (!reservation.created) {
    if (reservation.status === "failed") {
      const failed = await getAnalysisRowForOwner(
        auth.db,
        reservation.analysis_id,
      );
      throw new ApiError("ANALYSIS_FAILED", undefined, {
        analysis_id: failed.id,
        failure_code: failed.failure_code,
      });
    }

    const detail = await getAnalysisDetail(auth.db, reservation.analysis_id);
    if (reservation.status === "processing") {
      return { httpStatus: 202, detail };
    }
    return { httpStatus: 200, detail };
  }

  const startedAt = Date.now();

  // New reservation — execute engine once within the overall deadline.
  const row = await getAnalysisRowForOwner(auth.db, reservation.analysis_id);
  if (row.owner_id !== auth.user.id || row.case_id !== caseId) {
    throw new ApiError("NOT_FOUND");
  }

  let caseAlias: string;
  let notes: Awaited<ReturnType<typeof getConsultationPair>>;
  let programs: Awaited<ReturnType<typeof listActiveWelfarePrograms>>;
  try {
    [caseAlias, notes, programs] = await withOverallDeadline(
      Promise.all([
        getCaseAlias(auth.db, caseId),
        getConsultationPair(
          auth.db,
          caseId,
          row.previous_note_id,
          row.current_note_id,
        ),
        listActiveWelfarePrograms(auth.db),
      ]),
      reservation.analysis_id,
      startedAt,
    );
  } catch (error) {
    // Prep/read failures (including overall TIMEOUT) must terminalize processing.
    return await persistEngineFailure({
      analysisId: reservation.analysis_id,
      ownerId: auth.user.id,
      caseId,
      error:
        error instanceof ApiError
          ? error
          : new ApiError("SERVICE_UNAVAILABLE", undefined, {
              reason: "prep_lookup_failed",
            }),
    });
  }

  let engine: Awaited<ReturnType<typeof runAnalysis>>;
  try {
    engine = await withOverallDeadline(
      runAnalysis({
        mode,
        caseAlias,
        previous: notes.previous,
        current: notes.current,
        programs,
        openai:
          mode === "live"
            ? {
                apiKey: env.OPENAI_API_KEY ?? "",
                model: env.OPENAI_MODEL ?? "caregap-live-mock",
                useMock: env.CARE_GAP_LIVE_MOCK === "1",
              }
            : undefined,
      }),
      reservation.analysis_id,
      startedAt,
    );
  } catch (error) {
    return await persistEngineFailure({
      analysisId: reservation.analysis_id,
      ownerId: auth.user.id,
      caseId,
      error,
    });
  }

  let saved: boolean;
  try {
    saved = await withOverallDeadline(
      finalizeAnalysisSuccess({
        analysisId: row.id,
        ownerId: auth.user.id,
        caseId,
        model: engine.model,
        result: {
          analysis: engine.analysis,
          recommendations: engine.recommendations,
        },
      }),
      reservation.analysis_id,
      startedAt,
    );
  } catch (error) {
    // Conditional UPDATE threw (DB outage). Attempt failure mark; distinguish recovery.
    return await persistEngineFailure({
      analysisId: reservation.analysis_id,
      ownerId: auth.user.id,
      caseId,
      error:
        error instanceof ApiError
          ? error
          : new ApiError("SERVICE_UNAVAILABLE", undefined, {
              reason: "success_persist_failed",
              analysis_id: reservation.analysis_id,
            }),
    });
  }

  if (!saved) {
    // Stale processing was terminalized (e.g. 60s TIMEOUT) — discard late result.
    const current = await getAnalysisDetail(auth.db, row.id);
    if (current.status === "failed") {
      const stored = current.failure_code;
      const code: ApiErrorCode =
        stored && ANALYSIS_FAILURE_CODES.has(stored as ApiErrorCode)
          ? (stored as ApiErrorCode)
          : "TIMEOUT";
      throw new ApiError(code, undefined, { analysis_id: current.id });
    }
    if (current.status === "succeeded") {
      return { httpStatus: 200, detail: current };
    }
    throw new ApiError("SERVICE_UNAVAILABLE", undefined, {
      analysis_id: row.id,
      recovery: "success_persist_race",
    });
  }

  return {
    httpStatus: 201,
    detail: await getAnalysisDetail(auth.db, row.id),
  };
}

export async function createAnalysisReview(
  auth: AuthenticatedRequest,
  analysisId: string,
  decision: AnalysisReview["decision"],
  note: string,
): Promise<AnalysisReview> {
  const row = await getAnalysisRowForOwner(auth.db, analysisId);

  if (row.status === "processing") {
    throw new ApiError("ANALYSIS_IN_PROGRESS");
  }
  if (row.status === "failed") {
    throw new ApiError("ANALYSIS_FAILED", undefined, {
      analysis_id: row.id,
      failure_code: row.failure_code,
    });
  }

  const existing = await getAnalysisDetail(auth.db, analysisId);
  if (existing.review) {
    throw new ApiError("REVIEW_EXISTS");
  }

  // needs_followup → follow_up_tasks is created in the same DB transaction by
  // AFTER INSERT trigger reviews_enqueue_follow_up (sql/005). App-level second
  // insert is intentionally not used (avoids non-atomic success).
  return insertReview(auth.db, auth.user.id, analysisId, decision, note);
}
