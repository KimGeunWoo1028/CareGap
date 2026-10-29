import type { CaseRecord } from "@/lib/cases/types";

type NestedCount =
  | { count: number }[]
  | { count: number }
  | null
  | undefined;

function nestedCount(value: NestedCount): number {
  if (value == null) return 0;
  if (Array.isArray(value)) return value[0]?.count ?? 0;
  return value.count ?? 0;
}

/** Map a cases row (optionally with Supabase nested count) to CaseRecord. */
export function mapCaseRecord(row: {
  id: string;
  alias: string;
  created_at: string;
  consultations?: NestedCount;
  consultation_count?: number;
}): CaseRecord {
  const consultationCount =
    typeof row.consultation_count === "number"
      ? row.consultation_count
      : nestedCount(row.consultations);
  return {
    id: row.id,
    alias: row.alias,
    created_at: row.created_at,
    consultation_count: consultationCount,
  };
}
