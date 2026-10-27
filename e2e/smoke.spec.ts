import { expect, test } from "@playwright/test";

test("home page shows phase 0 skeleton banner", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("합성 데이터 전용");
  await expect(
    page.getByRole("heading", { name: "돌봄틈새 AI 프로젝트 골격" }),
  ).toBeVisible();
});
