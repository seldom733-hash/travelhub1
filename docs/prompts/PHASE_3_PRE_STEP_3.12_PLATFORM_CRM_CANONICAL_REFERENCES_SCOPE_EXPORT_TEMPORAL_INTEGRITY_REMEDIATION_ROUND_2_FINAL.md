# PHASE 3 — PRE-STEP 3.12 — PLATFORM CRM CANONICAL REFERENCES + CUSTOMER SCOPE + EXPORT + TEMPORAL INTEGRITY — REMEDIATION ROUND 2 FINAL

> **FINAL SUPERSEDING PROMPT**
>
> Этот prompt полностью заменяет все ранее подготовленные Round 2 по:
>
> - Commercial Reference Presentation Consistency;
> - Platform CRM Customer Scope;
> - Legacy Code / Export Contract;
> - Commerce Chain Integrity.
>
> **Предыдущие Round 2 НЕ ЗАПУСКАТЬ.**
>
> Выполнить только этот prompt.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**.

На русском обязательны:

- Implementation / Remediation Report;
- Audit / Runtime Evidence;
- findings;
- root cause analysis;
- architecture decisions;
- security findings;
- reconciliation;
- conclusions;
- recommendations;
- verdict explanations.

English разрешён только для technical identifiers: paths, classes, methods, DTO/models/tables, API endpoints, HTTP methods/status codes, CLI/Git commands, commit messages, enums, permissions, code snippets и standardized `VERDICT` strings.

Если итоговый report преимущественно English — задача незавершена.

Не включать plaintext passwords, tokens, secrets или credentials.

---

# 1. OBJECTIVE

Выполнить evidence-first repository-wide audit + remediation следующих связанных проблем:

```text
1. Marketplace canonical references
2. Legacy transaction codes
3. Platform CRM Customer business scope
4. Customer 360 Orders / Bookings / Payments
5. CRM Activity references
6. CSV/XLSX export semantics
7. Parallel/legacy Order Number TH-*
8. Historical commercial-chain chronology
9. Booking lifecycle chronology
10. Payment / refund / currency integrity
```

Это не cosmetic prefix task.

Цель — привести:

```text
DB
→ domain model
→ API
→ DTO/read model
→ UI
→ Customer 360
→ Activity
→ Search
→ CSV/XLSX
→ Analytics/drill-down
```

к одному доказанному business contract.

---

# 2. IMPORTANT SCOPE LIMIT — FINANCE CENTER DOES NOT EXIST YET

Полноценный:

```text
Finance Center
```

на текущем этапе **ещё не реализован**.

Следовательно:

- НЕ создавать `/app/finance`;
- НЕ создавать новый Payments Center;
- НЕ добавлять новый Finance sidebar item;
- НЕ использовать отсутствие Finance Center как defect этой remediation.

Payment runtime проверять через **фактически существующие surfaces**, прежде всего:

```text
Platform CRM
→ Клиенты
→ Customer 360
→ Платежи
```

а также через:

```text
Orders export
Bookings export
existing payment APIs/read models
Order/Booking detail if applicable
Analytics/drill-down if фактически существует
CSV/XLSX
CRM Activity
```

---

# 3. AUTHORITATIVE RUNTIME EVIDENCE — CUSTOMER 360

Пользователь вручную обнаружил:

## Orders

```text
Platform
→ CRM
→ Клиенты
→ Customer 360
→ Заказы

actual:
ORD-*

expected canonical Marketplace reference:
MKT-ORD-*
```

## Bookings

```text
Platform
→ CRM
→ Клиенты
→ Customer 360
→ Бронирования

actual:
BKG-*

expected:
MKT-BKG-*
```

## Payments

Конкретный runtime row:

```text
Payment ID:
87aef592-9394-4ec7-967-5f8b732dccbd

Code:
PAY-00000790

Status:
CAPTURED

Amount:
89.88 AZN

Order Ref:
MKT-ORD-000461

Order Number:
TH-2026-000790

Paid At:
24.12.2026
```

Тот же Payment UUID в Booking export:

```text
Payment ID:
87aef592-9394-4ec7-967-5f8b732dccbd

Payment Reference:
MKT-PAY-00000461-1
```

Следовательно, один и тот же Payment сейчас представлен:

```text
Customer 360:
PAY-00000790              ← legacy code

Booking export:
MKT-PAY-00000461-1        ← canonical reference
```

Это доказанный cross-view inconsistency.

---

# 4. AUTHORITATIVE EXPORT EVIDENCE — ORDERS

Реальная строка Orders export:

```text
ID:
8c7bb59a-e325-437f-9fb-f2a51417a7bd

Reference:
MKT-ORD-000107

Code:
ORD-00000174

Status:
CLOSED

Payment Status:
REFUNDED

Amount:
136.8 AZN

createdAt:
2026-12-31T05:01:00.000Z

updatedAt:
2026-08-23T13:25:12.005Z

Source:
MARKETPLACE

Booking:
MKT-BKG-00000107

Payment:
MKT-PAY-00000107-1

Payment Status:
CAPTURED

Payment Amount:
939.16 USD

Paid At:
2026-07-04T04:16:00.000Z
```

---

# 5. AUTHORITATIVE EXPORT EVIDENCE — BOOKINGS

Пример 1:

```text
Booking ID:
8a66f51f-60af-46d3-1116-c895bd4a3bb7

Reference:
MKT-BKG-00000216

Code:
BKG-00000369

Status:
COMPLETED

Amount:
96.9 AZN

createdAt:
2026-12-31T14:18:00.000Z

updatedAt:
2026-12-31T14:18:00.000Z

serviceDate:
2027-01-09T14:18:00.000Z

Order:
MKT-ORD-000216

Payment:
MKT-PAY-00000216-1
96.9 AZN
```

Пример 2:

```text
Reference:
MKT-BKG-00000461

Code:
BKG-00000790

Status:
COMPLETED

Amount:
89.88 AZN

createdAt:
2026-12-24T15:02:00.000Z

serviceDate:
2027-01-03T15:02:00.000Z

Order:
MKT-ORD-000461

Payment:
MKT-PAY-00000461-1
89.88 AZN
```

---

# 6. PREVIOUS CLAIM INVALIDATION

Предыдущие reports заявляли приблизительно:

```text
legacy ORD-* = 0
legacy BKG-* = 0
legacy PAY-* = 0
```

Но реальные exports доказывают:

```text
Order.referenceNumber = MKT-ORD-...
Order.code            = ORD-...

Booking.referenceNumber = MKT-BKG-...
Booking.code            = BKG-...

Payment.referenceNumber = MKT-PAY-...
Payment.code            = PAY-...
```

Следовательно, нельзя больше использовать ambiguous claim:

```text
legacy ORD-* = 0
```

без указания конкретного field.

---

# 7. FIELD-BY-FIELD DB TRUTH

Для:

```text
Request
Order
Booking
Payment
Refund
```

проверить отдельно:

```text
id
code
referenceNumber
commerceSequence
number/orderNumber
externalNumber
legacy aliases
```

Сформировать matrix:

| Entity | Field | Pattern | Count | Purpose | Canonical? | User-facing? |
|---|---|---|---:|---|---|---|

Queries должны быть exact.

Например, не смешивать:

```text
Order.code LIKE 'ORD-%'
```

с:

```text
Order.referenceNumber LIKE 'ORD-%'
```

---

# 8. CANONICAL MARKETPLACE REFERENCE CONTRACT

Target:

```text
Request → MKT-REQ-xxxxxxxx
Order   → MKT-ORD-xxxxxxxx
Booking → MKT-BKG-xxxxxxxx
Payment → MKT-PAY-xxxxxxxx-n
```

Master data:

```text
Customer → CRM-*
Partner  → PRN-*
```

Shared root:

```text
MKT-ORD-00000461
MKT-BKG-00000461
MKT-PAY-00000461-1
```

UUID/FK остаётся authoritative relational identity.

Reference — human/business traceability.

---

# 9. LEGACY CODE CONTRACT AUDIT

Для:

```text
Order.code
Booking.code
Payment.code
Request.code
Refund.code
```

установить:

- происхождение;
- generation logic;
- uniqueness;
- DB dependencies;
- integrations;
- search usage;
- API usage;
- UI usage;
- export usage;
- backward compatibility purpose;
- можно ли deprecate;
- можно ли перестать exposing пользователю.

**Не удалять legacy fields из DB без доказательства безопасности.**

---

# 10. BUSINESS PRESENTATION CONTRACT

Если audit подтверждает `referenceNumber` как canonical Marketplace business identifier:

```text
Business UI:
referenceNumber

Business CSV/XLSX:
referenceNumber

Search result display:
referenceNumber

CRM Activity:
referenceNumber

Customer 360:
referenceNumber
```

Legacy `code` может остаться internal/compatibility field, но не должен конкурировать с canonical reference как основной пользовательский номер.

---

# 11. LEGACY FALLBACK FORBIDDEN FOR NORMALIZED MARKETPLACE PRESENTATION

Не считать финальным исправлением:

```ts
referenceNumber ?? code
```

если `referenceNumber` по persistence/domain contract обязателен.

Missing `referenceNumber` должен выявлять defect, а не молча возвращать:

```text
ORD-*
BKG-*
PAY-*
```

Все legitimate compatibility exceptions перечислить в report.

---

# 12. NO PREFIX FABRICATION

Запрещено:

```ts
`MKT-${code}`
replace("ORD-", "MKT-ORD-")
replace("BKG-", "MKT-BKG-")
replace("PAY-", "MKT-PAY-")
```

Canonical reference брать из authoritative persisted/read contract.

---

# 13. CUSTOMER 360 — REFERENCE REMEDIATION

Исправить доказанные runtime defects:

```text
Customer 360 Orders:
ORD-* → MKT-ORD-*

Customer 360 Bookings:
BKG-* → MKT-BKG-*

Customer 360 Payments:
PAY-* → MKT-PAY-*-n
```

Для Payment UUID:

```text
87aef592-9394-4ec7-967-5f8b732dccbd
```

после fix Customer 360 должен показывать тот же canonical reference, который export показывает как:

```text
MKT-PAY-00000461-1
```

---

# 14. ORDER DETAIL → RELATED BOOKINGS

Известный runtime defect:

```text
Orders Center
→ Order Detail
→ Related Bookings
→ BKG-* ❌
```

Trace:

```text
Booking UUID
DB code
DB referenceNumber
API nested projection
DTO
frontend type
render binding
```

Expected:

```text
MKT-BKG-*
```

---

# 15. CRM ACTIVITY

Runtime показывает:

```text
ORD-*
BKG-*
PAY-*
RFD-*
```

Для Marketplace:

```text
ORD-* → MKT-ORD-*
BKG-* → MKT-BKG-*
PAY-* → MKT-PAY-*-n
```

через authoritative reference fields.

---

# 16. REFUND RFD-* — AUDIT, DO NOT GUESS

Не преобразовывать автоматически:

```text
RFD-* → MKT-RFD-*
```

Сначала определить:

```text
Refund model/table
code
referenceNumber
commerceSequence if any
Payment relation
Order relation
generation logic
search/export/UI contract
```

Если canonical Refund Reference Contract отсутствует — зафиксировать отдельный architecture gap.

---

# 17. TH-2026-* ORDER NUMBER AUDIT

Customer 360 Payments показывает:

```text
Order Ref:
MKT-ORD-000461

Order Number:
TH-2026-000790
```

Не удалять `TH-2026-*` автоматически.

Определить точную семантику:

```text
field name
origin
generation logic
business purpose
legacy/current status
invoice/order/customer-facing meaning
uniqueness
API consumers
UI consumers
export consumers
```

Установить relationship:

```text
Order.referenceNumber = MKT-ORD-*
Order.code            = ORD-*
Order Number          = TH-2026-*
```

Нужно понять, почему одна Order имеет три потенциальных human identifiers и какой из них для чего предназначен.

Если `TH-*` имеет отдельную доказанную бизнес-функцию — сохранить с корректным label.

Если это ещё один legacy competing identifier — deprecate from normal presentation.

---

# 18. EXPORT CONTRACT — ORDERS

Сейчас:

```text
Reference = MKT-ORD-000107
Code      = ORD-00000174
```

Audit должен решить, нужен ли `Code` обычному business user.

Если нет:

```text
standard business export
→ убрать legacy Code column
```

Legacy field можно сохранить только в explicit diagnostic/admin export при доказанной необходимости.

---

# 19. EXPORT CONTRACT — BOOKINGS

Сейчас:

```text
Reference = MKT-BKG-00000216
Code      = BKG-00000369
```

Кроме того:

```text
Order Code      = MKT-ORD-000216
Order Reference = MKT-ORD-000216
```

То есть `Order Code` фактически дублирует canonical reference и label выглядит misleading.

Проверить фактический export mapper.

Target:

- не иметь двух одинаковых columns с разными названиями;
- не называть `referenceNumber` словом `Code`;
- не exposing legacy Booking Code без доказанной business necessity.

---

# 20. EXPORT CONTRACT — PAYMENT REFERENCES

Orders/Bookings exports уже содержат:

```text
Payment References = MKT-PAY-*
```

Сопоставить с Customer 360 Payment `PAY-*`.

Один Payment UUID должен иметь один canonical business reference во всех business surfaces.

---

# 21. EXPORT CONTRACT — PROJECT SURFACES IN CURRENT SCOPE

Проверить существующие, а не будущие surfaces:

```text
Orders export
Bookings export
CRM Customers export
Customer-related exports if present
existing payment export endpoint if реально существует
Requests export if implemented
Analytics exports if implemented
```

Не создавать Finance Center.

---

# 22. PLATFORM CRM CUSTOMER BUSINESS SCOPE

Один master Customer может иметь:

```text
Marketplace commerce
+
Storefront commerce
```

Это допустимо.

Но:

```text
Platform Customer 360
= master Customer
+ Marketplace business activity only
```

Storefront customer commerce относится к соответствующему Partner/Storefront Workspace.

---

# 23. CUSTOMER REGISTRY ELIGIBILITY

Audit фактического rule.

Target:

```text
Marketplace-only Customer
→ Platform CRM YES

Mixed MKT + SF Customer
→ Platform CRM YES due Marketplace relationship

Storefront-only end-customer
→ Platform Marketplace CRM NO
```

Не использовать reference prefix как authorization/scope source.

---

# 24. SERVER-SIDE SCOPE

Запрещено:

```text
backend returns MKT + SF
frontend hides SF
```

Scope должен применяться в query/read model до:

```text
totals
pagination
export
KPI
activity
```

---

# 25. CUSTOMER 360 FULL SCOPE AUDIT

Проверить:

```text
Orders
Bookings
Payments
Requests
Refunds
Activity
KPI/totals
financial aggregates
last activity
search
exports
links
```

Platform context → Marketplace customer commerce only.

---

# 26. MIXED CUSTOMER TEST

Найти реального Customer:

```text
same Customer UUID
├ MKT activity
└ SF activity
```

Доказать:

```text
DB:
both remain

Platform Customer 360:
MKT only

correct Partner/Storefront Workspace:
its SF data remains
```

Не удалять SF data.

---

# 27. STOREFRONT-ONLY CUSTOMER TEST

Storefront-only end-customer без Marketplace relationship:

```text
Platform CRM Customers → absent
```

при этом DB record и Partner Workspace data сохраняются.

---

# 28. MARKETPLACE-ONLY CUSTOMER TEST

Marketplace-only customer должен корректно работать после scope remediation.

---

# 29. CRM ACTIVITY BUSINESS SCOPE

Если это Platform Marketplace CRM Activity:

```text
Storefront end-customer events
→ excluded server-side
```

Проверить rows + totals + pagination + search + export where applicable.

---

# 30. TEMPORAL ANOMALY — ROOT 107

Доказанная строка:

```text
Order MKT-ORD-000107

Payment.paidAt:
2026-07-04

Order.updatedAt:
2026-08-23

Order.createdAt:
2026-12-31
```

Получается:

```text
Payment.paidAt < Order.createdAt
Order.updatedAt < Order.createdAt
```

Это требует forensic trace.

---

# 31. ROOT 00000107 FORENSIC TRACE

Для commerce root `107` показать:

```text
Request if exists
Order
Booking
Payment(s)
Refund(s)
```

Для каждой:

```text
UUID
code
referenceNumber
commerceSequence
status
amount
currency
createdAt
updatedAt
serviceDate
paidAt
refund timestamps
relationships
```

Объяснить anomalies evidence-based.

---

# 32. REPOSITORY-WIDE TEMPORAL INTEGRITY AUDIT

Посчитать минимум:

```text
Order.updatedAt < Order.createdAt

Booking.updatedAt < Booking.createdAt

Payment.updatedAt < Payment.createdAt

Booking.createdAt < related Order.createdAt

Payment.createdAt < related Order.createdAt

Payment.paidAt < related Order.createdAt

converted Request.createdAt > Order.createdAt
```

Где fields/contract applicable.

Вывести:

```text
count
percentage
sample UUID/reference
source/root cause
```

---

# 33. BOOKING LIFECYCLE TEMPORAL INTEGRITY

Новые export findings:

```text
MKT-BKG-00000216
Status      = COMPLETED
createdAt   = 2026-12-31
serviceDate = 2027-01-09

MKT-BKG-00000461
Status      = COMPLETED
createdAt   = 2026-12-24
serviceDate = 2027-01-03
```

Если `COMPLETED` означает реально оказанную/завершённую услугу, это потенциально невозможно до serviceDate.

Сначала установить фактическую семантику `COMPLETED`.

---

# 34. BOOKING STATUS CONTRACT AUDIT

Определить:

```text
Booking status enum
meaning of NEW
meaning of CONFIRMED
meaning of COMPLETED
who transitions status
when transition occurs
whether completedAt exists
whether service completion is automatic/manual
whether historical seed assigns statuses randomly
```

Не менять status, пока semantics не доказана.

---

# 35. COMPLETED BOOKING ANOMALY COUNTS

Если `COMPLETED` действительно означает service completed, посчитать:

```text
COMPLETED where serviceDate > completion timestamp

COMPLETED where serviceDate > updatedAt
    if updatedAt currently acts as only transition evidence

COMPLETED where serviceDate > NOW
    only if runtime/current-date semantics make this check applicable
```

Если существует `completedAt`, использовать его как primary lifecycle evidence.

Не подменять `completedAt` полем `updatedAt`, если первое существует.

---

# 36. HISTORICAL DATA ROOT CAUSE

Проверить:

```text
seed scripts
backfills
migration scripts
factories
fixtures
manual generators
random date generation
timezone conversion
status generation
```

Не чинить отдельные строки вручную.

---

# 37. HISTORICAL REMEDIATION SAFETY

Если historical data действительно некорректна:

- remediation deterministic;
- preserve IDs;
- preserve canonical reference roots;
- preserve legitimate relations;
- не создавать random replacement dates;
- не ломать Analytics periods;
- не ломать Request SLA/TTL;
- не удалять Storefront representative data;
- документировать before/after counts.

---

# 38. FINANCIAL ANOMALY — ROOT 107

Root 107:

```text
Order:
136.8 AZN

Payment:
939.16 USD
CAPTURED

Order paymentStatus:
REFUNDED
```

Это не объявлять автоматически bug.

Нужен audit semantics.

---

# 39. ORDER AMOUNT SEMANTICS

Доказать, что означает:

```text
Order.amount
Order.currency
```

Например, но не предполагать:

```text
total
deposit
base amount
settlement amount
net amount
```

---

# 40. PAYMENT AMOUNT SEMANTICS

Доказать:

```text
Payment.amount
Payment.currency
Payment.status
logical payment ordinal
```

и relationship к Order/Booking.

---

# 41. MULTI-CURRENCY CONTRACT

Не сравнивать численно AZN и USD без FX contract.

Определить:

- разрешена ли payment currency != order currency;
- где хранится FX snapshot;
- есть ли base/settlement amount;
- есть ли ExchangeRate;
- применяется ли FX к historical records.

Если contract отсутствует — зафиксировать architecture gap.

Не fabricate FX.

---

# 42. CAPTURED PAYMENT + REFUNDED ORDER

Это может быть legitimate lifecycle:

```text
Payment CAPTURED
→ Refund created
→ Order paymentStatus REFUNDED
```

Проверить:

```text
Refund entity
refund amount
refund status
refund timestamps
payment relation
order relation
```

и доказать reconciliation.

---

# 43. FINANCIAL SAMPLE MATRIX

Сформировать:

| Root | Order | Payment(s) | Refund(s) | Currency | Status semantics | Result |
|---|---|---|---|---|---|---|

Минимум:

```text
root 107
root 216
root 461
one multiple-payment case if exists
one refund case
```

Для roots 216/461 уже известны логичные examples:

```text
Booking amount = Payment amount
same currency
```

Использовать их как comparison, но не как universal formula без audit.

---

# 44. SAME UUID CROSS-SURFACE TRACE

Минимум:

```text
5 Orders
5 Bookings
5 Payments
```

Для одного и того же UUID сравнить:

```text
DB
API
Center
Customer 360
CRM Activity
detail
Search
CSV
XLSX
Analytics/drill-down
```

где surface существует.

---

# 45. SEARCH CONTRACT

Canonical Marketplace references должны находиться:

```text
MKT-REQ-*
MKT-ORD-*
MKT-BKG-*
MKT-PAY-*-n
```

Legacy search compatibility может существовать, если доказана необходимость.

Но result display — canonical.

---

# 46. EXPORT FILTER / ROW COUNT

Для существующих registry exports:

```text
filtered total
=
CSV data rows
=
XLSX data rows
```

Scope применяется до export.

---

# 47. SECURITY / TENANT ISOLATION

Hard:

```text
Platform CRM
→ no Storefront end-customer commerce leakage

Storefront A
→ A only

Storefront B
→ B only
```

UUID/code/reference/prefix не является authorization token.

---

# 48. AUTOMATED TESTS — REFERENCES

Добавить regression tests:

```text
Customer 360 Order uses canonical reference
Customer 360 Booking uses canonical reference
Customer 360 Payment uses canonical reference
Order detail related Booking uses canonical reference
CRM Activity Order uses canonical reference
CRM Activity Booking uses canonical reference
CRM Activity Payment uses canonical reference
standard export does not expose unjustified legacy competing Code
```

---

# 49. AUTOMATED TESTS — CUSTOMER SCOPE

Добавить:

```text
Storefront-only customer excluded from Platform CRM
Mixed customer retained via Marketplace relationship
Mixed Customer 360 excludes SF Orders
excludes SF Bookings
excludes SF Payments
excludes SF Activity
totals exclude SF
pagination scoped
exports scoped
```

---

# 50. AUTOMATED TESTS — TEMPORAL

По доказанному domain contract:

```text
createdAt <= updatedAt

Order.createdAt <= Booking.createdAt

Order.createdAt <= Payment.createdAt

Order.createdAt <= Payment.paidAt
when paidAt represents successful post-order payment

Request chronology valid
```

Booking lifecycle tests добавить согласно установленной semantics `COMPLETED`.

---

# 51. TEST REPORTING — TRUTHFUL

Например:

```text
282/283 with 1 failed
```

означает:

```text
FAIL — 282 passed / 283 total
1 failed
```

Не PASS.

Для каждого suite:

```text
passed
failed
skipped
total
```

арифметика должна сходиться.

---

# 52. BROWSER RUNTIME MATRIX — MANDATORY

Проверить фактически существующие pages:

```text
Platform CRM Customers
mixed Customer 360
Customer 360 Orders
Customer 360 Bookings
Customer 360 Payments
Customer 360 Activity
Platform CRM Activity
Orders Center
Order Detail → Related Bookings
Booking Center
Analytics/drill-down where existing
```

**Finance Center не требовать и не создавать.**

---

# 53. CSV/XLSX RUNTIME — MANDATORY

Реально скачать applicable exports после remediation.

Проверить:

```text
Orders
Bookings
other existing exports in scope
```

Для Orders:

```text
Reference = MKT-ORD-*
```

Legacy `Code = ORD-*` не должен оставаться обычным competing business identifier без доказанной необходимости.

Для Bookings:

```text
Reference = MKT-BKG-*
```

Misleading duplicate:

```text
Order Code = MKT-ORD-*
Order Reference = MKT-ORD-*
```

должен быть нормализован по semantic contract.

---

# 54. REQUIRED BEFORE/AFTER MATRIX

| Finding | Before | Expected After | Result |
|---|---|---|---|
| Customer 360 Orders | ORD-* | MKT-ORD-* | |
| Customer 360 Bookings | BKG-* | MKT-BKG-* | |
| Customer 360 Payments | PAY-* | MKT-PAY-*-n | |
| Order Detail related Booking | BKG-* | MKT-BKG-* | |
| CRM Activity Order | ORD-* | MKT-ORD-* | |
| CRM Activity Booking | BKG-* | MKT-BKG-* | |
| CRM Activity Payment | PAY-* | MKT-PAY-*-n | |
| CRM Activity Refund | RFD-* | audited contract | |
| Mixed Customer 360 | MKT + SF | Marketplace only | |
| Orders export Code | ORD-* exposed | evidence-based contract | |
| Bookings export Code | BKG-* exposed | evidence-based contract | |
| Order Code export label | duplicates Reference | normalized semantics | |
| Payment Customer 360 | PAY-* | MKT-PAY-* | |
| Order Number | TH-* | audited semantics | |
| root 107 updatedAt/createdAt | invalid/suspicious | explained/fixed | |
| root 107 paidAt/order.createdAt | invalid/suspicious | explained/fixed | |
| COMPLETED future-service bookings | present | explained/fixed | |
| root 107 amount/currency | suspicious | reconciled/gap | |

---

# 55. REQUIRED REPORT

Создать:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_PLATFORM_CRM_CANONICAL_REFERENCES_SCOPE_EXPORT_TEMPORAL_INTEGRITY_REMEDIATION_ROUND_2_FINAL_REPORT.md
```

Обязательные sections:

1. Starting SHA
2. Git state
3. Superseded prompts/verdicts
4. Reproduced runtime findings
5. Field-by-field DB truth
6. Canonical Reference Contract
7. Legacy Code Contract
8. TH Order Number Contract
9. Export Contract
10. Platform CRM Customer eligibility
11. Mixed Customer evidence
12. Storefront-only Customer evidence
13. Marketplace-only Customer evidence
14. Customer 360 scope audit
15. Customer 360 reference remediation
16. CRM Activity remediation
17. Refund RFD audit
18. Order Detail Related Booking trace
19. Same UUID cross-surface matrix
20. Root 107 forensic trace
21. Repository-wide temporal audit
22. Temporal anomaly counts
23. Booking COMPLETED semantics
24. Booking lifecycle anomaly counts
25. Historical data root cause
26. Historical data remediation
27. Order amount semantics
28. Payment amount semantics
29. Multi-currency/FX findings
30. CAPTURED/REFUNDED reconciliation
31. Financial sample matrix
32. Search
33. CSV/XLSX runtime
34. Analytics/drill-down
35. Security/tenant isolation
36. Automated tests
37. Browser runtime
38. RU/AZ/EN
39. Before/After matrix
40. Remaining gaps
41. Implementation SHA
42. Final HEAD
43. origin/master
44. `HEAD == origin/master`
45. Verdict

---

# 56. ACCEPTANCE CRITERIA

`VERDICT A` разрешён только если:

```text
[ ] known runtime/export defects reproduced before fix

[ ] field-specific DB counts proven
[ ] Order.code / referenceNumber distinguished
[ ] Booking.code / referenceNumber distinguished
[ ] Payment.code / referenceNumber distinguished

[ ] canonical reference contract proven
[ ] legacy Code contract proven
[ ] TH-* semantics proven
[ ] no cosmetic prefix fabrication

[ ] Customer 360 Order → MKT-ORD-*
[ ] Customer 360 Booking → MKT-BKG-*
[ ] Customer 360 Payment → MKT-PAY-*-n
[ ] Order Detail Related Booking → MKT-BKG-*
[ ] CRM Activity ORD/BKG/PAY canonical
[ ] RFD audited without invented contract

[ ] standard business exports use unambiguous identifiers
[ ] misleading duplicate Code/Reference columns normalized

[ ] Storefront-only customers excluded from Platform Marketplace CRM
[ ] mixed customer retained if Marketplace relationship exists
[ ] Platform Customer 360 mixed customer shows MKT commerce only
[ ] Storefront data preserved
[ ] scope is server-side
[ ] totals/pagination/export use same scope

[ ] root 107 forensic trace complete
[ ] updatedAt < createdAt investigated
[ ] paidAt < Order.createdAt investigated
[ ] repository-wide temporal counts produced

[ ] COMPLETED semantics proven
[ ] future-service COMPLETED population audited
[ ] lifecycle data remediated if invalid

[ ] amount/currency semantics proven
[ ] CAPTURED/REFUNDED semantics reconciled
[ ] no fabricated FX

[ ] same UUID has same canonical reference across existing business surfaces
[ ] Search consistent
[ ] CSV/XLSX runtime proven
[ ] tenant isolation proven
[ ] CRM-* unchanged
[ ] PRN-* unchanged

[ ] Finance Center NOT created as part of this task

[ ] tests truthfully reported
[ ] browser runtime complete
[ ] report predominantly Russian
[ ] real Implementation SHA
[ ] HEAD == origin/master
```

---

# 57. HARD VERDICT B CONDITIONS

`VERDICT B` обязателен, если остаётся хотя бы одно:

```text
Customer 360 Order → ORD-*
Customer 360 Booking → BKG-*
Customer 360 Payment → PAY-*
Order Detail related Booking → BKG-*
CRM Activity → ORD-* / BKG-* / PAY-*
Storefront commerce visible in Platform Customer 360
```

Также B, если:

```text
frontend-only scope filtering
prefix used as authorization
legacy Code remains competing user-facing identifier without proven purpose
TH-* ignored
RFD-* mechanically renamed without contract
root 107 temporal anomaly ignored
COMPLETED future-service anomaly ignored
historical dates randomly rewritten
FX fabricated
browser runtime absent
CSV/XLSX runtime absent
Finance Center created just to satisfy this prompt
```

---

# 58. ROADMAP

Additively update:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Зафиксировать, что предыдущий Reference Presentation closure был reopened runtime/export evidence.

Round 2 FINAL включает:

```text
Platform CRM Customer scope
Canonical References
Legacy Code Contract
TH Order Number Contract
Export Contract
CRM Activity
Temporal Integrity
Booking Lifecycle Integrity
Payment/Refund/Currency Integrity Audit
```

Не переписывать historical records/verdicts.

---

# 59. STOP CONDITION

После:

```text
audit
→ remediation
→ tests
→ browser runtime
→ CSV/XLSX runtime
→ report
→ commit
→ push
```

**STOP.**

Не запускать автоматически:

```text
Shared Commerce Sequence + Request Center Full Strict Review
Product Freshness
Finance Center
Step 3.12
```

Следующий этап определяется только после проверки результата этого Round 2.
