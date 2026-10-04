import { OutboxWorkerService } from "./outbox-worker.service";

/**
 * Lifecycle воркера (устранённый баг из M3-gate диагностики):
 * «Transaction not found … obtained before disconnecting» возникал, потому что
 * PrismaService делает $disconnect в onModuleDestroy, а воркер останавливался
 * только в onApplicationShutdown — таймер успевал выстрелить между хуками.
 * Это САМОСТОЯТЕЛЬНЫЙ lifecycle-баг (воспроизводится в одиночном seed-прогоне
 * на чистой БД; dev/two-instance ни при чём — межинстансовую сериализацию
 * закрывает pg advisory lock, см. T-A в outbox-durable-worker.e2e-spec).
 */
describe("OutboxWorkerService (lifecycle)", () => {
  let prisma: { $transaction: jest.Mock };
  let tx: { $queryRaw: jest.Mock };
  let eventBus: { retryFailed: jest.Mock; publishPending: jest.Mock };
  let worker: OutboxWorkerService;
  let errorSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    tx = { $queryRaw: jest.fn().mockResolvedValue([{ locked: true }]) };
    prisma = {
      $transaction: jest.fn().mockImplementation((cb: (t: unknown) => unknown) => cb(tx)),
    };
    eventBus = {
      retryFailed: jest.fn().mockResolvedValue(0),
      publishPending: jest.fn().mockResolvedValue(0),
    };
    worker = new OutboxWorkerService(prisma as never, eventBus as never);
    const logger = (worker as unknown as { logger: { log: (...a: unknown[]) => void; error: (...a: unknown[]) => void } }).logger;
    logSpy = jest.spyOn(logger, "log").mockImplementation(() => undefined);
    errorSpy = jest.spyOn(logger, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("runCycle: lock взят → flip под lock (tx передаётся retryFailed), publishPending ВНЕ tx", async () => {
    const res = await worker.runCycle();
    expect(res).toEqual({ retried: 0, published: 0, lockAcquired: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(eventBus.retryFailed).toHaveBeenCalledTimes(1);
    expect(eventBus.retryFailed.mock.calls[0][2]).toBe(tx);
    expect(eventBus.publishPending).toHaveBeenCalledTimes(1);
    // publishPending вызывается после закрытия lock-транзакции (не внутри).
    expect(prisma.$transaction.mock.invocationCallOrder[0]).toBeLessThan(
      eventBus.publishPending.mock.invocationCallOrder[0],
    );
  });

  it("runCycle: конкурент не взял advisory lock → без publishPending", async () => {
    tx.$queryRaw.mockResolvedValue([{ locked: false }]);
    const res = await worker.runCycle();
    expect(res).toEqual({ retried: 0, published: 0, lockAcquired: false });
    expect(eventBus.retryFailed).not.toHaveBeenCalled();
    expect(eventBus.publishPending).not.toHaveBeenCalled();
  });

  it("stop: после onModuleDestroy (хук $disconnect) циклы не планируются", async () => {
    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    await worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("stop идемпотентен: повторный onApplicationShutdown не бросает и не планирует", async () => {
    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    await worker.onApplicationShutdown();
    await worker.onApplicationShutdown();
    await worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("disconnect-race («Transaction not found … before disconnecting») → штатная остановка: без error-лога, без ретраев", async () => {
    prisma.$transaction.mockRejectedValue(
      new Error(
        "Transaction API error: Transaction not found. Transaction ID is invalid, refers to an old closed transaction Prisma doesn't have information about anymore, or was obtained before disconnecting.",
      ),
    );
    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("outbox worker stopped (prisma disconnected)"));

    await jest.advanceTimersByTimeAsync(60_000);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1); // не перепланирован
  });

  it("обычная ошибка цикла → error-лог и ретрай через интервал (worker живёт)", async () => {
    prisma.$transaction.mockRejectedValueOnce(new Error("boom db"));
    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("outbox worker cycle failed: boom db"));

    await jest.advanceTimersByTimeAsync(500);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining("outbox worker stopped"));
  });
});
