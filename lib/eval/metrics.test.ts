import { describe, expect, it } from "vitest";
import {
  collectObservations,
  computeCitationMetrics,
  computeStatusMetrics,
} from "@/lib/eval/metrics";

describe("computeStatusMetrics", () => {
  it("scores perfect agreement", () => {
    const obs = collectObservations([
      {
        case_id: "a",
        gold: {
          meal: "worsened",
          mobility: "unknown",
          health: "unknown",
          environment: "unknown",
        },
        pred: {
          meal: "worsened",
          mobility: "unknown",
          health: "unknown",
          environment: "unknown",
        },
      },
    ]);
    const m = computeStatusMetrics(obs);
    expect(m.overall_status_accuracy).toBe(1);
    expect(m.missed_worsening_rate).toBe(0);
    expect(m.false_reassurance_rate).toBe(0);
  });

  it("detects missed worsening and false reassurance", () => {
    const obs = collectObservations([
      {
        case_id: "miss",
        gold: {
          meal: "worsened",
          mobility: "unknown",
          health: "unknown",
          environment: "unknown",
        },
        pred: {
          meal: "unchanged",
          mobility: "unknown",
          health: "unknown",
          environment: "unknown",
        },
      },
    ]);
    const m = computeStatusMetrics(obs);
    expect(m.missed_worsening_rate).toBe(1);
    expect(m.false_reassurance_rate).toBe(1);
  });

  it("detects false worsening", () => {
    const obs = collectObservations([
      {
        case_id: "fw",
        gold: {
          meal: "unchanged",
          mobility: "unknown",
          health: "unknown",
          environment: "unknown",
        },
        pred: {
          meal: "worsened",
          mobility: "unknown",
          health: "unknown",
          environment: "unknown",
        },
      },
    ]);
    const m = computeStatusMetrics(obs);
    expect(m.false_worsening_rate).not.toBe("N/A");
    expect(m.false_worsening_rate as number).toBeGreaterThan(0);
  });

  it("returns N/A when worsened support is zero", () => {
    const obs = collectObservations([
      {
        case_id: "none",
        gold: {
          meal: "unknown",
          mobility: "unknown",
          health: "unknown",
          environment: "unknown",
        },
        pred: {
          meal: "unknown",
          mobility: "unknown",
          health: "unknown",
          environment: "unknown",
        },
      },
    ]);
    const m = computeStatusMetrics(obs);
    expect(m.worsened_recall).toBe("N/A");
    expect(m.missed_worsening_rate).toBe("N/A");
    expect(m.false_reassurance_rate).toBe("N/A");
  });

  it("never auto-passes semantic citation review", () => {
    const c = computeCitationMetrics([
      {
        case_id: "c1",
        domain: "meal",
        side: "previous",
        quote: "식사",
        note_id: "n1",
        expected_note_id: "n1",
      },
    ]);
    expect(c.citation_presence_rate).toBe(1);
    expect(c.semantic_citation_review_items).toBe(1);
  });
});
