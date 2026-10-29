import { expect, type Page, type Route } from "@playwright/test";

/** Synthetic fixture aliases only — not real accounts or DB rows. */
export type MockCase = {
  id: string;
  alias: string;
  created_at: string;
  consultation_count: number;
};

export const MOCK_LOGIN_EMAIL = "mock-caseworker@example.invalid";
/** Placeholder only for the mocked Auth token path — never a real secret. */
export const MOCK_LOGIN_PASSWORD = "mock-password-not-real";

const MOCK_USER_ID = "00000000-0000-4000-8000-000000000001";

function b64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** Unsigned JWT-shaped token for in-memory Supabase client parsing in tests. */
export function mockAccessToken(): string {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64url({ alg: "HS256", typ: "JWT" }),
    b64url({
      sub: MOCK_USER_ID,
      email: MOCK_LOGIN_EMAIL,
      role: "authenticated",
      aud: "authenticated",
      exp: now + 3600,
      iat: now,
    }),
    "mock-signature",
  ].join(".");
}

function corsHeaders(contentType?: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

function authSessionBody() {
  const accessToken = mockAccessToken();
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "mock-refresh-token",
    user: {
      id: MOCK_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: MOCK_LOGIN_EMAIL,
      app_metadata: { provider: "email" },
      user_metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
    },
  };
}

export function sixMockCases(): MockCase[] {
  return Array.from({ length: 6 }, (_, index) => {
    const n = String(index + 1).padStart(3, "0");
    return {
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      alias: `합성-${n}`,
      created_at: `2026-10-${String(10 - index).padStart(2, "0")}T03:00:00.000Z`,
      consultation_count: index === 0 ? 2 : index % 3,
    };
  });
}

export type CasesApiMock = {
  list: MockCase[] | (() => MockCase[]);
  listStatus?: number;
  listError?: { code: string; message: string };
  createStatus?: number;
  createError?: { code: string; message: string };
  createHandler?: (alias: string) => {
    status: number;
    body: Record<string, unknown>;
  };
};

async function fulfillJson(
  route: Route,
  status: number,
  body: unknown,
): Promise<void> {
  await route.fulfill({
    status,
    headers: corsHeaders("application/json; charset=utf-8"),
    body: JSON.stringify(body),
  });
}

/**
 * Intercept browser Auth token calls and /api/cases only.
 * Does not change product code; blocks accidental PostgREST traffic.
 */
export async function installMockedAuthAndCasesApi(
  page: Page,
  api: CasesApiMock,
): Promise<void> {
  await page.route(
    (url) => url.pathname.includes("/auth/v1/token"),
    async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders() });
        return;
      }
      await fulfillJson(route, 200, authSessionBody());
    },
  );

  await page.route(
    (url) => url.pathname.includes("/auth/v1/logout"),
    async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders() });
        return;
      }
      await route.fulfill({ status: 204, headers: corsHeaders() });
    },
  );

  await page.route(
    (url) => url.pathname.includes("/rest/v1/"),
    async (route) => {
      await route.abort("blockedbyclient");
    },
  );

  await page.route(
    (url) => url.pathname === "/api/cases",
    async (route) => {
      const method = route.request().method();
      if (method === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders() });
        return;
      }

      if (method === "GET") {
        if (api.listError) {
          await fulfillJson(route, api.listStatus ?? 503, {
            error: {
              code: api.listError.code,
              message: api.listError.message,
              request_id: "mock-request-list",
              details: {},
            },
          });
          return;
        }
        const data = typeof api.list === "function" ? api.list() : api.list;
        await fulfillJson(route, 200, {
          data,
          meta: { request_id: "mock-request-list" },
        });
        return;
      }

      if (method === "POST") {
        const raw = route.request().postDataJSON() as { alias?: string } | null;
        const alias = raw?.alias ?? "";
        if (api.createHandler) {
          const result = api.createHandler(alias);
          await fulfillJson(route, result.status, result.body);
          return;
        }
        if (api.createError) {
          await fulfillJson(route, api.createStatus ?? 409, {
            error: {
              code: api.createError.code,
              message: api.createError.message,
              request_id: "mock-request-create",
              details: {},
            },
          });
          return;
        }
        await fulfillJson(route, 201, {
          data: {
            id: "00000000-0000-4000-8000-000000009999",
            alias,
            created_at: "2026-10-11T00:00:00.000Z",
            consultation_count: 0,
          },
          meta: { request_id: "mock-request-create" },
        });
        return;
      }

      await route.fulfill({ status: 405, headers: corsHeaders() });
    },
  );
}

/**
 * Explicit GoTrue-shaped password grant failure for UI regression only.
 * Matches what @supabase/auth-js parses into AuthApiError (invalid_credentials).
 */
export function mockInvalidCredentialsBody() {
  return {
    error: "invalid_grant",
    error_description: "Invalid login credentials",
    msg: "Invalid login credentials",
    error_code: "invalid_credentials",
  };
}

export type AuthFailureMockHandle = {
  /** Password-grant token requests fulfilled with the mocked 400. */
  tokenFailureHits: number;
  /** Auth/PostgREST requests that were blocked instead of forwarded. */
  unexpectedBlocked: string[];
  assertMockedFailureHandled(): void;
};

/**
 * Intercept password login as an auth failure; block other Auth + PostgREST.
 * Does not change product code. Real account verification stays BLOCKED.
 */
export async function installMockedAuthLoginFailure(
  page: Page,
): Promise<AuthFailureMockHandle> {
  const state = {
    tokenFailureHits: 0,
    unexpectedBlocked: [] as string[],
  };

  await page.route(
    (url) => url.pathname.includes("/auth/v1/token"),
    async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders() });
        return;
      }
      state.tokenFailureHits += 1;
      await fulfillJson(route, 400, mockInvalidCredentialsBody());
    },
  );

  await page.route(
    (url) => {
      const path = url.pathname;
      return path.includes("/auth/v1/") && !path.includes("/auth/v1/token");
    },
    async (route) => {
      state.unexpectedBlocked.push(
        `${route.request().method()} ${route.request().url()}`,
      );
      await route.abort("blockedbyclient");
    },
  );

  await page.route(
    (url) => url.pathname.includes("/rest/v1/"),
    async (route) => {
      state.unexpectedBlocked.push(
        `${route.request().method()} ${route.request().url()}`,
      );
      await route.abort("blockedbyclient");
    },
  );

  return {
    get tokenFailureHits() {
      return state.tokenFailureHits;
    },
    get unexpectedBlocked() {
      return state.unexpectedBlocked;
    },
    assertMockedFailureHandled() {
      expect(
        state.tokenFailureHits,
        "expected at least one mocked /auth/v1/token failure response",
      ).toBeGreaterThan(0);
      expect(
        state.unexpectedBlocked,
        "unexpected Auth or PostgREST request was attempted",
      ).toEqual([]);
    },
  };
}

/** Drive the real login form; Auth network is mocked by installMockedAuthAndCasesApi. */
export async function loginThroughMockedForm(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(MOCK_LOGIN_EMAIL);
  await page.getByLabel("비밀번호").fill(MOCK_LOGIN_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/cases\/?$/, { timeout: 15_000 });
}

export async function expectNoPageHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}

/** Synthetic case detail fixtures — not real DB rows. */
export type MockConsultation = {
  id: string;
  case_id: string;
  occurred_on: string;
  channel: "phone" | "visit" | "other";
  body: string;
  created_at: string;
};

export type MockAnalysis = {
  id: string;
  case_id: string;
  status: "processing" | "succeeded" | "failed";
  mode: "live" | "replay";
  created_at: string;
  completed_at: string | null;
  is_current: boolean;
};

export type MockCaseDetail = {
  case: MockCase;
  consultations: MockConsultation[];
  analyses: MockAnalysis[];
};

export const MOCK_CASE_ID = "00000000-0000-4000-8000-000000000101";

export function mockCaseShell(
  alias = "합성-001",
  id = MOCK_CASE_ID,
): MockCase {
  return {
    id,
    alias,
    created_at: "2026-10-01T03:00:00.000Z",
    consultation_count: 0,
  };
}

export function mockConsultation(
  partial: Partial<MockConsultation> &
    Pick<MockConsultation, "id" | "occurred_on" | "body">,
): MockConsultation {
  return {
    case_id: MOCK_CASE_ID,
    channel: "phone",
    created_at: `${partial.occurred_on}T04:00:00.000Z`,
    ...partial,
  };
}

export function buildMockDetail(options?: {
  consultations?: MockConsultation[];
  analyses?: MockAnalysis[];
  alias?: string;
}): MockCaseDetail {
  return {
    case: mockCaseShell(options?.alias),
    consultations: options?.consultations ?? [],
    analyses: options?.analyses ?? [],
  };
}

export type MockAnalysisDetail = {
  id: string;
  case_id: string;
  previous_note_id: string;
  current_note_id: string;
  status: MockAnalysis["status"];
  mode: MockAnalysis["mode"];
  schema_version: "1.0";
  model: string | null;
  result: {
    analysis: {
      schema_version: "1.0";
      summary: string;
      changes: Array<{
        domain: "meal" | "mobility" | "health" | "environment";
        status: "worsened" | "improved" | "unchanged" | "unknown";
        explanation: string;
        evidence_previous: { note_id: string; quote: string } | null;
        evidence_current: { note_id: string; quote: string } | null;
      }>;
      questions: string[];
    };
    recommendations: Array<{
      program_id: string;
      name: string;
      matched_domains: Array<"meal" | "mobility" | "health" | "environment">;
      summary: string;
      eligibility_status: "unverified";
      eligibility_checks: string[];
      region: string;
      source_url: string;
      source_checked_on: string;
      catalog_version: string;
    }>;
  } | null;
  failure_code: string | null;
  created_at: string;
  completed_at: string | null;
  is_current: boolean;
  review: {
    id: string;
    analysis_id: string;
    decision: "confirmed" | "needs_followup" | "rejected";
    note: string;
    created_at: string;
  } | null;
};

export type CaseDetailApiMock = {
  /** Mutable detail returned by GET; tests may update after mocked POST. */
  detail: MockCaseDetail | (() => MockCaseDetail);
  detailStatus?: number;
  detailError?: { code: string; message: string };
  postStatus?: number;
  postError?: { code: string; message: string };
  postHandler?: (payload: {
    occurred_on: string;
    channel: string;
    body: string;
  }) => { status: number; body: Record<string, unknown> };
  analysisDetail?: MockAnalysisDetail | (() => MockAnalysisDetail);
  createAnalysisHandler?: () => {
    status: number;
    body: Record<string, unknown>;
  };
  reviewHandler?: (payload: {
    decision: string;
    note: string;
  }) => { status: number; body: Record<string, unknown> };
};

/**
 * Auth + cases list + case detail GET + consultation POST.
 * Product code unchanged; PostgREST aborted.
 */
export async function installMockedAuthAndCaseDetailApi(
  page: Page,
  api: CaseDetailApiMock,
): Promise<void> {
  const caseRecord =
    typeof api.detail === "function" ? api.detail().case : api.detail.case;

  await installMockedAuthAndCasesApi(page, {
    list: [caseRecord],
  });

  await page.route(
    (url) => {
      const path = url.pathname;
      return (
        /^\/api\/cases\/[^/]+$/.test(path) ||
        /^\/api\/cases\/[^/]+\/consultations$/.test(path) ||
        /^\/api\/cases\/[^/]+\/analyses$/.test(path) ||
        /^\/api\/analyses\/[^/]+$/.test(path) ||
        /^\/api\/analyses\/[^/]+\/reviews$/.test(path)
      );
    },
    async (route) => {
      const method = route.request().method();
      const path = new URL(route.request().url()).pathname;

      if (method === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders() });
        return;
      }

      if (method === "POST" && /^\/api\/cases\/[^/]+\/analyses$/.test(path)) {
        if (api.createAnalysisHandler) {
          const result = api.createAnalysisHandler();
          await fulfillJson(route, result.status, result.body);
          return;
        }
        await fulfillJson(route, 503, {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "mock analysis create not configured",
            request_id: "mock-request-analysis",
            details: {},
          },
        });
        return;
      }

      if (method === "GET" && /^\/api\/analyses\/[^/]+$/.test(path)) {
        if (api.analysisDetail) {
          const data =
            typeof api.analysisDetail === "function"
              ? api.analysisDetail()
              : api.analysisDetail;
          await fulfillJson(route, 200, {
            data,
            meta: { request_id: "mock-request-analysis-get" },
          });
          return;
        }
        await fulfillJson(route, 404, {
          error: {
            code: "NOT_FOUND",
            message: "not found",
            request_id: "mock-request-analysis-get",
            details: {},
          },
        });
        return;
      }

      if (method === "POST" && /^\/api\/analyses\/[^/]+\/reviews$/.test(path)) {
        const raw = route.request().postDataJSON() as {
          decision?: string;
          note?: string;
        } | null;
        if (api.reviewHandler) {
          const result = api.reviewHandler({
            decision: raw?.decision ?? "",
            note: raw?.note ?? "",
          });
          await fulfillJson(route, result.status, result.body);
          return;
        }
        await fulfillJson(route, 503, {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "mock review not configured",
            request_id: "mock-request-review",
            details: {},
          },
        });
        return;
      }

      if (method === "GET" && /^\/api\/cases\/[^/]+$/.test(path)) {
        if (api.detailError) {
          await fulfillJson(route, api.detailStatus ?? 404, {
            error: {
              code: api.detailError.code,
              message: api.detailError.message,
              request_id: "mock-request-detail",
              details: {},
            },
          });
          return;
        }
        const data = typeof api.detail === "function" ? api.detail() : api.detail;
        await fulfillJson(route, 200, {
          data,
          meta: { request_id: "mock-request-detail" },
        });
        return;
      }

      if (
        method === "POST" &&
        /^\/api\/cases\/[^/]+\/consultations$/.test(path)
      ) {
        const raw = route.request().postDataJSON() as {
          occurred_on?: string;
          channel?: string;
          body?: string;
        } | null;
        const payload = {
          occurred_on: raw?.occurred_on ?? "",
          channel: raw?.channel ?? "phone",
          body: raw?.body ?? "",
        };
        if (api.postHandler) {
          const result = api.postHandler(payload);
          await fulfillJson(route, result.status, result.body);
          return;
        }
        if (api.postError) {
          await fulfillJson(route, api.postStatus ?? 409, {
            error: {
              code: api.postError.code,
              message: api.postError.message,
              request_id: "mock-request-consult",
              details: {},
            },
          });
          return;
        }
        await fulfillJson(route, 201, {
          data: mockConsultation({
            id: "00000000-0000-4000-8000-00000000c001",
            occurred_on: payload.occurred_on || "2026-10-11",
            channel: payload.channel as MockConsultation["channel"],
            body: payload.body,
          }),
          meta: { request_id: "mock-request-consult" },
        });
        return;
      }

      await route.fulfill({ status: 405, headers: corsHeaders() });
    },
  );
}

export async function openMockedCaseDetail(
  page: Page,
  api: CaseDetailApiMock,
): Promise<void> {
  await installMockedAuthAndCaseDetailApi(page, api);
  await loginThroughMockedForm(page);
  const detail =
    typeof api.detail === "function" ? api.detail() : api.detail;
  // Client navigation only — full page.goto would clear the memory session.
  await page
    .getByRole("link", { name: new RegExp(detail.case.alias) })
    .first()
    .click();
  await page.waitForURL(new RegExp(`/cases/${detail.case.id}/?$`), {
    timeout: 15_000,
  });
  await expect(
    page
      .getByRole("heading", { name: detail.case.alias, level: 1 })
      .or(page.getByText("사례를 불러오지 못했습니다")),
  ).toBeVisible({ timeout: 15_000 });
}
