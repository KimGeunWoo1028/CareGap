import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  buildMockDetail,
  expectNoPageHorizontalOverflow,
  mockConsultation,
  MOCK_CASE_ID,
  openMockedCaseDetail,
  type MockAnalysisDetail,
  type MockCaseDetail,
} from "./helpers/mock-session";

const ARTIFACT_DIR = path.join("e2e", "artifacts", "analysis-result-ui");

async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, `${name}.png`),
    fullPage: true,
  });
}

const PREV_ID = "00000000-0000-4000-8000-00000000c019";
const CURR_ID = "00000000-0000-4000-8000-00000000c020";
const ANALYSIS_ID = "00000000-0000-4000-8000-00000000a010";

function twoNoteDetail(analyses: MockCaseDetail["analyses"] = []): MockCaseDetail {
  return buildMockDetail({
    consultations: [
      mockConsultation({
        id: CURR_ID,
        occurred_on: "2026-10-10",
        body: "식사를 자주 거르심. 다리가 불편해 장을 보기 어렵고",
        channel: "phone",
      }),
      mockConsultation({
        id: PREV_ID,
        occurred_on: "2026-09-10",
        body: "혼자 식사도 잘하시고 가까운 가게까지 걸어가 장을 볼 수 있음.",
        channel: "visit",
      }),
    ],
    analyses,
  });
}

function succeededDetail(options?: {
  is_current?: boolean;
  review?: MockAnalysisDetail["review"];
  recommendations?: MockAnalysisDetail["result"] extends infer R
    ? R extends { recommendations: infer Rec }
      ? Rec
      : never
    : never;
}): MockAnalysisDetail {
  return {
    id: ANALYSIS_ID,
    case_id: MOCK_CASE_ID,
    previous_note_id: PREV_ID,
    current_note_id: CURR_ID,
    status: "succeeded",
    mode: "replay",
    schema_version: "1.0",
    model: null,
    result: {
      analysis: {
        schema_version: "1.0",
        summary:
          "최근 기록에서 식사 유지와 장보기에 어려움이 나타나 추가 확인이 필요합니다.",
        changes: [
          {
            domain: "meal",
            status: "worsened",
            explanation: "이전에는 식사를 잘했으나 최근 자주 거른다는 기록이 있습니다.",
            evidence_previous: {
              note_id: PREV_ID,
              quote: "혼자 식사도 잘하시고",
            },
            evidence_current: {
              note_id: CURR_ID,
              quote: "식사를 자주 거르심.",
            },
          },
          {
            domain: "mobility",
            status: "worsened",
            explanation: "장보기 어려움이 기록되었습니다.",
            evidence_previous: {
              note_id: PREV_ID,
              quote: "가까운 가게까지 걸어가 장을 볼 수 있음.",
            },
            evidence_current: {
              note_id: CURR_ID,
              quote: "다리가 불편해 장을 보기 어렵고",
            },
          },
          {
            domain: "health",
            status: "unknown",
            explanation: "건강 상태의 변화를 비교할 정보가 충분하지 않습니다.",
            evidence_previous: null,
            evidence_current: null,
          },
          {
            domain: "environment",
            status: "unknown",
            explanation: "생활환경의 변화를 비교할 정보가 충분하지 않습니다.",
            evidence_previous: null,
            evidence_current: null,
          },
        ],
        questions: [
          "최근 식사를 거르는 빈도와 이유는 무엇인가요?",
          "다리 불편이 언제 시작되었고 외출에 어떤 영향을 주나요?",
        ],
      },
      recommendations: options?.recommendations ?? [
        {
          program_id: "prog-meal-support",
          name: "합성 식사지원 후보",
          matched_domains: ["meal"],
          summary: "식사 악화 기록에 따른 연계 후보입니다.",
          eligibility_status: "unverified",
          eligibility_checks: ["소득·가구 기준 확인", "관할 지역 확인"],
          region: "전국(합성)",
          source_url: "https://example.invalid/program",
          source_checked_on: "2026-10-01",
          catalog_version: "demo-1",
        },
      ],
    },
    failure_code: null,
    created_at: "2026-10-11T01:00:00.000Z",
    completed_at: "2026-10-11T01:00:02.000Z",
    is_current: options?.is_current ?? true,
    review: options?.review ?? null,
  };
}

test.describe("analysis result UI with mocked auth/API only", () => {
  test("starts replay analysis, shows domains/evidence/candidates, saves review", async ({
    page,
  }) => {
    let detail = twoNoteDetail();
    let analysis = succeededDetail();
    let createCalls = 0;
    let usedIdempotency: string | null = null;

    await openMockedCaseDetail(page, {
      detail: () => detail,
      analysisDetail: () => analysis,
      createAnalysisHandler: () => {
        createCalls += 1;
        detail = twoNoteDetail([
          {
            id: ANALYSIS_ID,
            case_id: MOCK_CASE_ID,
            status: "succeeded",
            mode: "replay",
            created_at: analysis.created_at,
            completed_at: analysis.completed_at,
            is_current: true,
          },
        ]);
        return {
          status: 201,
          body: {
            data: analysis,
            meta: { request_id: "mock-analysis-create" },
          },
        };
      },
      reviewHandler: (payload) => {
        const review = {
          id: "00000000-0000-4000-8000-00000000r001",
          analysis_id: ANALYSIS_ID,
          decision: payload.decision as "needs_followup",
          note: payload.note,
          created_at: "2026-10-11T01:05:00.000Z",
        };
        analysis = { ...analysis, review };
        return {
          status: 201,
          body: {
            data: review,
            meta: { request_id: "mock-review-ok" },
          },
        };
      },
    });

    page.on("request", (req) => {
      const url = new URL(req.url());
      if (
        req.method() === "POST" &&
        /\/api\/cases\/[^/]+\/analyses$/.test(url.pathname)
      ) {
        usedIdempotency = req.headers()["idempotency-key"] ?? null;
      }
    });

    await expect(page.getByRole("button", { name: "새 분석" })).toBeEnabled();
    await page.getByRole("button", { name: "새 분석" }).click();

    await expect(
      page.getByText("사전 준비된 시연 결과 · AI 실시간 분석 아님"),
    ).toBeVisible();
    await expect(page.getByText(/식사 유지와 장보기에 어려움/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "식사", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("악화 기록").first()).toBeVisible();
    await expect(page.getByText("정보 부족").first()).toBeVisible();
    await expect(
      page.locator("q.analysis-quote", { hasText: "혼자 식사도 잘하시고" }),
    ).toBeVisible();
    await expect(
      page.locator("q.analysis-quote", { hasText: "식사를 자주 거르심." }),
    ).toBeVisible();
    await expect(
      page.getByText("최근 식사를 거르는 빈도와 이유는 무엇인가요?"),
    ).toBeVisible();
    await expect(page.getByText("합성 식사지원 후보")).toBeVisible();
    await expect(page.getByText("자격 미확인")).toBeVisible();
    expect(createCalls).toBe(1);
    expect(usedIdempotency).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    await page.getByLabel("추가 확인 필요", { exact: true }).check();
    await page.getByLabel("검토 메모").fill("합성 시연 추가 확인");
    await page.getByRole("button", { name: "검토 저장" }).click();
    await expect(page.locator(".analysis-review-readonly")).toContainText(
      "추가 확인 필요",
    );
    await expect(page.locator(".analysis-review-readonly")).toContainText(
      "합성 시연 추가 확인",
    );
    await expect(page.getByRole("button", { name: "검토 저장" })).toHaveCount(0);
    await expect(
      page.getByText(/검토는 이미 저장되어 수정할 수 없습니다/),
    ).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expectNoPageHorizontalOverflow(page);
    await shot(page, "result-review-1440");
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoPageHorizontalOverflow(page);
    await shot(page, "result-review-390");
  });

  test("shows empty candidates, previous-analysis warning, and processing poll", async ({
    page,
  }) => {
    const emptyRecs = succeededDetail({
      is_current: false,
      recommendations: [],
    });
    let detail = twoNoteDetail([
      {
        id: ANALYSIS_ID,
        case_id: MOCK_CASE_ID,
        status: "processing",
        mode: "replay",
        created_at: "2026-10-11T01:00:00.000Z",
        completed_at: null,
        is_current: true,
      },
    ]);
    let analysis: MockAnalysisDetail = {
      ...emptyRecs,
      status: "processing",
      result: null,
      completed_at: null,
      is_current: true,
      review: null,
    };
    let polls = 0;

    await openMockedCaseDetail(page, {
      detail: () => detail,
      analysisDetail: () => {
        polls += 1;
        if (polls >= 2) {
          analysis = emptyRecs;
          detail = twoNoteDetail([
            {
              id: ANALYSIS_ID,
              case_id: MOCK_CASE_ID,
              status: "succeeded",
              mode: "replay",
              created_at: emptyRecs.created_at,
              completed_at: emptyRecs.completed_at,
              is_current: false,
            },
          ]);
        }
        return analysis;
      },
    });

    await expect(page.getByRole("button", { name: "분석 진행 중…" })).toBeDisabled();
    await expect(page.getByText(/분석이 진행 중/)).toBeVisible();
    await expect
      .poll(async () => polls, { timeout: 12_000 })
      .toBeGreaterThanOrEqual(2);
    await expect(
      page.getByRole("strong").filter({ hasText: "이전 분석" }),
    ).toBeVisible();
    await expect(
      page.getByText("확인할 사업 후보가 없습니다. 원문을 검토해 주세요."),
    ).toBeVisible();
    await shot(page, "processing-then-stale-empty-recs");
  });

  test("shows distinct replay-unavailable error without inventing success", async ({
    page,
  }) => {
    await openMockedCaseDetail(page, {
      detail: twoNoteDetail(),
      createAnalysisHandler: () => ({
        status: 422,
        body: {
          error: {
            code: "REPLAY_UNAVAILABLE",
            message: "replay unavailable",
            request_id: "mock-replay-miss",
            details: {},
          },
        },
      }),
    });

    await page.getByRole("button", { name: "새 분석" }).click();
    await expect(page.getByText(/시연/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "분석 결과" })).toHaveCount(0);
  });
});
