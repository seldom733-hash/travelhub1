# PHASE 2 — STEP 2.11 — PRICING & FINANCIAL SNAPSHOT — IMPLEMENTATION REPORT

**Verdict:** `PHASE 2 STEP 2.11 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
**Date:** 2026-08-14
**NEXT:** `PHASE 2 — STEP 2.11 — STRICT REVIEW` (НЕ выполняется в этом проходе)

---

## 1. Verdict

**`PHASE 2 STEP 2.11 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`**

Аудит показал: frozen money snapshot уже реализован по всей цепочке
Quote → CheckoutIntent → Sale → Order → Booking (шаги 2.3–2.5/2.8) с единым
денежным контрактом. Step 2.11 закрыл единственный пробел исторической
денежной истины (`Booking.amount` без валюты), формализовал канонический
consistency-валидатор snapshot на binding boundary и доказал контракт
adversarial e2e. Tax/FX/commission — documented deferred boundaries (нет
производителей — движки не изобретались). Архитектурных блокеров нет.

## 2. Repository baseline

- branch `master`, HEAD синхронен origin (2.10C закоммичен как e6f0cc5).
- Dirty на старте: нет (чистое дерево после коммита 2.10C).
- Migrations: 50/50 (drift 0) → после 2.11 **51/51** (`20260814100000_add_booking_currency`).
- Backend unit baseline 498/498 → **508/508**; serial e2e baseline 1059/1059
  (59 suites) → **1067/1067** (60 suites); frontend 135/135 + build.
- Roadmap: 2.10–2.10C APPROVED; 2.11 не начат (описание визиона); NEXT после
  2.10C = 2.11. Не относящиеся к шагу изменения не производились.

## 3. Sources inspected

`schema.prisma` (Quote/QuoteItem/CheckoutIntent/Sale/Order/OrderItem/Booking/
finance.*); `sales.money.ts` + spec; `sales.payment-terms.ts` + spec;
`sales.service.ts` (quoteTotals/issue/createCheckoutIntent/completeSale);
`sales.validation.ts`; `checkout.controller.ts`; `finance.money.ts`;
`booking.subscribers.ts`; `order.service.ts` (OrderRequested consumer
validation); `eventbus/domain-events.ts`; e2e: checkout-commercial-intent,
sale-completion-order-requested, order-creation-consumer,
booking-requested-consumer, booking-service-time-model, booking-lifecycle-
completion, booking-temporal-contract, acquisition-source-propagation,
payment-terms, period-pricing, commercial-restriction, reverse-conversion,
remove-bootstrap-order; `docs/contracts/api.md`/`events.md`/`ids.md`;
арх-доки 2.3–2.10C; Roadmap v3; `docs/architecture/temporal-readiness.md`.
Repo-wide поиск writer-ов money-полей и reprice-путей (не по известным файлам).

## 4. Current → Target reconciliation

См. `docs/architecture/pricing-financial-snapshot.md` §4 (полная таблица).
Ключевое: base price/quantity/line/subtotal/discount/total/currency уже frozen
по цепочке; FX-курс/налог/commission — НЕ участвуют в production flow
(нет движков) → deferred; **единственный пробел — Booking.amount без
currency** → закрыт аддитивно.

## 5. Snapshot owner decision

Owner — существующий коммерческий flow (Sales: Quote ISSUE = канонический
freeze; CheckoutIntent = binding; Sale = snapshot; Order/Booking consumers =
verbatim copy, READ-only ADR-0001). НЕ создавался новый finance.PricingSnapshot
(§7/§8 2.11: предпочитать существующего owner; универсальный money-god-object
запрещён). Stop-condition §50.1 отрицателен: owner однозначен.

## 6. Freeze boundary

Quote ISSUE (первый freeze) → CheckoutIntent create (binding, + Step 2.11
consistency gate) → Sale complete (snapshot verbatim) → Order create
(валидированный verbatim) → Booking create (verbatim amount + currency).
После freeze: без repricing/re-tax/re-FX; lifecycle/мастер-data не мутируют.

## 7. Schema / migration

- `Booking.currency String?` — аддитивная nullable-колонка (frozen verbatim
  из OrderItem.currency; NULL = legacy Booking до 2.11, честно, без backfill).
- Миграция `20260814100000_add_booking_currency`:
  `ALTER TABLE "booking"."Booking" ADD COLUMN "currency" TEXT;`
  Аддитивная, 0 destructive ALTER, 0 `db push`, 0 backfill.
- Fresh replay: e2e globalSetup (drop+recreate + migrate deploy) — PASS;
  dev-БД 51/51, `migrate status` up to date, drift 0.

## 8. Monetary vocabulary

Канонический набор подтверждён: `unitPrice`, `quantity`, `line amount`,
`subtotal`, `discountAmount`, `total`, `currency`. `taxAmount`/FX —
deferred (нет producer-ов). Никаких полей «для полноты».

## 9. Decimal / precision

DECIMAL(12,2), decimal.js (Prisma.Decimal), 0 JS float как authority;
overflow guard (максимум 9999999999.99 → 422, не numeric overflow 500);
API — Decimal-строки. Единый источник истины — `sales.money.ts`.

## 10. Rounding

ROUND_HALF_UP 2dp на всех этапах (unit/line/subtotal/discount/payment-terms);
детерминирован; boundary unit-тесты (99.999→100, 99.994→99.99, 33.33% от
99.99 → 33.33/66.66). Consistency gate пересчитывает теми же правилами.

## 11. Currency

Единая ISO 4217 валюта транзакции; frozen во всех агрегатах + Booking
(2.11); mixed-currency Quote → 422 на ISSUE; legacy Booking currency NULL.
`validateFrozenMoneyFact` отклоняет деньги без/с невалидной валютой.

## 12. Tax

Tax/TaxRule — master data (2.10); расчёт в pricing flow ОТСУТСТВУЕТ
(inclusive/exclusive не определены — stop-condition). НЕ изобретался движок;
boundary/deferred задокументирован (арх-док §10). T2b: правка Tax после
freeze не мутирует snapshot.

## 13. FX

ExchangeRate — master data (2.10), конверсии в flow НЕТ (одна валюта;
schema явно: «НЕ выполняет FX-конверсию»). FX engine и snapshot-provenance
deferred (2.12A/2.14D). T2b: правка курса после freeze не мутирует snapshot.

## 14. Discount

Frozen факт (QuoteDiscountType/Value/Amount; PERCENTAGE 0..100, FIXED ≤
subtotal, NONE без value); promo/coupon engine НЕ создавался; gate
пересчитывает discountAmount.

## 15. Direct flow

Quote ISSUE → CheckoutIntent (binding + gate) → Sale → Order → Booking —
frozen verbatim (T1); forged money → 422 (T4); decimal strings (T1/T4).

## 16. Reverse flow

Buyer Request (BUYER_REQUEST) — та же frozen money семантика (T6: идентичные
snapshot-факты; acquisitionSource прокидывается frozen вниз); реальная
reverse-конверсия покрыта отдельным e2e (reverse-conversion).

## 17. Sale → Order propagation

OrderRequested consumer валидирует payload money (currency/subtotal/total/
items обязательны) и персистит verbatim: Order.amount = total,
Order.subtotal/discountAmount, OrderItem.amount/currency (T1/T2/T5).
Никакого вычисления из текущего Product.

## 18. Order → Booking propagation

BookingRequested consumer копирует `amount` + `currency` verbatim из
OrderItem; defensive `validateFrozenMoneyFact` (невалидный факт → событие
FAILED, не молчаливый save). Legacy Booking без currency — NULL, читаем (T3).

## 19. Immutability

Frozen money facts не мутируются: Product price change (T2), master-data
change (T2b), Booking lifecycle (сущ. 2.9A e2e), cancellation (сущ.),
будущий Payment lifecycle (boundary).

## 20. Product-change adversarial proof

T2: Tariff price 150 → 250 после ISSUE; CheckoutIntent/Sale/Order/OrderItem/
Booking сохраняют 150 (frozen). Дополнительно существующие e2e
(period-pricing #15, commercial-restriction #14, payment-terms 13d,
booking-service-time-model 35.10/36.12) доказывают freeze против периодных/
restriction/тарифных правок.

## 21. Tax / FX-change proof

T2b: деактивация Currency USD + правка Tax rate + правка ExchangeRate после
freeze — snapshot (sale.total/order.amount/currency) без изменений; FX/tax
сумм в snapshot нет (движков нет).

## 22. Idempotency

Без изменений (2.4/2.5/2.8): identical replay = no-op; divergent payload =
controlled conflict; unknown P2002 ≠ replay; без raw 500 (существующие e2e).
Snapshot-поля не входят в replay-сравнение там, где это ломало бы идентичный
replay.

## 23. Divergent replay

Sale completion/OrderRequested/BookingRequested divergent payload → controlled
conflict (существующие 2.4/2.5/2.8 e2e, без изменений).

## 24. Concurrency

Product price update vs freeze — freeze при ISSUE (не зависит от текущего
Catalog); master-data update vs транзакция — не влияет (T2b); concurrent Sale
completion / duplicate event delivery — существующие CAS/inbox инварианты;
новых гонок нет.

## 25. Atomicity

По существующему паттерну (freeze + переход + history/outbox атомарно);
binding gate выполняется ДО создания строки (валидный snapshot до записи);
failure → нет частичного snapshot/outbox (существующие 2.4 e2e).

## 26. Write-path audit

Новые writer-ы: `Booking.currency` — ТОЛЬКО booking.subscribers
(BookingRequested consumer, verbatim из OrderItem) — 1 canonical writer;
binding gate — read-only проверка в createCheckoutIntent (не writer).
Существующие money writer-ы без изменений. Unsafe/obsolete — **0**.

## 27. Reprice audit

Repo-wide: downstream получает цену только через frozen snapshots
(OrderRequested payload / Order / OrderItem); ни одного lookup текущего
Product price / повторного tax/FX/rounding после freeze (код прочитан;
T2/T2b доказывают). Скрытых reprice-путей нет.

## 28. RBAC

0 новых прав; owner-права без изменений; read-видимость — существующие
контракты. Finance-read право не даёт менять коммерческую цену (писать цену
может только Sales ISSUE/binding через свои права).

## 29. IDOR

Snapshot-поля не расширяют read surface; currency — часть существующей
Booking read-модели (owner-видимость). Unknown → нейтральный 404 (сущ.).

## 30. Mass assignment

Money/currency/totals — server-owned на всех write-поверхностях
(assertNoForbiddenKeys → 422, loud rejection, не silent-strip). T4: forged
subtotal/total/currency/discountAmount на checkout create → 422.

## 31. PII

Snapshot-факты не содержат PII (только money/currency/refs); traveler PII не
копируется в snapshot-поля; события без PII (сущ. e2e).

## 32. AuditLog

Изменений нет: новые пути (binding gate, Booking currency copy) — server-side
снапшот-валидация/копирование, user-triggered мутаций с новым audit не
вводилось; существующие audit-конвенции не тронуты.

## 33. Events

0 новых событий; payload-ы OrderRequested/BookingRequested не изменены
(currency читается consumer-ом из Order READ-only); ADR-0010 не затронут.

## 34. Ledger boundary

Создание snapshot-цепочки не пишет LedgerTransaction (T7: counts без
изменений); auto-posting/double-entry/balances/reversal — 0 (код + e2e).

## 35. ProviderFee / Settlement / Payout boundary

Snapshot НЕ создаёт ProviderFee/Settlement/Payout и НЕ связывается с ними
автоматически (T7); 2.10B immutable факты не источник pricing.

## 36. Payment / Refund / Invoice / Commission boundary

Payment runtime не начат (Order.paymentStatus UNPAID, T7); Refund/Invoice/
Commission(Accrual) — 0 фактов; 0 authorize/capture/refund/invoice/commission
движков.

## 37. Legacy compatibility

Существующие Sale/Order/Booking читаются; Booking.currency NULL для legacy
(T3); fallback на текущую Product price НЕ используется; write для новых
объектов заполняет frozen факты.

## 38. Negative test coverage matrix

1. anonymous mutation → 401 (сущ. RBAC e2e) ✓
2. forbidden role → 403 (сущ.) ✓
3. unknown/not-owned → 404 (сущ.) ✓
4. forged frozen money → 422 (T4 + сущ. checkout #4) ✓
5. malformed decimal → 422/400 (сущ. validation; unit) ✓
6. zero/negative amount → 422 (сущ. toMoney2/unit) ✓
7. precision overflow → 422 (unit: line/subtotal/overflow; сущ.) ✓
8. excessive scale → 422 (сущ. 2dp contract) ✓
9. unsupported currency → 422 (T4 forged RUB; сущ. ISO) ✓
10. inconsistent subtotal/total → 422 (unit validateFrozenSnapshot; gate) ✓
11. duplicate identical replay → no duplicate (сущ. 2.4/2.5/2.8) ✓
12. divergent replay → controlled conflict (сущ.) ✓
13. unknown P2002 → controlled, не false no-op (сущ. 2.10A) ✓
14. Product price change после freeze → no repricing (T2) ✓
15. Tax master-data change → no historical mutation (T2b) ✓
16. FX master-data change → no historical mutation (T2b) ✓
17. Booking lifecycle → no money mutation (сущ. 2.9A #31; арх-док) ✓
18. cancellation → no historical money rewrite (сущ. 2.9) ✓
19. no ledger auto-post (T7) ✓
20. no ProviderFee/Settlement/Payout auto-create (T7) ✓
21. no Payment runtime side effect (T7: paymentStatus UNPAID) ✓
22. no PII leakage (сущ. e2e; snapshot без PII) ✓
23. failed transaction → no partial snapshot/outbox (сущ. 2.4) ✓
24. legacy row без currency → читаем (T3) ✓

## 39. Positive test coverage matrix

1. canonical flow фиксирует snapshot (T1) ✓
2. decimal serialization string-based (T1/T4) ✓
3. rounding deterministic (unit boundary) ✓
4. Direct acquisition сохраняет snapshot (T1) ✓
5. Buyer Request / Reverse — тот же monetary contract (T6) ✓
6. Sale → Order propagation verbatim (T1/T2/T5) ✓
7. Order → Booking propagation verbatim (T1/T3/T5: amount+currency) ✓
8. multi-item order — независимые item snapshots (T5) ✓
9. replay first-write-wins (сущ. 2.4/2.8; не изменялось) ✓
10. Product change после freeze не влияет (T2) ✓
11. legacy records читаются (T3) ✓
12. correlation/causation при event consumer (сущ. e2e; без изменений) ✓
13. AuditLog минимален (сущ. e2e; новых audit-путей нет) ✓

## 40. Unit results

Unit **508/508** (42 suites). Новое: `validateFrozenMoneyFact` (3 теста),
`validateFrozenSnapshot` (6 тестов: consistent, NONE, line mismatch, subtotal
mismatch, discount mismatch/PERCENTAGE-без-value/NONE-с-value, total mismatch/
negative, overflow/bad currency/empty lines). Существующие sales.money
(16) без изменений.

## 41. Targeted e2e results

`pricing-financial-snapshot.e2e-spec.ts` — **8/8** (T1, T2, T2b, T3, T4, T5,
T6, T7). Регрессионные затронутые суites (booking-requested-consumer,
booking-service-time-model, acquisition-source-propagation,
checkout-commercial-intent, sale-completion-order-requested,
order-creation-consumer, booking-temporal-contract, payment-terms) —
**155/155** PASS.

## 42. Full serial e2e results

**1067/1067, 60 suites** (baseline 1059/59, +1 suite / +8 тестов).

## 43. Frontend regression

Фронт не изменён (git diff 0 frontend файлов), но прогнано: `tsc --noEmit`
PASS; Vitest **135/135 (23 files)**; `next build` (production) —
**Compiled successfully**.

## 44. DB regression

- Migrations: **51/51** (новая `20260814100000_add_booking_currency`);
  `migrate status` = up to date; drift 0.
- Fresh replay: e2e globalSetup (drop+recreate + `migrate deploy`) — PASS
  (каждый e2e-прогон стартует на пересозданной БД с реальными миграциями).
- Без `db push`.

## 45. Issues found

1. **Booking.amount без currency** — единственный пробел канонической
   денежной истины вниз по цепочке (деньги без валюты не имеют однозначной
   семантики). Не дефект реализации — пробел контракта, закрыт 2.11.
2. E2E-черновик T6 содержал мусорные строки (незавершённая симуляция
   reverse-источника) — переписан на hook `beforeIssue` (чисто).
3. Availability-эндпоинт в первом черновике спеки был неверный
   (`/products/availability` вместо `/products/:id/availability`) — исправлен.

## 46. Fixes applied

1. `Booking.currency` (schema + миграция + consumer verbatim + defensive
   validateFrozenMoneyFact).
2. `validateFrozenSnapshot` consistency gate на createCheckoutIntent (422).
3. E2E-спека переписана/починена (T6 hook, availability endpoint) — 8/8.

## 47. Exact files changed

Backend:
- `backend/prisma/schema.prisma` — `Booking.currency String?` (+док);
- `backend/prisma/migrations/20260814100000_add_booking_currency/migration.sql` — новый;
- `backend/src/modules/sales/sales.money.ts` — `validateFrozenMoneyFact`,
  `validateFrozenSnapshot` (+FrozenSnapshotInput/Line);
- `backend/src/modules/sales/sales.money.spec.ts` — unit +9;
- `backend/src/modules/sales/sales.service.ts` — binding gate в
  createCheckoutIntent (+import);
- `backend/src/modules/booking/booking.subscribers.ts` — `currency` verbatim +
  defensive validation (+import);
- `backend/test/pricing-financial-snapshot.e2e-spec.ts` — НОВЫЙ (8 тестов).

Docs:
- `docs/architecture/pricing-financial-snapshot.md` — НОВЫЙ (26 секций);
- `docs/contracts/api.md` — Booking frozen money fact (currency) контракт;
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` — статус 2.11;
- `docs/prompts/PHASE_2_STEP_2.11_PRICING_FINANCIAL_SNAPSHOT_IMPLEMENTATION_REPORT.md` — этот отчёт.

Не тронуты: `docs/contracts/events.md` (0 событий), `docs/contracts/ids.md`
(0 новых ID-prefix), frontend (0 файлов).

## 48. Architecture decision status

Архитектурных блокеров НЕТ: owner snapshot однозначен (существующий flow);
inclusive/exclusive tax — deferred (нет producer-а, не решалось);
FX source/rate selection — deferred (нет конверсии); discount/precedence —
frozen факт без promo-engine; commission formula — deferred (2.12C/E);
supplier net vs buyer gross — вне scope; ledger/payment/settlement/payout —
boundary. НИ ОДНОГО «разумного предположения» на месте неопределённости.

## 49. Deferred / out-of-scope

Tax engine + snapshot-tax; FX engine + snapshot-FX; promo/coupon engine;
commission policy/accrual (2.12C/E); Payment runtime (2.12); ledger
auto-posting; double-entry/balances; Settlement/Payout lifecycle (2.14);
refund/invoice engines; availability release; reschedule/reprice engine;
Finance Center frontend; notification engine.

## 50. Roadmap update

Step 2.11 → `🚧 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW
(2026-08-14)` (краткое саммари реализации + визион сохранён; tax/FX/commission
части явно помечены как deferred до canonical producer-ов).

## 51. Exact NEXT item

`PHASE 2 — STEP 2.11 — STRICT REVIEW` — отдельный adversarial-промпт; в этом
проходе НЕ выполняется (hard stop §54 соблюдён). Step 2.12 не начат.
