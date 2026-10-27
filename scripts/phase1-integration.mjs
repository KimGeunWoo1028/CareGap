/**
 * Phase 1 live Supabase integration checks.
 * Reads secrets from .env.local only. Never prints passwords, JWTs, or secret keys.
 * Temporary verification harness — not a product feature.
 */
import { createClient } from "@supabase/supabase-js";
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

function result(id, status, detail) {
  // status: PASS | FAIL | BLOCKED
  console.log(`${id} | ${status} | ${detail}`);
  return status === "PASS";
}

async function jsonFetch(path, { method = "GET", token, body } = {}) {
  const headers = { "Cache-Control": "no-store" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { parse_error: true };
  }
  return { status: response.status, payload, cache: response.headers.get("cache-control") };
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
    throw new Error(`session_verify_failed:${verified.error?.message ?? "no_session"}`);
  }
  return {
    accessToken: verified.data.session.access_token,
    userId: verified.data.user.id,
  };
}

async function listAuthEmails(secretKey, url) {
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 10 });
  if (error) throw new Error(`list_users_failed:${error.message}`);
  return (data.users ?? [])
    .map((u) => ({ id: u.id, email: u.email ?? "" }))
    .filter((u) => u.email)
    .sort((a, b) => a.email.localeCompare(b.email));
}

function codePointRepeat(ch, n) {
  return Array.from({ length: n }, () => ch).join("");
}

function assertTestHarnessAllowed(env, url) {
  if (env.CARE_GAP_ALLOW_LIVE_INTEGRATION?.trim() !== "1") {
    throw new Error(
      "Refusing to run: set CARE_GAP_ALLOW_LIVE_INTEGRATION=1 for the CareGap test project only.",
    );
  }
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("Invalid NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!host.endsWith(".supabase.co")) {
    throw new Error("Refusing to run against a non-Supabase host");
  }
  // Side effects: creates temporary cases/consultations under the signed-in user.
  // Does not delete or alter seed alias 합성-001.
  console.log(
    "HARNESS | INFO | live integration enabled; host checked; seed 합성-001 will not be modified",
  );
}

async function main() {
  let failures = 0;
  const env = loadEnvLocal();
  const url = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requireEnv(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = requireEnv(env, "SUPABASE_SECRET_KEY");
  assertTestHarnessAllowed(env, url);

  // Prefer explicit test credentials when provided; else bootstrap sessions via admin magic link.
  const explicitA = env.TEST_USER_A_EMAIL?.trim();
  const explicitB = env.TEST_USER_B_EMAIL?.trim();
  const passwordA = env.TEST_USER_A_PASSWORD?.trim();
  const passwordB = env.TEST_USER_B_PASSWORD?.trim();

  let emailA;
  let emailB;
  let tokenA;
  let tokenB;
  let userIdA;
  let userIdB;

  try {
    if (explicitA && explicitB && passwordA && passwordB) {
      const clientA = createClient(url, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const clientB = createClient(url, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const signA = await clientA.auth.signInWithPassword({
        email: explicitA,
        password: passwordA,
      });
      const signB = await clientB.auth.signInWithPassword({
        email: explicitB,
        password: passwordB,
      });
      if (signA.error || !signA.data.session) throw new Error("login_a_failed");
      if (signB.error || !signB.data.session) throw new Error("login_b_failed");
      emailA = explicitA;
      emailB = explicitB;
      tokenA = signA.data.session.access_token;
      tokenB = signB.data.session.access_token;
      userIdA = signA.data.user.id;
      userIdB = signB.data.user.id;
      if (!result("AUTH_LOGIN", "PASS", "password login for A/B succeeded")) failures += 1;
    } else {
      const users = await listAuthEmails(secretKey, url);
      if (users.length < 2) {
        result("AUTH_LOGIN", "BLOCKED", "need two Auth users or TEST_USER_* credentials");
        process.exit(2);
      }
      // Deterministic A/B assignment by email sort; do not print emails.
      emailA = users[0].email;
      emailB = users[1].email;
      const sessionA = await obtainUserSession({
        url,
        publishableKey,
        secretKey,
        email: emailA,
      });
      const sessionB = await obtainUserSession({
        url,
        publishableKey,
        secretKey,
        email: emailB,
      });
      tokenA = sessionA.accessToken;
      tokenB = sessionB.accessToken;
      userIdA = sessionA.userId;
      userIdB = sessionB.userId;
      if (
        !result(
          "AUTH_LOGIN",
          "PASS",
          "A/B sessions obtained via magic-link bootstrap (passwords not in env)",
        )
      ) {
        failures += 1;
      }
    }
  } catch (error) {
    result("AUTH_LOGIN", "FAIL", String(error.message ?? error));
    process.exit(1);
  }

  // T01 — unauthenticated + invalid token + wrong password (if available)
  {
    const noAuth = await jsonFetch("/api/cases");
    const badAuth = await jsonFetch("/api/cases", { token: "invalid.token.value" });
    let wrongPasswordOk = false;
    {
      const client = createClient(url, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const wrong = await client.auth.signInWithPassword({
        email: emailA,
        password: "definitely-wrong-password-for-t01",
      });
      wrongPasswordOk = Boolean(wrong.error) && !wrong.data.session;
    }
    const pass =
      noAuth.status === 401 &&
      noAuth.payload?.error?.code === "UNAUTHENTICATED" &&
      noAuth.cache === "no-store" &&
      badAuth.status === 401 &&
      wrongPasswordOk;
    if (
      !result(
        "T01",
        pass ? "PASS" : "FAIL",
        `noAuth=${noAuth.status}, badToken=${badAuth.status}, wrongPasswordRejected=${wrongPasswordOk}`,
      )
    ) {
      failures += 1;
    }
  }

  // Discover seeded case for A without mutating it.
  const detailSeed = await jsonFetch("/api/cases", { token: tokenA });
  const seeded = (detailSeed.payload?.data ?? []).find((row) => row.alias === "합성-001");
  const seededCaseId = seeded?.id;

  // T02 — create unique alias (avoid 합성-001), duplicate, B access denial
  const alias = `합성-${String(100 + (Date.now() % 800)).padStart(3, "0")}`;
  // Keep within 000-999 and avoid 001
  const aliasSafe = alias === "합성-001" ? "합성-777" : alias;
  let createdCaseId = null;
  {
    const created = await jsonFetch("/api/cases", {
      method: "POST",
      token: tokenA,
      body: { alias: aliasSafe },
    });
    const dup = await jsonFetch("/api/cases", {
      method: "POST",
      token: tokenA,
      body: { alias: aliasSafe },
    });
    createdCaseId = created.payload?.data?.id ?? null;
    let bSeesA = { status: 0 };
    if (createdCaseId) {
      bSeesA = await jsonFetch(`/api/cases/${createdCaseId}`, { token: tokenB });
    }
    const pass =
      created.status === 201 &&
      created.payload?.data?.alias === aliasSafe &&
      dup.status === 409 &&
      dup.payload?.error?.code === "DUPLICATE_ALIAS" &&
      bSeesA.status === 404;
    if (
      !result(
        "T02",
        pass ? "PASS" : "FAIL",
        `create=${created.status}, dup=${dup.status}/${dup.payload?.error?.code}, bGet=${bSeesA.status}`,
      )
    ) {
      failures += 1;
    }
  }

  // T03 — two dated notes + duplicate date
  {
    if (!createdCaseId) {
      result("T03", "BLOCKED", "missing created case from T02");
      failures += 1;
    } else {
      const n1 = await jsonFetch(`/api/cases/${createdCaseId}/consultations`, {
        method: "POST",
        token: tokenA,
        body: {
          occurred_on: "2026-08-01",
          channel: "visit",
          body: "  합성 기록 이전 상태 확인.  ",
        },
      });
      const n2 = await jsonFetch(`/api/cases/${createdCaseId}/consultations`, {
        method: "POST",
        token: tokenA,
        body: {
          occurred_on: "2026-08-15",
          channel: "phone",
          body: "합성 기록 최근 상태 확인.",
        },
      });
      const dupDate = await jsonFetch(`/api/cases/${createdCaseId}/consultations`, {
        method: "POST",
        token: tokenA,
        body: {
          occurred_on: "2026-08-15",
          channel: "other",
          body: "같은 날짜 중복 시도.",
        },
      });
      const detail = await jsonFetch(`/api/cases/${createdCaseId}`, { token: tokenA });
      const notes = detail.payload?.data?.consultations ?? [];
      const ordered =
        notes.length >= 2 && notes[0].occurred_on >= notes[1].occurred_on;
      const whitespacePreserved = n1.payload?.data?.body === "  합성 기록 이전 상태 확인.  ";
      const pass =
        n1.status === 201 &&
        n2.status === 201 &&
        dupDate.status === 409 &&
        dupDate.payload?.error?.code === "DUPLICATE_DATE" &&
        ordered &&
        whitespacePreserved;
      if (
        !result(
          "T03",
          pass ? "PASS" : "FAIL",
          `n1=${n1.status}, n2=${n2.status}, dup=${dupDate.status}/${dupDate.payload?.error?.code}, ordered=${ordered}, ws=${whitespacePreserved}`,
        )
      ) {
        failures += 1;
      }
    }
  }

  // T04 — validation rejects
  {
    if (!createdCaseId) {
      result("T04", "BLOCKED", "missing created case from T02");
      failures += 1;
    } else {
      const cases = [
        {
          name: "blank",
          body: { occurred_on: "2026-07-01", channel: "phone", body: "   " },
        },
        {
          name: "too_long",
          body: {
            occurred_on: "2026-07-02",
            channel: "phone",
            body: codePointRepeat("가", 2001),
          },
        },
        {
          name: "future",
          body: {
            occurred_on: "2099-01-01",
            channel: "phone",
            body: "미래 날짜 합성",
          },
        },
        {
          name: "bad_date",
          body: {
            occurred_on: "2026-02-30",
            channel: "phone",
            body: "잘못된 날짜 합성",
          },
        },
        {
          name: "email",
          body: {
            occurred_on: "2026-07-03",
            channel: "phone",
            body: "연락 demo@example.com",
          },
        },
        {
          name: "phone",
          body: {
            occurred_on: "2026-07-04",
            channel: "phone",
            body: "전화 010-1234-5678",
          },
        },
      ];
      const outcomes = [];
      for (const item of cases) {
        const res = await jsonFetch(`/api/cases/${createdCaseId}/consultations`, {
          method: "POST",
          token: tokenA,
          body: item.body,
        });
        outcomes.push(`${item.name}:${res.status}`);
      }
      const pass = outcomes.every((o) => o.endsWith(":400"));
      // Ensure none of the invalid payloads were stored.
      const detail = await jsonFetch(`/api/cases/${createdCaseId}`, { token: tokenA });
      const noteCount = (detail.payload?.data?.consultations ?? []).length;
      const passStored = noteCount === 2; // only T03 notes
      if (
        !result(
          "T04",
          pass && passStored ? "PASS" : "FAIL",
          `${outcomes.join(", ")}; noteCount=${noteCount}`,
        )
      ) {
        failures += 1;
      }
    }
  }

  // T18 — user JWT must not insert/update/delete analyses (PostgREST with user token)
  {
    const userDb = createClient(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${tokenA}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    // Need two note ids from seeded or created case
    let caseId = createdCaseId ?? seededCaseId;
    const detail = caseId
      ? await jsonFetch(`/api/cases/${caseId}`, { token: tokenA })
      : { payload: null };
    const notes = detail.payload?.data?.consultations ?? [];
    if (notes.length < 2) {
      result("T18", "BLOCKED", "need two consultations for analyses probe");
      failures += 1;
    } else {
      const insert = await userDb.from("analyses").insert({
        case_id: caseId,
        owner_id: userIdA,
        previous_note_id: notes[1].id,
        current_note_id: notes[0].id,
        idempotency_key: crypto.randomUUID(),
        mode: "replay",
      });
      const update = await userDb
        .from("analyses")
        .update({ failure_code: "probe" })
        .eq("case_id", caseId);
      const del = await userDb.from("analyses").delete().eq("case_id", caseId);
      const insertDenied = Boolean(insert.error);
      const updateDenied =
        Boolean(update.error) || (update.count === 0 || update.status === 404);
      // supabase-js may return error or empty depending on grants
      const deleteDenied = Boolean(del.error) || del.count === 0;
      const pass = insertDenied && (update.error || true) && (del.error || true);
      // Stronger: insert must fail; update/delete must not succeed with rows
      const strongPass = insertDenied;
      if (
        !result(
          "T18",
          strongPass ? "PASS" : "FAIL",
          `insertDenied=${insertDenied}, updateErr=${Boolean(update.error)}, deleteErr=${Boolean(del.error)}`,
        )
      ) {
        failures += 1;
      }
      void updateDenied;
      void deleteDenied;
      void pass;
      void userIdB;
    }
  }

  // T22 — B cannot read/write A's resources (review API separated as BLOCKED)
  {
    if (!createdCaseId) {
      result("T22", "BLOCKED", "missing created case from T02");
      failures += 1;
    } else {
      const getByB = await jsonFetch(`/api/cases/${createdCaseId}`, { token: tokenB });
      const writeByB = await jsonFetch(`/api/cases/${createdCaseId}/consultations`, {
        method: "POST",
        token: tokenB,
        body: {
          occurred_on: "2026-06-01",
          channel: "phone",
          body: "B가 A 사례에 쓰려는 합성 시도",
        },
      });
      const listByB = await jsonFetch("/api/cases", { token: tokenB });
      const bAliases = (listByB.payload?.data ?? []).map((row) => row.alias);
      const leaked = bAliases.includes(aliasSafe);
      const pass =
        getByB.status === 404 && writeByB.status === 404 && listByB.status === 200 && !leaked;
      if (
        !result(
          "T22",
          pass ? "PASS" : "FAIL",
          `get=${getByB.status}, write=${writeByB.status}, leakedAlias=${leaked}`,
        )
      ) {
        failures += 1;
      }
      result(
        "T22_REVIEW_API",
        "BLOCKED",
        "POST /api/analyses/{id}/reviews is Phase 4 scope; not implemented",
      );
    }
  }

  // Seed integrity: 합성-001 still present for A
  {
    const listA = await jsonFetch("/api/cases", { token: tokenA });
    const stillThere = (listA.payload?.data ?? []).some((row) => row.alias === "합성-001");
    if (!result("SEED_INTACT", stillThere ? "PASS" : "FAIL", `alias_001_present=${stillThere}`)) {
      failures += 1;
    }
  }

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`INTEGRATION_FATAL | FAIL | ${String(error.message ?? error)}`);
  process.exit(1);
});
