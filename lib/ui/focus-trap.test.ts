/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { listFocusable, trapTabKey } from "@/lib/ui/focus-trap";

describe("focus-trap", () => {
  it("lists enabled focusable controls", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button type="button">a</button>
      <button type="button" disabled>b</button>
      <input />
      <a href="#x">c</a>
    `;
    document.body.appendChild(root);
    expect(listFocusable(root).map((el) => el.tagName)).toEqual([
      "BUTTON",
      "INPUT",
      "A",
    ]);
    root.remove();
  });

  it("cycles Tab from last to first and Shift+Tab from first to last", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button type="button" id="first">first</button>
      <button type="button" id="last">last</button>
    `;
    document.body.appendChild(root);
    const first = root.querySelector<HTMLElement>("#first")!;
    const last = root.querySelector<HTMLElement>("#last")!;
    last.focus();
    const tab = {
      key: "Tab",
      shiftKey: false,
      preventDefault: vi.fn(),
    };
    trapTabKey(tab, root);
    expect(tab.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(first);

    first.focus();
    const shift = {
      key: "Tab",
      shiftKey: true,
      preventDefault: vi.fn(),
    };
    trapTabKey(shift, root);
    expect(shift.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(last);
    root.remove();
  });
});
