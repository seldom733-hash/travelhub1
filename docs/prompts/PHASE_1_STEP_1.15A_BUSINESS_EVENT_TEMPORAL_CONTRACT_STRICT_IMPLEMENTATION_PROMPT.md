# PHASE 1 — STEP 1.15A: BUSINESS EVENT TEMPORAL CONTRACT — STRICT IMPLEMENTATION PROMPT

## 0. Канонический scope

Выполни только **PHASE 1 — STEP 1.15A — Business Event Temporal Contract** проекта TravelHub.

Канонический Roadmap определяет event envelope:

- `eventId`
- `eventType`
- `occurredAt`
- `correlationId`
- `causationId`
- actor/system actor
- `entityId`
- source/channel
- version/metadata where applicable

Step 1.15 уже реализовал request/correlation infrastructure и ADR-0009.

Step 1.13A уже установил temporal discipline.

Step 1.14 уже ввёл canonical Order events.

Этот шаг **не должен** менять бизнес-lifecycle, строить новый event bus, внедрять vendor tracing или начинать Phase 2.

Не переходить к Step 1.16.

---

# 1. Цель

Стандартизировать **business event envelope** так, чтобы все канонические cross-domain business events имели единообразную, честную и forward-compatible структуру.

Цель:

> одинаковый технический envelope + domain-specific typed payload

при сохранении bounded-context ownership и существующей семантики событий.

Не превращать envelope в dump всей entity.

---

# 2. Перед изменениями — обязательный аудит

Исследуй фактический repository.

Найди:

- `domain-events.ts`;
- все event type registries/enums;
- `OutboxEvent`;
- `InboxEvent`;
- EventBusService;
- emit/emitResult;
- subscribers;
- Order canonical events;
- Booking events;
- Customer/Partner/Seller events;
- Product/Moderation events;
- Storefront lifecycle/domain events, если существуют;
- behavioral event stores — отдельно;
- AuditLog;
- ADR-0001/0003/0004/0008/0009;
- `temporal-readiness.md`;
- event contract docs;
- all tests.

Сначала построить inventory:

| Event | Producer | Consumer | Current envelope | Payload | Cross-domain? | Action |

Implementation reports не считать доказательством.

---

# 3. Business event vs behavioral event

Не смешивать:

## Business/domain event
Факт изменения бизнес-состояния/междоменный contract.

Примеры:
- OrderReadyForBooking
- OrderFulfilled
- OrderClosed
- BookingRequested
- BookingCreated
- PartnerCreated
- CustomerCreated

## Behavioral event
Пользовательское interaction:
- MarketplaceViewed
- ProductImpression
- StorefrontViewed
- ContactClicked

Step 1.15A стандартизирует **business event envelope**.

Behavioral event storage/envelope не мигрировать автоматически под этот contract.

---

# 4. Canonical envelope

Определи единый typed envelope.

Минимально:

```ts
type BusinessEventEnvelope<TPayload> = {
  eventId: string;
  eventType: string;
  occurredAt: string; // UTC ISO instant
  correlationId: string | null;
  causationId: string | null;
  actor: BusinessEventActor;
  entityId: string;
  source?: BusinessEventSource | null;
  version?: number | string | null;
  metadata?: BusinessEventMetadata | null;
  payload: TPayload;
}
```

Имена/структуру адаптировать к conventions проекта, но semantics не менять.

Не добавлять поля без реальной цели.

---

# 5. eventId

`eventId`:

- globally unique;
- immutable;
- stable через retry/delivery;
- не равен aggregate/entity ID;
- не генерируется consumer заново при replay того же event.

Использовать текущий Outbox event identity, если уже подходит.

---

# 6. eventType

`eventType`:

- canonical;
- стабильный;
- однозначный;
- без дублирующих aliases.

Не должно быть одновременно:
- `OrderFulfilled`
- `ORDER_FULFILLED`
- `OrderCompleted`

для одного факта без compatibility strategy.

Если legacy alias нужен — документировать deprecation.

---

# 7. occurredAt — критический temporal contract

`occurredAt` = фактическое время business fact/transition.

Не подменять:

- Outbox processing time;
- publishedAt;
- receivedAt;
- `updatedAt`;
- serviceDate;
- consumer receive time.

Для event, создаваемого в той же transaction, что и business transition, server-side event time должен соответствовать transition occurrence.

Если существующий Outbox `createdAt` фактически является transition time и создаётся в одной transaction — можно использовать/проецировать его как `occurredAt`, но contract должен быть явным.

Не фабриковать historical `occurredAt` для legacy rows.

---

# 8. correlationId

Использовать Step 1.15 contract.

Для новых business events:
- inherit active correlation context;
- root chain server-authoritative;
- legacy events могут иметь NULL.

Не использовать:
- order.code;
- booking.code;
- customerId;
- partnerId;
- behavioral sessionId.

---

# 9. causationId

`causationId` = непосредственная причина event.

Для child event от consumed event:
- parent `eventId`.

Для event от root HTTP request:
- использовать Step 1.15 semantics; не выдумывать parent business event.

Если causation неизвестна:
- NULL честнее guess.

---

# 10. Actor/system actor

Создать минимальный typed actor contract.

Нужно различать:

- authenticated user actor;
- system actor;
- anonymous, только если business event действительно может быть анонимным.

Не сериализовать raw User.

Минимально допустимые semantics, например:
- `type: USER | SYSTEM`
- `id?: userId`

Не включать:
- email;
- name;
- permissions;
- token;
- CRM profile.

Если actor неизвестен для legacy event → `SYSTEM/UNKNOWN` только если semantics реально доказана; иначе nullable/explicit UNKNOWN согласно выбранному контракту.

Не фабриковать actor задним числом.

---

# 11. entityId

`entityId` = canonical aggregate/entity, к которому относится business fact.

Примеры:
- Order event → orderId;
- Booking event → bookingId;
- PartnerCreated → partnerId;
- CustomerCreated → customerId.

Не путать с payload references.

Для событий, которые относятся к relation/process, определить primary aggregate owner.

Если неоднозначно — документировать.

---

# 12. source/channel

Поле source/channel использовать только там, где значение authoritative.

Нельзя угадывать:
- Marketplace vs Storefront acquisition;
- publication channel;
- UI route.

Если event имеет уже доказанный source:
- сохранить typed enum/reference.

Если нет:
- NULL/absent.

Полная acquisition propagation остаётся future commercial flow.

---

# 13. version

Version добавлять только если реальная entity/event version уже существует и нужна consumer-у.

Допустимые случаи:
- aggregate version;
- schema/event contract version.

Не путать эти два понятия.

Если вводится `eventSchemaVersion`, назвать явно.

Не добавлять фиктивный `version: 1` везде без documented migration/versioning strategy.

---

# 14. metadata

`metadata` должна быть строго ограниченной.

Не использовать `Record<string, any>` как свалку.

Допустимы только cross-cutting technical values, которые не заслуживают top-level field.

Не класть:
- PII;
- raw request;
- headers;
- ORM snapshot;
- business data, которое должно быть typed payload.

---

# 15. Payload boundary

Envelope общий, payload — domain-specific typed contract.

Пример:

`BusinessEventEnvelope<OrderRefPayload>`

Не перемещать domain fields в generic metadata.

Не сериализовать raw Prisma entity.

---

# 16. Outbox storage strategy

Проверить текущую `OutboxEvent` schema.

Предпочтительно:
- не создавать второй outbox;
- использовать существующие columns для IDs/metadata;
- payload хранить typed serialized representation согласно текущему bus contract.

Если envelope требует schema change:
- минимальная additive migration;
- nullable legacy fields;
- no fake backfill.

---

# 17. Legacy rows

Существующие Outbox events должны оставаться читаемыми.

Если у legacy row нет:
- occurredAt explicit;
- actor;
- entityId;
- source/version;

не угадывать.

Нужен backward-compatible decoder/adapter, если старый envelope отличается.

Legacy support не должен загрязнять новый canonical writer.

---

# 18. Writer standardization

После Step 1.15A новые business events должны создаваться через один canonical writer/factory/helper.

Запрещено иметь десятки ручных constructions с разной envelope semantics.

Но не создавать over-engineered framework.

Минимум:
- validation;
- context inheritance;
- occurredAt;
- actor;
- entityId;
- typed payload.

---

# 19. Consumer standardization

Consumers должны получать normalized canonical event.

Не заставлять каждый consumer:
- парсить legacy shape;
- угадывать correlation;
- вычислять occurredAt;
- искать entityId в payload.

Если нужен adapter layer — централизовать его.

---

# 20. Validation

Перед persist/publish валидировать:

- eventId;
- eventType;
- occurredAt;
- correlationId/causationId format;
- actor;
- entityId;
- source enums;
- metadata limits;
- payload contract.

Не допускать empty string IDs.

---

# 21. Order canonical events — обязательная миграция

Применить canonical envelope минимум к:

- `OrderReadyForBooking`
- `OrderFulfilled`
- `OrderClosed`
- `OrderCancelled`, если остаётся production event
- `BookingRequested`, если он проходит через тот же business event bus

Сохранить semantics Step 1.14.

Не менять counts/trigger transitions.

---

# 22. Booking events

Проверить и привести к envelope:
- BookingCreated;
- BookingConfirmed;
- BookingRejected;
- BookingStatusChanged, если production;
- другие cross-domain Booking events.

Не менять Booking lifecycle.

Booking CAS debt не решать здесь.

---

# 23. CRM/Security integration events

Проверить:
- CustomerCreated;
- PartnerCreated;
- seller/profile-related domain events, если реально cross-domain;
- onboarding events.

Привести только реальные business integration events.

Не превращать AuditLog actions в domain events.

---

# 24. Catalog events

Проверить существующие Product/Moderation/Catalog domain events.

Не создавать новые события «для полноты».

Стандартизировать только те, которые реально производятся/потребляются.

---

# 25. Event type registry

Создать/очистить canonical registry.

Проверить:
- stale aliases;
- dead event names;
- duplicate naming;
- legacy values.

Удалять только после proof отсутствия production consumers.

---

# 26. OccurredAt vs Outbox createdAt

Если OutboxEvent.createdAt сейчас используется как event time:

документировать mapping.

Возможные варианты:

### A. No schema change
Canonical envelope `occurredAt = outbox.createdAt`, потому что event создаётся атомарно с transition.

### B. Dedicated occurredAt
Добавить field, если createdAt семантически не всегда совпадает с occurrence.

Выбрать на основании кода, а не теории.

Если нужен architecture-level change всей event persistence semantics:
`ARCHITECTURE DECISION REQUIRED`.

---

# 27. Processing timestamps

Не смешивать:

- occurredAt;
- Outbox createdAt;
- publishedAt;
- failedAt/processedAt, если есть;
- consumer receive time.

Step 1.15A — business event temporal contract, не retry pipeline redesign.

---

# 28. Retry debt boundary

FAILED Outbox retry debt из 1.14/1.15 остаётся out of scope.

Не внедрять retry scheduler.

Но canonical envelope должен сохраняться при FAILED/PENDING/PUBLISHED status без мутации event identity/occurredAt.

---

# 29. Idempotency

Повторная публикация того же event:
- тот же eventId;
- тот же occurredAt;
- тот же correlation/causation;
- тот же payload/version.

Consumer dedup не должен зависеть от mutable processing timestamp.

---

# 30. Event immutability

После persist business envelope не должен мутировать, кроме processing-state columns Outbox.

Нельзя на retry менять:
- eventId;
- occurredAt;
- actor;
- entityId;
- payload;
- correlation;
- causation.

---

# 31. Security/privacy

Review payload/envelope на:
- PII;
- secrets;
- tokens;
- raw CRM;
- traveler docs;
- payment data.

Actor userId/entity references допустимы только как canonical IDs.

Не логировать full envelope без redaction policy.

---

# 32. AuditLog boundary

AuditLog не должен мигрироваться под BusinessEventEnvelope.

Event envelope ≠ audit schema.

Audit может хранить correlation reference, как реализовано в 1.15.

---

# 33. Behavioral boundary

Не мигрировать Marketplace/Storefront behavioral tables в business envelope.

Их:
- eventId;
- occurredAt;
- sessionId;
- acquisitionSource

остаются собственным analytics contract.

Можно документировать conceptual compatibility, но не объединять storage.

---

# 34. Source/channel semantics

Проверить каждое event source/channel значение.

Не допустить смешения:
- publication channel;
- acquisition source;
- producing bounded context;
- HTTP route.

Если `source` означает bounded context (`ORDER`, `BOOKING`, etc.), назвать/документировать именно так.

Если требуется `channel`, хранить отдельно и только при authoritative data.

---

# 35. Event versioning strategy

Определить минимальную стратегию backward compatibility.

Нужно ответить:
- как consumer отличит legacy envelope от new;
- нужен ли schemaVersion;
- как evolve payload без breaking migration.

Не строить полноценную schema registry platform.

Минимальное documented решение достаточно.

---

# 36. Contract tests

Добавить reusable contract tests для envelope.

Проверять:
- required fields;
- UUID format;
- UTC occurredAt;
- nullable legacy correlation;
- actor variants;
- entityId;
- metadata whitelist/limits;
- immutability.

---

# 37. Targeted E2E

Минимум:

1. OrderReadyForBooking has canonical envelope.
2. OrderFulfilled canonical envelope.
3. OrderClosed canonical envelope.
4. trigger counts unchanged from 1.14.
5. child Booking event inherits correlation/causation.
6. actor from authenticated command correct.
7. system-produced event actor correct.
8. entityId correct.
9. occurredAt UTC and stable across retry.
10. eventId stable.
11. duplicate delivery does not mutate envelope.
12. legacy event with missing fields still consumable.
13. no PII in Order payload.
14. no raw CRM in Partner/Customer event.
15. AuditLog unaffected structurally.
16. behavioral events unaffected.
17. FAILED/PENDING processing does not mutate business envelope.
18. independent request chains remain distinct.

---

# 38. Runtime verification

На dev/live test flow проверить:

A. authenticated Order command → envelope;
B. event fields in DB/outbox;
C. Booking child event lineage;
D. system subscriber event;
E. retry/delivery;
F. legacy compatibility;
G. actor;
H. occurredAt;
I. correlation/causation;
J. no PII.

Smoke cleanup обязателен.

---

# 39. Migration strategy

Если schema меняется:

- additive;
- nullable legacy;
- deterministic;
- no historical guess;
- no `NOW()` fake occurredAt;
- no fake actor/entity/source;
- migrate deploy;
- clean replay;
- status;
- diff/no drift.

Applied migrations не редактировать.

---

# 40. Docs / ADR

Обновить event contract docs.

Создать/обновить ADR, если envelope становится cross-domain canonical architecture.

Документировать:
- envelope;
- field semantics;
- actor;
- source/channel;
- versioning;
- temporal meanings;
- legacy compatibility;
- distinction from AuditLog/behavioral events;
- Step 1.15 correlation integration.

---

# 41. Full regression

Backend:
- typecheck;
- unit;
- envelope contract tests;
- eventbus/outbox/inbox;
- order canonical;
- booking;
- partner/customer/onboarding;
- buyer;
- auth/RBAC;
- temporal readiness;
- marketplace/storefront behavioral;
- full serial e2e.

Frontend:
- tsc;
- vitest;
- production build.

DB:
- migration status;
- diff/no drift;
- clean replay.

---

# 42. Stop conditions

Вернуть:

`ARCHITECTURE DECISION REQUIRED`

если для 1.15A нужно:
- изменить bounded-context ownership;
- объединить AuditLog и Outbox;
- объединить behavioral и business event stores;
- переписать business lifecycle;
- внедрить schema registry/vendor event platform;
- определить acquisition/source, которого сейчас нет;
- массово backfill unknown historical event facts.

---

# 43. Definition of Done

Step 1.15A завершён только если:

- canonical envelope определён;
- business event writers standardized;
- consumers получают normalized event;
- occurredAt честный;
- correlation/causation 1.15 preserved;
- actor typed;
- entityId explicit;
- source/channel не угадываются;
- payload typed;
- legacy events backward-compatible;
- event immutable;
- Order/Booking semantics не изменены;
- behavioral/Audit boundaries сохранены;
- full regression green;
- Step 1.16 не начат.

---

# 44. Итоговый отчёт

Вернуть:

# PHASE 1 — STEP 1.15A — ОТЧЁТ

1. Current → Target mapping
2. Event inventory
3. Canonical envelope
4. eventId semantics
5. eventType registry
6. occurredAt contract
7. correlationId
8. causationId
9. actor contract
10. entityId contract
11. source/channel
12. versioning
13. metadata
14. payload boundary
15. Outbox storage
16. legacy adapter
17. writer standardization
18. consumer normalization
19. validation
20. Order migration
21. Booking migration
22. CRM/Security events
23. Catalog events
24. event registry cleanup
25. immutability
26. idempotency/retry behavior
27. privacy/security
28. AuditLog boundary
29. Behavioral boundary
30. migration
31. unit/contract tests
32. E2E
33. runtime verification
34. full regression
35. docs/ADR
36. issues/fixes
37. remaining debt
38. architecture decision status
39. out-of-scope confirmation

Финальная строка:

`PHASE 1 STEP 1.15A COMPLETED — WAITING FOR REVIEW`

Не переходить к Step 1.16.
