/**
 * Payment.create path profiler: times each phase of a single request against
 * the real API, plus direct Prisma micro-benchmarks (order read, business
 * sequence upsert, idempotency claim/complete, audit, emit) to isolate where
 * the ~460ms baseline comes from.
 */
import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { EventBusService } from "../src/eventbus/eventbus.service";
import { adminLogin, api, createStaffUser, newRegistry, prepareDataset, type Tracked } from "../src/perf/lib/seed";
import { datasetCountsFor } from "../src/perf/lib/qualification";
import { IdsService } from "../src/shared/ids.service";
import { SecurityService } from "../src/security/security.service";

const DB = process.env.DATABASE_URL ?? "";
const tag = `payprof${Date.now().toString().slice(-6)}`;
function t(label: string, ms: number) {
  console.log(`  ${label.padEnd(44)} ${ms.toFixed(1).padStart(8)} ms`);
}

async function main() {
  process.env.OUTBOX_WORKER_ENABLED = "false";
  const app = await NestFactory.create(AppModule, { logger: ["error"] });
  app.setGlobalPrefix("api/v1");
  app.use((await import("cookie-parser")).default());
  app.enableCors({ origin: false, credentials: true });
  await app.listen(0);
  const addr = app.getHttpServer().address() as { port: number };
  const url = `http://127.0.0.1:${addr.port}`;
  const prisma = app.get(PrismaService);
  const eventBus = app.get(EventBusService);
  const ids = app.get(IdsService);
  const sec = app.get(SecurityService);
  const registry: Tracked = newRegistry();
  const admin = await adminLogin(url);
  const counts = datasetCountsFor("SMALL");
  const prep = await prepareDataset({ baseUrl: url, adminToken: admin.accessToken, prisma, eventBus, registry, runId: tag, counts });
  const fin = prep.fin;

  // Create an order to pay.
  const orders = await prisma.order.findMany({ where: { status: { notIn: ["CANCELLED"] } }, take: 1, select: { id: true, amount: true, currency: true } });
  if (orders.length === 0) throw new Error("no payable order");
  const orderId = orders[0].id;
  console.log(`order=${orderId} amount=${orders[0].amount}`);

  // Warm 1 request.
  await api(url, "POST", "/api/v1/finance/payments", { token: fin.token, body: { orderId }, headers: { "Idempotency-Key": `${tag}-warm` } });

  // Full HTTP request timing.
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const r = await api(url, "POST", "/api/v1/finance/payments", { token: fin.token, body: { orderId }, headers: { "Idempotency-Key": `${tag}-r${i}` } });
    console.log(`HTTP payment.create #${i}: ${(performance.now() - t0).toFixed(1)} ms status=${r.status}`);
  }

  // Micro-benchmarks: raw DB ops on the same connection pool.
  console.log("\n=== micro-benchmarks (10 iterations each) ===");
  let s = performance.now();
  for (let i = 0; i < 10; i++) await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true } });
  t("order.findUnique (read)", (performance.now() - s) / 10);

  s = performance.now();
  for (let i = 0; i < 10; i++) await prisma.$transaction((tx) => ids.nextCode(tx, "PAY"));
  t("businessSequence.upsert (nextCode PAY, own tx)", (performance.now() - s) / 10);

  s = performance.now();
  for (let i = 0; i < 10; i++) {
    await prisma.$transaction((tx) => ids.nextCode(tx, "PAY"));
  }
  t("nextCode PAY inside shared-ish tx", (performance.now() - s) / 10);

  s = performance.now();
  for (let i = 0; i < 10; i++) {
    const key = `${tag}-mb${i}`;
    await prisma.externalIdempotencyRecord.create({ data: { slotKey: `x-${key}`, scopeType: "USER", scopeId: fin.id, operation: "payment.create", fingerprint: "f", status: "IN_PROGRESS", claimedAt: new Date() } });
    await prisma.externalIdempotencyRecord.updateMany({ where: { slotKey: `x-${key}` }, data: { status: "COMPLETED", responseStatus: 201, responseBody: {}, completedAt: new Date() } });
  }
  t("idempotency claim+complete (raw)", (performance.now() - s) / 10);

  s = performance.now();
  for (let i = 0; i < 10; i++) {
    await prisma.auditLog.create({ data: { action: "diag", resource: "X", resourceId: `${tag}-${i}`, userId: fin.id, username: fin.username, details: {} } } as never);
  }
  t("auditLog.create (raw)", (performance.now() - s) / 10);

  s = performance.now();
  for (let i = 0; i < 10; i++) await eventBus.publishPending(10);
  t("eventBus.publishPending(10)", (performance.now() - s) / 10);

  // Cleanup
  await (await import("../src/perf/lib/seed")).cleanup(prisma, registry);
  await app.close();
  process.exit(0);
}

void main().catch((e) => { console.error(e); process.exit(2); });
