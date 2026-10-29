# 07 — Issue Register

Severity: **P0** safety/identity · **P1** core task / serious a11y · **P2** efficiency/consistency · **P3** polish.

---

### UX-001
- **Category:** Error Prevention & Recovery  
- **Severity:** P1  
- **Screen / Route:** `/follow-ups`  
- **Component / File:** `app/follow-ups/page.tsx` L58–60, L170–186  
- **Observed Behavior:** On API failure, `tasks` cleared and empty-state copy still renders with error Alert.  
- **Expected Behavior:** Error without claiming “대기 중인 후속 확인이 없습니다.”  
- **Steps to Reproduce:** Force follow-ups GET failure (mock) while filter open.  
- **Evidence:** Code inspection; mock pattern in E2E list-failure tests elsewhere.  
- **Benchmark Reference:** GOV.UK — do not mix service errors with empty success states.  
- **User Impact:** May believe there is no work when load failed.  
- **Recommended Fix:** Render empty only when `!error && !loading && tasks.length===0`.  
- **Regression Risk:** Low.  
- **Verification Method:** Unit/component or Playwright mock.  
- **Status:** Verified  

### UX-002
- **Category:** Error Prevention  
- **Severity:** P1  
- **Screen / Route:** `/follow-ups`  
- **Component / File:** `app/follow-ups/page.tsx` L207–224  
- **Observed Behavior:** 완료/취소 immediate PATCH; no confirm; cancel is one ghost click.  
- **Expected Behavior:** At least confirm destructive/terminal cancel (GOV.UK).  
- **Steps to Reproduce:** Open task → 취소.  
- **Evidence:** Code; prior real-DB gate proved terminal irreversibility (404 reopen).  
- **Benchmark Reference:** GOV.UK confirmation; Linear decline often with comment.  
- **User Impact:** Accidental closure of work; reopen blocked.  
- **Recommended Fix:** Minimal confirm dialog or `window.confirm` for cancel (and optionally done).  
- **Regression Risk:** Medium (E2E follow-ups-ui must update).  
- **Verification Method:** Mock E2E.  
- **Status:** Verified  

### UX-003
- **Category:** Workflow Efficiency / Privacy UX  
- **Severity:** P2  
- **Screen / Route:** `/follow-ups` → case link  
- **Component / File:** `follow-ups/page.tsx` L197–200  
- **Observed Behavior:** Link labeled “열기” with surrounding UUID in URL only; list does not show case **alias**.  
- **Expected Behavior:** Show alias (and maybe date) so subject identity is clear before navigation.  
- **Steps to Reproduce:** Open follow-ups with tasks.  
- **Evidence:** Code; screenshots `evidence/follow-ups-*.png`.  
- **Benchmark Reference:** Zendesk context shows requester identity in panel.  
- **User Impact:** Mis-open wrong case among many synthetics.  
- **Recommended Fix:** API include alias or client map; display alias text.  
- **Regression Risk:** Low–med (API contract).  
- **Verification Method:** Mock E2E.  
- **Status:** Verified  

### UX-004
- **Category:** Interaction Reliability  
- **Severity:** P3  
- **Screen / Route:** `/follow-ups`  
- **Component / File:** follow-ups `onSignOut` + `AppHeader.handleSignOut`  
- **Observed Behavior:** Potential double `signOut()`.  
- **Expected Behavior:** Single sign-out path.  
- **Evidence:** Code.  
- **Status:** Verified (code); runtime double-call Partially Verified  

### UX-005
- **Category:** Workflow Efficiency  
- **Severity:** P2  
- **Screen / Route:** `/follow-ups`  
- **Component / File:** filter `useState`  
- **Observed Behavior:** Filter not in URL; refresh returns to default `open`.  
- **Expected Behavior:** Linear-like URL-reflected filter (or documented ephemeral).  
- **Benchmark Reference:** [Linear Filters](https://linear.app/docs/filters)  
- **Status:** Verified  

### UX-006
- **Category:** AI Explainability / Workflow  
- **Severity:** P2  
- **Screen / Route:** `/follow-ups` vs detail  
- **Observed Behavior:** Acting on follow-up loses side-by-side evidence; only task note remains.  
- **Expected Behavior:** Zendesk-like retention of judgment context while completing work.  
- **Benchmark Reference:** Zendesk context panel docs.  
- **Status:** Verified  

### UX-007
- **Category:** Information Architecture  
- **Severity:** P2  
- **Screen / Route:** `/cases/[case_id]`  
- **Observed Behavior:** Very long single page; section nav helps but cognitive load high for first-time judges.  
- **Expected Behavior:** Clearer primary column / progressive disclosure for demo.  
- **Evidence:** Screenshots `case-detail-*`; page structure.  
- **Status:** Verified  

### UX-008
- **Category:** Accessibility / Interaction  
- **Severity:** P2  
- **Screen / Route:** `/cases` create panel  
- **Observed Behavior:** Not a dialog; no Escape; no focus trap.  
- **Expected Behavior:** If modal-like, dialog pattern; else document as inline only.  
- **Status:** Verified  

### UX-009
- **Category:** Visual Consistency / Explainability  
- **Severity:** P2  
- **Screen / Route:** Analysis domains  
- **Component / File:** `chip--change-unknown`, labels  
- **Observed Behavior:** “정보 부족” uses info styling.  
- **Expected Behavior:** Warning-weight semantics (Atlassian warning lozenge).  
- **Mitigation already present:** Text caveat against color-only judgment.  
- **Status:** Verified  

### UX-010
- **Category:** Demo Readiness / Operable  
- **Severity:** P1 (if reproducible on judge machine)  
- **Screen / Route:** `/login` via `npm run dev`  
- **Observed Behavior:** Suspense fallback never yields form in headless Chromium against :3000.  
- **Expected Behavior:** Form appears.  
- **Evidence:** `evidence/00-debug-login2.png`; contrast: Playwright webServer E2E passes.  
- **Recommended Fix:** Diagnose `useSearchParams`/hydration on turbopack; demo with `next start` build.  
- **Status:** Partially Verified  

### UX-011
- **Category:** Robust  
- **Severity:** P2  
- **Screen / Route:** global error  
- **File:** `app/global-error.tsx`  
- **Observed Behavior:** No `globals.css`; unstyled recovery.  
- **Status:** Verified  

### UX-012
- **Category:** AI Explainability / Demo  
- **Severity:** P3  
- **Screen / Route:** Review form  
- **Observed Behavior:** Default radio `needs_followup` preselected.  
- **Expected Behavior:** Neutral default or explicit “선택하세요”.  
- **Status:** Verified  

### UX-013
- **Category:** Privacy & Permission UX  
- **Severity:** P3 (positive control)  
- **Observation:** Cross-user 404 opaque; secrets not in URL on failed login — **strength**, not defect.  
- **Status:** Verified (prior gate + E2E)  

### Out of scope claims (not issues for this freeze)
- Review→follow-up **auto-create** real DB path — **Unverified** (do not PASS).  
- Web Live paid OpenAI — **Unverified**.
