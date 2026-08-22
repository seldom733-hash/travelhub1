import "reflect-metadata";
import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";

async function main() {
  process.env.OUTBOX_WORKER_ENABLED = "false";
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn"] });
  app.setGlobalPrefix("api/v1");
  app.use(cookieParser());
  app.enableCors({ origin: false, credentials: true });
  app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
  app.useGlobalFilters(new AppExceptionFilter());
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;
  const prisma = app.get(PrismaService);
  const login = await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "admin123" }) });
  const admin = (await login.json()) as { accessToken: string; user: { id: string } };
  const u = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin.accessToken}` }, body: JSON.stringify({ username: "dbgfin1", password: "perfpass123", roleCode: "FINANCE" }) });
  const lu = await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "dbgfin1", password: "perfpass123" }) });
  const fin = (await lu.json()) as { accessToken: string; user: { id: string } };
  // pick an order from the perf DB created by rem-pay-s (payment-capable, no payment yet)
  const order = await prisma.order.findFirst({ where: {}, select: { id: true, status: true, amount: true }, take: 1 });
  console.log("ORDER", JSON.stringify(order));
  if (!order) return;
  const res = await fetch(`${base}/api/v1/finance/payments`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${fin.accessToken}`, "Idempotency-Key": "dbg-key-1" }, body: JSON.stringify({ orderId: order.id }) });
  console.log("STATUS", res.status, JSON.stringify(await res.json()));
  await app.close();
}
void main();
