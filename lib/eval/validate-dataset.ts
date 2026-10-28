import { findSuspiciousIdentity } from "@/lib/validation/suspicious-pii";
import { evalDatasetSchema } from "@/lib/eval/schema";
import {
  jaccardBigrams,
  pairFingerprint,
} from "@/lib/eval/near-dup";
import type { EvalCase, EvalDataset } from "@/lib/eval/types";

export type DatasetIssue = {
  code: string;
  case_id?: string;
  detail: string;
};

const NEAR_DUP_THRESHOLD = 0.92;

export function validateEvalDataset(raw: unknown): {
  ok: boolean;
  dataset?: EvalDataset;
  issues: DatasetIssue[];
} {
  const issues: DatasetIssue[] = [];
  const parsed = evalDatasetSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        code: "SCHEMA",
        detail: `${issue.path.join(".")}: ${issue.message}`,
      });
    }
    return { ok: false, issues };
  }

  const dataset = parsed.data as EvalDataset;
  if (dataset.expert_reviewed !== false) {
    issues.push({
      code: "EXPERT_FLAG",
      detail: "expert_reviewed must be false unless experts actually reviewed",
    });
  }

  const ids = new Set<string>();
  const fps = new Map<string, string>();
  const familySplit = new Map<string, string>();

  for (const c of dataset.cases) {
    if (ids.has(c.id)) {
      issues.push({ code: "DUP_ID", case_id: c.id, detail: "duplicate case id" });
    }
    ids.add(c.id);

    if (c.review_status === "expert_reviewed") {
      issues.push({
        code: "EXPERT_LABEL",
        case_id: c.id,
        detail: "expert_reviewed not allowed without documented expert review",
      });
    }

    if (c.previous.occurred_on > c.current.occurred_on) {
      issues.push({
        code: "DATE_ORDER",
        case_id: c.id,
        detail: "previous.occurred_on after current.occurred_on",
      });
    }

    for (const side of ["previous", "current"] as const) {
      const body = c[side].body;
      if (!body.trim()) {
        issues.push({
          code: "EMPTY_BODY",
          case_id: c.id,
          detail: `${side} body empty`,
        });
      }
      const pii = findSuspiciousIdentity(body);
      if (pii) {
        issues.push({
          code: "PII_SUSPECT",
          case_id: c.id,
          detail: `${side}: ${pii}`,
        });
      }
    }

    for (const q of c.expected_quotes ?? []) {
      const body = c[q.side].body;
      if (!body.includes(q.quote)) {
        issues.push({
          code: "QUOTE_NOT_SUBSTRING",
          case_id: c.id,
          detail: `${q.domain}/${q.side} quote not exact substring`,
        });
      }
    }

    const fp = pairFingerprint(c.previous.body, c.current.body);
    const existing = fps.get(fp);
    if (existing) {
      issues.push({
        code: "DUP_PAIR",
        case_id: c.id,
        detail: `exact pair duplicate of ${existing}`,
      });
    } else {
      fps.set(fp, c.id);
    }

    const priorSplit = familySplit.get(c.family_id);
    if (priorSplit && priorSplit !== c.split) {
      issues.push({
        code: "FAMILY_SPLIT",
        case_id: c.id,
        detail: `family ${c.family_id} spans splits ${priorSplit} and ${c.split}`,
      });
    } else {
      familySplit.set(c.family_id, c.split);
    }
  }

  issues.push(...findNearDuplicates(dataset.cases));

  return { ok: issues.length === 0, dataset, issues };
}

function findNearDuplicates(cases: EvalCase[]): DatasetIssue[] {
  const issues: DatasetIssue[] = [];
  for (let i = 0; i < cases.length; i += 1) {
    for (let j = i + 1; j < cases.length; j += 1) {
      const a = cases[i]!;
      const b = cases[j]!;
      if (a.family_id === b.family_id) continue;
      // Require high similarity on the full previous||current pair (not a single short side).
      const score = jaccardBigrams(
        `${a.previous.body} ${a.current.body}`,
        `${b.previous.body} ${b.current.body}`,
      );
      if (score >= NEAR_DUP_THRESHOLD && a.split !== b.split) {
        issues.push({
          code: "NEAR_DUP_CROSS_SPLIT",
          case_id: a.id,
          detail: `near-dup with ${b.id} (jaccard=${score.toFixed(3)}) across splits`,
        });
      }
    }
  }
  return issues;
}

export function summarizeLabelDistribution(dataset: EvalDataset): Record<
  string,
  Record<string, number>
> {
  const out: Record<string, Record<string, number>> = {
    meal: {},
    mobility: {},
    health: {},
    environment: {},
  };
  for (const c of dataset.cases) {
    for (const domain of Object.keys(out)) {
      const st = c.expected_status[domain as keyof typeof c.expected_status];
      out[domain]![st] = (out[domain]![st] ?? 0) + 1;
    }
  }
  return out;
}
