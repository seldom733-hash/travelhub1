/**
 * Step 2.17B — deterministic synthetic dataset seed + registry + cleanup.
 *
 * Hard rules: synthetic identities only (no PII, no PAN/CVV, no production
 * credentials/JWTs). Every created row is tracked in a SeedRegistry and
 * deleted deterministically in dependency order during cleanup. Run-specific
 * prefixes (`perf<runid>_`) make cleanup unambiguous.
 */

import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { RoleCode } from "../../generated/prisma/client";

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
  quotes: string[];
  checkouts: string[];
  sales: string[];
  orders: string[];
  payments: string[];
  outbox: string[];
}

export function newRegistry(): Tracked {
  return { users: [], products: [], quotes: [], checkouts: [], sales: [], orders: [], payments: [], outbox: [] };
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

/** Drive the outbox until no PENDING remains (bounded) — materializes consumers. */
export async function drainOutbox(eventBus: EventBusService, prisma: PrismaService, maxRounds = 20): Promise<void> {
  for (let round = 0; round < maxRounds; round++) {
    await eventBus.publishPending(200);
    const pending = await prisma.outboxEvent.count({ where: { status: "PENDING" } });
    if (pending === 0) return;
  }
  throw new Error("outbox did not drain within bound");
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
  if (registry.sales.length > 0) {
    await del("availability reservations", () =>
      prisma.availabilityReservation.deleteMany({ where: { sourceSaleId: { in: registry.sales } } }),
    );
    await del("sales", () => prisma.sale.deleteMany({ where: { id: { in: registry.sales } } }));
  }
  if (registry.products.length > 0) {
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
