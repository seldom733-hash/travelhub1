/**
 * PHASE 2 STEP 2.13 — RefundService unit tests (state guards, source authority,
 * over-refund protection, idempotency, milestones). DB-race/инварианты,
 * дополняющие e2e:
 *  - source authority: только CAPTURED Payment; currency/orderId server-derived;
 *  - over-refund: serialized advisory lock + SUM(non-FAILED) ≤ payment.amount;
 *  - idempotency: identical (paymentId+amount) НЕ-FAILED → no-op; P2002
 *    (Refund_one_active_per_payment_amount) → controlled 409;
 *  - state machine: единственный authority, from-guard, первый milestone wins.
 */
import { Prisma } from "../../generated/prisma/client";
import { RefundStatus } from "../../generated/prisma/enums";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { RefundService } from "./refund.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { IdsService } from "../../shared/ids.service";
import type { SecurityService } from "../../security/security.service";
import type { EventBusService } from "../../eventbus/eventbus.service";

interface PrismaStub {
  payment: { findUnique: jest.Mock };
  refund: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    aggregate: jest.Mock;
  };
  refundHistory: { create: jest.Mock };
  operationalNote: { create: jest.Mock };
  $executeRaw: jest.Mock;
  $transaction: jest.Mock;
}

const ACTOR = { id: "u1", username: "fin1" };

const PAYMENT_ROW = {
  id: "pay-1",
  code: "PAY-00000001",
  orderId: "ord-1",
  amount: new Prisma.Decimal("150.00"),
  currency: "USD",
  status: "CAPTURED",
  customerId: "cus-1",
};

const REFUND_ROW = {
  id: "rfd-1",
  code: "RFD-00000001",
  paymentId: "pay-1",
  orderId: "ord-1",
  amount: new Prisma.Decimal("50.00"),
  currency: "USD",
  status: RefundStatus.REQUESTED,
  reason: null,
  version: 1,
  createdAt: new Date("2026-08-14T00:00:00Z"),
  requestedAt: new Date("2026-08-14T00:00:00Z"),
  approvedAt: null,
  processedAt: null,
  failedAt: null,
};

function makePrismaStub(): PrismaStub {
  const prisma: PrismaStub = {
    payment: { findUnique: jest.fn().mockResolvedValue(PAYMENT_ROW) },
    refund: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ ...REFUND_ROW, createdAt: new Date() }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(REFUND_ROW),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
    },
    refundHistory: { create: jest.fn().mockResolvedValue({ id: "h1" }) },
    operationalNote: { create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: "note-1", ...args.data })) },
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn(),
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

function makeService(prisma: PrismaStub): RefundService {
  const ids = { nextCode: jest.fn().mockResolvedValue("RFD-00000001") } as unknown as IdsService;
  const security = { audit: jest.fn().mockResolvedValue(undefined) } as unknown as SecurityService;
  const eventBus = {
    emit: jest.fn().mockResolvedValue("evt-1"),
    publishPending: jest.fn().mockResolvedValue(1),
  } as unknown as EventBusService;
  const refNum = { nextMarketplaceReference: jest.fn().mockResolvedValue("MKT-REF-000001") } as unknown as any;
  return new RefundService(prisma as unknown as PrismaService, ids, security, eventBus, refNum);
}

describe("RefundService (Step 2.13)", () => {
  describe("createRefund — source authority + frozen money + over-refund", () => {
    it("копирует currency/orderId verbatim из CAPTURED Payment; amount из запроса; REQUESTED + requestedAt", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      const result = await service.createRefund({ paymentId: "pay-1", amount: "50.00" }, ACTOR);
      expect(result.amount).toBe("50");
      expect(result.currency).toBe("USD");
      expect(result.orderId).toBe("ord-1");
      expect(result.status).toBe("REQUESTED");
      expect(prisma.refund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentId: "pay-1",
            orderId: "ord-1",
            amount: new Prisma.Decimal("50.00"),
            currency: "USD",
            status: RefundStatus.REQUESTED,
            isActiveRefund: true,
            version: 1,
            requestedAt: expect.any(Date),
          }),
        }),
      );
      // Over-refund serialization: advisory lock по paymentId + SUM(non-FAILED).
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.refund.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { paymentId: "pay-1", status: { notIn: ["FAILED"] } } }),
      );
    });

    it("unknown Payment → NotFoundError 404", async () => {
      const prisma = makePrismaStub();
      prisma.payment.findUnique.mockResolvedValue(null);
      const service = makeService(prisma);
      await expect(service.createRefund({ paymentId: "nope", amount: "10" }, ACTOR)).rejects.toThrow(NotFoundError);
    });

    it("non-CAPTURED Payment (PENDING/FAILED/CANCELLED) → ValidationDomainError 422", async () => {
      for (const status of ["PENDING", "FAILED", "CANCELLED", "AUTHORIZED"]) {
        const prisma = makePrismaStub();
        prisma.payment.findUnique.mockResolvedValue({ ...PAYMENT_ROW, status });
        const service = makeService(prisma);
        await expect(service.createRefund({ paymentId: "pay-1", amount: "10" }, ACTOR)).rejects.toThrow(ValidationDomainError);
      }
    });

    it("zero/negative/malformed amount → ValidationDomainError 422", async () => {
      const service = makeService(makePrismaStub());
      for (const bad of ["0", "-5", "abc", "", "1.999"]) {
        await expect(service.createRefund({ paymentId: "pay-1", amount: bad }, ACTOR)).rejects.toThrow(ValidationDomainError);
      }
    });

    it("refund > refundable (уже refunded) → ConflictError 409, Refund НЕ создаётся", async () => {
      const prisma = makePrismaStub();
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal("120.00") } }); // 150 - 120 = 30
      const service = makeService(prisma);
      await expect(service.createRefund({ paymentId: "pay-1", amount: "50" }, ACTOR)).rejects.toThrow(ConflictError);
      expect(prisma.refund.create).not.toHaveBeenCalled();
    });

    it("identical retry: НЕ-FAILED Refund с тем же (paymentId, amount) → no-op (существующий факт)", async () => {
      const prisma = makePrismaStub();
      prisma.refund.findFirst.mockResolvedValue({ ...REFUND_ROW, createdAt: new Date() });
      const service = makeService(prisma);
      const result = await service.createRefund({ paymentId: "pay-1", amount: "50" }, ACTOR);
      expect(result.code).toBe("RFD-00000001");
      expect(prisma.refund.create).not.toHaveBeenCalled();
    });

    it("P2002 (Refund_one_active_per_payment_amount) → controlled ConflictError 409, НЕ raw 500", async () => {
      const prisma = makePrismaStub();
      prisma.refund.create.mockRejectedValue({ code: "P2002", meta: { target: ["Refund_one_active_per_payment_amount"] } });
      const service = makeService(prisma);
      await expect(service.createRefund({ paymentId: "pay-1", amount: "50" }, ACTOR)).rejects.toThrow(ConflictError);
    });

    // ── Phase 3 Round 2D.1: initialNote integration ──────────────────────

    it("createRefund with initialNote: Refund + OperationalNote created atomically", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      await service.createRefund({ paymentId: "pay-1", amount: "50", initialNote: "Клиент запросил возврат за неоказанную услугу" }, ACTOR);
      expect(prisma.refund.create).toHaveBeenCalled();
      expect(prisma.operationalNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: "Refund",
            entityId: expect.any(String),
            text: "Клиент запросил возврат за неоказанную услугу",
            visibility: "INTERNAL",
            authorUserId: "u1",
            authorName: "fin1",
          }),
        }),
      );
    });

    it("createRefund without initialNote: Refund created, no OperationalNote", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      await service.createRefund({ paymentId: "pay-1", amount: "50" }, ACTOR);
      expect(prisma.refund.create).toHaveBeenCalled();
      expect(prisma.operationalNote.create).not.toHaveBeenCalled();
    });

    it("createRefund with empty initialNote: Refund created, no OperationalNote", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      await service.createRefund({ paymentId: "pay-1", amount: "50", initialNote: "   " }, ACTOR);
      expect(prisma.refund.create).toHaveBeenCalled();
      expect(prisma.operationalNote.create).not.toHaveBeenCalled();
    });

    it("createRefund with >5000 initialNote: note rejected, Refund NOT created (pre-tx validation)", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      await expect(
        service.createRefund({ paymentId: "pay-1", amount: "50", initialNote: "x".repeat(5001) }, ACTOR),
      ).rejects.toThrow("5000");
      expect(prisma.refund.create).not.toHaveBeenCalled();
      expect(prisma.operationalNote.create).not.toHaveBeenCalled();
    });

    it("initialNote does NOT affect Refund status/processedAt/reason/amount", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      const result = await service.createRefund({ paymentId: "pay-1", amount: "50", initialNote: "Test note" }, ACTOR);
      expect(result.status).toBe("REQUESTED");
      expect(result.amount).toBe("50");
      expect(result.reason).toBeNull();
      // processedAt should be null (not set by note)
      expect(result.processedAt).toBeNull();
    });
  });

  describe("transition — state machine (единственный authority)", () => {
    it("approve REQUESTED → APPROVED: approvedAt установлен, isActiveRefund остаётся true", async () => {
      const prisma = makePrismaStub();
      prisma.refund.findUnique.mockResolvedValue(REFUND_ROW);
      prisma.refund.findUniqueOrThrow.mockResolvedValue({
        ...REFUND_ROW,
        status: RefundStatus.APPROVED,
        version: 2,
        approvedAt: new Date(),
      });
      const service = makeService(prisma);
      const result = await service.approveRefund("RFD-00000001", ACTOR);
      expect(result.status).toBe("APPROVED");
      expect(prisma.refund.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "rfd-1", status: RefundStatus.REQUESTED, version: 1 },
          data: expect.objectContaining({ status: RefundStatus.APPROVED, approvedAt: expect.any(Date), isActiveRefund: true }),
        }),
      );
    });

    it("process APPROVED → PROCESSED: processedAt установлен, isActiveRefund остаётся true (retry → no-op)", async () => {
      const prisma = makePrismaStub();
      prisma.refund.findUnique.mockResolvedValue({ ...REFUND_ROW, status: RefundStatus.APPROVED, version: 2, approvedAt: new Date() });
      const service = makeService(prisma);
      await service.processRefund("RFD-00000001", ACTOR);
      expect(prisma.refund.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: RefundStatus.PROCESSED, processedAt: expect.any(Date), isActiveRefund: true }),
        }),
      );
    });

    it("fail из REQUESTED и из APPROVED → FAILED: failedAt установлен, isActiveRefund=false (attempt 2 легален)", async () => {
      for (const from of [RefundStatus.REQUESTED, RefundStatus.APPROVED]) {
        const prisma = makePrismaStub();
        prisma.refund.findUnique.mockResolvedValue({ ...REFUND_ROW, status: from, version: from === RefundStatus.APPROVED ? 2 : 1 });
        const service = makeService(prisma);
        await service.failRefund("RFD-00000001", ACTOR);
        expect(prisma.refund.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ status: RefundStatus.FAILED, failedAt: expect.any(Date), isActiveRefund: false }),
          }),
        );
      }
    });

    it("approve из APPROVED (уже) → ConflictError 409 (from-guard)", async () => {
      const prisma = makePrismaStub();
      prisma.refund.findUnique.mockResolvedValue({ ...REFUND_ROW, status: RefundStatus.APPROVED, version: 2 });
      const service = makeService(prisma);
      await expect(service.approveRefund("RFD-00000001", ACTOR)).rejects.toThrow(ConflictError);
    });

    it("process из REQUESTED (не APPROVED) → ConflictError 409 (from-guard)", async () => {
      const prisma = makePrismaStub();
      prisma.refund.findUnique.mockResolvedValue(REFUND_ROW);
      const service = makeService(prisma);
      await expect(service.processRefund("RFD-00000001", ACTOR)).rejects.toThrow(ConflictError);
    });

    it("CAS-проигрыш (concurrent) → ConflictError 409, без duplicate history", async () => {
      const prisma = makePrismaStub();
      prisma.refund.findUnique.mockResolvedValue(REFUND_ROW);
      prisma.refund.updateMany.mockResolvedValue({ count: 0 });
      const service = makeService(prisma);
      await expect(service.approveRefund("RFD-00000001", ACTOR)).rejects.toThrow(ConflictError);
      expect(prisma.refundHistory.create).not.toHaveBeenCalled();
    });

    it("unknown Refund → NotFoundError 404", async () => {
      const prisma = makePrismaStub();
      prisma.refund.findUnique.mockResolvedValue(null);
      const service = makeService(prisma);
      await expect(service.approveRefund("RFD-99999999", ACTOR)).rejects.toThrow(NotFoundError);
    });
  });
});
