import { expect, test } from "@playwright/test";

test("login page shows synthetic banner and form labels", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator(".status-banner")).toContainText("합성 데이터 전용");
  await expect(page.getByRole("heading", { name: "돌봄틈새 AI" })).toBeVisible();
  await expect(page.getByLabel("이메일")).toBeVisible();
  await expect(page.getByLabel("비밀번호")).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
});

test("unauthenticated cases route redirects toward login", async ({ page }) => {
  await page.goto("/cases");
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(page.getByLabel("이메일")).toBeVisible();
});
