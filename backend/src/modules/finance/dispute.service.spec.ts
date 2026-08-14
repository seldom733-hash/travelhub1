/**
 * PHASE 2 STEP 2.13A — DisputeService unit tests (state guards, source authority,
 * amount ≤ captured, idempotency, milestones). DB-race/инварианты, дополняющие e2e:
 *  - source authority: только CAPTURED Payment; currency/orderId server-derived;
 *  - amount: > 0, ≤ payment.amount (frozen captured); НЕ netting с Refund;
 *  - idempotency: один активный Dispute на payment → no-op; P2002
 *    (Dispute_one_active_per_payment) → controlled 409;
 *  - state machine: единственный authority, from-guard OPENED, первый milestone
 *    wins; терминальные освобождают слот.
 */
import { Prisma } from "../../generated/prisma/client";
import { DisputeStatus } from "../../generated/prisma/enums";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { DisputeService } from "./dispute.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { IdsService } from "../../shared/ids.service";
import type { SecurityService } from "../../security/security.service";
import type { EventBusService } from "../../eventbus/eventbus.service";

interface PrismaStub {
  payment: { findUnique: jest.Mock };
  dispute: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
    findUniqueOrThrow: jest.Mock;
  };
  disputeHistory: { create: jest.Mock };
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

const DISPUTE_ROW = {
  id: "dsp-1",
  code: "DSP-00000001",
  paymentId: "pay-1",
  orderId: "ord-1",
  amount: new Prisma.Decimal("50.00"),
  currency: "USD",
  status: DisputeStatus.OPENED,
  reason: null,
  version: 1,
  createdAt: new Date("2026-08-14T00:00:00Z"),
  openedAt: new Date("2026-08-14T00:00:00Z"),
  resolvedAt: null,
  cancelledAt: null,
};

function makePrismaStub(): PrismaStub {
  const prisma: PrismaStub = {
    payment: { findUnique: jest.fn().mockResolvedValue(PAYMENT_ROW) },
    dispute: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ ...DISPUTE_ROW, createdAt: new Date() }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(DISPUTE_ROW),
    },
    disputeHistory: { create: jest.fn().mockResolvedValue({ id: "h1" }) },
    $transaction: jest.fn(),
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

function makeService(prisma: PrismaStub): DisputeService {
  const ids = { nextCode: jest.fn().mockResolvedValue("DSP-00000001") } as unknown as IdsService;
  const security = { audit: jest.fn().mockResolvedValue(undefined) } as unknown as SecurityService;
  const eventBus = {
    emit: jest.fn().mockResolvedValue("evt-1"),
    publishPending: jest.fn().mockResolvedValue(1),
  } as unknown as EventBusService;
  return new DisputeService(prisma as unknown as PrismaService, ids, security, eventBus);
}

describe("DisputeService (Step 2.13A)", () => {
  describe("createDispute — source authority + frozen money + amount guard", () => {
    it("копирует currency/orderId verbatim из CAPTURED Payment; amount из запроса; OPENED + openedAt", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      const result = await service.createDispute({ paymentId: "pay-1", amount: "50.00" }, ACTOR);
      expect(result.amount).toBe("50");
      expect(result.currency).toBe("USD");
      expect(result.orderId).toBe("ord-1");
      expect(result.status).toBe("OPENED");
      expect(prisma.dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentId: "pay-1",
            orderId: "ord-1",
            amount: new Prisma.Decimal("50.00"),
            currency: "USD",
            status: DisputeStatus.OPENED,
            isActiveDispute: true,
            version: 1,
            openedAt: expect.any(Date),
          }),
        }),
      );
    });

    it("unknown Payment → NotFoundError 404", async () => {
      const prisma = makePrismaStub();
      prisma.payment.findUnique.mockResolvedValue(null);
      const service = makeService(prisma);
      await expect(service.createDispute({ paymentId: "nope", amount: "10" }, ACTOR)).rejects.toThrow(NotFoundError);
    });

    it("non-CAPTURED Payment (PENDING/FAILED/CANCELLED/AUTHORIZED) → ValidationDomainError 422", async () => {
      for (const status of ["PENDING", "FAILED", "CANCELLED", "AUTHORIZED"]) {
        const prisma = makePrismaStub();
        prisma.payment.findUnique.mockResolvedValue({ ...PAYMENT_ROW, status });
        const service = makeService(prisma);
        await expect(service.createDispute({ paymentId: "pay-1", amount: "10" }, ACTOR)).rejects.toThrow(ValidationDomainError);
      }
    });

    it("zero/negative/malformed amount → ValidationDomainError 422", async () => {
      const service = makeService(makePrismaStub());
      for (const bad of ["0", "-5", "abc", "", "1.999"]) {
        await expect(service.createDispute({ paymentId: "pay-1", amount: bad }, ACTOR)).rejects.toThrow(ValidationDomainError);
      }
    });

    it("amount > payment.amount (frozen captured) → ConflictError 409, Dispute НЕ создаётся (без netting с Refund)", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      await expect(service.createDispute({ paymentId: "pay-1", amount: "200" }, ACTOR)).rejects.toThrow(ConflictError);
      expect(prisma.dispute.create).not.toHaveBeenCalled();
    });

    it("identical retry: активный Dispute на payment (тот же amount) → no-op (существующий факт)", async () => {
      const prisma = makePrismaStub();
      prisma.dispute.findFirst.mockResolvedValue({ ...DISPUTE_ROW, createdAt: new Date() });
      const service = makeService(prisma);
      const result = await service.createDispute({ paymentId: "pay-1", amount: "50" }, ACTOR);
      expect(result.code).toBe("DSP-00000001");
      expect(prisma.dispute.create).not.toHaveBeenCalled();
    });

    it("STRICT REVIEW FIX: divergent amount при активном Dispute → ConflictError 409, НЕ молчаливый no-op с чужим фактом", async () => {
      const prisma = makePrismaStub();
      prisma.dispute.findFirst.mockResolvedValue({ ...DISPUTE_ROW, createdAt: new Date() });
      const service = makeService(prisma);
      // Активный Dispute = 50; запрос с другим amount (30) — материально другой
      // business payload → 409, а не возврат existing с amount=50.
      await expect(service.createDispute({ paymentId: "pay-1", amount: "30" }, ACTOR)).rejects.toThrow(ConflictError);
      expect(prisma.dispute.create).not.toHaveBeenCalled();
    });

    it("P2002 (Dispute_one_active_per_payment) → controlled ConflictError 409, НЕ raw 500", async () => {
      const prisma = makePrismaStub();
      prisma.dispute.create.mockRejectedValue({ code: "P2002", meta: { target: ["Dispute_one_active_per_payment"] } });
      const service = makeService(prisma);
      await expect(service.createDispute({ paymentId: "pay-1", amount: "50" }, ACTOR)).rejects.toThrow(ConflictError);
    });
  });

  describe("transition — state machine (единственный authority)", () => {
    it("resolve OPENED → RESOLVED: resolvedAt установлен, isActiveDispute=false (слот освобождён)", async () => {
      const prisma = makePrismaStub();
      prisma.dispute.findUnique.mockResolvedValue(DISPUTE_ROW);
      prisma.dispute.findUniqueOrThrow.mockResolvedValue({
        ...DISPUTE_ROW,
        status: DisputeStatus.RESOLVED,
        version: 2,
        resolvedAt: new Date(),
        isActiveDispute: false,
      });
      const service = makeService(prisma);
      const result = await service.resolveDispute("DSP-00000001", ACTOR);
      expect(result.status).toBe("RESOLVED");
      expect(prisma.dispute.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "dsp-1", status: DisputeStatus.OPENED, version: 1 },
          data: expect.objectContaining({ status: DisputeStatus.RESOLVED, resolvedAt: expect.any(Date), isActiveDispute: false }),
        }),
      );
    });

    it("cancel OPENED → CANCELLED: cancelledAt установлен, isActiveDispute=false (attempt 2 легален)", async () => {
      const prisma = makePrismaStub();
      prisma.dispute.findUnique.mockResolvedValue(DISPUTE_ROW);
      prisma.dispute.findUniqueOrThrow.mockResolvedValue({
        ...DISPUTE_ROW,
        status: DisputeStatus.CANCELLED,
        version: 2,
        cancelledAt: new Date(),
        isActiveDispute: false,
      });
      const service = makeService(prisma);
      const result = await service.cancelDispute("DSP-00000001", ACTOR);
      expect(result.status).toBe("CANCELLED");
      expect(prisma.dispute.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "dsp-1", status: DisputeStatus.OPENED, version: 1 },
          data: expect.objectContaining({ status: DisputeStatus.CANCELLED, cancelledAt: expect.any(Date), isActiveDispute: false }),
        }),
      );
    });

    it("resolve из RESOLVED (уже) → ConflictError 409 (from-guard)", async () => {
      const prisma = makePrismaStub();
      prisma.dispute.findUnique.mockResolvedValue({ ...DISPUTE_ROW, status: DisputeStatus.RESOLVED, version: 2, isActiveDispute: false });
      const service = makeService(prisma);
      await expect(service.resolveDispute("DSP-00000001", ACTOR)).rejects.toThrow(ConflictError);
    });

    it("cancel из RESOLVED (терминальный) → ConflictError 409 (terminal protection)", async () => {
      const prisma = makePrismaStub();
      prisma.dispute.findUnique.mockResolvedValue({ ...DISPUTE_ROW, status: DisputeStatus.RESOLVED, version: 2, isActiveDispute: false });
      const service = makeService(prisma);
      await expect(service.cancelDispute("DSP-00000001", ACTOR)).rejects.toThrow(ConflictError);
    });

    it("CAS-проигрыш (concurrent) → ConflictError 409, без duplicate history", async () => {
      const prisma = makePrismaStub();
      prisma.dispute.findUnique.mockResolvedValue(DISPUTE_ROW);
      prisma.dispute.updateMany.mockResolvedValue({ count: 0 });
      const service = makeService(prisma);
      await expect(service.resolveDispute("DSP-00000001", ACTOR)).rejects.toThrow(ConflictError);
      expect(prisma.disputeHistory.create).not.toHaveBeenCalled();
    });

    it("unknown Dispute → NotFoundError 404", async () => {
      const prisma = makePrismaStub();
      prisma.dispute.findUnique.mockResolvedValue(null);
      const service = makeService(prisma);
      await expect(service.resolveDispute("DSP-99999999", ACTOR)).rejects.toThrow(NotFoundError);
    });
  });
});
