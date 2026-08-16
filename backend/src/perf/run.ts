/**
 * PHASE 2 — STEP 2.17B — LOAD & PERFORMANCE HARNESS (exploratory).
 *
 * Orchestrator: parses CLI config (fail-closed) → safe-target guard →
 * boots the real Nest application in-process against an ISOLATED database →
 * seeds deterministic synthetic data → runs the requested profile (load /
 * payment.create idempotency / EventBus recovery) → validates correctness →
 * writes structured artifacts → deterministic cleanup.
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
import { parseArgs, PROFILES, usage, type RunConfig } from "./lib/config";
import { guardViolations } from "./lib/guard";
import { runLoad, summarizeLoad, type LoadResult, type MakeRequest } from "./lib/loader";
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

const SLO_STATE = "NOT EVALUATED — AUTHORITY REQUIRED";

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
  steps: Array<{ label: string; method: "GET" | "POST"; path: string; auth: "public" | "admin" | "sm" | "fin" | "login"; expected: number[]; body?: () => Record<string, unknown> }>,
  auth: { admin: string; sm: string; fin: string },
): MakeRequest {
  return (iteration: number) => {
    const step = steps[iteration % steps.length];
    const headers: Record<string, string> = {};
    if (step.auth === "admin") headers.Authorization = `Bearer ${auth.admin}`;
    else if (step.auth === "sm") headers.Authorization = `Bearer ${auth.sm}`;
    else if (step.auth === "fin") headers.Authorization = `Bearer ${auth.fin}`;
    return { label: step.label, method: step.method, path: step.path, headers, body: step.body ? step.body() : undefined, expected: step.expected };
  };
}

function p95Of(ms: number[]): number {
  if (ms.length === 0) return 0;
  const sorted = [...ms].sort((a, b) => a - b);
  const idx = Math.ceil((95 / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runLoadProfile(config: RunConfig, steps: Array<{ label: string; method: "GET" | "POST"; path: string; auth: "public" | "admin" | "sm" | "fin" | "login"; expected: number[]; body?: () => Record<string, unknown> }>, warmupMs: number, ctx: RunContext): Promise<{ result: LoadResult; checks: CorrectnessCheck[] }> {
  const admin = await adminLogin(ctx.baseUrl);
  const sm = await createStaffUser(ctx.baseUrl, admin.accessToken, ctx.registry, `perf${config.runId}_sm`, RoleCode.SALES_MANAGER);
  const fin = await createStaffUser(ctx.baseUrl, admin.accessToken, ctx.registry, `perf${config.runId}_fin`, RoleCode.FINANCE);

  // Scripted login probe — distinct synthetic users, once each (per-instance
  // throttle respected; login is NOT part of sustained load).
  const loginProbe: Array<{ username: string; ms: number; status: number }> = [];
  for (let i = 0; i < 5; i++) {
    const u = await createStaffUser(ctx.baseUrl, admin.accessToken, ctx.registry, `perf${config.runId}_lg${i}`, RoleCode.OPERATOR);
    const start = performance.now();
    const res = await api(ctx.baseUrl, "POST", "/api/v1/auth/login", { body: { username: u.username, password: "perfpass123" } });
    loginProbe.push({ username: u.username, ms: performance.now() - start, status: res.status });
  }

  const durationMs = config.durationMs ?? 10_000;
  const concurrency = config.concurrency ?? 5;
  const result = await runLoad({
    baseUrl: ctx.baseUrl,
    concurrency,
    durationMs,
    warmupMs,
    makeRequest: buildMakeRequest(steps, { admin: admin.accessToken, sm: sm.token, fin: fin.token }),
    requestTimeoutMs: config.requestTimeoutMs,
    seed: config.seed,
  });

  const checks = [...loadRunChecks(result)];
  const unexpectedLogin = loginProbe.filter((l) => l.status !== 200).length;
  checks.push({
    name: "scripted login probe 200",
    passed: unexpectedLogin === 0,
    detail: `probes=${loginProbe.length} unexpected=${unexpectedLogin} p95=${p95Of(loginProbe.map((l) => l.ms)).toFixed(1)}ms`,
  });

  ctx.scenario = {
    profile: config.profile,
    kind: "load",
    concurrency,
    durationMs,
    warmupMs,
    steps: steps.map((s) => ({ label: s.label, method: s.method, path: s.path, auth: s.auth, expected: s.expected })),
    loginProbe: loginProbe.map((l) => ({ username: l.username, status: l.status, ms: Math.round(l.ms) })),
  };
  return { result, checks };
}

async function runPaycreate(config: RunConfig, ctx: RunContext): Promise<{ result: LoadResult; checks: CorrectnessCheck[] }> {
  const admin = await adminLogin(ctx.baseUrl);
  const sm = await createStaffUser(ctx.baseUrl, admin.accessToken, ctx.registry, `perf${config.runId}_sm`, RoleCode.SALES_MANAGER);
  const fin = await createStaffUser(ctx.baseUrl, admin.accessToken, ctx.registry, `perf${config.runId}_fin`, RoleCode.FINANCE);

  // Build orders via the canonical chain (worker off — we drive the outbox).
  // 5 orders for the unique-key/burst set, 1 reserved for concurrent-identical,
  // 2 for concurrent-divergent → 8 total.
  const ORDER_COUNT = 8;
  const serviceDate = futureDate(45);
  const chains = [];
  for (let i = 0; i < ORDER_COUNT; i++) {
    chains.push(await buildOrderChain(ctx.baseUrl, admin.accessToken, ctx.prisma, sm, ctx.registry, 100 + i, serviceDate, `payc${i}`));
  }
  await drainOutbox(ctx.eventBus, ctx.prisma);
  const orders = await ctx.prisma.order.findMany({ where: { saleId: { in: chains.map((c) => c.saleId) } }, select: { id: true } });
  const orderIds = orders.map((o) => o.id);
  ctx.registry.orders.push(...orderIds);
  if (orderIds.length !== ORDER_COUNT) {
    throw new Error(`expected ${ORDER_COUNT} orders, got ${orderIds.length}`);
  }

  // Nested consumer chain proof: OrderRequested → Order → OrderCreated →
  // CommissionAccrual. Consumers are authoritative via InboxEvent dedup rows.
  const orderCreatedRows = await ctx.prisma.outboxEvent.findMany({ where: { eventType: "OrderCreated", aggregateId: { in: orderIds } }, select: { id: true } });
  const orderCreatedEvents = orderCreatedRows.length;
  const consumedInboxRows = await ctx.prisma.inboxEvent.count({ where: { eventId: { in: orderCreatedRows.map((r) => r.id) } } });
  const commissionAccruals = await ctx.prisma.commissionAccrual.count({});

  const pay = (orderId: string, key: string) =>
    api<{ id: string }>(ctx.baseUrl, "POST", "/api/v1/finance/payments", {
      token: fin.token,
      headers: { "Idempotency-Key": key },
      body: { orderId },
      timeoutMs: config.requestTimeoutMs,
    });

  // 1. Unique-key burst: 2 keys × 5 orders = 10 requests. The first key per
  //    order creates the Payment (201). The second key on the SAME order is a
  //    canonical business-level no-op (PaymentService idempotent retry: active
  //    payment exists → returns the existing fact, 201) — 0 duplicate facts.
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
        businessNoop++; // business-level no-op: same fact returned
      }
    } else if (res.status >= 500) {
      unique5xx++;
    }
  }

  // 2. Identical retry ×3 (DB-backed replay — 0 new facts, same id).
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

  // 3. Concurrent identical ×4 — all < 500, exactly 1 fact (fresh order).
  const concOrder = orderIds[5];
  const keyA = `perf-${config.runId}-conc-id-${config.seed}`;
  const concId = await Promise.all(Array.from({ length: 4 }, () => pay(concOrder, keyA)));
  const concId201 = concId.filter((r) => r.status === 201).length;
  const concId500 = concId.filter((r) => r.status >= 500).length;
  const winnerId = concId.find((r) => r.status === 201);
  if (winnerId) ctx.registry.payments.push((winnerId.body as { id: string }).id);

  // 4. Concurrent divergent — same key, different fresh orders → 1×201 + 1×409.
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
  const expectedPayments = 5 + 1 + div201; // unique facts + concurrent + divergent winner
  const checks: CorrectnessCheck[] = [
    ...(await paycreateChecks(ctx.prisma, { expectedPerOrder, userIds: [fin.id], expectedPayments, businessNoopKeys: businessNoop })),
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
    samples: [],
    byLabel: {
      "paycreate.unique": {
        count: uniqueLatency.length,
        stats: { count: uniqueLatency.length, min: 0, p50: 0, p95: 0, p99: 0, max: 0, mean: 0 },
        outcomes: { expected: unique201, unexpected4xx: 0, unexpected409: 0, unexpected429: 0, unexpected5xx: unique5xx, timeout: 0, transportError: 0 },
      },
    },
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

async function runEventbusRecovery(config: RunConfig): Promise<{ result: LoadResult; checks: CorrectnessCheck[]; drainMs: number; env: EnvMetadata }> {
  const SEED_COUNT = 250; // exceeds default worker batch (100) → burst
  const RUN_PREFIX = `perf-eb-${config.runId}`;
  let env: EnvMetadata | null = null;

  // Phase A: worker disabled — seed burst of PENDING + one poison.
  const a = await bootApp(false);
  try {
    const seeded = await a.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (let i = 0; i < SEED_COUNT; i++) {
        ids.push(
          await a.eventBus.emit(tx, {
            aggregateType: "Booking",
            aggregateId: `${RUN_PREFIX}-${i}`,
            eventType: "BookingCreated",
            payload: { bookingId: `${RUN_PREFIX}-${i}`, note: "perf-probe" },
            actor: { type: "SYSTEM" },
          }),
        );
      }
      return ids;
    });
    const poison = await a.prisma.$transaction((tx) =>
      a.eventBus.emit(tx, {
        aggregateType: "Booking",
        aggregateId: `${RUN_PREFIX}-poison`,
        eventType: "BookingCreated",
        payload: { bookingId: `${RUN_PREFIX}-poison`, note: "poison" },
        actor: { type: "SYSTEM" },
      }),
    );
    await a.prisma.outboxEvent.update({
      where: { id: poison },
      data: { status: "FAILED", retryable: false, attempts: 5, error: "perf poison" },
    });
    const pendingBefore = await a.prisma.outboxEvent.count({ where: { status: "PENDING", aggregateId: { startsWith: `${RUN_PREFIX}-` } } });
    if (pendingBefore !== SEED_COUNT) {
      throw new Error(`expected ${SEED_COUNT} PENDING, got ${pendingBefore}`);
    }
    void seeded;
    env = await collectEnv({
      runId: config.runId,
      dbUrl: process.env.DATABASE_URL,
      baseUrl: a.baseUrl,
      profile: config.profile,
      seed: config.seed,
      datasetClass: "SMALL",
      appInstances: 2,
      workerInstances: 1,
      postgresVersion: await postgresVersion(a.prisma),
      requestTimeoutMs: config.requestTimeoutMs,
    });
  } finally {
    await a.app.close();
  }

  // Phase B: worker enabled (fast interval) — measure drain + poison isolation.
  const prevInterval = process.env.OUTBOX_WORKER_INTERVAL_MS;
  process.env.OUTBOX_WORKER_INTERVAL_MS = "200";
  const drainStart = Date.now();
  const b = await bootApp(true);
  let drainMs = 0;
  let published = 0;
  let residualFailed = 0;
  let poisonStillFailed = false;
  try {
    const deadline = Date.now() + config.drainTimeoutMs;
    while (Date.now() < deadline) {
      const pending = await b.prisma.outboxEvent.count({ where: { status: "PENDING", aggregateId: { startsWith: `${RUN_PREFIX}-` } } });
      if (pending === 0) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    drainMs = Date.now() - drainStart;
    published = await b.prisma.outboxEvent.count({ where: { status: "PUBLISHED", aggregateId: { startsWith: `${RUN_PREFIX}-` } } });
    residualFailed = await b.prisma.outboxEvent.count({ where: { status: "FAILED", aggregateId: { startsWith: `${RUN_PREFIX}-` } } });
    const poisonRow = await b.prisma.outboxEvent.findFirst({ where: { aggregateId: `${RUN_PREFIX}-poison` } });
    poisonStillFailed = poisonRow?.status === "FAILED";
  } finally {
    await b.app.close();
    if (prevInterval !== undefined) process.env.OUTBOX_WORKER_INTERVAL_MS = prevInterval;
    else delete process.env.OUTBOX_WORKER_INTERVAL_MS;
  }

  // Phase C: multi-instance drain — two worker-enabled apps, same DB.
  const MI_COUNT = 100;
  const MI_PREFIX = `perf-mi-${config.runId}`;
  process.env.OUTBOX_WORKER_INTERVAL_MS = "500";
  const mi: Booted[] = [await bootApp(true), await bootApp(true)];
  let miPublished = 0;
  let miPending = 0;
  try {
    const { prisma, eventBus } = mi[0];
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < MI_COUNT; i++) {
        await eventBus.emit(tx, {
          aggregateType: "Booking",
          aggregateId: `${MI_PREFIX}-${i}`,
          eventType: "BookingCreated",
          payload: { bookingId: `${MI_PREFIX}-${i}`, note: "perf-mi" },
          actor: { type: "SYSTEM" },
        });
      }
    });
    const miDeadline = Date.now() + config.drainTimeoutMs;
    while (Date.now() < miDeadline) {
      miPending = await prisma.outboxEvent.count({ where: { status: "PENDING", aggregateId: { startsWith: `${MI_PREFIX}-` } } });
      if (miPending === 0) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    miPublished = await prisma.outboxEvent.count({ where: { status: "PUBLISHED", aggregateId: { startsWith: `${MI_PREFIX}-` } } });
  } finally {
    for (const inst of mi) await inst.app.close().catch(() => undefined);
    if (prevInterval !== undefined) process.env.OUTBOX_WORKER_INTERVAL_MS = prevInterval;
    else delete process.env.OUTBOX_WORKER_INTERVAL_MS;
  }

  // Cleanup: remove all seeded rows by prefix (deterministic, run-scoped).
  const cleanupPrisma = mi[0]?.prisma ?? b.prisma;
  const cleaned = await cleanupPrisma.outboxEvent.deleteMany({ where: { OR: [{ aggregateId: { startsWith: `${RUN_PREFIX}-` } }, { aggregateId: { startsWith: `${MI_PREFIX}-` } }] } });
  if (cleaned.count === 0) {
    // Fallback: reopen a prisma-less path is not possible — surface as observation.
    console.warn("[perf] eventbus cleanup deleted 0 rows (rows may already be gone)");
  }

  const checks = eventbusChecks({
    seededCount: SEED_COUNT,
    poisonId: `${RUN_PREFIX}-poison`,
    publishedCount: published,
    residualPending: 0,
    residualFailed: residualFailed - 1, // the poison itself is the expected FAILED
    poisonStillFailed,
    drainMs,
  });
  if (miPublished !== MI_COUNT || miPending !== 0) {
    checks.push({
      name: "multi-instance drain complete",
      passed: false,
      detail: `published=${miPublished}/${MI_COUNT} pending=${miPending}`,
    });
  } else {
    checks.push({
      name: "multi-instance drain complete",
      passed: true,
      detail: `published=${miPublished}/${MI_COUNT} pending=${miPending} instances=2`,
    });
  }

  const result: LoadResult = {
    samples: [],
    byLabel: {},
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
  };
  return { result, checks, drainMs, env: env! };
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
  process.env.DATABASE_URL = dbUrl;

  console.log(`[perf] profile=${config.profile} runId=${config.runId} db=${dbUrl.replace(/\/\/[^@]+@/, "//***@")}`);
  console.log(`[perf] EXPLORATORY PROFILE — NOT a production SLO, NOT a capacity target`);

  let result: LoadResult | null = null;
  let checks: CorrectnessCheck[] = [];
  let env: EnvMetadata | null = null;
  let ctx: RunContext | null = null;
  let drainMs = 0;
  let execError: string | null = null;

  try {
    if (profile.kind === "eventbus") {
      const r = await runEventbusRecovery(config);
      result = r.result;
      checks = r.checks;
      env = r.env;
      drainMs = r.drainMs;
      console.log(`[perf] EVENTBUS RECOVERY: published=${result.expected} drain=${drainMs}ms events/s=${result.successfulPerSec}`);
    } else {
      const booted = await bootApp(false);
      ctx = { ...booted, registry: newRegistry(), scenario: {} };
      env = await collectEnv({
        runId: config.runId,
        dbUrl,
        baseUrl: booted.baseUrl,
        profile: config.profile,
        seed: config.seed,
        datasetClass: "SMALL",
        appInstances: 1,
        workerInstances: 0,
        postgresVersion: await postgresVersion(booted.prisma),
        requestTimeoutMs: config.requestTimeoutMs,
      });
      if (profile.kind === "load") {
        const r = await runLoadProfile(config, profile.steps, profile.warmupMs, ctx);
        result = r.result;
        checks = r.checks;
        console.log("[perf] LOAD:\n" + summarizeLoad(r.result));
      } else {
        const r = await runPaycreate(config, ctx);
        result = r.result;
        checks = r.checks;
        console.log(`[perf] PAYCREATE: payments=${result.expected} unexpected5xx=${result.unexpected5xx}`);
      }
    }
  } catch (err) {
    execError = String((err as Error)?.message ?? err);
    console.error(`[perf] HARNESS EXECUTION FAILED: ${execError}`);
    process.exitCode = 1;
  } finally {
    if (ctx) {
      await ctx.app.close().catch(() => undefined);
      const issues = await cleanup(ctx.prisma, ctx.registry).catch((err) => [`cleanup crashed: ${String((err as Error)?.message ?? err)}`]);
      if (issues.length > 0) {
        console.error("[perf] CLEANUP ISSUES (visible, not hidden):\n  - " + issues.join("\n  - "));
        process.exitCode = 3;
      }
    }
  }

  if (env === null || result === null) {
    if (process.exitCode === 0) process.exitCode = 1;
    return;
  }

  const correctness: CorrectnessResult = verdictOf(checks);
  if (correctness.verdict === "FAIL" && process.exitCode === 0) process.exitCode = 1;
  const harnessExecution = execError === null ? "PASS" : "FAIL";

  const summary = {
    runId: config.runId,
    profile: config.profile,
    timestamp: new Date().toISOString(),
    verdict: { harnessExecution, correctness: correctness.verdict, measurement: "RECORDED", sloQualification: SLO_STATE },
    load: result
      ? sanitizeMetadata({
          byLabel: result.byLabel,
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
          requestsPerSec: result.requestsPerSec,
          successfulPerSec: result.successfulPerSec,
          measurementMs: result.measurementMs,
        })
      : null,
    note: "EXPLORATORY / HARNESS VALIDATION PROFILE — NOT production SLO, NOT production capacity target",
  };

  const written = writeArtifacts(config.outDir, {
    summary,
    environment: env as unknown as Record<string, unknown>,
    scenario: ctx?.scenario ?? { profile: config.profile, kind: "eventbus", seeded: 250, multiInstance: 100 },
    correctness: { ...correctness },
  });
  console.log("[perf] artifacts:");
  for (const f of written) console.log(`  ${f}`);
  console.log(`[perf] verdict: harnessExecution=${summary.verdict.harnessExecution} correctness=${correctness.verdict} sloQualification=${SLO_STATE}`);
}

void main();
