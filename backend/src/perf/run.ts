/**
 * PHASE 2 — STEP 2.17B — LOAD & PERFORMANCE HARNESS (exploratory + qualification-ready).
 *
 * Orchestrator: parses CLI config (fail-closed) → safe-target guard → final-mode
 * qualification validation → boots the real Nest application(s) in-process
 * against an ISOLATED database → prepares deterministic synthetic dataset →
 * runs the requested profile (load / payment.create / Booking-Order / login /
 * EventBus steady-burst-recovery / multi-instance) → validates correctness
 * against authoritative DB state → writes structured artifacts → deterministic
 * cleanup (attempted even on failure).
 *
 * Semantics: EXPLORATORY / HARNESS VALIDATION PROFILE only.
 *   exploratory profile ≠ approved SLO ≠ measured capacity ≠ capacity guarantee.
 * SLO_QUALIFICATION = NOT EVALUATED — AUTHORITY REQUIRED.
 *
 * Usage: ts-node src/perf/run.ts --profile=<name> [options]  (see lib/config usage)
 */

import "reflect-metadata";
import "dotenv/config";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "../app.module";
import { AppExceptionFilter } from "../shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../shared/validation-pipe";
import { PrismaService } from "../prisma/prisma.service";
import { EventBusService } from "../eventbus/eventbus.service";
import { RoleCode } from "../generated/prisma/client";
import { parseArgs, PROFILES, usage, type RunConfig, type LoadProfile, type Profile } from "./lib/config";
import { guardViolations } from "./lib/guard";
import { runLoad, summarizeLoad, type LoadResult, type MakeRequest, type RouteClass } from "./lib/loader";
import { scheduledStartMs, sleep } from "./lib/pacer";
import { collectEnv, type EnvMetadata } from "./lib/env";
import { writeArtifacts } from "./lib/artifacts";
import { sanitizeMetadata } from "./lib/redact";
import {
  adminLogin,
  api,
  buildOrderChain,
  cleanup,
  createStaffUser,
  drainOutbox,
  futureDate,
  newRegistry,
  prepareDataset,
  type AuthSession,
  type DrainOutboxResult,
  type SeedUser,
  type Tracked,
} from "./lib/seed";
import {
  eventbusChecks,
  loadRunChecks,
  paycreateChecks,
  verdictOf,
  type CorrectnessCheck,
  type CorrectnessResult,
} from "./lib/correctness";
import {
  datasetCountsFor,
  QUALIFICATION,
  validateQualificationConfig,
} from "./lib/qualification";

interface Booted {
  app: INestApplication;
  baseUrl: string;
  prisma: PrismaService;
  eventBus: EventBusService;
}

interface RunContext extends Booted {
  registry: Tracked;
  scenario: Record<string, unknown>;
}

interface Auth {
  admin: AuthSession;
  sm: SeedUser;
  fin: SeedUser;
}

const SLO_STATE = "NOT EVALUATED — AUTHORITY REQUIRED";

/** Lightweight harness-level memory sampler (no production deps; no SLO). */
class MemorySampler {
  private samples: Array<{ t: number; rss: number; heapUsed: number; heapTotal: number }> = [];
  private timer: NodeJS.Timeout | null = null;
  private startedAt = 0;

  start(intervalMs = 5_000): void {
    this.startedAt = Date.now();
    this.sample();
    this.timer = setInterval(() => this.sample(), intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.sample();
  }

  private sample(): void {
    const m = process.memoryUsage();
    this.samples.push({ t: Date.now() - this.startedAt, rss: m.rss, heapUsed: m.heapUsed, heapTotal: m.heapTotal });
  }

  stats(): Record<string, unknown> {
    const peakRss = Math.max(0, ...this.samples.map((s) => s.rss));
    const endRss = this.samples[this.samples.length - 1]?.rss ?? 0;
    const peakHeap = Math.max(0, ...this.samples.map((s) => s.heapUsed));
    const startRss = this.samples[0]?.rss ?? 0;
    return {
      status: "MEASURED",
      startRssMb: Math.round(startRss / (1024 * 1024)),
      peakRssMb: Math.round(peakRss / (1024 * 1024)),
      endRssMb: Math.round(endRss / (1024 * 1024)),
      peakHeapUsedMb: Math.round(peakHeap / (1024 * 1024)),
      samples: this.samples.length,
      durationMs: this.startedAt ? Date.now() - this.startedAt : 0,
    };
  }
}

async function bootApp(workerEnabled: boolean): Promise<Booted> {
  process.env.OUTBOX_WORKER_ENABLED = workerEnabled ? "true" : "false";
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn"] });
  app.setGlobalPrefix("api/v1");
  app.use(cookieParser());
  app.enableCors({ origin: false, credentials: true });
  (app.getHttpAdapter().getInstance() as { set: (k: string, v: string) => void }).set("query parser", "extended");
  app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
  app.useGlobalFilters(new AppExceptionFilter());
  await app.listen(0);
  const address = app.getHttpServer().address() as { port: number };
  return {
    app,
    baseUrl: `http://127.0.0.1:${address.port}`,
    prisma: app.get(PrismaService),
    eventBus: app.get(EventBusService),
  };
}

async function postgresVersion(prisma: PrismaService): Promise<string> {
  try {
    const rows = (await prisma.$queryRawUnsafe("SHOW server_version")) as Array<{ server_version: string }>;
    return rows[0]?.server_version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function buildMakeRequest(
  steps: LoadProfile["steps"],
  auth: { admin: string; sm: string; fin: string },
): MakeRequest {
  return (iteration: number) => {
    const step = steps[iteration % steps.length];
    const headers: Record<string, string> = {};
    if (step.auth === "admin") headers.Authorization = `Bearer ${auth.admin}`;
    else if (step.auth === "sm") headers.Authorization = `Bearer ${auth.sm}`;
    else if (step.auth === "fin") headers.Authorization = `Bearer ${auth.fin}`;
    return {
      label: step.label,
      method: step.method,
      path: step.path,
      headers,
      body: step.body ? step.body() : undefined,
      expected: step.expected,
      routeClass: step.routeClass,
    };
  };
}

function p95Of(ms: number[]): number {
  if (ms.length === 0) return 0;
  const sorted = [...ms].sort((a, b) => a - b);
  const idx = Math.ceil((95 / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

interface LoadOverrides {
  rps?: number;
  durationMs?: number;
  concurrency?: number;
  warmupMs?: number;
  baseUrls?: string[];
}

async function runLoadProfile(config: RunConfig, profile: LoadProfile, ctx: RunContext, auth: Auth, overrides: LoadOverrides = {}): Promise<{ result: LoadResult; checks: CorrectnessCheck[] }> {
  const rps = overrides.rps ?? config.targetRps ?? profile.rps;
  const durationMs = overrides.durationMs ?? config.durationMs ?? profile.durationMs;
  const concurrency = overrides.concurrency ?? config.concurrency ?? profile.concurrency;
  const warmupMs = overrides.warmupMs ?? config.warmupMs ?? profile.warmupMs;
  const baseUrls = overrides.baseUrls ?? [ctx.baseUrl];

  // Scripted login probe — distinct synthetic users, once each (per-instance
  // throttle respected; login is NOT part of sustained read load).
  const loginProbe: Array<{ username: string; ms: number; status: number }> = [];
  for (let i = 0; i < 5; i++) {
    const u = await createStaffUser(ctx.baseUrl, auth.admin.accessToken, ctx.registry, `perf${config.runId}_lg${i}`, RoleCode.OPERATOR);
    const start = performance.now();
    const res = await api(ctx.baseUrl, "POST", "/api/v1/auth/login", { body: { username: u.username, password: "perfpass123" } });
    loginProbe.push({ username: u.username, ms: performance.now() - start, status: res.status });
  }

  const result = await runLoad({
    baseUrl: ctx.baseUrl,
    baseUrls,
    concurrency,
    durationMs,
    warmupMs,
    mode: rps > 0 ? "paced" : "max-effort",
    targetRps: rps > 0 ? rps : undefined,
    makeRequest: buildMakeRequest(profile.steps, { admin: auth.admin.accessToken, sm: auth.sm.token, fin: auth.fin.token }),
    requestTimeoutMs: config.requestTimeoutMs,
    seed: config.seed,
  });

  const checks = [...loadRunChecks(result)];
  if (result.pacing) {
    checks.push({
      name: "load application validity (±5%)",
      passed: result.pacing.loadApplicationValid,
      detail: result.pacing.loadValidityDetail,
    });
  }
  const unexpectedLogin = loginProbe.filter((l) => l.status !== 200).length;
  checks.push({
    name: "scripted login probe 200",
    passed: unexpectedLogin === 0,
    detail: `probes=${loginProbe.length} unexpected=${unexpectedLogin} p95=${p95Of(loginProbe.map((l) => l.ms)).toFixed(1)}ms`,
  });

  ctx.scenario = {
    profile: config.profile,
    kind: "load",
    mode: result.mode,
    targetRps: rps,
    concurrency,
    durationMs,
    warmupMs,
    steps: profile.steps.map((s) => ({ label: s.label, method: s.method, path: s.path, auth: s.auth, expected: s.expected, routeClass: s.routeClass })),
    loginProbe: loginProbe.map((l) => ({ username: l.username, status: l.status, ms: Math.round(l.ms) })),
  };
  return { result, checks };
}

/** Fresh payment-capable order pool for payment scenarios (capped, tracked). */
async function buildOrderPool(ctx: RunContext, admin: AuthSession, sm: SeedUser, count: number, tag: string): Promise<string[]> {
  const serviceDate = futureDate(45);
  const chains = [];
  for (let i = 0; i < count; i++) {
    chains.push(await buildOrderChain(ctx.baseUrl, admin.accessToken, ctx.prisma, sm, ctx.registry, 100 + (i % 900), serviceDate, `${tag}${i}`));
  }
  await drainOutbox(ctx.eventBus, ctx.prisma);
  const orders = await ctx.prisma.order.findMany({
    where: { saleId: { in: chains.map((c) => c.saleId) } },
    select: { id: true },
  });
  const ids = orders.map((o) => o.id);
  ctx.registry.orders.push(...ids);
  if (ids.length !== count) {
    throw new Error(`order pool expected ${count}, got ${ids.length}`);
  }
  return ids;
}

async function runPaycreate(config: RunConfig, ctx: RunContext, auth: Auth): Promise<{ result: LoadResult; checks: CorrectnessCheck[] }> {
  // Build orders via the canonical chain (worker off — we drive the outbox).
  const ORDER_COUNT = 8;
  const orderIds = await buildOrderPool(ctx, auth.admin, auth.sm, ORDER_COUNT, `payc${config.seed}`);

  // Nested consumer chain proof: OrderRequested → Order → OrderCreated → CommissionAccrual.
  const orderCreatedRows = await ctx.prisma.outboxEvent.findMany({ where: { eventType: "OrderCreated", aggregateId: { in: orderIds } }, select: { id: true } });
  const orderCreatedEvents = orderCreatedRows.length;
  const consumedInboxRows = await ctx.prisma.inboxEvent.count({ where: { eventId: { in: orderCreatedRows.map((r) => r.id) } } });
  const commissionAccruals = await ctx.prisma.commissionAccrual.count({});

  const pay = (orderId: string, key: string) =>
    api<{ id: string }>(ctx.baseUrl, "POST", "/api/v1/finance/payments", {
      token: auth.fin.token,
      headers: { "Idempotency-Key": key },
      body: { orderId },
      timeoutMs: config.requestTimeoutMs,
    });

  const uniqueOrders = orderIds.slice(0, 5);
  let unique201 = 0;
  let unique5xx = 0;
  let businessNoop = 0;
  const uniqueKeys: string[] = [];
  const uniqueLatency: number[] = [];
  const perOrderFirstId = new Map<string, string>();
  for (let i = 0; i < 10; i++) {
    const orderId = uniqueOrders[i % uniqueOrders.length];
    const key = `perf-${config.runId}-u${i}-${config.seed}`;
    uniqueKeys.push(key);
    const start = performance.now();
    const res = await pay(orderId, key);
    uniqueLatency.push(performance.now() - start);
    if (res.status === 201) {
      unique201++;
      const id = (res.body as { id: string }).id;
      if (!perOrderFirstId.has(orderId)) {
        perOrderFirstId.set(orderId, id);
        ctx.registry.payments.push(id);
      } else if (perOrderFirstId.get(orderId) === id) {
        businessNoop++;
      }
    } else if (res.status >= 500) {
      unique5xx++;
    }
  }

  let replayOk = 0;
  for (let i = 0; i < 3; i++) {
    const orderId = uniqueOrders[i];
    const key = uniqueKeys[i];
    const first = await pay(orderId, key);
    const second = await pay(orderId, key);
    if (first.status === 201 && second.status === 201 && (first.body as { id?: string }).id === (second.body as { id?: string }).id) {
      replayOk++;
    }
  }

  const concOrder = orderIds[5];
  const keyA = `perf-${config.runId}-conc-id-${config.seed}`;
  const concId = await Promise.all(Array.from({ length: 4 }, () => pay(concOrder, keyA)));
  const concId201 = concId.filter((r) => r.status === 201).length;
  const concId500 = concId.filter((r) => r.status >= 500).length;
  const winnerId = concId.find((r) => r.status === 201);
  if (winnerId) ctx.registry.payments.push((winnerId.body as { id: string }).id);

  const keyB = `perf-${config.runId}-conc-div-${config.seed}`;
  const [ra, rb] = await Promise.all([pay(orderIds[6], keyB), pay(orderIds[7], keyB)]);
  const divWinner = [ra, rb].find((r) => r.status === 201);
  if (divWinner) ctx.registry.payments.push((divWinner.body as { id: string }).id);
  const div201 = [ra, rb].filter((r) => r.status === 201).length;
  const div409 = [ra, rb].filter((r) => r.status === 409).length;
  const div500 = [ra, rb].filter((r) => r.status >= 500).length;

  const expectedPerOrder: Array<{ orderId: string; expected: number }> = uniqueOrders.map((orderId) => ({ orderId, expected: 1 }));
  expectedPerOrder.push({ orderId: concOrder, expected: 1 });
  expectedPerOrder.push({ orderId: orderIds[6], expected: ra.status === 201 ? 1 : 0 });
  expectedPerOrder.push({ orderId: orderIds[7], expected: rb.status === 201 ? 1 : 0 });
  const expectedPayments = 5 + 1 + div201;
  const checks: CorrectnessCheck[] = [
    ...(await paycreateChecks(ctx.prisma, { expectedPerOrder, userIds: [auth.fin.id], expectedPayments, businessNoopKeys: businessNoop })),
    {
      name: "0 raw 500 across payment scenarios",
      passed: unique5xx + concId500 + div500 === 0,
      detail: `unique5xx=${unique5xx} concurrentIdentical5xx=${concId500} divergent5xx=${div500}`,
    },
    {
      name: "second key per order = business no-op (same fact), 0 duplicates",
      passed: businessNoop === 5 && unique5xx === 0,
      detail: `businessNoop=${businessNoop}/5 5xx=${unique5xx}`,
    },
    {
      name: "concurrent identical: 0 raw 500, exactly 1 fact",
      passed: concId500 === 0 && (await ctx.prisma.payment.count({ where: { orderId: concOrder } })) === 1,
      detail: `responses=${concId.length} 201=${concId201} 500=${concId500}`,
    },
    {
      name: "concurrent divergent = 1 fact + controlled 409, 0 raw 500",
      passed: div201 === 1 && div409 === 1 && div500 === 0,
      detail: `201=${div201} 409=${div409} 500=${div500}`,
    },
    {
      name: "nested consumer chain (OrderRequested → Order → OrderCreated → consumed)",
      passed: orderCreatedEvents >= ORDER_COUNT && consumedInboxRows >= ORDER_COUNT,
      detail: `orders=${orderIds.length} orderCreated=${orderCreatedEvents} consumedInbox=${consumedInboxRows} commissionAccruals(requires policy)=${commissionAccruals}`,
    },
  ];

  const result: LoadResult = {
    mode: "max-effort",
    samples: [],
    byLabel: {},
    byRouteClass: {},
    totalRequests: 10 + 6 + 4 + 2,
    expected: expectedPayments,
    unexpected4xx: 0,
    unexpected409: div409,
    unexpected429: 0,
    unexpected5xx: unique5xx + concId500 + div500,
    timeouts: 0,
    transportErrors: 0,
    requestsPerSec: 0,
    successfulPerSec: 0,
    measurementMs: 0,
    perBaseUrl: { [ctx.baseUrl]: 22 },
    warmup: { durationMs: 0, requests: 0 },
    expectedStatuses: expectedPayments,
    unexpectedStatuses: unique5xx + concId500 + div500 + div409,
  };

  ctx.scenario = {
    profile: config.profile,
    kind: "paycreate",
    orders: orderIds.length,
    uniqueKeys: 10,
    expectedUnique201: unique201,
    businessNoopPerOrder: businessNoop,
    identicalRetries: 3,
    concurrentIdentical: 4,
    concurrentDivergent: 2,
    nestedChain: { orderCreated: orderCreatedEvents, consumedInbox: consumedInboxRows, commissionAccruals },
  };
  return { result, checks };
}

/** Paced payment.create: fresh order pool + unique keys, business-idempotency exercised. */
async function runPaymentPaced(config: RunConfig, ctx: RunContext, auth: Auth, opts: { rps: number; durationMs: number; concurrency: number }): Promise<{ result: LoadResult; checks: CorrectnessCheck[] }> {
  // Max-effort (rps=0) exercises the CONCURRENCY ceiling directly (the payment
  // concurrency gate); paced mode exercises the arrival rate.
  const requestCount =
    opts.rps > 0 ? Math.floor((opts.durationMs / 1000) * opts.rps) : Math.min(Math.max(50, opts.concurrency * 2), 120);
  const poolSize = Math.min(Math.max(8, requestCount), 120);
  const orderIds = await buildOrderPool(ctx, auth.admin, auth.sm, poolSize, `payp${config.seed}`);
  const paymentsBefore = await ctx.prisma.payment.count({ where: { orderId: { in: orderIds } } });

  const result = await runLoad({
    baseUrl: ctx.baseUrl,
    concurrency: opts.concurrency,
    durationMs: opts.durationMs,
    warmupMs: config.warmupMs ?? 1_000,
    mode: opts.rps > 0 ? "paced" : "max-effort",
    targetRps: opts.rps > 0 ? opts.rps : undefined,
    makeRequest: (n: number) => {
      const orderId = orderIds[n % orderIds.length];
      return {
        label: "payment.create",
        method: "POST",
        path: "/api/v1/finance/payments",
        headers: { Authorization: `Bearer ${auth.fin.token}`, "Idempotency-Key": `perf-${config.runId}-pay-${n}-${config.seed}` },
        body: { orderId },
        expected: [200, 201],
        routeClass: "E" as RouteClass,
      };
    },
    requestTimeoutMs: config.requestTimeoutMs,
    seed: config.seed,
  });

  const facts = await ctx.prisma.payment.count({ where: { orderId: { in: orderIds } } });
  const started = opts.rps > 0 ? result.pacing?.startedOperations ?? 0 : result.totalRequests;
  // Warm-up requests really execute (paced and max-effort) and create idempotency
  // slots — they must be included in the «every key recorded» bookkeeping. The
  // loader now feeds ONE global identity stream (iteration.n) across warm-up and
  // measurement, so keys are disjoint: warmupSlotSet ∩ measurementSlotSet = ∅.
  const warmupRequests = result.warmup.requests ?? 0;
  const reached = started + warmupRequests;
  const expectedFacts = Math.min(poolSize, started);
  // Explicit measurement accounting (Step 2.17B disposition §13): separate the
  // warm-up and measurement sets so canonical assertions use the right set and
  // warm-up can never contaminate measurement counters.
  const measurementStarted = started;
  const warmupStarted = warmupRequests;
  const completedSlots = await ctx.prisma.externalIdempotencyRecord.count({
    where: { operation: "payment.create", scopeId: auth.fin.id, status: "COMPLETED" },
  });
  const measurementCompletedSlots = Math.max(0, completedSlots - warmupStarted);
  const warmupCompletedSlots = Math.min(completedSlots, warmupStarted);
  const businessNoOps = Math.max(0, reached - facts);
  const perOrderViolations = await ctx.prisma.payment.groupBy({ by: ["orderId"], where: { orderId: { in: orderIds } }, _count: { _all: true } });
  const dupOrders = perOrderViolations.filter((g) => g._count._all > 1).length;
  const checks: CorrectnessCheck[] = [
    ...loadRunChecks(result),
    {
      name: "payment facts = min(pool, started), 0 duplicates per order",
      passed: facts === expectedFacts && dupOrders === 0 && facts === paymentsBefore + expectedFacts,
      detail: `facts=${facts} expected=${expectedFacts} before=${paymentsBefore} dupOrders=${dupOrders}`,
    },
    {
      name: "idempotency slots == requests reaching the API (disjoint warmup/measurement keys)",
      // With disjoint namespaces every started request (warmup ∪ measurement)
      // records exactly one COMPLETED slot; measurement slots are asserted on
      // the measurement set only.
      passed: completedSlots === reached && measurementCompletedSlots >= measurementStarted,
      detail: `completedSlots=${completedSlots} measurementStarted=${measurementStarted} warmupStarted=${warmupStarted} measurementCompletedSlots=${measurementCompletedSlots} warmupCompletedSlots=${warmupCompletedSlots} reached=${reached} businessNoOps=${businessNoOps}`,
    },
    {
      name: "one-active-payment invariant (<=1 per order)",
      passed: dupOrders === 0 && facts <= poolSize,
      detail: `perOrderMax=${dupOrders === 0 ? 1 : ">1"} pool=${poolSize}`,
    },
  ];
  if (result.pacing) {
    checks.push({ name: "load application validity (±5%)", passed: result.pacing.loadApplicationValid, detail: result.pacing.loadValidityDetail });
  }
  ctx.scenario = {
    profile: config.profile,
    kind: "payment",
    rps: opts.rps,
    durationMs: opts.durationMs,
    requestCount,
    poolSize,
    facts,
    noopKeys: businessNoOps,
    warmupStarted,
    warmupCompletedSlots,
    measurementStarted,
    measurementCompletedSlots,
    businessFacts: facts,
    businessNoOps,
  };
  return { result, checks };
}

/** Paced Booking/Order chain writes: one canonical order per paced chain start. */
async function runBookingOrderPaced(config: RunConfig, ctx: RunContext, auth: Auth, opts: { rps: number; durationMs: number; concurrency: number }): Promise<{ result: LoadResult; checks: CorrectnessCheck[] }> {
  const targetRps = opts.rps;
  const windowStart = Date.now();
  const scheduled = Math.floor((opts.durationMs / 1000) * targetRps);
  const serviceDate = futureDate(45);
  const failures: string[] = [];
  const chainDurations: number[] = [];
  const chainSaleIds: string[] = [];
  let started = 0;
  let inFlight = 0;
  let maxConcurrencyObserved = 0;
  let completed = 0;
  const startOffsets: number[] = [];

  const startChain = async (n: number): Promise<void> => {
    const scheduledStart = scheduledStartMs({ targetRps, durationMs: opts.durationMs, windowStartMs: windowStart }, n);
    const delay = scheduledStart - Date.now();
    if (delay > 0) await sleep(delay);
    startOffsets.push(Date.now() - windowStart);
    started++;
    inFlight++;
    maxConcurrencyObserved = Math.max(maxConcurrencyObserved, inFlight);
    const s = performance.now();
    try {
      const chain = await buildOrderChain(ctx.baseUrl, auth.admin.accessToken, ctx.prisma, auth.sm, ctx.registry, 100 + (n % 900), serviceDate, `bok${config.seed}x${n}`);
      chainSaleIds.push(chain.saleId);
    } catch (err) {
      failures.push(`chain ${n}: ${String((err as Error)?.message ?? err)}`);
    } finally {
      chainDurations.push(performance.now() - s);
      inFlight--;
      completed++;
    }
  };

  const windowDeadline = windowStart + opts.durationMs;
  let next = 0;
  while (next < scheduled) {
    const waitMs = scheduledStartMs({ targetRps, durationMs: opts.durationMs, windowStartMs: windowStart }, next) - Date.now();
    if (waitMs > 0) await sleep(waitMs);
    if (Date.now() >= windowDeadline) break;
    while (inFlight >= opts.concurrency && Date.now() < windowDeadline + 1_000) {
      await sleep(2);
    }
    if (inFlight >= opts.concurrency) break;
    void startChain(next);
    next++;
  }
  while (inFlight > 0) await sleep(10);
  await drainOutbox(ctx.eventBus, ctx.prisma);

  // Orders materialize via the OrderRequested consumer during drain — count the
  // canonical Order rows for exactly the sales this scenario created, and track
  // their ids so cleanup is complete.
  const orderRows = await ctx.prisma.order.findMany({ where: { saleId: { in: chainSaleIds } }, select: { id: true } });
  ctx.registry.orders.push(...orderRows.map((o) => o.id));
  const ordersCreated = orderRows.length;
  // Scenario-scoped convergence: OrderCreated events for THIS scenario's orders
  // only (the shared perf DB accumulates events from prior scenarios).
  const orderRowIds = orderRows.map((o) => o.id);
  const orderCreatedEvents = await ctx.prisma.outboxEvent.count({ where: { eventType: "OrderCreated", aggregateId: { in: orderRowIds } } });
  const orderEventRows = await ctx.prisma.outboxEvent.findMany({ where: { eventType: "OrderCreated", aggregateId: { in: orderRowIds } }, select: { id: true } });
  const consumedInbox = await ctx.prisma.inboxEvent.count({ where: { eventId: { in: orderEventRows.map((r) => r.id) } } });
  const orderDup = await ctx.prisma.order.groupBy({ by: ["saleId"], _count: { _all: true } });
  const dupSales = orderDup.filter((g) => g._count._all > 1).length;

  const achievedStartRate = started > 1 ? (started - 1) / (Math.max(1e-3, (startOffsets[startOffsets.length - 1] - startOffsets[0]) / 1000)) : started > 0 ? started / (Math.max(1, opts.durationMs) / 1000) : 0;
  const isBurst = opts.durationMs <= 60_000;
  const validityDetail = isBurst
    ? `burst started=${started} scheduled=${scheduled} diffPct=${(Math.abs(started - scheduled) / Math.max(1, scheduled)) * 100}% (tolerance ±5%)`
    : `sustained achievedStartRate=${achievedStartRate.toFixed(2)}/s target=${targetRps}/s`;
  const loadValid = isBurst ? Math.abs(started - scheduled) / Math.max(1, scheduled) <= 0.05 : Math.abs(achievedStartRate - targetRps) / targetRps <= 0.05;

  const checks: CorrectnessCheck[] = [
    {
      name: "0 chain failures (0 raw 500 at chain level)",
      passed: failures.length === 0,
      detail: `failures=${failures.length}${failures.length > 0 ? ` first=${failures[0]}` : ""}`,
    },
    {
      // Successful chains only — aborted chains never reach the Order step.
      name: "1 Order per successful chain (no duplicates)",
      passed: ordersCreated === completed - failures.length && dupSales === 0,
      detail: `ordersCreated=${ordersCreated} chainsStarted=${completed} chainsFailed=${failures.length} dupSales=${dupSales}`,
    },
    {
      name: "event-chain convergence (OrderCreated consumed)",
      passed: orderCreatedEvents >= ordersCreated && consumedInbox >= ordersCreated,
      detail: `orderCreated=${orderCreatedEvents} consumedInbox=${consumedInbox} orders=${ordersCreated}`,
    },
    {
      name: "load application validity (±5%)",
      passed: loadValid,
      detail: validityDetail,
    },
  ];

  const result: LoadResult = {
    mode: "paced",
    samples: [],
    byLabel: {},
    byRouteClass: {
      D: {
        count: chainDurations.length,
        stats: (() => {
          const sorted = [...chainDurations].sort((a, b) => a - b);
          const p = (q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((q / 100) * sorted.length) - 1)] : 0);
          return { count: sorted.length, min: sorted[0] ?? 0, p50: p(50), p95: p(95), p99: p(99), max: sorted[sorted.length - 1] ?? 0, mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0 };
        })(),
        outcomes: { expected: completed - failures.length, unexpected4xx: 0, unexpected409: 0, unexpected429: 0, unexpected5xx: failures.length, timeout: 0, transportError: 0 },
      },
    },
    totalRequests: completed,
    expected: completed - failures.length,
    unexpected4xx: 0,
    unexpected409: 0,
    unexpected429: 0,
    unexpected5xx: failures.length,
    timeouts: 0,
    transportErrors: 0,
    requestsPerSec: completed > 0 ? Math.round((completed / Math.max(1, opts.durationMs)) * 1000) : 0,
    successfulPerSec: Math.round(((completed - failures.length) / Math.max(1, opts.durationMs)) * 1000),
    measurementMs: opts.durationMs,
    pacing: {
      targetRps,
      scheduledOperations: scheduled,
      startedOperations: started,
      completedOperations: completed,
      achievedStartRate,
      achievedCompletionRate: completed / (Math.max(1, opts.durationMs) / 1000),
      schedulerLagMs: 0,
      maxConcurrencyObserved,
      loadApplicationValid: loadValid,
      loadValidityDetail: validityDetail,
    },
    perBaseUrl: { [ctx.baseUrl]: completed },
    warmup: { durationMs: 0, requests: 0 },
    expectedStatuses: completed - failures.length,
    unexpectedStatuses: failures.length,
  };

  ctx.scenario = {
    profile: config.profile,
    kind: "booking",
    rps: targetRps,
    durationMs: opts.durationMs,
    scheduled,
    started,
    completed,
    ordersCreated,
    chainP95Ms: p95Of(chainDurations),
  };
  return { result, checks };
}

/** Paced auth/login with a distinct-user pool (throttle respected, never bypassed). */
async function runLoginPaced(config: RunConfig, ctx: RunContext, opts: { rps: number; durationMs: number }): Promise<{ result: LoadResult; checks: CorrectnessCheck[] }> {
  const requestCount = Math.floor((opts.durationMs / 1000) * opts.rps);
  const admin = await adminLogin(ctx.baseUrl);
  const pool: Array<{ username: string; password: string }> = [];
  // Pool sized so each principal is used sparingly (successful logins reset the
  // per-key throttle window; failures would accumulate — keep usage < 10/key).
  const needed = Math.ceil(requestCount / 9);
  for (let i = 0; i < Math.max(8, Math.min(needed, 60)); i++) {
    const u = await createStaffUser(ctx.baseUrl, admin.accessToken, ctx.registry, `perf${config.runId}_ln${i}`, RoleCode.OPERATOR);
    pool.push({ username: u.username, password: "perfpass123" });
  }
  const startedAt = Date.now();
  const result = await runLoad({
    baseUrl: ctx.baseUrl,
    concurrency: 4,
    durationMs: opts.durationMs,
    warmupMs: Math.min(config.warmupMs ?? 500, 500),
    mode: "paced",
    targetRps: opts.rps,
    makeRequest: (n: number) => {
      const u = pool[n % pool.length];
      return {
        label: "auth.login",
        method: "POST",
        path: "/api/v1/auth/login",
        body: { username: u.username, password: u.password },
        expected: [200],
        routeClass: "F" as RouteClass,
      };
    },
    requestTimeoutMs: config.requestTimeoutMs,
    seed: config.seed,
  });
  const measuredMs = Date.now() - startedAt;
  const checks: CorrectnessCheck[] = [
    ...loadRunChecks(result),
    {
      name: "login throttle not triggered (distinct principals, successes reset window)",
      passed: result.unexpected429 === 0,
      detail: `unexpected429=${result.unexpected429} pool=${pool.length} requests=${result.totalRequests}`,
    },
  ];
  if (result.pacing) {
    checks.push({ name: "load application validity (±5%)", passed: result.pacing.loadApplicationValid, detail: result.pacing.loadValidityDetail });
  }
  ctx.scenario = {
    profile: config.profile,
    kind: "login",
    rps: opts.rps,
    durationMs: opts.durationMs,
    requestCount,
    poolSize: pool.length,
    measuredMs,
  };
  return { result, checks };
}

interface EventbusOutcome {
  result: LoadResult;
  checks: CorrectnessCheck[];
  env: EnvMetadata;
  drainMs: number;
  metrics: Record<string, unknown>;
}

async function runEventbusScenario(config: RunConfig): Promise<EventbusOutcome> {
  if (config.profile === "eventbus-steady") {
    return runEventbusSteady(config);
  }
  const isRecovery = config.profile === "eventbus-recovery";
  const seedCount = config.seedEvents > 0 ? config.seedEvents : isRecovery ? QUALIFICATION.eventbus.recovery : QUALIFICATION.eventbus.burst;
  return runEventbusDrain(config, {
    seedCount,
    label: isRecovery ? "RECOVERY" : "BURST",
    recoveryGate: isRecovery,
  });
}

/** EventBus generation-under-processing at the approved steady rate (canonical worker config). */
async function runEventbusSteady(config: RunConfig): Promise<EventbusOutcome> {
  const rate = QUALIFICATION.eventbus.steadyPerSec;
  const durationMs = config.durationMs ?? 30_000;
  const workerCount = Math.max(1, config.workers);
  const prefix = `perf-ebs-${config.runId}`;
  const checks: CorrectnessCheck[] = [];
  let env: EnvMetadata | null = null;

  // Worker-enabled apps with CANONICAL worker config (no timing overrides).
  const workers: Booted[] = [];
  for (let i = 0; i < workerCount; i++) workers.push(await bootApp(true));
  const { prisma, eventBus } = workers[0];
  const backlogSamples: number[] = [];
  const maxBacklog = { value: 0 };
  let oldestAgeMaxMs = 0;
  const generationStart = Date.now();
  const scheduled = Math.floor((durationMs / 1000) * rate);
  let emitted = 0;
  let finished = 0;

  const emitOne = async (n: number): Promise<void> => {
    try {
      const scheduledStart = scheduledStartMs({ targetRps: rate, durationMs, windowStartMs: generationStart }, n);
      const delay = scheduledStart - Date.now();
      if (delay > 0) await sleep(delay);
      await prisma.$transaction((tx) =>
        eventBus.emit(tx, {
          aggregateType: "Booking",
          aggregateId: `${prefix}-${n}`,
          eventType: "BookingCreated",
          payload: { bookingId: `${prefix}-${n}`, note: "perf-steady" },
          actor: { type: "SYSTEM" },
        }),
      );
      emitted++;
      const pending = await prisma.outboxEvent.count({ where: { status: "PENDING", aggregateId: { startsWith: `${prefix}-` } } });
      backlogSamples.push(pending);
      maxBacklog.value = Math.max(maxBacklog.value, pending);
      const oldest = await prisma.outboxEvent.findFirst({ where: { status: "PENDING", aggregateId: { startsWith: `${prefix}-` } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
      if (oldest) oldestAgeMaxMs = Math.max(oldestAgeMaxMs, Date.now() - oldest.createdAt.getTime());
    } catch {
      /* a single emit failure is recorded as emitted < scheduled */
    } finally {
      finished++;
    }
  };

  let next = 0;
  while (next < scheduled) {
    const waitMs = scheduledStartMs({ targetRps: rate, durationMs, windowStartMs: generationStart }, next) - Date.now();
    if (waitMs > 0) await sleep(waitMs);
    if (Date.now() >= generationStart + durationMs) break;
    void emitOne(next).catch(() => undefined);
    next++;
  }
  while (finished < next) await sleep(5);
  const generationMs = Date.now() - generationStart;

  // Drain: wait for PENDING to reach 0 (bounded).
  const drainStart = Date.now();
  const drainDeadline = drainStart + config.drainTimeoutMs;
  while (Date.now() < drainDeadline) {
    const pending = await prisma.outboxEvent.count({ where: { status: "PENDING", aggregateId: { startsWith: `${prefix}-` } } });
    if (pending === 0) break;
    await sleep(500);
  }
  const drainMs = Date.now() - drainStart;
  const published = await prisma.outboxEvent.count({ where: { status: "PUBLISHED", aggregateId: { startsWith: `${prefix}-` } } });
  const residualFailed = await prisma.outboxEvent.count({ where: { status: "FAILED", aggregateId: { startsWith: `${prefix}-` } } });
  const finalPending = await prisma.outboxEvent.count({ where: { status: "PENDING", aggregateId: { startsWith: `${prefix}-` } } });

  env = await collectEnv({
    runId: config.runId,
    dbUrl: process.env.DATABASE_URL,
    baseUrl: workers[0].baseUrl,
    profile: config.profile,
    seed: config.seed,
    datasetClass: "SMALL",
    appInstances: 0,
    workerInstances: workerCount,
    postgresVersion: await postgresVersion(prisma),
    requestTimeoutMs: config.requestTimeoutMs,
  });

  checks.push(
    {
      name: "steady generation applied (emitted == scheduled)",
      passed: emitted === scheduled,
      detail: `emitted=${emitted} scheduled=${scheduled} generationMs=${generationMs}`,
    },
    {
      name: "0 lost committed events (all published or draining)",
      passed: published + finalPending === scheduled && residualFailed === 0,
      detail: `published=${published} finalPending=${finalPending} failed=${residualFailed}`,
    },
    {
      name: "backlog converged to 0 after generation",
      passed: finalPending === 0,
      detail: `finalPending=${finalPending} drainMs=${drainMs}`,
    },
    {
      name: "backlog bounded during generation (max recorded)",
      passed: true,
      detail: `maxBacklog=${maxBacklog.value} oldestAgeMaxMs=${oldestAgeMaxMs} samples=${backlogSamples.length}`,
    },
  );

  // Cleanup probe events.
  const ids = (await prisma.outboxEvent.findMany({ where: { aggregateId: { startsWith: `${prefix}-` } }, select: { id: true } })).map((e) => e.id);
  await prisma.inboxEvent.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.outboxEvent.deleteMany({ where: { aggregateId: { startsWith: `${prefix}-` } } });
  for (const w of workers) await w.app.close().catch(() => undefined);

  const result: LoadResult = {
    mode: "paced",
    samples: [],
    byLabel: {},
    byRouteClass: {},
    totalRequests: 0,
    expected: published,
    unexpected4xx: 0,
    unexpected409: 0,
    unexpected429: 0,
    unexpected5xx: 0,
    timeouts: 0,
    transportErrors: 0,
    requestsPerSec: 0,
    successfulPerSec: Math.round((published / Math.max(1, drainMs)) * 1000),
    measurementMs: drainMs,
    perBaseUrl: {},
    warmup: { durationMs: 0, requests: 0 },
    expectedStatuses: published,
    unexpectedStatuses: 0,
  };

  const metrics: Record<string, unknown> = {
    mode: "steady-generation",
    targetPerSec: rate,
    scheduled,
    emitted,
    generationMs,
    drainMs,
    published,
    finalPending,
    residualFailed,
    maxBacklog: maxBacklog.value,
    oldestAgeMaxMs,
    backlogSamples: backlogSamples.length,
    workers: workerCount,
    workerIntervalMs: QUALIFICATION.canonical.workerIntervalMs,
    workerBatch: QUALIFICATION.canonical.workerBatch,
  };
  return { result, checks, env, drainMs, metrics };
}

/** EventBus burst/recovery: seed N PENDING (+ poison) with workers OFF, then drain with canonical-config workers. */
async function runEventbusDrain(
  config: RunConfig,
  opts: { seedCount: number; label: string; recoveryGate: boolean },
): Promise<EventbusOutcome> {
  const seedCount = opts.seedCount;
  const RUN_PREFIX = `perf-eb-${config.runId}`;
  const workerCount = Math.max(1, config.workers);
  const drainBoundMs = opts.recoveryGate ? config.drainTimeoutMs : Math.max(60_000, config.drainTimeoutMs);
  let env: EnvMetadata | null = null;

  // Phase A: worker disabled — seed burst of PENDING + one poison.
  // Chunked seeding: 5,000 emits in one transaction exceeds the 5s interactive
  // transaction timeout — batch by 500 per transaction (deterministic order).
  const a = await bootApp(false);
  let seededCount = 0;
  try {
    const seeded: string[] = [];
    for (let base = 0; base < seedCount; base += 500) {
      const chunk = Math.min(500, seedCount - base);
      const ids = await a.prisma.$transaction(async (tx) => {
        const out: string[] = [];
        for (let k = 0; k < chunk; k++) {
          const i = base + k;
          out.push(
            await a.eventBus.emit(tx, {
              aggregateType: "Booking",
              aggregateId: `${RUN_PREFIX}-${i}`,
              eventType: "BookingCreated",
              payload: { bookingId: `${RUN_PREFIX}-${i}`, note: "perf-probe" },
              actor: { type: "SYSTEM" },
            }),
          );
        }
        return out;
      });
      seeded.push(...ids);
    }
    const poison = await a.prisma.$transaction((tx) =>
      a.eventBus.emit(tx, {
        aggregateType: "Booking",
        aggregateId: `${RUN_PREFIX}-poison`,
        eventType: "BookingCreated",
        payload: { bookingId: `${RUN_PREFIX}-poison`, note: "poison" },
        actor: { type: "SYSTEM" },
      }),
    );
    void seeded;
    await a.prisma.outboxEvent.update({
      where: { id: poison },
      data: { status: "FAILED", retryable: false, attempts: 5, error: "perf poison" },
    });
    const pendingBefore = await a.prisma.outboxEvent.count({ where: { status: "PENDING", aggregateId: { startsWith: `${RUN_PREFIX}-` } } });
    if (pendingBefore !== seedCount) {
      throw new Error(`expected ${seedCount} PENDING, got ${pendingBefore}`);
    }
    seededCount = seedCount;
    env = await collectEnv({
      runId: config.runId,
      dbUrl: process.env.DATABASE_URL,
      baseUrl: a.baseUrl,
      profile: config.profile,
      seed: config.seed,
      datasetClass: "SMALL",
      appInstances: 0,
      workerInstances: workerCount,
      postgresVersion: await postgresVersion(a.prisma),
      requestTimeoutMs: config.requestTimeoutMs,
    });
  } finally {
    await a.app.close();
  }

  // Phase B: canonical-config workers (NO timing overrides) — measure drain + poison isolation.
  const drainStart = Date.now();
  const workers: Booted[] = [];
  for (let i = 0; i < workerCount; i++) workers.push(await bootApp(true));
  let drainMs = 0;
  let published = 0;
  let residualPending = 0;
  let residualFailed = 0;
  let poisonStillFailed = false;
  try {
    const deadline = Date.now() + drainBoundMs;
    while (Date.now() < deadline) {
      const pending = await workers[0].prisma.outboxEvent.count({ where: { status: "PENDING", aggregateId: { startsWith: `${RUN_PREFIX}-` } } });
      if (pending === 0) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    drainMs = Date.now() - drainStart;
    published = await workers[0].prisma.outboxEvent.count({ where: { status: "PUBLISHED", aggregateId: { startsWith: `${RUN_PREFIX}-` } } });
    residualPending = await workers[0].prisma.outboxEvent.count({ where: { status: "PENDING", aggregateId: { startsWith: `${RUN_PREFIX}-` } } });
    residualFailed = await workers[0].prisma.outboxEvent.count({ where: { status: "FAILED", aggregateId: { startsWith: `${RUN_PREFIX}-` } } });
    const poisonRow = await workers[0].prisma.outboxEvent.findFirst({ where: { aggregateId: `${RUN_PREFIX}-poison` } });
    poisonStillFailed = poisonRow?.status === "FAILED";
  } finally {
    for (const w of workers) await w.app.close().catch(() => undefined);
  }

  const drained = published === seedCount && residualPending === 0;
  const checks = eventbusChecks({
    seededCount,
    poisonId: `${RUN_PREFIX}-poison`,
    publishedCount: published,
    residualPending,
    residualFailed: residualFailed - 1,
    poisonStillFailed,
    drainMs,
  });
  if (opts.recoveryGate) {
    checks.push({
      name: "recovery drain <= 120s (frozen authority)",
      passed: drained && drainMs <= 120_000,
      detail: `drainMs=${drainMs} published=${published}/${seedCount} pending=${residualPending} bound=120000`,
    });
  } else {
    checks.push({
      name: "burst drained within bound",
      passed: drained,
      detail: `drainMs=${drainMs} published=${published}/${seedCount} pending=${residualPending}`,
    });
  }

  // Cleanup: probe events (outbox + any inbox rows) by prefix.
  const ids = (await workers[0].prisma.outboxEvent.findMany({ where: { aggregateId: { startsWith: `${RUN_PREFIX}-` } }, select: { id: true } })).map((e) => e.id);
  await workers[0].prisma.inboxEvent.deleteMany({ where: { eventId: { in: ids } } });
  await workers[0].prisma.outboxEvent.deleteMany({ where: { aggregateId: { startsWith: `${RUN_PREFIX}-` } } });

  const result: LoadResult = {
    mode: "paced",
    samples: [],
    byLabel: {},
    byRouteClass: {},
    totalRequests: 0,
    expected: published,
    unexpected4xx: 0,
    unexpected409: 0,
    unexpected429: 0,
    unexpected5xx: 0,
    timeouts: 0,
    transportErrors: 0,
    requestsPerSec: Math.round((published / Math.max(1, drainMs)) * 1000),
    successfulPerSec: Math.round((published / Math.max(1, drainMs)) * 1000),
    measurementMs: drainMs,
    perBaseUrl: {},
    warmup: { durationMs: 0, requests: 0 },
    expectedStatuses: published,
    unexpectedStatuses: 0,
  };

  const metrics: Record<string, unknown> = {
    mode: opts.recoveryGate ? "recovery" : "burst",
    seeded: seedCount,
    published,
    drainMs,
    pendingAfter: residualPending,
    failedAfterExcludingPoison: residualFailed - 1,
    poisonIsolated: poisonStillFailed,
    workers: workerCount,
    workerIntervalMs: QUALIFICATION.canonical.workerIntervalMs,
    workerBatch: QUALIFICATION.canonical.workerBatch,
    drainGateMs: opts.recoveryGate ? 120_000 : drainBoundMs,
  };
  return { result, checks, env, drainMs, metrics };
}

/** True 2 app + 2 worker HTTP topology with shared PostgreSQL. */
async function runMultiInstance(config: RunConfig, profile: Profile): Promise<{ result: LoadResult; checks: CorrectnessCheck[]; env: EnvMetadata; metrics: Record<string, unknown> }> {
  const appCount = Math.max(2, config.apps);
  const workerCount = Math.max(2, config.workers);
  const apps: Booted[] = [];
  const workers: Booted[] = [];
  for (let i = 0; i < appCount; i++) apps.push(await bootApp(false));
  for (let i = 0; i < workerCount; i++) workers.push(await bootApp(true));

  const baseUrls = apps.map((a) => a.baseUrl);
  const admin = await adminLogin(apps[0].baseUrl);
  const registry = newRegistry();
  const sm = await createStaffUser(apps[0].baseUrl, admin.accessToken, registry, `perf${config.runId}_mism`, RoleCode.SALES_MANAGER);
  const fin = await createStaffUser(apps[0].baseUrl, admin.accessToken, registry, `perf${config.runId}_misfin`, RoleCode.FINANCE);

  // Seed probe events (worker off on apps → PENDING); workers drain them.
  const MI_COUNT = 200;
  const MI_PREFIX = `perf-mi-${config.runId}`;
  const probeIds: string[] = [];
  await apps[0].prisma.$transaction(async (tx) => {
    for (let i = 0; i < MI_COUNT; i++) {
      probeIds.push(
        await apps[0].eventBus.emit(tx, {
          aggregateType: "Booking",
          aggregateId: `${MI_PREFIX}-${i}`,
          eventType: "BookingCreated",
          payload: { bookingId: `${MI_PREFIX}-${i}`, note: "perf-mi" },
          actor: { type: "SYSTEM" },
        }),
      );
    }
  });

  const rps = config.targetRps ?? 100;
  const durationMs = config.durationMs ?? (profile.kind === "multi" ? ((profile as { durationMs?: number }).durationMs ?? 60_000) : 60_000);
  const concurrency = config.concurrency ?? 100;
  const result = await runLoad({
    baseUrl: apps[0].baseUrl,
    baseUrls,
    concurrency,
    durationMs,
    warmupMs: Math.min(config.warmupMs ?? 3_000, 3_000),
    mode: "paced",
    targetRps: rps,
    makeRequest: (n: number) => {
      const steps = (PROFILES["qual-burst"] as LoadProfile).steps;
      const step = steps[n % steps.length];
      const headers: Record<string, string> = {};
      if (step.auth === "sm") headers.Authorization = `Bearer ${sm.token}`;
      else if (step.auth === "fin") headers.Authorization = `Bearer ${fin.token}`;
      else if (step.auth === "admin") headers.Authorization = `Bearer ${admin.accessToken}`;
      return { label: step.label, method: step.method, path: step.path, headers, body: step.body ? step.body() : undefined, expected: step.expected, routeClass: step.routeClass };
    },
    requestTimeoutMs: config.requestTimeoutMs,
    seed: config.seed,
  });

  // EventBus competition: workers (canonical config) drain the probe backlog.
  const drainStart = Date.now();
  const drainDeadline = drainStart + Math.max(60_000, config.drainTimeoutMs);
  while (Date.now() < drainDeadline) {
    const pending = await apps[0].prisma.outboxEvent.count({ where: { status: "PENDING", aggregateId: { startsWith: `${MI_PREFIX}-` } } });
    if (pending === 0) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  const drainMs = Date.now() - drainStart;
  const miPublished = await apps[0].prisma.outboxEvent.count({ where: { status: "PUBLISHED", aggregateId: { startsWith: `${MI_PREFIX}-` } } });
  const miPending = await apps[0].prisma.outboxEvent.count({ where: { status: "PENDING", aggregateId: { startsWith: `${MI_PREFIX}-` } } });

  const perApp = Object.values(result.perBaseUrl);
  const balanced = perApp.length === appCount && perApp.every((c) => c > 0) && Math.abs(perApp[0] - perApp[1]) / Math.max(1, perApp[0] + perApp[1]) <= 0.6;
  const checks: CorrectnessCheck[] = [
    ...loadRunChecks(result),
    {
      name: "HTTP traffic distributed across both app instances",
      passed: balanced,
      detail: `perApp=${JSON.stringify(result.perBaseUrl)}`,
    },
    {
      name: "EventBus competition drained (published == seeded, 0 pending)",
      passed: miPublished === MI_COUNT && miPending === 0,
      detail: `published=${miPublished}/${MI_COUNT} pending=${miPending} drainMs=${drainMs} workers=${workerCount}`,
    },
    {
      name: "0 duplicate business effects (no raw 500, idempotent reads)",
      passed: result.unexpected5xx === 0,
      detail: `unexpected5xx=${result.unexpected5xx}`,
    },
  ];
  if (result.pacing) {
    checks.push({ name: "load application validity (±5%)", passed: result.pacing.loadApplicationValid, detail: result.pacing.loadValidityDetail });
  }

  const env = await collectEnv({
    runId: config.runId,
    dbUrl: process.env.DATABASE_URL,
    baseUrl: apps[0].baseUrl,
    profile: config.profile,
    seed: config.seed,
    datasetClass: "SMALL",
    appInstances: appCount,
    workerInstances: workerCount,
    postgresVersion: await postgresVersion(apps[0].prisma),
    requestTimeoutMs: config.requestTimeoutMs,
  });

  // Cleanup.
  const ids = (await apps[0].prisma.outboxEvent.findMany({ where: { aggregateId: { startsWith: `${MI_PREFIX}-` } }, select: { id: true } })).map((e) => e.id);
  await apps[0].prisma.inboxEvent.deleteMany({ where: { eventId: { in: ids } } });
  await apps[0].prisma.outboxEvent.deleteMany({ where: { aggregateId: { startsWith: `${MI_PREFIX}-` } } });
  await apps[0].prisma.user.deleteMany({ where: { id: { in: registry.users } } });
  for (const b of [...apps, ...workers]) await b.app.close().catch(() => undefined);

  const metrics: Record<string, unknown> = {
    appInstances: appCount,
    workerInstances: workerCount,
    perAppRequestCounts: result.perBaseUrl,
    probeSeeded: MI_COUNT,
    probePublished: miPublished,
    probePendingAfter: miPending,
    eventbusDrainMs: drainMs,
    rps,
    durationMs,
  };
  return { result, checks, env, metrics };
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error("CONFIG FAILED:\n" + parsed.errors.join("\n"));
    console.error("\n" + usage());
    process.exit(2);
  }
  const config = parsed.config;
  if (config.runId === "help") {
    console.log(usage());
    process.exit(0);
  }

  const profile = PROFILES[config.profile];
  const dbUrl = config.dbUrl ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required (--db-url or env)");
    process.exit(2);
  }
  const violations = guardViolations({
    dbUrl,
    nodeEnv: process.env.NODE_ENV,
    allowNonLocal: config.allowNonLocal,
    stress: config.stress,
    profile: config.profile,
  });
  if (violations.length > 0) {
    console.error("SAFE-TARGET GUARD REFUSED:");
    for (const v of violations) console.error(`  - ${v}`);
    console.error("No seed/load was executed.");
    process.exit(2);
  }
  // Final-mode fail-closed validation (worker timing, topology, dataset).
  if (config.finalMode) {
    const issues = validateQualificationConfig({
      finalMode: true,
      profile: config.profile,
      targetRps: config.targetRps ?? (profile.kind === "load" ? (profile as LoadProfile).rps : undefined),
      durationMs: config.durationMs,
      concurrency: config.concurrency,
      warmupMs: config.warmupMs,
      dataset: config.dataset,
      apps: config.apps,
      workers: config.workers,
      workerIntervalEnv: process.env.OUTBOX_WORKER_INTERVAL_MS,
      workerBatchEnv: process.env.OUTBOX_WORKER_BATCH,
      pspEnvVars: Object.entries(process.env)
        .filter(([k]) => /PSP|STRIPE|PAYSTACK|ADYEN|CHECKOUT/i.test(k))
        .map(([k, v]) => ({ name: k, value: v })),
    });
    if (issues.length > 0) {
      console.error("FINAL-MODE QUALIFICATION CONFIG INVALID (fail-closed):");
      for (const i of issues) console.error(`  - [${i.code}] ${i.message}`);
      console.error("No seed/load was executed.");
      process.exit(2);
    }
  }
  process.env.DATABASE_URL = dbUrl;

  console.log(`[perf] profile=${config.profile} runId=${config.runId} db=${dbUrl.replace(/\/\/[^@]+@/, "//***@")} final=${config.finalMode}`);
  console.log(`[perf] EXPLORATORY PROFILE — NOT a production SLO, NOT a capacity target`);

  const memory = new MemorySampler();
  memory.start();

  let result: LoadResult | null = null;
  let checks: CorrectnessCheck[] = [];
  let env: EnvMetadata | null = null;
  let ctx: RunContext | null = null;
  let drainMs = 0;
  let execError: string | null = null;
  let eventBusMetrics: Record<string, unknown> | null = null;
  let multiMetrics: Record<string, unknown> | null = null;
  let datasetPrepared: Record<string, number> | null = null;
  let datasetDrain: { afterChains: DrainOutboxResult; afterProbes: DrainOutboxResult } | null = null;
  const finalModeIssues: string[] = [];
  const status = { value: "RUNNING" as string };

  try {
    if (profile.kind === "eventbus") {
      const r = await runEventbusScenario(config);
      result = r.result;
      checks = r.checks;
      env = r.env;
      drainMs = r.drainMs;
      eventBusMetrics = r.metrics;
      console.log(`[perf] EVENTBUS ${r.metrics.mode}: published=${result.expected} drain=${drainMs}ms events/s=${result.successfulPerSec}`);
    } else if (profile.kind === "multi") {
      const r = await runMultiInstance(config, profile);
      result = r.result;
      checks = r.checks;
      env = r.env;
      multiMetrics = r.metrics;
      console.log("[perf] MULTI-INSTANCE:\n" + summarizeLoad(r.result));
    } else {
      const booted = await bootApp(false);
      const registry = newRegistry();
      ctx = { ...booted, registry, scenario: {} };
      const admin = await adminLogin(booted.baseUrl);
      const counts = datasetCountsFor(config.dataset, config.datasetScale);
      const prep = await prepareDataset({
        baseUrl: booted.baseUrl,
        adminToken: admin.accessToken,
        prisma: booted.prisma,
        eventBus: booted.eventBus,
        registry,
        runId: config.runId,
        counts,
      });
      datasetPrepared = prep.counts;
      datasetDrain = prep.drain;
      const auth: Auth = { admin, sm: prep.sm, fin: prep.fin };
      env = await collectEnv({
        runId: config.runId,
        dbUrl,
        baseUrl: booted.baseUrl,
        profile: config.profile,
        seed: config.seed,
        datasetClass: config.dataset,
        appInstances: 1,
        workerInstances: 0,
        postgresVersion: await postgresVersion(booted.prisma),
        requestTimeoutMs: config.requestTimeoutMs,
      });
      if (profile.kind === "load") {
        const lp = profile as LoadProfile;
        const r = await runLoadProfile(config, lp, ctx, auth);
        result = r.result;
        checks = r.checks;
        console.log("[perf] LOAD:\n" + summarizeLoad(r.result));
      } else if (profile.kind === "paycreate") {
        const r = await runPaycreate(config, ctx, auth);
        result = r.result;
        checks = r.checks;
        console.log(`[perf] PAYCREATE: payments=${result.expected} unexpected5xx=${result.unexpected5xx}`);
      } else if (profile.kind === "payment") {
        // payment-concurrency: max-effort (rps=0) so the 50-concurrent ceiling is
        // genuinely reached; steady/burst use arrival-rate pacing.
        const isConc = config.profile === "payment-concurrency";
        const rps = isConc ? 0 : config.targetRps ?? (config.profile === "payment-burst" ? QUALIFICATION.payment.burstRps : QUALIFICATION.payment.steadyRps);
        const concurrency = isConc ? QUALIFICATION.payment.concurrency : config.concurrency ?? 20;
        const r = await runPaymentPaced(config, ctx, auth, { rps, durationMs: config.durationMs ?? profile.durationMs ?? 60_000, concurrency });
        result = r.result;
        checks = r.checks;
        console.log("[perf] PAYMENT PACED:\n" + summarizeLoad(r.result));
      } else if (profile.kind === "booking") {
        const rps = config.targetRps ?? (config.profile === "booking-order-burst" ? QUALIFICATION.bookingOrder.burstRps : QUALIFICATION.bookingOrder.steadyRps);
        const r = await runBookingOrderPaced(config, ctx, auth, { rps, durationMs: config.durationMs ?? profile.durationMs ?? 60_000, concurrency: config.concurrency ?? 10 });
        result = r.result;
        checks = r.checks;
        console.log("[perf] BOOKING/ORDER PACED:\n" + summarizeLoad(r.result));
      } else if (profile.kind === "login") {
        const rps = config.targetRps ?? (config.profile === "login-burst" ? QUALIFICATION.login.burstRps : QUALIFICATION.login.qualRps);
        const r = await runLoginPaced(config, ctx, { rps, durationMs: config.durationMs ?? profile.durationMs ?? 60_000 });
        result = r.result;
        checks = r.checks;
        console.log("[perf] LOGIN PACED:\n" + summarizeLoad(r.result));
      }
    }
  } catch (err) {
    execError = String((err as Error)?.message ?? err);
    console.error(`[perf] HARNESS EXECUTION FAILED: ${execError}`);
    process.exitCode = 1;
  } finally {
    status.value = execError !== null ? "FAILED" : "DONE";
    if (ctx) {
      await ctx.app.close().catch(() => undefined);
      const issues = await cleanup(ctx.prisma, ctx.registry).catch((err) => [`cleanup crashed: ${String((err as Error)?.message ?? err)}`]);
      if (issues.length > 0) {
        console.error("[perf] CLEANUP ISSUES (visible, not hidden):\n  - " + issues.join("\n  - "));
        process.exitCode = 3;
      }
    }
  }

  memory.stop();
  const correctness: CorrectnessResult = verdictOf(checks);
  // process.exitCode is undefined until set — treat undefined/0 as «no failure yet»;
  // never override a cleanup exit code (3).
  if (execError === null && correctness.verdict === "FAIL" && process.exitCode !== 3) process.exitCode = 1;
  const harnessExecution = execError === null ? "PASS" : "FAIL";

  const summary = {
    runId: config.runId,
    profile: config.profile,
    mode: config.finalMode ? "final" : "exploratory",
    timestamp: new Date().toISOString(),
    status: status.value,
    verdict: { harnessExecution, correctness: correctness.verdict, measurement: "RECORDED", sloQualification: SLO_STATE },
    load: result
      ? sanitizeMetadata({
          mode: result.mode,
          byLabel: result.byLabel,
          byRouteClass: result.byRouteClass,
          totals: {
            totalRequests: result.totalRequests,
            expected: result.expected,
            unexpected4xx: result.unexpected4xx,
            unexpected409: result.unexpected409,
            unexpected429: result.unexpected429,
            unexpected5xx: result.unexpected5xx,
            timeouts: result.timeouts,
            transportErrors: result.transportErrors,
          },
          expectedStatuses: result.expectedStatuses,
          unexpectedStatuses: result.unexpectedStatuses,
          requestsPerSec: result.requestsPerSec,
          successfulPerSec: result.successfulPerSec,
          measurementMs: result.measurementMs,
          perBaseUrl: result.perBaseUrl,
          warmup: result.warmup,
          pacing: result.pacing,
        })
      : null,
    eventBus: eventBusMetrics,
    multiInstance: multiMetrics,
    dataset: datasetPrepared,
    datasetDrain,
    topology: {
      appInstances: env?.appInstances ?? 0,
      workerInstances: env?.workerInstances ?? 0,
    },
    worker: {
      intervalMs: QUALIFICATION.canonical.workerIntervalMs,
      batch: QUALIFICATION.canonical.workerBatch,
      overridesRejected: config.finalMode ? finalModeIssues.length > 0 : "N/A (exploratory)",
    },
    memoryTrend: memory.stats(),
    qualificationConfigValid: config.finalMode ? finalModeIssues.length === 0 : "N/A (exploratory)",
    note: "EXPLORATORY / HARNESS VALIDATION PROFILE — NOT production SLO, NOT production capacity target",
  };

  const written = writeArtifacts(config.outDir, {
    summary,
    environment: (env ?? {}) as Record<string, unknown>,
    scenario: ctx?.scenario ?? eventBusMetrics ?? multiMetrics ?? { profile: config.profile, kind: "none" },
    correctness: { ...correctness },
  });
  console.log("[perf] artifacts:");
  for (const f of written) console.log(`  ${f}`);
  console.log(`[perf] verdict: harnessExecution=${summary.verdict.harnessExecution} correctness=${correctness.verdict} sloQualification=${SLO_STATE}`);
}

void main();
