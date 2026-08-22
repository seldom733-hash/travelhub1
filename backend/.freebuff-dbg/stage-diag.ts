/** Stage-level timing: middleware→handler (guards) vs handler execution, at concurrency. */
import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { EventBusService } from "../src/eventbus/eventbus.service";
import { adminLogin, api, newRegistry, prepareDataset } from "../src/perf/lib/seed";
import { datasetCountsFor } from "../src/perf/lib/qualification";
import { sleep } from "../src/perf/lib/pacer";

const N = Number(process.argv[2] ?? 30);
const CONC = Number(process.argv[3] ?? 50);
const guardMs: number[] = [];
const handlerMs: number[] = [];
const totalMs: number[] = [];

@Injectable()
class StageInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = performance.now();
    return next.handle().pipe(
      tap(() => {
        handlerMs.push(performance.now() - start);
      }),
    );
  }
}

async function main() {
  process.env.OUTBOX_WORKER_ENABLED = "false";
  const app = await NestFactory.create(AppModule, { logger: ["error"] });
  app.setGlobalPrefix("api/v1");
  app.use((await import("cookie-parser")).default());
  app.enableCors({ origin: false, credentials: true });
  app.useGlobalInterceptors(new StageInterceptor());
  // Middleware: measures the pre-handler pipeline (body parse + guards).
  app.use((req: { start?: number }, _res: unknown, next: () => void) => {
    (req as { start: number }).start = performance.now();
    next();
  });
  await app.listen(0);
  const addr = app.getHttpServer().address() as { port: number };
  const url = `http://127.0.0.1:${addr.port}`;
  const prisma = app.get(PrismaService);
  const eventBus = app.get(EventBusService);
  const registry = newRegistry();
  const admin = await adminLogin(url);
  const prep = await prepareDataset({ baseUrl: url, adminToken: admin.accessToken, prisma, eventBus, registry, runId: `stage${Date.now().toString().slice(-6)}`, counts: datasetCountsFor("SMALL") });
  const sm = prep.sm;

  // Warm 1 request.
  await api(url, "POST", "/api/v1/sales/quotes", { token: sm.token, body: {} });
  // Reset measurement arrays: seed-phase requests must not pollute stats.
  handlerMs.length = 0;
  totalMs.length = 0;
  // Remove the now-shadowed duplicate declaration further down.

  const handlerById: Record<number, number> = {};
  // Hook into the http server response to measure total server-side duration.
  const srv = app.getHttpServer();
  const orig = srv.emit;
  srv.emit = function (event: string, ...args: unknown[]) {
    if (event === "request") {
      const [req, res] = args as [import("node:http").IncomingMessage, import("node:http").ServerResponse];
      const reqId = Math.floor(Math.random() * 1e9);
      (req as { reqId?: number }).reqId = reqId;
      const t0 = performance.now();
      res.on("finish", () => {
        totalMs.push(performance.now() - t0);
        handlerById[reqId] = t0;
      });
    }
    return (orig as (...a: unknown[]) => boolean).call(this, event, ...args);
  };

  let done = 0;
  let started = 0;
  const runOne = async (i: number) => {
    const r = await api(url, "POST", "/api/v1/sales/quotes", { token: sm.token, body: {} });
    done++;
    if (r.status !== 201) console.log(`  req ${i} status ${r.status}`);
  };
  while (started < N) {
    if (started - done >= CONC) { await sleep(2); continue; }
    started++;
    void runOne(started).then(() => undefined);
  }
  while (done < started) await sleep(5);

  // Drop the first (warm) request from stats.
  const sorted = (a: number[]) => a.slice(1).sort((x, y) => x - y);
  const pct = (a: number[], p: number) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
  const fmt = (a: number[]) => `n=${a.length} p50=${pct(a, 0.5).toFixed(0)} p95=${pct(a, 0.95).toFixed(0)} max=${pct(a, 1).toFixed(0)}`;
  console.log(`\n=== N=${N} CONC=${CONC} ===`);
  console.log(`handler (controller only): ${fmt(sorted(handlerMs))} ms`);
  console.log(`total server-side (finish): ${fmt(sorted(totalMs))} ms`);
  console.log(`guard+pipeline (total-handler avg): ${(totalMs.reduce((a, b) => a + b, 0) / Math.max(1, totalMs.length - 1) - handlerMs.reduce((a, b) => a + b, 0) / Math.max(1, handlerMs.length - 1)).toFixed(0)} ms`);
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
