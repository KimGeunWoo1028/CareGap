/**
 * Isolated Docker Postgres: new-install path 001→002→004→004a→canonical 005.
 * Does NOT apply mismatched 005 history payload or 005b.
 * Does NOT touch CareGap Test. Requires Docker daemon.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

const ROOT = resolve(import.meta.dirname, "..");
const NAME = "caregap-sql-new-install";
const PORT = "55433";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
}

function psql(sql) {
  return sh("docker", [
    "exec",
    "-i",
    NAME,
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ]);
}

function psqlFile(relativePath) {
  const sql = readFileSync(resolve(ROOT, relativePath), "utf8");
  return sh(
    "docker",
    ["exec", "-i", NAME, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
    { input: sql, stdio: ["pipe", "pipe", "pipe"] },
  );
}

function cleanup() {
  try {
    sh("docker", ["rm", "-f", NAME]);
  } catch {
    // ignore
  }
}

function asUser(userId, sql) {
  return psql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '${userId}', true);
    ${sql}
    commit;
  `);
}

function expectFail(label, fn) {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  if (!failed) throw new Error(`expected failure: ${label}`);
  console.log(`CHECK | PASS | ${label} rejected`);
}

try {
  cleanup();
  sh("docker", [
    "run",
    "-d",
    "--name",
    NAME,
    "-e",
    "POSTGRES_PASSWORD=postgres",
    "-p",
    `${PORT}:5432`,
    "postgres:17-alpine",
  ]);

  let ready = false;
  for (let i = 0; i < 40; i += 1) {
    try {
      psql("select 1;");
      ready = true;
      break;
    } catch {
      sh(
        process.platform === "win32" ? "powershell" : "sleep",
        process.platform === "win32"
          ? ["-Command", "Start-Sleep -Seconds 1"]
          : ["1"],
      );
    }
  }
  if (!ready) throw new Error("postgres not ready");

  // Supabase-like stubs (roles, auth.users, auth.uid).
  psql(`
    do $$ begin
      create role anon nologin;
    exception when duplicate_object then null; end $$;
    do $$ begin
      create role authenticated nologin;
    exception when duplicate_object then null; end $$;
    do $$ begin
      create role service_role nologin bypassrls;
    exception when duplicate_object then null; end $$;
    grant usage on schema public to anon, authenticated, service_role;
    grant all on schema public to postgres, service_role;
    grant anon, authenticated, service_role to postgres;

    create schema if not exists auth;
    grant usage on schema auth to anon, authenticated, service_role, postgres;
    create table auth.users (
      id uuid primary key,
      email text unique
    );
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $f$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $f$;
    grant execute on function auth.uid() to anon, authenticated, service_role, postgres;
  `);
  console.log("BOOT | PASS | auth/role stubs");

  psqlFile("sql/001_schema.sql");
  console.log("APPLY | PASS | 001_schema");
  psqlFile("sql/002_programs.sql");
  console.log("APPLY | PASS | 002_programs");

  // Seed users + demo case/notes (003 equivalent without Auth UI).
  psql(`
    insert into auth.users(id, email) values
      ('${USER_A}', 'a@example.invalid'),
      ('${USER_B}', 'b@example.invalid');
  `);
  asUser(
    USER_A,
    `
    insert into public.cases(owner_id, alias) values ('${USER_A}', '합성-001');
  `,
  );
  const caseId = psql(
    `select id::text from public.cases where owner_id='${USER_A}' and alias='합성-001';`,
  )
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^[0-9a-f-]{36}$/i.test(l));
  if (!caseId) throw new Error("case id not found");
  asUser(
    USER_A,
    `
    insert into public.consultations(case_id, occurred_on, channel, body) values
      ('${caseId}', '2026-09-10', 'phone', '혼자 식사도 잘하시고 가까운 가게까지 걸어가 장을 볼 수 있음.'),
      ('${caseId}', '2026-10-10', 'phone', '최근 다리가 불편해 장을 보기 어렵고 식사를 자주 거르심.');
  `,
  );
  console.log("APPLY | PASS | 003-equivalent seed");

  psqlFile("sql/004_follow_up_tasks.sql");
  console.log("APPLY | PASS | 004");
  psqlFile("sql/004a_follow_up_terminal_immutable.sql");
  console.log("APPLY | PASS | 004a");
  psqlFile("sql/005_review_follow_up_atomicity.sql");
  console.log("APPLY | PASS | 005 canonical (not mismatched history, not 005b)");

  // Tables
  const tables = psql(`
    select string_agg(tablename, ',' order by tablename)
    from pg_tables where schemaname='public'
      and tablename in ('cases','consultations','welfare_programs','analyses','reviews','follow_up_tasks');
  `);
  if (!tables.includes("follow_up_tasks") || !tables.includes("reviews")) {
    throw new Error(`tables missing: ${tables}`);
  }
  console.log("CHECK | PASS | core tables present");

  // RLS enabled
  const rls = psql(`
    select relname || '=' || relrowsecurity::text
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and relname in ('reviews','follow_up_tasks')
    order by 1;
  `);
  if (!rls.includes("reviews=t") || !rls.includes("follow_up_tasks=t")) {
    throw new Error(`RLS not enabled: ${rls}`);
  }
  console.log("CHECK | PASS | RLS enabled on reviews/follow_up_tasks");

  // Trigger + SECURITY INVOKER function
  const trig = psql(`
    select tgname from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='reviews' and not t.tgisinternal;
  `);
  if (!trig.includes("reviews_enqueue_follow_up")) {
    throw new Error(`trigger missing: ${trig}`);
  }
  const sec = psql(`
    select case when p.prosecdef then 'DEFINER' else 'INVOKER' end
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='reviews_enqueue_follow_up';
  `);
  if (!sec.includes("INVOKER")) throw new Error(`expected INVOKER: ${sec}`);
  console.log("CHECK | PASS | trigger + SECURITY INVOKER");

  // Programs granted readable
  const progCount = psql(`select count(*)::text from public.welfare_programs;`);
  if (!progCount.includes("2")) throw new Error(`programs count: ${progCount}`);
  console.log("CHECK | PASS | welfare_programs seeded");

  // Create succeeded analysis as service/postgres (simulates server finalize).
  const notes = psql(
    `select id::text from public.consultations where case_id='${caseId}' order by occurred_on;`,
  )
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[0-9a-f-]{36}$/i.test(l));
  if (notes.length < 2) throw new Error("need 2 notes");
  const analysisIds = [];
  for (let i = 0; i < 4; i += 1) {
    const id = randomUUID();
    analysisIds.push(id);
    psql(`
      insert into public.analyses(
        id, case_id, owner_id, previous_note_id, current_note_id,
        idempotency_key, mode, status, result, completed_at
      ) values (
        '${id}', '${caseId}', '${USER_A}', '${notes[0]}', '${notes[1]}',
        '${randomUUID()}', 'replay', 'succeeded',
        '{"summary":"iso"}'::jsonb, now()
      );
    `);
  }
  console.log("FIXTURE | PASS | 4 succeeded analyses");

  // needs_followup → auto follow-up
  asUser(
    USER_A,
    `
    insert into public.reviews(analysis_id, owner_id, decision, note)
    values ('${analysisIds[0]}', '${USER_A}', 'needs_followup', 'iso needs_followup');
  `,
  );
  const open1 = psql(`
    select count(*)::text from public.follow_up_tasks
    where analysis_id='${analysisIds[0]}' and kind='next_consultation' and status='open';
  `);
  if (!open1.includes("1")) throw new Error(`auto follow-up count: ${open1}`);
  console.log("CHECK | PASS | needs_followup creates open task");

  // confirmed → no task
  asUser(
    USER_A,
    `
    insert into public.reviews(analysis_id, owner_id, decision, note)
    values ('${analysisIds[1]}', '${USER_A}', 'confirmed', '');
  `,
  );
  const openConf = psql(`
    select count(*)::text from public.follow_up_tasks where analysis_id='${analysisIds[1]}';
  `);
  if (!/\b0\b/.test(openConf.split("\n").find((l) => /^\s*\d+\s*$/.test(l)) ?? openConf)) {
    // parse carefully
  }
  const confN = Number(
    (psql(
      `select count(*) from public.follow_up_tasks where analysis_id='${analysisIds[1]}';`,
    ).match(/\n\s*(\d+)\s*\n/) || [])[1],
  );
  if (confN !== 0) throw new Error(`confirmed created tasks: ${confN}`);
  console.log("CHECK | PASS | confirmed creates no follow-up");

  // rejected → no task
  asUser(
    USER_A,
    `
    insert into public.reviews(analysis_id, owner_id, decision, note)
    values ('${analysisIds[2]}', '${USER_A}', 'rejected', 'not applicable');
  `,
  );
  const rejN = Number(
    (psql(
      `select count(*) from public.follow_up_tasks where analysis_id='${analysisIds[2]}';`,
    ).match(/\n\s*(\d+)\s*\n/) || [])[1],
  );
  if (rejN !== 0) throw new Error(`rejected created tasks: ${rejN}`);
  console.log("CHECK | PASS | rejected creates no follow-up");

  // Dup open unique index
  expectFail("duplicate open follow-up", () => {
    asUser(
      USER_A,
      `
      insert into public.follow_up_tasks(owner_id, case_id, analysis_id, kind, note, status)
      values ('${USER_A}', '${caseId}', '${analysisIds[0]}', 'next_consultation', 'dup', 'open');
    `,
    );
  });

  // Ownership isolation: B cannot see A's follow-up
  const bSee = Number(
    (asUser(
      USER_B,
      `select count(*) from public.follow_up_tasks where analysis_id='${analysisIds[0]}';`,
    ).match(/\n\s*(\d+)\s*\n/) || [])[1],
  );
  if (bSee !== 0) throw new Error(`B saw A's tasks: ${bSee}`);
  console.log("CHECK | PASS | B cannot read A's follow-up");

  expectFail("B review on A's analysis", () => {
    asUser(
      USER_B,
      `
      insert into public.reviews(analysis_id, owner_id, decision, note)
      values ('${analysisIds[3]}', '${USER_B}', 'needs_followup', 'cross');
    `,
    );
  });

  // Trigger failure rolls back review: insert as postgres without jwt → auth.uid null
  expectFail("unauthenticated needs_followup rolls back", () => {
    psql(`
      insert into public.reviews(analysis_id, owner_id, decision, note)
      values ('${analysisIds[3]}', '${USER_A}', 'needs_followup', 'rollback probe');
    `);
  });
  const orphanReview = Number(
    (psql(
      `select count(*) from public.reviews where analysis_id='${analysisIds[3]}';`,
    ).match(/\n\s*(\d+)\s*\n/) || [])[1],
  );
  const orphanTask = Number(
    (psql(
      `select count(*) from public.follow_up_tasks where analysis_id='${analysisIds[3]}';`,
    ).match(/\n\s*(\d+)\s*\n/) || [])[1],
  );
  if (orphanReview !== 0 || orphanTask !== 0) {
    throw new Error(`rollback incomplete review=${orphanReview} task=${orphanTask}`);
  }
  console.log("CHECK | PASS | trigger failure rolls back review+task");

  // Ensure mismatched history file was NOT applied (column names would break otherwise).
  const body = psql(`
    select pg_get_functiondef('public.reviews_enqueue_follow_up'::regproc);
  `);
  if (body.includes("owner_user_id") || body.includes("task_type")) {
    throw new Error("mismatched 005 payload detected in function body");
  }
  if (!body.includes("owner_id") || !body.toLowerCase().includes("next_consultation")) {
    throw new Error("canonical 005 markers missing");
  }
  console.log("CHECK | PASS | function body is canonical 005 (not mismatched)");

  console.log("NEW_INSTALL_SUMMARY | PASS");
} catch (error) {
  console.error(
    `NEW_INSTALL_SUMMARY | FAIL | ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  cleanup();
}
