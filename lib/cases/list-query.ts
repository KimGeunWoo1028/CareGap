import type { CaseRecord } from "@/lib/cases/types";

export const CASE_ALIAS_PATTERN = /^합성-[0-9]{3}$/;

export function isValidCaseAlias(alias: string): boolean {
  return CASE_ALIAS_PATTERN.test(alias.trim());
}

/** Local filter over the already-fetched case list (max 100 from API). */
export function filterCasesByAlias(
  cases: readonly CaseRecord[],
  query: string,
): CaseRecord[] {
  const trimmed = query.trim();
  if (!trimmed) return [...cases];
  return cases.filter((item) => item.alias.includes(trimmed));
}
