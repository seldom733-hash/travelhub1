import { Prisma } from "../../generated/prisma/client";
import { ConflictError, ValidationDomainError } from "../../shared/errors";
import { SupplierPaymentService } from "./supplier-payment.service";

const ACTOR = { id: "u-fin", username: "finance" };
const D = (v: string | number) => new Prisma.Decimal(String(v));

function obligation(over: Record<string, unknown> = {}) {
  return {
    id: "ob-1",
    code: "SBO-00000001",
    supplierCode: "SUMMERTOUR",
    partnerId: null,
    status: "OPEN",
    sourceCurrency: "USD",
    sourceAmount: D(1000),
    aznAmount: D(1700),
    fxRate: D("1.7"),
    remainingAmount: D(1700),
    paidAmount: D(0),
    ...over,
  };
}

function payment(over: Record<string, unknown> = {}) {
  return {
    id: "pay-1",
    code: "SPO-00000001",
    status: "PENDING",
    supplierCode: "SUMMERTOUR",
    partnerId: null,
    amount: D(1000),
    currency: "USD",
    aznAmount: D(1700),
    method: "bank",
    providerRef: null,
    purpose: "tour prepayment",
    comment: null,
    occurredAt: new Date("2026-10-25T00:00:00Z"),
    confirmedAt: null,
    cancelledAt: null,
    actorId: ACTOR.id,
    version: 1,
    createdAt: new Date("2026-10-25T00:00:00Z"),
    ...over,
  };
}

function allocation(over: Record<string, unknown> = {}) {
  return {
    id: "alloc-1",
    payoutId: "pay-1",
    obligationId: "ob-1",
    amount: D(1000),
    aznAmount: D(1700),
    reversedAt: null,
    reversedById: null,
    createdAt: new Date("2026-10-25T00:00:00Z"),
    obligation: { id: "ob-1", code: "SBO-00000001" },
    ...over,
  };
}

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma: Record<string, any> = {
    supplierPayout: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async ({ data }: any) => payment({ ...data, id: "pay-new" })),
      update: jest.fn().mockResolvedValue(payment({ status: "CONFIRMED" })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    supplierPayoutAllocation: {
      create: jest.fn().mockResolvedValue(allocation()),
      findMany: jest.fn().mockResolvedValue([allocation()]),
      findUnique: jest.fn().mockResolvedValue(null),
      aggregate: jest.fn().mockResolvedValue({ _sum: { aznAmount: D(0) } }),
      groupBy: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(allocation({ reversedAt: new Date() })),
    },
    supplierObligation: {
      findFirst: jest.fn().mockResolvedValue(obligation()),
      findMany: jest.fn().mockResolvedValue([{ id: "ob-1", code: "SBO-00000001" }]),
      findUniqueOrThrow: jest.fn().mockResolvedValue(obligation({ remainingAmount: D(0), paidAmount: D(1700) })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue(obligation({ status: "CLOSED" })),
    },
    partner: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
  prisma.$transaction = jest.fn().mockImplementation(async (fn: any) => fn(prisma));
  const ids = { nextCode: jest.fn().mockResolvedValue("SPO-00000001") };
  const security = { audit: jest.fn().mockResolvedValue(undefined) };
  const eventBus = { emit: jest.fn().mockResolvedValue("evt-1"), publishEvent: jest.fn().mockResolvedValue(undefined) };
  const fxRates = {
    resolveStrict: jest.fn().mockResolvedValue({ rate: D("1.7"), rateCode: "SFX-1" }),
    convertToAzn: jest.fn().mockImplementation((amount: Prisma.Decimal, fx: { rate: Prisma.Decimal }) =>
      new Prisma.Decimal(amount).mul(fx.rate),
    ),
  };
  const service = new SupplierPaymentService(prisma as never, ids as never, security as never, eventBus as never, fxRates as never);
  return { service, prisma, ids, security, eventBus, fxRates };
}

describe("SupplierPaymentService — реестр платежей поставщикам", () => {
  it("create: PENDING + allocation НЕ трогает обязательство до подтверждения", async () => {
    const { service, prisma } = makeService({
      supplierPayout: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: any) => payment({ ...data, id: "pay-new" })),
        findFirst: jest.fn().mockResolvedValue(payment({ id: "pay-new", allocations: [allocation({ payoutId: "pay-new" })] })),
      },
    });

    const dto = await service.create(
      {
        supplierCode: "SUMMERTOUR",
        amount: "1000",
        currency: "USD",
        allocations: [{ obligationCode: "SBO-00000001", amount: "1000" }],
      },
      ACTOR,
    );

    expect(dto.status).toBe("PENDING");
    expect(dto.allocatedAzn).toBe("1700");
    expect(dto.unallocatedAzn).toBe("0");
    // черновик не оплачивает обязательство
    expect(prisma.supplierObligation.updateMany).not.toHaveBeenCalled();
  });

  it("create: превышение остатка обязательства → 422 (allocation rejected)", async () => {
    const { service, prisma } = makeService({
      supplierObligation: { ...makeService().prisma.supplierObligation, findFirst: jest.fn().mockResolvedValue(obligation({ remainingAmount: D(500) })) },
    });
    await expect(
      service.create(
        { supplierCode: "SUMMERTOUR", amount: "1000", currency: "USD", allocations: [{ obligationCode: "SBO-1", amount: "1000" }] },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(ValidationDomainError);
    expect(prisma.supplierPayout.create).not.toHaveBeenCalled();
  });

  it("create: распределения в сумме больше платежа → 422", async () => {
    const { service } = makeService();
    await expect(
      service.create(
        {
          supplierCode: "SUMMERTOUR",
          amount: "500",
          currency: "USD",
          aznAmount: "850",
          allocations: [{ obligationCode: "SBO-1", amount: "1000", aznAmount: "1700" }],
        },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(ValidationDomainError);
  });

  it("create: валюта отличается и нет frozen FX → требуется aznAmount", async () => {
    const { service } = makeService({
      supplierObligation: {
        ...makeService().prisma.supplierObligation,
        findFirst: jest.fn().mockResolvedValue(obligation({ sourceCurrency: "EUR", fxRate: null })),
      },
    });
    await expect(
      service.create(
        { supplierCode: "SUMMERTOUR", amount: "1000", currency: "USD", allocations: [{ obligationCode: "SBO-1", amount: "1000" }] },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(ValidationDomainError);
  });

  it("confirm: помечает CONFIRMED и применяет allocation (paid/remaining)", async () => {
    const { service, prisma, eventBus, security } = makeService({
      supplierPayout: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(payment({ status: "PENDING", allocations: [] }))
          .mockResolvedValueOnce(payment({ status: "CONFIRMED", allocations: [allocation()] })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(payment({ status: "CONFIRMED" })),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    const dto = await service.confirm("SPO-00000001", ACTOR);

    expect(dto.status).toBe("CONFIRMED");
    expect(prisma.supplierObligation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paidAmount: { increment: D(1700) } }) }),
    );
    expect(security.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "finance.supplier_payment.confirmed" }));
    expect(eventBus.publishEvent).toHaveBeenCalledWith("evt-1");
  });

  it("confirm: повторный вызов для CONFIRMED — идемпотентно, без второго применения", async () => {
    const { service, prisma } = makeService({
      supplierPayout: {
        findFirst: jest.fn().mockResolvedValue(payment({ status: "CONFIRMED", allocations: [] })),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    });
    const dto = await service.confirm("SPO-00000001", ACTOR);
    expect(dto.status).toBe("CONFIRMED");
    expect(prisma.supplierObligation.updateMany).not.toHaveBeenCalled();
  });

  it("cancel PENDING: CANCELLED без сторно обязательств", async () => {
    const { service, prisma } = makeService({
      supplierPayout: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(payment({ status: "PENDING", allocations: [] }))
          .mockResolvedValueOnce(payment({ status: "CANCELLED", allocations: [] })),
        findUniqueOrThrow: jest.fn().mockResolvedValue(payment({ status: "PENDING" })),
        update: jest.fn().mockResolvedValue(payment({ status: "CANCELLED" })),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    });
    const dto = await service.cancel("SPO-00000001", "дубль", ACTOR);
    expect(dto.status).toBe("CANCELLED");
    expect(prisma.supplierObligation.updateMany).not.toHaveBeenCalled();
  });

  it("cancel CONFIRMED: сторно allocation + компенсирующая ledger-проводка", async () => {
    const { service, prisma, eventBus } = makeService({
      supplierPayout: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(payment({ status: "CONFIRMED", allocations: [] }))
          .mockResolvedValueOnce(payment({ status: "CANCELLED", allocations: [] })),
        findUniqueOrThrow: jest.fn().mockResolvedValue(payment({ status: "CONFIRMED" })),
        update: jest.fn().mockResolvedValue(payment({ status: "CANCELLED" })),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    });
    const dto = await service.cancel("SPO-00000001", "ошибка банка", ACTOR);
    expect(dto.status).toBe("CANCELLED");
    expect(prisma.supplierObligation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paidAmount: { decrement: D(1700) } }) }),
    );
    expect(prisma.supplierPayoutAllocation.update).toHaveBeenCalled();
    expect(eventBus.emit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "SupplierPayoutReversed",
        payload: expect.objectContaining({ payoutId: "pay-1", amount: "1000", currency: "USD" }),
      }),
    );
    expect(eventBus.publishEvent).toHaveBeenCalledWith("evt-1");
  });

  it("cancel: повторная отмена CANCELLED ничего не сторнирует и не эмитит", async () => {
    const { service, prisma, eventBus } = makeService({
      supplierPayout: {
        findFirst: jest.fn().mockResolvedValue(payment({ status: "CANCELLED", allocations: [] })),
        updateMany: jest.fn(),
      },
    });
    const dto = await service.cancel("SPO-00000001", "repeat", ACTOR);
    expect(dto.status).toBe("CANCELLED");
    expect(prisma.supplierObligation.updateMany).not.toHaveBeenCalled();
    expect(prisma.supplierPayoutAllocation.update).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it("cancel: проигравший CAS не делает сторно (concurrent safety)", async () => {
    const { service, prisma } = makeService({
      supplierPayout: {
        findFirst: jest.fn().mockResolvedValue(payment({ status: "CONFIRMED", allocations: [] })),
        findUniqueOrThrow: jest.fn().mockResolvedValue(payment({ status: "CONFIRMED" })),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    await expect(service.cancel("SPO-00000001", "race", ACTOR)).rejects.toBeInstanceOf(ConflictError);
    expect(prisma.supplierObligation.updateMany).not.toHaveBeenCalled();
  });

  it("list unallocated=true: только платежи с остатком + причина", async () => {
    const { service } = makeService({
      supplierPayout: {
        findMany: jest.fn().mockResolvedValue([
          payment({ id: "p1", code: "SPO-1", allocations: [allocation({ payoutId: "p1" })] }),
          payment({ id: "p2", code: "SPO-2", allocations: [] }),
        ]),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
    });
    const res = await service.list({ unallocated: true });
    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].code).toBe("SPO-2");
    expect(res.items[0].unallocatedReason).toBe("NOT_ALLOCATED");
  });

  it("getByCodeOrId: нераспределённый остаток считается отдельно", async () => {
    const { service } = makeService({
      supplierPayout: {
        findFirst: jest.fn().mockResolvedValue(
          payment({ status: "CONFIRMED", amount: D(1000), aznAmount: D(1700), allocations: [allocation({ aznAmount: D(400) })] }),
        ),
      },
    });
    const dto = await service.getByCodeOrId("SPO-1");
    expect(dto.allocatedAzn).toBe("400");
    expect(dto.unallocatedAzn).toBe("1300");
  });

  it("create: providerRef replay c тем же payload → существующий платёж, без дубликата", async () => {
    const { service, prisma } = makeService({
      supplierPayout: {
        findUnique: jest.fn().mockResolvedValue({ ...payment({ id: "pay-old", status: "PENDING", obligationId: null, providerRef: "bank-1" }), allocations: [] }),
        findFirst: jest.fn().mockResolvedValue(payment({ id: "pay-old", status: "PENDING", providerRef: "bank-1", allocations: [] })),
        create: jest.fn(),
      },
      supplierPayoutAllocation: { ...makeService().prisma.supplierPayoutAllocation, findMany: jest.fn().mockResolvedValue([]) },
    });
    const dto = await service.create(
      { supplierCode: "SUMMERTOUR", amount: "1000", currency: "USD", providerRef: "bank-1" },
      ACTOR,
    );
    expect(dto.id).toBe("pay-old");
    expect(prisma.supplierPayout.create).not.toHaveBeenCalled();
  });

  it("create: providerRef replay c другим payload → 409", async () => {
    const { service } = makeService({
      supplierPayout: {
        findUnique: jest.fn().mockResolvedValue({ ...payment({ id: "pay-old", status: "PENDING", obligationId: null, providerRef: "bank-1" }), allocations: [] }),
      },
    });
    await expect(
      service.create({ supplierCode: "SUMMERTOUR", amount: "999", currency: "USD", providerRef: "bank-1" }, ACTOR),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("create: idempotency slot replay → существующий платёж, create не вызывается", async () => {
    const { service, prisma } = makeService({
      supplierPayout: {
        findUnique: jest.fn().mockResolvedValue({ code: "SPO-OLD" }),
        findFirst: jest.fn().mockResolvedValue(payment({ id: "pay-old", code: "SPO-OLD", allocations: [] })),
        create: jest.fn(),
      },
    });
    const dto = await service.create(
      { supplierCode: "SUMMERTOUR", amount: "1000", currency: "USD" },
      ACTOR,
      "slot-abc",
    );
    expect(dto.code).toBe("SPO-OLD");
    expect(prisma.supplierPayout.create).not.toHaveBeenCalled();
  });

  it("create: P2002 по slot (stale takeover) → возвращает уже созданный платёж", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
    const { service, prisma } = makeService({
      supplierPayout: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null) // первичная проверка слота
          .mockResolvedValueOnce({ code: "SPO-OLD" }), // backstop после P2002
        findFirst: jest.fn().mockResolvedValue(payment({ id: "pay-old", code: "SPO-OLD", allocations: [] })),
        create: jest.fn().mockRejectedValue(p2002),
      },
    });
    const dto = await service.create(
      { supplierCode: "SUMMERTOUR", amount: "1000", currency: "USD" },
      ACTOR,
      "slot-race",
    );
    expect(dto.code).toBe("SPO-OLD");
    expect(prisma.supplierPayout.create).toHaveBeenCalled();
  });

  it("create: providerRef с другим набором allocations → 409, не ложный replay", async () => {
    const { service } = makeService({
      supplierPayout: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null) // slot lookup: слота нет
          .mockResolvedValueOnce(
            payment({ id: "pay-old", code: "SPO-OLD", providerRef: "bank-1", amount: D(1000), aznAmount: D(1700) }),
          ),
      },
      supplierPayoutAllocation: {
        ...makeService().prisma.supplierPayoutAllocation,
        findMany: jest.fn().mockResolvedValue([
          { obligationId: "ob-1", amount: D(1000), aznAmount: D(1700) },
        ]),
      },
    });
    await expect(
      service.create(
        {
          supplierCode: "SUMMERTOUR",
          amount: "1000",
          currency: "USD",
          providerRef: "bank-1",
          allocations: [{ obligationCode: "SBO-00000001", amount: "500" }],
        },
        ACTOR,
        "slot-other",
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("allocate: платёж без остатка → 422", async () => {
    const { service } = makeService({
      supplierPayout: {
        findFirst: jest.fn().mockResolvedValue(payment({ status: "CONFIRMED", amount: D(100), aznAmount: D(170), allocations: [] })),
      },
      supplierPayoutAllocation: {
        findUnique: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { aznAmount: D(170) } }),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
      },
      supplierObligation: {
        ...makeService().prisma.supplierObligation,
        findFirst: jest.fn().mockResolvedValue(obligation()),
      },
    });
    await expect(
      service.allocate("SPO-1", { obligationCode: "SBO-1", amount: "1000", aznAmount: "1700" }, ACTOR),
    ).rejects.toBeInstanceOf(ValidationDomainError);
  });
});
