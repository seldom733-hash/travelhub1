/**
 * Step 2.17B — deterministic synthetic dataset seed + registry + cleanup.
 *
 * Hard rules: synthetic identities only (no PII, no PAN/CVV, no production
 * credentials/JWTs). Every created row is tracked in a SeedRegistry and
 * deleted deterministically in dependency order during cleanup. Run-specific
 * prefixes (`perf<runid>_`) make cleanup unambiguous.
 */

import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService, OUTBOX_MAX_ATTEMPTS } from "../../eventbus/eventbus.service";
import { Prisma, RoleCode } from "../../generated/prisma/client";
import { sleep } from "./pacer";

export interface ApiResult<T = unknown> {
  status: number;
  body: T;
}

export interface AuthSession {
  accessToken: string;
  user: { id: string; username: string };
}

/** Minimal HTTP helper over fetch — headers/body handled by callers. */
export async function api<T = unknown>(
  baseUrl: string,
  method: "GET" | "POST" | "PUT" | "PATCH",
  path: string,
  opts: { token?: string; body?: unknown; headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(opts.headers ?? {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown = null;
    if (text.length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { status: res.status, body: body as T };
  } finally {
    clearTimeout(timer);
  }
}

export interface Tracked {
  users: string[];
  products: string[];
  customers: string[];
  quotes: string[];
  checkouts: string[];
  sales: string[];
  orders: string[];
  payments: string[];
  ledger: string[];
  outbox: string[];
}

export function newRegistry(): Tracked {
  return {
    users: [],
    products: [],
    customers: [],
    quotes: [],
    checkouts: [],
    sales: [],
    orders: [],
    payments: [],
    ledger: [],
    outbox: [],
  };
}

export async function adminLogin(baseUrl: string): Promise<AuthSession> {
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";
  const res = await api<AuthSession>(baseUrl, "POST", "/api/v1/auth/login", { body: { username, password } });
  if (res.status !== 200) {
    throw new Error(`admin login failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export async function login(baseUrl: string, username: string, password: string): Promise<AuthSession> {
  const res = await api<AuthSession>(baseUrl, "POST", "/api/v1/auth/login", { body: { username, password } });
  if (res.status !== 200) {
    throw new Error(`login '${username}' failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export interface SeedUser {
  id: string;
  username: string;
  token: string;
  roleCode: RoleCode;
}

export async function createStaffUser(
  baseUrl: string,
  adminToken: string,
  registry: Tracked,
  tag: string,
  roleCode: RoleCode,
  password = "perfpass123",
): Promise<SeedUser> {
  const username = tag;
  const created = await api<{ id: string }>(baseUrl, "POST", "/api/v1/users", {
    token: adminToken,
    body: { username, password, roleCode },
  });
  if (created.status !== 201) {
    throw new Error(`create user '${username}' failed (${created.status}): ${JSON.stringify(created.body)}`);
  }
  registry.users.push(created.body.id);
  const session = await login(baseUrl, username, password);
  return { id: created.body.id, username, token: session.accessToken, roleCode };
}

export interface SeedProduct {
  id: string;
  tariffId: string;
}

/** Create a product + availability via admin API; tariff id resolved via prisma. */
export async function createProductWithAvailability(
  baseUrl: string,
  adminToken: string,
  prisma: PrismaService,
  registry: Tracked,
  title: string,
  price: number,
  serviceDate: string,
): Promise<SeedProduct> {
  const prod = await api<{ product: { id: string } }>(baseUrl, "POST", "/api/v1/products", {
    token: adminToken,
    body: { type: "TOUR", title, tariffs: [{ name: "Std", price }] },
  });
  if (prod.status !== 201) {
    throw new Error(`create product failed (${prod.status}): ${JSON.stringify(prod.body)}`);
  }
  registry.products.push(prod.body.product.id);
  const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: prod.body.product.id } });
  const avail = await api(baseUrl, "POST", `/api/v1/products/${prod.body.product.id}/availability`, {
    token: adminToken,
    body: { tariffId: tariff.id, date: `${serviceDate}T00:00:00.000Z`, slotsTotal: 100 },
  });
  if (avail.status !== 201) {
    throw new Error(`availability failed (${avail.status}): ${JSON.stringify(avail.body)}`);
  }
  return { id: prod.body.product.id, tariffId: tariff.id };
}

/**
 * Canonical chain to an Order (product → availability → quote → checkout →
 * sale → complete → OrderRequested event), driven through the real API.
 * Caller must run `drainOutbox` afterwards so OrderRequested → Order →
 * CommissionAccrual materialize (real nested consumer chain).
 */
export async function buildOrderChain(
  baseUrl: string,
  adminToken: string,
  prisma: PrismaService,
  sm: SeedUser,
  registry: Tracked,
  price: number,
  serviceDate: string,
  tag: string,
): Promise<{ quoteId: string; checkoutId: string; saleId: string; saleCode: string }> {
  const prod = await createProductWithAvailability(baseUrl, adminToken, prisma, registry, `Perf ${tag}`, price, serviceDate);

  const quote = await api<{ id: string; code: string }>(baseUrl, "POST", "/api/v1/sales/quotes", { token: sm.token, body: {} });
  if (quote.status !== 201) throw new Error(`quote failed (${quote.status}): ${JSON.stringify(quote.body)}`);
  registry.quotes.push(quote.body.id);
  const quoteCode = quote.body.code;

  const item = await api(baseUrl, "POST", `/api/v1/sales/quotes/${quoteCode}/items`, {
    token: sm.token,
    body: { productId: prod.id, tariffId: prod.tariffId, quantity: 1 },
  });
  if (item.status !== 201) throw new Error(`quote item failed (${item.status}): ${JSON.stringify(item.body)}`);

  const commercial = await api(baseUrl, "PUT", `/api/v1/sales/quotes/${quoteCode}/commercial`, {
    token: sm.token,
    body: { discountType: "NONE", validUntil: new Date(Date.now() + 60 * 86400000).toISOString() },
  });
  if (commercial.status !== 200) throw new Error(`commercial failed (${commercial.status}): ${JSON.stringify(commercial.body)}`);

  const issue = await api(baseUrl, "POST", `/api/v1/sales/quotes/${quoteCode}/issue`, { token: sm.token });
  if (issue.status !== 201) throw new Error(`issue failed (${issue.status}): ${JSON.stringify(issue.body)}`);

  const intent = await api<{ id: string; code: string; version: number }>(baseUrl, "POST", "/api/v1/sales/checkouts", {
    token: sm.token,
    body: { quoteId: quote.body.id, serviceDate, travelers: [] },
  });
  if (intent.status !== 201) throw new Error(`checkout failed (${intent.status}): ${JSON.stringify(intent.body)}`);
  registry.checkouts.push(intent.body.id);

  const terms = await api(baseUrl, "PUT", `/api/v1/sales/checkouts/${intent.body.code}/payment-terms`, {
    token: sm.token,
    body: { scheme: "FULL_PREPAYMENT", expectedVersion: intent.body.version },
  });
  if (terms.status !== 200) throw new Error(`payment-terms failed (${terms.status}): ${JSON.stringify(terms.body)}`);

  const sale = await api<{ id: string; code: string }>(baseUrl, "POST", "/api/v1/sales/sales", {
    token: sm.token,
    body: { quoteId: quote.body.id, checkoutIntentId: intent.body.id },
  });
  if (sale.status !== 201) throw new Error(`sale failed (${sale.status}): ${JSON.stringify(sale.body)}`);
  registry.sales.push(sale.body.id);

  const complete = await api(baseUrl, "POST", `/api/v1/sales/sales/${sale.body.code}/complete`, {
    token: sm.token,
    body: { expectedVersion: 1 },
  });
  if (complete.status !== 201) throw new Error(`complete failed (${complete.status}): ${JSON.stringify(complete.body)}`);

  return { quoteId: quote.body.id, checkoutId: intent.body.id, saleId: sale.body.id, saleCode: sale.body.code };
}

/** Create a synthetic CRM customer via the canonical API. */
export async function createCustomer(
  baseUrl: string,
  adminToken: string,
  registry: Tracked,
  tag: string,
  index: number,
): Promise<{ id: string; code: string }> {
  const created = await api<{ customer: { id: string; code: string } }>(baseUrl, "POST", "/api/v1/customers", {
    token: adminToken,
    body: {
      type: "PERSON",
      firstName: `Perf${tag}`,
      lastName: `Seed${index}`,
      email: `perf.${tag}.${index}@example.test`,
    },
  });
  if (created.status !== 201) {
    throw new Error(`create customer '${tag}${index}' failed (${created.status}): ${JSON.stringify(created.body)}`);
  }
  registry.customers.push(created.body.customer.id);
  return created.body.customer;
}

/** Seed N synthetic LedgerTransaction facts directly (canonical finance model, tracked). */
export async function seedLedgerRows(prisma: PrismaService, registry: Tracked, count: number, tag: string): Promise<string[]> {
  const ids: string[] = [];
  const BATCH = 200;
  for (let base = 0; base < count; base += BATCH) {
    const rows = Array.from({ length: Math.min(BATCH, count - base) }, (_, k) => {
      const i = base + k;
      return {
        code: `LTX-${String(10_000_000 + i).padStart(8, "0")}`,
        amount: new Prisma.Decimal("100.00"),
        currency: "USD",
        type: "PERF_DATASET",
        sourceType: "PERF",
        sourceId: `${tag}-${i}`,
        businessRef: `perf-dataset-${tag}-${i}`,
        actorType: "SYSTEM",
      };
    });
    // LedgerTransaction rows are created via LedgerService in production; direct
    // inserts here are synthetic dataset preparation only (deterministic, tracked).
    await prisma.ledgerTransaction.createMany({ data: rows as never, skipDuplicates: true });
    const found = await prisma.ledgerTransaction.findMany({
      where: { businessRef: { startsWith: `perf-dataset-${tag}-` } },
      select: { id: true },
    });
    ids.push(...found.map((r) => r.id));
  }
  registry.ledger.push(...ids);
  return ids;
}

/** Seed N EventBus probe events (BookingCreated, synthetic) — seed-capacity proof. */
export async function seedEventBusProbes(
  eventBus: EventBusService,
  prisma: PrismaService,
  registry: Tracked,
  count: number,
  prefix: string,
): Promise<string[]> {
  // Chunked: one transaction per 500 emits (5s interactive tx timeout safety).
  const ids: string[] = [];
  for (let base = 0; base < count; base += 500) {
    const chunk = Math.min(500, count - base);
    await prisma.$transaction(async (tx) => {
      for (let k = 0; k < chunk; k++) {
        const i = base + k;
        ids.push(
          await eventBus.emit(tx, {
            aggregateType: "Booking",
            aggregateId: `${prefix}-${i}`,
            eventType: "BookingCreated",
            payload: { bookingId: `${prefix}-${i}`, note: "perf-dataset" },
            actor: { type: "SYSTEM" },
          }),
        );
      }
    });
  }
  registry.outbox.push(...ids);
  return ids;
}

/**
 * Deterministic synthetic dataset preparation (H3).
 *
 * Creates users/products/customers/quotes/order-chains/ledger rows through the
 * canonical APIs (plus tracked direct ledger inserts) at the requested dataset
 * profile scale. Everything is run-prefixed and tracked for dependency-aware
 * cleanup. Order chains are drained so orders (payment-capable) materialize.
 */
export interface DatasetPrep {
  counts: Record<string, number>;
  /** Round-2 (F-1) drain diagnostics: iterations/duration/remaining per drain call. */
  drain: { afterChains: DrainOutboxResult; afterProbes: DrainOutboxResult };
  usernames: string[];
  orderIds: string[];
  sm: SeedUser;
  fin: SeedUser;
}

export async function prepareDataset(opts: {
  baseUrl: string;
  adminToken: string;
  prisma: PrismaService;
  eventBus: EventBusService;
  registry: Tracked;
  runId: string;
  counts: { users: number; products: number; customers: number; quotes: number; orderChains: number; paymentCapableOrders: number; ledger: number; eventBusSeed: number };
}): Promise<DatasetPrep> {
  const { baseUrl, adminToken, prisma, eventBus, registry, runId, counts } = opts;
  const tag = runId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  const sm = await createStaffUser(baseUrl, adminToken, registry, `perf${tag}_sm`, RoleCode.SALES_MANAGER);
  const fin = await createStaffUser(baseUrl, adminToken, registry, `perf${tag}_fin`, RoleCode.FINANCE);
  const serviceDate = futureDate(45);
  const usernames: string[] = [];
  const orderIds: string[] = [];

  // Users (dataset principals for login scenarios).
  for (let i = 0; i < counts.users; i++) {
    const u = await createStaffUser(baseUrl, adminToken, registry, `perf${tag}_u${i}`, RoleCode.OPERATOR);
    usernames.push(u.username);
  }
  // Products + availability.
  for (let i = 0; i < counts.products; i++) {
    await createProductWithAvailability(baseUrl, adminToken, prisma, registry, `Perf ${tag} p${i}`, 100 + (i % 900), serviceDate);
  }
  // CRM customers.
  for (let i = 0; i < counts.customers; i++) {
    await createCustomer(baseUrl, adminToken, registry, tag, i);
  }
  // Quotes (issued).
  for (let i = 0; i < counts.quotes; i++) {
    const prod = await prisma.product.findFirst({
      where: { title: { startsWith: `Perf ${tag}` } },
      select: { id: true },
      skip: i % Math.max(1, counts.products),
    });
    const tariff = prod ? await prisma.tariff.findFirstOrThrow({ where: { productId: prod.id } }) : null;
    const quote = await api<{ id: string; code: string }>(baseUrl, "POST", "/api/v1/sales/quotes", { token: sm.token, body: {} });
    if (quote.status !== 201) throw new Error(`dataset quote failed (${quote.status})`);
    registry.quotes.push(quote.body.id);
    if (prod && tariff) {
      const item = await api(baseUrl, "POST", `/api/v1/sales/quotes/${quote.body.code}/items`, {
        token: sm.token,
        body: { productId: prod.id, tariffId: tariff.id, quantity: 1 },
      });
      if (item.status !== 201) throw new Error(`dataset quote item failed (${item.status})`);
      const commercial = await api(baseUrl, "PUT", `/api/v1/sales/quotes/${quote.body.code}/commercial`, {
        token: sm.token,
        body: { discountType: "NONE", validUntil: new Date(Date.now() + 60 * 86400000).toISOString() },
      });
      if (commercial.status !== 200) throw new Error(`dataset commercial failed (${commercial.status})`);
      const issue = await api(baseUrl, "POST", `/api/v1/sales/quotes/${quote.body.code}/issue`, { token: sm.token });
      if (issue.status !== 201) throw new Error(`dataset quote issue failed (${issue.status})`);
    }
  }
  // Order chains (Booking/Order dataset) — drained so Orders materialize.
  const chainSaleIds: string[] = [];
  for (let i = 0; i < counts.orderChains; i++) {
    const chain = await buildOrderChain(baseUrl, adminToken, prisma, sm, registry, 100 + (i % 900), serviceDate, `${tag}oc${i}`);
    chainSaleIds.push(chain.saleId);
  }
  const drainAfterChains = await drainOutbox(eventBus, prisma);
  const orders = await prisma.order.findMany({
    where: { saleId: { in: chainSaleIds } },
    select: { id: true },
  });
  const chainOrders = orders;
  registry.orders.push(...chainOrders.map((o) => o.id));
  orderIds.push(...chainOrders.map((o) => o.id));
  // Ledger facts.
  await seedLedgerRows(prisma, registry, counts.ledger, tag);
  // EventBus seed-capacity proof (probe events, drained so the DB state is clean).
  const probePrefix = `perf-ds-${runId}`;
  await seedEventBusProbes(eventBus, prisma, registry, counts.eventBusSeed, probePrefix);
  const drainAfterProbes = await drainOutbox(eventBus, prisma);

  return {
    counts: {
      users: usernames.length,
      products: counts.products,
      customers: counts.customers,
      quotes: counts.quotes,
      orderChains: chainOrders.length,
      paymentCapableOrders: chainOrders.length,
      ledger: counts.ledger,
      eventBusSeed: counts.eventBusSeed,
    },
    drain: { afterChains: drainAfterChains, afterProbes: drainAfterProbes },
    usernames,
    orderIds,
    sm,
    fin,
  };
}

/**
 * Round-2 remediation (F-1): bounded, STATE-DRIVEN outbox drain for dataset
 * preparation. Completion is based on actual EventBus state, not loop count:
 *
 *   - healthy PENDING → published via the same production `publishPending` the
 *     worker uses; consumers may emit NESTED PENDING events (OrderRequested →
 *     Order → OrderCreated → CommissionAccrual), so the loop keeps going while
 *     PENDING remains (a single `publishPending` returning less than the batch
 *     is NOT a stop condition — §7).
 *   - retryable FAILED (attempts < OUTBOX_MAX_ATTEMPTS) → flipped back via the
 *     production `retryFailed` and re-published (durable-retry worker contract);
 *     events waiting on backoff (`nextAttemptAt`) are polled briefly.
 *   - poison / exhausted FAILED (retryable=false OR attempts >= max) → retained
 *     and isolated; NEVER counted as drainable work (§6).
 *
 * Convergence = PENDING === 0 AND retryable FAILED === 0. If the explicit
 * safety bound (maxIterations / maxDurationMs) is reached first, the seed FAILS
 * closed and the dataset MUST NOT be marked ready (§8). No unbounded loop; no
 * outbox/inbox history is deleted to force completion.
 */
export interface DrainOutboxOptions {
  /** publishPending/retryFailed batch (default 200). */
  batchSize?: number;
  /** Safety cap on drain iterations (default 2,000 — derived from the
   * REPRESENTATIVE contract: >=5,000 seed events + ~3 nested events/chain over
   * 1,000 chains ⇒ min rounds ≈ 8,000/200 = 40; 2,000 = 50x headroom). */
  maxIterations?: number;
  /** Safety cap on elapsed wall-clock time (default 10 min). */
  maxDurationMs?: number;
}

export interface DrainOutboxResult {
  completed: boolean;
  iterations: number;
  published: number;
  retried: number;
  elapsedMs: number;
  remainingPending: number;
  remainingRetryableFailed: number;
  batchSize: number;
}

const DRAIN_DEFAULT_BATCH_SIZE = 200;
const DRAIN_DEFAULT_MAX_ITERATIONS = 2_000;
const DRAIN_DEFAULT_MAX_DURATION_MS = 10 * 60_000;
/** Poll interval when only backoff-delayed retryable work remains. */
const DRAIN_BACKOFF_POLL_MS = 500;

interface DrainEventStore {
  outboxEvent: { count(args: { where: Record<string, unknown> }): Promise<number> };
}

export async function drainOutbox(
  eventBus: Pick<EventBusService, "publishPending" | "retryFailed">,
  prisma: DrainEventStore,
  options: DrainOutboxOptions = {},
): Promise<DrainOutboxResult> {
  const batchSize = options.batchSize ?? DRAIN_DEFAULT_BATCH_SIZE;
  const maxIterations = options.maxIterations ?? DRAIN_DEFAULT_MAX_ITERATIONS;
  const maxDurationMs = options.maxDurationMs ?? DRAIN_DEFAULT_MAX_DURATION_MS;
  const startedAt = Date.now();
  let iterations = 0;
  let published = 0;
  let retried = 0;

  const readState = async (): Promise<{ pending: number; retryable: number }> => {
    const [pending, retryable] = await Promise.all([
      prisma.outboxEvent.count({ where: { status: "PENDING" } }),
      prisma.outboxEvent.count({
        where: { status: "FAILED", retryable: true, attempts: { lt: OUTBOX_MAX_ATTEMPTS } },
      }),
    ]);
    return { pending, retryable };
  };

  for (;;) {
    iterations++;
    const elapsedMs = Date.now() - startedAt;
    if (iterations > maxIterations || elapsedMs > maxDurationMs) {
      const { pending, retryable } = await readState();
      throw new Error(
        `outbox did not drain within bound: pending=${pending} retryableFailed=${retryable} iterations=${iterations} elapsedMs=${elapsedMs} batchSize=${batchSize}`,
      );
    }
    const flipped = await eventBus.retryFailed(batchSize);
    const done = await eventBus.publishPending(batchSize);
    retried += flipped;
    published += done;
    const { pending, retryable } = await readState();
    if (pending === 0 && retryable === 0) {
      return {
        completed: true,
        iterations,
        published,
        retried,
        elapsedMs: Date.now() - startedAt,
        remainingPending: 0,
        remainingRetryableFailed: 0,
        batchSize,
      };
    }
    // No healthy progress this round (only backoff-delayed retryable work left,
    // e.g. a transiently failed OrderRequested waiting on nextAttemptAt): poll
    // briefly so the backoff can elapse — still bounded by the safety cap.
    if (done === 0 && flipped === 0 && pending === 0) {
      await sleep(DRAIN_BACKOFF_POLL_MS);
    }
  }
}

/** Cleanup: delete all tracked synthetic rows in dependency order. */
export async function cleanup(prisma: PrismaService, registry: Tracked): Promise<string[]> {
  const issues: string[] = [];
  const del = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn();
    } catch (err) {
      issues.push(`${label}: ${String((err as Error)?.message ?? err)}`);
    }
  };
  if (registry.users.length > 0) {
    await del("idempotency slots", () =>
      prisma.externalIdempotencyRecord.deleteMany({ where: { scopeId: { in: registry.users } } }),
    );
  }
  if (registry.payments.length > 0) {
    const payEventIds = (
      await prisma.outboxEvent.findMany({ where: { aggregateId: { in: registry.payments } }, select: { id: true } })
    ).map((e) => e.id);
    await del("payment inbox", () => prisma.inboxEvent.deleteMany({ where: { eventId: { in: payEventIds } } }));
    await del("payment outbox", () => prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: registry.payments } } }));
    await del("payment history", () => prisma.paymentHistory.deleteMany({ where: { paymentId: { in: registry.payments } } }));
    await del("payments", () => prisma.payment.deleteMany({ where: { id: { in: registry.payments } } }));
  }
  if (registry.orders.length > 0) {
    const orderEventIds = (
      await prisma.outboxEvent.findMany({ where: { aggregateId: { in: registry.orders } }, select: { id: true } })
    ).map((e) => e.id);
    await del("order inbox", () => prisma.inboxEvent.deleteMany({ where: { eventId: { in: orderEventIds } } }));
    await del("order outbox", () => prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: registry.orders } } }));
    await del("orders", () => prisma.order.deleteMany({ where: { id: { in: registry.orders } } }));
  }
  // OBS-2 fix: Quote/Checkout/Sale aggregate events also carry outbox+inbox rows
  // (QuoteIssued, CheckoutCreated, SaleCompleted…) — previously left as residue.
  const aggGroups: Array<{ label: string; ids: string[] }> = [
    { label: "sale", ids: registry.sales },
    { label: "checkout", ids: registry.checkouts },
    { label: "quote", ids: registry.quotes },
  ];
  for (const g of aggGroups) {
    if (g.ids.length === 0) continue;
    const eventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: g.ids } }, select: { id: true } })).map((e) => e.id);
    await del(`${g.label} inbox`, () => prisma.inboxEvent.deleteMany({ where: { eventId: { in: eventIds } } }));
    await del(`${g.label} outbox`, () => prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: g.ids } } }));
  }
  if (registry.sales.length > 0) {
    await del("availability reservations", () =>
      prisma.availabilityReservation.deleteMany({ where: { sourceSaleId: { in: registry.sales } } }),
    );
    await del("sales", () => prisma.sale.deleteMany({ where: { id: { in: registry.sales } } }));
  }
  if (registry.ledger.length > 0) {
    await del("ledger transactions", () => prisma.ledgerTransaction.deleteMany({ where: { id: { in: registry.ledger } } }));
  }
  if (registry.customers.length > 0) {
    const custEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: registry.customers } }, select: { id: true } })).map((e) => e.id);
    await del("customer inbox", () => prisma.inboxEvent.deleteMany({ where: { eventId: { in: custEventIds } } }));
    await del("customer outbox", () => prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: registry.customers } } }));
    await del("customers", () => prisma.customer.deleteMany({ where: { id: { in: registry.customers } } }));
  }
  if (registry.products.length > 0) {
    // Round-2 (F-1 scope): ProductCreated outbox/inbox rows carry the product
    // aggregateId — previously left as PUBLISHED residue (1,500 rows after a
    // REPRESENTATIVE seed). Harness-owned synthetic rows; canonical history
    // semantics preserved (only tracked perf rows are deleted).
    const prodEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: registry.products } }, select: { id: true } })).map((e) => e.id);
    await del("product inbox", () => prisma.inboxEvent.deleteMany({ where: { eventId: { in: prodEventIds } } }));
    await del("product outbox", () => prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: registry.products } } }));
    await del("availability", () => prisma.availability.deleteMany({ where: { productId: { in: registry.products } } }));
  }
  if (registry.checkouts.length > 0) {
    await del("checkout intents", () => prisma.checkoutIntent.deleteMany({ where: { id: { in: registry.checkouts } } }));
  }
  if (registry.quotes.length > 0) {
    await del("quotes", () => prisma.quote.deleteMany({ where: { id: { in: registry.quotes } } }));
  }
  if (registry.products.length > 0) {
    await del("products", () => prisma.product.deleteMany({ where: { id: { in: registry.products } } }));
  }
  if (registry.outbox.length > 0) {
    await del("seeded outbox", () => prisma.outboxEvent.deleteMany({ where: { id: { in: registry.outbox } } }));
  }
  if (registry.users.length > 0) {
    await del("users", () => prisma.user.deleteMany({ where: { id: { in: registry.users } } }));
  }
  return issues;
}

export function futureDate(days = 30): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}
