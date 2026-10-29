# 환경 설정 및 기술 기준

## 1. 사전 조건

- Node.js 24 LTS(2026-10-27 Node 공식 지원표 확인), npm. Next.js 16의 문서상 최소 Node는 20.9.0이지만 Supabase SDK 제안 버전의 엔진 조건 `>=22`를 만족하도록 24를 사용한다.
- 전용 Supabase 프로젝트, 로그인 가능한 테스트 계정 1개 이상(격리 시험은 2개), 프로젝트 URL과 publishable 키, 서버용 secret/service_role 키.
- live 모드일 때 OpenAI API 결제/권한, 서버 전용 API 키와 모델 접근. 무료 접근 가능 여부는 보장하지 않는다. replay는 OpenAI 키가 없어도 된다.
- Git·편집기, Chrome/Edge, 안정적인 네트워크. 이 저장소에는 Next.js 앱 소스가 포함되어 있다.

## 2. 제안 의존성

| 구성 | 기준 버전 | 근거/주의 |
|---|---|---|
| `next` | 16.4.3 | npm 2026-10-27 존재 확인 |
| `react`, `react-dom` | 19.3.1 | 같은 버전 사용, next peer 범위 충족 |
| `typescript` | 5.9.3 | 7.x 대신 보수적 기준, npm 존재 확인. 조합 실제 빌드 필요 |
| `@supabase/supabase-js` | 2.118.0 | 엔진 Node >=22. npm 존재 확인 |
| `zod` | 4.6.7 | npm 존재 확인 |
| `vitest` | 5.0.5 | Node 24 호환 엔진; Vite peer 범위 확인 후 설치 |
| `@playwright/test` | 1.64.1 | npm 존재 확인; 브라우저 설치 필요 |

모델 호출은 서버의 표준 `fetch`로 구현하면 OpenAI SDK 버전 고정이 필요 없다. 추가 의존성 및 타입 패키지는 개발 시 정확한 버전으로 설치 후 `package-lock.json`을 커밋하고 `npm ci`를 사용한다. 위 숫자는 패키지 등록 및 일부 메타데이터 확인이지 전체 조합의 설치/보안/배포 검증을 뜻하지 않는다. 배포 직전 보안 수정판 및 라이선스를 다시 살핀다. [SOURCES.md](SOURCES.md) 참조.

## 3. 환경 변수 예시 (`.env.local`, 실제 값을 커밋하지 않음)

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini-2026-03-17
ANALYSIS_MODE=live
```

`NEXT_PUBLIC_` 두 값은 브라우저 공개 가능. `SUPABASE_SECRET_KEY`는 secret key를 권장하며 기존 프로젝트는 service_role 키도 사용할 수 있다. Supabase는 기존 anon/service_role 키의 2026년 말 종료를 예고하므로 새 프로젝트는 publishable/secret 키를 사용한다. 둘 다 서버 전용이다. 인증 사용자 클라이언트에 secret key를 넣지 않는다. `OPENAI_API_KEY`는 `live` 필수, `replay`에서는 공란 가능. `ANALYSIS_MODE`는 `live` 또는 `replay`만 허용; 값 누락·오류는 시작 시 설정 오류, 임의 기본값 금지. `OPENAI_MODEL`은 live에 필수, replay는 사용하지 않는다. 배포 환경의 변경은 서버 재시작/재배포가 필요할 수 있다. 클라이언트에서 모드를 요청값으로 바꾸지 않는다.

## 4. 개발 시작 순서

1. `npm ci`로 의존성을 설치한다 (`package-lock.json` 기준).
2. Supabase 프로젝트에 SQL을 적용한다. **CareGap Test / Replay 시연**은 001→002→003(이메일 치환) 후 004→005 경로([DATABASE.md](DATABASE.md)). **Staging 깨끗한 UX**는 001→002→004→004a→005이며 **003 생략** — 상세는 [docs/ENVIRONMENT_SEPARATION.md](docs/ENVIRONMENT_SEPARATION.md). 공개 회원가입 해제와 A/B 계정 준비. 기존 Test를 Staging으로 재사용·초기화하지 않는다.
3. `.env.example`을 복사해 `.env.local`(Test)을 만들고 필요한 값을 채운다. Staging은 **별도** env 파일·키. 키를 공유하거나 버전관리하지 않는다. 시연·기본 검증은 `ANALYSIS_MODE=replay`. Live는 자동 활성화하지 않는다.
4. `npm run dev`로 로컬 실행. 검사는 `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`.
5. live로 전환할 때는 비용 한도·모델 권한과 외부 전송 데이터가 합성인지 확인한다. **실제 OpenAI 유료 호출은 별도 승인·예산 없이는 수행하지 않는다.**

### 모의 Playwright E2E용 공개 placeholder

실제 비밀값 없이 앱이 기동·빌드되도록 아래처럼 **가짜** 값을 쓸 수 있다. 이 값으로 실 Auth/DB에 연결하지 않는다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e2e-mock-publishable
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e2e-mock-secret
ANALYSIS_MODE=replay
```

브라우저: `npx playwright install chromium`. 기본 `npm run test:e2e`는 API/Auth를 가로채는 모의 경로다. 실비밀번호 UI는 `CARE_GAP_REAL_AUTH_E2E=1` + 로컬 `TEST_USER_*`가 필요하며 커밋하지 않는다.

## 5. 배포

대회 기간의 공개 접근을 피하는 환경을 우선한다. Next.js Node 런타임과 최소 45초 요청 시간 제한을 지원하는 호스트가 필요하다. 호스트 제한이 더 짧으면 live는 성공을 보장하지 못하므로 사전 점검하고 replay/녹화로 대체한다. 키는 서버에만 등록하고 URL·시연 계정을 비공개 공유한다. 합성 데이터라도 장기간 방치하지 말고 종료 후 시험 프로젝트와 키를 정리한다. 호스트의 요금·지역·요청 시간은 대회 시점에 확인한다.
