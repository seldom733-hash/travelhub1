jest.mock("./documents.service", () => ({ DocumentsService: class {} }));

import { FinancialDocumentConsumer } from "./financial-document.consumer";

describe("FinancialDocumentConsumer — order-level documents", () => {
  it("backfills a captured payment even when the order has no Booking", async () => {
    const payment = { id: "pay-1", orderId: "ord-1", amount: 500, currency: "AZN", referenceNumber: "PAY-1" };
    const order = { id: "ord-1", code: "ORD-1", customerId: "cus-1", amount: 500, paidAmount: 500, refundedAmount: 0, currency: "AZN" };
    const tx = {
      document: { findFirst: jest.fn().mockResolvedValue(null) },
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      booking: { findFirst: jest.fn().mockResolvedValue(null) },
      payment: { findUnique: jest.fn().mockResolvedValue({ referenceNumber: "PAY-1" }) },
      inboxEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    const prisma: any = {
      document: { findMany: jest.fn().mockResolvedValue([]) },
      payment: { findMany: jest.fn().mockResolvedValue([payment]) },
      refund: { findMany: jest.fn().mockResolvedValue([]) },
      supplierPayout: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    const documents = {
      createDocument: jest.fn().mockResolvedValue({ id: "doc-1", code: "PPD-1" }),
      issueDocument: jest.fn().mockResolvedValue({ versionNumber: 1, s3Key: "k" }),
    };
    const eventBus = { on: jest.fn(), isProcessed: jest.fn(), emit: jest.fn() };
    const consumer = new FinancialDocumentConsumer(eventBus as any, prisma, documents as any);

    await (consumer as any).backfill();

    expect(documents.createDocument).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: "PARTIAL_PAYMENT", bookingId: null, orderId: "ord-1", sourceId: "pay-1" }),
    );
    expect(documents.issueDocument).toHaveBeenCalled();
  });
});
