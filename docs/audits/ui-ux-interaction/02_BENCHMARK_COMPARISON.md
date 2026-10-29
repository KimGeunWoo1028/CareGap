# 02 — Benchmark Comparison

**Method:** Official documentation first. Patterns CareGap does not implement are marked as gaps, not defects of those products.  
**Limitation:** Live Zendesk/Dynamics/Linear product UIs were **not** logged into; comparison uses published docs only.

## Summary table

| Product | Verified Pattern | CareGap Current State | Gap | Adaptation (no copy) | Priority | Source |
|---------|------------------|----------------------|-----|----------------------|----------|--------|
| Zendesk Agent Workspace | Ticket + **context panel** (user history, apps) beside work | Single scrolling case page; no persistent side context while reviewing | Follow-up actions lose side-by-side evidence unless user scrolls | Keep evidence sticky or split pane on ≥1280px for analysis+review | P2 | [About Agent Workspace](https://support.zendesk.com/hc/en-us/articles/4408821259930-About-the-Zendesk-Agent-Workspace), [Context panel](https://support.zendesk.com/hc/en-us/articles/4408836526362-Using-the-context-panel) |
| Zendesk | Interaction history / ticket events with field diffs | Analysis history list + consultations list; no unified event timeline | Harder to answer “what changed when” across note/analysis/review/follow-up | Optional chronological activity rail (post-hackathon) | P3 | [Customer context](https://support.zendesk.com/hc/en-us/articles/4408829170458), [Ticket events](https://support.zendesk.com/hc/en-us/articles/4408829602970) |
| Dynamics 365 CS | Case form + **Activity timeline** (type/state/date filters) | Separate sections; follow-ups on another route | Status of notes vs analyses vs follow-ups not one timeline | Do not clone Dynamics; add light “이력 타임라인” later | P3 | [Activity timeline](https://learn.microsoft.com/en-us/dynamics365/developer/reference/mcp-tools/get_activity_timeline), [Case detail](https://learn.microsoft.com/en-us/dynamics365/developer/reference/mcp-tools/get_case) |
| Dynamics | Next action visible on case | Overview shows latest analysis/review labels; next step partly in guidance text | Follow-up CTA not tied to open tasks for this case | Case overview: count of open follow-ups for this case | P2 | Same Learn docs |
| Linear | Triage inbox + explicit status categories | Follow-ups open/all filter only | No priority, no triage keyboard, no URL-synced filters | Keep simple inbox; add due/priority only if volume grows | P3 | [Triage](https://linear.app/docs/triage), [Filters](https://linear.app/docs/filters), [Issue properties](https://linear.app/docs/issue-property) |
| Linear | Filters reflected in **URL** for share/reload | Filter is React state only | Refresh resets filter to default `open` | Encode `?status=` in URL (minimal) | P2 | [Filters](https://linear.app/docs/filters) |
| GOV.UK | Error message explains **what + how to fix**; keep values | Field alerts + Korean copy generally good; **no Error Summary** | Multi-field forms lack page-level error summary | Add summary above consultation form on submit fail | P2 | [Error message](https://design-system.service.gov.uk/components/error-message/) |
| GOV.UK | Task list: status not button-like; whole row linked | Follow-up status is text in line with actions | Cancel/Done look like primary work; status chips weak | Style terminal status as non-button tag (Atlassian lozenge pattern) | P2 | [Task list](https://design-system.service.gov.uk/components/task-list/) |
| GOV.UK | Confirmation before hard-to-reverse actions | Done/Cancel one-click | Accidental terminal PATCH | Confirm cancel (and optionally done) | P1 | GOV.UK patterns + CareGap irreversible PATCH |
| Atlassian | Semantic lozenge (success/warning/danger/info) + text | Chips for change status + 자격 미확인 | `unknown` uses info styling — readable but easy to under-weight | Keep text labels (already); ensure unknown uses warning semantics | P2 | [Lozenge](https://atlassian.design/components/lozenge/examples) |

## Answers to CareGap-specific benchmark questions

### Zendesk
1. **Context on one screen?** Partially — overview + compare + result on one page, but no sticky context panel.  
2. **Round-trips for history?** Low for notes/history on same page; follow-ups require leaving case.  
3. **Analysis + source together?** Yes — quotes + full note bodies in `AnalysisResultPanel`.  
4. **Evidence while acting on follow-ups?** **No** — follow-up page shows note string + case UUID link only.

### Dynamics
1. **Chronological clarity?** Partial — separate lists, not one timeline.  
2. **Previous vs current?** Strong compare strip + role labels.  
3. **Next action?** Compare guidance + analyze button; weaker after review.  
4. **Status consistency?** Korean labels exist; follow-up vs review vocab differs (“대기” vs “추가 확인 필요”).  
5. **Screen hops for key info?** Cases→detail≈1; detail→follow-ups≈1; reverse loses scroll position.

### Linear
1. **Prioritize follow-ups?** **No** priority UI.  
2. **Clear filters + reset?** Two toggles; no explicit “reset” beyond switching.  
3. **Filter persistence?** **Fails** on reload (memory + no URL).  
4. **Done vs open confusion?** Actions hidden when terminal — good; mixed “전체” list needs visual weight.  
5. **Context after navigation?** Case link opens detail cold (no return-to-task affordance).

### GOV.UK
1. Korean guidance: generally plain and purpose-clear (synthetic limits).  
2. Fix hints: present on many fields; not always Error Summary.  
3. Value preservation: e2e asserts keep-on-error for cases/consult forms — **Verified** in mock E2E.  
4. Status vs button: follow-up actions are real buttons; statuses are text — OK, but cancel is easy.  
5. Pre-action understanding: analyze has helper text; terminal follow-up has **no** confirm.  
6. Low digital literacy: possible for Replay path; long detail page is heavy.

### Atlassian
1. Risk/progress colors: domain chips + alert tones exist.  
2. Text besides color: explicit caveat “색상만으로 판단하지 말고…”.  
3. Same meaning / different colors: legacy CSS aliases exist but mapped.  
4. Same action / different components: primary vs ghost used consistently for main vs secondary.

## What we did **not** claim

- Visual polish of Zendesk/Linear as seen in marketing screenshots (not logged in).  
- Dynamics timeline AI highlights as applicable to CareGap MVP scope.
