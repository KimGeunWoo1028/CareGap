import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertWithinCostGuard,
  estimateLivePilotCost,
} from "@/lib/eval/live-cost";
import {
  checkLivePilotGates,
  runLivePilotDryRun,
  runLivePilotLive,
} from "@/lib/eval/live-pilot";

const ROOT = process.cwd();
const MANIFEST = resolve(ROOT, "fixtures/eval/live-pilot.v1.manifest.json");
const DATASET = resolve(ROOT, "fixtures/eval/dataset.v1.json");

describe("live pilot cost and gates", () => {
  it("estimates cost below hard max for 30-case pilot", () => {
    const est = estimateLivePilotCost({ cases: 30, hard_max_usd: 5 });
    expect(est.estimated_calls_including_retries).toBe(60);
    expect(est.within_hard_max).toBe(true);
    expect(est.estimate_vs_invoice_note).toMatch(/not the OpenAI invoice/i);
  });

  it("enforces cost guard before next call", () => {
    expect(() =>
      assertWithinCostGuard(
        {
          hard_max_usd: 1,
          spent_usd_estimate: 0.95,
          calls_made: 1,
          max_calls: 10,
        },
        0.1,
      ),
    ).toThrow(/hard_max_usd/);
  });

  it("blocks live mode without opt-in, approval, and key", () => {
    const gate = checkLivePilotGates({
      mode: "live",
      explicitApproval: false,
      caseCount: 30,
      hardMaxUsd: 5,
      env: {},
    });
    expect(gate.ok).toBe(false);
    expect(gate.blockers.length).toBeGreaterThanOrEqual(3);
  });

  it("allows dry-run gates without opt-in", () => {
    const gate = checkLivePilotGates({
      mode: "dry-run",
      explicitApproval: false,
      caseCount: 30,
      hardMaxUsd: 5,
      env: {},
    });
    expect(gate.ok).toBe(true);
    expect(gate.blockers).toEqual([]);
  });
});

describe("live pilot dry-run runner", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it("writes dry-run artifacts without live calls or metrics", () => {
    const outDir = mkdtempSync(join(tmpdir(), "caregap-pilot-"));
    dirs.push(outDir);
    const report = runLivePilotDryRun({
      manifestPath: MANIFEST,
      datasetPath: DATASET,
      outDir,
    });
    expect(report.live_calls_executed).toBe(false);
    expect(report.mode).toBe("dry-run");
    expect(report.metrics).toBeNull();
    expect(report.results.every((r) => r.status === "dry_run_skipped")).toBe(
      true,
    );
    const written = JSON.parse(readFileSync(report.artifact_paths.report, "utf8"));
    expect(written.live_calls_executed).toBe(false);
  });

  it("refuses live runner when gates fail", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "caregap-pilot-"));
    dirs.push(outDir);
    await expect(
      runLivePilotLive({
        manifestPath: MANIFEST,
        datasetPath: DATASET,
        outDir,
        hardMaxUsd: 5,
        explicitApproval: false,
        modelId: "gpt-5.4-mini-2026-03-17",
        promptVersion: "ai_spec_system_v1",
        env: {},
        callModel: async () => {
          throw new Error("should not be called");
        },
      }),
    ).rejects.toThrow(/LIVE_PILOT_GATES_FAILED/);
  });

  it("runs injected live caller only when gates pass and records failures", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "caregap-pilot-"));
    dirs.push(outDir);
    let calls = 0;
    const report = await runLivePilotLive({
      manifestPath: MANIFEST,
      datasetPath: DATASET,
      outDir,
      hardMaxUsd: 5,
      explicitApproval: true,
      modelId: "gpt-5.4-mini-2026-03-17",
      promptVersion: "ai_spec_system_v1",
      env: {
        CAREGAP_LIVE_EVAL_OPT_IN: "I_ACCEPT_PAID_SYNTHETIC_EVAL",
        OPENAI_API_KEY: "sk-test-not-real-key-xxxxx",
      },
      callModel: async (c) => {
        calls += 1;
        if (calls === 1) {
          throw new Error("INVALID_AI_OUTPUT:json_parse");
        }
        return {
          predicted_status: c.expected_status,
          latency_ms: 10,
          input_tokens: 100,
          output_tokens: 50,
          estimated_cost_usd: 0.001,
        };
      },
    });
    expect(report.live_calls_executed).toBe(true);
    expect(report.results.some((r) => r.status === "invalid_output")).toBe(true);
    expect(report.results.some((r) => r.status === "success")).toBe(true);
    expect(report.metrics).not.toBeNull();
    // Failures must remain visible — success-only inflation is not claimed complete.
    expect(report.metrics_note).toMatch(/successful cases/i);
  });
});
