/**
 * Chain-latency diagnostic: boots the real app, prepares a small dataset, then
 * runs `count` booking-order chains at `concurrency`, logging per-call latency
 * for each of the 10 chain steps and sampling DB blocker activity.
 * Read-only with respect to production code; uses the harness seed helpers.
 */
import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { EventBusService } from "../src/eventbus/eventbus.service";
import { adminLogin, api, createStaffUser, drainOutbox, futureDate, newRegistry, prepareDataset, type Tracked } from "../src/perf/lib/seed";
import { datasetCountsFor } from "../src/perf/lib/qualification";
import { sleep } from "../src/perf/lib/pacer";
import { spawnSync } from "node:child_process";

const DB = process.env.DATABASE_URL ?? "";
const dbName = /5432\/([^?]+)/.exec(DB)?.[1] ?? "postgres";
const count = Number(process.argv[2] ?? 20);
const concurrency = Number(process.argv[3] ?? 10);
const tag = `cdiag${Date.now().toString().slice(-6)}`;

function blockers(): string {
  const r = spawnSync("psql", ["-h", "localhost", "-U", "postgres", "-d", dbName, "-t", "-A", "-c", `
    SELECT left(a.query, 90) || ' WAIT=' || a.wait_event_type
    FROM pg_stat_activity a WHERE a.wait_event_type IS NOT NULL AND a.datname='${dbName}' LIMIT 6
  `], { encoding: "utf8", env: { ...process.env, PGPASSWORD: "postgres" } });
  return r.stdout.trim().replace(/\n/g, " | ") || "(none)";
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
  const registry: Tracked = newRegistry();
  const admin = await adminLogin(url);
  const counts = datasetCountsFor("SMALL");
  const prep = await prepareDataset({ baseUrl: url, adminToken: admin.accessToken, prisma, eventBus, registry, runId: tag, counts });
  const sm = prep.sm;
  const serviceDate = futureDate(45);

  console.log(`chains=${count} concurrency=${concurrency} base=${url}`);

  // Event-loop lag probe: drift of a 50ms interval. If the loop is saturated by
  // synchronous event-chain processing, lag will spike to seconds during completes.
  let maxLagMs = 0;
  let lastLagSample = 0;
  const lagProbe = setInterval(() => {
    const drift = performance.now() - lastLagSample - 50;
    lastLagSample = performance.now();
    if (drift > maxLagMs) maxLagMs = drift;
  }, 50);
  lastLagSample = performance.now();

  const stepNames = ["product", "availability", "quote", "item", "commercial", "issue", "checkout", "terms", "sale", "complete"];
  const stepStats: Record<string, number[]> = {};
  for (const s of stepNames) stepStats[s] = [];
  const chainMs: number[] = [];
  let started = 0, done = 0, failed = 0;

  const runOne = async (i: number) => {
    const t0 = performance.now();
    try {
      const prod = await api<{ product: { id: string } }>(url, "POST", "/api/v1/products", {
        token: admin.accessToken,
        body: { type: "TOUR", title: `Diag ${tag} ${i}`, tariffs: [{ name: "Std", price: 100 + (i % 900) }] },
      });
      if (prod.status !== 201) throw new Error(`product ${prod.status}`);
      const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: prod.body.product.id } });
      const avail = await api(url, "POST", `/api/v1/products/${prod.body.product.id}/availability`, {
        token: admin.accessToken,
        body: { tariffId: tariff.id, date: `${serviceDate}T00:00:00.000Z`, slotsTotal: 100 },
      });
      if (avail.status !== 201) throw new Error(`availability ${avail.status}`);
      stepStats["product"].push(0); stepStats["availability"].push(0);

      const t1 = performance.now();
      const quote = await api<{ id: string; code: string }>(url, "POST", "/api/v1/sales/quotes", { token: sm.token, body: {} });
      if (quote.status !== 201) throw new Error(`quote ${quote.status}: ${JSON.stringify(quote.body)}`);
      stepStats["quote"].push(performance.now() - t1);

      const t2 = performance.now();
      const item = await api(url, "POST", `/api/v1/sales/quotes/${quote.body.code}/items`, { token: sm.token, body: { productId: prod.body.product.id, tariffId: tariff.id, quantity: 1 } });
      if (item.status !== 201) throw new Error(`item ${item.status}`);
      stepStats["item"].push(performance.now() - t2);

      const t3 = performance.now();
      const commercial = await api(url, "PUT", `/api/v1/sales/quotes/${quote.body.code}/commercial`, { token: sm.token, body: { discountType: "NONE", validUntil: new Date(Date.now() + 60 * 86400000).toISOString() } });
      if (commercial.status !== 200) throw new Error(`commercial ${commercial.status}`);
      stepStats["commercial"].push(performance.now() - t3);

      const t4 = performance.now();
      const issue = await api(url, "POST", `/api/v1/sales/quotes/${quote.body.code}/issue`, { token: sm.token });
      if (issue.status !== 201) throw new Error(`issue ${issue.status}`);
      stepStats["issue"].push(performance.now() - t4);

      const t5 = performance.now();
      const intent = await api<{ id: string; code: string; version: number }>(url, "POST", "/api/v1/sales/checkouts", { token: sm.token, body: { quoteId: quote.body.id, serviceDate, travelers: [] } });
      if (intent.status !== 201) throw new Error(`checkout ${intent.status}`);
      stepStats["checkout"].push(performance.now() - t5);

      const t6 = performance.now();
      const terms = await api(url, "PUT", `/api/v1/sales/checkouts/${intent.body.code}/payment-terms`, { token: sm.token, body: { scheme: "FULL_PREPAYMENT", expectedVersion: intent.body.version } });
      if (terms.status !== 200) throw new Error(`terms ${terms.status}`);
      stepStats["terms"].push(performance.now() - t6);

      const t7 = performance.now();
      const sale = await api<{ id: string; code: string }>(url, "POST", "/api/v1/sales/sales", { token: sm.token, body: { quoteId: quote.body.id, checkoutIntentId: intent.body.id } });
      if (sale.status !== 201) throw new Error(`sale ${sale.status}`);
      stepStats["sale"].push(performance.now() - t7);

      const t8 = performance.now();
      const complete = await api(url, "POST", `/api/v1/sales/sales/${sale.body.code}/complete`, { token: sm.token, body: { expectedVersion: 1 } });
      if (complete.status !== 201) throw new Error(`complete ${complete.status}`);
      stepStats["complete"].push(performance.now() - t8);
    } catch (err) {
      failed++;
      if (failed <= 3) console.log(`  chain ${i} FAILED: ${String((err as Error)?.message ?? err)}`);
    } finally {
      chainMs.push(performance.now() - t0);
      done++;
    }
  };

  // Launch with semaphore.
  let next = 0;
  async function pump() {
    while (next < count) {
      const inFlight = started - done;
      if (inFlight >= concurrency) { await sleep(5); continue; }
      started++;
      void runOne(next).then(() => undefined);
      next++;
      if (next % 5 === 0) console.log(`  started=${started} done=${done} failed=${failed} lag=${maxLagMs}ms`);
    }
  }
  await pump();
  while (done < started) await sleep(20);

  clearInterval(lagProbe);
  console.log(`\n=== RESULT chains=${started} done=${done} failed=${failed} maxEventLoopLag=${maxLagMs}ms ===`);
  console.log("=== per-step latency (ms) p50/p95/max/n ===");
  for (const s of stepNames) {
    const arr = stepStats[s].sort((a, b) => a - b);
    const p = (q: number) => arr.length ? arr[Math.min(arr.length - 1, Math.ceil((q / 100) * arr.length) - 1)] : 0;
    console.log(`  ${s.padEnd(12)} n=${String(arr.length).padStart(3)} p50=${p(50).toFixed(0).padStart(6)} p95=${p(95).toFixed(0).padStart(6)} max=${(arr[arr.length - 1] ?? 0).toFixed(0).padStart(6)}`);
  }
  const c = chainMs.sort((a, b) => a - b);
  const cp = (q: number) => c.length ? c[Math.min(c.length - 1, Math.ceil((q / 100) * c.length) - 1)] : 0;
  console.log(`chain total: n=${c.length} p50=${cp(50).toFixed(0)} p95=${cp(95).toFixed(0)} max=${(c[c.length - 1] ?? 0).toFixed(0)} ms`);

  await drainOutbox(eventBus, prisma);
  const issues = await (await import("../src/perf/lib/seed")).cleanup(prisma, registry);
  if (issues.length) console.log("cleanup issues:", issues);
  await app.close();
  process.exit(failed > 0 ? 1 : 0);
}

void main().catch((e) => { console.error(e); process.exit(2); });
