/**
 * Timed ~4-minute presentation pacing dry-run (DEMO_RUNBOOK section budgets).
 * Never prints secrets. Requires CARE_GAP_REAL_AUTH_E2E=1 and a running UI base URL.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const BASE = process.env.CARE_GAP_UI_BASE ?? "http://127.0.0.1:3000";
const ARTIFACT = resolve(ROOT, "e2e/artifacts/hackathon-rc");

function loadEnvLocal() {
  const raw = readFileSync(resolve(ROOT, ".env.local"), "utf8");
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
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (process.env.CARE_GAP_REAL_AUTH_E2E?.trim() !== "1") {
    console.log("PACE | BLOCKED | set CARE_GAP_REAL_AUTH_E2E=1");
    process.exit(2);
  }
  const env = loadEnvLocal();
  const email = env.TEST_USER_A_EMAIL?.trim();
  const password = env.TEST_USER_A_PASSWORD?.trim();
  if (!email || !password) {
    console.log("PACE | BLOCKED | missing TEST_USER_A credentials");
    process.exit(2);
  }

  mkdirSync(resolve(ARTIFACT, "videos"), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: resolve(ARTIFACT, "videos"),
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();
  const t0 = Date.now();
  const marks = [];
  let ok = false;

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호").fill(password);
    await page.getByRole("button", { name: "로그인" }).click();
    await page.waitForURL(/\/cases/, { timeout: 30_000 });
    await page.getByRole("heading", { name: "사례 목록" }).waitFor();
    const seedLink = page.locator("a.case-link", { hasText: "합성-001" }).first();
    await seedLink.waitFor({ state: "visible", timeout: 45_000 });
    marks.push({ id: "login_done", ms: Date.now() - t0 });

    await sleep(30_000);
    marks.push({ id: "intro_0_30", ms: Date.now() - t0 });

    await seedLink.click();
    await page.waitForURL(/\/cases\/[0-9a-f-]+/i, { timeout: 30_000 });
    await page
      .locator(".compare-card__role", { hasText: "이전 상담" })
      .waitFor({ timeout: 45_000 });
    await page
      .locator(".compare-card__role", { hasText: "현재(최신) 상담" })
      .waitFor({ timeout: 45_000 });
    await sleep(40_000);
    marks.push({ id: "compare_0_30_1_10", ms: Date.now() - t0 });

    await page.getByRole("button", { name: "새 분석" }).click();
    await page
      .getByText("사전 준비된 시연 결과 · AI 실시간 분석 아님")
      .waitFor({ timeout: 45_000 });
    await sleep(50_000);
    marks.push({ id: "analyze_1_10_2_00", ms: Date.now() - t0 });

    await page.locator("q.analysis-quote").first().waitFor({ timeout: 15_000 });
    await sleep(50_000);
    marks.push({ id: "evidence_2_00_2_50", ms: Date.now() - t0 });

    await page.getByText("자격 미확인").first().waitFor({ timeout: 15_000 });
    await sleep(40_000);
    marks.push({ id: "candidates_2_50_3_30", ms: Date.now() - t0 });

    await page.getByLabel("추가 확인 필요", { exact: true }).check();
    await page.getByLabel("검토 메모").fill("발표 페이스 실측");
    await page.getByRole("button", { name: "검토 저장" }).click();
    await page.locator(".analysis-review-readonly").waitFor({ timeout: 30_000 });
    await sleep(30_000);
    marks.push({ id: "review_3_30_4_00", ms: Date.now() - t0 });

    await page.getByRole("button", { name: "로그아웃" }).click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    ok = true;
  } finally {
    const totalMs = Date.now() - t0;
    await context.close();
    await browser.close();
    const report = {
      ok,
      total_ms: totalMs,
      total_sec: Math.round(totalMs / 1000),
      target_sec: 240,
      within_four_minutes: ok && totalMs <= 250_000,
      marks,
      mode: "replay",
      base: BASE,
    };
    writeFileSync(
      resolve(ARTIFACT, "presentation-pace.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    if (!ok) {
      console.log(`PACE | FAIL | total_sec=${report.total_sec}`);
      process.exitCode = 1;
      return;
    }
    console.log(
      `PACE | PASS | total_sec=${report.total_sec}, within_4m=${report.within_four_minutes}`,
    );
  }
}

main().catch((error) => {
  console.error(`PACE | FAIL | ${String(error.message ?? error)}`);
  process.exit(1);
});
