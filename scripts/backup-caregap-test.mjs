/**
 * Logical backup of CareGap Test public tables via service role.
 * Writes JSON under backups/ (gitignored). Never prints secrets or row bodies to stdout.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const TABLES = [
  "cases",
  "consultations",
  "welfare_programs",
  "analyses",
  "reviews",
  "follow_up_tasks",
];

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

async function fetchAll(client, table) {
  const { data, error, count } = await client
    .from(table)
    .select("*", { count: "exact" })
    .order("id", { ascending: true })
    .limit(5000);
  if (error) throw new Error(`${table}:${error.message}`);
  return { rows: data ?? [], count: count ?? (data?.length ?? 0) };
}

async function main() {
  const env = loadEnvLocal();
  const url = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const secret = requireEnv(env, "SUPABASE_SECRET_KEY");
  if (!url.includes("korebhoeetajvelogcrx") && !url.includes("supabase.co")) {
    throw new Error("Refusing backup: URL does not look like CareGap Supabase host");
  }

  const client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = resolve(ROOT, "backups", `caregap-test-pre-004-${stamp}`);
  mkdirSync(dir, { recursive: true });

  const manifest = {
    project_hint: "CareGap Test",
    created_at: new Date().toISOString(),
    purpose: "pre-sql-004-logical-backup",
    tables: {},
  };

  for (const table of TABLES) {
    const { rows, count } = await fetchAll(client, table);
    if (rows.length !== count && count > rows.length) {
      throw new Error(`${table}: incomplete fetch rows=${rows.length} count=${count}`);
    }
    const json = `${JSON.stringify(rows, null, 2)}\n`;
    const file = resolve(dir, `${table}.json`);
    writeFileSync(file, json, "utf8");
    const sha = createHash("sha256").update(json).digest("hex");
    const bytes = statSync(file).size;
    // Round-trip parse check
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(parsed) || parsed.length !== rows.length) {
      throw new Error(`${table}: backup validation failed`);
    }
    manifest.tables[table] = {
      rows: rows.length,
      bytes,
      sha256: sha,
      file: `${table}.json`,
    };
    console.log(`BACKUP_TABLE | ${table} | rows=${rows.length} | bytes=${bytes}`);
  }

  const manifestPath = resolve(dir, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`BACKUP_OK | dir=${dir} | tables=${TABLES.length}`);
  console.log(`BACKUP_MANIFEST | ${manifestPath}`);
}

main().catch((error) => {
  console.error(`BACKUP_FAIL | ${error instanceof Error ? error.message : "unknown"}`);
  process.exitCode = 1;
});
