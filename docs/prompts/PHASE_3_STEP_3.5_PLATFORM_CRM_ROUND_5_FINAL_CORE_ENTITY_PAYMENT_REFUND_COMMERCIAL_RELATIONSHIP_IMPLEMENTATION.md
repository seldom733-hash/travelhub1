# PHASE 3 — STEP 3.5 — PLATFORM CRM
## ROUND 5 — CORE ENTITY DETAIL ROUTES + PAYMENT / REFUND BUSINESS CONTEXT + CUSTOMER ↔ PARTNER COMMERCIAL RELATIONSHIP CONTRACT
## SERVICE / ORDER / BOOKING DEEP LINKS + CUSTOMER 360 PAYMENT PURPOSE + REFUND TARGET
## SYSTEM-WIDE NAVIGATION / FINANCIAL TRACEABILITY / COMMERCIAL RELATIONSHIP REMEDIATION

---

# 1. PURPOSE

Round 4 implemented and runtime-verified:

```text
Customer 360 dedicated route
Partner 360 dedicated route
deep links
breadcrumbs
Back/Forward
tab URL state
Customer ↔ Partner cross-links
native Link semantics
```

Commit:

```text
1e9283e
```

However Round 4 also reported remaining gaps:

```text
Order detail route does not exist
Booking detail route does not exist
Service/Product detail route does not exist

CRM entity links therefore currently lead to list pages,
not exact entity detail pages.
```

Manual review also identified a second semantic gap:

```text
Customer 360 → Платежи
```

must answer:

```text
WHAT DOES THIS PAYMENT PAY FOR?
```

and:

```text
Customer 360 → Возвраты
```

must answer:

```text
WHAT IS BEING REFUNDED?
FROM WHICH PAYMENT / ORDER?
WHY?
```

This remediation closes both issues through:

1. canonical detail routes for core business entities;
2. exact CRM entity navigation;
3. Payment Business Context Contract;
4. Refund Business Context Contract.

---

# 2. CORE PRINCIPLE

A financial transaction without business-object context is insufficient for CRM.

Forbidden final representation:

```text
PAY-00123
PAID
120 AZN
26.08.2026
```

without answering what the payment belongs to.

Likewise:

```text
RFD-00123
APPROVED
31.22 AZN
26.08.2026
```

without explaining what is being refunded.

---

# 3. TARGET TRACEABILITY

Conceptually:

```text
CUSTOMER
   │
   ├── ORDER
   │    ├── BOOKING
   │    └── SERVICE / PRODUCT
   │
   ├── PAYMENT
   │    └── payment target / business context
   │
   └── REFUND
        ├── source Payment / Order
        ├── refund target / business context
        └── reason
```

Do NOT force this exact relational model onto the schema.

First determine the actual canonical relations.

---

# 4. FIRST ACTION — CANONICAL RELATIONSHIP AUDIT

Before production changes, inspect actual schema/entities/services for:

```text
Order
OrderItem if present
Booking
Service/Product/Tour/etc.
Payment
Refund
Customer
Partner
```

Determine exact join paths.

Required matrix:

| Entity | Canonical identifier | Parent/business relation | Detail API exists? | Detail route exists? |
|---|---|---|---|---|
| Service/Product | | | | |
| Order | | | | |
| Booking | | | | |
| Payment | | | | |
| Refund | | | | |

Do not infer relationships from UI labels.

---

# 5. PAYMENT RELATIONSHIP AUDIT

For Payment determine exactly:

```text
Does Payment belong to Order?
Does Payment belong directly to Booking?
Can one Payment cover multiple bookings/items?
Can one Order contain multiple services/bookings?
Are partial payments supported?
Are installments supported?
Is there an allocation model?
```

Only claim semantics supported by current code/schema.

---

# 6. REFUND RELATIONSHIP AUDIT

For Refund determine exactly:

```text
Does Refund reference Payment?
Does Refund reference Order?
Does Refund reference Booking?
Can one Refund represent a partial amount?
Can one Payment have multiple Refunds?
Is refund reason stored?
Is cancellation reason different from refund reason?
```

Do not conflate:

```text
refund
cancellation
payment reversal
failed payment
```

---

# 7. CORE ENTITY DETAIL ROUTES

Implement dedicated Platform detail routes for:

```text
Service / Product
Order
Booking
```

where canonical detail pages genuinely do not already exist.

Use existing application route conventions.

Conceptual examples only:

```text
/app/catalog/:id
/app/orders/:id
/app/bookings/:id
```

Do NOT blindly use these paths before route inventory.

---

# 8. SERVICE / PRODUCT DETAIL

The detail page must represent the canonical service/product entity already used by Catalog.

Minimum useful content should be derived from current model, such as:

```text
code/id
title/name
type/category
partner
status
publication state
relevant availability context
other existing canonical fields
```

Do not redesign the entire Catalog module.

---

# 9. ORDER DETAIL

Order Detail must provide enough context to understand the transaction.

Evaluate canonical availability of:

```text
order code
customer
partner
status
created date
total
currency
items/services
bookings
payments
refunds
```

Only show supported relations.

---

# 10. BOOKING DETAIL

Booking Detail must provide enough context to understand fulfillment.

Evaluate:

```text
booking code
customer
partner
service/product
order
booking status
service date
amount/value where canonical
payment context where appropriate
```

Preserve status semantics.

---

# 11. DETAIL PAGE NAVIGATION

Each detail page requires:

```text
stable URL
refresh-safe loading
browser Back/Forward
breadcrumb
not found
forbidden
RBAC
native link semantics
```

---

# 12. CRM ENTITY LINKS — REPLACE LIST DESTINATIONS

After detail routes exist, update CRM.

Partner 360:

```text
Услуги
service code/name
→ exact Service/Product Detail

Заказы
order code
→ exact Order Detail

Бронирования
booking code
→ exact Booking Detail
```

Customer 360:

```text
Заказы
order code
→ exact Order Detail

Бронирования
booking code
→ exact Booking Detail
```

No broad list destination for these entity references after remediation.

---

# 13. PAYMENT BUSINESS CONTEXT CONTRACT

Every Payment row in Customer 360 must answer:

```text
1. Which payment is this?
2. What business object does it pay for?
3. Which Order does it belong to?
4. Which Booking/Service context can be safely attributed?
5. How much?
6. What payment status?
7. When?
```

---

# 14. PAYMENT UI — TARGET COLUMNS

Determine exact fields from canonical data.

Preferred conceptual layout:

```text
Платёж
Что оплачивает
Заказ
Бронь / Услуга
Сумма
Статус
Дата
```

This is a semantic target, not permission to invent fields.

---

# 15. PAYMENT TARGET / PURPOSE

`Что оплачивает` must be derived from canonical relations.

Possible valid semantics:

```text
Order ORD-...
Booking BKG-...
Service/Product ...
Deposit for Order ...
Installment ...
```

only if current model proves them.

Forbidden:

```text
"Оплата Baku City Tour"
```

when the payment actually covers an Order containing multiple items.

---

# 16. MULTI-ITEM PAYMENT

If one Payment covers an entire Order with multiple items:

Do NOT arbitrarily select one Service.

Represent honestly, for example:

```text
Заказ ORD-...
3 услуги
```

with access to Order Detail.

If UI can safely summarize item names without clutter, that is optional.

---

# 17. PARTIAL PAYMENT

If partial payments are supported:

```text
Payment amount
≠
Order total
```

must remain clear.

Do not label a partial payment as full Order payment unless canonical status says so.

---

# 18. PAYMENT LINKS

Where canonical:

```text
Order code → Order Detail
Booking code → Booking Detail
Service name/code → Service Detail
```

Do not create Payment Detail merely to satisfy this prompt unless a canonical Payment Detail already exists or is independently justified.

---

# 19. REFUND BUSINESS CONTEXT CONTRACT

Every Refund row in Customer 360 must answer:

```text
1. Which refund is this?
2. What is being refunded?
3. Which Payment / Order is the money coming from?
4. Which Booking/Service context can be safely attributed?
5. How much?
6. What refund status?
7. Why?
8. When?
```

---

# 20. REFUND UI — TARGET COLUMNS

Preferred conceptual layout:

```text
Возврат
Что возвращается
Платёж / Заказ
Бронь / Услуга
Сумма
Статус
Причина
Дата
```

Again: only use fields supported by canonical data.

---

# 21. REFUND TARGET

`Что возвращается` must reflect actual refund scope.

Valid examples only when proven:

```text
Refund for Order ORD-...
Refund for Booking BKG-...
Partial refund for Payment PAY-...
Refund for cancelled service ...
```

Do not infer a single Service if refund scope is the whole Order.

---

# 22. REFUND SOURCE

Where canonical relation exists, show:

```text
Refund
→ Payment
→ Order
```

or actual project equivalent.

The user should be able to trace money backward.

---

# 23. REFUND REASON

If a canonical refund reason exists:

```text
show it
```

If only cancellation reason exists:

```text
do not relabel it as refund reason
```

If no refund reason is stored:

```text
show honest absence
```

Do not fabricate:

```text
"Отмена"
```

merely because a booking was cancelled.

---

# 24. PARTIAL REFUNDS

If supported:

```text
Refund amount
< Payment amount
```

must be represented correctly.

Do not imply the entire Payment was refunded.

---

# 25. MULTIPLE REFUNDS

If one Payment can have multiple refunds:

```text
each Refund remains a separate canonical transaction
```

Do not collapse them unless current domain model explicitly defines aggregate refund records.

---

# 26. PAYMENT ≠ REFUND ≠ ORDER STATUS

Preserve:

```text
Order status
≠
Booking status
≠
Payment status
≠
Refund status
```

No semantic shortcut in badges/labels.

---

# 27. PAYMENT / REFUND TRACEABILITY FROM ORDER DETAIL

If current relations allow it, Order Detail should show or link to:

```text
Payments
Refunds
Bookings/items
```

This is useful for exact financial traceability.

Do not turn this prompt into a full Finance module.

---

# 28. PAYMENT / REFUND TRACEABILITY FROM BOOKING DETAIL

Where canonical attribution exists, Booking Detail may show:

```text
related Order
related Payment context
related Refund context
```

Do not claim direct allocation if it only exists through Order.

---

# 29. SERVICE CONTEXT

Payment/Refund may display Service only when attribution is unambiguous.

Examples:

```text
Order has exactly one service
or
Payment allocation explicitly references service
or
Booking relation proves service
```

Otherwise prefer:

```text
Order context
multiple items indicator
```

---

# 30. CUSTOMER 360 — PAYMENTS

Replace financially context-poor rows with operationally traceable rows.

Required final classification:

```text
FULL
```

No placeholder.

---

# 31. CUSTOMER 360 — REFUNDS

Replace financially context-poor rows with operationally traceable rows.

Required final classification:

```text
FULL
```

No placeholder.

---


# 31A. CUSTOMER ↔ PARTNER COMMERCIAL RELATIONSHIP CONTRACT

Manual runtime review exposed a semantic defect:

```text
Customer 360 can have real Orders / Bookings / Payments / Refunds
while "Партнёрские связи" is empty.
```

For Platform CRM this is not sufficient.

The Platform knows that a Customer commercially interacted with a Partner when canonical transactional activity proves the relationship.

Hard invariant:

```text
Customer ↔ Partner Commercial Relationship
MUST be derived from canonical transactional activity.

PartnerCustomerRelation
MAY enrich that relationship with CRM metadata,
but MUST NOT be required for the commercial relationship
to appear in Platform CRM.
```

Do not assume the exact join path. Audit actual schema first.

Potential canonical evidence may include:

```text
Customer → Order → Partner
Customer → Booking → Partner
Customer → Order/Booking → Service → Partner
```

Use only relationships actually supported by the project.

---

# 31B. TWO DIFFERENT CONCEPTS — DO NOT CONFLATE

Keep these concepts separate:

```text
A. Commercial relationship
   Customer interacted commercially with Partner
   through canonical transactional activity.

B. CRM relationship metadata
   PartnerCustomerRelation
   lifecycle
   leadSource
   tags
   notes
   assignedTo
   etc.
```

The existence of A must not depend on B.

B may enrich A when a matching relation exists.

---

# 31C. CUSTOMER 360 — RENAME "ПАРТНЁРСКИЕ СВЯЗИ"

For Platform CRM rename:

```text
Партнёрские связи
```

to:

```text
Партнёры
```

and equivalent RU/AZ/EN translations.

The tab should answer:

```text
С какими партнёрами этот клиент реально взаимодействовал?
Каков масштаб этого взаимодействия?
Есть ли дополнительное CRM-отношение?
```

Do not present a technical `PartnerCustomerRelation` table as if it were the complete commercial history.

---

# 31D. CUSTOMER 360 → PARTNERS — REQUIRED SEMANTICS

Build the Partner list from canonical transactional relationship.

Evaluate useful fields supported by current data:

```text
Partner code/name
Orders count
Bookings count
Commercial amount/value where semantically safe
Last commercial activity
CRM relationship state/metadata where available
```

Preferred conceptual table:

```text
Партнёр | Заказы | Бронирования | Сумма | Последняя активность | CRM
```

This is not permission to invent unsupported aggregates.

Partner identity must link to exact Partner 360.

---

# 31E. CUSTOMER 360 → PARTNERS — DISTINCTNESS

A Partner must appear once per Customer.

If multiple:

```text
Orders
Bookings
Services
```

connect the same Customer and Partner, aggregate them into one commercial relationship row unless current architecture explicitly requires another representation.

Avoid duplicate Partner rows caused by joins.

---

# 31F. CUSTOMER 360 → PARTNERS — AMOUNT SEMANTICS

Before showing a monetary relationship total, define it.

Possible concepts are not interchangeable:

```text
Order total
Paid amount
Collected amount
Refund-adjusted amount
GMV
Net value
```

Choose only a canonical, useful metric and label it accurately.

If semantic authority is unclear:

```text
do not show the amount yet
```

Do not call it "Сумма" without defining what is summed.

---

# 31G. CUSTOMER 360 → PARTNERS — LAST ACTIVITY

If displayed, `Последняя активность` must have a documented predicate.

Examples may include:

```text
latest Order creation
latest Booking activity
latest completed transaction
```

Do not combine unrelated timestamps and call the maximum "activity" without defining the rule.

---

# 31H. CUSTOMER 360 → PARTNERS — CRM ENRICHMENT

When matching `PartnerCustomerRelation` exists, enrich the commercial relationship with canonical CRM metadata.

Examples where authorized:

```text
lifecycle
leadSource
assignedTo
```

Do not expose partner-private notes/tags to Platform unless existing authority explicitly allows them.

If no `PartnerCustomerRelation` exists:

```text
commercial Partner row MUST still remain visible
CRM metadata = absent / —
```

---

# 31I. PARTNER 360 → CUSTOMERS — MIRROR CONTRACT

Partner 360 → `Клиенты` must use the same commercial relationship authority in reverse.

Hard invariant:

```text
A Customer with canonical transactional activity
with the selected Partner
MUST be discoverable in Partner 360 → Клиенты
even when PartnerCustomerRelation does not exist.
```

Evaluate supported fields:

```text
Customer code/name
Orders count
Bookings count
Commercial value where semantically safe
Last commercial activity
CRM metadata where authorized
```

Customer identity must link to exact Customer 360.

---

# 31J. PARTNER 360 → CUSTOMERS — DISTINCT CUSTOMER SEMANTICS

Document exactly what:

```text
Customers count
```

means.

Preferred Platform semantic:

```text
distinct Customers with canonical commercial activity
with the selected Partner
```

Do not use:

```text
PartnerCustomerRelation row count
```

as the Partner customer count unless that is explicitly the intended metric.

---

# 31K. OVERVIEW COUNT PARITY

If Partner 360 Overview shows:

```text
Customers: N
```

it must reconcile with:

```text
Partner 360 → Клиенты
distinct commercial customer total
```

If Customer 360 Overview later shows a Partner count, it must reconcile with:

```text
Customer 360 → Партнёры
distinct commercial partner total
```

---

# 31L. TRANSACTIONAL RELATIONSHIP DATA AUTHORITY

Required matrix:

| Relationship | Canonical evidence | Join path | Distinct key | CRM enrichment | PASS |
|---|---|---|---|---|---|
| Customer → Partner | | | | PartnerCustomerRelation optional | |
| Partner → Customer | | | | PartnerCustomerRelation optional | |

Explicitly prove that the relationship is not dependent on `PartnerCustomerRelation`.

---

# 31M. NEAR-MISS / LEAKAGE TESTS

Verify exclusion of:

```text
another Customer's Partner
another Partner's Customer
unrelated PartnerCustomerRelation
orders without the selected Customer
bookings without the selected Partner
duplicate rows caused by multiple bookings/orders
```

No cross-entity leakage.

---

# 31N. EMPTY STATE RULE

Customer 360 → `Партнёры` may show empty only when:

```text
no canonical transactional relationship exists
AND
the relationship query succeeded.
```

Partner 360 → `Клиенты` may show empty only when:

```text
no canonical transactional relationship exists
AND
the relationship query succeeded.
```

The absence of `PartnerCustomerRelation` alone is NOT a valid empty-state reason.

---

# 31O. REPRESENTATIVE RUNTIME PROOF

Use runtime entities with known transactional activity.

For Customer 360, the previously inspected Marie Park is a useful candidate if current runtime data still contains her Orders/Bookings.

Required proof:

```text
Customer has transaction(s)
→ Partner(s) derived
→ Partner tab is not falsely empty
→ Partner link opens exact Partner 360
```

For Partner 360:

```text
Partner has Order(s)/Booking(s) with identifiable Customers
→ Customers derived
→ Customers tab is not falsely empty
→ Customer link opens exact Customer 360
```

Do not assume prior seed records still exist; verify current runtime.

---

# 31P. COMMERCIAL RELATIONSHIP SCENARIO MATRIX

Required:

| Scenario | Expected | Actual | PASS |
|---|---|---|---|
| Customer has Order with Partner, no PartnerCustomerRelation | Partner visible | | |
| Customer has Booking with Partner, no PartnerCustomerRelation | Partner visible if canonical path supports it | | |
| Customer has multiple Orders with same Partner | one Partner row + aggregates | | |
| Partner has multiple Orders from same Customer | one Customer row + aggregates | | |
| Matching PartnerCustomerRelation exists | commercial row enriched | | |
| PartnerCustomerRelation exists without transactional activity | classify/document behavior; do not silently call it commercial activity | | |
| No transactional relationship | honest empty | | |

---

# 31Q. PLATFORM CRM TERMINOLOGY

Final Platform CRM navigation should be:

```text
Customer 360
├── Обзор
├── Заказы
├── Бронирования
├── Платежи
├── Партнёры
├── Возвраты
└── История

Partner 360
├── Обзор
├── Услуги
├── Заказы
├── Бронирования
├── Клиенты
└── Витрина
```

Do not use `Партнёрские связи` as the final Platform-facing tab name unless architecture review proves a different intended semantic.

---

# 31R. END-TO-END COMMERCIAL TRACEABILITY

Round 5 should close this navigable conceptual chain where canonical data exists:

```text
Customer
   ↕
Partner
   ↓
Service / Product
   ↓
Order
   ↓
Booking
   ↓
Payment
   ↓
Refund
```

This diagram does NOT assert a strict database parent-child chain.

It represents the required user-facing traceability between canonical business objects.


# 32. CUSTOMER 360 — OVERVIEW PARITY

If Overview displays:

```text
Payments: N
Refunds: N
```

these counts must match the semantic totals in corresponding tabs.

---

# 33. EXACT ENTITY LINKS

Hard rule:

```text
Entity reference
→ exact entity
```

Not:

```text
Order reference
→ Orders list

Booking reference
→ Bookings list

Service reference
→ Catalog list
```

after dedicated routes are implemented.

---

# 34. PROJECT-WIDE REUSABILITY

Build core detail routes as reusable Platform routes.

They should later be usable from:

```text
CRM
Command Center
Decision Queue
Orders
Bookings
Catalog
Analytics drill-down
```

Do not hardwire them exclusively to CRM origin.

---

# 35. BREADCRUMBS

Use canonical hierarchy.

Examples conceptually:

```text
CRM / Customer / Marie Park / Order ORD-...
CRM / Partner / Absheron... / Service PRD-...
```

However a core detail page may use its owning module hierarchy instead:

```text
Orders / ORD-...
Bookings / BKG-...
Catalog / PRD-...
```

Prefer the canonical owning module rather than encoding origin-specific breadcrumbs.

Browser Back handles origin.

---

# 36. NO ORIGIN-SPECIFIC DETAIL DUPLICATION

Forbidden:

```text
CRM Order Detail
Orders Center Order Detail
```

as separate business implementations.

There should be one canonical Platform Order Detail.

Same for Booking and Service.

---

# 37. QUERY EFFICIENCY

Payment/refund context may require joins.

Avoid:

```text
N+1 per payment
N+1 per refund
client-side fetch per row
```

Prefer canonical backend include/join/aggregate query.

Report query strategy.

---

# 38. DATA AUTHORITY MATRIX

Required:

| Visible field | Surface | Canonical source | Join/predicate | Direct/derived | Ambiguity rule |
|---|---|---|---|---|---|
| Payment target | Customer 360 Payments | | | | |
| Payment Order | Customer 360 Payments | | | | |
| Payment Booking/Service | Customer 360 Payments | | | | |
| Refund target | Customer 360 Refunds | | | | |
| Refund source Payment/Order | Customer 360 Refunds | | | | |
| Refund Booking/Service | Customer 360 Refunds | | | | |
| Refund reason | Customer 360 Refunds | | | | |

---

# 39. PAYMENT SCENARIO MATRIX

Test actual supported scenarios.

| Scenario | Supported by model? | UI representation | PASS |
|---|---|---|---|
| single-item Order payment | | | |
| multi-item Order payment | | | |
| partial payment | | | |
| multiple payments per Order | | | |
| direct Booking allocation | | | |

Mark unsupported scenarios honestly.

Do not fabricate fixtures for unsupported domain capabilities.

---

# 40. REFUND SCENARIO MATRIX

| Scenario | Supported by model? | UI representation | PASS |
|---|---|---|---|
| full refund | | | |
| partial refund | | | |
| multiple refunds per Payment | | | |
| Order-level refund | | | |
| Booking-level refund | | | |
| refund reason available | | | |

---

# 41. NOT FOUND

Core detail routes:

```text
unknown Service
unknown Order
unknown Booking
```

must show canonical not-found behavior.

---

# 42. RBAC

Direct URL must preserve server-side authority.

Verify permissions for:

```text
Service read
Order read
Booking read
Customer CRM read
Partner CRM read
```

Do not expose objects simply because user knows an ID.

---

# 43. TENANT / PARTNER SCOPE

This prompt is Platform-focused.

Do not accidentally create Partner-accessible Platform detail routes unless current permission/scope architecture authorizes them.

Storefront Pro / Marketplace Basic behavior remains unchanged.

---

# 44. I18N

All new detail-page labels and financial context labels:

```text
RU
AZ
EN
```

Raw keys = 0.

---

# 45. PAGINATION

Preserve:

```text
pageSize = 20
```

for CRM operational tables.

Order/Booking/Service detail child collections must also remain bounded where applicable.

---

# 46. ERROR ≠ ZERO

Preserve prior invariant for:

```text
Payments
Refunds
Order Detail
Booking Detail
Service Detail
```

API failure must not become business zero/empty.

---

# 47. NO PAYMENT / REFUND DETAIL REQUIREMENT

This Round does NOT require dedicated:

```text
Payment Detail
Refund Detail
```

unless the project already has them.

The mandatory requirement is:

```text
financial business context
+
traceability to canonical business objects
```

---

# 48. BROWSER — SERVICE DETAIL

Required:

```text
Partner 360 → Services
click real service
→ exact Service/Product Detail
URL contains exact entity identity
refresh works
Back works
```

---

# 49. BROWSER — ORDER DETAIL

Required from:

```text
Customer 360 → Orders
Partner 360 → Orders
```

click real order:

```text
→ exact Order Detail
```

Verify same canonical detail route is used.

---

# 50. BROWSER — BOOKING DETAIL

Required from:

```text
Customer 360 → Bookings
Partner 360 → Bookings
```

click real booking:

```text
→ exact Booking Detail
```

---

# 51. BROWSER — PAYMENT CONTEXT

Use a customer with a real payment.

Verify row visibly answers:

```text
payment id
what it pays for
related order
booking/service context where unambiguous
amount
status
date
```

Click available entity references and verify exact destinations.

---

# 52. BROWSER — REFUND CONTEXT

Use a customer with a real refund.

Verify row visibly answers:

```text
refund id
what is being refunded
source payment/order
booking/service context where unambiguous
amount
status
reason if canonical
date
```

---

# 53. REPRESENTATIVE EXISTING DATA

Prefer existing runtime examples already proven in prior rounds where still present:

```text
Customer: Marie Park
Refund: RFD-F8DB5871781F
Partner: Absheron Peninsula Tours
Order: ORD-00000460
Services such as PRD-5483C002
```

Do not assume these records still exist without checking runtime.

---

# 54. TESTS — CORE DETAIL ROUTES

Required focused coverage:

```text
Service detail success
Service not found
Service forbidden where applicable

Order detail success
Order not found
Order forbidden where applicable

Booking detail success
Booking not found
Booking forbidden where applicable
```

---

# 55. TESTS — PAYMENT CONTEXT

Test canonical Payment serialization/presentation for supported cases.

At minimum:

```text
payment → Order context
single-item attribution if supported
multi-item ambiguity handling if present
```

---

# 56. TESTS — REFUND CONTEXT

At minimum:

```text
refund → source Payment/Order
refund amount/status
refund reason semantics
service/booking attribution only when safe
```

---

# 57. TESTS — LINK DESTINATIONS

Verify CRM-generated hrefs point to:

```text
exact Service detail
exact Order detail
exact Booking detail
```

No list fallback for these three after implementation.

---

# 58. REGRESSION

Must preserve:

```text
Customer 360 dedicated page
Partner 360 dedicated page
?tab=...
breadcrumbs
Back/Forward
Customer ↔ Partner links
Refunds real data
History
Partner Services
Partner Orders
Partner Bookings
Partner Customers
Partner Storefront
crm.partner.read
error/zero boundaries
20-row pagination
```

---

# 59. STATIC / BUILD GATES

Required:

```text
Backend TSC
Frontend TSC
Backend build
Frontend build
relevant backend tests
relevant frontend tests
```

Report exact counts.

---

# 60. REQUIRED ROUTE MATRIX

| Entity | Route before | Route after | API | Permission | Runtime PASS |
|---|---|---|---|---|---|
| Service/Product | list only | | | | |
| Order | list only | | | | |
| Booking | list only | | | | |

---

# 61. REQUIRED ENTITY LINK MATRIX

| Source | Reference | Destination | Exact entity? | Native Link? | PASS |
|---|---|---|---|---|---|
| Partner 360 Services | Service | | | | |
| Partner 360 Orders | Order | | | | |
| Partner 360 Bookings | Booking | | | | |
| Customer 360 Orders | Order | | | | |
| Customer 360 Bookings | Booking | | | | |
| Customer 360 Payments | Order/Booking/Service | | | | |
| Customer 360 Refunds | Payment/Order/Booking/Service | | | | |

---

# 62. REQUIRED BEFORE / AFTER — PAYMENTS

Report:

```text
BEFORE:
Payment row fields:
Business target visible:
Traceability:

AFTER:
Payment row fields:
Business target visible:
Order context:
Booking context:
Service context:
Ambiguity handling:
Clickable references:
```

---

# 63. REQUIRED BEFORE / AFTER — REFUNDS

Report:

```text
BEFORE:
Refund row fields:
Refund target visible:
Source transaction visible:
Reason visible:

AFTER:
Refund row fields:
Refund target:
Source Payment:
Source Order:
Booking context:
Service context:
Reason:
Ambiguity handling:
Clickable references:
```

---

# 64. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.5_PLATFORM_CRM_ROUND_5_CORE_ENTITY_DETAIL_PAYMENT_REFUND_CONTEXT_REPORT.md
```

---

# 65. HARD ACCEPTANCE CRITERIA

VERDICT A only if ALL applicable criteria pass:

1. Canonical Service/Product relationship audited.
2. Canonical Order relationship audited.
3. Canonical Booking relationship audited.
4. Canonical Payment relationship audited.
5. Canonical Refund relationship audited.
6. Payment allocation semantics documented.
7. Refund scope semantics documented.
8. Dedicated Service/Product detail route exists.
9. Dedicated Order detail route exists.
10. Dedicated Booking detail route exists.
11. Service direct URL works.
12. Order direct URL works.
13. Booking direct URL works.
14. Service refresh works.
15. Order refresh works.
16. Booking refresh works.
17. Service Back/Forward works.
18. Order Back/Forward works.
19. Booking Back/Forward works.
20. Service not-found works.
21. Order not-found works.
22. Booking not-found works.
23. Service server-side authorization works.
24. Order server-side authorization works.
25. Booking server-side authorization works.
26. Partner 360 Service reference opens exact Service.
27. Partner 360 Order reference opens exact Order.
28. Partner 360 Booking reference opens exact Booking.
29. Customer 360 Order reference opens exact Order.
30. Customer 360 Booking reference opens exact Booking.
31. No Service entity reference falls back to unfiltered list.
32. No Order entity reference falls back to unfiltered list.
33. No Booking entity reference falls back to unfiltered list.
34. Payment row identifies canonical Payment.
35. Payment row shows what it pays for.
36. Payment row shows related Order.
37. Booking/Service payment context is shown only when canonically attributable.
38. Multi-item ambiguity is handled honestly.
39. Partial-payment semantics are not misrepresented.
40. Refund row identifies canonical Refund.
41. Refund row shows what is being refunded.
42. Refund row shows source Payment/Order where canonical.
43. Booking/Service refund context is shown only when canonically attributable.
44. Refund reason uses canonical refund reason only.
45. Cancellation reason is not mislabeled as refund reason.
46. Partial refund semantics are preserved.
47. Multiple refunds are not incorrectly collapsed.
48. Payment status != Order status remains preserved.
49. Refund status != Payment status remains preserved.
50. Payment count parity PASS.
51. Refund count parity PASS.
52. Payment/refund context queries avoid N+1.
53. Customer 360 dedicated route does not regress.
54. Partner 360 dedicated route does not regress.
55. Customer ↔ Partner links do not regress.
56. Round 3 operational data does not regress.
57. Error != empty does not regress.
58. pageSize=20 does not regress.
59. crm.partner.read does not regress.
60. RU PASS.
61. AZ PASS.
62. EN PASS.
63. Raw i18n keys = 0.
64. Storefront Pro CRM is NOT started.
65. Marketplace Basic CRM is NOT started.
66. Partner Shared Sidebar implementation is NOT started.
67. F.1–F.13 remain NOT STARTED.
68. S.1–S.19 remain NOT STARTED.
69. Backend TSC PASS.
70. Frontend TSC PASS.
71. Backend build PASS.
72. Frontend build PASS.
73. Relevant backend tests PASS.
74. Relevant frontend tests PASS.
75. Route matrix supplied.
76. Entity link matrix supplied.
77. Payment scenario matrix supplied.
78. Refund scenario matrix supplied.
79. Payment before/after supplied.
80. Refund before/after supplied.
81. Browser Service evidence supplied.
82. Browser Order evidence supplied.
83. Browser Booking evidence supplied.
84. Browser Payment context evidence supplied.
85. Browser Refund context evidence supplied.
86. Production changes limited to scope.
87. Unrelated files committed = 0.
88. Push complete.
89. HEAD == origin/master.

---


# 65A. ADDITIONAL HARD ACCEPTANCE — CUSTOMER ↔ PARTNER

In addition to section 65, VERDICT A requires:

90. Customer ↔ Partner canonical commercial relationship path is documented.
91. Commercial relationship does not require PartnerCustomerRelation.
92. PartnerCustomerRelation is treated as optional CRM enrichment.
93. Customer 360 tab is renamed from `Партнёрские связи` to `Партнёры` in RU and equivalent AZ/EN.
94. Customer 360 → Partners derives real Partners from canonical transactional activity.
95. Customer with Order to Partner remains linked when PartnerCustomerRelation is absent.
96. Customer with multiple transactions to same Partner does not produce duplicate Partner rows.
97. Customer → Partner aggregate semantics are documented.
98. Customer → Partner monetary metric, if shown, has explicit meaning.
99. Customer → Partner last activity, if shown, has explicit predicate.
100. Customer → Partner CRM metadata is optional enrichment.
101. Partner 360 → Customers derives real Customers from canonical transactional activity.
102. Partner Customer count means documented distinct commercial Customers.
103. Partner Overview customer count reconciles with Customers tab.
104. Partner with multiple transactions from same Customer does not produce duplicate Customer rows.
105. PartnerCustomerRelation absence does not produce false empty Customers tab.
106. Transactional relationship authority matrix supplied.
107. Commercial relationship scenario matrix supplied.
108. Near-miss/cross-entity leakage tests PASS.
109. Customer → Partner exact deep link PASS.
110. Partner → Customer exact deep link PASS.
111. Runtime proof uses at least one Customer with real transactional Partner relationship.
112. Runtime proof uses at least one Partner with real transactional Customer relationship.
113. No false empty relationship state remains.
114. Customer 360 → Partners pagination remains bounded at 20 when >20.
115. Partner 360 → Customers pagination remains bounded at 20 when >20.
116. RU/AZ/EN terminology for Partners/Customers PASS.
117. End-to-end commercial traceability is documented.

# 66. VERDICT

Success:

```text
VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM ROUND 5 /
CORE SERVICE + ORDER + BOOKING DETAIL ROUTES /
EXACT ENTITY NAVIGATION /
PAYMENT + REFUND BUSINESS CONTEXT /
CUSTOMER ↔ PARTNER COMMERCIAL RELATIONSHIP
FULLY IMPLEMENTED AND RUNTIME-VERIFIED
```

Failure:

```text
VERDICT B — PLATFORM CRM ROUND 5 FINANCIAL TRACEABILITY / CORE ENTITY NAVIGATION INCOMPLETE
```

No conditional VERDICT A.

---

# 67. FINAL RESPONSE FORMAT

```text
VERDICT:

CANONICAL RELATIONSHIPS:
Service/Product:
Order:
Booking:
Payment:
Refund:

PAYMENT SEMANTICS:
Pays for:
Order relation:
Booking relation:
Service relation:
Partial payments:
Multi-item Orders:
Multiple payments:

REFUND SEMANTICS:
Refund target:
Payment relation:
Order relation:
Booking relation:
Service relation:
Partial refunds:
Multiple refunds:
Refund reason:

CORE DETAIL ROUTES:
Service:
Order:
Booking:

ROUTE MATRIX:
...

ENTITY LINK MATRIX:
...

CUSTOMER 360 PAYMENTS:
Before:
After:
Fields:
Target/purpose:
Links:
Ambiguity handling:

CUSTOMER 360 REFUNDS:
Before:
After:
Fields:
Refund target:
Source transaction:
Reason:
Links:
Ambiguity handling:

PAYMENT SCENARIO MATRIX:
...

REFUND SCENARIO MATRIX:
...

CUSTOMER ↔ PARTNER COMMERCIAL RELATIONSHIP:
Canonical evidence:
Customer → Partner join path:
Partner → Customer join path:
PartnerCustomerRelation role:
Distinctness:
Aggregate semantics:
Customer tab renamed:
Partner customer-count semantics:

TRANSACTIONAL RELATIONSHIP AUTHORITY MATRIX:
...

COMMERCIAL RELATIONSHIP SCENARIO MATRIX:
...

BROWSER:
Service:
Order:
Booking:
Payment context:
Refund context:

REGRESSION:
Customer 360:
Partner 360:
Round 3 data:
Round 4 deep links:
RBAC:
Pagination:
Error/empty:
i18n:

QUERY STRATEGY:
N+1:

Backend TSC:
Frontend TSC:
Backend build:
Frontend build:
Backend tests:
Frontend tests:

Production code changed:
DB schema changed:
Migration:
Files changed:

Platform CRM status:
Storefront Pro CRM status:
Marketplace Basic CRM status:
Partner Shared Sidebar implementation:
F.1–F.13:
S.1–S.19:

Report:
Commit:
HEAD:
origin/master:
HEAD == origin/master:
Unrelated files:

Remaining findings:
Next canonical stage:
```

---

# 68. STOP

After report:

```text
STOP
```

Do NOT automatically start Storefront Pro CRM.

We will visually inspect:

```text
Service Detail
Order Detail
Booking Detail
Customer 360 → Payments
Customer 360 → Refunds
```

before proceeding.
