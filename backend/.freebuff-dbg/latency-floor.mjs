import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

// Single sequential query latency (no concurrency)
const seq = [];
for (let i = 0; i < 20; i++) {
  const s = performance.now();
  await pool.query("SELECT 1");
  seq.push(performance.now() - s);
}
const s = [...seq].sort((a, b) => a - b);
console.log(`single sequential SELECT 1: p50=${s[10].toFixed(2)}ms p95=${s[18].toFixed(2)}ms min=${s[0].toFixed(2)}ms`);

// Small concurrent batch
for (const n of [2, 5, 10]) {
  const lat = [];
  await Promise.all(
    Array.from({ length: n }, async () => {
      const t = performance.now();
      await pool.query("SELECT 1");
      lat.push(performance.now() - t);
    }),
  );
  const sl = [...lat].sort((a, b) => a - b);
  console.log(`concurrent SELECT 1 n=${n}: p50=${(sl[Math.floor(sl.length / 2)] ?? 0).toFixed(2)}ms max=${(sl[sl.length - 1] ?? 0).toFixed(2)}ms`);
}

// A real-ish write: INSERT with gen_random_uuid
const seqw = [];
for (let i = 0; i < 10; i++) {
  const s = performance.now();
  await pool.query("INSERT INTO public.l1_probe (note) VALUES ('x')");
  seqw.push(performance.now() - s);
}
const sw = [...seqw].sort((a, b) => a - b);
console.log(`single sequential INSERT: p50=${sw[5].toFixed(2)}ms min=${sw[0].toFixed(2)}ms`);

await pool.end();
process.exit(0);
