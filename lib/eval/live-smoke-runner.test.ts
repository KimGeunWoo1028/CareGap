import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import replayFixture from "@/fixtures/replay-analysis.json";
import {
  callSmokeResponsesOnce,
  callSmokeResponsesWithLimitedRetry,
} from "@/lib/eval/live-smoke-call";
import {
  checkSmokeGates,
  createDefaultSmokeExecuteCase,
  loadSmokeManifest,
  runSmokeDryRun,
  runSmokeLive,
  validateSmokeManifest,
  SMOKE_MODEL_ID,
} from "@/lib/eval/live-smoke-runner";
import type { EvalCase } from "@/lib/eval/types";
import type { SmokeCallResult } from "@/lib/eval/live-smoke-call";

const ROOT = process.cwd();
const MANIFEST = resolve(ROOT, "fixtures/eval/live-smoke.v1.manifest.json");
const DATASET = resolve(ROOT, "fixtures/eval/dataset.v1.json");

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function completedPayload(text: string, usage?: object) {
  return {
    id: "resp_test",
    status: "completed",
    output: [
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text }],
      },
    ],
    usage: usage ?? {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      output_tokens_details: { reasoning_tokens: 10 },
    },
  };
}

describe("live smoke gates and dry-run", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it("validates committed smoke manifest", () => {
    const m = loadSmokeManifest(MANIFEST);
    expect(validateSmokeManifest(m)).toEqual([]);
  });

  it("blocks live without key, opt-in, or approval", () => {
    const m = loadSmokeManifest(MANIFEST);
    const gate = checkSmokeGates({
      mode: "live",
      explicitApproval: false,
      manifest: m,
      env: {},
    });
    expect(gate.ok).toBe(false);
    expect(gate.blockers.length).toBeGreaterThanOrEqual(3);
  });

  it("detects manifest tampering (test split / wrong ids)", () => {
    const m = loadSmokeManifest(MANIFEST);
    const bad = {
      ...m,
      test_split_used: true as false,
      cases: [
        ...m.cases.slice(0, 4),
        { ...m.cases[4]!, case_id: "eval-v1-999", split: "test" as "dev" },
      ],
    };
    const errors = validateSmokeManifest(bad);
    expect(errors.some((e) => e.includes("test") || e.includes("mismatch"))).toBe(
      true,
    );
  });

  it("dry-run writes artifacts with zero live calls", () => {
    const outDir = mkdtempSync(join(tmpdir(), "smoke-dry-"));
    dirs.push(outDir);
    const report = runSmokeDryRun({
      manifestPath: MANIFEST,
      datasetPath: DATASET,
      outDir,
    });
    expect(report.live_calls_executed).toBe(0);
    expect(report.model_accuracy_measured).toBe(false);
    expect(report.metrics).toBeNull();
    expect(report.results).toHaveLength(5);
    const written = JSON.parse(readFileSync(report.artifact_paths.report, "utf8"));
    expect(written.live_calls_executed).toBe(0);
    expect(JSON.stringify(written)).not.toMatch(/sk-[a-zA-Z0-9]/);
  });
});

describe("live smoke call classification (mock fetch)", () => {
  const previous = {
    note_id: "p",
    occurred_on: "2024-01-01",
    body: "이전 식사 잘함",
  };
  const current = {
    note_id: "c",
    occurred_on: "2024-02-01",
    body: "현재 식사 거름",
  };

  it("classifies refusal without retry", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "refusal", refusal: "no" }],
          },
        ],
      }),
    );
    const r = await callSmokeResponsesOnce({
      previous,
      current,
      openai: { apiKey: "test-key", model: SMOKE_MODEL_ID, fetchImpl: fetchImpl as never },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response_class).toBe("refusal");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("classifies incomplete", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output: [],
      }),
    );
    const r = await callSmokeResponsesOnce({
      previous,
      current,
      openai: { apiKey: "k", model: SMOKE_MODEL_ID, fetchImpl: fetchImpl as never },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response_class).toBe("incomplete");
  });

  it("retries 429 once then returns", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: "rate" } }))
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: "rate" } }));
    const { result, attempts } = await callSmokeResponsesWithLimitedRetry({
      previous,
      current,
      openai: { apiKey: "k", model: SMOKE_MODEL_ID, fetchImpl: fetchImpl as never },
    });
    expect(attempts).toBe(2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response_class).toBe("http_429");
  });

  it("does not retry auth errors", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, { error: {} }));
    const { attempts, result } = await callSmokeResponsesWithLimitedRetry({
      previous,
      current,
      openai: { apiKey: "k", model: SMOKE_MODEL_ID, fetchImpl: fetchImpl as never },
    });
    expect(attempts).toBe(1);
    if (!result.ok) expect(result.response_class).toBe("auth_or_model_access");
  });

  it("marks timeout as billing_uncertain and non-retryable", async () => {
    const fetchImpl = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    const { attempts, result } = await callSmokeResponsesWithLimitedRetry({
      previous,
      current,
      openai: { apiKey: "k", model: SMOKE_MODEL_ID, fetchImpl: fetchImpl as never },
    });
    expect(attempts).toBe(1);
    if (!result.ok) {
      expect(result.response_class).toBe("timeout");
      expect(result.billing_uncertain).toBe(true);
      expect(result.retryable).toBe(false);
    }
  });

  it("rejects invalid JSON", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, completedPayload("not-json{")),
    );
    const r = await callSmokeResponsesOnce({
      previous,
      current,
      openai: { apiKey: "k", model: SMOKE_MODEL_ID, fetchImpl: fetchImpl as never },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response_class).toBe("invalid_json");
  });
});

describe("live smoke runner with injected mock (no network)", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  const liveEnv = {
    CAREGAP_LIVE_EVAL_OPT_IN: "I_ACCEPT_PAID_SYNTHETIC_EVAL",
    OPENAI_API_KEY: "sk-test-not-real-key-xxxxxxxx",
    OPENAI_MODEL: SMOKE_MODEL_ID,
  };

  it("throws when approval missing even with opt-in", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "smoke-live-"));
    dirs.push(outDir);
    await expect(
      runSmokeLive({
        manifestPath: MANIFEST,
        datasetPath: DATASET,
        outDir,
        explicitApproval: false,
        env: liveEnv,
        executeCase: async () => {
          throw new Error("should not call");
        },
      }),
    ).rejects.toThrow(/SMOKE_LIVE_GATES_FAILED/);
  });

  it("runs mock successes and records metrics without real fetch", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "smoke-live-"));
    dirs.push(outDir);
    let calls = 0;
    const report = await runSmokeLive({
      manifestPath: MANIFEST,
      datasetPath: DATASET,
      outDir,
      explicitApproval: true,
      env: liveEnv,
      executeCase: async ({ evalCase }) => {
        calls += 1;
        const predicted_status = evalCase.expected_status;
        const result: SmokeCallResult = {
          ok: true,
          response_class: "success",
          predicted_status,
          analysis: {
            schema_version: "1.0",
            summary: "mock",
            changes: (
              Object.entries(predicted_status) as [
                keyof typeof predicted_status,
                (typeof predicted_status)[keyof typeof predicted_status],
              ][]
            ).map(([domain, status]) => ({
              domain,
              status,
              explanation: "m",
              evidence_previous: null,
              evidence_current: null,
            })),
            questions: [],
          },
          usage: {
            input_tokens: 100,
            output_tokens: 40,
            total_tokens: 140,
            reasoning_tokens: 5,
            cached_input_tokens: 0,
          },
          calculated_usage_cost_usd: 0.0003,
          latency_ms: 12,
          provider_status: "completed",
        };
        return { result, attempts: 1 };
      },
    });
    expect(calls).toBe(5);
    expect(report.live_calls_executed).toBe(5);
    expect(report.model_accuracy_measured).toBe(true);
    expect(report.metrics).not.toBeNull();
    expect(report.completion_status).toBe("complete");
  });

  it("aborts when cost guard would exceed and keeps partial status", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "smoke-live-"));
    dirs.push(outDir);
    // Pre-seed checkpoint near budget
    const m = loadSmokeManifest(MANIFEST);
    const { manifestHash } = await import("@/lib/eval/live-smoke-runner");
    const mh = manifestHash(m);
    writeFileSync(
      join(outDir, `live-smoke-run-checkpoint-${mh}.json`),
      JSON.stringify({
        fingerprint: mh,
        completed_case_ids: [],
        spent_usage_cost_usd: 0.99,
        calls_made: 0,
        mode: "live",
        updated_at: new Date().toISOString(),
        results: [],
      }),
    );
    const report = await runSmokeLive({
      manifestPath: MANIFEST,
      datasetPath: DATASET,
      outDir,
      explicitApproval: true,
      env: liveEnv,
      executeCase: async () => {
        throw new Error("should not be reached if cost aborts first");
      },
    });
    expect(report.completion_status).toBe("aborted");
    expect(report.results.some((r) => r.response_status === "cost_aborted")).toBe(
      true,
    );
    expect(report.live_calls_executed).toBe(0);
  });

  it("skips completed checkpoint cases on resume", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "smoke-live-"));
    dirs.push(outDir);
    const m = loadSmokeManifest(MANIFEST);
    const { manifestHash } = await import("@/lib/eval/live-smoke-runner");
    const mh = manifestHash(m);
    const first = m.cases[0]!;
    writeFileSync(
      join(outDir, `live-smoke-run-checkpoint-${mh}.json`),
      JSON.stringify({
        fingerprint: mh,
        completed_case_ids: [first.case_id],
        spent_usage_cost_usd: 0.01,
        calls_made: 1,
        mode: "live",
        updated_at: new Date().toISOString(),
        results: [
          {
            case_id: first.case_id,
            split: first.split,
            family_id: first.family_id,
            request_attempts: 1,
            response_status: "success",
            response_class: "success",
            input_tokens: 10,
            output_tokens: 10,
            reasoning_tokens: 0,
            estimated_cost_usd: 0.01,
            calculated_usage_cost_usd: 0.01,
            latency_ms: 1,
            validation_result: "passed",
            checkpoint_status: "completed",
            execution_timestamp: new Date().toISOString(),
            predicted_status: first.expected_status,
            error_code: null,
            billing_uncertain: false,
          },
        ],
      }),
    );
    const executed: string[] = [];
    await runSmokeLive({
      manifestPath: MANIFEST,
      datasetPath: DATASET,
      outDir,
      explicitApproval: true,
      env: liveEnv,
      executeCase: async ({ evalCase }) => {
        executed.push(evalCase.id);
        const result: SmokeCallResult = {
          ok: false,
          response_class: "http_5xx",
          error_code: "HTTP_500",
          retryable: false,
          billing_uncertain: false,
          usage: null,
          calculated_usage_cost_usd: null,
          latency_ms: 1,
          provider_status: null,
        };
        return { result, attempts: 1 };
      },
    });
    expect(executed).not.toContain(first.case_id);
  });

  it("createDefaultSmokeExecuteCase uses mock fetch and never leaks key in result JSON", async () => {
    const fixture = structuredClone(replayFixture);
    // Align fixture quotes to synthetic smoke case bodies is hard; force schema fail path is ok —
    // use success path with validate skipped by calling execute with bodies matching fixture.
    const evalCase = {
      id: "eval-mock",
      split: "dev",
      family_id: "fam-x",
      scenarios: ["stable_ok"],
      description: "m",
      previous: {
        occurred_on: "2024-01-10",
        body: "어제 시장에 혼자 다녀오셨고, 식사는 하루 세 끼 잘 드신다고 하셨습니다.",
      },
      current: {
        occurred_on: "2024-02-10",
        body: "최근에는 거동이 불편해 외출을 거의 못 하시고, 식사를 거르는 날이 늘었다고 하셨습니다.",
      },
      expected_status: {
        meal: "worsened",
        mobility: "worsened",
        health: "unknown",
        environment: "unknown",
      },
      label_rationale: "x",
      review_status: "internally_reviewed",
      author: "t",
      synthetic_source: "synthetic",
      creation_method: "handwritten_synthetic",
    } as EvalCase;

    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, completedPayload(JSON.stringify(fixture))),
    );
    const exec = createDefaultSmokeExecuteCase({
      apiKey: "sk-secret-should-not-appear",
      model: SMOKE_MODEL_ID,
      fetchImpl: fetchImpl as never,
    });
    const { result, attempts } = await exec({
      evalCase,
      remainingCalls: 2,
    });
    expect(attempts).toBeGreaterThanOrEqual(1);
    expect(fetchImpl).toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("sk-secret");
  });
});
