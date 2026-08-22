/** Raw http-client probe: quote POST at concurrency, server-instrumented via a temp interceptor. */
import "reflect-metadata";
import "dotenv/config";
import http from "node:http";
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

const N = Number(process.argv[2] ?? 40);
const CONC = Number(process.argv[3] ?? 50);
const handlerMs: number[] = [];
const samples: string[] = [];
const startedAt = new WeakMap<object, number>();

@Injectable()
class StageInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = performance.now();
    const req = ctx.switchToHttp().getRequest();
    return next.handle().pipe(
      tap(() => {
        handlerMs.push(performance.now() - start);
        if (samples.length < 10) {
          const arrived = startedAt.get(req) ?? start;
          samples.push(`arrived->ctrl=${(start - arrived).toFixed(0)}ms ctrl->end=${(performance.now() - start).toFixed(0)}ms`);
        }
      }),
    );
  }
}

function rawPost(port: number, token: string, body: string): Promise<{ ms: number; status: number }> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/api/v1/sales/quotes",
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), Authorization: `Bearer ${token}` },
        agent: false,
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve({ ms: performance.now() - t0, status: res.statusCode ?? 0 }));
      },
    );
    req.on("error", () => resolve({ ms: performance.now() - t0, status: 0 }));
    req.end(body);
  });
}

async function main() {
  process.env.OUTBOX_WORKER_ENABLED = "false";
  const app = await NestFactory.create(AppModule, { logger: ["error"] });
  // Raw express route: NO guards, NO DB, NO middleware — pure event-loop probe.
  (app.getHttpAdapter().getInstance() as unknown as { get: (p: string, h: (_req: unknown, res: { json: (b: object) => void }) => void) => void }).get("/__probe/ping", (_req: unknown, res: { json: (b: object) => void }) => res.json({ ok: true }));
  app.setGlobalPrefix("api/v1");
  app.use((await import("cookie-parser")).default());
  app.enableCors({ origin: false, credentials: true });
  app.useGlobalInterceptors(new StageInterceptor());
  await app.listen(0);
  const addr = app.getHttpServer().address() as { port: number };
  const port = addr.port;
  const srv = app.getHttpServer();
  srv.on("request", (req: object, res: import("node:http").ServerResponse) => {
    startedAt.set(req, performance.now());
    res.on("finish", () => {
      if (samples.length < 10) samples.push(`[total=${(performance.now() - (startedAt.get(req) ?? performance.now())).toFixed(0)}ms]`);
    });
  });
  const url = `http://127.0.0.1:${port}`;
  const prisma = app.get(PrismaService);
  const eventBus = app.get(EventBusService);
  const registry = newRegistry();
  const admin = await adminLogin(url);
  const prep = await prepareDataset({ baseUrl: url, adminToken: admin.accessToken, prisma, eventBus, registry, runId: `raw${Date.now().toString().slice(-6)}`, counts: datasetCountsFor("SMALL") });
  const sm = prep.sm;

  // Warm 1 raw request.
  await rawPost(port, sm.token, "{}");
  handlerMs.length = 0;

  const clientMs: number[] = [];
  const probeMs: number[] = [];
  let done = 0;
  let started = 0;
  const runOne = async () => {
    const r = await rawPost(port, sm.token, "{}");
    clientMs.push(r.ms);
    // Concurrent trivial-route probe: no DB, no guards — pure event-loop/HTTP cost.
    void (async () => {
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const req = http.request({ host: "127.0.0.1", port, path: "/__probe/ping", method: "GET", agent: false }, (res) => {
          res.resume();
          res.on("end", resolve);
        });
        req.on("error", resolve);
        req.end();
      });
      probeMs.push(performance.now() - t0);
    })();
    done++;
  };
  while (started < N) {
    if (started - done >= CONC) { await sleep(2); continue; }
    started++;
    void runOne();
  }
  while (done < started) await sleep(5);

  const sorted = (a: number[]) => a.slice().sort((x, y) => x - y);
  const pct = (a: number[], p: number) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
  const fmt = (a: number[]) => `n=${a.length} p50=${pct(a, 0.5).toFixed(0)} p95=${pct(a, 0.95).toFixed(0)} max=${pct(a, 1).toFixed(0)}`;
  console.log(`\n=== RAW CLIENT N=${N} CONC=${CONC} ===`);
  console.log(`client-observed: ${fmt(sorted(clientMs))} ms`);
  console.log(`server handler:  ${fmt(sorted(handlerMs))} ms`);
  console.log(`trivial-route probe: ${fmt(sorted(probeMs))} ms`);
  console.log(`sample phases:`);
  for (const s of samples) console.log(`  ${s}`);
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
