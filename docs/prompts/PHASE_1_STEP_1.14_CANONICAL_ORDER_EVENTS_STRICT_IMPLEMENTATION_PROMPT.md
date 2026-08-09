# PHASE 1 --- STEP 1.14: CANONICAL ORDER EVENTS --- STRICT IMPLEMENTATION PROMPT

## 0. Режим выполнения

Выполни **только PHASE 1 --- STEP 1.14 --- Canonical Order Events**
проекта TravelHub.

Это production implementation pass, а не архитектурный brainstorm.

Канонический Master Plan:
`TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`.

Step 1.14 должен реализовать канонические Order business events:

-   `OrderReadyForBooking`
-   `OrderFulfilled`
-   `OrderClosed`

и выполнить cleanup/deprecation generic `OrderStatusChanged` **только
там, где он подменяет канонические события**.

Не переходи к Step 1.15, 1.15A, 1.16 или Phase 2.

Не расширяй Step 1.14 будущими Order lifecycle/temporal задачами из
Phase 2.

------------------------------------------------------------------------

# 1. Цель

После Step 1.14 downstream consumer должен получать **семантическое
бизнес-событие**, а не пытаться угадывать смысл перехода Order из
generic `OrderStatusChanged`.

Требуется привести существующий Order event contract к модели:

> business fact → canonical event → durable outbox → idempotent
> downstream processing

при сохранении текущего ownership Order domain и существующего рабочего
lifecycle.

Step 1.14 **не должен создавать новый Order lifecycle**.

------------------------------------------------------------------------

# 2. Перед изменениями --- обязательный фактический аудит

Сначала исследуй реальный repository.

Найди:

-   Prisma Order models;
-   OrderItem;
-   OrderHistory;
-   существующие Order status/payment status enums;
-   Order service/controller/module;
-   все команды/методы, меняющие Order status;
-   `/orders/bootstrap`, если ещё существует;
-   все producers Order events;
-   все consumers Order events;
-   `OutboxEvent`;
-   `InboxEvent`;
-   outbox publisher/worker;
-   generic `OrderStatusChanged`;
-   `OrderCreated`;
-   `OrderRequested`;
-   `BookingRequested`;
-   существующие Booking consumers;
-   все тесты Order/Booking/outbox;
-   Buyer Cabinet Order read model;
-   audit/history logic;
-   ADR, связанные с domain ownership/events.

Построй Current → Target mapping.

**Не считай предыдущие отчёты доказательством реализации. Проверяй
код.**

------------------------------------------------------------------------

# 3. Domain ownership

Order domain остаётся владельцем:

-   Order;
-   OrderItem;
-   OrderTraveler;
-   OrderFulfillment, если существует;
-   OrderHistory;
-   Order lifecycle transitions.

Другие bounded contexts не должны напрямую писать в Order tables.

Step 1.14 не разрешает:

-   Booking писать Order status напрямую;
-   Sales писать Order напрямую;
-   Finance писать Order напрямую;
-   Catalog писать Order напрямую.

Cross-domain изменение должно происходить через уже разрешённый
event/orchestration contract.

Если текущий код нарушает это правило, зафиксируй проблему. Исправляй её
в Step 1.14 только если она непосредственно необходима для корректности
canonical Order events и не требует проектирования будущего Phase 2
flow.

------------------------------------------------------------------------

# 4. Canonical event semantics

## 4.1 OrderReadyForBooking

Событие означает:

> Order достиг **реального существующего** состояния, в котором Booking
> domain разрешено начать booking processing.

Нельзя вводить новый status только ради события.

Найди фактический текущий transition, который уже означает эту
бизнес-семантику.

Событие должно публиковаться **ровно при этом реальном переходе**.

Не публиковать его:

-   при простом PATCH;
-   при повторном чтении;
-   при unrelated update;
-   при переходе, который ещё не означает готовность к booking;
-   только потому, что Order существует.

Если существующая архитектура уже публикует `BookingRequested` в том же
месте, исследуй семантику.

Не создавай два конкурирующих события с одинаковым смыслом без явного
решения.

Определи и документируй:

-   является ли `OrderReadyForBooking` upstream business fact;
-   является ли `BookingRequested` отдельной command/request semantics;
-   или текущий `BookingRequested` фактически уже подменяет
    `OrderReadyForBooking`.

Если это невозможно определить из существующего lifecycle без изменения
бизнес-модели:

`ARCHITECTURE DECISION REQUIRED`

и не выдумывай transition.

------------------------------------------------------------------------

## 4.2 OrderFulfilled

Означает:

> обязательства по Order фактически выполнены согласно существующему
> Order lifecycle.

Публикуется только при реальном transition в уже существующее
fulfilled/completed состояние, которое действительно имеет эту
семантику.

Не выводить fulfillment:

-   из `updatedAt`;
-   из serviceDate;
-   из Booking status без существующего Order transition;
-   из Payment status;
-   из frontend действия без authoritative backend transition.

Повторный/idempotent вызов не должен создавать второй logical
`OrderFulfilled`.

------------------------------------------------------------------------

## 4.3 OrderClosed

Означает:

> Order окончательно закрыт согласно существующему lifecycle.

Не смешивать:

-   fulfilled;
-   cancelled;
-   rejected;
-   archived;
-   closed,

если существующая модель различает эти состояния.

`OrderClosed` публикуется только при фактическом canonical close
transition.

Если текущий Order lifecycle не имеет отдельного понятия CLOSED и
закрытие пока относится к будущему Step 2.7, **не придумывай CLOSED
status**.

В таком случае зафиксируй gap и не публикуй ложное событие.

------------------------------------------------------------------------

# 5. Generic OrderStatusChanged audit

Найди **каждое** место, где создаётся или потребляется:

`OrderStatusChanged`

Для каждого использования классифицируй:

### A. Generic event подменяет известный canonical business fact

Например, consumer проверяет:

`status === X`

и фактически интерпретирует это как ReadyForBooking/Fulfilled/Closed.

Такое использование должно быть мигрировано на canonical event, если
semantics доказана.

### B. Generic event используется как техническая/историческая notification

Если consumer действительно нужен любой status transition и это не
подмена business fact, не удаляй событие автоматически.

### C. Dead/unused

Удалить или deprecate безопасно после доказательства отсутствия
consumers.

Не делай глобальный blind-delete `OrderStatusChanged`.

------------------------------------------------------------------------

# 6. Event publication atomicity

Canonical Order event должен быть создан **атомарно с Order
transition**.

Предпочтительный контракт:

`Order mutation + OrderHistory + OutboxEvent`

в одной DB transaction.

Недопустимо:

1.  изменить Order;
2.  commit;
3.  потом отдельно попытаться создать event.

При падении transaction:

-   Order transition не должен сохраниться без обязательного event;
-   event не должен существовать без соответствующего Order
    state/history.

Проверь реальную outbox architecture и используй существующий механизм.

Не создавай второй outbox.

------------------------------------------------------------------------

# 7. Event identity и deduplication

Каждый logical business event должен иметь стабильный уникальный
`eventId` согласно существующей outbox модели.

Retry transition / concurrent request / duplicate command не должны
приводить к нескольким logical canonical events одного перехода.

Проверь:

-   optimistic concurrency;
-   CAS/updateMany;
-   transaction isolation;
-   unique constraints;
-   existing idempotency;
-   InboxEvent consumer dedup.

Если consumer получает event повторно, duplicate delivery не должен
создавать duplicate business effect.

------------------------------------------------------------------------

# 8. Event payload

Используй минимальный canonical payload.

Не сериализуй raw Prisma Order.

Минимально допустимые поля определяй по реальному существующему event
contract, но payload должен содержать только то, что необходимо
downstream consumer.

Предпочтительно:

-   `orderId`
-   stable Order code/number, если реально требуется
-   relevant canonical entity references
-   business status/state после transition, если это часть существующего
    контракта

Не включать без необходимости:

-   Customer PII;
-   email;
-   phone;
-   CRM notes;
-   Partner private data;
-   raw traveler data;
-   payment secrets;
-   internal ORM object;
-   arbitrary JSON dump.

------------------------------------------------------------------------

# 9. Temporal semantics

Step 1.13A уже установил temporal discipline.

Canonical events должны иметь честное event time.

Используй существующий outbox/event timestamp contract.

`occurredAt` означает фактическое время business transition.

Не использовать:

-   `updatedAt` как surrogate;
-   `serviceDate` как время event;
-   consumer processing time как business occurrence time.

Не добавляй сейчас Phase 2 Order temporal columns:

-   `submittedAt`;
-   `confirmedAt`;
-   `cancelledAt`;
-   `fulfilledAt`;
-   `closedAt`;

если они отсутствуют.

Они относятся к **Step 2.5A / Step 2.7**, кроме случая, когда без
минимального additive fix невозможно честно выполнить уже существующий
lifecycle. В таком случае сначала оцени архитектурную границу.

------------------------------------------------------------------------

# 10. Step 1.15 boundary --- correlation НЕ внедрять преждевременно

Следующий canonical Step:

**1.15 --- Correlation / Request ID Infrastructure**

Поэтому Step 1.14 не должен самостоятельно строить глобальную
request/correlation infrastructure.

Не добавляй массово:

-   requestId middleware;
-   correlationId;
-   causationId;
-   trace propagation;

если этого ещё нет.

Если существующий event envelope уже имеет такие поля --- сохрани их.

Если нет --- не придумывай частный несовместимый механизм только для
Order.

В отчёте явно укажи:

`Correlation/causation enrichment deferred to Step 1.15/1.15A.`

------------------------------------------------------------------------

# 11. Step 1.15A boundary --- не переделывать глобальный event envelope

Не выполняй сейчас массовую стандартизацию всех business events.

Step 1.15A отдельно определит общий envelope:

-   eventId;
-   eventType;
-   occurredAt;
-   correlationId;
-   causationId;
-   actor/system actor;
-   entityId;
-   source/channel;
-   version/metadata.

Step 1.14 должен быть **forward-compatible**, но не должен поглощать
Step 1.15A.

------------------------------------------------------------------------

# 12. Publication vs acquisition

Не смешивай canonical Order events с behavioral acquisition tracking.

Marketplace/Storefront behavioral events уже существуют отдельно.

Если Order сейчас не имеет immutable acquisition context --- не угадывай
его:

-   по ProductPublicationChannel;
-   по текущему Storefront status;
-   по URL;
-   по наличию storefront;
-   по behavioral event задним числом.

Полная propagation acquisition context относится к Step 2.5B.

Canonical Order event не должен фабриковать
`MARKETPLACE`/`PARTNER_STOREFRONT`.

------------------------------------------------------------------------

# 13. OrderHistory

Проверь существующий `OrderHistory`.

Каждый реальный Order transition, который создаёт canonical event,
должен сохранять существующую history semantics.

Canonical event **не заменяет OrderHistory**.

Разделение:

-   Order current state = текущее состояние;
-   OrderHistory = immutable domain chronology;
-   Outbox canonical event = междоменный business fact;
-   AuditLog = security/administrative audit, если применимо.

Не смешивать эти роли.

------------------------------------------------------------------------

# 14. Actor semantics

Если текущий transition знает actor --- не теряй его в history/audit.

Но не расширяй event payload PII.

Для system transition используй существующую system actor convention,
если она есть.

Не придумывай новый глобальный actor contract --- это также будет
уточняться общим event envelope.

------------------------------------------------------------------------

# 15. Booking integration

Это критическая часть review.

Проверь существующие связи Order → Booking.

Если Booking creation/processing сейчас запускается generic:

`OrderStatusChanged`

то после доказательства semantics переведи consumer на canonical
событие.

Если используется `BookingRequested`, не ломай его автоматически.

Нужно определить реальную цепочку.

Возможные допустимые результаты:

### Вариант 1

`Order transition → OrderReadyForBooking → consumer/orchestrator → BookingRequested → Booking`

если это соответствует существующей architecture.

### Вариант 2

`Order transition → BookingRequested → Booking`

а `OrderReadyForBooking` является отдельным fact event для других
consumers.

### Вариант 3

Текущий lifecycle не позволяет честно разделить semantics.

Тогда:

`ARCHITECTURE DECISION REQUIRED`

Нельзя создавать искусственную цепочку только ради названий событий.

------------------------------------------------------------------------

# 16. Buyer Cabinet regression

Step 1.13 Buyer Cabinet читает own Orders/Bookings.

После изменений:

-   projection не должна измениться без необходимости;
-   BUYER own-scope не ослабляется;
-   IDOR protection сохраняется;
-   internal event fields не попадают в Buyer API;
-   новые event names не должны менять пользовательские статусы.

------------------------------------------------------------------------

# 17. Marketplace / Storefront regression

Step 1.14 не должен менять:

-   Catalog Product lifecycle;
-   Product publication channels;
-   Storefront entitlement;
-   seller identity;
-   Marketplace public DTO;
-   behavioral events;
-   Storefront behavioral events.

Проверь regression suites.

------------------------------------------------------------------------

# 18. RBAC / security

Canonical event publication --- backend domain behavior, а не новое
пользовательское permission.

Не создавай permission вида `order.emit_event`.

Проверь существующие Order mutation permissions.

Нельзя расширять BUYER/PARTNER права ради Step 1.14.

IDOR/object scope должен остаться backend-enforced.

------------------------------------------------------------------------

# 19. Concurrency scenarios

Обязательно проверить:

1.  два concurrent запроса на один transition;
2.  повторный idempotent transition;
3.  transition уже выполнен;
4.  transaction rollback;
5.  duplicate outbox delivery;
6.  consumer retry.

Доказать, что canonical event не создаётся дважды как два business
facts.

Если текущий lifecycle сам не concurrency-safe --- исправить минимально
в рамках затронутого transition либо зафиксировать REVIEW FIX REQUIRED,
если проблема блокирует correctness Step 1.14.

------------------------------------------------------------------------

# 20. Migrations

Предпочтительно Step 1.14 не требует schema migration, если существующий
OutboxEvent достаточно универсален.

Если migration действительно нужна:

-   только additive/minimal;
-   no guessed historical backfill;
-   no destructive migration;
-   no `db push`;
-   clean replay;
-   migration status;
-   drift check.

Не добавлять отдельные таблицы только для трёх событий, если
существующий Outbox уже является canonical transport.

------------------------------------------------------------------------

# 21. Required automated tests

Добавь/обнови unit/e2e tests, которые доказывают фактическую семантику.

Минимум:

### OrderReadyForBooking

-   не публикуется до соответствующего transition;
-   публикуется ровно один раз при transition;
-   retry не создаёт второй logical event;
-   payload whitelist;
-   OrderHistory соответствует transition.

### OrderFulfilled

-   публикуется только при реальном fulfillment transition;
-   unrelated update не публикует;
-   retry/idempotency;
-   chronology/event time корректны.

### OrderClosed

Если реальный close transition существует:

-   event только на close;
-   fulfilled ≠ closed;
-   cancelled ≠ closed, если domain различает;
-   duplicate transition не дублирует event.

Если close transition **не существует**:

-   automated proof, что ложный `OrderClosed` нигде не публикуется;
-   gap документирован для Step 2.7.

### Generic OrderStatusChanged

-   consumer migration доказана;
-   canonical consumer больше не зависит от generic status matching;
-   generic event остаётся только там, где реально нужен, либо
    удалён/deprecated.

### Atomicity

Доказать:

-   state/history/outbox согласованы;
-   failure не оставляет partial business fact.

### Consumer dedup

Повторная доставка canonical event не создаёт duplicate effect.

------------------------------------------------------------------------

# 22. Full regression

Обязательно запусти:

Backend:

-   `tsc --noEmit`;
-   unit;
-   новый/обновлённый Order e2e;
-   Booking e2e;
-   outbox/inbox/event e2e;
-   Buyer Cabinet e2e;
-   полный serial backend e2e.

Frontend:

Если frontend не менялся --- всё равно:

-   `tsc --noEmit`;
-   vitest;
-   production build.

Также:

-   `prisma migrate status`;
-   drift check, если schema затронута;
-   clean migration replay через существующий test setup.

------------------------------------------------------------------------

# 23. Runtime verification

На live/dev stack проверь реальный Order flow, насколько существующий
lifecycle позволяет.

Минимум:

1.  создать/использовать тестовый Order штатным текущим способом;
2.  выполнить transition ReadyForBooking, если он существует;
3.  проверить Order state;
4.  проверить OrderHistory;
5.  проверить Outbox canonical event;
6.  проверить consumer effect;
7.  повторить transition → duplicate business event отсутствует;
8.  выполнить fulfillment, если он существует;
9.  проверить canonical event;
10. close --- только если такой transition реально существует.

Smoke data после проверки удалить безопасно.

Не изменять legacy production-like данные ради smoke.

------------------------------------------------------------------------

# 24. Documentation

Обнови architecture/docs только по фактическому результату.

Зафиксируй:

-   canonical Order event names;
-   semantics каждого;
-   producer;
-   authoritative transition;
-   consumers;
-   payload;
-   dedup/idempotency;
-   relation с OrderHistory;
-   relation с generic `OrderStatusChanged`;
-   отсутствующие lifecycle gaps;
-   boundary Step 1.15/1.15A;
-   boundary Phase 2.

Если проект ведёт event catalog --- обнови его.

------------------------------------------------------------------------

# 25. Deferred decisions / roadmap discipline

Не решать в Step 1.14:

-   новый Order lifecycle;
-   Order creation через Sale;
-   удаление `/orders/bootstrap` как отдельную задачу;
-   full temporal columns;
-   acquisition propagation;
-   Checkout;
-   Quote/Sale;
-   Booking lifecycle completion;
-   Finance/Payment;
-   correlation infrastructure;
-   global event envelope;
-   Communication foundation.

Они остаются в своих canonical Steps.

------------------------------------------------------------------------

# 26. Stop conditions

Немедленно остановись и выдай:

`ARCHITECTURE DECISION REQUIRED`

если для реализации требуется:

-   придумать новый Order status;
-   переопределить существующий lifecycle;
-   решить неясную семантику `BookingRequested` vs
    `OrderReadyForBooking` без доказательств из кода;
-   перенести ownership Order/Booking;
-   создать новый bounded context;
-   определить acquisition source постфактум;
-   реализовать существенную часть Phase 2.

Опиши:

1.  обнаруженный конфликт;
2.  фактический current state;
3.  варианты;
4.  последствия каждого;
5.  рекомендуемый вариант;

и **не продолжай спорную реализацию**.

------------------------------------------------------------------------

# 27. Definition of Done

Step 1.14 считается завершённым только если:

-   реальные Order transitions исследованы;
-   `OrderReadyForBooking` имеет доказанную semantics или честно
    остановлен как architecture decision;
-   `OrderFulfilled` имеет доказанную semantics или честно отмечен gap;
-   `OrderClosed` не фабрикуется при отсутствии close lifecycle;
-   generic `OrderStatusChanged` больше не подменяет известные canonical
    business facts;
-   canonical events атомарны с transition/history;
-   duplicate/retry/concurrency не создают duplicate business facts;
-   payload минимален и не содержит PII/internal dump;
-   Buyer/Booking regression пройдена;
-   full backend regression green;
-   frontend regression green;
-   migrations clean;
-   docs соответствуют коду;
-   Step 1.15 и Phase 2 не начаты.

------------------------------------------------------------------------

# 28. Финальный отчёт

Верни отчёт строго по структуре:

1.  Current → Target mapping
2.  Order lifecycle фактически найденный в коде
3.  Existing Order events inventory
4.  Generic `OrderStatusChanged` usage inventory
5.  `OrderReadyForBooking` semantics / producer / consumers
6.  `OrderFulfilled` semantics / producer / consumers
7.  `OrderClosed` semantics / producer / consumers или documented gap
8.  `BookingRequested` relationship
9.  Atomicity / transaction boundary
10. OrderHistory relationship
11. Event payload contracts
12. Temporal semantics / `occurredAt`
13. Idempotency / deduplication
14. Concurrency results
15. Consumer retry / Inbox dedup
16. RBAC / object scope
17. Buyer Cabinet regression
18. Marketplace / Storefront regression
19. Migration status
20. Unit tests
21. E2E tests
22. Full regression
23. Runtime verification
24. Docs / ADR changes
25. Issues found/fixed
26. Remaining gaps → exact future Step
27. Deferred Decisions compliance
28. Out-of-scope confirmation
29. ARCHITECTURE DECISION REQUIRED --- YES/NO

Финальная строка только после успешного завершения:

`PHASE 1 STEP 1.14 COMPLETED — WAITING FOR REVIEW`

Не переходить к Step 1.15.
