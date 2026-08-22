import pg from "pg";
const { Pool } = pg;

function pct(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.ceil((q / 100) * sorted.length) - 1)];
}

async function run(N) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 50 });
  for (let i = 0; i < N; i++) await pool.query("SELECT 1");

  const lat = [];
  await Promise.all(
    Array.from({ length: N }, async () => {
      const s = performance.now();
      await pool.query(
        `INSERT INTO "events"."OutboxEvent" (id, "aggregateType", "aggregateId", "eventType", payload, status) VALUES (gen_random_uuid(), 'x', 'x', 'x', '{"a":1}', 'PENDING')`,
      );
      lat.push(performance.now() - s);
    }),
  );
  const sorted = [...lat].sort((a, b) => a - b);
  console.log(`N=${N} pool.query:   p50=${pct(sorted, 50).toFixed(0)}ms p95=${pct(sorted, 95).toFixed(0)}ms`);

  const lat2 = [];
  await Promise.all(
    Array.from({ length: N }, async () => {
      const s = performance.now();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO "events"."OutboxEvent" (id, "aggregateType", "aggregateId", "eventType", payload, status) VALUES (gen_random_uuid(), 'x', 'x', 'x', '{"a":1}', 'PENDING')`,
        );
        await client.query("COMMIT");
      } finally {
        client.release();
      }
      lat2.push(performance.now() - s);
    }),
  );
  const sorted2 = [...lat2].sort((a, b) => a - b);
  console.log(`N=${N} pool.connect: p50=${pct(sorted2, 50).toFixed(0)}ms p95=${pct(sorted2, 95).toFixed(0)}ms`);
  await pool.end();
}

for (const n of [5, 10, 20]) {
  await run(n);
}
process.exit(0);
