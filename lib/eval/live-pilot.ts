/**
 * Controlled Live Evaluation Pilot runner.
 *
 * Default mode is dry-run. Real OpenAI calls require ALL of:
 * 1. mode === "live"
 * 2. CAREGAP_LIVE_EVAL_OPT_IN=I_ACCEPT_PAID_SYNTHETIC_EVAL
 * 3. explicitApproval === true (CLI --i-approve-live-spend)
 * 4. OPENAI_API_KEY present
 * 5. Cost guard not exceeded
 *
 * Results go under fixtures/eval/artifacts only — never CareGap Test DB.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertWithinCostGuard,
  estimateLivePilotCost,
  type CostGuardState,
  type LiveCostEstimate,
} from "@/lib/eval/live-cost";
import { DEFAULT_LIVE_EVAL_BUDGET } from "@/lib/eval/live-prep";
import {
  collectObservations,
  computeStatusMetrics,
} from "@/lib/eval/metrics";
import type { PilotManifest } from "@/lib/eval/pilot-select";
import type {
  EvalCase,
  EvalDataset,
  ExpectedStatusMap,
} from "@/lib/eval/types";

export type LivePilotMode = "dry-run" | "live";

export type LivePilotGateCheck = {
  ok: boolean;
  mode: LivePilotMode;
  opt_in_env: boolean;
  explicit_approval: boolean;
  api_key_present: boolean;
  cost_estimate: LiveCostEstimate;
  blockers: string[];
};

export type LivePilotCaseResult = {
  case_id: string;
  family_id: string;
  status:
    | "dry_run_skipped"
    | "success"
    | "api_failure"
    | "invalid_output"
    | "cost_aborted"
    | "checkpoint_skip";
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  error_code: string | null;
  predicted_status: ExpectedStatusMap | null;
};

export type LivePilotRunReport = {
  schema_version: "caregap.eval.live_pilot.v1";
  generated_at: string;
  mode: LivePilotMode;
  live_calls_executed: boolean;
  dataset_version: string;
  model_id: string | null;
  prompt_version: string | null;
  evaluation_version: string;
  case_count: number;
  gate: LivePilotGateCheck;
  results: LivePilotCaseResult[];
  metrics: ReturnType<typeof computeStatusMetrics> | null;
  metrics_note: string;
  artifact_paths: {
    report: string;
    checkpoint: string;
  };
};

const EVAL_VERSION = "live-pilot-prep-v1";
const OPT_IN_ENV = DEFAULT_LIVE_EVAL_BUDGET.require_opt_in_env;
const OPT_IN_VALUE = "I_ACCEPT_PAID_SYNTHETIC_EVAL";

export function checkLivePilotGates(input: {
  mode: LivePilotMode;
  explicitApproval: boolean;
  caseCount: number;
  hardMaxUsd: number;
  maxAttemptsPerCase?: number;
  env?: NodeJS.ProcessEnv;
}): LivePilotGateCheck {
  const env = input.env ?? process.env;
  const opt_in_env = env[OPT_IN_ENV] === OPT_IN_VALUE;
  const api_key_present = Boolean(
    env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 8,
  );
  const cost_estimate = estimateLivePilotCost({
    cases: input.caseCount,
    hard_max_usd: input.hardMaxUsd,
    max_attempts_per_case: input.maxAttemptsPerCase,
  });
  const blockers: string[] = [];
  if (input.mode === "live") {
    if (!opt_in_env) {
      blockers.push(`${OPT_IN_ENV} must be ${OPT_IN_VALUE}`);
    }
    if (!input.explicitApproval) {
      blockers.push("explicitApproval required (--i-approve-live-spend)");
    }
    if (!api_key_present) {
      blockers.push("OPENAI_API_KEY missing or too short");
    }
    if (!cost_estimate.within_hard_max) {
      blockers.push(
        `estimated_usd ${cost_estimate.estimated_usd.toFixed(4)} exceeds hard_max_usd ${input.hardMaxUsd}`,
      );
    }
  }
  return {
    ok: blockers.length === 0,
    mode: input.mode,
    opt_in_env,
    explicit_approval: input.explicitApproval,
    api_key_present,
    cost_estimate,
    blockers,
  };
}

function loadManifest(path: string): PilotManifest {
  return JSON.parse(readFileSync(path, "utf8")) as PilotManifest;
}

function loadDataset(path: string): EvalDataset {
  return JSON.parse(readFileSync(path, "utf8")) as EvalDataset;
}

function casesById(dataset: EvalDataset): Map<string, EvalCase> {
  return new Map(dataset.cases.map((c) => [c.id, c]));
}

function fingerprintManifest(manifest: PilotManifest): string {
  return createHash("sha256")
    .update(JSON.stringify(manifest.cases.map((c) => c.case_id).sort()))
    .digest("hex")
    .slice(0, 16);
}

export function runLivePilotDryRun(input: {
  manifestPath: string;
  datasetPath: string;
  outDir: string;
  hardMaxUsd?: number;
  evaluationVersion?: string;
}): LivePilotRunReport {
  const hardMaxUsd = input.hardMaxUsd ?? DEFAULT_LIVE_EVAL_BUDGET.max_estimated_usd;
  const manifest = loadManifest(input.manifestPath);
  const dataset = loadDataset(input.datasetPath);
  const byId = casesById(dataset);
  const gate = checkLivePilotGates({
    mode: "dry-run",
    explicitApproval: false,
    caseCount: manifest.cases.length,
    hardMaxUsd,
  });

  mkdirSync(input.outDir, { recursive: true });
  const fp = fingerprintManifest(manifest);
  const reportPath = join(input.outDir, `live-pilot-dry-run-${fp}.json`);
  const checkpointPath = join(input.outDir, `live-pilot-checkpoint-${fp}.json`);

  const results: LivePilotCaseResult[] = manifest.cases.map((entry) => {
    const c = byId.get(entry.case_id);
    if (!c) {
      return {
        case_id: entry.case_id,
        family_id: entry.family_id,
        status: "api_failure",
        latency_ms: null,
        input_tokens: null,
        output_tokens: null,
        estimated_cost_usd: null,
        error_code: "CASE_NOT_FOUND",
        predicted_status: null,
      };
    }
    return {
      case_id: c.id,
      family_id: c.family_id,
      status: "dry_run_skipped",
      latency_ms: null,
      input_tokens: null,
      output_tokens: null,
      estimated_cost_usd: null,
      error_code: null,
      predicted_status: null,
    };
  });

  const report: LivePilotRunReport = {
    schema_version: "caregap.eval.live_pilot.v1",
    generated_at: new Date().toISOString(),
    mode: "dry-run",
    live_calls_executed: false,
    dataset_version: manifest.parent_dataset_version,
    model_id: null,
    prompt_version: null,
    evaluation_version: input.evaluationVersion ?? EVAL_VERSION,
    case_count: manifest.cases.length,
    gate,
    results,
    metrics: null,
    metrics_note:
      "No Live model metrics — dry-run only. Do not invent accuracy from this report.",
    artifact_paths: {
      report: reportPath,
      checkpoint: checkpointPath,
    },
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(
    checkpointPath,
    `${JSON.stringify(
      {
        fingerprint: fp,
        completed_case_ids: [] as string[],
        mode: "dry-run",
        updated_at: report.generated_at,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return report;
}

/**
 * Live execution entry — throws unless all gates pass.
 * callModel is injected so unit tests never open network sockets.
 */
export async function runLivePilotLive(input: {
  manifestPath: string;
  datasetPath: string;
  outDir: string;
  hardMaxUsd: number;
  explicitApproval: boolean;
  callModel: (c: EvalCase) => Promise<{
    predicted_status: ExpectedStatusMap;
    latency_ms: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number;
  }>;
  env?: NodeJS.ProcessEnv;
  evaluationVersion?: string;
  modelId: string;
  promptVersion: string;
}): Promise<LivePilotRunReport> {
  const manifest = loadManifest(input.manifestPath);
  const dataset = loadDataset(input.datasetPath);
  const byId = casesById(dataset);
  const gate = checkLivePilotGates({
    mode: "live",
    explicitApproval: input.explicitApproval,
    caseCount: manifest.cases.length,
    hardMaxUsd: input.hardMaxUsd,
    env: input.env,
  });
  if (!gate.ok) {
    throw new Error(`LIVE_PILOT_GATES_FAILED: ${gate.blockers.join("; ")}`);
  }

  mkdirSync(input.outDir, { recursive: true });
  const fp = fingerprintManifest(manifest);
  const reportPath = join(input.outDir, `live-pilot-live-${fp}.json`);
  const checkpointPath = join(input.outDir, `live-pilot-checkpoint-${fp}.json`);

  let completed: string[] = [];
  if (existsSync(checkpointPath)) {
    const cp = JSON.parse(readFileSync(checkpointPath, "utf8")) as {
      completed_case_ids?: string[];
    };
    completed = cp.completed_case_ids ?? [];
  }
  const completedSet = new Set(completed);

  const guard: CostGuardState = {
    hard_max_usd: input.hardMaxUsd,
    spent_usd_estimate: 0,
    calls_made: 0,
    max_calls: gate.cost_estimate.estimated_calls_including_retries,
  };

  const perCallEst =
    gate.cost_estimate.estimated_usd /
    Math.max(1, gate.cost_estimate.estimated_calls_including_retries);

  const results: LivePilotCaseResult[] = [];
  const scoredPairs: Array<{
    case_id: string;
    gold: ExpectedStatusMap;
    pred: ExpectedStatusMap;
  }> = [];

  for (const entry of manifest.cases) {
    if (completedSet.has(entry.case_id)) {
      results.push({
        case_id: entry.case_id,
        family_id: entry.family_id,
        status: "checkpoint_skip",
        latency_ms: null,
        input_tokens: null,
        output_tokens: null,
        estimated_cost_usd: null,
        error_code: "CHECKPOINT_SKIP",
        predicted_status: null,
      });
      continue;
    }

    const c = byId.get(entry.case_id);
    if (!c) {
      results.push({
        case_id: entry.case_id,
        family_id: entry.family_id,
        status: "api_failure",
        latency_ms: null,
        input_tokens: null,
        output_tokens: null,
        estimated_cost_usd: null,
        error_code: "CASE_NOT_FOUND",
        predicted_status: null,
      });
      continue;
    }

    try {
      assertWithinCostGuard(guard, perCallEst);
    } catch (e) {
      results.push({
        case_id: c.id,
        family_id: c.family_id,
        status: "cost_aborted",
        latency_ms: null,
        input_tokens: null,
        output_tokens: null,
        estimated_cost_usd: null,
        error_code: e instanceof Error ? e.message : "COST_GUARD",
        predicted_status: null,
      });
      break;
    }

    try {
      const out = await input.callModel(c);
      guard.calls_made += 1;
      guard.spent_usd_estimate += out.estimated_cost_usd;
      results.push({
        case_id: c.id,
        family_id: c.family_id,
        status: "success",
        latency_ms: out.latency_ms,
        input_tokens: out.input_tokens,
        output_tokens: out.output_tokens,
        estimated_cost_usd: out.estimated_cost_usd,
        error_code: null,
        predicted_status: out.predicted_status,
      });
      scoredPairs.push({
        case_id: c.id,
        gold: c.expected_status,
        pred: out.predicted_status,
      });
      completed.push(c.id);
      writeFileSync(
        checkpointPath,
        `${JSON.stringify(
          {
            fingerprint: fp,
            completed_case_ids: completed,
            mode: "live",
            spent_usd_estimate: guard.spent_usd_estimate,
            updated_at: new Date().toISOString(),
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    } catch (e) {
      guard.calls_made += 1;
      const msg = e instanceof Error ? e.message.slice(0, 200) : "API_ERROR";
      const invalid = /INVALID_AI_OUTPUT|json_parse|evidence/i.test(msg);
      results.push({
        case_id: c.id,
        family_id: c.family_id,
        status: invalid ? "invalid_output" : "api_failure",
        latency_ms: null,
        input_tokens: null,
        output_tokens: null,
        estimated_cost_usd: null,
        error_code: msg,
        predicted_status: null,
      });
    }
  }

  const metrics =
    scoredPairs.length > 0
      ? computeStatusMetrics(collectObservations(scoredPairs))
      : null;

  const report: LivePilotRunReport = {
    schema_version: "caregap.eval.live_pilot.v1",
    generated_at: new Date().toISOString(),
    mode: "live",
    live_calls_executed: true,
    dataset_version: manifest.parent_dataset_version,
    model_id: input.modelId,
    prompt_version: input.promptVersion,
    evaluation_version: input.evaluationVersion ?? EVAL_VERSION,
    case_count: manifest.cases.length,
    gate,
    results,
    metrics,
    metrics_note:
      metrics == null
        ? "No successful scored cases — do not report accuracy."
        : "Metrics only on successful cases; failures listed in results. Small-n pilot — not production approval.",
    artifact_paths: {
      report: reportPath,
      checkpoint: checkpointPath,
    },
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}
