/**
 * READ-ONLY audit screenshots. Does NOT click create/analyze/review/complete/cancel.
 * Opt-in: CARE_GAP_AUDIT_CAPTURE=1
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[line.slice(0, i).trim()] = v;
  }
  return env;
}

if (process.env.CARE_GAP_AUDIT_CAPTURE?.trim() !== "1") {
  console.error("Set CARE_GAP_AUDIT_CAPTURE=1 to run");
  process.exit(1);
}

const env = loadEnvLocal();
const email = env.TEST_USER_A_EMAIL;
const password = env.TEST_USER_A_PASSWORD;
const base = process.env.CARE_GAP_AUDIT_BASE ?? "http://127.0.0.1:3000";
const out = path.join(
  process.cwd(),
  "docs",
  "audits",
  "ui-ux-interaction",
  "evidence",
);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
await page.locator("#email").waitFor({ state: "visible", timeout: 60_000 });
await page.screenshot({ path: path.join(out, "01-login-1440.png"), fullPage: true });

await page.locator("#email").fill(email);
await page.locator("#password").fill(password);
await page.getByRole("button", { name: "로그인" }).click();
await page.waitForURL(/\/cases/, { timeout: 60_000 });
await page.screenshot({ path: path.join(out, "02-cases-1440.png"), fullPage: true });

const search = page.locator("#case-search, input[placeholder='목록에서 검색']");
if (await search.count()) {
  await search.first().fill("합성-001");
  await page.waitForTimeout(400);
}
await page.screenshot({
  path: path.join(out, "03-cases-search-001-1440.png"),
  fullPage: true,
});

const link001 = page.getByRole("link", { name: /합성-001/ }).first();
if ((await link001.count()) > 0) {
  await link001.click();
  await page.waitForURL(/\/cases\//);
  await page.screenshot({
    path: path.join(out, "04-case-detail-001-1440.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(out, "05-case-detail-001-390.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  const followNav = page.getByRole("link", { name: "후속 확인" }).first();
  await followNav.click();
  await page.waitForURL(/\/follow-ups/);
  await page.screenshot({
    path: path.join(out, "06-follow-ups-1440.png"),
    fullPage: true,
  });
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/login`);
await page.screenshot({ path: path.join(out, "07-login-390.png"), fullPage: true });

console.log(JSON.stringify({ out, note: "read-only; no mutations clicked" }));
await browser.close();
