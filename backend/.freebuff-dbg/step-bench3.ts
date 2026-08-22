/** Time upsert vs interactive-tx parts of one quote-like iteration. */
import "reflect-metadata";
import "dotenv/config";
import { PrismaService } from "../src/prisma/prisma.service";

const prisma = new PrismaService();
const tag = `p3${Date.now().toString().slice(-6)}`;

async function main(): Promise<void> {
  await prisma.$connect();
  console.log(`db=${/5432\/([^?]+)/.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "?"}`);

  const s0 = performance.now();
  const code = await prisma.seqClient.businessSequence.upsert({
    where: { prefix: `${tag}-Q` },
    update: { value: { increment: 1 } },
    create: { prefix: `${tag}-Q`, value: 1 },
  });
  const tUpsert = performance.now() - s0;

  const s1 = performance.now();
  await prisma.$transaction(async (tx) => {
    const q = await tx.quote.create({
      data: {
        code: `${tag}-${String(code.value).padStart(8, "0")}`,
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
  const tTx = performance.now() - s1;

  console.log(`upsert=${tUpsert.toFixed(1)}ms  tx=${tTx.toFixed(1)}ms  total=${(tUpsert + tTx).toFixed(1)}ms`);

  // Repeat the tx alone 3 more times to see if the first was anomalous.
  for (let i = 0; i < 3; i++) {
    const s = performance.now();
    await prisma.$transaction(async (tx) => {
      await tx.quote.create({
        data: {
          code: `${tag}-x${i}-${Math.random().toString(36).slice(2, 8)}`,
          customerId: null,
          opportunityId: null,
          productId: null,
          status: "DRAFT",
          acquisitionSource: null,
          createdById: "perf-bench",
        },
      });
    });
    console.log(`repeat tx #${i + 1}: ${(performance.now() - s).toFixed(1)}ms`);
  }

  await prisma.quote.deleteMany({ where: { code: { startsWith: tag } } });
  await prisma.seqClient.businessSequence.deleteMany({ where: { prefix: { startsWith: tag } } });
  await prisma.$disconnect();
  process.exit(0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(2);
});
