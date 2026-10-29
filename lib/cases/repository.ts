import { ApiError, mapDatabaseError } from "@/lib/api/errors";
import { mapCaseRecord } from "@/lib/cases/case-record";
import { computeIsCurrent } from "@/lib/cases/is-current";
import type {
  AnalysisSummary,
  CaseDetail,
  CaseRecord,
  ConsultationRecord,
} from "@/lib/cases/types";
import type { UserScopedClient } from "@/lib/db/clients";

const CASE_LIST_LIMIT = 100;
const NESTED_LIMIT = 50;

type AnalysisRow = {
  id: string;
  case_id: string;
  status: AnalysisSummary["status"];
  mode: AnalysisSummary["mode"];
  created_at: string;
  completed_at: string | null;
  previous_note_id: string;
  current_note_id: string;
};

export async function listCases(db: UserScopedClient): Promise<CaseRecord[]> {
  const { data, error } = await db
    .from("cases")
    .select("id, alias, created_at, consultations(count)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CASE_LIST_LIMIT);

  if (error) throw mapDatabaseError(error);
  return (data ?? []).map(mapCaseRecord);
}

export async function createCase(
  db: UserScopedClient,
  ownerId: string,
  alias: string,
): Promise<CaseRecord> {
  const { data, error } = await db
    .from("cases")
    .insert({ alias, owner_id: ownerId })
    .select("id, alias, created_at")
    .single();

  if (error) throw mapDatabaseError(error);
  if (!data) throw new ApiError("SERVICE_UNAVAILABLE");
  return mapCaseRecord({ ...data, consultation_count: 0 });
}

export async function getCaseDetail(
  db: UserScopedClient,
  caseId: string,
): Promise<CaseDetail> {
  const { data: caseRow, error: caseError } = await db
    .from("cases")
    .select("id, alias, created_at")
    .eq("id", caseId)
    .maybeSingle();

  if (caseError) throw mapDatabaseError(caseError);
  if (!caseRow) throw new ApiError("NOT_FOUND");

  const { data: consultations, error: consultationError } = await db
    .from("consultations")
    .select("id, case_id, occurred_on, channel, body, created_at")
    .eq("case_id", caseId)
    .order("occurred_on", { ascending: false })
    .limit(NESTED_LIMIT);

  if (consultationError) throw mapDatabaseError(consultationError);

  const { data: analyses, error: analysisError } = await db
    .from("analyses")
    .select(
      "id, case_id, status, mode, created_at, completed_at, previous_note_id, current_note_id",
    )
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(NESTED_LIMIT);

  if (analysisError) throw mapDatabaseError(analysisError);

  const consultationRows = (consultations ?? []) as ConsultationRecord[];
  const latestNoteIds = consultationRows.map((row) => row.id);
  const analysisRows = (analyses ?? []) as AnalysisRow[];

  return {
    case: mapCaseRecord({
      ...caseRow,
      consultation_count: consultationRows.length,
    }),
    consultations: consultationRows,
    analyses: analysisRows.map((row) => ({
      id: row.id,
      case_id: row.case_id,
      status: row.status,
      mode: row.mode,
      created_at: row.created_at,
      completed_at: row.completed_at,
      is_current: computeIsCurrent(latestNoteIds, row),
    })),
  };
}

export async function createConsultation(
  db: UserScopedClient,
  caseId: string,
  input: {
    occurred_on: string;
    channel: ConsultationRecord["channel"];
    body: string;
  },
): Promise<ConsultationRecord> {
  const { data: ownedCase, error: caseError } = await db
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .maybeSingle();

  if (caseError) throw mapDatabaseError(caseError);
  if (!ownedCase) throw new ApiError("NOT_FOUND");

  const { data, error } = await db
    .from("consultations")
    .insert({
      case_id: caseId,
      occurred_on: input.occurred_on,
      channel: input.channel,
      body: input.body,
    })
    .select("id, case_id, occurred_on, channel, body, created_at")
    .single();

  if (error) throw mapDatabaseError(error);
  if (!data) throw new ApiError("SERVICE_UNAVAILABLE");
  return data as ConsultationRecord;
}
