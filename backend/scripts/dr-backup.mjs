#!/usr/bin/env node
/**
 * TravelHub DR — PostgreSQL backup (Step 2.17A).
 *
 * Dependency-free Node helper (no project imports). Wraps pg_dump (custom
 * format, whole multi-schema DB) with checksum + evidence output.
 *
 * Usage:
 *   node scripts/dr-backup.mjs [--out <dir>] [--label <name>]
 *
 * - DATABASE_URL from env or backend/.env (no secrets printed).
 * - Fails (exit != 0) on any pg_dump error.
 * - Artifacts excluded from Git (backend/.backups/).
 * - Never touches production restore; this script only creates dumps.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = resolve(HERE, "..");
const DEFAULT_OUT = join(BACKEND_ROOT, ".backups");

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

function findPgDump() {
  if (process.env.PG_DUMP_BIN && existsSync(process.env.PG_DUMP_BIN)) return process.env.PG_DUMP_BIN;
  // Common Windows install paths (project dev environment is Windows).
  const probe = "C:\\Program Files\\PostgreSQL";
  if (existsSync(probe)) {
    try {
      const versions = readdirSync(probe).sort().reverse();
      for (const v of versions) {
        const p = join(probe, v, "bin", "pg_dump.exe");
        if (existsSync(p)) return p;
      }
    } catch { /* fall through */ }
  }
  // PATH fallback (Linux/macOS/CI).
  const r = spawnSync("pg_dump", ["--version"], { encoding: "utf8" });
  if (r.status === 0) return "pg_dump";
  throw new Error("pg_dump not found: set PG_DUMP_BIN or install PostgreSQL client tools");
}

function redact(url) {
  return url.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
}

const args = process.argv.slice(2);
function flag(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const outDir = resolve(flag("--out", DEFAULT_OUT));
const label = flag("--label", "canonical");
mkdirSync(outDir, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const artifact = join(outDir, `travelhub_${label}_${ts}.dump`);
const checksumFile = artifact + ".sha256";

const url = loadDatabaseUrl();
const dbName = new URL(url).pathname.replace(/^\//, "");
const pgDump = findPgDump();

console.log(`[dr-backup] DB: ${dbName} (${redact(url)})`);
console.log(`[dr-backup] pg_dump: ${pgDump}`);
console.log(`[dr-backup] artifact: ${artifact}`);
const t0 = Date.now();

// Custom format, whole DB, fail on error, credentials only via env.
const argsDump = [
  "-Fc", "--no-owner", "--no-privileges",
  "--file", artifact,
  "-d", url,
];
const r = spawnSync(pgDump, argsDump, { encoding: "utf8", env: { ...process.env, DATABASE_URL: url, PGPASSWORD: undefined } });
// Connection credentials come from the URL itself; PGPASSWORD deliberately unset here.
if (r.status !== 0) {
  console.error("[dr-backup] FAILED: pg_dump exited non-zero");
  if (r.stderr) console.error(r.stderr.slice(0, 2000));
  // Remove any partial artifact pg_dump may have left (no sidecar was written).
  if (existsSync(artifact)) {
    try {
      rmSync(artifact, { force: true });
      console.error(`  removed partial artifact: ${artifact}`);
    } catch (e) {
      console.error(`  WARN: could not remove partial artifact: ${e.message}`);
    }
  }
  process.exit(r.status ?? 1);
}

const durationMs = Date.now() - t0;
const size = statSync(artifact).size;

const sha = createHash("sha256");
const data = readFileSync(artifact);
sha.update(data);
const checksum = sha.digest("hex");
writeFileSync(checksumFile, checksum + "\n");

console.log("[dr-backup] OK");
console.log(`  artifact: ${artifact}`);
console.log(`  size_bytes: ${size}`);
console.log(`  checksum_algorithm: sha256`);
console.log(`  checksum: ${checksum}`);
console.log(`  checksum_file: ${checksumFile}`);
console.log(`  duration_ms: ${durationMs}`);
console.log(`  exit_status: 0`);
