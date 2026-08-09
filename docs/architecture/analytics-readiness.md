# TravelHub — Phase 1 Analytics Readiness (Step 1.18A)

Дата: 2026-08-10. Статус: **PASS** (verdict в конце). Источник истины — фактический
код/schema/migrations + runtime-пробы (не отчёты). Документ — выходной артефакт
Step 1.18A Analytics Readiness Gate. НЕ является BI/dashboard/warehouse-дизайном.

---

## 1. Определение analytics-ready (§3)

Объект analytics-ready, если для каждого критичного business fact известны: что
произошло; canonical entity; когда (реальный timestamp); кто/что инициировал (где
нужно); source-of-truth; различимость lifecycle-переходов; неизменяемость истории
(повторные переходы не затирают, PATCH не переписывает); legacy unknown отличим
от «не происходило»; joins по canonical IDs.

`NULL / UNKNOWN` честнее выдуманной истории. `updatedAt` никогда не milestone.

## 2. Readiness matrix (§4) — фактическая

| Domain | Entity | Business fact | Source of truth | Timestamp/event | Actor | Historical? | READY/GAP | Owner |
|---|---|---|---|---|---|---|---|---|
| Catalog | Product | создан | `catalog.Product` | `createdAt` | `createdBy` | ProductHistory `created` | READY | Catalog |
| Catalog | Product | подан на модерацию | `ModerationSubmission` | `submittedAt` | `submittedById/Username` | `ProductHistory moderation.submitted` | READY | Catalog |
| Catalog | Product | ревью начато | `ModerationSubmission` | `reviewStartedAt` | `assignedModeratorId` | `ProductHistory` | READY | Catalog |
| Catalog | Product | решение | `ModerationSubmission` | `decidedAt` | `assignedModeratorId` | `ProductHistory` + `previousSubmissionId` | READY | Catalog |
| Catalog | Product | опубликован | `Product.publishedAt` | `publishedAt` | `updatedBy` | `ProductHistory publish` + `ProductPublished` (outbox) | READY | Catalog |
| Catalog | Product | архивирован | `Product.status=ARCHIVED` | (нет колонки) | `updatedBy` | `ProductHistory archive` + `ProductArchived` (outbox) | READY (история) | Catalog |
| Catalog | Product | change proposal | `ProductDraft` + `ModerationSubmission(draftVersion)` | `ProductDraft.createdAt/updatedAt`, `submittedAt` | `createdById/updatedById` | `ProductHistory change_proposal.*` | READY | Catalog |
| Catalog | ProductPublicationChannel | изменён | `ProductPublicationChannel` | `createdAt` | `createdById` | `ProductHistory channels.updated` | READY (current-state + history transitions) | Catalog |
| Catalog | ProductMedia | загружено | `ProductMedia.createdAt` | `createdAt` | `createdById` | `ProductHistory media.uploaded` | READY | Catalog |
| Catalog | Category | создана | `catalog.Category.createdAt` | `createdAt` (nullable) | — | — | READY с 1.13A; legacy NULL | Catalog |
| Catalog | CategorySchema | активирована | `CategorySchema.activatedAt` | `activatedAt` | — | — (однонаправленный) | READY с 1.13A; legacy NULL | Catalog |
| Catalog | PublicSellerProfile | создан | `PublicSellerProfile` | `memberSince`/`createdAt` | — | — | READY | Catalog |
| Catalog | PublicSellerProfile | решение по identity | `PublicSellerProfileProposal` | `submittedAt/reviewedAt` | `reviewedById/Username` | proposal history + `approvedAt/approvedById` | READY | Catalog |
| Catalog | PartnerStorefront | создана | `PartnerStorefront.createdAt` | `createdAt` | `createdById` | AuditLog `storefront.created` | READY | Catalog |
| Catalog | PartnerStorefront | активирована/деактивирована | `activatedAt/deactivatedAt` + AuditLog | `activatedAt/deactivatedAt` | `activatedById/deactivatedById` | AuditLog `storefront.activated/deactivated` (все циклы) | READY | Catalog |
| Catalog | PartnerStorefront | entitlement | AuditLog `storefront.entitlement_changed` | AuditLog `createdAt` | actor | `details.from/to` | READY (последовательность из audit) | Catalog |
| Catalog | StorefrontMedia | загружено | `StorefrontMedia.createdAt` | `createdAt` | `createdById` | — | READY | Catalog |
| Catalog | MarketplaceBehavioralEvent | взаимодействие | `MarketplaceBehavioralEvent` | `occurredAt` (client UTC) | anonymous | `receivedAt`, unique `eventId`, indexes | READY с 1.13B | Catalog |
| Catalog | StorefrontBehavioralEvent | взаимодействие | `StorefrontBehavioralEvent` | `occurredAt` (client UTC) | anonymous | `receivedAt`, unique `eventId`, indexes | READY с 1.12.3 | Catalog |
| Security | User/Buyer | регистрация | `security.User.createdAt` | `createdAt` | — | AuditLog `auth.register` + `CustomerHistory created` | READY | Security |
| CRM | Customer | создан | `crm.Customer.createdAt` + `CustomerCreated` | `createdAt` / event | actor | `CustomerHistory created` | READY | CRM |
| CRM | Partner | создан/linked | `PartnerCreated` (outbox) + `PartnerApplication.reviewedAt` + `PublicSellerProfile.createdAt` | event `createdAt` | `reviewedById` | outbox + `PartnerApplicationHistory` | READY (NO entity-time column; восстановимо) | CRM |
| Security | PartnerApplication | подан/решён | `PartnerApplication` | `submittedAt/reviewedAt` | `reviewedById/Username` | `PartnerApplicationHistory` | READY | Security |
| Communication | Communication | факт | `Communication.occurredAt` | `occurredAt` (server UTC) | `actorUserId` | immutable row | READY | Communication |
| Order | Order | создан + canonical переходы | `order.Order` + `OrderHistory` + canonical events | `createdAt`; события `OrderReadyForBooking/Fulfilled/Closed` | `createdBy/updatedBy` | `OrderHistory` + outbox | READY (хронология); milestone-колонки — Phase 2 | Order |
| Booking | Booking | создан + canonical переходы | `booking.Booking` + `BookingHistory` + events | `createdAt`; `BookingRequested/Confirmed/Rejected/Cancelled` | — | `BookingHistory` + outbox | READY (хронология); temporal-колонки — Phase 2 | Booking |
| Events | OutboxEvent | факт события | `events.OutboxEvent` | `createdAt` (атомарно с переходом) | `actor` (JSON, с 1.15A) | immutable envelope | READY | Events |
| Security | AuditLog | security/operational факт | `security.AuditLog` | `createdAt` | `userId/username` | immutable | READY (только где контракт делает source) | Security |

## 3. Критические направления (§5–§23) — вердикты

### Product chronology (§5–§6) — READY
`createdAt <= submittedAt <= reviewStartedAt <= decidedAt <= publishedAt` доказано
e2e (analytics-readiness #1). `updatedAt` не используется как milestone: PATCH
PUBLISHED идёт через change-proposal N+1 (live N не трогается), `publishedAt`
ставится только в publish-переходе (temporal-readiness e2e #4/#5).

**Publication channel history:** `ProductPublicationChannel` хранит current-state
(createdAt первой установки); изменения каналов фиксируются в `ProductHistory
channels.updated` (from/to). Метрика «сколько Product реально доступно в канале
на дату X»: current-state analytics — READY; full historical channel timeline —
ограничена (нет отдельной channel-history таблицы). Классификация:
**current-state analytics ready; historical channel analytics частично (из
ProductHistory transitions); полноценная channel history — не требование Phase 1,
owner: Phase 2 при необходимости**. Ничего не фабрикуется.

### Moderation (§7) — READY
`submittedAt/reviewStartedAt/decidedAt`, оба актора, snapshot immutable,
`previousSubmissionId` chain (доказано e2e #2). Метрики lead time / time-to-review
/ approval-rate / repeated submissions — вычислимы.

### Seller identity (§8) — READY
`PublicSellerProfile.memberSince/createdAt`, `approvedAt/approvedById`,
proposal `submittedAt/reviewedAt/reviewedById`, visibility transitions только
через APPROVED proposal (CAS version). «Какая seller identity была действующей на
дату X» — из proposal chain + approvedAt. Storefront business identity НЕ является
Marketplace identity history (раздельные модели — не смешиваются).

### Partner onboarding (§9) — READY
`PartnerApplication.submittedAt/reviewedAt/reviewedById`, `PartnerApplicationHistory`,
`PartnerCreated` outbox event, Catalog `PublicSellerProfile.createdAt` (проекция).
**`crm.Partner` НЕ имеет createdAt/updatedAt (documented gap):** время становления
canonical Partner восстанавливается из связки `reviewedAt` (approve-транзакция) +
`PartnerCreated` event + `PublicSellerProfile.createdAt`. Не копируется
application.reviewedAt в несуществующую колонку Partner — восстановление через
immutable события. Class: **READY via events; dedicated Partner entity-time —
future step (owner: Phase 2 partner lifecycle commands)**.

### Buyer/Customer (§10) — READY
`User.createdAt` (регистрация), `Customer.createdAt` + `CustomerCreated` event +
`CustomerHistory created` (создание проекции), `User.customerId` каноническая
связь. Различимы: время регистрации аккаунта vs создание Customer projection.
Login/verification time не используется как registration time.

### Storefront lifecycle (§11–§13) — READY
`createdAt/activatedAt/deactivatedAt` + actor-колонки + AuditLog
`storefront.activated/deactivated` с createdAt — **все циклы восстановимы**
(доказано e2e #5: activate→deactivate→activate даёт 3 audit-строки в порядке).
Колонки хранят последний цикл, история циклов — в AuditLog (immutable).

### Storefront entitlement (§12) — READY
AuditLog `storefront.entitlement_changed` c `details.from/to` + actor + createdAt.
Последовательность NONE→ACTIVE→SUSPENDED→ACTIVE доказана e2e #5 (из audit).
Billing domain не создаётся.

### Storefront content history (§13) — ACCEPTED NON-CRITICAL GAP
PATCH businessName/tagline/description/contacts логируется `storefront.updated`
в AuditLog (без full diff), но полная версионная история текстов не хранится.
Class: **non-critical** — критичные аналитические факты (public lifecycle,
entitlement, traffic, product views, contact clicks) восстановимы; историческая
текстовая копия — presentation-only, Roadmap не делает её analytical fact.

### Marketplace behavioral (§14) — READY
8 event types (VIEWED/SEARCH/CATEGORY/PRODUCT_IMPRESSION/PRODUCT_VIEWED/
FILTER/SORT/CTA), unique eventId dedup, occurredAt/receivedAt, sessionId,
server-resolved canonical productId/categoryId, acquisitionSource= MARKETPLACE
server-authoritative, locale/path. Funnel metrics: sessions, views, impressions,
intra-session funnel — вычислимы.

### Storefront behavioral (§15) — READY
4 event types, та же дисциплина; CONTACT_CLICKED хранит contactType БЕЗ значения
(доказано e2e #8). Preview не загрязняет: preview-контур не инжектит behavioral
events (проверено в 1.12.3 review).

### Semantic stability (§16) — READY с зафиксированной границей
Semantics задокументированы в schema-комментариях/contracts (impression =
rendered-card, search = committed, contact click = intent, не lead/conversion).
Schema registry не вводится; изменение semantics — через migration/version note
(debt зафиксирован).

### Session limitations (§17) — честно ограничено
sessionId — opaque, browser-session, без visitorId/cross-device. Доступно: сессии,
views, impressions, funnel внутри сессии. НЕДОСТУПНО: unique people, cross-device,
long-term retention, person-level attribution. sessionId НЕ называется
«unique visitor».

### Acquisition/source (§18) — READY (interaction attribution)
MARKETPLACE/PARTNER_STOREFRONT — server-authoritative на ingestion; DIRECT
зарезервирован, не симулируется. Interaction attribution ready; transaction
attribution (Sale/Payment acquisition propagation) — Phase 2 gap (не blocker).

### AuditLog boundary (§19) — соблюдено
AuditLog используется как source только там, где контракт явно делает его
source (storefront entitlement from→to, lifecycle-циклы витрины). Business-event
chronology — из canonical events/history, не из generic AuditLog.

### Business-event analytics (§20–§21) — READY
Envelope: eventType/aggregateId/occurredAt(createdAt atomic)/actor/correlation/
causation. Order ready/fulfilled/closed, BookingRequested/Confirmed/Rejected —
вычислимы из outbox. `occurredAt` = время факта: emit атомарен с переходом
(state + history + outbox в одной tx — подтверждено 1.17/1.18); consumer-produced
child events пишут своё createdAt (не parent time).

### Communication (§22) — READY
`occurredAt` server-UTC атомарно с фактом; type/direction/context/actorClass;
NOTE/INTERNAL excluded из own-списков (total тоже, проверено 1.17). Body не нужен
для базовых метрик. Retention debt — отдельно (ниже).

### Order/Booking (§23) — READY (transitional)
createdAt + immutable history + canonical events дают хронологию. Milestone-
колонки (confirmedAt/cancelledAt/fulfilledAt/closedAt, Booking request/confirm/
cancel + IANA) — Phase 2 (2.5A/2.8A-2.9A). НЕ фабрикуются.

## 4. Repeatable lifecycle matrix (§24)

| Lifecycle | Repeats? | Column only? | History/event? | Все циклы восстановимы? |
|---|---|---|---|---|
| Storefront activate/deactivate | да | колонки = последний цикл | AuditLog `storefront.activated/deactivated` | ДА (audit) |
| Storefront entitlement | да | current `entitlementStatus` | AuditLog `storefront.entitlement_changed` from/to | ДА (audit) |
| Moderation resubmission | да | нет | `ModerationSubmission` + `previousSubmissionId` | ДА |
| Product publish/archive/republish | да (change proposal) | `publishedAt` = последний | `ProductHistory` + `ProductPublished/Archived` | ДА |
| Seller proposals | да | profile current | proposal chain + approvedAt | ДА |
| CategorySchema | нет (однонаправлен) | activatedAt/deprecatedAt | — | ДА (нет повторов) |

## 5. Actor completeness (§25)

- USER: Product/Moderation (submittedBy/assignedModerator/updatedBy), Storefront
  (activatedById/deactivatedById), AuditLog (userId/username), Proposal
  (reviewedById).
- SYSTEM: outbox `actor: {type:"SYSTEM"}` для consumer-произведённых фактов
  (с 1.15A).
- Anonymous: behavioral события (сознательно без actor).
- Legacy: actor unknown — не фабрикуется (NULL).

## 6. Canonical references / historical identity (§26–§27)

Joins только по canonical IDs: Product/Partner/Customer/Storefront/SellerProfile/
Category/Order/Booking/Communication. Slug — presentation identity, не join key
для analytics. Hard-delete отсутствует для исторических сущностей (audit by
default; cascade только тестовый cleanup). Historical-label accuracy — отдельно
классифицировано как non-critical.

## 7. Legacy data audit (§28–§29) — dev-БД (travelhub1, probe-only)

| Entity | Total | Fully temporal | Legacy unknown | Reconstructable | Irrecoverable |
|---|---|---|---|---|---|
| Product | 42 | 42 (createdAt; 8 publishedAt) | 0 | 42 (history/events) | 0 |
| ProductDraft | 0 | 0 | — | — | 0 |
| ModerationSubmission | 0 (dev) | — | — | — | 0 (e2e-доказано) |
| Category | 18 | 0 | 18 (createdAt NULL — seed до 1.13A) | 0 (сознательно) | 0 (критичной хронологии нет: категории не lifecycle) |
| CategorySchema | 19 | 1 (activatedAt) | 18 (DRAFT, milestone не происходил) | 0 | 0 |
| PublicSellerProfile | 2 | 2 | 0 | 0 | 0 |
| PartnerStorefront | 0 (dev) | — | — | — | 0 (e2e-доказано) |
| Storefront/MP behavioral | 106 (MP) / 0 (SF) | 106 | 0 | 0 | 0 |
| Partner | 2 | нет entity-time | — | 2 (PartnerCreated + reviewedAt + profile) | 0 |
| Customer | 39 | 39 | 0 | 0 | 0 |
| Order/Booking | 26/15 | 26/15 | 0 | history+events | 0 |
| Communication | 0 (dev) | — | — | — | 0 |
| User | 51 | 51 | 0 | 0 | 0 |
| PartnerApplication | 1 | 1 | 0 | 0 | 0 |
| AuditLog | 682 | 682 | 0 | 0 | 0 |
| OutboxEvent | 422 | 422 | 0 | 0 | 0 |

**Irrecoverable critical gaps: НЕТ.** Единственный legacy unknown — Category
entity-time (18 строк seed до миграции 1.13A) — некритичен (категории не имеют
повторяющихся lifecycle-переходов; дата создания категории — presentation/
конфигурационный факт, не критичная business chronology). Запрет на backfill
соблюдён: значения не менялись, NULL остался NULL (e2e #9).

## 8. Funnel availability (§31–§32)

**Marketplace:** visit → search/category → product impression → product view →
(будущий commercial intent — Phase 2). Все 4 доступные стадии измеримы по raw
истории (e2e #7). ProductView→Sale conversion НЕ заявляется.

**Storefront:** view → product impression → product view → contact click. 4 стадии
измеримы (e2e #8). ContactClick = intent, НЕ lead/sale.

## 9. Current-state vs historical (§53)

- Current-state ready: Product channels, Storefront state, entitlement current,
  visibility current.
- Historical ready: все lifecycle-переходы (Product/Moderation/Seller/Partner/
  Storefront cycles/entitlement cycles/Order/Booking events) — из history/events/
  audit.
- Historical НЕ ready (accepted): полная текстовая конфигурация витрины;
  historical channel availability по дням (только transitions).

## 10. Privacy/data minimization (§36–§37)

Behavioral payload: whitelist per eventType, no PII, no raw IP, no tokens, no
contact values (e2e #10: forged email/phone → 422, stored payloads без контактов).
Event payloads: canonical refs только (CustomerCreated/PartnerCreated без
email/phone — verified). Traveler/passenger PII redacted на HTTP-контуре для
не-OPERATOR/ADMIN (pii-redaction e2e). Communication body не входит в analytics
foundation. **Retention assumption:** analytics-history claims предполагают
хранение behavioral/AuditLog/Outbox по retention-политике Phase 3 (3.45A +
Deferred); до этого — явное допущение, не реализация.

## 11. Timezone/monotonicity (§38–§39)

Все instant-поля UTC (Postgres TIMESTAMP + ISO Z). `serviceDate` — service-local,
НЕ конвертируется. Monotonicity: created <= submitted <= reviewStarted <= decided
<= published; storefront created <= activated; entitlement/activation sequences —
доказаны e2e. Behavioral occurredAt/receivedAt — отдельные семантики, skew окно
±10 мин.

## 12. Migration temporal audit (§40–§41)

21 миграций; 1.13A (`20260809110000_add_temporal_readiness`) — аддитивные
nullable колонки (Category.createdAt/updatedAt, CategorySchema.activatedAt/
deprecatedAt) без backfill: legacy NULL остаётся NULL. Нет `NOW()` для
неизвестного прошлого, нет copy updatedAt→lifecycle, нет actor fabrication.
Step 1.18A изменений schema не вносит (gate, не feature sprint).

## 13. History/event immutability (§42–§44)

`*_history` таблицы и AuditLog: нет normal update/delete путей (кроме тестового
cleanup). Outbox envelope после persist неизменяем (status/attempts/error —
processing-отдельно). FAILED retry debt — не потеря analytics history: Outbox
row durable (доказано outbox-failure-injection e2e). Dedup: behavioral unique
eventId (e2e #7), Inbox consumerId+eventId unique, idempotent retry команд не
дублирует canonical events.

## 14. Data-quality tests (§45–§46)

`backend/test/analytics-readiness.e2e-spec.ts` (10 сценариев):
1. Product create→moderate→publish chronology (монотонность + history + event);
2. change proposal/resubmission (previousSubmissionId chain);
3. Partner application→approval chronology (+ PartnerCreated + profile + User.partnerId);
4. Seller proposal lifecycle (submittedAt<=reviewedAt; approvedAt/approvedById);
5. Storefront activate/deactivate/activate + entitlement sequence из AuditLog;
6. Buyer/Customer creation chronology (+ CustomerCreated + CustomerHistory);
7. Marketplace behavioral funnel (order, dedup, server-resolved productId);
8. Storefront behavioral funnel (contactType без значения);
9. legacy NULL остаётся NULL (Category/DRAFT schema);
10. no PII в behavioral/event foundation (forged → 422; payload-аудит).

Плюс существующие: temporal-readiness.e2e (6), storefront-behavioral (16),
marketplace-behavioral (16), pii-redaction (7), outbox-failure-injection (2).

## 15. Representative query feasibility (§51) — dev-БД

| Metric | Query | Результат |
|---|---|---|
| Products published per day | `Product.publishedAt` group by day | 2 дня (2026-08-07: 1, 08-09: 7) — вычислимо |
| Marketplace product views per product | `MarketplaceBehavioralEvent` group by productId | топ-1: 5 views — вычислимо |
| Storefront contact clicks by type | payload->>'contactType' | пусто в dev (нет SF-данных), SQL выполним |
| Sessions with product view | count distinct sessionId | 4 — вычислимо |
| Partner approvals per day | `PartnerApplication.reviewedAt` group by day | 1 — вычислимо |
| Moderation lead time | avg(decidedAt-submittedAt) | пусто в dev (0 decided), SQL выполним |
| Storefront active intervals | columns + AuditLog cycles | 0 active в dev; интервалы из audit — e2e #5 |

## 16. Reliable-from horizons (§56–§57)

| Dataset | Reliable from |
|---|---|
| Category entity-time / CategorySchema lifecycle | миграция `20260809110000_add_temporal_readiness` (Step 1.13A) onward; до — legacy unknown |
| Storefront behavioral | миграция `20260808225507_add_storefront_behavioral_events` (Step 1.12.3) onward |
| Marketplace behavioral | миграция `20260809130000_add_marketplace_behavioral_events` (Step 1.13B) onward |
| Business event actor (USER/SYSTEM) | миграция `20260809140000_add_business_event_actor` (Step 1.15A) onward; раньше — actor NULL |
| Communication | миграция `20260809172257_add_communication_foundation` (Step 1.16) onward |
| Product/Moderation/Seller/Partner/Storefront lifecycle | с соответствующих Steps 1.1–1.12 (нет legacy-инструментационного разрыва в dev/test) |
| Calendar deployment date | не выдумывается; указывается migration/version |

Semantic boundaries: ProductImpression = rendered-card с 1.13B (storefront — с
1.12.3); re-интерпретация более ранних строк не выполняется.

## 17. Reconcile с temporal-readiness.md (§59)

Противоречий нет: temporal-readiness v1 claims подтверждены независимо
(entitlement NO GAP via audit; Partner create/link NO GAP via events;
Category legacy NULL; updatedAt discipline). Дополнения этого документа:
1) channel publication history классифицирован (current-state + transitions,
   полная historical channel availability — future); 2) Storefront content history
   классифицирован non-critical; 3) добавлены reliable-from horizons и data
   coverage; 4) analytics-границы (AuditLog/session/retention) явные.

## 18. Deferred Decisions compliance (§60)

НЕ реализовано: dashboard/BI, attribution model сверх acquisitionSource,
visitor identity, cookie/CMP, warehouse, retention engine, AI analytics,
predictive metrics, Storefront plan analytics, Partner CRM analytics,
revenue/finance analytics, cross-device tracking. Новых DD не требуется.

## 19. Остаточный debt (Phase 2 / future)

- `crm.Partner` entity-time columns — при partner lifecycle commands (Phase 2).
- Order milestone columns — 2.5A/2.7; Booking temporal — 2.8A/2.9A.
- Historical channel availability по дням — по необходимости (Phase 2+).
- Outbox automated retry/recovery — 2.17 (durable, не потеря).
- Retention policy — 3.45A + DD.
- Storefront content full version history — non-critical, при необходимости.

---

## Verdict

**PHASE 1 STEP 1.18A ANALYTICS READINESS GATE PASSED WITH LEGACY LIMITATIONS — READY FOR STEP 2.0**

Критических lifecycle gaps нет; неизвестное относится к pre-instrumentation
legacy (Category entity-time) и явно сегментировано; полная история критичных
переходов восстановима из immutable history/events/audit; privacy-границы
сохранены; regression зелёная.
