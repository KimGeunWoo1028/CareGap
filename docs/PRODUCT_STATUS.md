# CareGap AI — 제품 구현 상태 (해커톤)

발표 자료·대본·리허설·영상은 이 문서 범위가 아니다. 기능·실행·검증만 정리한다.

**기능 동결 (로컬 RC):** 브랜치 `feat/hackathon-product-hardening`, 태그 `caregap-hackathon-rc2-local` (push·main·`caregap-hackathon-rc1` 이동 없음).

## 환경

- **Supabase:** CareGap Test 단일 프로젝트 ([ENVIRONMENT_SEPARATION.md](ENVIRONMENT_SEPARATION.md))
- **기본 분석 모드:** `ANALYSIS_MODE=replay`
- **웹 Live:** `ANALYSIS_MODE=live` + 실키, 또는 `CARE_GAP_LIVE_MOCK=1`로 유료 호출 없이 Live 경로 검증
- 합성 데이터 전용. 실제 대상자 개인정보 금지

## 구현된 기능

| 영역 | 상태 |
|---|---|
| 로그인(세션 메모리) | 구현 |
| 사례 목록(소유자 RLS, 검색, 빈 상태, 상담 건수) | 구현 |
| 사례 상세 개요·섹션 내비 | 구현 |
| 상담 기록 등록(불변) | 구현 |
| Replay 분석(`합성-001` 고정 원문) | 구현 |
| Live 분석(실 OpenAI / Mock) | 구현 · 웹 Live 실호출은 별도 승인 |
| 4범주 변화·원문 근거·사업 후보 | 구현 |
| 담당자 검토 | 구현 |
| 후속 확인(생성 트리거·완료·취소) | 구현 · UI Mock E2E 포함 |
| 분석 이력 | 구현 |

## 실제 검증 범위 (동결 기준)

| 항목 | 결과 | 비고 |
|---|---|---|
| typecheck / lint / vitest / build / mock E2E | PASS | 동결 커밋 기준 재실행 |
| Replay UI·시연(합성-001) | PASS | mock E2E + 옵트인 rehearsal |
| Live Mock (OpenAI 0회) | PASS | 단위 테스트 |
| Live Recheck / AI eval 코드 포함 | PASS | `05544b8` 등이 본 브랜치 ancestor |
| 후속 PATCH `open→done` / `open→cancelled` · 재개방 차단 · A/B 404 | PASS | 실DB 게이트(승인분). `analysis_id=null` 수동 POST |
| 인증 후 반응형(사례·상세·후속 × 4 viewport) | PASS | 옵트인 `viewport-auth-gate` |
| 검토 저장 → 후속 **자동 생성** | 미입증 | Mock UI만. 실DB 게이트 범위 밖 |
| 웹 Live **유료** OpenAI E2E | 미검증 | 호출 금지 유지 |

## 실행

```bash
npm ci
cp .env.example .env.local   # CareGap Test 값 입력
npm run dev
```

검사: `npm run typecheck` · `lint` · `test` · `build` · `test:e2e`

## Replay vs Live

- **Replay:** 비용 없음. alias·날짜·원문 완전 일치 시에만 성공. 불일치는 시연 모드 안내.
- **Live(실):** 유료·네트워크·검증 실패 가능. CLI smoke ≠ 웹 검증.
- **Live(Mock):** `CARE_GAP_LIVE_MOCK=1` + `ANALYSIS_MODE=live`. OpenAI 미호출.

## 알려진 제한

- 상담·분석·검토 수정/삭제 UI 없음(명세)
- Replay는 고정 시연 한 쌍만
- 웹 Live 실유료 E2E는 기본 스위트에 없음
- real-auth / hackathon-rehearsal / viewport-auth-gate E2E는 `CARE_GAP_REAL_AUTH_E2E=1` 없으면 skip
- 실DB A/B·후속 PATCH는 승인된 게이트로만 검증. 미실행 시 PASS 표기 금지
- 게이트 첫 실패로 남은 orphan `합성-097`(상담·분석·후속 0). 삭제 금지 정책으로 유지
- `scripts/real-db-follow-up-gate.mjs`는 기본 생성 금지(`CARE_GAP_GATE_WRITE=1` 필요). 재실행은 리포트 resume
- `design/full-redesign` 등 미병합 브랜치는 본 RC에 포함되지 않음
- 미커밋 live-smoke dry-run/checkpoint 타임스탬프 노이즈는 RC 산출물 아님

## 오류 대응 (사용자 문구)

| 상황 | 안내 방향 |
|---|---|
| 기록 부족 | 다른 날짜 상담 2건 필요 |
| Replay 불일치 | 시연 모드·준비된 합성 사례만 |
| 분석 실패/타임아웃 | 원문 보관 · 새 분석 또는 직접 검토 |
| 인증 만료 | 재로그인 |
| 후속 완료 후 재개방 | API NOT_FOUND(open만 갱신) |
