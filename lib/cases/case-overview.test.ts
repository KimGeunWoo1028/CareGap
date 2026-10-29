import { describe, expect, it } from "vitest";
import { buildCaseOverview } from "@/lib/cases/case-overview";
import type { CaseDetail } from "@/lib/cases/types";

const baseDetail: CaseDetail = {
  case: {
    id: "c1",
    alias: "합성-010",
    created_at: "2026-10-01T00:00:00.000Z",
    consultation_count: 2,
  },
  consultations: [
    {
      id: "n2",
      case_id: "c1",
      occurred_on: "2026-10-10",
      channel: "phone",
      body: "현재",
      created_at: "2026-10-10T01:00:00.000Z",
    },
    {
      id: "n1",
      case_id: "c1",
      occurred_on: "2026-09-10",
      channel: "phone",
      body: "이전",
      created_at: "2026-09-10T01:00:00.000Z",
    },
  ],
  analyses: [
    {
      id: "a1",
      case_id: "c1",
      status: "succeeded",
      mode: "replay",
      created_at: "2026-10-11T00:00:00.000Z",
      completed_at: "2026-10-11T00:01:00.000Z",
      is_current: true,
    },
  ],
};

describe("buildCaseOverview", () => {
  it("summarizes consultation and analysis readiness", () => {
    const snap = buildCaseOverview(baseDetail, null, true);
    expect(snap.alias).toBe("합성-010");
    expect(snap.consultationCount).toBe(2);
    expect(snap.latestConsultationOn).toBe("2026-10-10");
    expect(snap.latestAnalysisStatusLabel).toBe("성공");
    expect(snap.compareReady).toBe(true);
  });

  it("labels pending review when selected analysis succeeded without review", () => {
    const selected = {
      id: "a1",
      case_id: "c1",
      previous_note_id: "n1",
      current_note_id: "n2",
      status: "succeeded" as const,
      mode: "replay" as const,
      schema_version: "1.0" as const,
      model: null,
      result: null,
      failure_code: null,
      created_at: "2026-10-11T00:00:00.000Z",
      completed_at: "2026-10-11T00:01:00.000Z",
      is_current: true,
      review: null,
    };
    expect(buildCaseOverview(baseDetail, selected, true).reviewStatusLabel).toBe(
      "검토 대기",
    );
  });
});
