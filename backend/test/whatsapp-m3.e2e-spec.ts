/**
 * M3 e2e — WhatsApp Inbound & Chat (mock provider, real DB).
 *
 * §28/§29 матрица:
 *  1.  RBAC: anonymous 401 / BUYER 403 / OPERATOR read+manage на §25 endpoints;
 *  2.  inbound wiring: provider.onInbound → запись/Communication/диалог
 *      (UNMATCHED), unread, markRead → 0;
 *  3.  §7 dedup: повторная доставка → duplicate (1 строка, без 2-й
 *      Communication); КОНКУРЕНТНАЯ доставка → ровно один победитель;
 *  4.  §10 matching: 1 совпадение → MATCHED (+WhatsAppContact AUTO);
 *      >1 → AMBIGUOUS (+фильтр списка, ручной link → MANUAL + audit §24);
 *  5.  §8: echo известного outbound → БЕЗ второй копии Communication;
 *      fromMe вне TravelHUB → Communication OUTBOUND;
 *  6.  §21: media/пустой текст → строка SKIPPED без Communication;
 *  7.  §25 API: list/filter/detail/candidates/context/timeline/read/send
 *      (conversationId валидация), 404/400-границы;
 *  8.  §29 непрерывность: одна история Request→Order→Booking→Customer
 *      (набор строк не меняется, контекст §13 меняется на лету);
 *  9.  §22: STOP → suppression + audit; отправка подавленному → 409.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { RoleCode } from "../src/generated/prisma/enums";
import { WHATSAPP_PROVIDER } from "../src/integrations/whatsapp/whatsapp.module";
import { WhatsAppInboundService } from "../src/integrations/whatsapp/inbound/inbound.service";
import type { MockWhatsAppProvider } from "../src/integrations/whatsapp/provider/mock/mock-whatsapp.provider";

interface Session {
  accessToken: string;
  user: { id: string; role: string; customerId: string | null; permissions: string[] };
}

const stamp = Date.now();
const sessionPath = mkdtempSync(join(tmpdir(), "wa3-e2e-"));
const ENV_KEYS = [
  "WHATSAPP_ENABLED",
  "WHATSAPP_PROVIDER",
  "WHATSAPP_AUTO_CONNECT",
  "WHATSAPP_SESSION_PATH",
  "WHATSAPP_AUTH_ENCRYPTION_KEY",
] as const;
const savedEnv: Record<string, string | undefined> = {};

process.env.WHATSAPP_ENABLED = "true";
process.env.WHATSAPP_PROVIDER = "mock";
process.env.WHATSAPP_AUTO_CONNECT = "false";
process.env.WHATSAPP_SESSION_PATH = sessionPath;
process.env.WHATSAPP_AUTH_ENCRYPTION_KEY = "e2e-0123456789abcdef0123456789abcdef";

const JID_UNMATCHED = "994501333333@s.whatsapp.net";
const PHONE_MATCH = "+994501222222";
const JID_MATCH = "994501222222@s.whatsapp.net";
const PHONE_AMBIG = "+994501444444";
const JID_AMBIG = "994501444444@s.whatsapp.net";
const JID_OUTSIDE = "994501555555@s.whatsapp.net";
const JID_MEDIA = "994501666666@s.whatsapp.net";
const PHONE_FLOW = "+994501777777";
const JID_FLOW = "994501777777@s.whatsapp.net";

describe("M3 — WhatsApp Inbound & Chat (e2e, mock provider)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let provider: MockWhatsAppProvider;
  let inboundService: WhatsAppInboundService;
  let adminAgent: ReturnType<typeof request.agent>;
  let operatorAgent: ReturnType<typeof request.agent>;
  let operatorToken: string;
  let buyerToken: string;
  let startedAt: Date;
  const createdUsers: string[] = [];
  const createdCustomers: string[] = [];
  const fixtureCodes: string[] = [];

  let custMatchId: string;
  let custAmb1Id: string;
  let custAmb2Id: string;
  let custFlowId: string;
  let matchConversationId: string;

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ username, password })
      .expect(200);
    return res.body as Session;
  };

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  const pollDb = async (predicate: () => Promise<boolean>, timeoutMs = 4000): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await predicate()) return true;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return predicate();
  };

  const createCustomer = async (phone: string, tag: string): Promise<string> => {
    const customer = await prisma.customer.create({
      data: {
        code: `WA3-${tag}-${stamp}`,
        email: `wa3_${tag}_${stamp}@test.local`,
        phone,
        firstName: "WA3",
        lastName: tag.toUpperCase(),
      },
      select: { id: true },
    });
    createdCustomers.push(customer.id);
    return customer.id;
  };

  const inbound = (overrides: Record<string, unknown>) =>
    inboundService.processInbound({
      participant: null,
      lid: null,
      senderPn: null,
      occurredAt: new Date(),
      type: "text",
      text: "hello",
      fromMe: false,
      remoteJid: JID_UNMATCHED,
      providerMessageId: "x",
      ...overrides,
    } as never);

  const commCount = () => prisma.communication.count({ where: { channel: "WHATSAPP", createdAt: { gte: startedAt } } });

  beforeAll(async () => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    startedAt = new Date();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    prisma = moduleRef.get(PrismaService);
    provider = moduleRef.get<MockWhatsAppProvider>(WHATSAPP_PROVIDER, { strict: false });
    inboundService = moduleRef.get(WhatsAppInboundService, { strict: false });
    await app.init();

    const admin = await login("admin", "admin123");
    adminAgent = agent(admin.accessToken);
    createdUsers.push(admin.user.id);

    const operator = (
      await adminAgent
        .post("/api/v1/users")
        .send({ username: `wa3_op_${stamp}`, password: "operpass123", roleCode: RoleCode.OPERATOR })
        .expect(201)
    ).body as { id: string };
    createdUsers.push(operator.id);
    operatorToken = (await login(`wa3_op_${stamp}`, "operpass123")).accessToken;
    operatorAgent = agent(operatorToken);

    const buyer = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        username: `wa3_buy_${stamp}`,
        email: `wa3_buy_${stamp}@test.local`,
        password: "buyerpass123",
        firstName: "Buyer",
        lastName: "WA3",
      })
      .expect(201);
    buyerToken = (buyer.body as Session).accessToken;
    createdUsers.push((buyer.body as Session).user.id);

    custMatchId = await createCustomer(PHONE_MATCH, "match");
    custAmb1Id = await createCustomer(PHONE_AMBIG, "amb1");
    custAmb2Id = await createCustomer(PHONE_AMBIG, "amb2");
    custFlowId = await createCustomer(PHONE_FLOW, "flow");

    await adminAgent.post("/api/v1/whatsapp/connect").send({ confirm: true }).expect(200);
    expect(provider.getSnapshot().state).toBe("CONNECTED");
  });

  afterAll(async () => {
    const account = await prisma.whatsAppAccount.findFirst();
    if (account) {
      await prisma.whatsAppInboundMessage.deleteMany({ where: { accountId: account.id } });
      await prisma.whatsAppOutboundMessage.deleteMany({ where: { accountId: account.id } });
      await prisma.whatsAppConversation.deleteMany({ where: { accountId: account.id } });
      await prisma.whatsAppContact.deleteMany({ where: { accountId: account.id } });
    }
    await prisma.whatsAppSuppression.deleteMany({ where: { canonicalPhone: { in: [PHONE_MATCH] } } });
    await prisma.communication.deleteMany({
      where: { channel: "WHATSAPP", createdAt: { gte: startedAt } },
    });
    await prisma.booking.deleteMany({ where: { code: { in: fixtureCodes } } });
    await prisma.order.deleteMany({ where: { code: { in: fixtureCodes } } });
    await prisma.request.deleteMany({ where: { code: { in: fixtureCodes } } });
    await prisma.customer.deleteMany({ where: { id: { in: createdCustomers } } });
    await prisma.auditLog.deleteMany({
      where: { action: { startsWith: "whatsapp." }, createdAt: { gte: startedAt } },
    });
    await prisma.whatsAppAccount.deleteMany({});
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await app.close();
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    rmSync(sessionPath, { recursive: true, force: true });
  });

  // ── 1. RBAC ───────────────────────────────────────────────────────────────

  it("1. anonymous → 401; BUYER → 403; OPERATOR читает список (whatsapp.read)", async () => {
    const http = request(app.getHttpServer());
    await http.get("/api/v1/whatsapp/conversations").expect(401);
    await http.get("/api/v1/whatsapp/conversations/any").expect(401);
    await http.get("/api/v1/whatsapp/conversations/any/messages").expect(401);
    await http.get("/api/v1/whatsapp/customer-search?search=x").expect(401);
    await http.post("/api/v1/whatsapp/conversations/any/read").expect(401);
    await http.post("/api/v1/whatsapp/conversations/any/customer").send({ customerId: "x" }).expect(401);

    await operatorAgent.get("/api/v1/whatsapp/conversations").expect(200);
    await operatorAgent.get("/api/v1/whatsapp/customer-search?search=x").expect(200);
    await agent(buyerToken).get("/api/v1/whatsapp/conversations").expect(403);
    await agent(buyerToken).get("/api/v1/whatsapp/customer-search?search=x").expect(403);
    await agent(buyerToken).post("/api/v1/whatsapp/conversations/any/read").expect(403);
    await agent(buyerToken).post("/api/v1/whatsapp/conversations/any/customer").send({ customerId: "x" }).expect(403);
  });

  // ── 2. Inbound wiring (provider → pipeline) ──────────────────────────────

  it("2. provider.onInbound → диалог UNMATCHED + Communication + unread; markRead → 0", async () => {
    provider.driveInbound({
      providerMessageId: `w3-in-wire-${stamp}`,
      remoteJid: JID_UNMATCHED,
      text: "Здравствуйте, есть вопросы",
    });

    const found = await pollDb(async () => {
      const row = await prisma.whatsAppConversation.findUnique({
        where: { accountId_remoteJid: { accountId: (await prisma.whatsAppAccount.findFirstOrThrow()).id, remoteJid: JID_UNMATCHED } },
      });
      return row !== null;
    });
    expect(found).toBe(true);

    const account = await prisma.whatsAppAccount.findFirstOrThrow();
    const conversation = await prisma.whatsAppConversation.findUniqueOrThrow({
      where: { accountId_remoteJid: { accountId: account.id, remoteJid: JID_UNMATCHED } },
    });
    expect(conversation.matchingStatus).toBe("UNMATCHED");
    expect(conversation.customerId).toBeNull();
    expect(conversation.canonicalPhone).toBe("+994501333333");
    expect(conversation.lastMessagePreview).toContain("Здравствуйте");

    const message = await prisma.whatsAppInboundMessage.findUniqueOrThrow({
      where: { accountId_providerMessageId: { accountId: account.id, providerMessageId: `w3-in-wire-${stamp}` } },
    });
    expect(message.processingStatus).toBe("PROCESSED");
    expect(message.matchingStatus).toBe("UNMATCHED");
    expect(message.text).toBe("Здравствуйте, есть вопросы");
    expect(message.communicationId).not.toBeNull();

    const communication = await prisma.communication.findUniqueOrThrow({
      where: { id: message.communicationId! },
    });
    expect(communication.channel).toBe("WHATSAPP");
    expect(communication.direction).toBe("INBOUND");
    expect(communication.contextType).toBeNull();

    const list = await operatorAgent.get("/api/v1/whatsapp/conversations").expect(200);
    const item = list.body.find((row: { id: string }) => row.id === conversation.id);
    expect(item).toBeTruthy();
    expect(item.unreadCount).toBeGreaterThanOrEqual(1);
    expect(item.matchingStatus).toBe("UNMATCHED");

    const filtered = await operatorAgent
      .get("/api/v1/whatsapp/conversations?matchingStatus=UNMATCHED&limit=100")
      .expect(200);
    expect(filtered.body.some((row: { id: string }) => row.id === conversation.id)).toBe(true);
    await operatorAgent.get("/api/v1/whatsapp/conversations?limit=0").expect(400);
    await operatorAgent
      .get("/api/v1/whatsapp/conversations?matchingStatus=NOPE")
      .expect(400);

    await operatorAgent.post(`/api/v1/whatsapp/conversations/${conversation.id}/read`).expect(200);
    const afterRead = await operatorAgent.get("/api/v1/whatsapp/conversations?limit=100").expect(200);
    const readItem = afterRead.body.find((row: { id: string }) => row.id === conversation.id);
    expect(readItem.unreadCount).toBe(0);
  });

  // ── 3-4. Dedup §7 ─────────────────────────────────────────────────────────

  it("3. §7 повторная доставка → duplicate: 1 строка, Communication не растёт", async () => {
    const id = `w3-dup-${stamp}`;
    const first = await inbound({ providerMessageId: id, remoteJid: JID_UNMATCHED, text: "dup" });
    expect(first).toMatchObject({ outcome: "persisted" });
    const comms = await commCount();

    const second = await inbound({ providerMessageId: id, remoteJid: JID_UNMATCHED, text: "dup" });
    expect(second).toEqual({ outcome: "duplicate" });

    const account = await prisma.whatsAppAccount.findFirstOrThrow();
    const rows = await prisma.whatsAppInboundMessage.count({
      where: { accountId: account.id, providerMessageId: id },
    });
    expect(rows).toBe(1);
    expect(await commCount()).toBe(comms);
  });

  it("4. §7 КОНКУРЕНТНАЯ доставка (Promise.all) → ровно один победитель, без дублей", async () => {
    const id = `w3-race-${stamp}`;
    const results = await Promise.all([
      inbound({ providerMessageId: id, remoteJid: JID_UNMATCHED, text: "race" }),
      inbound({ providerMessageId: id, remoteJid: JID_UNMATCHED, text: "race" }),
    ]);
    const outcomes = results.map((r) => r.outcome).sort();
    expect(outcomes).toEqual(["duplicate", "persisted"]);

    const account = await prisma.whatsAppAccount.findFirstOrThrow();
    const rows = await prisma.whatsAppInboundMessage.count({
      where: { accountId: account.id, providerMessageId: id },
    });
    expect(rows).toBe(1);
  });

  // ── 5-6. Matching §10 ─────────────────────────────────────────────────────

  it("5. §10 ровно 1 совпадение → MATCHED + WhatsAppContact(AUTO) + контекст CUSTOMER", async () => {
    const result = await inbound({
      providerMessageId: `w3-match-${stamp}`,
      remoteJid: JID_MATCH,
      text: "это я",
    });
    expect(result).toMatchObject({ outcome: "persisted", matchingStatus: "MATCHED" });

    const account = await prisma.whatsAppAccount.findFirstOrThrow();
    const conversation = await prisma.whatsAppConversation.findUniqueOrThrow({
      where: { accountId_remoteJid: { accountId: account.id, remoteJid: JID_MATCH } },
    });
    matchConversationId = conversation.id;
    expect(conversation.customerId).toBe(custMatchId);
    expect(conversation.matchingStatus).toBe("MATCHED");

    const contact = await prisma.whatsAppContact.findUniqueOrThrow({
      where: { accountId_jid: { accountId: account.id, jid: JID_MATCH } },
    });
    expect(contact.customerId).toBe(custMatchId);
    expect(contact.linkSource).toBe("AUTO");
    expect(contact.canonicalPhone).toBe(PHONE_MATCH);

    const detail = await operatorAgent.get(`/api/v1/whatsapp/conversations/${conversation.id}`).expect(200);
    expect(detail.body.customer.id).toBe(custMatchId);
    expect(detail.body.context.type).toBe("CUSTOMER");
    expect(detail.body.context.code).toMatch(/^WA3-/);
  });

  it("6. §10 >1 совпадений → AMBIGUOUS (+кандидаты, фильтр) → link → MATCHED + audit §24", async () => {
    const result = await inbound({
      providerMessageId: `w3-amb-${stamp}`,
      remoteJid: JID_AMBIG,
      text: "кто я",
    });
    expect(result).toMatchObject({ outcome: "persisted", matchingStatus: "AMBIGUOUS" });

    const account = await prisma.whatsAppAccount.findFirstOrThrow();
    const conversation = await prisma.whatsAppConversation.findUniqueOrThrow({
      where: { accountId_remoteJid: { accountId: account.id, remoteJid: JID_AMBIG } },
    });
    expect(conversation.customerId).toBeNull();
    expect(conversation.matchingStatus).toBe("AMBIGUOUS");

    const detail = await operatorAgent.get(`/api/v1/whatsapp/conversations/${conversation.id}`).expect(200);
    expect(detail.body.matchingStatus).toBe("AMBIGUOUS");
    expect(detail.body.candidates.map((c: { id: string }) => c.id).sort()).toEqual(
      [custAmb1Id, custAmb2Id].sort(),
    );

    const filtered = await operatorAgent
      .get("/api/v1/whatsapp/conversations?matchingStatus=AMBIGUOUS&limit=100")
      .expect(200);
    expect(filtered.body.some((row: { id: string }) => row.id === conversation.id)).toBe(true);

    // §25 ручной поиск клиента для link (без CRM Marketplace-scope фильтра):
    // телефон → оба кандидата; текст (код/имя) → один, без дублей; пусто → [].
    const byPhone = await operatorAgent
      .get(`/api/v1/whatsapp/customer-search?search=${encodeURIComponent(PHONE_AMBIG)}`)
      .expect(200);
    expect(byPhone.body.map((c: { id: string }) => c.id).sort()).toEqual(
      [custAmb1Id, custAmb2Id].sort(),
    );
    const byText = await operatorAgent
      .get("/api/v1/whatsapp/customer-search?search=WA3-amb1")
      .expect(200);
    expect(byText.body.map((c: { id: string }) => c.id)).toEqual([custAmb1Id]);
    const byEmpty = await operatorAgent.get("/api/v1/whatsapp/customer-search?search=").expect(200);
    expect(byEmpty.body).toEqual([]);

    // Ручной выбор (§25 link-customer, whatsapp.manage у OPERATOR) + audit §24.
    const linked = await operatorAgent
      .post(`/api/v1/whatsapp/conversations/${conversation.id}/customer`)
      .send({ customerId: custAmb1Id })
      .expect(200);
    expect(linked.body.matchingStatus).toBe("MATCHED");
    expect(linked.body.customer.id).toBe(custAmb1Id);

    const audits = await prisma.auditLog.findMany({
      where: { action: "whatsapp.customer_linked", createdAt: { gte: startedAt } },
    });
    expect(audits).toHaveLength(1);
    const details = JSON.stringify(audits[0]!.details ?? {});
    expect(details).toContain(custAmb1Id);
    expect(details).not.toContain(PHONE_AMBIG.replace("+", ""));

    const contact = await prisma.whatsAppContact.findUniqueOrThrow({
      where: { accountId_jid: { accountId: account.id, jid: JID_AMBIG } },
    });
    expect(contact.linkSource).toBe("MANUAL");

    // Прошлые сообщения диалога получают контекст-CUSTOMER pointer.
    const message = await prisma.whatsAppInboundMessage.findFirstOrThrow({
      where: { conversationId: conversation.id, providerMessageId: `w3-amb-${stamp}` },
    });
    const communication = await prisma.communication.findUniqueOrThrow({
      where: { id: message.communicationId! },
    });
    expect(communication.contextType).toBe("CUSTOMER");
    expect(communication.contextId).toBe(custAmb1Id);
  });

  // ── 7-8. fromMe §8 ────────────────────────────────────────────────────────

  it("7. §8 echo известного outbound → inbound-строка связана, Communication НЕ растёт", async () => {
    const send = await adminAgent
      .post("/api/v1/whatsapp/messages")
      .set("Idempotency-Key", `w3-echo-${stamp}`)
      .send({ text: "echo test", customerId: custMatchId, conversationId: matchConversationId })
      .expect(201);
    const outboundRow = await prisma.whatsAppOutboundMessage.findUniqueOrThrow({
      where: { id: send.body.outboundId },
    });
    expect(outboundRow.conversationId).toBe(matchConversationId);
    const comms = await commCount();

    const result = await inbound({
      providerMessageId: outboundRow.providerMessageId,
      remoteJid: outboundRow.recipientJid,
      fromMe: true,
      text: "echo test",
    });
    expect(result).toMatchObject({ outcome: "persisted", communicationId: outboundRow.communicationId });
    expect(await commCount()).toBe(comms);

    // Таймлайн: сообщение представлено ОДИН раз (без дубля echo-строки).
    const timeline = await operatorAgent
      .get(`/api/v1/whatsapp/conversations/${matchConversationId}/messages`)
      .expect(200);
    const copies = timeline.body.filter(
      (item: { communicationCode: string | null }) => item.communicationCode === send.body.communicationCode,
    );
    expect(copies).toHaveLength(1);
  });

  it("8. §8 fromMe вне TravelHUB → Communication OUTBOUND (sentOutsideTravelHub-marker = fromMe-строка)", async () => {
    const comms = await commCount();
    const result = await inbound({
      providerMessageId: `w3-outside-${stamp}`,
      remoteJid: JID_OUTSIDE,
      fromMe: true,
      text: "отправлено с телефона",
    });
    expect(result).toMatchObject({ outcome: "persisted" });
    expect(await commCount()).toBe(comms + 1);

    const account = await prisma.whatsAppAccount.findFirstOrThrow();
    const message = await prisma.whatsAppInboundMessage.findUniqueOrThrow({
      where: { accountId_providerMessageId: { accountId: account.id, providerMessageId: `w3-outside-${stamp}` } },
    });
    expect(message.fromMe).toBe(true);
    expect(message.communicationId).not.toBeNull();
    const communication = await prisma.communication.findUniqueOrThrow({
      where: { id: message.communicationId! },
    });
    expect(communication.direction).toBe("OUTBOUND");
    expect(communication.senderType).toBe("SYSTEM");
    expect(communication.body).toBe("отправлено с телефона");
  });

  // ── 9. Media / empty §21 ──────────────────────────────────────────────────

  it("9. §21 media/пустой текст → строка SKIPPED без Communication; превью [image]", async () => {
    const comms = await commCount();
    const media = await inbound({
      providerMessageId: `w3-media-${stamp}`,
      remoteJid: JID_MEDIA,
      type: "image",
      text: null,
    });
    const empty = await inbound({
      providerMessageId: `w3-empty-${stamp}`,
      remoteJid: JID_MEDIA,
      text: "   ",
    });
    expect(media).toMatchObject({ outcome: "persisted", processingStatus: "SKIPPED" });
    expect(empty).toMatchObject({ outcome: "persisted", processingStatus: "SKIPPED" });
    expect(await commCount()).toBe(comms);

    const account = await prisma.whatsAppAccount.findFirstOrThrow();
    const mediaRow = await prisma.whatsAppInboundMessage.findUniqueOrThrow({
      where: { accountId_providerMessageId: { accountId: account.id, providerMessageId: `w3-media-${stamp}` } },
    });
    expect(mediaRow.messageType).toBe("image");
    expect(mediaRow.text).toBeNull();
    expect(mediaRow.communicationId).toBeNull();

    const conversation = await prisma.whatsAppConversation.findUniqueOrThrow({
      where: { accountId_remoteJid: { accountId: account.id, remoteJid: JID_MEDIA } },
    });
    expect(conversation.lastMessagePreview).toBe("[image]");
  });

  // ── 10. §25 timeline/send/read ────────────────────────────────────────────

  it("10. §25 timeline: inbound+outbound одной историей, сортировка, статусы; read; 404/422-границы", async () => {
    const send = await adminAgent
      .post("/api/v1/whatsapp/messages")
      .set("Idempotency-Key", `w3-tl-${stamp}`)
      .send({ text: "ответ оператора", customerId: custMatchId, conversationId: matchConversationId })
      .expect(201);

    const timeline = await operatorAgent
      .get(`/api/v1/whatsapp/conversations/${matchConversationId}/messages?limit=50`)
      .expect(200);
    expect(timeline.body.length).toBeGreaterThanOrEqual(3);
    const times = timeline.body.map((item: { occurredAt: string }) => Date.parse(item.occurredAt));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    const outbound = timeline.body.filter((item: { origin: string }) => item.origin === "outbound");
    expect(outbound.length).toBeGreaterThanOrEqual(2);
    expect(outbound.some((item: { status: string }) => item.status === "SENT")).toBe(true);
    expect(timeline.body.some((item: { body: string }) => item.body === "это я")).toBe(true);

    // conversationId, не соответствующий получателю → 422.
    const account = await prisma.whatsAppAccount.findFirstOrThrow();
    const mediaConversation = await prisma.whatsAppConversation.findUniqueOrThrow({
      where: { accountId_remoteJid: { accountId: account.id, remoteJid: JID_MEDIA } },
    });
    await adminAgent
      .post("/api/v1/whatsapp/messages")
      .set("Idempotency-Key", `w3-mismatch-${stamp}`)
      .send({ text: "x", customerId: custMatchId, conversationId: mediaConversation.id })
      .expect(422);

    await operatorAgent
      .get("/api/v1/whatsapp/conversations/00000000-0000-0000-0000-000000000000")
      .expect(404);
    await operatorAgent
      .get("/api/v1/whatsapp/conversations/00000000-0000-0000-0000-000000000000/messages")
      .expect(404);
    await operatorAgent
      .post("/api/v1/whatsapp/conversations/00000000-0000-0000-0000-000000000000/read")
      .expect(404);
    await operatorAgent
      .post(`/api/v1/whatsapp/conversations/${matchConversationId}/customer`)
      .send({ customerId: "00000000-0000-0000-0000-000000000000" })
      .expect(404);

    // send.body.status — lifecycle M2 не изменился.
    expect(send.body.status).toBe("SENT");
  });

  // ── 11. §29 continuity ────────────────────────────────────────────────────

  it("11. §29 непрерывность: одна история через Request→Order→Booking→Customer; контекст §13 на лету", async () => {
    // Inbound «до» конвертаций.
    const msgA = await inbound({
      providerMessageId: `w3-flow-a-${stamp}`,
      remoteJid: JID_FLOW,
      text: "до оформления",
    });
    expect(msgA).toMatchObject({ outcome: "persisted", matchingStatus: "MATCHED" });

    const account = await prisma.whatsAppAccount.findFirstOrThrow();
    const conversation = await prisma.whatsAppConversation.findUniqueOrThrow({
      where: { accountId_remoteJid: { accountId: account.id, remoteJid: JID_FLOW } },
    });
    expect(conversation.customerId).toBe(custFlowId);

    const timelineIds = async (): Promise<string[]> => {
      const res = await operatorAgent
        .get(`/api/v1/whatsapp/conversations/${conversation.id}/messages?limit=50`)
        .expect(200);
      return res.body.map((item: { id: string }) => item.id);
    };
    const detail = async () => {
      const res = await operatorAgent.get(`/api/v1/whatsapp/conversations/${conversation.id}`).expect(200);
      return res.body.context as { type: string; code: string } | null;
    };

    // REQUEST context.
    const requestRow = await prisma.request.create({
      data: {
        code: `WA3-REQ-${stamp}`,
        commerceSequence: `${stamp}`.slice(-8).padStart(8, "1"),
        referenceNumber: `WA3-REQ-${stamp}`,
        customerId: custFlowId,
        status: "NEW",
      },
    });
    fixtureCodes.push(requestRow.code);
    expect((await detail())?.type).toBe("REQUEST");

    const beforeIds = await timelineIds();
    expect(beforeIds).toHaveLength(1);

    // ORDER context (приоритет над Request).
    const orderRow = await prisma.order.create({
      data: {
        code: `WA3-ORD-${stamp}`,
        number: `WA3-2026-${stamp}`,
        referenceNumber: `WA3-ORD-${stamp}`,
        customerId: custFlowId,
        status: "NEW",
      },
    });
    fixtureCodes.push(orderRow.code);
    expect((await detail())?.type).toBe("ORDER");

    // BOOKING context (приоритет над Order).
    const bookingRow = await prisma.booking.create({
      data: {
        code: `WA3-BKG-${stamp}`,
        referenceNumber: `WA3-BKG-${stamp}`,
        orderId: orderRow.id,
        productId: "wa3-fixture-product",
        status: "CONFIRMED",
      },
    });
    fixtureCodes.push(bookingRow.code);
    expect((await detail())?.type).toBe("BOOKING");

    // Inbound «после» конвертаций — история растёт, контекст не копируется.
    const msgB = await inbound({
      providerMessageId: `w3-flow-b-${stamp}`,
      remoteJid: JID_FLOW,
      text: "после оформления",
    });
    expect(msgB).toMatchObject({ outcome: "persisted" });

    const afterIds = await timelineIds();
    expect(afterIds.slice(0, beforeIds.length)).toEqual(beforeIds);
    expect(afterIds.length).toBe(beforeIds.length + 1);

    // Терминалы → контекст падает вниз, история НЕ меняется.
    await prisma.booking.update({ where: { id: bookingRow.id }, data: { status: "CANCELLED" } });
    await prisma.order.update({ where: { id: orderRow.id }, data: { status: "CLOSED" } });
    expect((await detail())?.type).toBe("REQUEST");

    await prisma.request.update({
      where: { id: requestRow.id },
      data: { status: "CONVERTED", convertedOrderId: orderRow.id, convertedAt: new Date() },
    });
    const finalContext = await detail();
    expect(finalContext?.type).toBe("CUSTOMER");
    expect(finalContext?.code).toMatch(/^WA3-/);

    expect(await timelineIds()).toEqual(afterIds);
  });

  // ── 12. Suppression §22 ───────────────────────────────────────────────────

  it("12. §22 STOP → suppression+audit; отправка подавленному → 409 + audit", async () => {
    const result = await inbound({
      providerMessageId: `w3-stop-${stamp}`,
      remoteJid: JID_MATCH,
      text: "СТОП",
    });
    expect(result).toMatchObject({ outcome: "persisted", suppressed: true });

    const suppression = await prisma.whatsAppSuppression.findUnique({
      where: { canonicalPhone: PHONE_MATCH },
    });
    expect(suppression).toBeTruthy();
    expect(suppression!.reason).toBe("СТОП");
    expect(suppression!.scope).toBe("ALL");

    const audits = await prisma.auditLog.findMany({
      where: { action: "whatsapp.suppression.added", createdAt: { gte: startedAt } },
    });
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits[0]!.details ?? {})).not.toContain(PHONE_MATCH.replace("+", ""));

    await adminAgent
      .post("/api/v1/whatsapp/messages")
      .set("Idempotency-Key", `w3-sup-${stamp}`)
      .send({ text: "не должно уйти", customerId: custMatchId })
      .expect(409);

    const blocked = await prisma.auditLog.findMany({
      where: { action: "whatsapp.send.suppressed", createdAt: { gte: startedAt } },
    });
    expect(blocked).toHaveLength(1);
    // Ничего не создано после блокировки (2 успешные отправки были ДО STOP).
    const all = await prisma.whatsAppOutboundMessage.findMany({
      where: { recipientPhone: PHONE_MATCH, createdAt: { gte: startedAt } },
      orderBy: { createdAt: "asc" },
    });
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all.every((row) => !(row.createdAt > blocked[0]!.createdAt))).toBe(true);
  });
});
