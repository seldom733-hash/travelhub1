/**
 * STRICT REVIEW Step 1.18 — FAILURE INJECTION: FAILED Outbox path (§17/§18).
 *
 * Цель — независимо доказать фактический failure mode Outbox:
 *  1. consumer exception → OutboxEvent.status = FAILED, error сохраняется;
 *  2. факт durable: событие записано атомарно с business transition (emit в tx),
 *     при падении consumer-а строка остаётся FAILED — факт НЕ теряется;
 *  3. Inbox НЕ пишется при падении consumer-а (side effect откачен);
 *  4. recovery = документированный manual flip status → PENDING + повторный
 *     publishPending → доставка успешна, side effect ровно один раз;
 *  5. повторная доставка не создаёт duplicate (Inbox dedup);
 *  6. correlation/causation сохраняются при retry.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { EventBusService } from "../src/eventbus/eventbus.service";
import { DomainEvents } from "../src/eventbus/domain-events";
import { createRequestId, runWithRequestContext } from "../src/shared/request-context";

describe("Step 1.18 — Outbox FAILED failure-injection (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: EventBusService;

  /** Управляемый «flaky» consumer: бросает только пока failNext=true. */
  let failNext = true;
  const flakyConsumer = () => {
    if (failNext) throw new Error("injected consumer failure");
  };

  const CONSUMER = "outbox-fi-recovery";
  let sideEffects = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    eventBus = app.get(EventBusService);

    // flaky consumer (сначала падает), затем идемпотентный recovery consumer.
    eventBus.on(DomainEvents.ProductPublished, flakyConsumer);
    eventBus.on(DomainEvents.ProductPublished, async (envelope) => {
      if (await eventBus.isProcessed(CONSUMER, envelope.eventId)) return;
      await prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER, eventId: envelope.eventId } } })) return;
        sideEffects++;
        await tx.inboxEvent.create({ data: { consumerId: CONSUMER, eventId: envelope.eventId } });
      });
    });
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { eventType: DomainEvents.ProductPublished } });
    await prisma.inboxEvent.deleteMany({ where: { consumerId: CONSUMER } });
    await app.close();
  });

  it("consumer exception → FAILED + error, факт durable, Inbox пуст, auto-retry отсутствует", async () => {
    failNext = true;
    const eventId = await runWithRequestContext(
      { requestId: createRequestId(), correlationId: "corr-fi-1", causationId: null, actor: { type: "USER", id: "u1" } },
      async () =>
        prisma.$transaction((tx) =>
          eventBus.emit(tx, {
            aggregateType: "Product",
            aggregateId: "agg-fi-1",
            eventType: DomainEvents.ProductPublished,
            payload: { productId: "agg-fi-1", code: "PRD-FI-1", title: "FI", type: "TOUR" },
          }),
        ),
    );
    expect(eventId).toBeTruthy();

    expect(await eventBus.publishPending()).toBe(0); // consumer упал

    const row = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(row.status).toBe("FAILED");
    expect(row.error).toContain("injected consumer failure");
    expect(row.correlationId).toBe("corr-fi-1"); // correlation durable
    expect(await prisma.inboxEvent.count({ where: { consumerId: CONSUMER } })).toBe(0); // side effect откачен

    // publishPending повторно НЕ выбирает FAILED — автоматического retry нет (это и есть заявленный debt).
    expect(await eventBus.publishPending()).toBe(0);
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } })).status).toBe("FAILED");
  });

  it("manual recovery (flip→PENDING) → доставка успешна, side effect ровно один раз, дубликатов нет", async () => {
    failNext = true;
    const eventId = await runWithRequestContext(
      { requestId: createRequestId(), correlationId: "corr-fi-2", causationId: null, actor: { type: "SYSTEM" } },
      () =>
        prisma.$transaction((tx) =>
          eventBus.emit(tx, {
            aggregateType: "Product",
            aggregateId: "agg-fi-2",
            eventType: DomainEvents.ProductPublished,
            payload: { productId: "agg-fi-2", code: "PRD-FI-2", title: "FI2", type: "TOUR" },
          }),
        ),
    );
    await eventBus.publishPending();
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } })).status).toBe("FAILED");

    // Recovery: consumer больше не падает, flip → PENDING, повторная публикация.
    failNext = false;
    await prisma.outboxEvent.update({ where: { id: eventId }, data: { status: "PENDING", error: null } });
    expect(await eventBus.publishPending()).toBe(1);

    const recovered = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(recovered.status).toBe("PUBLISHED");
    // correlation сохранён через failure + recovery (не переписан, не потерян).
    expect(recovered.correlationId).toBe("corr-fi-2");
    expect(sideEffects).toBe(1); // ровно один раз
    expect(await prisma.inboxEvent.count({ where: { consumerId: CONSUMER } })).toBe(1);

    // Повторный publishPending — ничего (status PUBLISHED + Inbox dedup).
    expect(await eventBus.publishPending()).toBe(0);
    expect(sideEffects).toBe(1);
    expect(await prisma.inboxEvent.count({ where: { consumerId: CONSUMER } })).toBe(1);
  });
});
