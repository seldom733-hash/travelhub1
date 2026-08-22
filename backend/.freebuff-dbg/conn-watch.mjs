// Connection/wait sampler for the current run DB (Windows-safe via pg).
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
      `SELECT count(*)::int AS conns,
              count(*) FILTER (WHERE state='active')::int AS active,
              count(*) FILTER (WHERE wait_event_type='Lock')::int AS locks,
              count(*) FILTER (WHERE wait_event_type='Client')::int AS clients,
              count(*) FILTER (WHERE wait_event_type='IO')::int AS io
       FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`,
      [dbName],
    );
    const r = rows[0];
    samples.push({ t: (Date.now() - start) / 1000, ...r });
    process.stdout.write(`\r t+${((Date.now() - start) / 1000).toFixed(1)}s conns=${r.conns} active=${r.active} locks=${r.locks} client=${r.clients} io=${r.io}   `);
  } catch (e) {
    process.stdout.write(`\r sampler err: ${String(e.message).slice(0, 50)}   `);
  }
}, 250);

const until = Number(process.argv[2] ?? 90);
setTimeout(async () => {
  clearInterval(sampler);
  process.stdout.write("\n");
  const peak = { conns: 0, active: 0, locks: 0 };
  for (const s of samples) {
    peak.conns = Math.max(peak.conns, s.conns);
    peak.active = Math.max(peak.active, s.active);
    peak.locks = Math.max(peak.locks, s.locks);
  }
  console.log(`\n=== samples=${samples.length} peak conns=${peak.conns} peak active=${peak.active} peak locks=${peak.locks} ===`);
  await client.end();
  process.exit(0);
}, until * 1000);
