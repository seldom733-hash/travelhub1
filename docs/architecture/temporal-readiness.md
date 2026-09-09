# TravelHub — Temporal & Analytics Readiness (Phase 1 Step 1.13A)

Дата: 2026-08-09. Статус: актуально для Phase 1 (+ D8 addendum §16, 2026-09-09).

Документ — результат **полного temporal audit** существующих business entities и
lifecycle'ов (Step 1.13A). Цель — не создать новые бизнес-процессы, а сделать
существующую платформу пригодной для восстановления фактической хронологии и
будущей аналитики. Никаких новых Order/Booking/Payment/Finance/Support/Documents
lifecycle'ов здесь НЕ вводится.

---

## 1. Temporal taxonomy (§3)

Все system/business-моменты — **однозначные UTC instants** (Prisma `DateTime`
→ ISO-8601 с суффиксом `Z`; сериализация `toISOString()`; frontend — `formatDate`).

| Категория | Поля | Семантика |
|---|---|---|
| **Entity time** | `createdAt`, `updatedAt` | когда объект создан / последний раз изменён |
| **Lifecycle time** | `submittedAt`, `reviewStartedAt`, `decidedAt`, `publishedAt`, `activatedAt`, `deactivatedAt`, `deprecatedAt`, `approvedAt`, `reviewedAt`, `memberSince` | реальные бизнес-переходы |
| **Event time** | `OutboxEvent.createdAt`, `StorefrontBehavioralEvent.occurredAt` | когда факт/событие произошло |
| **Processing time** | `receivedAt` (behavioral), `publishedAt` (outbox), `processedAt` (inbox) | когда система обработала |

Категории **не смешиваются**: `updatedAt` никогда не заменяет lifecycle-момент.

## 2. Analytics readiness matrix (§18)

| Entity | Business Fact | Source of Truth | Timestamp | Actor | History | Ready | Gap |
|---|---|---|---|---|---|---|---|
| Product | создан | `catalog.Product` | `createdAt` | `createdBy` | `ProductHistory(action=created)` | ✅ | — |
| Product | подан на модерацию | `ModerationSubmission` | `submittedAt` | `submittedByUsername` | `ProductHistory(action=moderation.submitted)` | ✅ | — |
| Product | ревью начато | `ModerationSubmission` | `reviewStartedAt` | `assignedModeratorUsername` | `ProductHistory` | ✅ | — |
| Product | решение | `ModerationSubmission` | `decidedAt` | `assignedModeratorUsername` | `ProductHistory` + `previousSubmissionId` | ✅ | — |
| Product | опубликован | `Product.publishedAt` | `publishedAt` | `updatedBy` | `ProductHistory(action=publish)` + `ProductPublished` event | ✅ | — |
| Product | заархивирован | `Product.status=ARCHIVED` | (нет колонки) | `updatedBy` | `ProductHistory(action=archive)` + `ProductArchived` event | ✅ | NO GAP (history) |
| Product | material change proposal | `ProductDraft` + `ModerationSubmission(draftVersion)` | `ProductDraft.updatedAt` / `submittedAt` | `createdById/updatedById` | `ProductHistory(action=change_proposal.edited)` | ✅ | — |
| ProductMedia | загружено | `ProductMedia.createdAt` | `createdAt` | `createdById` | `ProductHistory(action=media.uploaded)` | ✅ | — |
| ProductMedia | опубликовано | product publish tx | (нет колонки) | — | `ProductHistory(action=publish)` (та же tx) | ✅ | NO GAP (history, точная tx) |
| ProductMedia | заменено | `ProductMedia.status=DRAFT` | `updatedAt` | — | `ProductHistory(action=media.replaced)` | ✅ | NO GAP |
| Category | создана | `catalog.Category.createdAt` | `createdAt` ✅ (FIX) | — | — | ✅ | FIXED |
| CategorySchema | активирована | `CategorySchema.activatedAt` | `activatedAt` ✅ (FIX) | — | — | ✅ | FIXED |
| CategorySchema | деприкейтед | `CategorySchema.deprecatedAt` | `deprecatedAt` ✅ (FIX) | — | — | ✅ | FIXED |
| Moderation | все циклы | `ModerationSubmission` + `previousSubmissionId` | `submittedAt/reviewStartedAt/decidedAt` | оба актора | snapshot + `ProductHistory` | ✅ | — |
| PartnerApplication | создана/подана/решена | `security.PartnerApplication` | `submittedAt/reviewedAt` | `reviewedByUsername` | `PartnerApplicationHistory` | ✅ | — |
| CRM Partner | создан/linked | `PartnerCreated` event + `PartnerApplication.reviewedAt` | event `createdAt` / `reviewedAt` | `reviewedByUsername` | outbox + `PartnerApplicationHistory` + Catalog `PublicSellerProfile.createdAt` | ✅ | NO GAP (event+history) |
| PublicSellerProfile | создан | `catalog.PublicSellerProfile` | `memberSince`/`createdAt` | — | — | ✅ | — |
| Seller proposal | подан/решён | `PublicSellerProfileProposal` | `submittedAt/reviewedAt` | `reviewedByUsername` | CAS `version` | ✅ | — |
| PartnerStorefront | активирована/деактивирована | `PartnerStorefront` | `activatedAt/deactivatedAt` | `activatedById/deactivatedById` | AuditLog `storefront.activated/deactivated` | ✅ | — |
| Storefront entitlement | изменён | AuditLog `storefront.entitlement_changed` | AuditLog `createdAt` | actor | AuditLog from/to | ✅ | NO GAP (audit) |
| ProductPublicationChannel | изменён | `ProductPublicationChannel` | `createdAt` | `createdById` | `ProductHistory(action=channels.updated)` | ✅ | — |
| StorefrontBehavioralEvent | взаимодействие | `StorefrontBehavioralEvent` | `occurredAt` (client UTC) | — (anonymous) | `receivedAt`, `eventId` dedup, indexes | ✅ | — |
| MarketplaceBehavioralEvent (1.13B) | взаимодействие Marketplace | `MarketplaceBehavioralEvent` | `occurredAt` (client UTC) | — (anonymous) | `receivedAt`, `eventId` dedup, indexes | ✅ | — |
| User/Buyer | регистрация | `security.User.createdAt` + `CustomerCreated` + AuditLog `auth.register` | `createdAt` | — | `CustomerHistory(action=created)` | ✅ | — |
| CRM Customer | создан/изменён | `crm.Customer` | `createdAt/updatedAt` | actor | `CustomerHistory` | ✅ | — |
| legacy Order | создан | `order.Order` | `createdAt` | `createdBy` | `OrderHistory` + events | ✅ | см. §7 |
| legacy Booking | создан | `booking.Booking` | `createdAt` | — | `BookingHistory` + events | ✅ | см. §8 |
| legacy Payment | — | **не существует** (только `Order.paymentStatus/paidAmount`) | — | — | — | ✅ | см. §9 |

## 3. FIX NOW — сделанные изменения (§33)

1. **Category entity time** — `Category.createdAt/updatedAt` (nullable, additive):
   - `createCategory` и seed канонических категорий проставляют `createdAt` явно.
   - `updateCategoryTitle` → `updatedAt` (Prisma `@updatedAt`).
   - Legacy-строки (канонический seed до миграции) — `createdAt = NULL`
     (**LEGACY UNKNOWN**, §24), НЕ fake backfill.
2. **CategorySchema lifecycle timestamps** — `activatedAt/deprecatedAt`:
   - `activate` → `activatedAt`, superseded ACTIVE → `deprecatedAt` (та же tx);
   - `deprecate` → `deprecatedAt`;
   - повторная активация DEPRECATED — по-прежнему 409 (хронология не ломается);
   - NULL = milestone ещё не происходил / legacy unknown.

**Почему колонки, а не history (§15A/C):** lifecycle CategorySchema однонаправлен
(DRAFT→ACTIVE→DEPRECATED, DEPRECATED не реактивируется; одна ACTIVE на категорию) —
повторяющихся циклов нет, текущий milestone + суперсессия старой схемы достаточны.

## 4. Поля, осознанно НЕ добавленные (§15B / §5 "не дублировать хаотично")

| Поле | Почему нет |
|---|---|
| `Product.archivedAt` | archive не имеет milestone-колонки, но полная chronology — `ProductHistory(action=archive)` + `ProductArchived` (immutable). |
| `ProductMedia.publishedAt` | media публикуется атомарно с product publish в той же tx — `ProductHistory(action=publish)` фиксирует точный момент. |
| `Category.status` transitions | runtime-переходов status у Category нет (только create/rename) — `createdAt/updatedAt` покрывают. |
| `Order.confirmedAt/cancelledAt/fulfilledAt/closedAt` | canonical события реализованы (Step 1.14, факт-хронология из outbox); milestone-КОЛОНКИ — Step 2.5A/2.7, fake не вводим. |
| `Booking` request/confirm/cancel timestamps | будущая temporal-модель — Step 2.8A/2.9A. |
| `Payment.*` timestamps | Finance-модель не существует — GAP для 2.10C/2.12 (остаётся; producer/семантика — 2.12–2.14). |
| `LedgerTransaction.occurredAt` | РЕАЛИЗОВАН (Step 2.10C, 2026-08-14): бизнес-occurrence время факта (UTC), отдельно от `createdAt` (персистенция); NULL = неизвестно (без backfill); authority — server-валидированный ISO 8601; first-write-wins при replay. Детали — `finance-temporal-contract.md`. |
| `crm.Partner.createdAt/updatedAt` | создание/link доказуемо из `PartnerCreated` + `PartnerApplication.reviewedAt` + Catalog projection. |
| `User.activatedAt/deactivatedAt` | статус-переходы фиксируются AuditLog `user.status_changed`. |
| IANA timezone / `serviceStartsAt` | legacy `serviceDate` — service-local time; IANA-модель — future (2.8A/2.9A), отдельно от UTC instants. |

## 5. updatedAt discipline (§4) — проверено

- `publishedAt` ставится ТОЛЬКО в publish transition; обычный PATCH его не трогает
  (e2e #4/#5: PATCH PUBLISHED структурно 409, live N меняется только через
  change-proposal N+1).
- Storefront: PATCH не меняет `activatedAt/deactivatedAt` (e2e storefront §35).
- Frontend-лейблы: `pdp.published_on` (publishedAt), `product.updated` (updatedAt),
  account orders `createdAt` + `serviceDate` раздельно — misleading labels нет.

## 6. UTC / timezone (§20)

- Все `DateTime` — Postgres `TIMESTAMP(3)` + Prisma; сериализация `toISOString()` (Z).
- Behavioral `occurredAt` — client UTC в clock-skew окне; `receivedAt` — server
  (e2e storefront-behavioral §22).
- Legacy `serviceDate` — service-local data (не UTC instant и не lifecycle) — задокументировано.

## 7. legacy Order (§12) — canonical events сделаны, temporal-колонки GAP

- Честные timestamps: `createdAt` (создание), `updatedAt`, `serviceDate` (услуга).
- **Step 1.14 (сделано):** canonical Order факт-события `OrderReadyForBooking`
  (confirm), `OrderFulfilled` (complete/reconcile), `OrderClosed` (close)
  публикуются атомарно с переходом (state + OrderHistory + OutboxEvent в одной
  транзакции); event time = `OutboxEvent.createdAt`. `OrderStatusChanged` остаётся
  только для технических переходов.
- `confirmedAt/cancelledAt/fulfilledAt/closedAt` НЕ существуют (milestone-колонки
  — Step 2.5A/2.7, не раньше; факты воспроизводятся из canonical событий).

## 8. legacy Booking (§13) — GAP

- Честные timestamps: `createdAt`, `updatedAt`, `serviceDate`.
- Переходы — `BookingHistory` + события (`BookingConfirmed/Rejected/Cancelled/StatusChanged`).
- Нет request/confirm/cancel timestamps, нет IANA timezone/serviceStartsAt/serviceEndsAt.
- **Owner: Step 2.8A / 2.9A** (Booking temporal model).

## 9. legacy Payment (§14) — GAP

- Отдельной сущности **нет**: только `Order.paymentStatus` (UNPAID/PARTIALLY_PAID/
  PAID/REFUNDED) + `paidAmount`. Никаких fake milestone timestamps.
- Buyer Cabinet Payments — controlled empty contract (`available:false`), e2e проверяет.
- **Owner: Step 2.10C / 2.12** (Finance domain). legacy Payment НЕ объявлен
  authoritative Finance.

## 10. Actor / source / context (§16)

- Product/Moderation — actor (submittedBy/assignedModerator/updatedBy).
- Storefront — actor (activatedById/deactivatedById).
- AuditLog — username + action + resource + createdAt.
- Correlation: outbox `correlationId/causationId` (Step 1.15 infrastructure НЕ
  расширялся — без необходимости).

## 11. Security / privacy (§27)

- Public API отдаёт только whitelisted timestamps: `publishedAt`, `activatedAt`,
  `memberSince`. Внутренние (reviewStartedAt/decidedAt/audit) — только internal
  контурам (moderation/partner/owner). e2e public-catalog §17 проверяет DTO.

## 12. Indexes / performance (§26)

- Новые колонки (`Category.createdAt/updatedAt`, `CategorySchema.activatedAt/
  deprecatedAt`) — справочные/конфигурационные, НЕ индексированы (нет hot query
  path по ним; не индексируем "всё подряд").
- Существующие: `ModerationSubmission_submittedAt_idx`, behavioral
  `(storefrontId,occurredAt)` / `(eventType,occurredAt)` — достаточны.
- Step 1.13B: `MarketplaceBehavioralEvent` — `(eventType,occurredAt)`,
  `(productId,occurredAt)`, `(categoryId,occurredAt)`, `(sessionId)`,
  `(acquisitionSource,occurredAt)`, unique `eventId` — только обоснованные
  агрегации/debug, без дублирования Storefront-индексов.

## 13. GAP classification (§33)

- **FIX NOW**: Category entity time; CategorySchema lifecycle timestamps. — сделано.
- **FUTURE STEP**: Order milestone columns (2.5A/2.7; canonical события уже есть);
  Booking temporal (2.8A/2.9A); Payment (2.10C/2.12); `crm.Partner` entity time
  (при появлении partner lifecycle команд); `serviceDate` → IANA (2.8A).
- **LEGACY UNKNOWN**: `Category.createdAt`/`CategorySchema.activatedAt` для строк,
  созданных до миграции (NULL — честно, без угадывания из updatedAt).
- **NO GAP**: Product archive; ProductMedia publish; Storefront entitlement;
  Partner create/link; User status; behavioral chronology.

## 14. Deferred Decisions

Новых кандидатов DD-021+ не требуется: решения приняты в рамках существующих
ADR (0001/0003/0007/0008) без изменения ownership. Architecture decision не нужен.

## 15. Reconciliation — Step 1.18A Analytics Readiness (2026-08-10)

Глубокий аудит 1.18A подтвердил все claims этого документа (entitlement NO GAP
via AuditLog; Partner create/link NO GAP via events; Category legacy NULL;
updatedAt discipline). Два уточнения для честности:

1. **ProductPublicationChannel history**: колонка `createdAt` — момент первой
   установки канала (current-state); изменения каналов фиксируются в
   `ProductHistory channels.updated` (from/to). Метрика «сколько Product реально
   доступно в канале на дату X»: **current-state analytics ready; полная
   historical channel availability по дням — ограничена** (нужна отдельная
   channel-history таблица, если Phase 2 потребует; не требование Phase 1).
   Ряд матрицы остаётся READY (transitions), с классификацией в
   `analytics-readiness.md §2/§3`.
2. **Storefront content history** (businessName/tagline/description/contacts):
   `storefront.updated` AuditLog без full diff; полная версионная история
   текстов не хранится — **non-critical gap** (критичные факты: public lifecycle,
   entitlement, traffic, product views, contact clicks — восстановимы).

Полный artifact: `docs/architecture/analytics-readiness.md` (readiness matrix,
reliable-from horizons, data coverage, funnels, privacy boundary, debt owners).

## 16. D8 Addendum — Canonical Registry Temporal Vocabulary (2026-09-09)

D8 (Global Temporal Visibility) фиксирует канонический словарь для ВСЕХ
registry-поверхностей. Ни одна поверхность не вводит второй механизм
валидации или второй период-контракт.

### 16.1 Canonical date-param validation (B-06 fix, сделано)

Единый helper: `backend/src/shared/date-param.ts` — `parseDateParam(value, paramName)`.

| Вход | Результат |
|---|---|
| absent / пустая строка | `undefined` (фильтр не применяется) |
| валидное значение | `Date` (`YYYY-MM-DD` → UTC midnight) |
| malformed | `BadRequestException` → **HTTP 400**, message `"<paramName> must be a valid date"` |

- Валидация — синхронная, ДО построения any Prisma where (никогда не
  «молчаливый Invalid Date» в БД-запросе).
- `dateFrom`/`dateTo` валидируются НЕЗАВИСИМО (по одному вызову на параметр,
  имя параметра — в сообщении).
- Canonical response shape: `{ statusCode: 400, message, requestId? }` +
  `X-Request-Id` header (AppExceptionFilter, обычный путь).
- Scope границы контракта: registry QUERY-PARAM date filters only.
  Finance `ValidationDomainError` (422) для SUBMITTED financial payloads
  (напр. `LedgerTransaction.occurredAt`) — намеренно НЕ изменён. KPI-размерности
  (paymentStatus/currency/...) — остаются на Finance 422-контракте.

Применено (B-06 surfaces, все через `parseDateParam`):

| Поверхность | Метод(ы) | Дата-фильтр | Boundary | Pre-D8 поведение |
|---|---|---|---|---|
| Orders | `listOrders`, `exportOrders` | `createdAt` | `[from, to)` | молчаливый Invalid Date |
| Bookings | `listBookings`, `exportBookings` | `createdAt` | `[from, to)` | молчаливый Invalid Date |
| Requests | `listRequests`, `getRequestKpi` | `createdAt` | `[from, to)` | 400 (уже канонично; helper унифицирован) |
| Payments | registry `list` | `dateField` (`createdAt`\|`paidAt`, default `createdAt`) | `[from, to)` | 422 (выровнен на 400) |
| CRM customers | `listCustomers`, `exportCustomers` | активность: `Order.createdAt` | `[from, to)` | молчаливый Invalid Date |
| Catalog | `listProducts` | `publishedAt` | `[from, to]` end-of-day | молчаливый Invalid Date |
| CRM Activity | `listCustomerActivity`, `listPartnerActivity` | `occurredAt` | `gte/lte` (включающий конец) | **404** variant (исправлен на 400) |

Примечание: CRM Activity DTO `@IsDateString()` остаётся первым слоем
(global ValidationPipe → 400); `parseDateParam` — канонический защитный слой.
Public-catalog `available_from` (422) — public discovery-параметр, не registry
period filter (вне B-06, зафиксировано как variance).

### 16.2 Boundary semantics — канонический half-open `[from, to)`

Канонический registry-период: **half-open `[from, to)`** — включающий нижний,
ИСКЛЮЧАЮЩИЙ верхний boundary (`gte`/`lt`). Это совпадает с Analytics
`resolvePeriod` (presets/CUSTOM → `[start, endExclusive)`), что делает
KPI-скоп и table-скоп сравнимыми.

Задокументированные осознанные вариации (единственные допущенные):
- **Catalog `publishedAt`**: `[from, to]` end-of-day inclusive (`lte` +
  23:59:59.999) — day-granularity семантика публикации.
- **CRM Activity `occurredAt`**: включающий верхний `lte` — event-feed
  курсорная семантика.
Обе вариации НЕ переносятся на другие поверхности без явного решения D-track.

### 16.3 Default registry temporal dimension

Терминология: «registry period» = период фильтрации списка (query-param
`dateFrom`/`dateTo`); «registry temporal dimension» = canonical date-поле,
по которому период применяется (см. таблицу 16.1). По умолчанию — entity
времени (`createdAt`), КРОМЕ: Payments (переключаемое `dateField`:
`createdAt`\|`paidAt`), CRM customers (активность через `Order.createdAt`),
Catalog (`publishedAt` — lifecycle-время публикации), CRM Activity
(`occurredAt` — event time). Смешение с lifecycle/event time категорий §1
не допускается: период фильтрует по объявленному dimension, не подменяя его.

### 16.4 Timezone layers (три слоя, канонические имена)

1. **UTC instants** — все `DateTime` колонки/сериализация (§6 этого документа;
   `toISOString()` с `Z`).
2. **Service-local calendar** — legacy `serviceDate` (date-only, service-local
   дата; НЕ UTC instant).
3. **IANA zone facts** — `serviceTimeZone`/`serviceTime` (Step 2.8A; валидные
   IANA имена, authority server-side).
Period-resolution для Analytics — server-side, default timezone **UTC**
(`analytics-period.resolver.ts`); frontend никогда не ресолвит период сам
(передаёт preset/CUSTOM — server-authoritative).

### 16.5 Analytics temporal visibility (D8 scope statement)

D8 покрывает Analytics только на уровне **temporal visibility** — НЕ KPI
семантики. Состояние (evidence-based):

- Server-authoritative период: DTO `@Matches(/^\d{4}-\d{2}-\d{2}$/)` → 400;
  presets + CUSTOM ресолвит `resolvePeriod` → `[start, endExclusive)`.
- Granularity/comparison/timezone (default UTC) — server-owned;
  RBAC: `analytics.read`.
- Variance: период Analytics живёт в local state, не в URL (отличие от
  registry-поверхностей; осознанно).
- **KPI semantic reconciliation** (KPI definitions, bucket-vs-headline,
  comparison semantics) — НЕ D8: owner **D11**.

### 16.6 Cross-domain intentional semantics (D8 MUST)

Различия между доменами, признанные намеренными и документированными
(не дефекты):

| Различие | Домены | Зафиксировано |
|---|---|---|
| Registry period boundary `[from,to)` vs включающий `lte` | Operations vs Catalog/CRM Activity | §16.2 |
| Payload 422 vs query-param 400 | Finance submissions vs ВСЕ registry query params | §16.1 |
| Период в URL vs local state | Registry vs Analytics | §16.5 |
| `dateField` переключаемый vs фиксированный dimension | Payments vs остальные | §16.3 |

## 17. D8 Global Temporal Visibility — canonical vocabulary

This section is the project-wide D8 contract: it documents existing facts and does not create a temporal model or alter frozen authorities.

### 17.1 Entity and lifecycle time

| Fact | Meaning / authority | Type / storage / mutability | Presentation and filter rule |
|---|---|---|---|
| `createdAt` | entity persistence; server/Prisma authority | instant, UTC `DateTime`, immutable | browser/runtime-locale display; default registry temporal dimension for Requests, Orders, Bookings, Payments |
| `updatedAt` | last permitted entity change; server/Prisma authority | instant, UTC `DateTime`, mutable | informational; never service occurrence or lifecycle transition |
| Order `submittedAt` / `confirmedAt` / `cancelledAt` / `fulfilledAt` / `closedAt` | server lifecycle transitions | nullable immutable UTC instants | milestones, not default registry filter |
| Booking `requestedAt` / `confirmedAt` / `rejectedAt` / `cancelledAt` / `completedAt` | server lifecycle transitions | nullable immutable UTC instants | milestones, not default registry filter |
| Payment and Refund lifecycle facts | Finance transitions (`paidAt`, `failedAt`, `cancelledAt`, `requestedAt`, `approvedAt`, `processedAt`) | nullable immutable UTC instants | Payments may explicitly use `dateField=paidAt`; default remains `createdAt` |

`NULL` lifecycle facts mean that transition has not happened. D8 does not change their semantics or write paths.

### 17.2 Service occurrence

| Fact | Meaning / authority | Type / storage / mutability | Presentation and filter rule |
|---|---|---|---|
| `serviceDate` | service-local calendar date; Product zone frozen downstream Product → CheckoutIntent → Order → Booking | date-only, UTC-midnight representation, immutable after binding | displayed as a calendar date; Booking upcoming uses service occurrence, not creation |
| `serviceTime` / `serviceEndTime` | authoritative local wall-clock start/end | local-time `HH:mm`, immutable after binding | show with service context; never infer browser zone |
| `serviceTimeZone` | authoritative Product IANA zone frozen downstream | timezone/IANA string, immutable after binding | business/service zone; never browser/IP-derived |
| `serviceStartsAt` / `serviceEndsAt` | derived Booking occurrence instants | UTC instants, immutable; null for date-only | exact-occurrence consumers only, not default Operations period |
| `serviceTimeType` | occurrence precision classification | typed state, immutable after binding | determines whether an instant exists |

### 17.3 Financial, event, and processing time

`LedgerTransaction.occurredAt` is the immutable nullable UTC business-occurrence instant, server-owned by Ledger and distinct from `createdAt`. `CrmActivity.occurredAt` is the immutable UTC event instant from its source and is the default CRM Activity temporal dimension. Behavioral events distinguish client UTC `occurredAt` (within server clock-skew policy) from server `receivedAt`. `receivedAt`, `publishedAt`, and `processedAt` are server-owned UTC processing or publication facts. Catalog filters intentionally use lifecycle `publishedAt`.

### 17.4 Registry and presentation periods

"Default registry temporal dimension" is the field used by default list sort and/or default period filtering; it is not a hierarchy of timestamps.

| Registry | Default registry temporal dimension | Period / boundary | Classification |
|---|---|---|---|
| Requests | `createdAt` | `[dateFrom,dateTo)` UTC midnights | intentional |
| Orders | `createdAt` | `[dateFrom,dateTo)` UTC midnights | intentional |
| Bookings | `createdAt` | `[dateFrom,dateTo)` UTC midnights; upcoming remains `serviceDate` | intentional |
| Payments | `createdAt`; explicit `dateField=paidAt` opt-in | `[dateFrom,dateTo)` UTC midnights | intentional |
| CRM Activity | `occurredAt` | inclusive `gte/lte` date-only bounds | intentional event-feed variance |
| CRM customers | related `Order.createdAt` activity | `[dateFrom,dateTo)` UTC midnights | intentional activity drill-down |
| Catalog | `publishedAt` | inclusive end-of-day `[from,to]` | intentional publication-day variance |

Absent bound means no filter. Registry params accept only real `YYYY-MM-DD` calendar dates. Each is validated independently before any Prisma read/where: malformed input throws `BadRequestException`, HTTP 400, `{ statusCode: 400, message: "<paramName> must be a valid date", requestId? }` through the ordinary exception-filter and `X-Request-Id` path; D8 never passes `Invalid Date` to Prisma.

Operations Header Period is global within the active Operations registry: `?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`, server-authoritative UTC-midnight `[from,to)` bounds, with the same period for KPI and table dataset. Browser local timezone cannot move that business boundary; Operations URL state remains authoritative.

### 17.5 Storage, business, and display timezone

`DateTime` storage and API serialization are UTC ISO 8601 `Z`. Business/service timezone is solely frozen `Product.serviceTimeZone` IANA authority. Display is separate: registry date display uses runtime `Intl`/`toLocaleDateString` with RU/AZ/EN tags, so instant display follows browser/runtime timezone. Date-only service dates must not be presented as fabricated UTC service instants.

### 17.6 DST and cross-midnight

`shared/service-time.ts` remains the authority. Ambiguous fall-back local time resolves to the early/first instant; nonexistent spring-forward time resolves to the instant after the gap; and `serviceEndTime <= serviceTime` resolves on the next local calendar day. These rules apply only to derived service occurrence instants.

### 17.7 Analytics visibility and ownership boundaries

D8 owns Analytics temporal visibility only: server-side preset/CUSTOM `startDate`/`endDate` resolution, granularity, comparison-parameter presence, timezone (default UTC), and `[start,endExclusive)` period. Analytics uses local state rather than registry URL state; this is intentional.

D9 owns export field-set standardisation (including missing `serviceDate` in Orders export). D11 owns KPI definitions, headline/bucket reconciliation, comparison semantics, and project-wide status/total semantics. Finance owns PSP milestones and capture/settlement/payout/provider-state design. D8 introduces no schema, migration, RBAC, permissions, or competing temporal authority.

---

`PHASE 1 STEP 1.13A TEMPORAL READINESS DOCUMENT — v1 (+1.18A reconciliation, +D8 canonical registry temporal vocabulary §16)`
