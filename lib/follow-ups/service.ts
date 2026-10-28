import { ApiError } from "@/lib/api/errors";
import type { AuthenticatedRequest } from "@/lib/auth/request-auth";
import {
  findOpenFollowUpForAnalysis,
  insertFollowUpTask,
  listFollowUpTasks,
  updateFollowUpTaskStatus,
} from "@/lib/follow-ups/repository";
import type {
  FollowUpKind,
  FollowUpStatus,
  FollowUpTask,
} from "@/lib/follow-ups/types";

export async function listOwnerFollowUps(
  auth: AuthenticatedRequest,
  status?: FollowUpStatus,
): Promise<FollowUpTask[]> {
  return listFollowUpTasks(auth.db, { status });
}

export async function createFollowUpTask(
  auth: AuthenticatedRequest,
  input: {
    caseId: string;
    analysisId?: string | null;
    kind: FollowUpKind;
    note: string;
    dueOn?: string | null;
  },
): Promise<FollowUpTask> {
  if (input.analysisId) {
    const existing = await findOpenFollowUpForAnalysis(
      auth.db,
      input.analysisId,
      input.kind,
    );
    if (existing) {
      throw new ApiError("VALIDATION_ERROR", undefined, {
        reason: "follow_up_open_exists",
        analysis_id: input.analysisId,
        kind: input.kind,
        task_id: existing.id,
      });
    }
  }

  return insertFollowUpTask(auth.db, {
    ownerId: auth.user.id,
    caseId: input.caseId,
    analysisId: input.analysisId ?? null,
    kind: input.kind,
    note: input.note,
    dueOn: input.dueOn,
  });
}

/**
 * Opens a next_consultation task when the worker marks needs_followup.
 * Idempotent for the same analysis: returns existing open task if present.
 */
export async function createFollowUpFromReview(
  auth: AuthenticatedRequest,
  input: { caseId: string; analysisId: string; reviewNote: string },
): Promise<FollowUpTask> {
  const existing = await findOpenFollowUpForAnalysis(
    auth.db,
    input.analysisId,
    "next_consultation",
  );
  if (existing) return existing;

  return insertFollowUpTask(auth.db, {
    ownerId: auth.user.id,
    caseId: input.caseId,
    analysisId: input.analysisId,
    kind: "next_consultation",
    note: input.reviewNote.trim() || "추가 상담·확인이 필요합니다.",
  });
}

export async function completeFollowUpTask(
  auth: AuthenticatedRequest,
  taskId: string,
  status: "done" | "cancelled",
): Promise<FollowUpTask> {
  if (status !== "done" && status !== "cancelled") {
    throw new ApiError("VALIDATION_ERROR", undefined, {
      field: "status",
      reason: "terminal_only",
    });
  }
  return updateFollowUpTaskStatus(auth.db, taskId, status);
}
