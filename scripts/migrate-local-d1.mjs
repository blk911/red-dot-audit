#!/usr/bin/env node
// Applies drizzle/*.sql to the local Miniflare D1 file that `vite dev` already
// created for the `DB` binding, tracking a ledger so each migration runs once.
//
// The migrations directory mixes drizzle-kit-generated files with hand-written
// ones and has duplicate numeric prefixes (0003_*, 0004_*, 0005_* each appear
// twice) because `drizzle/meta/_journal.json` only records 6 of the 17 files —
// it was never kept in sync with the hand-written migrations. Do not trust it
// for ordering. This script instead applies files in plain lexical filename
// order, which was verified by reading every file's CREATE/ALTER statements
// and confirming each ALTER's target table (or referenced index) is created by
// an earlier file in that same lexical order. See CLAUDE_HANDOFF.md section 11.
//
// Usage: node scripts/migrate-local-d1.mjs
// Requires: the local D1 sqlite file already exists, i.e. `npm run dev` has
// been run at least once and a page that touches `env.DB` has been loaded
// (any request to `/` or `/admin` does this).

import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const drizzleDir = path.join(root, "drizzle");
const d1Dir = path.join(root, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");

function findLocalD1File() {
  let entries;
  try {
    entries = readdirSync(d1Dir);
  } catch {
    entries = [];
  }
  const candidates = entries.filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite");
  if (candidates.length === 0) {
    console.error(
      `No local D1 database file found under ${d1Dir}.\n` +
      "Run `npm run dev` and load a page (e.g. `/`) at least once first — " +
      "Miniflare creates the D1 file lazily on first access to the `DB` binding.",
    );
    process.exit(1);
  }
  if (candidates.length > 1) {
    console.error(
      `Expected exactly one local D1 database file under ${d1Dir}, found ${candidates.length}: ${candidates.join(", ")}.\n` +
      "Remove the stale one(s) (or the whole .wrangler/state/v3/d1 directory to start clean) and retry.",
    );
    process.exit(1);
  }
  return path.join(d1Dir, candidates[0]);
}

function migrationFiles() {
  return readdirSync(drizzleDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

const dbFile = findLocalD1File();
console.log(`[migrate] using local D1 file: ${dbFile}`);
const db = new DatabaseSync(dbFile);

db.exec(`
  CREATE TABLE IF NOT EXISTS _local_migrations_ledger (
    tag TEXT PRIMARY KEY NOT NULL,
    applied_at TEXT NOT NULL
  );
`);

const already = new Set(
  db.prepare("SELECT tag FROM _local_migrations_ledger").all().map((row) => row.tag),
);

const files = migrationFiles();
let appliedCount = 0;

for (const file of files) {
  const tag = file.replace(/\.sql$/, "");
  if (already.has(tag)) {
    console.log(`[migrate] skip  ${tag} (already applied)`);
    continue;
  }
  const sql = readFileSync(path.join(drizzleDir, file), "utf8");
  console.log(`[migrate] apply ${tag}`);
  db.exec("BEGIN");
  try {
    db.exec(sql);
    db.prepare("INSERT INTO _local_migrations_ledger (tag, applied_at) VALUES (?, ?)").run(
      tag,
      new Date().toISOString(),
    );
    db.exec("COMMIT");
    appliedCount += 1;
  } catch (error) {
    db.exec("ROLLBACK");
    console.error(`[migrate] FAILED on ${tag}:`, error.message);
    process.exit(1);
  }
}

console.log(`[migrate] done — ${appliedCount} applied, ${files.length - appliedCount} already up to date`);

// Verify the specific columns section 11 calls out as critical.
const checks = [
  ["admin_census_deployments", "acquisition_status"],
  ["admin_census_deployments", "audit_id"],
  ["admin_jurisdiction_audits", "census_id"],
  ["admin_jurisdiction_metrics", "source_date"],
  ["admin_jurisdiction_metrics", "excerpt"],
  ["admin_jurisdiction_metrics", "confidence"],
];

console.log("[migrate] verifying critical columns:");
let allOk = true;
for (const [table, column] of checks) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
  const ok = columns.includes(column);
  allOk = allOk && ok;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${table}.${column}`);
}
if (!allOk) {
  console.error("[migrate] one or more critical columns are missing.");
  process.exit(1);
}
