/**
 * Validate local JSON logical backup integrity without writing to CareGap Test.
 * Schema restore requires sql/001–004a (and 005 when approved); this checks data files only.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const BACKUPS = resolve(ROOT, "backups");

function latestBackupDir() {
  if (!existsSync(BACKUPS)) throw new Error("no backups/ directory");
  const dirs = readdirSync(BACKUPS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("caregap-test-pre-004-"))
    .map((d) => d.name)
    .sort();
  if (!dirs.length) throw new Error("no pre-004 backup dirs");
  return resolve(BACKUPS, dirs[dirs.length - 1]);
}

try {
  const dir = latestBackupDir();
  const manifest = JSON.parse(readFileSync(resolve(dir, "manifest.json"), "utf8"));
  const tables = Object.keys(manifest.tables ?? {});
  if (tables.length < 5) throw new Error("manifest missing expected tables");

  for (const table of tables) {
    const meta = manifest.tables[table];
    const raw = readFileSync(resolve(dir, meta.file), "utf8");
    const sha = createHash("sha256").update(raw).digest("hex");
    if (sha !== meta.sha256) {
      throw new Error(`${table}: sha256 mismatch`);
    }
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length !== meta.rows) {
      throw new Error(`${table}: row count mismatch`);
    }
    console.log(`BACKUP_CHECK | PASS | ${table} rows=${meta.rows}`);
  }

  console.log(
    "BACKUP_SCOPE | data-only JSON; schema restore needs sql/001-004a (+005 when approved)",
  );
  console.log(
    "BACKUP_RESTORE_TO_CARE_GAP_TEST | NOT_RUN | would overwrite live data — blocked by policy",
  );
  console.log(`BACKUP_SUMMARY | PASS | dir=${dir}`);
} catch (error) {
  console.error(
    `BACKUP_SUMMARY | FAIL | ${error instanceof Error ? error.message : "unknown"}`,
  );
  process.exitCode = 1;
}
