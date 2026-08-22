import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main(): Promise<void> {
  const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }) });
  await p.$connect();
  // Sequential autocommit inserts — measures per-commit WAL/fsync cost.
  const t0 = Date.now();
  for (let i = 0; i < 30; i++) {
    await p.$executeRawUnsafe(
      `INSERT INTO "events"."OutboxEvent" (id, "aggregateType", "aggregateId", "eventType", payload, status) VALUES (gen_random_uuid(), 'x', 'x', 'x', '{"a":1}', 'PENDING')`,
    );
  }
  const perInsert = (Date.now() - t0) / 30;
  console.log(`30 sequential autocommit inserts: ${perInsert.toFixed(1)} ms/insert`);
  await p.$disconnect();
  process.exit(0);
}

void main().catch((e) => {
  console.error((e as Error).message);
  process.exit(2);
});
