// Step 2.17B Workstream A — live backlog sampler via pg (Windows-safe).
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";

const dbName = readFileSync(process.env.TMP ? `${process.env.TMP}/rq3_db.txt` : "/tmp/rq3_db.txt", "utf8").trim();
const prefix = process.argv[2] ?? "rem3a-ebs6";
const client = new pg.Client({ host: "localhost", port: 5432, user: "postgres", password: "postgres", database: dbName });
await client.connect();

const samples = [];
const start = Date.now();
const sampler = setInterval(async () => {
  try {
    const { rows } = await client.query(
      `SELECT status, count(*)::int AS c FROM events."OutboxEvent" WHERE "aggregateId" LIKE $1 GROUP BY status`,
      [`perf-ebs-${prefix}-%`],
    );
    const counts = {};
    for (const r of rows) counts[r.status] = r.c;
    samples.push({ t: Date.now(), ...counts });
    const pend = counts.PENDING ?? 0;
    process.stdout.write(`\r t+${((Date.now() - start) / 1000).toFixed(1)}s PENDING=${pend} PUB=${counts.PUBLISHED ?? 0} FAIL=${counts.FAILED ?? 0}   `);
  } catch (e) {
    process.stdout.write(`\r sampler err: ${String(e.message).slice(0, 60)}   `);
  }
}, 100);

const child = spawn(process.execPath, ["node_modules/ts-node/dist/bin.js", "src/perf/run.ts", "--profile=eventbus-steady", `--duration=${process.argv[3] ?? "20000"}`, "--workers=2", `--run-id=${prefix}`], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: `postgresql://postgres:postgres@localhost:5432/${dbName}` },
  stdio: ["ignore", "pipe", "pipe"],
});
let childOut = "";
child.stdout.on("data", (d) => (childOut += d.toString()));
child.stderr.on("data", (d) => (childOut += d.toString()));
child.on("exit", async (code) => {
  clearInterval(sampler);
  process.stdout.write("\n");
  const peak = Math.max(0, ...samples.map((s) => s.PENDING ?? 0));
  console.log(`\n=== SAMPLES=${samples.length} peak PENDING=${peak} ===`);
  // Print compressed time series: PENDING at 500ms buckets
  const buckets = new Map();
  for (const s of samples) {
    const b = Math.floor((s.t - start) / 500);
    buckets.set(b, Math.max(buckets.get(b) ?? 0, s.PENDING ?? 0));
  }
  const series = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([b, v]) => `${(b * 0.5).toFixed(1)}:${v}`).join(" ");
  console.log(series.slice(0, 2500));
  const verdict = childOut.split("\n").filter((l) => l.includes("verdict:") || l.includes("EVENTBUS")).join("\n");
  console.log(verdict);
  await client.end();
});
