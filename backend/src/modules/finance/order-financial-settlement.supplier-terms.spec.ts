import { OrderFinancialSettlementService } from "./order-financial-settlement.service";

function build() {
  const tx: any = {
    orderCancellationSupplierTerm: { deleteMany: jest.fn(), create: jest.fn() },
  };
  const prisma: any = {
    order: { findUnique: jest.fn().mockResolvedValue({ id: "o1" }) },
    orderCancellationSupplierTerm: { findMany: jest.fn().mockResolvedValue([{ id: "t1" }]) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const security: any = { audit: jest.fn() };
  return { prisma, tx, service: new OrderFinancialSettlementService(prisma, {} as any, security, {} as any, {} as any) };
}

describe("cancellation supplier terms", () => {
  it("saves terms per supplier", async () => {
    const { prisma, tx, service } = build();
    const rows = await service.saveCancellationSupplierTerms("o1", [{ supplierCode: "ANEX", paidAmount: "500", supplierPenalty: "100" }], { id: "u1", username: "admin" } as any);
    expect(tx.orderCancellationSupplierTerm.create).toHaveBeenCalled();
    expect(rows).toHaveLength(1);
  });

  it("rejects unknown order", async () => {
    const { prisma, service } = build();
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(service.saveCancellationSupplierTerms("missing", [], { id: "u1", username: "admin" } as any)).rejects.toThrow();
  });

  it("lists saved terms", async () => {
    const { service } = build();
    const rows = await service.getCancellationSupplierTerms("o1");
    expect(rows).toHaveLength(1);
  });
});
