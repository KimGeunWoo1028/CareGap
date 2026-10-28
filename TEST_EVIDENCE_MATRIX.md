# TEST_EVIDENCE_MATRIX — T01–T26 (Phase 6 session)

Legend for **This session** column:
- **PASS** — verified in this Phase 6 run with the stated layer
- **PARTIAL** — only some layers verified this session
- **BLOCKED** — environment/policy prevented full acceptance check
- **FAIL** — expectation not met (none this session)

| ID | This session | Layer / evidence | Notes |
|---|---|---|---|
| T01 | PASS | Phase1 + real-auth UI + wrong password | Memory re-login after reload confirmed in UI |
| T02 | PASS | Phase1 | Create 201, duplicate alias 409, B 404 |
| T03 | PASS | Phase1 | Two notes, order, duplicate date 409 |
| T04 | PASS | Phase1 | Invalid payloads 400; not stored |
| T05 | PASS | Phase4 | Empty-ish case → 422 NOT_ENOUGH_RECORDS |
| T06 | PASS | Phase6 rehearsal | Isolated case; third note flips is_current |
| T07 | PASS | Phase4 | Same idempotency key → 200 same analysis id |
| T08 | PASS | Phase4 + RC `rc-t08-concurrency.mjs` | Cross-case key conflict; processing same-key 202; other-key ANALYSIS_IN_PROGRESS 409 |
| T09 | PASS | Vitest validate/replay | Exact substring quotes |
| T10 | PASS | Vitest validate | Fabricated quotes / domain errors rejected |
| T11 | PASS | Vitest validate | unknown + null evidence |
| T12 | PASS | Vitest matching (existing suite in `npm test`) | Sort / unverified |
| T13 | PASS | Vitest matching | Empty recommendations path |
| T14 | PASS | Phase4 + Replay×3 | 201 then REVIEW_EXISTS 409 |
| T15 | PASS | Phase4 Replay create + Vitest drift | Replay mode badge path via API `mode=replay` |
| T16 | PASS | Vitest live stub / service | No silent live→replay fallback |
| T17 | PASS | Phase6 rehearsal | Stale processing → TIMEOUT; reserve proceeds |
| T18 | PASS | Phase1 + Phase6 | User INSERT analyses denied |
| T19 | BLOCKED | Policy | Live reservation rate-limit not exercised |
| T20 | PARTIAL | Static + harness logs | No JWT/password in harness lines; Live request capture BLOCKED |
| T21 | PASS | Playwright responsive/mock UI | 390/1280 (+ other viewports in suite) |
| T22 | PASS | Phase1 + Phase4 + Phase6 + real A/B | Cases/notes/analyses/reviews isolation |
| T23 | PASS | Vitest validate | Injection text does not bypass schema rules |
| T24 | PASS | Vitest service | Late success discarded when not processing |
| T25 | PASS | Vitest validate | Unicode substring compare |
| T26 | PASS | Vitest review service | processing/failed review rejected |

## Tooling gates

| Suite | This session |
|---|---|
| typecheck / lint / unit / build | PASS |
| Playwright mock E2E | PASS (28) |
| Playwright real password UI | PASS (3, opt-in) |
| OpenAI Live smoke | BLOCKED |
