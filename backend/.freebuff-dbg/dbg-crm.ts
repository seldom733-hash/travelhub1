import "reflect-metadata";
import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";

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
  const login = await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "admin123" }) });
  const sess = (await login.json()) as { accessToken: string };
  const res = await fetch(`${base}/api/v1/customers`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.accessToken}` }, body: JSON.stringify({ type: "PERSON", firstName: "Dbg", lastName: "X", email: "dbg.x@example.test" }) });
  console.log("STATUS", res.status);
  console.log("BODY", JSON.stringify(await res.json()));
  await app.close();
}
void main();
