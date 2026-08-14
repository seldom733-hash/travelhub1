/**
 * PHASE 2 STEP 2.12E — CommissionService unit tests (ADR-0013 D9/D10/D14).
 * DB-инварианты, дополняющие e2e:
 *  - признание на Order creation из frozen snapshot (0 live lookup);
 *  - fail-closed: нет snapshot / нет seller / corrupt snapshot / base mismatch;
 *  - commissionAmount = round_half_up(base × rate) (Decimal authority);
 *  - idempotency: identical replay → no-op; divergent → ConflictError;
 *  - 0 side-effects (Ledger/Settlement/Payout/Invoice/PSP не вызываются).
 */
import "reflect-metadata";
import { Prisma } from "../../generated/prisma/client";
import { CommissionCollectionModel, CommissionStatus, CommissionAccrualStatus } from "../../generated/prisma/enums";
import { ConflictError, ValidationDomainError } from "../../shared/errors";
import { CommissionService } from "./commission.service";
import { validateCommissionSnapshot, validateCommissionRate } from "./finance.validation";
import { mapCommissionChannelFromAcquisition } from "../sales/sales.service";
import { SalesAcquisitionSource } from "../../generated/prisma/enums";
import type { PrismaService } from "../../prisma/prisma.service";
import type { IdsService } from "../../shared/ids.service";
import type { EventBusService } from "../../eventbus/eventbus.service";
import type { CommissionSourceOrder } from "./commission.service";

interface TxStub {
  commission: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  commissionAccrual: {
    findUniqueOrThrow: jest.Mock;
    create: jest.Mock;
  };
}

const ACTOR_CTX = { correlationId: "corr-1", causationId: "evt-1" };

function orderRow(overrides: Partial<Record<string, unknown>> = {}): CommissionSourceOrder {
  return {
    id: "ord-1",
    code: "ORD-00000001",
    amount: new Prisma.Decimal("1000.00"),
    currency: "USD",
    sellerPartnerId: "par-1",
    commissionSnapshot: {
      policyCode: "CMP-00000001",
      policyVersion: 1,
      rateType: "PERCENTAGE",
      rate: "0.15",
      baseAmount: "1000.00",
      baseCurrency: "USD",
      channel: "MARKETPLACE",
      sellerPartnerId: "par-1",
      selectedAt: "2026-08-14T10:00:00.000Z",
      roundingContractVersion: "v1",
    },
    ...overrides,
  };
}

function makeTxStub(): TxStub {
  return {
    commission: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
        id: "cms-1",
        code: "CMS-00000001",
        ...(args.data as object),
      })),
    },
    commissionAccrual: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "caa-1", code: "CAA-00000001" }),
      create: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
        id: "caa-1",
        code: "CAA-00000001",
        ...(args.data as object),
      })),
    },
  };
}

function makeService(tx: TxStub): CommissionService {
  return new CommissionService(
    { commission: tx.commission, commissionAccrual: tx.commissionAccrual } as unknown as PrismaService,
    { nextCode: jest.fn().mockResolvedValueOnce("CMS-00000001").mockResolvedValueOnce("CAA-00000001") } as unknown as IdsService,
    { emitResult: jest.fn().mockResolvedValue("evt-1") } as unknown as EventBusService,
  );
}

describe("CommissionService (Step 2.12E, ADR-0013)", () => {
  describe("recognition (createAccrualForOrder)", () => {
    it("creates Commission + CommissionAccrual with round_half_up(base × rate)", async () => {
      const tx = makeTxStub();
      const svc = makeService(tx);
      const res = await svc.createAccrualForOrder(tx as never, orderRow(), ACTOR_CTX);
      // Decimal.js toString срезает trailing zeros (DTO-конвенция rate/amount);
      // хранится DECIMAL(12,2) = 150.00. Числовая эквивалентность.
      expect(res).toMatchObject({ commission: { code: "CMS-00000001" }, accrual: { code: "CAA-00000001" }, amount: "150" });
      expect(tx.commission.create).toHaveBeenCalledTimes(1);
      expect(tx.commissionAccrual.create).toHaveBeenCalledTimes(1);
      const cData = tx.commission.create.mock.calls[0][0].data as Record<string, unknown>;
      expect(cData).toMatchObject({ orderId: "ord-1", partnerId: "par-1", collectionModel: CommissionCollectionModel.PARTNER_COLLECT, status: CommissionStatus.ACCRUED });
      expect(String(cData.amount as Prisma.Decimal)).toBe("150");
      const aData = tx.commissionAccrual.create.mock.calls[0][0].data as Record<string, unknown>;
      expect(String(aData.amount as Prisma.Decimal)).toBe("150");
      expect(aData.sourceCommissionId).toBe("cms-1");
      expect(aData.accruedAt).toBeInstanceOf(Date);
    });

    it("rounds half-up to 2dp (base × rate = 1000 × 0.155 = 155.00; 1000 × 0.1555 = 155.50)", async () => {
      const tx = makeTxStub();
      const svc = makeService(tx);
      const o = orderRow();
      o.commissionSnapshot = { ...(o.commissionSnapshot as Record<string, unknown>), rate: "0.1555" };
      const res = await svc.createAccrualForOrder(tx as never, o, ACTOR_CTX);
      expect(res?.amount).toBe("155.5"); // toString срезает trailing zero; DECIMAL(12,2) = 155.50
    });

    it("rounds genuine half-cent half-up (1.00 × 0.015 = 0.015 → 0.02)", async () => {
      const tx = makeTxStub();
      const svc = makeService(tx);
      const o = orderRow({ amount: new Prisma.Decimal("1.00") });
      o.commissionSnapshot = { ...(o.commissionSnapshot as Record<string, unknown>), baseAmount: "1.00", rate: "0.015" };
      const res = await svc.createAccrualForOrder(tx as never, o, ACTOR_CTX);
      expect(res?.amount).toBe("0.02"); // 0.015 → ROUND_HALF_UP(2dp) → 0.02
    });

    it("rejects zero-amount commission (fail-loud; NO_POLICY ≠ 0% — никогда молчаливый 0-факт)", async () => {
      const tx = makeTxStub();
      const svc = makeService(tx);
      const o = orderRow({ amount: new Prisma.Decimal("0.01") });
      o.commissionSnapshot = { ...(o.commissionSnapshot as Record<string, unknown>), baseAmount: "0.01", rate: "0.15" };
      // 0.01 × 0.15 = 0.0015 → 0.00 (ROUND_HALF_UP) → zero → invariant violation.
      await expect(svc.createAccrualForOrder(tx as never, o, ACTOR_CTX)).rejects.toThrow(ValidationDomainError);
      expect(tx.commission.create).not.toHaveBeenCalled();
    });

    it("returns null when no commissionSnapshot (no-commission channel / NO_POLICY / legacy)", async () => {
      const tx = makeTxStub();
      const svc = makeService(tx);
      const o = orderRow({ commissionSnapshot: null });
      await expect(svc.createAccrualForOrder(tx as never, o, ACTOR_CTX)).resolves.toBeNull();
      expect(tx.commission.create).not.toHaveBeenCalled();
    });

    it("returns null when sellerPartnerId missing (multi-seller / no seller — fail-closed D14)", async () => {
      const tx = makeTxStub();
      const svc = makeService(tx);
      const o = orderRow({ sellerPartnerId: null });
      await expect(svc.createAccrualForOrder(tx as never, o, ACTOR_CTX)).resolves.toBeNull();
      expect(tx.commission.create).not.toHaveBeenCalled();
    });

    it("rejects corrupt/invalid frozen rate (fail-loud, not silent 0-fact)", async () => {
      const tx = makeTxStub();
      const svc = makeService(tx);
      const o = orderRow();
      o.commissionSnapshot = { ...(o.commissionSnapshot as Record<string, unknown>), rate: "1e-7" };
      await expect(svc.createAccrualForOrder(tx as never, o, ACTOR_CTX)).rejects.toThrow(ValidationDomainError);
      expect(tx.commission.create).not.toHaveBeenCalled();
    });

    it("rejects baseAmount mismatch with frozen Order.amount (producer defect)", async () => {
      const tx = makeTxStub();
      const svc = makeService(tx);
      const o = orderRow();
      o.commissionSnapshot = { ...(o.commissionSnapshot as Record<string, unknown>), baseAmount: "999.00" };
      await expect(svc.createAccrualForOrder(tx as never, o, ACTOR_CTX)).rejects.toThrow(ValidationDomainError);
    });

    it("rejects sellerPartnerId mismatch between snapshot and Order", async () => {
      const tx = makeTxStub();
      const svc = makeService(tx);
      const o = orderRow({ sellerPartnerId: "par-2" });
      await expect(svc.createAccrualForOrder(tx as never, o, ACTOR_CTX)).rejects.toThrow(ValidationDomainError);
    });

    it("rejects currency mismatch between snapshot and Order", async () => {
      const tx = makeTxStub();
      const svc = makeService(tx);
      const o = orderRow();
      o.commissionSnapshot = { ...(o.commissionSnapshot as Record<string, unknown>), baseCurrency: "EUR" };
      await expect(svc.createAccrualForOrder(tx as never, o, ACTOR_CTX)).rejects.toThrow(ValidationDomainError);
    });
  });

  describe("idempotency / divergent replay", () => {
    it("identical replay → no-op (returns existing, no new create, no new event)", async () => {
      const tx = makeTxStub();
      tx.commission.findUnique.mockResolvedValue({
        id: "cms-1",
        code: "CMS-00000001",
        amount: new Prisma.Decimal("150.00"),
        currency: "USD",
        partnerId: "par-1",
        collectionModel: CommissionCollectionModel.PARTNER_COLLECT,
      });
      const svc = makeService(tx);
      const res = await svc.createAccrualForOrder(tx as never, orderRow(), ACTOR_CTX);
      expect(res).toMatchObject({ commission: { id: "cms-1" }, eventId: "" });
      expect(tx.commission.create).not.toHaveBeenCalled();
      expect(tx.commissionAccrual.create).not.toHaveBeenCalled();
    });

    it("divergent replay → controlled ConflictError (never silent success)", async () => {
      const tx = makeTxStub();
      tx.commission.findUnique.mockResolvedValue({
        id: "cms-1",
        code: "CMS-00000001",
        amount: new Prisma.Decimal("200.00"),
        currency: "USD",
        partnerId: "par-1",
        collectionModel: CommissionCollectionModel.PARTNER_COLLECT,
      });
      const svc = makeService(tx);
      await expect(svc.createAccrualForOrder(tx as never, orderRow(), ACTOR_CTX)).rejects.toThrow(ConflictError);
    });
  });

  describe("pure validators", () => {
    it("validateCommissionSnapshot accepts canonical shape and rejects corruption", () => {
      const snap = orderRow().commissionSnapshot as Record<string, unknown>;
      expect(validateCommissionSnapshot(snap).policyCode).toBe("CMP-00000001");
      expect(() => validateCommissionSnapshot({ ...snap, rate: "0.15 " })).toThrow(ValidationDomainError);
      expect(() => validateCommissionSnapshot({ ...snap, rate: "1.5" })).toThrow(ValidationDomainError); // >= 1
      expect(() => validateCommissionSnapshot({ ...snap, rate: "0.000000" })).toThrow(ValidationDomainError); // 0
      expect(() => validateCommissionSnapshot({ ...snap, rate: "0.1234567" })).toThrow(ValidationDomainError); // > 6 знаков
      expect(() => validateCommissionSnapshot({ ...snap, channel: "DIRECT" })).toThrow(ValidationDomainError);
      expect(() => validateCommissionSnapshot(null)).toThrow(ValidationDomainError);
      expect(() => validateCommissionSnapshot({ ...snap, baseAmount: "abc" })).toThrow(ValidationDomainError);
      expect(() => validateCommissionSnapshot({ ...snap, baseAmount: "-5" })).toThrow(ValidationDomainError);
      expect(() => validateCommissionSnapshot({ ...snap, selectedAt: "not-a-date" })).toThrow(ValidationDomainError);
      expect(() => validateCommissionSnapshot({ ...snap, policyVersion: 0 })).toThrow(ValidationDomainError);
      expect(() => validateCommissionSnapshot({ ...snap, sellerPartnerId: "" })).toThrow(ValidationDomainError);
    });
    it("validateCommissionRate still guards canonical fraction (shared with policy)", () => {
      expect(validateCommissionRate("0.15")).toBe("0.15");
      expect(() => validateCommissionRate("1e-7")).toThrow(ValidationDomainError);
    });
    it("mapCommissionChannelFromAcquisition: only MARKETPLACE maps to commission channel", () => {
      expect(mapCommissionChannelFromAcquisition(SalesAcquisitionSource.MARKETPLACE)).toBe("MARKETPLACE");
      expect(mapCommissionChannelFromAcquisition(SalesAcquisitionSource.DIRECT)).toBeNull();
      expect(mapCommissionChannelFromAcquisition(SalesAcquisitionSource.BUYER_REQUEST)).toBeNull();
      expect(mapCommissionChannelFromAcquisition(SalesAcquisitionSource.PARTNER_STOREFRONT)).toBeNull();
      expect(mapCommissionChannelFromAcquisition(null)).toBeNull();
    });
  });
});
