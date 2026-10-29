# 04 — Visual Regression

## Verified via Playwright (mock + opt-in auth)

| Surface | Check | Result |
|---------|-------|--------|
| Login | smoke + responsive 390/1280/1440 | PASS |
| Cases list | mock E2E + create dialog + viewport gate | PASS |
| Case detail | sticky nav + `aria-current` + return banner + notes toggle | PASS (code + prior detail E2E) |
| Follow-ups | confirm dialog; alias; analysis summary; return links | PASS (E2E) |
| Analysis | unknown chip CSS warning | Code-level; mock E2E unchanged |

## Intentional visual changes

- Shared modal backdrop + porcelain panel + close chrome  
- Danger confirm button for cancel  
- Unknown change chip uses warning palette  
- Sticky detail nav current underline  
- Follow-up return banner on case detail  
- Global error card styling  

## UX-010 artifacts

`e2e/artifacts/ux-010-dev/` — login, after-login, reload→login, full-nav→login, create dialog on `npm run dev`.

## Not a pixel-diff suite

No dedicated screenshot baseline tool. Evidence: E2E assertions + audit `docs/audits/ui-ux-interaction/evidence/` for layout context.
