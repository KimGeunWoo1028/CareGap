# 문서 인덱스

| 순서 | 문서 | 독자와 목적 |
|---|---|---|
| 1 | [README](README.md) | 빠른 시작과 범위 |
| 2 | [PRD](PRD.md) | 문제, 목표, MVP 우선순위와 성공 기준 |
| 3 | [SRS](SRS.md) | 기능·비기능 요구와 수용 기준 |
| 4 | [ARCHITECTURE](ARCHITECTURE.md) | 구성, 인증 경계, 처리 순서, 일정 |
| 5 | [DATABASE](DATABASE.md) | 데이터 사전, RLS, 마이그레이션 및 시드 |
| 6 | [API_SPEC](API_SPEC.md) | 엔드포인트·요청·응답·오류 계약 |
| 7 | [AI_SPEC](AI_SPEC.md) | 입력, 프롬프트, 출력 스키마, 근거 검증, 매칭 |
| 8 | [UI_UX](UI_UX.md) | 화면, 흐름, 문구, 상태와 접근성 |
| 9 | [SECURITY](SECURITY.md) | 해커톤 안전 경계와 기관 도입 조건 |
| 10 | [TEST_PLAN](TEST_PLAN.md) | 요구사항 추적과 재현 가능한 테스트 |
| 11 | [DEMO_GUIDE](DEMO_GUIDE.md) | 시연 대본, 설정, 장애 대안 |
| 12 | [환경 설정](ENVIRONMENT.md) | 버전·환경 변수와 초기화 |
| 13 | [SOURCES](SOURCES.md) · [패키지 점검](PACKAGE_VERIFICATION.md) | 1차 출처와 문서 검증 범위 |
| 14 | [AGENTS](AGENTS.md), [CLAUDE](CLAUDE.md) | 저장소 공통 작업 지침 |
| 15 | [구현 단계 프롬프트](PROMPTS/IMPLEMENTATION_PHASES.md) | 모든 도구가 공유하는 단계별 작업 |
| 16 | [Cursor](PROMPTS/CURSOR.md) · [Codex](PROMPTS/CODEX.md) · [Claude](PROMPTS/CLAUDE.md) | 도구별 시작·검토 지시문 |
| 17 | [SQL](sql/001_schema.sql) · [사업 시드](sql/002_programs.sql) · [합성 시드](sql/003_demo_seed.sql) | Supabase 적용용 초안 |
| 18 | [분석 JSON 스키마](schemas/analysis.schema.json) · [시연 결과](fixtures/replay-analysis.json) · [전체 응답 예시](fixtures/success-response.json) · [평가 사례](fixtures/evaluation-cases.json) | 검증 및 재현 자료 |
| 19 | [고도화 로드맵](docs/ROADMAP.md) · [진행 현황](docs/PROJECT_PROGRESS.md) · [마이그레이션 감사](docs/POST_MIGRATION_AUDIT.md) · [AI 평가 계획](docs/AI_EVALUATION_PLAN.md) · [평가 보정](docs/AI_EVALUATION_CALIBRATION.md) · [Live 파일럿](docs/AI_LIVE_EVALUATION_PILOT.md) | 검토·재현성·평가 기반 |
| 20 | [후속 확인](sql/004_follow_up_tasks.sql) · [004a](sql/004a_follow_up_terminal_immutable.sql) · [005 원자성](sql/005_review_follow_up_atomicity.sql) · [005b 교정](sql/005b_review_follow_up_atomicity_correct.sql) · [005 불일치 이력](sql/history/005_review_follow_up_atomicity.mismatched-applied-payload.sql) · CI `.github/workflows/ci.yml` | 후속 업무·원자성·이력 정합 |

## 충돌을 방지하는 읽기 순서

사용자가 이 패키지를 수정하라고 명시한 지시가 최우선이다. 패키지 안에서는 **SRS의 요구사항 → API_SPEC의 외부 계약 → AI_SPEC의 결과 의미 → DATABASE의 저장 제약**을 따른다. 기능 변경 시 관련 문서를 함께 고친다. DB SQL은 단독 실행 가능한 실체이며 설명과 차이가 발견되면 배포를 중단하고 수정 후 재검증한다. 화면 디자인과 구현 프롬프트가 새 기능을 추가할 수 없다.

## 공통 식별자

`case_id`, `note_id`, `analysis_id`, `review_id`는 UUID 문자열이다. 사업 ID는 텍스트 `senior_care`, `daegu_integrated`다. API는 snake_case JSON을 사용하고 날짜는 `YYYY-MM-DD`, 시각은 UTC ISO 8601이다. 사용자가 보는 날짜는 한국시간으로 표시한다.
