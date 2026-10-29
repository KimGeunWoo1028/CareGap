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
  analysis_id: string;
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
    kind: "next_consultation",
    status: "open",
    due_on: null,
    note: "모의 후속 확인",
    created_at: "2026-10-12T01:00:00.000Z",
    completed_at: null,
  };
}

async function installFollowUpsApi(page: Page, task: MockTask): Promise<{
  getTask: () => MockTask;
}> {
  let current = { ...task };
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
  };
}

test.describe("follow-ups UI with mocked auth/API only", () => {
  test("marks open task done and removes it from open filter", async ({
    page,
  }) => {
    await installMockedAuthAndCasesApi(page, { list: sixMockCases() });
    const store = await installFollowUpsApi(page, openTask());
    await loginThroughMockedForm(page);
    // Client nav only — full page.goto clears the in-memory session.
    await page.getByRole("link", { name: "후속 확인" }).click();
    await expect(page.getByRole("heading", { name: "후속 확인" })).toBeVisible();
    await expect(page.getByText("모의 후속 확인")).toBeVisible();
    await page.getByRole("button", { name: "완료" }).click();
    await expect(page.getByText("대기 중인 후속 확인이 없습니다.")).toBeVisible();
    expect(store.getTask().status).toBe("done");
  });

  test("marks open task cancelled via ghost action", async ({ page }) => {
    await installMockedAuthAndCasesApi(page, { list: sixMockCases() });
    const store = await installFollowUpsApi(page, openTask());
    await loginThroughMockedForm(page);
    await page.getByRole("link", { name: "후속 확인" }).click();
    await page.getByRole("button", { name: "취소" }).click();
    await expect(page.getByText("대기 중인 후속 확인이 없습니다.")).toBeVisible();
    expect(store.getTask().status).toBe("cancelled");
  });
});

