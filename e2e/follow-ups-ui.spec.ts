import { expect, test, type Page, type Route } from "@playwright/test";
import {
  installMockedAuthAndCasesApi,
  loginThroughMockedForm,
  sixMockCases,
} from "./helpers/mock-session";

type MockTask = {
  id: string;
  owner_id: string;
  case_id: string;
  analysis_id: string | null;
  case_alias?: string | null;
  analysis_summary?: string | null;
  analysis_completed_at?: string | null;
  analysis_mode?: "live" | "replay" | null;
  kind: "next_consultation";
  status: "open" | "done" | "cancelled";
  due_on: string | null;
  note: string;
  created_at: string;
  completed_at: string | null;
};

function openTask(): MockTask {
  return {
    id: "00000000-0000-4000-8000-00000000f001",
    owner_id: "00000000-0000-4000-8000-000000000001",
    case_id: sixMockCases()[0].id,
    analysis_id: "00000000-0000-4000-8000-00000000a001",
    case_alias: sixMockCases()[0].alias,
    analysis_summary: "식사 악화 · 이동 변화 없음 (모의 요약)",
    analysis_completed_at: "2026-10-11T08:00:00.000Z",
    analysis_mode: "replay",
    kind: "next_consultation",
    status: "open",
    due_on: null,
    note: "모의 후속 확인",
    created_at: "2026-10-12T01:00:00.000Z",
    completed_at: null,
  };
}

async function installFollowUpsApi(
  page: Page,
  task: MockTask,
  options: { failList?: boolean } = {},
): Promise<{
  getTask: () => MockTask;
  getPatchCount: () => number;
}> {
  let current = { ...task };
  let patchCount = 0;
  await page.route("**/api/follow-ups**", async (route: Route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
      return;
    }
    if (method === "GET" && url.pathname === "/api/follow-ups") {
      if (options.failList) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "일시적으로 목록을 불러올 수 없습니다.",
              request_id: "mock-fu-fail",
              details: {},
            },
          }),
        });
        return;
      }
      const status = url.searchParams.get("status");
      const rows =
        status === "open" && current.status !== "open" ? [] : [current];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: rows,
          meta: { request_id: "mock-fu-list" },
        }),
      });
      return;
    }
    const patchMatch = url.pathname.match(/^\/api\/follow-ups\/([^/]+)$/);
    if (method === "PATCH" && patchMatch) {
      patchCount += 1;
      const body = req.postDataJSON() as { status?: string };
      if (current.status !== "open") {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "NOT_FOUND",
              message: "요청한 자료를 찾을 수 없습니다.",
              request_id: "mock-fu-patch",
              details: {},
            },
          }),
        });
        return;
      }
      current = {
        ...current,
        status: body.status === "cancelled" ? "cancelled" : "done",
        completed_at: "2026-10-12T02:00:00.000Z",
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: current,
          meta: { request_id: "mock-fu-patch" },
        }),
      });
      return;
    }
    await route.fulfill({ status: 405 });
  });
  return {
    getTask: () => current,
    getPatchCount: () => patchCount,
  };
}

test.describe("follow-ups UI with mocked auth/API only", () => {
  test("shows case alias and keeps open filter in URL", async ({ page }) => {
    await installMockedAuthAndCasesApi(page, { list: sixMockCases() });
    await installFollowUpsApi(page, openTask());
    await loginThroughMockedForm(page);
    await page.getByRole("link", { name: "후속 확인" }).click();
    await expect(page.getByRole("heading", { name: "후속 확인" })).toBeVisible();
    await expect(page.getByText(sixMockCases()[0].alias)).toBeVisible();
    await expect(page.getByText(/연결된 분석 요약:/)).toBeVisible();
    await expect(page.getByText(/시연\(Replay\)/)).toBeVisible();
    const evidence = page.getByRole("link", { name: "분석 결과·근거" });
    await expect(evidence).toBeVisible();
    await expect(evidence).toHaveAttribute("href", /return=%2Ffollow-ups/);
    await expect(page.getByRole("link", { name: "사례 열기" })).toBeVisible();
    await page.getByRole("button", { name: "전체" }).click();
    await expect(page).toHaveURL(/status=all/);
    await page.getByRole("button", { name: "필터 초기화" }).click();
    await expect(page).not.toHaveURL(/status=all/);
  });

  test("list failure is not shown as empty success", async ({ page }) => {
    await installMockedAuthAndCasesApi(page, { list: sixMockCases() });
    await installFollowUpsApi(page, openTask(), { failList: true });
    await loginThroughMockedForm(page);
    await page.getByRole("link", { name: "후속 확인" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "목록을 불러오지 못했습니다" }),
    ).toBeVisible();
    await expect(
      page.getByText("대기 중인 후속 확인이 없습니다."),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
  });

  test("done confirm dismiss leaves task unchanged", async ({ page }) => {
    await installMockedAuthAndCasesApi(page, { list: sixMockCases() });
    const store = await installFollowUpsApi(page, openTask());
    await loginThroughMockedForm(page);
    await page.getByRole("link", { name: "후속 확인" }).click();
    await page.getByRole("button", { name: "완료" }).click();
    await expect(
      page.getByRole("heading", { name: "후속 확인을 완료할까요?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "돌아가기" }).click();
    await expect(page.getByText("모의 후속 확인")).toBeVisible();
    expect(store.getTask().status).toBe("open");
    expect(store.getPatchCount()).toBe(0);
  });

  test("marks open task done after confirm and removes it from open filter", async ({
    page,
  }) => {
    await installMockedAuthAndCasesApi(page, { list: sixMockCases() });
    const store = await installFollowUpsApi(page, openTask());
    await loginThroughMockedForm(page);
    await page.getByRole("link", { name: "후속 확인" }).click();
    await expect(page.getByRole("heading", { name: "후속 확인" })).toBeVisible();
    await expect(page.getByText("모의 후속 확인")).toBeVisible();
    await page.getByRole("button", { name: "완료" }).click();
    await page.getByRole("button", { name: "완료 처리" }).click();
    await expect(page.getByText("대기 중인 후속 확인이 없습니다.")).toBeVisible();
    expect(store.getTask().status).toBe("done");
  });

  test("cancel confirm dismiss leaves task unchanged", async ({ page }) => {
    await installMockedAuthAndCasesApi(page, { list: sixMockCases() });
    const store = await installFollowUpsApi(page, openTask());
    await loginThroughMockedForm(page);
    await page.getByRole("link", { name: "후속 확인" }).click();
    await page.getByRole("button", { name: "취소" }).click();
    await expect(
      page.getByRole("heading", { name: "후속 확인을 취소할까요?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "돌아가기" }).click();
    expect(store.getTask().status).toBe("open");
    expect(store.getPatchCount()).toBe(0);
  });

  test("marks open task cancelled after confirm", async ({ page }) => {
    await installMockedAuthAndCasesApi(page, { list: sixMockCases() });
    const store = await installFollowUpsApi(page, openTask());
    await loginThroughMockedForm(page);
    await page.getByRole("link", { name: "후속 확인" }).click();
    await page.getByRole("button", { name: "취소" }).click();
    await page.getByRole("button", { name: "취소 처리" }).click();
    await expect(page.getByText("대기 중인 후속 확인이 없습니다.")).toBeVisible();
    expect(store.getTask().status).toBe("cancelled");
  });
});
