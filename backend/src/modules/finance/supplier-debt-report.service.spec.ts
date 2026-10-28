import { Prisma } from "../../generated/prisma/client";
import { SupplierDebtReportService } from "./supplier-debt-report.service";

const D = (v: string | number) => new Prisma.Decimal(String(v));

function obligation(over: Record<string, unknown> = {}) {
  return {
    id: "ob-1",
    code: "SBO-00000001",
    invoiceNumber: "INV-1",
    supplierCode: "SUMMERTOUR",
    partnerId: "ptn-1",
    orderCode: "ORD-1",
    bookingCode: "BKG-1",
    sourceAmount: D(1000),
    sourceCurrency: "USD",
    aznAmount: D(1700),
    status: "OPEN",
    dueDate: new Date("2026-10-20T00:00:00Z"),
    confirmedAt: new Date("2026-10-01T00:00:00Z"),
    createdAt: new Date("2026-10-01T00:00:00Z"),
    ...over,
  };
}

function makeService(opts: {
  obligations?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  allocations?: Array<Record<string, unknown>>;
} = {}) {
  const prisma: any = {
    supplierObligation: { findMany: jest.fn().mockResolvedValue(opts.obligations ?? [obligation()]) },
    supplierObligationEvent: { findMany: jest.fn().mockResolvedValue(opts.events ?? []) },
    supplierPayoutAllocation: { findMany: jest.fn().mockResolvedValue(opts.allocations ?? []) },
    partner: { findMany: jest.fn().mockResolvedValue([{ id: "ptn-1", code: "PAR-1" }]) },
  };
  const security = { audit: jest.fn().mockResolvedValue(undefined) };
  return { service: new SupplierDebtReportService(prisma, security as never), prisma, security };
}

describe("SupplierDebtReportService — задолженность на дату", () => {
  it("восстанавливает сумму/оплату/остаток из событий и allocations на дату", async () => {
    const { service } = makeService({
      events: [
        { obligationId: "ob-1", type: "CREATED", aznAmount: D(1700) },
        { obligationId: "ob-1", type: "ADJUSTED", aznAmount: D(1600) },
      ],
      allocations: [{ obligationId: "ob-1", aznAmount: D(400) }],
    });
    const report = await service.getReport({ asOf: "2026-10-25" });
    expect(report.items).toHaveLength(1);
    expect(report.items[0]).toMatchObject({
      obligationCode: "SBO-00000001",
      aznAmount: "1600",
      paidAzn: "400",
      remainingAzn: "1200",
      status: "PARTIALLY_PAID",
      overdue: true,
      precision: "EVENT",
      partnerCode: "PAR-1",
      sourceCurrency: "USD",
    });
    expect(report.totalsByCurrency).toEqual([
      expect.objectContaining({ currency: "USD", count: 1, sourceAmount: "1000", aznAmount: "1600", paidAzn: "400", remainingAzn: "1200" }),
    ]);
  });

  it("отмена в истории → CANCELLED и не overdue", async () => {
    const { service } = makeService({
      events: [
        { obligationId: "ob-1", type: "CREATED", aznAmount: D(1700) },
        { obligationId: "ob-1", type: "CANCELLED", aznAmount: D(1700) },
      ],
    });
    const report = await service.getReport({ asOf: "2026-10-25" });
    expect(report.items[0].status).toBe("CANCELLED");
    expect(report.items[0].overdue).toBe(false);
    // Отменённое обязательство не попадает в итоговую задолженность.
    expect(report.totalsByCurrency).toEqual([]);
  });

  it("полная оплата на дату → CLOSED, remaining 0", async () => {
    const { service } = makeService({
      events: [{ obligationId: "ob-1", type: "CREATED", aznAmount: D(1700) }],
      allocations: [{ obligationId: "ob-1", aznAmount: D(1700) }],
    });
    const report = await service.getReport({ asOf: "2026-10-25" });
    expect(report.items[0].status).toBe("CLOSED");
    expect(report.items[0].remainingAzn).toBe("0");
  });

  it("legacy obligation без событий → CURRENT-сумма с предупреждением", async () => {
    const { service } = makeService();
    const report = await service.getReport({ asOf: "2026-10-25" });
    expect(report.items[0].precision).toBe("LEGACY_CURRENT");
    expect(report.warnings[0]).toMatch(/LEGACY_CURRENT/);
  });

  it("PENDING-платёж не попадает в paid (dao возвращает только confirmed allocations)", async () => {
    // Контракт обеспечивается SQL-фильтром payout.confirmedAt <= asOf; здесь
    // проверяем, что при отсутствии allocations paid остаётся 0.
    const { service } = makeService({
      events: [{ obligationId: "ob-1", type: "CREATED", aznAmount: D(1700) }],
      allocations: [],
    });
    const report = await service.getReport({ asOf: "2026-10-25" });
    expect(report.items[0].paidAzn).toBe("0");
    expect(report.items[0].status).toBe("OPEN");
  });

  it("невалидная дата → 422-подобная ValidationDomainError", async () => {
    const { service } = makeService();
    await expect(service.getReport({ asOf: "25-10-2026" })).rejects.toThrow(/YYYY-MM-DD/);
  });
});
