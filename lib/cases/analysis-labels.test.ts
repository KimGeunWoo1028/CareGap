import { describe, expect, it } from "vitest";
import {
  analysisModeBanner,
  changeStatusLabel,
  domainLabel,
} from "@/lib/cases/analysis-labels";
import { computeIsCurrent } from "@/lib/cases/is-current";
import { userMessageForApiError } from "@/lib/api/client";

describe("analysis labels and T06 is_current unit", () => {
  it("maps domains and statuses for UI without treating unknown as safe", () => {
    expect(domainLabel("meal")).toBe("식사");
    expect(changeStatusLabel("unknown")).toBe("정보 부족");
    expect(changeStatusLabel("unchanged")).toBe("변화 없음");
    expect(analysisModeBanner("replay")).toContain("시연");
    expect(analysisModeBanner("live")).toContain("실시간");
  });

  it("T06 unit: third newer note marks prior pair as not current", () => {
    expect(
      computeIsCurrent(["n3", "n2", "n1"], {
        previous_note_id: "n1",
        current_note_id: "n2",
      }),
    ).toBe(false);
  });

  it("surfaces distinct analysis error copy", () => {
    expect(
      userMessageForApiError({
        ok: false,
        status: 422,
        code: "REPLAY_UNAVAILABLE",
        message: "",
        details: {},
        requestId: null,
      }),
    ).toContain("시연");
    expect(
      userMessageForApiError({
        ok: false,
        status: 502,
        code: "INVALID_AI_OUTPUT",
        message: "",
        details: {},
        requestId: null,
      }),
    ).toContain("근거");
  });
});
