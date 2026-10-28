# AI Evaluation Report (Foundation Slice)

**Executed:** offline unit/pipeline checks on `feat/ai-evaluation-foundation`  
**Live OpenAI calls:** **none**

## Summary

| Item | Result |
|---|---|
| Dataset v1 cases | ≥100 (see `fixtures/eval/dataset.v1.json`) |
| Dataset validation | PASS (`lib/eval/validate-dataset.test.ts`) |
| Metrics / pipeline tests | PASS (`lib/eval/metrics.test.ts`, `pipeline.test.ts`) |
| Identity stub scoring | Structural sanity only — **not** model accuracy |
| Prediction source used | `synthetic_stub` (and replay edge-case test) |
| Expert review | Not claimed |

## How to reproduce

```bash
node scripts/generate-eval-dataset.mjs
npx vitest run lib/eval
```

Artifacts written by tests:

- `fixtures/eval/sample-predictions.identity.json`
- `fixtures/eval/reports/latest-identity.json`
- `fixtures/eval/reports/latest-identity.md`

## Next Live stage (not started)

Requires: budget approval, `CAREGAP_LIVE_EVAL_OPT_IN=I_ACCEPT_PAID_SYNTHETIC_EVAL`, case gates in `lib/eval/live-prep.ts`, capped calls, and versioned prediction files with `prediction_source=live`.
