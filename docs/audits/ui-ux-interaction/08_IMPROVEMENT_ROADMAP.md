# 08 — Improvement Roadmap

**Rule:** No implementation in this audit. Options compared per issue cluster.  
**Freeze:** Prefer Minimal Fix before RC2 demo if P0/P1; Structural Redesign post-hackathon.

## Grouping

### A. Fix before hackathon demo (if any code change is later approved)

| Item | Options | Freeze impact |
|------|---------|---------------|
| UX-010 Login Suspense hang | **A** Demo via `next start` / known-good browser tab; **B** Fix Suspense/hydration | A: zero code; B: med risk |
| UX-001 Empty+error | **A** Conditional empty | Low risk, high value |
| UX-002 Confirm cancel | **A** `window.confirm`; **B** accessible dialog | A tiny; B needs E2E update |
| Demo ops | Use Replay + `합성-001` only; avoid reload; avoid clicking Cancel on gate tasks | Process only |

### B. Improves demo quality (still small)

| Item | Minimal | Refinement | Structural |
|------|---------|------------|------------|
| UX-003 Alias on follow-ups | Show alias if API already returns joinable data | Enrich GET list | Redesign inbox cards |
| UX-012 Neutral review default | Default unset / `confirmed` | Wizard step | — |
| UX-009 Unknown chip tone | CSS token swap to warning | — | Full status system |
| Section focus for demo | Scroll-spy highlight | Collapsible “시연 모드” layout | Split app shell |

### C. Post-hackathon productization

| Item | Notes |
|------|-------|
| UX-006 Sticky evidence / split pane | Zendesk-inspired context retention |
| UX-005 URL filters | Linear-like shareability |
| UX-007 Progressive disclosure | Dynamics-like tabs/timeline |
| Unified activity timeline | Dynamics Activity timeline pattern |
| Priority / due sorting | Linear triage (only if volume warrants) |
| Dialog system | Focus trap, Escape |
| axe CI | After freeze lifts |

### D. Explicitly out of scope now

- Multi-role ACL UI  
- Live paid OpenAI E2E as UX dependency  
- Cleaning orphan `합성-097` (data policy)  
- Merging `design/full-redesign` without separate approval  
- Push / moving RC1/RC2 tags  

## Alternative comparison template (representative)

### Confirm cancel (UX-002)

| | A Minimal | B Refinement | C Structural |
|--|-----------|--------------|--------------|
| Approach | `confirm()` before PATCH cancelled | Accessible modal with focus return | Undo window / soft-delete |
| Pros | Fast, clear | A11y-complete | Best ops safety |
| Cons | Native dialog UX | More code/tests | Spec + API change |
| Freeze | Acceptable if approved | Risky near demo | Defer |

### Follow-up context (UX-006)

| | A | B | C |
|--|---|---|---|
| Approach | Link text shows alias + “분석으로” deep link | Side drawer with last analysis summary | Full agent workspace split |
| Freeze | Prefer A/B later | — | Post |

## Recommended sequence (if freeze temporarily lifted)

1. UX-001 empty/error guard  
2. UX-002 cancel confirm  
3. UX-003 alias visibility  
4. Stabilize login path for demo (`next start` or UX-010 fix)  
5. Defer timeline/split-pane
