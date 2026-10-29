/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { readQueryParam, writeQueryParam } from "@/lib/url-state";

describe("url-state", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/cases");
  });

  it("writes and reads query params without personal payloads", () => {
    writeQueryParam("q", "합성-001");
    expect(readQueryParam("q")).toBe("합성-001");
    writeQueryParam("q", null);
    expect(readQueryParam("q")).toBeNull();
  });

  it("omits default filter values from the URL", () => {
    writeQueryParam("status", "open", { defaultValue: "open" });
    expect(window.location.search).not.toContain("status=");
    writeQueryParam("status", "all", { defaultValue: "open" });
    expect(readQueryParam("status")).toBe("all");
  });
});
