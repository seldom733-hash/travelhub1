import { LedgerPostingConsumer } from "./ledger-posting.consumer";
import { DomainEvents } from "../../eventbus/domain-events";

/**
 * Reversal contract: отмена CONFIRMED-выплаты создаёт ОТДЕЛЬНУЮ append-only
 * проводку SUPPLIER_PAYOUT_REVERSAL (same sourceType/sourceId, другой type),
 * исходная SUPPLIER_PAYOUT не удаляется. Повторная доставка события
 * идемпотентна (inbox isProcessed → no-op).
 */
function makeConsumer(opts: { processed?: boolean } = {}) {
  const handlers = new Map<string, (ev: unknown) => Promise<void>>();
  const eventBus = {
    on: jest.fn((type: string, handler: (ev: unknown) => Promise<void>) => handlers.set(type, handler)),
    isProcessed: jest.fn().mockResolvedValue(opts.processed ?? false),
    markProcessed: jest.fn().mockResolvedValue(undefined),
  };
  const ledger = { create: jest.fn().mockResolvedValue({ id: "ltx-1" }) };
  const prisma = {
    $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  };
  const consumer = new LedgerPostingConsumer(eventBus as never, prisma as never, ledger as never);
  consumer.onModuleInit();
  return { consumer, handlers, eventBus, ledger };
}

const reversalEvent = {
  id: "evt-rev-1",
  payload: {
    payoutId: "pay-1",
    payoutCode: "SPO-00000001",
    amount: "1000",
    currency: "USD",
    reason: "bank error",
    occurredAt: "2026-10-25T12:00:00.000Z",
  },
};

describe("LedgerPostingConsumer — SupplierPayoutReversed", () => {
  it("пишет компенсирующую проводку SUPPLIER_PAYOUT_REVERSAL по той же payout-ссылке", async () => {
    const { handlers, ledger } = makeConsumer();
    const handler = handlers.get(DomainEvents.SupplierPayoutReversed);
    expect(handler).toBeDefined();

    await handler!(reversalEvent);

    expect(ledger.create).toHaveBeenCalledWith({
      amount: "1000",
      currency: "USD",
      type: "SUPPLIER_PAYOUT_REVERSAL",
      sourceType: "SUPPLIER_PAYOUT",
      sourceId: "pay-1",
      sourceEventId: "evt-rev-1",
      businessRef: "SPO-00000001",
      occurredAt: "2026-10-25T12:00:00.000Z",
    });
  });

  it("повторная доставка события не создаёт второе сторно", async () => {
    const { handlers, ledger } = makeConsumer({ processed: true });
    await handlers.get(DomainEvents.SupplierPayoutReversed)!(reversalEvent);
    expect(ledger.create).not.toHaveBeenCalled();
  });

  it("событие помечается processed после успешной проводки", async () => {
    const { handlers, eventBus } = makeConsumer();
    await handlers.get(DomainEvents.SupplierPayoutReversed)!(reversalEvent);
    expect(eventBus.markProcessed).toHaveBeenCalledWith(
      expect.anything(),
      "ledger-posting-consumer",
      "evt-rev-1",
    );
  });
});
