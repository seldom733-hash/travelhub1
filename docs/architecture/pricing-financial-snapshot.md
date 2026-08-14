# Pricing & Financial Snapshot (Step 2.11)

**Step:** Phase 2 — 2.11 — Pricing & Financial Snapshot
**Status:** IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW (2026-08-14)
**Predecessor:** Step 2.10C (APPROVED WITH REVIEW FIXES)
**NEXT:** Phase 2 — Step 2.11 — STRICT REVIEW

---

## 1. Purpose

Установить **канонический pricing/financial snapshot contract**: исторически
достоверная денежная картина коммерческой операции объясняется из
immutable/frozen snapshots и НЕ зависит от текущей mutable Catalog/Finance
конфигурации (Product price, Currency, ExchangeRate, Tax, будущих commission
settings). Изменение master-data после фиксации НЕ меняет зафиксированную
стоимость сделки.

## 2. Scope

- **In scope:** аудит фактического frozen-money контракта по цепочке
  Quote → CheckoutIntent → Sale → Order → Booking; закрытие единственного
  пробела (Booking.amount без валюты); канонический consistency-валидатор
  frozen snapshot на binding boundary; adversarial e2e; docs/contracts;
  Roadmap; отчёт.
- **Out of scope (deferred):** налоговый движок (Tax/TaxRule master data
  существует, расчёта в pricing flow нет — см. §10); FX-конверсия
  (ExchangeRate master data существует, конверсии в flow нет — §11); discount
  engine (скидка существует как frozen факт, promo/coupon engine — нет, §12);
  commission policy/расчёт (2.12C/E); Payment runtime (2.12); ledger
  auto-posting (2.12+); Settlement/Payout lifecycle (2.14); реprice/reschedule
  engine; Finance Center frontend.

## 3. Ownership

Snapshot-контракт владеется **существующими агрегатами коммерческого flow**
(Sales: Quote/CheckoutIntent/Sale; Order consumer; Booking consumer), НЕ новым
finance-агрегатом. Pricing вычисляется и замораживается в Sales (Quote ISSUE);
downstream домены копируют frozen факты verbatim (READ-only, ADR-0001), никогда
не пересчитывают. Денежная математика — единый платформенный контракт
`sales.money.ts` (DECIMAL(12,2), half-up 2dp, decimal.js; finance.money
переиспользует его как single source of truth, Step 2.10 §7).

## 4. Current → Target reconciliation

| Concern | Current authority | Current storage | Mutable? | Snapshot exists? | Target 2.11 |
|---|---|---|---|---|---|
| unit/base price | Catalog Tariff/period | QuoteItem.unitPrice (frozen at ISSUE) | да (Catalog) | да | сохранён |
| quantity | Quote item | QuoteItem.quantity / OrderItem.quantity | нет после ISSUE | да | сохранён |
| line amount | Sales (quoteTotals) | QuoteItem.amount / OrderItem.amount | нет | да | сохранён + consistency gate |
| subtotal | Sales (quoteTotals) | Quote/Checkout/Sale/Order.subtotal | нет | да | сохранён + gate |
| discount | Sales (validateDiscountValue) | QuoteDiscountType/Value/Amount + Order/Checkout/Sale | нет | да | сохранён + gate |
| gross/total | Sales (quoteTotals) | Quote/Checkout/Sale.total; Order.amount | нет | да | сохранён + gate |
| transaction currency | Quote.currency (единая) | Quote/Checkout/Sale/Order/OrderItem.currency | нет | да (кроме Booking) | **+ Booking.currency** |
| FX rate | — (нет конверсии в flow) | — | — | нет | deferred (§11) |
| tax rate/amount | — (нет расчёта в flow) | — | — | нет | deferred (§10) |
| rounding | Sales ROUND_HALF_UP 2dp | — | — | контракт | сохранён (gate) |
| commission | — (нет расчёта) | — | — | нет | deferred (2.12C/E) |
| provider fee / settlement / payout | — (2.10B immutable факты) | finance.* | нет | — | boundary (§18) |

## 5. Canonical monetary vocabulary

`unitPrice`, `quantity`, `line amount` (= round_half_up(unitPrice × quantity)),
`subtotal` (= Σ lines), `discountAmount` (NONE→0 | PERCENTAGE→
round_half_up(subtotal×pct/100) | FIXED→value, строго ≤ subtotal), `total`
(= subtotal − discountAmount ≥ 0), `currency` (ISO 4217, единая на
транзакцию). Все суммы — Decimal-строки DECIMAL(12,2). Никаких новых полей
ради полноты: taxAmount/FX — deferred (нет producer-а).

## 6. Freeze boundary

- **Quote ISSUE** — первый и канонический freeze: unitPrice/amount/currency/
  serviceDate/restrictionSnapshot замораживаются на QuoteItem; subtotal/
  discountAmount/total персистятся на Quote (immutable после ISSUE).
- **CheckoutIntent create** — binding boundary: frozen Quote totals копируются
  server-side verbatim (frontend не источник цены); Step 2.11 добавляет
  consistency gate (см. §8).
- **Sale completion** — snapshot копируется verbatim из CheckoutIntent
  (frozen; CAS OPEN→CLOSED).
- **Order create** (OrderRequested consumer) — валидирует payload money и
  персистит verbatim.
- **Booking create** (BookingRequested consumer) — копирует amount + currency
  verbatim из OrderItem.
- После freeze никакого repricing/re-tax/re-FX из текущего Catalog/Finance;
  Booking lifecycle/будущий Payment lifecycle/смена master-data не мутируют
  frozen факты.

## 7. Decimal contract — HARD GATE

Все денежные вычисления — только decimal.js (Prisma.Decimal); ни одного
`Number(...)`/`parseFloat` как monetary authority; нет binary float
intermediate state. Хранение — DECIMAL(12,2). Overflow guard: сумма/строка
выше `9999999999.99` → 422 (не Prisma numeric overflow 500). API — Decimal-
строки. Единственный источник истины — `sales.money.ts` (finance.money
реэкспортирует; payment-terms использует тот же контракт).

## 8. Rounding

ROUND_HALF_UP до 2 знаков на каждом этапе: unit price → 2dp; line amount →
2dp; subtotal → 2dp (сумма уже 2dp, round no-op); PERCENTAGE discount →
round_half_up(subtotal×pct/100); payment terms (2.3B) — тот же half-up.
Один и тот же алгоритм во всех доменах (deterministic; unit-тесты на
boundary: 99.999 → 100, 99.994 → 99.99, 33.33% от 99.99 → 33.33/66.66).
Step 2.11 добавляет consistency gate, который ВЕРИФИЦИРУЕТ frozen snapshot
(вычисляет expected lines/subtotal/discount/total теми же правилами и
сравнивает с зафиксированными; расхождение → 422). Gate НЕ пересчитывает
и НЕ персистит деньги — никакого второго money authority (покупатель
принимает именно ISSUE-значения).

## 9. Currency

Единая валюта транзакции (ISO 4217, из Tariff через Quote; mixed-currency
Quote → 422 на ISSUE). Frozen в Quote/Checkout/Sale/Order/OrderItem и — Step
2.11 — в Booking (`currency String?`, verbatim из OrderItem). Legacy Booking
(до 2.11) — NULL без backfill. Валидация: 3-буквенный ISO код; деньги без
валюты отклоняются (`validateFrozenMoneyFact`).

## 10. Tax boundary

Tax/TaxRule — Finance master data (2.10). В production pricing flow налоговый
расчёт ОТСУТСТВУЕТ (нет канонического producer-а, inclusive/exclusive
семантика не определена — stop-condition §50.2 2.11). Step 2.11 НЕ изобретает
налоговый движок: налоговые суммы/ставки в snapshot не вводятся. Deferred:
tax-расчёт/применение — будущий шаг (после определения producer-а и
inclusive/exclusive политики); тогда snapshot расширяется аддитивно
(amount/rate/jurisdiction provenance), без изменения существующих frozen
фактов.

## 11. FX boundary

ExchangeRate — Finance master data (2.10), НЕ выполняет конверсию (явно
заявлено в schema: «НЕ выполняет FX-конверсию — вне 2.10»). В pricing flow
конверсии НЕТ (одна валюта на транзакцию; mixed-currency невозможен по
конструкции Quote). Step 2.11 НЕ внедряет FX engine: frozen provenance
(rate/source/quote currencies) отсутствует намеренно. Deferred: FX-конверсия
и её snapshot-provenance — 2.12A/2.14D.

## 12. Discount boundary

Discount существует как frozen факт (QuoteDiscountType/Value/Amount + строгие
инварианты PERCENTAGE 0..100 / FIXED ≤ subtotal / NONE без value). Step 2.11
НЕ создаёт promo/coupon engine; новых discount-семантик для заполнения
snapshot не вводит. Consistency gate верифицирует discountAmount по тем же
правилам (сравнение с ISSUE-значением, без пересчёта/перезаписи).

## 13. Commission boundary

TravelHub Commission ≠ ProviderFee/Tax/Discount/Settlement/Payout. Семантика
deferred (2.12C/E SPLIT, 2.12D collect, 2.12E post-factum). Step 2.11 не
вычисляет commission, не создаёт CommissionAccrual, не пишет ledger, не
уменьшает payout, не создаёт settlement. Зарезервирован только
документированный extension boundary (арх-док §26).

## 14. Quote / Checkout / Sale propagation

`Quote(ISSUE) → CheckoutIntent(create) → Sale(complete) → OrderRequested`
— frozen totals копируются server-side verbatim на каждом шаге; frontend
никогда не источник цены (forged money → 422). Step 2.11: binding gate на
createCheckoutIntent — ВЕРИФИКАЦИЯ lines/subtotal/discount/total по
каноническим правилам (expected vs frozen, без пересчёта/персиста —
единственный money authority остаётся ISSUE); расхождение → controlled 422
(defense-in-depth поверх ISSUE-валидации). Replay/idempotency Sale
completion — без изменений (CAS).

## 15. Order / OrderItem propagation

OrderRequested consumer валидирует money payload (currency/subtotal/total/
items обязательны, Decimal) и персистит verbatim: Order.amount = total,
Order.subtotal/discountAmount, OrderItem.amount = line amount, currency.
Никакого вычисления исторического total из текущего Product. Cancellation
и lifecycle-переходы не меняют frozen pricing (доказано e2e 2.5/2.7).

## 16. Booking propagation

BookingRequested consumer копирует из Order/OrderItem (READ-only): `amount`
verbatim и — Step 2.11 — `currency` verbatim из OrderItem; defensive
`validateFrozenMoneyFact` перед записью (невалидный факт → событие FAILED,
не молчаливый save). Lifecycle Booking (2.9A) не трогает money/currency.
Legacy Booking без currency — NULL, читаем без backfill.

## 17. Reverse marketplace

Buyer Request flow (Opportunity → Quote acquisitionSource=BUYER_REQUEST →
Checkout → Sale → Order → Booking) использует тот же frozen snapshot path;
snapshot сохраняется независимо от acquisitionSource (доказано e2e T6:
идентичные money факты при BUYER_REQUEST; реальная конверсия — reverse-
conversion e2e). Никакого live-price пересчёта в Reverse flow.

## 18. Immutability

После freeze frozen money facts не мутируются ни при каких обстоятельствах:
Product price change (T2), Currency/Tax/ExchangeRate master-data change (T2b),
Booking lifecycle (2.9A e2e), cancellation, будущий Payment lifecycle.
Исправление цены — только будущий approved compensating-процесс, не правка
строки.

## 19. Idempotency

Sale completion / OrderRequested / BookingRequested idempotency — без
изменений (2.4/2.5/2.8): identical replay = no-op; divergent payload =
controlled conflict; unknown P2002 ≠ replay; без raw 500. Snapshot-поля не
стали частью replay-сравнения там, где это ломало бы идентичный логический
replay.

## 20. Concurrency

Product price update vs snapshot freeze — snapshot не зависит от текущего
Catalog (freeze при ISSUE; параллельная правка тарифа не влияет, T2).
Master-data update vs frozen транзакция — не влияет (T2b). Concurrent Sale
completion / event delivery — существующие CAS/inbox-инварианты (2.4/2.8)
без изменений. Новых гонок не вводится.

## 21. Atomicity

Snapshot + owning aggregate transition + history/outbox — атомарны по
существующему паттерну (Quote ISSUE tx; CheckoutIntent create tx; Sale
complete tx: updateMany CAS + reservations + OrderRequested; Order/Booking
consumer tx: entity + history + inbox). Откат теста: failure → нет частичного
snapshot/outbox (существующие 2.4 e2e). Binding gate выполняется до создания
строки (снапшот валиден до записи).

## 22. Events

0 новых событий (нет нового canonical business fact с consumer-ом). Существующие
event payload-ы (OrderRequested: frozen commercial snapshot) не изменены;
BookingRequested payload не расширялся (currency читается consumer-ом из
Order READ-only — минимальный payload, §11 2.8A). ADR-0010 не затронут.

## 23. RBAC / IDOR / mass assignment

RBAC: 0 новых прав; существующие owner-права (sales.*/booking.*/order.*).
Read-видимость — существующие контракты. IDOR: snapshot-поля не расширяют
read surface (currency — часть существующей Booking read-модели). Mass
assignment: money/currency/totals — server-owned на всех write-поверхностях
(assertNoForbiddenKeys → 422; e2e T4: forged subtotal/total/currency на
checkout create → 422). Запрет не ослаблен.

## 24. Legacy compatibility

Существующие Sale/Order/Booking читаются; новые поля nullable (Booking.
currency → NULL для legacy, честно, без backfill — e2e T3). Fallback на
текущую Product price НЕ используется как «историческая истина». Write для
новых объектов заполняет frozen факты.

## 25. Finance boundaries

Создание snapshot-цепочки НЕ создаёт LedgerTransaction/ProviderFee/
Settlement/Payout/Payment/Refund/Invoice/Commission(Accrual) (e2e T7: counts
без изменений; Order.paymentStatus UNPAID). Ledger auto-posting, double-entry,
balances, FX/tax engine, settlement/payout lifecycle — вне 2.11. Finance
master-data (Currency/Tax/ExchangeRate) остаётся reference data; snapshot не
зависит от live JOIN к ним (все необходимые факты frozen в цепочке).

## 26. Deferred items

Tax engine + snapshot-tax provenance; FX engine + snapshot-FX provenance;
promo/coupon engine; commission policy/accrual (2.12C/E); Payment runtime
(2.12); ledger auto-posting; Settlement/Payout lifecycle (2.14); reprice/
reschedule engine; Finance Center frontend; налоговые/валютные поля в
Booking/Order (добавятся аддитивно вместе с producer-ами).
