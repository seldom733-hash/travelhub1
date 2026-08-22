/* Debug (not committed): replicate harness runLoad warmup + payment slot accounting. */
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
import { runLoad } from "../src/perf/lib/loader";

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
    const sm = await createStaffUser(baseUrl, adminToken, registry, `perfdbg2_${ts}_sm`, RoleCode.SALES_MANAGER);
    const fin = await createStaffUser(baseUrl, adminToken, registry, `perfdbg2_${ts}_fin`, RoleCode.FINANCE);

    const serviceDate = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
    const chainIds: string[] = [];
    for (let i = 0; i < 30; i++) {
      const c = await buildOrderChain(baseUrl, adminToken, prisma, sm, registry, 100 + (i % 900), serviceDate, `dbg2${i}`);
      chainIds.push(c.saleId);
    }
    await drainOutbox(eventBus, prisma);
    const orders = await prisma.order.findMany({ where: { saleId: { in: chainIds } }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    console.log("orders:", orderIds.length);

    const runId = `rq-pay-dbg-${ts}`;
    const seed = 1;
    const result = await runLoad({
      baseUrl,
      concurrency: 20,
      durationMs: 15_000,
      warmupMs: 2_000,
      mode: "paced",
      targetRps: 2,
      makeRequest: (n: number) => {
        const orderId = orderIds[n % orderIds.length];
        return {
          label: "payment.create",
          method: "POST" as const,
          path: "/api/v1/finance/payments",
          headers: { Authorization: `Bearer ${fin.token}`, "Idempotency-Key": `perf-${runId}-pay-${n}-${seed}` },
          body: { orderId },
          expected: [200, 201],
          routeClass: "E" as const,
        };
      },
      seed,
    });
    console.log("load totals:", JSON.stringify({ total: result.totalRequests, expected: result.expected, unexpected: result.unexpectedStatuses, perBaseUrl: result.perBaseUrl }));
    console.log("warmup:", JSON.stringify(result.warmup));
    console.log("pacing:", JSON.stringify(result.pacing && { started: result.pacing.startedOperations, completed: result.pacing.completedOperations }));

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
