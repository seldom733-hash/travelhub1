// Watch pg_locks: every interval, print counts of blocking waiters grouped by
// relation name + the raw wait_event lines. Usage: node lock-watch.mjs <db> [intervalMs]
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const db = process.argv[2] ?? "postgres";
const intervalMs = Number(process.argv[3] ?? 200);
const outfile = `/tmp/lock-watch-${db}.log`;

function q(sql) {
  const r = spawnSync("psql", ["-h", "localhost", "-U", "postgres", "-d", db, "-t", "-A", "-c", sql], {
    encoding: "utf8",
    env: { ...process.env, PGPASSWORD: "postgres" },
  });
  return r.stdout.trim();
}

appendFileSync(outfile, `=== lock watch ${new Date().toISOString()} ===\n`);
let running = true;
process.on("SIGINT", () => (running = false));
process.on("SIGTERM", () => (running = false));
const deadline = Date.now() + 10 * 60 * 1000;
while (running && Date.now() < deadline) {
  const ts = new Date().toISOString();
  try {
    const byRel = q(`
      SELECT COALESCE(c.relname, l2.mode, 'unknown'), count(*)
      FROM pg_locks l
      LEFT JOIN pg_class c ON c.oid = l.relation
      LEFT JOIN pg_locks l2 ON l2.pid = l.pid AND l2.granted AND l2.relation = l.relation
      WHERE NOT l.granted
      GROUP BY 1 ORDER BY 2 DESC
    `);
    const waits = q(`SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock'`);
    if (byRel !== "" && byRel !== "0") {
      appendFileSync(outfile, `${ts} waits=${waits} :: ${byRel.replace(/\n/g, " | ")}\n`);
    }
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, intervalMs));
}
