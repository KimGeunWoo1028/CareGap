import { ApiError } from "@/lib/api/errors";
import { analysisOutputSchema } from "@/lib/analysis/schema";
import {
  ANALYSIS_DOMAINS,
  type AnalysisNote,
  type DomainChange,
  type Evidence,
  type ValidatedAnalysis,
} from "@/lib/analysis/types";
import { codePointLength } from "@/lib/validation/consultations";

function invalid(details: Record<string, unknown> = {}): never {
  throw new ApiError("INVALID_AI_OUTPUT", undefined, details);
}

function assertTextLength(
  value: string,
  min: number,
  max: number,
  field: string,
): void {
  const length = codePointLength(value);
  if (length < min || length > max) {
    invalid({ field, reason: "length", length, min, max });
  }
}

function assertNonWhitespaceQuote(quote: string, field: string): void {
  if (quote.trim().length === 0) {
    invalid({ field, reason: "blank_quote" });
  }
}

function assertEvidence(
  evidence: Evidence | null,
  expectedNoteId: string,
  body: string,
  field: string,
): void {
  if (evidence === null) return;

  if (evidence.note_id !== expectedNoteId) {
    invalid({
      field,
      reason: "note_id_mismatch",
      expected: expectedNoteId,
      actual: evidence.note_id,
    });
  }

  assertNonWhitespaceQuote(evidence.quote, `${field}.quote`);
  assertTextLength(evidence.quote, 1, 200, `${field}.quote`);

  // Exact contiguous substring; no normalization.
  if (!body.includes(evidence.quote)) {
    invalid({ field, reason: "quote_not_substring" });
  }
}

function assertDomainEvidenceRules(
  change: DomainChange,
  previous: AnalysisNote,
  current: AnalysisNote,
): void {
  assertEvidence(
    change.evidence_previous,
    previous.note_id,
    previous.body,
    `${change.domain}.evidence_previous`,
  );
  assertEvidence(
    change.evidence_current,
    current.note_id,
    current.body,
    `${change.domain}.evidence_current`,
  );

  if (change.status === "unknown") {
    return;
  }

  if (change.evidence_previous === null || change.evidence_current === null) {
    invalid({
      domain: change.domain,
      status: change.status,
      reason: "both_evidence_required",
    });
  }
}

/**
 * Validates AI/replay analysis JSON against structure, domain rules, and
 * exact quote substrings for the selected notes. Failures throw INVALID_AI_OUTPUT.
 */
export function validateAnalysisOutput(
  raw: unknown,
  previous: AnalysisNote,
  current: AnalysisNote,
): ValidatedAnalysis {
  const parsed = analysisOutputSchema.safeParse(raw);
  if (!parsed.success) {
    invalid({
      reason: "schema",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const value = parsed.data;
  assertTextLength(value.summary, 1, 300, "summary");

  if (value.changes.length !== 4) {
    invalid({ reason: "changes_count", count: value.changes.length });
  }

  const seen = new Set<string>();
  for (const change of value.changes) {
    if (seen.has(change.domain)) {
      invalid({ reason: "duplicate_domain", domain: change.domain });
    }
    seen.add(change.domain);
    assertTextLength(change.explanation, 1, 300, `${change.domain}.explanation`);
    assertDomainEvidenceRules(change, previous, current);
  }

  for (const domain of ANALYSIS_DOMAINS) {
    if (!seen.has(domain)) {
      invalid({ reason: "missing_domain", domain });
    }
  }

  if (value.questions.length > 4) {
    invalid({ reason: "questions_count", count: value.questions.length });
  }
  value.questions.forEach((question, index) => {
    assertTextLength(question, 1, 200, `questions[${index}]`);
  });

  return value as ValidatedAnalysis;
}
