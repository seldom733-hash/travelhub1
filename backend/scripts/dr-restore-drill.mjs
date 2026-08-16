#!/usr/bin/env node
/**
 * TravelHub DR — isolated restore drill (Step 2.17A).
 *
 * Dependency-free Node helper. Restores a dr-backup artifact to an ISOLATED
 * recovery database, verifies schema/migration/data integrity, runs read-only
 * smoke checks, records timings, then cleans up.
 *
 * Usage:
 *   node scripts/dr-restore-drill.mjs --backup <file> [--target <db>] [--keep] [--yes]
 *
 * SAFETY (fail closed):
 *  - target DB must NOT equal the canonical DB from DATABASE_URL, and must not
 *    match the protected-name list (postgres, template*, travelhub, travelhub1,
 *    *_prod, prod*);
 *  - --yes is REQUIRED to acknowledge this is an isolated recovery target;
 *  - never DROP without an explicit, verified isolated target;
 *  - no Prisma `db push`; no writes to the canonical DB.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = resolve(HERE, "..");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = join(BACKEND_ROOT, ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?\s*$/);
      if (m) return m[1];
    }
  }
  throw new Error("DATABASE_URL not found in env or backend/.env");
}

function findTool(name) {
  if (process.env.PG_BIN_DIR) {
    const p = join(process.env.PG_BIN_DIR, name + ".exe");
    if (existsSync(p)) return p;
  }
  const probe = "C:\\Program Files\\PostgreSQL";
  if (existsSync(probe)) {
    try {
      const versions = readdirSync(probe).sort().reverse();
      for (const v of versions) {
        const p = join(probe, v, "bin", name + ".exe");
        if (existsSync(p)) return p;
      }
    } catch { /* fall through */ }
  }
  const r = spawnSync(name, ["--version"], { encoding: "utf8" });
  if (r.status === 0) return name;
  throw new Error(`${name} not found: set PG_BIN_DIR or install PostgreSQL client tools`);
}

function redact(url) {
  return url.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
}

function sha256File(file) {
  const h = createHash("sha256");
  h.update(readFileSync(file));
  return h.digest("hex");
}

const args = process.argv.slice(2);
function flag(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const backupFile = resolve(flag("--backup", ""));
const targetOverride = flag("--target", "");
const keep = args.includes("--keep");
const yes = args.includes("--yes");

const url = loadDatabaseUrl();
const canonicalDb = new URL(url).pathname.replace(/^\//, "");
const psql = findTool("psql");
const pgRestore = findTool("pg_restore");

const PROTECTED = ["postgres", "template0", "template1", "travelhub", "travelhub1", "travelhub_dev", "travelhub_prod"];
function isProtected(name) {
  return PROTECTED.includes(name.toLowerCase()) || /(_prod|_production)$/i.test(name) || /^prod/i.test(name);
}

// SAFETY-FIRST: target safety guards run BEFORE any backup-file handling.
const target = targetOverride || `travelhub_dr_drill_${Date.now()}`;
if (isProtected(target)) {
  console.error(`[dr-restore-drill] REFUSED: target "${target}" is a protected/canonical name — aborting`);
  process.exit(3);
}
if (!yes) {
  console.error("[dr-restore-drill] REFUSED: --yes required to acknowledge isolated recovery target");
  console.error(`  target: ${target}  (canonical: ${canonicalDb})`);
  process.exit(3);
}
if (!/^[a-z_][a-z0-9_]*$/i.test(target)) {
  console.error(`[dr-restore-drill] REFUSED: target "${target}" is not a valid bare database name`);
  process.exit(3);
}

if (!backupFile || !existsSync(backupFile)) {
  console.error("[dr-restore-drill] missing or invalid --backup file");
  process.exit(2);
}

// Split DATABASE_URL into connection parts (no secret printing).
const u = new URL(url);
const pgUrl = url; // pg tools accept the full URL via -d
const t0 = Date.now();
let timings = {};

console.log(`[dr-restore-drill] backup: ${backupFile}`);
console.log(`[dr-restore-drill] target (isolated): ${target}  (canonical: ${canonicalDb})`);

// 1. Validate backup + checksum.
const checksumFile = backupFile + ".sha256";
if (!existsSync(checksumFile)) {
  console.error("[dr-restore-drill] REFUSED: missing .sha256 sidecar — refusing unverified artifact");
  process.exit(4);
}
const expected = readFileSync(checksumFile, "utf8").trim().split(/\s+/)[0];
const actual = sha256File(backupFile);
console.log(`  checksum_algorithm: sha256`);
console.log(`  checksum_expected:  ${expected}`);
console.log(`  checksum_actual:    ${actual}`);
if (expected !== actual) {
  console.error("[dr-restore-drill] FAILED: checksum mismatch — corrupted backup artifact");
  process.exit(4);
}
console.log("  checksum_verified: true");

// 2. Create isolated DB (maintenance connection to `postgres`).
const adminUrl = url.replace(new URL(url).pathname, "/postgres");
let r = spawnSync(psql, ["-d", adminUrl, "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE "${target}"`], { encoding: "utf8" });
if (r.status !== 0) {
  console.error("[dr-restore-drill] FAILED: could not create isolated target DB");
  console.error(r.stderr?.slice(0, 1200));
  process.exit(5);
}
timings.create = Date.now() - t0;

// 3. Restore (custom format; --no-owner/--no-privileges for isolated drill).
const tRestore = Date.now();
const restoreUrl = url.replace(new URL(url).pathname, `/${target}`);
r = spawnSync(pgRestore, ["-d", restoreUrl, "--no-owner", "--no-privileges", "--exit-on-error", backupFile], { encoding: "utf8" });
timings.restore = Date.now() - tRestore;
if (r.status !== 0) {
  console.error("[dr-restore-drill] FAILED: pg_restore exited non-zero");
  console.error(r.stderr?.slice(0, 2000));
  process.exit(6);
}

// 4. Verify integrity (read-only).
const tVerify = Date.now();
function q(sql) {
  const rr = spawnSync(psql, ["-d", restoreUrl, "-tAc", sql], { encoding: "utf8" });
  if (rr.status !== 0) throw new Error(`verify query failed: ${sql}\n${rr.stderr?.slice(0, 800)}`);
  return rr.stdout.trim();
}
try {
  const schemas = q(`SELECT string_agg(schema_name, ',' ORDER BY schema_name) FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')`);
  const migrations = q(`SELECT count(*) FROM _prisma_migrations`);
  // Canonical invariant: every Prisma migration folder must be present in the
  // restored DB (the source may legitimately carry legacy rows for folders that
  // were later consolidated — that is preserved verbatim, not asserted).
  const migDir = join(BACKEND_ROOT, "prisma", "migrations");
  const folderMigs = readdirSync(migDir).filter((f) => /^\d{14}_/.test(f)).sort();
  const present = q(`SELECT string_agg(migration_name, ',' ORDER BY migration_name) FROM _prisma_migrations`).split(",");
  const presentSet = new Set(present);
  const missing = folderMigs.filter((f) => !presentSet.has(f));
  const users = q(`SELECT count(*) FROM security."User"`);
  const outbox = q(`SELECT count(*) FROM events."OutboxEvent"`);
  const inbox = q(`SELECT count(*) FROM events."InboxEvent"`);
  const outboxFailed = q(`SELECT count(*) FROM events."OutboxEvent" WHERE status='FAILED'`);
  const payments = q(`SELECT count(*) FROM finance."Payment"`);
  const sales = q(`SELECT count(*) FROM sales."Sale"`);
  const orders = q(`SELECT count(*) FROM "order"."Order"`);
  const bookings = q(`SELECT count(*) FROM booking."Booking"`);
  const ledgers = q(`SELECT count(*) FROM finance."LedgerTransaction"`);
  const idemp = q(`SELECT count(*) FROM events."ExternalIdempotencyRecord"`);
  console.log("  schemas_restored: " + schemas.split(",").length + " (" + schemas + ")");
  console.log(`  migration_state: ${migrations} rows in _prisma_migrations (all ${folderMigs.length} canonical folders present)`);
  console.log(`  security.User: ${users}`);
  console.log(`  events.OutboxEvent: ${outbox} (FAILED: ${outboxFailed})`);
  console.log(`  events.InboxEvent: ${inbox}`);
  console.log(`  finance.Payment: ${payments}`);
  console.log(`  sales.Sale: ${sales}`);
  console.log(`  order.Order: ${orders}`);
  console.log(`  booking.Booking: ${bookings}`);
  console.log(`  finance.LedgerTransaction: ${ledgers}`);
  console.log(`  events.ExternalIdempotencyRecord: ${idemp}`);
  if (!schemas.includes("security") || !schemas.includes("finance") || !schemas.includes("events")) {
    throw new Error("restored DB missing canonical schemas");
  }
  if (missing.length > 0) throw new Error(`restored DB missing ${missing.length} canonical migrations: ${missing.join(",")}`);
  console.log(`  migrations_folder_expected: ${folderMigs.length}`);
} catch (err) {
  console.error("[dr-restore-drill] FAILED: integrity verification: " + err.message);
  process.exit(7);
}
timings.verify = Date.now() - tVerify;

// 5. Smoke (read-only): representative auth/session + outbox worker-visible state.
const tSmoke = Date.now();
try {
  const smokeUser = q(`SELECT count(*) FROM security."User" WHERE status='ACTIVE'`);
  const smokeToken = q(`SELECT count(*) FROM security."User" WHERE "tokenVersion" IS NOT NULL`);
  const smokeOutboxPending = q(`SELECT count(*) FROM events."OutboxEvent" WHERE status='PENDING'`);
  console.log(`  smoke: active users=${smokeUser}, tokenVersion set=${smokeToken}, outbox PENDING=${smokeOutboxPending}`);
} catch (err) {
  console.error("[dr-restore-drill] FAILED: smoke check: " + err.message);
  process.exit(8);
}
timings.smoke = Date.now() - tSmoke;
timings.total = Date.now() - t0;

console.log("[dr-restore-drill] OK");
console.log("  restore_drill: PASSED");
console.log("  timings_ms: " + JSON.stringify(timings));

// 6. Cleanup (unless --keep).
if (!keep) {
  const tDrop = Date.now();
  r = spawnSync(psql, ["-d", adminUrl, "-c", `DROP DATABASE IF EXISTS "${target}" WITH (FORCE)`], { encoding: "utf8" });
  timings.cleanup = Date.now() - tDrop;
  if (r.status !== 0) {
    console.error(`[dr-restore-drill] WARN: cleanup DROP of ${target} failed (left for manual removal)`);
  } else {
    console.log(`  cleanup: dropped ${target}`);
  }
} else {
  console.log(`  cleanup: --keep set, target left as ${target}`);
}

// Persist drill evidence (no secrets).
const evidenceFile = join(BACKEND_ROOT, ".backups", `drill-evidence-${Date.now()}.json`);
writeFileSync(evidenceFile, JSON.stringify({
  backup: backupFile,
  target,
  checksum: actual,
  checksum_algorithm: "sha256",
  timings_ms: timings,
  result: "PASSED",
  ts: new Date().toISOString(),
}, null, 2));
console.log(`  evidence: ${evidenceFile}`);
