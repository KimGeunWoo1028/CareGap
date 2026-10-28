/**
 * Phase 4 live Supabase checks: analysis create/get/review.
 * Never prints passwords, JWTs, secret keys, or consultation bodies.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

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

function result(id, status, detail) {
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
    cache: response.headers.get("cache-control"),
    retryAfter: response.headers.get("retry-after"),
  };
}

async function obtainUserSession({ url, publishableKey, secretKey, email }) {
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error(`session_bootstrap_failed:${error?.message ?? "no_token_hash"}`);
  }
  const userClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const verified = await userClient.auth.verifyOtp({
    type: "email",
    token_hash: data.properties.hashed_token,
  });
  if (verified.error || !verified.data.session?.access_token) {
    throw new Error(`otp_failed:${verified.error?.message ?? "no_session"}`);
  }
  return {
    token: verified.data.session.access_token,
    userId: verified.data.user.id,
  };
}

async function main() {
  {
    const envPreview = loadEnvLocal();
    const allow =
      process.env.CARE_GAP_ALLOW_LIVE_INTEGRATION?.trim() === "1" ||
      envPreview.CARE_GAP_ALLOW_LIVE_INTEGRATION?.trim() === "1";
    if (!allow) {
      console.log(
        "PHASE4_GATE | BLOCKED | set CARE_GAP_ALLOW_LIVE_INTEGRATION=1 for the CareGap test project only.",
      );
      process.exit(2);
    }
  }

  const env = loadEnvLocal();
  const url = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requireEnv(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = requireEnv(env, "SUPABASE_SECRET_KEY");
  if (!url.includes("supabase.co")) {
    throw new Error("Refusing non-supabase.co host");
  }
  if ((env.ANALYSIS_MODE ?? "").trim() !== "replay") {
    console.log(
      "PHASE4_MODE | BLOCKED | ANALYSIS_MODE must be replay for this harness (no live OpenAI spend).",
    );
    process.exit(2);
  }

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: listData, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 50,
  });
  if (listError) throw listError;
  const users = (listData?.users ?? [])
    .map((u) => ({ id: u.id, email: u.email ?? "" }))
    .filter((u) => u.email)
    .sort((a, b) => a.email.localeCompare(b.email));
  if (users.length < 1) {
    result("AUTH", "BLOCKED", "no auth users");
    process.exit(1);
  }

  const sessionA = await obtainUserSession({
    url,
    publishableKey,
    secretKey,
    email: users[0].email,
  });
  const tokenA = sessionA.token;
  const tokenB =
    users.length > 1
      ? (
          await obtainUserSession({
            url,
            publishableKey,
            secretKey,
            email: users[1].email,
          })
        ).token
      : null;

  let failures = 0;

  const cases = await jsonFetch("/api/cases", { token: tokenA });
  const seed = (cases.payload?.data ?? []).find((row) => row.alias === "합성-001");
  if (!seed) {
    result("SEED", "BLOCKED", "합성-001 missing for user A");
    process.exit(1);
  }

  const detail = await jsonFetch(`/api/cases/${seed.id}`, { token: tokenA });
  const notes = detail.payload?.data?.consultations ?? [];
  if (notes.length < 2) {
    result("T05", "BLOCKED", "seed case needs two consultations");
    process.exit(1);
  }

  // T05 — not enough records on a fresh empty-ish temp case
  {
    const alias = `합성-${String(90 + Math.floor(Math.random() * 9)).padStart(3, "0")}`;
    const created = await jsonFetch("/api/cases", {
      method: "POST",
      token: tokenA,
      body: { alias },
    });
    if (created.status !== 201) {
      // collision — skip rather than mutate seed
      result("T05", "BLOCKED", `temp case create status=${created.status}`);
    } else {
      const key = randomUUID();
      const res = await jsonFetch(`/api/cases/${created.payload.data.id}/analyses`, {
        method: "POST",
        token: tokenA,
        headers: { "Idempotency-Key": key },
        body: {},
      });
      if (
        !result(
          "T05",
          res.status === 422 && res.payload?.error?.code === "NOT_ENOUGH_RECORDS"
            ? "PASS"
            : "FAIL",
          `status=${res.status}, code=${res.payload?.error?.code ?? "none"}`,
        )
      ) {
        failures += 1;
      }
    }
  }

  // Replay create → get → review on seed 합성-001
  const key1 = randomUUID();
  const create1 = await jsonFetch(`/api/cases/${seed.id}/analyses`, {
    method: "POST",
    token: tokenA,
    headers: { "Idempotency-Key": key1 },
    body: {},
  });

  const createOk =
    create1.status === 201 &&
    create1.payload?.data?.status === "succeeded" &&
    create1.payload?.data?.mode === "replay" &&
    create1.payload?.data?.result?.analysis &&
    Array.isArray(create1.payload?.data?.result?.recommendations) &&
    create1.cache === "no-store";

  if (
    !result(
      "T15_REPLAY_CREATE",
      createOk ? "PASS" : create1.status === 422 ? "FAIL" : "FAIL",
      `status=${create1.status}, analysisStatus=${create1.payload?.data?.status ?? create1.payload?.error?.code}`,
    )
  ) {
    failures += 1;
  }

  const analysisId = create1.payload?.data?.id;
  if (analysisId) {
    const again = await jsonFetch(`/api/cases/${seed.id}/analyses`, {
      method: "POST",
      token: tokenA,
      headers: { "Idempotency-Key": key1 },
      body: {},
    });
    if (
      !result(
        "T07",
        again.status === 200 && again.payload?.data?.id === analysisId ? "PASS" : "FAIL",
        `status=${again.status}`,
      )
    ) {
      failures += 1;
    }

    const got = await jsonFetch(`/api/analyses/${analysisId}`, { token: tokenA });
    if (
      !result(
        "GET_ANALYSIS",
        got.status === 200 && got.payload?.data?.id === analysisId ? "PASS" : "FAIL",
        `status=${got.status}, is_current=${got.payload?.data?.is_current}`,
      )
    ) {
      failures += 1;
    }

    const review = await jsonFetch(`/api/analyses/${analysisId}/reviews`, {
      method: "POST",
      token: tokenA,
      body: { decision: "needs_followup", note: "합성 통합 검토" },
    });
    const dup = await jsonFetch(`/api/analyses/${analysisId}/reviews`, {
      method: "POST",
      token: tokenA,
      body: { decision: "confirmed", note: "" },
    });
    if (
      !result(
        "T14",
        review.status === 201 &&
          dup.status === 409 &&
          dup.payload?.error?.code === "REVIEW_EXISTS"
          ? "PASS"
          : "FAIL",
        `review=${review.status}, dup=${dup.status}/${dup.payload?.error?.code}`,
      )
    ) {
      failures += 1;
    }

    if (tokenB) {
      const leak = await jsonFetch(`/api/analyses/${analysisId}`, { token: tokenB });
      if (
        !result(
          "T22_ANALYSIS",
          leak.status === 404 ? "PASS" : "FAIL",
          `status=${leak.status}`,
        )
      ) {
        failures += 1;
      }
    } else {
      result("T22_ANALYSIS", "BLOCKED", "need second auth user");
    }
  }

  // Idempotency conflict: same key, different case
  {
    const alias = `합성-${String(80 + Math.floor(Math.random() * 9)).padStart(3, "0")}`;
    const created = await jsonFetch("/api/cases", {
      method: "POST",
      token: tokenA,
      body: { alias },
    });
    if (created.status === 201 && analysisId) {
      // add two notes so reservation can proceed far enough to hit key conflict first
      await jsonFetch(`/api/cases/${created.payload.data.id}/consultations`, {
        method: "POST",
        token: tokenA,
        body: {
          occurred_on: "2026-01-01",
          channel: "phone",
          body: "임시 이전 합성 원문입니다.",
        },
      });
      await jsonFetch(`/api/cases/${created.payload.data.id}/consultations`, {
        method: "POST",
        token: tokenA,
        body: {
          occurred_on: "2026-01-02",
          channel: "phone",
          body: "임시 현재 합성 원문입니다.",
        },
      });
      const conflict = await jsonFetch(
        `/api/cases/${created.payload.data.id}/analyses`,
        {
          method: "POST",
          token: tokenA,
          headers: { "Idempotency-Key": key1 },
          body: {},
        },
      );
      if (
        !result(
          "T08_KEY_CASE",
          conflict.status === 409 &&
            conflict.payload?.error?.code === "IDEMPOTENCY_CONFLICT"
            ? "PASS"
            : "FAIL",
          `status=${conflict.status}, code=${conflict.payload?.error?.code}`,
        )
      ) {
        failures += 1;
      }
    } else {
      result("T08_KEY_CASE", "BLOCKED", "could not create temp case");
    }
  }

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`INTEGRATION_FATAL | FAIL | ${String(error.message ?? error)}`);
  process.exit(1);
});
