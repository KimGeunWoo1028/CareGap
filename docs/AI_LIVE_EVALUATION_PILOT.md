# CareGap AI — Controlled Live Evaluation Pilot

**Branch:** `feat/ai-live-evaluation-pilot`  
**Parent calibration:** `1cffcc2`  
**Live OpenAI calls in this prep slice:** **none** (dry-run only)

## Purpose

Prepare a small, gated Live pilot so real model quality can be measured **after** explicit user approval. This document freezes selection, safety, cost, and recording rules. It does **not** contain invented Live accuracy numbers.

## Pilot cohort

| Field | Value |
|---|---|
| Manifest | `fixtures/eval/live-pilot.v1.manifest.json` |
| Parent dataset | `fixtures/eval/dataset.v1.json` |
| Size | 20–30 cases (committed manifest is deterministic) |
| Splits | Dev + Val only |
| Test split | **Forbidden** |
| Family uniqueness | One case per `family_id` |
| Label approval | `internally_reviewed` → `label_approved_for_scoring=true`; `draft` included but **not** primary gold |

Regenerate / verify:

```bash
npm run eval:pilot:manifest
npx vitest run lib/eval/pilot-select.test.ts
```

## Live stack readiness (mock vs live)

| Concern | Location | Status |
|---|---|---|
| Responses `output` parse | `lib/analysis/live-response.ts` | Covered by unit tests |
| Structured JSON + schema | `lib/analysis/validate.ts` | Pre-persist validation |
| Refusal / incomplete / empty | `lib/analysis/live.ts` | Fail without silent replay |
| Timeout / retry (429/5xx) | `lib/analysis/live.ts` | Max 2 attempts; invalid output not retried as success |
| Invalid evidence quotes | `validateAnalysisOutput` | Reject before save |
| Prompt injection fixtures | Eval scenarios + validate tests | Synthetic only |
| Eval dry-run planner | `lib/eval/live-dry-run.ts` | No network |
| Pilot gates + cost guard | `lib/eval/live-pilot.ts`, `live-cost.ts` | Enforced in runner |

Mock/unit Live tests (`lib/analysis/live.test.ts`) stay separate from paid pilot execution.

## Cost & safety gates (all required for paid Live)

1. Mode `live` (default remains `dry-run`)
2. Env `CAREGAP_LIVE_EVAL_OPT_IN=I_ACCEPT_PAID_SYNTHETIC_EVAL`
3. Explicit CLI/API approval (`--i-approve-live-spend` / `explicitApproval: true`)
4. `OPENAI_API_KEY` present
5. Planner `estimated_usd ≤ hard_max_usd` (default **$5**)
6. Runtime `assertWithinCostGuard` before each call
7. Checkpoint skip of completed `case_id`s (no re-bill)
8. Synthetic fixtures only; **no** CareGap Test DB writes
9. Never log API keys or consultation body text

`estimated_usd` ≠ invoice. Re-verify OpenAI list prices and account access before approval.

## Dry-run

```bash
npm run eval:pilot:dry-run
```

Artifacts under `fixtures/eval/artifacts/` with `live_calls_executed: false` and `metrics: null`.

## Metrics (only after approved Live run)

Compute with existing harness (`computeStatusMetrics` / citation helpers):

- Accuracy, Macro-F1, Worsened Precision/Recall
- Missed Worsening, False Worsening, False Reassurance
- Unknown Detection, Evidence exact / semantic-review flags
- Invalid Output Rate, API Failure Rate, Latency, Tokens, Cost

Failures stay in the report; do not score only successes and call that model quality. Prefer worsening detection and evidence review over beating `always_unknown` on overall accuracy alone. Small-n pilot ≠ production approval. **Do not use Test split for prompt tuning.**

## Quality judgment vs baselines

Calibration baselines (`fixtures/eval/reports/calibration-baselines.v1.json`) remain the offline reference. A Live model that only exceeds always-unknown accuracy is **not** auto-approved.

## User actions before paid Live

1. Confirm `OPENAI_API_KEY` and model access for `gpt-5.4-mini-2026-03-17` (or chosen substitute).
2. Re-check current input/output token prices; update rate card if needed.
3. Set `CAREGAP_LIVE_EVAL_OPT_IN=I_ACCEPT_PAID_SYNTHETIC_EVAL`.
4. Approve spend in writing (hard max, case count, model).
5. Run the Live entrypoint only after that approval (not provided as default npm script).

## Absolute preserves

- No main/RC mutation, no SQL 001–005b re-run, no CareGap Test data changes
- Replay contract + worsened-only matching unchanged
- No paid OpenAI without approval; no git push without approval
