/**
 * Controlled Live Smoke runner (5 cases).
 * Default dry-run. Live requires opt-in + CLI approval + key + budget gates.
 * Artifacts under fixtures/eval/artifacts only — never CareGap Test DB.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AnalysisNote } from "@/lib/analysis/types";
import { LIVE_MAX_OUTPUT_TOKENS } from "@/lib/analysis/live";
import {
  assertWithinCostGuard,
  calculateUsageCostUsd,
  estimateLivePilotCost,
  estimateWorstCaseCallUsd,
  type CostGuardState,
} from "@/lib/eval/live-cost";
import { gateCaseForLive, DEFAULT_LIVE_EVAL_BUDGET } from "@/lib/eval/live-prep";
import {
  collectObservations,
  computeCitationMetrics,
  computeStatusMetrics,
  type EvidenceItem,
} from "@/lib/eval/metrics";
import {
  LIVE_SMOKE_CASE_IDS,
  type SmokePilotManifest,
} from "@/lib/eval/smoke-select";
import {
  callSmokeResponsesWithLimitedRetry,
  SMOKE_PROMPT_VERSION,
  type SmokeCallResult,
} from "@/lib/eval/live-smoke-call";
import type {
  EvalCase,
  EvalDataset,
  ExpectedStatusMap,
} from "@/lib/eval/types";

export const SMOKE_EVAL_VERSION = "live-smoke-runner-v1";
export const SMOKE_MODEL_ID = "gpt-5.4-mini-2026-03-17";
export const SMOKE_HARD_MAX_USD = 1;
export const SMOKE_MAX_CALLS = 10;
export const SMOKE_MAX_CASES = 5;

const OPT_IN_ENV = DEFAULT_LIVE_EVAL_BUDGET.require_opt_in_env;
const OPT_IN_VALUE = "I_ACCEPT_PAID_SYNTHETIC_EVAL";

export type SmokeGateCheck = {
  ok: boolean;
  mode: "dry-run" | "live";
  opt_in_env: boolean;
  explicit_approval: boolean;
  api_key_present: boolean;
  model_ok: boolean;
  manifest_ok: boolean;
  budget_ok: boolean;
  blockers: string[];
  planner_estimate_usd: number;
  worst_case_per_call_usd: number;
};

export type SmokeCaseResult = {
  case_id: string;
  split: "dev" | "val";
  family_id: string;
  request_attempts: number;
  response_status: string;
  response_class: string;
  input_tokens: number | null;
  output_tokens: number | null;
  reasoning_tokens: number | null;
  estimated_cost_usd: number | null;
  calculated_usage_cost_usd: number | null;
  latency_ms: number | null;
  validation_result: "not_run" | "passed" | "failed" | "skipped";
  checkpoint_status: "new" | "completed" | "skipped_duplicate" | "aborted";
  execution_timestamp: string;
  predicted_status: ExpectedStatusMap | null;
  error_code: string | null;
  billing_uncertain: boolean;
};

export type SmokeRunReport = {
  schema_version: "caregap.eval.live_smoke_run.v1";
  generated_at: string;
  mode: "dry-run" | "live";
  live_calls_executed: number;
  model_accuracy_measured: boolean;
  model_id: string;
  prompt_version: string;
  dataset_version: string;
  evaluation_version: string;
  manifest_hash: string;
  completion_status: "dry_run" | "complete" | "partial" | "blocked" | "aborted";
  gate: SmokeGateCheck;
  results: SmokeCaseResult[];
  metrics: ReturnType<typeof computeStatusMetrics> | null;
  citation_metrics: ReturnType<typeof computeCitationMetrics> | null;
  totals: {
    api_attempts: number;
    calculated_usage_cost_usd: number;
    estimated_planner_usd: number;
    success_cases: number;
    failed_cases: number;
  };
  metrics_note: string;
  cost_disclaimer: string;
  artifact_paths: { report: string; checkpoint: string };
};

export type SmokeCheckpoint = {
  fingerprint: string;
  completed_case_ids: string[];
  spent_usage_cost_usd: number;
  calls_made: number;
  mode: "dry-run" | "live";
  updated_at: string;
  results?: SmokeCaseResult[];
};

function sha16(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

export function manifestHash(manifest: SmokePilotManifest): string {
  return sha16(JSON.stringify(manifest.cases.map((c) => c.case_id)));
}

export function loadSmokeManifest(path: string): SmokePilotManifest {
  return JSON.parse(readFileSync(path, "utf8")) as SmokePilotManifest;
}

export function validateSmokeManifest(manifest: SmokePilotManifest): string[] {
  const errors: string[] = [];
  if (manifest.test_split_used) errors.push("test_split_used");
  if (manifest.cases.length !== SMOKE_MAX_CASES) {
    errors.push(`case_count_${manifest.cases.length}`);
  }
  if (manifest.model_id !== SMOKE_MODEL_ID) {
    errors.push(`model_mismatch_${manifest.model_id}`);
  }
  if (manifest.hard_max_usd !== SMOKE_HARD_MAX_USD) {
    errors.push("hard_max_usd_mismatch");
  }
  if (manifest.max_calls_including_retries !== SMOKE_MAX_CALLS) {
    errors.push("max_calls_mismatch");
  }
  const ids = manifest.cases.map((c) => c.case_id);
  if (JSON.stringify(ids) !== JSON.stringify([...LIVE_SMOKE_CASE_IDS])) {
    errors.push("case_id_set_mismatch");
  }
  const families = new Set<string>();
  for (const c of manifest.cases) {
    if (c.split !== "dev" && c.split !== "val") errors.push(`split_${c.case_id}`);
    if (!c.label_approved_for_scoring) errors.push(`unapproved_${c.case_id}`);
    if (families.has(c.family_id)) errors.push(`family_dup_${c.family_id}`);
    families.add(c.family_id);
  }
  return errors;
}

export function checkSmokeGates(input: {
  mode: "dry-run" | "live";
  explicitApproval: boolean;
  manifest: SmokePilotManifest;
  modelId?: string;
  env?: NodeJS.ProcessEnv;
}): SmokeGateCheck {
  const env = input.env ?? process.env;
  const opt_in_env = env[OPT_IN_ENV] === OPT_IN_VALUE;
  const api_key_present = Boolean(
    env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 8,
  );
  const modelId = input.modelId ?? env.OPENAI_MODEL ?? SMOKE_MODEL_ID;
  const model_ok = modelId === SMOKE_MODEL_ID;
  const manifestErrors = validateSmokeManifest(input.manifest);
  const manifest_ok = manifestErrors.length === 0;
  const planner = estimateLivePilotCost({
    cases: SMOKE_MAX_CASES,
    max_attempts_per_case: 2,
    hard_max_usd: SMOKE_HARD_MAX_USD,
  });
  const worst_case_per_call_usd = estimateWorstCaseCallUsd({
    estimated_input_tokens: 2000,
    max_output_tokens: LIVE_MAX_OUTPUT_TOKENS,
  });
  const budget_ok =
    planner.within_hard_max &&
    worst_case_per_call_usd <= SMOKE_HARD_MAX_USD &&
    planner.estimated_calls_including_retries <= SMOKE_MAX_CALLS;

  const blockers: string[] = [];
  if (input.mode === "live") {
    if (!opt_in_env) blockers.push(`${OPT_IN_ENV} must be ${OPT_IN_VALUE}`);
    if (!input.explicitApproval) {
      blockers.push("explicitApproval required (--i-approve-live-spend)");
    }
    if (!api_key_present) blockers.push("OPENAI_API_KEY missing or too short");
    if (!model_ok) blockers.push(`OPENAI_MODEL must be ${SMOKE_MODEL_ID}`);
    if (!manifest_ok) blockers.push(...manifestErrors.map((e) => `manifest:${e}`));
    if (!budget_ok) blockers.push("budget_or_call_cap_failed");
  }

  return {
    ok: blockers.length === 0,
    mode: input.mode,
    opt_in_env,
    explicit_approval: input.explicitApproval,
    api_key_present,
    model_ok,
    manifest_ok,
    budget_ok,
    blockers,
    planner_estimate_usd: planner.estimated_usd,
    worst_case_per_call_usd,
  };
}

function toNotes(c: EvalCase): { previous: AnalysisNote; current: AnalysisNote } {
  return {
    previous: {
      note_id: `${c.id}-previous`,
      occurred_on: c.previous.occurred_on,
      body: c.previous.body,
    },
    current: {
      note_id: `${c.id}-current`,
      occurred_on: c.current.occurred_on,
      body: c.current.body,
    },
  };
}

function readCheckpoint(path: string): SmokeCheckpoint | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as SmokeCheckpoint;
}

function writeCheckpoint(path: string, cp: SmokeCheckpoint): void {
  writeFileSync(path, `${JSON.stringify(cp, null, 2)}\n`, "utf8");
}

export function runSmokeDryRun(input: {
  manifestPath: string;
  datasetPath: string;
  outDir: string;
}): SmokeRunReport {
  const manifest = loadSmokeManifest(input.manifestPath);
  const dataset = JSON.parse(
    readFileSync(input.datasetPath, "utf8"),
  ) as EvalDataset;
  const byId = new Map(dataset.cases.map((c) => [c.id, c]));
  const gate = checkSmokeGates({
    mode: "dry-run",
    explicitApproval: false,
    manifest,
  });
  const mh = manifestHash(manifest);
  mkdirSync(input.outDir, { recursive: true });
  const reportPath = join(input.outDir, `live-smoke-run-dry-${mh}.json`);
  const checkpointPath = join(input.outDir, `live-smoke-run-checkpoint-${mh}.json`);

  const results: SmokeCaseResult[] = [];
  const now = new Date().toISOString();
  for (const entry of manifest.cases) {
    const c = byId.get(entry.case_id);
    const gateCase = c ? gateCaseForLive(c) : null;
    results.push({
      case_id: entry.case_id,
      split: entry.split,
      family_id: entry.family_id,
      request_attempts: 0,
      response_status: "dry_run_skipped",
      response_class: "dry_run_skipped",
      input_tokens: null,
      output_tokens: null,
      reasoning_tokens: null,
      estimated_cost_usd: null,
      calculated_usage_cost_usd: null,
      latency_ms: null,
      validation_result: "not_run",
      checkpoint_status: "new",
      execution_timestamp: now,
      predicted_status: null,
      error_code:
        !c
          ? "CASE_NOT_FOUND"
          : gateCase && !gateCase.runnable
            ? gateCase.reasons.join(",")
            : null,
      billing_uncertain: false,
    });
  }

  const planner = estimateLivePilotCost({
    cases: 5,
    max_attempts_per_case: 2,
    hard_max_usd: SMOKE_HARD_MAX_USD,
  });

  const report: SmokeRunReport = {
    schema_version: "caregap.eval.live_smoke_run.v1",
    generated_at: now,
    mode: "dry-run",
    live_calls_executed: 0,
    model_accuracy_measured: false,
    model_id: SMOKE_MODEL_ID,
    prompt_version: SMOKE_PROMPT_VERSION,
    dataset_version: manifest.parent_dataset_version,
    evaluation_version: SMOKE_EVAL_VERSION,
    manifest_hash: mh,
    completion_status: "dry_run",
    gate,
    results,
    metrics: null,
    citation_metrics: null,
    totals: {
      api_attempts: 0,
      calculated_usage_cost_usd: 0,
      estimated_planner_usd: planner.estimated_usd,
      success_cases: 0,
      failed_cases: 0,
    },
    metrics_note:
      "Dry-run only — model_accuracy_measured=false. Do not invent accuracy.",
    cost_disclaimer:
      "Local hard_max_usd is a process guard, not a guarantee of OpenAI invoice ceiling.",
    artifact_paths: { report: reportPath, checkpoint: checkpointPath },
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeCheckpoint(checkpointPath, {
    fingerprint: mh,
    completed_case_ids: [],
    spent_usage_cost_usd: 0,
    calls_made: 0,
    mode: "dry-run",
    updated_at: now,
    results: [],
  });
  return report;
}

export async function runSmokeLive(input: {
  manifestPath: string;
  datasetPath: string;
  outDir: string;
  explicitApproval: boolean;
  env?: NodeJS.ProcessEnv;
  /**
   * Injected caller for tests. Production CLI passes real Responses caller.
   * Each invocation counts as attempts returned toward max_calls.
   */
  executeCase: (args: {
    evalCase: EvalCase;
    remainingCalls: number;
  }) => Promise<{ result: SmokeCallResult; attempts: number }>;
}): Promise<SmokeRunReport> {
  const manifest = loadSmokeManifest(input.manifestPath);
  const dataset = JSON.parse(
    readFileSync(input.datasetPath, "utf8"),
  ) as EvalDataset;
  const byId = new Map(dataset.cases.map((c) => [c.id, c]));
  const gate = checkSmokeGates({
    mode: "live",
    explicitApproval: input.explicitApproval,
    manifest,
    env: input.env,
  });
  const mh = manifestHash(manifest);
  mkdirSync(input.outDir, { recursive: true });
  const reportPath = join(input.outDir, `live-smoke-run-live-${mh}.json`);
  const checkpointPath = join(
    input.outDir,
    `live-smoke-run-checkpoint-${mh}.json`,
  );

  if (!gate.ok) {
    const blocked: SmokeRunReport = {
      schema_version: "caregap.eval.live_smoke_run.v1",
      generated_at: new Date().toISOString(),
      mode: "live",
      live_calls_executed: 0,
      model_accuracy_measured: false,
      model_id: SMOKE_MODEL_ID,
      prompt_version: SMOKE_PROMPT_VERSION,
      dataset_version: manifest.parent_dataset_version,
      evaluation_version: SMOKE_EVAL_VERSION,
      manifest_hash: mh,
      completion_status: "blocked",
      gate,
      results: [],
      metrics: null,
      citation_metrics: null,
      totals: {
        api_attempts: 0,
        calculated_usage_cost_usd: 0,
        estimated_planner_usd: gate.planner_estimate_usd,
        success_cases: 0,
        failed_cases: 0,
      },
      metrics_note: "Blocked before any Live calls.",
      cost_disclaimer:
        "Local hard_max_usd is a process guard, not a guarantee of OpenAI invoice ceiling.",
      artifact_paths: { report: reportPath, checkpoint: checkpointPath },
    };
    writeFileSync(reportPath, `${JSON.stringify(blocked, null, 2)}\n`, "utf8");
    throw new Error(`SMOKE_LIVE_GATES_FAILED: ${gate.blockers.join("; ")}`);
  }

  const prior = readCheckpoint(checkpointPath);
  const completed = new Set(prior?.completed_case_ids ?? []);
  const priorById = new Map(
    (prior?.results ?? []).map((r) => [r.case_id, r]),
  );

  const guard: CostGuardState = {
    hard_max_usd: SMOKE_HARD_MAX_USD,
    spent_usd_estimate: prior?.spent_usage_cost_usd ?? 0,
    calls_made: prior?.calls_made ?? 0,
    max_calls: SMOKE_MAX_CALLS,
  };

  const results: SmokeCaseResult[] = [];
  const scored: Array<{
    case_id: string;
    gold: ExpectedStatusMap;
    pred: ExpectedStatusMap;
  }> = [];
  const evidenceItems: EvidenceItem[] = [];
  let aborted = false;
  let live_calls_executed = 0;

  for (const entry of manifest.cases) {
    if (completed.has(entry.case_id)) {
      const priorRow = priorById.get(entry.case_id);
      results.push(
        priorRow
          ? {
              ...priorRow,
              checkpoint_status: "skipped_duplicate",
              response_status: "checkpoint_skip",
              error_code: "CHECKPOINT_SKIP",
            }
          : {
              case_id: entry.case_id,
              split: entry.split,
              family_id: entry.family_id,
              request_attempts: 0,
              response_status: "checkpoint_skip",
              response_class: "checkpoint_skip",
              input_tokens: null,
              output_tokens: null,
              reasoning_tokens: null,
              estimated_cost_usd: null,
              calculated_usage_cost_usd: null,
              latency_ms: null,
              validation_result: "skipped",
              checkpoint_status: "skipped_duplicate",
              execution_timestamp: new Date().toISOString(),
              predicted_status: null,
              error_code: "CHECKPOINT_SKIP",
              billing_uncertain: false,
            },
      );
      if (priorRow?.predicted_status) {
        const c = byId.get(entry.case_id);
        if (c) {
          scored.push({
            case_id: c.id,
            gold: c.expected_status,
            pred: priorRow.predicted_status,
          });
        }
      }
      continue;
    }

    const c = byId.get(entry.case_id);
    if (!c) {
      results.push({
        case_id: entry.case_id,
        split: entry.split,
        family_id: entry.family_id,
        request_attempts: 0,
        response_status: "api_failure",
        response_class: "unexpected",
        input_tokens: null,
        output_tokens: null,
        reasoning_tokens: null,
        estimated_cost_usd: null,
        calculated_usage_cost_usd: null,
        latency_ms: null,
        validation_result: "failed",
        checkpoint_status: "aborted",
        execution_timestamp: new Date().toISOString(),
        predicted_status: null,
        error_code: "CASE_NOT_FOUND",
        billing_uncertain: false,
      });
      continue;
    }

    const synthetic = gateCaseForLive(c);
    if (!synthetic.runnable) {
      results.push({
        case_id: c.id,
        split: entry.split,
        family_id: c.family_id,
        request_attempts: 0,
        response_status: "gate_failed",
        response_class: "unexpected",
        input_tokens: null,
        output_tokens: null,
        reasoning_tokens: null,
        estimated_cost_usd: null,
        calculated_usage_cost_usd: null,
        latency_ms: null,
        validation_result: "failed",
        checkpoint_status: "aborted",
        execution_timestamp: new Date().toISOString(),
        predicted_status: null,
        error_code: synthetic.reasons.join(","),
        billing_uncertain: false,
      });
      continue;
    }

    const worst = estimateWorstCaseCallUsd({
      estimated_input_tokens: 2000,
      max_output_tokens: LIVE_MAX_OUTPUT_TOKENS,
    });
    try {
      assertWithinCostGuard(guard, worst);
    } catch (e) {
      aborted = true;
      results.push({
        case_id: c.id,
        split: entry.split,
        family_id: c.family_id,
        request_attempts: 0,
        response_status: "cost_aborted",
        response_class: "cost_aborted",
        input_tokens: null,
        output_tokens: null,
        reasoning_tokens: null,
        estimated_cost_usd: null,
        calculated_usage_cost_usd: null,
        latency_ms: null,
        validation_result: "not_run",
        checkpoint_status: "aborted",
        execution_timestamp: new Date().toISOString(),
        predicted_status: null,
        error_code: e instanceof Error ? e.message : "COST_GUARD",
        billing_uncertain: false,
      });
      break;
    }

    const remaining = guard.max_calls - guard.calls_made;
    if (remaining <= 0) {
      aborted = true;
      break;
    }

    const { result, attempts } = await input.executeCase({
      evalCase: c,
      remainingCalls: remaining,
    });
    live_calls_executed += attempts;
    guard.calls_made += attempts;

    const usageCost =
      result.calculated_usage_cost_usd ??
      (result.usage?.input_tokens != null && result.usage.output_tokens != null
        ? calculateUsageCostUsd({
            input_tokens: result.usage.input_tokens,
            output_tokens: result.usage.output_tokens,
          })
        : null);
    if (usageCost != null) {
      guard.spent_usd_estimate += usageCost;
    } else if (!result.ok && result.billing_uncertain) {
      // Conservative: count worst-case exposure when billing uncertain
      guard.spent_usd_estimate += worst;
    }

    const caseResult: SmokeCaseResult = {
      case_id: c.id,
      split: entry.split,
      family_id: c.family_id,
      request_attempts: attempts,
      response_status: result.ok ? "success" : result.response_class,
      response_class: result.response_class,
      input_tokens: result.usage?.input_tokens ?? null,
      output_tokens: result.usage?.output_tokens ?? null,
      reasoning_tokens: result.usage?.reasoning_tokens ?? null,
      estimated_cost_usd: worst,
      calculated_usage_cost_usd: usageCost,
      latency_ms: result.latency_ms,
      validation_result: result.ok ? "passed" : "failed",
      checkpoint_status: result.ok ? "completed" : "new",
      execution_timestamp: new Date().toISOString(),
      predicted_status: result.ok ? result.predicted_status : null,
      error_code: result.ok ? null : result.error_code,
      billing_uncertain: result.ok ? false : result.billing_uncertain,
    };
    results.push(caseResult);

    if (result.ok) {
      scored.push({
        case_id: c.id,
        gold: c.expected_status,
        pred: result.predicted_status,
      });
      for (const ch of result.analysis.changes) {
        for (const side of ["previous", "current"] as const) {
          const ev = side === "previous" ? ch.evidence_previous : ch.evidence_current;
          if (!ev) continue;
          evidenceItems.push({
            case_id: c.id,
            domain: ch.domain,
            side,
            note_id: ev.note_id,
            quote: ev.quote,
            expected_note_id: `${c.id}-${side}`,
          });
        }
      }
      completed.add(c.id);
      writeCheckpoint(checkpointPath, {
        fingerprint: mh,
        completed_case_ids: [...completed],
        spent_usage_cost_usd: guard.spent_usd_estimate,
        calls_made: guard.calls_made,
        mode: "live",
        updated_at: new Date().toISOString(),
        results: results.filter((r) => r.checkpoint_status === "completed"),
      });
    }
  }

  const metrics =
    scored.length > 0
      ? computeStatusMetrics(collectObservations(scored))
      : null;
  const citation_metrics =
    evidenceItems.length > 0 ? computeCitationMetrics(evidenceItems) : null;

  const success_cases = results.filter((r) => r.response_class === "success").length;
  const failed_cases = results.filter(
    (r) =>
      r.response_class !== "success" &&
      r.response_class !== "dry_run_skipped" &&
      r.response_class !== "checkpoint_skip",
  ).length;

  const completion_status: SmokeRunReport["completion_status"] = aborted
    ? "aborted"
    : failed_cases > 0 || success_cases < manifest.cases.length
      ? "partial"
      : "complete";

  const report: SmokeRunReport = {
    schema_version: "caregap.eval.live_smoke_run.v1",
    generated_at: new Date().toISOString(),
    mode: "live",
    live_calls_executed,
    model_accuracy_measured: metrics != null,
    model_id: SMOKE_MODEL_ID,
    prompt_version: SMOKE_PROMPT_VERSION,
    dataset_version: manifest.parent_dataset_version,
    evaluation_version: SMOKE_EVAL_VERSION,
    manifest_hash: mh,
    completion_status,
    gate,
    results,
    metrics,
    citation_metrics,
    totals: {
      api_attempts: guard.calls_made,
      calculated_usage_cost_usd: guard.spent_usd_estimate,
      estimated_planner_usd: gate.planner_estimate_usd,
      success_cases,
      failed_cases,
    },
    metrics_note:
      metrics == null
        ? "No successful scored cases — do not report accuracy."
        : "Small-n smoke metrics only; failures retained. Not field accuracy evidence. Evidence semantic review remains manual.",
    cost_disclaimer:
      "Local hard_max_usd is a process guard, not a guarantee of OpenAI invoice ceiling. Project $1 limit is a separate external control.",
    artifact_paths: { report: reportPath, checkpoint: checkpointPath },
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

/** Production Live executeCase binding — used only after gates pass. */
export function createDefaultSmokeExecuteCase(openai: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): (args: {
  evalCase: EvalCase;
  remainingCalls: number;
}) => Promise<{ result: SmokeCallResult; attempts: number }> {
  return async ({ evalCase, remainingCalls }) => {
    const notes = toNotes(evalCase);
    const maxAttempts = Math.min(2, remainingCalls);
    if (maxAttempts <= 0) {
      return {
        attempts: 0,
        result: {
          ok: false,
          response_class: "unexpected",
          error_code: "NO_REMAINING_CALLS",
          retryable: false,
          billing_uncertain: false,
          usage: null,
          calculated_usage_cost_usd: null,
          latency_ms: 0,
          provider_status: null,
        },
      };
    }
    // Temporarily limit retries if only 1 call remains
    if (maxAttempts === 1) {
      const { callSmokeResponsesOnce } = await import("@/lib/eval/live-smoke-call");
      const result = await callSmokeResponsesOnce({
        previous: notes.previous,
        current: notes.current,
        openai: {
          apiKey: openai.apiKey,
          model: openai.model,
          fetchImpl: openai.fetchImpl,
        },
      });
      return { result, attempts: 1 };
    }
    return callSmokeResponsesWithLimitedRetry({
      previous: notes.previous,
      current: notes.current,
      openai: {
        apiKey: openai.apiKey,
        model: openai.model,
        fetchImpl: openai.fetchImpl,
      },
    });
  };
}
