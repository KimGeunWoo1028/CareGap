/**
 * RC probe for T08 concurrency paths that can affect Replay demos.
 * No OpenAI. ANALYSIS_MODE must be replay. Never prints secrets.
 *
 * Covers:
 * - same key while processing → 202
 * - different key while processing → 409 ANALYSIS_IN_PROGRESS
 * - (cross-case same key remains covered by phase4 harness)
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const API = process.env.CARE_GAP_API_BASE ?? "http://127.0.0.1:3000";

function loadEnvLocal() {
  const raw = readFileSync(resolve(ROOT, ".env.local"), "utf8");
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

function log(id, status, detail) {
  console.log(`${id} | ${status} | ${detail}`);
  return status === "PASS";
}

async function jsonFetch(path, { method = "GET", token, body, headers = {} } = {}) {
  const reqHeaders = { "Cache-Control": "no-store", ...headers };
  if (token) reqHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) reqHeaders["Content-Type"] = "application/json";
  const response = await fetch(`${API}${path}`, {
    method,
    headers: reqHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { parse_error: true };
  }
  return { status: response.status, payload };
}

async function main() {
  const allow =
    process.env.CARE_GAP_ALLOW_LIVE_INTEGRATION?.trim() === "1" ||
    loadEnvLocal().CARE_GAP_ALLOW_LIVE_INTEGRATION?.trim() === "1";
  if (!allow) {
    log("RC_T08_GATE", "BLOCKED", "set CARE_GAP_ALLOW_LIVE_INTEGRATION=1");
    process.exit(2);
  }

  const env = loadEnvLocal();
  if ((env.ANALYSIS_MODE ?? "").trim() !== "replay") {
    log("RC_T08_MODE", "BLOCKED", "ANALYSIS_MODE must be replay");
    process.exit(2);
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const secret = env.SUPABASE_SECRET_KEY?.trim();
  const email = env.TEST_USER_A_EMAIL?.trim();
  const password = env.TEST_USER_A_PASSWORD?.trim();
  if (!url?.includes("supabase.co") || !publishable || !secret || !email || !password) {
    log("RC_T08_ENV", "BLOCKED", "missing supabase/test user env");
    process.exit(2);
  }

  let failures = 0;
  const auth = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const signed = await auth.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) {
    log("RC_T08_AUTH", "FAIL", "password login failed");
    process.exit(1);
  }
  const token = signed.data.session.access_token;
  const userId = signed.data.user.id;
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const alias = `합성-${String(50 + Math.floor(Math.random() * 9)).padStart(3, "0")}`;
  const created = await jsonFetch("/api/cases", {
    method: "POST",
    token,
    body: { alias },
  });
  if (created.status !== 201) {
    log("RC_T08", "BLOCKED", `temp case status=${created.status}`);
    process.exit(1);
  }
  const caseId = created.payload.data.id;
  const n1 = await jsonFetch(`/api/cases/${caseId}/consultations`, {
    method: "POST",
    token,
    body: {
      occurred_on: "2026-03-01",
      channel: "phone",
      body: "T08 이전 합성 원문입니다.",
    },
  });
  const n2 = await jsonFetch(`/api/cases/${caseId}/consultations`, {
    method: "POST",
    token,
    body: {
      occurred_on: "2026-03-02",
      channel: "phone",
      body: "T08 현재 합성 원문입니다.",
    },
  });
  if (n1.status !== 201 || n2.status !== 201) {
    log("RC_T08", "BLOCKED", `notes n1=${n1.status} n2=${n2.status}`);
    process.exit(1);
  }

  const processingId = randomUUID();
  const keySame = randomUUID();
  const insert = await admin.from("analyses").insert({
    id: processingId,
    case_id: caseId,
    owner_id: userId,
    previous_note_id: n1.payload.data.id,
    current_note_id: n2.payload.data.id,
    idempotency_key: keySame,
    mode: "replay",
    status: "processing",
    schema_version: "1.0",
    model: null,
    result: null,
    failure_code: null,
    completed_at: null,
  });
  if (insert.error) {
    log("RC_T08", "FAIL", "could not seed processing row");
    process.exit(1);
  }

  const sameKey = await jsonFetch(`/api/cases/${caseId}/analyses`, {
    method: "POST",
    token,
    headers: { "Idempotency-Key": keySame },
    body: {},
  });
  const otherKey = await jsonFetch(`/api/cases/${caseId}/analyses`, {
    method: "POST",
    token,
    headers: { "Idempotency-Key": randomUUID() },
    body: {},
  });

  const sameOk =
    sameKey.status === 202 &&
    sameKey.payload?.data?.id === processingId &&
    sameKey.payload?.data?.status === "processing";
  const otherOk =
    otherKey.status === 409 &&
    otherKey.payload?.error?.code === "ANALYSIS_IN_PROGRESS";

  if (
    !log(
      "T08_PROCESSING_SAME_KEY",
      sameOk ? "PASS" : "FAIL",
      `status=${sameKey.status}, idMatch=${sameKey.payload?.data?.id === processingId}`,
    )
  ) {
    failures += 1;
  }
  if (
    !log(
      "T08_PROCESSING_OTHER_KEY",
      otherOk ? "PASS" : "FAIL",
      `status=${otherKey.status}, code=${otherKey.payload?.error?.code}`,
    )
  ) {
    failures += 1;
  }

  // Cleanup: fail the processing row so the temp case does not block later demos.
  await admin
    .from("analyses")
    .update({
      status: "failed",
      failure_code: "TIMEOUT",
      completed_at: new Date().toISOString(),
    })
    .eq("id", processingId)
    .eq("status", "processing");

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`RC_T08_FATAL | FAIL | ${String(error.message ?? error)}`);
  process.exit(1);
});
