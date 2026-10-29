# 돌봄틈새 AI (CareGap AI) — 해커톤 MVP

기준일: 2026-10-28 (한국시간) · 상태: **구현된 해커톤 MVP (Replay 시연 경로)**. 실서비스·실제 상담 기록·자동 자격 판정은 범위 밖이다.

담당자가 **합성** 상담 기록 두 건을 비교해 식사·거동·건강·생활환경 변화와 원문 근거를 보고, 고정 복지사업 후보를 검토하는 보조 웹 앱이다. 진단·수급 자격 확정·자동 신청은 하지 않는다.

## 설치·실행

사전 조건: Node.js ≥ 22.12, npm, Git. Live를 쓰지 않으면 OpenAI 키가 필요 없다.

```bash
npm ci
cp .env.example .env.local
# .env.local에 본인 테스트 Supabase URL·공개키·서버 비밀키를 채운다. ANALYSIS_MODE=replay 권장.
npm run dev
```

브라우저에서 `http://localhost:3000` → 로그인 → 사례 → 기록 → 분석 → 검토.

해커톤은 **CareGap Test 단일 Supabase**만 사용한다([docs/ENVIRONMENT_SEPARATION.md](docs/ENVIRONMENT_SEPARATION.md)). 이미 적용된 SQL·데이터는 건드리지 않는다. 신규 빈 프로젝트일 때만 [DATABASE.md](DATABASE.md) 순서를 따른다.

## 검사

| 명령 | 내용 |
|---|---|
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run test` | Vitest 단위·컴포넌트 테스트 |
| `npm run build` | Next.js 프로덕션 빌드 |
| `npm run test:e2e` | Playwright **모의** E2E (아래 공개 placeholder 필요) |

### 모의 E2E 환경값 (비밀 아님)

`npm run test:e2e`는 실제 Auth/DB를 치지 않고 브라우저·API를 가로챈다. 앱 기동용으로 **공개 placeholder**만 있으면 된다. 실제 키·암호를 넣지 말 것.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e2e-mock-publishable
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e2e-mock-secret
ANALYSIS_MODE=replay
```

브라우저 바이너리(최초 1회):

```bash
npx playwright install chromium
```

실제 비밀번호 로그인 UI E2E는 옵트인이다: `CARE_GAP_REAL_AUTH_E2E=1`과 `.env.local`의 `TEST_USER_*`(커밋 금지). 기본 `test:e2e`에는 포함되지 않거나 skip된다.

## Replay vs Live

| 모드 | 동작 | 이번 MVP에서 |
|---|---|---|
| `ANALYSIS_MODE=replay` | 정해진 합성 문장·날짜가 일치할 때만 fixture 결과. OpenAI 미호출 | 시연·기본 검증 경로 |
| `ANALYSIS_MODE=live` | 서버가 Responses API로 합성 두 기록만 전송. 실패 시 **자동 replay 전환 없음** | 유료 실호출은 이번 작업에서 **미검증** |

Live 단위 테스트는 REST 응답을 **모의**한다. 실제 OpenAI 호출·운영 DB 변경·배포는 포함하지 않는다.

## 신뢰성 (P0)

- Live REST: `output` 배열에서 `reasoning` 이후 `message`의 `output_text`를 추출한다. 최상위 `output_text`만 의존하지 않는다.
- Auth: 메모리 세션(`persistSession: false`) 유지. 열린 탭에서 토큰 갱신 시 React `accessToken`이 `onAuthStateChange`로 동기화된다. 새로고침 시 재로그인.
- 분석: 예약 이후 준비 조회·엔진·결과 저장 실패를 `failed`로 정리한다. 전체 벽시계 **45초** 한도를 서버가 강제한다. 멱등·동시성·늦게 도착한 성공 폐기는 유지한다.

## 계약 요약

- API JSON: snake_case. 최근 서로 다른 날짜 두 기록만 비교.
- 범주: `meal` / `mobility` / `health` / `environment`. 상태: `worsened` / `improved` / `unchanged` / `unknown`.
- 인용은 선택 기록의 **정확한 부분 문자열**. 스키마·서버 검증 전 성공 저장 금지. `unknown`은 안전 판정이 아니다.
- 사업 후보는 DB 고정 목록 + 서버 규칙. AI가 사업명·자격을 결정하지 않는다. UI는 `unverified`·담당자 최종 판단을 표시한다.

고도화 추적: [docs/ROADMAP.md](docs/ROADMAP.md), [docs/PROJECT_PROGRESS.md](docs/PROJECT_PROGRESS.md). 후속 확인 UI: `/follow-ups`(SQL `004` 적용 필요).

상세 계약: [SRS.md](SRS.md), [API_SPEC.md](API_SPEC.md), [AI_SPEC.md](AI_SPEC.md), [DATABASE.md](DATABASE.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ENVIRONMENT.md](ENVIRONMENT.md). 공통 지침: [AGENTS.md](AGENTS.md).
