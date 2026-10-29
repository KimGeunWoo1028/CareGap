import { ApiError, mapDatabaseError } from "@/lib/api/errors";
import type { UserScopedClient } from "@/lib/db/clients";
import type {
  FollowUpKind,
  FollowUpStatus,
  FollowUpTask,
} from "@/lib/follow-ups/types";

const SELECT_COLS =
  "id, owner_id, case_id, analysis_id, kind, status, due_on, note, created_at, completed_at";

const LIST_SELECT = `${SELECT_COLS}, cases(alias), analyses(completed_at, mode, status, result)`;

type FollowUpRow = FollowUpTask & {
  cases?: { alias: string } | { alias: string }[] | null;
  analyses?:
    | {
        completed_at: string | null;
        mode: string | null;
        status: string | null;
        result: unknown;
      }
    | {
        completed_at: string | null;
        mode: string | null;
        status: string | null;
        result: unknown;
      }[]
    | null;
};

function firstNested<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function extractSummary(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const analysis = (result as { analysis?: { summary?: unknown } }).analysis;
  const summary = analysis?.summary;
  return typeof summary === "string" && summary.trim()
    ? summary.trim()
    : null;
}

function mapFollowUpRow(row: FollowUpRow): FollowUpTask {
  const caseRow = firstNested(row.cases);
  const analysisRow = firstNested(row.analyses);
  return {
    id: row.id,
    owner_id: row.owner_id,
    case_id: row.case_id,
    analysis_id: row.analysis_id,
    kind: row.kind,
    status: row.status,
    due_on: row.due_on,
    note: row.note,
    created_at: row.created_at,
    completed_at: row.completed_at,
    case_alias: caseRow?.alias ?? null,
    analysis_completed_at: analysisRow?.completed_at ?? null,
    analysis_mode: analysisRow?.mode ?? null,
    analysis_status: analysisRow?.status ?? null,
    analysis_summary: extractSummary(analysisRow?.result),
  };
}

export async function listFollowUpTasks(
  db: UserScopedClient,
  options: { status?: FollowUpStatus; limit?: number } = {},
): Promise<FollowUpTask[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  let query = db
    .from("follow_up_tasks")
    .select(LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (options.status) {
    query = query.eq("status", options.status);
  }
  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return ((data ?? []) as FollowUpRow[]).map(mapFollowUpRow);
}

export async function findOpenFollowUpForAnalysis(
  db: UserScopedClient,
  analysisId: string,
  kind: FollowUpKind,
): Promise<FollowUpTask | null> {
  const { data, error } = await db
    .from("follow_up_tasks")
    .select(SELECT_COLS)
    .eq("analysis_id", analysisId)
    .eq("kind", kind)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  return (data as FollowUpTask | null) ?? null;
}

export async function insertFollowUpTask(
  db: UserScopedClient,
  input: {
    ownerId: string;
    caseId: string;
    analysisId: string | null;
    kind: FollowUpKind;
    note: string;
    dueOn?: string | null;
  },
): Promise<FollowUpTask> {
  const { data, error } = await db
    .from("follow_up_tasks")
    .insert({
      owner_id: input.ownerId,
      case_id: input.caseId,
      analysis_id: input.analysisId,
      kind: input.kind,
      note: input.note,
      due_on: input.dueOn ?? null,
      status: "open",
    })
    .select(SELECT_COLS)
    .single();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new ApiError("SERVICE_UNAVAILABLE");
  return data as FollowUpTask;
}

export async function updateFollowUpTaskStatus(
  db: UserScopedClient,
  taskId: string,
  status: Exclude<FollowUpStatus, "open">,
): Promise<FollowUpTask> {
  const { data, error } = await db
    .from("follow_up_tasks")
    .update({
      status,
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("status", "open")
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new ApiError("NOT_FOUND");
  return data as FollowUpTask;
}
