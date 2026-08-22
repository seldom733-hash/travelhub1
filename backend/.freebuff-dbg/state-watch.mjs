// Sample PG backend state breakdown during a perf run (Windows-safe via pg).
import { readFileSync } from "node:fs";
import pg from "pg";

const dbName = readFileSync(process.env.TMP ? `${process.env.TMP}/rq3_db.txt` : "/tmp/rq3_db.txt", "utf8").trim();
const client = new pg.Client({ host: "localhost", port: 5432, user: "postgres", password: "postgres", database: dbName });
await client.connect();

const samples = [];
const start = Date.now();
const sampler = setInterval(async () => {
  try {
    const { rows } = await client.query(
      `SELECT state, count(*)::int AS c FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid() GROUP BY state`,
      [dbName],
    );
    const m = {};
    for (const r of rows) m[r.state] = r.c;
    samples.push({ t: (Date.now() - start) / 1000, ...m });
    process.stdout.write(`\r t+${((Date.now() - start) / 1000).toFixed(1)}s idle=${m.idle ?? 0} act=${m.active ?? 0} idleTx=${m["idle in transaction"] ?? 0} fastpath=${m.fastpath ?? 0}   `);
  } catch (e) {
    process.stdout.write(`\r err ${String(e.message).slice(0, 40)}   `);
  }
}, 200);

const until = Number(process.argv[2] ?? 90);
setTimeout(async () => {
  clearInterval(sampler);
  process.stdout.write("\n");
  const peak = { idle: 0, active: 0, idleTx: 0 };
  for (const s of samples) {
    peak.idle = Math.max(peak.idle, s.idle ?? 0);
    peak.active = Math.max(peak.active, s.active ?? 0);
    peak.idleTx = Math.max(peak.idleTx, s["idle in transaction"] ?? 0);
  }
  console.log(`\n=== samples=${samples.length} peak idle=${peak.idle} active=${peak.active} idleTx=${peak.idleTx} ===`);
  await client.end();
  process.exit(0);
}, until * 1000);
