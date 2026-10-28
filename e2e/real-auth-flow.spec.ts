import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Real Supabase password-login UI checks.
 * Opt-in only: set CARE_GAP_REAL_AUTH_E2E=1 in the shell (not required in .env.local).
 * Also needs TEST_USER_A/B_* in .env.local.
 * Never logs or screenshots password/JWT values.
 */

function loadEnvLocal(): Record<string, string> {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const env: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 0) continue;
      const key = line.slice(0, i).trim();
      let value = line.slice(i + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

const fileEnv = loadEnvLocal();
const allow = process.env.CARE_GAP_REAL_AUTH_E2E?.trim() === "1";
const emailA = fileEnv.TEST_USER_A_EMAIL?.trim() ?? "";
const passwordA = fileEnv.TEST_USER_A_PASSWORD?.trim() ?? "";
const emailB = fileEnv.TEST_USER_B_EMAIL?.trim() ?? "";
const passwordB = fileEnv.TEST_USER_B_PASSWORD?.trim() ?? "";
const ready = allow && Boolean(emailA && passwordA && emailB && passwordB);

test.describe("real Supabase password auth UI", () => {
  test.skip(
    !ready,
    "Set CARE_GAP_REAL_AUTH_E2E=1 and TEST_USER_A/B credentials in .env.local",
  );

  test("A logs in, sees cases, reload requires login, logout blocks cases", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("이메일").fill(emailA);
    await page.getByLabel("비밀번호").fill(passwordA);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/cases/);
    await expect(page.getByRole("heading", { name: "사례 목록" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "내 사례" })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel("이메일").fill(emailA);
    await page.getByLabel("비밀번호").fill(passwordA);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/cases/);

    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/cases");
    await expect(page).toHaveURL(/\/login/);
  });

  test("wrong password stays on login without leaking secrets in URL", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("이메일").fill(emailA);
    await page.getByLabel("비밀번호").fill("definitely-wrong-password-for-phase6");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.url()).not.toMatch(/password=/i);
    await expect(page.locator(".alert")).toBeVisible();
  });

  test("B can log in to cases list", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("이메일").fill(emailB);
    await page.getByLabel("비밀번호").fill(passwordB);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/cases/);
    await expect(page.getByRole("heading", { name: "사례 목록" })).toBeVisible();
  });
});
