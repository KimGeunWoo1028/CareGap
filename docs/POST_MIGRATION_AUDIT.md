# Post-Migration Audit & Reproducibility Gate

**Date:** 2026-10-28  
**Branch:** `fix/p0-reliability` @ `671802a`  
**CareGap Test:** `korebhoeetajvelogcrx` (read-only this pass)  
**RC / main:** `107e9ec` (unchanged)

## Verdict

**PASS** for audit + new-install reproducibility. CareGap Test data left unchanged.  
**14-row orphan backfill: deferred by product decision (2026-10-28)** — candidates preserved below only; no DB writes.

---

## 1. Git & migration history

| Item | Result |
|---|---|
| Working tree at start | clean @ `671802a` |
| `main` / `caregap-hackathon-rc1` | `107e9ec` |
| Repo SQL | `004`, `004a`, `005` (canonical), `005b` (corrective), `sql/history/…mismatched-applied-payload.sql` |
| Test migrations | `004` → `004a` → `005`(mismatched recorded) → `005b`(live correct) |
| New install path | `001→002→003→004→004a→005` only — **not** mismatched payload, **not** `005b` |
| Upgrade path (Test-like) | already at `005b`; no further DDL |

---

## 2. `needs_followup` classification (n=22)

Read-only query on CareGap Test. No inserts/updates.

| Classification | Count | Meaning |
|---|---:|---|
| `has_open` | **7** | Open `next_consultation` exists |
| `has_done_only` | **1** | Task completed; no open row (expected) |
| `has_cancelled_only` | **0** | — |
| `no_task` | **14** | No `next_consultation` row at all |
| FK / ownership mismatch | **0** | — |

**Without open task:** 15 = 14 `no_task` + 1 `has_done_only`.

### Deferred backfill candidate list (`no_task` = 14)

Past synthetic test reviews (pre-005). **Do not backfill unless explicitly re-approved.** Data remains as-is on CareGap Test.

| analysis_id | note preview | cause |
|---|---|---|
| `59eac53d-ba87-40ee-9b6b-d8256e5bc4d9` | phase6 rehearsal 2 | pre-005 gap |
| `4a361325-7843-4ecf-b67d-cfd2bb01bbd2` | phase6 rehearsal 3 | pre-005 gap |
| `d6bd5da8-4ad3-4967-bf61-dc223237e19b` | 합성 통합 검토 | pre-005 gap |
| `78c23861-aa4c-4da4-8a0d-6f2db808b312` | 합성 통합 검토 | pre-005 gap |
| `bc105a81-494c-401e-86d4-d7f039e87fde` | phase6 rehearsal 1 | pre-005 gap |
| `ba66f158-e1fd-42a0-8392-4585b9e8f4da` | phase6 rehearsal 2 | pre-005 gap |
| `ce5533df-0f63-4127-acd1-52a326e5bcf0` | phase6 rehearsal 3 | pre-005 gap |
| `6c1cc9bc-a53b-4128-a79f-63aaec6109b4` | phase6 rehearsal 1 | pre-005 gap |
| `1b653c30-0808-4544-9ade-be6abec3539a` | phase6 rehearsal 2 | pre-005 gap |
| `55a54e4d-bd28-4a9a-a049-ab53ae7ca08f` | phase6 rehearsal 3 | pre-005 gap |
| `6b97915e-973b-48e1-bc6e-749ddb45af00` | RC rehearsal 1 | pre-005 gap |
| `5faf2f6f-9c33-4cd0-8a71-086c0152a1bd` | RC rehearsal 2 | pre-005 gap |
| `aff13eaa-3ab1-4bc2-a90a-a1d935ccf1f4` | RC rehearsal 3 | pre-005 gap |
| `8598b17a-b685-4c13-b6f9-9c5b45fd62d6` | 발표 페이스 실측 | pre-005 gap |

### Not missing (`has_done_only` = 1)

| analysis_id | note | status |
|---|---|---|
| `bc2dbfda-b9d9-41bb-88bc-4fce5a0a6f4c` | 통합 검증: 추가 상담 필요 | **done** task exists — not a backfill candidate |

### Post-005 healthy (`has_open` = 7)

Includes atomicity fixtures (`fixture-005`) and earlier recovered opens — consistent with 005b.

---

## 3. Correction plan — **deferred**

| Decision | Scope |
|---|---|
| **Deferred (2026-10-28)** | 14 `no_task` rows kept as candidate list only |
| **Not needed** | `has_done_only`, `has_open`, ownership/FK |

If revisited later: one `POST /follow-ups` / `createFollowUpFromReview` per analysis (`next_consultation`/`open`). No bulk SQL rewrite; no 001–005b re-run; no delete of existing rows.

---

## 4. New-install reproducibility

| Check | Result |
|---|---|
| Docker Desktop engine | **up** (server 29.8.1) |
| Supabase CLI (global) | not installed; `npx supabase@2.122.0` available — **not required** for this gate |
| Script | `scripts/verify-sql-new-install.mjs` |
| Path applied | `001` → `002` → seed → `004` → `004a` → **canonical `005`** |
| Excluded | mismatched history payload, `005b` |
| Tables / RLS / GRANT / INVOKER trigger | PASS |
| needs_followup auto-task | PASS |
| confirmed/rejected no task | PASS |
| duplicate open blocked | PASS |
| B isolation | PASS |
| trigger fail → full rollback | PASS |
| **NEW_INSTALL_SUMMARY** | **PASS** |

CareGap Test was **not** reset or migrated in this gate.

---

## 5. Local regression (this pass)

| Check | Result |
|---|---|
| typecheck | PASS |
| lint | PASS |
| unit (Vitest) | 152 PASS |
| build | PASS |
| Mock E2E | 28 PASS / 7 skipped (real-auth · rehearsal) |
| OpenAI Live | not called |

---

## 6. Residual risks

1. 14 orphan `needs_followup` rows remain on Test as historical synthetic data (backfill deferred).  
2. CareGap Test migration **name** `005` still points at mismatched payload in history; live objects match `005b`/canonical `005`.  
3. Isolated install uses Postgres stubs for `auth.*` / roles — not a full Supabase stack (sufficient for SQL contract gate).
