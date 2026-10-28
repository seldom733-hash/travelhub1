import { ValidationDomainError } from "../../shared/errors";
import { computeDueDate, SupplierPaymentTermsService } from "./supplier-payment-terms.service";

const ACTOR = { id: "u-fin", username: "finance" };

describe("SupplierPaymentTerms — расчёт срока", () => {
  it("IMMEDIATE → дата подтверждения (UTC date-only)", () => {
    const due = computeDueDate("IMMEDIATE", 0, new Date("2026-10-25T15:30:00Z"));
    expect(due.toISOString()).toBe("2026-10-25T00:00:00.000Z");
  });

  it("NET_DAYS 30 → +30 дней (месяц/граница года)", () => {
    const due = computeDueDate("NET_DAYS", 30, new Date("2026-12-15T10:00:00Z"));
    expect(due.toISOString()).toBe("2027-01-14T00:00:00.000Z");
  });

  it("неподдерживаемое правило → 422", () => {
    expect(() => computeDueDate("AFTER_INVOICE", 10, new Date())).toThrow(ValidationDomainError);
  });
});

function makeService(existing: Record<string, unknown> | null = null) {
  const row = {
    id: "terms-1",
    supplierCode: "SUMMERTOUR",
    rule: "NET_DAYS",
    days: 30,
    active: true,
    updatedById: ACTOR.id,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-25T00:00:00Z"),
  };
  const prisma: any = {
    supplierPaymentTerms: {
      findUnique: jest.fn().mockResolvedValue(existing),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue(row),
    },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
  };
  const security = { audit: jest.fn().mockResolvedValue(undefined) };
  return { service: new SupplierPaymentTermsService(prisma, security as never), prisma, security };
}

describe("SupplierPaymentTermsService — правила поставщика", () => {
  it("upsert: сохраняет правило и пишет аудит old→new", async () => {
    const { service, prisma } = makeService({ ...{ rule: "IMMEDIATE", days: 0 } });
    const result = await service.upsert({ supplierCode: "summertour", rule: "NET_DAYS", days: 30 }, ACTOR);
    expect(result).toMatchObject({ supplierCode: "SUMMERTOUR", rule: "NET_DAYS", days: 30 });
    expect(prisma.supplierPaymentTerms.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { supplierCode: "SUMMERTOUR" },
        create: expect.objectContaining({ rule: "NET_DAYS", days: 30 }),
      }),
    );
    expect(prisma.supplierPaymentTerms.upsert).toBeDefined();
  });

  it("IMMEDIATE принудительно days=0", async () => {
    const { service, prisma } = makeService();
    await service.upsert({ supplierCode: "KOMPAS", rule: "IMMEDIATE", days: 99 }, ACTOR);
    expect(prisma.supplierPaymentTerms.upsert.mock.calls[0][0].create.days).toBe(0);
  });

  it("невалидные дни → 422", async () => {
    const { service } = makeService();
    await expect(service.upsert({ supplierCode: "KOMPAS", rule: "NET_DAYS", days: 400 }, ACTOR)).rejects.toBeInstanceOf(
      ValidationDomainError,
    );
  });

  it("resolveForSupplier: отсутствие правила → null (ручной срок)", async () => {
    const { service } = makeService(null);
    await expect(service.resolveForSupplier("KOMPAS")).resolves.toBeNull();
    await expect(service.resolveForSupplier(null)).resolves.toBeNull();
  });
});
