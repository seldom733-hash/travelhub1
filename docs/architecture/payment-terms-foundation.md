# Payment Terms / Payment Scheme Foundation (Step 2.3B)

**Статус:** реализовано (Step 2.3B), ожидает Strict Review.
**Связанные документы:** `checkout-commercial-intent.md` (2.3A), `quote-commercial-offer.md`
(2.3), `sales-domain-foundation.md` (2.1), ADR-0001, Roadmap v3 (2.3B/2.12F/2.5B/2.8A),
Deferred Decisions Map.

---

## 1. Ownership

**Владелец payment terms — Sales** (`sales.CheckoutIntent`). Обоснование:

- Roadmap 2.3B: «Partner выбирает только разрешённые платформой схемы/параметры;
  Sale/Order хранит immutable financial snapshot» — выбор происходит в Sales/Checkout
  flow до Sale completion;
- ADR-0001 соблюдён: Sales пишет только в `sales.*`; никаких записей в Finance
  (Finance schema ещё не существует);
- payment terms НЕ являются Finance-контрактом: это коммерческое обязательство
  покупателя, зафиксированное до будущего Sale/Order propagation (2.4/2.5);
- Finance владеет Payment/PaymentTerms в *полном* смысле (PMT-*, PSP, ledger) —
  начиная со своих шагов (2.10C/2.12); в 2.3B нет Payment/PSP/ledger.

## 2. Canonical scheme vocabulary

Roadmap v3 §2.3B + Baseline 1.6 (payment terms section) задают ровно 5 схем —
реализованы без переименований и без «запаса» схем:

| Scheme | initialAmount | remainingAmount | prepayment-параметры | Due semantics (несёт enum) |
|---|---|---|---|---|
| `FULL_PREPAYMENT` | = total | 0 | запрещены | IMMEDIATE (вся сумма сейчас) |
| `PARTIAL_PREPAYMENT` | вычислено (0 < initial < total) | total − initial | PERCENTAGE \| FIXED (обязательны) | BEFORE_SERVICE (остаток до услуги) |
| `DEPOSIT` | вычислено (0 < initial < total) | total − initial | PERCENTAGE \| FIXED (обязательны) | AT_SERVICE (остаток при услуге) |
| `PAY_LATER` | 0 | total | запрещены | BEFORE_SERVICE |
| `PAY_AT_SERVICE` | 0 | total | запрещены | AT_SERVICE (отличим от PAY_LATER) |

## 3. Scheme semantics (точные)

- **FULL_PREPAYMENT**: покупатель оплачивает всю сумму сейчас; `remainingAmount = 0`;
  никакого client-supplied amount; никакого percentage/fixed поля (422 при передаче).
  Zero-total edge: при total = 0 initial = 0, remaining = 0 — корректна (нечего платить).
- **PARTIAL_PREPAYMENT**: предоплата `PERCENTAGE (0 < p < 100)` или `FIXED (0 < v < total)`.
  Строгий инвариант `0 < initialAmount < total`; 100% → 422 «use FULL_PREPAYMENT»;
  0 → 422. Остаток — до оказания услуги (BEFORE_SERVICE).
- **DEPOSIT**: задаток — **ЧАСТЬ total** (Roadmap 2.12F: «Deposit, 30/70 и другие
  разрешённые схемы»): `remainingAmount = total − depositAmount`; НЕ отдельное
  обязательство сверх total. Может задаваться PERCENTAGE или FIXED. Остаток — при
  оказании услуги (AT_SERVICE). Вычислительно DEPOSIT и PARTIAL_PREPAYMENT
  идентичны (та же формула 0 < initial < total); отличие — ТОЛЬКО в due-семантике,
  которую несёт сам enum (AT_SERVICE vs BEFORE_SERVICE) — явно задокументировано,
  никакого скрытого поведения (§11/§25).
- **PAY_LATER**: 0 сейчас, вся сумма до оказания услуги (BEFORE_SERVICE). Без fake
  due timestamp (due-time model — 2.8A; due dates/reminders — 2.12F/Finance).
- **PAY_AT_SERVICE**: 0 сейчас, вся сумма при оказании услуги (AT_SERVICE) — явно
  отличим от generic PAY_LATER (different scheme + AT_SERVICE semantics); без fake
  UTC service instant (2.3A поддерживает только date-only serviceDate).

## 4. Monetary authority

`Issued Quote → frozen Checkout total → server-derived Payment Terms amounts`.

- Запрещено: frontend → initialAmount/remainingAmount (forged → 422);
- запрещено: повторное чтение текущей Catalog/Tariff цены для расчёта terms
  (binding-price frozen, единый price authority, §12);
- payment terms НЕ меняют Checkout total (коммерческое намерение остаётся total).

## 5. Decimal / rounding / reconciliation

- Представление: DECIMAL(12,2) (существующий platform contract);
- математика: decimal.js (Prisma.Decimal), НИКАКИХ JS floating-point;
- percentage: `round_half_up(total × p / 100, 2)` (ROUND_HALF_UP, как sales.money);
- fixed: точное значение, нормализация 2dp half-up;
- обязательный инвариант: `initialAmount + remainingAmount == Checkout.total` для
  всех prepaid-схем (доказано unit + e2e, включая awkward values: 199.98/33.33%,
  0.05/50%, 123.45/17.5%);
- rounding не может обнулить initial (0 после округления → 422) и не может дать
  initial == total (→ 422 «use FULL_PREPAYMENT»);
- overflow guard: prepaymentValue за пределами DECIMAL(12,2) → 422, не Prisma 500.

## 6. Data model (sales.*)

Поля **непосредственно на `CheckoutIntent`** (минимальная модель, §15; отдельная
entity не нужна — terms это единственная current commercial configuration):

```
paymentScheme      PaymentScheme?          // NULL = not selected
prepaymentType     PaymentPrepaymentType?  // PERCENTAGE|FIXED (PARTIAL/DEPOSIT)
prepaymentValue    Decimal(12,2)?          // p (0<p<100) или v (0<v<total)
initialAmount      Decimal(12,2)?          // server-derived
remainingAmount    Decimal(12,2)?          // server-derived
```

- `NULL = payment terms not selected` (честно; НЕ подразумевается дефолтная схема);
- **нет backfill** для existing Checkout rows (ни одна существующая строка не
  получает выдуманную схему);
- currency НЕ дублируется — наследуется от Checkout (единая валюта intent).

## 7. Mutability / CAS

- Мутация только через отдельную команду `PUT /checkouts/:code/payment-terms`
  (никакого generic PATCH);
- пока Checkout ACTIVE и Sale не завершён — terms изменяемы (replace: новая схема
  атомарно заменяет предыдущую);
- после CANCELLED — immutable (422);
- все изменения требуют `expectedVersion`: stale → 409; два concurrent update →
  ровно один успех (один history fact); terms-update vs cancel — один победитель
  (CAS по version);
- Step 2.4 получит однозначный frozen terms snapshot (поля на intent, без
  reinterpretation).

## 8. API surface

```
PUT /api/v1/sales/checkouts/:code/payment-terms   (sales.checkout.write)
  body: { scheme, prepaymentType?, prepaymentValue?, expectedVersion }
  → 200 detail (paymentTerms: нормализованная проекция)
  → 400/401/403/404/409/422 + requestId
```

Projection (detail и list): `paymentTerms: null | { scheme, prepaymentType,
prepaymentValue, initialAmount, remainingAmount }`. `null` = not selected (никакой
частично сфабрикованной zero-схемы, §34).

## 9. DTO / mass-assignment

Forbidden keys (raw-body до DTO-strip): id/code/quote*/customerId/status/currency/
subtotal/discount*/total/price/unitPrice/amount/fee/tax/paidAmount/paymentStatus/
**initialAmount/remainingAmount**/dueAt/dueDate/dueTrigger/orderId/paymentId/
pspReference/provider/availability/capacity/serviceDate/travelers/acquisitionSource/
options/cancelledAt/timestamps/actor/history/requestId/correlation.

## 10. RBAC / capabilities

Используются существующие `sales.checkout.read` / `sales.checkout.write` (новые
permissions не создаются):

- ADMIN — всё;
- SALES_MANAGER — write (set terms);
- DIRECTOR — read-only (существующая матрица);
- FINANCE — НЕ получает checkout write «потому что payment» (payment terms ≠
  Finance permission);
- OPERATOR/BUYER/PARTNER/MODERATOR/ANALYST/MARKETER — 403 (кроме одобренных матриц).

Роли = presets; per-user capabilities — Step 3.12E/DD-021 (не нарушено, без
hardcoded `if role === SALES_MANAGER` в бизнес-логике).

## 11. Boundaries (не реализовано)

- НЕ Payment / transaction / PSP intent / authorization / capture / refund /
  invoice / ledger / settlement / payout / commission / paid status;
- НЕ изменяется Checkout total; НЕ создаются Order/Booking/Payment;
- НЕ публикуется OrderRequested; Sale не закрывается (остаётся OPEN);
- availability НЕ резервируется (DD-022 остаётся обязательным prerequisite до 2.4:
  atomic revalidate/reserve перед OrderRequested);
- public/BUYER checkout остаётся Step 3.31; anonymous identity не создаётся;
- `acquisitionSource` НЕ меняется (DIRECT остаётся server-authoritative);
- события не создаются (нет consumer → нет event, §41): Step 2.4/2.5 прочитают
  authoritative Checkout/Sale snapshot.

## 12. Quote-expiry interaction

Frozen Checkout price остаётся authoritative независимо от истекшего source Quote
(terms ссылаются на frozen total, не на reprice). `quoteExpired` НЕ блокирует
terms mutation (Checkout ACTIVE → мутация допустима); он влияет только на future
Sale completion (2.4). Документировано минимально-безопасно, без молчаливой policy.

## 13. Temporal / history / audit

- `updatedAt` НЕ используется как payment-terms milestone;
- History action `payment_terms_changed` (immutable, actor, from/to scheme,
  semantic config + derived monetary summary, БЕЗ PII/raw body);
- AuditLog `sales.checkout.payment_terms_changed` (code/ref, scheme from/to, safe
  summary; actor/correlation — существующая инфраструктура; без PII).

## 14. Migration

`20260810092034_add_payment_terms_foundation`: enums PaymentScheme +
PaymentPrepaymentType (sales.*); CheckoutIntent +5 nullable колонок. Аддитивная,
**без backfill** (existing rows остаются NULL = not selected), deterministic, clean
replay, no drift; предыдущие миграции не тронуты.

## 15. Step 2.4 prerequisites (после 2.3B)

- DD-022 availability reservation/locking owner + atomic gate (до/в 2.4);
- outbox retry reliability prerequisite;
- payment terms snapshot propagation (frozen поля intent — готовы к snapshot);
- acquisition source propagation (2.5B);
- commercial snapshot contract (Quote→Checkout→Sale frozen chain);
- Sale completion idempotency/atomicity.

## 16. Tests

- Unit `sales.payment-terms.spec.ts` (21): все схемы, Decimal/rounding, границы
  (0/100/100.01, fixed ==total/>total/0), reconciliation (awkward values), invalid
  combinations, overflow guards, date-only AT_SERVICE semantics.
- E2E `payment-terms.e2e-spec.ts` (16 тестов, покрытие 24 пунктов §43): auth/RBAC,
  все 5 схем, forged derived → 422, Decimal reconciliation, CAS (stale 409 +
  concurrent one-winner), cancelled immutable, history/audit no PII, legacy
  null-proof (no fake backfill), isolation (no Order/Booking/Payment/OrderRequested,
  Sale OPEN, availability not reserved, source unchanged), requestId/error envelope.

## 17. Deferred (не обязательная часть 2.3B)

PSP execution, due reminders, installments beyond canonical 2.3B, refundable/
non-refundable deposit policy (Roadmap не определяет), offline collection workflow,
finance ledger treatment — 2.12F/2.13/Finance.
