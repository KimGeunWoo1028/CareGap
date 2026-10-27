import { expect, test } from "@playwright/test";
import { installMockedAuthLoginFailure } from "./helpers/mock-session";

/** Synthetic placeholders only — not a real account. */
const FAILED_LOGIN_EMAIL = "stage2-check@example.invalid";
const FAILED_LOGIN_PASSWORD = "mock-failed-password-not-real";

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

test("failed login keeps values, shows error, and does not put secrets in the URL", async ({
  page,
}) => {
  const authFailure = await installMockedAuthLoginFailure(page);

  await page.goto("/login");
  await page.getByLabel("이메일").fill(FAILED_LOGIN_EMAIL);
  await page.getByLabel("비밀번호").fill(FAILED_LOGIN_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page.getByRole("alert", { name: "오류" })).toContainText(
    "로그인 정보를 확인해 주세요.",
    { timeout: 15_000 },
  );
  await expect(page).toHaveURL(/\/login$/);
  expect(page.url()).not.toMatch(/password=/i);
  await expect(page.getByLabel("이메일")).toHaveValue(FAILED_LOGIN_EMAIL);
  await expect(page.getByLabel("비밀번호")).not.toHaveValue("");
  const loginButton = page.getByRole("button", { name: "로그인" });
  await loginButton.scrollIntoViewIfNeeded();
  await expect(loginButton).toBeEnabled();
  await expect(loginButton).toBeVisible();

  authFailure.assertMockedFailureHandled();
});
