/**
 * Deterministic UUID-shaped note ids for offline/Live eval.
 * Avoids non-UUID labels like "eval-v1-001-previous" that models often ignore
 * in favor of demo UUIDs, causing note_id_mismatch without relaxing validation.
 */

import { createHash } from "node:crypto";

export function syntheticNoteId(
  caseId: string,
  side: "previous" | "current",
): string {
  const h = createHash("sha256")
    .update(`caregap-eval-note:${caseId}:${side}`)
    .digest("hex");
  // UUID version 4-shaped deterministic id (not RFC random).
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
