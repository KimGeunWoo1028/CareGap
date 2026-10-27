import { expect, test } from "@playwright/test";

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
});
