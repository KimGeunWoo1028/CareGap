import { expect, test } from "@playwright/test";
import {
  installMockedAuthAndCasesApi,
  loginThroughMockedForm,
  sixMockCases,
} from "./helpers/mock-session";

test.describe("memory session policy with mocked auth only", () => {
  test("full reload clears in-memory session and requires login again", async ({
    page,
  }) => {
    await installMockedAuthAndCasesApi(page, { list: sixMockCases() });
    await loginThroughMockedForm(page);
    await expect(page.getByRole("heading", { name: "사례 목록" })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByLabel("이메일")).toBeVisible();
  });

  test("logout returns to login and blocks cases without a new session", async ({
    page,
  }) => {
    await installMockedAuthAndCasesApi(page, { list: sixMockCases() });
    await loginThroughMockedForm(page);
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await page.goto("/cases");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
