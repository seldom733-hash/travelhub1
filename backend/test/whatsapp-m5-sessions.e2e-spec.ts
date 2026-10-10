/**
 * M5 e2e — несколько WhatsApp-номеров одновременно + мягкое архивирование.
 *
 *  1.  RBAC: anonymous 401, BUYER 403, OPERATOR читает список;
 *  2.  POST /whatsapp/sessions — новый номер (label trim, DISCONNECTED,
 *      audit whatsapp.account_created); список/получение одного номера, 404;
 *  3.  POST /sessions/:id/connect — confirm-gating + audit whatsapp.connected
 *      ИМЕННО этого номера (resourceId = accountId);
 *  4.  inbound с РАЗНЫХ номеров → диалоги с соответствующим accountId;
 *      GET /conversations?accountId= фильтрует по номеру;
 *  5.  GET /sessions/:id/qr — 409 вне QR_REQUIRED; 404 для неизвестного id;
 *  6.  POST /sessions/:id/disconnect — audit whatsapp.disconnected этого номера;
 *  7.  POST /sessions/:id/archive — confirm-gating (422), архивирование:
 *      archivedAt, контекст снят, повторный archive идемпотентен, операции
 *      с архивным номером → 409, audit whatsapp.archived;
 *  8.  история цела после archive: диалог/таймлайн/inbound-сообщение на месте
 *      и по accountId, и без фильтра;
 *  9.  исходящее после archive уходит на primary-номер (не на архивный);
 *  10. legacy-роуты по-прежнему работают с primary-номером.
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
import { WhatsAppSessionRegistryService } from "../src/integrations/whatsapp/session/session-registry.service";
import type { MockWhatsAppProvider } from "../src/integrations/whatsapp/provider/mock/mock-whatsapp.provider";

const stamp = Date.now();
const sessionPath = mkdtempSync(join(tmpdir(), "wa5-e2e-"));
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

const JID_PRIMARY = `9945066${String(stamp).slice(-6)}@s.whatsapp.net`;
const JID_SECOND = `9945077${String(stamp).slice(-6)}@s.whatsapp.net`;
const SEND_PHONE = "+994501999999";

interface Session {
  accessToken: string;
  user: { id: string; role: string; customerId: string | null; permissions: string[] };
}

interface AccountRow {
  id: string;
  label: string | null;
  archivedAt: string | null;
  state?: string;
  status?: { state: string; enabled: boolean };
}

describe("M5 — WhatsApp multi-number sessions (e2e, mock provider)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let registry: WhatsAppSessionRegistryService;
  let primaryProvider: MockWhatsAppProvider;
  let adminAgent: ReturnType<typeof request.agent>;
  let operatorToken: string;
  let buyerToken: string;
  let startedAt: Date;
  let primaryId: string;
  let secondId: string;
  let secondConvId: string;
  let primaryConvId: string;
  const createdUsers: string[] = [];
  const outboundIds: string[] = [];
  const commCodes: string[] = [];

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  const auditRows = (action: string) =>
    prisma.auditLog.findMany({ where: { action, createdAt: { gte: startedAt } }, orderBy: { createdAt: "asc" } });

  const pollDb = async (predicate: () => Promise<boolean>, timeoutMs = 4000): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await predicate()) return true;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return predicate();
  };

  const conversationOf = (accountId: string, remoteJid: string) =>
    prisma.whatsAppConversation.findUnique({
      where: { accountId_remoteJid: { accountId, remoteJid } },
    });

  beforeAll(async () => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    startedAt = new Date();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    prisma = moduleRef.get(PrismaService);
    registry = moduleRef.get(WhatsAppSessionRegistryService, { strict: false });
    primaryProvider = moduleRef.get<MockWhatsAppProvider>(WHATSAPP_PROVIDER, { strict: false });
    await app.init();

    const admin = await login("admin", "admin123");
    adminAgent = agent(admin.accessToken);
    createdUsers.push(admin.user.id);

    const operator = (
      await adminAgent
        .post("/api/v1/users")
        .send({ username: `wa_m5_op_${stamp}`, password: "operpass123", roleCode: RoleCode.OPERATOR })
        .expect(201)
    ).body as { id: string };
    createdUsers.push(operator.id);
    operatorToken = (await login(`wa_m5_op_${stamp}`, "operpass123")).accessToken;

    const buyerRes = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        username: `wa_m5_buy_${stamp}`,
        email: `wa_m5_buy_${stamp}@test.local`,
        password: "buyerpass123",
        firstName: "Buyer",
        lastName: "WA5",
      })
      .expect(201);
    const buyer = buyerRes.body as Session;
    createdUsers.push(buyer.user.id);
    buyerToken = buyer.accessToken;

    // Primary-номер создаётся лениво (ensurePrimaryAccountId) и подключается
    // через legacy-роут — до создания второго номера, чтобы контекст primary
    // был построенным первым.
    const status = await adminAgent.get("/api/v1/whatsapp/status").expect(200);
    expect(status.body.state).toBe("DISCONNECTED");
    await adminAgent.post("/api/v1/whatsapp/connect").send({ confirm: true }).expect(200);
    const primary = await prisma.whatsAppAccount.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    primaryId = primary.id;
    expect(primaryProvider.getSnapshot().state).toBe("CONNECTED");
  });

  afterAll(async () => {
    const accountIds = await prisma.whatsAppAccount
      .findMany({ select: { id: true } })
      .then((rows) => rows.map((row) => row.id));
    await prisma.whatsAppInboundMessage.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.whatsAppOutboundMessage.deleteMany({ where: { id: { in: outboundIds } } });
    await prisma.whatsAppOutboundMessage.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.whatsAppConversation.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.whatsAppContact.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.communication.deleteMany({
      where: { channel: "WHATSAPP", createdAt: { gte: startedAt } },
    });
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
    await http.get("/api/v1/whatsapp/sessions").expect(401);
    await http.post("/api/v1/whatsapp/sessions").send({ label: "x" }).expect(401);
    await http.get("/api/v1/whatsapp/sessions/any").expect(401);
    await http.post("/api/v1/whatsapp/sessions/any/connect").send({ confirm: true }).expect(401);
    await http.post("/api/v1/whatsapp/sessions/any/archive").send({ confirm: true }).expect(401);

    await agent(buyerToken).get("/api/v1/whatsapp/sessions").expect(403);
    await agent(buyerToken).post("/api/v1/whatsapp/sessions").send({ label: "x" }).expect(403);
    await agent(buyerToken).post("/api/v1/whatsapp/sessions/any/archive").send({ confirm: true }).expect(403);

    await agent(operatorToken).get("/api/v1/whatsapp/sessions").expect(200);
  });

  // ── 2. Создание номера + список ──────────────────────────────────────────

  it("2. POST sessions: label trim + DISCONNECTED + audit; list; 404 для неизвестного", async () => {
    const created = await adminAgent
      .post("/api/v1/whatsapp/sessions")
      .send({ label: "  Второй номер  " })
      .expect(201);
    const account = created.body.account as AccountRow;
    secondId = account.id;
    expect(account.label).toBe("Второй номер");
    expect(account.archivedAt).toBeNull();
    expect(account.status?.state).toBe("DISCONNECTED");
    expect(secondId).not.toBe(primaryId);

    const audits = await auditRows("whatsapp.account_created");
    expect(audits.length).toBe(1);
    expect(audits[0]!.resourceId).toBe(secondId);

    const list = await adminAgent.get("/api/v1/whatsapp/sessions").expect(200);
    const accounts = list.body.accounts as AccountRow[];
    expect(accounts).toHaveLength(2);
    expect(accounts.find((row) => row.id === primaryId)).toBeTruthy();
    const second = accounts.find((row) => row.id === secondId)!;
    expect(second.archivedAt).toBeNull();
    expect(second.status?.state).toBe("DISCONNECTED");
    // primary подключён в beforeAll и остался CONNECTED
    expect(accounts.find((row) => row.id === primaryId)!.status?.state).toBe("CONNECTED");

    const one = await adminAgent.get(`/api/v1/whatsapp/sessions/${secondId}`).expect(200);
    expect((one.body.account as AccountRow).id).toBe(secondId);

    await adminAgent.get("/api/v1/whatsapp/sessions/does-not-exist").expect(404);
  });

  // ── 3. Connect конкретного номера ────────────────────────────────────────

  it("3. connect: confirm обязателен (422); success → CONNECTED именно этого номера + audit", async () => {
    await adminAgent.post(`/api/v1/whatsapp/sessions/${secondId}/connect`).send({ confirm: false }).expect(422);

    const res = await adminAgent
      .post(`/api/v1/whatsapp/sessions/${secondId}/connect`)
      .send({ confirm: true })
      .expect(200);
    expect(res.body.state).toBe("CONNECTED");

    const ctx = registry.get(secondId);
    expect(ctx).toBeTruthy();
    expect(ctx!.provider.getSnapshot().state).toBe("CONNECTED");

    const audits = await auditRows("whatsapp.connected");
    const forSecond = audits.filter((row) => row.resourceId === secondId);
    const forPrimary = audits.filter((row) => row.resourceId === primaryId);
    expect(forSecond).toHaveLength(1);
    expect(forPrimary).toHaveLength(1); // legacy connect в beforeAll

    // Независимость: оба номера подключены одновременно.
    const primaryCtx = registry.get(primaryId);
    expect(primaryCtx!.provider.getSnapshot().state).toBe("CONNECTED");
  });

  // ── 4. Inbound с разных номеров ──────────────────────────────────────────

  it("4. inbound каждого номера → диалог со своим accountId; фильтр ?accountId=", async () => {
    const secondCtx = registry.get(secondId)!;
    (secondCtx.provider as unknown as MockWhatsAppProvider).driveInbound({
      providerMessageId: `m5-second-${stamp}`,
      remoteJid: JID_SECOND,
      text: `Сообщение со второго номера ${stamp}`,
    });
    const primaryCtx = registry.get(primaryId)!;
    (primaryCtx.provider as unknown as MockWhatsAppProvider).driveInbound({
      providerMessageId: `m5-primary-${stamp}`,
      remoteJid: JID_PRIMARY,
      text: `Сообщение с primary ${stamp}`,
    });

    const foundSecond = await pollDb(async () => (await conversationOf(secondId, JID_SECOND)) !== null);
    const foundPrimary = await pollDb(async () => (await conversationOf(primaryId, JID_PRIMARY)) !== null);
    expect(foundSecond).toBe(true);
    expect(foundPrimary).toBe(true);

    const secondConv = await conversationOf(secondId, JID_SECOND);
    const primaryConv = await conversationOf(primaryId, JID_PRIMARY);
    secondConvId = secondConv!.id;
    primaryConvId = primaryConv!.id;
    expect(secondConv!.matchingStatus).toBe("UNMATCHED");
    expect(primaryConv!.matchingStatus).toBe("UNMATCHED");

    const all = await adminAgent.get("/api/v1/whatsapp/conversations?limit=100").expect(200);
    expect(all.body.find((row: { id: string }) => row.id === secondConvId)).toBeTruthy();
    expect(all.body.find((row: { id: string }) => row.id === primaryConvId)).toBeTruthy();

    const onlySecond = await adminAgent
      .get(`/api/v1/whatsapp/conversations?limit=100&accountId=${secondId}`)
      .expect(200);
    expect(onlySecond.body).toHaveLength(1);
    expect(onlySecond.body[0].id).toBe(secondConvId);
    expect(onlySecond.body[0].accountId).toBe(secondId);

    const onlyPrimary = await adminAgent
      .get(`/api/v1/whatsapp/conversations?limit=100&accountId=${primaryId}`)
      .expect(200);
    expect(onlyPrimary.body).toHaveLength(1);
    expect(onlyPrimary.body[0].id).toBe(primaryConvId);

    const timeline = await adminAgent.get(`/api/v1/whatsapp/conversations/${secondConvId}/messages`).expect(200);
    const texts = JSON.stringify(timeline.body);
    expect(texts).toContain(`Сообщение со второго номера ${stamp}`);
  });

  // ── 5. QR конкретного номера ─────────────────────────────────────────────

  it("5. GET /sessions/:id/qr: 409 вне QR_REQUIRED; 404 для неизвестного id", async () => {
    await adminAgent.get(`/api/v1/whatsapp/sessions/${secondId}/qr`).expect(409);
    await adminAgent.get("/api/v1/whatsapp/sessions/does-not-exist/qr").expect(404);
  });

  // ── 6. Disconnect конкретного номера ─────────────────────────────────────

  it("6. disconnect второго номера → DISCONNECTED + audit этого номера", async () => {
    const res = await adminAgent
      .post(`/api/v1/whatsapp/sessions/${secondId}/disconnect`)
      .expect(200);
    expect(res.body.state).toBe("DISCONNECTED");
    expect(registry.get(secondId)!.provider.getSnapshot().state).toBe("DISCONNECTED");

    const audits = await auditRows("whatsapp.disconnected");
    expect(audits.filter((row) => row.resourceId === secondId)).toHaveLength(1);
    // primary остаётся CONNECTED
    expect(registry.get(primaryId)!.provider.getSnapshot().state).toBe("CONNECTED");
  });

  // ── 7. Архивирование ─────────────────────────────────────────────────────

  it("7. archive: confirm 422; успех → archivedAt + контекст снят; повтор идемпотентен; 409 после", async () => {
    await adminAgent.post(`/api/v1/whatsapp/sessions/${secondId}/archive`).send({ confirm: false }).expect(422);

    const res = await adminAgent
      .post(`/api/v1/whatsapp/sessions/${secondId}/archive`)
      .send({ confirm: true })
      .expect(200);
    expect(res.body.state).toBe("DISCONNECTED");

    const row = await prisma.whatsAppAccount.findUniqueOrThrow({ where: { id: secondId } });
    expect(row.archivedAt).not.toBeNull();
    expect(row.state).toBe("DISCONNECTED");
    expect(registry.get(secondId)).toBeUndefined();

    const audits = await auditRows("whatsapp.archived");
    expect(audits.filter((r) => r.resourceId === secondId)).toHaveLength(1);

    // Архивный номер остаётся в списке — история и метаданные не теряются.
    const list = await adminAgent.get("/api/v1/whatsapp/sessions").expect(200);
    const archived = (list.body.accounts as AccountRow[]).find((acc) => acc.id === secondId)!;
    expect(archived).toBeTruthy();
    expect(archived.archivedAt).not.toBeNull();

    // Идемпотентный повтор: 200, второй audit НЕ появляется.
    const again = await adminAgent
      .post(`/api/v1/whatsapp/sessions/${secondId}/archive`)
      .send({ confirm: true })
      .expect(200);
    expect(again.body.state).toBe("DISCONNECTED");
    expect((await auditRows("whatsapp.archived")).filter((r) => r.resourceId === secondId)).toHaveLength(1);

    // Операции с архивным номером → 409 (archived), 404 не предусмотрен.
    await adminAgent.post(`/api/v1/whatsapp/sessions/${secondId}/connect`).send({ confirm: true }).expect(409);
    await adminAgent.post(`/api/v1/whatsapp/sessions/${secondId}/disconnect`).expect(409);

    const one = await adminAgent.get(`/api/v1/whatsapp/sessions/${secondId}`).expect(200);
    expect((one.body.account as AccountRow).archivedAt).not.toBeNull();
  });

  // ── 8. История после архивирования ───────────────────────────────────────

  it("8. история цела после archive: диалог, таймлайн и inbound-сообщение на месте", async () => {
    const conv = await conversationOf(secondId, JID_SECOND);
    expect(conv).not.toBeNull();
    expect(conv!.id).toBe(secondConvId);

    const message = await prisma.whatsAppInboundMessage.findUnique({
      where: { accountId_providerMessageId: { accountId: secondId, providerMessageId: `m5-second-${stamp}` } },
    });
    expect(message).not.toBeNull();
    expect(message!.communicationId).not.toBeNull();

    const filtered = await adminAgent
      .get(`/api/v1/whatsapp/conversations?limit=100&accountId=${secondId}`)
      .expect(200);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].id).toBe(secondConvId);

    const all = await adminAgent.get("/api/v1/whatsapp/conversations?limit=100").expect(200);
    expect(all.body.find((row: { id: string }) => row.id === secondConvId)).toBeTruthy();

    const timeline = await adminAgent.get(`/api/v1/whatsapp/conversations/${secondConvId}/messages`).expect(200);
    expect(JSON.stringify(timeline.body)).toContain(`Сообщение со второго номера ${stamp}`);
  });

  // ── 9. Outbound после архивирования ──────────────────────────────────────

  it("9. POST messages после archive → отправка уходит на primary-номер (не архивный)", async () => {
    const key = `wa-m5-send-${stamp}`;
    const res = await adminAgent
      .post("/api/v1/whatsapp/messages")
      .set("Idempotency-Key", key)
      .send({ text: `Привет после архива ${stamp}`, phone: SEND_PHONE })
      .expect(201);
    outboundIds.push(res.body.outboundId);
    commCodes.push(res.body.communicationCode);
    expect(res.body.status).toBe("SENT");

    const row = await prisma.whatsAppOutboundMessage.findUniqueOrThrow({ where: { id: res.body.outboundId } });
    expect(row.accountId).toBe(primaryId);
    expect(row.accountId).not.toBe(secondId);

    const audits = await auditRows("whatsapp.send");
    expect(audits.length).toBe(1);
  });

  // ── 10. Legacy-роуты.primary не задет ────────────────────────────────────

  it("10. legacy status/disconnect работают с primary-номером (не с архивным)", async () => {
    const status = await adminAgent.get("/api/v1/whatsapp/status").expect(200);
    expect(status.body.state).toBe("CONNECTED");

    const res = await adminAgent.post("/api/v1/whatsapp/disconnect").expect(200);
    expect(res.body.state).toBe("DISCONNECTED");

    const audits = await auditRows("whatsapp.disconnected");
    const legacyDisconnect = audits.filter((row) => row.resourceId === primaryId);
    expect(legacyDisconnect).toHaveLength(1);

    const list = await adminAgent.get("/api/v1/whatsapp/sessions").expect(200);
    const accounts = list.body.accounts as AccountRow[];
    expect(accounts).toHaveLength(2);
    const archivedRows = accounts.filter((acc) => acc.archivedAt !== null);
    expect(archivedRows.map((acc) => acc.id)).toEqual([secondId]);
    expect(commCodes.length).toBeGreaterThan(0);
  });
});
