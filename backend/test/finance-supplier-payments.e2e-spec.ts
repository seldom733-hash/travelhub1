/**
 * Finance completion E2E (2026-10-25).
 *
 * Сквозной сценарий на изолированной TEST_DATABASE_URL:
 *   booking confirmed → SupplierObligation (consumer) → PENDING supplier payment →
 *   confirm (obligation paid/remaining + ledger SUPPLIER_PAYOUT) → evidence upload
 *   (private mock storage) → cancel (reversal ledger SUPPLIER_PAYOUT_REVERSAL,
 *   obligation restored, repeat cancel idempotent) → debt-as-of report.
 *
 * Не запускает dev/prod БД: e2e env принудительно подменяет DATABASE_URL на
 * *_test (см. test/e2e.env.ts). ObjectStorage замокан — бинарные файлы не нужны.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { EventBusService } from "../src/eventbus/eventbus.service";
import { DomainEvents } from "../src/eventbus/domain-events";
import { Prisma } from "../src/generated/prisma/client";

const mockStorage = {
  putObject: jest.fn(async ({ key }: { key: string }) => ({ key, size: 20 })),
  deleteObject: jest.fn(async () => undefined),
  objectExists: jest.fn(async () => true),
  getSignedReadUrl: jest.fn(async () => "https://signed.test/evidence.pdf"),
};

const DAY = 24 * 60 * 60 * 1000;

describe("FINANCE completion — supplier payments + ledger reversal (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: EventBusService;
  let adminToken: string;
  const stamp = Date.now();
  const created = {
    orderId: "",
    bookingId: "",
    obligationId: "",
    paymentId: "",
    paymentIds: [] as string[],
    userIds: [] as string[],
    documentId: "",
  };

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider("ObjectStorageService")
      .useValue(mockStorage)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    eventBus = app.get(EventBusService);

    const login = await request(server()).post("/api/v1/auth/login").send({ username: "admin", password: "admin123" }).expect(200);
    adminToken = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    const payoutIds = [...new Set(created.paymentIds.filter(Boolean))];
    const auditIds = [...new Set([created.obligationId, ...payoutIds].filter(Boolean))];
    if (payoutIds.length) {
      await prisma.supplierPaymentEvidence.deleteMany({ where: { payoutId: { in: payoutIds } } });
      await prisma.supplierPayoutAllocation.deleteMany({ where: { payoutId: { in: payoutIds } } });
      await prisma.supplierPayout.deleteMany({ where: { id: { in: payoutIds } } });
      await prisma.ledgerTransaction.deleteMany({ where: { sourceId: { in: payoutIds } } });
    }
    if (created.obligationId) {
      await prisma.supplierObligationEvent.deleteMany({ where: { obligationId: created.obligationId } });
      await prisma.supplierObligation.deleteMany({ where: { id: created.obligationId } });
    }
    if (auditIds.length) await prisma.auditLog.deleteMany({ where: { resourceId: { in: auditIds } } });
    if (created.userIds.length) await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    if (created.bookingId) {
      await prisma.passenger.deleteMany({ where: { bookingId: created.bookingId } });
      await prisma.booking.deleteMany({ where: { id: created.bookingId } });
    }
    if (created.orderId) await prisma.order.deleteMany({ where: { id: created.orderId } });
    await app.close();
  });

  it("booking confirmed → obligation (consumer), then full payment lifecycle", async () => {
    const confirmedAt = new Date(Date.now() - 2 * DAY);
    const order = await prisma.order.create({
      data: {
        code: `E2E-FIN-ORD-${stamp}`,
        number: `TH-E2E-FIN-${stamp}`,
        referenceNumber: `MKT-E2E-FIN-${stamp}`,
        commerceSequence: `E${stamp}`.slice(0, 8),
        status: "PARTIALLY_FULFILLED",
        paymentStatus: "PAID",
        currency: "USD",
        amount: new Prisma.Decimal(1000),
        paidAmount: new Prisma.Decimal(1000),
        refundedAmount: new Prisma.Decimal(0),
        version: 1,
        acquisitionSource: "MARKETPLACE",
        serviceDate: new Date(Date.now() + 30 * DAY),
        commercialSnapshot: {
          supplierPrice: 1000,
          supplierCurrency: "USD",
          fx: { aznAmount: 1700, rate: 1.7, rateCode: "SFX-E2E" },
          customerCurrency: "AZN",
          customerFinalPrice: 2000,
        },
      },
    });
    created.orderId = order.id;

    const booking = await prisma.booking.create({
      data: {
        code: `E2E-FIN-BKG-${stamp}`,
        referenceNumber: `MKT-E2E-BKG-${stamp}`,
        orderId: order.id,
        productId: "00000000-0000-0000-0000-000000000000",
        status: "CONFIRMED",
        currency: "USD",
        amount: new Prisma.Decimal(1000),
        serviceDate: new Date(Date.now() + 30 * DAY),
        confirmedAt,
      },
    });
    created.bookingId = booking.id;

    await prisma.$transaction((tx) =>
      eventBus.emit(tx, {
        aggregateType: "Booking",
        aggregateId: booking.id,
        eventType: DomainEvents.BookingConfirmed,
        payload: { bookingId: booking.id, code: booking.code, orderId: order.id, productId: booking.productId },
      }),
    );
    await eventBus.publishPending();

    const obligationsRes = await request(server())
      .get(`/api/v1/finance/obligations?orderId=${order.id}`)
      .set(auth())
      .expect(200);
    const obligation = (obligationsRes.body as { items: Array<Record<string, unknown>> }).items[0];
    expect(obligation).toBeTruthy();
    created.obligationId = obligation.id as string;
    expect(obligation).toMatchObject({ sourceCurrency: "USD", aznAmount: "1700", status: "OPEN" });

    // Register PENDING payment with allocation: debt must NOT decrease yet.
    const idemKey = `e2e-supplier-key-${stamp}`;
    const createRes = await request(server())
      .post("/api/v1/finance/supplier-payments")
      .set(auth())
      .set("Idempotency-Key", idemKey)
      .send({
        supplierCode: "SUMMERTOUR",
        amount: "400",
        currency: "USD",
        purpose: "e2e finance",
        providerRef: `e2e-fin-${stamp}`,
        allocations: [{ obligationCode: obligation.code, amount: "400" }],
      })
      .expect(201);
    const payment = createRes.body as Record<string, unknown>;
    created.paymentId = payment.id as string;
    created.paymentIds.push(payment.id as string);
    expect(payment.status).toBe("PENDING");
    expect(payment.allocatedAzn).toBe("680");
    expect(payment.unallocatedAzn).toBe("0");

    // Без Idempotency-Key защищённая операция не выполняется (400), слот не создан.
    await request(server())
      .post("/api/v1/finance/supplier-payments")
      .set(auth())
      .send({ supplierCode: "SUMMERTOUR", amount: "1", currency: "USD" })
      .expect(400);

    // Same key + same semantic payload → replay, no second payout/allocation.
    const replayRes = await request(server())
      .post("/api/v1/finance/supplier-payments")
      .set(auth())
      .set("Idempotency-Key", idemKey)
      .send({
        supplierCode: "SUMMERTOUR",
        amount: "400",
        currency: "USD",
        purpose: "e2e finance",
        providerRef: `e2e-fin-${stamp}`,
        allocations: [{ obligationCode: obligation.code, amount: "400" }],
      })
      .expect(201);
    expect((replayRes.body as { code: string }).code).toBe(payment.code);
    expect(await prisma.supplierPayout.count({ where: { providerRef: `e2e-fin-${stamp}` } })).toBe(1);
    expect(await prisma.supplierPayoutAllocation.count({ where: { payoutId: payment.id as string } })).toBe(1);

    // Same key + divergent payload → controlled 409, original payment intact.
    await request(server())
      .post("/api/v1/finance/supplier-payments")
      .set(auth())
      .set("Idempotency-Key", idemKey)
      .send({ supplierCode: "SUMMERTOUR", amount: "401", currency: "USD" })
      .expect(409);

    // Concurrent duplicate with a fresh key: DB unique slot + idempotency layer
    // must return ONE fact, not two.
    const concurrentKey = `e2e-concurrent-${stamp}`;
    const concurrentBody = {
      supplierCode: "SUMMERTOUR",
      amount: "10",
      currency: "USD",
      allocations: [{ obligationCode: obligation.code, amount: "10" }],
    };
    const [c1, c2] = await Promise.all([
      request(server())
        .post("/api/v1/finance/supplier-payments")
        .set(auth())
        .set("Idempotency-Key", concurrentKey)
        .send(concurrentBody),
      request(server())
        .post("/api/v1/finance/supplier-payments")
        .set(auth())
        .set("Idempotency-Key", concurrentKey)
        .send(concurrentBody),
    ]);
    expect([c1.status, c2.status]).toEqual([201, 201]);
    expect((c1.body as { code: string }).code).toBe((c2.body as { code: string }).code);
    const concurrentCode = (c1.body as { code: string }).code;
    const concurrentRow = await prisma.supplierPayout.findUniqueOrThrow({
      where: { code: concurrentCode },
      include: { allocations: true },
    });
    created.paymentIds.push(concurrentRow.id);
    expect(concurrentRow.allocations).toHaveLength(1);
    expect(
      await prisma.supplierPayout.count({ where: { idempotencySlotKey: { not: null }, code: concurrentCode } }),
    ).toBe(1);

    // Different keys → different payments (keys must not merge unrelated ops).
    const distinctBody = { supplierCode: "SUMMERTOUR", amount: "7", currency: "USD" };
    const d1 = await request(server())
      .post("/api/v1/finance/supplier-payments")
      .set(auth())
      .set("Idempotency-Key", `e2e-distinct-a-${stamp}`)
      .send(distinctBody)
      .expect(201);
    const d2 = await request(server())
      .post("/api/v1/finance/supplier-payments")
      .set(auth())
      .set("Idempotency-Key", `e2e-distinct-b-${stamp}`)
      .send(distinctBody)
      .expect(201);
    created.paymentIds.push((d1.body as { id: string }).id, (d2.body as { id: string }).id);
    expect((d1.body as { code: string }).code).not.toBe((d2.body as { code: string }).code);

    // Same providerRef via a DIFFERENT key and identical payload → replay of the
    // external fact; changing allocations under that ref → 409.
    const providerKey1 = `e2e-provider-a-${stamp}`;
    const providerKey2 = `e2e-provider-b-${stamp}`;
    const providerRef = `e2e-provider-ref-${stamp}`;
    const providerBody = {
      supplierCode: "SUMMERTOUR",
      amount: "5",
      currency: "USD",
      providerRef,
      allocations: [{ obligationCode: obligation.code, amount: "5" }],
    };
    const p1 = await request(server())
      .post("/api/v1/finance/supplier-payments")
      .set(auth())
      .set("Idempotency-Key", providerKey1)
      .send(providerBody)
      .expect(201);
    created.paymentIds.push((p1.body as { id: string }).id);
    const p2 = await request(server())
      .post("/api/v1/finance/supplier-payments")
      .set(auth())
      .set("Idempotency-Key", providerKey2)
      .send(providerBody)
      .expect(201);
    expect((p2.body as { code: string }).code).toBe((p1.body as { code: string }).code);
    await request(server())
      .post("/api/v1/finance/supplier-payments")
      .set(auth())
      .set("Idempotency-Key", `e2e-provider-c-${stamp}`)
      .send({ ...providerBody, allocations: [{ obligationCode: obligation.code, amount: "4" }] })
      .expect(409);

    // RBAC/principal isolation: BUYER cannot create a supplier payment; guards
    // run before the idempotency claim (403, no slot/row).
    const buyer = await request(server())
      .post("/api/v1/auth/register")
      .send({
        username: `e2e-fin-buyer-${stamp}`,
        email: `e2e-fin-buyer-${stamp}@test.local`,
        password: "buyerpass123",
        firstName: "E2E",
        lastName: "Buyer",
      })
      .expect(201);
    created.userIds.push((buyer.body as { user: { id: string } }).user.id);
    await request(server())
      .post("/api/v1/finance/supplier-payments")
      .set("Authorization", `Bearer ${(buyer.body as { accessToken: string }).accessToken}`)
      .set("Idempotency-Key", `e2e-buyer-key-${stamp}`)
      .send({ supplierCode: "SUMMERTOUR", amount: "1", currency: "USD" })
      .expect(403);

    const pendingObligation = await request(server())
      .get(`/api/v1/finance/obligations/${obligation.code}`)
      .set(auth())
      .expect(200);
    expect((pendingObligation.body as Record<string, unknown>).paidAmount).toBe("0");

    // Evidence upload (private storage; metadata + audit), list/download.
    const uploadRes = await request(server())
      .post(`/api/v1/finance/supplier-payments/${payment.code}/documents`)
      .set(auth())
      .attach("files", Buffer.from("%PDF-1.4 e2e invoice"), { filename: "invoice.pdf", contentType: "application/pdf" })
      .expect(201);
    created.documentId = (uploadRes.body as { items: Array<{ id: string }> }).items[0].id;
    // Приватный контур: без токена документы недоступны (401), storage key не утекает.
    await request(server())
      .get(`/api/v1/finance/supplier-payments/${payment.code}/documents`)
      .expect(401);
    await request(server())
      .get(`/api/v1/finance/supplier-payments/${payment.code}/documents/${created.documentId}/download`)
      .expect(401);
    const docs = await request(server())
      .get(`/api/v1/finance/supplier-payments/${payment.code}/documents`)
      .set(auth())
      .expect(200);
    expect((docs.body as { items: Array<{ fileName: string }> }).items[0].fileName).toBe("invoice.pdf");
    const download = await request(server())
      .get(`/api/v1/finance/supplier-payments/${payment.code}/documents/${created.documentId}/download`)
      .set(auth())
      .expect(200);
    expect((download.body as { url: string }).url).toContain("signed.test");

    // Confirm: obligation paid, ledger SUPPLIER_PAYOUT appears once.
    await request(server()).post(`/api/v1/finance/supplier-payments/${payment.code}/confirm`).set(auth()).expect(200);
    const confirmedObligation = await request(server())
      .get(`/api/v1/finance/obligations/${obligation.code}`)
      .set(auth())
      .expect(200);
    expect(confirmedObligation.body).toMatchObject({ paidAmount: "680", remainingAmount: "1020", status: "PARTIALLY_PAID" });

    const ledgerAfterConfirm = await prisma.ledgerTransaction.findMany({
      where: { sourceType: "SUPPLIER_PAYOUT", sourceId: payment.id as string },
      orderBy: { createdAt: "asc" },
    });
    expect(ledgerAfterConfirm.map((l) => l.type)).toEqual(["SUPPLIER_PAYOUT"]);
    expect(ledgerAfterConfirm[0].amount.toString()).toBe("400");

    // Confirm twice — no duplicate ledger/obligation changes.
    await request(server()).post(`/api/v1/finance/supplier-payments/${payment.code}/confirm`).set(auth()).expect(200);
    expect(
      await prisma.ledgerTransaction.count({ where: { sourceType: "SUPPLIER_PAYOUT", sourceId: payment.id as string } }),
    ).toBe(1);

    // Cancel: reversal ledger + obligation restored; repeat cancel idempotent.
    await request(server())
      .post(`/api/v1/finance/supplier-payments/${payment.code}/cancel`)
      .set(auth())
      .send({ reason: "e2e bank error" })
      .expect(200);
    const cancelledObligation = await request(server())
      .get(`/api/v1/finance/obligations/${obligation.code}`)
      .set(auth())
      .expect(200);
    expect(cancelledObligation.body).toMatchObject({ paidAmount: "0", remainingAmount: "1700", status: "OPEN" });

    const ledgerAfterCancel = await prisma.ledgerTransaction.findMany({
      where: { sourceType: "SUPPLIER_PAYOUT", sourceId: payment.id as string },
      orderBy: { createdAt: "asc" },
    });
    expect(ledgerAfterCancel.map((l) => l.type).sort()).toEqual(["SUPPLIER_PAYOUT", "SUPPLIER_PAYOUT_REVERSAL"]);
    const reversal = ledgerAfterCancel.find((l) => l.type === "SUPPLIER_PAYOUT_REVERSAL")!;
    expect(reversal.amount.toString()).toBe("400");
    expect(reversal.currency).toBe("USD");

    await request(server()).post(`/api/v1/finance/supplier-payments/${payment.code}/cancel`).set(auth()).send({}).expect(200);
    expect(
      await prisma.ledgerTransaction.count({
        where: { sourceType: "SUPPLIER_PAYOUT", sourceId: payment.id as string, type: "SUPPLIER_PAYOUT_REVERSAL" },
      }),
    ).toBe(1);

    // Debt as of date: before confirmation — no obligation; today — obligation visible.
    const beforeRes = await request(server())
      .get(`/api/v1/finance/reports/supplier-debt?asOf=${new Date(confirmedAt.getTime() - 5 * DAY).toISOString().slice(0, 10)}&search=${booking.code}`)
      .set(auth())
      .expect(200);
    expect((beforeRes.body as { items: unknown[] }).items).toHaveLength(0);
    const todayRes = await request(server())
      .get(`/api/v1/finance/reports/supplier-debt?asOf=${new Date().toISOString().slice(0, 10)}&search=${booking.code}`)
      .set(auth())
      .expect(200);
    const rows = (todayRes.body as { items: Array<Record<string, unknown>> }).items;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ obligationCode: obligation.code, paidAzn: "0", remainingAzn: "1700", precision: "EVENT" });

    // Экспорт отчёта (CSV) + аудит выгрузки.
    const exportRes = await request(server())
      .get(`/api/v1/finance/reports/supplier-debt/export?format=csv&asOf=${new Date().toISOString().slice(0, 10)}&search=${booking.code}`)
      .set(auth())
      .expect(200);
    expect(exportRes.headers["content-type"]).toContain("text/csv");
    expect(exportRes.text).toContain(obligation.code);
    const exportAudit = await prisma.auditLog.findFirst({
      where: { action: "finance.supplier_debt_report.exported", createdAt: { gte: new Date(Date.now() - 5 * 60_000) } },
    });
    expect(exportAudit).toBeTruthy();

    // Evidence of executed payment cannot be deleted; CANCELLED payment too.
    await request(server())
      .delete(`/api/v1/finance/supplier-payments/${payment.code}/documents/${created.documentId}`)
      .set(auth())
      .expect(409);
  }, 120000);
});
