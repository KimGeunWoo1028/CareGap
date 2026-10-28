# FINAL_RELEASE_CHECKLIST — Hackathon MVP gate

## A. Build & automated

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run test` (119)
- [x] `npm run build`
- [x] `npm run test:e2e` mock suite (28 pass; real-auth skipped by default)
- [x] Opt-in real password UI E2E (3 pass)

## B. Security / privacy

- [x] `ANALYSIS_MODE=replay` for this verification (no silent Live)
- [x] No OpenAI paid calls this session
- [x] Passwords / JWT / secret keys not written into Phase 6 reports
- [x] User JWT cannot INSERT analyses (T18)
- [x] A/B isolation on cases / analyses / reviews (T22)
- [x] API 401 for missing/invalid token (T01)
- [ ] Live provider payload capture (BLOCKED — no Live call)
- [ ] T19 live rate-limit DB exercise (BLOCKED — policy)

## C. Demo data

- [x] `합성-001` intact with demo date pair
- [x] Replay×3 succeeded with distinct analysis ids + review once each
- [x] Seed not truncated/reset during Phase 6

## D. Product claims discipline

- [x] Replay labeled as non-live in UI copy
- [x] Recommendations shown as unverified / non-application
- [x] No claim of institutional rollout or measured welfare outcomes

## E. Git

- [x] Work on `test/phase6-final-verification` (not force-pushed)
- [ ] main merge — **do not** auto-merge
- [ ] remote push — **only if humans request**

## F. Remaining human actions before stage

1. [x] Replay backup videos recorded locally under `e2e/artifacts/hackathon-rc/videos/`  
2. Optional (explicit approval): Live smoke with cost cap + `ANALYSIS_MODE=live` restart  
3. Confirm stage machine clock, network, and shared screen privacy  
4. Confirm Auth user A owns `합성-001` for the talk  
5. [x] Tag `caregap-hackathon-rc1` on verified commit (no push/merge)

## Gate decision

**GO (Replay hackathon demo)** — see `HACKATHON_RC_REPORT.md`.  
Warnings: Live OpenAI and T19 live quota remain unverified.
