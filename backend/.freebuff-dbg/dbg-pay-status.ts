/* Debug (not committed): log the exact status of each warmup-style payment request. */
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
    const sm = await createStaffUser(baseUrl, adminToken, registry, `perfdbg3_${ts}_sm`, RoleCode.SALES_MANAGER);
    const fin = await createStaffUser(baseUrl, adminToken, registry, `perfdbg3_${ts}_fin`, RoleCode.FINANCE);

    const serviceDate = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
    const chainIds: string[] = [];
    for (let i = 0; i < 30; i++) {
      const c = await buildOrderChain(baseUrl, adminToken, prisma, sm, registry, 100 + (i % 900), serviceDate, `dbg3${i}`);
      chainIds.push(c.saleId);
    }
    await drainOutbox(eventBus, prisma);
    const orders = await prisma.order.findMany({ where: { saleId: { in: chainIds } }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    console.log("orders:", orderIds.length);

    // Replicate the loader warmup window with status logging.
    const windowStart = Date.now();
    const targetRps = 2;
    const durationMs = 2000;
    const scheduled = Math.floor((durationMs / 1000) * targetRps);
    let started = 0;
    let completed = 0;
    const results: string[] = [];
    const startOne = async (n: number) => {
      const sched = scheduledStartMs({ targetRps, durationMs, windowStartMs: windowStart }, n);
      const delay = sched - Date.now();
      if (delay > 0) await sleep(delay);
      started++;
      try {
        const st = await api<unknown>(baseUrl, "POST", "/api/v1/finance/payments", {
          token: fin.token,
          headers: { "Idempotency-Key": `perf-rq-dbgst-${n}-1` },
          body: { orderId: orderIds[n % orderIds.length] },
          timeoutMs: 10_000,
        });
        results.push(`n=${n} order=${orderIds[n % orderIds.length].slice(0, 8)} status=${st.status} body=${JSON.stringify(st.body).slice(0, 120)}`);
      } catch (e) {
        results.push(`n=${n} THREW ${String((e as Error)?.message ?? e)}`);
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
      void startOne(next);
      next++;
    }
    while (completed < next) await sleep(10);
    console.log("warmup results:");
    for (const r of results) console.log("  " + r);

    const byStatus = await prisma.externalIdempotencyRecord.groupBy({ by: ["status"], where: { operation: "payment.create", scopeId: fin.id }, _count: { _all: true } });
    console.log("slots after warmup:", JSON.stringify(byStatus));
    const facts = await prisma.payment.count({ where: { orderId: { in: orderIds } } });
    console.log("payment facts after warmup:", facts);
  } finally {
    await app.close();
  }
}
void main();
