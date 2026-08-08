/**
 * E2E: RBAC Matrix §4 — granular permissions на запись Catalog/CRM.
 *
 * Дифференциальная матрица:
 *  - BUYER (регистрация): только чтение → 403 на ВСЕ write-эндпоинты;
 *  - SALES_MANAGER: crm.customer.write / crm.contact.write (201 на customers/contacts),
 *    но НЕ catalog.* и НЕ company/partner/supplier → 403;
 *  - MODERATOR: catalog.product.write/publish, catalog.category.write,
 *    catalog.availability.write (201 на products/categories/availability),
 *    но НЕ crm.customer.write → 403 на CRM;
 *  - ADMIN — позитивный контроль на company/partner/supplier (никто из трёх ролей их не имеет).
 */
// Test DB: jest `setupFiles` (test/e2e.env.ts) подставляет изолированную
// тестовую БД (TEST_DATABASE_URL) до импорта AppModule — dev-БД не используется.

import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";
import { RoleCode } from "../src/generated/prisma/enums";

describe("Phase 2 — RBAC: запись Catalog/CRM закрыта по правам (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const created: {
    users: string[];
    products: string[];
    customers: string[];
    categories: string[];
    companies: string[];
    partners: string[];
    suppliers: string[];
  } = { users: [], products: [], customers: [], categories: [], companies: [], partners: [], suppliers: [] };
  const stamp = Date.now();

  const login = async (username: string, password: string) => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as { accessToken: string; user: { id: string; role: RoleCode; permissions: string[] } };
  };

  const agent = async (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  let adminAgent: ReturnType<typeof request.agent>;
  let buyerAgent: ReturnType<typeof request.agent>;
  let salesAgent: ReturnType<typeof request.agent>;
  let modAgent: ReturnType<typeof request.agent>;
  const buyerUsername = `rbaccatbuyer${stamp}`;
  const salesUsername = `rbaccatsales${stamp}`;
  const modUsername = `rbaccatmod${stamp}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminAgent = await agent((await login("admin", "admin123")).accessToken);

    const reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ username: buyerUsername, password: "buyerpass123", fullName: "Покупатель" })
      .expect(201);
    created.users.push(reg.body.user.id);
    buyerAgent = await agent(reg.body.accessToken);

    const sales = (
      await adminAgent.post("/api/v1/users").send({ username: salesUsername, password: "salespass123", roleCode: RoleCode.SALES_MANAGER })
    ).body;
    created.users.push(sales.id);
    salesAgent = await agent((await login(salesUsername, "salespass123")).accessToken);

    const mod = (
      await adminAgent.post("/api/v1/users").send({ username: modUsername, password: "modpass123", roleCode: RoleCode.MODERATOR })
    ).body;
    created.users.push(mod.id);
    modAgent = await agent((await login(modUsername, "modpass123")).accessToken);
  });

  afterAll(async () => {
    // Дочерние строки удаляем явно (не полагаемся на каскад product→availability, customer→contact).
    await prisma.availability.deleteMany({ where: { productId: { in: created.products } } });
    await prisma.contact.deleteMany({ where: { customerId: { in: created.customers } } });
    await prisma.supplier.deleteMany({ where: { id: { in: created.suppliers } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.company.deleteMany({ where: { id: { in: created.companies } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  it("роли имеют права записи строго по матрице", async () => {
    const buyer = await login(buyerUsername, "buyerpass123");
    expect(buyer.user.permissions).not.toContain("catalog.product.write");
    expect(buyer.user.permissions).not.toContain("crm.customer.write");

    const sales = await login(salesUsername, "salespass123");
    expect(sales.user.permissions).toContain("crm.customer.write");
    expect(sales.user.permissions).toContain("crm.contact.write");
    expect(sales.user.permissions).not.toContain("catalog.product.write");
    expect(sales.user.permissions).not.toContain("crm.company.write");

    const mod = await login(modUsername, "modpass123");
    expect(mod.user.permissions).toContain("catalog.product.write");
    expect(mod.user.permissions).toContain("catalog.product.publish");
    expect(mod.user.permissions).toContain("catalog.category.write");
    expect(mod.user.permissions).toContain("catalog.availability.write");
    expect(mod.user.permissions).not.toContain("crm.customer.write");
  });

  it("Catalog: BUYER/SALES_MANAGER → 403 на все write; MODERATOR → 201/200", async () => {
    // BUYER/SALES не могут создавать продукты и категории
    await buyerAgent.post("/api/v1/products").send({ type: "TOUR", title: "No" }).expect(403);
    await salesAgent.post("/api/v1/products").send({ type: "TOUR", title: "No" }).expect(403);
    await buyerAgent.post("/api/v1/categories").send({ title: "No" }).expect(403);
    await salesAgent.post("/api/v1/categories").send({ title: "No" }).expect(403);

    // MODERATOR (catalog.product.write) создаёт продукт — позитивный контроль
    const product = (
      await modAgent
        .post("/api/v1/products")
        .send({ type: "TOUR", title: `403 Cat ${stamp}`, tariffs: [{ name: "S", price: 100 }] })
        .expect(201)
    ).body.product;
    created.products.push(product.id);

    // PATCH: BUYER/SALES → 403, MODERATOR → 200
    await buyerAgent.patch(`/api/v1/products/${product.id}`).send({ title: "Hack" }).expect(403);
    await salesAgent.patch(`/api/v1/products/${product.id}`).send({ title: "Hack" }).expect(403);
    await modAgent.patch(`/api/v1/products/${product.id}`).send({ title: `403 Cat updated ${stamp}` }).expect(200);

    // publish: BUYER/SALES → 403, MODERATOR (catalog.product.publish) → 201
    await buyerAgent.post(`/api/v1/products/${product.id}/publish`).expect(403);
    await salesAgent.post(`/api/v1/products/${product.id}/publish`).expect(403);
    await modAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);

    // archive: BUYER/SALES → 403, MODERATOR → 201
    await buyerAgent.post(`/api/v1/products/${product.id}/archive`).expect(403);
    await salesAgent.post(`/api/v1/products/${product.id}/archive`).expect(403);
    await modAgent.post(`/api/v1/products/${product.id}/archive`).expect(201);

    // availability: BUYER/SALES → 403, MODERATOR (catalog.availability.write) → 201
    await buyerAgent.post(`/api/v1/products/${product.id}/availability`).send({ date: "2026-12-31", slotsTotal: 5 }).expect(403);
    await salesAgent.post(`/api/v1/products/${product.id}/availability`).send({ date: "2026-12-31", slotsTotal: 5 }).expect(403);
    await modAgent.post(`/api/v1/products/${product.id}/availability`).send({ date: "2026-12-31", slotsTotal: 5 }).expect(201);

    // категория: MODERATOR (catalog.category.write) → 201 (slug обязателен, явный)
    const category = (await modAgent.post("/api/v1/categories").send({ title: `403 Cat ${stamp}`, slug: `403-cat-${stamp}` }).expect(201)).body;
    if (category?.id) created.categories.push(category.id);
  });

  it("CRM: BUYER/MODERATOR → 403 на клиентов; SALES_MANAGER → 201/200; компания/партнёр/поставщик — 403 для всех ролей", async () => {
    // BUYER/MODERATOR не могут создавать клиентов
    await buyerAgent.post("/api/v1/customers").send({ email: "no@test.local" }).expect(403);
    await modAgent.post("/api/v1/customers").send({ email: "no@test.local" }).expect(403);

    // SALES_MANAGER (crm.customer.write) создаёт клиента — позитивный контроль
    const customer = (
      await salesAgent
        .post("/api/v1/customers")
        .send({ type: "PERSON", firstName: "403", lastName: "Crm", email: `403-crm-${stamp}@test.local` })
        .expect(201)
    ).body.customer;
    created.customers.push(customer.id);

    // PATCH: BUYER/MODERATOR → 403, SALES → 200
    await buyerAgent.patch(`/api/v1/customers/${customer.id}`).send({ firstName: "Hack" }).expect(403);
    await modAgent.patch(`/api/v1/customers/${customer.id}`).send({ firstName: "Hack" }).expect(403);
    await salesAgent.patch(`/api/v1/customers/${customer.id}`).send({ firstName: "403", lastName: "Crm Updated" }).expect(200);

    // контакты: BUYER/MODERATOR → 403, SALES (crm.contact.write) → 201
    await buyerAgent.post(`/api/v1/customers/${customer.id}/contacts`).send({ name: "Hack" }).expect(403);
    await modAgent.post(`/api/v1/customers/${customer.id}/contacts`).send({ name: "Hack" }).expect(403);
    await salesAgent.post(`/api/v1/customers/${customer.id}/contacts`).send({ name: `Contact ${stamp}` }).expect(201);

    // компании/партнёры/поставщики: ни BUYER, ни SALES_MANAGER, ни MODERATOR
    await buyerAgent.post("/api/v1/companies").send({ name: "No" }).expect(403);
    await salesAgent.post("/api/v1/companies").send({ name: "No" }).expect(403);
    await modAgent.post("/api/v1/companies").send({ name: "No" }).expect(403);
    await salesAgent.post("/api/v1/partners").send({ name: "No" }).expect(403);
    await salesAgent.post("/api/v1/suppliers").send({ name: "No" }).expect(403);

    // ADMIN — позитивный контроль
    const company = (await adminAgent.post("/api/v1/companies").send({ name: `403 Co ${stamp}` }).expect(201)).body;
    if (company?.id) created.companies.push(company.id);
    const partner = (await adminAgent.post("/api/v1/partners").send({ name: `403 Partner ${stamp}` }).expect(201)).body;
    if (partner?.id) created.partners.push(partner.id);
    const supplier = (await adminAgent.post("/api/v1/suppliers").send({ name: `403 Supplier ${stamp}` }).expect(201)).body;
    if (supplier?.id) created.suppliers.push(supplier.id);
  });
});
