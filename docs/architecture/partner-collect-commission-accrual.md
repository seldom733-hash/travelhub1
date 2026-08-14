# Step 2.12E — PARTNER_COLLECT / Commission Accrual Foundation

Статус: **IMPLEMENTATION COMPLETED — waiting for strict review**
ADR: ADR-0013 (Commission Policy Contract, D9/D10/D14/D19) — каноничен.
Предшественники: Step 2.14E (CommissionPolicy master data), Step 2.10A/B (Ledger/ProviderFee/Settlement/Payout foundation).

## 1. Scope (что реализовано)

Finance-owned признание **TravelHub Commission** (CMS-*) + receivable
**CommissionAccrual** (CAA-*) для **PARTNER_COLLECT** на **Order creation** из
**frozen commissionSnapshot** (Quote ISSUE freeze, ADR-0013 D6/D7).

- **Recognition trigger** = Order creation (D10: Partner собрал деньги вне
  platform rail; НЕ Payment CAPTURED, НЕ PSP, НЕ live state).
- **0 live policy lookup** (D7/invariant 3): producer использует ТОЛЬКО frozen
  snapshot; NO_POLICY/AMBIGUOUS на freeze → NULL snapshot → 0 accrual
  (fail-closed, НЕ «0%»).
- **Seller attribution** (D14): `Order.sellerPartnerId` frozen snapshot-at-event
  (Quote ISSUE); multi-seller/без seller → 0 фактов (fail-closed, НЕ live
  Catalog lookup).
- **amount** = `round_half_up(base × rate)` — Decimal authority
  (finance.money → sales.money toMoney2), 0 JS float (invariant 4).
- **base** = frozen `Order.total` (D4: tax-exclusive by construction, до refund).
- **Idempotency**: inbox + `Commission_orderId_key` +
  `CommissionAccrual_sourceCommissionId_key`; divergent replay → controlled
  ConflictError (НЕ silent success).
- **Событие** `CommissionAccrued` (outbox, PUBLISHED result-event, атомарно,
  PII-free, correlation/causation chain) — потребителей 0.
- **0 side-effects**: 0 Ledger (2.12D), 0 Settlement/Payout (2.14A/B), 0 Invoice
  (2.14), 0 PSP split (2.12C), 0 Refund/Dispute adjustment (D11/D12).
- Immutable финансовые поля; status НЕ эволюционирует в 2.12E
  (INVOICED/PAID/COLLECTED — future шаги); update/delete путей нет.

## 2. Freeze-цепочка (Quote ISSUE → Order)

| Шаг | Где | Что |
|---|---|---|
| Quote ISSUE | `sales.service.issueQuote` | `mapCommissionChannelFromAcquisition(MARKETPLACE)` → детерминированный resolver `CommissionPolicyService.resolve(channel, now)` → **`commissionSnapshot`** `{policyCode, policyVersion, rateType, rate, baseAmount, baseCurrency, channel, sellerPartnerId, selectedAt, roundingContractVersion}` + `sellerPartnerId` (один уникальный non-null Product.partnerId по items) |
| Checkout | `createCheckoutIntent` | snapshot **verbatim** из Quote (binding price; НЕ reprice) |
| Sale complete | `completeSale` | snapshot verbatim из Checkout + `sellerPartnerId` в OrderRequested payload |
| Order | `order-requested.consumer` → `order.service.createOrderFromRequested` | персист `Order.commissionSnapshot` + `Order.sellerPartnerId` verbatim (валидация payload) |

Fail-closed на freeze: `NO_COMMISSION_CHANNEL` (не MARKETPLACE) / `NO_POLICY` /
`AMBIGUOUS` → snapshot NULL (нет commission-контекста → 0 accrual); multi-seller
или отсутствие seller → `sellerPartnerId` NULL → 0 accrual.

## 3. Producer (CommissionAccrualConsumer)

- Подписка: `DomainEvents.OrderCreated` (canonical Order-created факт, D10).
- **OrderCreated теперь доставляется подписчикам**: эмитится `emit` (PENDING)
  атомарно с Order; order-requested consumer после успешного коммита помечает
  источник OrderRequested PUBLISHED и вызывает `publishPending()` (паттерн
  payment.service/booking.service) → CommissionAccrualConsumer выполняется в той
  же доставке. Downstream failure (коррупция snapshot) → OrderCreated FAILED
  (не перебрасывается) — OrderRequested остаётся PUBLISHED.
- Внутри транзакции consumer-а (Finance-owned producer, READ-only cross-context
  чтение Order, ADR-0001):
  1. `commissionSnapshot === null/undefined` → no-op (нет commission-контекста);
  2. `sellerPartnerId` NULL → no-op (multi-seller/без seller, D14);
  3. `validateCommissionSnapshot` (глубокая форма; коррупция = invariant
     violation → ValidationDomainError → событие FAILED, НЕ молчаливый 0-факт);
  4. проверки консистентности: snapshot.sellerPartnerId == Order.sellerPartnerId,
     snapshot.baseCurrency == Order.currency, `baseAmount == Order.amount`
     (расхождение = producer-дефект → ValidationDomainError);
  5. `amount = toMoney2(base × rate)`; zero-amount → ValidationDomainError
     (rate > 0 по контракту; NO_POLICY ≠ 0%);
  6. existing `Commission` (replay) → identical → no-op существующий факт;
     divergent → `ConflictError` (класс Finance divergent-replay defect);
  7. create `Commission` (CMS-*, PARTNER_COLLECT, ACCRUED) +
     `CommissionAccrual` (CAA-*, ACCRUED, `accruedAt` = now, sourceCommissionId)
     + `CommissionAccrued` (emitResult, PUBLISHED) — атомарно;
  8. inbox строка consumer-а (dedup).

## 4. Read API (Finance Center; RBAC `finance.commission.read`)

- `GET /api/v1/finance/commissions?status=&orderId=&partnerId=&page=&pageSize=`
- `GET /api/v1/finance/commissions/:code` (404 unknown; без PII)
- `GET /api/v1/finance/commission-accruals?status=&partnerId=&page=&pageSize=`
- `GET /api/v1/finance/commission-accruals/:code` (404 unknown; без PII)

Фактический read-set ROLE_PERMISSIONS: FINANCE / DIRECTOR / ANALYST
(SALES_MANAGER/OPERATOR/BUYER — 403). DTO: refs + frozen money + status +
milestones; никаких passport/card/банковских данных.

## 5. Инварианты / границы

- Один earned-факт на Order (`@@unique([orderId])`) и один receivable на
  Commission (`@@unique([sourceCommissionId])`) — DB backstop идемпотентности.
- 0 write-путей вне `CommissionService.createAccrualForOrder` (repo-wide audit).
- 0 Payment/PSP/webhook зависимостей (2.12A/B/C); 0 Ledger (2.12D); 0
  Settlement/Payout/Invoice (2.14A/B/2.14); 0 Refund/Dispute adjustments
  (D11/D12 — deferred).
- CommissionAccrued payload: refs + frozen money/policy provenance
  (amount, currency, channel, collectionModel, policyCode/version, baseAmount,
  selectedAt) — БЕЗ PII (email/phone/passport/card).
- Status эволюция (INVOICED/PAID/COLLECTED), периодизация, Invoice —
  будущие шаги (2.14/2.12E+); в 2.12E статус фиксирован ACCRUED.

## 6. Данные (миграция `20260814190000_add_partner_collect_commission_accrual`)

Аддитивная, 0 backfill, 0 destructive ALTER: enum
`CommissionCollectionModel {PARTNER_COLLECT}`; nullable
`commissionSnapshot Json?` (Quote/CheckoutIntent/Sale/Order);
`Order.sellerPartnerId TEXT?` + index; `Commission.collectionModel` +
`Commission_orderId_key`; `CommissionAccrual.sourceCommissionId` +
`accruedAt` + unique. 0 фактов создаётся миграцией (schema-only).

## 7. Известные ограничения (deferred, документировано)

- SPLIT_AT_PAYMENT (2.12C) — аддитивное расширение enum collectionModel.
- Invoice/accrual-периодизация/INVOICED/COLLECTED — 2.14/2.12E+.
- CommissionAccrued потребителей нет (лента/аналитика).
- Ledger posting commission-факта — 2.12D (producer шаг).
