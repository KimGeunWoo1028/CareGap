/**
 * CareGap Test — approved real-DB follow-up + A/B isolation gate.
 * Does NOT touch 합성-001. Does NOT call OpenAI.
 * Creates are off by default: set CARE_GAP_GATE_WRITE=1 explicitly.
 * Resumes prior report case IDs when aliases still exist (idempotent).
 * Reads .env.local; never prints passwords or tokens.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  DEMO_ALIAS,
  assertCreateBatchReady,
  planGateCases,
  preferredAliases,
} from "./lib/real-db-follow-up-gate-plan.mjs";

const ROOT = process.cwd();
const BASE = process.env.CARE_GAP_GATE_BASE_URL ?? "http://127.0.0.1:3000";
const REPORT_PATH = path.join(
  ROOT,
  "fixtures",
  "eval",
  "artifacts",
  "real-db-follow-up-gate-report.json",
);
const allowWrite = process.env.CARE_GAP_GATE_WRITE?.trim() === "1";

function loadEnvLocal() {
  const raw = readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function loadPriorReport() {
  try {
    return JSON.parse(readFileSync(REPORT_PATH, "utf8"));
  } catch {
    return null;
  }
}

function redactEmail(email) {
  if (!email || !email.includes("@")) return "(redacted)";
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}…@${d}`;
}

async function signIn(env, email, password) {
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session?.access_token) {
    throw new Error(`sign-in failed for ${redactEmail(email)}`);
  }
  return {
    token: data.session.access_token,
    userId: data.user.id,
    email,
  };
}

async function api(token, method, apiPath, body) {
  const res = await fetch(`${BASE}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function createCase(token, alias) {
  return api(token, "POST", "/api/cases", { alias });
}

async function createFollowUp(token, caseId, note) {
  return api(token, "POST", "/api/follow-ups", {
    case_id: caseId,
    analysis_id: null,
    kind: "next_consultation",
    note,
  });
}

async function patchFollowUp(token, taskId, status) {
  return api(token, "PATCH", `/api/follow-ups/${taskId}`, { status });
}

async function getFollowUpList(token, status) {
  const q = status ? `?status=${status}` : "";
  return api(token, "GET", `/api/follow-ups${q}`);
}

async function getCase(token, caseId) {
  return api(token, "GET", `/api/cases/${caseId}`);
}

async function listCases(token) {
  return api(token, "GET", "/api/cases");
}

async function main() {
  const env = loadEnvLocal();
  if (env.ANALYSIS_MODE && env.ANALYSIS_MODE !== "replay") {
    throw new Error("Refusing to run: ANALYSIS_MODE must stay replay for this gate");
  }

  const emailA = env.TEST_USER_A_EMAIL;
  const passA = env.TEST_USER_A_PASSWORD;
  const emailB = env.TEST_USER_B_EMAIL;
  const passB = env.TEST_USER_B_PASSWORD;
  if (!emailA || !passA || !emailB || !passB) {
    throw new Error("TEST_USER_A/B credentials required in .env.local");
  }

  const prior = loadPriorReport();
  const report = {
    schema_version: "caregap.real_db_follow_up_gate.v1",
    generated_at: new Date().toISOString(),
    base_url: BASE,
    analysis_mode: env.ANALYSIS_MODE ?? null,
    openai_network_calls: 0,
    allow_write: allowWrite,
    accounts: {
      a: redactEmail(emailA),
      b: redactEmail(emailB),
    },
    created: {
      cases: [],
      follow_ups: [],
    },
    checks: {},
    preserved_demo_alias: DEMO_ALIAS,
  };

  const a = await signIn(env, emailA, passA);
  const b = await signIn(env, emailB, passB);

  const casesRes = await listCases(a.token);
  if (casesRes.status !== 200) {
    throw new Error(`list cases failed status=${casesRes.status}`);
  }
  const existingAliases = (casesRes.json?.data ?? []).map((c) => c.alias);
  const plan = planGateCases({
    preferred: preferredAliases(),
    existingAliases,
    resumeCases: prior?.created?.cases ?? [],
    max: 2,
  });
  report.plan = {
    reuse: plan.reuse,
    toCreate: plan.toCreate,
    blocked_count: plan.blocked.length,
  };

  const needCreate = 2 - plan.reuse.length;
  assertCreateBatchReady({ toCreate: plan.toCreate, need: needCreate });

  if (needCreate > 0 && !allowWrite) {
    throw new Error(
      `Refusing to create ${needCreate} case(s): set CARE_GAP_GATE_WRITE=1 after explicit approval`,
    );
  }

  const caseIds = [];
  for (const c of plan.reuse) {
    caseIds.push(c.id);
    report.created.cases.push({
      id: c.id,
      alias: c.alias,
      owner: "A",
      source: "resume",
    });
  }
  for (const alias of plan.toCreate) {
    const created = await createCase(a.token, alias);
    if (created.status !== 201 || !created.json?.data?.id) {
      throw new Error(
        `create case ${alias} failed status=${created.status} code=${created.json?.error?.code ?? "?"}`,
      );
    }
    caseIds.push(created.json.data.id);
    report.created.cases.push({
      id: created.json.data.id,
      alias,
      owner: "A",
      source: "create",
    });
  }

  const priorTasks = prior?.created?.follow_ups ?? [];
  const canResumeTasks =
    priorTasks.length >= 2 &&
    plan.reuse.length >= 2 &&
    priorTasks.every((t) => t?.id && caseIds.includes(t.case_id));

  const notes = [
    "게이트 검증용 후속 업무 · done 경로",
    "게이트 검증용 후속 업무 · cancelled 경로",
  ];
  const taskIds = [];
  const expectedTerminal = ["done", "cancelled"];

  if (canResumeTasks) {
    for (let i = 0; i < 2; i += 1) {
      const t = priorTasks[i];
      taskIds.push(t.id);
      report.created.follow_ups.push({
        id: t.id,
        case_id: t.case_id,
        status: t.status,
        path: expectedTerminal[i],
        source: "resume",
      });
    }
  } else {
    if (!allowWrite) {
      throw new Error(
        "No resumable follow-ups in prior report; set CARE_GAP_GATE_WRITE=1 to create",
      );
    }
    for (let i = 0; i < 2; i += 1) {
      const created = await createFollowUp(a.token, caseIds[i], notes[i]);
      if (created.status !== 201 || !created.json?.data?.id) {
        throw new Error(
          `create follow-up ${i} failed status=${created.status} code=${created.json?.error?.code ?? "?"}`,
        );
      }
      const task = created.json.data;
      taskIds.push(task.id);
      report.created.follow_ups.push({
        id: task.id,
        case_id: task.case_id,
        status: task.status,
        path: expectedTerminal[i],
        source: "create",
      });
    }
  }

  const listAll = await getFollowUpList(a.token);
  const listedBefore = (listAll.json?.data ?? []).filter((t) =>
    taskIds.includes(t.id),
  );
  const byId = Object.fromEntries(listedBefore.map((t) => [t.id, t]));

  if (canResumeTasks) {
    report.checks.done_patch = {
      http: 200,
      status: byId[taskIds[0]]?.status ?? null,
      mode: "resume_read",
    };
    report.checks.cancelled_patch = {
      http: 200,
      status: byId[taskIds[1]]?.status ?? null,
      mode: "resume_read",
    };
  } else {
    const donePatch = await patchFollowUp(a.token, taskIds[0], "done");
    report.checks.done_patch = {
      http: donePatch.status,
      status: donePatch.json?.data?.status ?? null,
      mode: "write",
    };
    const cancelPatch = await patchFollowUp(a.token, taskIds[1], "cancelled");
    report.checks.cancelled_patch = {
      http: cancelPatch.status,
      status: cancelPatch.json?.data?.status ?? null,
      mode: "write",
    };
  }

  const listAfter = await getFollowUpList(a.token);
  const listed = (listAfter.json?.data ?? []).filter((t) =>
    taskIds.includes(t.id),
  );
  report.checks.refresh_list = listed.map((t) => ({
    id: t.id,
    status: t.status,
    completed_at: t.completed_at,
  }));

  const reopenDone = await patchFollowUp(a.token, taskIds[0], "cancelled");
  const reopenCancel = await patchFollowUp(a.token, taskIds[1], "done");
  report.checks.reopen_blocked = {
    done_task_second_patch_http: reopenDone.status,
    done_task_second_patch_code: reopenDone.json?.error?.code ?? null,
    cancelled_task_second_patch_http: reopenCancel.status,
    cancelled_task_second_patch_code: reopenCancel.json?.error?.code ?? null,
  };

  const bCase = await getCase(b.token, caseIds[0]);
  const bPatch = await patchFollowUp(b.token, taskIds[0], "done");
  const bList = await getFollowUpList(b.token);
  const bSeesA = (bList.json?.data ?? []).some((t) => taskIds.includes(t.id));
  report.checks.cross_user = {
    b_get_a_case_http: bCase.status,
    b_get_a_case_code: bCase.json?.error?.code ?? null,
    b_patch_a_follow_up_http: bPatch.status,
    b_patch_a_follow_up_code: bPatch.json?.error?.code ?? null,
    b_list_contains_a_tasks: bSeesA,
  };

  const afterCross = await getFollowUpList(a.token);
  const afterTasks = (afterCross.json?.data ?? []).filter((t) =>
    taskIds.includes(t.id),
  );
  report.checks.a_data_unchanged_after_b = afterTasks.map((t) => ({
    id: t.id,
    status: t.status,
  }));

  const pass =
    report.checks.done_patch.status === "done" &&
    report.checks.cancelled_patch.status === "cancelled" &&
    report.checks.reopen_blocked.done_task_second_patch_http >= 400 &&
    report.checks.reopen_blocked.cancelled_task_second_patch_http >= 400 &&
    report.checks.cross_user.b_get_a_case_http === 404 &&
    report.checks.cross_user.b_patch_a_follow_up_http === 404 &&
    report.checks.cross_user.b_list_contains_a_tasks === false &&
    afterTasks.every((t) =>
      t.id === taskIds[0] ? t.status === "done" : t.status === "cancelled",
    );

  report.gate_pass = pass;
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        report_path: REPORT_PATH,
        gate_pass: pass,
        allow_write: allowWrite,
        case_ids: caseIds,
        task_ids: taskIds,
        plan: report.plan,
        checks: report.checks,
      },
      null,
      2,
    ),
  );
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(String(error?.message ?? error));
  process.exitCode = 1;
});
