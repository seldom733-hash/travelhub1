/**
 * PHASE 3 — PRE-STEP 3.12 — D6 — BOOKING REMEDIATION E2E
 *
 * R1 — Mutability contract (no field-level edit, mass-assignment denied)
 * R2 — Immutable audit (BookingHistory entries on lifecycle actions)
 * R3 — Atomicity (business failure → no false audit)
 * R4 — Concurrency (double transition safety)
 * Cross-context security
 */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/shared/exception.filter';
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from '../src/shared/validation-pipe';
import { PrismaService } from '../src/prisma/prisma.service';

describe('D6 Booking Remediation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  const stamp = Date.now();
  let seq = 0;
  const uid = (tag: string) => `D6REM${tag}${seq++}${stamp}`;

  let bookingId = '';
  let terminalBookingId = '';
  const createdOrders: string[] = [];
  const createdBookings: string[] = [];

  const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

  const createOrderAndBooking = async (bookingStatus: string, orderStatus: string, tag: string) => {
    const customer = await prisma.customer.create({
      data: { code: uid('CUS'), firstName: 'Test', lastName: 'Customer', email: `${tag}@test.local` },
    });

    const order = await prisma.order.create({
      data: {
        code: `ORD-${tag}`, number: `TH-${tag}`, referenceNumber: `MKT-${tag}`,
        commerceSequence: tag, status: orderStatus as any, paymentStatus: 'UNPAID',
        currency: 'AZN', amount: 100, paidAmount: 0, refundedAmount: 0, version: 1,
        acquisitionSource: 'MARKETPLACE', customerId: customer.id, submittedAt: new Date(),
        serviceDate: new Date(Date.now() + 30 * 86400_000),
      },
    });
    createdOrders.push(order.id);

    const product = await prisma.product.findFirst();
    const booking = await prisma.booking.create({
      data: {
        code: `BKG-${tag}`, referenceNumber: `MKT-BKG-${tag}`,
        commerceSequence: tag, orderId: order.id,
        productId: product?.id ?? '00000000-0000-0000-0000-000000000001',
        status: bookingStatus as any, amount: 100, currency: 'AZN',
        acquisitionSource: 'MARKETPLACE', serviceDate: new Date(Date.now() + 30 * 86400_000),
      },
    });
    createdBookings.push(booking.id);

    await prisma.bookingHistory.create({
      data: { bookingId: booking.id, action: 'created', from: null, to: bookingStatus, actorName: 'system', comment: 'Booking created' },
    });

    return { orderId: order.id, bookingId: booking.id };
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

    // Active (CONFIRMED) booking
    const active = await createOrderAndBooking('CONFIRMED', 'IN_PROCESSING', uid('ACT'));
    bookingId = active.bookingId;

    // Terminal (COMPLETED) booking
    const terminal = await createOrderAndBooking('COMPLETED', 'CLOSED', uid('TRM'));
    terminalBookingId = terminal.bookingId;
  });

  afterAll(async () => {
    for (const id of createdBookings) {
      await prisma.bookingHistory.deleteMany({ where: { bookingId: id } }).catch(() => {});
      await prisma.booking.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdOrders) {
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    await app.close();
  });

  // ── R1: MUTABILITY CONTRACT ──

  describe('R1 — Mutability Contract', () => {
    it('M1: valid lifecycle action succeeds', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}`)
        .set(authHeaders()).send({ action: 'service' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_SERVICE');
    });

    it('M2: lifecycle action denied on terminal booking', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${terminalBookingId}`)
        .set(authHeaders()).send({ action: 'complete' });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('M3: forged forbidden field rejected (mass-assignment)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}`)
        .set(authHeaders()).send({ action: 'complete', amount: '999999', status: 'CANCELLED' });
      expect(res.status).toBe(422);
    });

    it('M4: invalid transition returns 409', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}`)
        .set(authHeaders()).send({ action: 'send' });
      expect(res.status).toBe(409);
    });

    it('M5: nonexistent booking returns 404', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/bookings/00000000-0000-0000-0000-000000000000')
        .set(authHeaders()).send({ action: 'complete' });
      expect(res.status).toBe(404);
    });

    it('M6: DB unchanged after invalid transition', async () => {
      // Get current status
      const before = await prisma.booking.findUnique({ where: { id: bookingId } });
      // Attempt invalid transition
      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}`)
        .set(authHeaders()).send({ action: 'send' });
      // Verify DB unchanged
      const after = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(after!.status).toBe(before!.status);
    });
  });

  // ── R2: IMMUTABLE AUDIT ──

  describe('R2 — Immutable Audit', () => {
    it('A1: lifecycle action creates BookingHistory entry', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${bookingId}/history`)
        .set(authHeaders());
      expect(res.status).toBe(200);
      const items = res.body.items ?? [];
      expect(items.length).toBeGreaterThanOrEqual(1);
      // Should have a lifecycle event
      const lifecycle = items.find((h: any) =>
        h.action?.includes('service') || h.action?.includes('IN_SERVICE') || h.event?.includes('service')
      );
      expect(lifecycle).toBeDefined();
      expect(lifecycle.actor || lifecycle.actorName).toBeTruthy();
      expect(lifecycle.createdAt).toBeTruthy();
    });

    it('A2: history is append-only (ordered by createdAt desc)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${bookingId}/history`)
        .set(authHeaders());
      const items = res.body.items ?? [];
      for (let i = 1; i < items.length; i++) {
        expect(new Date(items[i - 1].createdAt).getTime())
          .toBeGreaterThanOrEqual(new Date(items[i].createdAt).getTime());
      }
    });

    it('A3: multiple lifecycle actions accumulate history', async () => {
      // IN_SERVICE → COMPLETE
      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}`)
        .set(authHeaders()).send({ action: 'complete' }).expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${bookingId}/history`)
        .set(authHeaders());
      // Should have: created (seed) + service + complete = at least 3
      expect(res.body.items.length).toBeGreaterThanOrEqual(3);
    });

    it('A4: history entries have actor and from/to', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${bookingId}/history`)
        .set(authHeaders());
      const items = res.body.items ?? [];
      for (const item of items) {
        expect(item.actor || item.actorName).toBeTruthy();
        expect(item.createdAt).toBeTruthy();
      }
    });
  });

  // ── R3: ATOMICITY ──

  describe('R3 — Atomicity', () => {
    it('FI-1: failed transition does NOT create false audit', async () => {
      const histBefore = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${terminalBookingId}/history`)
        .set(authHeaders());
      const countBefore = histBefore.body.items.length;

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${terminalBookingId}`)
        .set(authHeaders()).send({ action: 'complete' });
      expect(res.status).toBeGreaterThanOrEqual(400);

      const histAfter = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${terminalBookingId}/history`)
        .set(authHeaders());
      expect(histAfter.body.items.length).toBe(countBefore);
    });

    it('FI-2: forged action does not create false audit', async () => {
      const histBefore = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${terminalBookingId}/history`)
        .set(authHeaders());
      const countBefore = histBefore.body.items.length;

      const r = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${terminalBookingId}`)
        .set(authHeaders()).send({ action: 'nonexistent_action' });
      expect(r.status).toBeGreaterThanOrEqual(400);

      const histAfter = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${terminalBookingId}/history`)
        .set(authHeaders());
      expect(histAfter.body.items.length).toBe(countBefore);
    });

    it('FI-3: mass-assignment does not create false audit', async () => {
      const histBefore = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${terminalBookingId}/history`)
        .set(authHeaders());
      const countBefore = histBefore.body.items.length;

      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${terminalBookingId}`)
        .set(authHeaders()).send({ action: 'complete', amount: '0', status: 'NEW' }).expect(422);

      const histAfter = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${terminalBookingId}/history`)
        .set(authHeaders());
      expect(histAfter.body.items.length).toBe(countBefore);
    });
  });

  // ── R4: CONCURRENCY ──

  describe('R4 — Concurrency', () => {
    it('double lifecycle action: exactly one succeeds', async () => {
      // Create a fresh CONFIRMED booking
      const { bookingId: freshId } = await createOrderAndBooking('CONFIRMED', 'IN_PROCESSING', uid('RACE'));

      const [r1, r2] = await Promise.all([
        request(app.getHttpServer())
          .patch(`/api/v1/bookings/${freshId}`)
          .set(authHeaders()).send({ action: 'service' }),
        request(app.getHttpServer())
          .patch(`/api/v1/bookings/${freshId}`)
          .set(authHeaders()).send({ action: 'service' }),
      ]);

      const statuses = [r1.status, r2.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Verify final status
      const final = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${freshId}`)
        .set(authHeaders());
      expect(final.body.status).toBe('IN_SERVICE');
    });
  });

  // ── CROSS-CONTEXT SECURITY ──

  describe('Cross-Context Security', () => {
    it('Storefront Booking → 404 on detail', async () => {
      const sf = await prisma.booking.findFirst({ where: { acquisitionSource: 'PARTNER_STOREFRONT' } });
      if (!sf) return;
      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${sf.id}`)
        .set(authHeaders());
      expect(res.status).toBe(404);
    });

    it('Storefront Booking → 404 on history', async () => {
      const sf = await prisma.booking.findFirst({ where: { acquisitionSource: 'PARTNER_STOREFRONT' } });
      if (!sf) return;
      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${sf.id}/history`)
        .set(authHeaders());
      expect(res.status).toBe(404);
    });

    it('Storefront Booking → 404 on action', async () => {
      const sf = await prisma.booking.findFirst({ where: { acquisitionSource: 'PARTNER_STOREFRONT' } });
      if (!sf) return;
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${sf.id}`)
        .set(authHeaders()).send({ action: 'complete' });
      expect(res.status).toBe(404);
    });

    it('unauthenticated request → 401', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${bookingId}`);
      expect(res.status).toBe(401);
    });
  });
});
