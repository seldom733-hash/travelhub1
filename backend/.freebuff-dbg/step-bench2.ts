/** Decompose the quote-like step cost on the rem6 DB. */
import "reflect-metadata";
import "dotenv/config";
import { PrismaService } from "../src/prisma/prisma.service";

const prisma = new PrismaService();
const tag = `dec${Date.now().toString().slice(-6)}`;
const N = 20;

function pct(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((q / 100) * sorted.length) - 1)];
}

async function bench(label: string, fn: () => Promise<void>): Promise<void> {
  const lat: number[] = [];
  for (let i = 0; i < N; i++) {
    const s = performance.now();
    await fn();
    lat.push(performance.now() - s);
  }
  const sorted = [...lat].sort((a, b) => a - b);
  console.log(`${label.padEnd(46)} p50=${pct(sorted, 50).toFixed(0)}ms p95=${pct(sorted, 95).toFixed(0)}ms`);
}

async function main(): Promise<void> {
  await prisma.$connect();
  await prisma.seqClient.$connect();
  console.log(`N=${N} db=${/5432\/([^?]+)/.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "?"}`);

  await bench("A) seqClient upsert alone", async () => {
    await prisma.seqClient.businessSequence.upsert({
      where: { prefix: `${tag}-A` },
      update: { value: { increment: 1 } },
      create: { prefix: `${tag}-A`, value: 1 },
    });
  });

  await bench("B) empty interactive $transaction", async () => {
    await prisma.$transaction(async () => undefined);
  });

  await bench("C) quote.create in tx", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.quote.create({
        data: {
          code: `${tag}-c${Math.random().toString(36).slice(2, 10)}`,
          customerId: null,
          opportunityId: null,
          productId: null,
          status: "DRAFT",
          acquisitionSource: null,
          createdById: "perf-bench",
        },
      });
    });
  });

  await bench("D) quote+history+audit in tx", async () => {
    await prisma.$transaction(async (tx) => {
      const q = await tx.quote.create({
        data: {
          code: `${tag}-d${Math.random().toString(36).slice(2, 10)}`,
          customerId: null,
          opportunityId: null,
          productId: null,
          status: "DRAFT",
          acquisitionSource: null,
          createdById: "perf-bench",
        },
      });
      await tx.quoteHistory.create({
        data: { quoteId: q.id, action: "created", from: null, to: "DRAFT", actorId: "perf-bench", actorName: "bench", fields: {} },
      });
      await tx.auditLog.create({
        data: { userId: null, username: "bench", action: "sales.quote.created", resource: "Quote", resourceId: q.id, details: {} },
      });
    });
  });

  await bench("E) quote.create autocommit (no tx)", async () => {
    await prisma.quote.create({
      data: {
        code: `${tag}-e${Math.random().toString(36).slice(2, 10)}`,
        customerId: null,
        opportunityId: null,
        productId: null,
        status: "DRAFT",
        acquisitionSource: null,
        createdById: "perf-bench",
      },
    });
  });

  await prisma.quote.deleteMany({ where: { code: { startsWith: tag } } });
  await prisma.seqClient.businessSequence.deleteMany({ where: { prefix: { startsWith: tag } } });
  await prisma.$disconnect();
  process.exit(0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(2);
});
