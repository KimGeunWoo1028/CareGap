/**
 * Isolated Postgres check: apply stub FKs → 004 → 004a without touching CareGap Test.
 * Requires Docker. Exit 0 on success.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const NAME = "caregap-sql-004-seq";
const PORT = "55432";

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

  // wait for ready
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

  // Minimal stubs for FKs referenced by 004 (not full CareGap schema).
  psql(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key);
    create table public.cases (
      id uuid primary key,
      owner_id uuid not null references auth.users(id)
    );
    create table public.analyses (
      id uuid primary key,
      case_id uuid not null references public.cases(id),
      owner_id uuid not null references auth.users(id),
      status text not null default 'succeeded'
    );
    create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
  `);

  psqlFile("sql/004_follow_up_tasks.sql");
  console.log("SEQ | PASS | 004 applied");
  psqlFile("sql/004a_follow_up_terminal_immutable.sql");
  console.log("SEQ | PASS | 004a applied");

  // Second 004a is idempotent replace
  psqlFile("sql/004a_follow_up_terminal_immutable.sql");
  console.log("SEQ | PASS | 004a re-apply idempotent");

  // Re-applying full 004 should fail (table exists)
  let second004Failed = false;
  try {
    psqlFile("sql/004_follow_up_tasks.sql");
  } catch {
    second004Failed = true;
  }
  if (!second004Failed) {
    throw new Error("expected second 004 apply to fail");
  }
  console.log("SEQ | PASS | second 004 correctly non-reentrant");
  console.log("SEQ_SUMMARY | PASS");
} catch (error) {
  console.error(
    `SEQ_SUMMARY | FAIL | ${error instanceof Error ? error.message : "unknown"}`,
  );
  process.exitCode = 1;
} finally {
  cleanup();
}
