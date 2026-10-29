# CareGap 환경 분리 — Test / Staging / Production

이 문서는 **기존 CareGap Test를 Staging·Production처럼 재사용하지 않는다**는 설계를 고정한다. 현 단계는 합성 데이터 전용이며 실제 복지 대상자 개인정보를 쓰지 않는다.

## 1. 데이터 출처 구분

| 구분 | 목적 | 저장 위치 | 일반 사용자 사례 목록 유입 |
|---|---|---|---|
| CareGap Test DB 누적 사례(~21건) | 해커톤·개발·Replay 시연 중 같은 테스트 계정으로 만든 합성 사례 | 기존 Supabase **CareGap Test** `cases` 등 | 해당 계정으로 로그인하면 **본인 소유분 전부** 표시(숨김 필터 없음) |
| `sql/003_demo_seed.sql` | Replay용 `합성-001` + 고정 두 상담 원문 | Test DB에 **수동 적용**된 시드 | 시드 대상 이메일의 계정에 `합성-001` 1건 |
| `fixtures/replay-analysis.json` | Replay 엔진 고정 결과 | 저장소 fixture | DB 삽입 없음 |
| `fixtures/eval/**`, `dataset.v1` | AI 평가·Live smoke | 저장소 artifact / 로컬 실행 | 앱 목록에 자동 등록 **금지** |
| 분석·검토·후속 업무 | 기능 검증 이력 | Test DB `analyses` / `reviews` / `follow_up_tasks` | 사례 상세·후속 화면에서만 조회 |
| Staging DB (신규) | 실제 서비스와 같은 UX·빈 시작 | **별도** Supabase 프로젝트 | 새 계정 = 사례 0건. 003 대량 자동 시드 금지 |

목록이 “지저분한” 이유는 UI 버그가 아니라 **Test 프로젝트에 연결된 개발 계정이 소유한 사례가 많기 때문**이다. 앱은 이미 owner RLS로 본인 사례만 반환한다.

## 2. 환경 정의

### CareGap Test (유지)

- 현재 ~21건 및 상담·분석·검토·후속 이력 **보존**
- Replay RC·평가 CLI·기존 `.env.local`이 가리키는 프로젝트 유지
- SQL 001~005b 이력 **불변**. 데이터 삭제·초기화 금지
- 이 DB를 Staging URL로 바꿔 쓰지 않음

### CareGap Staging (승인 후 구축)

- **새** Supabase 프로젝트 + **새** Auth 사용자 + **새** 환경 변수 세트
- 스키마: `001` → `002` → `004` → `004a` → `005`(의도 SQL). **`003_demo_seed` 기본 생략**
- 사업 카탈로그는 `002`만. 사례는 사용자가 UI로 직접 등록
- UI·API·데이터 모델은 Production과 동일하게 유지
- `ANALYSIS_MODE`는 운영자가 명시 설정. Live 자동 활성화·유료 호출 자동 실행 금지

### Production (향후)

- Staging과 동일 화면·모델, **별도** DB·인증·비밀키
- 실제 개인정보 처리는 보안·법률·운영 검증 후 별도 판단

## 3. 애플리케이션 동작 (Staging 승인 전에도 적용)

- 로그인 후 `/cases`: 소유 사례만, 0건이면 빈 상태 + 작업 순서 안내
- 사례 추가 → 상담 기록 → 비교 분석 → 검토 → 후속 확인 → 이력 조회
- 목록에 개발용 ID / Replay 가능 여부 / `failure_code` 미표시
- 평가 fixture를 신규 계정에 자동 삽입하지 않음
- Replay는 `합성-001` 고정 원문만. 미지원은 AI 장애로 오인되지 않게 안내
- 합성 데이터 전용 배너 유지

## 4. Staging Supabase — 사용자 승인 필요 작업

**외부 서비스 변경이므로 승인 전에는 실행하지 않는다.**

1. Supabase에서 새 프로젝트 생성(이름 예: `CareGap Staging`), 공개 가입 비활성
2. Auth에 Staging 전용 테스트 계정 A(격리 시험 시 B) 생성. 비밀번호·키는 저장소에 넣지 않음
3. SQL Editor에서 순서대로: `001_schema.sql` → `002_programs.sql` → `004_follow_up_tasks.sql` → `004a_follow_up_terminal_immutable.sql` → `005_review_follow_up_atomicity.sql`  
   - **003 생략** (깨끗한 0건 시작)  
   - CareGap Test의 `005b`/history 불일치 페이로드는 Staging에 적용하지 않음
4. 로컬(또는 호스트)에 `.env.staging.local` 등 **별도** 파일로 URL / publishable / secret / `ANALYSIS_MODE` 설정. Test `.env.local`을 덮어쓰지 않음
5. Staging 계정으로 로그인 → 사례 0건 확인 → 사례 1건 수동 등록 → 기록 2건 → (Replay면 시연 원문만 / Live는 별도 예산 승인)
6. 기존 CareGap Test 프로젝트·데이터·키는 그대로 둔다

승인 문구 예: “CareGap Staging용 새 Supabase 프로젝트 생성과 001·002·004·004a·005 적용을 진행해도 된다(003 제외).”

## 5. 웹 Live 경로 검증 상태 (주장 금지)

| 경로 | 상태 |
|---|---|
| 서버 `ANALYSIS_MODE=live` + `runAnalysis` | 구현됨. 웹은 서버 모드만 따름 |
| CLI Live smoke / recheck-v2 | 평가 하네스에서 검증. **웹 UI E2E Live 유료 호출은 이번 작업에서 수행하지 않음** |
| Replay 웹 | 고정 fixture 일치 시에만 성공. 불일치는 `REPLAY_UNAVAILABLE` 사용자 안내 |
| 일반 신규 합성 사례의 웹 Live | Staging DB + Live 키·예산·관측 절차가 갖춰진 뒤 **별도 검증** 필요. 지금은 “웹 Live가 안전하게 검증됨”이라고 단정하지 않음 |

일반 신규 사례 Live를 제품 수준으로 열려면 추가로 필요한 것:

1. Staging(또는 전용) DB와 Live 전용 비밀키·모델·비용 한도
2. Replay가 아닌 입력에 대한 웹 스모크(승인된 유료 호출 또는 기록된 fixture 재생 정책)
3. 실패 시 Replay 자동 전환이 없음을 UI·로그로 재확인
4. 인용·스키마 서버 검증 회귀와 운영 모니터링

## 6. 금지 사항

- Test DB 사례를 UI에서만 숨기는 임시 필터를 Staging 대체로 쓰지 않음
- Test를 wipe하거나 Staging URL로 재라벨하지 않음
- 001~005b 불변 SQL을 Staging 핑계로 Test에 재적용·수정하지 않음
- 평가 데이터셋 자동 유입, Live 자동 활성화, 승인 없는 유료 OpenAI 호출
