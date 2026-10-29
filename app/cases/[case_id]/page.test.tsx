/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { CaseDetailInner } from "@/app/cases/[case_id]/page";
import type { CaseDetail } from "@/lib/cases/types";

const push = vi.fn();
const replace = vi.fn();
const clearSession = vi.fn();
const signOut = vi.fn(async () => undefined);
const apiRequest = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useParams: () => ({ case_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
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
  userMessageForApiError: (failure: {
    message: string;
    code: string;
    status?: number;
  }) => {
    if (failure.code === "DUPLICATE_DATE") {
      return "같은 날짜의 상담 기록이 이미 있습니다.";
    }
    if (failure.code === "NOT_FOUND") {
      return "요청한 자료를 찾을 수 없거나 접근할 수 없습니다.";
    }
    if (failure.code === "UNAUTHENTICATED") {
      return "세션이 만료되었습니다. 다시 로그인해 주세요.";
    }
    return failure.message || "일시적인 오류가 발생했습니다.";
  },
}));

function sampleDetail(overrides?: Partial<CaseDetail>): CaseDetail {
  return {
    case: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      alias: "합성-001",
      created_at: "2026-10-01T00:00:00.000Z",
      consultation_count: 0,
    },
    consultations: [],
    analyses: [],
    ...overrides,
  };
}

function setInputValue(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const proto =
    input instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
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

describe("CaseDetailInner", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      false;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    apiRequest.mockReset();
    push.mockReset();
    replace.mockReset();
    clearSession.mockReset();
    signOut.mockReset();
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it("shows distinct guidance for 0 and 1 consultation", async () => {
    apiRequest.mockResolvedValue({
      ok: true,
      data: sampleDetail(),
      status: 200,
      requestId: null,
    });
    root.render(<CaseDetailInner />);
    await waitFor(() =>
      container.textContent?.includes("비교할 기록이 없습니다") === true,
    );
    expect(container.textContent).toContain("첫 기록을 저장");

    apiRequest.mockResolvedValue({
      ok: true,
      data: sampleDetail({
        consultations: [
          {
            id: "n1",
            case_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            occurred_on: "2026-10-10",
            channel: "visit",
            body: "한 건만 있음",
            created_at: "2026-10-10T01:00:00.000Z",
          },
        ],
      }),
      status: 200,
      requestId: null,
    });
    root.render(<CaseDetailInner />);
    await waitFor(() =>
      container.textContent?.includes("한 건 더 필요") === true,
    );
    expect(container.textContent).toContain("다른 상담 날짜");
  });

  it("renders previous then current labels for two notes", async () => {
    apiRequest.mockResolvedValue({
      ok: true,
      data: sampleDetail({
        consultations: [
          {
            id: "n2",
            case_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            occurred_on: "2026-10-10",
            channel: "phone",
            body: "현재 원문",
            created_at: "2026-10-10T01:00:00.000Z",
          },
          {
            id: "n1",
            case_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            occurred_on: "2026-09-10",
            channel: "phone",
            body: "이전 원문",
            created_at: "2026-09-10T01:00:00.000Z",
          },
        ],
      }),
      status: 200,
      requestId: null,
    });
    root.render(<CaseDetailInner />);
    await waitFor(() => container.textContent?.includes("현재 원문") === true);
    expect(container.textContent).toContain("이전 상담");
    expect(container.textContent).toContain("현재(최신) 상담");
    const analyze = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("새 분석"),
    ) as HTMLButtonElement;
    expect(analyze).toBeTruthy();
    expect(analyze.disabled).toBe(false);
  });

  it("keeps body on duplicate-date failure and marks the date field", async () => {
    apiRequest.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === "POST") {
        return {
          ok: false,
          status: 409,
          code: "DUPLICATE_DATE",
          message: "duplicate",
          details: {},
          requestId: null,
        };
      }
      return {
        ok: true,
        data: sampleDetail(),
        status: 200,
        requestId: null,
      };
    });
    root.render(<CaseDetailInner />);
    await waitFor(() => container.querySelector("#body") != null);

    const body = container.querySelector("#body") as HTMLTextAreaElement;
    setInputValue(body, "합성 원문을 유지해야 합니다.");
    const form = container.querySelector("form") as HTMLFormElement;
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );

    await waitFor(() =>
      container.textContent?.includes("같은 날짜의 상담 기록") === true,
    );
    expect((container.querySelector("#body") as HTMLTextAreaElement).value).toBe(
      "합성 원문을 유지해야 합니다.",
    );
    expect(
      (container.querySelector("#occurred_on") as HTMLInputElement).getAttribute(
        "aria-invalid",
      ),
    ).toBe("true");
  });

  it("clears body only after a successful save and reload", async () => {
    let consultations: CaseDetail["consultations"] = [];
    apiRequest.mockImplementation(async (path: string, options?: { method?: string; body?: { body: string; occurred_on: string; channel: string } }) => {
      if (options?.method === "POST") {
        consultations = [
          {
            id: "n-new",
            case_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            occurred_on: options.body!.occurred_on,
            channel: options.body!.channel as "phone",
            body: options.body!.body,
            created_at: "2026-10-11T01:00:00.000Z",
          },
        ];
        return {
          ok: true,
          data: consultations[0],
          status: 201,
          requestId: null,
        };
      }
      return {
        ok: true,
        data: sampleDetail({ consultations }),
        status: 200,
        requestId: null,
      };
    });
    root.render(<CaseDetailInner />);
    await waitFor(() => container.querySelector("#body") != null);
    setInputValue(
      container.querySelector("#body") as HTMLTextAreaElement,
      "저장될 합성 원문",
    );
    (container.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await waitFor(() =>
      container.textContent?.includes("합성 기록을 저장했습니다.") === true,
    );
    expect((container.querySelector("#body") as HTMLTextAreaElement).value).toBe(
      "",
    );
    expect(container.textContent).toContain("저장될 합성 원문");
  });

  it("marks stale analyses and keeps 404 opaque", async () => {
    apiRequest.mockResolvedValue({
      ok: true,
      data: sampleDetail({
        analyses: [
          {
            id: "an-1",
            case_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            status: "succeeded",
            mode: "live",
            created_at: "2026-09-01T00:00:00.000Z",
            completed_at: "2026-09-01T00:01:00.000Z",
            is_current: false,
          },
        ],
      }),
      status: 200,
      requestId: null,
    });
    root.render(<CaseDetailInner />);
    await waitFor(() =>
      container.textContent?.includes("이전 분석") === true,
    );

    apiRequest.mockResolvedValue({
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      message: "hidden",
      details: {},
      requestId: null,
    });
    root.render(<CaseDetailInner />);
    await waitFor(() =>
      container.textContent?.includes("찾을 수 없거나 접근할 수 없습니다") ===
        true,
    );
    expect(container.textContent).not.toContain("소유");
  });

  it("rejects whitespace-only body client-side without clearing", async () => {
    apiRequest.mockResolvedValue({
      ok: true,
      data: sampleDetail(),
      status: 200,
      requestId: null,
    });
    root.render(<CaseDetailInner />);
    await waitFor(() => container.querySelector("#body") != null);
    setInputValue(
      container.querySelector("#body") as HTMLTextAreaElement,
      "   \n  ",
    );
    (container.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await waitFor(() =>
      container.textContent?.includes("공백만 있는 원문") === true,
    );
    expect(apiRequest.mock.calls.some((c) => c[1]?.method === "POST")).toBe(
      false,
    );
    expect((container.querySelector("#body") as HTMLTextAreaElement).value).toBe(
      "   \n  ",
    );
  });
});
