// Diagnostic sidecar: samples PostgreSQL lock waits + outbox backlog during a
// perf repro run. Writes CSV lines to stdout (redirect to a file).
// Usage: node .freebuff-dbg/sample-db.mjs <outfile> <prefix> [intervalMs]
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const outfile = process.argv[2] ?? "/tmp/db-sample.csv";
const prefix = process.argv[3] ?? "perf-";
const intervalMs = Number(process.argv[4] ?? 200);

const PG = "postgresql://postgres:postgres@localhost:5432/" + (process.env.DB_NAME ?? "");
if (process.env.DATABASE_URL) {
  const m = /5432\/([^?]+)/.exec(process.env.DATABASE_URL);
  if (m) process.env.DB_NAME = m[1];
}
const db = process.env.DB_NAME ?? "postgres";

function q(sql) {
  const r = spawnSync("psql", ["-h", "localhost", "-U", "postgres", "-d", db, "-t", "-A", "-c", sql], {
    encoding: "utf8",
    env: { ...process.env, PGPASSWORD: "postgres" },
  });
  return r.stdout.trim();
}

appendFileSync(outfile, "ts,waiters,lock_waits,io_waits,backlog,oldest_age_ms,conns\n");
let running = true;
process.on("SIGINT", () => (running = false));
process.on("SIGTERM", () => (running = false));

const deadline = Date.now() + 15 * 60 * 1000;
while (running && Date.now() < deadline) {
  const ts = Date.now();
  let waiters = "-", lockWaits = "-", ioWaits = "-", backlog = "-", oldest = "-", conns = "-";
  try {
    waiters = q(`SELECT count(*) FROM pg_stat_activity WHERE state='active' AND wait_event_type IS NOT NULL`);
    lockWaits = q(`SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock'`);
    ioWaits = q(`SELECT count(*) FROM pg_stat_activity WHERE wait_event_type IN ('IO','BufferPin')`);
    backlog = q(`SELECT count(*) FROM events."OutboxEvent" WHERE status='PENDING' AND "aggregateId" LIKE '${prefix}%'`);
    oldest = q(`SELECT COALESCE(EXTRACT(EPOCH FROM (now() - min("createdAt")))*1000, 0)::int FROM events."OutboxEvent" WHERE status='PENDING' AND "aggregateId" LIKE '${prefix}%'`);
    conns = q(`SELECT count(*) FROM pg_stat_activity WHERE datname='${db}'`);
  } catch {
    /* transient */
  }
  appendFileSync(outfile, `${ts},${waiters},${lockWaits},${ioWaits},${backlog},${oldest},${conns}\n`);
  await new Promise((r) => setTimeout(r, intervalMs));
}
