/**
 * E2E PHASE 2 STEP 2.12E — PARTNER_COLLECT / Commission Accrual Foundation
 * (ADR-0013 D9/D10/D14/D19).
 *
 * Покрывает (§36 negative / §37 positive промпта):
 *  T1 — canonical chain: MARKETPLACE Quote → ISSUE freeze (commissionSnapshot +
 *        sellerPartnerId) → Checkout → Sale → complete → Order (frozen verbatim)
 *        → Commission (CMS-*) + CommissionAccrual (CAA-*) + CommissionAccrued;
 *        amount = round_half_up(total × rate); status ACCRUED; PARTNER_COLLECT.
 *  T2 — money: half-up rounding (0.15 × 123.45 = 18.52); frozen base = Order.total.
 *  T3 — read API: list/detail Commission + Accrual (FINANCE); RBAC 403
 *        (SALES_MANAGER/OPERATOR/BUYER — finance.commission.read отсутствует);
 *        404 unknown code; без PII.
 *  T4 — no commission context: MARKETPLACE + policy, но product БЕЗ partner
 *        (sellerPartnerId NULL) → 0 фактов (D14 fail-closed, НЕ live lookup).
 *  T5 — NO_POLICY: MARKETPLACE без ACTIVE policy на now → snapshot NULL → 0 фактов
 *        (fail-closed; НЕ «0%» молча; resolved NO_POLICY ≠ NO_COMMISSION_CHANNEL).
 *  T6 — idempotency: ровно один факт на Order (Commission_orderId_key,
 *        CommissionAccrual_sourceCommissionId_key, inbox); повторный
 *        publishPending не создаёт дублей.
 *  T7 — zero side-effects: 0 Ledger/ProviderFee/Settlement/Payout/Invoice/
 *        Payment/Refund/Dispute (delta 0); ровно один CommissionAccrued;
 *        корреляция OrderRequested → OrderCreated → CommissionAccrued
 *        (causation chain); CommissionAccrued без PII.
 *  T8 — corrupt frozen snapshot (sellerPartnerId mismatch) → consumer FAILED
 *        (OrderCreated FAILED, событие НЕ молчаливый 0-факт), 0 Commission rows.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { Prisma, RoleCode, SalesAcquisitionSource } from "../src/generated/prisma/client";
import { EventBusService } from "../src/eventbus/eventbus.service";
import { DomainEvents } from "../src/eventbus/domain-events";
import { IdsService } from "../src/shared/ids.service";

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[]; customerId: string | null; partnerId: string | null };
}

interface ProductFixture {
  productId: string;
  tariffId: string;
  tariffPrice: string;
}

interface SaleCtx {
  quote: { id: string; code: string };
  intent: { id: string; code: string; version: number; total: string; currency: string };
  sale: { id: string; code: string; version: number; status: string };
  date: string;
  total: string;
  currency: string;
}

const FUTURE = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const CONSUMER_ID = "commission-accrual-consumer";
const NOW = new Date();

const FINANCIAL_SIDE_EFFECT_MODELS = [
  "ledgerTransaction",
  "providerFee",
  "settlement",
  "payout",
  "invoice",
  "payment",
  "refund",
  "dispute",
] as const;

describe("Phase 2 Step 2.12E — Partner Collect / Commission Accrual (e2e, ADR-0013)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: EventBusService;
  let ids: IdsService;
  let adminAgent: ReturnType<typeof request.agent>;
  let finAgent: Session;
  let sharedPolicyCode: string;

  const stamp = Date.now();
  const created: {
    users: string[];
    customers: string[];
    partners: string[];
    products: string[];
    opportunities: string[];
    quotes: string[];
    checkouts: string[];
    sales: string[];
    orders: string[];
    policies: string[];
  } = { users: [], customers: [], partners: [], products: [], opportunities: [], quotes: [], checkouts: [], sales: [], orders: [], policies: [] };

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };
  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };
  const createStaff = async (tag: string, roleCode: RoleCode, password = "staffpass123"): Promise<Session> => {
    const staff = (await adminAgent.post("/api/v1/users").send({ username: `${tag}${stamp}`, password, roleCode }).expect(201)).body as { id: string };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, password);
  };

  /** Партнёр через crm API (admin) — источник partnerId для ownership override. */
  const createPartner = async (tag: string): Promise<string> => {
    const p = (await adminAgent.post("/api/v1/partners").send({ name: `2.12E Partner ${tag} ${stamp}` }).expect(201)).body as { id: string };
    created.partners.push(p.id);
    return p.id;
  };

  /** Продукт, owned партнёром (admin ownership override, аудируется). */
  const createPartnerProduct = async (tag: string, partnerId: string, price = 100): Promise<ProductFixture> => {
    const res = await adminAgent
      .post("/api/v1/products")
      .send({ type: "TOUR", title: `2.12E ${tag} ${stamp}`, tariffs: [{ name: "Std", price }], partnerId, ownershipReason: "e2e 2.12E" })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    return { productId: product.id, tariffId: tariff.id, tariffPrice: String(tariff.price) };
  };

  /** Продукт БЕЗ владельца (system/admin-owned) — D14 fail-closed путь. */
  const createUnownedProduct = async (tag: string, price = 100): Promise<ProductFixture> => {
    const res = await adminAgent
      .post("/api/v1/products")
      .send({ type: "TOUR", title: `2.12E unowned ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    return { productId: product.id, tariffId: tariff.id, tariffPrice: String(tariff.price) };
  };

  const upsertAvailability = async (productId: string, tariffId: string, date: string, slotsTotal = 10) => {
    await adminAgent.post(`/api/v1/products/${productId}/availability`).send({ tariffId, date: `${date}T00:00:00.000Z`, slotsTotal }).expect(201);
  };

  /**
   * CommissionPolicy: DRAFT → ACTIVE. Окно обязано покрывать now (freeze
   * резолвит на реальном now). Open-ended (effectiveTo null) — валидно.
   * Возвращает code; вызывающий обязан заархивировать политику ПОСЛЕ теста
   * (overlap-инвариант: одна ACTIVE на канал-окно).
   */
  const createAndActivatePolicy = async (token: string, rate: string): Promise<{ code: string }> => {
    const policy = (await agent(token)
      .post("/api/v1/finance/commission-policies")
      .send({ channel: "MARKETPLACE", rate, effectiveFrom: "2020-01-01T00:00:00.000Z", effectiveTo: null })
      .expect(201)).body as { id: string; code: string };
    created.policies.push(policy.id);
    await agent(token).post(`/api/v1/finance/commission-policies/${policy.code}/activate`).expect(201);
    return { code: policy.code };
  };

  const archivePolicy = async (token: string, code: string) => {
    await agent(token).post(`/api/v1/finance/commission-policies/${code}/archive`).expect(201);
  };

  /** Полный fixture до Sale (НЕ complete): ISSUED Quote (MARKETPLACE) + Checkout + Sale OPEN. */
  const makeReadySale = async (smToken: string, fx: ProductFixture, opts: { extraItems?: Array<{ fx: ProductFixture }> } = {}): Promise<SaleCtx> => {
    const date = FUTURE();
    // Opportunity → MARKETPLACE (server-derived источник; тест задаёт факт через
    // prisma — симуляция канонического Lead→Opportunity пути, как в harness-ах).
    const opp = (await agent(smToken).post("/api/v1/sales/opportunities").send({ title: `2.12E opp ${stamp}` }).expect(201)).body as { id: string };
    created.opportunities.push(opp.id);
    await prisma.opportunity.update({ where: { id: opp.id }, data: { acquisitionSource: SalesAcquisitionSource.MARKETPLACE } });

    const quote = (await agent(smToken).post("/api/v1/sales/quotes").send({ opportunityId: opp.id }).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
    for (const extra of opts.extraItems ?? []) {
      await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: extra.fx.productId, tariffId: extra.fx.tariffId, quantity: 1 }).expect(201);
    }
    await agent(smToken)
      .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
      .send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() })
      .expect(200);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);

    const intent = (await agent(smToken)
      .post("/api/v1/sales/checkouts")
      .send({ quoteId: quote.id, serviceDate: date, travelers: [] })
      .expect(201)).body as { id: string; code: string; version: number; total: string; currency: string };
    created.checkouts.push(intent.id);
    await agent(smToken)
      .put(`/api/v1/sales/checkouts/${intent.code}/payment-terms`)
      .send({ scheme: "FULL_PREPAYMENT", expectedVersion: intent.version })
      .expect(200);
    await upsertAvailability(fx.productId, fx.tariffId, date);
    for (const extra of opts.extraItems ?? []) {
      await upsertAvailability(extra.fx.productId, extra.fx.tariffId, date);
    }

    const sale = (await agent(smToken)
      .post("/api/v1/sales/sales")
      .send({ quoteId: quote.id, checkoutIntentId: intent.id })
      .expect(201)).body as { id: string; code: string; version: number; status: string };
    created.sales.push(sale.id);
    return { quote, intent, sale, date, total: intent.total, currency: intent.currency };
  };

  const complete = (token: string, saleCode: string, expectedVersion: number) =>
    agent(token).post(`/api/v1/sales/sales/${saleCode}/complete`).send({ expectedVersion });

  const countFacts = async () => {
    return {
      commissions: await prisma.commission.count(),
      accruals: await prisma.commissionAccrual.count(),
      accruedEvents: await prisma.outboxEvent.count({ where: { eventType: "CommissionAccrued" } }),
      inbox: await prisma.inboxEvent.count({ where: { consumerId: CONSUMER_ID } }),
    };
  };

  const countSideEffects = async () => {
    const out: Record<string, number> = {};
    for (const m of FINANCIAL_SIDE_EFFECT_MODELS) {
      out[m] = await (prisma as unknown as Record<string, { count: () => Promise<number> }>)[m].count();
    }
    return out;
  };

  const deltas = <T extends Record<string, number>>(before: T, after: T) =>
    Object.fromEntries(Object.keys(before).map((k) => [k, after[k] - before[k]])) as Record<string, number>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    eventBus = app.get(EventBusService);
    ids = app.get(IdsService);

    const admin = await login("admin", "admin123");
    adminAgent = agent(admin.accessToken);
    finAgent = await createStaff("e12_fin", RoleCode.FINANCE);
    // Общая ACTIVE policy на now (T1–T4, T6–T7). T5 архивирует её для NO_POLICY.
    sharedPolicyCode = (await createAndActivatePolicy(finAgent.accessToken, "0.15")).code;
  });

  afterAll(async () => {
    // Commission/Accrual + CommissionAccrued + inbox (OrderCreated chain).
    await prisma.commissionAccrual.deleteMany();
    await prisma.commission.deleteMany();
    await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'CommissionAccrued'`);
    await prisma.$executeRawUnsafe(`DELETE FROM "events"."InboxEvent" WHERE "consumerId" = '${CONSUMER_ID}'`);
    if (created.orders.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'OrderCreated' AND "aggregateId" = ANY($1)`, created.orders);
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    if (created.sales.length > 0) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'OrderRequested' AND "payload"->>'saleId' = ANY($1)`,
        created.sales,
      );
      await prisma.availabilityReservation.deleteMany({ where: { sourceSaleId: { in: created.sales } } });
      await prisma.saleHistory.deleteMany({ where: { saleId: { in: created.sales } } });
      await prisma.sale.deleteMany({ where: { id: { in: created.sales } } });
    }
    await prisma.$executeRawUnsafe(
      `DELETE FROM "events"."InboxEvent" WHERE "consumerId" = 'order-requested-consumer' AND "eventId" NOT IN (SELECT id FROM "events"."OutboxEvent")`,
    );
    for (const id of created.checkouts) {
      await prisma.checkoutIntentHistory.deleteMany({ where: { checkoutIntentId: id } });
      await prisma.checkoutIntentTraveler.deleteMany({ where: { checkoutIntentId: id } });
      await prisma.checkoutIntent.deleteMany({ where: { id } });
    }
    for (const id of created.quotes) {
      await prisma.quoteItem.deleteMany({ where: { quoteId: id } });
      await prisma.quoteHistory.deleteMany({ where: { quoteId: id } });
      await prisma.quote.deleteMany({ where: { id } });
    }
    if (created.opportunities.length > 0) {
      await prisma.opportunityHistory.deleteMany({ where: { opportunityId: { in: created.opportunities } } });
      await prisma.opportunity.deleteMany({ where: { id: { in: created.opportunities } } });
    }
    if (created.policies.length > 0) {
      await prisma.commissionPolicyHistory.deleteMany({ where: { policyId: { in: created.policies } } });
      await prisma.commissionPolicy.deleteMany({ where: { id: { in: created.policies } } });
    }
    await prisma.availability.deleteMany({ where: { productId: { in: created.products } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  it("T1. canonical PARTNER_COLLECT chain: freeze → Order → Commission + CommissionAccrual + CommissionAccrued", async () => {
    const before = await countFacts();
    const partnerId = await createPartner("t1");
    const fx = await createPartnerProduct("t1", partnerId, 100);
    const sm = await createStaff("e12_t1", RoleCode.SALES_MANAGER);

    const ctx = await makeReadySale(sm.accessToken, fx);
    await complete(sm.accessToken, ctx.sale.code, ctx.sale.version).expect(201);
    await eventBus.publishPending();

    // Order: frozen sellerPartnerId + commissionSnapshot verbatim.
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    expect(order.sellerPartnerId).toBe(partnerId);
    const snap = order.commissionSnapshot as Record<string, unknown>;
    expect(snap.policyCode).toBe(sharedPolicyCode);
    expect(snap.rate).toBe("0.15");
    expect(snap.baseAmount).toBe("100");
    expect(snap.baseCurrency).toBe(ctx.currency);
    expect(snap.channel).toBe("MARKETPLACE");
    expect(snap.sellerPartnerId).toBe(partnerId);
    expect(order.amount.toString()).toBe("100");

    // Commission + CommissionAccrual: amount = round_half_up(100 × 0.15) = 15.
    const commission = await prisma.commission.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(commission.code).toMatch(/^CMS-/);
    expect(commission.amount.toString()).toBe("15");
    expect(commission.currency).toBe(ctx.currency);
    expect(commission.collectionModel).toBe("PARTNER_COLLECT");
    expect(commission.status).toBe("ACCRUED");
    expect(commission.partnerId).toBe(partnerId);
    const accrual = await prisma.commissionAccrual.findUniqueOrThrow({ where: { sourceCommissionId: commission.id } });
    expect(accrual.code).toMatch(/^CAA-/);
    expect(accrual.amount.toString()).toBe("15");
    expect(accrual.status).toBe("ACCRUED");
    expect(accrual.partnerId).toBe(partnerId);
    expect(accrual.accruedAt).not.toBeNull();

    // CommissionAccrued (PUBLISHED result-event): refs + frozen provenance, без PII.
    const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { eventType: "CommissionAccrued" } });
    expect(ev.status).toBe("PUBLISHED");
    const p = ev.payload as Record<string, unknown>;
    expect(p.commissionId).toBe(commission.id);
    expect(p.accrualId).toBe(accrual.id);
    expect(p.orderId).toBe(order.id);
    expect(p.partnerId).toBe(partnerId);
    expect(p.amount).toBe("15");
    expect(p.collectionModel).toBe("PARTNER_COLLECT");
    expect(p.policyCode).toBe(sharedPolicyCode);
    expect(p.channel).toBe("MARKETPLACE");
    const raw = JSON.stringify(p);
    for (const forbidden of ["email", "phone", "passportNumber", "firstName", "lastName", "birthDate", "card"]) {
      expect(raw).not.toContain(forbidden);
    }
    // Линейность: CommissionAccrued.causation = OrderCreated.id; correlation
    // chain наследуется (OrderCreated.correlationId = OrderRequested.correlationId).
    const orderCreatedEv = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateType: "Order", aggregateId: order.id, eventType: "OrderCreated" } });
    expect(orderCreatedEv.causationId).not.toBeNull();
    expect(ev.causationId).toBe(orderCreatedEv.id);
    expect(ev.correlationId).toBe(orderCreatedEv.correlationId);

    // Delta: ровно один факт на Order; inbox consumer-а +1.
    const d = deltas(before, await countFacts());
    expect(d.commissions).toBe(1);
    expect(d.accruals).toBe(1);
    expect(d.accruedEvents).toBe(1);
    expect(d.inbox).toBe(1);
  });

  it("T2. money: round_half_up(base × rate); base = frozen Order.total (123.45 × 0.15 = 18.52)", async () => {
    const before = await countFacts();
    const partnerId = await createPartner("t2");
    const fx = await createPartnerProduct("t2", partnerId, 123.45);
    const sm = await createStaff("e12_t2", RoleCode.SALES_MANAGER);

    const ctx = await makeReadySale(sm.accessToken, fx);
    await complete(sm.accessToken, ctx.sale.code, ctx.sale.version).expect(201);
    await eventBus.publishPending();

    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    expect(order.amount.toString()).toBe("123.45");
    const commission = await prisma.commission.findUniqueOrThrow({ where: { orderId: order.id } });
    // 123.45 × 0.15 = 18.5175 → ROUND_HALF_UP → 18.52
    expect(commission.amount.toString()).toBe("18.52");
    expect(deltas(before, await countFacts()).accruals).toBe(1);
  });

  it("T3. read API: list/detail Commission + Accrual; RBAC 403; 404 unknown code; без PII", async () => {
    const partnerId = await createPartner("t3");
    const fx = await createPartnerProduct("t3", partnerId, 200);
    const sm = await createStaff("e12_t3", RoleCode.SALES_MANAGER);
    const ctx = await makeReadySale(sm.accessToken, fx);
    await complete(sm.accessToken, ctx.sale.code, ctx.sale.version).expect(201);
    await eventBus.publishPending();

    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    const commission = await prisma.commission.findUniqueOrThrow({ where: { orderId: order.id } });
    const accrual = await prisma.commissionAccrual.findUniqueOrThrow({ where: { sourceCommissionId: commission.id } });

    // FINANCE — read.
    const list = await agent(finAgent.accessToken).get("/api/v1/finance/commissions").expect(200);
    expect(list.body.total).toBeGreaterThanOrEqual(1);
    expect(list.body.items.some((c: { code: string }) => c.code === commission.code)).toBe(true);
    const detail = await agent(finAgent.accessToken).get(`/api/v1/finance/commissions/${commission.code}`).expect(200);
    expect(detail.body.amount).toBe("30");
    expect(detail.body.orderId).toBe(order.id);
    expect(detail.body.collectionModel).toBe("PARTNER_COLLECT");
    const accList = await agent(finAgent.accessToken).get("/api/v1/finance/commission-accruals").expect(200);
    expect(accList.body.items.some((a: { code: string }) => a.code === accrual.code)).toBe(true);
    const accDetail = await agent(finAgent.accessToken).get(`/api/v1/finance/commission-accruals/${accrual.code}`).expect(200);
    expect(accDetail.body.amount).toBe("30");
    expect(accDetail.body.status).toBe("ACCRUED");
    expect(accDetail.body.sourceCommissionId).toBe(commission.id);
    expect(JSON.stringify(detail.body)).not.toContain("passport");

    // RBAC: read-set по факту ROLE_PERMISSIONS — FINANCE/DIRECTOR/ANALYST (ADMIN
    // через ALL_PERMISSIONS) читают; SALES_MANAGER/OPERATOR/PARTNER/MODERATOR/
    // MARKETER/BUYER — finance.commission.read отсутствует → 403.
    const director = await createStaff("e12_t3dir", RoleCode.DIRECTOR);
    const analyst = await createStaff("e12_t3an", RoleCode.ANALYST);
    const salesManager = await createStaff("e12_t3sm", RoleCode.SALES_MANAGER);
    const operator = await createStaff("e12_t3op", RoleCode.OPERATOR);
    const moderator = await createStaff("e12_t3mod", RoleCode.MODERATOR);
    const marketer = await createStaff("e12_t3mkt", RoleCode.MARKETER);
    const buyer = (await request(app.getHttpServer()).post("/api/v1/auth/register").send({
      username: `e12buyer${stamp}`,
      email: `e12buyer${stamp}@test.local`,
      password: "buyerpass123",
      firstName: "Buyer",
      lastName: "T3",
    }).expect(201)).body as Session;
    created.users.push(buyer.user.id);
    const partner = await createStaff("e12_t3ptn", RoleCode.PARTNER, "partnerpass123");
    for (const who of [director, analyst]) {
      await agent(who.accessToken).get("/api/v1/finance/commissions").expect(200);
      await agent(who.accessToken).get(`/api/v1/finance/commissions/${commission.code}`).expect(200);
      await agent(who.accessToken).get("/api/v1/finance/commission-accruals").expect(200);
      await agent(who.accessToken).get(`/api/v1/finance/commission-accruals/${accrual.code}`).expect(200);
    }
    for (const who of [salesManager, operator, moderator, marketer, partner, buyer]) {
      await agent(who.accessToken).get("/api/v1/finance/commissions").expect(403);
      await agent(who.accessToken).get(`/api/v1/finance/commissions/${commission.code}`).expect(403);
      await agent(who.accessToken).get("/api/v1/finance/commission-accruals").expect(403);
      await agent(who.accessToken).get(`/api/v1/finance/commission-accruals/${accrual.code}`).expect(403);
    }

    // 404 unknown codes.
    await agent(finAgent.accessToken).get("/api/v1/finance/commissions/CMS-99999999").expect(404);
    await agent(finAgent.accessToken).get("/api/v1/finance/commission-accruals/CAA-99999999").expect(404);
  });

  it("T4. no commission context (unowned product → sellerPartnerId NULL) → 0 фактов (D14 fail-closed)", async () => {
    const before = await countFacts();
    const fx = await createUnownedProduct("t4", 100);
    const sm = await createStaff("e12_t4", RoleCode.SALES_MANAGER);

    const ctx = await makeReadySale(sm.accessToken, fx);
    await complete(sm.accessToken, ctx.sale.code, ctx.sale.version).expect(201);
    await eventBus.publishPending();

    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    // Channel MARKETPLACE + policy есть, НО нет единого seller → snapshot без
    // sellerPartnerId → accrual fail-closed (0 фактов, НЕ live Catalog lookup).
    expect(order.sellerPartnerId).toBeNull();
    const d = deltas(before, await countFacts());
    expect(d.commissions).toBe(0);
    expect(d.accruals).toBe(0);
    expect(d.accruedEvents).toBe(0);
    // OrderCreated всё равно обработан (inbox строка consumer-а).
    expect(d.inbox).toBe(1);
  });

  it("T5. NO_POLICY: MARKETPLACE без ACTIVE policy на now → snapshot NULL → 0 фактов (не «0%»)", async () => {
    // Архив общей политики: теперь на канале нет ACTIVE-политики, покрывающей now.
    await archivePolicy(finAgent.accessToken, sharedPolicyCode);
    // Политика с окном, НЕ покрывающим now (effectiveTo в прошлом) → NO_POLICY.
    const past = (await agent(finAgent.accessToken)
      .post("/api/v1/finance/commission-policies")
      .send({ channel: "MARKETPLACE", rate: "0.15", effectiveFrom: "2020-01-01T00:00:00.000Z", effectiveTo: "2026-01-01T00:00:00.000Z" })
      .expect(201)).body as { id: string; code: string };
    created.policies.push(past.id);
    await agent(finAgent.accessToken).post(`/api/v1/finance/commission-policies/${past.code}/activate`).expect(201);
    const res = await agent(finAgent.accessToken)
      .get(`/api/v1/finance/commission-policies/resolve?channel=MARKETPLACE&at=${encodeURIComponent(NOW.toISOString())}`)
      .expect(200);
    expect(res.body).toEqual({ found: false, reason: "NO_POLICY" });

    const before = await countFacts();
    const partnerId = await createPartner("t5");
    const fx = await createPartnerProduct("t5", partnerId, 100);
    const sm = await createStaff("e12_t5", RoleCode.SALES_MANAGER);
    const ctx = await makeReadySale(sm.accessToken, fx);
    await complete(sm.accessToken, ctx.sale.code, ctx.sale.version).expect(201);
    await eventBus.publishPending();

    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    // NO_POLICY → commission-контекста нет вообще: ни snapshot, ни seller
    // attribution не замораживаются (fail-closed; не «0%», а отсутствие контекста).
    expect(order.sellerPartnerId).toBeNull();
    expect(order.commissionSnapshot).toBeNull(); // NO_POLICY → NULL (не «0%»)
    const d = deltas(before, await countFacts());
    expect(d.commissions).toBe(0);
    expect(d.accruals).toBe(0);
    expect(d.accruedEvents).toBe(0);
    expect(d.inbox).toBe(1);
    // Освобождаем канал для следующих тестов (overlap-инвариант).
    await archivePolicy(finAgent.accessToken, past.code);
  });

  it("T6. idempotency: ровно один факт на Order; повторный publishPending — без дублей", async () => {
    // Общая политика заархивирована в T5 → новая ACTIVE (overlap-инвариант чист).
    const policy = await createAndActivatePolicy(finAgent.accessToken, "0.15");
    const before = await countFacts();
    const partnerId = await createPartner("t6");
    const fx = await createPartnerProduct("t6", partnerId, 300);
    const sm = await createStaff("e12_t6", RoleCode.SALES_MANAGER);
    const ctx = await makeReadySale(sm.accessToken, fx);
    await complete(sm.accessToken, ctx.sale.code, ctx.sale.version).expect(201);
    await eventBus.publishPending();

    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    const d1 = deltas(before, await countFacts());
    expect(d1.commissions).toBe(1);

    // Повторная доставка: OrderCreated уже PUBLISHED → publishPending ничего не
    // диспатчит; DB backstop (Commission_orderId_key) — второй слой защиты.
    await eventBus.publishPending();
    await eventBus.publishPending();
    const d2 = deltas(before, await countFacts());
    expect(d2.commissions).toBe(1);
    expect(d2.accruals).toBe(1);
    expect(d2.accruedEvents).toBe(1);
    expect(await prisma.commission.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.commissionAccrual.count({ where: { partnerId } })).toBe(1);
    await archivePolicy(finAgent.accessToken, policy.code);
  });

  it("T7. zero side-effects: delta 0 по Ledger/ProviderFee/Settlement/Payout/Invoice/Payment/Refund/Dispute; 1 CommissionAccrued", async () => {
    const policy = await createAndActivatePolicy(finAgent.accessToken, "0.15");
    const before = await countFacts();
    const sideBefore = await countSideEffects();
    const partnerId = await createPartner("t7");
    const fx = await createPartnerProduct("t7", partnerId, 100);
    const sm = await createStaff("e12_t7", RoleCode.SALES_MANAGER);
    const ctx = await makeReadySale(sm.accessToken, fx);
    await complete(sm.accessToken, ctx.sale.code, ctx.sale.version).expect(201);
    await eventBus.publishPending();

    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    const side = deltas(sideBefore, await countSideEffects());
    for (const [m, n] of Object.entries(side)) {
      expect(n).toBe(0);
    }
    // Booking/Availability: accrual-производитель не мутирует их (negative matrix).
    const bBefore = await prisma.booking.count();
    const aBefore = await prisma.availability.count();
    const bAfter = await prisma.booking.count();
    const aAfter = await prisma.availability.count();
    expect(bAfter - bBefore).toBe(0);
    expect(aAfter - aBefore).toBe(0);
    expect(deltas(before, await countFacts()).accruedEvents).toBe(1);
    await archivePolicy(finAgent.accessToken, policy.code);
  });

  it("T8. corrupt frozen snapshot (sellerPartnerId mismatch) → consumer FAILED, 0 фактов (не молчаливый 0)", async () => {
    const before = await countFacts();
    const partnerId = await createPartner("t8");
    // Order напрямую с КОРРУМПТИРОВАННЫМ snapshot (mismatch sellerPartnerId) —
    // как если бы producer записал дефектные frozen-данные. Коды/номера — через
    // канонический IdsService (никаких ручных последовательностей).
    const code = await prisma.$transaction((tx) => ids.nextCode(tx, "ORD"));
    const number = await prisma.$transaction((tx) => ids.nextOrderNumber(tx));
    const order = await prisma.order.create({
      data: {
        code,
        number,
        customerId: null,
        status: "NEW",
        paymentStatus: "UNPAID",
        currency: "USD",
        amount: new Prisma.Decimal("100"),
        paidAmount: new Prisma.Decimal("0"),
        version: 1,
        submittedAt: new Date(),
        acquisitionSource: SalesAcquisitionSource.MARKETPLACE,
        sellerPartnerId: partnerId,
        commissionSnapshot: {
          policyCode: "CMP-CORRUPT",
          policyVersion: 1,
          rateType: "PERCENTAGE",
          rate: "0.15",
          baseAmount: "100",
          baseCurrency: "USD",
          channel: "MARKETPLACE",
          sellerPartnerId: "PAR-CORRUPT-DIFFERENT",
          selectedAt: new Date().toISOString(),
          roundingContractVersion: "v1",
        } as Prisma.InputJsonValue,
      } as Prisma.OrderUncheckedCreateInput,
    });
    created.orders.push(order.id);

    // OrderCreated (PENDING) вручную — доставка consumer-у через publishPending.
    await prisma.outboxEvent.create({
      data: {
        aggregateType: "Order",
        aggregateId: order.id,
        eventType: DomainEvents.OrderCreated,
        payload: { orderId: order.id, code: order.code, number: order.number, customerId: null, amount: "100", currency: "USD" } as Prisma.InputJsonValue,
        correlationId: `corr-t8-${stamp}`,
        status: "PENDING",
      },
    });
    await eventBus.publishPending();

    // Consumer FAILED: событие помечено FAILED с error, НЕ молчаливый 0-факт.
    const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: order.id, eventType: "OrderCreated" } });
    expect(ev.status).toBe("FAILED");
    expect(ev.error).toContain("sellerPartnerId");
    expect(await prisma.commission.count({ where: { orderId: order.id } })).toBe(0);
    const d = deltas(before, await countFacts());
    expect(d.accruals).toBe(0);
    // FAILED не retryable (OrderCreated legacy-семантика) — факт не создан дважды.
    await eventBus.publishPending();
    expect(await prisma.commission.count({ where: { orderId: order.id } })).toBe(0);
    expect(deltas(before, await countFacts()).accruals).toBe(0);
  });

  it("T9. policy changed AFTER freeze → Commission использует frozen A (0 live re-resolve)", async () => {
    const before = await countFacts();
    const policyA = await createAndActivatePolicy(finAgent.accessToken, "0.15");
    const partnerId = await createPartner("t9");
    const fx = await createPartnerProduct("t9", partnerId, 100);
    const sm = await createStaff("e12_t9", RoleCode.SALES_MANAGER);
    const ctx = await makeReadySale(sm.accessToken, fx); // ISSUE freeze c policy A (0.15)

    // После freeze: policy A архивируется, включается policy B (другая ставка).
    await archivePolicy(finAgent.accessToken, policyA.code);
    const policyB = await createAndActivatePolicy(finAgent.accessToken, "0.30");

    await complete(sm.accessToken, ctx.sale.code, ctx.sale.version).expect(201);
    await eventBus.publishPending();

    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    const snap = order.commissionSnapshot as Record<string, unknown>;
    expect(snap.policyCode).toBe(policyA.code); // frozen A, НЕ B
    expect(snap.rate).toBe("0.15");
    const commission = await prisma.commission.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(commission.amount.toString()).toBe("15"); // 100 × 0.15 (A), не 30 (B)
    expect(deltas(before, await countFacts()).commissions).toBe(1);
    await archivePolicy(finAgent.accessToken, policyB.code);
  });

  it("T10. mutable Catalog/Product changed AFTER freeze → Commission остаётся у frozen seller", async () => {
    const before = await countFacts();
    const policy = await createAndActivatePolicy(finAgent.accessToken, "0.15");
    const sellerA = await createPartner("t10a");
    const sellerB = await createPartner("t10b");
    const fx = await createPartnerProduct("t10", sellerA, 100);
    const sm = await createStaff("e12_t10", RoleCode.SALES_MANAGER);
    const ctx = await makeReadySale(sm.accessToken, fx); // freeze: seller = A

    // После freeze мутируем live Product.partnerId (Catalog mutable source).
    await prisma.product.update({ where: { id: fx.productId }, data: { partnerId: sellerB } });

    await complete(sm.accessToken, ctx.sale.code, ctx.sale.version).expect(201);
    await eventBus.publishPending();

    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    expect(order.sellerPartnerId).toBe(sellerA); // frozen seller, НЕ live Catalog
    const commission = await prisma.commission.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(commission.partnerId).toBe(sellerA);
    expect(deltas(before, await countFacts()).accruals).toBe(1);
    await archivePolicy(finAgent.accessToken, policy.code);
  });

  it("T11. multi-seller (2 items, 2 partners) → 0 Commission/Accrual (fail-closed, не first-row)", async () => {
    const before = await countFacts();
    const policy = await createAndActivatePolicy(finAgent.accessToken, "0.15");
    const p1 = await createPartner("t11a");
    const p2 = await createPartner("t11b");
    const fx1 = await createPartnerProduct("t11a", p1, 100);
    const fx2 = await createPartnerProduct("t11b", p2, 100);
    const sm = await createStaff("e12_t11", RoleCode.SALES_MANAGER);
    const ctx = await makeReadySale(sm.accessToken, fx1, { extraItems: [{ fx: fx2 }] });
    await complete(sm.accessToken, ctx.sale.code, ctx.sale.version).expect(201);
    await eventBus.publishPending();

    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    // Multi-seller → sellerPartnerId NULL → snapshot NULL (нет единого seller) → 0 фактов.
    expect(order.sellerPartnerId).toBeNull();
    const d = deltas(before, await countFacts());
    expect(d.commissions).toBe(0);
    expect(d.accruals).toBe(0);
    expect(d.accruedEvents).toBe(0);
    expect(d.inbox).toBe(1);
    await archivePolicy(finAgent.accessToken, policy.code);
  });

  it("T12. concurrent duplicate OrderCreated delivery → ровно один факт, 0 raw 500", async () => {
    const before = await countFacts();
    const partnerId = await createPartner("t12");
    const code = await prisma.$transaction((tx) => ids.nextCode(tx, "ORD"));
    const number = await prisma.$transaction((tx) => ids.nextOrderNumber(tx));
    const order = await prisma.order.create({
      data: {
        code,
        number,
        customerId: null,
        status: "NEW",
        paymentStatus: "UNPAID",
        currency: "USD",
        amount: new Prisma.Decimal("100"),
        paidAmount: new Prisma.Decimal("0"),
        version: 1,
        submittedAt: new Date(),
        acquisitionSource: SalesAcquisitionSource.MARKETPLACE,
        sellerPartnerId: partnerId,
        commissionSnapshot: {
          policyCode: "CMP-T12",
          policyVersion: 1,
          rateType: "PERCENTAGE",
          rate: "0.15",
          baseAmount: "100",
          baseCurrency: "USD",
          channel: "MARKETPLACE",
          sellerPartnerId: partnerId,
          selectedAt: new Date().toISOString(),
          roundingContractVersion: "v1",
        } as Prisma.InputJsonValue,
      } as Prisma.OrderUncheckedCreateInput,
    });
    created.orders.push(order.id);
    await prisma.outboxEvent.create({
      data: {
        aggregateType: "Order",
        aggregateId: order.id,
        eventType: DomainEvents.OrderCreated,
        payload: { orderId: order.id, code: order.code, number: order.number, customerId: null, amount: "100", currency: "USD" } as Prisma.InputJsonValue,
        correlationId: `corr-t12-${stamp}`,
        status: "PENDING",
      },
    });

    // Concurrent delivery: оба publishPending видят один и тот же PENDING
    // OrderCreated; consumer-ные транзакции конкурируют — inbox + DB unique
    // (Commission_orderId_key) → один факт, loser controlled no-op, 0 raw 500.
    await Promise.all([eventBus.publishPending(), eventBus.publishPending()]);

    const d = deltas(before, await countFacts());
    expect(d.commissions).toBe(1);
    expect(d.accruals).toBe(1);
    expect(d.accruedEvents).toBe(1);
    expect(await prisma.commission.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("T13. read API pagination validation: page=0/pageSize=0/pageSize>max/page=abc → 400", async () => {
    const g = (q: string) => agent(finAgent.accessToken).get(`/api/v1/finance/commissions?${q}`);
    await g("page=0").expect(400);
    await g("pageSize=0").expect(400);
    await g("pageSize=101").expect(400);
    await g("page=abc").expect(400);
    await g("status=NOT_A_STATUS").expect(400); // строго валидный enum (review fix: raw 500 → 400)
    await g("status=ACCRUED").expect(200); // валидный enum
    await agent(finAgent.accessToken).get("/api/v1/finance/commission-accruals?pageSize=101").expect(400);
    await agent(finAgent.accessToken).get("/api/v1/finance/commission-accruals?status=NOT_A_STATUS").expect(400);
    await agent(finAgent.accessToken).get("/api/v1/finance/commissions?page=1&pageSize=100").expect(200);
  });
});
