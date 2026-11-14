import { ForbiddenException } from "@nestjs/common";
import { SalesAnalyticsService } from "./sales-analytics.service";

function buildPrisma() {
  const request = {
    id: "req-1", referenceNumber: "MKT-REQ-1", createdAt: new Date("2026-11-10T10:00:00Z"),
    customerId: null, requestType: "TOUR_PACKAGE", sourceChannel: "WHATSAPP", status: "NEW",
    assignedManagerId: "m-1", assignedAt: new Date("2026-11-10T10:01:00Z"), assignmentType: "AUTO",
    firstContactAt: null, processingStartedAt: null, slaDueAt: null,
    convertedOrderId: null, customerAcceptedAt: null, supplierRespondedAt: null,
  };
  const prisma: any = {
    request: { findMany: jest.fn().mockResolvedValue([request]) },
    order: { findMany: jest.fn().mockResolvedValue([]) },
    booking: { findMany: jest.fn().mockResolvedValue([]) },
    payment: { findMany: jest.fn().mockResolvedValue([]) },
    refund: { findMany: jest.fn().mockResolvedValue([]) },
    customer: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    requestHistory: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return prisma;
}

describe("SalesAnalyticsService RBAC / scope", () => {
  it("forces a SALES_MANAGER to own assignedManagerId", async () => {
    const prisma = buildPrisma();
    const service = new SalesAnalyticsService(prisma);
    await service.dashboard(
      { preset: "CURRENT_MONTH", timezone: "UTC", managerId: "another-manager" },
      { id: "m-1", role: "SALES_MANAGER" },
    );
    const where = prisma.request.findMany.mock.calls[0][0].where;
    expect(where.assignedManagerId).toBe("m-1");
  });

  it("rejects a SALES_MANAGER opening another manager card", async () => {
    const service = new SalesAnalyticsService(buildPrisma());
    await expect(
      service.managerDetail("other", { preset: "CURRENT_MONTH", timezone: "UTC" }, { id: "m-1", role: "SALES_MANAGER" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
