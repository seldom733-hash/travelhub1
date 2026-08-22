/* Debug (not committed): warmup window → slot count → measurement window → slot count. */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";
import { EventBusService } from "../src/eventbus/eventbus.service";
import { newRegistry, createStaffUser, buildOrderChain, drainOutbox, api } from "../src/perf/lib/seed";
import { RoleCode } from "../src/generated/prisma/enums";
import { scheduledStartMs, sleep } from "../src/perf/lib/pacer";

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn"] });
  app.setGlobalPrefix("api/v1");
  app.use(cookieParser());
  app.enableCors({ origin: false, credentials: true });
  (app.getHttpAdapter().getInstance() as { set: (k: string, v: string) => void }).set("query parser", "extended");
  app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
  app.useGlobalFilters(new AppExceptionFilter());
  await app.listen(0);
  const baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
  const prisma = app.get(PrismaService);
  const eventBus = app.get(EventBusService);
  const registry = newRegistry();
  try {
    const adminRes = await api<{ accessToken: string }>(baseUrl, "POST", "/api/v1/auth/login", { body: { username: "admin", password: "admin123" } });
    const adminToken = adminRes.body.accessToken;
    const ts = Date.now().toString(36);
    const sm = await createStaffUser(baseUrl, adminToken, registry, `perfdbg4_${ts}_sm`, RoleCode.SALES_MANAGER);
    const fin = await createStaffUser(baseUrl, adminToken, registry, `perfdbg4_${ts}_fin`, RoleCode.FINANCE);

    const serviceDate = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
    const chainIds: string[] = [];
    for (let i = 0; i < 30; i++) {
      const c = await buildOrderChain(baseUrl, adminToken, prisma, sm, registry, 100 + (i % 900), serviceDate, `dbg4${i}`);
      chainIds.push(c.saleId);
    }
    await drainOutbox(eventBus, prisma);
    const orders = await prisma.order.findMany({ where: { saleId: { in: chainIds } }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    console.log("orders:", orderIds.length);

    const runId = `rq-pay-comb-${ts}`;
    const seed = 1;
    let iterationN = 0;
    const makeReq = (n: number) => ({
      method: "POST" as const,
      path: "/api/v1/finance/payments",
      headers: { Authorization: `Bearer ${fin.token}`, "Idempotency-Key": `perf-${runId}-pay-${n}-${seed}` },
      body: { orderId: orderIds[n % orderIds.length] },
      timeoutMs: 10_000,
    });

    const runWindow = async (label: string, windowStart: number, targetRps: number, durationMs: number, fromN: number, count: number) => {
      const scheduled = Math.floor((durationMs / 1000) * targetRps);
      let started = 0;
      let completed = 0;
      const res: string[] = [];
      const startOne = async (n: number) => {
        const sched = scheduledStartMs({ targetRps, durationMs, windowStartMs: windowStart }, n - fromN);
        const delay = sched - Date.now();
        if (delay > 0) await sleep(delay);
        started++;
        try {
          const st = await api<unknown>(baseUrl, "POST", makeReq(n).path, makeReq(n));
          res.push(`n=${n} status=${st.status}`);
        } catch (e) {
          res.push(`n=${n} THREW ${String((e as Error)?.message ?? e)}`);
        } finally {
          completed++;
        }
      };
      const deadline = windowStart + durationMs;
      let next = 0;
      while (next < scheduled) {
        const waitMs = scheduledStartMs({ targetRps, durationMs, windowStartMs: windowStart }, next) - Date.now();
        if (waitMs > 0) await sleep(waitMs);
        if (Date.now() >= deadline) break;
        void startOne(fromN + next);
        next++;
      }
      while (completed < next) await sleep(10);
      console.log(`${label}: ${res.join(" ")}`);
    };

    // Warmup window (2 RPS, 2000 ms, n=0..3).
    await runWindow("WARMUP", Date.now(), 2, 2000, 0, 4);
    let slots = await prisma.externalIdempotencyRecord.count({ where: { operation: "payment.create", scopeId: fin.id } });
    let facts = await prisma.payment.count({ where: { orderId: { in: orderIds } } });
    console.log(`after WARMUP: slots=${slots} facts=${facts}`);

    // Measurement window (2 RPS, 15000 ms, n=4..33).
    await runWindow("MEASURE", Date.now(), 2, 15000, 4, 30);
    slots = await prisma.externalIdempotencyRecord.count({ where: { operation: "payment.create", scopeId: fin.id } });
    facts = await prisma.payment.count({ where: { orderId: { in: orderIds } } });
    const byStatus = await prisma.externalIdempotencyRecord.groupBy({ by: ["status"], where: { operation: "payment.create", scopeId: fin.id }, _count: { _all: true } });
    console.log(`after MEASURE: slots=${slots} facts=${facts} byStatus=${JSON.stringify(byStatus)}`);
  } finally {
    await app.close();
  }
}
void main();
