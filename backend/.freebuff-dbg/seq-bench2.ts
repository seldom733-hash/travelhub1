/**
 * Focused sequence-lock experiment:
 *  - E) shared prefix, upsert FIRST then 50ms work  (current pattern)
 *  - F) shared prefix, 50ms work then upsert LAST    (reorder hypothesis)
 *  - G) shared prefix, upsert in a SHORT OWN tx      (decouple hypothesis)
 * If F is fast, reordering transactions is the fix. If G is fast and F slow,
 * the lock-until-commit is intrinsic → decouple/short-tx is the fix.
 */
import "reflect-metadata";
import "dotenv/config";
import { PrismaService } from "../src/prisma/prisma.service";

const N = Number(process.argv[2] ?? 50);
const workMs = Number(process.argv[3] ?? 50);
const prisma = new PrismaService();
const tag = `seqc${Date.now().toString().slice(-6)}`;

function pct(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((q / 100) * sorted.length) - 1)];
}

async function run(label: string, fn: (i: number) => Promise<void>): Promise<void> {
  const lat: number[] = [];
  await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      const s = performance.now();
      await fn(i);
      lat.push(performance.now() - s);
    }),
  );
  const sorted = [...lat].sort((a, b) => a - b);
  console.log(
    `${label.padEnd(52)} n=${String(N).padStart(3)} p50=${pct(sorted, 50).toFixed(0).padStart(5)}ms p95=${pct(sorted, 95)
      .toFixed(0)
      .padStart(5)}ms max=${(sorted[sorted.length - 1] ?? 0).toFixed(0).padStart(5)}ms`,
  );
}

const work = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await prisma.$connect();
  await prisma.businessSequence.create({ data: { prefix: `${tag}-e`, value: 1 } });
  await prisma.businessSequence.create({ data: { prefix: `${tag}-f`, value: 1 } });
  await prisma.businessSequence.create({ data: { prefix: `${tag}-g`, value: 1 } });
  console.log(`N=${N} work=${workMs}ms db=${/5432\/([^?]+)/.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "?"}`);

  await run("E) upsert FIRST, then work (current)", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.businessSequence.upsert({
        where: { prefix: `${tag}-e` },
        update: { value: { increment: 1 } },
        create: { prefix: `${tag}-e`, value: 1 },
      });
      await work(workMs);
    });
  });

  await run("F) work FIRST, upsert LAST", async () => {
    await prisma.$transaction(async (tx) => {
      await work(workMs);
      await tx.businessSequence.upsert({
        where: { prefix: `${tag}-f` },
        update: { value: { increment: 1 } },
        create: { prefix: `${tag}-f`, value: 1 },
      });
    });
  });

  await run("G) upsert in SHORT OWN tx (decoupled)", async () => {
    await prisma.$transaction((tx) =>
      tx.businessSequence.upsert({
        where: { prefix: `${tag}-g` },
        update: { value: { increment: 1 } },
        create: { prefix: `${tag}-g`, value: 1 },
      }),
    );
    await work(workMs);
  });

  await prisma.businessSequence.deleteMany({ where: { prefix: { startsWith: tag } } });
  await prisma.$disconnect();
  process.exit(0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(2);
});
