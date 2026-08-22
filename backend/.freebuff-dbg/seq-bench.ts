/** Micro-benchmark: 50 concurrent nextCode allocations on the same prefix. */
import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { IdsService } from "../src/shared/ids.service";
import { PrismaService } from "../src/prisma/prisma.service";

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ["error"] });
  const ids = app.get(IdsService);
  const prisma = app.get(PrismaService);
  await prisma.$connect();

  const N = 50;
  // Warm the seqClient pool (cold-connect dominates the first claim).
  await ids.nextCode(undefined as never, "WARM");
  for (const prefix of ["PAY", "QTE", "SAL"]) {
    const start = performance.now();
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) => ids.nextCode(undefined as never, prefix).then((code) => performance.now() - start)),
    );
    results.sort((a, b) => a - b);
    const p50 = results[Math.floor(N * 0.5)];
    const p95 = results[Math.floor(N * 0.95)];
    const p99 = results[Math.floor(N * 0.99)];
    console.log(`nextCode(${prefix}) concurrent ${N}: p50=${p50.toFixed(0)}ms p95=${p95.toFixed(0)}ms p99=${p99.toFixed(0)}ms max=${results[N - 1].toFixed(0)}ms total=${(performance.now() - start).toFixed(0)}ms`);
  }
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
