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
    orderFinancialSettlement: { findMany: jest.fn().mockResolvedValue([]) },
    orderFinancialAdjustment: { findMany: jest.fn().mockResolvedValue([]) },
    supplierObligation: { findMany: jest.fn().mockResolvedValue([]) },
    customer: { findMany: jest.fn().mockResolvedValue([]) },
    product: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
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

  it("does not count canceled orders as sales", async () => {
    const prisma = buildPrisma();
    prisma.request.findMany.mockResolvedValue([{
      id: "req-cancel", referenceNumber: "MKT-REQ-C", createdAt: new Date("2026-11-10T10:00:00Z"),
      customerId: null, requestType: "TOUR_PACKAGE", sourceChannel: "WHATSAPP", status: "CONVERTED",
      assignedManagerId: null, assignedAt: null, assignmentType: null, firstContactAt: null,
      processingStartedAt: null, slaDueAt: null, convertedOrderId: "ord-cancel",
      customerAcceptedAt: null, supplierRespondedAt: null,
    }]);
    prisma.order.findMany.mockResolvedValue([{
      id: "ord-cancel", referenceNumber: "MKT-ORD-C", createdAt: new Date("2026-11-10T10:00:00Z"),
      status: "CANCELLED", amount: 1000, cancelledAt: new Date("2026-11-10T11:00:00Z"),
      fulfilledAt: null, closedAt: null, customerId: null, financialStatus: "OPEN",
    }]);
    const service = new SalesAnalyticsService(prisma);
    const result = await service.dashboard({ preset: "CURRENT_MONTH", timezone: "UTC" }, { role: "ADMIN" });
    expect(result.kpis.salesAmount.value).toBe(0);
    expect(result.kpis.ordersCreated.value).toBe(1);
    expect(result.kpis.cancelledOrders.value).toBe(1);
  });

  it("allocates a deal cost across its services", async () => {
    const prisma = buildPrisma();
    prisma.request.findMany.mockResolvedValue([{
      id: "req-1", referenceNumber: "MKT-REQ-1", createdAt: new Date("2026-11-10T10:00:00Z"),
      customerId: null, requestType: "TOUR_PACKAGE", sourceChannel: "WHATSAPP", status: "CONVERTED",
      assignedManagerId: null, assignedAt: null, assignmentType: null, firstContactAt: null,
      processingStartedAt: null, slaDueAt: null, convertedOrderId: "ord-1",
      customerAcceptedAt: null, supplierRespondedAt: null,
      commercialSnapshot: { netSupplierCost: 500 },
    }]);
    prisma.order.findMany.mockResolvedValue([{
      id: "ord-1", referenceNumber: "MKT-ORD-1", createdAt: new Date("2026-11-10T10:00:00Z"),
      status: "FULFILLED", amount: 1000, fulfilledAt: new Date("2026-11-12T10:00:00Z"),
      closedAt: null, cancelledAt: null, customerId: null, financialStatus: "OPEN",
      items: [
        { id: "i1", title: "Hotel", type: "HOTEL", amount: 600 },
        { id: "i2", title: "Transfer", type: "TRANSFER", amount: 400 },
      ],
    }]);
    const service = new SalesAnalyticsService(prisma);
    const result = await service.dashboard({ preset: "CURRENT_MONTH", timezone: "UTC" }, { role: "ADMIN" });
    const deal = result.deals.completed[0];
    expect(deal).toBeTruthy();
    expect(deal.services.map((s: any) => s.cost)).toEqual([300, 200]);
  });

  it("does not leak another manager's financial rows", async () => {
    const prisma = buildPrisma();
    const own = {
      id: "ord-own", referenceNumber: "MKT-ORD-OWN", createdAt: new Date("2026-11-10T10:00:00Z"),
      status: "SENT_TO_BOOKING", amount: 1000, fulfilledAt: null, closedAt: null,
      cancelledAt: null, customerId: null, financialStatus: "OPEN", items: [],
    };
    const other = { ...own, id: "ord-other", referenceNumber: "MKT-ORD-OTHER" };
    prisma.request.findMany.mockResolvedValue([{
      id: "req-own", referenceNumber: "MKT-REQ-OWN", createdAt: new Date("2026-11-10T10:00:00Z"),
      customerId: null, requestType: "TOUR_PACKAGE", sourceChannel: "WHATSAPP", status: "CONVERTED",
      assignedManagerId: "m-1", assignedAt: new Date("2026-11-10T10:01:00Z"), assignmentType: "AUTO",
      firstContactAt: null, processingStartedAt: null, slaDueAt: null, convertedOrderId: "ord-own",
      customerAcceptedAt: null, supplierRespondedAt: null,
    }]);
    prisma.order.findMany.mockResolvedValue([own, other]);
    prisma.payment.findMany.mockResolvedValue([
      { orderId: "ord-own", amount: 100, code: "PAY-1", paidAt: new Date("2026-11-10T11:00:00Z") },
      { orderId: "ord-other", amount: 900, code: "PAY-2", paidAt: new Date("2026-11-10T11:00:00Z") },
    ]);
    const service = new SalesAnalyticsService(prisma);
    const result = await service.dashboard({ preset: "CURRENT_MONTH", timezone: "UTC" }, { id: "m-1", role: "SALES_MANAGER" });
    expect(result.financials.map((x: any) => x.code)).toEqual(["PAY-1"]);
  });
});
