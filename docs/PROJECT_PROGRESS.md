# CareGap Progress

**Mode:** sync · 2026-10-28

## Now

`feat/ai-evaluation-calibration`: baselines + dry-run Live readiness (still no paid calls).

## Done

- Eval foundation (`3e1cd32`): dataset v1 101, metrics/pipeline
- Calibration: unknown-imbalance audit, baselines, v2 candidates (24), dry-run planner
- Quality gates documented; Live execution still forbidden

## Next

- User-approved Live eval with budgets
- Promote v2 candidates after review; expert labeling
- Field interviews (roadmap #6)

## Tracks

| Track | Status |
|---|---|
| Replay demo | Stable (RC `107e9ec`) |
| Schema / follow-ups | Stable on CareGap Test |
| AI eval foundation | Dataset+metrics offline PASS |
| Live model accuracy | Not measured this slice |
| Field evidence | Not started |

## Do-not

실데이터·유료 Live 무단 호출·expert_reviewed 허위 표시·SQL/Test 데이터 변경·push/`main`·RC 변경.
