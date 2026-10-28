import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Hackathon RC browser rehearsal ×3 (real A password login + Replay UI).
 * Opt-in: CARE_GAP_REAL_AUTH_E2E=1
 * Never logs passwords/JWT.
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

const ARTIFACT_DIR = path.join("e2e", "artifacts", "hackathon-rc");
const timings: Array<{
  run: number;
  ok: boolean;
  wall_ms: number;
  analysisVisible: boolean;
  reviewSaved: boolean;
}> = [];

test.use({
  video: ready ? { mode: "on", size: { width: 1280, height: 720 } } : "off",
  viewport: { width: 1280, height: 720 },
});

test.describe.configure({ mode: "serial" });

test.describe("hackathon RC browser rehearsal", () => {
  test.skip(!ready, "Set CARE_GAP_REAL_AUTH_E2E=1 and TEST_USER_A_* in .env.local");

  for (let run = 1; run <= 3; run += 1) {
    test(`rehearsal run ${run}: login → 합성-001 → analyze → review → logout`, async ({
      page,
    }, testInfo) => {
      const t0 = Date.now();
      let analysisVisible = false;
      let reviewSaved = false;
      let ok = false;

      try {
        await page.goto("/login");
        await page.getByLabel("이메일").fill(emailA);
        await page.getByLabel("비밀번호").fill(passwordA);
        await page.getByRole("button", { name: "로그인" }).click();
        await expect(page).toHaveURL(/\/cases/);

        const seedLink = page.getByRole("link", { name: /합성-001/ }).first();
        await expect(seedLink).toBeVisible();
        await seedLink.click();
        await expect(page).toHaveURL(/\/cases\//);

        await expect(
          page.locator(".compare-card__role", { hasText: "이전 상담" }),
        ).toBeVisible();
        await expect(
          page.locator(".compare-card__role", { hasText: "현재(최신) 상담" }),
        ).toBeVisible();

        const analyze = page.getByRole("button", { name: "새 분석" });
        await expect(analyze).toBeEnabled();
        await analyze.click();

        await expect(
          page.getByText("사전 준비된 시연 결과 · AI 실시간 분석 아님"),
        ).toBeVisible({ timeout: 45_000 });
        analysisVisible = true;

        await expect(page.getByRole("heading", { name: "식사", exact: true })).toBeVisible();
        await expect(page.locator("q.analysis-quote").first()).toBeVisible();
        await expect(page.getByText("자격 미확인").first()).toBeVisible();

        await page.getByLabel("추가 확인 필요", { exact: true }).check();
        await page.getByLabel("검토 메모").fill(`RC rehearsal ${run}`);
        await page.getByRole("button", { name: "검토 저장" }).click();
        await expect(page.locator(".analysis-review-readonly")).toContainText(
          "추가 확인 필요",
        );
        reviewSaved = true;

        await page.getByRole("button", { name: "로그아웃" }).click();
        await expect(page).toHaveURL(/\/login/);
        ok = true;
      } finally {
        const wall_ms = Date.now() - t0;
        timings.push({ run, ok, wall_ms, analysisVisible, reviewSaved });
        mkdirSync(ARTIFACT_DIR, { recursive: true });
        writeFileSync(
          path.join(ARTIFACT_DIR, "rehearsal-timings.json"),
          `${JSON.stringify(timings, null, 2)}\n`,
          "utf8",
        );
        await page.screenshot({
          path: path.join(ARTIFACT_DIR, `rehearsal-run-${run}.png`),
          fullPage: true,
        });
        testInfo.annotations.push({
          type: "rehearsal",
          description: `run=${run} ok=${ok} wall_ms=${wall_ms}`,
        });
      }
    });
  }

  test("write timing summary after three runs", async () => {
    expect(timings).toHaveLength(3);
    expect(timings.every((row) => row.ok)).toBe(true);
    const total = timings.reduce((sum, row) => sum + row.wall_ms, 0);
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      path.join(ARTIFACT_DIR, "rehearsal-summary.md"),
      [
        "# Hackathon RC browser rehearsal",
        "",
        `Generated: ${new Date().toISOString()}`,
        "Mode: replay (UI banner verified each run)",
        "",
        "| Run | OK | Wall ms | Analysis | Review |",
        "|---|---|---|---|---|",
        ...timings.map(
          (row) =>
            `| ${row.run} | ${row.ok} | ${row.wall_ms} | ${row.analysisVisible} | ${row.reviewSaved} |`,
        ),
        "",
        `Total wall ms (3 runs): ${total}`,
        `Mean wall ms: ${Math.round(total / timings.length)}`,
        "",
        "Videos: Playwright `test-results/` for this spec; screenshots under `e2e/artifacts/hackathon-rc/`.",
        "",
      ].join("\n"),
      "utf8",
    );
  });
});
