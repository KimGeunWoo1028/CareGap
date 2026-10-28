# CareGap Progress

**Mode:** sync · 2026-10-28

## Now

`feat/ai-evaluation-foundation`: offline eval dataset/metrics/pipeline foundation (no Live calls).

## Done

- Migration gate closed (`efd3dd5` base); 14 orphan follow-ups deferred
- Eval dataset v1 (~100 synthetic cases), validators, metrics, pipeline tests
- Live prep gates documented; execution forbidden in this slice

## Next

- Controlled Live eval (opt-in + budget) when approved
- Expert review of labels; expand toward 100–200 with richer citation gold
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
