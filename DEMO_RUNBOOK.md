# DEMO_RUNBOOK — CareGap AI 4분 시연

**Mode for this package verification:** Replay (`ANALYSIS_MODE=replay`)  
**Do not claim Live AI** unless a separate Live smoke has been approved and measured.

## 1. Pre-demo checklist (day-of)

- [x] Node 24+, `npm run build` succeeds *(RC 2026-10-28)*
- [x] `.env.local`: Supabase URL/publishable/secret present; `ANALYSIS_MODE=replay`
- [x] Dev/prod server reachable; request timeout ≥ 45s if Live ever enabled later
- [x] Test user A password login works (UI)
- [x] Case `합성-001` visible for A with notes dated **2026-09-10** and **2026-10-10**
- [x] Exact seed bodies (DEMO_GUIDE):
  - 2026-09-10: `혼자 식사도 잘하시고 가까운 가게까지 걸어가 장을 볼 수 있음.`
  - 2026-10-10: `최근 다리가 불편해 장을 보기 어렵고 식사를 자주 거르심.`
- [ ] Screen sharing hides `.env`, network Auth headers, password managers *(human on stage)*
- [x] Fresh browser session (memory session → refresh needs login)

## 2. 4-minute script (operator actions)

| Time | Click / show | Say |
|---|---|---|
| 0:00–0:30 | Login as A → Cases list | “돌봄틈새 AI는 담당자가 누적 상담 기록을 비교하도록 돕는 도구입니다. 실제 개인정보는 쓰지 않았습니다.” |
| 0:30–1:10 | Open `합성-001`, previous/current cards | “이전에는 식사·장보기가 가능했고, 최근에는 다리 불편과 식사 누락이 기록됐습니다.” |
| 1:10–2:00 | **새 분석** → wait for result | “지금은 Replay입니다. 사전 준비된 시연 결과이며 실시간 AI 호출이 아닙니다.” (UI banner) |
| 2:00–2:50 | Domain cards + quotes | “변화는 원문 근거와 함께 봅니다. 정보가 없으면 ‘정보 부족’입니다.” |
| 2:50–3:30 | Recommendations + source link | “연계 후보이며 자격은 미확인입니다. 공식 출처와 확인 항목을 담당자가 봅니다.” |
| 3:30–4:00 | Review `추가 확인 필요` + save | “이 저장은 신청·자격 확정이 아닙니다. 담당자 판단 보조입니다.” |

## 3. Screen sequence (click order)

1. `/login` → email/password → 로그인  
2. `/cases` → `합성-001`  
3. Confirm compare strip (이전 / 현재)  
4. 새 분석  
5. Scroll: summary → notes → 4 domains → questions → candidates  
6. Review radios → 검토 저장 → readonly confirmation  
7. Optional: 분석 이력 row select  
8. 로그아웃  

## 4. Expected failures & recovery

| Symptom | Likely cause | Recovery |
|---|---|---|
| 422 REPLAY_UNAVAILABLE | Seed body/date drift or extra newer notes | Fix seed texts/dates; do **not** delete via UI; use spare test user if needed |
| 409 REVIEW_EXISTS | Already reviewed this analysis | Start **새 분석** with a new attempt (new idempotency key) |
| 409 ANALYSIS_IN_PROGRESS | Prior processing | Wait / poll; after 60s stale cleanup allows new key |
| 401 / login loop | Memory session cleared | Log in again; expected after refresh |
| Blank candidates | Matching found no worsened domains | Still a valid success; explain unverified / empty copy |

## 5. AI / network / DB alternatives

- **AI only (if Live were used):** Do **not** auto-fallback. Explain failure, switch server to `ANALYSIS_MODE=replay`, restart, new analysis. Prefer pre-recorded Replay video with mode visible if switch costs too much time.  
- **Internet / Supabase / host down:** Play backup recording; state clearly it is a recording. Replay is **not** fully offline (still needs auth + DB + app).  
- **Wrong password on stage:** Re-type carefully; never paste secrets into chat or slides.

## 6. Backup recording plan

| Item | Status |
|---|---|
| Plan: 60–90s Replay flow with mode banner + timestamps visible | Done |
| Actual video files (RC) | Local `e2e/artifacts/hackathon-rc/videos/rehearsal-run-*.webm` (gitignored) |
| Live-mode backup video | N/A (Live blocked; Replay-only RC) |

### How to re-record if needed

```powershell
$env:CARE_GAP_REAL_AUTH_E2E="1"
npx playwright test e2e/hackathon-rehearsal.spec.ts
# Copy test-results/**/video.webm → e2e/artifacts/hackathon-rc/videos/
```

Do not show password managers or Network Auth headers while recording.

## 7. Judge Q&A (evidence-first)

- **현장 효과?** “가설 단계. 담당자 시간과 정확도는 아직 기관 검증 전입니다.”  
- **자격 확정?** “아닙니다. unverified 후보이며 사람이 확인합니다.”  
- **왜 공공 API 없나?** “해커톤은 고정 목록+공식 출처. API 연동은 후속.”  
- **안전한가?** “합성 전용, JWT+RLS, 원문 근거 검증. 실도입 전 보안·개인정보 평가 필요.”  

## 8. Timing note (RC measured)

| Path | Measured |
|---|---|
| API Replay create+review | ~1.5–1.9s |
| UI click-through (login→review→logout) | mean **~4.7s** (3 runs) |
| Narrated DEMO_RUNBOOK pacing dry-run | **248s (~4:08)** — within 4-minute stage budget |

Do **not** guarantee Live latency without a measured Live smoke. On stage, speak to the section table above; do not rush the click-only path.
