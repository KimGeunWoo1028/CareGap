/**
 * 5-case smoke cohort carved from the committed 30-case Live pilot manifest.
 * Dev/Val only; statuses: worsened / improved / unchanged / unknown (+ domain breadth).
 */

import type { PilotCaseEntry, PilotManifest } from "@/lib/eval/pilot-select";

/** Fixed representative IDs from live-pilot.v1 (must remain in that parent cohort). */
export const LIVE_SMOKE_CASE_IDS = [
  "eval-v1-001", // worsened — meal + mobility
  "eval-v1-003", // improved — mobility
  "eval-v1-002", // unchanged — meal
  "eval-v1-004", // unknown / insufficient — all domains
  "eval-v1-016", // worsened — environment (domain breadth)
] as const;

export type SmokePilotManifest = {
  smoke_id: string;
  smoke_version: string;
  parent_pilot_id: string;
  parent_pilot_version: string;
  parent_dataset_version: string;
  created_for: "controlled_live_smoke_5";
  model_id: string;
  splits_allowed: ["dev", "val"];
  test_split_used: false;
  max_calls_including_retries: 10;
  hard_max_usd: 1;
  cases: PilotCaseEntry[];
  selection_notes: string[];
};

export function selectLiveSmokeCases(
  parent: PilotManifest,
  options?: { modelId?: string },
): SmokePilotManifest {
  if (parent.test_split_used) {
    throw new Error("Parent pilot must not use Test split");
  }
  const byId = new Map(parent.cases.map((c) => [c.case_id, c]));
  const cases: PilotCaseEntry[] = [];
  for (const id of LIVE_SMOKE_CASE_IDS) {
    const entry = byId.get(id);
    if (!entry) {
      throw new Error(`Smoke case ${id} missing from parent pilot manifest`);
    }
    if (entry.split !== "dev" && entry.split !== "val") {
      throw new Error(`Smoke case ${id} has forbidden split ${entry.split}`);
    }
    if (!entry.label_approved_for_scoring) {
      throw new Error(`Smoke case ${id} is not approved for scoring`);
    }
    cases.push(entry);
  }

  const statuses = new Set(
    cases.flatMap((c) => Object.values(c.expected_status)),
  );
  for (const required of ["worsened", "improved", "unchanged", "unknown"] as const) {
    if (!statuses.has(required)) {
      throw new Error(`Smoke cohort missing status ${required}`);
    }
  }

  return {
    smoke_id: "live-smoke-v1",
    smoke_version: "1.0.0",
    parent_pilot_id: parent.pilot_id,
    parent_pilot_version: parent.pilot_version,
    parent_dataset_version: parent.parent_dataset_version,
    created_for: "controlled_live_smoke_5",
    model_id: options?.modelId ?? "gpt-5.4-mini-2026-03-17",
    splits_allowed: ["dev", "val"],
    test_split_used: false,
    max_calls_including_retries: 10,
    hard_max_usd: 1,
    cases,
    selection_notes: [
      "Subset of live-pilot.v1 only — not Test split.",
      "Statuses: worsened, improved, unchanged, unknown represented.",
      "Domains: meal, mobility, environment non-unknown plus all-unknown case.",
      "Local hard_max_usd=$1; account billing caps must be verified separately.",
      "No paid OpenAI calls until explicit user approval.",
    ],
  };
}
