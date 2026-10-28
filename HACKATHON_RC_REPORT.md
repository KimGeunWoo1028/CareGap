# CareGap AI — Hackathon MVP Release Candidate Report

**Tag target:** `caregap-hackathon-rc1`  
**Branch:** `test/phase6-final-verification`  
**Date (Seoul):** 2026-10-28  
**Demo mode:** `ANALYSIS_MODE=replay` (no paid OpenAI calls this RC)

## 1. Full automated results (this RC session)

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS (119) |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS (35: mock + opt-in real/rehearsal when gate env present) |
| A/B password Auth API | PASS |
| Supabase seed `합성-001` pair | PASS |
| Secrets in reports/console | Not printed (passwords/JWT/keys withheld) |

## 2. Browser rehearsal ×3 (real A UI)

Source: Playwright `e2e/hackathon-rehearsal.spec.ts`  
Artifacts: `e2e/artifacts/hackathon-rc/` (gitignored binaries)

| Run | OK | Wall ms | Replay banner | Review saved |
|---|---|---|---|---|
| 1 | true | 5239 | yes | yes |
| 2 | true | 4726 | yes | yes |
| 3 | true | 4013 | yes | yes |

Mean click-through: **~4.7s**. Each run used a **new** analysis + one review (no duplicate review on same analysis). Seed preserved.

Backup videos (local):  
`e2e/artifacts/hackathon-rc/videos/rehearsal-run-1.webm` … `rehearsal-run-3.webm`  
(~0.8–1.3 MB each; Replay banner visible in flow; no password fields retained after logout screenshots).

## 3. T08 / T19 / T20 final status

| ID | Status | Evidence |
|---|---|---|
| T08 | **PASS** | Same key while processing → **202**; other key → **409 ANALYSIS_IN_PROGRESS** (`scripts/rc-t08-concurrency.mjs`); cross-case key conflict previously PASS in Phase4 |
| T19 | **BLOCKED** | Live rate-limit not exercised (would create live reservations; Replay demo unaffected — SQL limits apply only when `mode=live`) |
| T20 | **PARTIAL** | Harness/RC logs have no JWT/passwords/keys; Live provider capture still BLOCKED (no Live call) |

## 4. Replay demo stability

- API Replay×3 create→review: PASS (~1.5–1.9s each)  
- UI Replay×3: PASS  
- Stale processing cleanup (T17) and isolation (T18/T22): PASS this session  
- Live OpenAI: **not verified** (explicitly out of scope)

## 5. Presentation timing (measured)

DEMO_RUNBOOK section budgets executed end-to-end with real login + Replay analyze + review:

| Metric | Value |
|---|---|
| Target | 240s (4:00) |
| Measured wall | **248s (~4:08)** |
| Within tolerance (≤250s) | **yes** (`presentation-pace.json`) |

Click-only path remains ~5s; narrated stage use the 4:00 script pacing.

## 6. Backup video

| Item | Status |
|---|---|
| 60–90s-class Replay UI recordings | **Produced** (3× WebM, local artifact dir) |
| Committed to git | **No** (`.gitignore` `/e2e/artifacts`) |
| Live-mode backup | N/A |

## 7. Defects

| Issue | Impact | Resolution |
|---|---|---|
| Stale process on :3000 caused flaky standalone pace nav | RC tooling only | Used fresh `:3002` server; e2e webServer path already healthy |
| No product/design regressions found | — | No feature/design changes |

## 8. Git

- Branch: `test/phase6-final-verification`
- Tag: `caregap-hackathon-rc1` (created after this report commit)
- No main merge, no remote push

## 9. Decision

### **GO** (Replay hackathon demo)

Core P0 demo path is stable with real A login, Replay analysis, evidence/candidates/review, measured ~4-minute pacing, and local backup videos.  

**Caveats (non-blocking for Replay stage):** Live OpenAI untested; T19 live quota untested; keep `ANALYSIS_MODE=replay` on stage unless a separate Live approval is given.
