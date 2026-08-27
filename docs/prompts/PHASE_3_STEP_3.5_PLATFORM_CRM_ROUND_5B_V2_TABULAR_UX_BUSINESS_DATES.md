# PHASE 3 — STEP 3.5 — PLATFORM CRM
## ROUND 5B V2 — CUSTOMER 360 + PARTNER 360 TABULAR UX CONSISTENCY + BUSINESS DATE AUTHORITY
## ENTITY COLLECTION TABLES / REFERENCE NAVIGATION / STATE PARITY / VISUAL CLOSURE

---

# 1. STATUS

Round 5 and Round 5A established the functional/data contracts:

```text
Customer ↔ Partner commercial relationship
Payment → business context
Refund → source Payment / Order / reason
Order Detail
Booking Detail
Product/Service Detail
exact entity deep links
runtime parity
```

Current accepted runtime authority:

```text
HEAD / origin/master: d1d199f
Frontend: localhost:3000
Backend API: localhost:4000
```

However manual browser review shows that Platform CRM 360 pages are not yet visually consistent.

Example:

```text
Customer 360 → Платежи
```

currently renders Payment as a large record/card:

```text
PAY-00000959
50.88 AZN
Оплата за заказ ORD-00000959 (TH-2026-000959)
CAPTURED
```

The data is useful and correct, but the representation is inconsistent with the other entity collections.

Therefore Platform CRM is NOT yet visually final-closed.

Current stage:

```text
ROUND 5B — TABULAR UX CONSISTENCY / VISUAL CLOSURE
```

This is primarily a frontend UX consistency round.

Do NOT redesign CRM architecture or replace canonical backend semantics.

---

# 2. OBJECTIVE

Bring all collection-oriented tabs in:

```text
Customer 360
Partner 360
```

to a consistent Enterprise SaaS information architecture.

Hard UX principle:

```text
Overview / single-object summary
→ cards / KPI / structured summary

Collection of business entities
→ table

Chronological audit/activity
→ timeline or table, according to actual semantics

Single Storefront object
→ structured summary/detail
```

---

# 3. TARGET CUSTOMER 360

Final conceptual structure:

```text
Customer 360
├── Обзор              → summary / KPI
├── Заказы             → TABLE
├── Бронирования       → TABLE
├── Платежи            → TABLE
├── Партнёры           → TABLE
├── Возвраты           → TABLE
└── История            → TIMELINE or TABLE
```

Do not render Orders, Bookings, Payments, Partners or Refunds as unrelated full-width record cards when they represent a collection.

---

# 4. TARGET PARTNER 360

Final conceptual structure:

```text
Partner 360
├── Обзор              → summary / KPI
├── Услуги             → TABLE
├── Заказы             → TABLE
├── Бронирования       → TABLE
├── Клиенты            → TABLE
└── Витрина            → structured Storefront summary/detail
```

---

# 5. AUDIT BEFORE IMPLEMENTATION

Before changing UI, inspect every Customer 360 and Partner 360 tab.

Produce matrix:

| 360 | Tab | Current renderer | Rows/entities | Canonical fields available | Target renderer |
|---|---|---|---:|---|---|
| Customer | Orders | | | | TABLE |
| Customer | Bookings | | | | TABLE |
| Customer | Payments | | | | TABLE |
| Customer | Partners | | | | TABLE |
| Customer | Refunds | | | | TABLE |
| Customer | History | | | | TIMELINE/TABLE |
| Partner | Services | | | | TABLE |
| Partner | Orders | | | | TABLE |
| Partner | Bookings | | | | TABLE |
| Partner | Customers | | | | TABLE |
| Partner | Storefront | | 1 | | SUMMARY |

Do not assume current implementation based on old reports.

Inspect actual runtime/source.

---

# 6. REUSE EXISTING DESIGN SYSTEM

Do NOT create a second table design.

Reuse the visual patterns already present in Platform CRM list pages and other mature Platform tables:

```text
header
row density
border
hover state
typography
status badges
pagination
loading state
empty state
error state
links
horizontal overflow behavior
```

The 360 tables should visually belong to the same product.

---

# 7. CUSTOMER 360 → ORDERS

Render as table.

Evaluate canonical fields and prefer a useful compact contract such as:

| Заказ | Дата создания | Партнёр | Состав / контекст | Сумма | Статус |
|---|---|---|---|---:|---|

Only use fields supported by canonical Order data.

Required:

```text
Order code/reference → exact /app/orders/:id
Partner → exact Partner 360 where canonical partner exists
```

If an Order contains multiple products/services:

```text
do not pretend it contains one service
```

Use honest summary semantics.

---

# 8. CUSTOMER 360 → BOOKINGS

Render as table.

Preferred conceptual contract:

| Бронирование | Дата создания | Услуга | Партнёр | Дата / период услуги | Сумма* | Статус |
|---|---|---|---|---|---:|---|

Only include amount if Booking has an authoritative monetary semantic.

Required:

```text
Booking → exact /app/bookings/:id
Service/Product → exact /app/catalog/:id when canonical
Partner → exact Partner 360 when canonical
```

---

# 9. CUSTOMER 360 → PAYMENTS

Replace current full-width Payment cards with a table.

Minimum target:

| Платёж | Дата оплаты | Что оплачено | Сумма | Способ оплаты | Статус |
|---|---|---|---:|---|---|

Use actual available canonical fields.

For current runtime example:

```text
PAY-00000959
50.88 AZN
CAPTURED
Order ORD-00000959 / TH-2026-000959
```

must remain visible after conversion.

---

# 10. PAYMENT BUSINESS CONTEXT

`Что оплачено` must preserve the Round 5 business context.

For an Order-linked Payment:

```text
Заказ ORD-00000959
TH-2026-000959
```

Order reference must navigate to:

```text
/app/orders/<exact-order-id>
```

If canonical Booking/Service context is uniquely attributable, it may be shown.

Do NOT arbitrarily choose one Booking/Service from a multi-entity Order.

---

# 11. PAYMENT REFERENCE NAVIGATION

Current project does NOT yet have a dedicated Payment Detail route according to the accepted Round 5 scope.

Therefore:

```text
PAY-00000959
```

must NOT be presented as a fake clickable deep link to a nonexistent detail page.

It may be styled as an entity reference/code without navigation.

Order/Booking/Service references inside the row may be clickable where exact detail routes exist.

---

# 12. PAYMENT DATE

Use the canonical Payment business timestamp.

Audit available fields.

Possible candidates may include:

```text
createdAt
capturedAt
paidAt
completedAt
```

Choose according to actual Payment semantics.

Do not label `createdAt` as `Дата оплаты` unless it actually means payment time.

If only creation timestamp is authoritative:

```text
Дата создания
```

is safer.

Document chosen predicate.

---


# 12A. BUSINESS DATE AUTHORITY — MANDATORY

This Round must distinguish:

```text
technical creation timestamps
≠
business event dates
```

The visible table date must answer the actual business question for the entity.

Required contract:

| Entity | Mandatory visible business date |
|---|---|
| Order | Order creation date |
| Booking | Booking creation date |
| Payment | Payment business date |
| Refund | Refund business date |
| Service/Product | Service/Product creation date |

Additional operational dates may be shown only when useful and semantically distinct.

---

# 12B. ORDER DATE

For Order tables:

```text
Дата создания
```

must come from the canonical Order creation timestamp.

Do not relabel:

```text
updatedAt
closedAt
paidAt
```

as Order creation.

---

# 12C. BOOKING DATES

Booking tables must distinguish:

```text
Дата создания бронирования
```

from:

```text
Дата / период услуги
```

Both may be useful.

Do not replace Booking creation date with service date.

Preferred conceptual layout:

```text
Бронирование | Создано | Дата услуги | Услуга | ... | Статус
```

where current data model supports service date.

---

# 12D. PAYMENT BUSINESS DATE — REQUIRED

For Payment tables, the important visible date is NOT merely `createdAt`.

The table must show the date when the payment business event actually occurred.

Determine the canonical field/status transition, for example only if actual model supports:

```text
paidAt
capturedAt
completedAt
processedAt
```

Required label should reflect the actual semantics, e.g.:

```text
Дата оплаты
```

when the timestamp means successful payment.

Hard rule:

```text
createdAt MUST NOT be presented as "Дата оплаты"
unless createdAt is explicitly the canonical payment event time
in the current architecture.
```

---

# 12E. PAYMENT WITHOUT COMPLETED BUSINESS DATE

If a Payment exists but is not yet actually paid/captured/completed:

```text
Дата оплаты = —
```

unless the canonical model defines another explicit business date for the current status.

Do not show request/record creation time as successful payment date.

The status itself must communicate the actual state.

---

# 12F. REFUND BUSINESS DATE — REQUIRED

For Refund tables, the important visible date is the date when the refund business event actually occurred.

Determine the canonical field/status transition, for example only if the actual model supports:

```text
refundedAt
approvedAt
completedAt
processedAt
```

Use the field whose semantics correspond to the actual refund event being shown.

If the final business event is completed refund:

```text
Дата возврата
```

must represent the actual completed/refunded timestamp.

---

# 12G. REFUND REQUEST DATE ≠ REFUND DATE

Distinguish:

```text
Дата создания запроса на возврат
```

from:

```text
Дата возврата
```

These are not interchangeable.

If Refund status is only:

```text
REQUESTED
PENDING
```

and no actual refund has occurred:

```text
Дата возврата = —
```

If useful, a separate:

```text
Дата запроса
```

may be shown.

Do not call the request creation timestamp the refund date.

---

# 12H. REFUND APPROVED vs COMPLETED

If the Refund lifecycle distinguishes:

```text
APPROVED
COMPLETED / REFUNDED
```

determine which date is the actual monetary return.

Do not label approval date as refund-completion date unless architecture defines approval as the actual financial event.

Report exact status/date semantics.

---

# 12I. SERVICE / PRODUCT CREATION DATE

For Service/Product tables:

```text
Дата создания
```

must use canonical creation timestamp.

`updatedAt` may optionally be shown as a separate:

```text
Обновлено
```

only if useful.

---

# 12J. DATE FORMAT / TIMEZONE

Use the project's canonical timezone/date formatting.

Do not show raw ISO timestamps.

Required consistency across CRM:

```text
Order
Booking
Payment
Refund
Service/Product
```

The same locale/timezone contract must be applied in RU/AZ/EN.

---

# 12K. REQUIRED BUSINESS DATE MATRIX

Provide:

| Entity | UI label | Canonical source field | Business meaning | Null behavior | PASS |
|---|---|---|---|---|---|
| Order | | | | | |
| Booking creation | | | | | |
| Booking service date | | | | | |
| Payment | | | | | |
| Refund request if shown | | | | | |
| Refund business date | | | | | |
| Service/Product | | | | | |

No unresolved `createdAt maybe` wording is accepted for Payment/Refund.

# 13. PAYMENT METHOD

Show `Способ оплаты` only from canonical payment method data.

Examples may include:

```text
CARD
BANK_TRANSFER
APPLE_PAY
...
```

Do not infer method from provider or transaction metadata unless architecture defines that mapping.

If unavailable:

```text
—
```

---

# 14. CUSTOMER 360 → PARTNERS

Keep the Round 5 commercial relationship contract.

Render as table.

Preferred contract:

| Партнёр | Заказы | Бронирования | Коммерческий объём* | Последняя активность | CRM |
|---|---:|---:|---:|---|---|

Current runtime evidence must remain represented:

```text
Marie Park
→ Baku Tours Pro
→ 2 Orders
→ 1 Booking
→ 206.92 AZN
```

`Baku Tours Pro` → exact Partner 360.

---

# 15. PARTNER COMMERCIAL VALUE

Do not blindly label:

```text
206.92 AZN
```

as `Сумма`.

Reuse the semantic definition established in Round 5.

If Round 5 did not actually prove the semantic definition:

```text
audit it now
```

and use an explicit label such as:

```text
Сумма заказов
Оплачено
Коммерческий объём
```

only when supported.

---

# 16. CUSTOMER 360 → REFUNDS

Replace collection-style Refund cards with a table.

Preferred conceptual contract:

| Возврат | Дата возврата | Что возвращено | Исходный платёж | Сумма | Причина | Статус |
|---|---|---|---|---:|---|---|

Preserve Round 5 runtime context:

```text
RFD-F8DB5871781F
→ Order ORD-00000959
→ Payment PAY-00000959
→ canonical refund reason
```

---

# 17. REFUND NAVIGATION

Required:

```text
Order reference
→ exact /app/orders/:id
```

If canonical Booking/Service context exists and is displayed:

```text
Booking → exact Booking Detail
Service → exact Product/Service Detail
```

Payment reference:

```text
PAY-...
```

must remain non-clickable until a real Payment Detail route exists.

No fake route.

---

# 18. REFUND REASON

Use only canonical Refund reason.

If long:

```text
truncate visually if needed
```

but preserve access to the full value using an accessible title/tooltip/detail affordance already supported by the design system.

Do not silently lose the reason.

---

# 19. CUSTOMER 360 → HISTORY

Audit what `CustomerHistory` actually represents.

If it is chronological event history, prefer:

```text
timeline
```

or a compact chronological table:

| Дата/время | Событие | Объект | Изменение / описание | Actor |
|---|---|---|---|---|

Do not force History into a transactional table if timeline semantics are more appropriate.

Required decision:

```text
TIMELINE
or
TABLE
```

with justification in report.

---

# 20. PARTNER 360 → SERVICES

Render as table using canonical Product/Service fields.

Preferred conceptual contract:

| Услуга | Тип | Статус | Цена / от | Дата создания | Обновлено* |
|---|---|---|---:|---|

Only include meaningful fields.

Required:

```text
Service/Product reference/name
→ exact /app/catalog/:id
```

---

# 21. PARTNER 360 → ORDERS

Render as table.

Preferred conceptual contract:

| Заказ | Дата | Клиент | Состав / контекст | Сумма | Статус |
|---|---|---|---|---:|---|

Required:

```text
Order → exact Order Detail
Customer → exact Customer 360 when canonical
```

---

# 22. PARTNER 360 → BOOKINGS

Render as table.

Preferred conceptual contract:

| Бронирование | Дата | Клиент | Услуга | Сумма* | Статус |
|---|---|---|---|---:|---|

Required:

```text
Booking → exact Booking Detail
Customer → exact Customer 360
Service/Product → exact Product/Service Detail
```

Only show amount if semantically authoritative.

---

# 23. PARTNER 360 → CUSTOMERS

Keep Round 5 commercial customer authority.

Render as table.

Preferred contract:

| Клиент | Заказы | Бронирования | Коммерческий объём* | Последняя активность | CRM |
|---|---:|---:|---:|---|---|

Current runtime:

```text
Baku Tours Pro
→ 18 distinct commercial customers
→ Marie Park included
```

must remain valid.

Customer → exact Customer 360.

---

# 24. PARTNER 360 → STOREFRONT

Do NOT force Storefront into a table if there is one Storefront object.

Use structured summary/detail.

Example information architecture, only where canonical fields exist:

```text
Storefront
├── status
├── entitlement status
├── name/domain/slug
├── public URL
├── created/updated
└── relevant configuration summary
```

If not configured:

```text
Витрина не настроена
```

is an honest empty state.

---

# 25. TABLE COLUMN DISCIPLINE

Do not maximize column count.

Desktop target:

```text
approximately 5–7 useful columns
```

unless a particular entity genuinely requires more.

Priority:

```text
identity
business context
money/date
status
navigation
```

Avoid low-value internal telemetry.

---

# 26. ENTITY CODE + BUSINESS NUMBER

Where both exist, preserve distinction.

Example:

```text
ORD-00000959
TH-2026-000959
```

Do not collapse them into one ambiguous identifier.

A compact representation is allowed:

```text
ORD-00000959
TH-2026-000959
```

within the same cell.

---

# 27. CLICKABLE REFERENCE CONTRACT

Clickable:

```text
Order → Order Detail
Booking → Booking Detail
Service/Product → Product Detail
Customer → Customer 360
Partner → Partner 360
```

Not clickable until real route exists:

```text
Payment
Refund
```

unless an existing exact detail route is discovered during audit.

Do NOT create Payment/Refund detail routes in this round.

---

# 28. NATIVE LINK SEMANTICS

Entity navigation must use native link behavior.

Required where applicable:

```text
Ctrl/Cmd click
middle click
Open in new tab
browser Back
browser Forward
refresh
```

Do not implement entity navigation using only `onClick` divs.

---

# 29. ROW CLICK POLICY

Do not make the entire row ambiguously clickable when it contains several different entity references.

Preferred:

```text
specific entity references are clickable
```

Example Payment row:

```text
PAY-00000959      non-clickable
ORD-00000959      clickable → Order Detail
```

---

# 30. STATUS BADGES

Reuse canonical status badge visual patterns.

Do not introduce per-tab status styling.

Examples:

```text
CAPTURED
APPROVED
ACTIVE
CONFIRMED
COMPLETED
```

must use the existing shared/consistent status treatment where possible.

Do not change backend status semantics.

---

# 31. MONEY FORMATTING

Use one shared formatting contract.

Required:

```text
50.88 AZN
206.92 AZN
```

or the established locale-aware project format.

Do not mix:

```text
AZN 50.88
50,88 AZN
50.88 AZN
```

arbitrarily within the same locale.

---

# 32. DATE/TIME FORMATTING

Use one shared locale-aware contract.

Do not display raw ISO timestamps in normal UI unless the product already intentionally does so.

---

# 33. PAGINATION

Collection tabs must remain bounded.

Hard rule:

```text
default page size <= 20
```

If a collection can exceed 20:

```text
pagination or equivalent bounded navigation is required
```

Do not fetch/render unbounded Partner Orders, Customer Payments, etc.

---

# 34. COUNT PARITY

Where Overview displays counts:

```text
Orders
Bookings
Payments
Refunds
Partners
Customers
Services
```

the count must reconcile with the corresponding tab's canonical total.

Do not count only the currently displayed page.

Required parity examples:

```text
Customer Overview Payments = Payments tab total
Customer Overview Refunds = Refunds tab total
Partner Overview Customers = Customers tab total
Partner Overview Services = Services tab total
```

where those KPI/counts exist.

---

# 35. LOADING STATE

Every async collection tab needs an intentional loading state.

Do not temporarily show:

```text
0
Нет данных
```

while request is pending.

---

# 36. ERROR ≠ EMPTY

Hard invariant:

```text
API error
!=
empty collection
```

On error:

```text
show error state
hide false zero/empty claims
```

On successful zero result:

```text
show honest empty state
```

---

# 37. EMPTY STATES

Examples:

```text
Платежей пока нет
Возвратов пока нет
Партнёров пока нет
Клиентов пока нет
```

only after successful zero-result response.

Do not display empty table chrome with misleading data.

---

# 38. RESPONSIVE / OVERFLOW

The Platform UI is desktop-oriented, but tables must not destroy layout at narrower widths.

Use the project's established horizontal overflow behavior.

Do not compress identifiers/statuses into unreadable columns.

---

# 39. TABLE HEADER STABILITY

Headers should remain semantically stable.

Avoid dynamically changing the meaning of a column row-by-row.

For heterogeneous context, use a general header such as:

```text
Что оплачено
```

rather than:

```text
Заказ
```

if some Payments may canonically pay another object type.

---

# 40. NO INVENTED DATA

Never populate a visually desirable column by guessing.

Allowed:

```text
—
```

or omit the column if canonical data is absent.

Forbidden:

```text
derive payment method from unrelated provider field
derive service from first Order item
derive Partner from arbitrary relation
invent "last activity"
```

---

# 41. BACKEND CHANGE POLICY

Prefer existing Round 5 APIs.

Backend changes are allowed only when a required table field or bounded pagination cannot be obtained correctly from existing canonical APIs.

If backend changes:

```text
document why
preserve authority/scoping
add tests
```

Do not create duplicate APIs for presentation convenience.

---

# 42. CUSTOMER/PARTNER SECURITY AUTHORITY

This round must not weaken:

```text
crm.customer.*
crm.partner.*
workspace/role authority
```

Platform CRM remains Platform-scoped.

No Partner workspace scope changes in Round 5B.

---

# 43. I18N

All new headers, empty states, errors, tooltips and labels:

```text
RU
AZ
EN
```

Required.

Hard gate:

```text
raw i18n keys = 0
```

Specifically recheck:

```text
crm.detail.partners
```

to ensure Round 5A does not regress.

---

# 44. CURRENT RUNTIME REPRESENTATIVE RECORDS

Use existing runtime examples where still present:

```text
Customer:
Marie Park
CRM-00000067

Payment:
PAY-00000959
50.88 AZN
CAPTURED

Order:
ORD-00000959
TH-2026-000959

Partner:
Baku Tours Pro

Customer ↔ Partner:
2 Orders
1 Booking
206.92 AZN

Refund:
RFD-F8DB5871781F
```

If seed/runtime data changed, resolve current equivalents rather than hardcoding old records.

---

# 45. REQUIRED CUSTOMER 360 BROWSER MATRIX

| Tab | Renderer | Real rows | Links | Pagination/bounded | Loading | Error | Empty | PASS |
|---|---|---:|---|---|---|---|---|---|
| Overview | summary | | n/a | n/a | | | | |
| Orders | TABLE | | | | | | | |
| Bookings | TABLE | | | | | | | |
| Payments | TABLE | | | | | | | |
| Partners | TABLE | | | | | | | |
| Refunds | TABLE | | | | | | | |
| History | TIMELINE/TABLE | | | | | | | |

---

# 46. REQUIRED PARTNER 360 BROWSER MATRIX

| Tab | Renderer | Real rows | Links | Pagination/bounded | Loading | Error | Empty | PASS |
|---|---|---:|---|---|---|---|---|---|
| Overview | summary | | n/a | n/a | | | | |
| Services | TABLE | | | | | | | |
| Orders | TABLE | | | | | | | |
| Bookings | TABLE | | | | | | | |
| Customers | TABLE | | | | | | | |
| Storefront | summary/detail | 1/0 | | n/a | | | | |

---

# 47. PAYMENT TABLE RUNTIME PROOF

For Marie Park, prove the table visibly contains:

```text
PAY-00000959
50.88 AZN
CAPTURED
ORD-00000959
TH-2026-000959
```

and:

```text
ORD-00000959
→ exact Order Detail
```

Also report:

```text
Payment date predicate:
Payment method source:
```

---

# 48. REFUND TABLE RUNTIME PROOF

For Marie Park, prove the table visibly contains:

```text
RFD-F8DB5871781F
source Payment
source Order
amount
canonical reason
status
```

and exact Order navigation.

---

# 49. PARTNERS TABLE RUNTIME PROOF

For Marie Park:

```text
Baku Tours Pro
2 Orders
1 Booking
206.92 AZN
```

must remain visible if current canonical runtime still contains that relationship.

Prove:

```text
Partner link → exact Partner 360
```

---

# 50. PARTNER CUSTOMERS TABLE RUNTIME PROOF

For Baku Tours Pro:

```text
18 distinct commercial Customers
```

must remain represented if current runtime data remains unchanged.

Marie Park must be visible when her row is in the current page/search result.

Prove exact Customer 360 navigation.

---

# 51. VISUAL CONSISTENCY REVIEW

After implementation compare:

```text
Customer 360 Orders
Customer 360 Bookings
Customer 360 Payments
Customer 360 Partners
Customer 360 Refunds

Partner 360 Services
Partner 360 Orders
Partner 360 Bookings
Partner 360 Customers
```

They should share the same visual grammar.

This does NOT mean identical columns.

It means:

```text
same table system
same density
same status treatment
same link treatment
same loading/error/empty grammar
same pagination grammar
```

---

# 52. NO PLACEHOLDERS

Forbidden final output:

```text
coming soon
unavailable
будет доступно позже
data not implemented
```

If canonical data is truly empty:

```text
honest empty state
```

If API/data contract is broken:

```text
error state
```

---

# 53. NO SECOND 360 IMPLEMENTATION

Keep dedicated routes introduced in Round 4:

```text
/app/crm/customers/:id
/app/crm/partners/:id
```

Do not reintroduce side panels or duplicate detail implementations.

---

# 54. NO NEW DETAIL ROUTES

Do NOT implement in this round:

```text
Payment Detail
Refund Detail
```

Those can be separately evaluated later if operational need justifies them.

Round 5B is table consistency, not entity-model expansion.

---

# 55. NO STOREFRONT PRO CRM YET

Do NOT start:

```text
Storefront Pro CRM
Marketplace Basic CRM finalization
Partner sidebar implementation
Storefront dashboard
Storefront Command Center
Storefront Analytics
Finance
Employees
Marketing
Omnichannel
```

Platform CRM must be visually closed first.

---

# 56. TEST REQUIREMENTS

Add/update focused frontend tests for:

```text
Payments rendered as table
Refunds rendered as table
Partners rendered as table
Partner Customers rendered as table
exact entity hrefs
non-clickable Payment/Refund references
error != empty
raw i18n keys absent
```

Where shared table components are introduced, test meaningful behavior rather than implementation details.

---

# 57. BUILD / REGRESSION GATES

Required:

```text
Frontend TSC
Frontend tests
Frontend build
Backend TSC if backend changed
Backend tests if backend changed
Backend build if backend changed
```

Report exact counts.

---

# 58. BROWSER VERIFICATION

Mandatory on the same localhost runtime used by the user.

Verify:

```text
/app/crm/customers/<id>?tab=orders
/app/crm/customers/<id>?tab=bookings
/app/crm/customers/<id>?tab=payments
/app/crm/customers/<id>?tab=partners
/app/crm/customers/<id>?tab=refunds
/app/crm/customers/<id>?tab=history

/app/crm/partners/<id>?tab=services
/app/crm/partners/<id>?tab=orders
/app/crm/partners/<id>?tab=bookings
/app/crm/partners/<id>?tab=customers
/app/crm/partners/<id>?tab=storefront
```

---

# 59. VISUAL ACCEPTANCE — PAYMENTS

The current Payment card representation:

```text
PAY-00000959                               CAPTURED
50.88 AZN
Оплата за заказ ORD-00000959 (...)
```

must no longer be the collection renderer.

Expected:

```text
table header
+
Payment row(s)
```

with the same information preserved.

---

# 60. VISUAL ACCEPTANCE — REFUNDS

Refund collection must use the same table grammar.

Do not leave Payments as table and Refunds as cards.

---

# 61. VISUAL ACCEPTANCE — PARTNERS / CUSTOMERS

Commercial relationship collections must use the same table grammar:

```text
Customer → Partners
Partner → Customers
```

and preserve commercial aggregate semantics established in Round 5.

---

# 62. VISUAL ACCEPTANCE — SERVICES / ORDERS / BOOKINGS

Partner Services/Orders/Bookings and Customer Orders/Bookings must not regress to placeholder or unstructured card lists.

---

# 63. ACCEPTANCE CRITERIA

VERDICT A only if all applicable criteria pass:

1. Current renderer audit supplied.
2. Existing Platform table system reused.
3. Customer Orders = TABLE.
4. Customer Bookings = TABLE.
5. Customer Payments = TABLE.
6. Customer Partners = TABLE.
7. Customer Refunds = TABLE.
8. Customer History renderer explicitly classified.
9. Partner Services = TABLE.
10. Partner Orders = TABLE.
11. Partner Bookings = TABLE.
12. Partner Customers = TABLE.
13. Partner Storefront = structured summary/detail.
14. Payment card collection renderer removed.
15. Refund card collection renderer removed.
16. Payment business context preserved.
17. Refund business context preserved.
18. PAY-00000959 visible in table if runtime record remains.
19. 50.88 AZN visible.
20. CAPTURED visible.
21. ORD-00000959 visible.
22. TH-2026-000959 visible.
23. Order reference opens exact Order Detail.
24. Payment reference does not fake a nonexistent detail link.
25. Refund reference does not fake a nonexistent detail link.
26. Refund source Payment visible.
27. Refund source Order visible.
28. Refund reason visible.
29. Baku Tours Pro relationship remains visible.
30. 2 Orders preserved.
31. 1 Booking preserved.
32. 206.92 AZN semantic documented if displayed.
33. Partner link opens exact Partner 360.
34. Partner Customers remains transaction-derived.
35. Customer link opens exact Customer 360.
36. Entity references use native links.
37. Multi-entity rows do not use ambiguous whole-row click.
38. Status badges consistent.
39. Money formatting consistent.
40. Date formatting consistent.
41. Payment date predicate documented.
42. Payment method source documented or honest absence used.
43. Collection page size <= 20.
44. Pagination/bounded navigation works where needed.
45. Overview counts reconcile with tab totals where applicable.
46. Loading != empty.
47. Error != empty.
48. Honest zero-result states.
49. No invented columns/data.
50. No placeholders.
51. No raw i18n keys.
52. RU PASS.
53. AZ PASS.
54. EN PASS.
55. `crm.detail.partners` regression absent.
56. Dedicated Customer 360 route preserved.
57. Dedicated Partner 360 route preserved.
58. No Payment Detail added.
59. No Refund Detail added.
60. No Storefront Pro CRM started.
61. Customer 360 browser matrix supplied.
62. Partner 360 browser matrix supplied.
63. Payment runtime proof supplied.
64. Refund runtime proof supplied.
65. Partner relationship runtime proof supplied.
66. Visual consistency review PASS.
67. Frontend TSC PASS.
68. Frontend tests PASS.
69. Frontend build PASS.
70. Backend gates PASS if backend changed.
71. Unrelated files = 0.
72. Commit pushed.
73. HEAD == origin/master.
74. Browser evidence comes from same localhost runtime observed by user.
75. Order tables show canonical Order creation date.
76. Booking tables show canonical Booking creation date.
77. Booking service date remains semantically distinct from Booking creation date.
78. Payment tables show canonical payment business date.
79. Payment `createdAt` is not mislabeled as payment date.
80. Pending/failed unpaid Payment does not receive fake successful payment date.
81. Refund tables show canonical refund business date.
82. Refund request date is not mislabeled as refund date.
83. Pending/requested Refund does not receive fake completed refund date.
84. Refund approval date is not mislabeled as completed refund date unless canonical semantics prove equivalence.
85. Service/Product tables show canonical creation date.
86. All date labels are semantically correct.
87. RU/AZ/EN date labels PASS.
88. Canonical timezone/date formatting is consistent.
89. Business Date Matrix supplied with no unresolved Payment/Refund source ambiguity.

---

# 64. VERDICT

Success:

```text
VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM ROUND 5B /
CUSTOMER 360 + PARTNER 360 TABULAR UX CONSISTENCY /
ENTITY REFERENCE NAVIGATION /
STATE PARITY /
VISUAL CLOSURE
FULLY IMPLEMENTED AND BROWSER-VERIFIED
```

Failure:

```text
VERDICT B — PLATFORM CRM ROUND 5B TABULAR UX / VISUAL CLOSURE INCOMPLETE
```

No conditional VERDICT A.

---

# 65. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.5_PLATFORM_CRM_ROUND_5B_TABULAR_UX_CONSISTENCY_REPORT.md
```

---

# 66. FINAL RESPONSE FORMAT

```text
VERDICT:

ROOT CAUSE / UX GAP:

RUNTIME:
Repository:
HEAD:
origin/master:
Frontend:
Backend:
API target:

CURRENT RENDERER AUDIT:
...

CUSTOMER 360:
Overview:
Orders:
Bookings:
Payments:
Partners:
Refunds:
History:

PARTNER 360:
Overview:
Services:
Orders:
Bookings:
Customers:
Storefront:

PAYMENT TABLE:
Columns:
Payment date predicate:
Payment method source:
PAY-00000959:
Order context:
Exact links:

REFUND TABLE:
Columns:
Refund date predicate:
RFD-F8DB5871781F:
Payment context:
Order context:
Reason source:
Exact links:

CUSTOMER → PARTNER:
Columns:
Baku Tours Pro:
Orders:
Bookings:
Commercial value:
Commercial value semantic:
Exact Partner link:

PARTNER → CUSTOMERS:
Columns:
Distinct total:
Marie Park:
Exact Customer link:

BUSINESS DATE MATRIX:
...

ORDER DATE:
Source:
Label:

BOOKING DATES:
Creation source:
Service-date source:

PAYMENT BUSINESS DATE:
Source:
Status/date semantics:
Null behavior:

REFUND BUSINESS DATE:
Request-date source:
Refund-date source:
Status/date semantics:
Null behavior:

SERVICE/PRODUCT DATE:
Source:

PAGINATION:
...

STATE PARITY:
Loading:
Error:
Empty:

I18N:
RU:
AZ:
EN:
Raw keys:

CUSTOMER 360 BROWSER MATRIX:
...

PARTNER 360 BROWSER MATRIX:
...

VISUAL CONSISTENCY REVIEW:
...

Frontend TSC:
Frontend tests:
Frontend build:

Backend changed:
Backend TSC:
Backend tests:
Backend build:

Production files changed:
Unrelated files:
Commit:
HEAD:
origin/master:
HEAD == origin/master:

Report:
Remaining findings:
Next canonical stage:
```

---

# 67. STOP

After the report:

```text
STOP
```

Do not start Storefront Pro CRM.

If VERDICT A is achieved and manual browser review confirms the result, Platform CRM may then be declared:

```text
PLATFORM CRM — FINAL CLOSED
```

and the next canonical CRM stage becomes:

```text
STOREFRONT PRO CRM
```
