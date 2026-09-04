/**
 * D5 — Storefront Scope Isolation (e2e)
 *
 * Proves that a real PARTNER_STOREFRONT Order in the database is:
 * - invisible in Platform list
 * - 404 on Platform direct-ID detail
 * - 404 on Platform direct-ID history
 * - 404 on Platform direct-ID actions/travelers
 *
 * And that legitimate Marketplace Orders remain accessible.
 * DB proof: both rows exist — isolation is scope-based, not nonexistent-object.
 */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/shared/exception.filter';
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from '../src/shared/validation-pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { Prisma } from '../src/generated/prisma/client';

describe('D5 Storefront Scope Isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let partnerId: string;

  const stamp = Date.now();
  let seq = 0;
  const uid = (tag: string) => `SFSI${tag}${seq++}${stamp}`;

  let marketplaceOrderId = '';
  let marketplaceOrderRef = '';
  let storefrontOrderId = '';
  let storefrontOrderRef = '';

  const created: { orders: string[]; partners: string[]; users: string[] } = {
    orders: [],
    partners: [],
    users: [],
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AppExceptionFilter());
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    await app.init();
    prisma = mod.get(PrismaService);

    // Login as Platform ADMIN
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    adminToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    for (const id of created.orders) {
      await prisma.orderItem.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.fulfillment.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.orderHistory.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.orderTraveler.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    await app.close();
  });

  const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

  /**
   * Create a partner through the onboarding flow (matches D5 fullpage pattern).
   */
  const ensurePartner = async () => {
    if (partnerId) return partnerId;
    const email = `sf-scope-${stamp}@test.local`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/partner-register')
      .send({
        email, password: 'partnerpass123', firstName: 'Test', lastName: 'Partner',
        applicantType: 'INDIVIDUAL', brandName: 'SF Scope Test Partner',
        country: 'AZ', contactEmail: email, termsAccepted: true,
      })
      .expect(201);

    const pLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: email, password: 'partnerpass123' })
      .expect(200);
    const pToken = pLogin.body.accessToken;
    const pHeaders = { Authorization: `Bearer ${pToken}` };

    const appRow = (await request(app.getHttpServer())
      .get('/api/v1/partner/application').set(pHeaders).expect(200)).body as { id: string };
    await request(app.getHttpServer())
      .post('/api/v1/partner/application/submit').set(pHeaders).expect(201);

    const queue = (await request(app.getHttpServer())
      .get('/api/v1/partner/onboarding/review').set(authHeaders()).expect(200))
      .body as { items: Array<{ id: string }> };
    const reviewId = queue.items.find((x) => x.id === appRow.id)!.id;

    await request(app.getHttpServer())
      .post(`/api/v1/partner/onboarding/review/${reviewId}/start`).set(authHeaders()).expect(201);
    const approved = (await request(app.getHttpServer())
      .post(`/api/v1/partner/onboarding/review/${reviewId}/approve`)
      .set(authHeaders()).send({ reason: 'ok' }).expect(201))
      .body as { partnerId: string };

    partnerId = approved.partnerId;
    created.partners.push(partnerId);
    return partnerId;
  };

  /**
   * Seed Order helper — creates a real Order + Item + Fulfillment in DB.
   */
  const seedOrder = async (
    source: 'MARKETPLACE' | 'PARTNER_STOREFRONT',
    tag: string,
  ) => {
    const pid = await ensurePartner();
    const customer = await prisma.customer.create({
      data: {
        code: uid('CUS'),
        firstName: `SF${tag}`, lastName: 'Scope',
        email: `sf-${tag.toLowerCase()}@test.local`,
      },
    });

    const order = await prisma.order.create({
      data: {
        code: `ORD-${tag}`,
        number: `TH-${tag}`,
        referenceNumber: source === 'PARTNER_STOREFRONT' ? `SF-${tag}` : `MKT-${tag}`,
        commerceSequence: tag,
        status: 'IN_PROCESSING',
        paymentStatus: 'UNPAID',
        currency: 'AZN',
        amount: 100,
        paidAmount: 0,
        refundedAmount: 0,
        version: 1,
        acquisitionSource: source,
        sellerPartnerId: pid,
        customerId: customer.id,
        submittedAt: new Date(),
        serviceDate: new Date(Date.now() + 30 * 86400_000),
      },
    });
    created.orders.push(order.id);

    await prisma.orderItem.create({
      data: {
        orderId: order.id, productId: '00000000-0000-0000-0000-000000000001',
        productCode: 'PRD-TEST', title: `${source} Test Product`, type: 'SERVICE',
        quantity: 1, price: 100, currency: 'AZN', amount: 100,
        serviceDate: new Date(Date.now() + 30 * 86400_000),
      },
    });
    await prisma.fulfillment.create({
      data: { orderId: order.id, status: 'NOT_STARTED', notes: null },
    });

    return { id: order.id, ref: order.referenceNumber, source: order.acquisitionSource };
  };

  // ─── SETUP: create both Marketplace and Storefront Orders ───
  beforeAll(async () => {
    const mkt = await seedOrder('MARKETPLACE', uid('MKT'));
    marketplaceOrderId = mkt.id;
    marketplaceOrderRef = mkt.ref;

    const sf = await seedOrder('PARTNER_STOREFRONT', uid('SF'));
    storefrontOrderId = sf.id;
    storefrontOrderRef = sf.ref;

    // DB proof: both exist
    const mktDb = await prisma.order.findUnique({ where: { id: marketplaceOrderId } });
    const sfDb = await prisma.order.findUnique({ where: { id: storefrontOrderId } });
    expect(mktDb).toBeTruthy();
    expect(mktDb!.acquisitionSource).toBe('MARKETPLACE');
    expect(sfDb).toBeTruthy();
    expect(sfDb!.acquisitionSource).toBe('PARTNER_STOREFRONT');
  });

  // ─── T1: Platform → Marketplace detail = allowed ───
  it('T1: Platform ADMIN can access Marketplace Order detail', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/orders/${marketplaceOrderId}`)
      .set(authHeaders())
      .expect(200);
    expect(res.body.id).toBe(marketplaceOrderId);
    expect(res.body.referenceNumber).toBe(marketplaceOrderRef);
    expect(res.body.acquisitionSource).toBe('MARKETPLACE');
  });

  // ─── T2: Platform → Storefront detail = 404 ───
  it('T2: Platform ADMIN gets 404 on Storefront Order detail', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/orders/${storefrontOrderId}`)
      .set(authHeaders())
      .expect(404);
    expect(res.body.message).toMatch(/not found/i);
    // Must NOT leak any Storefront data
    expect(res.body).not.toHaveProperty('referenceNumber');
    expect(res.body).not.toHaveProperty('acquisitionSource');
    expect(res.body).not.toHaveProperty('amount');
    expect(res.body).not.toHaveProperty('customerId');
  });

  // ─── T3: Platform → Storefront history = 404 ───
  it('T3: Platform ADMIN gets 404 on Storefront Order history', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/orders/${storefrontOrderId}/history`)
      .set(authHeaders())
      .expect(404);
    expect(res.body.message).toMatch(/not found/i);
    expect(res.body).not.toHaveProperty('items');
    expect(res.body).not.toHaveProperty('total');
  });

  // ─── T4: Platform list hides Storefront ───
  it('T4: Platform list query excludes Storefront Orders', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/orders?pageSize=600')
      .set(authHeaders())
      .expect(200);
    const items = res.body.items || [];
    const sfItems = items.filter((o: any) => o.acquisitionSource === 'PARTNER_STOREFRONT');
    expect(sfItems).toHaveLength(0);
  });

  // ─── T5: Platform search doesn't surface Storefront ref ───
  it('T5: Search by Storefront ref returns 0 results', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/orders?search=${storefrontOrderRef}`)
      .set(authHeaders())
      .expect(200);
    const items = res.body.items || [];
    expect(items).toHaveLength(0);
  });

  // ─── T6: Platform action on Storefront = 404 ───
  it('T6: Platform lifecycle action on Storefront Order is denied', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${storefrontOrderId}`)
      .set(authHeaders())
      .send({ action: 'cancel' })
      .expect(404);
  });

  // ─── T7: Platform traveler read on Storefront = 404 ───
  it('T7: Platform traveler read on Storefront Order is denied', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/orders/${storefrontOrderId}/travelers`)
      .set(authHeaders())
      .expect(404);
  });

  // ─── T8: DB proof — both rows exist ───
  it('T8: Both Orders exist in DB (scope-based, not nonexistent-object)', async () => {
    const mkt = await prisma.order.findUnique({ where: { id: marketplaceOrderId } });
    const sf = await prisma.order.findUnique({ where: { id: storefrontOrderId } });
    expect(mkt).toBeTruthy();
    expect(mkt!.acquisitionSource).toBe('MARKETPLACE');
    expect(sf).toBeTruthy();
    expect(sf!.acquisitionSource).toBe('PARTNER_STOREFRONT');
  });
});
