/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { CasesPageInner } from "@/app/cases/page";

const push = vi.fn();
const replace = vi.fn();
const clearSession = vi.fn();
const signOut = vi.fn(async () => undefined);
const apiRequest = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth/session-context", () => ({
  useAuthSession: () => ({
    accessToken: "test-token",
    clearSession,
    signOut,
    user: { email: "caseworker@example.invalid" },
  }),
}));

vi.mock("@/lib/api/client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  userMessageForApiError: (failure: { message: string; code: string }) => {
    if (failure.code === "DUPLICATE_ALIAS") return "같은 별칭이 있습니다.";
    return failure.message;
  },
}));

function sampleCases() {
  return [
    {
      id: "case-1",
      alias: "합성-001",
      created_at: "2026-10-10T01:00:00.000Z",
    },
    {
      id: "case-2",
      alias: "합성-007",
      created_at: "2026-10-09T01:00:00.000Z",
    },
  ];
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 2000,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error("waitFor timed out");
}

function mockListOk(data: ReturnType<typeof sampleCases> | []) {
  apiRequest.mockImplementation(async (_path: string, options?: { method?: string }) => {
    if (options?.method === "POST") {
      throw new Error("unexpected POST in this test");
    }
    return { ok: true, data, status: 200, requestId: null };
  });
}

describe("CasesPageInner", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    push.mockReset();
    replace.mockReset();
    clearSession.mockReset();
    signOut.mockReset();
    apiRequest.mockReset();
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it("shows empty state when the loaded list has zero cases", async () => {
    mockListOk([]);
    root.render(<CasesPageInner />);
    await waitFor(() =>
      (container.textContent ?? "").includes("아직 등록된 합성 사례가 없습니다."),
    );
    expect(container.querySelector(".case-table")).toBeNull();
  });

  it("renders loaded cases and filters locally by alias", async () => {
    mockListOk(sampleCases());
    root.render(<CasesPageInner />);
    await waitFor(() => (container.textContent ?? "").includes("합성-007"));

    expect(container.textContent).toContain("현재 불러온 사례에서 검색");
    expect(container.textContent).toContain("최대 100건");

    const search = container.querySelector("#case-search") as HTMLInputElement;
    setInputValue(search, "007");
    await waitFor(() => {
      const aliases = Array.from(
        container.querySelectorAll(".case-table tbody a"),
      ).map((a) => a.textContent ?? "");
      return (
        aliases.some((t) => t.startsWith("합성-007")) &&
        !aliases.some((t) => t.startsWith("합성-001"))
      );
    });
    expect(container.textContent).toContain("표시 중 1건");
  });

  it("keeps the query and offers clear when search matches nothing", async () => {
    mockListOk(sampleCases());
    root.render(<CasesPageInner />);
    await waitFor(() => (container.textContent ?? "").includes("합성-001"));

    const search = container.querySelector("#case-search") as HTMLInputElement;
    setInputValue(search, "합성-999");
    await waitFor(() =>
      (container.textContent ?? "").includes("일치하는 사례가 없습니다."),
    );
    expect(search.value).toBe("합성-999");

    const clear = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("검색어 지우기"),
    ) as HTMLButtonElement;
    clear.click();
    await waitFor(() => (container.textContent ?? "").includes("합성-001"));
    expect(search.value).toBe("");
  });

  it("shows list fetch failures separately from empty lists", async () => {
    apiRequest.mockImplementation(async () => ({
      ok: false,
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message:
        "일시적으로 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      details: {},
      requestId: null,
    }));
    root.render(<CasesPageInner />);
    await waitFor(() =>
      (container.textContent ?? "").includes("목록을 불러오지 못했습니다"),
    );
    expect(container.textContent).not.toContain(
      "아직 등록된 합성 사례가 없습니다.",
    );
  });

  it("validates alias format without calling create", async () => {
    mockListOk([]);
    root.render(<CasesPageInner />);
    await waitFor(() =>
      (container.textContent ?? "").includes("아직 등록된 합성 사례가 없습니다."),
    );

    const open = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "사례 추가",
    ) as HTMLButtonElement;
    open.click();
    await waitFor(() => Boolean(container.querySelector("#alias")));

    const alias = container.querySelector("#alias") as HTMLInputElement;
    setInputValue(alias, "잘못된별칭");
    const submit = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("사례 만들기"),
    ) as HTMLButtonElement;
    submit.click();
    await waitFor(() =>
      (container.textContent ?? "").includes(
        "별칭은 합성-001 형식으로 입력해 주세요.",
      ),
    );
    expect(
      apiRequest.mock.calls.filter((call) => call[1]?.method === "POST"),
    ).toHaveLength(0);
  });

  it("keeps the alias on duplicate create and does not navigate", async () => {
    apiRequest.mockImplementation(async (_path: string, options?: { method?: string }) => {
      if (options?.method === "POST") {
        return {
          ok: false,
          status: 409,
          code: "DUPLICATE_ALIAS",
          message: "같은 별칭이 있습니다.",
          details: {},
          requestId: null,
        };
      }
      return { ok: true, data: [], status: 200, requestId: null };
    });
    root.render(<CasesPageInner />);
    await waitFor(() =>
      (container.textContent ?? "").includes("아직 등록된 합성 사례가 없습니다."),
    );

    const open = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "사례 추가",
    ) as HTMLButtonElement;
    open.click();
    await waitFor(() => Boolean(container.querySelector("#alias")));

    const alias = container.querySelector("#alias") as HTMLInputElement;
    setInputValue(alias, "합성-001");
    const submit = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("사례 만들기"),
    ) as HTMLButtonElement;
    submit.click();
    await waitFor(() =>
      (container.textContent ?? "").includes("같은 별칭이 있습니다."),
    );
    expect(alias.value).toBe("합성-001");
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates to the created case detail after a real successful POST", async () => {
    apiRequest.mockImplementation(async (_path: string, options?: { method?: string }) => {
      if (options?.method === "POST") {
        return {
          ok: true,
          status: 201,
          requestId: null,
          data: {
            id: "new-case",
            alias: "합성-003",
            created_at: "2026-10-11T00:00:00.000Z",
          },
        };
      }
      return { ok: true, data: [], status: 200, requestId: null };
    });
    root.render(<CasesPageInner />);
    await waitFor(() =>
      (container.textContent ?? "").includes("아직 등록된 합성 사례가 없습니다."),
    );

    const open = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "사례 추가",
    ) as HTMLButtonElement;
    open.click();
    await waitFor(() => Boolean(container.querySelector("#alias")));

    const alias = container.querySelector("#alias") as HTMLInputElement;
    setInputValue(alias, "합성-003");
    const submit = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("사례 만들기"),
    ) as HTMLButtonElement;
    submit.click();
    await waitFor(() => push.mock.calls.length > 0);
    expect(apiRequest).toHaveBeenCalledWith("/api/cases", {
      method: "POST",
      token: "test-token",
      body: { alias: "합성-003" },
    });
    expect(push).toHaveBeenCalledWith("/cases/new-case");
  });

  it("clears the session and routes to login on 401 list fetch", async () => {
    apiRequest.mockImplementation(async () => ({
      ok: false,
      status: 401,
      code: "UNAUTHENTICATED",
      message: "세션이 만료되었습니다. 다시 로그인해 주세요.",
      details: {},
      requestId: null,
    }));
    root.render(<CasesPageInner />);
    await waitFor(() => replace.mock.calls.some((call) => call[0] === "/login"));
    expect(clearSession).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
  });

  it("exposes name and arrow links to the same case detail per row", async () => {
    mockListOk(sampleCases());
    root.render(<CasesPageInner />);
    await waitFor(
      () => container.querySelectorAll(".case-table tbody a").length === 4,
    );

    const row = container.querySelector(".case-table tbody tr") as HTMLElement;
    const links = row.querySelectorAll("a");
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe("/cases/case-1");
    expect(links[0].textContent).toContain("등록일");
    expect(links[0].textContent).toContain("상세 열기");
    expect(links[1].getAttribute("href")).toBe("/cases/case-1");
    expect(links[1].getAttribute("aria-label")).toContain("행 상세 열기");
    expect(row.querySelector(".case-table__chevron")?.getAttribute("aria-hidden")).toBeNull();
  });
});
