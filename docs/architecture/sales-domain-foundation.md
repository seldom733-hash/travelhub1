# Sales Domain Foundation (Phase 2 — Step 2.1)

## 1. Bounded-context ownership

Sales — отдельный bounded context со своей схемой БД `sales.*` и модулем
`backend/src/modules/sales/` (NestJS `SalesModule`). Владеет ТОЛЬКО
Sales-сущностями. НЕ владеет Order/Booking/Payment/Finance; НЕ пишет в
Catalog/CRM/Order/Booking/Security (ADR-0001). Cross-domain ссылки —
read-by-ID валидация существования, без FK и без расширения прав.

| Контекст | Schema | Владелец | Модуль |
|---|---|---|---|
| Catalog | `catalog.*` | Catalog | `modules/catalog` |
| CRM | `crm.*` | CRM | `modules/crm` |
| Security | `security.*` | Security | `security/` |
| Order | `order.*` | Order | `modules/order` |
| Booking | `booking.*` | Booking | `modules/booking` |
| Communication | `communication.*` | Communication | `modules/communication` |
| **Sales** | **`sales.*`** | **Sales** | **`modules/sales`** |

## 2. Entity map

| Entity | Canonical code | Lifecycle (Step 2.1) | Терминал |
|---|---|---|---|
| `Lead` | `LED-*` | `NEW → QUALIFIED \| DISQUALIFIED` | DISQUALIFIED |
| `Opportunity` | `OPP-*` | `NEW → OPEN → WON \| LOST` | WON, LOST |
| `Quote` | `QTE-*` | `DRAFT → ISSUED` | ISSUED |
| `Sale` | `SAL-*` | `OPEN` (создание); **переходов нет** — completion → `OrderRequested` (Step 2.4) | — |

Каждая entity — собственная identity + `sales.*History` (audit by default:
create + status transitions, actor, from/to, safe fields — без PII/body).

## 3. Canonical ID strategy

Коды генерируются `IdsService.nextCode(tx, "LED|OPP|QTE|SAL")` внутри
транзакции домена через атомарный upsert счётчика `events.BusinessSequence`
— конкуренция безопасна (доказано e2e: 20 параллельных create на prefix →
20 уникальных кодов, без P2002 наружу). Формат: `PREFIX-` + 8 цифр.

## 4. Relationship model

`Lead → Opportunity → Quote → Sale` — НЕ обязательная линейность: все связи
nullable/optional, каждая entity сохраняет собственную identity. Никакого
giant aggregate; lifecycle одного объекта не является surrogate lifecycle
другого.

- **`Quote.productId` (single, nullable)** — foundation-ссылка на предмет КП;
  Step 2.3 (Quote & Commercial Offer Flow) добавит items/snapshot аддитивной
  миграцией (QuoteItem), single-поле не блокирует multi-item будущее.
- **`Sale.quoteId @unique` (1:1 Quote→Sale)** — duplicate-conversion
  protection: одно КП не порождает две Sale. Revised quote / partial
  acceptance → новая Quote-строка (аддитивно в Step 2.3 при необходимости).

## 5. Customer / Partner / Supplier boundary

- **Customer**: только canonical `crm.Customer.id` reference (nullable для
  раннего Lead); Sales НЕ пишет в CRM; forged customerId не расширяет права
  (валидируется существование, authority — permission-гейт).
- **Lead `name` — display label, НЕ prospect identity**: `name` — минимальный
  бизнес-лейбл для внутренней sales-воронки; canonical identity остаётся
  `crm.Customer` (когда Lead связан). Нового prospect/contact identity
  контракта НЕТ; Partner CRM lead intake — отдельный Phase 3 (Step 3.5C).
- **`assignedToId` — business reference, не authorization**: ответственный
  internal staff-пользователь (security.User). REVIEW FIX 2: назначать можно
  только staff-роли (BUYER/PARTNER → 422); поле не даёт никаких прав
  вызывающему.
- **Partner ≠ Supplier**: references на этом шаге не вводились (нет реального
  Step 2.1 invariant); Supplier lifecycle — prerequisite будущего Booking flow.
- **Product**: только canonical `catalog.Product.id` reference в Quote
  (read-by-ID); никаких копий mutable Product / cross-context writes.

## 6. Sale semantics (строго)

`Sale ≠ Order`. На Step 2.1 Sale НЕ создаёт Order/Booking, НЕ резервирует
Availability, НЕ меняет inventory, НЕ означает paid/fulfilled.

**REVIEW FIX 1 (strict review):** transition-команды Sale в Step 2.1 НЕТ —
статус только `OPEN` при создании. Семантика «Sale completion →
OrderRequested» принадлежит Step 2.4 (единственная граница): закрытие Sale
без события сейчас создало бы неоднозначную legacy-семантику («закрыта без
сделки» vs «завершена в Order»). Enum-значение `SaleStatus.CLOSED`
зарезервировано в schema для решения Step 2.4, runtime-команды нет
(close-endpoint → 404, история Sale — только `created`).

Доказано e2e: создание Sale не изменяет счётчики Order/Booking и не
публикует OrderRequested/OrderCreated в outbox.

## 7. Behavioral isolation

Behavioral события (Marketplace/Storefront telemetry) НЕ создают Lead
автоматически (никакого consumer). Contact click — intent signal, не
canonical Lead. Доказано e2e: ingestion `MARKETPLACE_VIEWED` → 202, счётчик
Lead не меняется.

## 8. Temporal semantics

`createdAt`/`updatedAt` (entity time). Lifecycle milestones — только реальные
transition-команды (CAS по `version`): двойной переход → один 200/201, второй
409 (нет дубликата milestone/history). `updatedAt` НЕ используется как
milestone. Новых legacy-строк нет (таблицы новые, no backfill).

## 9. Actor / history / audit

- Actor — из JWT (authenticated actor); SYSTEM/actor из body запрещены.
- `sales.*History` — доменная история (audit by default).
- `AuditLog` — административная ссылка (action `sales.*.created/status_changed`,
  details только code/status refs, без PII/body).
- Behavioral события НЕ попадают в Sales history.

## 10. RBAC

| Permission | SALES_MANAGER | DIRECTOR | FINANCE | MARKETER | ANALYST | ADMIN |
|---|---|---|---|---|---|---|
| `sales.lead.read` | ✔ | ✔ | — | ✔ | ✔ | ✔ |
| `sales.lead.write` | ✔ | — | — | — | — | ✔ |
| `sales.opportunity.read` | ✔ | ✔ | — | ✔ | ✔ | ✔ |
| `sales.opportunity.write` | ✔ | — | — | — | — | ✔ |
| `sales.quote.read` | ✔ | ✔ | — | — | ✔ | ✔ |
| `sales.quote.write` | ✔ | — | — | — | — | ✔ |
| `sales.sale.read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `sales.sale.write` | ✔ | — | — | — | — | ✔ |
| `sales.sale.complete` | ✔ | — | — | — | — | ✔ |

BUYER/PARTNER/MODERATOR — без sales-прав (403, доказано e2e). Права уже были
в каталоге (dormant из Phase 1) — переиспользованы без дублирования; seed
реконсилирует их идемпотентно. `sales.quote.approve` — резерв для Step 2.3
(на этом шаге не используется).

## 11. API surface (минимальный, foundation)

`/api/v1/sales/*` — только internal staff с granular permissions:

- `POST/GET /sales/leads`, `GET /sales/leads/:code`, `POST /sales/leads/:code/transition`
- `POST/GET /sales/opportunities`, `GET /sales/opportunities/:code`, `POST /sales/opportunities/:code/transition`
- `POST/GET /sales/quotes`, `GET /sales/quotes/:code`, `POST /sales/quotes/:code/issue`
- `POST/GET /sales/sales`, `GET /sales/sales/:code` (transition-команды Sale — Step 2.4)

Пагинация canonical (page/pageSize/total/hasMore, cap 50), детерминированный
порядок (createdAt desc, code asc). DTO whitelist + `assertNoForbiddenKeys`
(422): id/code/status/version/temporal/actor/history/correlation запрещены.
KPI/dashboard/queues/filtering/export — НЕ реализованы (Step 2.2).

## 12. Cross-context write proof

Sales НЕ пишет в Catalog/CRM/Order/Booking/Finance/Security — только чтение
существования по ID. Никакого direct Sales → Order table write. События
(OrderRequested и пр.) на Step 2.1 НЕ публикуются.

## 13. Money / availability / snapshot boundary

- Money-поля ОСОЗНАННО отсутствуют (monetary contract — Step 2.3A/2.4).
- Availability/capacity hold/reservation — НЕ реализованы (Step 2.3A/2.4).
- Commercial snapshot — НЕ реализован (deadline Step 2.5).

## 14. Payment / Subscription absence

Payment/PSP/Refund/Commission/Settlement/Payout — отсутствуют; `Sale.status`
не является payment state. Storefront entitlement не тронут
(`entitlement != Subscription`).

## 15. Explicit non-goals (Step 2.1)

Sales Center backend/UI, queues, KPI, dashboard, advanced filtering,
Quote flow/pricing/discounts/validity, Checkout Context, cart, price
resolution, capacity reservation, `OrderRequested`, Order/Booking creation,
Payment/PSP/Refund/Commission/Settlement/Payout/Finance, Documents,
Subscription/Billing, Partner CRM, Support/Chat/Notifications, analytics
dashboards, multilingual/AI translation.

## 15A. Sale completion roadmap note

Step 2.4 («Sale Completion → OrderRequested») определяет переход завершения
Sale и его событие. Step 2.1 намеренно не вводит terminal-статус Sale, чтобы
не зафиксировать неоднозначную семантику до события.

## 16. Prerequisites к последующим шагам (не выполнены здесь)

1. Outbox automated retry/recovery — до Step 2.4/2.5.
2. Booking currency/amount policy — до Step 2.8.
3. Monetary contract — до Step 2.3A/2.4.
4. Tariff/Availability reservation & locking — до Step 2.3A/2.4.
5. Commercial snapshot policy — до Step 2.5.
6. `/orders/bootstrap` removal — Step 2.6.
7. Payment/PSP/ledger — Step 2.10C/2.12.
8. Supplier lifecycle/validation — Step 2.8.
9. Payment/checkout idempotency keys — Step 2.10.

## 17. Roadmap sequencing notice

Step 2.17 расположен позже reliability-dependent Step 2.4/2.5 — перед Step 2.4
roadmap-owner должен определить, как reliability capability будет реализована
раньше. Step 2.1 не переносит Step 2.17.
