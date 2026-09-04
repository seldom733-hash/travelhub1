/**
 * PHASE 3 — PRE-STEP 3.12 — D6 — C1: FORCED AUDIT-FAILURE ROLLBACK
 *
 * Proves that Booking lifecycle mutation + BookingHistory write
 * are in the same $transaction:
 *   - If history write fails → booking mutation is rolled back
 *   - Booking status/version remain UNCHANGED
 *   - No successful new audit/history event
 *
 * Mechanism: PostgreSQL trigger on BookingHistory that throws an error,
 * causing the entire $transaction to rollback (real DB-level failure).
 */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/shared/exception.filter';
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from '../src/shared/validation-pipe';
import { PrismaService } from '../src/prisma/prisma.service';

describe('D6 C1 — Forced Audit-Failure Rollback (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  const stamp = Date.now();
  let seq = 0;
  const uid = (tag: string) => `D6C1${tag}${seq++}${stamp}`;

  let bookingId = '';
  let bookingStatusBefore = '';
  let bookingVersionBefore = 0;
  let historyCountBefore = 0;
  const createdOrders: string[] = [];
  const createdBookings: string[] = [];

  const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AppExceptionFilter());
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    await app.init();
    prisma = mod.get(PrismaService);

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    adminToken = loginRes.body.accessToken;

    // Create fixtures
    const customer = await prisma.customer.create({
      data: {
        code: uid('CUS'),
        firstName: 'C1',
        lastName: 'Test',
        email: `${uid('c1')}@test.local`,
      },
    });

    const order = await prisma.order.create({
      data: {
        code: `ORD-${uid('O')}`,
        number: `TH-${uid('N')}`,
        referenceNumber: `MKT-${uid('R')}`,
        commerceSequence: uid('CS'),
        status: 'IN_PROCESSING',
        paymentStatus: 'UNPAID',
        currency: 'AZN',
        amount: 100,
        paidAmount: 0,
        refundedAmount: 0,
        version: 1,
        acquisitionSource: 'MARKETPLACE',
        customerId: customer.id,
        submittedAt: new Date(),
        serviceDate: new Date(Date.now() + 30 * 86400_000),
      },
    });
    createdOrders.push(order.id);

    const product = await prisma.product.findFirst();
    const booking = await prisma.booking.create({
      data: {
        code: `BKG-${uid('B')}`,
        referenceNumber: `MKT-BKG-${uid('B')}`,
        commerceSequence: uid('CS'),
        orderId: order.id,
        productId: product?.id ?? '00000000-0000-0000-0000-000000000001',
        status: 'CONFIRMED',
        amount: 100,
        currency: 'AZN',
        acquisitionSource: 'MARKETPLACE',
        serviceDate: new Date(Date.now() + 30 * 86400_000),
      },
    });
    createdBookings.push(booking.id);
    bookingId = booking.id;

    // Capture BEFORE state
    const bookingBefore = await prisma.booking.findUnique({ where: { id: bookingId } });
    bookingStatusBefore = bookingBefore!.status;
    bookingVersionBefore = bookingBefore!.version;
    historyCountBefore = await prisma.bookingHistory.count({ where: { bookingId } });
  });

  afterAll(async () => {
    // Remove the trigger
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS trg_block_booking_history ON "booking"."BookingHistory"`,
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `DROP FUNCTION IF EXISTS booking.fn_block_booking_history()`,
    ).catch(() => {});

    for (const id of createdBookings) {
      await prisma.bookingHistory.deleteMany({ where: { bookingId: id } }).catch(() => {});
      await prisma.booking.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdOrders) {
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    await app.close();
  });

  it('C1: forced history failure rolls back booking mutation', async () => {
    // Capture BEFORE state
    const histBeforeCount = historyCountBefore;
    const bookingBefore = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(bookingBefore!.status).toBe('CONFIRMED');
    expect(bookingBefore!.version).toBe(bookingVersionBefore);

    // Install PostgreSQL trigger that blocks ALL BookingHistory inserts
    // This simulates audit write failure at the DB level
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION booking.fn_block_booking_history()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'INJECTED: D6 C1 forced audit failure — blocking BookingHistory insert to verify $transaction rollback';
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_block_booking_history
      BEFORE INSERT ON "booking"."BookingHistory"
      FOR EACH ROW
      EXECUTE FUNCTION booking.fn_block_booking_history();
    `);

    // Attempt valid lifecycle action: CONFIRMED → IN_SERVICE
    // Inside $transaction:
    //   1. booking.updateMany (succeeds)
    //   2. bookingHistory.create → TRIGGER THROWS → transaction rolls back
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${bookingId}`)
      .set(authHeaders())
      .send({ action: 'service' });

    // Request should fail (500 due to internal DB error)
    expect(res.status).toBeGreaterThanOrEqual(400);

    // Remove the trigger for subsequent reads
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS trg_block_booking_history ON "booking"."BookingHistory"`,
    );
    await prisma.$executeRawUnsafe(
      `DROP FUNCTION IF EXISTS booking.fn_block_booking_history()`,
    );

    // AFTER: verify rollback
    const bookingAfter = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(bookingAfter!.status).toBe(bookingStatusBefore); // Still CONFIRMED
    expect(bookingAfter!.version).toBe(bookingVersionBefore); // Version unchanged

    const histAfterCount = await prisma.bookingHistory.count({ where: { bookingId } });
    expect(histAfterCount).toBe(histBeforeCount); // No new history entry
  });

  it('C1: booking is still mutable after failed attempt', async () => {
    // Verify the booking wasn't corrupted by the failed attempt
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking!.status).toBe('CONFIRMED');

    // Now succeed without the trigger
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${bookingId}`)
      .set(authHeaders())
      .send({ action: 'service' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_SERVICE');

    // Verify history was created
    const hist = await prisma.bookingHistory.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
    expect(hist.length).toBeGreaterThanOrEqual(1);
    expect(hist[0].action).toBe('service');
    expect(hist[0].from).toBe('CONFIRMED');
    expect(hist[0].to).toBe('IN_SERVICE');
  });
});
