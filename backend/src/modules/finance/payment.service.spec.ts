/**
 * PHASE 2 STEP 2.12 → MULTI/PARTIAL PAYMENTS — PaymentService unit tests
 * (state guards, frozen money, idempotency, milestones). DB-race/инварианты,
 * дополняющие e2e:
 *  - frozen money: currency серверное из Order snapshot verbatim; amount —
 *    клиентский ввод, ограничен due-guard (0 < amount <= due);
 *  - state machine: единственный authority, from-guard PENDING, повторный
 *    переход → 409, первый milestone wins; confirm → overpayment guard;
 *  - idempotency: ВНЕШНИЙ Idempotency-Key (interceptor); бизнес-level
 *    active-noop снят — новый create = новый факт; P2002 не глотается;
 *    MULTI/PARTIAL §13: per-slot бизнес-идемпотентность (тот же слот →
 *    тот же Payment; P2002 на слоте → существующий Payment, не raw 500);
 *  - validation: unknown Order → NotFound; CANCELLED/CLOSED Order → 422;
 *    amount > due / формат → 422.
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
  payment: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; updateMany: jest.Mock; findUniqueOrThrow: jest.Mock; aggregate: jest.Mock };
  paymentHistory: { create: jest.Mock };
  operationalNote: { create: jest.Mock };
  $transaction: jest.Mock;
  $executeRaw: jest.Mock;
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
      create: jest.fn().mockImplementation((args: any) => Promise.resolve({ ...PAYMENT_ROW, ...args.data, createdAt: new Date() })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(PAYMENT_ROW),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
    },
    paymentHistory: { create: jest.fn().mockResolvedValue({ id: "h1" }) },
    operationalNote: { create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: "note-1", ...args.data })) },
    $transaction: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(0),
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
      const result = await service.createPayment({ orderId: "ord-1", reason: "manual" }, ACTOR);
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
      await expect(service.createPayment({ orderId: "nope", reason: "manual" }, ACTOR)).rejects.toThrow(NotFoundError);
    });

    it("MULTI/PARTIAL §13: тот же idempotencySlotKey → возвращает существующий Payment (без create — бизнес-идемпотентность)", async () => {
      const prisma = makePrismaStub();
      const existing = { ...PAYMENT_ROW, idempotencySlotKey: "slot-1" };
      prisma.payment.findUnique.mockResolvedValue(existing);
      const service = makeService(prisma);
      const result = await service.createPayment({ orderId: "ord-1", reason: "manual" }, ACTOR, "slot-1");
      expect(result.id).toBe("pay-1");
      expect(result.status).toBe("PENDING");
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("MULTI/PARTIAL §13: незнакомый/null слот → штатный create; slotKey проставляется в строке Payment", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      const result = await service.createPayment({ orderId: "ord-1", reason: "manual" }, ACTOR, "slot-2");
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({ where: { idempotencySlotKey: "slot-2" } });
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ idempotencySlotKey: "slot-2" }),
        }),
      );
      expect(result.status).toBe("PENDING");
      // Вне HTTP-idempotency-контекста слота нет.
      await service.createPayment({ orderId: "ord-1", reason: "manual" }, ACTOR);
      expect(prisma.payment.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ idempotencySlotKey: null }) }),
      );
    });

    it("P2002 на Payment_idempotencySlotKey_key (гонка executor'ов одного слота) → существующий Payment, не raw 500", async () => {
      const prisma = makePrismaStub();
      const existing = { ...PAYMENT_ROW, idempotencySlotKey: "slot-3" };
      prisma.payment.findUnique
        .mockResolvedValueOnce(null) // первый lookup: ещё не создан
        .mockResolvedValueOnce(existing); // после P2002: уже создан конкурентом
      prisma.payment.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed on idempotencySlotKey", {
          code: "P2002",
          clientVersion: "7.9.1",
        }),
      );
      const service = makeService(prisma);
      const result = await service.createPayment({ orderId: "ord-1", reason: "manual" }, ACTOR, "slot-3");
      expect(result.id).toBe("pay-1");
    });

    it("CANCELLED/CLOSED Order → ValidationDomainError 422 (обязательство не подлежит оплате)", async () => {
      for (const status of ["CANCELLED", "CLOSED"]) {
        const prisma = makePrismaStub();
        prisma.order.findUnique.mockResolvedValue({ ...ORDER_ROW, status });
        const service = makeService(prisma);
        await expect(service.createPayment({ orderId: "ord-1", reason: "manual" }, ACTOR)).rejects.toThrow(ValidationDomainError);
      }
    });

    it("multi: активный Payment НЕ блокирует новый create (due-guard вместо one-active)", async () => {
      const prisma = makePrismaStub();
      prisma.payment.findFirst.mockResolvedValue({ ...PAYMENT_ROW, createdAt: new Date() });
      const service = makeService(prisma);
      // paid=0 (CAPTURED/REFUNDED нет), reserved=0 (PENDING нет) → due=150.
      prisma.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });
      const result = await service.createPayment({ orderId: "ord-1", amount: "50", reason: "manual" }, ACTOR);
      expect(result.amount).toBe("50");
      expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    });

    it("amount без значения → берётся весь текущий остаток (due = total − paid − reserved)", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      prisma.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal("50") } }) // paid
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal("30") } }); // reserved (PENDING)
      await service.createPayment({ orderId: "ord-1", reason: "manual" }, ACTOR);
      // 150 − 50 − 30 = 70
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: new Prisma.Decimal("70") }) }),
      );
    });

    it("amount > due → ValidationDomainError 422 (переплата невозможна)", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      prisma.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal("100") } }) // paid
        .mockResolvedValueOnce({ _sum: { amount: null } }); // reserved
      await expect(service.createPayment({ orderId: "ord-1", amount: "51", reason: "manual" }, ACTOR)).rejects.toThrow(ValidationDomainError);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it("полностью оплаченный заказ (due=0) → ValidationDomainError 422", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      prisma.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal("150") } }) // paid (call 1)
        .mockResolvedValueOnce({ _sum: { amount: null } }) // reserved (call 1)
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal("150") } }) // paid (call 2)
        .mockResolvedValueOnce({ _sum: { amount: null } }); // reserved (call 2)
      await expect(service.createPayment({ orderId: "ord-1", amount: "10", reason: "manual" }, ACTOR)).rejects.toThrow(ValidationDomainError);
      await expect(service.createPayment({ orderId: "ord-1", reason: "manual" }, ACTOR)).rejects.toThrow(ValidationDomainError);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it("available=0 из-за РЕЗЕРВА (paid=0) → 422 '(reserved by active payments)', не '(fully paid)'", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      prisma.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } }) // paid = 0
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal("150") } }); // reserved = PENDING 150
      const err = await service
        .createPayment({ orderId: "ord-1", amount: "10", reason: "manual" }, ACTOR)
        .then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(ValidationDomainError);
      expect(String((err as Error).message)).toContain("exceeds remaining due 0");
      expect(String((err as Error).message)).toContain("reserved by active payments");
      expect(String((err as Error).message)).not.toContain("fully paid");
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it("available=0 из-за резерва, amount не задан → 422 '(reserved by active payments)' в no-amount ветке", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      prisma.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } }) // paid = 0
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal("150") } }); // reserved = 150
      const err = await service
        .createPayment({ orderId: "ord-1", reason: "manual" }, ACTOR)
        .then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(ValidationDomainError);
      expect(String((err as Error).message)).toContain("no remaining amount due");
      expect(String((err as Error).message)).toContain("reserved by active payments");
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it("available=0 из-за ПОЛНОЙ оплаты → '(fully paid)' (ветка различает paid vs reserved)", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      prisma.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal("150") } }) // paid = 150 ≥ amount
        .mockResolvedValueOnce({ _sum: { amount: null } }); // reserved = 0
      const err = await service
        .createPayment({ orderId: "ord-1", amount: "10", reason: "manual" }, ACTOR)
        .then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(ValidationDomainError);
      expect(String((err as Error).message)).toContain("order is fully paid");
      expect(String((err as Error).message)).not.toContain("reserved by active payments");
    });

    it("некорректный формат amount (0 / отрицательный / >2 знаков) → 422 ДО транзакции", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      for (const amount of ["0", "-5", "10.123"]) {
        await expect(service.createPayment({ orderId: "ord-1", amount, reason: "manual" }, ACTOR)).rejects.toThrow(ValidationDomainError);
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("P2002 не глотается: известный one-active индекс снят, unique-violation пробрасывается как есть", async () => {
      const prisma = makePrismaStub();
      prisma.payment.create.mockRejectedValue({ code: "P2002", meta: { target: ["Payment_referenceNumber_key"] } });
      const service = makeService(prisma);
      await expect(service.createPayment({ orderId: "ord-1", reason: "manual" }, ACTOR)).rejects.toMatchObject({ code: "P2002" });
    });

    // ── Phase 3 Round 2D.1: initialNote integration ──────────────────────

    it("createPayment with initialNote: Payment + OperationalNote created atomically", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      await service.createPayment({ orderId: "ord-1", reason: "manual", initialNote: "Ожидаем банковское подтверждение" }, ACTOR);
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
      await service.createPayment({ orderId: "ord-1", reason: "manual" }, ACTOR);
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(prisma.operationalNote.create).not.toHaveBeenCalled();
    });

    it("createPayment with empty initialNote: Payment created, no OperationalNote", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      await service.createPayment({ orderId: "ord-1", reason: "manual", initialNote: "   " }, ACTOR);
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(prisma.operationalNote.create).not.toHaveBeenCalled();
    });

    it("createPayment with >5000 initialNote: note rejected, Payment NOT created (pre-tx validation)", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      await expect(
        service.createPayment({ orderId: "ord-1", reason: "manual", initialNote: "x".repeat(5001) }, ACTOR),
      ).rejects.toThrow("5000");
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.operationalNote.create).not.toHaveBeenCalled();
    });

    it("initialNote does NOT affect Payment status/paidAt/amount/currency", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      const result = await service.createPayment({ orderId: "ord-1", reason: "manual", initialNote: "Test note" }, ACTOR);
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
