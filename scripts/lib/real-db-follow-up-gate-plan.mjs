/**
 * Pure planning helpers for the real-DB follow-up gate.
 * Keeps create attempts idempotent: resume reported IDs, skip existing aliases,
 * preflight both free slots before any create, never touch 합성-001.
 */

export const DEMO_ALIAS = "합성-001";
export const DEFAULT_MAX_CASES = 2;

/**
 * @param {number} from
 * @param {number} to
 * @returns {string[]}
 */
export function preferredAliases(from = 90, to = 99) {
  const out = [];
  for (let n = from; n <= to; n += 1) {
    const alias = `합성-${String(n).padStart(3, "0")}`;
    if (alias === DEMO_ALIAS) continue;
    out.push(alias);
  }
  return out;
}

/**
 * @param {{
 *   preferred?: string[],
 *   existingAliases?: string[],
 *   resumeCases?: { id: string, alias: string }[],
 *   max?: number,
 * }} opts
 * @returns {{
 *   reuse: { id: string, alias: string }[],
 *   toCreate: string[],
 *   blocked: string[],
 * }}
 */
export function planGateCases(opts = {}) {
  const preferred = opts.preferred ?? preferredAliases();
  const existing = new Set(opts.existingAliases ?? []);
  const max = opts.max ?? DEFAULT_MAX_CASES;
  const resume = (opts.resumeCases ?? []).filter(
    (c) => c?.id && c?.alias && c.alias !== DEMO_ALIAS,
  );

  const reuse = [];
  const seenAlias = new Set();
  for (const c of resume) {
    if (reuse.length >= max) break;
    if (seenAlias.has(c.alias)) continue;
    if (!existing.has(c.alias)) continue;
    reuse.push({ id: c.id, alias: c.alias });
    seenAlias.add(c.alias);
  }

  const need = max - reuse.length;
  const toCreate = [];
  const blocked = [];
  for (const alias of preferred) {
    if (alias === DEMO_ALIAS) {
      blocked.push(alias);
      continue;
    }
    if (seenAlias.has(alias) || existing.has(alias)) {
      blocked.push(alias);
      continue;
    }
    if (toCreate.length < need) {
      toCreate.push(alias);
      seenAlias.add(alias);
    }
  }

  return { reuse, toCreate, blocked };
}

/**
 * Refuse create when fewer free aliases than needed (avoids partial orphan creates).
 * @param {{ toCreate: string[], need: number }} args
 */
export function assertCreateBatchReady({ toCreate, need }) {
  if (need <= 0) return;
  if (toCreate.length < need) {
    throw new Error(
      `insufficient free aliases: need ${need}, free ${toCreate.length}`,
    );
  }
}
