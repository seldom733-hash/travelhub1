/**
 * M2 e2e — WhatsApp §6.4 REST API + outbound lifecycle (mock provider).
 *
 * Owner scope M2 (без notification/inbound/media/frontend):
 *  1.  auth/RBAC gate: anonymous 401, BUYER 403, OPERATOR/ADMIN по правам §6.4;
 *  2.  GET status — enabled/provider/state/hasQr без QR/phone-секретов;
 *  3.  connect/disconnect/logout/session-reset — confirm-gating (422) +
 *      audit whatsapp.connected/.disconnected/.logout/.session_reset (без QR);
 *  4.  GET qr — только в QR_REQUIRED (409 иначе), rate-limit 429 (max=10),
 *      QR не аудируется и не пишется в БД;
 *  5.  POST messages — Idempotency-Key обязателен (400), forbidden keys 422,
 *      XOR recipient 422, длина 422/400, 201 → SENT, audit whatsapp.send
 *      БЕЗ текста/телефона, replay того же ключа = тот же outboundId,
 *      divergent reuse → 409;
 *  6.  delivery receipts: delivered/read → статус+evidence (DELIVERED/READ);
 *  7.  crash→UNKNOWN → recover: mark-failed / retry-anyway (confirm 422,
 *      аудит retry_anyway с duplicateDeliveryPossible), non-UNKNOWN → 409,
 *      missing → 404, OPERATOR → 403 (только whatsapp.send.recover);
 *  8.  GET messages — операционный список без recipientPhone.
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
import { WhatsAppOutboundService } from "../src/integrations/whatsapp/outbound/outbound.service";
import type { MockWhatsAppProvider } from "../src/integrations/whatsapp/provider/mock/mock-whatsapp.provider";

interface Session {
  accessToken: string;
  user: { id: string; role: string; customerId: string | null; permissions: string[] };
}

const stamp = Date.now();
const sessionPath = mkdtempSync(join(tmpdir(), "wa-e2e-"));
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

describe("M2 — WhatsApp §6.4 (e2e, mock provider)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let provider: MockWhatsAppProvider;
  let outboundService: WhatsAppOutboundService;
  let adminAgent: ReturnType<typeof request.agent>;
  let operatorToken: string;
  let buyerToken: string;
  let startedAt: Date;
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

  const sendBody = (text: string, extra: Record<string, unknown> = {}) => ({ text, phone: "+994501234567", ...extra });

  const auditRows = (action: string) =>
    prisma.auditLog.findMany({ where: { action, createdAt: { gte: startedAt } }, orderBy: { createdAt: "asc" } });

  const pollDb = async (predicate: () => Promise<boolean>, timeoutMs = 3000): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await predicate()) return true;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return predicate();
  };

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
    outboundService = moduleRef.get(WhatsAppOutboundService, { strict: false });
    await app.init();

    const admin = await login("admin", "admin123");
    adminAgent = agent(admin.accessToken);
    createdUsers.push(admin.user.id);

    const operator = (
      await adminAgent.post("/api/v1/users").send({ username: `wa_m2_op_${stamp}`, password: "operpass123", roleCode: RoleCode.OPERATOR }).expect(201)
    ).body as { id: string };
    createdUsers.push(operator.id);
    operatorToken = (await login(`wa_m2_op_${stamp}`, "operpass123")).accessToken;

    const buyerRes = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        username: `wa_m2_buy_${stamp}`,
        email: `wa_m2_buy_${stamp}@test.local`,
        password: "buyerpass123",
        firstName: "Buyer",
        lastName: "WA",
      })
      .expect(201);
    const buyer = buyerRes.body as Session;
    createdUsers.push(buyer.user.id);
    buyerToken = buyer.accessToken;

    // Гарантия стартового состояния (autoConnect=false).
    expect(provider.getSnapshot().state).toBe("DISCONNECTED");
  });

  afterAll(async () => {
    await prisma.whatsAppOutboundMessage.deleteMany({ where: { id: { in: outboundIds } } });
    await prisma.communication.deleteMany({ where: { code: { in: commCodes } } });
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

  // ── 1. Auth / RBAC gates ───────────────────────────────────────────────────

  it("1. anonymous → 401 на все §6.4 endpoints", async () => {
    const http = request(app.getHttpServer());
    await http.get("/api/v1/whatsapp/status").expect(401);
    await http.get("/api/v1/whatsapp/qr").expect(401);
    await http.get("/api/v1/whatsapp/messages").expect(401);
    await http.post("/api/v1/whatsapp/connect").send({ confirm: true }).expect(401);
    await http.post("/api/v1/whatsapp/disconnect").send({}).expect(401);
    await http.post("/api/v1/whatsapp/logout").send({ confirm: true }).expect(401);
    await http.post("/api/v1/whatsapp/session-reset").send({ confirm: true }).expect(401);
    await http.post("/api/v1/whatsapp/messages").send({ text: "x", phone: "+994501234567" }).expect(401);
    await http.post("/api/v1/whatsapp/messages/any/recover").send({ action: "reconcile" }).expect(401);
  });

  it("2. RBAC: BUYER → 403; OPERATOR читает status; права §6.4 у роли есть", async () => {
    await agent(buyerToken).get("/api/v1/whatsapp/status").expect(403);
    await agent(buyerToken).post("/api/v1/whatsapp/connect").send({ confirm: true }).expect(403);
    await agent(buyerToken).post("/api/v1/whatsapp/messages").set("Idempotency-Key", `wa-e2e-buy-${stamp}`).send(sendBody("hi")).expect(403);

    const status = await agent(operatorToken).get("/api/v1/whatsapp/status").expect(200);
    expect(status.body.enabled).toBe(true);
    expect(status.body.provider).toBe("mock");
    expect(status.body.state).toBe("DISCONNECTED");
    expect(status.body.hasQr).toBe(false);
    expect(status.body.phone).toBeNull();
    expect(status.body.reconnect.maxAttempts).toBeGreaterThan(0);

    const adminStatus = await adminAgent.get("/api/v1/whatsapp/status").expect(200);
    expect(adminStatus.body.enabled).toBe(true);
    // WhatsAppAccount row создаётся при первом status (fail-closed выключено — не создаёт).
    expect(await prisma.whatsAppAccount.count()).toBe(1);
  });

  // ── 3-4. connect / disconnect + audit ──────────────────────────────────────

  it("3. connect: без confirm → 400/422; confirm=true → CONNECTED + audit whatsapp.connected (без QR/телефона)", async () => {
    // Пустой body ловит ValidationPipe (400); confirm=false доходит до
    // доменного confirm-gating (422).
    await adminAgent.post("/api/v1/whatsapp/connect").send({}).expect(400);
    await adminAgent.post("/api/v1/whatsapp/connect").send({ confirm: false }).expect(422);
    expect(provider.getSnapshot().state).toBe("DISCONNECTED");

    const res = await adminAgent.post("/api/v1/whatsapp/connect").send({ confirm: true }).expect(200);
    expect(res.body.state).toBe("CONNECTED");
    expect(res.body.hasQr).toBe(false);

    const rows = await auditRows("whatsapp.connected");
    expect(rows.length).toBe(1);
    expect(rows[0]!.userId).not.toBeNull();
    const details = JSON.stringify(rows[0]!.details ?? {});
    expect(details).not.toContain("mock-qr");
    expect(details).not.toContain("+994");
    expect(details).toContain("fencingToken");
  });

  it("4. disconnect → DISCONNECTED + audit whatsapp.disconnected", async () => {
    const res = await adminAgent.post("/api/v1/whatsapp/disconnect").send({}).expect(200);
    expect(res.body.state).toBe("DISCONNECTED");
    expect((await auditRows("whatsapp.disconnected")).length).toBe(1);
  });

  // ── 5. QR: доступ только в QR_REQUIRED + rate-limit + no-audit ─────────────

  it("5. GET qr: 409 вне QR_REQUIRED; в QR_REQUIRED — 200 без audit; 11-й запрос → 429", async () => {
    // 409-проба отдельным пользователем: rate-limit слушателя per-user, а
    // успешные 10 запросов админа должны уложиться в окно max=10.
    await agent(operatorToken).get("/api/v1/whatsapp/qr").expect(409);

    provider.driveState("INITIALIZING");
    provider.driveState("QR_REQUIRED");
    expect(provider.getSnapshot().qr).not.toBeNull();

    const auditBefore = (await prisma.auditLog.count({ where: { action: { startsWith: "whatsapp." } } })) as number;
    for (let i = 0; i < 10; i++) {
      const res = await adminAgent.get("/api/v1/whatsapp/qr").expect(200);
      expect(res.body.qr).toMatch(/^mock-qr-/);
    }
    await adminAgent.get("/api/v1/whatsapp/qr").expect(429);
    // QR не аудируется и не персистится.
    expect(await prisma.auditLog.count({ where: { action: { startsWith: "whatsapp." } } })).toBe(auditBefore);
    const account = await prisma.whatsAppAccount.findFirst();
    expect(JSON.stringify(account ?? {})).not.toContain("mock-qr");
  });

  it("6. logout: confirm обязателен; success → DISCONNECTED + audit whatsapp.logout", async () => {
    await adminAgent.post("/api/v1/whatsapp/logout").send({ confirm: false }).expect(422);
    const res = await adminAgent.post("/api/v1/whatsapp/logout").send({ confirm: true }).expect(200);
    expect(res.body.state).toBe("DISCONNECTED");
    expect((await auditRows("whatsapp.logout")).length).toBe(1);
  });

  it("7. session-reset: confirm обязателен; success локально wipe + audit whatsapp.session_reset", async () => {
    provider.driveState("INITIALIZING");
    provider.driveState("QR_REQUIRED");
    await adminAgent.post("/api/v1/whatsapp/session-reset").send({}).expect(400);
    await adminAgent.post("/api/v1/whatsapp/session-reset").send({ confirm: false }).expect(422);
    const res = await adminAgent.post("/api/v1/whatsapp/session-reset").send({ confirm: true }).expect(200);
    expect(res.body.state).toBe("DISCONNECTED");
    const rows = await auditRows("whatsapp.session_reset");
    expect(rows.length).toBe(1);
    expect(JSON.stringify(rows[0]!.details ?? {})).toContain("wipedLocalSession");
  });

  // ── 8-9. Outbound: validation + success + audit PII-free ───────────────────

  it("8. POST messages: нет Idempotency-Key → 400; forbidden keys → 422; XOR/длина → 422/400", async () => {
    await adminAgent.post("/api/v1/whatsapp/connect").send({ confirm: true }).expect(200);

    // Интерсептор требует валидный ключ ДО контроллера.
    await adminAgent.post("/api/v1/whatsapp/messages").send(sendBody("hello")).expect(400);

    await adminAgent
      .post("/api/v1/whatsapp/messages")
      .set("Idempotency-Key", `wa-e2e-forbidden-${stamp}`)
      .send(sendBody("hello", { status: "SENT" }))
      .expect(422);
    await adminAgent
      .post("/api/v1/whatsapp/messages")
      .set("Idempotency-Key", `wa-e2e-both-${stamp}`)
      .send(sendBody("hello", { customerId: "cus-1" }))
      .expect(422);
    await adminAgent
      .post("/api/v1/whatsapp/messages")
      .set("Idempotency-Key", `wa-e2e-none-${stamp}`)
      .send({ text: "hello" })
      .expect(422);
    await adminAgent
      .post("/api/v1/whatsapp/messages")
      .set("Idempotency-Key", `wa-e2e-len-${stamp}`)
      .send({ text: "x".repeat(4001), phone: "+994501234567" })
      .expect(400);
    await adminAgent
      .post("/api/v1/whatsapp/messages")
      .set("Idempotency-Key", `wa-e2e-customer404-${stamp}`)
      .send({ text: "hello", customerId: "00000000-0000-0000-0000-000000000000" })
      .expect(404);
    // Отправка без CONNECTED невозможна (state после connect=CONNECTED — провалидируем отдельно ниже).
    expect(provider.getSnapshot().state).toBe("CONNECTED");
  });

  it("9. POST messages success → 201 SENT + CML-код + audit whatsapp.send без текста/телефона", async () => {
    const key = `wa-e2e-send-${stamp}`;
    const res = await adminAgent.post("/api/v1/whatsapp/messages").set("Idempotency-Key", key).send(sendBody("Привет из M2 e2e")).expect(201);
    expect(res.body.status).toBe("SENT");
    expect(res.body.communicationCode).toMatch(/^CML-/);
    // Канонический id: сгенерирован И сохранён ДО отправки (at-most-once).
    expect(res.body.providerMessageId).toMatch(/^3EB0[0-9A-F]{36}$/);
    outboundIds.push(res.body.outboundId);
    commCodes.push(res.body.communicationCode);

    const row = await prisma.whatsAppOutboundMessage.findUniqueOrThrow({ where: { id: res.body.outboundId } });
    expect(row.status).toBe("SENT");
    expect(row.sentAt).not.toBeNull();
    expect(row.providerMessageId).toBe(res.body.providerMessageId);
    expect(row.operationKey).toBe(key);
    expect(row.fencingToken).toBeGreaterThanOrEqual(1);

    const communication = await prisma.communication.findUniqueOrThrow({ where: { id: row.communicationId } });
    expect(communication.channel).toBe("WHATSAPP");
    expect(communication.direction).toBe("OUTBOUND");

    const audits = await auditRows("whatsapp.send");
    expect(audits.length).toBe(1);
    const details = JSON.stringify(audits[0]!.details ?? {});
    expect(details).not.toContain("Привет из M2 e2e");
    expect(details).not.toContain("+994501234567");
    expect(details).toContain(res.body.communicationCode);
  });

  it("10. Идемпотентность: replay ключа → тот же outboundId, divergent reuse → 409", async () => {
    const key = `wa-e2e-idem-${stamp}`;
    const first = await adminAgent.post("/api/v1/whatsapp/messages").set("Idempotency-Key", key).send(sendBody("idem-A")).expect(201);
    outboundIds.push(first.body.outboundId);
    commCodes.push(first.body.communicationCode);

    const replay = await adminAgent.post("/api/v1/whatsapp/messages").set("Idempotency-Key", key).send(sendBody("idem-A")).expect(201);
    expect(replay.body.outboundId).toBe(first.body.outboundId);

    await adminAgent.post("/api/v1/whatsapp/messages").set("Idempotency-Key", key).send(sendBody("ДРУГОЙ ТЕКСТ")).expect(409);
  });

  it("11. OPERATOR с whatsapp.send может отправлять; BUYER получает 403", async () => {
    const res = await agent(operatorToken)
      .post("/api/v1/whatsapp/messages")
      .set("Idempotency-Key", `wa-e2e-op-${stamp}`)
      .send(sendBody("operator send"))
      .expect(201);
    outboundIds.push(res.body.outboundId);
    commCodes.push(res.body.communicationCode);

    await agent(buyerToken).post("/api/v1/whatsapp/messages").set("Idempotency-Key", `wa-e2e-buy2-${stamp}`).send(sendBody("buyer")).expect(403);
    // OPERATOR без whatsapp.send.recover → 403 на recover.
    await agent(operatorToken)
      .post(`/api/v1/whatsapp/messages/${res.body.outboundId}/recover`)
      .send({ action: "reconcile" })
      .expect(403);
  });

  // ── 12. List ───────────────────────────────────────────────────────────────

  it("12. GET messages: 200, без recipientPhone, limit-валидация 400", async () => {
    const res = await adminAgent.get("/api/v1/whatsapp/messages?limit=5").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const mine = res.body.find((entry: { id: string }) => entry.id === outboundIds[0]);
    expect(mine).toBeDefined();
    expect(mine.status).toBe("SENT");
    expect(mine.communicationCode).toBe(commCodes[0]);
    expect(Object.keys(mine)).not.toContain("recipientPhone");
    expect(Object.keys(mine)).not.toContain("recipientJid");

    await adminAgent.get("/api/v1/whatsapp/messages?limit=0").expect(400);
  });

  // ── 13. Delivery receipts ──────────────────────────────────────────────────

  it("13. Delivery receipts: delivered → DELIVERED+deliveredAt; read → READ+readAt", async () => {
    const row = await prisma.whatsAppOutboundMessage.findUniqueOrThrow({ where: { id: outboundIds[0]! } });
    provider.driveDelivery({ providerMessageId: row.providerMessageId!, status: "delivered" });
    const gotDelivered = await pollDb(async () => {
      const fresh = await prisma.whatsAppOutboundMessage.findUnique({ where: { id: row.id } });
      return fresh?.status === "DELIVERED" && fresh.deliveredAt !== null;
    });
    expect(gotDelivered).toBe(true);

    provider.driveDelivery({ providerMessageId: row.providerMessageId!, status: "read" });
    const gotRead = await pollDb(async () => {
      const fresh = await prisma.whatsAppOutboundMessage.findUnique({ where: { id: row.id } });
      return fresh?.status === "READ" && fresh.readAt !== null;
    });
    expect(gotRead).toBe(true);

    // Монотонность: поздний delivered НЕ откатывает READ.
    provider.driveDelivery({ providerMessageId: row.providerMessageId!, status: "delivered" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const after = await prisma.whatsAppOutboundMessage.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe("READ");
  });

  // ── 14. Crash → UNKNOWN → recover ──────────────────────────────────────────

  it("14. Crash→UNKNOWN (boot scan) + recover: mark-failed / retry-anyway / 409 / 404", async () => {
    // Карантин: реальная отправка → перевод в зависший SENDING со старым updatedAt.
    const key1 = `wa-e2e-stuck1-${stamp}`;
    const send1 = await adminAgent.post("/api/v1/whatsapp/messages").set("Idempotency-Key", key1).send(sendBody("stuck-1")).expect(201);
    outboundIds.push(send1.body.outboundId);
    commCodes.push(send1.body.communicationCode);
    await prisma.whatsAppOutboundMessage.update({
      where: { id: send1.body.outboundId },
      data: { status: "SENDING", sentAt: null, updatedAt: new Date(Date.now() - 120_000) },
    });

    const key2 = `wa-e2e-stuck2-${stamp}`;
    const send2 = await adminAgent.post("/api/v1/whatsapp/messages").set("Idempotency-Key", key2).send(sendBody("stuck-2")).expect(201);
    outboundIds.push(send2.body.outboundId);
    commCodes.push(send2.body.communicationCode);
    await prisma.whatsAppOutboundMessage.update({
      where: { id: send2.body.outboundId },
      data: { status: "SENDING", sentAt: null, updatedAt: new Date(Date.now() - 120_000) },
    });

    // Как boot: детерминированный прогон детектора (at-most-once: SENDING → UNKNOWN).
    await outboundService.recoverStaleSending();
    const stuck1 = await prisma.whatsAppOutboundMessage.findUniqueOrThrow({ where: { id: send1.body.outboundId } });
    const stuck2 = await prisma.whatsAppOutboundMessage.findUniqueOrThrow({ where: { id: send2.body.outboundId } });
    expect(stuck1.status).toBe("UNKNOWN");
    expect(stuck2.status).toBe("UNKNOWN");
    expect((await auditRows("whatsapp.send.crash_to_unknown")).length).toBeGreaterThanOrEqual(1);

    // mark-failed.
    const markRes = await adminAgent
      .post(`/api/v1/whatsapp/messages/${send1.body.outboundId}/recover`)
      .send({ action: "mark-failed" })
      .expect(200);
    expect(markRes.body.status).toBe("FAILED_PERMANENT");
    expect(markRes.body.recovered).toBe(true);
    expect((await auditRows("whatsapp.send.mark_failed")).length).toBe(1);

    // retry-anyway: без confirm → 422; с confirm → повторный send с новым providerMessageId.
    await adminAgent
      .post(`/api/v1/whatsapp/messages/${send2.body.outboundId}/recover`)
      .send({ action: "retry-anyway" })
      .expect(422);
    const retryRes = await adminAgent
      .post(`/api/v1/whatsapp/messages/${send2.body.outboundId}/recover`)
      .send({ action: "retry-anyway", confirm: true })
      .expect(200);
    expect(retryRes.body.status).toBe("SENT");
    const retried = await prisma.whatsAppOutboundMessage.findUniqueOrThrow({ where: { id: send2.body.outboundId } });
    expect(retried.status).toBe("SENT");
    expect(retried.providerMessageId).not.toBe(stuck2.providerMessageId);
    const retryAudits = await auditRows("whatsapp.send.retry_anyway");
    expect(retryAudits.length).toBe(1);
    expect(JSON.stringify(retryAudits[0]!.details ?? {})).toContain("duplicateDeliveryPossible");

    // Границы: non-UNKNOWN → 409; отсутствующая → 404; reconcile без evidence → status.
    await adminAgent.post(`/api/v1/whatsapp/messages/${send1.body.outboundId}/recover`).send({ action: "reconcile" }).expect(409);
    await adminAgent
      .post("/api/v1/whatsapp/messages/00000000-0000-0000-0000-000000000000/recover")
      .send({ action: "reconcile" })
      .expect(404);
    const reconcileSent = await adminAgent
      .post(`/api/v1/whatsapp/messages/${outboundIds[0]}/recover`)
      .send({ action: "reconcile" })
      .expect(409);
    expect(reconcileSent.body.message ?? reconcileSent.body.error ?? "").toBeTruthy();
  });

  // ── 15. Kill-switch контракт статуса ───────────────────────────────────────

  it("15. Финальный статус-снимок: enabled+mock, сессия управляется только через §6.4", async () => {
    const res = await adminAgent.get("/api/v1/whatsapp/status").expect(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.provider).toBe("mock");
    expect(["CONNECTED", "DISCONNECTED", "QR_REQUIRED", "INITIALIZING"]).toContain(res.body.state);
    expect(res.body.phone === null || typeof res.body.phone === "string").toBe(true);
    // Состояние БД согласовано со статусом (персист через state-change listener).
    const account = await prisma.whatsAppAccount.findFirst();
    expect(account?.state).toBe(res.body.state);
  });
});
