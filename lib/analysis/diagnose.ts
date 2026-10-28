/**
 * Structured diagnosis for INVALID_AI_OUTPUT — does not relax validation.
 */

import { ApiError } from "@/lib/api/errors";
import type { AnalysisNote } from "@/lib/analysis/types";
import { validateAnalysisOutput } from "@/lib/analysis/validate";

export const VALIDATION_DIAGNOSIS_CODES = [
  "schema",
  "invalid_enum",
  "missing_field",
  "note_id_mismatch",
  "exact_quote",
  "blank_quote",
  "length",
  "both_evidence_required",
  "changes_count",
  "duplicate_domain",
  "missing_domain",
  "questions_count",
  "unknown",
] as const;

export type ValidationDiagnosisCode =
  (typeof VALIDATION_DIAGNOSIS_CODES)[number];

export type ValidationDiagnosis = {
  ok: false;
  code: ValidationDiagnosisCode;
  reason: string;
  field?: string;
  domain?: string;
  details: Record<string, unknown>;
};

export type ValidationDiagnosisResult =
  | { ok: true }
  | ValidationDiagnosis;

function mapReason(details: Record<string, unknown>): ValidationDiagnosisCode {
  const reason = String(details.reason ?? "unknown");
  switch (reason) {
    case "schema":
      return "schema";
    case "note_id_mismatch":
      return "note_id_mismatch";
    case "quote_not_substring":
      return "exact_quote";
    case "blank_quote":
      return "blank_quote";
    case "length":
      return "length";
    case "both_evidence_required":
      return "both_evidence_required";
    case "changes_count":
      return "changes_count";
    case "duplicate_domain":
      return "duplicate_domain";
    case "missing_domain":
      return "missing_domain";
    case "questions_count":
      return "questions_count";
    default:
      break;
  }
  const issues = details.issues;
  if (Array.isArray(issues)) {
    const joined = JSON.stringify(issues).toLowerCase();
    if (joined.includes("invalid_enum") || joined.includes("enum")) {
      return "invalid_enum";
    }
    if (joined.includes("required") || joined.includes("invalid_type")) {
      return "missing_field";
    }
    return "schema";
  }
  return "unknown";
}

export function classifyValidationDetails(
  details: Record<string, unknown>,
): ValidationDiagnosis {
  const code = mapReason(details);
  return {
    ok: false,
    code,
    reason: String(details.reason ?? code),
    field: typeof details.field === "string" ? details.field : undefined,
    domain: typeof details.domain === "string" ? details.domain : undefined,
    details,
  };
}

/** Run validator and return structured diagnosis without throwing. */
export function diagnoseAnalysisOutput(
  raw: unknown,
  previous: AnalysisNote,
  current: AnalysisNote,
): ValidationDiagnosisResult {
  try {
    validateAnalysisOutput(raw, previous, current);
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError && e.code === "INVALID_AI_OUTPUT") {
      return classifyValidationDetails(e.details);
    }
    return {
      ok: false,
      code: "unknown",
      reason: e instanceof Error ? e.message : "unknown",
      details: {},
    };
  }
}

export function formatDiagnosisCode(d: ValidationDiagnosis): string {
  const parts = [d.code, d.reason];
  if (d.field) parts.push(d.field);
  if (d.domain) parts.push(d.domain);
  return parts.join(":");
}
