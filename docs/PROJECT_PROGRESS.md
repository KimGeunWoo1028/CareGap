# CareGap Progress

**Mode:** sync · 2026-10-28

## Now

Migration reconciliation on `fix/p0-reliability` @ `43ff50b`+: document 005/005b history, freeze CareGap Test schema/data (no DDL/DML this pass).

## Done

- P0 reliability, CI, eval harness, worsened-only matching
- CareGap Test: 004 → 004a → 005 (mismatched payload) → 005b (correct); atomicity A/B previously PASS
- Repo: canonical `sql/005`, corrective `sql/005b`, recovered mismatched payload under `sql/history/`
- Read-only integrity: cases/consultations/programs preserved; 0 orphan FK; 0 dup open; pre-005 orphan `needs_followup` counted (no auto-backfill)

## Next

- Isolated Docker 001→005b reproducibility when Desktop daemon is available
- Approved manual orphan follow-up backfill (optional)
- Next hardening stage only after PARTIAL→PASS on reproducibility

## Tracks

| Track | Status |
|---|---|
| Replay demo path | Stable (RC `107e9ec`) |
| Live provider | Mock-only verified (no paid calls) |
| Follow-up + atomicity | Live on Test via 005b |
| Schema reproducibility | BLOCKED (Docker daemon down) |
| Field evidence | Not started |

## Do-not

실데이터·자동 자격·자동 신청·비밀/백업 커밋·CareGap Test 초기화·migration history 수동 편집·추측성 “검증 통과”·push/`main`·RC 변경.
