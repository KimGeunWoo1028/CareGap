# 돌봄틈새 AI (CareGap AI) — 해커톤 MVP 문서 패키지

기준일: 2026-10-27 (한국시간) · 문서 버전: 1.0 · 상태: **구현 명세 및 계획**. 완성된 앱이 아니다.

## 무엇을 만드나

가상의 복지 상담 기록 두 건을 비교하여 식사·거동·건강·생활환경에서 확인할 변화를 근거 원문과 함께 제시하고, 기존 복지사업의 연계 후보를 보여 주는 담당자 보조 웹 앱이다. 진단, 위험도 판정, 수급 자격 결정, 자동 신청·기관 연동은 하지 않는다. 실제 개인정보나 실제 상담 기록을 넣지 않는다.

## 지금 바로 시작

1. [INDEX.md](INDEX.md)에서 담당 역할에 필요한 문서를 고른다. 먼저 [PRD.md](PRD.md), [SRS.md](SRS.md), [ARCHITECTURE.md](ARCHITECTURE.md)를 읽는다.
2. 이 폴더 전체를 새 프로젝트 저장소의 루트에 복사한다. 여기에는 앱 소스가 없으므로 Node.js를 설치해도 바로 서비스가 실행되지 않는다.
3. [PROMPTS/IMPLEMENTATION_PHASES.md](PROMPTS/IMPLEMENTATION_PHASES.md) 0단계부터 코딩 도구에 붙여 넣고 각 단계의 확인 조건을 통과한다. [AGENTS.md](AGENTS.md)는 프로젝트 공통 지침이다. Cursor·Codex·Claude별 첫 지시문은 `PROMPTS/`에 있다.
4. 개발자가 Supabase 테스트 프로젝트와 사전 생성한 테스트 계정을 준비하고 [DATABASE.md](DATABASE.md)의 순서로 [sql/001_schema.sql](sql/001_schema.sql), [sql/002_programs.sql](sql/002_programs.sql), [sql/003_demo_seed.sql](sql/003_demo_seed.sql)을 적용한다. 마지막 파일의 이메일을 본인의 테스트 계정 이메일로 바꿔야 한다.
5. 구현한 앱의 환경 변수를 `ENVIRONMENT.md`에 따라 로컬에 설정한다. `ANALYSIS_MODE=live`에는 서버 전용 OpenAI API 키 및 해당 모델 이용 권한이 필요하다. `replay`는 정해진 합성 예시에서만 동작하며 AI 실시간 분석이 아니다.
6. [TEST_PLAN.md](TEST_PLAN.md)의 필수 검사를 수행하고, [DEMO_GUIDE.md](DEMO_GUIDE.md)에 따라 사전 리허설한다.

## 공유할 기준

- 비교 대상: 한 대상자의 가장 최근 서로 다른 날짜 기록 두 건. 하루 한 건만 저장. 날짜가 최신인 것을 현재로 한다.
- 주요 범주: `meal`, `mobility`, `health`, `environment`. 상태 값은 `worsened`, `improved`, `unchanged`, `unknown`.
- 근거: 이전/현재 기록 ID와 해당 원문에 **정확히 포함된 연속 문자열**. 사실이 없으면 근거와 변화 판단을 추측하지 않는다.
- 프로그램은 `senior_care`와 `daegu_integrated` 두 건으로 시작한다. AI가 사업명을 만들지 않고 서버가 고정 목록에서 규칙으로 후보를 산출한다. 조건·중복·지역 여부는 담당자가 확인한다.
- 인증 사용자는 자신의 가상 사례만 본다. 브라우저는 공개키와 사용자 토큰만 사용한다. 서비스 비밀키와 AI 키는 서버 전용이다.
- live와 replay 전환은 서버의 환경 설정으로만 한다. 호출 장애가 발생해도 몰래 replay로 전환하지 않는다.
- 자료·버전 확인 내역은 [SOURCES.md](SOURCES.md)에 있다. 서비스 정책, 모델 접근·비용, 의존성 호환성은 대회 직전 재확인한다.

## 이 패키지의 범위와 한계

문서, SQL 초안, JSON 스키마 및 합성 시연 자료를 제공한다. 앱 구현, 클라우드 자원 생성, 실서비스 배포, 실제 데이터 검증 및 기관 승인까지 수행한 것은 아니다. 이 패키지의 지표와 일정은 목표치이며 측정 결과가 아니다. 실제 기관 도입 시 [SECURITY.md](SECURITY.md)의 후속 항목을 별도 수행해야 한다.
