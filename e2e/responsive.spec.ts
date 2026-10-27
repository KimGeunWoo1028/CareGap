import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectFullyInInitialViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

async function expectLoginControlsInInitialViewport(page: Page) {
  await expectFullyInInitialViewport(page, page.getByLabel("이메일"));
  await expectFullyInInitialViewport(page, page.getByLabel("비밀번호"));
  await expectFullyInInitialViewport(
    page,
    page.getByRole("button", { name: "로그인" }),
  );
}

test.describe("responsive shells", () => {
  test("390px login remains usable without page-level overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    await expect(page.getByLabel("이메일")).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  });

  test("1280px login shows primary heading and banner", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await expect(page.locator(".status-banner")).toContainText("담당자 판단 보조");
    await expect(page.getByRole("heading", { name: "돌봄틈새 AI" })).toBeVisible();
  });

  test("1440px login keeps banner and avoids page overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    await expect(page.locator(".status-banner")).toContainText("합성 데이터 전용");
    await expect(page.getByRole("heading", { name: "돌봄틈새 AI" })).toBeVisible();
    await expect(page.getByLabel("이메일")).toBeVisible();
  });

  test("390px places credentials above long synthetic intro", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    const emailBox = await page.getByLabel("이메일").boundingBox();
    const captionBox = await page
      .getByText("식사 변화의 근거 예시")
      .boundingBox();
    expect(emailBox).toBeTruthy();
    expect(captionBox).toBeTruthy();
    expect(emailBox!.y).toBeLessThan(captionBox!.y);
  });

  test("1280px places intro to the left of the login form", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    const introBox = await page.locator(".auth-intro").boundingBox();
    const formBox = await page.locator(".auth-form").boundingBox();
    expect(introBox).toBeTruthy();
    expect(formBox).toBeTruthy();
    expect(introBox!.x).toBeLessThan(formBox!.x);
  });

  for (const size of [
    { name: "390×844", width: 390, height: 844 },
    { name: "1280×800", width: 1280, height: 800 },
    { name: "1440×900", width: 1440, height: 900 },
  ] as const) {
    test(`${size.name} keeps email, password, and login button in the initial viewport`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/login");
      await expect(page.locator(".status-banner")).toContainText("합성 데이터 전용");
      await expectLoginControlsInInitialViewport(page);
    });
  }

  test("200% zoom keeps login controls reachable with allowed vertical scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    const email = page.getByLabel("이메일");
    const password = page.getByLabel("비밀번호");
    const button = page.getByRole("button", { name: "로그인" });

    await email.scrollIntoViewIfNeeded();
    await expect(email).toBeVisible();
    await password.scrollIntoViewIfNeeded();
    await expect(password).toBeVisible();
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeVisible();

    const buttonBox = await button.boundingBox();
    expect(buttonBox).toBeTruthy();
    expect(buttonBox!.height).toBeGreaterThanOrEqual(22);
  });
});
