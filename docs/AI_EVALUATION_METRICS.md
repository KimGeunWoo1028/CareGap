# AI Evaluation Metrics

`evaluation_version`: **1.1.0** (`lib/eval/metrics.ts`)

All rates use **N/A** when the denominator is 0 (never coerced to 0%).

| Metric | Definition |
|---|---|
| Domain confusion matrix | Counts gold→pred per domain and overall |
| Overall status accuracy | Correct (case,domain) / all scored cells |
| Macro F1 | Unweighted mean of per-status F1 |
| Worsened precision / recall | Standard binary metrics for `worsened` |
| False worsening rate | Pred `worsened` ∧ gold≠`worsened` / gold≠`worsened` |
| Missed worsening rate | Gold `worsened` ∧ pred≠`worsened` / gold `worsened` |
| False reassurance rate | Gold `worsened` ∧ pred∈{`unchanged`,`improved`} / gold `worsened` (unknown deferred separately) |
| Unknown usage rate | Pred `unknown` share |
| Unknown detection rate | Pred `unknown` / gold `unknown` |
| Coverage | Matched predictions / dataset size |
| Citation presence rate | Non-empty evidence quotes / evidence items (structural) |
| Citation ID consistency | Matching note_id when both predicted and expected IDs exist |
| Semantic citation review items | Count flagged for **manual** review — **never auto-PASS** |

## Honest reporting rules

- `prediction_source=replay` or `synthetic_stub` must not be described as Live model accuracy.
- `prediction_source=live` requires `model_id` and opt-in execution (not in this slice).
- Expert clinical validity requires `expert_reviewed` labels (not present in v1).
