/**
 * PHASE 2 STEP 2.12 — PaymentService unit tests (state guards, frozen money,
 * idempotency, milestones). DB-race/инварианты, дополняющие e2e:
 *  - frozen money: amount/currency серверные из Order snapshot verbatim;
 *  - state machine: единственный authority, from-guard PENDING, повторный
 *    переход → 409, первый milestone wins;
 *  - idempotency: identical retry → существующий активный Payment (no-op);
 *    P2002 (Payment_one_active_per_order) → controlled 409, НЕ raw 500;
 *  - validation: unknown Order → NotFound; CANCELLED/CLOSED Order → 422.
 */
import { Prisma } from "../../generated/prisma/client";
import { PaymentStatus } from "../../generated/prisma/enums";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { PaymentService } from "./payment.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { IdsService } from "../../shared/ids.service";
import type { SecurityService } from "../../security/security.service";
import type { EventBusService } from "../../eventbus/eventbus.service";

interface PrismaStub {
  order: { findUnique: jest.Mock };
  payment: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; updateMany: jest.Mock; findUniqueOrThrow: jest.Mock };
  paymentHistory: { create: jest.Mock };
  operationalNote: { create: jest.Mock };
  $transaction: jest.Mock;
}

const ACTOR = { id: "u1", username: "fin1" };

const ORDER_ROW = {
  id: "ord-1",
  code: "ORD-00000001",
  status: "NEW",
  amount: new Prisma.Decimal("150.00"),
  currency: "USD",
  customerId: "cus-1",
};

const PAYMENT_ROW = {
  id: "pay-1",
  code: "PAY-00000001",
  orderId: "ord-1",
  customerId: "cus-1",
  partnerId: null,
  amount: new Prisma.Decimal("150.00"),
  currency: "USD",
  status: PaymentStatus.PENDING,
  paymentMethod: null,
  providerRef: null,
  version: 1,
  createdAt: new Date("2026-08-14T00:00:00Z"),
  paidAt: null,
  failedAt: null,
  cancelledAt: null,
};

function makePrismaStub(): PrismaStub {
  const prisma: PrismaStub = {
    order: { findUnique: jest.fn().mockResolvedValue(ORDER_ROW) },
    payment: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ ...PAYMENT_ROW, createdAt: new Date() }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(PAYMENT_ROW),
    },
    paymentHistory: { create: jest.fn().mockResolvedValue({ id: "h1" }) },
    operationalNote: { create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: "note-1", ...args.data })) },
    $transaction: jest.fn(),
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

function makeService(prisma: PrismaStub): PaymentService {
  const ids = { nextCode: jest.fn().mockResolvedValue("PAY-00000001") } as unknown as IdsService;
  const security = { audit: jest.fn().mockResolvedValue(undefined) } as unknown as SecurityService;
  const eventBus = {
    emit: jest.fn().mockResolvedValue("evt-1"),
    publishPending: jest.fn().mockResolvedValue(1),
  } as unknown as EventBusService;
  const refNum = { nextMarketplaceReference: jest.fn().mockResolvedValue("MKT-PAY-000001") } as unknown as any;
  return new PaymentService(prisma as unknown as PrismaService, ids, security, eventBus, refNum);
}

describe("PaymentService (Step 2.12)", () => {
  describe("createPayment — frozen money + guards", () => {
    it("копирует frozen Order amount/currency verbatim (без reprice); клиент не передаёт деньги", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      const result = await service.createPayment({ orderId: "ord-1" }, ACTOR);
      expect(result.amount).toBe("150");
      expect(result.currency).toBe("USD");
      expect(result.status).toBe("PENDING");
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: "ord-1",
            amount: ORDER_ROW.amount,
            currency: "USD",
            status: PaymentStatus.PENDING,
            isActivePayment: true,
            version: 1,
          }),
        }),
      );
    });

    it("unknown Order → NotFoundError 404", async () => {
      const prisma = makePrismaStub();
      prisma.order.findUnique.mockResolvedValue(null);
      const service = makeService(prisma);
      await expect(service.createPayment({ orderId: "nope" }, ACTOR)).rejects.toThrow(NotFoundError);
    });

    it("CANCELLED/CLOSED Order → ValidationDomainError 422 (обязательство не подлежит оплате)", async () => {
      for (const status of ["CANCELLED", "CLOSED"]) {
        const prisma = makePrismaStub();
        prisma.order.findUnique.mockResolvedValue({ ...ORDER_ROW, status });
        const service = makeService(prisma);
        await expect(service.createPayment({ orderId: "ord-1" }, ACTOR)).rejects.toThrow(ValidationDomainError);
      }
    });

    it("identical retry: активный Payment уже существует → no-op (существующий факт)", async () => {
      const prisma = makePrismaStub();
      prisma.payment.findFirst.mockResolvedValue({ ...PAYMENT_ROW, createdAt: new Date() });
      const service = makeService(prisma);
      const result = await service.createPayment({ orderId: "ord-1" }, ACTOR);
      expect(result.code).toBe("PAY-00000001");
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it("P2002 (Payment_one_active_per_order) → controlled ConflictError 409, НЕ raw 500", async () => {
      const prisma = makePrismaStub();
      prisma.payment.create.mockRejectedValue({ code: "P2002", meta: { target: ["Payment_one_active_per_order"] } });
      const service = makeService(prisma);
      await expect(service.createPayment({ orderId: "ord-1" }, ACTOR)).rejects.toThrow(ConflictError);
    });

    // ── Phase 3 Round 2D.1: initialNote integration ──────────────────────

    it("createPayment with initialNote: Payment + OperationalNote created atomically", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      await service.createPayment({ orderId: "ord-1", initialNote: "Ожидаем банковское подтверждение" }, ACTOR);
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(prisma.operationalNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: "Payment",
            entityId: expect.any(String),
            text: "Ожидаем банковское подтверждение",
            visibility: "INTERNAL",
            authorUserId: "u1",
            authorName: "fin1",
          }),
        }),
      );
    });

    it("createPayment without initialNote: Payment created, no OperationalNote", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      await service.createPayment({ orderId: "ord-1" }, ACTOR);
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(prisma.operationalNote.create).not.toHaveBeenCalled();
    });

    it("createPayment with empty initialNote: Payment created, no OperationalNote", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      await service.createPayment({ orderId: "ord-1", initialNote: "   " }, ACTOR);
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(prisma.operationalNote.create).not.toHaveBeenCalled();
    });

    it("createPayment with >5000 initialNote: note rejected, Payment NOT created (pre-tx validation)", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      await expect(
        service.createPayment({ orderId: "ord-1", initialNote: "x".repeat(5001) }, ACTOR),
      ).rejects.toThrow("5000");
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.operationalNote.create).not.toHaveBeenCalled();
    });

    it("initialNote does NOT affect Payment status/paidAt/amount/currency", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      const result = await service.createPayment({ orderId: "ord-1", initialNote: "Test note" }, ACTOR);
      expect(result.status).toBe("PENDING");
      expect(result.amount).toBe("150");
      expect(result.currency).toBe("USD");
      // paidAt should be null (not set by note)
      expect(result.paidAt).toBeNull();
    });
  });

  describe("transition — state machine (единственный authority)", () => {
    it("confirm PENDING → CAPTURED: paidAt установлен, isActivePayment остаётся true (overpayment protection)", async () => {
      const prisma = makePrismaStub();
      prisma.payment.findUnique.mockResolvedValue(PAYMENT_ROW);
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({
        ...PAYMENT_ROW,
        status: PaymentStatus.CAPTURED,
        version: 2,
        paidAt: new Date(),
      });
      const service = makeService(prisma);
      const result = await service.confirmPayment("PAY-00000001", ACTOR);
      expect(result.status).toBe("CAPTURED");
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pay-1", status: PaymentStatus.PENDING, version: 1 },
          data: expect.objectContaining({ status: PaymentStatus.CAPTURED, paidAt: expect.any(Date), isActivePayment: true }),
        }),
      );
    });

    it("fail PENDING → FAILED: failedAt установлен, isActivePayment=false (attempt 2 легален)", async () => {
      const prisma = makePrismaStub();
      prisma.payment.findUnique.mockResolvedValue(PAYMENT_ROW);
      const service = makeService(prisma);
      await service.failPayment("PAY-00000001", ACTOR);
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.FAILED, failedAt: expect.any(Date), isActivePayment: false }),
        }),
      );
    });

    it("cancel PENDING → CANCELLED: cancelledAt установлен, isActivePayment=false", async () => {
      const prisma = makePrismaStub();
      prisma.payment.findUnique.mockResolvedValue(PAYMENT_ROW);
      const service = makeService(prisma);
      await service.cancelPayment("PAY-00000001", ACTOR);
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.CANCELLED, cancelledAt: expect.any(Date), isActivePayment: false }),
        }),
      );
    });

    it("repeat confirm (уже CAPTURED) → ConflictError 409 (terminal protection)", async () => {
      const prisma = makePrismaStub();
      prisma.payment.findUnique.mockResolvedValue({ ...PAYMENT_ROW, status: PaymentStatus.CAPTURED, version: 2, paidAt: new Date() });
      const service = makeService(prisma);
      await expect(service.confirmPayment("PAY-00000001", ACTOR)).rejects.toThrow(ConflictError);
    });

    it("confirm из FAILED → ConflictError 409 (from-guard PENDING)", async () => {
      const prisma = makePrismaStub();
      prisma.payment.findUnique.mockResolvedValue({ ...PAYMENT_ROW, status: PaymentStatus.FAILED, version: 2, failedAt: new Date() });
      const service = makeService(prisma);
      await expect(service.confirmPayment("PAY-00000001", ACTOR)).rejects.toThrow(ConflictError);
    });

    it("CAS-проигрыш (concurrent) → ConflictError 409, без duplicate history", async () => {
      const prisma = makePrismaStub();
      prisma.payment.findUnique.mockResolvedValue(PAYMENT_ROW);
      prisma.payment.updateMany.mockResolvedValue({ count: 0 });
      const service = makeService(prisma);
      await expect(service.confirmPayment("PAY-00000001", ACTOR)).rejects.toThrow(ConflictError);
      expect(prisma.paymentHistory.create).not.toHaveBeenCalled();
    });

    it("unknown Payment → NotFoundError 404", async () => {
      const prisma = makePrismaStub();
      prisma.payment.findUnique.mockResolvedValue(null);
      const service = makeService(prisma);
      await expect(service.confirmPayment("PAY-99999999", ACTOR)).rejects.toThrow(NotFoundError);
    });
  });
});
