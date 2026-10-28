/**
 * CareGap Test A/B verification for sql/005 review→follow_up atomicity.
 * Uses JWT clients only for positive paths; privileged SQL for rollback probe.
 * Never prints passwords, JWTs, or secret keys.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

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

async function passwordSession(url, publishableKey, email, password) {
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    throw new Error(`login_failed:${error?.message ?? "no_session"}`);
  }
  return {
    token: data.session.access_token,
    userId: data.user.id,
    db: createClient(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  };
}

async function findUnreviewedSucceeded(db, ownerId, limit = 40) {
  const { data: rows, error } = await db
    .from("analyses")
    .select("id, case_id, status")
    .eq("owner_id", ownerId)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const free = [];
  for (const row of rows ?? []) {
    const { data: review } = await db
      .from("reviews")
      .select("id")
      .eq("analysis_id", row.id)
      .maybeSingle();
    if (!review) free.push(row);
  }
  return free;
}

/** Create synthetic succeeded analyses (service role) without touching seed reviews. */
async function ensureUnreviewedFixtures(admin, ownerClient, ownerId, need) {
  let free = await findUnreviewedSucceeded(ownerClient, ownerId);
  if (free.length >= need) return free;

  const { data: caseRow, error: caseErr } = await ownerClient
    .from("cases")
    .select("id")
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();
  if (caseErr || !caseRow) throw new Error(caseErr?.message ?? "owner has no case");

  const { data: notes, error: notesErr } = await ownerClient
    .from("consultations")
    .select("id, occurred_on")
    .eq("case_id", caseRow.id)
    .order("occurred_on", { ascending: true })
    .limit(2);
  if (notesErr || !notes || notes.length < 2) {
    throw new Error(notesErr?.message ?? "case needs ≥2 consultations");
  }

  const missing = need - free.length;
  const rows = [];
  for (let i = 0; i < missing; i += 1) {
    rows.push({
      case_id: caseRow.id,
      owner_id: ownerId,
      previous_note_id: notes[0].id,
      current_note_id: notes[1].id,
      idempotency_key: randomUUID(),
      mode: "replay",
      status: "succeeded",
      schema_version: "1.0",
      model: "fixture-005",
      result: {
        summary: "synthetic fixture for 005 atomicity",
        domains: [],
      },
      completed_at: new Date().toISOString(),
    });
  }
  const { data: inserted, error: insErr } = await admin
    .from("analyses")
    .insert(rows)
    .select("id, case_id, status");
  if (insErr) throw new Error(`fixture_insert:${insErr.message}`);
  free = [...free, ...(inserted ?? [])];
  return free;
}

async function openFollowUps(db, analysisId) {
  const { data, error } = await db
    .from("follow_up_tasks")
    .select("id, analysis_id, kind, status, note")
    .eq("analysis_id", analysisId)
    .eq("kind", "next_consultation")
    .eq("status", "open");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function main() {
  const env = loadEnvLocal();
  const url = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  if (!url.includes("korebhoeetajvelogcrx")) {
    throw new Error("Refusing: not CareGap Test URL");
  }
  const publishable = requireEnv(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const serviceKey =
    env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const emailA = requireEnv(env, "TEST_USER_A_EMAIL");
  const passA = requireEnv(env, "TEST_USER_A_PASSWORD");
  const emailB = requireEnv(env, "TEST_USER_B_EMAIL");
  const passB = requireEnv(env, "TEST_USER_B_PASSWORD");

  let pass = 0;
  let fail = 0;
  let blocked = 0;
  const track = (ok) => {
    if (ok) pass += 1;
    else fail += 1;
  };

  const a = await passwordSession(url, publishable, emailA, passA);
  const b = await passwordSession(url, publishable, emailB, passB);
  track(log("AUTH_A", "PASS", "password session"));
  track(log("AUTH_B", "PASS", "password session"));

  if (!serviceKey) {
    blocked += 1;
    log("FIXTURES", "BLOCKED", "service role required to mint unreviewed analyses");
    console.log(`SUMMARY | PASS=${pass} FAIL=${fail} BLOCKED=${blocked}`);
    process.exit(2);
  }
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let freeA;
  try {
    freeA = await ensureUnreviewedFixtures(admin, a.db, a.userId, 7);
  } catch (err) {
    fail += 1;
    log("FIXTURES", "FAIL", err instanceof Error ? err.message : String(err));
    console.log(`SUMMARY | PASS=${pass} FAIL=${fail} BLOCKED=${blocked}`);
    process.exit(1);
  }
  if (freeA.length < 6) {
    blocked += 1;
    log("FIXTURES", "BLOCKED", `need ≥6 unreviewed; have ${freeA.length}`);
    console.log(`SUMMARY | PASS=${pass} FAIL=${fail} BLOCKED=${blocked}`);
    process.exit(2);
  }
  track(log("FIXTURES", "PASS", `unreviewed_succeeded=${freeA.length}`));

  const [forFollowup, forConfirmed, forRejected, forDupSkip, forConcurrent1, forConcurrent2] =
    freeA;

  // 1) needs_followup → auto-create exactly one open next_consultation
  {
    const before = await openFollowUps(a.db, forFollowup.id);
    const { data: review, error } = await a.db
      .from("reviews")
      .insert({
        analysis_id: forFollowup.id,
        owner_id: a.userId,
        decision: "needs_followup",
        note: "005 atomicity: needs_followup",
      })
      .select("id")
      .single();
    if (error) {
      fail += 1;
      log("NEEDS_FOLLOWUP_INSERT", "FAIL", error.message);
    } else {
      track(log("NEEDS_FOLLOWUP_INSERT", "PASS", "review inserted"));
      const after = await openFollowUps(a.db, forFollowup.id);
      if (before.length === 0 && after.length === 1) {
        track(log("NEEDS_FOLLOWUP_AUTO", "PASS", "exactly one open follow-up created"));
      } else {
        fail += 1;
        log(
          "NEEDS_FOLLOWUP_AUTO",
          "FAIL",
          `before=${before.length} after=${after.length} review=${review?.id}`,
        );
      }
    }
  }

  // 2) confirmed → no follow-up
  {
    const { error } = await a.db.from("reviews").insert({
      analysis_id: forConfirmed.id,
      owner_id: a.userId,
      decision: "confirmed",
      note: "005 atomicity: confirmed",
    });
    if (error) {
      fail += 1;
      log("CONFIRMED_INSERT", "FAIL", error.message);
    } else {
      track(log("CONFIRMED_INSERT", "PASS", "review inserted"));
      const after = await openFollowUps(a.db, forConfirmed.id);
      if (after.length === 0) {
        track(log("CONFIRMED_NO_TASK", "PASS", "no follow-up created"));
      } else {
        fail += 1;
        log("CONFIRMED_NO_TASK", "FAIL", `open=${after.length}`);
      }
    }
  }

  // 3) rejected → no follow-up
  {
    const { error } = await a.db.from("reviews").insert({
      analysis_id: forRejected.id,
      owner_id: a.userId,
      decision: "rejected",
      note: "005 atomicity: rejected",
    });
    if (error) {
      fail += 1;
      log("REJECTED_INSERT", "FAIL", error.message);
    } else {
      track(log("REJECTED_INSERT", "PASS", "review inserted"));
      const after = await openFollowUps(a.db, forRejected.id);
      if (after.length === 0) {
        track(log("REJECTED_NO_TASK", "PASS", "no follow-up created"));
      } else {
        fail += 1;
        log("REJECTED_NO_TASK", "FAIL", `open=${after.length}`);
      }
    }
  }

  // 4) duplicate open skip: pre-create open task, then needs_followup → still one open
  if (forDupSkip) {
    const { error: seedErr } = await a.db.from("follow_up_tasks").insert({
      owner_id: a.userId,
      case_id: forDupSkip.case_id,
      analysis_id: forDupSkip.id,
      kind: "next_consultation",
      note: "pre-existing open",
      status: "open",
    });
    if (seedErr) {
      fail += 1;
      log("DUP_SEED", "FAIL", seedErr.message);
    } else {
      const { error } = await a.db.from("reviews").insert({
        analysis_id: forDupSkip.id,
        owner_id: a.userId,
        decision: "needs_followup",
        note: "005 atomicity: dup skip",
      });
      if (error) {
        fail += 1;
        log("DUP_SKIP_REVIEW", "FAIL", error.message);
      } else {
        const after = await openFollowUps(a.db, forDupSkip.id);
        if (after.length === 1) {
          track(log("DUP_SKIP", "PASS", "idempotent skip kept one open"));
        } else {
          fail += 1;
          log("DUP_SKIP", "FAIL", `open=${after.length}`);
        }
      }
    }
  }

  // 5) concurrency: two parallel needs_followup on distinct analyses
  if (forConcurrent1 && forConcurrent2) {
    const results = await Promise.all([
      a.db
        .from("reviews")
        .insert({
          analysis_id: forConcurrent1.id,
          owner_id: a.userId,
          decision: "needs_followup",
          note: "005 concurrent A1",
        })
        .select("id")
        .single(),
      a.db
        .from("reviews")
        .insert({
          analysis_id: forConcurrent2.id,
          owner_id: a.userId,
          decision: "needs_followup",
          note: "005 concurrent A2",
        })
        .select("id")
        .single(),
    ]);
    const errs = results.filter((r) => r.error);
    if (errs.length) {
      fail += 1;
      log("CONCURRENT_INSERT", "FAIL", errs.map((e) => e.error.message).join("; "));
    } else {
      track(log("CONCURRENT_INSERT", "PASS", "both reviews inserted"));
      const t1 = await openFollowUps(a.db, forConcurrent1.id);
      const t2 = await openFollowUps(a.db, forConcurrent2.id);
      if (t1.length === 1 && t2.length === 1) {
        track(log("CONCURRENT_TASKS", "PASS", "each analysis has one open follow-up"));
      } else {
        fail += 1;
        log("CONCURRENT_TASKS", "FAIL", `t1=${t1.length} t2=${t2.length}`);
      }
    }
  } else {
    blocked += 1;
    log("CONCURRENT", "BLOCKED", "need 2 more unreviewed analyses");
  }

  // 6) trigger failure rolls back review (service role insert with auth.uid null)
  {
    const freeMore = await findUnreviewedSucceeded(a.db, a.userId, 40);
    const probe = freeMore.find(
      (row) =>
        row.id !== forFollowup.id &&
        row.id !== forConfirmed.id &&
        row.id !== forRejected.id &&
        row.id !== forDupSkip?.id &&
        row.id !== forConcurrent1?.id &&
        row.id !== forConcurrent2?.id,
    );
    if (!probe) {
      blocked += 1;
      log("ROLLBACK_PROBE", "BLOCKED", "no remaining unreviewed analysis");
    } else {
      const { count: reviewsBefore } = await a.db
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("analysis_id", probe.id);
      const { error } = await admin.from("reviews").insert({
        analysis_id: probe.id,
        owner_id: a.userId,
        decision: "needs_followup",
        note: "005 rollback probe",
      });
      const { count: reviewsAfter } = await a.db
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("analysis_id", probe.id);
      const tasks = await openFollowUps(a.db, probe.id);
      if (error && (reviewsBefore ?? 0) === (reviewsAfter ?? 0) && tasks.length === 0) {
        track(
          log(
            "TRIGGER_FAIL_ROLLBACK",
            "PASS",
            "unauthenticated trigger raise left no review/task",
          ),
        );
      } else if (!error) {
        fail += 1;
        log(
          "TRIGGER_FAIL_ROLLBACK",
          "FAIL",
          "service insert succeeded unexpectedly (auth.uid may be set)",
        );
      } else {
        fail += 1;
        log(
          "TRIGGER_FAIL_ROLLBACK",
          "FAIL",
          `err=${error.message} reviews ${reviewsBefore}->${reviewsAfter} tasks=${tasks.length}`,
        );
      }
    }
  }

  // 7) B cannot read A's follow-up / insert review on A's analysis
  {
    const { data: aTasks } = await a.db
      .from("follow_up_tasks")
      .select("id")
      .eq("owner_id", a.userId)
      .eq("status", "open")
      .limit(1);
    const targetId = aTasks?.[0]?.id;
    if (!targetId) {
      blocked += 1;
      log("RLS_B_READ", "BLOCKED", "A has no open task");
    } else {
      const { data: seen } = await b.db.from("follow_up_tasks").select("id").eq("id", targetId);
      if ((seen?.length ?? 0) === 0) {
        track(log("RLS_B_READ", "PASS", "B cannot see A's follow-up"));
      } else {
        fail += 1;
        log("RLS_B_READ", "FAIL", "B saw A's row");
      }
    }

    const { error: crossErr } = await b.db.from("reviews").insert({
      analysis_id: forFollowup.id,
      owner_id: b.userId,
      decision: "needs_followup",
      note: "cross-user probe",
    });
    if (crossErr) {
      track(log("RLS_B_REVIEW_BLOCK", "PASS", "B cannot review A's analysis"));
    } else {
      fail += 1;
      log("RLS_B_REVIEW_BLOCK", "FAIL", "B inserted review on A's analysis");
    }
  }

  console.log(`SUMMARY | PASS=${pass} FAIL=${fail} BLOCKED=${blocked}`);
  if (fail > 0) process.exit(1);
  if (blocked > 0) process.exit(2);
}

main().catch((err) => {
  console.error(`FATAL | ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
