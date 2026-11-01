/**
 * Cancellation financial settlement — isolated-DB e2e.
 *
 * Verifies the approved examples against real Prisma/Postgres facts:
 *  - full settlement with penalty (no fake payments; write-off adjustment);
 *  - repeat confirmation is idempotent;
 *  - pending refund blocks FINANCIALLY_SETTLED;
 *  - ledger and AuditLog receive adjustment facts.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";

const stamp = Date.now();

describe("Order financial cancellation settlement (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ username: "admin", password: "admin123" })
      .expect(200);
    token = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedSettledCancellation(tag: string, pendingRefund = false) {
    const suffix = `${tag}-${stamp}`;
    const order = await prisma.order.create({
      data: {
        code: `SET-ORD-${suffix}`,
        number: `SET-TH-${suffix}`,
        referenceNumber: `MKT-SET-${suffix}`,
        commerceSequence: String(Math.floor(Math.random() * 900000) + 100000),
        status: "CANCELLED",
        paymentStatus: "PARTIALLY_PAID",
        currency: "AZN",
        amount: 2000,
        paidAmount: 1200,
        refundedAmount: pendingRefund ? 0 : 300,
        cancelledAt: new Date(),
        acquisitionSource: "MARKETPLACE",
      },
    });
    const payment = await prisma.payment.create({
      data: {
        code: `SET-PAY-${suffix}`,
        referenceNumber: `MKT-SET-PAY-${suffix}`,
        orderId: order.id,
        amount: 1200,
        currency: "AZN",
        status: "CAPTURED",
        paidAt: new Date(),
        isActivePayment: true,
      },
    });
    await prisma.ledgerTransaction.create({
      data: {
        code: `SET-LTX-P-${suffix}`,
        amount: 1200,
        currency: "AZN",
        type: "PAYMENT_CAPTURED",
        sourceType: "PAYMENT",
        sourceId: payment.id,
      },
    });
    if (pendingRefund) {
      await prisma.refund.create({
        data: {
          code: `SET-RFD-${suffix}`,
          referenceNumber: `MKT-SET-RFD-${suffix}`,
          paymentId: payment.id,
          orderId: order.id,
          amount: 100,
          currency: "AZN",
          status: "REQUESTED",
          requestedAt: new Date(),
          isActiveRefund: true,
        },
      });
    } else {
      const refund = await prisma.refund.create({
        data: {
          code: `SET-RFD-${suffix}`,
          referenceNumber: `MKT-SET-RFD-${suffix}`,
          paymentId: payment.id,
          orderId: order.id,
          amount: 300,
          currency: "AZN",
          status: "PROCESSED",
          requestedAt: new Date(),
          approvedAt: new Date(),
          processedAt: new Date(),
          isActiveRefund: true,
        },
      });
      await prisma.ledgerTransaction.create({
        data: {
          code: `SET-LTX-R-${suffix}`,
          amount: 300,
          currency: "AZN",
          type: "REFUND_PROCESSED",
          sourceType: "REFUND",
          sourceId: refund.id,
        },
      });
    }
    return order;
  }

  it("closes scenario A with penalty and write-off, idempotently", async () => {
    const order = await seedSettledCancellation("A");
    const body = {
      finalCustomerLiability: "900.00",
      penaltyAmount: "900.00",
      platformPenaltyShare: "400.00",
      supplierPenaltyShare: "500.00",
      reason: "Non-refundable supplier fee",
    };
    const first = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/financial-settlement/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send(body)
      .expect(201);

    expect(first.body.status).toBe("FINANCIALLY_SETTLED_WITH_PENALTY");
    expect(first.body.annulledUnpaidAmount).toBe("800");
    expect(first.body.remainingToPay).toBe("0");
    expect(first.body.remainingToRefund).toBe("0");

    const repeat = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/financial-settlement/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send(body)
      .expect(201);
    expect(repeat.body.id).toBe(first.body.id);

    const freshness = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(freshness.financialStatus).toBe("FINANCIALLY_SETTLED_WITH_PENALTY");
    expect(await prisma.orderFinancialAdjustment.count({ where: { orderId: order.id } })).toBe(3);
    expect(await prisma.ledgerTransaction.count({
      where: { sourceType: "ORDER_FINANCIAL_ADJUSTMENT", sourceId: { in: (await prisma.orderFinancialAdjustment.findMany({ where: { orderId: order.id }, select: { id: true } })).map((a) => a.id) } },
    })).toBe(3);
    expect(await prisma.auditLog.count({
      where: { resource: "OrderFinancialSettlement", resourceId: first.body.id },
    })).toBeGreaterThan(0);
  });

  it("does not close while a refund is still pending", async () => {
    const order = await seedSettledCancellation("B", true);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/financial-settlement/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        finalCustomerLiability: "1200.00",
        penaltyAmount: "0",
        platformPenaltyShare: "0",
        supplierPenaltyShare: "0",
        reason: "Attempted close",
      });
    expect(res.status).toBe(409);
    const freshness = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(freshness.financialStatus).toBe("OPEN");
  });
});
