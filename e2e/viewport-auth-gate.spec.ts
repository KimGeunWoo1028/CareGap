import { expect, test, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Authenticated viewport checks (cases / detail+analysis anchors / follow-ups).
 * Opt-in: CARE_GAP_REAL_AUTH_E2E=1 + TEST_USER_A in .env.local.
 * Memory sessions do not survive full reloads — re-login per viewport; use in-app links.
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
const ready = allow && Boolean(emailA && passwordA);

async function loginAsA(page: Page) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(emailA);
  await page.getByLabel("비밀번호").fill(passwordA);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/cases/);
  await expect(page.getByRole("heading", { name: "사례 목록" })).toBeVisible();
}

async function noHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}

test.describe("authenticated viewport gate (real Auth A)", () => {
  test.skip(!ready, "Set CARE_GAP_REAL_AUTH_E2E=1 and TEST_USER_A in .env.local");

  test("cases, detail, analysis anchors, follow-ups fit 1920/1366/768/390", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const outDir = path.join("e2e", "artifacts", "viewport-gate");
    mkdirSync(outDir, { recursive: true });

    const sizes = [
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "1366x768", width: 1366, height: 768 },
      { name: "768x1024", width: 768, height: 1024 },
      { name: "390x844", width: 390, height: 844 },
    ] as const;

    for (const size of sizes) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await loginAsA(page);

      await noHorizontalOverflow(page);
      await page.screenshot({
        path: path.join(outDir, `cases-${size.name}.png`),
        fullPage: true,
      });

      const caseLink = page.locator("a.case-link").first();
      await expect(caseLink).toBeVisible();
      await caseLink.click();
      await expect(page).toHaveURL(/\/cases\/[0-9a-f-]+/i);
      await expect(page.getByRole("heading", { name: "사례 개요" })).toBeVisible();
      await expect(
        page.locator("#analysis-result-heading, a[href='#analysis-result-heading']").first(),
      ).toBeVisible();
      await noHorizontalOverflow(page);
      await page.screenshot({
        path: path.join(outDir, `case-detail-${size.name}.png`),
        fullPage: true,
      });

      await page.getByRole("link", { name: "후속 확인" }).first().click();
      await expect(page).toHaveURL(/\/follow-ups/);
      await expect(page.getByRole("heading", { name: "후속 확인" })).toBeVisible();
      await noHorizontalOverflow(page);
      await page.screenshot({
        path: path.join(outDir, `follow-ups-${size.name}.png`),
        fullPage: true,
      });
    }
  });
});
