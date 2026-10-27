import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  buildMockDetail,
  expectNoPageHorizontalOverflow,
  mockConsultation,
  MOCK_CASE_ID,
  openMockedCaseDetail,
  type CaseDetailApiMock,
  type MockCaseDetail,
} from "./helpers/mock-session";

const ARTIFACT_DIR = path.join("e2e", "artifacts", "case-detail-ui");

async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, `${name}.png`),
    fullPage: true,
  });
}

const LONG_BODY = [
  "합성 상담 원문 예시입니다.",
  "줄바꿈을 포함한 긴 문단을 읽기 폭과 함께 확인합니다.",
  "앞뒤 공백과 연속 개행도 보존되어야 합니다.\n\n",
  "가나다라마바사아자차카타파하 ".repeat(40),
].join("\n");

test.describe("case detail UI with mocked auth/API only", () => {
  test("0 consultations shows guidance and fits viewports", async ({
    page,
  }) => {
    await openMockedCaseDetail(page, {
      detail: buildMockDetail({ consultations: [] }),
    });
    await expect(
      page.getByRole("heading", { name: "비교할 기록이 없습니다" }),
    ).toBeVisible();
    await expect(page.getByText(/서로 다른 날짜의 상담 기록이 2건/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /새 분석 \(기록 2건 필요\)/ }),
    ).toBeDisabled();
    await expect(
      page.getByText(/표시 중 0건 · 최신 날짜 순 · 최대 50건 조회/),
    ).toBeVisible();
    await expect(
      page.getByText(/표시 중 0건 · 최신 생성 순 · 최대 50건 조회/),
    ).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expectNoPageHorizontalOverflow(page);
    await shot(page, "empty-0-1440x900");
    await page.setViewportSize({ width: 1280, height: 800 });
    await expectNoPageHorizontalOverflow(page);
    await shot(page, "empty-0-1280x800");
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoPageHorizontalOverflow(page);
    await shot(page, "empty-0-390x844");
  });

  test("1 consultation asks for another date; 2 shows previous then current", async ({
    page,
  }) => {
    await openMockedCaseDetail(page, {
      detail: buildMockDetail({
        consultations: [
          mockConsultation({
            id: "00000000-0000-4000-8000-00000000c010",
            occurred_on: "2026-10-10",
            body: "한 건만 있는 합성 원문",
            channel: "visit",
          }),
        ],
      }),
    });
    await expect(
      page.getByRole("heading", { name: /한 건 더 필요/ }),
    ).toBeVisible();
    await shot(page, "one-note-1280x800");

    const detail = buildMockDetail({
      consultations: [
        mockConsultation({
          id: "00000000-0000-4000-8000-00000000c020",
          occurred_on: "2026-10-10",
          body: "  현재 원문 앞공백\n둘째 줄  ",
          channel: "phone",
        }),
        mockConsultation({
          id: "00000000-0000-4000-8000-00000000c019",
          occurred_on: "2026-09-10",
          body: "이전 원문",
          channel: "other",
        }),
      ],
      analyses: [
        {
          id: "00000000-0000-4000-8000-00000000a002",
          case_id: MOCK_CASE_ID,
          status: "succeeded",
          mode: "live",
          created_at: "2026-10-11T00:00:00.000Z",
          completed_at: "2026-10-11T00:01:00.000Z",
          is_current: true,
        },
        {
          id: "00000000-0000-4000-8000-00000000a001",
          case_id: MOCK_CASE_ID,
          status: "succeeded",
          mode: "replay",
          created_at: "2026-09-15T00:00:00.000Z",
          completed_at: "2026-09-15T00:01:00.000Z",
          is_current: false,
        },
      ],
    });

    await openMockedCaseDetail(page, {
      detail: () => detail,
    });
    await expect(
      page.locator(".compare-card__role", { hasText: "이전 상담" }),
    ).toBeVisible();
    await expect(
      page.locator(".compare-card__role", { hasText: "현재(최신) 상담" }),
    ).toBeVisible();
    await expect(page.locator(".compare-card__body").filter({ hasText: "이전 원문" })).toBeVisible();
    await expect(
      page.locator(".compare-card__body").filter({ hasText: /현재 원문 앞공백/ }),
    ).toBeVisible();
    await expect(
      page.getByText("새 상담 기록이 추가된 이전 분석"),
    ).toBeVisible();
    await expect(page.getByText(/replay · 사전 준비 시연/)).toBeVisible();
    await expect(page.getByRole("button", { name: "새 분석" })).toBeEnabled();

    const roles = page.locator(".compare-card__role");
    await expect(roles.nth(0)).toHaveText("이전 상담");
    await expect(roles.nth(1)).toHaveText("현재(최신) 상담");

    await page.setViewportSize({ width: 1440, height: 900 });
    await expectNoPageHorizontalOverflow(page);
    await shot(page, "two-notes-1440x900");
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoPageHorizontalOverflow(page);
    await shot(page, "two-notes-390x844");
  });

  test("create form keeps values on duplicate date and 503", async ({
    page,
  }) => {
    const api: CaseDetailApiMock = {
      detail: buildMockDetail({
        consultations: [
          mockConsultation({
            id: "00000000-0000-4000-8000-00000000c030",
            occurred_on: "2026-10-10",
            body: "기존",
          }),
        ],
      }),
      postError: {
        code: "DUPLICATE_DATE",
        message: "같은 날짜의 상담 기록이 이미 있습니다.",
      },
      postStatus: 409,
    };
    await openMockedCaseDetail(page, api);

    await page.getByLabel("상담 날짜").fill("2026-10-10");
    await page.getByLabel("합성 원문").fill("중복 날짜에 남길 원문");
    await page.getByRole("button", { name: "합성 기록 저장" }).click();
    await expect(
      page.getByText("같은 날짜의 상담 기록이 이미 있습니다."),
    ).toBeVisible();
    await expect(page.getByLabel("합성 원문")).toHaveValue(
      "중복 날짜에 남길 원문",
    );
    await expect(page.getByLabel("상담 날짜")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await shot(page, "duplicate-date-1440x900");
  });

  test("successful save clears body only after mocked 201 and reload", async ({
    page,
  }) => {
    let detail: MockCaseDetail = buildMockDetail({ consultations: [] });
    await openMockedCaseDetail(page, {
      detail: () => detail,
      postHandler: (payload) => {
        const created = mockConsultation({
          id: "00000000-0000-4000-8000-00000000c040",
          occurred_on: payload.occurred_on,
          channel: payload.channel as "phone" | "visit" | "other",
          body: payload.body,
        });
        detail = {
          ...detail,
          consultations: [created, ...detail.consultations],
        };
        return {
          status: 201,
          body: {
            data: created,
            meta: { request_id: "mock-consult-ok" },
          },
        };
      },
    });

    const draft = `  저장 확인용 원문\n둘째 줄  `;
    await page.getByLabel("상담 날짜").fill("2026-10-08");
    await page.getByLabel("합성 원문").fill(draft);
    await page.getByRole("button", { name: "합성 기록 저장" }).click();
    await expect(page.getByText("합성 기록을 저장했습니다.")).toBeVisible();
    await expect(page.getByLabel("합성 원문")).toHaveValue("");
    await expect(page.getByText(/저장 확인용 원문/)).toBeVisible();
  });

  test("long body, form errors, and 200% zoom stay reachable", async ({
    page,
  }) => {
    await openMockedCaseDetail(page, {
      detail: buildMockDetail({
        consultations: [
          mockConsultation({
            id: "00000000-0000-4000-8000-00000000c050",
            occurred_on: "2026-10-10",
            body: LONG_BODY,
          }),
          mockConsultation({
            id: "00000000-0000-4000-8000-00000000c049",
            occurred_on: "2026-09-01",
            body: "짧은 이전 원문",
          }),
          mockConsultation({
            id: "00000000-0000-4000-8000-00000000c048",
            occurred_on: "2026-08-01",
            body: "세 번째(비교 밖)",
          }),
        ],
      }),
      postStatus: 503,
      postError: {
        code: "SERVICE_UNAVAILABLE",
        message: "서비스 연결을 확인할 수 없습니다.",
      },
    });

    await expect(
      page.locator(".compare-card__role", { hasText: "이전 상담" }),
    ).toBeVisible();
    await expect(page.getByText("세 번째(비교 밖)", { exact: true })).toBeVisible();
    await page.getByLabel("합성 원문").fill("실패해도 남을 원문");
    await page.getByRole("button", { name: "합성 기록 저장" }).click();
    await expect(page.getByText("서비스 연결을 확인할 수 없습니다.")).toBeVisible();
    await expect(page.getByLabel("합성 원문")).toHaveValue("실패해도 남을 원문");
    await shot(page, "long-and-503-1280x800");

    await page.setViewportSize({ width: 720, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expect(page.getByLabel("합성 원문")).toBeVisible();
    await expect(page.getByRole("button", { name: "합성 기록 저장" })).toBeVisible();
    await shot(page, "zoom-200-720");
    await page.evaluate(() => {
      document.documentElement.style.zoom = "1";
    });
  });

  test("404 detail stays opaque without leaking ownership", async ({
    page,
  }) => {
    await openMockedCaseDetail(page, {
      detail: buildMockDetail(),
      detailStatus: 404,
      detailError: {
        code: "NOT_FOUND",
        message: "요청한 자료를 찾을 수 없거나 접근할 수 없습니다.",
      },
    });
    await expect(
      page.getByText("요청한 자료를 찾을 수 없거나 접근할 수 없습니다."),
    ).toBeVisible();
    await expect(page.getByText(/소유/)).toHaveCount(0);
    await shot(page, "not-found-1280x800");
  });
});
