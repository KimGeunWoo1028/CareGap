# 05 — Accessibility Audit (WCAG 2.2 AA oriented)

**Scope:** Manual code review + existing Playwright assertions + screenshot inspection.  
**Not run this audit:** axe-core, Lighthouse, NVDA/VoiceOver (tools not added to package.json per freeze).  
**Therefore:** No claim of full WCAG conformance. Findings are **defects or risks**, not a certification.

## Perceivable

| Criterion theme | Finding | Status |
|-----------------|---------|--------|
| Text alternatives | BrandMark decorative `aria-hidden`; status banner has text | Partial |
| Color not sole means | Explicit caveat on domain chips; chip text labels | Pass tendency |
| Contrast | Porcelain on navy / ink on porcelain designed; **not measured** | Unverified |
| Reflow | CSS overflow-x clip; e2e login 200% zoom; auth viewports 390–1920 | Partial (login+auth screenshots) |
| Images of text | Not used for critical content | Pass tendency |

## Operable

| Criterion theme | Finding | Status |
|-----------------|---------|--------|
| Keyboard | Native controls; no keyboard traps found in code | Partial |
| Focus visible | `:focus-visible` 3px | Pass tendency |
| Focus order | Logical form order; create panel focus restore on open/close | Partial |
| Target size (24×24) | `--control-min: 44px` | Pass tendency |
| Pointer cancellation | Standard click buttons | Partial |
| Motion | `prefers-reduced-motion` disables animations | Pass tendency |

## Understandable

| Criterion theme | Finding | Status |
|-----------------|---------|--------|
| `lang="ko"` | layout | Pass |
| Labels | htmlFor on major fields | Pass tendency |
| Errors | aria-invalid + describedby; Alert live on some | Partial — no Error Summary |
| Consistent nav | Header brand + follow-ups | Pass tendency |
| Help | Synthetic / judgment banners persistent | Pass tendency |

## Robust

| Criterion theme | Finding | Status |
|-----------------|---------|--------|
| Valid roles | alert/status/group used | Partial |
| Name/role/value | Buttons named in Korean | Pass tendency |
| Create panel not dialog | Missing dialog semantics if treated as modal | Fail if judged as dialog pattern |
| global-error unstyled | May confuse recovery | Fail risk |

## Specific issues

### UX-010 — Login Suspense stall (Operable / Robust)
- **Observed:** Headless Chromium vs `npm run dev` remained on “로그인 화면을 준비하는 중…” with no `#email` (`evidence/00-debug-login2.png`).
- **Expected:** LoginForm resolves after `useSearchParams` Suspense.
- **Impact:** Demo blockers if judge browser hits same hang.
- **Status:** Partially Verified (dev path); production Playwright path Verified working via E2E.

### UX-011 — Follow-ups error + empty (Understandable)
- Error Alert and “대기 중인 후속 확인이 없습니다” can both show.
- Status: Verified in code `follow-ups/page.tsx` L170–186.

## Tools not used (honest)

| Tool | Why unused |
|------|------------|
| axe-core | Not a project dependency; freeze forbids adding |
| Lighthouse | Not run |
| Screen reader | Not run |

Automatic tooling alone would not have certified AA anyway.
