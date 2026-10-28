/**
 * Phase 6 Replay rehearsal ×3 against CareGap test Supabase.
 * Uses TEST_USER_* password login when present. Never prints secrets, JWTs, or note bodies.
 * Does not call OpenAI; requires ANALYSIS_MODE=replay.
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

function requireEnv(env, key) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing ${key}`);
  return value;
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
  return {
    status: response.status,
    payload,
    requestId:
      payload?.meta?.request_id ??
      payload?.error?.request_id ??
      response.headers.get("x-request-id"),
  };
}

async function passwordLogin(url, publishableKey, email, password) {
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session?.access_token) {
    throw new Error("password_login_failed");
  }
  return {
    token: signed.data.session.access_token,
    userId: signed.data.user.id,
  };
}

async function main() {
  if (process.env.CARE_GAP_ALLOW_LIVE_INTEGRATION?.trim() !== "1") {
    log(
      "PHASE6_GATE",
      "BLOCKED",
      "set CARE_GAP_ALLOW_LIVE_INTEGRATION=1 for the CareGap test project only",
    );
    process.exit(2);
  }

  const env = loadEnvLocal();
  const url = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requireEnv(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!url.includes("supabase.co")) {
    throw new Error("Refusing non-supabase.co host");
  }
  if ((env.ANALYSIS_MODE ?? "").trim() !== "replay") {
    log("PHASE6_MODE", "BLOCKED", "ANALYSIS_MODE must remain replay (no live OpenAI)");
    process.exit(2);
  }

  const emailA = env.TEST_USER_A_EMAIL?.trim();
  const passwordA = env.TEST_USER_A_PASSWORD?.trim();
  const emailB = env.TEST_USER_B_EMAIL?.trim();
  const passwordB = env.TEST_USER_B_PASSWORD?.trim();
  if (!emailA || !passwordA || !emailB || !passwordB) {
    log("AUTH_PASSWORD", "BLOCKED", "TEST_USER_A/B email+password required");
    process.exit(2);
  }

  let failures = 0;
  const started = Date.now();

  let sessionA;
  let sessionB;
  try {
    sessionA = await passwordLogin(url, publishableKey, emailA, passwordA);
    sessionB = await passwordLogin(url, publishableKey, emailB, passwordB);
    log("AUTH_PASSWORD", "PASS", "A/B password login succeeded (credentials not logged)");
  } catch (error) {
    log("AUTH_PASSWORD", "FAIL", String(error.message ?? error));
    process.exit(1);
  }

  {
    const wrong = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const bad = await wrong.auth.signInWithPassword({
      email: emailA,
      password: "definitely-wrong-password-for-phase6",
    });
    if (
      !log(
        "T01_WRONG_PASSWORD",
        bad.error && !bad.data.session ? "PASS" : "FAIL",
        `rejected=${Boolean(bad.error)}`,
      )
    ) {
      failures += 1;
    }
  }

  const listA = await jsonFetch("/api/cases", { token: sessionA.token });
  const seed = (listA.payload?.data ?? []).find((row) => row.alias === "합성-001");
  if (!seed) {
    log("SEED", "FAIL", "합성-001 missing for user A");
    process.exit(1);
  }

  const detail = await jsonFetch(`/api/cases/${seed.id}`, { token: sessionA.token });
  const notes = detail.payload?.data?.consultations ?? [];
  const dates = notes.map((n) => n.occurred_on).sort();
  const hasPair =
    notes.length >= 2 &&
    dates.includes("2026-09-10") &&
    dates.includes("2026-10-10");
  if (
    !log(
      "SEED_PAIR",
      hasPair ? "PASS" : "FAIL",
      `noteCount=${notes.length}, hasDemoDates=${hasPair}`,
    )
  ) {
    failures += 1;
  }

  // Isolation: B cannot read A seed case / analyses
  {
    const leakCase = await jsonFetch(`/api/cases/${seed.id}`, { token: sessionB.token });
    if (
      !log(
        "T22_CASE",
        leakCase.status === 404 ? "PASS" : "FAIL",
        `status=${leakCase.status}`,
      )
    ) {
      failures += 1;
    }
  }

  const runs = [];
  for (let i = 1; i <= 3; i += 1) {
    const t0 = Date.now();
    const key = randomUUID();
    const create = await jsonFetch(`/api/cases/${seed.id}/analyses`, {
      method: "POST",
      token: sessionA.token,
      headers: { "Idempotency-Key": key },
      body: {},
    });
    const analysis = create.payload?.data;
    const okCreate =
      create.status === 201 &&
      analysis?.status === "succeeded" &&
      analysis?.mode === "replay" &&
      analysis?.result?.analysis?.changes?.length === 4;

    const domains = (analysis?.result?.analysis?.changes ?? []).map((c) => c.domain);
    const domainOk =
      ["meal", "mobility", "health", "environment"].every((d) => domains.includes(d));

    let reviewStatus = null;
    let dupStatus = null;
    let dupCode = null;
    if (okCreate && analysis?.id) {
      const review = await jsonFetch(`/api/analyses/${analysis.id}/reviews`, {
        method: "POST",
        token: sessionA.token,
        body: {
          decision: "needs_followup",
          note: `phase6 rehearsal ${i}`,
        },
      });
      reviewStatus = review.status;
      const dup = await jsonFetch(`/api/analyses/${analysis.id}/reviews`, {
        method: "POST",
        token: sessionA.token,
        body: { decision: "confirmed", note: "" },
      });
      dupStatus = dup.status;
      dupCode = dup.payload?.error?.code ?? null;

      const leak = await jsonFetch(`/api/analyses/${analysis.id}`, {
        token: sessionB.token,
      });
      const reviewLeak = await jsonFetch(`/api/analyses/${analysis.id}/reviews`, {
        method: "POST",
        token: sessionB.token,
        body: { decision: "confirmed", note: "should fail" },
      });
      if (
        !log(
          `T22_ANALYSIS_R${i}`,
          leak.status === 404 && reviewLeak.status === 404 ? "PASS" : "FAIL",
          `get=${leak.status}, review=${reviewLeak.status}`,
        )
      ) {
        failures += 1;
      }
    }

    const ms = Date.now() - t0;
    const runOk =
      okCreate &&
      domainOk &&
      reviewStatus === 201 &&
      dupStatus === 409 &&
      dupCode === "REVIEW_EXISTS";
    runs.push({
      run: i,
      ok: runOk,
      analysisId: analysis?.id ?? null,
      requestId: create.requestId ?? null,
      ms,
      mode: analysis?.mode ?? null,
      createStatus: create.status,
      reviewStatus,
      dupStatus,
      dupCode,
    });
    if (
      !log(
        `REPLAY_RUN_${i}`,
        runOk ? "PASS" : "FAIL",
        `analysis_id=${analysis?.id ?? "none"}, request_id=${create.requestId ?? "none"}, ms=${ms}, mode=${analysis?.mode ?? "none"}, review=${reviewStatus}, dup=${dupStatus}/${dupCode}`,
      )
    ) {
      failures += 1;
    }
  }

  const allOk = runs.every((r) => r.ok);
  log(
    "REPLAY_X3",
    allOk ? "PASS" : "FAIL",
    `runs=${runs.length}, elapsed_ms=${Date.now() - started}`,
  );

  // Direct analyses write probe (T18) on seed case — user JWT only
  {
    const userDb = createClient(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${sessionA.token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const insert = await userDb.from("analyses").insert({
      case_id: seed.id,
      owner_id: sessionA.userId,
      previous_note_id: notes[1]?.id,
      current_note_id: notes[0]?.id,
      idempotency_key: randomUUID(),
      mode: "replay",
    });
    if (
      !log(
        "T18",
        insert.error ? "PASS" : "FAIL",
        `insertDenied=${Boolean(insert.error)}`,
      )
    ) {
      failures += 1;
    }
  }

  // T06 — isolated temp case: analysis on first pair becomes not current after a 3rd note.
  // Does not mutate 합성-001. Uses service role only to insert a finished analysis row
  // (no OpenAI). is_current is computed on GET.
  {
    const secretKey = requireEnv(env, "SUPABASE_SECRET_KEY");
    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const alias = `합성-${String(70 + Math.floor(Math.random() * 9)).padStart(3, "0")}`;
    const created = await jsonFetch("/api/cases", {
      method: "POST",
      token: sessionA.token,
      body: { alias },
    });
    if (created.status !== 201) {
      log("T06", "BLOCKED", `temp case create status=${created.status}`);
    } else {
      const caseId = created.payload.data.id;
      const n1 = await jsonFetch(`/api/cases/${caseId}/consultations`, {
        method: "POST",
        token: sessionA.token,
        body: {
          occurred_on: "2026-01-01",
          channel: "phone",
          body: "T06 이전 합성 원문입니다.",
        },
      });
      const n2 = await jsonFetch(`/api/cases/${caseId}/consultations`, {
        method: "POST",
        token: sessionA.token,
        body: {
          occurred_on: "2026-01-02",
          channel: "phone",
          body: "T06 현재 합성 원문입니다.",
        },
      });
      if (n1.status !== 201 || n2.status !== 201) {
        log("T06", "BLOCKED", `notes status n1=${n1.status} n2=${n2.status}`);
      } else {
        const analysisId = randomUUID();
        const insert = await admin.from("analyses").insert({
          id: analysisId,
          case_id: caseId,
          owner_id: sessionA.userId,
          previous_note_id: n1.payload.data.id,
          current_note_id: n2.payload.data.id,
          idempotency_key: randomUUID(),
          mode: "replay",
          status: "succeeded",
          schema_version: "1.0",
          model: null,
          result: {
            analysis: {
              schema_version: "1.0",
              summary: "T06 isolated fixture",
              changes: [],
              questions: [],
            },
            recommendations: [],
          },
          failure_code: null,
          completed_at: new Date().toISOString(),
        });
        const before = await jsonFetch(`/api/analyses/${analysisId}`, {
          token: sessionA.token,
        });
        const n3 = await jsonFetch(`/api/cases/${caseId}/consultations`, {
          method: "POST",
          token: sessionA.token,
          body: {
            occurred_on: "2026-01-03",
            channel: "phone",
            body: "T06 세 번째 합성 원문입니다.",
          },
        });
        const after = await jsonFetch(`/api/analyses/${analysisId}`, {
          token: sessionA.token,
        });
        const pass =
          !insert.error &&
          before.status === 200 &&
          before.payload?.data?.is_current === true &&
          n3.status === 201 &&
          after.status === 200 &&
          after.payload?.data?.is_current === false &&
          after.payload?.data?.previous_note_id === n1.payload.data.id &&
          after.payload?.data?.current_note_id === n2.payload.data.id;
        if (
          !log(
            "T06",
            pass ? "PASS" : "FAIL",
            `insertErr=${Boolean(insert.error)}, before=${before.payload?.data?.is_current}, after=${after.payload?.data?.is_current}, n3=${n3.status}`,
          )
        ) {
          failures += 1;
        }
      }
    }
  }

  // T17 — stale processing (>60s) is terminalized on next reservation for same case.
  {
    const secretKey = requireEnv(env, "SUPABASE_SECRET_KEY");
    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const alias = `합성-${String(60 + Math.floor(Math.random() * 9)).padStart(3, "0")}`;
    const created = await jsonFetch("/api/cases", {
      method: "POST",
      token: sessionA.token,
      body: { alias },
    });
    if (created.status !== 201) {
      log("T17", "BLOCKED", `temp case create status=${created.status}`);
    } else {
      const caseId = created.payload.data.id;
      const n1 = await jsonFetch(`/api/cases/${caseId}/consultations`, {
        method: "POST",
        token: sessionA.token,
        body: {
          occurred_on: "2026-02-01",
          channel: "phone",
          body: "T17 이전 합성 원문입니다.",
        },
      });
      const n2 = await jsonFetch(`/api/cases/${caseId}/consultations`, {
        method: "POST",
        token: sessionA.token,
        body: {
          occurred_on: "2026-02-02",
          channel: "phone",
          body: "T17 현재 합성 원문입니다.",
        },
      });
      if (n1.status !== 201 || n2.status !== 201) {
        log("T17", "BLOCKED", `notes status n1=${n1.status} n2=${n2.status}`);
      } else {
        const staleId = randomUUID();
        const staleCreated = new Date(Date.now() - 90_000).toISOString();
        const insert = await admin.from("analyses").insert({
          id: staleId,
          case_id: caseId,
          owner_id: sessionA.userId,
          previous_note_id: n1.payload.data.id,
          current_note_id: n2.payload.data.id,
          idempotency_key: randomUUID(),
          mode: "replay",
          status: "processing",
          schema_version: "1.0",
          model: null,
          result: null,
          failure_code: null,
          created_at: staleCreated,
          completed_at: null,
        });
        const reserve = await jsonFetch(`/api/cases/${caseId}/analyses`, {
          method: "POST",
          token: sessionA.token,
          headers: { "Idempotency-Key": randomUUID() },
          body: {},
        });
        const staleAfter = await admin
          .from("analyses")
          .select("status,failure_code")
          .eq("id", staleId)
          .maybeSingle();
        // Expect stale row failed/TIMEOUT; new request may be 422 REPLAY_UNAVAILABLE
        // (non-seed texts) but must not be blocked by ANALYSIS_IN_PROGRESS from stale row.
        const staleOk =
          staleAfter.data?.status === "failed" &&
          staleAfter.data?.failure_code === "TIMEOUT";
        const notBlockedByStale =
          reserve.payload?.error?.code !== "ANALYSIS_IN_PROGRESS";
        const pass = !insert.error && staleOk && notBlockedByStale;
        if (
          !log(
            "T17",
            pass ? "PASS" : "FAIL",
            `insertErr=${Boolean(insert.error)}, stale=${staleAfter.data?.status}/${staleAfter.data?.failure_code}, reserve=${reserve.status}/${reserve.payload?.error?.code ?? reserve.payload?.data?.status}`,
          )
        ) {
          failures += 1;
        }
      }
    }
  }

  log(
    "T19",
    "BLOCKED",
    "live-mode rate-limit probe skipped to avoid live reservations and demo quota pollution; SQL limits apply only when mode=live",
  );

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`PHASE6_FATAL | FAIL | ${String(error.message ?? error)}`);
  process.exit(1);
});
