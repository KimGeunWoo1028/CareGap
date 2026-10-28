import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareRateCards,
  estimateLivePilotCost,
  DEFAULT_PILOT_RATE_CARD,
  LEGACY_PLACEHOLDER_RATE_CARD,
} from "@/lib/eval/live-cost";
import {
  LIVE_SMOKE_CASE_IDS,
  selectLiveSmokeCases,
} from "@/lib/eval/smoke-select";
import type { PilotManifest } from "@/lib/eval/pilot-select";

describe("live smoke cohort and official rate card", () => {
  const parent = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "fixtures/eval/live-pilot.v1.manifest.json"),
      "utf8",
    ),
  ) as PilotManifest;

  it("selects 5 Dev/Val approved cases covering all statuses", () => {
    const smoke = selectLiveSmokeCases(parent);
    expect(smoke.cases).toHaveLength(5);
    expect(smoke.test_split_used).toBe(false);
    expect(smoke.model_id).toBe("gpt-5.4-mini-2026-03-17");
    expect(smoke.hard_max_usd).toBe(1);
    expect(smoke.max_calls_including_retries).toBe(10);
    expect(smoke.cases.map((c) => c.case_id)).toEqual([...LIVE_SMOKE_CASE_IDS]);
    expect(smoke.cases.every((c) => c.label_approved_for_scoring)).toBe(true);
    const statuses = new Set(
      smoke.cases.flatMap((c) => Object.values(c.expected_status)),
    );
    for (const s of ["worsened", "improved", "unchanged", "unknown"]) {
      expect(statuses.has(s as never)).toBe(true);
    }
  });

  it("matches committed live-smoke.v1.manifest.json when present", () => {
    const committed = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "fixtures/eval/live-smoke.v1.manifest.json"),
        "utf8",
      ),
    );
    const fresh = selectLiveSmokeCases(parent);
    expect(fresh.cases.map((c) => c.case_id)).toEqual(
      committed.cases.map((c: { case_id: string }) => c.case_id),
    );
  });

  it("uses official rates and stays under $1 for 5×2 calls", () => {
    expect(DEFAULT_PILOT_RATE_CARD.input_usd_per_1m_tokens).toBe(0.75);
    expect(DEFAULT_PILOT_RATE_CARD.output_usd_per_1m_tokens).toBe(4.5);
    const cmp = compareRateCards();
    expect(cmp.input_multiplier).toBe(3);
    expect(cmp.output_multiplier).toBe(2.25);
    expect(LEGACY_PLACEHOLDER_RATE_CARD.input_usd_per_1m_tokens).toBe(0.25);

    const est = estimateLivePilotCost({
      cases: 5,
      max_attempts_per_case: 2,
      hard_max_usd: 1,
    });
    expect(est.estimated_calls_including_retries).toBe(10);
    expect(est.estimated_usd).toBeCloseTo(0.045, 5);
    expect(est.within_hard_max).toBe(true);
  });
});
