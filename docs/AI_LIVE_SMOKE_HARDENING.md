# Live Smoke Failure Analysis & Quality Hardening

**Source Live report (immutable):** `fixtures/eval/artifacts/live-smoke-run-live-1eb98abc380d11a5.json`  
**Offline reinterpretation:** `fixtures/eval/artifacts/live-smoke-run-live-1eb98abc380d11a5.analysis.json`  
**Paid calls in this hardening slice:** **0**

## eval-v1-001 — schema_or_evidence_invalid

| Fact | Detail |
|---|---|
| Bodies | Identical to replay demo notes |
| Smoke note_ids used at run time | `eval-v1-001-previous` / `eval-v1-001-current` (non-UUID labels) |
| Tokens billed | input 516 / output 508 (completed generation) |
| Stored diagnosis | Generic Korean INVALID_AI_OUTPUT message only |

**Most likely cause:** `note_id_mismatch` — model returned demo/UUID-style ids or otherwise non-exact ids while quotes may have matched. Raw Responses payload was not persisted; future runs emit `validation_diagnosis` codes (`note_id_mismatch`, `exact_quote`, `schema`, …).

**Remediation:** deterministic UUID-shaped `syntheticNoteId`; prompt requires verbatim `note_id` copy; diagnosis codes on failure.

## eval-v1-004 — unknown → unchanged

| Fact | Detail |
|---|---|
| Bodies | Identical “날씨 이야기…전화 종료” both sides |
| Gold | all `unknown` |
| Pred | all `unchanged` (validated — dual evidence of off-domain text) |

**Cause:** Model treated identical off-domain text as status maintenance. AI_SPEC requires comparable **domain** status for `unchanged`; absence / off-domain chatter → `unknown`.

**Remediation:** prompt hardening (no case-id hardcoding).

## Metric split

- **A (success-only):** Accuracy / Macro-F1 / Worsened P·R on valid responses only  
- **B (operational):** valid rate, validation failure rate, gold worsened unevaluated due to validation failure, false reassurance on valid cells  

Do not treat A as end-to-end recall.

## Semantic citation review

Historical artifact did **not** store evidence quotes (14 structural review slots only). Worksheet marks them `pending_manual_review` with empty quotes. Future successful runs store `evidence_snapshots` for item-level review. Exact-substring ≠ expert approval.
