import { ForbiddenException } from "@nestjs/common";
import { SupplierPaymentPlanService } from "./supplier-payment-plan.service";

function build(overrides: Record<string, unknown> = {}) {
  const prisma: any = {
    supplierObligation: {
      findUnique: jest.fn().mockResolvedValue({
        id: "ob-1",
        code: "SBO-1",
        status: "OPEN",
        remainingAmount: 1000,
        aznAmount: 1000,
      }),
    },
    supplierPaymentPlan: {
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn(),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({
        id: "plan-1",
        mode: data.mode,
        installments: data.installments.create.map((row: any, index: number) => ({
          id: `i-${index}`,
          ...row,
          amount: Number(row.amount),
        })),
      })),
    },
    supplierObligationUpdate: jest.fn(),
    ...overrides,
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  // The service calls tx.supplierObligation.update; keep a tx-compatible alias.
  prisma.supplierObligation.update = jest.fn().mockResolvedValue({});
  const security = { audit: jest.fn().mockResolvedValue(undefined) };
  return { prisma, security, service: new SupplierPaymentPlanService(prisma, security as any) };
}

describe("SupplierPaymentPlanService", () => {
  it("rejects non-finance roles", async () => {
    const { service } = build();
    await expect(service.list({ id: "u", username: "sales", role: "SALES_MANAGER" })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("requires exactly one full payment", async () => {
    const { service } = build();
    await expect(
      service.upsert("ob-1", { mode: "FULL", installments: [] }, { id: "u", username: "finance", role: "FINANCE" }),
    ).rejects.toThrow(/exactly one/);
  });

  it("requires first before last for partial payment", async () => {
    const { service } = build();
    await expect(
      service.upsert(
        "ob-1",
        {
          mode: "PARTIAL",
          installments: [
            { kind: "FIRST", dueDate: "2026-12-05", amount: 300 },
            { kind: "LAST", dueDate: "2026-11-20", amount: 700 },
          ],
        },
        { id: "u", username: "finance", role: "FINANCE" },
      ),
    ).rejects.toThrow(/before/);
  });

  it("requires installments to sum to the obligation remainder", async () => {
    const { service } = build();
    await expect(
      service.upsert(
        "ob-1",
        {
          mode: "PARTIAL",
          installments: [
            { kind: "FIRST", dueDate: "2026-11-20", amount: 300 },
            { kind: "LAST", dueDate: "2026-12-05", amount: 600 },
          ],
        },
        { id: "u", username: "finance", role: "FINANCE" },
      ),
    ).rejects.toThrow(/sum to/);
  });

  it("saves first + last and returns the final due date", async () => {
    const { service, prisma } = build();
    const result = await service.upsert(
      "ob-1",
      {
        mode: "PARTIAL",
        installments: [
          { kind: "FIRST", dueDate: "2026-11-20", amount: 300 },
          { kind: "LAST", dueDate: "2026-12-05", amount: 700 },
        ],
      },
      { id: "u", username: "finance", role: "FINANCE" },
    );
    expect(result.mode).toBe("PARTIAL");
    expect(result.dueDate).toBe("2026-12-05");
    expect(result.installments).toHaveLength(2);
    expect(prisma.supplierObligation.update).toHaveBeenCalledWith({
      where: { id: "ob-1" },
      data: { dueDate: new Date(Date.UTC(2026, 11, 5)) },
    });
  });
});
