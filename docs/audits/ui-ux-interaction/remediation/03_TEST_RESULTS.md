# 03 — Test Results

**Run date:** 2026-10-29 (final remediation pass)  
**Branch:** `fix/caregap-ux-audit-remediation` @ `8c5057e` (uncommitted remediation changes)

| Command | Result | Notes |
|---------|--------|-------|
| `npm run typecheck` | **PASS** | |
| `npm run lint` | **PASS** | |
| `npm run test` | **PASS** | **245** tests |
| `npm run build` | **PASS** | Next.js 16.4.3 |
| `npm run test:e2e` | **PASS** | **43** tests |

## Delta

| Suite | Prior remediation doc | Final |
|-------|----------------------:|------:|
| Vitest | 243 | **245** |
| Playwright | 42 | **43** |

New coverage this pass:

- `lib/ui/focus-trap.test.ts`
- E2E create-dialog Tab cycle / Escape / focus restore
- Follow-ups alias + analysis summary + `return=` deep link assertions
- Cases unit tests updated for body-portal dialog

## UX-010 `npm run dev` recheck

| Check | Result |
|-------|--------|
| Direct `/login` | PASS (`scripts/ux010-dev-verify.mjs`) |
| Login success | PASS |
| Reload after login → login again | PASS (intentional memory session) |
| Soft nav cases ↔ follow-ups | PASS |
| Hard `goto /cases` while “authenticated” | Redirects to login (policy, not defect) |
| Create dialog Escape restore | PASS |
| Hydration | WARN: Playwright injects `caret-color: transparent` during fill — not an app hang |

Artifacts: `e2e/artifacts/ux-010-dev/`

Focused re-run against live `npm run dev` (`PLAYWRIGHT_BASE_URL=http://localhost:3000`): create dialog + follow-ups alias + empty-list focus — **3 passed**.

## Not run / out of scope

| Item | Reason |
|------|--------|
| Real DB follow-up PATCH | Safety — no production writes |
| Paid OpenAI | Forbidden |
| axe-core automated CI | Not a project dependency; not claimed as WCAG cert |
| Screen-reader formal certification | Manual spot-check only — **미검증** for full SR pass |

## Opt-in E2E note

Shell with `CARE_GAP_REAL_AUTH_E2E=1` also ran real-auth / viewport / rehearsal in the full suite and passed. Default CI without the flag skips those.
