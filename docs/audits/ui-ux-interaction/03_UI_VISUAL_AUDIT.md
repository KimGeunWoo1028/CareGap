# 03 — UI / Visual Audit

**Evidence:** `app/globals.css`, screen screenshots under `evidence/`, code layout classes.  
**Split scoring:** Visual Polish vs Operational Usability (see §4.5).

## 4.1 Layout

| Observation | Evidence | Severity |
|-------------|----------|----------|
| Night enamel shell + porcelain work plates is intentional dual surface | `globals.css` L1–3, body gradient L132–136; work `.panel` surfaces | — |
| No sidebar IA; top chrome + single column/line-board | `app-header`, `.line-board` | Operational: simple but shallow hierarchy |
| Case detail is a long vertical stack (overview→compare→result→form→notes→history) | `cases/[case_id]/page.tsx` | P2 density |
| Compare strip becomes 2-col at ≥1280px | `globals.css` ~1504+ | Verified in CSS; screenshots at 1920/1366 |
| Login is branded first-viewport (brand + form + synthetic intro) | `login/page.tsx`, layout thesis comment | Strong demo presence |
| `global-error` unstyled | `global-error.tsx` no CSS import | P2 if triggered |

## 4.2 Typography

| Observation | Evidence |
|-------------|----------|
| Pretendard + Malgun fallback | `layout.tsx` |
| Clear title / panel title / muted hierarchy | `.cases-title`, `.panel__title`, `.muted` |
| Hangul body size raised on work decks (`--body-work`) | tokens L85–86 |
| Long consultation bodies wrap in compare cards | screenshots `case-detail-*` |
| Risk: decorative “transit” metaphor (GATE, line-id) may confuse non-design stakeholders | login `map-platform__code` |

## 4.3 Color system

| Token role | Values | Notes |
|------------|--------|-------|
| Primary action | cobalt `#2f6fed` | Buttons |
| Danger | scarlet / `--error` | Alerts, worsened chips |
| Success | line-green / ok-* | improved / ok alerts |
| Warning | amber / warning-* | stale analysis |
| Info | info-* | processing, **unknown** change |

**Issue:** `unknown` (“정보 부족”) uses info chrome — text mitigates, but Atlassian would map closer to **warning**. Caveat copy present (`analysis-result-panel.tsx` L102–104).

No theme toggle. `html { color-scheme: dark }` with light form controls for date inputs — intentional workaround.

## 4.4 Tables and cards

| Surface | Finding |
|---------|---------|
| Cases table | Alias link, counts, dates; caption visually hidden |
| Follow-up list | Card-like rows; kind·status inline; weak separation of terminal vs open in “전체” |
| Analysis domain cards | Status chip + explanation + quote evidence — strong operational layout |
| Empty states | Cases empty has steps; follow-ups empty can collide with error |

## 4.5 Visual Polish vs Operational Usability

| Dimension | Verdict | Rationale |
|-----------|---------|-----------|
| **A. Visual Polish** | Above typical hackathon baseline | Cohesive token system, brand-forward login, compare “interchange” motif |
| **B. Operational Usability** | Adequate for Replay demo; weaker as caseworker console | Long detail page, follow-up context loss, irreversible actions without confirm, filter/state fragility |

**Do not equate polish with readiness.** Operational gaps dominate release recommendation.

## Unverified visually

- Live authenticated capture against `npm run dev` login form (Suspense hang) — used prior Playwright gate screenshots instead.
- Contrast ratios not instrumented with axe/Lighthouse in this audit (see `05_ACCESSIBILITY_AUDIT.md`).
