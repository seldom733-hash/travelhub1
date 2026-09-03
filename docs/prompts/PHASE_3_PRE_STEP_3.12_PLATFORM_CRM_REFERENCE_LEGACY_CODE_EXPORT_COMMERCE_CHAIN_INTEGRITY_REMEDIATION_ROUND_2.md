# PHASE 3 — PRE-STEP 3.12 — PLATFORM CRM SCOPE + CANONICAL REFERENCES + LEGACY CODE/EXPORT + COMMERCE CHAIN INTEGRITY — REMEDIATION ROUND 2

> **SUPERSEDES BOTH PREVIOUS ROUND 2 PROMPTS**
>
> НЕ запускать:
>
> - `PHASE_3_PRE_STEP_3.12_PROJECT_WIDE_COMMERCIAL_REFERENCE_PRESENTATION_CONSISTENCY_REMEDIATION_ROUND_2.md`
> - `PHASE_3_PRE_STEP_3.12_PLATFORM_CRM_CUSTOMER_SCOPE_REFERENCE_CONSISTENCY_REMEDIATION_ROUND_2.md`
>
> Этот документ полностью заменяет их и включает последние runtime/export findings.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**.

Обязательно на русском:

- Implementation / Remediation Report;
- Audit / Runtime Evidence;
- findings;
- root cause analysis;
- architecture decisions;
- security findings;
- data reconciliation;
- conclusions;
- recommendations;
- verdict explanations.

Английский разрешён только для технических identifiers: file paths, class/method/DTO/model/table names, API endpoints, HTTP methods/status codes, Git/CLI commands, commit messages, enums, permission identifiers, code snippets и standardized `VERDICT` strings.

Если итоговый отчёт преимущественно на английском языке — задача незавершена.

Не включать plaintext passwords, tokens, secrets или credentials.

---

# 1. PURPOSE

Закрыть одним evidence-first remediation четыре связанных класса дефектов:

```text
A. Platform CRM Customer business scope
B. Canonical commercial reference presentation
C. Legacy code leakage into business UI/API/export
D. Historical commercial-chain temporal/financial integrity
```

Не исправлять симптомы по одному экрану.

Сначала доказать фактическую data/read/export architecture, затем устранить root causes.

---

# 2. AUTHORITATIVE NEW EVIDENCE — ORDER CENTER EXPORT

В реальном export Orders Center обнаружена строка:

```text
Order ID:
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

Partner:
PRN-00000009
Gabala Mountain Lodge

Customer:
CRM-00000062
Maria Yamamoto

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

Эта строка является обязательным входным evidence для remediation.

---

# 3. IMPORTANT CORRECTION TO PREVIOUS DB CLAIM

Предыдущий report утверждал:

```text
legacy ORD-* = 0
legacy BKG-* = 0
legacy PAY-* = 0
```

Но export доказывает существование:

```text
Order.referenceNumber = MKT-ORD-000107
Order.code            = ORD-00000174
```

Следовательно, предыдущая формулировка была недостаточно точной.

Необходимо отдельно проверять:

```text
referenceNumber
```

и:

```text
code
```

Нельзя писать просто:

```text
legacy ORD-* = 0
```

без указания field.

---

# 4. FIELD-BY-FIELD DATABASE TRUTH — MANDATORY

Для каждой transaction entity проверить отдельно:

```text
Request
Order
Booking
Payment
Refund
```

и для каждого relevant field:

```text
id
code
referenceNumber
commerceSequence
legacy/reference aliases
```

Сформировать таблицу:

| Entity | Field | Pattern | Count | Purpose | Canonical? | User-facing allowed? |
|---|---|---:|---:|---|---|---|
| Order | code | ORD-* | ... | ... | NO/YES | ... |
| Order | referenceNumber | MKT-ORD-* | ... | ... | YES | YES |
| Booking | code | BKG-* / MKT-BKG-* | ... | ... | ... | ... |
| Booking | referenceNumber | MKT-BKG-* | ... | ... | YES | YES |
| Payment | code | PAY-* / ... | ... | ... | ... | ... |
| Payment | referenceNumber | MKT-PAY-*-n | ... | ... | YES | YES |

Exact query logic приложить к report.

---

# 5. LEGACY CODE CONTRACT AUDIT

Определить фактическое назначение:

```text
Order.code
Booking.code
Payment.code
Refund.code
Request.code if applicable
```

Для каждого field ответить:

1. когда он появился;
2. где генерируется;
3. есть ли DB uniqueness;
4. используется ли как FK/relationship;
5. используется ли integrations;
6. используется ли search;
7. используется ли API;
8. используется ли UI;
9. используется ли export;
10. можно ли его deprecate;
11. можно ли перестать exposing его пользователю;
12. можно ли безопасно удалить в будущем.

Не удалять field из DB вслепую.

---

# 6. CANONICAL BUSINESS IDENTIFIER CONTRACT

Для Marketplace transaction business presentation:

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

Canonical business reference:

```text
referenceNumber
```

если repository/schema audit подтверждает именно этот persisted contract.

Legacy `code` не должен конкурировать с canonical reference как второй пользовательский номер той же transaction entity.

---

# 7. UUID REMAINS TECHNICAL IDENTITY

Не заменять DB relationships строковыми references.

```text
UUID/FK
→ authoritative entity relationship

referenceNumber
→ human/business traceability
```

Legacy `code`, если сохраняется, не становится authorization key.

---

# 8. BUSINESS EXPORT CONTRACT — ORDERS

Текущий export содержит одновременно:

```text
Reference = MKT-ORD-000107
Code      = ORD-00000174
```

Это создаёт два конкурирующих user-facing identifiers.

Audit должен определить, имеет ли `Code` доказанную бизнес-функцию.

Если нет — убрать legacy `Code` из standard business export.

Целевой standard export:

```text
ID                  technical, если export contract его предусматривает
Reference           MKT-ORD-*
...
Booking References  MKT-BKG-*
Payment References  MKT-PAY-*-n
```

Legacy code может оставаться только в:

```text
explicit diagnostic/admin export
```

если реально нужен для migration/debug/backward compatibility.

Он не должен молча присутствовать в обычном business export.

---

# 9. BUSINESS EXPORT CONTRACT — BOOKINGS / PAYMENTS / REQUESTS

Проверить аналогично:

```text
Bookings export
Payments export
Requests export
CRM exports
Analytics exports
```

Исключить competing legacy business identifiers.

Не удалять useful technical UUID автоматически.

Разделять:

```text
technical ID
canonical business Reference
legacy compatibility Code
```

---

# 10. NO COSMETIC PREFIX FIX

Запрещено:

```ts
`MKT-${code}`
code.replace("ORD-", "MKT-ORD-")
code.replace("BKG-", "MKT-BKG-")
```

Canonical reference должен поступать из authoritative persisted/read contract.

---

# 11. LEGACY FALLBACK HARDENING

Для normalized Marketplace business views конструкции вида:

```ts
referenceNumber ?? code
```

не являются acceptable final solution, если `referenceNumber` по domain contract обязателен.

Missing canonical reference:

```text
= data/API/DTO defect
```

а не повод тихо вернуть legacy identifier.

Все допустимые compatibility exceptions перечислить отдельно.

---

# 12. KNOWN RUNTIME REFERENCE DEFECTS

До fix воспроизвести:

```text
Platform CRM
→ Клиенты
→ Customer 360
→ Заказы
→ ORD-* ❌

Platform CRM
→ Клиенты
→ Customer 360
→ Бронирования
→ BKG-* ❌

Orders Center
→ Order detail
→ Связанные бронирования
→ BKG-* ❌

Platform CRM
→ Активность
→ ORD-* / BKG-* / PAY-* ❌
```

После fix browser runtime должен показать canonical references.

---

# 13. CRM ACTIVITY — REFUND RFD-* AUDIT

Runtime также показывает:

```text
RFD-*
```

Не переименовывать автоматически в:

```text
MKT-RFD-*
```

Сначала определить существующий Refund Reference Contract:

```text
Refund entity/table
code
referenceNumber
relation to Payment
relation to Order
relation to Booking
generation logic
current search/export/UI contract
```

Если canonical Refund numbering ещё не утверждён — оформить отдельный architecture gap.

Не придумывать contract внутри cosmetic remediation.

---

# 14. PLATFORM CRM CUSTOMER SCOPE

Один master Customer может иметь:

```text
Marketplace activity
+
Storefront activity
```

Например:

```text
MKT-...
SF001-...
```

Это допустимо в общей БД.

Но Platform CRM не должен смешивать Storefront end-customer commerce с Marketplace commerce.

---

# 15. TARGET CUSTOMER CONTEXT MODEL

```text
MASTER CUSTOMER
        │
        ├── Marketplace activity
        │       ↓
        │   Platform CRM
        │
        └── Storefront activity
                ↓
            corresponding Partner/Storefront Workspace
```

Не создавать дубликат Customer только ради channel separation.

Не удалять Storefront data.

---

# 16. PLATFORM CRM CUSTOMER REGISTRY ELIGIBILITY

Audit фактического правила включения Customer в:

```text
Platform → CRM → Клиенты
```

Target semantics:

```text
Marketplace-only Customer
→ included

Mixed MKT + SF Customer
→ included because Marketplace relationship exists

Storefront-only end-customer
→ excluded from Platform Marketplace CRM
```

Не использовать prefix как primary scope/authorization source.

---

# 17. SERVER-SIDE SCOPE

Scope должен применяться server-side.

Запрещено:

```text
API returns MKT + SF
frontend hides SF
```

Иначе будут неверны:

```text
security
totals
pagination
export
KPI
activity
```

---

# 18. CUSTOMER 360 — FULL SCOPE

Проверить:

```text
Profile/summary
Orders
Bookings
Payments
Requests
Refunds
Activity/timeline
KPI
totals
last activity
financial aggregates
exports
links/drill-down
```

В Platform context customer commerce должен быть Marketplace-scoped.

---

# 19. MIXED CUSTOMER EVIDENCE

Найти реального Customer с:

```text
MKT transaction(s)
+
SF001/SFxxx transaction(s)
```

Показать DB truth:

```text
Customer UUID
MKT Orders
SF Orders
MKT Bookings
SF Bookings
MKT Payments
SF Payments
```

Затем browser/API evidence:

```text
Platform Customer 360
→ only Marketplace commerce

correct Partner/Storefront Workspace
→ its Storefront commerce remains available
```

---

# 20. STOREFRONT-ONLY CUSTOMER EVIDENCE

Найти Storefront-only end-customer.

Expected:

```text
Platform CRM Customers
→ absent
```

если у него нет Marketplace relationship.

Не удалять его из DB.

---

# 21. MARKETPLACE-ONLY CUSTOMER NON-REGRESSION

Marketplace-only Customer должен продолжить корректно работать:

```text
registry
360
Orders
Bookings
Payments
Activity
totals
```

---

# 22. CRM ACTIVITY BUSINESS SCOPE

Если Platform CRM Activity является Marketplace CRM activity:

```text
Storefront end-customer commerce
→ excluded server-side
```

Проверить:

```text
rows
totals
pagination
search
export if present
```

---

# 23. ORDER DETAIL RELATED BOOKINGS

Для конкретного Booking UUID проследить:

```text
DB Booking.referenceNumber
DB Booking.code
Order detail API nested object
DTO
frontend binding
rendered value
```

Expected:

```text
MKT-BKG-*
```

---

# 24. EXACT SAME-ENTITY TRACE

Для минимум:

```text
5 Orders
5 Bookings
5 Payments
```

сравнить один и тот же UUID:

```text
DB
primary API
CRM API
Center UI
Customer 360
CRM Activity
detail view
Search
CSV
XLSX
Analytics/drill-down
```

где applicable.

---

# 25. NEW FINDING — TEMPORAL CHAIN ANOMALY

В приведённом export:

```text
Order.createdAt:
2026-12-31T05:01:00.000Z

Payment.paidAt:
2026-07-04T04:16:00.000Z
```

То есть:

```text
Payment.paidAt < Order.createdAt
```

для связанной commercial chain.

Также:

```text
Order.updatedAt:
2026-08-23T13:25:12.005Z

Order.createdAt:
2026-12-31T05:01:00.000Z
```

то есть:

```text
updatedAt < createdAt
```

Это отдельный сильный data-integrity anomaly.

Не исправлять одну строку вручную.

---

# 26. COMMERCIAL CHAIN TEMPORAL INTEGRITY AUDIT

Repository-wide проверить Marketplace historical chains.

Минимум invariants, где соответствующие timestamps существуют:

```text
Request.createdAt
<= supplierRespondedAt
<= customerAcceptedAt/customerActionAt
<= Order.createdAt
<= Booking.createdAt
```

Payment:

```text
Order.createdAt <= Payment.createdAt
```

и для successful captured payment:

```text
Order.createdAt <= Payment.paidAt
```

Также generic entity invariant:

```text
createdAt <= updatedAt
```

если timestamps имеют стандартную семантику.

Если Booking может быть created before Order в реальной модели — это должно быть доказано domain contract; не предполагать.

---

# 27. TEMPORAL AUDIT COUNTS

Посчитать минимум:

```text
Orders with updatedAt < createdAt

Payments with createdAt < related Order.createdAt
Payments with paidAt < related Order.createdAt

Bookings with createdAt < related Order.createdAt

Converted Requests with Request.createdAt > Order.createdAt
```

И другие нарушения текущего Request SLA/TTL contract, если applicable.

Показать:

```text
count
percentage
sample IDs
source/generation origin
```

---

# 28. DETERMINE ROOT CAUSE OF TEMPORAL ANOMALIES

Не менять dates до root cause.

Проверить:

```text
seed scripts
historical backfill
migration
factory
test fixtures
manual data generation
timezone conversion
field mapping
export serialization
```

Особенно определить, почему:

```text
Order.createdAt = future relative to updatedAt/payment
```

---

# 29. NO DATE FABRICATION

Если historical synthetic/representative data требует remediation:

- не использовать random dates без chain constraints;
- не сдвигать production-like records вслепую;
- сохранить относительную бизнес-хронологию;
- не ломать period analytics;
- не ломать Request SLA/TTL evidence;
- не менять IDs/reference roots.

Исправление должно быть deterministic и documented.

---

# 30. NEW FINDING — FINANCIAL CHAIN ANOMALY

В той же строке:

```text
Order Amount:
136.8 AZN

Payment Amount:
939.16 USD
```

Это не автоматически доказанный bug, потому что возможны:

```text
different amount semantics
multi-currency
partial/additional payment
historical synthetic data
```

Но для связанной Order/Payment chain это требует обязательного audit.

---

# 31. ORDER AMOUNT SEMANTICS

Определить, что означает:

```text
Order.amount
```

Например:

```text
order total?
base amount?
deposit?
net?
converted amount?
```

Не предполагать.

Показать source of truth и formula.

---

# 32. PAYMENT AMOUNT SEMANTICS

Определить:

```text
Payment.amount
Payment.currency
Payment status
logical payment ordinal
refund relationship
```

Проверить, должен ли captured payment reconcile с Order amount/currency.

---

# 33. MULTI-CURRENCY RULE

Не сравнивать:

```text
136.8 AZN
vs
939.16 USD
```

как числовое равенство без FX contract.

Сначала определить:

- разрешена ли payment currency, отличная от Order currency;
- где хранится FX rate;
- где хранится settlement/base amount;
- существует ли authoritative conversion;
- является ли ExchangeRate data доступной.

Если FX contract отсутствует — зафиксировать architecture/data gap.

Не fabricate conversion.

---

# 34. PAYMENT STATUS CONTRADICTION AUDIT

Export row содержит:

```text
Order Payment Status = REFUNDED
```

и nested:

```text
Payment Status = CAPTURED
```

Это может быть корректно, если:

```text
payment captured
→ later refunded
```

Но audit должен доказать semantics.

Проверить:

```text
Order.paymentStatus
Payment.status
Refund records
refund amount
refund timestamps
```

Не считать это автоматически bug.

---

# 35. FINANCIAL RECONCILIATION MATRIX

Для sample commercial chains создать:

| Root | Order Amount/Currency | Payments | Refunds | Status | Reconciled? | Explanation |
|---|---|---|---|---|---|---|

Минимум:

- sample с normal captured payment;
- sample с refund;
- sample с multiple payments;
- обнаруженный root `00000107`.

---

# 36. ROOT 00000107 — MANDATORY FORENSIC TRACE

Для конкретного evidence root:

```text
commerceSequence = 107
```

сделать полный forensic trace:

```text
Request if exists
Order
Booking
Payment(s)
Refund(s)
```

Показать:

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
paidAt
refund timestamps
relationships
```

Объяснить каждое выявленное расхождение.

---

# 37. DO NOT CONFLATE REFERENCE FIX WITH DATA REWRITE

Если legacy `code` существует, это не означает автоматически, что его нужно удалить из DB.

Если historical dates/amounts некорректны, это не означает автоматически, что numbering migration ошибочна.

Разделить root causes:

```text
identity/reference
presentation
business scope
historical chronology
financial semantics
```

---

# 38. SEARCH CONTRACT

Search по canonical:

```text
MKT-REQ-*
MKT-ORD-*
MKT-BKG-*
MKT-PAY-*-n
```

Legacy code search может оставаться compatibility-only, если доказана необходимость.

Но search result должен отображать canonical reference.

---

# 39. EXPORT ROW COUNT / FILTER INVARIANT

Для applicable registries:

```text
filtered total
=
CSV data rows
=
XLSX data rows
```

Scope применяется до export.

Platform exports не должны включать Storefront end-customer commerce.

---

# 40. ANALYTICS / DRILL-DOWN

Проверить:

```text
Successful Payments
Partner Performance
Customer drill-down
Order/Booking drill-down
```

Canonical references и Platform Marketplace scope должны совпадать с operational centers.

---

# 41. SECURITY / TENANT ISOLATION

Hard rules:

```text
Platform CRM
→ no Storefront end-customer commerce leakage

Storefront A
→ A only

Storefront B
→ B only
```

Prefix не является authorization source.

Scope server-side.

---

# 42. AUTOMATED TESTS — REFERENCE

Добавить regression tests:

```text
Customer 360 Order → referenceNumber
Customer 360 Booking → referenceNumber
Order detail related Booking → referenceNumber
CRM Activity Order → referenceNumber
CRM Activity Booking → referenceNumber
CRM Activity Payment → referenceNumber
business export does not expose legacy Code unless explicitly diagnostic
```

---

# 43. AUTOMATED TESTS — SCOPE

Добавить:

```text
Storefront-only customer excluded from Platform CRM
Mixed customer retained due Marketplace activity
Mixed Customer 360 excludes SF Orders
excludes SF Bookings
excludes SF Payments
excludes SF Activity
totals exclude SF commerce
pagination is scoped
export is scoped
```

---

# 44. AUTOMATED TESTS — TEMPORAL INTEGRITY

Добавить deterministic tests для historical data generator/backfill:

```text
createdAt <= updatedAt
Order.createdAt <= Booking.createdAt
Order.createdAt <= Payment.createdAt
Order.createdAt <= paidAt when paidAt exists
Request chronology valid
```

где domain contract применим.

---

# 45. AUTOMATED TESTS — FINANCIAL INTEGRITY

Добавить tests согласно фактически доказанной payment model:

```text
payment/order currency semantics
refund semantics
multiple logical payments
financial reconciliation
```

Не писать тест под выдуманную формулу.

---

# 46. TEST REPORTING — TRUTHFUL

Если frontend:

```text
282/283
```

и 1 failed:

```text
FAIL — 282 passed / 283 total
```

`pre-existing` не превращает suite в PASS.

Для backend:

```text
passed + failed + skipped = total
```

обязательно.

---

# 47. BROWSER RUNTIME — MANDATORY

Проверить:

```text
Platform CRM Customers registry
mixed Customer 360
Customer 360 Orders
Customer 360 Bookings
Customer 360 Payments
Customer 360 Activity
Platform CRM Activity
Orders Center
Order detail → Related Bookings
Booking Center
Payments
Analytics/drill-down
```

---

# 48. EXPORT RUNTIME — MANDATORY

Реально скачать CSV/XLSX после fix.

Проверить:

```text
Orders
Bookings
Payments
```

и другие applicable exports.

Для Orders убедиться, что обычный business export больше не создаёт ambiguous pair:

```text
Reference = MKT-ORD-*
Code = ORD-*
```

если `Code` не имеет доказанной business necessity.

---

# 49. BEFORE / AFTER KNOWN FINDINGS

Обязательная таблица:

| Finding | Before | After | Result |
|---|---|---|---|
| Customer 360 Orders | ORD-* | MKT-ORD-* | ... |
| Customer 360 Bookings | BKG-* | MKT-BKG-* | ... |
| Order Detail Related Bookings | BKG-* | MKT-BKG-* | ... |
| CRM Activity Orders | ORD-* | MKT-ORD-* | ... |
| CRM Activity Bookings | BKG-* | MKT-BKG-* | ... |
| CRM Activity Payments | PAY-* | MKT-PAY-*-n | ... |
| CRM Activity Refund | RFD-* | audited contract | ... |
| Mixed Customer 360 | MKT + SF mixed | Marketplace-only | ... |
| Orders business export | Reference + legacy Code | canonical contract | ... |
| Root 107 chronology | invalid/suspicious | explained/fixed | ... |
| Root 107 financial chain | suspicious | explained/fixed/gap | ... |

---

# 50. REQUIRED REPORT

Создать:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_PLATFORM_CRM_REFERENCE_LEGACY_CODE_EXPORT_COMMERCE_CHAIN_INTEGRITY_REMEDIATION_ROUND_2_REPORT.md
```

Обязательные разделы:

1. Starting SHA
2. Git state
3. Previous verdict invalidation
4. Reproduced runtime findings
5. Field-by-field DB truth
6. Legacy Code Contract Audit
7. Canonical Reference Contract
8. Business Export Contract
9. Platform CRM customer eligibility
10. Mixed Customer evidence
11. Storefront-only Customer evidence
12. Marketplace-only Customer evidence
13. Customer 360 full scope audit
14. CRM Activity audit
15. Refund RFD contract finding
16. Order Detail related Booking trace
17. Repository-wide second-pass inventory
18. Same-entity reference matrix
19. Root 00000107 forensic trace
20. Temporal integrity audit
21. Temporal anomaly counts
22. Temporal root cause
23. Financial semantics audit
24. Currency/FX findings
25. Refund/payment-status reconciliation
26. Financial reconciliation matrix
27. Search
28. CSV/XLSX runtime evidence
29. Analytics/drill-down
30. Security/tenant isolation
31. Automated tests
32. Browser runtime
33. RU/AZ/EN
34. Before/After table
35. Remaining gaps
36. Implementation SHA
37. Final HEAD
38. origin/master
39. `HEAD == origin/master`
40. Verdict

---

# 51. ACCEPTANCE CRITERIA

`VERDICT A` только если:

```text
[ ] field-specific DB counts proven
[ ] legacy code purpose audited
[ ] canonical business identifier contract proven
[ ] ordinary business exports no longer expose unjustified competing legacy identifiers

[ ] Customer 360 Orders → MKT-ORD-*
[ ] Customer 360 Bookings → MKT-BKG-*
[ ] Order Detail Related Bookings → MKT-BKG-*
[ ] CRM Activity Orders → MKT-ORD-*
[ ] CRM Activity Bookings → MKT-BKG-*
[ ] CRM Activity Payments → MKT-PAY-*-n
[ ] Refund RFD semantics audited

[ ] Storefront-only customers excluded from Platform Marketplace CRM
[ ] mixed customer retains Marketplace eligibility
[ ] mixed Customer 360 excludes Storefront commerce
[ ] Platform CRM Activity excludes Storefront customer commerce
[ ] totals/pagination/export use server-side scope

[ ] root 00000107 fully traced
[ ] updatedAt < createdAt anomaly explained and remediated if invalid
[ ] Payment.paidAt < Order.createdAt anomaly explained and remediated if invalid
[ ] repository-wide temporal anomaly counts produced
[ ] historical generator/backfill hardened if root cause is historical data generation

[ ] Order/Payment amount semantics proven
[ ] multi-currency semantics proven or explicit architecture gap recorded
[ ] REFUNDED vs CAPTURED semantics reconciled
[ ] no fabricated FX conversion

[ ] same UUID = same canonical reference across applicable surfaces
[ ] Search/CSV/XLSX consistent
[ ] CRM-* unchanged
[ ] PRN-* unchanged
[ ] Storefront data preserved
[ ] tenant isolation preserved
[ ] tests truthfully reported
[ ] browser runtime evidence complete
[ ] report predominantly Russian
[ ] real Implementation SHA
[ ] HEAD == origin/master
```

---

# 52. HARD VERDICT B CONDITIONS

`VERDICT B` если остаётся хотя бы одно:

```text
Customer 360 → ORD-*
Customer 360 → BKG-*
Order detail → BKG-*
CRM Activity → ORD-* / BKG-* / PAY-*
Storefront commerce visible in Platform Customer 360
frontend-only SF filtering
legacy Code exposed as competing business identifier without justified contract
```

Также `VERDICT B`, если:

```text
known temporal anomaly ignored
root 107 not traced
dates rewritten without root cause
amount/currency mismatch silently declared correct
FX fabricated
browser/export runtime evidence absent
```

Refund `RFD-*` не переименовывать без contract; отсутствие самого audit по Refund — `VERDICT B`.

---

# 53. ROADMAP

Additively обновить:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Зафиксировать:

```text
previous Reference Presentation verdict reopened by runtime/export evidence

Round 2 now covers:
- Platform CRM Customer scope
- canonical references
- legacy Code contract
- business export contract
- CRM Activity
- historical temporal integrity
- financial-chain integrity audit
```

Историю не переписывать.

---

# 54. STOP CONDITION

После:

```text
audit
→ remediation
→ tests
→ browser runtime
→ CSV/XLSX runtime
→ report
→ commit/push
```

остановиться.

Не запускать автоматически:

```text
Shared Commerce Sequence + Request Center Full Strict Review
Product Freshness
Step 3.12
```

Следующий этап только после подтверждённого `VERDICT A`:

```text
PHASE 3 — PRE-STEP 3.12
SHARED COMMERCE SEQUENCE + REQUEST CENTER
FULL STRICT REVIEW
```
