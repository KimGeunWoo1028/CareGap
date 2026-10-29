/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { AnalysisReviewForm } from "@/components/analysis/analysis-review-form";

function waitFor(predicate: () => boolean, ms = 2000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) resolve();
      else if (Date.now() - start > ms) reject(new Error("waitFor timeout"));
      else setTimeout(tick, 20);
    };
    tick();
  });
}

describe("AnalysisReviewForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it("does not submit until a decision is explicitly selected", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const onSubmit = vi.fn();
    root.render(<AnalysisReviewForm onSubmit={onSubmit} />);
    await waitFor(() => container.querySelector("form") != null);

    (container.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await waitFor(
      () => container.textContent?.includes("검토 결정을 선택") === true,
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires a note when rejected before calling onSubmit", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const onSubmit = vi.fn();
    root.render(<AnalysisReviewForm onSubmit={onSubmit} />);
    await waitFor(() => container.querySelector("form") != null);

    const rejected = Array.from(
      container.querySelectorAll('input[type="radio"]'),
    ).find(
      (el) => (el as HTMLInputElement).value === "rejected",
    ) as HTMLInputElement;
    rejected.click();
    (container.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await waitFor(() => container.textContent?.includes("사유를 입력") === true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits needs_followup only after explicit choice", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const onSubmit = vi.fn(async () => undefined);
    root.render(<AnalysisReviewForm onSubmit={onSubmit} />);
    await waitFor(() => container.querySelector("textarea") != null);

    const follow = Array.from(
      container.querySelectorAll('input[type="radio"]'),
    ).find(
      (el) => (el as HTMLInputElement).value === "needs_followup",
    ) as HTMLInputElement;
    follow.click();

    const note = container.querySelector("textarea") as HTMLTextAreaElement;
    const proto = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    );
    proto?.set?.call(note, "추가 확인 예정");
    note.dispatchEvent(new Event("input", { bubbles: true }));

    (container.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await waitFor(() => onSubmit.mock.calls.length > 0);
    expect(onSubmit).toHaveBeenCalledWith("needs_followup", "추가 확인 예정");
  });
});
