# PHASE 1 — STEP 1.15A — STRICT IMPLEMENTATION REVIEW

## 0. Роль и границы

Проведи строгий code / architecture / temporal / privacy / event-contract review уже реализованного:

**PHASE 1 — STEP 1.15A — BUSINESS EVENT TEMPORAL CONTRACT**

Implementation report не считать доказательством.

Проверяй фактический repository:

- Prisma schema;
- migration SQL;
- `domain-events.ts`;
- EventBusService;
- Outbox/Inbox;
- request-context / actor propagation;
- JwtAuthGuard;
- Order/Booking/CRM/Catalog producers;
- subscribers/consumers;
- tests;
- ADR-0010;
- events.md;
- runtime/dev DB.

Это review существующей реализации.

Не переходить к:
- Step 1.16;
- Phase 2.

Если найдена локальная подтверждённая проблема — исправить как review-fix и повторить regression.

Если требуется изменить ownership, privacy architecture, event-store model или business lifecycle — вернуть:

`ARCHITECTURE DECISION REQUIRED`

---

# 1. Главные review-риски

Обязательно проверить:

1. `occurredAt = OutboxEvent.createdAt` действительно честно для всех canonical producers.
2. USER/SYSTEM actor authority и propagation не смешиваются.
3. Durable Outbox не хранит чрезмерную PII без доказанной необходимости.
4. `BookingRequested.payload.travelers` не превращает Outbox в чувствительное PII-хранилище без policy.
5. `CustomerCreated/CustomerUpdated.email` действительно нужен consumer-ам.
6. Malformed legacy actor → null adapter не скрывает corruption новых rows.
7. `created[0]!.id` в BookingCreated действительно безопасен по invariant.
8. Envelope immutable не только логически, но и по всем production write paths.
9. Legacy NULL semantics не фабрикуются.
10. Source/version/metadata правильно НЕ введены, если authoritative данных нет.
11. Step 1.15 correlation semantics полностью сохранены.
12. Behavioral/Audit boundaries не размыты.

---

# 2. Canonical envelope audit

Проверить фактический `BusinessEventEnvelope<TPayload>`.

Ожидаемые поля:

- eventId
- eventType
- occurredAt
- correlationId
- causationId
- actor
- entityId
- entityType
- payload

Проверить:
- types;
- nullability;
- format;
- runtime validation;
- writer usage;
- consumer projection.

Не считать TypeScript type достаточной runtime guarantee.

---

# 3. occurredAt = createdAt — критический блок

Отчёт выбрал Option A:

`occurredAt = OutboxEvent.createdAt`

Это допустимо только если фактически выполняется invariant:

> Outbox row создаётся атомарно в той же transaction и в том же business transition, который event представляет.

Проверить каждый major producer class:

- Order;
- Booking;
- Customer/Partner;
- Product/Catalog.

Для каждого составить:

| Event | Business mutation | Transaction | Outbox insert | createdAt semantics | Honest occurredAt? |

Если event создаётся:
- позже отдельным subscriber;
- после commit;
- через polling/reconciliation без исходного transition time;
- как delayed technical consequence,

то `createdAt` может быть processing time, а не business occurrence time.

В таком случае нужен REVIEW FIX или architecture decision.

---

# 4. Reconcile-produced events

Особенно проверить события, создаваемые reconciliation/subscriber paths.

Например:
- `OrderFulfilled` через Booking status reconciliation;
- другие child/system events.

Определить:
- какой business fact реально occurred;
- когда он произошёл;
- совпадает ли момент создания Outbox row с occurrence.

Не использовать consumer processing time как occurredAt, если событие должно отражать более ранний business transition.

---

# 5. Atomicity proof

Для canonical business events проверить:

`business state mutation + history + outbox row`

в одной transaction там, где event означает именно этот transition.

Не должно быть:
- mutation commit → потом emit;
- emit → потом mutation;
- history отдельно.

Если producer по design реагирует на уже-consumed parent event и создаёт новый child business fact в своей transaction — это допустимо, но occurredAt должен отражать child fact, а не parent.

---

# 6. Actor authority

Проверить `BusinessEventActor`.

Ожидаемо:
- `{type:"USER", id}`
- `{type:"SYSTEM", id?}`
- `{type:"UNKNOWN"}` / null legacy

Нужно доказать:

- USER actor берётся только из authenticated server context;
- frontend/body не может forged actor;
- SYSTEM actor устанавливается consumer/system context;
- child event не наследует USER actor автоматически, если actual producer — system consumer;
- UNKNOWN не используется как lazy default для новых событий, где actor известен.

---

# 7. USER → SYSTEM transition

Критически проверить цепочку:

Authenticated USER action
→ parent event
→ async consumer
→ child event.

Ожидаемо:

Parent:
`actor = USER`

Child:
`actor = SYSTEM`

при сохранении:
- correlationId;
- causationId = parent eventId.

Проверить фактические tests и runtime.

Не должно быть:
- child USER actor copied from parent request context;
- SYSTEM event retaining stale user context.

---

# 8. Nested actor context

Проверить request-context implementation:

- `setRequestActor`;
- nested `runWithRequestContext`;
- publishPending.

Проверить:
- parent USER context;
- nested SYSTEM consumer context;
- exit nested → USER parent restored;
- parallel consumers не смешивают actor;
- no actor leakage между requests.

---

# 9. Actor persistence validation

`actor` хранится JSONB.

Проверить runtime validation ДО persist:

- USER requires valid id;
- SYSTEM allowed shape;
- UNKNOWN shape;
- arbitrary keys rejected/ignored;
- email/name/roles нельзя подсунуть;
- empty USER id rejected;
- malformed JSON невозможно записать через canonical writer.

---

# 10. Legacy malformed actor adapter

`toOutboxEnvelope` возвращает null для malformed legacy actor.

Проверить, что это поведение применяется именно к legacy reads.

Не должно быть так, что malformed **new** Outbox rows quietly normalize to null и corruption остаётся незаметным.

Нужно разделить:

- canonical writer → strict reject;
- legacy adapter → tolerant read.

Добавить targeted test.

---

# 11. PII boundary — критический блок

Провести полный event-payload audit.

Составить таблицу:

| Event | Payload fields | PII? | Consumer need | Durable? | Action |

Особое внимание:

- `BookingRequested.payload.travelers`
- CustomerCreated/CustomerUpdated email
- traveler/passport/contact fields
- Product/Partner payloads
- any raw snapshots

Outbox — durable infrastructure storage. Поэтому PII должна иметь явную необходимость и boundary.

---

# 12. BookingRequested travelers PII

Отчёт прямо признаёт passport/traveler PII в payload.

Это нельзя автоматически оставить как "Phase 2 debt" без проверки.

Нужно определить:

1. Какие именно traveler fields хранятся?
2. Есть ли passport number/document data?
3. Нужен ли consumer-у полный snapshot?
4. Может ли consumer получить traveler data read-by-ID?
5. Есть ли encryption-at-rest на уровне БД/storage?
6. Каков retention Outbox rows?
7. Кто имеет DB/admin доступ?
8. Пишется ли payload в logs/errors?
9. Копируется ли payload в Inbox?
10. Нужна ли минимизация уже сейчас?

Допустимые результаты:

### A. Payload действительно необходим сейчас
Тогда documented sensitive-event contract обязателен:
- minimal fields;
- no logging;
- restricted access;
- retention debt explicit.

### B. Consumer может читать canonical data по IDs
Тогда PII нужно убрать из durable event payload и передавать только references.

### C. Решение требует redesign Booking orchestration
Вернуть:
`ARCHITECTURE DECISION REQUIRED`

Не оставлять passport PII в Outbox только потому, что тесты зелёные.

---

# 13. Customer email in events

Проверить:
- CustomerCreated;
- CustomerUpdated.

Определить, нужен ли email реальному consumer.

Если Catalog/другой consumer использует только `customerId/code/name`, email нужно рассмотреть на удаление.

Если email — required business integration field:
- documented;
- typed;
- no raw CRM;
- no logging;
- no unnecessary duplication.

Data minimization предпочтительна.

---

# 14. Raw CRM / User / Traveler leakage

Repo-wide проверить payload constructors.

Запрещены:
- spread Prisma object;
- raw Customer;
- raw User;
- raw Traveler;
- raw Passport;
- full Partner entity;
- request DTO dump.

Только explicit typed fields.

---

# 15. entityId correctness

Проверить mapping:

- Order event → orderId
- Booking event → bookingId
- PartnerCreated → partnerId
- CustomerCreated → customerId
- Product events → productId

Не использовать code вместо canonical entityId.

---

# 16. BookingCreated aggregateId invariant

Фикс:

`created[0]!.id`

Проверить upstream invariant.

Нужно доказать:

- `created.length > 0` гарантирован до emit;
- при empty result system не падает с runtime TypeError;
- consumer path имеет controlled behavior;
- transaction semantics корректны.

Лучше explicit invariant/assertion с domain error, чем non-null assertion, если empty theoretically возможен.

Если массив может быть пустым — REVIEW FIX REQUIRED.

---

# 17. eventId semantics

Проверить:
- OutboxEvent.id = eventId;
- UUID;
- immutable;
- retry не генерирует новый ID;
- duplicate publish того же row сохраняет ID;
- consumer dedup использует parent eventId.

---

# 18. eventType registry

Repo-wide проверить:
- aliases;
- duplicates;
- stale values;
- production consumers.

Не должно быть semantic duplicates.

Generic OrderStatusChanged должен оставаться только техническим, как в Step 1.14.

---

# 19. correlationId / causationId regression

Step 1.15 contract должен быть неизменён.

Проверить:
- server-authoritative root correlation;
- child inherits correlation;
- child causation = parent eventId;
- independent HTTP calls distinct;
- legacy NULL safe;
- no business-code correlation.

Actor work не должен ломать ALS semantics.

---

# 20. source/channel absence

Отчёт не добавил source/channel в v1 из-за отсутствия authoritative значения.

Проверить, что это действительно честно.

Не должно быть скрытого:
- source в metadata;
- acquisition guess;
- route-derived channel.

PartnerEventPayload.source как domain-specific payload field допустим только если semantics явно не acquisition.

---

# 21. version absence

Проверить, что:
- event schema version действительно не требуется прямо сейчас;
- legacy/new envelope можно различить без ambiguity;
- backward-compatible additive strategy достаточна.

Если consumer уже зависит от actor/entity fields, надо понять, как он отличает old row.

Не вводить version искусственно, но убедиться в compatibility.

---

# 22. Legacy adapter

Проверить `toOutboxEnvelope`.

Он должен:
- централизовать legacy normalization;
- не mutate input;
- не guess actor;
- not fabricate occurredAt beyond honest createdAt mapping;
- preserve NULL correlation;
- maintain legacy aliases only for compatibility.

Новые consumers по возможности должны использовать canonical fields.

---

# 23. Writer standardization

Repo-wide найти прямые `prisma.outboxEvent.create`/raw inserts вне EventBusService.

Production business writers должны использовать canonical writer.

Допустимые исключения:
- migration/test fixtures;
- controlled repair tooling.

Любой active bypass = REVIEW FIX.

---

# 24. Validation coverage

`assertValidBusinessEventWrite` должен проверять не только empty aggregateId.

Проверить:
- eventType known?
- aggregate/entity IDs non-empty;
- payload defined;
- actor valid;
- correlation/causation format;
- oversized payload?
- metadata absent/untrusted;
- entityType valid.

Не обязательно строить schema registry, но runtime contract должен быть meaningful.

---

# 25. Envelope immutability — критический блок

Repo-wide найти все updates `events.OutboxEvent`.

После insert разрешено менять только processing-state поля, например:
- status;
- publishedAt;
- error;
- attempts, если используется.

Не должно изменяться:
- eventType;
- aggregateId/entityId;
- payload;
- actor;
- correlationId;
- causationId;
- createdAt.

Добавить automated DB-level/service-level proof.

---

# 26. Retry semantics

При retry/re-publish:

- same eventId;
- same occurredAt;
- same actor;
- same entityId;
- same payload;
- same correlation/causation.

Проверить FAILED → PENDING/manual retry path, если существует.

Если FAILED auto retry отсутствует — debt сохраняется, но envelope не мутируется.

---

# 27. Inbox payload duplication

Проверить InboxEvent schema/behavior.

Если Inbox сохраняет raw event payload:
- PII duplicated?
- retention?
- actor/envelope persisted twice?

Не расширять scope, но если BookingRequested traveler PII дублируется в Inbox — privacy risk выше и должен быть явно рассмотрен.

---

# 28. Logs / errors

Проверить eventbus/subscriber logs.

Не логировать:
- full payload;
- travelers;
- passports;
- email;
- Customer data;
- raw actor object beyond safe IDs.

FAILED outbox error не должен включать serialized payload.

---

# 29. AuditLog boundary

Проверить, что Step 1.15A не добавил actor/event fields в AuditLog schema.

AuditLog correlation reference остаётся Step 1.15 behavior.

No event envelope dump.

---

# 30. Behavioral boundary

Проверить schema and code:

MarketplaceBehavioralEvent / StorefrontBehavioralEvent не получили:
- actor;
- entityId;
- correlationId;
- causationId
из business envelope.

Behavioral contract независим.

---

# 31. Product/Catalog event semantics

Проверить ProductCreated/Published/Archived.

Особенно occurredAt mapping и actor:
- USER/PARTNER action;
- SYSTEM moderation publication, если так;
- no fake actor.

Не создавать новых Product events.

---

# 32. CRM/Partner event semantics

Проверить:
- CustomerCreated/Updated;
- PartnerCreated.

Actor:
- registration/system orchestration;
- admin approval;
- CRM service.

Не подменять actor тем, кто физически вызвал lower-level service, если business fact produced system-side.

Если semantics неоднозначна — документировать.

---

# 33. Order canonical event regression

Повторно проверить:
- OrderReadyForBooking;
- OrderFulfilled;
- OrderClosed;
- BookingRequested;
- generic technical OrderStatusChanged.

Envelope refactor не должен менять event counts/trigger transitions.

---

# 34. Booking lifecycle regression

Проверить:
- BookingCreated;
- Confirmed;
- Rejected;
- Cancelled;
- StatusChanged;
- Inbox dedup.

Не исправлять Booking CAS debt в этом step.

---

# 35. Migration SQL review

Проверить migration:

`20260809140000_add_business_event_actor`

или фактическое имя.

Требования:
- только additive nullable JSONB;
- no default;
- no backfill;
- deterministic;
- no trigger;
- no historical guessed actor;
- clean replay;
- no edited applied migrations.

---

# 36. Legacy NULL proof

Добавить automated proof:

pre-existing Outbox row без actor
→ migration/startup/reconciliation
→ actor остаётся NULL.

Не только clean DB tests.

---

# 37. Runtime tests required

Минимум:

1. USER Order command → USER actor.
2. child SYSTEM event → SYSTEM actor.
3. correlation inherited.
4. causation parent eventId.
5. occurredAt = honest transition time.
6. retry does not mutate envelope.
7. malformed new actor rejected.
8. malformed legacy actor tolerated/null.
9. legacy actor remains NULL.
10. BookingCreated empty invariant safe.
11. BookingRequested payload privacy inspected.
12. Customer event email necessity tested/documented.
13. direct Outbox writer bypass absent.
14. behavioral unaffected.

---

# 38. Security / access

Проверить кто может читать Outbox/Inbox:
- no public API;
- no Buyer/Partner raw event access;
- internal admin/debug endpoints, если есть;
- DB exposure.

Если PII remains in event payload, access boundary обязателен.

---

# 39. Retention / privacy debt

Не нужно проектировать полноценный retention engine, но для durable PII events нужно явно указать:
- retention unknown/debt;
- cleanup owner;
- encryption/access assumption.

Если такая политика критична уже сейчас для passport data, это может стать blocking review issue.

---

# 40. Docs / ADR-0010

Сверить code vs ADR.

ADR должен честно описывать:
- occurredAt=createdAt assumption;
- actor authority;
- legacy NULL;
- event immutability;
- payload data minimization;
- sensitive BookingRequested payload debt;
- Customer email;
- behavioral/Audit boundaries;
- future versioning.

Не преуменьшать PII risk формулировкой "typed = safe".

---

# 41. Required tests

Минимум:
- envelope validator;
- actor variants;
- malformed new actor reject;
- malformed legacy actor tolerate;
- USER→SYSTEM propagation;
- 50 parallel actor/correlation context isolation;
- occurredAt honesty;
- immutability across retry;
- legacy NULL actor;
- no direct writer bypass;
- BookingRequested PII policy test;
- Customer email consumer-need contract;
- Order counts unchanged;
- Booking counts unchanged;
- AuditLog unchanged;
- behavioral schema unchanged.

---

# 42. Full regression

Backend:
- `tsc --noEmit`;
- unit;
- envelope tests;
- eventbus/outbox/inbox;
- order canonical;
- booking;
- partner/customer;
- buyer;
- auth/RBAC;
- temporal readiness;
- correlation request-context;
- marketplace behavioral;
- storefront behavioral;
- full serial e2e.

Frontend:
- `tsc --noEmit`;
- vitest;
- production build.

DB:
- migrate status;
- migrate diff/no drift;
- clean replay.

---

# 43. Approval criteria

Step 1.15A можно рекомендовать к APPROVED только если:

- occurredAt semantics доказана per producer;
- actor authority корректна;
- USER/SYSTEM context не течёт;
- new malformed actor нельзя persist;
- legacy malformed/NULL safe;
- envelope immutable;
- canonical writer не обходится;
- PII в durable events минимизирована/обоснована;
- BookingRequested traveler payload имеет acceptable current boundary либо исправлен;
- Customer email обоснован или удалён;
- Step 1.15 correlation preserved;
- behavioral/Audit boundaries intact;
- migration clean;
- regressions green.

---

# 44. Review fixes

Если найден локальный дефект:

`FIX N — <название>`

Описать:
- problem;
- risk;
- root cause;
- files;
- fix;
- tests;
- regression.

Не расширять scope.

---

# 45. Architecture decision triggers

Вернуть:

`ARCHITECTURE DECISION REQUIRED`

если требуется:
- redesign BookingRequested orchestration из-за PII;
- новый encrypted event store;
- изменение bounded-context ownership;
- отдельная privacy architecture для event bus;
- объединение behavioral/business stores;
- новый version/schema registry platform;
- изменение lifecycle semantics.

---

# 46. Формат итогового отчёта

Вернуть:

# PHASE 1 — STEP 1.15A — STRICT REVIEW — ОТЧЁТ

1. Verdict
2. Files/modules inspected
3. Canonical envelope
4. occurredAt per-producer matrix
5. Atomicity proof
6. Actor authority
7. USER→SYSTEM propagation
8. Actor context isolation
9. Actor persistence validation
10. Legacy malformed actor
11. PII inventory
12. BookingRequested traveler PII review
13. Customer email review
14. Raw-entity leakage review
15. entityId correctness
16. BookingCreated invariant
17. eventId/eventType
18. correlation/causation regression
19. source/channel absence
20. versioning/legacy compatibility
21. Legacy adapter
22. Writer standardization
23. Validation
24. Envelope immutability
25. Retry semantics
26. Inbox duplication/privacy
27. Logging/privacy
28. AuditLog boundary
29. Behavioral boundary
30. Catalog events
31. CRM/Partner events
32. Order regression
33. Booking regression
34. Migration review
35. Legacy NULL proof
36. Runtime verification
37. Security/access
38. Retention/privacy debt
39. ADR-0010 consistency
40. Unit tests
41. E2E tests
42. Full regression
43. Issues/fixes
44. Remaining debt
45. Architecture decision status
46. Out-of-scope confirmation

Если fixes были:

`PHASE 1 STEP 1.15A REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`

Если fixes не нужны:

`PHASE 1 STEP 1.15A REVIEW PASSED — WAITING FOR APPROVAL`

Не переходить к Step 1.16.
