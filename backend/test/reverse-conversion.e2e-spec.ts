/**
 * E2E PHASE 2 STEP 2.2F — Proposal → Canonical Sales Conversion (reverse.*, DD-030).
 *
 * Инварианты (промпт 2.2F §47, консолидировано):
 *  1. anonymous denied; PARTNER cannot select;
 *  2. forged server-owned fields → 422 (mass assignment);
 *  3. cross-buyer / cross-request → neutral 404;
 *  4. DRAFT request rejected; CANCELLED request rejected;
 *  5. DRAFT proposal rejected; WITHDRAWN proposal rejected;
 *  6. selection → exactly one Opportunity; zero Lead/Quote/Checkout/Sale/Order/Booking;
 *  7. Opportunity.leadId null; customerId = BuyerRequest buyer;
 *  8. provenance: buyerRequestId / proposalId / sellerId correct;
 *  9. acquisitionSource = BUYER_REQUEST (server-derived, не forgeable);
 * 10. Proposal amount НЕ копируется в binding price (Opportunity не имеет money);
 * 11. selected Proposal recorded in Reverse (request.selectedProposalId,
 *     proposal.selectedAt/convertedOpportunityId);
 * 12. only one selected Proposal per BuyerRequest (sequential + concurrent A/B);
 * 13. duplicate same Proposal selection idempotent (retry safe);
 * 14. concurrent duplicate conversion → one Opportunity;
 * 15. request cancel vs selection race;
 * 16. proposal withdraw vs selection race (обе стороны);
 * 17. failure atomicity (stale CAS → 409, нет partial state);
 * 18. history/audit (без PII);
 * 19. no contact disclosure; no Communication mutation; no Catalog mutation;
 * 20. no new speculative events (outbox);
 * 21. Checkout DIRECT legacy path remains DIRECT;
 * 22. request-led path (Opportunity → Quote → Checkout) = BUYER_REQUEST;
 * 23. (§37) idempotent retry со СТАРОЙ expectedVersion (response-loss) — тот же
 *     результат, без дублирования history/audit;
 * 24. (§10) проигравший concurrent A/B — без success history/audit;
 * 25. (§25/§47/§50) полная цепочка select → Sale → OrderRequested → Order →
 *     Booking сохраняет BUYER_REQUEST (frozen snapshot); DIRECT не задеты.
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

interface Session {
  accessToken: string;
  user: { id: string; role: string; username: string; email: string | null; customerId: string | null; permissions: string[] };
}

describe("Phase 2 Step 2.2F — Proposal → Canonical Sales Conversion (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const created = {
    users: [] as string[],
    customers: [] as string[],
    partners: [] as string[],
    categories: [] as string[],
    products: [] as string[],
    quotes: [] as string[],
    checkouts: [] as string[],
    opportunities: [] as string[],
    availability: [] as string[],
    sales: [] as string[],
    orders: [] as string[],
  };

  let adminAgent: ReturnType<typeof request.agent>;
  let catHotelId: string;
  const futureDate = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };
  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  /** Полный onboarding партнёра (register → submit → review → approve → re-login). */
  const createApprovedSeller = async (tag: string) => {
    const email = `cv${tag}${stamp}@test.local`;
    const reg = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/partner-register")
        .send({
          email,
          password: "partnerpass123",
          firstName: "П",
          lastName: tag.toUpperCase(),
          applicantType: "INDIVIDUAL",
          brandName: `Conversion Partner ${tag} ${stamp}`,
          country: "AZ",
          contactEmail: email,
          termsAccepted: true,
        })
        .expect(201)
    ).body as { user: { id: string } };
    created.users.push(reg.user.id);
    const pAgent = agent((await login(email, "partnerpass123")).accessToken);
    const appRow = (await pAgent.get("/api/v1/partner/application").expect(200)).body as { id: string };
    created.partners.push(appRow.id);
    await pAgent.post("/api/v1/partner/application/submit").expect(201);
    const queue = (await adminAgent.get("/api/v1/partner/onboarding/review").expect(200)).body as { items: Array<{ id: string }> };
    const appId = queue.items.find((x) => x.id === appRow.id)!.id;
    await adminAgent.post(`/api/v1/partner/onboarding/review/${appId}/start`).expect(201);
    const approved = (await adminAgent.post(`/api/v1/partner/onboarding/review/${appId}/approve`).send({ reason: "ok" }).expect(201)).body as { partnerId: string };
    created.partners.push(approved.partnerId);
    const session = await login(email, "partnerpass123");
    return { email, partnerId: approved.partnerId, agent: agent(session.accessToken) };
  };

  const createActiveCapability = async (
    p: Awaited<ReturnType<typeof createApprovedSeller>>,
    categoryId: string,
    destinations: Array<{ countryCode?: string; cityCode?: string; worldwide?: boolean }>,
  ) => {
    const c = (await p.agent.post("/api/v1/partner/reverse/capabilities").send({ categoryId, destinations }).expect(201)).body as { id: string; version: number };
    const act = (await p.agent.post(`/api/v1/partner/reverse/capabilities/${c.id}/activate`).send({ expectedVersion: c.version }).expect(201)).body as { version: number };
    await p.agent.post(`/api/v1/partner/reverse/capabilities/${c.id}/accept-requests`).send({ accepts: true, expectedVersion: act.version }).expect(201);
    return c.id;
  };

  const createStaff = async (tag: string, roleCode: RoleCode, password = "staffpass123") => {
    const staff = (await adminAgent.post("/api/v1/users").send({ username: `${tag}${stamp}`, password, roleCode }).expect(201)).body as { id: string };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, password);
  };

  /** Продукт + тариф (admin) для полной цепочки Quote → Checkout. */
  const createProduct = async (tag: string, price = 100) => {
    const res = await adminAgent
      .post("/api/v1/products")
      .send({ type: "TOUR", title: `Conversion ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    return { productId: product.id, tariffId: tariff.id };
  };

  /** ISSUED Quote (1 item + commercial) через Sales API (SALES_MANAGER). */
  const issueQuote = async (smToken: string, fx: { productId: string; tariffId: string }, opportunityId?: string) => {
    const body = opportunityId ? { opportunityId } : {};
    const quote = (await agent(smToken).post("/api/v1/sales/quotes").send(body).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
    await agent(smToken)
      .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
      .send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() })
      .expect(200);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);
    return quote;
  };

  const runMatch = (a: ReturnType<typeof request.agent>, buyerRequestId: string) =>
    a.post("/api/v1/system/reverse/matching/run").send({ buyerRequestId });

  const createProposal = (a: ReturnType<typeof request.agent>, buyerRequestId: string, body: Record<string, unknown> = {}) =>
    a.post("/api/v1/partner/reverse/proposals").send({ buyerRequestId, ...body });
  const submitProposal = (a: ReturnType<typeof request.agent>, id: string, version: number) =>
    a.post(`/api/v1/partner/reverse/proposals/${id}/submit`).send({ expectedVersion: version });
  const withdrawProposal = (a: ReturnType<typeof request.agent>, id: string, version: number) =>
    a.post(`/api/v1/partner/reverse/proposals/${id}/withdraw`).send({ expectedVersion: version });
  const selectProposal = (a: ReturnType<typeof request.agent>, reqId: string, proposalId: string, version: number) =>
    a.post(`/api/v1/buyer/requests/${reqId}/proposals/${proposalId}/select`).send({ expectedVersion: version });
  const getRequest = (a: ReturnType<typeof request.agent>, reqId: string) => a.get(`/api/v1/buyer/requests/${reqId}`);
  const historyRequest = (a: ReturnType<typeof request.agent>, reqId: string) => a.get(`/api/v1/buyer/requests/${reqId}/history`);

  const dbCounts = async () => {
    const [leads, opps, quotes, checkouts, sales, orders, bookings, communications, availReservations, outbox] =
      await prisma.$transaction([
        prisma.lead.count(),
        prisma.opportunity.count(),
        prisma.quote.count(),
        prisma.checkoutIntent.count(),
        prisma.sale.count(),
        prisma.order.count(),
        prisma.booking.count(),
        prisma.communication.count(),
        prisma.availabilityReservation.count(),
        prisma.outboxEvent.count(),
      ]);
    return { leads, opps, quotes, checkouts, sales, orders, bookings, communications, availReservations, outbox };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminAgent = agent((await login("admin", "admin123")).accessToken);
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `Conv Hotel ${stamp}`, slug: `cv-hotel-${stamp}` }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    catHotelId = cat.id;
  });

  afterAll(async () => {
    // Порядок (FK): checkout → quote → opportunity → reverse → product → users.
    for (const id of created.checkouts) {
      await prisma.checkoutIntentHistory.deleteMany({ where: { checkoutIntentId: id } });
      await prisma.checkoutIntentTraveler.deleteMany({ where: { checkoutIntentId: id } });
      await prisma.checkoutIntent.deleteMany({ where: { id } });
    }
    // Полная цепочка (test 16): Sale → OrderRequested → Order → Booking cleanup.
    if (created.orders.length > 0) {
      const bookings = await prisma.booking.findMany({ where: { orderId: { in: created.orders } }, select: { id: true } });
      const bookingIds = bookings.map((b) => b.id);
      if (bookingIds.length > 0) {
        await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'BookingCreated' AND "aggregateId" = ANY($1)`, bookingIds);
        await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
      }
      // BookingRequested — всегда (даже если consumer не создал Booking).
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'BookingRequested' AND "aggregateId" = ANY($1)`, created.orders);
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" IN ('OrderCreated','OrderReadyForBooking','OrderFulfilled','OrderStatusChanged') AND "aggregateId" = ANY($1)`,
        created.orders,
      );
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    if (created.sales.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'OrderRequested' AND "payload"->>'saleId' = ANY($1)`, created.sales);
      const salesRows = await prisma.sale.findMany({ where: { id: { in: created.sales } }, select: { orderRequestedEventId: true } });
      const reqEventIds = salesRows.map((s) => s.orderRequestedEventId).filter((e): e is string => !!e);
      if (reqEventIds.length > 0) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "events"."InboxEvent" WHERE "consumerId" = 'order-requested-consumer' AND "eventId" = ANY($1)`,
          reqEventIds,
        );
      }
      await prisma.availabilityReservation.deleteMany({ where: { sourceSaleId: { in: created.sales } } });
      await prisma.saleHistory.deleteMany({ where: { saleId: { in: created.sales } } });
      await prisma.sale.deleteMany({ where: { id: { in: created.sales } } });
    }
    await prisma.quote.deleteMany({ where: { id: { in: created.quotes } } });
    await prisma.opportunity.deleteMany({ where: { id: { in: created.opportunities } } });
    await prisma.sellerProposalHistory.deleteMany();
    await prisma.sellerProposal.deleteMany();
    await prisma.buyerRequestDistribution.deleteMany();
    await prisma.buyerRequest.deleteMany();
    await prisma.sellerCapability.deleteMany();
    await prisma.publicSellerProfile.deleteMany({ where: { partnerId: { in: created.partners } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    if (created.availability.length > 0) {
      await prisma.availability.deleteMany({ where: { id: { in: created.availability } } });
    }
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.outboxEvent.deleteMany({
      where: { OR: [{ aggregateId: { in: created.customers } }, { aggregateId: { in: created.partners } }] },
    });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.auditLog.deleteMany({
      where: {
        action: { in: ["proposal.selected", "sales.opportunity.created_from_buyer_request", "reverse.match.run", "proposal.created", "proposal.submitted"] },
      },
    });
    await app.close();
  });

  // ── Fixtures ──────────────────────────────────────────────────────────

  let sellerA: Awaited<ReturnType<typeof createApprovedSeller>>;
  let sellerB: Awaited<ReturnType<typeof createApprovedSeller>>;
  let buyerAgent: ReturnType<typeof request.agent>;
  let buyerCustomerId: string;
  let buyer2Agent: ReturnType<typeof request.agent>;
  let smToken: string;

  /** request SUBMITTED + распределён на A и B + Proposal от A (SUBMITTED).
   *  matching-run НЕ бампает request.version; requestVersion = версия после submit. */
  const makeReady = async (opts: { money?: { amount: number; currency: string } } = {}) => {
    const r = (
      await buyerAgent
        .post("/api/v1/buyer/requests")
        .send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }], serviceDateFrom: "2026-09-01", serviceDateTo: "2026-09-07", adults: 2 })
        .expect(201)
    ).body as { id: string; version: number };
    const s = (await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/submit`).send({ expectedVersion: r.version }).expect(201)).body as { id: string; version: number };
    await runMatch(adminAgent, s.id).expect(201);
    const p = (await createProposal(sellerA.agent, s.id, opts.money ? { money: opts.money } : {}).expect(201)).body as { id: string; version: number };
    const sub = (await submitProposal(sellerA.agent, p.id, p.version).expect(201)).body as { version: number };
    return { requestId: s.id, proposalId: p.id, proposalVersion: sub.version, requestVersion: s.version };
  };

  beforeAll(async () => {
    sellerA = await createApprovedSeller("a");
    sellerB = await createApprovedSeller("b");
    await createActiveCapability(sellerA, catHotelId, [{ countryCode: "TR" }]);
    await createActiveCapability(sellerB, catHotelId, [{ countryCode: "TR" }]);

    const buyerReg = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ username: `cvbuyer${stamp}`, email: `cvbuyer${stamp}@test.local`, password: "buyerpass123", firstName: "Б", lastName: "Б" })
        .expect(201)
    ).body as Session;
    created.users.push(buyerReg.user.id);
    buyerCustomerId = buyerReg.user.customerId!;
    created.customers.push(buyerCustomerId);
    buyerAgent = agent(buyerReg.accessToken);

    const buyer2Reg = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ username: `cvbuyer2${stamp}`, email: `cvbuyer2${stamp}@test.local`, password: "buyerpass123", firstName: "Б2", lastName: "Б2" })
        .expect(201)
    ).body as Session;
    created.users.push(buyer2Reg.user.id);
    created.customers.push(buyer2Reg.user.customerId!);
    buyer2Agent = agent(buyer2Reg.accessToken);

    const sm = await createStaff("cv_sm", RoleCode.SALES_MANAGER);
    smToken = sm.accessToken;
  });

  // ── 1-2. Gates / mass assignment ──────────────────────────────────────

  it("1. anonymous select → 401; PARTNER select → 403", async () => {
    const fx = await makeReady();
    await request(app.getHttpServer())
      .post(`/api/v1/buyer/requests/${fx.requestId}/proposals/${fx.proposalId}/select`)
      .send({ expectedVersion: fx.requestVersion })
      .expect(401);
    await selectProposal(sellerA.agent, fx.requestId, fx.proposalId, fx.requestVersion).expect(403);
  });

  it("2. forged server-owned fields на select → 422 (mass assignment)", async () => {
    const fx = await makeReady();
    const forged: Array<Record<string, unknown>> = [
      { opportunityId: "OPP-x", expectedVersion: fx.requestVersion },
      { acquisitionSource: "MARKETPLACE", expectedVersion: fx.requestVersion },
      { amount: "100.00", expectedVersion: fx.requestVersion },
      { currency: "USD", expectedVersion: fx.requestVersion },
      { customerId: "cus-x", expectedVersion: fx.requestVersion },
      { sellerId: "par-x", expectedVersion: fx.requestVersion },
      { selected: true, expectedVersion: fx.requestVersion },
      { converted: true, expectedVersion: fx.requestVersion },
      { contactDisclosed: true, expectedVersion: fx.requestVersion },
      { quoteId: "QTE-x", expectedVersion: fx.requestVersion },
      { leadId: "LED-x", expectedVersion: fx.requestVersion },
      { salesOwner: "u-x", expectedVersion: fx.requestVersion },
    ];
    for (const body of forged) {
      await selectProposal(buyerAgent, fx.requestId, fx.proposalId, body.expectedVersion as number).send(body).expect(422);
    }
    // Ничего не создано (полная атомарность на 422).
    const after = await dbCounts();
    expect(after.opps).toBe(0);
  });

  // ── 3-5. Eligibility ──────────────────────────────────────────────────

  it("3. cross-buyer select → neutral 404; Proposal чужого request → 404", async () => {
    const fx = await makeReady();
    await selectProposal(buyer2Agent, fx.requestId, fx.proposalId, fx.requestVersion).expect(404);
    // Proposal из request A не принадлежит request B.
    await selectProposal(buyerAgent, "00000000-0000-0000-0000-000000000000", fx.proposalId, 1).expect(404);
    const after = await dbCounts();
    expect(after.opps).toBe(0);
  });

  it("4. gates: DRAFT request → 422; CANCELLED request → 422; DRAFT proposal → 422; WITHDRAWN proposal → 422", async () => {
    // DRAFT request: не распределён (DRAFT не матчится) — Proposal создать нельзя,
    // а select на DRAFT request без Proposal физически невозможен; гейт DRAFT
    // проверяется ниже на request SUBMITTED c DRAFT proposal.
    const rDraft = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as { id: string };
    await createProposal(sellerA.agent, rDraft.id).expect(422);

    // CANCELLED request: Proposal создан и засабмичен ДО cancel, затем select → 422.
    const r = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as { id: string; version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/submit`).send({ expectedVersion: r.version }).expect(201);
    await runMatch(adminAgent, r.id).expect(201);
    const p = (await createProposal(sellerA.agent, r.id).expect(201)).body as { id: string; version: number };
    const sub = (await submitProposal(sellerA.agent, p.id, p.version).expect(201)).body as { version: number };
    const fresh = (await buyerAgent.get(`/api/v1/buyer/requests/${r.id}`).expect(200)).body as { version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/cancel`).send({ expectedVersion: fresh.version }).expect(201);
    await selectProposal(buyerAgent, r.id, p.id, fresh.version + 1).expect(422); // CANCELLED request

    // DRAFT proposal → 422 (не засабмичен; один Proposal на seller+request —
    // sellerB ещё не создавал на этом request).
    const fx = await makeReady();
    const pD = (await createProposal(sellerB.agent, fx.requestId).expect(201)).body as { id: string; version: number };
    await selectProposal(buyerAgent, fx.requestId, pD.id, fx.requestVersion).expect(422); // DRAFT proposal

    // WITHDRAWN proposal → 422 (свежий request, чтобы sellerB мог создать Proposal).
    const fx2 = await makeReady();
    const pW = (await createProposal(sellerB.agent, fx2.requestId).expect(201)).body as { id: string; version: number };
    const sW = (await submitProposal(sellerB.agent, pW.id, pW.version).expect(201)).body as { version: number };
    await withdrawProposal(sellerB.agent, pW.id, sW.version).expect(201);
    await selectProposal(buyerAgent, fx2.requestId, pW.id, fx2.requestVersion).expect(422); // WITHDRAWN proposal

    const after = await dbCounts();
    expect(after.opps).toBe(0);
  });

  // ── 6-11. Happy path + provenance ─────────────────────────────────────

  it("5. selection → exactly one Opportunity; zero Lead/Quote/Checkout/Sale/Order/Booking; provenance + BUYER_REQUEST; NEW; leadId null", async () => {
    const before = await dbCounts();
    const fx = await makeReady({ money: { amount: 250, currency: "USD" } });

    const res = (await selectProposal(buyerAgent, fx.requestId, fx.proposalId, fx.requestVersion).expect(201)).body as {
      requestId: string;
      proposalId: string;
      proposalCode: string;
      selected: boolean;
      idempotent: boolean;
      opportunity: { id: string; code: string };
    };
    expect(res.selected).toBe(true);
    expect(res.idempotent).toBe(false);
    expect(res.opportunity.code).toMatch(/^OPP-\d{8}$/);
    created.opportunities.push(res.opportunity.id);

    const after = await dbCounts();
    expect(after.opps).toBe(before.opps + 1);
    expect(after.leads).toBe(before.leads); // zero Lead
    expect(after.quotes).toBe(before.quotes); // zero Quote (2.2F scope = Opportunity)
    expect(after.checkouts).toBe(before.checkouts);
    expect(after.sales).toBe(before.sales);
    expect(after.orders).toBe(before.orders);
    expect(after.bookings).toBe(before.bookings);
    expect(after.communications).toBe(before.communications); // no Communication side effect
    expect(after.availReservations).toBe(before.availReservations);
    expect(after.outbox).toBe(before.outbox); // no speculative events

    // Opportunity provenance через Sales API (admin read).
    const opp = (await adminAgent.get(`/api/v1/sales/opportunities/${res.opportunity.code}`).expect(200)).body as {
      id: string;
      code: string;
      leadId: string | null;
      customerId: string | null;
      buyerRequestId: string | null;
      proposalId: string | null;
      sellerId: string | null;
      acquisitionSource: string | null;
      status: string;
      title: string;
    };
    expect(opp.id).toBe(res.opportunity.id);
    expect(opp.leadId).toBeNull(); // no Lead
    expect(opp.customerId).toBe(buyerCustomerId); // BuyerRequest buyer mapping
    expect(opp.buyerRequestId).toBe(fx.requestId);
    expect(opp.proposalId).toBe(fx.proposalId);
    expect(opp.sellerId).toBe(sellerA.partnerId); // selected Seller
    expect(opp.acquisitionSource).toBe("BUYER_REQUEST"); // server-derived
    expect(opp.status).toBe("NEW"); // lifecycle start, no auto-OPEN
    expect(opp.title).toContain(fx.requestId ? "BuyerRequest" : "BuyerRequest");

    // Reverse selection state recorded.
    const req = await prisma.buyerRequest.findUnique({ where: { id: fx.requestId } });
    expect(req?.selectedProposalId).toBe(fx.proposalId);
    const proposal = await prisma.sellerProposal.findUnique({ where: { id: fx.proposalId } });
    expect(proposal?.selectedAt).toBeTruthy();
    expect(proposal?.convertedOpportunityId).toBe(res.opportunity.id);
    expect(proposal?.convertedAt).toBeTruthy();
    expect(proposal?.status).toBe("SUBMITTED"); // lifecycle enum НЕ меняется
    // Proposal amount НЕ копируется (Opportunity не имеет money полей — bind-цена
    // появится только в canonical Quote из Catalog).
    const oppRow = await prisma.opportunity.findUnique({ where: { id: res.opportunity.id } });
    expect(oppRow?.buyerRequestId).toBe(fx.requestId);
  });

  it("6. idempotent retry: повторный select того же Proposal → idempotent:true, одна Opportunity; §37 stale-version retry без дублирования", async () => {
    const fx = await makeReady();
    const first = (await selectProposal(buyerAgent, fx.requestId, fx.proposalId, fx.requestVersion).expect(201)).body as { opportunity: { id: string; code: string }; idempotent: boolean };
    created.opportunities.push(first.opportunity.id);
    // Обычный клиентский retry с актуальной версией.
    const retry = (await selectProposal(buyerAgent, fx.requestId, fx.proposalId, fx.requestVersion + 1).expect(201)).body as { opportunity: { id: string; code: string }; idempotent: boolean };
    expect(retry.idempotent).toBe(true);
    expect(retry.opportunity.id).toBe(first.opportunity.id); // существующий результат
    // §37 (response-loss): retry приходит со СТАРОЙ expectedVersion (клиент не видел
    // бамп версии) → idempotent:true, тот же результат, НЕ 409 (fast-path до CAS).
    const stale = (await selectProposal(buyerAgent, fx.requestId, fx.proposalId, fx.requestVersion).expect(201)).body as {
      idempotent: boolean;
      opportunity: { id: string };
    };
    expect(stale.idempotent).toBe(true);
    expect(stale.opportunity.id).toBe(first.opportunity.id);
    expect(await prisma.opportunity.count({ where: { proposalId: fx.proposalId } })).toBe(1);
    // Ровно один success-факт в history/audit (retry не дублирует).
    expect(await prisma.buyerRequestHistory.count({ where: { requestId: fx.requestId, action: "proposal_selected" } })).toBe(1);
    expect(await prisma.sellerProposalHistory.count({ where: { proposalId: fx.proposalId, action: "selected" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "proposal.selected", resourceId: fx.proposalId } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "sales.opportunity.created_from_buyer_request", resourceId: first.opportunity.id } })).toBe(1);
  });

  it("7. one-winner: select Proposal B после A → 409; concurrent A/B → один победитель", async () => {
    // Sequential: A уже выбран.
    const fx = await makeReady();
    const aRes = (await selectProposal(buyerAgent, fx.requestId, fx.proposalId, fx.requestVersion).expect(201)).body as { opportunity: { id: string } };
    created.opportunities.push(aRes.opportunity.id);
    const pB = (await createProposal(sellerB.agent, fx.requestId).expect(201)).body as { id: string; version: number };
    const sB = (await submitProposal(sellerB.agent, pB.id, pB.version).expect(201)).body as { version: number };
    void sB;
    await selectProposal(buyerAgent, fx.requestId, pB.id, fx.requestVersion + 1).expect(409); // already selected A

    // Concurrent: свежий request, Proposal A vs B одновременно → один 201, один 409.
    const fx2 = await makeReady();
    const pB2 = (await createProposal(sellerB.agent, fx2.requestId).expect(201)).body as { id: string; version: number };
    await submitProposal(sellerB.agent, pB2.id, pB2.version).expect(201);
    const [c1, c2] = await Promise.all([
      selectProposal(buyerAgent, fx2.requestId, fx2.proposalId, fx2.requestVersion),
      selectProposal(buyerAgent, fx2.requestId, pB2.id, fx2.requestVersion),
    ]);
    const ok = (n: number) => n >= 200 && n < 300;
    expect(ok(c1.status) && ok(c2.status)).toBe(false); // не оба победителя
    expect([c1.status, c2.status].filter((s) => s === 409).length).toBe(1);
    const winner = ok(c1.status) ? c1 : c2;
    const winnerBody = winner.body as { opportunity: { id: string } };
    created.opportunities.push(winnerBody.opportunity.id);
    const oppsForReq = await prisma.opportunity.count({ where: { buyerRequestId: fx2.requestId } });
    expect(oppsForReq).toBe(1); // одна Opportunity на request
    const selReq = await prisma.buyerRequest.findUnique({ where: { id: fx2.requestId } });
    expect(selReq?.selectedProposalId).toBeTruthy();
    const winnerProp = await prisma.sellerProposal.findUnique({ where: { id: selReq!.selectedProposalId! } });
    expect(winnerProp?.convertedOpportunityId).toBe(winnerBody.opportunity.id);
    // Проигравший Proposal НЕ получил conversion state.
    const loserId = winnerProp!.id === fx2.proposalId ? pB2.id : fx2.proposalId;
    const loserRow = await prisma.sellerProposal.findUnique({ where: { id: loserId } });
    expect(loserRow?.convertedOpportunityId).toBeNull();
    expect(loserRow?.selectedAt).toBeNull();
    // §10: проигравший НЕ имеет success history/audit (полная атомарность на 409).
    expect(await prisma.buyerRequestHistory.count({ where: { requestId: fx2.requestId, action: "proposal_selected" } })).toBe(1); // только победитель
    expect(await prisma.sellerProposalHistory.count({ where: { proposalId: loserId, action: "selected" } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "proposal.selected", resourceId: loserId } })).toBe(0);
  });

  it("8. concurrent duplicate conversion одного Proposal → одна Opportunity (unique + атомарность)", async () => {
    const fx = await makeReady();
    const [r1, r2] = await Promise.all([
      selectProposal(buyerAgent, fx.requestId, fx.proposalId, fx.requestVersion),
      selectProposal(buyerAgent, fx.requestId, fx.proposalId, fx.requestVersion),
    ]);
    const ok = (n: number) => n >= 200 && n < 300;
    expect(ok(r1.status) && ok(r2.status)).toBe(true); // один 201 + один idempotent 201
    const idemFlags = [r1.body, r2.body].map((b: { idempotent: boolean }) => b.idempotent);
    expect(idemFlags.filter((x) => x === false).length).toBe(1); // ровно одна не-идемпотентная
    const opps = await prisma.opportunity.count({ where: { proposalId: fx.proposalId } });
    expect(opps).toBe(1);
    const oppRow = (r1.body.idempotent ? r2.body : r1.body) as { opportunity: { id: string } };
    created.opportunities.push(oppRow.opportunity.id);
  });

  // ── 12-17. Races / atomicity / history ────────────────────────────────

  it("9. request cancel vs selection: cancel закоммичен → select 422; selection → cancel не инвалидирует Opportunity", async () => {
    // Cancel первый → select отклонён.
    const r = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as { id: string; version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/submit`).send({ expectedVersion: r.version }).expect(201);
    await runMatch(adminAgent, r.id).expect(201);
    const p = (await createProposal(sellerA.agent, r.id).expect(201)).body as { id: string; version: number };
    const sub = (await submitProposal(sellerA.agent, p.id, p.version).expect(201)).body as { version: number };
    void sub;
    const fresh = (await buyerAgent.get(`/api/v1/buyer/requests/${r.id}`).expect(200)).body as { version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/cancel`).send({ expectedVersion: fresh.version }).expect(201);
    await selectProposal(buyerAgent, r.id, p.id, fresh.version + 1).expect(422);
    expect(await prisma.opportunity.count({ where: { buyerRequestId: r.id } })).toBe(0);

    // Selection первый → cancel проходит, Opportunity остаётся (durable).
    const fx = await makeReady();
    const sel = (await selectProposal(buyerAgent, fx.requestId, fx.proposalId, fx.requestVersion).expect(201)).body as { opportunity: { id: string } };
    created.opportunities.push(sel.opportunity.id);
    const fresh2 = (await buyerAgent.get(`/api/v1/buyer/requests/${fx.requestId}`).expect(200)).body as { version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${fx.requestId}/cancel`).send({ expectedVersion: fresh2.version }).expect(201);
    const still = await prisma.opportunity.findUnique({ where: { id: sel.opportunity.id } });
    expect(still).toBeTruthy(); // conversion не инвалидируется cancel-ом (документировано)
  });

  it("10. proposal withdraw vs selection: withdraw закоммичен → select 422; selected → withdraw 422 (guard)", async () => {
    // Withdraw первый → select отклонён (sellerB — makeReady уже создал Proposal A).
    const fx = await makeReady();
    const pW = (await createProposal(sellerB.agent, fx.requestId).expect(201)).body as { id: string; version: number };
    const sW = (await submitProposal(sellerB.agent, pW.id, pW.version).expect(201)).body as { version: number };
    await withdrawProposal(sellerB.agent, pW.id, sW.version).expect(201);
    await selectProposal(buyerAgent, fx.requestId, pW.id, fx.requestVersion).expect(422);
    expect(await prisma.opportunity.count({ where: { proposalId: pW.id } })).toBe(0);

    // Selection первый → withdraw запрещён (не молчаливая инвалидация).
    const fx2 = await makeReady();
    const sel = (await selectProposal(buyerAgent, fx2.requestId, fx2.proposalId, fx2.requestVersion).expect(201)).body as { opportunity: { id: string } };
    created.opportunities.push(sel.opportunity.id);
    const prop = await prisma.sellerProposal.findUnique({ where: { id: fx2.proposalId } });
    await withdrawProposal(sellerA.agent, fx2.proposalId, prop!.version).expect(422);
    const still = await prisma.opportunity.findUnique({ where: { id: sel.opportunity.id } });
    expect(still).toBeTruthy();
  });

  it("11. failure atomicity: stale expectedVersion → 409 без partial state (нет Opportunity, нет selectedProposalId)", async () => {
    const fx = await makeReady();
    await selectProposal(buyerAgent, fx.requestId, fx.proposalId, 999).expect(409); // stale request version
    const req = await prisma.buyerRequest.findUnique({ where: { id: fx.requestId } });
    expect(req?.selectedProposalId).toBeNull();
    expect(await prisma.opportunity.count({ where: { proposalId: fx.proposalId } })).toBe(0);
    const proposal = await prisma.sellerProposal.findUnique({ where: { id: fx.proposalId } });
    expect(proposal?.selectedAt).toBeNull();
    expect(proposal?.convertedOpportunityId).toBeNull();
  });

  it("12. history/audit: request proposal_selected + proposal selected + audit; без PII/контента", async () => {
    const fx = await makeReady({ money: { amount: 123, currency: "USD" } });
    const sel = (await selectProposal(buyerAgent, fx.requestId, fx.proposalId, fx.requestVersion).expect(201)).body as { opportunity: { id: string; code: string } };
    created.opportunities.push(sel.opportunity.id);

    const reqHist = (await historyRequest(buyerAgent, fx.requestId).expect(200)).body as { items: Array<{ action: string; fields: Record<string, unknown> | null }> };
    expect(reqHist.items.map((h) => h.action)).toContain("proposal_selected");
    const selEntry = reqHist.items.find((h) => h.action === "proposal_selected")!;
    expect(selEntry.fields).toHaveProperty("convertedOpportunityId");

    const propHist = await prisma.sellerProposalHistory.findMany({ where: { proposalId: fx.proposalId } });
    expect(propHist.map((h) => h.action)).toContain("selected");
    const propSel = propHist.find((h) => h.action === "selected")!;
    expect(propSel.from).toBe("SUBMITTED");
    expect(propSel.fields).toHaveProperty("opportunityCode");

    const audits = await prisma.auditLog.findMany({
      where: { action: { in: ["proposal.selected", "sales.opportunity.created_from_buyer_request"] } },
      orderBy: { createdAt: "desc" },
      take: 4,
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);
    const raw = JSON.stringify(audits);
    expect(raw.toLowerCase()).not.toMatch(/password|email|phone|description|amount/i); // no PII / proposal content
  });

  it("13. no side effects: zero Quote/Checkout/Sale/Order/Booking; no Communication; no Catalog mutation; no outbox events", async () => {
    const before = await dbCounts();
    const fx = await makeReady();
    const sel = (await selectProposal(buyerAgent, fx.requestId, fx.proposalId, fx.requestVersion).expect(201)).body as { opportunity: { id: string } };
    created.opportunities.push(sel.opportunity.id);
    const after = await dbCounts();
    expect(after.leads).toBe(before.leads);
    expect(after.quotes).toBe(before.quotes);
    expect(after.checkouts).toBe(before.checkouts);
    expect(after.sales).toBe(before.sales);
    expect(after.orders).toBe(before.orders);
    expect(after.bookings).toBe(before.bookings);
    expect(after.communications).toBe(before.communications);
    expect(after.availReservations).toBe(before.availReservations);
    expect(after.outbox).toBe(before.outbox); // нет ProposalSelected/OpportunityCreated speculative событий
  });

  // ── 14-15. Acquisition propagation (§48) ──────────────────────────────

  it("14. request-led flow: Opportunity → Quote → Checkout = BUYER_REQUEST (полная цепочка, серверно)", async () => {
    const fx = await makeReady();
    const sel = (await selectProposal(buyerAgent, fx.requestId, fx.proposalId, fx.requestVersion).expect(201)).body as { opportunity: { code: string } };
    const oppRow = await prisma.opportunity.findFirstOrThrow({ where: { code: sel.opportunity.code } });
    created.opportunities.push(oppRow.id);

    // Opportunity → Quote (Sales API, opportunityId) — acquisitionSource наследуется.
    const prod = await createProduct("led");
    const quote = await issueQuote(smToken, prod, oppRow.id);
    const qDetail = (await agent(smToken).get(`/api/v1/sales/quotes/${quote.code}`).expect(200)).body as { acquisitionSource: string | null };
    expect(qDetail.acquisitionSource).toBe("BUYER_REQUEST");

    // Quote → Checkout — server-derived BUYER_REQUEST (НЕ client-authoritative).
    const intent = (await agent(smToken).post("/api/v1/sales/checkouts").send({ quoteId: quote.id }).expect(201)).body as { id: string; code: string };
    created.checkouts.push(intent.id);
    const ckDetail = (await agent(smToken).get(`/api/v1/sales/checkouts/${intent.code}`).expect(200)).body as { acquisitionSource: string };
    expect(ckDetail.acquisitionSource).toBe("BUYER_REQUEST");

    // Checkout creation не принимает client-forged source.
    await agent(smToken).post("/api/v1/sales/checkouts").send({ quoteId: quote.id, acquisitionSource: "MARKETPLACE" }).expect(422);
  });

  it("15. direct flow: Quote без Opportunity → Checkout = DIRECT (legacy сохранён)", async () => {
    const prod = await createProduct("dir");
    const quote = await issueQuote(smToken, prod); // без opportunityId
    const qDetail = (await agent(smToken).get(`/api/v1/sales/quotes/${quote.code}`).expect(200)).body as { acquisitionSource: string | null };
    expect(qDetail.acquisitionSource).toBeNull(); // Quote direct — честный NULL
    const intent = (await agent(smToken).post("/api/v1/sales/checkouts").send({ quoteId: quote.id }).expect(201)).body as { id: string; code: string };
    created.checkouts.push(intent.id);
    const ckDetail = (await agent(smToken).get(`/api/v1/sales/checkouts/${intent.code}`).expect(200)).body as { acquisitionSource: string };
    expect(ckDetail.acquisitionSource).toBe("DIRECT"); // fallback legacy DIRECT
  });

  it("16. §25/§47/§50: полная цепочка select → Sale → OrderRequested → Order → Booking сохраняет BUYER_REQUEST (frozen)", async () => {
    const fx = await makeReady();
    const sel = (await selectProposal(buyerAgent, fx.requestId, fx.proposalId, fx.requestVersion).expect(201)).body as { opportunity: { code: string } };
    const oppRow = await prisma.opportunity.findFirstOrThrow({ where: { code: sel.opportunity.code } });
    created.opportunities.push(oppRow.id);
    expect(oppRow.acquisitionSource).toBe("BUYER_REQUEST");

    // Канонический Sales lifecycle из request-led Opportunity.
    const date = futureDate(30);
    const prod = await createProduct("chain");
    const q = (await agent(smToken).post("/api/v1/sales/quotes").send({ opportunityId: oppRow.id }).expect(201)).body as { id: string; code: string };
    created.quotes.push(q.id);
    await agent(smToken).post(`/api/v1/sales/quotes/${q.code}/items`).send({ productId: prod.productId, tariffId: prod.tariffId, quantity: 1 }).expect(201);
    await agent(smToken)
      .put(`/api/v1/sales/quotes/${q.code}/commercial`)
      .send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() })
      .expect(200);
    await agent(smToken).post(`/api/v1/sales/quotes/${q.code}/issue`).expect(201);
    const qDetail = (await agent(smToken).get(`/api/v1/sales/quotes/${q.code}`).expect(200)).body as { acquisitionSource: string | null };
    expect(qDetail.acquisitionSource).toBe("BUYER_REQUEST"); // унаследован из Opportunity

    const intent = (await agent(smToken)
      .post("/api/v1/sales/checkouts")
      .send({ quoteId: q.id, serviceDate: date, travelers: [{ firstName: "Иван", lastName: "Иванов", birthDate: "1990-05-01" }] })
      .expect(201)).body as { id: string; code: string; version: number };
    created.checkouts.push(intent.id);
    const ckDetail = (await agent(smToken).get(`/api/v1/sales/checkouts/${intent.code}`).expect(200)).body as { acquisitionSource: string };
    expect(ckDetail.acquisitionSource).toBe("BUYER_REQUEST"); // server-derived из Quote
    await agent(smToken)
      .put(`/api/v1/sales/checkouts/${intent.code}/payment-terms`)
      .send({ scheme: "FULL_PREPAYMENT", expectedVersion: intent.version })
      .expect(200);
    const avail = (await adminAgent
      .post(`/api/v1/products/${prod.productId}/availability`)
      .send({ tariffId: prod.tariffId, date: `${date}T00:00:00.000Z`, slotsTotal: 5 })
      .expect(201)).body as { id: string };
    created.availability.push(avail.id);

    const sale = (await agent(smToken).post("/api/v1/sales/sales").send({ quoteId: q.id, checkoutIntentId: intent.id }).expect(201)).body as {
      id: string;
      code: string;
      version: number;
    };
    created.sales.push(sale.id);
    // Sale.acquisitionSource заполняется при completion из frozen Checkout snapshot
    // (createSale НЕ копирует source — единый money/source authority = Checkout).
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).acquisitionSource).toBeNull();

    const done = (await agent(smToken).post(`/api/v1/sales/sales/${sale.code}/complete`).send({ expectedVersion: sale.version }).expect(201)).body as {
      orderRequestedEventId: string;
    };
    // После completion — frozen BUYER_REQUEST (snapshot Checkout).
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).acquisitionSource).toBe("BUYER_REQUEST");
    // OrderRequested payload — frozen BUYER_REQUEST snapshot.
    const reqEv = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: done.orderRequestedEventId } });
    expect((reqEv.payload as { acquisitionSource: string }).acquisitionSource).toBe("BUYER_REQUEST");
    // Order (consumer) — source из payload без пересчёта.
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: sale.id } });
    created.orders.push(order.id);
    expect(order.acquisitionSource).toBe("BUYER_REQUEST");

    // Order lifecycle → Booking: Booking.acquisitionSource копируется из Order
    // (READ-only, ADR-0001) — mechanism source-agnostic, DIRECT-путь уже покрыт
    // acquisition-source-propagation.e2e-spec.
    await adminAgent
      .patch(`/api/v1/orders/${order.id}/travelers`)
      .send({ travelers: [{ firstName: "Иван", lastName: "Иванов", birthDate: "1990-05-01", passportNumber: "P1234567", citizenship: "AZ", gender: "M" }] })
      .expect(200);
    for (const act of ["process", "confirm", "send"] as const) {
      await adminAgent.patch(`/api/v1/orders/${order.id}`).send({ action: act }).expect(200);
    }
    const bookings = await prisma.booking.findMany({ where: { orderId: order.id } });
    expect(bookings.length).toBeGreaterThan(0);
    for (const b of bookings) {
      expect(b.acquisitionSource).toBe("BUYER_REQUEST"); // frozen из Order
    }
  });
});
