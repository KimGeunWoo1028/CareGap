/**
 * Manual semantic citation review worksheet — never auto-PASS.
 */

import { ANALYSIS_DOMAINS, type ChangeStatus } from "@/lib/analysis/types";
import type { ValidatedAnalysis } from "@/lib/analysis/types";

export type SemanticReviewStatus =
  | "pending_manual_review"
  | "supports_status"
  | "does_not_support_status"
  | "ambiguous";

export type SemanticCitationReviewItem = {
  case_id: string;
  domain: (typeof ANALYSIS_DOMAINS)[number];
  predicted_status: ChangeStatus;
  evidence_source: "previous" | "current";
  evidence_quote: string;
  note_id: string;
  /** Exact-substring structural check only — not semantic approval. */
  exact_substring_ok: boolean;
  semantic_review_status: SemanticReviewStatus;
  reviewer_note: string;
};

export function buildSemanticCitationReviewItems(input: {
  case_id: string;
  analysis: ValidatedAnalysis;
  previousBody: string;
  currentBody: string;
}): SemanticCitationReviewItem[] {
  const items: SemanticCitationReviewItem[] = [];
  for (const change of input.analysis.changes) {
    for (const side of ["previous", "current"] as const) {
      const ev =
        side === "previous" ? change.evidence_previous : change.evidence_current;
      if (!ev) continue;
      const body = side === "previous" ? input.previousBody : input.currentBody;
      items.push({
        case_id: input.case_id,
        domain: change.domain,
        predicted_status: change.status,
        evidence_source: side,
        evidence_quote: ev.quote,
        note_id: ev.note_id,
        exact_substring_ok: body.includes(ev.quote),
        semantic_review_status: "pending_manual_review",
        reviewer_note: "",
      });
    }
  }
  return items;
}
