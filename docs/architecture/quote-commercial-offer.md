# PHASE 2 — STEP 2.3 — QUOTE & COMMERCIAL OFFER FLOW

Статус: REVIEW FIXES COMPLETED — WAITING FOR APPROVAL (Strict Review)
Базовая линия: `master @ 047a6b6` (v0.8.0) + Steps 2.1 (sales foundation) / 2.2 (sales center).

## 1. Ownership

**Sales владеет коммерческим предложением Quote и его immutable commercial snapshot.**
Catalog остаётся owner текущих Product/Tariff данных. Sales читает Product/Tariff по
canonical ID, копирует коммерческие значения в собственный snapshot (QuoteItem) при
формировании DRAFT; после ISSUE КП исторически воспроизводимо независимо от Catalog.
Запрещено: Sales → Catalog write; FK между `sales.*` и `catalog.*`; динамическое
подмешивание текущей Catalog цены в ISSUED КП.

## 2. Data model (sales.*)

- `Quote` (header): + `currency` (единая, из Tariff), `validUntil`, `issuedAt`,
  `discountType` (NONE|PERCENTAGE|FIXED), `discountValue`, `discountAmount`,
  `subtotal`, `total` (персистятся при ISSUE; DRAFT → null, читаются computed).
  `productId` — legacy/foundation nullable колонка (честная семантика).
- `QuoteItem` (строка): `productId/productCode/productTitle`, `tariffId/tariffCode/
  tariffName` (Sales-owned snapshot), `quantity`, `unitPrice`, `currency`, `amount`
  (line = unitPrice × quantity, Decimal). FK строго внутри `sales.*`.
- `QuoteTraveler`: `firstName`, `lastName`, `birthDate?` — МИНИМУМ для offer
  composition/pricing. НЕ копирует passport/document/payment PII (OrderTraveler/
  Passenger — свои домены; Step 2.5 создаст OrderTraveler из canonical snapshot).
  `birthDate` — calendar date `YYYY-MM-DD` (time-компонент/timezone → 422, будущие
  даты → 422); хранится как UTC midnight (`T00:00:00.000Z`) — без timezone
  day-shift при повторном display.
- `QuoteHistory`: факты created / item_added / item_updated / item_removed /
  customer_changed / travelers_changed / commercial_changed / issued (без PII).

## 3. Money contract (Quote-local, sanctioned entry-audit prerequisite #3)

- Представление: `DECIMAL(12,2)` — существующий platform contract (Tariff.price,
  Order.amount, Booking.amount).
- Математика: decimal.js (Prisma.Decimal); НИКАКИХ JS floating-point для
  authoritative totals.
- line = unitPrice × quantity (exact); subtotal = Σ lines.
- **Overflow guard**: line/subtotal/discountAmount не могут превысить DECIMAL(12,2)
  (максимум `9999999999.99`) — иначе 422, а не Prisma numeric overflow (500).
- discount: PERCENTAGE (0..100) → `round_half_up(subtotal × pct / 100, 2)`;
  FIXED (≥0, валюта КП) — **СТРОГО ≤ subtotal: при FIXED > subtotal → 422 ДО записи
  во всех мутациях (set commercial, update/remove item) + финальный гейт при ISSUE;
  никакого silent clamp и никакого partial write** (невалидное состояние не
  сохраняется; инвариант «FIXED ≤ текущий subtotal» поддерживается на всех
  мутациях состава). FIXED > 0 на пустой КП (subtotal 0) невозможен; FIXED = 0 и
  PERCENTAGE/NONE можно задать до добавления items.
- total = subtotal − discountAmount ≥ 0.
- Rounding: half-up до 2dp — совпадает с точностью хранения; детерминированная
  политика.
- Currency: единая на КП, источник — Catalog Tariff.currency (свободный список не
  вводится; Finance Currency master data — будущий домен). Все items одной валюты
  (иначе 422); первый item фиксирует currency КП.
- **Price authority**: backend. Клиент передаёт только productId/tariffId/quantity,
  discountType/discountValue, validUntil, customer/travelers. snapshot-имена,
  unitPrice, amount, subtotal, discountAmount, total — server-owned (422 при
  передаче).
- **РЕКОНСИЛЯЦИЯ (не закрывает):** authoritative checkout/order propagation
  (2.3A/2.4) и Order commercial snapshot (2.5) обязаны сверить эту политику с
  Payment/Finance (2.10C/2.12) до production денежного потока.

## 4. Eligibility (server-side, read-only)

Product существует; **разрешённые Product status: DRAFT / COMPLETE / REVIEWED /
PUBLISHED / CHANGED**; ARCHIVED → 422 (минимальный инвариант: Marketplace
publication НЕ определяет internal Sales eligibility — внутренний sales-контур
сам решает, что можно котировать; детерминированная обработка недоступных
сущностей). Tariff существует и принадлежит Product (`tariff.productId ===
productId`); tariff validity window (если задан validFrom/validTo) покрывает now.
Без capacity reservation/locking (ничего не резервируется).

## 5. Lifecycle

`DRAFT → ISSUED`. DRAFT — редактируемый состав (items/travelers/customer/discount/
validUntil через action-команды, CAS по version). ISSUE — одна atomic transaction:
CAS → валидация (≥1 item, единая валюта, validUntil > now, discount bounds) →
расчёт totals → персист subtotal/discountAmount/total/issuedAt → history + audit.
Нет состояния ISSUED без snapshot/history. После ISSUE: прямые edit запрещены (422);
повторный ISSUE — детерминированный 422 (terminal protection, lifecycle convention
2.1). ACCEPTED/REJECTED/CONVERTED/PAID/ORDERED НЕ вводятся (owner — будущие steps).

**Currency (remove-last-item):** удаление последнего item оставляет колонку
`currency` со старым значением (пустая КП); добавление нового item после этого
переустанавливает currency по первому item нового состава — смешивание валют
после remove-all допустимо (переключение валюты). При установленной FIXED-скидке
удаление/уменьшение items ниже суммы скидки → 422 (сначала уменьшить/снять скидку).

**Legacy Quotes (честная семантика):** КП, созданные до 2.3 (без состава/денег),
остаются DRAFT; detail показывает computed нулевые totals, `currency` — schema
default (`USD`) и `discountType` — `NONE` до первого коммерческого действия;
ISSUE без ≥1 item → 422; никакого fabricated `issuedAt`/persisted totals.

## 6. API (action-oriented, /api/v1/sales/quotes/*)

```
POST   /quotes                    — create DRAFT (sales.quote.write)
GET    /quotes                    — list (sales.quote.read)
GET    /quotes/:code              — detail: commercial projection + items/travelers
GET    /quotes/:code/history      — immutable chronology
POST   /quotes/:code/items        — add item {productId, tariffId, quantity}
PATCH  /quotes/:code/items/:id    — update quantity
DELETE /quotes/:code/items/:id    — remove item
PUT    /quotes/:code/customer     — set customerId (null = unset)
PUT    /quotes/:code/travelers    — replace travelers [{firstName, lastName, birthDate?}]
PUT    /quotes/:code/commercial   — {discountType, discountValue?, validUntil?}
POST   /quotes/:code/issue        — atomic ISSUE (freeze)
```

DRAFT detail: totals computed on read (preview). ISSUED detail: persisted immutable
values. Whitelist DTO: никакого internal Catalog/CRM/Audit/request-полей.

## 7. RBAC / capability model

Permission-based (Step 2.2 модель сохранена): mutation/issue — `sales.quote.write`;
read — `sales.quote.read`. ANALYST/MARKETER (kpi.read only) → 403 на raw Quote.
FINANCE (sale.read only) → 403 на quote. Без role-hardcoding для авторизации актора
(единственная role-проверка — staff-only assignee в assertOptionalUser, бизнес-
ограничение на целевого пользователя).

## 8. Concurrency / idempotency

CAS по `version` на всех мутациях (item add/update/remove, customer, travelers,
commercial) и на ISSUE. Concurrent ISSUE → один 201 + один 409 (true concurrency)
или 422 (сериализация: повторный ISSUE) — ровно один issued-history-fact.
ISSUE vs edit race → один успех + один 409/422, агрегат консистентен (нет totals
от одной версии и items от другой). Повторный ISSUE детерминированно 422.

## 9. Temporal / history / audit

`createdAt/updatedAt` — entity time; `issuedAt` — lifecycle time (не заменяется
updatedAt); `validUntil` — commercial validity boundary (UTC, > now при ISSUE).
QuoteHistory — business chronology (immutable, actor, без PII). AuditLog —
operational (action/resource/details без PII/body; correlation server-derived).

## 10. Boundaries (не реализовано)

- Checkout 2.3A: нет checkout session/cart/service-date/options/capacity hold;
  frontend не источник цены.
- Payment Terms 2.3B: нет prepayment/deposit/due schedule/payment state.
- Sale completion / OrderRequested / Order / Booking / Payment / Finance: нет.
- Capacity reservation: нет.
- Events: Sales не эмитит событий (consumer'ов нет; outbox reliability prerequisite
  остаётся до 2.4/2.5).
- Discount engine: только NONE/PERCENTAGE/FIXED; нет promo/coupon/campaign.
- Tax/fee/commission/PSP fee: не вводятся.
- Multilingual/AI translation/trial/billing/custom domains/Partner CRM: нет.

## 11. Migration

`20260809231950_add_quote_commercial_flow`: enum QuoteDiscountType; Quote +8
nullable/defaulted колонок; таблицы QuoteItem/QuoteTraveler (FK строго внутри
`sales.*`); индексы QuoteItem(quoteId), QuoteTraveler(quoteId). Аддитивная, без
backfill/destructive. Clean replay — e2e globalSetup; drift — migrate status up to
date (24 миграции).

## 12. Tests

- Unit `sales.money.spec.ts` (17/17): Decimal normalization, rounding half-up,
  discount PERCENTAGE/FIXED (strict, без silent clamp), DECIMAL(12,2) overflow
  guards, negative guards, line/subtotal/total.
- E2E `quote-commercial-offer.e2e-spec.ts` (18 тестов, покрытие всех 35 пунктов §39):
  auth/RBAC (anon 401, BUYER/PARTNER/MODERATOR 403, ANALYST/MARKETER aggregate-only,
  SM flow); composition/eligibility (несуществующие refs, чужой tariff, ARCHIVED);
  backend totals + forged rejection; currency; discount valid/invalid; customer;
  travelers + privacy (no passport); ISSUE semantics (validUntil, issuedAt, re-issue);
  ISSUED immutability; Catalog mutation после issue (snapshot proof); concurrent ISSUE;
  ISSUE vs edit race; history chronology; AuditLog no PII; child IDOR; forbidden keys;
  isolation (no Order/Booking/Payment/Availability/OrderRequested, Sale OPEN);
  error envelope/requestId.
- Regression: full serial e2e **500/500** (34 спека), unit **263/263**, frontend
  tsc clean / vitest 56/56 / next build OK.

## 13. Runtime verification (isolated, port 4008)

Аноним → 401; SM: quote QTE-00000048 → item (150×2) → commercial 10% → preview
subtotal=300/discount=30/total=270 USD → issue 201; Catalog PATCH (tariff → 999) →
issued snapshot неизменен (150/300/30/270, issuedAt set); edit issued → 422;
re-issue → 422; Order/Booking не создаются; `OrderRequested` отсутствует. Инстанс
остановлен.
