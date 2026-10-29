# CareGap 해커톤 단일 환경 정책

**해커톤(약 2일) 범위에서는 CareGap Test Supabase 프로젝트 하나만 사용한다.**  
Staging·Production용 별도 프로젝트를 만들지 않는다. 상업 운영·실제 복지 대상자 개인정보 처리는 범위 밖이다.

이 결정은 RLS·소유권 격리를 해제하지 않는다. 사용자는 본인 사례만 본다.

## 1. 현재 확정 환경

| 항목 | 정책 |
|---|---|
| Supabase | 기존 **CareGap Test** 단일 프로젝트 |
| SQL 001~005b | **재적용·초기화 금지**. 이력 불변 |
| 기존 ~21건 합성 사례 | **삭제·숨김 금지**. 해당 owner 계정에만 표시 |
| 분석·검토·후속 | 기존 이력 보존 |
| `.env.local` | Test 프로젝트 URL·키만. 환경별 배포 구성 추가 금지 |
| Staging / Production 프로젝트 | **이번 해커톤에서 생성하지 않음** |

앱 UX(빈 목록·사례 추가·비교 분석·검토·후속)는 Production-like 흐름을 유지하되, **데이터는 모두 이 Test 프로젝트**에 둔다.

## 2. 데이터 출처 (목록 유입)

| 구분 | 위치 | 목록 유입 |
|---|---|---|
| 개발·시연 중 누적 사례(~21) | Test DB, 특정 Auth 계정 owner | 그 계정 로그인 시에만 |
| `sql/003_demo_seed.sql` | Test에 수동 적용된 `합성-001` | 시드 대상 이메일 계정만 |
| Replay fixture | `fixtures/replay-analysis.json` | DB 삽입 없음 |
| 평가 dataset / Live smoke | `fixtures/eval/**` | 앱 자동 등록 금지 |

깨끗한 목록이 필요하면 **새 Auth 계정**을 만든다(아래). 기존 계정의 사례를 지우거나 UI에서 숨기지 않는다.

## 3. 해커톤용 깨끗한 계정 (권장)

동일 CareGap Test 프로젝트에 Auth 사용자만 추가한다.

### Supabase에서 계정 만들기

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 **CareGap Test** 선택  
2. 왼쪽 **Authentication** → **Users**  
3. **Add user** → **Create new user**  
4. 해커톤 전용 이메일·비밀번호 입력 (저장소·보고서에 비밀번호를 적지 말 것)  
5. 공개 회원가입이 꺼져 있어도 Dashboard에서 사용자를 직접 만들 수 있다  
6. **기존 사용자·사례를 삭제하거나 이메일을 바꾸지 말 것**

### 기대 동작 (앱)

- 로그인 성공  
- `/cases` **0건** (다른 계정의 21건은 RLS로 비노출)  
- 사례 추가 → 상담 기록 → 분석·검토·후속은 **해당 계정만**

실DB에서 0건·격리를 확인하는 절차는 사용자가 새 계정으로 로그인할 때 수행한다. 자동화 E2E(모의 Auth)만으로는 실DB 격리를 PASS라고 하지 않는다.

## 4. Replay vs 웹 Live (해커톤 시연)

Replay는 alias `합성-001`이고, 최신 두 상담의 **날짜·원문이 시드와 문자 단위로 동일**할 때만 성공한다. 임의 신규 기록에 고정 결과를 붙이지 않으며, 불일치 시 `REPLAY_UNAVAILABLE`(시연 모드 안내)이다.

| | A. Replay 시연 기록 준비 | B. 웹 Live (`ANALYSIS_MODE=live`) |
|---|---|---|
| 방법 | 새 계정에서 `합성-001` 생성 후 DEMO_GUIDE 두 원문·날짜를 **그대로** 등록 | `.env.local`에 Live 키·모델·`ANALYSIS_MODE=live` 후 서버 재시작, 합성 기록으로 분석 |
| 난이도 | 낮음 (UI만) | 중 (키·예산·재시작·실패 대응) |
| 신뢰성 | 높음 (고정 fixture, 오프라인 AI 불필요) | 중 (네트워크·검증·모델 변동) |
| 비용 | 없음 | 유료 호출 가능 |
| 시연 위험 | 원문 한 글자만 달라도 실패 | 지연·검증 실패·비용. **CLI Live smoke 성공 ≠ 웹 Live 검증** |
| **해커톤 권장** | **A** | 백업·선택. 유료 호출은 별도 승인 후에만 |

권장 리허설: `ANALYSIS_MODE=replay`로 A 경로를 끝까지 돌린다. Live는 녹화 백업 또는 승인된 1회 스모크만.

## 5. 향후 (비필수)

대회 이후 상업·실데이터 검토 시 Test와 분리된 Staging/Production이 필요할 수 있다. **지금 구현·프로젝트 생성 필수 작업이 아니다.**

## 6. 금지

- Staging/Production Supabase 신규 생성 (해커톤 범위)  
- Test 데이터 wipe, 사례 숨김 필터로 “깨끗한 목록” 흉내  
- SQL 001~005b 재적용  
- 평가 fixture 자동 유입, Live 자동 활성화, 승인 없는 유료 OpenAI 호출  
- Replay 미지원을 AI 장애로 연출
