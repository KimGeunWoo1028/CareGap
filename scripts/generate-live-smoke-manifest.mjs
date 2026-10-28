/**
 * Build 5-case smoke manifest from live-pilot.v1.manifest.json.
 * Does not call OpenAI.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SMOKE_IDS = [
  "eval-v1-001",
  "eval-v1-003",
  "eval-v1-002",
  "eval-v1-004",
  "eval-v1-016",
];

const parentPath = resolve(root, "fixtures/eval/live-pilot.v1.manifest.json");
const outPath = resolve(root, "fixtures/eval/live-smoke.v1.manifest.json");
const parent = JSON.parse(readFileSync(parentPath, "utf8"));
if (parent.test_split_used) throw new Error("parent used test split");

const byId = new Map(parent.cases.map((c) => [c.case_id, c]));
const cases = SMOKE_IDS.map((id) => {
  const entry = byId.get(id);
  if (!entry) throw new Error(`missing ${id}`);
  if (entry.split !== "dev" && entry.split !== "val") {
    throw new Error(`bad split ${id}`);
  }
  if (!entry.label_approved_for_scoring) {
    throw new Error(`not approved ${id}`);
  }
  return entry;
});

const statuses = new Set(
  cases.flatMap((c) => Object.values(c.expected_status)),
);
for (const required of ["worsened", "improved", "unchanged", "unknown"]) {
  if (!statuses.has(required)) throw new Error(`missing status ${required}`);
}

const smoke = {
  smoke_id: "live-smoke-v1",
  smoke_version: "1.0.0",
  parent_pilot_id: parent.pilot_id,
  parent_pilot_version: parent.pilot_version,
  parent_dataset_version: parent.parent_dataset_version,
  created_for: "controlled_live_smoke_5",
  model_id: "gpt-5.4-mini-2026-03-17",
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

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(smoke, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      out: outPath,
      case_ids: cases.map((c) => c.case_id),
      model_id: smoke.model_id,
      hard_max_usd: smoke.hard_max_usd,
      max_calls_including_retries: smoke.max_calls_including_retries,
    },
    null,
    2,
  ),
);
