# TravelHub — Temporal & Analytics Readiness (Phase 1 Step 1.13A)

Дата: 2026-08-09. Статус: актуально для Phase 1.

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
| `Payment.*` timestamps | Finance-модель не существует — GAP для 2.10C/2.12. |
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

---

`PHASE 1 STEP 1.13A TEMPORAL READINESS DOCUMENT — v1`
