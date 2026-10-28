# AI Evaluation Calibration & Live Readiness

**Branch:** `feat/ai-evaluation-calibration`  
**Base:** `3e1cd32`  
**Live OpenAI calls this slice:** **none**

## 1. Dataset audit (v1, 101 cases)

| Item | Finding |
|---|---|
| Structure | 4-domain `expected_status`, splits, `family_id`, scenarios, rationales |
| Cells | 404 status labels |
| Unknown share | **~78.7%** (unknown-heavy; overall accuracy is a weak gate) |
| Splits | ~dev 68 / val 18 / test 15 |
| Family leakage | **0** cross-split family violations |
| Review status | `draft` + `internally_reviewed` only; **no** `expert_reviewed` |
| Over-interpretation risk | High if using identity-stub or overall accuracy alone |

### Label corrections

No v1 gold labels were rewritten in this slice. Ambiguous scenarios remain flagged for human review (`audit.ambiguity_flags`). Original 12 legacy labels stay preserved.

## 2. Imbalance & baselines

Baselines are **synthetic stubs** scored with the same metrics pipeline. They are **not** Live model results.

See `fixtures/eval/reports/calibration-baselines.v1.json` after `npx vitest run lib/eval`.

Expected qualitative pattern:

| Baseline | Overall accuracy | Worsened recall | Interpretation |
|---|---|---|---|
| `always_unknown` | ≈0.787 | **0** (missed worsening=1) | Looks “accurate”, **misses all worsening**; macro-F1 must not ignore unsupported classes |
| `majority_class` | same when unknown dominates | **0** | Same failure mode |
| `majority_per_domain` | similar | **0** here | Domain majorities are also unknown |
| `stratified_random` (seed 42) | lower; noisy worsened | low | Calibration floor only — see JSON artifact |

**Rule:** a model that misses worsening is **not** “good” even with high overall accuracy.

## 3. v2 candidates

`fixtures/eval/dataset.v2.candidates.json` — **24** additive cases (clear worsen/stable/ongoing/improve/conflict/negation/paraphrase/temporal/insufficiency).  
**Not** merged into frozen v1 scoring. Promote only after review. Test split not for prompt tuning.

## 4. Gold quality process

- Structural quote substring ≠ semantic fitness (`citation_semantic_review_required`)
- Rationales required; thin rationales flagged
- Expert labels forbidden without experts

## 5. Live dry-run readiness

`lib/eval/live-dry-run.ts`:

- Default planning mode `dry_run` → `would_call_openai: false`
- Explicit opt-in flag (still no network in this slice)
- Call/cost budgets, model/prompt/dataset/schema versions
- Checkpoint resume / duplicate skip
- Eval fixtures ≠ CareGap Test DB
- `executeLiveEvalForbidden()` remains hard-stop for paid calls

## 6. Quality gate (for future Live reports)

Must include: overall + per-domain accuracy, macro-F1, worsened P/R, missed worsening, false worsening, false reassurance, unknown detection, citation presence, **manual** semantic citation review count, model failure rate, **vs baselines**.  
Must state dataset size + non-expert label limits.  
Must **not** invent Live metrics without a real run.

## 7. User prep before Live approval

1. Confirm OpenAI project access + spend cap  
2. Set `CAREGAP_LIVE_EVAL_OPT_IN=I_ACCEPT_PAID_SYNTHETIC_EVAL`  
3. Choose case subset (start ≤30) and budget  
4. Confirm synthetic-only fixture path  
5. Empty/init checkpoint file  
6. Agree not to tune on `test` split  

## Interpretation limit

This document does **not** claim measured Live model accuracy.
