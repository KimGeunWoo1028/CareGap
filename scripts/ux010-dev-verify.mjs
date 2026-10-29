import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    const env = {};
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
const email = fileEnv.TEST_USER_A_EMAIL?.trim() ?? "";
const password = fileEnv.TEST_USER_A_PASSWORD?.trim() ?? "";
if (!email || !password) {
  console.log("UX010_DEV | BLOCKED | missing TEST_USER_A credentials");
  process.exit(2);
}

const outDir = join("e2e", "artifacts", "ux-010-dev");
mkdirSync(outDir, { recursive: true });
// Prefer localhost to match the running `npm run dev` banner.
const base = process.env.UX010_BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));

const steps = [];
async function shot(name) {
  await page.screenshot({
    path: join(outDir, `${name}.png`),
    fullPage: true,
  });
}

async function loginOnce() {
  const emailInput = page.getByLabel("이메일");
  const passwordInput = page.getByLabel("비밀번호");
  await emailInput.click();
  await emailInput.fill("");
  await emailInput.pressSequentially(email, { delay: 15 });
  await passwordInput.click();
  await passwordInput.fill("");
  await passwordInput.pressSequentially(password, { delay: 15 });
  await expectValues();
  await page.getByRole("button", { name: "로그인" }).click();
  await page
    .getByRole("heading", { name: "사례 목록" })
    .waitFor({ timeout: 45_000 });
}

async function expectValues() {
  const emailVal = await page.getByLabel("이메일").inputValue();
  const passLen = (await page.getByLabel("비밀번호").inputValue()).length;
  if (emailVal !== email || passLen !== password.length) {
    throw new Error(
      `controlled_inputs_not_set emailMatch=${emailVal === email} passLen=${passLen}`,
    );
  }
}

try {
  await page.goto(`${base}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.getByLabel("이메일").waitFor({ state: "visible", timeout: 30_000 });
  steps.push("login_direct_ok");
  await shot("01-login-direct");

  await loginOnce();
  steps.push("login_success");
  await shot("02-after-login");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/login/, { timeout: 20_000 });
  await page.getByLabel("이메일").waitFor({ state: "visible", timeout: 20_000 });
  steps.push("reload_requires_login_expected");
  await shot("03-after-reload-login");

  await loginOnce();
  steps.push("relogin_ok");
  await shot("04-after-relogin-cases");

  // Soft navigation keeps the in-memory session.
  await page.getByRole("link", { name: "후속 확인" }).click();
  await page
    .getByRole("heading", { name: "후속 확인" })
    .waitFor({ timeout: 20_000 });
  steps.push("soft_nav_followups_ok");
  await page.getByRole("link", { name: /돌봄틈새 AI/ }).click();
  await page
    .getByRole("heading", { name: "사례 목록" })
    .waitFor({ timeout: 20_000 });
  steps.push("soft_nav_cases_ok");

  // Full document navigation clears memory session (intentional policy).
  await page.goto(`${base}/cases`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/login/, { timeout: 20_000 });
  steps.push("full_nav_cases_requires_login_expected");
  await shot("05-full-nav-requires-login");

  await loginOnce();
  steps.push("login_after_full_nav_ok");
  await page.getByRole("button", { name: "사례 추가" }).click();
  await page
    .getByRole("dialog", { name: "합성 사례 추가" })
    .waitFor({ timeout: 5_000 });
  steps.push("create_dialog_ok");
  await shot("06-create-dialog");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "사례 추가" }).waitFor({ timeout: 5_000 });
  steps.push("escape_restore_ok");

  const hydrationHints = consoleErrors.filter((t) =>
    /hydrat|Suspense|Minified React/i.test(t),
  );
  console.log(
    JSON.stringify(
      {
        verdict: hydrationHints.length ? "WARN" : "PASS",
        env: `npm run dev @ ${base}`,
        steps,
        consoleErrorCount: consoleErrors.length,
        hydrationHints,
        note: "persistSession=false: full reload/document navigation clears session by design; soft SPA nav keeps it",
      },
      null,
      2,
    ),
  );
} catch (e) {
  await shot("fail");
  console.log(
    JSON.stringify(
      {
        verdict: "FAIL",
        error: String(e),
        steps,
        url: page.url(),
        consoleErrors: consoleErrors.slice(0, 8),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
