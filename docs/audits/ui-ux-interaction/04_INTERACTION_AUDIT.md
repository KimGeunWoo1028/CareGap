# 04 — Interaction Audit

**Sources:** component code, mock E2E specs (`e2e/*-ui.spec.ts`, `follow-ups-ui`, `session-policy`), viewport gate.  
**Not executed this audit:** real DB PATCH/POST (forbidden). Prior gate evidence cited where relevant.

## 5.1 Component state matrix (representative)

| Control | Default | Hover | Focus-visible | Disabled | Loading | Error | Empty | Notes |
|---------|---------|-------|---------------|----------|---------|-------|-------|-------|
| Primary button | yes | CSS | `:focus-visible` | yes | `aria-busy` on analyze/login/save | — | — | |
| Ghost button | yes | CSS | yes | yes when busyId | — | — | — | Follow-up cancel |
| Text/textarea | yes | — | ring | saving | — | `aria-invalid` | — | Values kept (E2E) |
| Cases create panel | collapsed | — | expand focus restore | — | — | field errors | — | No Escape close |
| Follow-up filter | pressed | — | yes | — | sets loading | — | — | Not in URL |
| Modals | **N/A** | | | | | | | None implemented |
| History select | button | — | yes | — | — | — | empty copy | `aria-current` |

## 5.2 Buttons — critical findings

| ID | Issue | File | Reproduce |
|----|-------|------|-----------|
| UX-002 | Follow-up **완료/취소** have no confirmation; cancel uses ghost but still one-click terminal | `follow-ups/page.tsx` L207–224 | Open task → click 취소 |
| UX-003 | Analyze starts without confirm (acceptable for MVP) but creates server work | detail page L586–606 | Click 새 분석 (not done in this audit) |
| — | Busy disables sibling action via `busyId` | follow-ups L212 | Mock E2E |
| UX-004 | Header `onSignOut` + AppHeader both may signOut (follow-ups double call) | follow-ups L116–120 + app-header L14–16 | Logout |

**Visible-but-broken:** none proven. Disabled analyze when <2 notes shows explanatory label — good.

## 5.3 Modal / Dialog

**None.** Escape does not dismiss create panel. No focus trap. Background click N/A.

## 5.4 Search / filter / sort

| Behavior | Status | Evidence |
|----------|--------|----------|
| Cases search partial Hangul | Mock E2E + UI copy “목록에서 검색” | `cases-ui.spec.ts` |
| Empty search distinct from empty list | Yes | cases page L313 vs L339 |
| Clear search | Button restores | E2E |
| Follow-up filter open/all | Works in UI | Code + mock E2E |
| Filter in URL / back-forward | **No** | Code: `useState` only |
| Sort control | **No** (fixed newest) | cases lede copy |
| Cases max 100 | Documented in UI | L273 |

## 5.5 Forms

| Form | Keep values on error | Duplicate submit guard | Enter submit |
|------|----------------------|------------------------|--------------|
| Login | yes (failed login E2E) | submitting disabled | yes |
| Case create | yes (E2E) | saving path | yes |
| Consultation | yes (E2E) | `saving` / length guard | yes |
| Review | local validation; rejected requires note | `busy` disables | yes |

**Missing vs GOV.UK:** page-level Error Summary linking to fields.

**Default review decision** = `needs_followup` (`analysis-review-form.tsx` L27–28) — biases toward creating follow-ups (product choice; call out for demo).

## 5.6 Async

| Pattern | Where | Gap |
|---------|-------|-----|
| Skeleton | cases list | follow-ups uses text only |
| Processing poll 3s | analysis | good distinction failed vs processing |
| Error clears tasks | follow-ups | **empty+error** (UX-001) |
| Stale analysis | `!is_current` warning | good |
| Late response | cancelled flag on cases/follow-ups effects | partial |

## 5.7 Keyboard

| Check | Result |
|-------|--------|
| Focus-visible ring | Present globally |
| Custom key handlers | **None** in TSX |
| Tab through login/cases | Expected via native controls; mock E2E exercises clicks more than full keyboard journeys |
| Escape closes overlays | **No** overlays |
| Full workflow keyboard-only | **Unverified** end-to-end in this audit |

## Interaction reliability score drivers

- Strong: disabled states, aria-busy, keep-on-error forms, terminal follow-up hides actions.  
- Weak: irreversible cancel, error/empty collision, filter persistence, create panel a11y, login Suspense hang on some clients.
