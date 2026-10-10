/**
 * M4.3 — PHONE AUTH & REGISTRATION e2e (ADR-0016 phone-first identity).
 *
 * Покрытие §28 (Auth + Registration):
 *  - phone login (все форматы записи одного номера → один аккаунт);
 *  - legacy username login (совместимость сохранена);
 *  - email НЕ является login identity;
 *  - wrong password → 401;
 *  - throttle: ротация формата записи телефона НЕ обходит окно (§13);
 *  - registration: country + phone → loginPhone/country (нормализация до
 *    персистентности); invalid phone/country → 422; forbidden fields → 422;
 *  - duplicate phone → 409; duplicate email → 409;
 *  - Customer reuse по телефону (без дубликата Customer);
 *  - activation mechanics (§19 option B): issue (hash в БД, plaintext один
 *    раз) → consume (single-use, expiry, ACTIVE, tokenVersion++, audit без
 *    секретов); RBAC на issue.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { normalizePhoneE164 } from "../src/shared/phone/phone";

describe("M4.3 — phone auth & registration (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const password = "secret12345";
  const emailDomain = `m43-${stamp}.test`;
  let adminToken: string;

  // Уникальные AZ-номера (9 цифр после +994, префикс 50): на каждый кейс свой.
  let pseq = 0;
  const nextNational = () => {
    pseq += 1;
    const nine = `50${String(((stamp % 100000) * 100 + pseq) % 100000000).padStart(7, "0")}`;
    return `0${nine.slice(0, 9)}`; // национальный формат: 0 + 9 цифр
  };
  const canonicalOf = (national: string) => normalizePhoneE164(national)!;

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const login = await api()
      .post("/api/v1/auth/login")
      .send({ username: "admin", password: "admin123" })
      .expect(200);
    adminToken = login.body.accessToken as string;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { username: { startsWith: `m43-${stamp}` } } });
    await prisma.customer.deleteMany({ where: { email: { endsWith: `@${emailDomain}` } } });
    await app.close();
  });

  const register = (body: Record<string, unknown>) =>
    api().post("/api/v1/auth/register").send({ password, ...body });

  it("register(country+phone): loginPhone = canonical E.164, country = ISO, AuthUser.phone в ответе", async () => {
    const national = nextNational();
    const res = await register({
      username: `m43-${stamp}-1`,
      email: `one-${stamp}@${emailDomain}`,
      country: "az", // вход — любой регистр, хранится uppercase
      phone: national,
      firstName: "Phone",
      lastName: "First",
    }).expect(201);

    const canonical = canonicalOf(national);
    expect(res.body.user.phone).toBe(canonical);

    const user = await prisma.user.findUnique({ where: { username: `m43-${stamp}-1` } });
    expect(user?.loginPhone).toBe(canonical);
    expect(user?.country).toBe("AZ");

    // Profile display (§16): identity-секция профиля содержит login phone.
    const profile = await api()
      .get("/api/v1/account/profile")
      .set("Authorization", `Bearer ${res.body.accessToken}`)
      .expect(200);
    expect(profile.body.user.phone).toBe(canonical);
  });

  it("phone login: все форматы записи одного номера + legacy username → один аккаунт", async () => {
    const national = nextNational();
    const canonical = canonicalOf(national);
    const username = `m43-${stamp}-2`;
    const reg = await register({
      username,
      email: `two-${stamp}@${emailDomain}`,
      country: "AZ",
      phone: canonical,
    }).expect(201);

    const variants = [
      national, // 050...
      canonical, // +994...
      canonical.slice(1), // 994... без плюса
      canonical.replace(/(\+994)(\d{2})(\d{3})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5"), // с пробелами
    ];
    for (const identifier of variants) {
      const login = await api()
        .post("/api/v1/auth/login")
        .send({ username: identifier, password })
        .expect(200);
      expect(login.body.user.id).toBe(reg.body.user.id);
      expect(login.body.user.phone).toBe(canonical);
    }

    // Legacy username login сохранён (§12 compatibility path).
    const legacy = await api()
      .post("/api/v1/auth/login")
      .send({ username, password })
      .expect(200);
    expect(legacy.body.user.id).toBe(reg.body.user.id);
  });

  it("wrong password по телефону → 401", async () => {
    const national = nextNational();
    await register({
      username: `m43-${stamp}-3`,
      email: `three-${stamp}@${emailDomain}`,
      country: "AZ",
      phone: national,
    }).expect(201);
    await api()
      .post("/api/v1/auth/login")
      .send({ username: national, password: "wrong-password-1" })
      .expect(401);
  });

  it("email НЕ является login identity: вход по email при отдельном username → 401", async () => {
    const national = nextNational();
    const email = `four-${stamp}@${emailDomain}`;
    await register({
      username: `m43-${stamp}-4`,
      email,
      country: "AZ",
      phone: national,
    }).expect(201);
    // email ≠ username → новый email-lookup не вводится (§12).
    await api().post("/api/v1/auth/login").send({ username: email, password }).expect(401);
    // Тот же username работает (legacy path).
    await api()
      .post("/api/v1/auth/login")
      .send({ username: `m43-${stamp}-4`, password })
      .expect(200);
  });

  it("duplicate phone (другой формат того же номера) → 409; duplicate email → 409", async () => {
    const national = nextNational();
    const email = `five-${stamp}@${emailDomain}`;
    await register({
      username: `m43-${stamp}-5`,
      email,
      country: "AZ",
      phone: national,
    }).expect(201);

    // Тот же номер в другом формате + другой username/email → 409 (loginPhone unique).
    await register({
      username: `m43-${stamp}-5b`,
      email: `five-b-${stamp}@${emailDomain}`,
      country: "AZ",
      phone: canonicalOf(national).slice(1), // 994... без плюса
    }).expect(409);

    // Дубликат email → 409 (прежний контракт сохранён).
    await register({
      username: `m43-${stamp}-5c`,
      email: email.toUpperCase(),
      country: "AZ",
      phone: nextNational(),
    }).expect(409);
  });

  it("invalid phone → 422; invalid country → 422; forbidden fields → 422", async () => {
    await register({
      username: `m43-${stamp}-6`,
      email: `six-${stamp}@${emailDomain}`,
      country: "AZ",
      phone: "abcde", // ≥5 символов (проходит DTO), но не номер → service 422
    }).expect(422);

    await register({
      username: `m43-${stamp}-6b`,
      email: `six-b-${stamp}@${emailDomain}`,
      country: "XXX", // 3-симв. (проходит DTO), не 2-letter ISO → service 422
      phone: nextNational(),
    }).expect(422);

    // Forged identity-поля → 422 (assertNoForbiddenKeys, REGISTER_FORBIDDEN_KEYS).
    await register({
      username: `m43-${stamp}-6c`,
      email: `six-c-${stamp}@${emailDomain}`,
      country: "AZ",
      phone: nextNational(),
      role: "ADMIN",
      customerId: "CUS-00000099",
      permissions: ["settings.write"],
    }).expect(422);
  });

  it("Customer reuse: телефон существующего Customer → User.link, без дубликата Customer", async () => {
    const national = nextNational();
    const canonical = canonicalOf(national);
    const crmEmail = `crm-${stamp}@${emailDomain}`;

    const created = await api()
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: crmEmail, firstName: "Existing", lastName: "Customer", phone: national })
      .expect(201);
    const customerId = (created.body.customer?.id ?? created.body.id) as string;
    expect(customerId).toBeTruthy();

    const before = await prisma.customer.count({ where: { phoneCanonical: canonical } });
    expect(before).toBe(1);

    const reg = await register({
      username: `m43-${stamp}-7`,
      email: `seven-${stamp}@${emailDomain}`,
      country: "AZ",
      phone: canonical.replace("+994", "0"), // национальный формат того же номера
    }).expect(201);
    expect(reg.body.user.customerId).toBe(customerId);

    // Ровно один Customer с этим телефоном — дубликат не создан.
    const after = await prisma.customer.count({ where: { phoneCanonical: canonical } });
    expect(after).toBe(1);
  });

  it("throttle §13: ротация формата записи телефона НЕ обходит окно (10 → 429)", async () => {
    const national = nextNational();
    const canonical = canonicalOf(national);
    await register({
      username: `m43-${stamp}-8`,
      email: `eight-${stamp}@${emailDomain}`,
      country: "AZ",
      phone: national,
    }).expect(201);

    const formats = [national, canonical, canonical.slice(1), canonical.replace(/(\+994)(\d{2})(\d{3})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5")];
    // 10 неудачных попыток в РАЗНЫХ форматах → один ключ `canonical|ip`.
    for (let i = 0; i < 10; i++) {
      await api()
        .post("/api/v1/auth/login")
        .send({ username: formats[i % formats.length], password: "wrong-password-1" })
        .expect(401);
    }
    // 11-я попытка (любой формат) → 429: окно исчерпано, обход невозможен.
    await api()
      .post("/api/v1/auth/login")
      .send({ username: canonical, password: "wrong-password-1" })
      .expect(429);
  });

  it("activation §19: issue(hash в БД, plaintext один раз) → consume(single-use) → ACTIVE + tv++ + audit без секретов", async () => {
    const national = nextNational();
    const username = `m43-${stamp}-9`;
    const reg = await register({
      username,
      email: `nine-${stamp}@${emailDomain}`,
      country: "AZ",
      phone: national,
    }).expect(201);
    const userId = reg.body.user.id as string;

    // Сессия ДО деактивации (tv=0).
    const oldToken = reg.body.accessToken as string;

    // Админ деактивирует пользователя.
    await api()
      .patch(`/api/v1/users/${userId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "INACTIVE" })
      .expect(200);
    // INACTIVE не входит (даже со старой сессией guard отклоняет).
    await api().get("/api/v1/auth/me").set("Authorization", `Bearer ${oldToken}`).expect(401);

    // Issue: plaintext ОДИН раз в ответе; RBAC — только settings.write.
    const blockedLogin = await api()
      .post("/api/v1/auth/login")
      .send({ username, password });
    expect(blockedLogin.status).toBe(401); // INACTIVE не может войти до activate

    const issue = await api()
      .post(`/api/v1/users/${userId}/activation-token`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(201);
    const token = issue.body.token as string;
    expect(token).toBeTruthy();
    expect(issue.body.expiresAt).toBeTruthy();

    // В БД — только SHA-256 hash (plaintext отсутствует), usedAt = null.
    const rows = await prisma.activationToken.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].tokenHash).not.toBe(token);
    expect(rows[0].usedAt).toBeNull();

    // RBAC: BUYER без settings.write → 403.
    const reg2 = await register({
      username: `m43-${stamp}-9b`,
      email: `nine-b-${stamp}@${emailDomain}`,
      country: "AZ",
      phone: nextNational(),
    }).expect(201);
    await api()
      .post(`/api/v1/users/${userId}/activation-token`)
      .set("Authorization", `Bearer ${reg2.body.accessToken}`)
      .expect(403);

    // Consume: активация INACTIVE → ACTIVE.
    const consume = await api().post("/api/v1/auth/activate").send({ token }).expect(200);
    expect(consume.body.ok).toBe(true);
    const activated = await prisma.user.findUnique({ where: { id: userId } });
    expect(activated?.status).toBe("ACTIVE");
    expect(activated?.tokenVersion).toBe(1); // tv++ — старые сессии не воскресают

    // Single-use: повторный consume → 401.
    await api().post("/api/v1/auth/activate").send({ token }).expect(401);

    // Старая (pre-deactivation) сессия не воскресла; свежий вход работает.
    await api().get("/api/v1/auth/me").set("Authorization", `Bearer ${oldToken}`).expect(401);
    const fresh = await api().post("/api/v1/auth/login").send({ username, password }).expect(200);
    expect(fresh.body.user.id).toBe(userId);

    // Аудит есть, секретов в нём нет.
    const audits = await prisma.auditLog.findMany({
      where: { action: { in: ["account.activation", "account.activation_issued"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    expect(audits.some((a) => a.action === "account.activation")).toBe(true);
    expect(audits.some((a) => a.action === "account.activation_issued")).toBe(true);
    expect(JSON.stringify(audits)).not.toContain(token);
  });

  it("activation: истёкший токен → 401; неизвестный токен → 401", async () => {
    const username = `m43-${stamp}-10`;
    const reg = await register({
      username,
      email: `ten-${stamp}@${emailDomain}`,
      country: "AZ",
      phone: nextNational(),
    }).expect(201);
    const userId = reg.body.user.id as string;

    const issue = await api()
      .post(`/api/v1/users/${userId}/activation-token`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(201);
    // Истечение: backdate expiresAt напрямую (механика expiry).
    await prisma.activationToken.updateMany({
      where: { userId, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await api().post("/api/v1/auth/activate").send({ token: issue.body.token }).expect(401);

    // Неизвестный токен — тот же неотличимый 401 (без enumeration).
    await api()
      .post("/api/v1/auth/activate")
      .send({ token: "a".repeat(43) })
      .expect(401);
  });
});
