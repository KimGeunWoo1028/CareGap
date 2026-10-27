/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { AnalysisResultPanel } from "@/components/analysis/analysis-result-panel";
import type { AnalysisDetail, ConsultationRecord } from "@/lib/cases/types";

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

const consultations: ConsultationRecord[] = [
  {
    id: "prev",
    case_id: "case",
    occurred_on: "2026-09-10",
    channel: "phone",
    body: "이전 원문 식사 양호",
    created_at: "2026-09-10T01:00:00.000Z",
  },
  {
    id: "curr",
    case_id: "case",
    occurred_on: "2026-10-10",
    channel: "visit",
    body: "현재 원문 식사 거름",
    created_at: "2026-10-10T01:00:00.000Z",
  },
];

function detail(overrides?: Partial<AnalysisDetail>): AnalysisDetail {
  return {
    id: "an-1",
    case_id: "case",
    previous_note_id: "prev",
    current_note_id: "curr",
    status: "succeeded",
    mode: "replay",
    schema_version: "1.0",
    model: null,
    result: {
      analysis: {
        schema_version: "1.0",
        summary: "요약 문장",
        changes: [
          {
            domain: "meal",
            status: "worsened",
            explanation: "식사 악화 설명",
            evidence_previous: { note_id: "prev", quote: "식사 양호" },
            evidence_current: { note_id: "curr", quote: "식사 거름" },
          },
          {
            domain: "mobility",
            status: "unchanged",
            explanation: "거동 변화 없음",
            evidence_previous: null,
            evidence_current: null,
          },
          {
            domain: "health",
            status: "unknown",
            explanation: "건강 정보 부족",
            evidence_previous: null,
            evidence_current: null,
          },
          {
            domain: "environment",
            status: "improved",
            explanation: "환경 개선",
            evidence_previous: null,
            evidence_current: null,
          },
        ],
        questions: ["추가 확인 질문 A"],
      },
      recommendations: [],
    },
    failure_code: null,
    created_at: "2026-10-11T00:00:00.000Z",
    completed_at: "2026-10-11T00:00:01.000Z",
    is_current: true,
    review: null,
    ...overrides,
  };
}

describe("AnalysisResultPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it("renders replay banner, domains, evidence, empty candidates, and review form", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const onSubmit = vi.fn();
    root.render(
      <AnalysisResultPanel
        analysis={detail()}
        consultations={consultations}
        onSubmitReview={onSubmit}
      />,
    );
    await waitFor(() => container.textContent?.includes("요약 문장") === true);
    expect(container.textContent).toContain("사전 준비된 시연 결과");
    expect(container.textContent).toContain("악화 기록");
    expect(container.textContent).toContain("정보 부족");
    expect(container.textContent).toContain("식사 양호");
    expect(container.textContent).toContain("추가 확인 질문 A");
    expect(container.textContent).toContain("확인할 사업 후보가 없습니다");
    expect(container.textContent).not.toContain("수급 가능 확정");
    expect(container.querySelector("button")?.textContent).toContain("검토 저장");
  });

  it("warns on previous analysis and shows readonly review", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    root.render(
      <AnalysisResultPanel
        analysis={detail({
          is_current: false,
          review: {
            id: "r1",
            analysis_id: "an-1",
            decision: "confirmed",
            note: "확인 메모",
            created_at: "2026-10-11T00:10:00.000Z",
          },
        })}
        consultations={consultations}
      />,
    );
    await waitFor(() => container.textContent?.includes("이전 분석") === true);
    expect(container.textContent).toContain("확인함");
    expect(container.textContent).toContain("확인 메모");
    expect(container.querySelector("button")).toBeNull();
  });
});
