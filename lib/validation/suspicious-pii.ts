/** Heuristic blockers from API_SPEC — not a complete PII detector. */
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const MOBILE_PATTERN =
  /(?:^|[^0-9])01[016789][- ]?[0-9]{3,4}[- ]?[0-9]{4}(?:$|[^0-9])/;
const RRN_PATTERN =
  /(?:^|[^0-9])[0-9]{6}[- ]?[1-4][0-9]{6}(?:$|[^0-9])/;

export function findSuspiciousIdentity(text: string): string | null {
  if (EMAIL_PATTERN.test(text)) return "email";
  if (MOBILE_PATTERN.test(text)) return "phone";
  if (RRN_PATTERN.test(text)) return "rrn";
  return null;
}

export function assertNoSuspiciousIdentity(text: string): void {
  const kind = findSuspiciousIdentity(text);
  if (kind) {
    throw new Error(kind);
  }
}
