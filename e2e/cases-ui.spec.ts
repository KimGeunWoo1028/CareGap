import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  expectNoPageHorizontalOverflow,
  installMockedAuthAndCasesApi,
  loginThroughMockedForm,
  sixMockCases,
  type CasesApiMock,
} from "./helpers/mock-session";

const ARTIFACT_DIR = path.join("e2e", "artifacts", "cases-ui");

async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, `${name}.png`),
    fullPage: true,
  });
}

async function openCasesWithMock(
  page: Page,
  api: CasesApiMock,
): Promise<void> {
  await installMockedAuthAndCasesApi(page, api);
  await loginThroughMockedForm(page);
  await expect(page.getByRole("heading", { name: "사례 목록" })).toBeVisible();
}

async function expectSingleDetailLinkPerRow(page: Page): Promise<void> {
  const rows = page.locator(".case-table tbody tr");
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const links = row.locator("a");
    await expect(links).toHaveCount(2);
    const nameHref = await links.nth(0).getAttribute("href");
    const arrowHref = await links.nth(1).getAttribute("href");
    expect(nameHref).toBeTruthy();
    expect(arrowHref).toBe(nameHref);
    await expect(row.locator(".case-row__arrow-link")).toBeVisible();
  }
}

async function expectNoFirstRowEmphasis(page: Page): Promise<void> {
  const rows = page.locator(".case-table tbody tr");
  if ((await rows.count()) < 2) return;
  const firstBg = await rows
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const secondBg = await rows
    .nth(1)
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(firstBg).toBe(secondBg);
}

test.describe("cases list UI with mocked auth/API only", () => {
  test("6-case list keeps columns, one link per row, and fits viewports", async ({
    page,
  }) => {
    const cases = sixMockCases();
    await openCasesWithMock(page, { list: cases });

    await expect(page.getByText("표시 중 6건")).toBeVisible();
    await expect(
      page.getByText(/목록에서 검색 · 등록일 최신순 · 최대 100건/),
    ).toBeVisible();
    await expect(page.getByLabel("목록에서 검색")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "사례명" })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "상담 기록" }),
    ).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "등록일" })).toBeVisible();
    await expect(page.locator("a.case-link", { hasText: "합성-001" })).toBeVisible();
    await expect(page.locator(".case-note-count").first()).toHaveText("2건");
    await expectSingleDetailLinkPerRow(page);
    await expectNoFirstRowEmphasis(page);

    for (const size of [
      { name: "1440x900", width: 1440, height: 900 },
      { name: "1280x800", width: 1280, height: 800 },
      { name: "390x844", width: 390, height: 844 },
    ] as const) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await expectNoPageHorizontalOverflow(page);
      await expect(page.getByRole("heading", { name: "사례 목록" })).toBeVisible();
      await expect(page.locator("a.case-link", { hasText: "합성-001" })).toBeVisible();
      await shot(page, `list-6-${size.name}`);
    }
  });

  test("empty list is distinct from search-empty and restores focus on cancel", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openCasesWithMock(page, { list: [] });

    await expect(page.getByText("아직 등록된 합성 사례가 없습니다.")).toBeVisible();
    await expect(
      page.getByText(/사례를 추가한 뒤 서로 다른 날짜의 상담 기록/),
    ).toBeVisible();
    await expect(page.locator(".case-table")).toHaveCount(0);
    await shot(page, "empty-1280x800");

    const titleAdd = page
      .locator(".cases-title-row")
      .getByRole("button", { name: "사례 추가" });
    await titleAdd.click();
    await expect(page.getByLabel("사례명")).toBeFocused();
    await shot(page, "create-open-1280x800");

    await page.getByRole("button", { name: "취소" }).click();
    await expect(titleAdd).toBeFocused();
  });

  test("search miss keeps query and clear restores rows", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openCasesWithMock(page, { list: sixMockCases() });

    await page.getByLabel("목록에서 검색").fill("합성-999");
    await expect(page.getByText("일치하는 사례가 없습니다.")).toBeVisible();
    await expect(page.getByLabel("목록에서 검색")).toHaveValue("합성-999");
    await expectNoPageHorizontalOverflow(page);
    await shot(page, "search-empty-390x844");

    await page.getByRole("button", { name: "검색어 지우기" }).click();
    await expect(page.getByLabel("목록에서 검색")).toHaveValue("");
    await expect(page.locator("a.case-link", { hasText: "합성-001" })).toBeVisible();
    await expect(page.getByText("표시 중 6건")).toBeVisible();
  });

  test("create panel shows format and duplicate errors without clearing input", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openCasesWithMock(page, {
      list: sixMockCases(),
      createError: {
        code: "DUPLICATE_ALIAS",
        message: "같은 별칭이 있습니다.",
      },
    });

    await page.getByRole("button", { name: "사례 추가" }).click();
    await expect(page.getByLabel("사례명")).toBeFocused();

    await page.getByLabel("사례명").fill("잘못된이름");
    await page.getByRole("button", { name: "사례 만들기" }).click();
    await expect(page.locator(".field__error")).toContainText(
      "별칭은 합성-001 형식으로 입력해 주세요.",
    );
    await expect(page.getByLabel("사례명")).toHaveValue("잘못된이름");
    await shot(page, "create-format-error-1440x900");

    await page.getByLabel("사례명").fill("합성-001");
    await page.getByRole("button", { name: "사례 만들기" }).click();
    await expect(page.locator(".field__error")).toContainText(
      "같은 별칭이 있습니다.",
    );
    await expect(page.getByLabel("사례명")).toHaveValue("합성-001");
    await expect(page.getByRole("button", { name: "사례 만들기" })).toBeVisible();
    await shot(page, "create-duplicate-error-1440x900");
  });

  test("list failure stays distinct from empty and retry reloads mocked rows", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const rows = sixMockCases();
    const api: CasesApiMock = {
      list: rows,
      listError: {
        code: "SERVICE_UNAVAILABLE",
        message:
          "일시적으로 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      },
    };

    await installMockedAuthAndCasesApi(page, api);
    await loginThroughMockedForm(page);
    await expect(page.getByText("목록을 불러오지 못했습니다")).toBeVisible();
    await expect(page.getByText("아직 등록된 합성 사례가 없습니다.")).toHaveCount(
      0,
    );
    await shot(page, "list-error-1280x800");

    api.listError = undefined;
    await page.getByRole("button", { name: "다시 시도" }).click();
    await expect(page.locator("a.case-link", { hasText: "합성-001" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("표시 중 6건")).toBeVisible();
  });
});
