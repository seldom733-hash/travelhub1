// Lock watcher v2: every interval, log any Lock-waiting session with its query
// text (truncated) and the relation being waited on. Usage: node lock-watch2.mjs <db> [intervalMs]
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const db = process.argv[2] ?? "postgres";
const intervalMs = Number(process.argv[3] ?? 100);
const outfile = `${process.env.TEMP ?? process.env.TMP ?? "."}/lock-watch2-${db}.log`;

function q(sql) {
  const r = spawnSync("psql", ["-h", "localhost", "-U", "postgres", "-d", db, "-t", "-A", "-c", sql], {
    encoding: "utf8",
    env: { ...process.env, PGPASSWORD: "postgres" },
  });
  return r.stdout.trim();
}

appendFileSync(outfile, `=== lock watch v2 ${new Date().toISOString()} ===\n`);
let running = true;
process.on("SIGINT", () => (running = false));
process.on("SIGTERM", () => (running = false));
const deadline = Date.now() + 10 * 60 * 1000;
while (running && Date.now() < deadline) {
  const ts = new Date().toISOString();
  try {
    const rows = q(`
      SELECT a.pid, COALESCE(c.relname, 'non-rel'), left(a.query, 120)
      FROM pg_locks l
      JOIN pg_stat_activity a ON a.pid = l.pid
      LEFT JOIN pg_class c ON c.oid = l.relation
      WHERE NOT l.granted AND a.wait_event_type = 'Lock'
      ORDER BY l.pid
    `);
    if (rows !== "") {
      for (const line of rows.split("\n")) {
        appendFileSync(outfile, `${ts} :: ${line}\n`);
      }
    }
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, intervalMs));
}
