// Diagnostic sidecar v2: samples PENDING backlog, oldest PENDING age, PUBLISHED
// deltas (publish rate), lock waits, and connections every interval.
// Usage: node .freebuff-dbg/sample-db2.mjs <outfile> <dbname> <prefix> [intervalMs]
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const outfile = process.argv[2] ?? "/tmp/db-sample.csv";
const db = process.argv[3] ?? "postgres";
const prefix = process.argv[4] ?? "perf-";
const intervalMs = Number(process.argv[5] ?? 100);

function q(sql) {
  const r = spawnSync("psql", ["-h", "localhost", "-U", "postgres", "-d", db, "-t", "-A", "-c", sql], {
    encoding: "utf8",
    env: { ...process.env, PGPASSWORD: "postgres" },
  });
  return r.stdout.trim();
}

appendFileSync(outfile, "ts,lock_waits,io_waits,backlog,oldest_age_ms,published_total,conns\n");
let running = true;
process.on("SIGINT", () => (running = false));
process.on("SIGTERM", () => (running = false));

const deadline = Date.now() + 15 * 60 * 1000;
while (running && Date.now() < deadline) {
  const ts = Date.now();
  let lockWaits = "-", ioWaits = "-", backlog = "-", oldest = "-", published = "-", conns = "-";
  try {
    lockWaits = q(`SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock'`);
    ioWaits = q(`SELECT count(*) FROM pg_stat_activity WHERE wait_event_type IN ('IO','BufferPin')`);
    backlog = q(`SELECT count(*) FROM events."OutboxEvent" WHERE status='PENDING' AND "aggregateId" LIKE '${prefix}%'`);
    oldest = q(`SELECT COALESCE(EXTRACT(EPOCH FROM (now() - min("createdAt")))*1000, 0)::int FROM events."OutboxEvent" WHERE status='PENDING' AND "aggregateId" LIKE '${prefix}%'`);
    published = q(`SELECT count(*) FROM events."OutboxEvent" WHERE status='PUBLISHED' AND "aggregateId" LIKE '${prefix}%'`);
    conns = q(`SELECT count(*) FROM pg_stat_activity WHERE datname='${db}'`);
  } catch {
    /* transient */
  }
  appendFileSync(outfile, `${ts},${lockWaits},${ioWaits},${backlog},${oldest},${published},${conns}\n`);
  await new Promise((r) => setTimeout(r, intervalMs));
}
