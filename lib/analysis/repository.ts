import { ApiError, mapDatabaseError } from "@/lib/api/errors";
import {
  parseStartAnalysisRpc,
  type StartAnalysisRpcSuccess,
} from "@/lib/analysis/rpc";
import type {
  AnalysisDetail,
  AnalysisMode,
  AnalysisResultPayload,
  AnalysisReview,
  AnalysisRow,
} from "@/lib/analysis/analysis-types";
import type { WelfareProgram } from "@/lib/analysis/types";
import { computeIsCurrent } from "@/lib/cases/is-current";
import type { UserScopedClient } from "@/lib/db/clients";
import { createServiceRoleClient } from "@/lib/db/service-client";

const ANALYSIS_SELECT =
  "id, case_id, owner_id, previous_note_id, current_note_id, idempotency_key, mode, status, schema_version, model, result, failure_code, created_at, completed_at";

export async function callStartAnalysis(
  db: UserScopedClient,
  caseId: string,
  idempotencyKey: string,
  mode: AnalysisMode,
): Promise<StartAnalysisRpcSuccess> {
  const { data, error } = await db.rpc("start_analysis", {
    p_case_id: caseId,
    p_key: idempotencyKey,
    p_mode: mode,
  });
  return parseStartAnalysisRpc(data, error);
}

export async function getAnalysisRowForOwner(
  db: UserScopedClient,
  analysisId: string,
): Promise<AnalysisRow> {
  const { data, error } = await db
    .from("analyses")
    .select(ANALYSIS_SELECT)
    .eq("id", analysisId)
    .maybeSingle();

  if (error) throw mapDatabaseError(error);
  if (!data) throw new ApiError("NOT_FOUND");
  return data as AnalysisRow;
}

export async function listLatestNoteIds(
  db: UserScopedClient,
  caseId: string,
): Promise<string[]> {
  const { data, error } = await db
    .from("consultations")
    .select("id")
    .eq("case_id", caseId)
    .order("occurred_on", { ascending: false })
    .limit(2);

  if (error) throw mapDatabaseError(error);
  return (data ?? []).map((row) => row.id as string);
}

export async function getReviewForAnalysis(
  db: UserScopedClient,
  analysisId: string,
): Promise<AnalysisReview | null> {
  const { data, error } = await db
    .from("reviews")
    .select("id, analysis_id, decision, note, created_at")
    .eq("analysis_id", analysisId)
    .maybeSingle();

  if (error) throw mapDatabaseError(error);
  return (data as AnalysisReview | null) ?? null;
}

export async function getAnalysisDetail(
  db: UserScopedClient,
  analysisId: string,
): Promise<AnalysisDetail> {
  const row = await getAnalysisRowForOwner(db, analysisId);
  const [latestNoteIds, review] = await Promise.all([
    listLatestNoteIds(db, row.case_id),
    getReviewForAnalysis(db, analysisId),
  ]);

  return toAnalysisDetail(row, latestNoteIds, review);
}

export function toAnalysisDetail(
  row: AnalysisRow,
  latestNoteIds: string[],
  review: AnalysisReview | null,
): AnalysisDetail {
  const succeeded = row.status === "succeeded";
  const failed = row.status === "failed";
  return {
    id: row.id,
    case_id: row.case_id,
    previous_note_id: row.previous_note_id,
    current_note_id: row.current_note_id,
    status: row.status,
    mode: row.mode,
    schema_version: "1.0",
    model: row.model,
    result: succeeded ? (row.result as AnalysisResultPayload) : null,
    failure_code: failed ? row.failure_code : null,
    created_at: row.created_at,
    completed_at: row.completed_at,
    is_current: computeIsCurrent(latestNoteIds, row),
    review,
  };
}

export async function getCaseAlias(
  db: UserScopedClient,
  caseId: string,
): Promise<string> {
  const { data, error } = await db
    .from("cases")
    .select("alias")
    .eq("id", caseId)
    .maybeSingle();

  if (error) throw mapDatabaseError(error);
  if (!data?.alias) throw new ApiError("NOT_FOUND");
  return data.alias as string;
}

export async function getConsultationPair(
  db: UserScopedClient,
  caseId: string,
  previousNoteId: string,
  currentNoteId: string,
): Promise<{
  previous: { note_id: string; occurred_on: string; body: string };
  current: { note_id: string; occurred_on: string; body: string };
}> {
  const { data, error } = await db
    .from("consultations")
    .select("id, occurred_on, body")
    .eq("case_id", caseId)
    .in("id", [previousNoteId, currentNoteId]);

  if (error) throw mapDatabaseError(error);
  const rows = data ?? [];
  const previous = rows.find((row) => row.id === previousNoteId);
  const current = rows.find((row) => row.id === currentNoteId);
  if (!previous || !current) {
    throw new ApiError("SERVICE_UNAVAILABLE", undefined, {
      reason: "reserved_notes_missing",
    });
  }
  return {
    previous: {
      note_id: previous.id as string,
      occurred_on: previous.occurred_on as string,
      body: previous.body as string,
    },
    current: {
      note_id: current.id as string,
      occurred_on: current.occurred_on as string,
      body: current.body as string,
    },
  };
}

export async function listActiveWelfarePrograms(
  db: UserScopedClient,
): Promise<WelfareProgram[]> {
  const { data, error } = await db
    .from("welfare_programs")
    .select(
      "id, name, tags, summary, eligibility_checks, region, source_url, source_checked_on, catalog_version, active",
    )
    .eq("active", true);

  if (error) throw mapDatabaseError(error);
  return (data ?? []) as WelfareProgram[];
}

/**
 * Conditional success finalize. Returns true only when exactly one processing row updated.
 */
export async function finalizeAnalysisSuccess(input: {
  analysisId: string;
  ownerId: string;
  caseId: string;
  model: string | null;
  result: AnalysisResultPayload;
}): Promise<boolean> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("analyses")
    .update({
      status: "succeeded",
      result: input.result,
      model: input.model,
      failure_code: null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.analysisId)
    .eq("owner_id", input.ownerId)
    .eq("case_id", input.caseId)
    .eq("status", "processing")
    .select("id");

  if (error) throw mapDatabaseError(error);
  return (data?.length ?? 0) === 1;
}

export async function finalizeAnalysisFailure(input: {
  analysisId: string;
  ownerId: string;
  caseId: string;
  failureCode: string;
}): Promise<boolean> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("analyses")
    .update({
      status: "failed",
      result: null,
      model: null,
      failure_code: input.failureCode,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.analysisId)
    .eq("owner_id", input.ownerId)
    .eq("case_id", input.caseId)
    .eq("status", "processing")
    .select("id");

  if (error) throw mapDatabaseError(error);
  return (data?.length ?? 0) === 1;
}

export async function insertReview(
  db: UserScopedClient,
  ownerId: string,
  analysisId: string,
  decision: AnalysisReview["decision"],
  note: string,
): Promise<AnalysisReview> {
  const { data, error } = await db
    .from("reviews")
    .insert({
      analysis_id: analysisId,
      owner_id: ownerId,
      decision,
      note,
    })
    .select("id, analysis_id, decision, note, created_at")
    .single();

  if (error) throw mapDatabaseError(error);
  if (!data) throw new ApiError("SERVICE_UNAVAILABLE");
  return data as AnalysisReview;
}
