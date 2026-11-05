import { ConflictError } from "../../shared/errors";
import { OrderFinancialSettlementService } from "./order-financial-settlement.service";

function build() {
  const prisma: any = {
    cancellationApproval: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    orderFinancialSettlement: { findUnique: jest.fn() },
  };
  const ids: any = { nextCode: jest.fn().mockResolvedValue("CNA-00000001") };
  const security: any = { audit: jest.fn() };
  return { prisma, service: new OrderFinancialSettlementService(prisma, ids, security, {} as any, {} as any) };
}

describe("cancellation approval workflow", () => {
  it("rejects self-approval", async () => {
    const { prisma, service } = build();
    prisma.cancellationApproval.findFirst.mockResolvedValue({ id: "a1", submittedById: "u1", input: {} });
    await expect(service.approveCancellationApproval("o1", { id: "u1", username: "manager" } as any)).rejects.toBeInstanceOf(ConflictError);
  });

  it("cannot submit twice while pending", async () => {
    const { prisma, service } = build();
    prisma.cancellationApproval.findFirst.mockResolvedValue({ id: "a1", status: "PENDING" });
    await expect(service.submitCancellationApproval("o1", {} as any, { id: "u2", username: "manager" } as any)).rejects.toBeInstanceOf(ConflictError);
  });

  it("creates pending approval with code", async () => {
    const { prisma, service } = build();
    prisma.cancellationApproval.findFirst.mockResolvedValue(null);
    prisma.cancellationApproval.create.mockResolvedValue({ id: "a1", code: "CNA-00000001", status: "PENDING" });
    const row = await service.submitCancellationApproval("o1", {} as any, { id: "u2", username: "manager" } as any);
    expect(row.code).toBe("CNA-00000001");
    expect(prisma.cancellationApproval.create).toHaveBeenCalled();
  });
});
