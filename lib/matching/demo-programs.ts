import type { WelfareProgram } from "@/lib/analysis/types";

/** Catalog rows matching sql/002_programs.sql for offline unit tests. */
export const DEMO_WELFARE_PROGRAMS: WelfareProgram[] = [
  {
    id: "senior_care",
    name: "노인맞춤돌봄서비스",
    tags: ["meal", "mobility"],
    summary:
      "생활 유지에 도움이 필요한 노인을 위한 안전·일상생활 지원 등의 사업",
    eligibility_checks: [
      "만 65세 이상 여부와 관련 수급 자격",
      "돌봄 필요도와 선정 조사",
      "유사 서비스 중복 이용 여부와 지역 수행기관",
    ],
    region: "national",
    source_url: "https://www.mohw.go.kr/menu.es?mid=a10712010400",
    source_checked_on: "2026-10-27",
    catalog_version: "2026-10-27",
    active: true,
  },
  {
    id: "daegu_integrated",
    name: "대구형 통합돌봄 단디돌봄",
    tags: ["meal", "mobility", "health", "environment"],
    summary: "대구 지역의 의료·요양·돌봄 연계 상담 후보",
    eligibility_checks: [
      "대구 거주 및 돌봄 필요 여부",
      "주소지 구·군별 제공 서비스와 비용",
      "신청 후 조사 및 기존 서비스 이용 상황",
    ],
    region: "daegu",
    source_url:
      "https://info.daegu.go.kr/newshome/mtnmain.php?mtnkey=articleview&mkey=scatelist&mkey2=1&aid=276466",
    source_checked_on: "2026-10-27",
    catalog_version: "2026-10-27",
    active: true,
  },
];
