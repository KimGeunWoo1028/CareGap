# AI Evaluation Plan (Foundation)

**Branch:** `feat/ai-evaluation-foundation`  
**Scope:** offline synthetic evaluation infrastructure only. **No paid OpenAI calls** in this slice.

## Goals

1. Expand labeled synthetic pairs to ~100–120 (v1 ships ≥100).
2. Validate dataset quality (schema, quotes, PII heuristics, near-dup/split leakage).
3. Score predictions with explicit safety-oriented metrics (false reassurance, missed worsening, N/A denominators).
4. Keep Replay demo and worsened-only matching untouched.
5. Prepare opt-in Live eval gates without executing Live.

## Non-goals

- Changing auth, DB SQL, API, or UI contracts.
- Claiming model accuracy from Replay or identity stubs.
- Marking labels `expert_reviewed` without experts.

## Artifacts

| Path | Role |
|---|---|
| `fixtures/eval/dataset.v1.json` | Gold dataset |
| `fixtures/evaluation-cases.json` | Legacy 12-case seed (preserved) |
| `lib/eval/*` | Schema, validation, metrics, pipeline, live prep |
| `scripts/generate-eval-dataset.mjs` | Regenerates v1 from handcrafted templates |
| `scripts/run-eval.mjs` | Runs eval unit suite (offline) |
| `docs/AI_EVALUATION_*.md` | Plan, metrics, dataset, report |

## Workflow

1. Edit/regenerate dataset → `node scripts/generate-eval-dataset.mjs`
2. Validate + metrics via `npx vitest run lib/eval`
3. Store prediction JSON with honest `prediction_source`
4. Future Live: opt-in env + budget gates in `lib/eval/live-prep.ts` (execution still forbidden here)

## Split policy

- Target ~60% `dev` / ~20% `val` / ~20% `test`
- Same `family_id` must not cross splits
- Do not iteratively tune prompts against `test`
