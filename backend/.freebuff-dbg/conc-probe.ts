import "reflect-metadata";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main(): Promise<void> {
  const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 50 }) });
  await p.$connect();
  const N = Number(process.argv[2] ?? 50);

  // Warmup: force the pool to create up to N connections sequentially before measuring.
  const warmupLat: number[] = [];
  for (let i = 0; i < N; i++) {
    const s = performance.now();
    await p.$executeRawUnsafe(`SELECT 1`);
    warmupLat.push(performance.now() - s);
  }
  const ws = [...warmupLat].sort((a, b) => a - b);
  const wp = (q: number) => ws[Math.min(ws.length - 1, Math.ceil((q / 100) * ws.length) - 1)];
  console.log(`warmup sequential SELECT 1: n=${N} p50=${wp(50).toFixed(1)}ms p95=${wp(95).toFixed(1)}ms max=${(ws[ws.length - 1] ?? 0).toFixed(1)}ms`);

  // 50 concurrent simple autocommit inserts (no shared row).
  const lat: number[] = [];
  await Promise.all(
    Array.from({ length: N }, async () => {
      const s = performance.now();
      await p.$executeRawUnsafe(
        `INSERT INTO "events"."OutboxEvent" (id, "aggregateType", "aggregateId", "eventType", payload, status) VALUES (gen_random_uuid(), 'x', 'x', 'x', '{"a":1}', 'PENDING')`,
      );
      lat.push(performance.now() - s);
    }),
  );
  const sorted = [...lat].sort((a, b) => a - b);
  const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil((q / 100) * sorted.length) - 1)];
  console.log(`concurrent autocommit inserts: n=${N} p50=${pct(50).toFixed(1)}ms p95=${pct(95).toFixed(1)}ms max=${(sorted[sorted.length - 1] ?? 0).toFixed(1)}ms`);

  // Same but 50 concurrent interactive transactions (1 insert each).
  const lat2: number[] = [];
  await Promise.all(
    Array.from({ length: N }, async () => {
      const s = performance.now();
      await p.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO "events"."OutboxEvent" (id, "aggregateType", "aggregateId", "eventType", payload, status) VALUES (gen_random_uuid(), 'x', 'x', 'x', '{"a":1}', 'PENDING')`,
        );
      });
      lat2.push(performance.now() - s);
    }),
  );
  const sorted2 = [...lat2].sort((a, b) => a - b);
  const pct2 = (q: number) => sorted2[Math.min(sorted2.length - 1, Math.ceil((q / 100) * sorted2.length) - 1)];
  console.log(`concurrent interactive tx (1 insert): n=${N} p50=${pct2(50).toFixed(1)}ms p95=${pct2(95).toFixed(1)}ms max=${(sorted2[sorted2.length - 1] ?? 0).toFixed(1)}ms`);

  await p.$disconnect();
  process.exit(0);
}

void main().catch((e) => {
  console.error((e as Error).message);
  process.exit(2);
});
