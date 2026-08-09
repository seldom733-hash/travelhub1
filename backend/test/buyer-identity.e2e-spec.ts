/**
 * E2E PHASE 1 STEP 1.9 — Buyer Identity & Public-to-Authenticated Transition.
 *
 * Кларификация «Buyer ↔ CRM Customer mapping» (синхронная CRM-owned
 * orchestration в одной транзакции):
 *   Register BUYER → create security.User → CrmService.ensureCustomerForBuyer
 *   (create-or-link по нормализованному email) → link User.customerId → session.
 *
 * Инвариант: ACTIVE BUYER ⇒ valid User.customerId ⇒ existing CRM Customer.
 *
 * Покрытие (Step 1.9 §18 + Clarification §10):
 *   1-3.  register → User (BUYER) + Customer + customerId link;
 *   4.    forged role/partnerId/customerId/permissions/status в register → 422;
 *   5-6.  duplicate email / retry → 409, НЕ создаёт duplicate Customer;
 *   7.    CRM failure → регистрация целиком откатывается (нет User, нет Customer);
 *   8.    deterministic reuse существующего Customer (по email);
 *   9.    ambiguous legacy match НЕ merge'ится (имя/телефон — не ключ);
 *   10.   BUYER не может связать себя с чужим Customer (register/profile → 422);
 *   11.   PARTNER/internal (createStaff) НЕ создаёт Buyer Customer;
 *   12.   login + /auth/me → BUYER с customerId;
 *   13-16. profile: own read, own update (identity + CRM business + email sync),
 *          mass-assignment forbidden, чужой profile недоступен;
 *   17-18. INACTIVE/LOCKED BUYER: login 401, /auth/me 401, профиль 401;
 *          deactivation НЕ удаляет Customer;
 *   19.   logout → 200 (audit);
 *   20.   BUYER permissions: account.profile.* есть, internal catalog/partner — нет;
 *   21.   repair command (dry-run/report, idempotent) — детерминированный repair
 *         legacy BUYER (ADMIN endpoint /users/reconcile-buyer-customers).
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
import { CrmService } from "../src/modules/crm/crm.service";
import { RoleCode } from "../src/generated/prisma/enums";

interface BuyerSession {
  accessToken: string;
  user: {
    id: string;
    role: RoleCode;
    status: string;
    email: string | null;
    customerId: string | null;
    permissions: string[];
  };
}

describe("Phase 1 Step 1.9 — Buyer Identity & CRM Customer Mapping (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let crmService: CrmService;

  const stamp = Date.now();
  const created = { users: [] as string[], customers: [] as string[], partners: [] as string[] };

  // Возвращает supertest-объект (thenable): цепочки .expect() перед await.
  const register = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post("/api/v1/auth/register").send(body);

  const login = async (username: string, password: string): Promise<BuyerSession> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as BuyerSession;
  };

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    crmService = app.get(CrmService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await app.close();
  });

  const trackUser = (id: string) => created.users.push(id);
  const trackCustomer = (id: string) => created.customers.push(id);

  // ── 1-3. Registration invariant ─────────────────────────────────────────────

  it("1-3. register BUYER: создаётся User (BUYER, ACTIVE) + CRM Customer; User.customerId == Customer.id", async () => {
    const email = `buyer${stamp}@test.local`;
    const reg = await register({
      email,
      password: "buyerpass123",
      firstName: "Иван",
      lastName: "Покупателев",
    }).expect(201);
    const session = reg.body as BuyerSession;
    trackUser(session.user.id);

    expect(session.user.role).toBe(RoleCode.BUYER);
    expect(session.user.status).toBe("ACTIVE");
    expect(session.user.email).toBe(email);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    expect(user.code).toMatch(/^USR-\d{8}$/);
    expect(user.customerId).not.toBeNull();

    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: user.customerId! } });
    trackCustomer(customer.id);
    expect(customer.email).toBe(email); // нормализован
    expect(customer.firstName).toBe("Иван");
    expect(customer.lastName).toBe("Покупателев");
    expect(customer.type).toBe("PERSON");
    // Ключевой invariant: User.customerId == Customer.id.
    expect(user.customerId).toBe(customer.id);
  });

  it("1-3b. /auth/me возвращает BUYER с корректным customerId (Clarification §9)", async () => {
    const email = `me${stamp}@test.local`;
    const reg = await register({ email, password: "buyerpass123" }).expect(201);
    const session = reg.body as BuyerSession;
    trackUser(session.user.id);
    trackCustomer((await prisma.customer.findUniqueOrThrow({ where: { email } })).id);

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .expect(200);
    expect(me.body.role).toBe("BUYER");
    expect(me.body.status).toBe("ACTIVE");
    expect(me.body.customerId).toBe(session.user.customerId);
  });

  // ── 4. Forged identity fields ───────────────────────────────────────────────

  it("4. register: forged role/partnerId/customerId/permissions/status → 422", async () => {
    const cases: Record<string, unknown>[] = [
      { email: `r1${stamp}@t.local`, password: "buyerpass123", role: "ADMIN" },
      { email: `r2${stamp}@t.local`, password: "buyerpass123", roleCode: "PARTNER" },
      { email: `r3${stamp}@t.local`, password: "buyerpass123", partnerId: "PAR-00000001" },
      { email: `r4${stamp}@t.local`, password: "buyerpass123", customerId: "CUS-00000001" },
      { email: `r5${stamp}@t.local`, password: "buyerpass123", permissions: ["admin"] },
      { email: `r6${stamp}@t.local`, password: "buyerpass123", status: "ACTIVE" },
    ];
    for (const body of cases) {
      await register(body).expect(422);
    }
    // Роль не принимается в принципе — BUYER по умолчанию.
    const ok = await register({ email: `r7${stamp}@t.local`, password: "buyerpass123", firstName: "X" }).expect(201);
    expect((ok.body as BuyerSession).user.role).toBe("BUYER");
    trackUser((ok.body as BuyerSession).user.id);
  });

  it("4b. register: короткий/отсутствующий email/password → 400", async () => {
    await register({ password: "buyerpass123" }).expect(400); // нет email
    await register({ email: "bad", password: "buyerpass123" }).expect(400); // не email
    await register({ email: `short${stamp}@t.local`, password: "123" }).expect(400); // короткий пароль
  });

  // ── 5-6. Duplicates / retry idempotency ─────────────────────────────────────

  it("5. duplicate email: повторная регистрация → 409; duplicate Customer НЕ создаётся", async () => {
    const email = `dup${stamp}@test.local`;
    const first = await register({ email, username: `dupuser${stamp}`, password: "buyerpass123" }).expect(201);
    trackUser((first.body as BuyerSession).user.id);

    // Тот же email, другой username → 409 (User.email unique).
    await register({ email, username: `dupuser2${stamp}`, password: "buyerpass123" }).expect(409);
    // Тот же email и username (retry) → 409 (User.username unique).
    await register({ email, username: `dupuser${stamp}`, password: "buyerpass123" }).expect(409);

    // Customer ровно один.
    const customers = await prisma.customer.findMany({ where: { email } });
    expect(customers.length).toBe(1);
    trackCustomer(customers[0].id);
  });

  // ── 7. CRM failure → atomic rollback ────────────────────────────────────────

  it("7. CRM failure: регистрация откатывается целиком (нет User, нет Customer)", async () => {
    const email = `crash${stamp}@test.local`;
    const spy = jest.spyOn(crmService, "ensureCustomerForBuyer").mockRejectedValueOnce(new Error("crm-outage"));
    try {
      await register({ email, username: `crashuser${stamp}`, password: "buyerpass123" }).expect(500);
    } finally {
      spy.mockRestore();
    }
    const user = await prisma.user.findUnique({ where: { username: `crashuser${stamp}` } });
    expect(user).toBeNull();
    const customer = await prisma.customer.findUnique({ where: { email } });
    expect(customer).toBeNull();
  });

  // ── 8-9. Deterministic reuse / ambiguous legacy ─────────────────────────────

  it("8. deterministic reuse: существующий Customer по email link'ится (нет дубликата)", async () => {
    const email = `reuse${stamp}@test.local`;
    const admin = await login("admin", "admin123");
    const adminAgent = agent(admin.accessToken);
    const created = (
      await adminAgent.post("/api/v1/customers").send({ type: "PERSON", firstName: "Старый", lastName: "Клиент", email }).expect(201)
    ).body.customer as { id: string };
    trackCustomer(created.id);

    const reg = await register({ email, username: `reuseuser${stamp}`, password: "buyerpass123", firstName: "Новый" }).expect(201);
    trackUser((reg.body as BuyerSession).user.id);
    expect((reg.body as BuyerSession).user.customerId).toBe(created.id);

    // Customer не дублирован и НЕ перезаписан (CRM — владелец бизнес-полей).
    const customers = await prisma.customer.findMany({ where: { email } });
    expect(customers.length).toBe(1);
    expect(customers[0].firstName).toBe("Старый"); // регистрация не перезаписала существующий Customer
  });

  it("9. ambiguous legacy: похожие имена не merge'ятся — link только по email", async () => {
    const admin = await login("admin", "admin123");
    const adminAgent = agent(admin.accessToken);
    const emailA = `amb-a${stamp}@test.local`;
    const emailB = `amb-b${stamp}@test.local`;
    const cA = (await adminAgent.post("/api/v1/customers").send({ type: "PERSON", firstName: "Али", lastName: "Гусейнов", email: emailA }).expect(201)).body.customer as { id: string };
    const cB = (await adminAgent.post("/api/v1/customers").send({ type: "PERSON", firstName: "Али", lastName: "Гусейнов", email: emailB }).expect(201)).body.customer as { id: string };
    trackCustomer(cA.id);
    trackCustomer(cB.id);

    const reg = await register({ email: emailA, username: `ambuser${stamp}`, password: "buyerpass123" }).expect(201);
    trackUser((reg.body as BuyerSession).user.id);
    expect((reg.body as BuyerSession).user.customerId).toBe(cA.id);

    // cB не тронут (нет авто-merge по имени).
    const afterB = await prisma.customer.findUniqueOrThrow({ where: { id: cB.id } });
    expect(afterB.firstName).toBe("Али");
    expect(afterB.lastName).toBe("Гусейнов");
  });

  // ── 10-11. Ownership / role gates ───────────────────────────────────────────

  it("10. BUYER не может связать себя с чужим Customer (register + profile → 422)", async () => {
    await register({ email: `foreign${stamp}@t.local`, password: "buyerpass123", customerId: "CUS-00000099" }).expect(422);
    const reg = await register({ email: `self${stamp}@test.local`, password: "buyerpass123" }).expect(201);
    trackUser((reg.body as BuyerSession).user.id);
    const buyerAgent = agent((reg.body as BuyerSession).accessToken);
    await buyerAgent.patch("/api/v1/account/profile").send({ customerId: "CUS-00000099" }).expect(422);
  });

  it("11. PARTNER/internal (createStaff) НЕ создаёт Buyer Customer автоматически", async () => {
    const admin = await login("admin", "admin123");
    const adminAgent = agent(admin.accessToken);
    const before = await prisma.customer.count();

    const partner = (await adminAgent
      .post("/api/v1/users")
      .send({ username: `s19partner${stamp}`, password: "partnerpass123", roleCode: RoleCode.PARTNER, email: `p${stamp}@test.local` })
      .expect(201)).body as { id: string };
    trackUser(partner.id);
    const analyst = (await adminAgent
      .post("/api/v1/users")
      .send({ username: `s19analyst${stamp}`, password: "analystpass123", roleCode: RoleCode.ANALYST, email: `a${stamp}@test.local` })
      .expect(201)).body as { id: string };
    trackUser(analyst.id);

    const after = await prisma.customer.count();
    expect(after).toBe(before); // ни одного Customer не создано
    const pRow = await prisma.user.findUniqueOrThrow({ where: { id: partner.id } });
    expect(pRow.customerId).toBeNull();
  });

  it("11b. BUYER не получает /products, /category-schemas, /partners (403)", async () => {
    const reg = await register({ email: `gated${stamp}@test.local`, password: "buyerpass123" }).expect(201);
    trackUser((reg.body as BuyerSession).user.id);
    const buyerAgent = agent((reg.body as BuyerSession).accessToken);
    await buyerAgent.get("/api/v1/products").expect(403);
    await buyerAgent.get("/api/v1/category-schemas").expect(403);
    await buyerAgent.post("/api/v1/partners").send({ name: "x" }).expect(403);
    await buyerAgent.get("/api/v1/users").expect(403);
  });

  // ── 12. BUYER login (Step 1.9 §18 №5) ───────────────────────────────────────

  it("12. BUYER login success: username=email → JWT; /auth/me → BUYER с customerId", async () => {
    const email = `login${stamp}@test.local`;
    const reg = await register({ email, password: "buyerpass123" }).expect(201);
    trackUser((reg.body as BuyerSession).user.id);

    const session = await login(email, "buyerpass123"); // username по умолчанию = email
    expect(session.user.role).toBe("BUYER");
    expect(session.user.customerId).toBe((reg.body as BuyerSession).user.customerId);

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .expect(200);
    expect(me.body.role).toBe("BUYER");
    expect(me.body.customerId).toBe(session.user.customerId);
  });

  // ── 13-16. Own-scope profile ────────────────────────────────────────────────

  it("13. profile own read: user + связанный Customer (business projection)", async () => {
    const reg = await register({ email: `prof${stamp}@test.local`, password: "buyerpass123", firstName: "Проф", lastName: "Байер" }).expect(201);
    trackUser((reg.body as BuyerSession).user.id);
    const buyerAgent = agent((reg.body as BuyerSession).accessToken);

    const profile = (await buyerAgent.get("/api/v1/account/profile").expect(200)).body as {
      user: { id: string; role: string; email: string | null; customerId: string | null };
      customer: { id: string; firstName: string | null; lastName: string | null; email: string };
    };
    expect(profile.user.role).toBe("BUYER");
    expect(profile.user.customerId).toBe((reg.body as BuyerSession).user.customerId);
    expect(profile.customer.firstName).toBe("Проф");
    expect(profile.customer.email).toBe(`prof${stamp}@test.local`);
  });

  it("14. profile own update: identity (fullName/email) + CRM business (firstName/lastName/phone); email синхронизируется на Customer", async () => {
    const reg = await register({ email: `upd${stamp}@test.local`, password: "buyerpass123" }).expect(201);
    trackUser((reg.body as BuyerSession).user.id);
    const buyerAgent = agent((reg.body as BuyerSession).accessToken);
    const newEmail = `upd-new${stamp}@test.local`;

    const updated = (
      await buyerAgent
        .patch("/api/v1/account/profile")
        .send({ firstName: "Новое", lastName: "Имя", phone: "+994500000000", email: newEmail })
        .expect(200)
    ).body as { user: { fullName: string | null; email: string | null }; customer: { firstName: string | null; lastName: string | null; phone: string | null; email: string } };

    expect(updated.user.email).toBe(newEmail);
    expect(updated.user.fullName).toBe("Новое Имя"); // display projection синхронизирована
    expect(updated.customer.firstName).toBe("Новое");
    expect(updated.customer.lastName).toBe("Имя");
    expect(updated.customer.phone).toBe("+994500000000");
    // Email identity синхронизирован на Customer (канонический ключ связи).
    expect(updated.customer.email).toBe(newEmail);

    const cRow = await prisma.customer.findUniqueOrThrow({ where: { id: (reg.body as BuyerSession).user.customerId! } });
    expect(cRow.email).toBe(newEmail);
  });

  it("14b. profile update email: дубликат → 409", async () => {
    const a = await register({ email: `dupA${stamp}@test.local`, password: "buyerpass123" }).expect(201);
    const b = await register({ email: `dupB${stamp}@test.local`, password: "buyerpass123" }).expect(201);
    trackUser((a.body as BuyerSession).user.id);
    trackUser((b.body as BuyerSession).user.id);
    const buyerAgent = agent((b.body as BuyerSession).accessToken);
    await buyerAgent.patch("/api/v1/account/profile").send({ email: `dupA${stamp}@test.local` }).expect(409);
  });

  it("15. profile: mass-assignment запрещён (role/partnerId/customerId/status/userId/username/password → 422)", async () => {
    const reg = await register({ email: `guard${stamp}@test.local`, password: "buyerpass123" }).expect(201);
    trackUser((reg.body as BuyerSession).user.id);
    const buyerAgent = agent((reg.body as BuyerSession).accessToken);

    const forbidden: Record<string, unknown>[] = [
      { role: "ADMIN" },
      { permissions: ["admin"] },
      { partnerId: "PAR-1" },
      { customerId: "CUS-1" },
      { status: "ACTIVE" },
      { userId: "someone-else" },
      { username: "hacker" },
      { password: "hacked123" },
    ];
    for (const body of forbidden) {
      await buyerAgent.patch("/api/v1/account/profile").send(body).expect(422);
    }
  });

  it("16. чужой profile недоступен: нет userId-параметра, попытка подмены → 422", async () => {
    const a = await register({ email: `ownA${stamp}@test.local`, password: "buyerpass123" }).expect(201);
    const b = await register({ email: `ownB${stamp}@test.local`, password: "buyerpass123" }).expect(201);
    trackUser((a.body as BuyerSession).user.id);
    trackUser((b.body as BuyerSession).user.id);
    const buyerAgent = agent((b.body as BuyerSession).accessToken);

    // Любая попытка указать чужой/произвольный userId отклоняется.
    await buyerAgent.patch("/api/v1/account/profile").send({ userId: (a.body as BuyerSession).user.id }).expect(422);
    await buyerAgent.get("/api/v1/account/profile?userId=" + (a.body as BuyerSession).user.id).expect(200); // query игнорируется — own-scope
    // Профиль A не отдаёт данных B.
    const meB = (await buyerAgent.get("/api/v1/account/profile").expect(200)).body as { user: { id: string } };
    expect(meB.user.id).toBe((b.body as BuyerSession).user.id);
  });

  // ── 17-18. Inactive / LOCKED ────────────────────────────────────────────────

  it("17. INACTIVE BUYER: login 401; действующий токен /auth/me и profile → 401", async () => {
    const reg = await register({ email: `off${stamp}@test.local`, password: "buyerpass123" }).expect(201);
    trackUser((reg.body as BuyerSession).user.id);
    const token = (reg.body as BuyerSession).accessToken;

    const admin = await login("admin", "admin123");
    const adminAgent = agent(admin.accessToken);
    await adminAgent.patch(`/api/v1/users/${(reg.body as BuyerSession).user.id}/status`).send({ status: "INACTIVE" }).expect(200);

    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username: `off${stamp}`, password: "buyerpass123" }).expect(401);
    await request(app.getHttpServer()).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`).expect(401);
    await request(app.getHttpServer()).get("/api/v1/account/profile").set("Authorization", `Bearer ${token}`).expect(401);
  });

  it("18. deactivation User НЕ удаляет Customer (customer history сохраняется)", async () => {
    const reg = await register({ email: `keep${stamp}@test.local`, password: "buyerpass123", firstName: "Сохранить" }).expect(201);
    const customerId = (reg.body as BuyerSession).user.customerId!;
    trackUser((reg.body as BuyerSession).user.id);
    trackCustomer(customerId);

    const admin = await login("admin", "admin123");
    const adminAgent = agent(admin.accessToken);
    await adminAgent.patch(`/api/v1/users/${(reg.body as BuyerSession).user.id}/status`).send({ status: "INACTIVE" }).expect(200);

    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    expect(customer.status).toBe("ACTIVE");
    expect(customer.firstName).toBe("Сохранить");
    const history = await prisma.customerHistory.count({ where: { customerId } });
    expect(history).toBeGreaterThan(0);
  });

  // ── 19. Logout / session ────────────────────────────────────────────────────

  it("19. logout → 200; вход/выход аудируются", async () => {
    const reg = await register({ email: `out${stamp}@test.local`, password: "buyerpass123" }).expect(201);
    trackUser((reg.body as BuyerSession).user.id);
    const buyerAgent = agent((reg.body as BuyerSession).accessToken);
    await buyerAgent.post("/api/v1/auth/logout").expect(200);

    const logs = await prisma.auditLog.findMany({
      where: { action: { in: ["auth.login", "auth.logout", "auth.register"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    expect(logs.some((l) => l.action === "auth.register")).toBe(true);
    expect(logs.some((l) => l.action === "auth.login")).toBe(true);
    expect(logs.some((l) => l.action === "auth.logout")).toBe(true);
  });

  // ── 20. BUYER RBAC ──────────────────────────────────────────────────────────

  it("20. BUYER permissions: account.profile.* + узкие own-scope Buyer Cabinet права; internal CRM/Order/Booking/Finance и catalog/partner/moderation — нет", async () => {
    const reg = await register({ email: `perms${stamp}@test.local`, password: "buyerpass123" }).expect(201);
    trackUser((reg.body as BuyerSession).user.id);
    const p = (reg.body as BuyerSession).user.permissions;
    expect(p).toContain("account.profile.read");
    expect(p).toContain("account.profile.update");
    // Step 1.13: узкие own-scope read-права Buyer Cabinet.
    expect(p).toContain("account.order.read_own");
    expect(p).toContain("account.booking.read_own");
    expect(p).toContain("account.payment.read_own");
    expect(p).toContain("account.document.read_own");
    expect(p).toContain("account.support.read_own");
    // Step 1.13: internal read-контракты BUYER больше НЕ выдаются (§15).
    expect(p).not.toContain("crm.customer.read");
    expect(p).not.toContain("order.read");
    expect(p).not.toContain("booking.read");
    expect(p).not.toContain("finance.payment.read");
    expect(p).not.toContain("catalog.product.read");
    expect(p).not.toContain("catalog.category_schema.read");
    expect(p).not.toContain("catalog.category_schema.read_active_for_product_edit");
    expect(p).not.toContain("moderation.approve");
    expect(p).not.toContain("partner.anything");
    expect(p).not.toContain("settings.write");
  });

  // ── 21. Deterministic legacy repair (Clarification §7, review fix) ──────────

  it("21. repair command (dry-run → real): legacy BUYER с customerId=null получает детерминированный link", async () => {
    const admin = await login("admin", "admin123");
    const adminAgent = agent(admin.accessToken);
    const legacyEmail = `legacy${stamp}@test.local`;
    // «Легаси» BUYER без customerId (createStaff) с email.
    const legacy = (await adminAgent
      .post("/api/v1/users")
      .send({ username: `legacy${stamp}`, password: "buyerpass123", roleCode: RoleCode.BUYER, email: legacyEmail })
      .expect(201)).body as { id: string };
    trackUser(legacy.id);
    const before = await prisma.user.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(before.customerId).toBeNull();

    // dry-run: только отчёт, БЕЗ изменений (review fix — no guessing).
    const dry = (await adminAgent
      .post("/api/v1/users/reconcile-buyer-customers")
      .send({ dryRun: true })
      .expect(201)).body as { dryRun: boolean; created: number; linked: number };
    expect(dry.dryRun).toBe(true);
    expect(dry.created + dry.linked).toBeGreaterThanOrEqual(1);
    const afterDry = await prisma.user.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(afterDry.customerId).toBeNull(); // dry-run ничего не изменил

    // Реальный прогон: repair (deterministic link по email) + audit.
    const res = (await adminAgent
      .post("/api/v1/users/reconcile-buyer-customers")
      .send({ dryRun: false })
      .expect(201)).body as { dryRun: boolean; created: number; linked: number };
    expect(res.dryRun).toBe(false);
    expect(res.created + res.linked).toBeGreaterThanOrEqual(1);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(after.customerId).not.toBeNull();
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: after.customerId! } });
    expect(customer.email).toBe(legacyEmail);
    trackCustomer(customer.id);

    // Повторный прогон идемпотентен: Customer переиспользуется, дубликат невозможен.
    await adminAgent.post("/api/v1/users/reconcile-buyer-customers").send({}).expect(201);
    const customersAfter = await prisma.customer.findMany({ where: { email: legacyEmail } });
    expect(customersAfter.length).toBe(1);

    // repair-прогоны аудируются (dry-run и реальный).
    const audits = await prisma.auditLog.findMany({
      where: { action: { in: ["user.buyer_customer_repair", "user.buyer_customer_repair_dryrun"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    expect(audits.length).toBeGreaterThanOrEqual(3);
  });

  it("21b. repair не трогает internal/PARTNER (только BUYER)", async () => {
    const admin = await login("admin", "admin123");
    const adminAgent = agent(admin.accessToken);
    const staff = (await adminAgent
      .post("/api/v1/users")
      .send({ username: `nostaff${stamp}`, password: "staffpass123", roleCode: RoleCode.OPERATOR })
      .expect(201)).body as { id: string };
    trackUser(staff.id);
    const partner = (await adminAgent
      .post("/api/v1/users")
      .send({ username: `repairpartner${stamp}`, password: "partnerpass123", roleCode: RoleCode.PARTNER, email: `rp${stamp}@test.local` })
      .expect(201)).body as { id: string };
    trackUser(partner.id);

    const before = await prisma.user.findUniqueOrThrow({ where: { id: staff.id } });
    expect(before.customerId).toBeNull();
    await adminAgent.post("/api/v1/users/reconcile-buyer-customers").send({}).expect(201);
    const afterStaff = await prisma.user.findUniqueOrThrow({ where: { id: staff.id } });
    expect(afterStaff.customerId).toBeNull(); // OPERATOR не получает Buyer Customer
    const afterPartner = await prisma.user.findUniqueOrThrow({ where: { id: partner.id } });
    expect(afterPartner.customerId).toBeNull(); // PARTNER не получает Buyer Customer
  });

  it("21c. repair: customerId на несуществующий Customer — мёртвая ссылка чистится и ремонтируется по email", async () => {
    const admin = await login("admin", "admin123");
    const adminAgent = agent(admin.accessToken);
    const email = `broken${stamp}@test.local`;
    const legacy = (await adminAgent
      .post("/api/v1/users")
      .send({ username: `brokenuser${stamp}`, password: "buyerpass123", roleCode: RoleCode.BUYER, email })
      .expect(201)).body as { id: string };
    trackUser(legacy.id);
    // Ломаем ссылку напрямую (createStaff не принимает customerId).
    await prisma.user.update({ where: { id: legacy.id }, data: { customerId: "CUS-DOES-NOT-EXIST" } });

    const dry = (await adminAgent
      .post("/api/v1/users/reconcile-buyer-customers")
      .send({ dryRun: true })
      .expect(201)).body as { brokenRefs: number };
    expect(dry.brokenRefs).toBeGreaterThanOrEqual(1);

    await adminAgent.post("/api/v1/users/reconcile-buyer-customers").send({}).expect(201);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(after.customerId).not.toBeNull();
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: after.customerId! } });
    expect(customer.email).toBe(email);
    trackCustomer(customer.id);
  });
});
