/**
 * Step-bench: mimics the quote-step DB work directly on Prisma (no HTTP).
 * 50 concurrent chains each: seqClient nextCode(QTE-bench) + quote INSERT +
 * quoteHistory INSERT + auditLog INSERT — the exact quote-step DB pattern.
 * If per-tx latency here is low (~50ms) while the HTTP quote step is 600ms,
 * the cost is app-side (NestJS/HTTP), not the DB.
 */
import "reflect-metadata";
import "dotenv/config";
import { PrismaService } from "../src/prisma/prisma.service";

const N = Number(process.argv[2] ?? 50);
const prisma = new PrismaService();
const tag = `bench${Date.now().toString().slice(-6)}`;

function pct(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((q / 100) * sorted.length) - 1)];
}

async function main(): Promise<void> {
  await prisma.$connect();
  console.log(`N=${N} db=${/5432\/([^?]+)/.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "?"}`);

  const lat: number[] = [];
  await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      const s = performance.now();
      const code = await prisma.seqClient.businessSequence.upsert({
        where: { prefix: `${tag}-Q` },
        update: { value: { increment: 1 } },
        create: { prefix: `${tag}-Q`, value: 1 },
      });
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
      lat.push(performance.now() - s);
    }),
  );

  const sorted = [...lat].sort((a, b) => a - b);
  console.log(`quote-like tx: n=${N} p50=${pct(sorted, 50).toFixed(0)}ms p95=${pct(sorted, 95).toFixed(0)}ms max=${(sorted[sorted.length - 1] ?? 0).toFixed(0)}ms`);
  await prisma.seqClient.businessSequence.deleteMany({ where: { prefix: { startsWith: tag } } });
  await prisma.$disconnect();
  process.exit(0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(2);
});
