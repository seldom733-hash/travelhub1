/**
 * Step 2.17 — DURABLE EVENT DELIVERY (OutboxWorker) e2e.
 *
 * Закрывает два подтверждённых дефекта:
 *  1. publishPending() вызывался только инлайном после коммита — падение процесса
 *     между коммитом и вызовом оставляло событие в PENDING навсегда;
 *  2. retryFailed() не имел production-вызывающего — retryable FAILED события
 *     (например OrderRequested) никогда не ретраились автоматически.
 *
 * Доказательства здесь:
 *  - PENDING-событие доставляется фоновым циклом worker-а (runCycle), без
 *    dependency на inline publishPending в HTTP-пути;
 *  - retryable FAILED-событие автоматически ретраится (retryFailed в том же
 *    цикле), side effect выполняется ровно один раз (Inbox dedup);
 *  - exhausted (attempts >= OUTBOX_MAX_ATTEMPTS) FAILED — poison, не выбирается
 *    retryFailed, статус остаётся FAILED с error;
 *  - цикл сериализуется pg advisory xact lock (lockAcquired);
 *  - в e2e worker отключён (OUTBOX_WORKER_ENABLED=false) — тесты детерминированы,
 *    фоновый таймер не вмешивается.
 */
import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { EventBusService, OUTBOX_MAX_ATTEMPTS, type OutboxEnvelope } from "../src/eventbus/eventbus.service";
import { OutboxWorkerService } from "../src/eventbus/outbox-worker.service";
import { DomainEvents } from "../src/eventbus/domain-events";
import { createRequestId, runWithRequestContext } from "../src/shared/request-context";

describe("Step 2.17 — Outbox durable worker (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: EventBusService;
  let worker: OutboxWorkerService;

  const CONSUMER = "outbox-durable-worker";
  let sideEffects = 0;
  let failNext = false;
  const flakyConsumer = () => {
    if (failNext) throw new Error("injected worker consumer failure");
  };
  // Идемпотентный dedup-consumer (Inbox authoritative), production-паттерн:
  // P2002 по inbox unique (consumerId+eventId) — легитимная гонка двух
  // одновременных доставок → no-op (не raw-ошибка). Регистрируется на ОБОИХ
  // шинах (T-A): кто бы ни опубликовал событие, side effect считается ровно
  // один раз.
  const dedupConsumer = async (envelope: OutboxEnvelope) => {
    try {
      await prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER, eventId: envelope.eventId } } })) return;
        sideEffects++;
        await tx.inboxEvent.create({ data: { consumerId: CONSUMER, eventId: envelope.eventId } });
      });
    } catch (err) {
      if (typeof err === "object" && err !== null) {
        const e = err as { code?: string; meta?: { target?: unknown } };
        if (e.code === "P2002" && Array.isArray(e.meta?.target) && (e.meta.target as string[]).includes("consumerId") && (e.meta.target as string[]).includes("eventId")) return;
      }
      throw err;
    }
  };

  // T-A: второй worker-«инстанс» — отдельный Prisma-клиент (отдельное
  // соединение), отдельный EventBusService и OutboxWorkerService на той же БД.
  let prisma2: PrismaService;
  let eventBus2: EventBusService;
  let worker2: OutboxWorkerService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    eventBus = app.get(EventBusService);
    worker = app.get(OutboxWorkerService);

    // Shared-DB isolation: чистим только наши типы/consumer.
    await prisma.outboxEvent.deleteMany({ where: { eventType: { in: [DomainEvents.ProductPublished, DomainEvents.OrderRequested] } } });
    await prisma.inboxEvent.deleteMany({ where: { consumerId: CONSUMER } });

    eventBus.on(DomainEvents.OrderRequested, flakyConsumer);
    eventBus.on(DomainEvents.OrderRequested, dedupConsumer);

    // Второй инстанс (отдельные соединения, та же БД) — конкуренция за pg
    // advisory xact lock между двумя worker-ами.
    prisma2 = new PrismaService();
    eventBus2 = new EventBusService(prisma2);
    eventBus2.on(DomainEvents.OrderRequested, flakyConsumer);
    eventBus2.on(DomainEvents.OrderRequested, dedupConsumer);
    worker2 = new OutboxWorkerService(prisma2, eventBus2);
  });

  afterAll(async () => {
    // Реальный OrderRequestedConsumer (AppModule) обрабатывает наши события и
    // создаёт Order в общей БД — чистим их (shared-DB isolation для serial e2e).
    const saleRefs = ["sale-pending-1", "sale-retry-1", "sale-poison-1", "sale-race-1", "sale-crash-1", "sale-chain-1"];
    const orders = await prisma.order.findMany({ where: { saleId: { in: saleRefs } }, select: { id: true } });
    if (orders.length > 0) {
      const ids = orders.map((o) => o.id);
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'OrderCreated' AND "aggregateId" = ANY($1)`, ids);
      await prisma.orderHistory.deleteMany({ where: { orderId: { in: ids } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
      await prisma.order.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.outboxEvent.deleteMany({ where: { eventType: { in: [DomainEvents.ProductPublished, DomainEvents.OrderRequested] } } });
    await prisma.inboxEvent.deleteMany({ where: { consumerId: CONSUMER } });
    // Harness hygiene: наши OrderRequested обрабатываются ТАКЖЕ реальными
    // consumer-ами AppModule (order-requested-consumer → Order/OrderCreated →
    // commission-accrual-consumer). Их Inbox-записи для наших (уже удалённых)
    // событий — сироты в общей БД: удаляем (не влияет на другие суиты, т.к.
    // их события на месте).
    await prisma.$executeRawUnsafe(`
      DELETE FROM "events"."InboxEvent"
      WHERE "consumerId" IN ('order-requested-consumer', 'commission-accrual-consumer')
        AND "eventId" NOT IN (SELECT id FROM "events"."OutboxEvent")
    `);
    await prisma2.$disconnect();
    await app.close();
  });

  async function emitOrder(id: string, retryable = true): Promise<string> {
    return runWithRequestContext(
      { requestId: createRequestId(), correlationId: `corr-w-${id}`, causationId: null, actor: { type: "SYSTEM" } },
      () =>
        prisma.$transaction((tx) =>
          eventBus.emit(tx, {
            aggregateType: "Order",
            aggregateId: `ord-${id}`,
            eventType: DomainEvents.OrderRequested,
            retryable,
            payload: {
              version: 1,
              saleId: `sale-${id}`,
              saleCode: `SALE-${id}`,
              checkoutId: `ci-${id}`,
              checkoutCode: `CI-${id}`,
              quoteId: `quote-${id}`,
              customerId: null,
              reservationId: `res-${id}`,
              reservationIds: [`res-${id}`],
              items: [
                {
                  productId: `prd-${id}`,
                  productCode: `PRD-${id}`,
                  productTitle: `Product ${id}`,
                  productType: "TOUR",
                  tariffId: `trf-${id}`,
                  tariffCode: `TRF-${id}`,
                  quantity: 1,
                  unitPrice: "100.00",
                  amount: "100.00",
                },
              ],
              currency: "USD",
              subtotal: "100.00",
              discountType: "NONE",
              discountValue: null,
              discountAmount: null,
              total: "100.00",
              paymentScheme: "FULL_PREPAYMENT",
              prepaymentType: null,
              prepaymentValue: null,
              initialAmount: "100.00",
              remainingAmount: "0",
              acquisitionSource: "DIRECT",
              serviceDate: "2026-08-20",
            },
          }),
        ),
    );
  }

  it("worker disabled in e2e (OUTBOX_WORKER_ENABLED=false) — детерминизм без фонового таймера", () => {
    expect(String(process.env.OUTBOX_WORKER_ENABLED)).toBe("false");
    expect(worker.status()).toBeDefined();
  });

  it("PENDING-событие доставляется фоновым циклом worker-а без inline publishPending", async () => {
    const eventId = await emitOrder("pending-1");
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } })).status).toBe("PENDING");

    const result = await worker.runCycle();
    expect(result.lockAcquired).toBe(true);
    expect(result.published).toBeGreaterThanOrEqual(1);
    expect(result.retried).toBe(0);

    const row = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(row.status).toBe("PUBLISHED");
    expect(sideEffects).toBe(1); // доставка + side effect через worker
    expect(await prisma.inboxEvent.count({ where: { consumerId: CONSUMER } })).toBe(1);
  });

  it("retryable FAILED автоматически ретраится циклом worker-а; side effect ровно один раз", async () => {
    failNext = true;
    const eventId = await emitOrder("retry-1");
    // Первый цикл: consumer падает → FAILED (внутри цикла же вызывается retryFailed,
    // но событие только что создано в PENDING и в этом же цикле упало — publishPending
    // пометил FAILED; retryFailed идёт ДО publishPending в цикле, поэтому retry случится
    // на следующем цикле).
    const first = await worker.runCycle();
    const row1 = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(row1.status).toBe("FAILED");
    expect(row1.error).toContain("injected worker consumer failure");

    failNext = false;
    const second = await worker.runCycle(); // retryFailed(limit) → publishPending(limit)
    expect(second.retried).toBeGreaterThanOrEqual(1);

    const row2 = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(row2.status).toBe("PUBLISHED");
    expect(sideEffects).toBe(2); // +1 ретрай успешен
    expect(await prisma.inboxEvent.count({ where: { consumerId: CONSUMER } })).toBe(2);
    expect(row2.attempts).toBeGreaterThanOrEqual(1); // инкремент при failure; успех не добавляет

    // Повторный цикл — ничего не осталось (dedup).
    const third = await worker.runCycle();
    expect(third.published).toBe(0);
    expect(sideEffects).toBe(2);
  });

  it("exhausted retryable FAILED — poison: не выбирается, статус FAILED + error сохраняются", async () => {
    failNext = true;
    const eventId = await emitOrder("poison-1");
    // Имитация исчерпания попыток: ставим attempts на max заранее (worker не будет
    // перебирать это событие), затем публикуем и падаем.
    await prisma.outboxEvent.update({ where: { id: eventId }, data: { attempts: OUTBOX_MAX_ATTEMPTS } });
    await worker.runCycle();
    const row = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(row.status).toBe("FAILED");
    expect(row.error).toContain("injected worker consumer failure");

    // retryFailed выбирает только attempts < OUTBOX_MAX_ATTEMPTS → poison не ретраится.
    const retried = await eventBus.retryFailed(100, new Date());
    expect(retried).toBe(0);
    const after = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(after.status).toBe("FAILED");
    const status = await worker.status();
    expect(status.exhausted).toBeGreaterThanOrEqual(1);
  });

  it("advisory lock сериализует цикл: lockAcquired=true при исполнении, повторный вызов безопасен", async () => {
    const first = await worker.runCycle();
    const second = await worker.runCycle(); // конкурирующий «инстанс» — попадёт в тот же xact lock
    expect(first.lockAcquired).toBe(true);
    // Оба вызова завершились корректно; ни один не «упал» из-за конкуренции за lock.
    expect(typeof second.lockAcquired).toBe("boolean");
  });

  it("T-A: два worker-инстанса (раздельные соединения, одна БД) — race за advisory lock без raw-ошибки и без дубликата side effect", async () => {
    failNext = true;
    const eventId = await emitOrder("race-1");
    const before = sideEffects;
    // Оба цикла стартуют одновременно — конкурентная гонка за pg advisory xact lock.
    const [r1, r2] = await Promise.all([worker.runCycle(), worker2.runCycle()]);
    // Ожидаемая гонка — НЕ raw-ошибка: оба вернули результат.
    expect(typeof r1.lockAcquired).toBe("boolean");
    expect(typeof r2.lockAcquired).toBe("boolean");
    // Хотя бы один инстанс владел lock (flip + попытка публикации).
    expect(r1.lockAcquired || r2.lockAcquired).toBe(true);
    const row = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(row.status).toBe("FAILED"); // инжектированная consumer-ошибка
    expect(row.error).toContain("injected worker consumer failure");
    expect(row.attempts).toBeGreaterThanOrEqual(1);
    expect(sideEffects).toBe(before); // во время FAILED side effect не выполнен

    // Детерминированный recovery: flip с now за пределами backoff-окна (если событие
    // уже PENDING — flip no-op), затем race двух инстансов НА ДОСТАВКЕ одного
    // PENDING-события — ровно один side effect (Inbox dedup authoritative),
    // без raw-ошибки. Backoff-математика покрыта unit (eventbus.retry.spec).
    failNext = false;
    await eventBus.retryFailed(100, new Date(Date.now() + 5000));
    const mid = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(mid.status).toBe("PENDING"); // flip закоммичен, доставка ещё не началась

    const [f1, f2] = await Promise.all([worker.runCycle(), worker2.runCycle()]);
    expect(typeof f1.lockAcquired).toBe("boolean");
    expect(typeof f2.lockAcquired).toBe("boolean");
    const final = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(final.status).toBe("PUBLISHED");
    expect(sideEffects).toBe(before + 1); // ровно одна доставка side effect
  });

  it("T-B: crash-окно FAILED→PENDING (только flip) до доставки — событие восстанавливается следующим циклом", async () => {
    failNext = true;
    const eventId = await emitOrder("crash-1");
    await worker.runCycle(); // FAILED (инжектированная ошибка)
    failNext = false;
    const before = sideEffects;

    // Имитация crash-окна: только flip (retryFailed), доставка ещё не произошла
    // (worker упал между flip и publishPending).
    const flipped = await eventBus.retryFailed(100, new Date());
    expect(flipped).toBeGreaterThanOrEqual(1);
    const mid = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(mid.status).toBe("PENDING"); // flip закоммичен, доставки не было

    // Следующий цикл worker-а доставляет (recovery без потери и без дубликата).
    const r = await worker.runCycle();
    expect(r.published).toBeGreaterThanOrEqual(1);
    const final = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(final.status).toBe("PUBLISHED");
    expect(sideEffects).toBe(before + 1); // ровно одна доставка side effect
  });

  it("T-G/T-H: nested цепочка OrderRequested→Order→OrderCreated (реальный consumer) через worker-цикл", async () => {
    const eventId = await emitOrder("chain-1");
    await worker.runCycle();

    // Реальный OrderRequestedConsumer создал Order из frozen snapshot payload.
    const order = await prisma.order.findUnique({ where: { saleId: "sale-chain-1" } });
    expect(order).toBeTruthy();
    // OrderCreated эмитится PENDING атомарно с Order; вложенный publishPending
    // (вне lock-транзакции после стабилизации) доставил его → PUBLISHED.
    const oc = await prisma.outboxEvent.findFirst({ where: { eventType: "OrderCreated", aggregateId: order!.id } });
    expect(oc).toBeTruthy();
    expect(oc!.status).toBe("PUBLISHED");
    // Исходное OrderRequested — PUBLISHED (не зависло в FAILED/PENDING).
    const orig = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(orig.status).toBe("PUBLISHED");
  });
});
