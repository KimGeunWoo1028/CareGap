# 05 — Accessibility Result

## Fixed

| Item | Change |
|------|--------|
| Confirm dialog | Reuses `ModalDialog`: `role=dialog` `aria-modal`, labelled, Escape, Tab trap, restore focus, body scroll lock, inert background |
| Create dialog | Same shell; accessible name; initial focus on alias; busy disables close/Escape/backdrop; errors keep input |
| Review radios | No silent default; must choose |
| Case detail nav | `aria-current` on sticky section links |
| Follow-ups context | Alias + summary (when present) + deep links; no fabricated evidence |
| Global error | Clear actions, Korean copy |
| Focus-visible | Unchanged global ring |

## Manual / automated this pass

| Check | Result |
|-------|--------|
| Keyboard create dialog (Tab / Shift+Tab / Escape / restore) | **PASS** (Playwright) |
| Confirm dialog keyboard | **PASS** (prior + shared ModalDialog) |
| Error messages (`role=alert`) | Exercised in unit/E2E |
| Status announcements | Partial via existing `aria-live` / Alert — not exhaustive |
| Contrast | Not re-measured instrumentally — **미검증** |
| Semantic HTML | Spot-checked dialog/nav/forms |
| Screen reader | Not run — **미검증** |
| axe-core | Not installed/run — **미검증** |

## Remaining limits

- axe-core CI / full WCAG 2.2 AA certification **not** claimed  
- Screen-reader certification **not** claimed  
- Contrast instrumental re-measure **미검증**
