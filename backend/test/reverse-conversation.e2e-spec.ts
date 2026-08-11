/**
 * E2E PHASE 2 STEP 2.2E — Buyer Request / Proposal Communication (pre-sale chat).
 *
 * Покрывает §45 (35 пунктов):
 *  1.  anonymous denied (open/list/get/messages/send → 401);
 *  2.  unmatched Seller не может open/read/send (neutral 422/404);
 *  3.  distributed Seller может open;
 *  4.  Buyer, владеющий request, может open;
 *  5.  Buyer A не может читать/писать в conversation Buyer B;
 *  6.  Seller A не может читать/писать в conversation Seller B;
 *  7.  один request, распределённый A и B → изолированные conversations;
 *  8.  повторный open → тот же CML;
 *  9.  конкурентный open → один conversation;
 *  10. memberships server-derived (buyerCustomerId/sellerPartnerId из reverse);
 *  11. forged buyerId/sellerId/memberIds/proposalId/status → 422;
 *  12. guessed CML/thread id → 404;
 *  13. guessed message id → 404 (legacy detail neutral для BUYER_REQUEST-сообщений);
 *  14. sender spoof → 422 (авторство server-derived);
 *  15. Buyer может отправлять;
 *  16. Seller может отправлять;
 *  17. Seller projection без Buyer контактного PII;
 *  18. Buyer projection использует safe PublicSellerProfile (SELL-*);
 *  19. raw Partner UUID не отдаётся где требуется publicId;
 *  20. HIDDEN/ANONYMOUS seller identity semantics;
 *  21. contact-sharing контент заблокирован;
 *  22. anti-disintermediation bypass-попытки → 422;
 *  23. length/control-char/XSS валидация;
 *  24. BuyerRequest CANCELLED: open 422, send 422, история durable;
 *  25. Proposal WITHDRAWN: чат продолжает работать, история не удаляется;
 *  26. нет duplicate membership (ровно один поток на (request, seller));
 *  27. failure atomicity (422 не оставляет строк);
 *  28. reverse.* без Message/Chat/ChatMember/Conversation таблиц;
 *  29. нет Proposal mutation через чат;
 *  30. нет Sales/Order/Booking/Payment fan-out;
 *  31. нет Catalog/Pricing mutation;
 *  32. acquisition source не меняется (BUYER_REQUEST);
 *  33. audit: conversation.opened / conversation.message.sent (без body); без outbox;
 *  34. pagination/determinism;
 *  35. миграция: только communication.* (clean replay через globalSetup).
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
  user: {
    id: string;
    role: string;
    email: string | null;
    customerId: string | null;
    partnerId: string | null;
    permissions: string[];
  };
}

describe("Phase 2 Step 2.2E — Buyer Request / Proposal Communication (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created: {
    users: string[];
    customers: string[];
    partners: string[];
    categories: string[];
    threads: string[];
    messages: string[];
  } = { users: [], customers: [], partners: [], categories: [], threads: [], messages: [] };

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };
  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  /** Полный onboarding: register → submit → review → approve → re-login (JWT с partnerId). */
  const createApprovedSeller = async (tag: string) => {
    const email = `rcv${tag}${stamp}@test.local`;
    const reg = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/partner-register")
        .send({
          email,
          password: "partnerpass123",
          firstName: "П",
          lastName: tag.toUpperCase(),
          applicantType: "INDIVIDUAL",
          brandName: `Conversation Partner ${tag} ${stamp}`,
          country: "AZ",
          contactEmail: email,
          termsAccepted: true,
        })
        .expect(201)
    ).body as { user: { id: string } };
    created.users.push(reg.user.id);
    const pAgent = agent((await login(email, "partnerpass123")).accessToken);
    const appRow = (await pAgent.get("/api/v1/partner/application").expect(200)).body as { id: string };
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

  // Уникальный SELL-* publicId для тестового bootstrap: время + монотонный
  // счётчик (надёжнее Date.now()+random — никаких коллизий при нагрузке).
  let profileSeq = 0;
  const ensurePublicSellerProfile = async (partnerId: string): Promise<string> => {
    profileSeq += 1;
    const publicId = "SELL-" + String(Date.now()).slice(-6) + String(profileSeq).padStart(3, "0");
    await prisma.publicSellerProfile.upsert({
      where: { partnerId },
      update: {},
      create: { publicId, partnerId, status: "APPROVED", visibilityMode: "ANONYMOUS", verified: true },
    });
    const row = await prisma.publicSellerProfile.findUniqueOrThrow({ where: { partnerId }, select: { publicId: true } });
    return row.publicId;
  };

  const runMatch = (a: ReturnType<typeof request.agent>, buyerRequestId: string) =>
    a.post("/api/v1/system/reverse/matching/run").send({ buyerRequestId });

  const openConversation = (a: ReturnType<typeof request.agent>, buyerRequestId: string, sellerPublicId?: string) =>
    a.post("/api/v1/communications/reverse/conversations").send({ buyerRequestId, ...(sellerPublicId ? { sellerPublicId } : {}) });

  const listConversations = (a: ReturnType<typeof request.agent>, qs = "") =>
    a.get(`/api/v1/communications/reverse/conversations${qs}`);
  const getConversation = (a: ReturnType<typeof request.agent>, id: string) =>
    a.get(`/api/v1/communications/reverse/conversations/${id}`);
  const listMessages = (a: ReturnType<typeof request.agent>, id: string, qs = "") =>
    a.get(`/api/v1/communications/reverse/conversations/${id}/messages${qs}`);
  const sendMessage = (a: ReturnType<typeof request.agent>, id: string, body: Record<string, unknown>) =>
    a.post(`/api/v1/communications/reverse/conversations/${id}/messages`).send(body);

  const dbCounts = async () => {
    const [products, tariffs, availability, leads, opps, quotes, sales, orders, bookings, availReservations] =
      await prisma.$transaction([
        prisma.product.count(),
        prisma.tariff.count(),
        prisma.availability.count(),
        prisma.lead.count(),
        prisma.opportunity.count(),
        prisma.quote.count(),
        prisma.sale.count(),
        prisma.order.count(),
        prisma.booking.count(),
        prisma.availabilityReservation.count(),
      ]);
    return { products, tariffs, availability, leads, opps, quotes, sales, orders, bookings, availReservations };
  };

  const reverseTables = async (): Promise<string[]> => {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'reverse' ORDER BY table_name`,
    )) as Array<{ table_name: string }>;
    return rows.map((r) => r.table_name);
  };

  const communicationTables = async (): Promise<string[]> => {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'communication' ORDER BY table_name`,
    )) as Array<{ table_name: string }>;
    return rows.map((r) => r.table_name);
  };

  const submitRequest = async (buyer: ReturnType<typeof request.agent>, destinations: Array<{ countryCode?: string; cityCode?: string; worldwide?: boolean }>) => {
    const r = (
      await buyer
        .post("/api/v1/buyer/requests")
        .send({ categoryId: catHotelId, destinations, serviceDateFrom: "2026-09-01", serviceDateTo: "2026-09-07", adults: 2 })
        .expect(201)
    ).body as { id: string; version: number };
    const s = (await buyer.post(`/api/v1/buyer/requests/${r.id}/submit`).send({ expectedVersion: r.version }).expect(201)).body as { id: string; version: number };
    return { id: s.id, version: s.version };
  };

  let catHotelId: string;
  let sellerA: Awaited<ReturnType<typeof createApprovedSeller>>;
  let sellerB: Awaited<ReturnType<typeof createApprovedSeller>>;
  let sellerC: Awaited<ReturnType<typeof createApprovedSeller>>;
  let sellerD: Awaited<ReturnType<typeof createApprovedSeller>>;
  let publicIdA: string;
  let publicIdB: string;
  let publicIdD: string;
  let buyer1: Session & { customerId: string };
  let buyer1Agent: ReturnType<typeof request.agent>;
  let buyer2: Session & { customerId: string };
  let buyer2Agent: ReturnType<typeof request.agent>;
  let reqId: string; // распределён и A, и B
  let threadABuyer: { id: string; code: string };
  let threadBBuyer: { id: string; code: string };
  let operatorAccessToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminAgent = agent((await login("admin", "admin123")).accessToken);

    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `Conv Hotel ${stamp}`, slug: `rcv-hotel-${stamp}` }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    catHotelId = cat.id;

    sellerA = await createApprovedSeller("a");
    sellerB = await createApprovedSeller("b");
    sellerC = await createApprovedSeller("c");
    sellerD = await createApprovedSeller("d");
    publicIdA = await ensurePublicSellerProfile(sellerA.partnerId);
    publicIdB = await ensurePublicSellerProfile(sellerB.partnerId);
    publicIdD = await ensurePublicSellerProfile(sellerD.partnerId);
    // Seller D — HIDDEN профиль: идентичность не раскрывается, чат с ним невозможен.
    await prisma.publicSellerProfile.update({ where: { partnerId: sellerD.partnerId }, data: { status: "HIDDEN" } });
    await createActiveCapability(sellerA, catHotelId, [{ countryCode: "TR" }]);
    await createActiveCapability(sellerB, catHotelId, [{ countryCode: "TR" }]);

    const b1 = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ username: `rcvbuyer1${stamp}`, email: `rcvbuyer1${stamp}@test.local`, password: "buyerpass123", firstName: "Б1", lastName: "Б1" })
        .expect(201)
    ).body as Session;
    created.users.push(b1.user.id);
    buyer1 = { ...b1, customerId: b1.user.customerId! };
    created.customers.push(buyer1.customerId);
    buyer1Agent = agent(b1.accessToken);

    const b2 = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ username: `rcvbuyer2${stamp}`, email: `rcvbuyer2${stamp}@test.local`, password: "buyerpass123", firstName: "Б2", lastName: "Б2" })
        .expect(201)
    ).body as Session;
    created.users.push(b2.user.id);
    buyer2 = { ...b2, customerId: b2.user.customerId! };
    created.customers.push(buyer2.customerId);
    buyer2Agent = agent(b2.accessToken);

    const s = await submitRequest(buyer1Agent, [{ countryCode: "TR" }]);
    reqId = s.id;
    await runMatch(adminAgent, reqId).expect(201);

    // Staff OPERATOR (create/read есть, write_own НЕТ) — создаётся через admin API
    // (e2e-БД стартует пустой: только миграции, без seed).
    const op = (await adminAgent.post("/api/v1/users").send({ username: `rcvop${stamp}`, password: "staffpass123", roleCode: "OPERATOR" }).expect(201)).body as { id: string };
    created.users.push(op.id);
    operatorAccessToken = (await login(`rcvop${stamp}`, "staffpass123")).accessToken;
  });

  afterAll(async () => {
    await prisma.communication.deleteMany({ where: { id: { in: created.messages } } });
    await prisma.communicationThread.deleteMany({ where: { id: { in: created.threads } } });
    await prisma.sellerProposalHistory.deleteMany();
    await prisma.sellerProposal.deleteMany();
    await prisma.buyerRequestDistribution.deleteMany();
    await prisma.buyerRequest.deleteMany();
    await prisma.sellerCapability.deleteMany();
    await prisma.publicSellerProfile.deleteMany({ where: { partnerId: { in: created.partners } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.outboxEvent.deleteMany({
      where: { OR: [{ aggregateId: { in: created.customers } }, { aggregateId: { in: created.partners } }] },
    });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.auditLog.deleteMany({
      where: { action: { in: ["conversation.opened", "conversation.message.sent"] } },
    });
    await app.close();
  });

  // ── 1-2. Anonymous / role gates ────────────────────────────────────────

  it("1. anonymous: open/list/get/messages/send → 401; staff без write_own → 403", async () => {
    await request(app.getHttpServer()).post("/api/v1/communications/reverse/conversations").send({ buyerRequestId: "x" }).expect(401);
    await request(app.getHttpServer()).get("/api/v1/communications/reverse/conversations").expect(401);
    await request(app.getHttpServer()).get("/api/v1/communications/reverse/conversations/x").expect(401);
    await request(app.getHttpServer()).get("/api/v1/communications/reverse/conversations/x/messages").expect(401);
    await request(app.getHttpServer()).post("/api/v1/communications/reverse/conversations/x/messages").send({ body: "hi" }).expect(401);
    // OPERATOR (staff): communication.create/read есть, write_own НЕТ → 403 (peer-контур закрыт).
    await openConversation(agent(operatorAccessToken), reqId, publicIdA).expect(403);
    await listConversations(agent(operatorAccessToken)).expect(403);
  });

  it("2. unmatched Seller (нет distribution): open → 422; get/messages/send чужого → 404", async () => {
    await openConversation(sellerC.agent, reqId).expect(422);
    await getConversation(sellerC.agent, "00000000-0000-0000-0000-000000000000").expect(404);
    await listMessages(sellerC.agent, "00000000-0000-0000-0000-000000000000").expect(404);
    await sendMessage(sellerC.agent, "00000000-0000-0000-0000-000000000000", { body: "hello" }).expect(404);
  });

  // ── 3-4. Open by distributed Seller / owning Buyer ─────────────────────

  it("3. distributed Seller открывает conversation → CML-*, 201", async () => {
    const res = await openConversation(sellerA.agent, reqId).expect(201);
    expect(res.body.code).toMatch(/^CML-/);
    expect(res.body.buyerRequestId).toBe(reqId);
    expect(res.body.requestCode).toMatch(/^BRQ-/);
    expect(res.body.seller).toBeNull(); // Seller-view: без seller PII/identity
    created.threads.push(res.body.id);
    threadABuyer = { id: res.body.id, code: res.body.code };
  });

  it("4. Buyer, владеющий request, открывает conversation по sellerPublicId (SELL-*) → тот же поток", async () => {
    const res = await openConversation(buyer1Agent, reqId, publicIdA).expect(201);
    expect(res.body.id).toBe(threadABuyer.id); // сходится к тому же CML (§8)
    expect(res.body.code).toBe(threadABuyer.code);
    expect(res.body.seller?.publicId).toBe(publicIdA); // buyer-view: SELL-*
  });

  it("4b. Seller publicId обязателен для BUYER; для SELLER запрещён (server-derived)", async () => {
    await openConversation(buyer1Agent, reqId).expect(422); // без sellerPublicId
    await openConversation(sellerA.agent, reqId, publicIdA).expect(422); // seller не передаёт sellerPublicId
  });

  // ── 5-7. Cross-Buyer / Cross-Seller isolation ─────────────────────────

  it("5. Buyer A ≠ Buyer B: чужой conversation → 404 (get/messages/send); чужой list пуст", async () => {
    await getConversation(buyer2Agent, threadABuyer.id).expect(404);
    await listMessages(buyer2Agent, threadABuyer.id).expect(404);
    await sendMessage(buyer2Agent, threadABuyer.id, { body: "чужой" }).expect(404);
    const own = (await listConversations(buyer2Agent).expect(200)).body as { items: unknown[]; total: number };
    expect(own.items).toHaveLength(0);
    expect(own.total).toBe(0);
  });

  it("6. Seller A ≠ Seller B: B не видит/не пишет в conversation A", async () => {
    await getConversation(sellerB.agent, threadABuyer.id).expect(404);
    await listMessages(sellerB.agent, threadABuyer.id).expect(404);
    await sendMessage(sellerB.agent, threadABuyer.id, { body: "чужой" }).expect(404);
  });

  it("7. один request, распределённый A и B → изолированные conversations (разные CML)", async () => {
    const resB = await openConversation(buyer1Agent, reqId, publicIdB).expect(201);
    expect(resB.body.id).not.toBe(threadABuyer.id);
    expect(resB.body.code).not.toBe(threadABuyer.code);
    created.threads.push(resB.body.id);
    threadBBuyer = { id: resB.body.id, code: resB.body.code };

    // A пишет в СВОЙ поток; B этот поток не видит.
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "Сообщение A в поток A" }).expect(201);
    await sendMessage(sellerB.agent, threadBBuyer.id, { body: "Сообщение B в поток B" }).expect(201);
    const msgsB = (await listMessages(sellerB.agent, threadBBuyer.id).expect(200)).body as { items: Array<{ body: string }> };
    expect(msgsB.items.map((m) => m.body)).not.toContain("Сообщение A в поток A");
    await listMessages(sellerB.agent, threadABuyer.id).expect(404);
  });

  // ── 8-10. Idempotency / membership ────────────────────────────────────

  it("8. повторный open (seller и buyer) → тот же CML, без дубликатов", async () => {
    const again = await openConversation(sellerA.agent, reqId).expect(201);
    expect(again.body.id).toBe(threadABuyer.id);
    const buyerAgain = await openConversation(buyer1Agent, reqId, publicIdA).expect(201);
    expect(buyerAgain.body.id).toBe(threadABuyer.id);
    const count = await prisma.communicationThread.count({ where: { buyerRequestId: reqId, sellerPartnerId: sellerA.partnerId } });
    expect(count).toBe(1);
  });

  it("9. конкурентный open → один conversation (DB unique + P2002 re-read)", async () => {
    const results = await Promise.all([
      openConversation(sellerA.agent, reqId),
      openConversation(buyer1Agent, reqId, publicIdA),
      openConversation(sellerA.agent, reqId),
      openConversation(buyer1Agent, reqId, publicIdA),
      openConversation(sellerA.agent, reqId),
      openConversation(buyer1Agent, reqId, publicIdA),
    ]);
    for (const r of results) {
      expect(r.status).toBe(201);
      expect(r.body.id).toBe(threadABuyer.id);
    }
    const count = await prisma.communicationThread.count({ where: { buyerRequestId: reqId, sellerPartnerId: sellerA.partnerId } });
    expect(count).toBe(1);
  });

  it("10. memberships server-derived: buyerCustomerId == request.buyerId, sellerPartnerId == distribution.sellerId", async () => {
    const thread = await prisma.communicationThread.findUniqueOrThrow({ where: { id: threadABuyer.id } });
    expect(thread.buyerCustomerId).toBe(buyer1.customerId);
    expect(thread.sellerPartnerId).toBe(sellerA.partnerId);
    const request = await prisma.buyerRequest.findUniqueOrThrow({ where: { id: reqId } });
    expect(thread.buyerCustomerId).toBe(request.buyerId);
  });

  // ── 11-14. Mass assignment / IDOR / spoof ─────────────────────────────

  // Raw-body helper для forged-key тестов (запрещённые ключи → 422).
  const openConversationRaw = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post("/api/v1/communications/reverse/conversations").set("Authorization", `Bearer ${buyer1.accessToken}`).send(body);

  it("11. forged buyerId/sellerId/memberIds/proposalId/status/version → 422 (open + send)", async () => {
    const cases: Array<Record<string, unknown>> = [
      { buyerRequestId: reqId, sellerId: sellerA.partnerId },
      { buyerRequestId: reqId, buyerId: buyer1.customerId },
      { buyerRequestId: reqId, memberIds: [buyer1.customerId, sellerA.partnerId] },
      { buyerRequestId: reqId, proposalId: "PRP-1", status: "ACTIVE" },
      { buyerRequestId: reqId, version: 1, createdAt: new Date().toISOString() },
      { buyerRequestId: reqId, contactDisclosed: true },
      { buyerRequestId: reqId, quoteId: "QTE-1", saleId: "SAL-1" },
    ];
    for (const body of cases) {
      await openConversationRaw(body).expect(422);
    }
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "ok", senderId: buyer1.customerId }).expect(422);
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "ok", direction: "INBOUND" }).expect(422);
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "ok", recipientId: buyer1.customerId }).expect(422);
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "ok", status: "ACTIVE" }).expect(422);
  });

  it("12. guessed thread/CML id → 404 (нет утечки существования)", async () => {
    await getConversation(sellerA.agent, "CML-00000000").expect(404);
    await getConversation(buyer1Agent, "CML-00000000").expect(404);
    await listMessages(sellerA.agent, "CML-00000000").expect(404);
    // Код потока не является Communication-кодом: legacy detail → 404.
    await request(app.getHttpServer())
      .get(`/api/v1/communications/${threadABuyer.code}`)
      .set("Authorization", `Bearer ${buyer1.accessToken}`)
      .expect(404);
  });

  it("13. guessed message id: чужое сообщение через legacy detail → neutral 404", async () => {
    const sent = await sendMessage(sellerA.agent, threadABuyer.id, { body: "для теста 13" }).expect(201);
    const msgCode = (sent.body as { code: string }).code;
    // Сообщение BUYER_REQUEST-контекста не видно ни через legacy own-scope,
    // ни другой стороне в peer-контуре (другой поток).
    await request(app.getHttpServer())
      .get(`/api/v1/communications/${msgCode}`)
      .set("Authorization", `Bearer ${buyer1.accessToken}`)
      .expect(404);
    await getConversation(sellerB.agent, threadABuyer.id).expect(404);
  });

  it("14. sender spoof отклонён: авторство всегда из actor (строки хранят server-derived sender)", async () => {
    // seller A шлёт, но пытается подставить sender → 422 (выше); реальное авторство:
    const before = await prisma.communication.count({ where: { threadId: threadABuyer.id, senderType: "PARTNER", senderId: sellerA.partnerId } });
    const sent = await sendMessage(sellerA.agent, threadABuyer.id, { body: "серверное авторство" }).expect(201);
    created.messages.push((sent.body as { id: string }).id);
    const after = await prisma.communication.count({ where: { threadId: threadABuyer.id, senderType: "PARTNER", senderId: sellerA.partnerId } });
    expect(after).toBe(before + 1);
  });

  // ── 15-20. Send / projections / identity ──────────────────────────────

  it("15. Buyer может отправлять (side=BUYER, direction=INBOUND)", async () => {
    const sent = (await sendMessage(buyer1Agent, threadABuyer.id, { body: "Вопрос от покупателя" }).expect(201)).body as {
      id: string;
      code: string;
      side: string;
      body: string;
    };
    created.messages.push(sent.id);
    expect(sent.side).toBe("BUYER");
    expect(sent.body).toBe("Вопрос от покупателя");
    const row = await prisma.communication.findUniqueOrThrow({ where: { id: sent.id } });
    expect(row.direction).toBe("INBOUND");
    expect(row.senderType).toBe("CUSTOMER");
    expect(row.senderId).toBe(buyer1.customerId);
    expect(row.threadId).toBe(threadABuyer.id);
  });

  it("16. Seller может отправлять (side=SELLER, direction=OUTBOUND)", async () => {
    const sent = (await sendMessage(sellerA.agent, threadABuyer.id, { body: "Ответ продавца" }).expect(201)).body as {
      id: string;
      side: string;
    };
    created.messages.push(sent.id);
    expect(sent.side).toBe("SELLER");
    const row = await prisma.communication.findUniqueOrThrow({ where: { id: sent.id } });
    expect(row.direction).toBe("OUTBOUND");
    expect(row.senderType).toBe("PARTNER");
    expect(row.senderId).toBe(sellerA.partnerId);
  });

  it("17. Seller projection без Buyer контактного PII (только request-контекст)", async () => {
    const detail = (await getConversation(sellerA.agent, threadABuyer.id).expect(200)).body as Record<string, unknown>;
    expect(detail.requestCode).toMatch(/^BRQ-/);
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain(buyer1.customerId);
    expect(serialized.toLowerCase()).not.toContain("email");
    expect(serialized.toLowerCase()).not.toContain("firstName");
    const msgs = (await listMessages(sellerA.agent, threadABuyer.id).expect(200)).body as { items: Array<Record<string, unknown>> };
    for (const m of msgs.items) {
      expect(Object.keys(m).sort()).toEqual(["body", "code", "id", "occurredAt", "side", "subject"]);
    }
  });

  it("18-19. Buyer projection: safe PublicSellerProfile (SELL-*), raw Partner UUID НЕ отдаётся", async () => {
    const detail = (await getConversation(buyer1Agent, threadABuyer.id).expect(200)).body as {
      seller: { publicId: string; displayName: string | null; visibilityMode: string; verified: boolean };
    };
    expect(detail.seller.publicId).toBe(publicIdA);
    expect(detail.seller.publicId).toMatch(/^SELL-/);
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain(sellerA.partnerId); // raw crm.Partner UUID
    // сообщения: никаких внутренних UUID сторон.
    const msgs = (await listMessages(buyer1Agent, threadABuyer.id).expect(200)).body as { items: Array<Record<string, unknown>> };
    for (const m of msgs.items) {
      const s = JSON.stringify(m);
      expect(s).not.toContain(sellerA.partnerId);
      expect(s).not.toContain(buyer1.customerId);
    }
  });

  it("20. HIDDEN seller: buyer не может открыть чат (нейтрально); ANONYMOUS displayName = null", async () => {
    // Seller D — HIDDEN профиль: чат невозможен (422 нейтрально).
    await openConversation(buyer1Agent, reqId, publicIdD).expect(422);
    // ANONYMOUS: displayName = null (фронтенд локализует generic label).
    const detail = (await getConversation(buyer1Agent, threadABuyer.id).expect(200)).body as { seller: { displayName: string | null; visibilityMode: string } };
    expect(detail.seller.visibilityMode).toBe("ANONYMOUS");
    expect(detail.seller.displayName).toBeNull();
  });

  // ── 21-23. Content validation ─────────────────────────────────────────

  it("21. contact-sharing контент заблокирован (CHAT EXISTS ≠ CONTACT DISCLOSED)", async () => {
    await sendMessage(buyer1Agent, threadABuyer.id, { body: "Пишите на email@example.com" }).expect(422);
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "Позвоните +7 900 123-45-67" }).expect(422);
  });

  it("22. anti-disintermediation bypass-попытки → 422 (URL/мессенджеры/соцсети)", async () => {
    await sendMessage(buyer1Agent, threadABuyer.id, { body: "Сайт https://example.com/tour" }).expect(422);
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "t.me/hub" }).expect(422);
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "wa.me/1234567890" }).expect(422);
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "@instagram_handle" }).expect(422);
    // ISO-даты — не контакт: легально.
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "Даты: 2026-09-01 — 2026-09-07" }).expect(201);
  });

  it("23. длина / control chars / XSS валидация", async () => {
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "x".repeat(4001) }).expect(400); // DTO @MaxLength → 400
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "x".repeat(4000) }).expect(201);
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "<script>alert(1)</script>" }).expect(422);
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "bad\u0000content" }).expect(422);
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "", subject: "x".repeat(201) }).expect(400);
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "ok", subject: "мой@email.com" }).expect(422);
  });

  // ── 24-25. State semantics ────────────────────────────────────────────

  it("24. BuyerRequest CANCELLED: open → 422, send → 422, история durable", async () => {
    const s = await submitRequest(buyer1Agent, [{ countryCode: "TR" }]);
    await runMatch(adminAgent, s.id).expect(201);
    const opened = (await openConversation(sellerA.agent, s.id).expect(201)).body as { id: string };
    created.threads.push(opened.id);
    await sendMessage(buyer1Agent, opened.id, { body: "до отмены" }).expect(201);

    await buyer1Agent.post(`/api/v1/buyer/requests/${s.id}/cancel`).send({ expectedVersion: s.version }).expect(201);

    await openConversation(sellerA.agent, s.id).expect(422);
    await sendMessage(buyer1Agent, opened.id, { body: "после отмены" }).expect(422);
    await sendMessage(sellerA.agent, opened.id, { body: "после отмены" }).expect(422);
    // История остаётся читаемой и durable.
    const msgs = (await listMessages(buyer1Agent, opened.id).expect(200)).body as { items: Array<{ body: string }> };
    expect(msgs.items.map((m) => m.body)).toContain("до отмены");
    expect(msgs.items.map((m) => m.body)).not.toContain("после отмены");
    // failure atomicity: 422 не оставил строк.
    const leftover = await prisma.communication.count({ where: { threadId: opened.id, body: "после отмены" } });
    expect(leftover).toBe(0);
  });

  it("25. Proposal WITHDRAWN: чат продолжает работать, история не удаляется, ref остаётся валидным", async () => {
    // Открываем чат ДО proposal → ref не привязан; proposal создаётся, сабмитится,
    // отзывается — чат не ломается.
    const s = await submitRequest(buyer1Agent, [{ countryCode: "TR" }]);
    await runMatch(adminAgent, s.id).expect(201);
    const opened = (await openConversation(sellerA.agent, s.id).expect(201)).body as { id: string };
    created.threads.push(opened.id);
    const p = (await sellerA.agent.post("/api/v1/partner/reverse/proposals").send({ buyerRequestId: s.id, money: { amount: 800, currency: "USD" } }).expect(201)).body as { id: string; version: number };
    const submitted = (await sellerA.agent.post(`/api/v1/partner/reverse/proposals/${p.id}/submit`).send({ expectedVersion: p.version }).expect(201)).body as { version: number };
    const withdrawn = (await sellerA.agent.post(`/api/v1/partner/reverse/proposals/${p.id}/withdraw`).send({ expectedVersion: submitted.version }).expect(201)).body as { version: number };

    // WITHDRAWN proposal: переписка продолжается (request остаётся SUBMITTED).
    await sendMessage(buyer1Agent, opened.id, { body: "после отзыва proposal" }).expect(201);
    const msgs = (await listMessages(buyer1Agent, opened.id).expect(200)).body as { items: Array<{ body: string }> };
    expect(msgs.items.map((m) => m.body)).toContain("после отзыва proposal");
    // Proposal не мутирован чатом (§29): статус/версия остаются ровно после withdraw.
    const proposal = await prisma.sellerProposal.findUniqueOrThrow({ where: { id: p.id } });
    expect(proposal.status).toBe("WITHDRAWN");
    expect(proposal.version).toBe(withdrawn.version);
  });

  it("25b. open ПОСЛЕ появления Proposal: trusted ref proposalId привязывается (тот же request+seller)", async () => {
    const s = await submitRequest(buyer1Agent, [{ countryCode: "TR" }]);
    await runMatch(adminAgent, s.id).expect(201);
    const p = (await sellerA.agent.post("/api/v1/partner/reverse/proposals").send({ buyerRequestId: s.id, money: { amount: 500, currency: "EUR" } }).expect(201)).body as { id: string; version: number };
    await sellerA.agent.post(`/api/v1/partner/reverse/proposals/${p.id}/submit`).send({ expectedVersion: p.version }).expect(201);
    const opened = (await openConversation(buyer1Agent, s.id, publicIdA).expect(201)).body as { id: string; proposalId: string | null };
    created.threads.push(opened.id);
    expect(opened.proposalId).toBe(p.id);
    // Чат не может привязать proposal клиентом: proposalId в body → 422 (forbidden key).
    await request(app.getHttpServer())
      .post("/api/v1/communications/reverse/conversations")
      .set("Authorization", `Bearer ${buyer1.accessToken}`)
      .send({ buyerRequestId: s.id, sellerPublicId: publicIdA, proposalId: "PRP-1" })
      .expect(422);
  });

  // ── 26-27. Duplicate membership / failure atomicity ───────────────────

  it("26. нет duplicate membership: ровно один поток на (request, seller); таблиц member НЕТ", async () => {
    const count = await prisma.communicationThread.count({ where: { buyerRequestId: reqId, sellerPartnerId: sellerA.partnerId } });
    expect(count).toBe(1);
    const commTables = await communicationTables();
    // ровно две таблицы: Communication (сообщения) + CommunicationThread (room).
    expect([...commTables].sort()).toEqual(["Communication", "CommunicationThread"]);
  });

  it("27. failure atomicity: failed open/send не оставляют строк/потоков", async () => {
    const threadsBefore = await prisma.communicationThread.count();
    const msgsBefore = await prisma.communication.count();
    // Несуществующий request: seller-путь → neutral 422 (анти-enumeration — та же
    // конвенция, что resolveDistribution в 2.2D: не различаем «нет request» и
    // «не распределён мне»).
    await openConversation(sellerA.agent, "00000000-0000-0000-0000-000000000000").expect(422);
    await sendMessage(buyer1Agent, threadABuyer.id, { body: "контакт@example.com" }).expect(422);
    expect(await prisma.communicationThread.count()).toBe(threadsBefore);
    expect(await prisma.communication.count()).toBe(msgsBefore);
  });

  // ── 28-32. Isolation / zero fan-out ───────────────────────────────────

  it("28. reverse.* не содержит Message/Chat/ChatMember/Conversation таблиц (владелец — communication.*)", async () => {
    const tables = await reverseTables();
    const forbidden = ["Message", "ChatRoom", "ChatMember", "Conversation", "CommunicationThread", "ThreadMessage"];
    for (const f of forbidden) {
      expect(tables).not.toContain(f);
    }
    expect(tables).toContain("BuyerRequest");
    expect(tables).toContain("BuyerRequestDistribution");
    expect(tables).toContain("SellerProposal");
  });

  it("29. чат не мутирует Proposal (нет submit/withdraw/select через сообщения)", async () => {
    const before = await prisma.sellerProposal.count();
    await sendMessage(buyer1Agent, threadABuyer.id, { body: "не влияет на proposal" }).expect(201);
    expect(await prisma.sellerProposal.count()).toBe(before);
  });

  it("30. open/send создают НОЛЬ Sales/Order/Booking/Payment fan-out", async () => {
    const before = await dbCounts();
    await sendMessage(sellerA.agent, threadABuyer.id, { body: "проверка fan-out" }).expect(201);
    const after = await dbCounts();
    expect(after).toEqual(before);
  });

  it("31. чат не создаёт/не меняет Catalog/Pricing (Product/Tariff/Availability)", async () => {
    const before = await dbCounts();
    await openConversation(buyer1Agent, reqId, publicIdB).expect(201);
    await sendMessage(buyer1Agent, threadBBuyer.id, { body: "catalog isolation" }).expect(201);
    const after = await dbCounts();
    expect(after).toEqual(before);
  });

  it("32. acquisition source не меняется (остаётся BUYER_REQUEST)", async () => {
    const request = await prisma.buyerRequest.findUniqueOrThrow({ where: { id: reqId } });
    expect(request.acquisitionSource).toBe("BUYER_REQUEST");
    const msg = await prisma.communication.findFirstOrThrow({ where: { threadId: threadABuyer.id } });
    expect(msg.contextType).toBe("BUYER_REQUEST");
    expect(msg.contextId).toBe(reqId);
  });

  // ── 33-34. Audit / pagination ─────────────────────────────────────────

  it("33. аудит conversation.opened/message.sent (без body); событий в outbox НЕТ", async () => {
    const audits = await prisma.auditLog.findMany({
      where: { action: { in: ["conversation.opened", "conversation.message.sent"] } },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);
    const opened = audits.find((a) => a.action === "conversation.opened");
    expect(opened?.resource).toBe("CommunicationThread");
    for (const a of audits) {
      const details = (a.details ?? {}) as Record<string, unknown>;
      expect(details.body).toBeUndefined(); // PII minimization — без контента
    }
    const events = await prisma.outboxEvent.count({
      where: { eventType: { contains: "Communication", mode: "insensitive" } },
    });
    expect(events).toBe(0);
  });

  it("34. пагинация/детерминизм: threads + messages", async () => {
    const p1 = (await listConversations(buyer1Agent, "?page=1&pageSize=2").expect(200)).body as {
      items: unknown[];
      total: number;
      page: number;
      pageSize: number;
      hasMore: boolean;
    };
    expect(p1.page).toBe(1);
    expect(p1.pageSize).toBe(2);
    expect(p1.total).toBeGreaterThanOrEqual(2);
    const p2 = (await listConversations(buyer1Agent, "?page=2&pageSize=2").expect(200)).body as { items: unknown[] };
    const ids1 = (p1.items as Array<{ id: string }>).map((i) => i.id);
    const ids2 = (p2.items as Array<{ id: string }>).map((i) => i.id);
    for (const id of ids2) expect(ids1).not.toContain(id); // без пересечения страниц
    // сообщения: детерминированный хронологический порядок.
    const msgs = (await listMessages(sellerA.agent, threadABuyer.id, "?page=1&pageSize=50").expect(200)).body as {
      items: Array<{ occurredAt: string }>;
    };
    const times = msgs.items.map((m) => m.occurredAt);
    expect([...times].sort()).toEqual(times); // asc
    // cap 50: pageSize > 50 отклоняется (400).
    await listMessages(sellerA.agent, threadABuyer.id, "?pageSize=999").expect(400);
  });

  it("35. миграция аддитивна и локальна: только communication.* (clean replay на e2e-БД через globalSetup)", async () => {
    // reverseTables (см. 28) уже доказал: reverse.* не тронут.
    const comm = await communicationTables();
    expect(comm).toContain("Communication");
    expect(comm).toContain("CommunicationThread");
    // Сообщения потока действительно пишутся в communication.Communication.
    const row = await prisma.communication.findFirst({ where: { threadId: threadABuyer.id }, select: { threadId: true } });
    expect(row?.threadId).toBe(threadABuyer.id);
  });
});
