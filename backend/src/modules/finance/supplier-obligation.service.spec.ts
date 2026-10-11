/**
 * UNIFIED FINANCE CENTER Phase 2 — SupplierObligationService tests.
 *
 * Контракт (implementation prompt Phase 2):
 *  - creation: snapshot с fx → aznAmount/fxRate/rateCode снапшот; AZN-источник
 *    без fx → aznAmount = sourceAmount, rate 1; не-AZN без fx/snapshot →
 *    UNKNOWN (aznAmount null, НИКОГДА 0); bookingId-идемпотентность (P2002 →
 *    no-op, возвращает существующую);
 *  - payout: частичные (несколько payout), guarded atomic decrement (concurrent
 *    overspend → 409), overpayment → 422, UNKNOWN → blocked, providerRef
 *    replay same → no-op / divergent → 409, closed/cancelled → 409;
 *  - aznAmount: сервер считает при совпадении валюты+fxRate; иначе требует
 *    явный (валидация <= remaining);
 *  - cancel/adjust: только unpaid (paid == 0), иначе 409.
 */
import { Prisma } from "../../generated/prisma/client";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { SupplierObligationService } from "./supplier-obligation.service";

const ACTOR = { id: "u1", username: "fin.admin" };
const DEC = (v: string | number | null | undefined) => (v == null ? null : new Prisma.Decimal(String(v)));

interface ObligationRow {
  id: string;
  code: string;
  bookingId: string;
  bookingCode: string | null;
  orderId: string;
  orderCode: string | null;
  orderItemId: string | null;
  supplierCode: string | null;
  partnerId: string | null;
  serviceType: string | null;
  sourceAmount: Prisma.Decimal;
  sourceCurrency: string;
  aznAmount: Prisma.Decimal | null;
  fxRate: Prisma.Decimal | null;
  fxRateCode: string | null;
  status: string;
  paidAmount: Prisma.Decimal;
  remainingAmount: Prisma.Decimal | null;
  source: string;
  sourceEventId: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  payouts?: PayoutRow[];
}

interface PayoutRow {
  id: string;
  code: string;
  obligationId: string;
  amount: Prisma.Decimal;
  currency: string;
  aznAmount: Prisma.Decimal;
  fxRate: Prisma.Decimal | null;
  fxVariance: Prisma.Decimal | null;
  method: string | null;
  providerRef: string | null;
  occurredAt: Date;
  reason: string | null;
  evidenceUrl: string | null;
  actorType: string | null;
  actorId: string | null;
  createdAt: Date;
}

function ob(overrides: Partial<ObligationRow> = {}): ObligationRow {
  return {
    id: "ob1",
    code: "SBO-00000001",
    bookingId: "bkg1",
    bookingCode: "BKG-00000001",
    orderId: "ord1",
    orderCode: "ORD-00000001",
    orderItemId: null,
    supplierCode: "SUMMERTOUR",
    partnerId: "ptn1",
    serviceType: "tour",
    sourceAmount: DEC("1000")!,
    sourceCurrency: "USD",
    aznAmount: DEC("1700")!,
    fxRate: DEC("1.7")!,
    fxRateCode: "SFX-00000001",
    status: "OPEN",
    paidAmount: DEC("0")!,
    remainingAmount: DEC("1700")!,
    source: "BOOKING_CONFIRMED",
    sourceEventId: "evt1",
    confirmedAt: new Date("2026-10-01T00:00:00Z"),
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    payouts: [],
    ...overrides,
  };
}

function payout(overrides: Partial<PayoutRow> = {}): PayoutRow {
  return {
    id: "pay1",
    code: "SPO-00000001",
    obligationId: "ob1",
    amount: DEC("1000")!,
    currency: "USD",
    aznAmount: DEC("1700")!,
    fxRate: DEC("1.7")!,
    fxVariance: DEC("0")!,
    method: "bank",
    providerRef: "pr1",
    occurredAt: new Date("2026-10-02T00:00:00Z"),
    reason: null,
    evidenceUrl: null,
    actorType: "USER",
    actorId: "u1",
    createdAt: new Date("2026-10-02T00:00:00Z"),
    ...overrides,
  };
}

function uniqueViolation(field: string): Error {
  return Object.assign(new Error("unique"), { code: "P2002", meta: { target: [field] } });
}

interface Harness {
  service: SupplierObligationService;
  prisma: Record<string, Record<string, jest.Mock>>;
  ids: { nextCode: jest.Mock };
  security: { audit: jest.Mock };
  eventBus: { emit: jest.Mock; publishPending: jest.Mock; publishEvent: jest.Mock };
}

function makeService(opts: { obligation?: ObligationRow | null; payoutByProviderRef?: PayoutRow | null } = {}): Harness {
  const current: ObligationRow | null = opts.obligation === undefined ? ob() : opts.obligation;
  const prisma: Record<string, Record<string, jest.Mock>> = {
    supplierObligation: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(current),
      findMany: jest.fn().mockResolvedValue(current ? [current] : []),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(1),
    },
    supplierPayout: {
      findUnique: jest.fn().mockResolvedValue(opts.payoutByProviderRef ?? null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        payout({ id: "pay-new", code: "SPO-00000009", ...data } as Partial<PayoutRow>)),
      count: jest.fn().mockResolvedValue(0),
    },
    partner: { findMany: jest.fn().mockResolvedValue([{ id: "ptn1", code: "PAR-00000001" }]) },
  };
  prisma.$transaction = { ...({} as Record<string, jest.Mock>) };
  const $transaction = jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  (prisma as Record<string, unknown>).$transaction = $transaction;
  const ids = { nextCode: jest.fn().mockResolvedValue("SBO-00000009") };
  const security = { audit: jest.fn().mockResolvedValue(undefined) };
  const eventBus = { emit: jest.fn().mockResolvedValue("evt-out"), publishPending: jest.fn().mockResolvedValue(1), publishEvent: jest.fn().mockResolvedValue(1) };
  const service = new SupplierObligationService(prisma as never, ids as never, security as never, eventBus as never);
  return { service, prisma, ids, security, eventBus };
}

describe("SupplierObligationService (UNIFIED FINANCE CENTER Phase 2)", () => {
  describe("createObligationForBooking", () => {
    const booking = {
      bookingId: "bkg1",
      bookingCode: "BKG-00000001",
      orderId: "ord1",
      orderCode: "ORD-00000001",
      orderItemId: null,
      bookingAmount: DEC("1000")!,
      bookingCurrency: "USD",
      sellerPartnerId: "ptn1",
    };
    const ctx = { sourceEventId: "evt1", confirmedAt: new Date("2026-10-01T00:00:00Z") };

    it("snapshot с fx → aznAmount/fxRate/rateCode снапшота (immutable)", async () => {
      const h = makeService({ obligation: null });
      h.prisma.supplierObligation.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        ob({ id: "ob-new", ...data } as Partial<ObligationRow>));
      const dto = await h.service.createObligationForBooking(
        h.prisma as never,
        { ...booking, commercialSnapshot: { supplierCode: "SUMMERTOUR", serviceType: "tour", supplierPrice: 1000, supplierCurrency: "USD", fx: { rate: "1.7", rateCode: "SFX-00000001", aznAmount: 1700 } } },
        ctx,
      );
      expect(dto.aznAmount).toBe("1700");
      expect(dto.fxRate).toBe("1.7");
      expect(dto.fxRateCode).toBe("SFX-00000001");
      expect(dto.amountUnknown).toBe(false);
      expect(dto.status).toBe("OPEN");
      expect(dto.paidAmount).toBe("0");
      expect(dto.remainingAmount).toBe("1700");
    });

    it("AZN-источник без fx → aznAmount = sourceAmount, rate 1", async () => {
      const h = makeService({ obligation: null });
      h.prisma.supplierObligation.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        ob({ id: "ob-new", ...data } as Partial<ObligationRow>));
      const dto = await h.service.createObligationForBooking(
        h.prisma as never,
        { ...booking, bookingCurrency: "AZN", commercialSnapshot: { supplierCurrency: "AZN", supplierPrice: 500 } },
        ctx,
      );
      expect(dto.aznAmount).toBe("500");
      expect(dto.fxRate).toBe("1");
      expect(dto.amountUnknown).toBe(false);
    });

    it("не-AZN без fx/snapshot → UNKNOWN (aznAmount null, НИКОГДА 0)", async () => {
      const h = makeService({ obligation: null });
      h.prisma.supplierObligation.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        ob({ id: "ob-new", ...data } as Partial<ObligationRow>));
      const dto = await h.service.createObligationForBooking(h.prisma as never, { ...booking, commercialSnapshot: null }, ctx);
      expect(dto.aznAmount).toBeNull();
      expect(dto.fxRate).toBeNull();
      expect(dto.amountUnknown).toBe(true);
      expect(dto.remainingAmount).toBeNull();
      expect(dto.sourceAmount).toBe("1000");
      expect(dto.sourceCurrency).toBe("USD");
    });

    it("bookingId-идемпотентность: P2002 на bookingId → no-op (существующая)", async () => {
      const h = makeService({ obligation: null });
      const existing = ob({ id: "ob-existing", code: "SBO-00000005" });
      h.prisma.supplierObligation.create.mockRejectedValue(uniqueViolation("bookingId"));
      h.prisma.supplierObligation.findUnique.mockResolvedValue(existing);
      const dto = await h.service.createObligationForBooking(
        h.prisma as never,
        { ...booking, commercialSnapshot: { fx: { rate: "1.7", aznAmount: 1700 } } },
        ctx,
      );
      expect(dto.code).toBe("SBO-00000005");
      expect(dto.id).toBe("ob-existing");
    });

    it("неизвестный P2002 (не bookingId) → проброс (не ложный no-op)", async () => {
      const h = makeService({ obligation: null });
      h.prisma.supplierObligation.create.mockRejectedValue(uniqueViolation("code"));
      await expect(
        h.service.createObligationForBooking(h.prisma as never, { ...booking, commercialSnapshot: null }, ctx),
      ).rejects.toThrow();
    });
  });

  describe("createPayout", () => {
    it("частичная выплата: guarded decrement + payout, статус PARTIALLY_PAID", async () => {
      const h = makeService({ obligation: ob() });
      h.prisma.supplierObligation.updateMany.mockResolvedValue({ count: 1 });
      h.prisma.supplierObligation.findUniqueOrThrow.mockResolvedValue(
        ob({ status: "PARTIALLY_PAID", paidAmount: DEC("850")!, remainingAmount: DEC("850")! }),
      );
      const dto = await h.service.createPayout(
        { obligationCode: "SBO-00000001", amount: "500", currency: "USD", providerRef: "pr1" },
        ACTOR,
      );
      expect(dto.aznAmount).toBe("850"); // 500 × 1.7 (сервер посчитал)
      expect(dto.fxVariance).toBe("0");
      expect(dto.providerRef).toBe("pr1");
      // guarded update: status payable + remaining >= aznAmount
      const guard = h.prisma.supplierObligation.updateMany.mock.calls[0][0].where;
      expect(guard.status.in).toEqual(["OPEN", "PARTIALLY_PAID", "ADJUSTED"]);
      expect(guard.remainingAmount).toEqual({ gte: expect.any(Prisma.Decimal) });
      // инкремент paid / декремент remaining
      const data = h.prisma.supplierObligation.updateMany.mock.calls[0][0].data;
      expect(data.paidAmount.increment).toBeDefined();
      expect(data.remainingAmount.decrement).toBeDefined();
    });

    it("выплата полного остатка → CLOSED", async () => {
      const h = makeService({ obligation: ob() });
      h.prisma.supplierObligation.updateMany.mockResolvedValue({ count: 1 });
      h.prisma.supplierObligation.findUniqueOrThrow.mockResolvedValue(
        ob({ status: "CLOSED", paidAmount: DEC("1700")!, remainingAmount: DEC("0")! }),
      );
      const dto = await h.service.createPayout({ obligationCode: "SBO-00000001", amount: "1000", currency: "USD" }, ACTOR);
      expect(dto.aznAmount).toBe("1700");
    });

    it("overpayment: aznAmount > remaining → 422 (blocked)", async () => {
      const h = makeService({ obligation: ob({ remainingAmount: DEC("100")! }) });
      await expect(
        h.service.createPayout({ obligationCode: "SBO-00000001", amount: "5000", currency: "USD", aznAmount: "1700" }, ACTOR),
      ).rejects.toThrow(ValidationDomainError);
      await expect(
        h.service.createPayout({ obligationCode: "SBO-00000001", amount: "5000", currency: "USD", aznAmount: "1700" }, ACTOR),
      ).rejects.toThrow(/overpayment blocked/);
    });

    it("UNKNOWN obligation (aznAmount null) → payout заблокирован (never zero)", async () => {
      const h = makeService({ obligation: ob({ aznAmount: null, fxRate: null, remainingAmount: null }) });
      await expect(
        h.service.createPayout({ obligationCode: "SBO-00000001", amount: "100", currency: "USD" }, ACTOR),
      ).rejects.toThrow(/UNKNOWN AZN amount/);
    });

    it("closed/cancelled → 409 (не принимает выплат)", async () => {
      const h = makeService({ obligation: ob({ status: "CLOSED", remainingAmount: DEC("0")! }) });
      await expect(
        h.service.createPayout({ obligationCode: "SBO-00000001", amount: "10", currency: "USD", aznAmount: "17" }, ACTOR),
      ).rejects.toThrow(ConflictError);
    });

    it("concurrent overspend: guarded update count=0 → 409", async () => {
      const h = makeService({ obligation: ob() });
      h.prisma.supplierObligation.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        h.service.createPayout({ obligationCode: "SBO-00000001", amount: "100", currency: "USD", aznAmount: "170" }, ACTOR),
      ).rejects.toThrow(/concurrent overspend/);
    });

    it("providerRef replay same payload → no-op (существующий payout)", async () => {
      const existing = payout({ providerRef: "pr1", obligationId: "ob1", aznAmount: DEC("850")!, amount: DEC("500")!, currency: "USD" });
      const h = makeService({ obligation: ob(), payoutByProviderRef: existing });
      const dto = await h.service.createPayout(
        { obligationCode: "SBO-00000001", amount: "500", currency: "USD", providerRef: "pr1", aznAmount: "850" },
        ACTOR,
      );
      expect(dto.code).toBe("SPO-00000001");
      expect(h.prisma.supplierObligation.updateMany).not.toHaveBeenCalled();
    });

    it("providerRef replay divergent → 409", async () => {
      const existing = payout({ providerRef: "pr1", obligationId: "ob1", aznAmount: DEC("850")!, amount: DEC("500")!, currency: "USD" });
      const h = makeService({ obligation: ob(), payoutByProviderRef: existing });
      await expect(
        h.service.createPayout({ obligationCode: "SBO-00000001", amount: "999", currency: "USD", providerRef: "pr1", aznAmount: "850" }, ACTOR),
      ).rejects.toThrow(ConflictError);
    });

    it("валюта не совпадает + нет fxRate → aznAmount обязателен (422)", async () => {
      const h = makeService({ obligation: ob({ sourceCurrency: "USD", fxRate: DEC("1.7")! }) });
      // RUB ≠ USD → сервер не может посчитать без явного aznAmount
      await expect(
        h.service.createPayout({ obligationCode: "SBO-00000001", amount: "100", currency: "RUB" }, ACTOR),
      ).rejects.toThrow(/aznAmount is required/);
    });

    it("FX variance: явный aznAmount ≠ amount×fxRate → variance фиксируется", async () => {
      const h = makeService({ obligation: ob() });
      h.prisma.supplierObligation.updateMany.mockResolvedValue({ count: 1 });
      h.prisma.supplierObligation.findUniqueOrThrow.mockResolvedValue(
        ob({ status: "PARTIALLY_PAID", paidAmount: DEC("870")!, remainingAmount: DEC("830")! }),
      );
      const dto = await h.service.createPayout(
        { obligationCode: "SBO-00000001", amount: "500", currency: "USD", aznAmount: "870" },
        ACTOR,
      );
      expect(dto.aznAmount).toBe("870");
      expect(dto.fxVariance).toBe("20"); // 870 − (500×1.7=850)
    });
  });

  describe("cancelObligation", () => {
    it("unpaid → CANCELLED", async () => {
      const h = makeService({ obligation: ob() });
      h.prisma.supplierObligation.update.mockResolvedValue(ob({ status: "CANCELLED" }));
      const dto = await h.service.cancelObligation("SBO-00000001", "dup", ACTOR);
      expect(dto.status).toBe("CANCELLED");
    });

    it("paid > 0 → 409 (reverse payouts first)", async () => {
      const h = makeService({ obligation: ob({ paidAmount: DEC("100")! }) });
      await expect(h.service.cancelObligation("SBO-00000001", null, ACTOR)).rejects.toThrow(/already paid/);
    });

    it("not found → 404", async () => {
      const h = makeService({ obligation: null });
      await expect(h.service.cancelObligation("SBO-99999999", null, ACTOR)).rejects.toThrow(NotFoundError);
    });
  });

  describe("adjustObligation", () => {
    it("unpaid → меняет aznAmount/remaining, статус ADJUSTED", async () => {
      const h = makeService({ obligation: ob() });
      h.prisma.supplierObligation.update.mockResolvedValue(
        ob({ aznAmount: DEC("1900")!, remainingAmount: DEC("1900")!, status: "ADJUSTED" }),
      );
      const dto = await h.service.adjustObligation("SBO-00000001", { newAznAmount: "1900", reason: "corrected" }, ACTOR);
      expect(dto.aznAmount).toBe("1900");
      expect(dto.remainingAmount).toBe("1900");
      expect(dto.status).toBe("ADJUSTED");
      // аудит со старым и новым значением (append-only история)
      const details = h.security.audit.mock.calls[0][1].details;
      expect(details.oldAznAmount).toBe("1700");
      expect(details.newAznAmount).toBe("1900");
    });

    it("paid > 0 → 409 (post-payout adjustment — будущий шаг)", async () => {
      const h = makeService({ obligation: ob({ paidAmount: DEC("500")! }) });
      await expect(
        h.service.adjustObligation("SBO-00000001", { newAznAmount: "1900", reason: null }, ACTOR),
      ).rejects.toThrow(/already paid/);
    });

    it("newAznAmount <= paid (после partial) → 409 (семантика remaining)", async () => {
      // unpaid-only guard уже покрывает paid>0; здесь newAznAmount <= 0 → 422
      const h = makeService({ obligation: ob() });
      await expect(
        h.service.adjustObligation("SBO-00000001", { newAznAmount: "0", reason: null }, ACTOR),
      ).rejects.toThrow(/newAznAmount must be > 0/);
    });

    it("cancelled → 409", async () => {
      const h = makeService({ obligation: ob({ status: "CANCELLED" }) });
      await expect(
        h.service.adjustObligation("SBO-00000001", { newAznAmount: "1900", reason: null }, ACTOR),
      ).rejects.toThrow(/CANCELLED/);
    });
  });
});
