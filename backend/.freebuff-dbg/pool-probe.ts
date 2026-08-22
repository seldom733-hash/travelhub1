/**
 * Pool-probe: verifies that a second PrismaClient constructed with PrismaPg
 * honors the `max` pool option (the dedicated BusinessSequence client design).
 * Prints the number of live connections each client opens.
 */
import "reflect-metadata";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaService } from "../src/prisma/prisma.service";

async function main(): Promise<void> {
  const main = new PrismaService(); // pool = DATABASE_POOL_SIZE ?? 20
  const seqPoolSize = Number(process.env.DATABASE_SEQ_POOL_SIZE ?? 3);
  const seq = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: Number.isFinite(seqPoolSize) && seqPoolSize > 0 ? seqPoolSize : 3,
    }),
  });
  await main.$connect();
  await seq.$connect();
  await seq.businessSequence.upsert({ where: { prefix: "POOLPROBE" }, update: { value: { increment: 1 } }, create: { prefix: "POOLPROBE", value: 1 } });
  const seqConnections = await seq.$queryRawUnsafe("SELECT count(*) AS n FROM pg_stat_activity WHERE datname = current_database()");
  console.log(`DATABASE_SEQ_POOL_SIZE=${seqPoolSize}`);
  console.log(`seqClient connections on this DB: ${String((seqConnections as Array<{ n: bigint | number }>)[0]?.n)}`);
  await seq.businessSequence.deleteMany({ where: { prefix: "POOLPROBE" } });
  await seq.$disconnect();
  await main.$disconnect();
  process.exit(0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(2);
});
