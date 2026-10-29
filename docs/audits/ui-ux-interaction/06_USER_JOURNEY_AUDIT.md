# 06 — User Journey Audit

**Constraint:** No new analyses, reviews, follow-up PATCH, or OpenAI in this audit.  
**Evidence mix:** Code paths, mock E2E (`hackathon-rehearsal`, `analysis-result-ui`, `follow-ups-ui`), prior real-DB gate report (read-only citation), viewport screenshots.

Times are **not** fabricated. Click counts are structural estimates from IA, not stopwatch measurements.

## Scenario A — Normal consultation analysis (Replay)

| Step | Path | Observation | Result |
|------|------|-------------|--------|
| 1 Find subject | `/cases` search | Alias search client-side | Achievable |
| 2–3 View past/current notes | Detail compare strip + notes | Dates + channel + body | Achievable |
| 4 Start analysis | 새 분석 | Replay only if exact fixture match | Mock E2E Verified; live paid **not** |
| 5 Evidence | Domain quotes + full notes in panel | Strong explainability | Achievable |
| 6 Review | Radio + memo | Default `needs_followup` | Achievable |
| 7 Follow-ups | Navigate away to `/follow-ups` | Context drop | Friction |
| 8 Trace back | Quotes + note cards + history | Possible on detail | Achievable |

**Confusion points:** Long page; follow-up page loses evidence; memory session reload → login (demo risk).  
**Hops (structural):** login→cases→detail→(optional follow-ups) ≈ 3–4 navigations.

## Scenario B — Wrong subject selected

| Check | Finding |
|-------|---------|
| Alias visible in breadcrumb | Yes (`detail-breadcrumb__current`) |
| Distinct aliases in list | Yes |
| Cross-user wrong UUID | Opaque 404 (security OK; UX message generic) |
| Recovery | Back to `/cases`, search again |

**Risk:** Similar synthetic aliases (`합성-09x` clutter) increase mis-click probability — data hygiene, not UI alone.

## Scenario C — Empty data

| Empty | UI |
|-------|-----|
| No cases | Guided steps + CTA |
| Search miss | Distinct empty + clear |
| 0 consultations | Warning guidance before analyze |
| No analysis | Panel absent until selected/created |
| No follow-ups | Empty copy (+ risk of error collision) |

Mock E2E covers several empties — Verified.

## Scenario D — Errors / interruption (Mock)

| Condition | Evidence |
|-----------|----------|
| Network/list failure | cases retry UI — E2E |
| Bad login | stays on login, no secret in URL — E2E |
| Duplicate date / 503 consult | values kept — E2E |
| Replay unavailable | distinct error — E2E |
| Analysis failed status | Alert in panel — code |
| Auth expiry | 401 → login — code paths |

Real network abort mid-flight: **Unverified** beyond cancelled flags.

## Scenario E — Hackathon demo (`합성-001` Replay)

| Question | Answer | Evidence type |
|----------|--------|---------------|
| First-time purpose clear? | Yes — banners + login intro + compare demo | Observation (code/UI copy) |
| Core value on screen? | Compare → domains → quotes → unverified candidates | Code + rehearsal E2E |
| Data vs AI distinguished? | Mode banner, caveats, 자격 미확인 | Code |
| Evidence path clear? | Quotes + original notes | Code |
| Next action clear? | Review form; then leave for follow-ups | Partial |
| Demo breakage? | Memory reload; login Suspense hang on broken dev tab; alias clutter | Observed / prior |

`hackathon-rehearsal.spec.ts` (3 runs) previously passed under opt-in real auth — cited as prior evidence, not re-run with writes this audit.

## Journey metrics (structural, not timed)

| Journey | Screens | Primary clicks (min) | Main failure modes |
|---------|---------|----------------------|--------------------|
| A Replay happy path | 3–4 | ~8–15 | Replay mismatch, session reload |
| Follow-up complete | +1 | +2 | Accidental cancel, context loss |
| Wrong case | 2 | 2–4 | Alias similarity |
