/**
 * E2E PHASE 2 STEP 2.2B — Buyer Request Foundation (reverse.*, ADR-0012).
 *
 * Инварианты:
 *  - ownership ТОЛЬКО из actor.customerId (сервер); forged buyerId/customerId/
 *    ownerId/source/version/temporal → 422; чужой request → neutral 404;
 *  - BuyerRequest ≠ Sales/Order/Booking/Communication: создание/мутация НЕ
 *    создают Lead/Opportunity/Quote/Sale/Order/Booking/Product;
 *  - lifecycle DRAFT → SUBMITTED → CANCELLED (update только в DRAFT);
 *    никакого MATCHED/DISTRIBUTED/Proposal/conversion;
 *  - CAS (version): stale → 409; races → один победитель;
 *  - acquisitionSource серверный, всегда BUYER_REQUEST;
 *  - PII-minimal: никаких контактов в request/history/audit; preferences
 *    reject contact-ключи;
 *  - Seller/PARTNER доступа НЕ имеет (2.2C distribution — позже);
 *  - reverse.* содержит только 2.2A+2.2B сущности.
 *
 * Test DB: изолированная (e2e.env.ts) — dev-БД не используется.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { RoleCode } from "../src/generated/prisma/enums";
import * as bcrypt from "bcryptjs";

interface Session {
  accessToken: string;
  user: { id: string; role: string; username: string; email: string | null; customerId: string | null; permissions: string[] };
}

interface RequestView {
  id: string;
  code: string;
  buyerId: string;
  categoryId: string;
  categorySlug: string;
  destinations: Array<{ countryCode?: string; cityCode?: string; worldwide?: boolean }>;
  serviceDateFrom: string | null;
  serviceDateTo: string | null;
  adults: number;
  children: number;
  infants: number;
  budget: { currency: string; min?: number; max?: number } | null;
  preferences: Record<string, unknown> | null;
  acquisitionSource: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  cancelledAt: string | null;
}

describe("Phase 2 Step 2.2B — Buyer Request Foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const created = {
    users: [] as string[],
    customers: [] as string[],
    partners: [] as string[],
    categories: [] as string[],
    requests: [] as string[],
  };

  let adminAgent: ReturnType<typeof request.agent>;
  let partnerAgent: ReturnType<typeof request.agent>;
  let buyerAAgent: ReturnType<typeof request.agent>;
  let buyerBAgent: ReturnType<typeof request.agent>;
  let catHotelId: string;
  let catTourId: string;

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  const registerBuyer = async (tag: string): Promise<Session> => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        username: `${tag}${stamp}`,
        email: `${tag}${stamp}@test.local`,
        password: "buyerpass123",
        firstName: "Покупатель",
        lastName: tag.toUpperCase(),
      })
      .expect(201);
    const session = res.body as Session;
    created.users.push(session.user.id);
    if (session.user.customerId) created.customers.push(session.user.customerId);
    return session;
  };

  const listReq = (a: ReturnType<typeof request.agent>, qs = "") => a.get(`/api/v1/buyer/requests${qs}`);
  const getReq = (a: ReturnType<typeof request.agent>, id: string) => a.get(`/api/v1/buyer/requests/${id}`);
  const reqHistory = (a: ReturnType<typeof request.agent>, id: string) => a.get(`/api/v1/buyer/requests/${id}/history`);
  const createReq = (a: ReturnType<typeof request.agent>, body: Record<string, unknown>) => a.post("/api/v1/buyer/requests").send(body);
  const patchReq = (a: ReturnType<typeof request.agent>, id: string, body: Record<string, unknown>) => a.patch(`/api/v1/buyer/requests/${id}`).send(body);
  const submitReq = (a: ReturnType<typeof request.agent>, id: string, v: number) => a.post(`/api/v1/buyer/requests/${id}/submit`).send({ expectedVersion: v });
  const cancelReq = (a: ReturnType<typeof request.agent>, id: string, v: number) => a.post(`/api/v1/buyer/requests/${id}/cancel`).send({ expectedVersion: v });

  const dbCounts = async () => {
    const [products, tariffs, availability, leads, opps, quotes, sales, orders, bookings] = await prisma.$transaction([
      prisma.product.count(),
      prisma.tariff.count(),
      prisma.availability.count(),
      prisma.lead.count(),
      prisma.opportunity.count(),
      prisma.quote.count(),
      prisma.sale.count(),
      prisma.order.count(),
      prisma.booking.count(),
    ]);
    return { products, tariffs, availability, leads, opps, quotes, sales, orders, bookings };
  };

  const reverseTables = async (): Promise<string[]> => {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'reverse' ORDER BY table_name`,
    )) as Array<{ table_name: string }>;
    return rows.map((r) => r.table_name);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminAgent = await agent((await login("admin", "admin123")).accessToken);

    const catHotel = (await adminAgent.post("/api/v1/categories").send({ title: `BR Hotel ${stamp}`, slug: `br-hotel-${stamp}` }).expect(201)).body as { id: string };
    created.categories.push(catHotel.id);
    catHotelId = catHotel.id;
    const catTour = (await adminAgent.post("/api/v1/categories").send({ title: `BR Tour ${stamp}`, slug: `br-tour-${stamp}` }).expect(201)).body as { id: string };
    created.categories.push(catTour.id);
    catTourId = catTour.id;

    const buyerA = await registerBuyer("brqa");
    buyerAAgent = await agent(buyerA.accessToken);
    const buyerB = await registerBuyer("brqb");
    buyerBAgent = await agent(buyerB.accessToken);

    // PARTNER (approved) — не должен иметь доступа к Buyer Requests.
    const partnerReg = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/partner-register")
        .send({
          email: `brqp${stamp}@test.local`,
          password: "partnerpass123",
          firstName: "Ф",
          lastName: "Л",
          applicantType: "INDIVIDUAL",
          brandName: `BRQ Partner ${stamp}`,
          country: "AZ",
          contactEmail: `brqp${stamp}@test.local`,
          termsAccepted: true,
        })
        .expect(201)
    ).body as { user: { id: string } };
    created.users.push(partnerReg.user.id);
    const pAgent = agent((await login(`brqp${stamp}@test.local`, "partnerpass123")).accessToken);
    const appRow = (await pAgent.get("/api/v1/partner/application").expect(200)).body as { id: string };
    created.partners.push(appRow.id);
    await pAgent.post("/api/v1/partner/application/submit").expect(201);
    const queue = (await adminAgent.get("/api/v1/partner/onboarding/review").expect(200)).body as { items: Array<{ id: string }> };
    const appId = queue.items.find((x) => x.id === appRow.id)!.id;
    await adminAgent.post(`/api/v1/partner/onboarding/review/${appId}/start`).expect(201);
    const approved = (await adminAgent.post(`/api/v1/partner/onboarding/review/${appId}/approve`).send({ reason: "ok" }).expect(201)).body as { partnerId: string };
    created.partners.push(approved.partnerId);
    partnerAgent = await agent((await login(`brqp${stamp}@test.local`, "partnerpass123")).accessToken);
  });

  afterAll(async () => {
    await prisma.buyerRequest.deleteMany({ where: { buyerId: { in: created.customers } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    // Outbox-гигиена: CustomerCreated/PartnerCreated этих сущностей.
    await prisma.outboxEvent.deleteMany({
      where: { OR: [{ aggregateId: { in: created.customers } }, { aggregateId: { in: created.partners } }] },
    });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.auditLog.deleteMany({ where: { resource: "BuyerRequest" } });
    await app.close();
  });

  // ── Gates / RBAC ──────────────────────────────────────────────────────

  it("1/2. anonymous denied (401); PARTNER denied от Buyer own API (403)", async () => {
    await request(app.getHttpServer()).get("/api/v1/buyer/requests").expect(401);
    await request(app.getHttpServer()).post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(401);
    await partnerAgent.get("/api/v1/buyer/requests").expect(403);
    await partnerAgent.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(403);
  });

  it("2b. BUYER без Customer context (customerId=null) отклонён (403)", async () => {
    const buyerRole = await prisma.role.findUniqueOrThrow({ where: { code: RoleCode.BUYER } });
    const unmapped = await prisma.user.create({
      data: {
        code: `USR-UNMAPPED-${stamp}`,
        username: `brqunmapped${stamp}`,
        email: `brqunmapped${stamp}@test.local`,
        passwordHash: bcrypt.hashSync("buyerpass123", 10),
        roleId: buyerRole.id,
        status: "ACTIVE",
        fullName: "Без Маппинга",
        // customerId намеренно НЕ задан (сломанный/legacy state)
      },
    });
    created.users.push(unmapped.id);
    const s = (await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username: `brqunmapped${stamp}`, password: "buyerpass123" }).expect(200)).body as Session;
    const ua = agent(s.accessToken);
    await ua.get("/api/v1/buyer/requests").expect(403);
    await ua.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(403);
  });

  it("3. BUYER create → 201, BRQ-*, buyerId = own customerId, source BUYER_REQUEST, без Sales/Order/Product side effects", async () => {
    const before = await dbCounts();
    const res = await createReq(buyerAAgent, {
      categoryId: catHotelId,
      destinations: [{ countryCode: "TR" }, { countryCode: "TR", cityCode: "ANTALYA" }],
      serviceDateFrom: "2026-09-01",
      serviceDateTo: "2026-09-07",
      adults: 2,
      children: 1,
      budget: { currency: "USD", min: 100, max: 500 },
      preferences: { hotelCategory: "4*", mealPlan: "BB" },
    }).expect(201);
    const r = res.body as RequestView;
    created.requests.push(r.id);
    expect(r.code).toMatch(/^BRQ-\d{8}$/);
    expect(r.buyerId).toBe((await login("brqa" + stamp, "buyerpass123")).user.customerId);
    expect(r.acquisitionSource).toBe("BUYER_REQUEST");
    expect(r.status).toBe("DRAFT");
    expect(r.categorySlug).toBe(`br-hotel-${stamp}`);
    expect(r.destinations).toEqual([{ countryCode: "TR" }, { countryCode: "TR", cityCode: "ANTALYA" }]);
    expect(r.serviceDateFrom).toBe("2026-09-01T00:00:00.000Z");
    expect(r.serviceDateTo).toBe("2026-09-07T00:00:00.000Z");
    expect(r.adults).toBe(2);
    expect(r.budget).toEqual({ currency: "USD", min: 100, max: 500 });
    // НЕ создаются Product/Tariff/Availability/Lead/Opportunity/Quote/Sale/Order/Booking.
    const after = await dbCounts();
    expect(after).toEqual(before);
  });

  it("4/5/6. category ref validation (422); destination validation (422); request существует без Product", async () => {
    await createReq(buyerAAgent, { categoryId: "00000000-0000-0000-0000-000000000000", destinations: [{ countryCode: "TR" }] }).expect(422);
    await createReq(buyerAAgent, { categoryId: catHotelId, destinations: [{ countryCode: "tr" }] }).expect(422);
    // Zero-Product request легален: категория без единого Product.
    const r = (await createReq(buyerAAgent, { categoryId: catTourId, destinations: [{ countryCode: "GE" }] }).expect(201)).body as RequestView;
    created.requests.push(r.id);
    const products = await prisma.product.count({ where: { categoryId: catTourId } });
    expect(products).toBe(0);
  });

  it("7/8. list own + get own; deterministic pagination + total", async () => {
    const list = (await listReq(buyerAAgent).expect(200)).body as { items: RequestView[]; total: number };
    expect(list.total).toBe(2);
    expect(list.items.every((r) => r.buyerId === list.items[0].buyerId)).toBe(true);
    const page = (await listReq(buyerAAgent, "?limit=1&offset=0").expect(200)).body as { items: RequestView[]; total: number };
    expect(page.items.length).toBe(1);
    expect(page.total).toBe(2);
    const one = (await getReq(buyerAAgent, list.items[0].id).expect(200)).body as RequestView;
    expect(one.id).toBe(list.items[0].id);
  });

  it("9. cross-Buyer IDOR: A не читает request B (neutral 404); A не мутирует B", async () => {
    const bReq = (await createReq(buyerBAgent, { categoryId: catHotelId, destinations: [{ countryCode: "DE" }] }).expect(201)).body as RequestView;
    created.requests.push(bReq.id);
    await getReq(buyerAAgent, bReq.id).expect(404);
    await reqHistory(buyerAAgent, bReq.id).expect(404);
    await patchReq(buyerAAgent, bReq.id, { destinations: [{ countryCode: "FR" }], expectedVersion: 1 }).expect(404);
    await submitReq(buyerAAgent, bReq.id, 1).expect(404);
    await cancelReq(buyerAAgent, bReq.id, 1).expect(404);
  });

  it("10. forged buyerId/customerId/ownerId/source/version/temporal в create/PATCH → 422", async () => {
    await createReq(buyerAAgent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }], buyerId: "x" }).expect(422);
    await createReq(buyerAAgent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }], customerId: "x", ownerId: "x" }).expect(422);
    await createReq(buyerAAgent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }], acquisitionSource: "MARKETPLACE", status: "SUBMITTED", version: 9, code: "BRQ-99999999" }).expect(422);
    const own = (await listReq(buyerAAgent).expect(200)).body as { items: RequestView[] };
    const cap = own.items.find((r) => r.categoryId === catHotelId)!;
    await patchReq(buyerAAgent, cap.id, { destinations: [{ countryCode: "TR" }], expectedVersion: cap.version, status: "SUBMITTED", buyerId: "x" }).expect(422);
  });

  it("11. draft update: destinations/dates/pax/budget/preferences + categoryId (draft edit)", async () => {
    const own = (await listReq(buyerAAgent).expect(200)).body as { items: RequestView[] };
    const r = own.items.find((x) => x.categoryId === catTourId)!;
    const upd = (await patchReq(buyerAAgent, r.id, {
      destinations: [{ countryCode: "GE", cityCode: "TBILISI" }],
      serviceDateFrom: "2026-10-01",
      adults: 3,
      budget: { currency: "EUR", min: 50, max: 300 },
      expectedVersion: r.version,
    }).expect(200)).body as RequestView;
    expect(upd.destinations).toEqual([{ countryCode: "GE", cityCode: "TBILISI" }]);
    expect(upd.serviceDateFrom).toBe("2026-10-01T00:00:00.000Z");
    expect(upd.adults).toBe(3);
    expect(upd.children).toBe(0); // не передано — сохранено
    expect(upd.budget).toEqual({ currency: "EUR", min: 50, max: 300 });
    expect(upd.version).toBe(r.version + 1);
  });

  it("12/13. submit → SUBMITTED + submittedAt; submitted protected from edit (422)", async () => {
    const own = (await listReq(buyerAAgent).expect(200)).body as { items: RequestView[] };
    const r = own.items.find((x) => x.categoryId === catHotelId)!;
    const s = (await submitReq(buyerAAgent, r.id, r.version).expect(201)).body as RequestView;
    expect(s.status).toBe("SUBMITTED");
    expect(s.submittedAt).not.toBeNull();
    await patchReq(buyerAAgent, r.id, { destinations: [{ countryCode: "FR" }], expectedVersion: s.version }).expect(422);
  });

  it("14. cancel: DRAFT → CANCELLED + cancelledAt; SUBMITTED → CANCELLED; no-op при CANCELLED", async () => {
    const own = (await listReq(buyerAAgent).expect(200)).body as { items: RequestView[] };
    const draft = own.items.find((x) => x.categoryId === catTourId)!;
    const c = (await cancelReq(buyerAAgent, draft.id, draft.version).expect(201)).body as RequestView;
    expect(c.status).toBe("CANCELLED");
    expect(c.cancelledAt).not.toBeNull();
    const noop = (await cancelReq(buyerAAgent, draft.id, c.version).expect(201)).body as RequestView;
    expect(noop.version).toBe(c.version);
    const sub = own.items.find((x) => x.categoryId === catHotelId)!;
    const cs = (await cancelReq(buyerAAgent, sub.id, sub.version).expect(201)).body as RequestView;
    expect(cs.status).toBe("CANCELLED");
  });

  it("15. stale CAS → 409 (update/submit/cancel)", async () => {
    const r = (await createReq(buyerBAgent, { categoryId: catTourId, destinations: [{ countryCode: "GE" }] }).expect(201)).body as RequestView;
    created.requests.push(r.id);
    await patchReq(buyerBAgent, r.id, { destinations: [{ countryCode: "DE" }], expectedVersion: r.version + 100 }).expect(409);
    await submitReq(buyerBAgent, r.id, r.version + 100).expect(409);
    await cancelReq(buyerBAgent, r.id, r.version + 100).expect(409);
  });

  it("16/17/18. races: concurrent update; submit vs update; cancel vs submit — один победитель + финальное состояние", async () => {
    const one2xxOne409 = (statuses: number[]) => {
      expect(statuses.filter((s) => s >= 200 && s < 300)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(1);
    };

    // 16. update vs update: финал — version+1, ровно один из кандидатов, одна
    // history-запись "updated", один успешный audit.
    const r = (await createReq(buyerBAgent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as RequestView;
    created.requests.push(r.id);
    const v = r.version;
    const [u1, u2] = await Promise.all([
      patchReq(buyerBAgent, r.id, { destinations: [{ countryCode: "DE" }], expectedVersion: v }),
      patchReq(buyerBAgent, r.id, { destinations: [{ countryCode: "US" }], expectedVersion: v }),
    ]);
    one2xxOne409([u1.status, u2.status]);
    const fresh = (await getReq(buyerBAgent, r.id).expect(200)).body as RequestView;
    expect(fresh.version).toBe(v + 1);
    if (u1.status >= 200 && u1.status < 300) {
      expect(fresh.destinations).toEqual([{ countryCode: "DE" }] as never);
    } else {
      expect(fresh.destinations).toEqual([{ countryCode: "US" }] as never);
    }
    const h16 = (await reqHistory(buyerBAgent, r.id).expect(200)).body as { items: Array<{ action: string }> };
    expect(h16.items.filter((x) => x.action === "updated")).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { resource: "BuyerRequest", resourceId: r.id, action: "request.updated" } })).toBe(1);

    // 17. submit vs update: финал — status SUBMITTED (если submit победил) ИЛИ
    // DRAFT с обновлёнными destinations (если update победил); version+1 всегда.
    const r2 = (await createReq(buyerBAgent, { categoryId: catTourId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as RequestView;
    created.requests.push(r2.id);
    const [s1, s2] = await Promise.all([
      submitReq(buyerBAgent, r2.id, r2.version),
      patchReq(buyerBAgent, r2.id, { destinations: [{ countryCode: "DE" }], expectedVersion: r2.version }),
    ]);
    one2xxOne409([s1.status, s2.status]);
    const fresh2 = (await getReq(buyerBAgent, r2.id).expect(200)).body as RequestView;
    expect(fresh2.version).toBe(r2.version + 1);
    if (s1.status >= 200 && s1.status < 300) {
      expect(fresh2.status).toBe("SUBMITTED");
      expect(fresh2.submittedAt).not.toBeNull();
    } else {
      expect(fresh2.status).toBe("DRAFT");
      expect(fresh2.destinations).toEqual([{ countryCode: "DE" }] as never);
    }
    const h17 = (await reqHistory(buyerBAgent, r2.id).expect(200)).body as { items: Array<{ action: string }> };
    expect(h17.items.filter((x) => x.action === "submitted" || x.action === "updated")).toHaveLength(1);

    // 18. cancel vs submit: финал — CANCELLED (cancel победил) ИЛИ SUBMITTED
    // (submit победил); version+1; никакого противоречивого history.
    const r3 = (await createReq(buyerBAgent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as RequestView;
    created.requests.push(r3.id);
    const [c1, c2] = await Promise.all([
      cancelReq(buyerBAgent, r3.id, r3.version),
      submitReq(buyerBAgent, r3.id, r3.version),
    ]);
    one2xxOne409([c1.status, c2.status]);
    const fresh3 = (await getReq(buyerBAgent, r3.id).expect(200)).body as RequestView;
    expect(fresh3.version).toBe(r3.version + 1);
    if (c1.status >= 200 && c1.status < 300) {
      expect(fresh3.status).toBe("CANCELLED");
      expect(fresh3.cancelledAt).not.toBeNull();
    } else {
      expect(fresh3.status).toBe("SUBMITTED");
      expect(fresh3.submittedAt).not.toBeNull();
    }
    const h18 = (await reqHistory(buyerBAgent, r3.id).expect(200)).body as { items: Array<{ action: string }> };
    expect(h18.items.filter((x) => x.action === "cancelled" || x.action === "submitted")).toHaveLength(1);
  });

  it("16b. category change в DRAFT: categoryId + categorySlug обновляются атомарно (snapshot-консистентность)", async () => {
    const r = (await createReq(buyerBAgent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as RequestView;
    created.requests.push(r.id);
    const upd = (await patchReq(buyerBAgent, r.id, { categoryId: catTourId, expectedVersion: r.version }).expect(200)).body as RequestView;
    expect(upd.categoryId).toBe(catTourId);
    expect(upd.categorySlug).toBe(`br-tour-${stamp}`); // snapshot обновлён ВМЕСТЕ с categoryId
    expect(upd.version).toBe(r.version + 1);
    const hist = (await reqHistory(buyerBAgent, r.id).expect(200)).body as { items: Array<{ action: string; fields: { categoryId?: string } }> };
    expect(hist.items.find((x) => x.action === "updated")?.fields?.categoryId).toBe(catTourId);
  });

  it("19/20. history (created/updated/submitted/cancelled) + audit с actor, без PII", async () => {
    const own = (await listReq(buyerBAgent).expect(200)).body as { items: RequestView[] };
    const cancelled = own.items.find((x) => x.status === "CANCELLED" && x.categoryId === catHotelId);
    const r = cancelled ?? own.items[0];
    const h = (await reqHistory(buyerBAgent, r.id).expect(200)).body as { items: Array<{ action: string; actorId: string | null; fields: unknown }> };
    expect(h.items.some((x) => x.action === "created")).toBe(true);
    const audit = await prisma.auditLog.count({ where: { resource: "BuyerRequest", resourceId: r.id } });
    expect(audit).toBeGreaterThanOrEqual(1);
    // Никаких контактных полей в history/audit.
    const histJson = JSON.stringify(h.items);
    expect(histJson).not.toMatch(/email|phone|whatsapp|passport/i);
  });

  it("21. no Seller access: PARTNER не может прочитать Buyer Requests (403) — даже по id", async () => {
    const own = (await listReq(buyerBAgent).expect(200)).body as { items: RequestView[] };
    await partnerAgent.get(`/api/v1/buyer/requests/${own.items[0].id}`).expect(403);
  });

  it("22/23. reverse.* содержит только 2.2A+2.2B сущности (нет matching/Proposal)", async () => {
    const tables = await reverseTables();
    // Step 2.2C добавил BuyerRequestDistribution (легитимная эволюция).
    expect(tables).toEqual(["BuyerRequest", "BuyerRequestDistribution", "BuyerRequestHistory", "SellerCapability", "SellerCapabilityHistory"]);
  });

  it("24/25/26. создание request НЕ создаёт Sales/Order/Booking/Product entities", async () => {
    const before = await dbCounts();
    await createReq(buyerBAgent, { categoryId: catHotelId, destinations: [{ countryCode: "FR" }] }).expect(201);
    const after = await dbCounts();
    expect(after).toEqual(before);
  });

  it("27. PII: view не содержит контактов; preferences reject contact-ключи НА ЛЮБОЙ ГЛУБИНЕ", async () => {
    const own = (await listReq(buyerBAgent).expect(200)).body as { items: RequestView[] };
    const r = own.items[0];
    const viewJson = JSON.stringify(r);
    expect(viewJson).not.toMatch(/email|phone|whatsapp|telegram|passport|document/i);
    await createReq(buyerBAgent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }], preferences: { contactPhone: "123" } }).expect(422);
    // Nested bypass (top-level key "details" сам по себе безопасен):
    await createReq(buyerBAgent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }], preferences: { details: { phone: "+994501234567" } } }).expect(422);
    await createReq(buyerBAgent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }], preferences: { notes: { wa: "123" } } }).expect(422);
    await createReq(buyerBAgent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }], preferences: { list: [{ email: "a@b.c" }] } }).expect(422);
    await createReq(buyerBAgent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }], preferences: { mobile: "123", tel: "123", mail: "a@b", "e-mail": "a@b" } }).expect(422);
    // Легитимные travel-ключи НЕ блокируются (нет false positives):
    await createReq(buyerBAgent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }], preferences: { travelStyle: "leisure", hotelCategory: "4*", roomNumber: "101", contactlessCheckin: true, automobile: "compact" } }).expect(201);
  });

  it("28. BUYER_REQUEST source server-owned: forged → 422; persisted всегда BUYER_REQUEST", async () => {
    const r = (await createReq(buyerBAgent, { categoryId: catTourId, destinations: [{ countryCode: "DE" }] }).expect(201)).body as RequestView;
    created.requests.push(r.id);
    expect(r.acquisitionSource).toBe("BUYER_REQUEST");
    const all = (await listReq(buyerBAgent, "?limit=100").expect(200)).body as { items: RequestView[] };
    expect(all.items.every((x) => x.acquisitionSource === "BUYER_REQUEST")).toBe(true);
  });

  it("28b. lifecycle-команды принимают ТОЛЬКО expectedVersion: forged demand/status/ownership → 422", async () => {
    const r = (await createReq(buyerBAgent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as RequestView;
    created.requests.push(r.id);
    await submitReq(buyerBAgent, r.id, r.version).expect(201);
    const r2 = (await createReq(buyerBAgent, { categoryId: catTourId, destinations: [{ countryCode: "DE" }] }).expect(201)).body as RequestView;
    created.requests.push(r2.id);
    await submitReq(buyerBAgent, r2.id, r2.version + 50).expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/buyer/requests/${r2.id}/submit`)
      .set("Authorization", `Bearer ${(await login(`brqb${stamp}`, "buyerpass123")).accessToken}`)
      .send({ expectedVersion: r2.version, status: "CANCELLED", buyerId: "x", destinations: [{ countryCode: "US" }], acquisitionSource: "MARKETPLACE" })
      .expect(422);
    await request(app.getHttpServer())
      .post(`/api/v1/buyer/requests/${r2.id}/cancel`)
      .set("Authorization", `Bearer ${(await login(`brqb${stamp}`, "buyerpass123")).accessToken}`)
      .send({ expectedVersion: r2.version, submittedAt: "2026-01-01T00:00:00.000Z", status: "SUBMITTED" })
      .expect(422);
    const fresh = (await getReq(buyerBAgent, r2.id).expect(200)).body as RequestView;
    expect(fresh.status).toBe("DRAFT"); // forged lifecycle не прошёл
    expect(fresh.acquisitionSource).toBe("BUYER_REQUEST");
  });

  it("29. failure atomicity: stale CAS не оставляет history/audit/версию", async () => {
    const r = (await createReq(buyerBAgent, { categoryId: catTourId, destinations: [{ countryCode: "GE" }] }).expect(201)).body as RequestView;
    created.requests.push(r.id);
    const hBefore = await prisma.buyerRequestHistory.count({ where: { requestId: r.id } });
    const aBefore = await prisma.auditLog.count({ where: { resource: "BuyerRequest", resourceId: r.id } });
    await patchReq(buyerBAgent, r.id, { destinations: [{ countryCode: "FR" }], expectedVersion: r.version + 50 }).expect(409);
    expect(await prisma.buyerRequestHistory.count({ where: { requestId: r.id } })).toBe(hBefore);
    expect(await prisma.auditLog.count({ where: { resource: "BuyerRequest", resourceId: r.id } })).toBe(aBefore);
    const fresh = (await getReq(buyerBAgent, r.id).expect(200)).body as RequestView;
    expect(fresh.version).toBe(r.version);
    expect(fresh.destinations).toEqual([{ countryCode: "GE" }]);
  });

  it("30. pagination/determinism: детерминированный порядок (createdAt desc, id desc)", async () => {
    const all = (await listReq(buyerBAgent, "?limit=100").expect(200)).body as { items: RequestView[] };
    const sorted = [...all.items].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1,
    );
    expect(all.items.map((x) => x.id)).toEqual(sorted.map((x) => x.id));
  });
});
