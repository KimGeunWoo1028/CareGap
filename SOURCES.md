# 출처와 확인 기록

확인일: 2026-10-27 (Asia/Seoul). 링크의 내용과 서비스 정책은 바뀔 수 있다. 접근 가능한 공식 자료의 존재와 핵심 내용만 확인했으며, 개별 신청 가능성이나 실제 행정 연계는 확인하지 않았다.

## 복지사업 및 공개 데이터

1. [보건복지부 노인맞춤돌봄서비스 정책 안내](https://www.mohw.go.kr/menu.es?mid=a10712010400): 서비스 대상, 신청, 직접·연계 서비스, 선정 절차. 식사관리/외출동행 등을 포함하지만 개인의 수급 여부는 공식 선정 절차가 필요하다. 시드 `senior_care`의 출처다.
2. [대구광역시: 통합돌봄 신청 안내](https://info.daegu.go.kr/newshome/mtnmain.php?mtnkey=articleview&mkey=scatelist&mkey2=1&aid=276466): 2026-03-24 안내, 단디돌봄의 대상·신청·지역별 서비스·비용. 시드 `daegu_integrated`의 출처다. 해당 페이지는 **공공누리 제4유형(출처표시·상업적 이용금지·변경금지)**을 표시한다. 패키지는 원문을 복제하거나 공식 요약물인 것처럼 배포하지 않고, 제한적인 사실 정리와 링크를 제공한다. 2차 자료·상업적 이용·원문 변형은 별도 권리 확인이 필요하다.
3. [공공데이터포털 중앙부처복지서비스](https://www.data.go.kr/data/15090532/openapi.do)와 [지자체복지서비스](https://www.data.go.kr/data/15108347/openapi.do): 공식 목록·상세 API이며 확인한 페이지는 REST/XML로 설명한다. 본 MVP는 호출하지 않는다. 후속 연동은 최신 활용신청·인증키·이용허락·제한·명세·업데이트 주기를 직접 확인한다.
4. [한국사회보장정보원 노인맞춤돌봄시스템 소개](https://ssis.or.kr/lay1/S1T1388C1389/contents.do): 기존 시스템의 기능 소개. 이 MVP가 해당 시스템과 연동되거나 기관 승인을 받았다는 뜻이 아니다.

## 기술

5. [Next.js 16 업그레이드 안내](https://nextjs.org/docs/app/guides/upgrading/version-16): 최소 Node 버전과 16 계열 변경 사항. [Node.js 릴리스](https://nodejs.org/en/about/previous-releases): Node 24 LTS 지원 표.
6. [Supabase RLS 문서](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase API 키](https://supabase.com/docs/guides/api/api-keys): RLS, 사용자 JWT, 서비스/secret 키의 RLS 우회 경계. 실제 대회 프로젝트 설정은 별도 테스트 필요.
7. [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [Responses 생성 API](https://developers.openai.com/api/reference/resources/responses/methods/create): `text.format`과 schema strict, 거절/불완전 응답 처리. [GPT-5.4 Mini 모델](https://developers.openai.com/api/docs/models/gpt-5.4-mini): `gpt-5.4-mini-2026-03-17`, Responses와 Structured Outputs 지원 확인. 계정별 사용 가능성·현재 비용은 확인하지 못했으므로 대회 전 별도 확인. [데이터 제어](https://developers.openai.com/api/docs/guides/your-data): 보존·처리 조건 확인. `store:false`가 모든 보존을 없앤다고 단정하지 않는다.
8. [Codex AGENTS.md 안내](https://developers.openai.com/codex/guides/agents-md), [Cursor 규칙](https://cursor.com/docs/rules), [Claude Code 프로젝트 메모리](https://code.claude.com/docs/en/memory): 도구별 프로젝트 지침 동작. Claude 채팅 제품과 Claude Code의 파일 접근 방식은 다를 수 있다.
9. npm 공개 레지스트리에서 [Next 16.4.3](https://registry.npmjs.org/next/16.4.3), [React 19.3.1](https://registry.npmjs.org/react/19.3.1), [React DOM 19.3.1](https://registry.npmjs.org/react-dom/19.3.1), [TypeScript 5.9.3](https://registry.npmjs.org/typescript/5.9.3), [Supabase JS 2.118.0](https://registry.npmjs.org/@supabase/supabase-js/2.118.0), [Zod 4.6.7](https://registry.npmjs.org/zod/4.6.7), [Vitest 5.0.5](https://registry.npmjs.org/vitest/5.0.5), [Playwright 1.64.1](https://registry.npmjs.org/@playwright/test/1.64.1)의 패키지 존재 및 일부 peer/엔진 메타데이터를 확인했다. 패키지의 전체 조합·런타임 보안 점검·실제 설치 테스트는 구현 단계에 남아 있다.

대구시 공식 정보와 보건복지부 자료는 복지사업 이름·설명·검토 항목의 근거다. 상담 데이터·질문·매칭 규칙·성공 지표는 이 프로젝트가 만든 예시이며 공공기관의 판단이나 기준이 아니다.
