# CareGap AI — 제품 구현 상태 (해커톤)

발표 자료·대본·리허설은 이 문서 범위가 아니다. 기능·실행·검증만 정리한다.

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
- real-auth / hackathon-rehearsal E2E는 환경 변수 없으면 skip
- 실DB A/B 격리는 모의 테스트와 구분(미실행 시 PASS 표기 금지)

## 오류 대응 (사용자 문구)

| 상황 | 안내 방향 |
|---|---|
| 기록 부족 | 다른 날짜 상담 2건 필요 |
| Replay 불일치 | 시연 모드·준비된 합성 사례만 |
| 분석 실패/타임아웃 | 원문 보관 · 새 분석 또는 직접 검토 |
| 인증 만료 | 재로그인 |
| 후속 완료 후 재개방 | API NOT_FOUND(open만 갱신) |
