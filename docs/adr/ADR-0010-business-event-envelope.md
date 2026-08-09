# ADR-0010 — Business Event Envelope (Step 1.15A)

- Статус: **Accepted**
- Дата: 2026-08-09
- Связанные ADR: ADR-0001 (модульный монолит), ADR-0009 (correlation/request context), ADR-0008 (behavioral instrumentation)
- Реализация: Phase 1 Step 1.15A (Business Event Temporal Contract)

## Контекст

Канонический Roadmap требует единый business event envelope (`eventId`,
`eventType`, `occurredAt`, `correlationId`, `causationId`, actor, `entityId`,
source/channel, version/metadata). До Step 1.15A envelope был имплицитным:
`OutboxEvent` хранил `id/aggregateType/aggregateId/eventType/payload/
correlationId/causationId/createdAt`; actor лежал только в payload отдельных
событий как username-строка; temporal семантика `createdAt` не была явно
задокументирована как `occurredAt`.

## Решение

Ввести единый typed envelope (`BusinessEventEnvelope<TPayload>`,
`backend/src/eventbus/domain-events.ts`) для ВСЕХ cross-domain business events,
сохранив bounded-context ownership и существующую семантику событий. Хранение
остаётся в `events.OutboxEvent` (без второго outbox):

| Envelope field | Storage | Семантика |
|---|---|---|
| `eventId` | `OutboxEvent.id` | global unique UUID, immutable, стабилен через retry; НЕ entityId |
| `eventType` | `OutboxEvent.eventType` | canonical registry (DomainEvents); без aliases/дубликатов |
| `occurredAt` | проекция `createdAt` (опция A, §26) | фактическое время business fact: событие пишется АТОМАРНО с transition в одной транзакции → `createdAt` честно = occurrence |
| `correlationId` | `OutboxEvent.correlationId` | Step 1.15/ADR-0009: server-authoritative causal chain; НЕ business ID |
| `causationId` | `OutboxEvent.causationId` | непосредственная причина: child event → eventId родителя |
| `actor` | `OutboxEvent.actor` (JSONB, additive nullable) | `{type:"USER",id}` \| `{type:"SYSTEM",id?}` \| `{type:"UNKNOWN"}` \| null (legacy) |
| `entityId` / `entityType` | `aggregateId` / `aggregateType` | canonical aggregate owner |
| `source` / `version` / `metadata` | — (ОТСУТСТВУЮТ в v1) | нет authoritative значения; не угадываются (§12-14) |

### Writer standardization (§18)

Все новые business events проходят через `EventBusService.emit/emitResult` —
единственный canonical writer. Валидация (`assertValidBusinessEventWrite`)
ДО persist: непустые `eventType/aggregateId/aggregateType`, определённый
`payload`, корректный `actor` (USER требует non-empty id; UNKNOWN без id).
Пустые ID запрещены (§20).

### Actor flow (§10)

- HTTP authenticated command: `JwtAuthGuard` (внутри ALS-scope middleware-а)
  вызывает `setRequestActor({type:"USER", id})` после `auth.me` → все emit
  запросов наследуют USER actor. Только canonical userId, без username/email/
  permissions.
- Событие, порождённое обработкой события (consumer): `publishPending`
  устанавливает для обработки контекст `{type:"SYSTEM"}` → события-результаты
  (BookingCreated, OrderFulfilled через reconcile) наследуют SYSTEM.
- Public/anonymous: actor = null (UNKNOWN). Без fake backfill для legacy.

### Consumer normalization (§19)

`OutboxEnvelope` (что получают подписчики) — canonical projection:
`entityId/entityType` (алиасы aggregate-полей), `occurredAt` (ISO из createdAt),
`actor`. Legacy-строки без actor читаются: actor=null, correlation=NULL — без
угадывания. Consumer-ам не нужно парсить legacy shape.

### Temporal contract (§7/§26/§27)

`occurredAt` = `createdAt` (опция A) — НЕ подменяется `publishedAt`/`updatedAt`/
processing-временем. Обработка не мутирует envelope: retry меняет только
`status/publishedAt/error`; eventId/occurredAt/actor/payload/correlation/
causation immutable (§30).

### Ограничения/границы

- **AuditLog** (ADR-0009 сохраняет correlation reference) НЕ мигрируется под
  envelope — audit schema ≠ event envelope (§32).
- **Behavioral events** (Marketplace/Storefront, ADR-0008) — отдельное storage
  со своим `eventId/sessionId/occurredAt`; бизнес-envelope их не касается (§33).
- **PII data minimization (STRICT REVIEW FIX, применён)**:
  - `BookingRequested` — payload минимизирован до `{orderId, orderCode,
    customerId}`: consumer (BookingSubscribers) читает `order.items`/
    `order.travelers` из БД по orderId (READ-only, ADR-0001) — паспортные
    данные туристов НЕ хранятся в durable Outbox;
  - `CustomerCreated/CustomerUpdated` — `email` убран (нет consumer-ов);
  - `PartnerCreated` — `contactEmail`/`registrationNumber` убраны (consumer
    использует только `partnerId`, countryCode читает по ID);
  - правила payload: только explicit typed fields, никаких raw Prisma/User/
    Traveler/Passport spread, никакого request-DTO dump (§14);
  - payload НЕ логируется (eventbus/subscribers без payload-logging);
  - InboxEvent не хранит payload (только consumerId+eventId) — дублирования PII нет.
- FAILED-outbox retry debt (1.14/1.15) остаётся вне scope.
- **Retention debt (STRICT REVIEW)**: исторические строки Outbox (созданные ДО
  минимизации) могут содержать traveler-паспорта (старый BookingRequested) и
  email (старый CustomerCreated) в payload. По правилу no-backfill они НЕ
  переписываются миграцией. Retention/cleanup этих строк — явный debt:
  владелец — команда платформы; политика очистки Outbox (TTL/анонимизация)
  — future Phase 2 (encryption-at-rest / retention engine).

## Последствия

- Envelope стандартизирован; payload остаётся domain-specific typed.
- Additive миграция `20260809140000_add_business_event_actor` (actor JSONB,
  nullable, NO backfill). Applied migrations не редактируются.
- Consumer-контракт расширен без breaking change (additive поля projection).
- `BookingStatusChanged`/`OrderStatusChanged` payload.actor (username-строка,
  legacy domain field) сохраняется для backward compatibility; envelope.actor —
  канонический typed actor.

## Альтернативы

- **B (dedicated occurredAt column)**: отклонено — все события пишутся атомарно
  с transition; `createdAt` честно отражает occurrence; колонка добавила бы
  дублирование без семантической выгоды (§26 опция A достаточно).
- **Отдельный schema-registry/platform**: вне scope (§42 stop condition) —
  минимальное documented решение достаточно.
- **Прямой actor в payload**: отклонено — повторяется в каждом payload; typed
  envelope actor централизован и наследуется из контекста.
