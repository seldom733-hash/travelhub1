# ADR-0008: Storefront Behavioral Instrumentation Foundation (Step 1.12.3)

- **Status:** Accepted (Phase 1 Step 1.12.3; **extended by Step 1.13B — Marketplace scope**)
- **Date:** 2026-08-09
- **Related:** ADR-0001 (modular monolith), ADR-0005 (Public Seller Identity), ADR-0006 (Storefront commercial model & channels), ADR-0007 (Partner CRM & acquisition boundary)

## Context

Storefront (платный SaaS-сайт PARTNER) в будущих фазах получит analytics
(трафик, посетители, просмотры, funnel, conversion, product performance,
geography/seasonality, attribution). Требуется минимальная, каноническая и
privacy-safe **foundation** для поведенческих событий публичной Storefront, без
реализации самой аналитики/агрегации и без принятия product/commercial-решений
(Deferred Decisions Map, DD-001…DD-020).

Существующие ADR не определяют ownership будущего behavioral event store.
Настоящий ADR фиксирует минимальное решение (Step 1.12.3 §2) и явно НЕ делает
Catalog владельцем «всей будущей analytics».

## Decision

1. **Owner behavioral instrumentation Step 1.12.3 — модуль Catalog/Storefront.**
   Durable store: таблица `catalog.StorefrontBehavioralEvent` (narrow, Storefront-
   scoped: только события `STOREFRONT_*` публичной витрины). Это НЕ новый bounded
   context и НЕ Analytics domain (запрещено §2: «не создавать полноценный Analytics
   domain ради этого шага»). Storefront сейчас Catalog-owned — события витрины
   хранятся рядом, но **только как instrumentation foundation**. Marketplace
   behavioral events (Step 1.13B) и любой будущий analytics/aggregation engine
   ПЕРЕСМАТРИВАЮТ ownership и не наследуют этот ADR автоматически.

2. **Publication channel ≠ acquisition source.** `ProductPublicationChannel`
   (MARKETPLACE/PARTNER_STOREFRONT) — Catalog-owned distribution state (где Product
   разрешён). `AcquisitionSource` (MARKETPLACE/PARTNER_STOREFRONT/DIRECT) — через
   какой пользовательский контекст возникло конкретное взаимодействие. Для
   Storefront events сервер authoritatively фиксирует `PARTNER_STOREFRONT`
   (endpoint storefront-scoped); `DIRECT` не симулируется без referral/entry-
   контракта; `MARKETPLACE` зарезервирован для 1.13B. Наличие Product в
   `PARTNER_STOREFRONT` НЕ доказывает Storefront-originated sale (коммерческие
   выводы — вне scope).

3. **Behavioral events ≠ business domain events ≠ AuditLog.**
   - Business domain events — `events.OutboxEvent`/`InboxEvent` (транзакционный
     outbox, ADR-0001): изменяют бизнес-состояние. Behavioral events НЕ идут
     через outbox и НЕ смешиваются с ним семантически.
   - AuditLog (`security.AuditLog`) — кто из authenticated actors изменил
     бизнес-состояние. Page views/clicks в AuditLog НЕ пишутся.
   - `StorefrontBehavioralEvent` — анонимная телеметрия посетителя, без
     `createdById`/actor, без внутренних полей.

4. **Envelope и trust boundary.** Каждое событие: `eventId` (UUID, dedup via
   unique constraint), `eventType` (enum whitelist), `occurredAt` (client UTC,
   clock-skew окно на сервере), `receivedAt` (server, отдельная семантика),
   `storefrontId`/`productId` (canonical IDs, резолвятся сервером из slug'ов),
   `sessionId` (opaque non-PII), `acquisitionSource` (server-authoritative),
   `locale`, `path`, строгий per-eventType `payload`. Клиент не может forged:
   storefrontId/partnerId/productId вне контекста витрины/authenticatedUserId/
   acquisitionSource/actor-поля; payload не принимает контактные значения.

5. **Privacy boundary.** Анонимный посетитель может генерировать события без
   регистрации. Без browser fingerprinting, без cross-device identity graph, без
   deanonymization, без raw IP в payload. `StorefrontContactClicked` хранит
   `contactType` (PHONE/EMAIL/WHATSAPP/WEBSITE/SOCIAL) и нормализованный
   `platform` для SOCIAL — НЕ само контактное значение. Consent/CMP платформа —
   deferred product/privacy decision (не реализуется здесь).

6. **Neutral behavior.** Ingestion: синтаксически невалидные события → 4xx
   (клиент должен чинить баги); семантически непубличные ресурсы (DRAFT/INACTIVE
   storefront, NONE/SUSPENDED/EXPIRED entitlement, непубличный/чужой/неканальный
   Product) → 202 + silent drop (neutral, без раскрытия скрытого состояния);
   duplicate `eventId` → 202 (dedup). Preview НЕ считается public событием.

7. **Reuse.** Валидация публичности/ownership/channel переиспользует
   authoritative predicates `PublicCatalogService` (getPublicStorefront /
   getStorefrontProductDetail) — без расходящейся копии бизнес-логики.

## Consequences

- Storefront analytics foundation готова без Analytics domain и без принятия
  commercial-решений; стабильные идентификаторы (SF-*, P-*, eventId, sessionId,
  acquisitionSource) пригодны для будущей propagation.
- Catalog НЕ становится владельцем всей аналитики: 1.13B и агрегация
  пересматривают ownership; envelope/session/source инфраструктура переиспользуема.

---

# ADR-0008 Amendment (Step 1.13B): Marketplace Behavioral Events

- **Status:** Accepted (Phase 1 Step 1.13B)
- **Date:** 2026-08-09

## Context

Step 1.12.3 создал behavioral instrumentation только для публичной Storefront.
Step 1.13B расширяет ту же дисциплину на публичный Marketplace: честно
фиксировать visits / product impressions / product views / category views /
search executions / filter/sort/CTA-намерения Marketplace, чтобы будущая
аналитика считала их без реконструкции из access logs. Это НЕ Analytics engine
и НЕ изменение Storefront ownership.

## Decision

1. **Расширение foundation, НЕ новый bounded context.** Marketplace behavioral
   events используют ту же semantic discipline и тот же envelope, что Storefront
   (eventId dedup, occurredAt/receivedAt, sessionId opaque non-PII, locale, path,
   acquisitionSource server-authoritative, neutral-drop, per-eventType payload
   whitelist). Durable storage — отдельная narrow-таблица
   `catalog.MarketplaceBehavioralEvent` (потому что у Marketplace нет storefrontId;
   Storefront-события и их таблица НЕ трогаются).

2. **Ownership остаётся Catalog/Storefront-module** (behavioral instrumentation),
   как и в 1.12.3. Никакой перенос ownership существующих Storefront events,
   никакой destructive migration, никакого нового bounded context `Analytics`.

3. **Publication ≠ acquisition сохранено.** Для Marketplace events сервер
   authoritatively фиксирует `acquisitionSource = MARKETPLACE`. Publication
   channel Product (MARKETPLACE/PARTNER_STOREFRONT/BOTH) из behavioral events
   НЕ мутирует и источник не меняет.

4. **Server-authoritative resolution.** productId/categoryId резолвятся сервером
   из slug'ов через те же public predicates, что и read-контур
   (`marketplaceWhere()`: PUBLISHED + publishedAt + MARKETPLACE channel; категория
   ACTIVE). Клиент не может forged productId/categoryId/partnerId/sellerId/
   storefrontId/customerId/userId/acquisitionSource.

5. **Search privacy guard.** `MARKETPLACE_SEARCH_PERFORMED` хранит только
   нормализованную/усечённую query (trim + collapse + max 80) с запретом
   email/phone/URL-like контента (422). Raw PII-поиск не сохраняется.

6. **Без изменений Storefront контракта.** Storefront events/таблица/endpoint
   не изменены; sessionId Marketplace — отдельный opaque namespace
   (`travelhub.mp.sessionId`), НЕ трогает существующий `travelhub.sf.sessionId`
   (без регрессии; объединение сессий — deferred, без visitorId).

## Consequences

- Marketplace raw data позволяет будущей аналитике считать Marketplace visits /
  impressions / PDP views / category views / search executions / impression→PDP
  funnel / Marketplace vs Storefront source comparison — без реконструкции из
  access logs. Aggregation/dashboards/BI/attribution — НЕ реализуются (deferred).
- Acquisition propagation в Order/Booking/Payment НЕ выполняется (Step 1.13B —
  только behavioral acquisition context; propagation — будущие canonical flows).
- Две narrow behavioral таблицы (Storefront + Marketplace) — осознанное решение:
  общий envelope и helpers, раздельная physical storage (storefrontId обязателен
  только в Storefront-контексте).

## Alternatives considered

- **Generalized единая behavioral таблица** — отклонено: потребовала бы
  nullable storefrontId и изменения существующих Storefront событий (риск
  регрессии 1.12.3); расширение (вариант A из Step 1.13B §2) безопаснее и
  доказуемо.
- **Новый bounded context Analytics** — отклонено (как и в 1.12.3).
- **events.Outbox для behavioral** — отклонено (behavioral ≠ business events).
- **Persistent visitorId / authenticated tracking** — отклонено (privacy).
- Public ingestion endpoint не требует Authorization; authenticated identity в
  событиях не захватывается на этом шаге (privacy-safe, deferred).
- Anti-spam/rate-limiting полноценно не реализуется (narrow DTO + size limits +
  dedup; тяжёлая anti-fraud — вне scope, рассматривается при 1.13B).

## Alternatives considered

- **Новая схема/домен `analytics`** — отклонено: преждевременный bounded context
  ради foundation (запрещено §2).
- **`events.OutboxEvent` для behavioral events** — отклонено: смешение с business
  domain events (запрещено §10).
- **Без durable storage** — отклонено: требуется durability/dedup/observability
  (§10), иначе foundation бесполезна для будущих метрик.
- **Catalog как владелец всей будущей analytics** — отклонено: нарушает §2,
  ownership 1.13B пересматривается.
