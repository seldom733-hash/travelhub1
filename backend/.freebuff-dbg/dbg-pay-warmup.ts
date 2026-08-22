/* Debug (not committed): reproduce rq-pay-s slot accounting anomaly. */
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
import { sleep, scheduledStartMs } from "../src/perf/lib/pacer";

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
    const sm = await createStaffUser(baseUrl, adminToken, registry, "perfdbg_sm", RoleCode.SALES_MANAGER);
    const fin = await createStaffUser(baseUrl, adminToken, registry, "perfdbg_fin", RoleCode.FINANCE);

    const serviceDate = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
    const chainIds: string[] = [];
    for (let i = 0; i < 30; i++) {
      const c = await buildOrderChain(baseUrl, adminToken, prisma, sm, registry, 100 + (i % 900), serviceDate, `dbg${i}`);
      chainIds.push(c.saleId);
    }
    await drainOutbox(eventBus, prisma);
    const orders = await prisma.order.findMany({ where: { saleId: { in: chainIds } }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    console.log("orders:", orderIds.length);

    const pay = async (n: number, key: string) => {
      const res = await api<unknown>(baseUrl, "POST", "/api/v1/finance/payments", {
        token: fin.token,
        headers: { "Idempotency-Key": key },
        body: { orderId: orderIds[n % orderIds.length] },
        timeoutMs: 10_000,
      });
      return res.status;
    };

    // Phase A: 4 warmup-style requests paced at 2 RPS.
    const windowStart = Date.now();
    for (let n = 0; n < 4; n++) {
      const waitMs = scheduledStartMs({ targetRps: 2, durationMs: 2000, windowStartMs: windowStart }, n) - Date.now();
      if (waitMs > 0) await sleep(waitMs);
      const st = await pay(n, `perf-dbg-pay-${n}-1`);
      console.log(`warmup n=${n} order=${orderIds[n % orderIds.length].slice(0, 8)} status=${st}`);
    }
    let slots = await prisma.externalIdempotencyRecord.count({ where: { operation: "payment.create", scopeId: fin.id } });
    console.log("after warmup: total slots =", slots);

    // Phase B: 30 measurement-style requests paced at 2 RPS.
    const mStart = Date.now();
    for (let n = 4; n < 34; n++) {
      const waitMs = scheduledStartMs({ targetRps: 2, durationMs: 15000, windowStartMs: mStart }, n - 4) - Date.now();
      if (waitMs > 0) await sleep(waitMs);
      const st = await pay(n, `perf-dbg-pay-${n}-1`);
      if (st !== 200 && st !== 201) console.log(`MEAS n=${n} status=${st} !!!`);
    }
    const byStatus = await prisma.externalIdempotencyRecord.groupBy({
      by: ["status"],
      where: { operation: "payment.create", scopeId: fin.id },
      _count: { _all: true },
    });
    console.log("slots by status:", JSON.stringify(byStatus));
    const facts = await prisma.payment.count({ where: { orderId: { in: orderIds } } });
    console.log("payment facts:", facts);
  } finally {
    await app.close();
  }
}
void main();
