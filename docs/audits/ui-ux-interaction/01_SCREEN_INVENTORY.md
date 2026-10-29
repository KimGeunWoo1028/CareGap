# 01 — Screen Inventory

**Audit date:** 2026-10-29 (KST)  
**Repo HEAD (verified):** `8c5057e` (`feat/hackathon-product-hardening`, tag `caregap-hackathon-rc2-local`)  
**Mode:** READ-ONLY (no product code / DB / OpenAI changes)

## 1.1 Tech structure (verified)

| Area | Actual | Evidence |
|------|--------|----------|
| Framework | Next.js **16.4.3**, React **19.3.1**, App Router | `package.json` |
| UI library | **None** (no Tailwind/shadcn/MUI/Radix) | dependencies |
| CSS | Single `app/globals.css` design tokens + component classes | `:root` L5–109 |
| Font | Pretendard variable via `next/font/local` | `app/layout.tsx` |
| Routing | `app/**/page.tsx` only; no `middleware.ts` | glob |
| State | `AuthSessionProvider` + page `useState` | `lib/auth/session-context.tsx` |
| API | Bearer token `apiRequest` → `/api/*` | `lib/api/client.ts` |
| Auth UX | In-memory Supabase session (`persistSession: false`) | `lib/auth/browser.ts` |
| Tests | Vitest + Playwright | `vitest.config.ts`, `playwright.config` |

## 1.2 Implemented screens

### `/` — `app/page.tsx`

| Field | Finding |
|-------|---------|
| User Goal | Session 준비 후 `/cases` 또는 `/login`으로 이동 |
| Primary Action | 없음 (자동 redirect) |
| States | loading only |
| Dependencies | `useAuthSession().ready` |
| Problems | 짧은 대기 화면; 대시보드 아님 |

### `/login` — `app/login/page.tsx`

| Field | Finding |
|-------|---------|
| User Goal | 테스트 계정 로그인 + 제품 한계 이해 |
| Primary | 로그인 |
| Secondary | 없음 (가입/비밀번호 찾기 없음 — 의도적 카피) |
| States | Suspense fallback, submitting, error Alert, success→redirect |
| Dependencies | Supabase Auth (not `/api`) |
| Problems | **P1:** `npm run dev` + headless Chromium에서 Suspense fallback(`로그인 화면을 준비하는 중…`)에 고착 관찰 (`evidence/00-debug-login2.png`). Playwright production webServer 경로에서는 E2E 통과. |

### `/cases` — `app/cases/page.tsx`

| Field | Finding |
|-------|---------|
| User Goal | 내 사례 목록·검색·신규 사례명 생성 |
| Primary | 사례 추가, 행 클릭→상세 |
| Secondary | 검색, 새로고침, 생성 취소 |
| States | skeleton, list error+retry, empty list, empty search |
| Dependencies | `GET/POST /api/cases` |
| Problems | 생성은 inline panel (모달 아님); Escape로 닫히지 않음 |

### `/cases/[case_id]` — `app/cases/[case_id]/page.tsx`

| Field | Finding |
|-------|---------|
| User Goal | 개요·비교·분석·검토·기록 등록·이력 |
| Primary | 새 분석, 기록 저장, 검토 저장 |
| Secondary | 앵커 내비, 이력 선택, `/follow-ups` 링크 |
| States | loading, opaque 404, compare guidance, analysis processing/failed/succeeded, form errors |
| Dependencies | case GET, consultations POST, analyses, reviews |
| Problems | 한 페이지에 다수 구역(스크롤 부담); 분석 시작은 되돌리기 어려운 작업이나 추가 확인 dialog 없음 |

### `/follow-ups` — `app/follow-ups/page.tsx`

| Field | Finding |
|-------|---------|
| User Goal | 후속 업무 대기/전체 확인 및 종결 |
| Primary | 완료 / 취소 |
| Secondary | 필터 대기만/전체, 사례 목록 |
| States | loading text, error, empty, terminal hides actions |
| Dependencies | `GET/PATCH /api/follow-ups` |
| Problems | **error+empty 동시 표시** (L170–186); 완료/취소 **확인 dialog 없음**; 사례 링크가 UUID; 우선순위/기한 정렬 없음; 필터 URL 미반영 |

### Boundaries

| Route | File | Notes |
|-------|------|-------|
| error | `app/error.tsx` | reset / login |
| global-error | `app/global-error.tsx` | **globals.css 미로드** → 스타일 붕괴 가능 |
| not-found | `app/not-found.tsx` | login만 링크 |

## 1.3 Explicitly unimplemented

| Expected in brief | Status |
|-------------------|--------|
| Dashboard / KPI home | **미구현** (`/` = redirect) |
| Admin / settings | **미구현** |
| Multi-role screens (검토자/관리자) | **미구현** (owner RLS only) |
| Dedicated Replay demo route | **미구현** (Replay은 모드 배너로만) |
| Modal/dialog system | **미구현** |
| Dark/light theme toggle | **미구현** (고정 night shell + porcelain work plates) |

## 1.4 Roles

| Role candidate | Implemented? |
|----------------|--------------|
| 상담 담당자 | Yes (단일 persona UI) |
| 검토자 / 관리자 / 슈퍼바이저 | **No** separate UI |

권한: `owner_id = auth.uid()` + API ownership. 교차 사용자 UI는 404 opaque.

## 1.5 Components

| Path | Role |
|------|------|
| `components/app-header.tsx` | Brand, follow-ups, email, logout |
| `components/status-banner.tsx` | Global synthetic / judgment-assist banner |
| `components/require-auth.tsx` | Hard redirect to login |
| `components/alert.tsx` | Tone alerts |
| `components/analysis/analysis-result-panel.tsx` | Domains, evidence, candidates, review |
| `components/analysis/analysis-review-form.tsx` | Radio decision + memo |

## Evidence index

- Viewport (auth A, prior gate): `evidence/cases-*.png`, `case-detail-*.png`, `follow-ups-*.png`
- Login Suspense hang (dev :3000): `evidence/00-debug-login2.png`
