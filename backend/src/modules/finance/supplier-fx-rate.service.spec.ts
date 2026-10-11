/**
 * UNIFIED FINANCE CENTER Phase 1 — SupplierFxRateService tests.
 *
 * Обязательный тест-матрица (implementation prompt Phase 1):
 *  - missing rate: resolveStrict/convertToAznStrict → controlled error;
 *    resolveSafe/convertToAznSafe → null (fail-open browse, НИКОГДА не 1);
 *  - AZN identity: resolve("X", "AZN") → rate 1 без DB-lookup;
 *  - supplier-specific: два поставщика с разными курсами → разные эквиваленты;
 *  - rounding: half-up 2dp через toMoney2 (platform money contract);
 *  - setCurrent: CREATE (history CREATE, audit) / UPDATE (history old→new);
 *    идемпотентный повтор того же курса → без новой истории;
 *  - AZN→AZN reject (всегда 1, строка не хранится);
 *  - invalid rate reject (validateRate: ≤0 / >6 знаков / не число).
 */
import { Prisma } from "../../generated/prisma/client";
import { ValidationDomainError } from "../../shared/errors";
import { SupplierFxRateService } from "./supplier-fx-rate.service";

const ACTOR = { id: "u1", username: "fin.admin" };

interface Row {
  id: string;
  code: string;
  supplierCode: string;
  sourceCurrencyIso: string;
  targetCurrencyIso: string;
  rate: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
  updatedById: string | null;
  updatedByName: string | null;
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: "r1",
    code: "SFX-00000001",
    supplierCode: "SUMMERTOUR",
    sourceCurrencyIso: "USD",
    targetCurrencyIso: "AZN",
    rate: new Prisma.Decimal("1.70"),
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    updatedById: "u1",
    updatedByName: "fin.admin",
    ...overrides,
  };
}

interface Harness {
  service: SupplierFxRateService;
  prisma: {
    supplierFxRate: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    supplierFxRateHistory: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    $transaction: jest.Mock;
  };
  ids: { nextCode: jest.Mock };
  security: { audit: jest.Mock };
}

function makeService(existing: Row | null = null): Harness {
  const prisma = {
    supplierFxRate: {
      findUnique: jest.fn().mockResolvedValue(existing),
      findMany: jest.fn().mockResolvedValue(existing ? [existing] : []),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        row({ id: "r-new", code: "SFX-00000009", ...data } as Partial<Row>)),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        row({ ...data, rate: data.rate as Prisma.Decimal, updatedAt: new Date("2026-10-02T00:00:00Z") } as Partial<Row>)),
    },
    supplierFxRateHistory: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn(),
  };
  // $transaction(fn) — последовательно с тем же mock-клиентом (unit-контракт).
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  const ids = { nextCode: jest.fn().mockResolvedValue("SFX-00000009") };
  const security = { audit: jest.fn().mockResolvedValue(undefined) };
  const service = new SupplierFxRateService(
    prisma as never,
    ids as never,
    security as never,
  );
  return { service, prisma, ids, security };
}

describe("SupplierFxRateService (UNIFIED FINANCE CENTER Phase 1)", () => {
  describe("resolve / convert", () => {
    it("AZN source → identity rate 1 without DB lookup", async () => {
      const h = makeService();
      const fx = await h.service.resolveStrict("SUMMERTOUR", "AZN");
      expect(fx.rate.toString()).toBe("1");
      expect(fx.rateCode).toBeNull();
      expect(h.prisma.supplierFxRate.findUnique).not.toHaveBeenCalled();

      const safe = await h.service.resolveSafe("SUMMERTOUR", "AZN");
      expect(safe?.rate.toString()).toBe("1");
    });

    it("missing rate: resolveStrict → controlled error (никогда не silent 1)", async () => {
      const h = makeService(null);
      await expect(h.service.resolveStrict("KOMPAS", "USD")).rejects.toThrow(ValidationDomainError);
      await expect(h.service.resolveStrict("KOMPAS", "USD")).rejects.toThrow(/missing FX rate/);
    });

    it("missing rate: resolveSafe → null (fail-open browse), convertToAznSafe → null", async () => {
      const h = makeService(null);
      expect(await h.service.resolveSafe("KOMPAS", "USD")).toBeNull();
      expect(await h.service.convertToAznSafe("KOMPAS", "USD", 1000)).toBeNull();
    });

    it("missing rate: convertToAznStrict → controlled error", async () => {
      const h = makeService(null);
      await expect(h.service.convertToAznStrict("KOMPAS", "USD", 1000)).rejects.toThrow(/missing FX rate/);
    });

    it("supplier-specific: два поставщика — своя ставка на USD→AZN", async () => {
      const h = makeService();
      h.prisma.supplierFxRate.findUnique
        .mockResolvedValueOnce(row({ code: "SFX-00000001", supplierCode: "SUMMERTOUR", rate: new Prisma.Decimal("1.70") }))
        .mockResolvedValueOnce(row({ code: "SFX-00000002", supplierCode: "KOMPAS", rate: new Prisma.Decimal("1.72") }));
      const a = await h.service.convertToAznStrict("SUMMERTOUR", "USD", 1000);
      const b = await h.service.convertToAznStrict("KOMPAS", "USD", 1000);
      // decimal.js toString срезает хвостовые нули (канон платформы: rate.toString()).
      expect(a.aznAmount.toString()).toBe("1700");
      expect(b.aznAmount.toString()).toBe("1720");
    });

    it("adapter-токен AVIASALES → курс, хранящийся по Partner.code (резолюция по имени партнёра)", async () => {
      const rateRow = row({ code: "SFX-00000010", supplierCode: "PRN-00000004", rate: new Prisma.Decimal("1.70") });
      const prisma = {
        supplierFxRate: {
          findUnique: jest.fn(async ({ where }: { where?: Record<string, unknown> }) => {
            const k = where?.["supplierCode_sourceCurrencyIso_targetCurrencyIso"] as
              | { supplierCode?: string }
              | undefined;
            return k?.supplierCode === "PRN-00000004" ? rateRow : null;
          }),
          findMany: jest.fn().mockResolvedValue([rateRow]),
          create: jest.fn(),
          update: jest.fn(),
        },
        supplierFxRateHistory: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        product: { findFirst: jest.fn().mockResolvedValue(null) },
        partner: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest.fn().mockResolvedValue({ code: "PRN-00000004", name: "Aviasales" }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        $transaction: jest.fn(),
      };
      const service = new SupplierFxRateService(
        prisma as never,
        { nextCode: jest.fn() } as never,
        { audit: jest.fn() } as never,
      );

      const fx = await service.resolveStrict("AVIASALES", "USD");
      expect(fx.rate.toString()).toBe("1.7");
      expect(fx.rateCode).toBe("SFX-00000010");
      expect(prisma.partner.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ name: expect.objectContaining({ in: ["Aviasales"] }) }) }),
      );
    });

    it("будущий поставщик без записи в маппинге: токен нормализуется в имя партнёра (VOYAGER → Voyager)", async () => {
      const rateRow = row({ code: "SFX-00000011", supplierCode: "PRN-00000009", rate: new Prisma.Decimal("1.70") });
      const prisma = {
        supplierFxRate: {
          findUnique: jest.fn(async ({ where }: { where?: Record<string, unknown> }) => {
            const k = where?.["supplierCode_sourceCurrencyIso_targetCurrencyIso"] as
              | { supplierCode?: string }
              | undefined;
            return k?.supplierCode === "PRN-00000009" ? rateRow : null;
          }),
          findMany: jest.fn().mockResolvedValue([rateRow]),
          create: jest.fn(),
          update: jest.fn(),
        },
        supplierFxRateHistory: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        // Нет продуктов (до первого синка) и нет legacy-записи — только имя.
        product: { findFirst: jest.fn().mockResolvedValue(null) },
        partner: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([{ code: "PRN-00000009", name: "Voyager" }]),
        },
        $transaction: jest.fn(),
      };
      const service = new SupplierFxRateService(
        prisma as never,
        { nextCode: jest.fn() } as never,
        { audit: jest.fn() } as never,
      );

      const fx = await service.resolveStrict("VOYAGER", "USD");
      expect(fx.rate.toString()).toBe("1.7");
      expect(fx.rateCode).toBe("SFX-00000011");
    });

    it("rounding: half-up 2dp (platform money contract)", async () => {
      const h = makeService(row({ rate: new Prisma.Decimal("1.111") }));
      const conv = await h.service.convertToAznStrict("SUMMERTOUR", "USD", "999.99");
      // 999.99 × 1.111 = 1110.98889 → half-up 2dp → 1110.99
      expect(conv.aznAmount.toString()).toBe("1110.99");

      const h2 = makeService(row({ rate: new Prisma.Decimal("1.2345") }));
      const conv2 = await h2.service.convertToAznStrict("SUMMERTOUR", "USD", "1000");
      // 1000 × 1.2345 = 1234.5 → 1234.50 (toString → "1234.5")
      expect(conv2.aznAmount.toString()).toBe("1234.5");
    });

    it("convertToAzn: amount <= 0 → reject (Gate E spirit)", () => {
      const h = makeService();
      expect(() =>
        h.service.convertToAzn(0, { rate: new Prisma.Decimal("1.7"), rateCode: null }),
      ).toThrow(ValidationDomainError);
      expect(() =>
        h.service.convertToAzn(-5, { rate: new Prisma.Decimal("1.7"), rateCode: null }),
      ).toThrow(ValidationDomainError);
    });
  });

  describe("setCurrent (upsert + history + audit)", () => {
    it("CREATE: код SFX-*, history CREATE (oldRate null), audit finance.fx_rate.set", async () => {
      const h = makeService(null);
      const dto = await h.service.setCurrent(
        { supplierCode: "SUMMERTOUR", sourceCurrencyIso: "USD", rate: "1.70" },
        ACTOR,
      );
      expect(dto.code).toBe("SFX-00000009");
      // decimal.js toString срезает хвостовые нули (канон rateDto: rate.toString()).
      expect(dto.rate).toBe("1.7");
      expect(dto.targetCurrencyIso).toBe("AZN");
      expect(h.ids.nextCode).toHaveBeenCalledWith(expect.anything(), "SFX");
      expect(h.prisma.supplierFxRateHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "CREATE", oldRate: null, newRate: new Prisma.Decimal("1.70") }),
        }),
      );
      expect(h.security.audit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: "finance.fx_rate.set", resourceId: "SFX-00000009" }),
      );
    });

    it("UPDATE: history oldRate→newRate, updatedBy stamped", async () => {
      const h = makeService(row({ rate: new Prisma.Decimal("1.70") }));
      const dto = await h.service.setCurrent(
        { supplierCode: "SUMMERTOUR", sourceCurrencyIso: "USD", rate: "1.75" },
        ACTOR,
      );
      expect(dto.rate).toBe("1.75");
      expect(h.prisma.supplierFxRate.update).toHaveBeenCalled();
      expect(h.prisma.supplierFxRateHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "UPDATE",
            oldRate: new Prisma.Decimal("1.70"),
            newRate: new Prisma.Decimal("1.75"),
            actorId: "u1",
            actorName: "fin.admin",
          }),
        }),
      );
    });

    it("идемпотентный повтор того же курса → no history noise", async () => {
      const h = makeService(row({ rate: new Prisma.Decimal("1.70") }));
      const dto = await h.service.setCurrent(
        { supplierCode: "SUMMERTOUR", sourceCurrencyIso: "USD", rate: "1.70" },
        ACTOR,
      );
      expect(dto.rate).toBe("1.7");
      expect(h.prisma.supplierFxRate.update).not.toHaveBeenCalled();
      expect(h.prisma.supplierFxRateHistory.create).not.toHaveBeenCalled();
    });

    it("AZN→AZN reject (всегда 1, строка не хранится)", async () => {
      const h = makeService(null);
      await expect(
        h.service.setCurrent({ supplierCode: "SUMMERTOUR", sourceCurrencyIso: "AZN", rate: "1" }, ACTOR),
      ).rejects.toThrow(/AZN→AZN/);
    });

    it("invalid rate reject (≤0, >6 знаков, не число)", async () => {
      const h = makeService(null);
      await expect(
        h.service.setCurrent({ supplierCode: "S", sourceCurrencyIso: "USD", rate: "0" }, ACTOR),
      ).rejects.toThrow(ValidationDomainError);
      await expect(
        h.service.setCurrent({ supplierCode: "S", sourceCurrencyIso: "USD", rate: "-1.5" }, ACTOR),
      ).rejects.toThrow(ValidationDomainError);
      await expect(
        h.service.setCurrent({ supplierCode: "S", sourceCurrencyIso: "USD", rate: "1.1234567" }, ACTOR),
      ).rejects.toThrow(/6 decimal places/);
    });

    it("invalid source currency ISO reject", async () => {
      const h = makeService(null);
      await expect(
        h.service.setCurrent({ supplierCode: "S", sourceCurrencyIso: "usd", rate: "1.7" }, ACTOR),
      ).rejects.toThrow(ValidationDomainError);
    });
  });
});
