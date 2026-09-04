/**
 * PHASE 3 — PRE-STEP 3.12 — D6 — BOOKING FULL-PAGE DETAIL (e2e)
 *
 * Tests:
 *  - authorized detail with enriched DTO + availableActions
 *  - lifecycle transitions (valid/invalid/terminal)
 *  - history creation on transitions
 *  - cross-context isolation (Storefront Booking → 404)
 *  - not-found for nonexistent
 *  - DB==API reconciliation
 */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/shared/exception.filter';
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from '../src/shared/validation-pipe';
import { PrismaService } from '../src/prisma/prisma.service';

describe('D6 Booking Full-Page Detail (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let partnerId: string;

  const stamp = Date.now();
  let seq = 0;
  const uid = (tag: string) => `D6BK${tag}${seq++}${stamp}`;

  let activeBookingId = '';
  let activeBookingRef = '';
  let terminalBookingId = '';
  let terminalBookingRef = '';
  let storefrontBookingId = '';
  let storefrontBookingRef = '';

  const created = { orders: [] as string[], bookings: [] as string[] };

  const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

  const ensurePartner = async () => {
    if (partnerId) return partnerId;
    const email = `d6-partner-${stamp}@test.local`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/partner-register')
      .send({ email, password: 'partnerpass123', firstName: 'D6', lastName: 'Partner', applicantType: 'INDIVIDUAL', brandName: 'D6 Test Partner', country: 'AZ', contactEmail: email, termsAccepted: true })
      .expect(201);
    const pLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: email, password: 'partnerpass123' }).expect(200);
    const pH = { Authorization: `Bearer ${pLogin.body.accessToken}` };
    const appRow = (await request(app.getHttpServer()).get('/api/v1/partner/application').set(pH).expect(200)).body as { id: string };
    await request(app.getHttpServer()).post('/api/v1/partner/application/submit').set(pH).expect(201);
    const queue = (await request(app.getHttpServer()).get('/api/v1/partner/onboarding/review').set(authHeaders()).expect(200)).body as { items: Array<{ id: string }> };
    const reviewId = queue.items.find((x) => x.id === appRow.id)!.id;
    await request(app.getHttpServer()).post(`/api/v1/partner/onboarding/review/${reviewId}/start`).set(authHeaders()).expect(201);
    const approved = (await request(app.getHttpServer()).post(`/api/v1/partner/onboarding/review/${reviewId}/approve`).set(authHeaders()).send({ reason: 'ok' }).expect(201)).body as { partnerId: string };
    partnerId = approved.partnerId;
    return partnerId;
  };

  const seedOrderAndBooking = async (source: 'MARKETPLACE' | 'PARTNER_STOREFRONT', bookingStatus: string, tag: string) => {
    const pid = await ensurePartner();
    const customer = await prisma.customer.create({ data: { code: uid('CUS'), firstName: 'D6', lastName: 'Customer', email: `d6-${tag.toLowerCase()}@test.local` } });

    const order = await prisma.order.create({
      data: {
        code: `ORD-${tag}`, number: `TH-${tag}`, referenceNumber: source === 'PARTNER_STOREFRONT' ? `SF-${tag}` : `MKT-${tag}`,
        commerceSequence: tag, status: 'IN_PROCESSING', paymentStatus: 'UNPAID', currency: 'AZN', amount: 200, paidAmount: 0, refundedAmount: 0,
        version: 1, acquisitionSource: source, sellerPartnerId: pid, customerId: customer.id, submittedAt: new Date(), serviceDate: new Date(Date.now() + 30 * 86400_000),
      },
    });
    created.orders.push(order.id);

    const product = await prisma.product.findFirst();
    const booking = await prisma.booking.create({
      data: {
        code: `BKG-${tag}`, referenceNumber: source === 'PARTNER_STOREFRONT' ? `SF-BKG-${tag}` : `MKT-BKG-${tag}`,
        commerceSequence: tag, orderId: order.id, productId: product?.id ?? '00000000-0000-0000-0000-000000000001',
        status: bookingStatus as any, amount: 200, currency: 'AZN', acquisitionSource: source,
        serviceDate: new Date(Date.now() + 30 * 86400_000),
      },
    });
    created.bookings.push(booking.id);

    await prisma.bookingHistory.create({
      data: { bookingId: booking.id, action: 'created', from: null, to: bookingStatus, actorName: 'system', comment: 'Booking created' },
    });

    return { bookingId: booking.id, bookingRef: booking.referenceNumber, orderId: order.id, orderRef: order.referenceNumber };
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AppExceptionFilter());
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    await app.init();
    prisma = mod.get(PrismaService);

    const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: 'admin', password: 'admin123' }).expect(200);
    adminToken = loginRes.body.accessToken;

    // Seed fixtures
    const active = await seedOrderAndBooking('MARKETPLACE', 'CONFIRMED', uid('ACT'));
    activeBookingId = active.bookingId;
    activeBookingRef = active.bookingRef;

    const terminal = await seedOrderAndBooking('MARKETPLACE', 'COMPLETED', uid('TRM'));
    terminalBookingId = terminal.bookingId;
    terminalBookingRef = terminal.bookingRef;

    const sf = await seedOrderAndBooking('PARTNER_STOREFRONT', 'CONFIRMED', uid('SF'));
    storefrontBookingId = sf.bookingId;
    storefrontBookingRef = sf.bookingRef;
  });

  afterAll(async () => {
    for (const id of created.bookings) {
      await prisma.bookingHistory.deleteMany({ where: { bookingId: id } }).catch(() => {});
      await prisma.booking.delete({ where: { id } }).catch(() => {});
    }
    for (const id of created.orders) {
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    await app.close();
  });

  // T1: authorized detail
  it('T1: Platform ADMIN can get Booking detail with enriched DTO', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/bookings/${activeBookingId}`).set(authHeaders()).expect(200);
    expect(res.body.id).toBe(activeBookingId);
    expect(res.body.referenceNumber).toBe(activeBookingRef);
    expect(res.body.status).toBe('CONFIRMED');
    expect(Array.isArray(res.body.availableActions)).toBe(true);
    expect(res.body.availableActions.length).toBeGreaterThan(0);
    expect(res.body.orderCode).toBeTruthy();
    // productTitle may be null if product was not found by ID
  });

  // T2: not-found for nonexistent
  it('T2: nonexistent Booking returns 404', async () => {
    await request(app.getHttpServer()).get('/api/v1/bookings/00000000-0000-0000-0000-000000000000').set(authHeaders()).expect(404);
  });

  // T3: cross-context isolation
  it('T3: Platform ADMIN gets 404 on Storefront Booking detail', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/bookings/${storefrontBookingId}`).set(authHeaders()).expect(404);
    expect(res.body.message).toMatch(/not found/i);
    expect(res.body).not.toHaveProperty('referenceNumber');
  });

  // T4: availableActions reflects state machine
  it('T4: CONFIRMED Booking shows service/change/cancel actions', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/bookings/${activeBookingId}`).set(authHeaders()).expect(200);
    const actions = res.body.availableActions;
    expect(actions).toContain('service');
    expect(actions).toContain('requestChange');
    expect(actions).toContain('cancel');
    expect(actions).toContain('requestCancellation');
  });

  // T5: terminal Booking — availableActions limited
  it('T5: COMPLETED Booking has no lifecycle actions', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/bookings/${terminalBookingId}`).set(authHeaders()).expect(200);
    expect(res.body.status).toBe('COMPLETED');
    // COMPLETED is terminal — no valid transitions from it
    expect(res.body.availableActions).toHaveLength(0);
  });

  // T6: valid lifecycle transition
  it('T6: lifecycle action on active Booking succeeds', async () => {
    // Create a fresh NEW booking for lifecycle test
    const { bookingId } = await seedOrderAndBooking('MARKETPLACE', 'NEW', uid('LIF'));

    // Send → SENT_TO_SUPPLIER
    await request(app.getHttpServer()).patch(`/api/v1/bookings/${bookingId}`).set(authHeaders()).send({ action: 'send' }).expect(200);

    // Verify
    const res = await request(app.getHttpServer()).get(`/api/v1/bookings/${bookingId}`).set(authHeaders()).expect(200);
    expect(res.body.status).toBe('SENT_TO_SUPPLIER');
    expect(res.body.availableActions).toContain('confirm');
    expect(res.body.availableActions).toContain('reject');
  });

  // T7: invalid transition denied
  it('T7: invalid transition returns 409', async () => {
    // CONFIRMED → complete is invalid (must go through IN_SERVICE first)
    await request(app.getHttpServer()).patch(`/api/v1/bookings/${activeBookingId}`).set(authHeaders()).send({ action: 'complete' }).expect(409);
  });

  // T8: terminal mutation denied
  it('T8: action on terminal Booking is denied', async () => {
    await request(app.getHttpServer()).patch(`/api/v1/bookings/${terminalBookingId}`).set(authHeaders()).send({ action: 'cancel' }).expect(409);
  });

  // T9: history endpoint
  it('T9: Booking history endpoint returns entries', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/bookings/${activeBookingId}/history`).set(authHeaders()).expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).toHaveProperty('action');
    expect(res.body.items[0]).toHaveProperty('actorName');
  });

  // T10: history created after lifecycle action
  it('T10: lifecycle action creates history entry', async () => {
    const { bookingId } = await seedOrderAndBooking('MARKETPLACE', 'NEW', uid('HST'));

    await request(app.getHttpServer()).patch(`/api/v1/bookings/${bookingId}`).set(authHeaders()).send({ action: 'send' }).expect(200);

    const hist = await request(app.getHttpServer()).get(`/api/v1/bookings/${bookingId}/history`).set(authHeaders()).expect(200);
    const sendEntry = hist.body.items.find((h: any) => h.action === 'send');
    expect(sendEntry).toBeTruthy();
    expect(sendEntry.from).toBe('NEW');
    expect(sendEntry.to).toBe('SENT_TO_SUPPLIER');
  });

  // T11: DB proof — scope isolation is not nonexistent-object
  it('T11: Storefront Booking exists in DB while denied', async () => {
    const dbBooking = await prisma.booking.findUnique({ where: { id: storefrontBookingId } });
    expect(dbBooking).toBeTruthy();
    expect(dbBooking!.acquisitionSource).toBe('PARTNER_STOREFRONT');
  });

  // T12: list query hides Storefront bookings
  it('T12: Platform list excludes Storefront bookings', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/bookings?pageSize=600').set(authHeaders()).expect(200);
    const items = res.body.items || [];
    const sfItems = items.filter((b: any) => b.acquisitionSource === 'PARTNER_STOREFRONT');
    expect(sfItems).toHaveLength(0);
  });
});
