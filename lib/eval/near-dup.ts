/** Lightweight near-duplicate helpers for synthetic Korean notes. */

export function normalizeNoteText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:'"“”‘’()[\]{}]/g, "")
    .trim();
}

export function bigrams(text: string): Set<string> {
  const n = normalizeNoteText(text).replace(/\s/g, "");
  const out = new Set<string>();
  if (n.length < 2) {
    if (n) out.add(n);
    return out;
  }
  for (let i = 0; i < n.length - 1; i += 1) {
    out.add(n.slice(i, i + 2));
  }
  return out;
}

export function jaccardBigrams(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const g of A) {
    if (B.has(g)) inter += 1;
  }
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function pairFingerprint(previous: string, current: string): string {
  return `${normalizeNoteText(previous)}||${normalizeNoteText(current)}`;
}
