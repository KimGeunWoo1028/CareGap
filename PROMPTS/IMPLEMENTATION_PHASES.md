# 공통 구현 단계 프롬프트 — 순서대로 복사

이 패키지는 설계 문서이지 완성된 코드가 아니다. 팀원이 동시에 같은 파일을 고치지 않도록 역할 소유를 먼저 정하고, 변경 공유 전 서로의 작업을 덮어쓰지 않는다. 각 프롬프트 앞에 `AGENTS.md`와 아래 단계의 참조 문서를 첨부하거나 프로젝트에 둔다. 실행할 수 없는 검사는 결과에 BLOCKED와 사유를 남긴다. 코딩 도구가 계정·클라우드 자원을 자동으로 확보했다고 가정하지 않는다.

## 0단계: 준비와 골격

```text
당신은 CareGap AI의 구현 담당자다. 먼저 AGENTS.md, README.md, INDEX.md, SRS.md, ARCHITECTURE.md, ENVIRONMENT.md를 읽어라. 현재 파일과 변경 상태를 확인하고 사용자 파일을 보존하라.
이 문서 패키지의 P0만 대상으로 Next.js App Router + TypeScript의 최소 프로젝트 골격을 만든다. 정확한 의존성 제안 버전과 Node 24 호환을 확인하고 설치 결과를 바탕으로 lockfile을 만든다. ENVIRONMENT.md의 명령(dev/build/typecheck/lint/test/test:e2e)이 동작하도록 scripts를 설정한다. 서버 전용과 브라우저용 환경 변수 구분, 빈 값 검증, .env.local 무시 규칙, 오류 페이지와 합성 데이터 배너를 마련한다.
기존 문서·SQL·fixture를 삭제하거나 실제 비밀을 생성·기록하지 마라. 실서비스 연동은 하지 마라. 설치·lint·typecheck·build가 가능한지 실행하고 결과와 차단 사유를 간결하게 보고하라. 앱이 아직 완성되지 않았음을 명확히 하라.
```

완료: 로컬 골격 실행, 문서 보존, 환경 변수는 예시만, 실제 키는 버전 관리 제외. 패키지 충돌 시 먼저 공식 문서를 확인하고 합리적인 변경을 문서화한다.

## 1단계: 인증과 데이터 접근 (A 담당)

```text
AGENTS.md, SRS.md, DATABASE.md, SECURITY.md, API_SPEC.md를 읽어라. sql/001_schema.sql~003_demo_seed.sql을 기준으로 Supabase Auth 로그인/로그아웃과 사용자 JWT 기반 DB client를 구현하라. 사용자당 사례·상담 기록의 읽기/생성 API, 필수 입력과 의심 식별정보 검증, 소유권 확인 및 오류 매핑을 구현하라.
모든 서버 API에서 getUser(token)을 검증하고 사용자 권한으로 질의한다. 가입 UI, 기록 수정/삭제는 추가하지 않는다. 서버 비밀키를 브라우저에 노출하지 않는다. A/B 계정이 없으면 실제 RLS 통합 검사는 BLOCKED라고 보고하되 단위 검사와 코드 검토를 수행하라. SQL 적용은 사용자가 제공한 테스트 프로젝트에만 수행하고 잘못된 이메일의 시드는 중단하라.
T01~T04, T18, T22 중 구현된 범위를 확인하고 결과를 보고하라.
```

완료: A/B 접근 분리, 본인만 생성/조회, 타인 ID 404, 원문 입력 검증, 새로고침 후 재로그인. SQL 에러는 제약명으로 매핑.

## 2단계: 화면과 기록 (B 담당)

```text
AGENTS.md, UI_UX.md, SRS.md, API_SPEC.md를 읽어라. A의 API 계약을 그대로 사용해 로그인, 사례 목록·생성, 사례 상세와 날짜/채널/합성 원문 입력 화면을 구현하라. API가 미완이면 외부 호출 경계만 모의 처리하고 통합 시 제거하라. 원문은 수정하지 않으며 조회 최신 순, 2건 미만/중복/만료/네트워크 상태를 명시한다.
1280px과 390px에서 사용할 수 있도록 만들고 실제 라벨, 키보드 포커스, 텍스트 상태, 오류 안내를 포함하라. 제품 화면에 실제 개인정보 또는 테스트 암호를 넣지 마라. T01~T05, T21을 실행 가능 범위에서 검증하고 변경과 미완 항목을 보고하라.
```

완료: 두 합성 기록을 입력하고 목록에서 비교 대상으로 볼 수 있음. 로그인 세션은 메모리 전용.

## 3단계: AI 분석과 사업 매칭 (C 담당)

```text
AGENTS.md, AI_SPEC.md, SRS.md, API_SPEC.md, DATABASE.md, SECURITY.md를 읽어라. schemas/analysis.schema.json 및 fixtures/replay-analysis.json을 기준으로 AI 응답 파서와 서버 validator를 구현하고 각 4개 범주, 근거 ID, 양 시점 근거, 원문 substring, 글자 수, 질문 수를 검증하라. 하나라도 위반하면 전체 결과를 실패시켜라.
정해진 alias/날짜/원문에서만 replay fixture UUID를 현재 기록 ID로 치환하라. live는 서버 fetch로 Responses API strict JSON Schema와 store:false, 설정된 모델, 20초 호출 제한 및 일시적 오류 1회 재시도를 구현하라. 모델 응답의 거절/불완전/timeout을 처리하고 자동 replay 전환은 금지한다.
DB 활성 사업과 악화 범주 교집합을 기준으로 AI_SPEC의 정렬/스냅샷/자격 미확인 매칭을 구현한다. live 공급자 stub으로 T09~T13, T15~T16, T23~T25의 검증을 작성해 실행하고, 실제 API는 키가 있을 때만 합성 자료로 시험하라. 모델 접근 불가는 BLOCKED로 보고하라.
```

완료: 합성 결과 4범주와 인용, 서버 결정 후보가 출력되고 조작 결과는 실패. replay는 고정 시연으로 명시.

## 4단계: 분석 API와 검토 통합 (A+C 담당)

```text
API_SPEC.md, DATABASE.md, ARCHITECTURE.md, AI_SPEC.md, TEST_PLAN.md를 읽고 분석 생성/조회 및 검토 API를 구현하라. 인증된 사용자 client로 start_analysis RPC를 호출하고 새 예약에서만 AI 또는 replay를 수행한다. 같은 키 재사용·다른 사례/모드 충돌·하나의 진행 작업·속도 제한·오래된 작업 정리를 SQL 규칙에 맞게 처리한다.
service role 키로 업데이트하기 전 인증 사용자 권한으로 analysis와 case 소유권 및 입력 기록을 확인한다. id, actor, case, status=processing을 조건으로 validated result를 단 한 번 완료한다. 실패도 조건부로 기록한다. 결과는 immutable 기록 ID를 보존하고 is_current는 최신 두 ID와 비교한다. review는 소유 성공 분석에만 1회 저장한다.
동시 요청, 연결 중단, 실패 저장 불가, 60초 만료 뒤 늦게 도착한 응답을 시험한다. T05~T08, T14, T16~T20, T22, T24, T26 결과와 미실행 이유를 보고하라.
```

완료: 사용자의 분석 직접 쓰기는 금지되며 같은 요청은 새 호출을 만들지 않는다. 서버 프로세스 장애 이후 복구 가능.

## 5단계: 결과 화면·시연 연결 (B+D 담당)

```text
UI_UX.md, API_SPEC.md, AI_SPEC.md, DEMO_GUIDE.md를 읽고 결과의 네 영역, 각 시점 근거와 원문, 질문, 사업 후보/공식 링크/자격 미확인, 담당자 검토 입력·저장, 이력과 오래된 결과 경고를 구현하라. live/replay 표식을 화면에 반드시 남긴다. processing/failed/빈 후보/재시도/세션 만료 화면을 구현하라.
가능하면 Playwright로 T15, T21과 로그인→기록→replay→근거→후보→검토 흐름을 확인하라. 모바일과 키보드 사용도 확인하라. 합성 화면으로만 녹화하고 장애 대안은 DEMO_GUIDE.md에 따라 설명하라. 결과에 테스트 근거와 한계를 보고하라.
```

완료: 심사자가 근거와 출처를 확인하고 담당자 검토를 저장할 수 있다. 녹화 화면은 모드를 숨기지 않는다.

## 6단계: 최종 통합 점검 (전원)

```text
PRD.md, SRS.md, TEST_PLAN.md, SECURITY.md, DEMO_GUIDE.md를 기준으로 P0만 점검한다. 실제 변경 및 테스트 결과를 확인하고 npm run lint, typecheck, test, build, test:e2e를 각각 실행하라. A/B 실제 RLS 테스트, 시드 기반 replay 3회, live smoke(계정과 네트워크가 되는 경우)를 검증하라.
실패는 원인을 분석해 수정 후 해당 검사를 다시 실행하라. 미실행은 BLOCKED와 이유를 밝히고 실측하지 않은 지표나 기관 도입 가능성을 주장하지 마라. 4분 시연, AI/DB 장애 대안과 백업 영상의 모드 표시를 확인한다. 마지막에 실행한 검사, 결과, 남은 제한과 다음 행동을 보고하라.
```

## 역할·핸드오프

| 역할 | 소유 | 상대에게 제공할 것 |
|---|---|---|
| A 백엔드 | `app/api`, `lib/auth`, `lib/db`, SQL 검증 | API 예시·오류·A/B 테스트 계정 준비 상태 |
| B 프런트 | `app` 화면, UI 컴포넌트 | 필요한 데이터 모양, 접근성·반응형 점검 |
| C AI | `lib/analysis`, `lib/matching`, 스키마/fixture 검증 | validator 함수 계약, 실제/모의 호출 결과 |
| D 기획/QA | 테스트·시드·발표 | 케이스와 합격/차단 기록, 영상 |

공유 파일 수정은 한 명이 담당한다. 2명이면 A+C 및 B+D를 합친다. 계정·결제·접근권한은 사람과 조직이 제공하며 팀원의 비밀을 채팅에 붙여 넣지 않는다.
