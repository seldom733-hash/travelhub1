import { OrderClosureWorker } from "./order-closure.worker";
import { ConflictError } from "../../shared/errors";

function createWorker() {
  const orders = {
    prisma: {
      order: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    },
    orderAction: jest.fn().mockResolvedValue({ id: "ord-1" }),
  };
  const worker = new OrderClosureWorker(orders as any);
  const logger = (worker as any).logger as {
    log: jest.Mock;
    debug: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };
  jest.spyOn(logger, "log").mockImplementation(() => undefined);
  jest.spyOn(logger, "debug").mockImplementation(() => undefined);
  jest.spyOn(logger, "warn").mockImplementation(() => undefined);
  jest.spyOn(logger, "error").mockImplementation(() => undefined);
  return { worker, orders, logger };
}

describe("OrderClosureWorker", () => {
  it("W1: closes every candidate and logs one summary line", async () => {
    const { worker, orders, logger } = createWorker();
    orders.prisma.order.findMany.mockResolvedValue([
      { id: "ord-1", code: "ORD-1" },
      { id: "ord-2", code: "ORD-2" },
    ]);

    await worker.run();

    expect(orders.orderAction).toHaveBeenCalledTimes(2);
    expect(orders.orderAction).toHaveBeenCalledWith("ord-1", "close", "system");
    expect(logger.log).toHaveBeenCalledWith("Automatic order closure: 2/2 closed");
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("W2: expected domain skips are aggregated, not logged per order as warnings", async () => {
    const { worker, orders, logger } = createWorker();
    orders.prisma.order.findMany.mockResolvedValue([
      { id: "ord-1", code: "ORD-1" },
      { id: "ord-2", code: "ORD-2" },
      { id: "ord-3", code: "ORD-3" },
    ]);
    orders.orderAction
      .mockRejectedValueOnce(new ConflictError("Service period has not ended"))
      .mockRejectedValueOnce(new ConflictError("Service period has not ended"))
      .mockResolvedValueOnce({ id: "ord-3" });

    await worker.run();

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      "Automatic order closure: 1/3 closed; skipped: 2× Service period has not ended",
    );
    expect(logger.debug).toHaveBeenCalledTimes(2);
  });

  it("W2b: real per-order messages aggregate after stripping the order code", async () => {
    const { worker, orders, logger } = createWorker();
    orders.prisma.order.findMany.mockResolvedValue([
      { id: "ord-1", code: "ORD-00000011" },
      { id: "ord-2", code: "ORD-00000051" },
    ]);
    const detail = "cannot be completed/closed: clientDebt=0, supplierDebt=700";
    orders.orderAction
      .mockRejectedValueOnce(new ConflictError(`Order ORD-00000011 ${detail}`))
      .mockRejectedValueOnce(new ConflictError(`Order ORD-00000051 ${detail}`));

    await worker.run();

    expect(logger.log).toHaveBeenCalledWith(`Automatic order closure: 0/2 closed; skipped: 2× ${detail}`);
  });

  it("W2c: only the top 5 reasons are listed, the rest are summarised", async () => {
    const { worker, orders, logger } = createWorker();
    orders.prisma.order.findMany.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({ id: `ord-${i}`, code: `ORD-${i}` })),
    );
    orders.orderAction.mockImplementation((id: string) =>
      Promise.reject(new ConflictError(`reason for ${id}`)),
    );

    await worker.run();

    const message = logger.log.mock.calls[0][0] as string;
    expect(message).toContain("0/7 closed");
    expect(message.match(/1× reason for ord-/g)).toHaveLength(5);
    expect(message).toContain("+2 more reason(s)");
  });

  it("W3: unexpected failures are logged as errors and do not abort the run", async () => {
    const { worker, orders, logger } = createWorker();
    orders.prisma.order.findMany.mockResolvedValue([
      { id: "ord-1", code: "ORD-1" },
      { id: "ord-2", code: "ORD-2" },
    ]);
    orders.orderAction
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce({ id: "ord-2" });

    await worker.run();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Automatic order close failed for order ORD-1: connection reset"),
      expect.anything(),
    );
    expect(orders.orderAction).toHaveBeenCalledTimes(2);
    expect(logger.log).toHaveBeenCalledWith("Automatic order closure: 1/2 closed");
  });

  it("W4: candidate query failure is warned once and ends the run", async () => {
    const { worker, orders, logger } = createWorker();
    orders.prisma.order.findMany.mockRejectedValue(new Error("db down"));

    await expect(worker.run()).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith("Automatic order closure skipped: db down");
    expect(orders.orderAction).not.toHaveBeenCalled();
  });

  it("W5: empty candidate set produces no log noise", async () => {
    const { worker, logger } = createWorker();

    await worker.run();

    expect(logger.log).not.toHaveBeenCalled();
  });

  it("W6: candidates are selected oldest-first (deterministic batch)", async () => {
    const { worker, orders } = createWorker();

    await worker.run();

    expect(orders.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "asc" }, take: 500 }),
    );
  });
});
