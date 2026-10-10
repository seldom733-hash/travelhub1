/**
 * M4.4 — WHATSAPP INTEGRATION e2e (first contact onboarding, §18).
 *
 * Покрытие (без изменения M3-семантики — whatsapp-m3 остаётся зелёным):
 *  - RBAC: anonymous 401 / BUYER 403 / OPERATOR (whatsapp.manage) onboards;
 *  - first contact: UNMATCHED → collect info → re-resolve (общий resolver)
 *    → create Customer (CRM-owned, phoneCanonical) → link диалога → audit;
 *  - reuse: телефон существует (1 владелец) → без create (create/reuse);
 *  - email-fallback: телефон новый, email существует → reuse (read-only);
 *  - AMBIGUOUS (>1 владельцев) → 409 (ручной выбор через link, не auto-merge);
 *  - уже linked с другим customer → 409 (unlink first — ручной link уважается);
 *  - без canonicalPhone (LID) и без override → 422 (не угадываем номер);
 *  - optional activation (§19 option B): существующий INACTIVE User по
 *    loginPhone → token (SHA-256 в БД, plaintext один раз) → consume →
 *    ACTIVE + tv++; ACTIVE → без токена; user отсутствует → без регистрации
 *    (website registration НЕ форсируется, пароли НЕ изобретаются);
 *  - audit whatsapp.customer_onboarded: метаданные, без PII/секретов.
 */
import "reflect-metadata";
import { createHash } from "crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { RoleCode } from "../src/generated/prisma/enums";
import { normalizePhoneE164 } from "../src/shared/phone/phone";

interface Session {
  accessToken: string;
  user: { id: string; role: string };
}

describe("M4.4 — WhatsApp first contact onboarding (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const emailDomain = `m44-${stamp}.test`;
  const password = "secret12345";
  let adminToken: string;
  let operatorToken: string;
  let buyerToken: string;
  let accountId: string;
  const createdUserIds: string[] = [];

  let pseq = 0;
  const nextNational = () => {
    pseq += 1;
    const nine = `50${String(((stamp % 100000) * 100 + pseq) % 100000000).padStart(7, "0")}`;
    return `0${nine.slice(0, 9)}`;
  };
  const canonicalOf = (national: string) => normalizePhoneE164(national)!;

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const login = async (username: string, pass: string): Promise<Session> => {
    const res = await api().post("/api/v1/auth/login").send({ username, password: pass }).expect(200);
    return res.body as Session;
  };

  const createConversation = async (remoteJid: string, canonicalPhone: string | null) => {
    const conv = await prisma.whatsAppConversation.create({
      data: { accountId, remoteJid, canonicalPhone },
      select: { id: true },
    });
    return conv.id;
  };

  const onboard = (token: string, convId: string, body: Record<string, unknown>) =>
    api().post(`/api/v1/whatsapp/conversations/${convId}/onboard`).set(bearer(token)).send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const admin = await login("admin", "admin123");
    adminToken = admin.accessToken;

    const operator = (
      await api()
        .post("/api/v1/users")
        .set(bearer(adminToken))
        .send({ username: `m44_op_${stamp}`, password, roleCode: RoleCode.OPERATOR })
        .expect(201)
    ).body as { id: string };
    createdUserIds.push(operator.id);
    operatorToken = (await login(`m44_op_${stamp}`, password)).accessToken;

    const buyer = (await api()
      .post("/api/v1/auth/register")
      .send({ username: `m44_buy_${stamp}`, email: `buyer@${emailDomain}`, password, country: "AZ" })
      .expect(201)).body as Session;
    buyerToken = buyer.accessToken;
    createdUserIds.push(buyer.user.id);

    const account = await prisma.whatsAppAccount.create({ data: {}, select: { id: true } });
    accountId = account.id;
  });

  afterAll(async () => {
    await prisma.whatsAppAccount.deleteMany({ where: { id: accountId } });
    await prisma.communication.deleteMany({
      where: { channel: "WHATSAPP", createdAt: { gte: new Date(stamp - 60_000) } },
    });
    await prisma.customer.deleteMany({ where: { email: { endsWith: `@${emailDomain}` } } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { action: { startsWith: "whatsapp." } },
          { action: { startsWith: "account.activation" } },
        ],
        createdAt: { gte: new Date(stamp - 60_000) },
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  it("RBAC: anonymous → 401; BUYER → 403; invalid email → 400", async () => {
    const convId = await createConversation(`994509990001@s.whatsapp.net`, "+994509990001");
    await api().post(`/api/v1/whatsapp/conversations/${convId}/onboard`).send({ email: "x@y.test" }).expect(401);
    await onboard(buyerToken, convId, { email: `buyer-rbac@${emailDomain}` }).expect(403);
    await onboard(operatorToken, convId, { email: "not-an-email" }).expect(400);
    await prisma.whatsAppConversation.delete({ where: { id: convId } });
  });

  it("first contact: UNMATCHED → create Customer (CRM-owned) → link → MATCHED + audit без PII", async () => {
    const national = nextNational();
    const canonical = canonicalOf(national);
    const email = `first@${emailDomain}`;
    const convId = await createConversation(`994${national.slice(1)}@s.whatsapp.net`, canonical);

    const res = await onboard(operatorToken, convId, {
      email,
      firstName: "WA",
      lastName: "First",
    }).expect(200);

    expect(res.body.created).toBe(true);
    expect(res.body.conversation.matchingStatus).toBe("MATCHED");
    expect(res.body.conversation.customerId).toBeTruthy();
    const customerId = res.body.customerId as string;

    // CRM-owned creation: phoneCanonical заполнен (M4.1 write-site правило).
    const customer = await prisma.customer.findUniqueOrThrow({ where: { email } });
    expect(customer.id).toBe(customerId);
    expect(customer.phoneCanonical).toBe(canonical);

    // Связь диалога + контакт (link, pointer/audit §14/§24).
    const conv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: convId } });
    expect(conv.customerId).toBe(customerId);
    expect(conv.matchingStatus).toBe("MATCHED");
    const contact = await prisma.whatsAppContact.findFirst({ where: { accountId, customerId } });
    expect(contact).not.toBeNull();

    // Audit: метаданные, без email/phone (PII minimization).
    const audits = await prisma.auditLog.findMany({
      where: { action: "whatsapp.customer_onboarded", resourceId: convId },
    });
    expect(audits.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(audits);
    expect(serialized).toContain(customerId);
    expect(serialized).not.toContain(email);
    expect(serialized).not.toContain(canonical);
    expect(serialized).not.toContain(password);
  });

  it("reuse: тот же телефон (1 владелец) → без create, тот же Customer", async () => {
    const national = nextNational();
    const canonical = canonicalOf(national);
    const emailA = `reuse-a@${emailDomain}`;
    const convA = await createConversation(`994${national.slice(1)}a@s.whatsapp.net`, canonical);
    const first = await onboard(operatorToken, convA, { email: emailA }).expect(200);
    expect(first.body.created).toBe(true);

    const convB = await createConversation(`994${national.slice(1)}b@s.whatsapp.net`, canonical);
    const second = await onboard(operatorToken, convB, { email: `reuse-b@${emailDomain}` }).expect(200);
    expect(second.body.created).toBe(false);
    expect(second.body.customerId).toBe(first.body.customerId);

    // Ровно один Customer с телефоном — дубликат не создан.
    const owners = await prisma.customer.findMany({ where: { phoneCanonical: canonical } });
    expect(owners).toHaveLength(1);
    // И ровно один с emailA.
    expect(await prisma.customer.count({ where: { email: emailA } })).toBe(1);
  });

  it("email-fallback: телефон новый, email существует → reuse (read-only, не merge)", async () => {
    const email = `fallback@${emailDomain}`;
    const seedNational = nextNational();
    const seedConv = await createConversation(`994${seedNational.slice(1)}s@s.whatsapp.net`, canonicalOf(seedNational));
    const seed = await onboard(operatorToken, seedConv, { email }).expect(200);
    expect(seed.body.created).toBe(true);

    // Новый номер + существующий email → reuse того же Customer (без create).
    const otherNational = nextNational();
    const conv = await createConversation(`994${otherNational.slice(1)}f@s.whatsapp.net`, canonicalOf(otherNational));
    const res = await onboard(operatorToken, conv, { email }).expect(200);
    expect(res.body.created).toBe(false);
    expect(res.body.customerId).toBe(seed.body.customerId);
    // Телефон не был «присвоен» Customer — read-only fallback (не merge).
    const customer = await prisma.customer.findUniqueOrThrow({ where: { email } });
    expect(customer.phoneCanonical).toBe(canonicalOf(seedNational));
  });

  it("AMBIGUOUS (>1 владельцев) → 409 (никогда не auto-merge)", async () => {
    const national = nextNational();
    const canonical = canonicalOf(national);
    for (const tag of ["amb1", "amb2"]) {
      await prisma.customer.create({
        data: {
          code: `M44-${tag}-${stamp}`,
          email: `${tag}@${emailDomain}`,
          phone: canonical,
          phoneCanonical: canonical,
          firstName: "Amb",
          lastName: tag,
        },
      });
    }
    const convId = await createConversation(`994${national.slice(1)}amb@s.whatsapp.net`, canonical);
    const res = await onboard(operatorToken, convId, { email: `amb-new@${emailDomain}` });
    expect(res.status).toBe(409);
    // Диалог остался UNMATCHED — ручной выбор через link-customer.
    const conv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: convId } });
    expect(conv.customerId).toBeNull();
    expect(conv.matchingStatus).toBe("UNMATCHED");
  });

  it("уже linked с другим customer → 409 unlink first (ручной link уважается)", async () => {
    const national = nextNational();
    const canonical = canonicalOf(national);
    const linkedEmail = `linked@${emailDomain}`;
    const seed = await api()
      .post("/api/v1/customers")
      .set(bearer(adminToken))
      .send({ email: linkedEmail, phone: nextNational() })
      .expect(201);
    const linkedId = (seed.body.customer?.id ?? seed.body.id) as string;

    const convId = await createConversation(`994${national.slice(1)}lnk@s.whatsapp.net`, canonical);
    await api()
      .post(`/api/v1/whatsapp/conversations/${convId}/customer`)
      .set(bearer(operatorToken))
      .send({ customerId: linkedId })
      .expect(200);

    // Резолв по телефону нового номера даёт другого (нового) customer → 409.
    const res = await onboard(operatorToken, convId, { email: `conflict@${emailDomain}` });
    expect(res.status).toBe(409);

    const conv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: convId } });
    expect(conv.customerId).toBe(linkedId); // ручная связь не сброшена
  });

  it("без canonicalPhone (LID) и без override → 422; с override-телефоном → create", async () => {
    const lidConvId = await createConversation(`501352371898${pseq}@lid`, null);
    const res = await onboard(operatorToken, lidConvId, { email: `lid@${emailDomain}` });
    expect(res.status).toBe(422);

    // Override: оператор указал номер — нормализация → create (§18 collect).
    const national = nextNational();
    const withOverride = await onboard(operatorToken, lidConvId, {
      email: `lid-override@${emailDomain}`,
      phone: national,
    }).expect(200);
    expect(withOverride.body.created).toBe(true);
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { email: `lid-override@${emailDomain}` },
    });
    expect(customer.phoneCanonical).toBe(canonicalOf(national));
  });

  it("optional activation: существующий INACTIVE User → token (hash в БД) → consume → ACTIVE + tv++", async () => {
    const national = nextNational();
    const canonical = canonicalOf(national);
    const username = `m44_act_${stamp}`;
    const reg = (await api()
      .post("/api/v1/auth/register")
      .send({
        username,
        email: `act@${emailDomain}`,
        password,
        country: "AZ",
        phone: canonical,
      })
      .expect(201)).body as Session;
    createdUserIds.push(reg.user.id);
    const oldToken = reg.accessToken;

    // Деактивация (PATCH /users/:id/status — как в M4.3 e2e).
    await api()
      .patch(`/api/v1/users/${reg.user.id}/status`)
      .set(bearer(adminToken))
      .send({ status: "INACTIVE" })
      .expect(200);
    await api().get("/api/v1/auth/me").set(bearer(oldToken)).expect(401);

    // Website-регистрация уже создала Customer по телефону → onboard REUSE.
    const convId = await createConversation(`994${national.slice(1)}act@s.whatsapp.net`, canonical);
    const res = await onboard(operatorToken, convId, {
      email: `act-onboard@${emailDomain}`,
      activateUser: true,
    }).expect(200);
    expect(res.body.created).toBe(false); // reuse Customer (1 владелец)
    expect(res.body.user).toMatchObject({ id: reg.user.id, status: "INACTIVE" });
    const token = res.body.activation?.token as string;
    expect(token).toBeTruthy();

    // В БД — только SHA-256 hash, plaintext отсутствует.
    const rows = await prisma.activationToken.findMany({ where: { userId: reg.user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(createHash("sha256").update(token, "utf8").digest("hex"));
    expect(rows[0]!.usedAt).toBeNull();

    // Consume → ACTIVE + tv++; single-use → повторный 401.
    await api().post("/api/v1/auth/activate").send({ token }).expect(200);
    const activated = await prisma.user.findUniqueOrThrow({ where: { id: reg.user.id } });
    expect(activated.status).toBe("ACTIVE");
    expect(activated.tokenVersion).toBe(1);
    await api().post("/api/v1/auth/activate").send({ token }).expect(401);
    await api().get("/api/v1/auth/me").set(bearer(oldToken)).expect(401);

    // Секретов в аудите нет.
    const audits = await prisma.auditLog.findMany({
      where: { action: { startsWith: "account.activation" } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    expect(JSON.stringify(audits)).not.toContain(token);
  });

  it("activateUser: ACTIVE user → без токена; user отсутствует → без регистрации", async () => {
    // ACTIVE user (buyer с country, без phone → loginPhone null)... используем
    // вторую конвертацию для уже активированного номера (test 8 → ACTIVE).
    const activeUsername = `m44_act2_${stamp}`;
    const national = nextNational();
    const canonical = canonicalOf(national);
    const reg = (await api()
      .post("/api/v1/auth/register")
      .send({
        username: activeUsername,
        email: `act2@${emailDomain}`,
        password,
        country: "AZ",
        phone: canonical,
      })
      .expect(201)).body as Session;
    createdUserIds.push(reg.user.id);

    const convId = await createConversation(`994${national.slice(1)}act2@s.whatsapp.net`, canonical);
    const res = await onboard(operatorToken, convId, {
      email: `act2-onboard@${emailDomain}`,
      activateUser: true,
    }).expect(200);
    expect(res.body.user).toMatchObject({ id: reg.user.id, status: "ACTIVE" });
    expect(res.body.activation).toBeNull(); // уже активен — токен не выдаётся

    // user отсутствует → user/activation = null, User НЕ создаётся (§18).
    const noUserNational = nextNational();
    const noUserConv = await createConversation(
      `994${noUserNational.slice(1)}nou@s.whatsapp.net`,
      canonicalOf(noUserNational),
    );
    const before = await prisma.user.count({ where: { loginPhone: canonicalOf(noUserNational) } });
    expect(before).toBe(0);
    const fresh = await onboard(operatorToken, noUserConv, {
      email: `nouser@${emailDomain}`,
      activateUser: true,
    }).expect(200);
    expect(fresh.body.user).toBeNull();
    expect(fresh.body.activation).toBeNull();
    expect(fresh.body.created).toBe(true);
    expect(
      await prisma.user.count({ where: { loginPhone: canonicalOf(noUserNational) } }),
    ).toBe(0);
  });
});
