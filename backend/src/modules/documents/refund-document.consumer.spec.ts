jest.mock("./documents.service", () => ({ DocumentsService: class {} }));

import { RefundDocumentConsumer } from "./refund-document.consumer";

describe("RefundDocumentConsumer — order-level documents", () => {
  it("creates a refund document when the order has no Booking", async () => {
    const order = {
      id: "ord-1", code: "ORD-1", customerId: "cus-1", amount: 500,
      paidAmount: 500, refundedAmount: 200, currency: "AZN", paymentStatus: "PAID",
    };
    const tx: any = {
      inboxEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      booking: { findFirst: jest.fn().mockResolvedValue(null) },
      document: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const prisma: any = { $transaction: jest.fn((fn: any) => fn(tx)) };
    const documents = {
      createDocument: jest.fn().mockResolvedValue({ id: "doc-1", code: "RFD-1" }),
      issueDocument: jest.fn().mockResolvedValue({ versionNumber: 1, s3Key: "k" }),
      invalidateDocument: jest.fn(),
    };
    const eventBus = { on: jest.fn(), isProcessed: jest.fn().mockResolvedValue(false) };
    const consumer = new RefundDocumentConsumer(eventBus as any, prisma, documents as any);

    await (consumer as any).onRefundProcessed({
      id: "evt-1",
      payload: { orderId: "ord-1", refundId: "rfd-1", amount: "200", code: "RFD-1" },
    });

    expect(documents.createDocument).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: "REFUND", bookingId: null, orderId: "ord-1" }),
    );
    expect(documents.issueDocument).toHaveBeenCalled();
  });
});
