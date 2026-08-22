/**
 * Verifies the decoupled-allocation design (Workstream B fix):
 *   outer domain tx (holds a connection for its duration) calls an INNER short
 *   transaction on the SAME PrismaService client to allocate a sequence value.
 * With pool=20 and 50 concurrent outer txs, does this deadlock (pool
 * exhaustion) or complete with acceptable tail?
 */
import "reflect-metadata";
import "dotenv/config";
import { PrismaService } from "../src/prisma/prisma.service";

const N = Number(process.argv[2] ?? 50);
const workMs = Number(process.argv[3] ?? 50);
const prisma = new PrismaService();
const tag = `nest${Date.now().toString().slice(-6)}`;

function pct(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((q / 100) * sorted.length) - 1)];
}

const work = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await prisma.$connect();
  await prisma.businessSequence.create({ data: { prefix: `${tag}-shared`, value: 1 } });
  const poolSize = Number(process.env.DATABASE_POOL_SIZE ?? 20);
  console.log(`N=${N} work=${workMs}ms pool=${poolSize} db=${/5432\/([^?]+)/.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "?"}`);

  const lat: number[] = [];
  const errors: string[] = [];
  await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      const s = performance.now();
      try {
        await prisma.$transaction(async (tx) => {
          // domain work (would include entity writes etc.)
          await tx.$executeRaw`SELECT 1`;
          // sequence allocation in a SHORT INNER tx on the SAME client
          const seq = await prisma.$transaction((t) =>
            t.businessSequence.upsert({
              where: { prefix: `${tag}-shared` },
              update: { value: { increment: 1 } },
              create: { prefix: `${tag}-shared`, value: 1 },
            }),
          );
          void seq;
          await work(workMs);
          await tx.$executeRaw`SELECT 2`;
        });
        lat.push(performance.now() - s);
      } catch (e) {
        errors.push(String((e as Error)?.message ?? e).slice(0, 120));
      }
    }),
  );
  const sorted = [...lat].sort((a, b) => a - b);
  console.log(
    `RESULT ok=${lat.length}/${N} p50=${pct(sorted, 50).toFixed(0)}ms p95=${pct(sorted, 95).toFixed(0)}ms max=${(
      sorted[sorted.length - 1] ?? 0
    ).toFixed(0)}ms errors=${errors.length}${errors.length ? ` first=${errors[0]}` : ""}`,
  );

  await prisma.businessSequence.deleteMany({ where: { prefix: { startsWith: tag } } });
  await prisma.$disconnect();
  process.exit(errors.length ? 1 : 0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(2);
});
