import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const raw = readFileSync(resolve(import.meta.dirname, "../.env.local"), "utf8");
const line = raw.split(/\r?\n/).find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_URL="));
if (!line) {
  console.log("FAIL_MISSING_URL");
  process.exit(1);
}
let value = line.slice("NEXT_PUBLIC_SUPABASE_URL=".length).trim();
if (
  (value.startsWith('"') && value.endsWith('"')) ||
  (value.startsWith("'") && value.endsWith("'"))
) {
  value = value.slice(1, -1);
}
const host = new URL(value).host;
console.log(`host=${host}`);
console.log(
  host.startsWith("korebhoeetajvelogcrx.")
    ? "PASS_PROJECT"
    : "FAIL_PROJECT",
);
