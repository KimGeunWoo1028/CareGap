# AI Evaluation Dataset

## Version

- File: `fixtures/eval/dataset.v1.json`
- `dataset_version`: **1.0.0**
- Language: Korean synthetic consultation pairs
- `synthetic_only`: true
- `expert_reviewed`: **false** (internal labels only)

## Legacy seed

`fixtures/evaluation-cases.json` keeps the original 12 cases. They are migrated into v1 as `eval-v1-001`…`012` with `legacy_id` and `review_status=internally_reviewed`. Labels were preserved after review (no clear errors found).

## Size & splits (v1)

Regenerate with `node scripts/generate-eval-dataset.mjs`. Expected: **100–120** cases.

Approximate policy: ~60% `dev` / ~20% `val` / ~20% `test`.  
`family_id` near-duplicates stay in one split. Do not optimize prompts on `test`.

## Case fields

`id`, `split`, `family_id`, `scenarios[]`, `previous`/`current` (`occurred_on`,`body`), `expected_status` (4 domains), `label_rationale`, optional `expected_quotes`, `review_status` (`draft`|`internally_reviewed`|`expert_reviewed`), `author`, `synthetic_source`, `creation_method`.

## Quality gates

`validateEvalDataset` enforces schema, enums, date order, exact quote substrings, PII heuristics, exact pair dedupe, family/split consistency, and pair-level near-dup cross-split checks.

## Deferred CareGap Test orphans

Unrelated DB follow-up orphans remain listed in `docs/POST_MIGRATION_AUDIT.md` and are **not** part of this eval set.
