# 02 — Issue Resolution

| Issue | Status | Cause | Change | Evidence |
|-------|--------|-------|--------|----------|
| UX-001 | **Resolved** | Empty rendered when `error` set | Empty only if `!loading && !error`; retry button | E2E `list failure is not shown as empty success` |
| UX-002 | **Resolved** | Immediate PATCH | `ConfirmDialog` before done/cancelled; irreversible copy; busy lock | E2E confirm dismiss + confirm apply |
| UX-003 | **Resolved** | No alias in list DTO | `cases(alias)` join → `case_alias`; UI shows alias | E2E alias text + `사례 열기` link |
| UX-004 | **Resolved** | Double `signOut` | `onSignOut` only `router.replace`; header owns signOut | Code review |
| UX-005 | **Resolved** | Filter React-only | `?status=all` via `url-state`; popstate; reset | E2E URL assertions |
| UX-006 | **Resolved (minimal)** | Context lost on follow-ups | Alias + truncated analysis summary + mode/completed_at; deep links with `?return=`; detail return banner restores filter path | E2E alias/summary/`return=` href; no Zendesk panel; no invented evidence |
| UX-007 | **Resolved (minimal)** | Long detail hard to scan | Sticky section nav + `aria-current` via IntersectionObserver; overview kept; notes preview/expand beyond 3 | Code + CSS; evidence screenshots optional |
| UX-008 | **Resolved** | Create panel incomplete a11y | Shared `ModalDialog` (portal, `aria-modal`, name, initial focus, Tab trap, Escape, inert background, restore focus); busy blocks close/submit; errors keep input | E2E `create dialog traps focus…`; unit `focus-trap` |
| UX-009 | **Resolved** | unknown used info chrome | `chip--change-unknown` → warning tokens | CSS |
| UX-010 | **Resolved (policy documented)** | Suspense/`useSearchParams` hang on some Turbopack+headless paths | Drop Suspense; `readQueryParam`; memory session unchanged | Playwright webServer/`next start` E2E; `scripts/ux010-dev-verify.mjs` on `npm run dev` |
| UX-011 | **Resolved** | Unstyled global-error | Inline porcelain/navy + retry + login | Code |
| UX-012 | **Resolved** | Default `needs_followup` | `decision=null` until explicit choice | Unit + E2E radio |

### Policy note (UX-010)

`persistSession: false` is intentional. Full document reload / hard navigation clears the in-memory session and returns to login. Soft SPA navigations keep the session. This is not a defect.

### Deferred / not claimed

- Full Zendesk-style context panel / activity timeline
- axe-core CI gate / WCAG certification
- Fake Undo (no API — correctly not built)
- Screen-reader certification pass
