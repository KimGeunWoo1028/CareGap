# CareGap Progress

**Mode:** sync · 2026-10-28

## Now

Ready for AI quality / eval hardening. Migration gate closed; 14 orphan follow-ups deferred (list only).

## Done

- P0 reliability, CI, eval harness seed, worsened-only matching
- CareGap Test: 004 → 004a → 005 (mismatched) → 005b (correct); data preserved
- Isolated Docker new-install `001→005` PASS; audit in `docs/POST_MIGRATION_AUDIT.md`
- 14 pre-005 `no_task` analysis IDs recorded as deferred candidates (no backfill)

## Next

- Expand eval set (100–200) · semantic/citation metrics beyond status agreement
- Controlled Live eval when budget approved (not free)
- Roadmap #6 field interviews · #9/#10 institutional

## Tracks

| Track | Status |
|---|---|
| Replay demo path | Stable (RC `107e9ec`) |
| Live provider | Implemented; paid calls not re-run this gate |
| Follow-up + atomicity | Live on Test via 005b |
| Schema reproducibility | PASS (isolated Docker) |
| AI eval depth | Seed only (12 fixtures, status labels) |

## Do-not

실데이터·자동 자격·자동 신청·비밀/백업 커밋·CareGap Test 초기화·migration history 수동 편집·무단 백필·추측성 “검증 통과”·push/`main`·RC 변경.
