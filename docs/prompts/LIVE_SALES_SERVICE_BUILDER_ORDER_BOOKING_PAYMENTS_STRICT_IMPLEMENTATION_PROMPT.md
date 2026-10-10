# LIVE SALES — SERVICE BUILDER → ORDER → BOOKING → PAYMENTS
## STRICT IMPLEMENTATION PROMPT

### STATUS

Implementation task.

This prompt defines the implementation of the Live Sales service-assembly flow discussed with the owner.

The implementation must be performed against the EXISTING TravelHUB architecture and repository.

Do not replace existing canonical entities with invented parallel entities unless repository inspection proves that the required capability does not already exist.

Before changing code, inspect the existing:
- Request
- Order
- OrderItem
- Booking
- Payment
- Supplier/Partner
- Product
- Quote/Sale if present
- existing lifecycle/status logic
- existing manual/offline payment implementation
- existing RBAC
- existing Live Sales / Request UI

Preserve existing architecture wherever possible.

---

# 1. BUSINESS OBJECTIVE

TravelHUB must support Live Sales where a customer purchases through:

- WhatsApp
- phone
- office
- chat
- other communication channels

The manager may assemble one customer offer from services supplied by different partners.

Example:

```text
Customer
  ↓
WhatsApp
  ↓
Request
  ↓
Manager assembles services
  ├── Flight      → AZAL
  ├── Hotel       → KOMPAS
  ├── Transfer    → Local Transfer LLC
  └── Insurance   → Insurance Partner
  ↓
Customer accepts
  ↓
Order
  ↓
Bookings / Payments / Fulfillment
```

A service DOES NOT have to exist as a TravelHUB Product.

Therefore:

```text
productId = NULL
```

may be valid for a genuine Live Sales / manual supplier service.

Product is catalog data, not the mandatory source of every sale.

---

# 2. CORE BUSINESS RULE

The manager must have a reusable form:

## "Добавить услугу"

The form represents one service included in the customer's assembled offer.

The service type must be selectable from an extensible list, including at minimum:

```text
TOUR
HOTEL
FLIGHT
TRANSFER
INSURANCE
EXCURSION
CAR_RENTAL
VISA
OTHER
```

The list must NOT be hardcoded into a single UI component if the existing architecture provides a service/type registry.

The architecture must allow new service types later.

---

# 3. SERVICE FORM

The service form must support, at minimum:

```text
Service type
Service name / description
Supplier / Partner
Supplier-side reference when applicable
Product — OPTIONAL
Supplier cost
Supplier currency
Customer price
Customer currency
Source / provenance
Relevant dates
Additional service-specific information
```

The exact fields must be reconciled with existing domain models before implementation.

Do not create duplicate concepts if existing models already provide them.

---

# 4. SUPPLIER / PARTNER SELECTION

The supplier must be selected from the central Partner/Supplier directory.

IMPORTANT:

A Partner in the directory does NOT have to:

- have a Product in the TravelHUB catalog;
- have an API integration;
- appear in Storefront;
- be a catalog seller.

Examples:

```text
KOMPAS
  Partner ✓
  Catalog ✓
  Integration ✓
  Live Sales ✓

AZAL
  Partner ✓
  Integration ✓
  Live Sales ✓

Local Transfer LLC
  Partner ✓
  Catalog ✗
  Integration ✗
  Live Sales ✓

Direct Hotel
  Partner ✓
  Catalog ✗
  Integration ✗
  Live Sales ✓
```

The manager must be able to select any active eligible supplier/partner from the directory.

Do NOT make catalog Product existence a prerequisite for selecting a supplier.

---

# 5. PRODUCT IS OPTIONAL

The service builder must support both:

## Catalog service

```text
Service: Hotel
Supplier: KOMPAS
Product: Rixos Premium Dubai
productId != NULL
```

and:

## Non-catalog / Live Sales service

```text
Service: Hotel
Supplier: Hotel X
Product: none
productId = NULL
Name/description: Hotel X
Supplier reference: ...
```

Both must be valid.

Do not solve supplier identity problems by making Product mandatory.

---

# 6. SUPPLIER IDENTITY

Do NOT introduce a universal assumption that:

```text
hotelKey
```

or:

```text
hotelExternalId
```

is the TravelHUB canonical identifier.

These are supplier-specific concepts.

Different suppliers may expose the same business object under different field names:

```text
SUMMERTOUR → hotelKey
KOMPAS     → hotelKey
KAZUNION   → hotelKey
Supplier X → hotelExternalId
Supplier Y → hotelId
Supplier Z → objectId
```

TravelHUB must keep supplier-specific identity behind the appropriate adapter/integration boundary.

For the current implementation:

- do not rename or delete `hotelKey`;
- do not rename or delete `hotelExternalId`;
- do not merge them merely because current values may coincide;
- do not use either supplier-specific name as a universal business-domain contract.

If the existing architecture already has a generic supplier reference mechanism, reuse it.

If it does not, document the smallest safe abstraction required before implementation.

---

# 7. REQUEST STAGE

The Request is the workspace for customer demand and offer assembly.

The Request UI must allow:

```text
+ Добавить услугу
```

The manager can:

- add services;
- remove services;
- change supplier;
- change supplier cost;
- change customer price;
- update descriptions;
- add catalog or non-catalog services;
- assemble a package from multiple suppliers.

Example:

```text
REQUEST MKT-REQ-000301

Customer:
John Smith

Services:

1. Flight
   Supplier: AZAL
   Cost: $600
   Customer price: $700

2. Hotel
   Supplier: KOMPAS
   Cost: $900
   Customer price: $1000

3. Transfer
   Supplier: Local Transfer LLC
   Cost: $80
   Customer price: $100

4. Insurance
   Supplier: PASHA Insurance
   Cost: $40
   Customer price: $60

Total supplier cost: $1620
Total customer price: $1860
```

The Request remains editable while the commercial proposal is being negotiated.

---

# 8. REQUEST PRICING

Maintain strict separation:

```text
supplierCost
customerPrice
```

Do not overwrite supplier cost with customer price.

Do not calculate supplier cost from customer price.

Do not calculate customer price from supplier cost unless the existing TravelHUB pricing architecture explicitly requires it.

If the Supplier Markup architecture is already implemented, integrate with it rather than bypassing it.

For automatically priced supplier offers:

```text
supplier live price
    ↓
TravelHUB markup
    ↓
public/display price
    ↓
individual Live Sales discount if applicable
    ↓
customer final price
```

For manual supplier quotes/offers:

```text
supplier quote/manual cost
    ↓
manager/platform pricing
    ↓
customer price
```

Preserve price provenance.

---

# 9. CUSTOMER ACCEPTANCE

When the customer accepts the assembled offer:

```text
Request
   ↓
customer acceptance
   ↓
Order
```

Do NOT destroy the Request.

The existing lifecycle/history rules remain in force.

The accepted service composition becomes the basis for the Order.

---

# 10. ORDER STAGE

The Order is the frozen commercial truth.

The Order must preserve the accepted services.

Each accepted service becomes an Order Item or maps to the repository's existing canonical equivalent.

Each Order Item must preserve, as applicable:

```text
service type
service description
supplier / partner
supplier reference
productId — OPTIONAL
supplier cost
supplier currency
customer price
customer currency
price/source snapshot
accepted/frozen timestamp
relevant service dates
```

Historical commercial values must not be silently recalculated from current Product/catalog data.

The Order must remain valid even if:

- Product later changes;
- Product is archived;
- supplier price changes;
- supplier integration changes;
- the original catalog record disappears.

---

# 11. CUSTOMER PAYMENTS

The Order view must additionally expose a customer payment block.

Minimum conceptual information:

```text
Customer total
Paid by customer
Customer outstanding balance
Payment history
Payment status
```

Example:

```text
CUSTOMER PAYMENTS

Total due:        $1860
Paid:             $900
Outstanding:      $960

[ + Получить оплату ]

Payment history:
2026-10-01   $500   CASH
2026-10-03   $400   CARD
```

Reuse the existing Payment domain and manual/offline payment implementation.

Do NOT create a second payment system.

Use the existing server-authoritative amount rules, RBAC, reason/audit requirements, seller attribution, and PaymentHistory where already present.

---

# 12. SUPPLIER PAYMENTS

The Order must additionally expose supplier obligations/payments.

Supplier financials are separate from customer payments.

Example:

```text
SUPPLIER SETTLEMENTS

AZAL
  Supplier cost: $600
  Paid:          $600
  Outstanding:   $0

KOMPAS
  Supplier cost: $900
  Paid:          $300
  Outstanding:   $600

Transfer
  Supplier cost: $80
  Paid:          $80
  Outstanding:   $0
```

Do NOT model supplier payment as a customer payment with a different label.

The architecture must distinguish:

```text
Customer Payment
```

from:

```text
Supplier Payment / Settlement
```

Before creating a new supplier-payment entity, inspect the existing finance domain for a canonical payable/settlement mechanism and reuse it if available.

If no suitable mechanism exists, document the minimum required domain extension rather than inventing a parallel finance system.

---

# 13. PAYMENT LIFECYCLE

Payments continue after Order creation and after Booking creation.

Therefore:

```text
Booking ≠ financial completion
```

and:

```text
Order
 ├── Customer Payments
 └── Supplier Settlements
```

must remain active while the Order is operational.

Example lifecycle:

```text
Customer pays 30%
        ↓
Hotel booking created
        ↓
Supplier deposit paid
        ↓
Customer pays another 40%
        ↓
Flight ticket issued
        ↓
Supplier paid in full
        ↓
Customer pays remaining balance
```

The system must support this without recreating the Order or replacing the service form.

---

# 14. BOOKING STAGE

Booking is an operational fulfillment record for a specific Order Item/service.

Do NOT move the entire commercial service form into Booking as a new independent commercial object.

Conceptually:

```text
Order
 ├── OrderItem: Flight
 │      └── Booking
 │
 ├── OrderItem: Hotel
 │      └── Booking
 │
 ├── OrderItem: Transfer
 │      └── Booking
 │
 └── OrderItem: Insurance
        └── Booking
```

Booking must contain operational information such as:

```text
booking status
supplier reference
supplier confirmation
traveler/passenger
service dates
ticket/voucher/document references
fulfillment data
supplier communication state
```

Use existing Booking fields/statuses.

Do not duplicate financial truth unnecessarily into Booking.

---

# 15. SERVICE FORM THROUGH THE LIFECYCLE

The UI must conceptually evolve:

## Request

```text
Services
[ + Добавить услугу ]
```

Editable offer composition.

## Order

```text
Services
Customer Payments
Supplier Settlements
```

Accepted commercial composition becomes frozen/historical truth while payments continue.

## Booking

```text
Order Item
  ↓
Booking / Fulfillment
```

Operational information is added.

The commercial service data remains accessible through the Order.

Do NOT create a second independent service composition at Booking stage.

---

# 16. MULTI-SUPPLIER ASSEMBLED TOUR

The implementation MUST support one Order containing services from multiple partners.

Example:

```text
Order
 ├── Flight → AZAL
 ├── Hotel → KOMPAS
 ├── Transfer → Local Transfer LLC
 ├── Insurance → PASHA Insurance
 └── Excursion → Local Excursions
```

Each line may have:

```text
different supplier
different supplier reference
different supplier cost
different customer price
different booking state
different payment/settlement state
```

Do not assume one Order has one supplier.

---

# 17. FINANCIAL INTEGRITY

The system must be able to calculate:

```text
Total customer revenue
- Total supplier cost
= Gross commercial difference
```

Example:

```text
Customer price:  $1860
Supplier cost:   $1620
Gross difference: $240
```

This must NOT be confused with:

- Storefront seller commission;
- markup rule;
- payment status;
- booking status.

Existing `CommissionPolicy` must remain separate.

Existing Supplier Markup architecture must remain separate from realized settlement/payment state.

---

# 18. SNAPSHOTS AND HISTORICAL TRUTH

When the customer accepts the offer and the Order is created, preserve the accepted commercial snapshot.

At minimum preserve:

```text
supplier
supplier reference
supplier cost
supplier currency
customer price
customer currency
product reference if any
service description
service type
source/provenance
accepted timestamp
```

Do not later recalculate historical Order prices from live supplier/catalog data.

Supplier prices can change after the Order is created.

---

# 19. STATUS INTEGRITY

Do not introduce new lifecycle states unless the existing architecture lacks the required state.

Reuse existing:

- Request statuses
- Order statuses
- Booking statuses
- Payment statuses

Keep these concepts separate:

```text
Request status
Order status
Booking status
Customer payment status
Supplier settlement status
```

Do not infer one from another without explicit existing business rules.

---

# 20. UI REQUIREMENTS

Implement the service builder in the existing Request/Live Sales UI.

Required capabilities:

```text
+ Добавить услугу
Edit service
Remove service
Select service type
Select partner/supplier
Optional Product selection
Supplier cost
Customer price
Service details
```

The Order UI must expose:

```text
Services
Customer Payments
Supplier Settlements
```

The Booking UI must expose:

```text
Operational booking information
```

while retaining access to the Order's commercial and financial context.

Follow existing TravelHUB design system, permissions, localization, tables, modals, and responsive patterns.

Do not create a parallel UI style.

---

# 21. RBAC

Inspect existing permissions before adding new ones.

Required actions should reuse existing permissions where appropriate.

Potential capabilities include:

```text
request.read
request.manage
order.read
order.manage
payment.read
payment.manage
supplier settlement read/manage
booking.read
booking.manage
```

Do not invent duplicate permissions if equivalent permissions already exist.

If a new permission is genuinely required, document it before implementation.

---

# 22. AUDIT / HISTORY

Changes to commercial services must be auditable.

At minimum capture where existing architecture supports it:

```text
actor
timestamp
action
before
after
reason where required
```

Important transitions:

```text
service added
service removed
supplier changed
supplier cost changed
customer price changed
customer discount changed
customer accepted
Order created
customer payment recorded
supplier settlement recorded
booking created
booking status changed
```

Do not silently rewrite historical accepted values.

---

# 23. IDEMPOTENCY / DUPLICATION

The implementation must prevent:

- duplicate service lines from repeated UI submission;
- duplicate Order Items during Request → Order;
- duplicate payments;
- duplicate supplier settlements;
- duplicate bookings.

Reuse existing idempotency mechanisms.

Do not invent parallel idempotency infrastructure without checking the repository.

---

# 24. BACKWARD COMPATIBILITY

Existing catalog-based flow must continue to work:

```text
Catalog Product
  ↓
Request
  ↓
Order
  ↓
Booking
```

New Live Sales flow must work:

```text
WhatsApp / manual
  ↓
Request
  ↓
+ Add Service
  ↓
multiple suppliers
  ↓
Order
  ↓
Bookings
  ↓
ongoing payments
```

Do not break existing Storefront/catalog sales.

Do not make `productId` globally mandatory.

---

# 25. REQUIRED PRE-IMPLEMENTATION AUDIT

Before coding, inspect and report:

1. Existing Request model and UI.
2. Existing Order and OrderItem models.
3. Existing Booking model and lifecycle.
4. Existing Payment model and manual payment flow.
5. Existing supplier/partner directory.
6. Existing Product relationship.
7. Existing Quote/Sale models if present.
8. Existing Live Sales/Request flows.
9. Existing RBAC.
10. Existing snapshot/history mechanisms.

Identify what can be reused.

Do not create duplicate entities where equivalent existing entities already exist.

---

# 26. IMPLEMENTATION PHASES

## Phase 0 — Architecture discovery

Read-only inspection.

Output:
- existing entities
- existing reusable mechanisms
- gaps
- exact implementation scope

No code changes until the existing architecture is understood.

## Phase 1 — Service Builder

Implement the reusable "Добавить услугу" capability in Request/Live Sales.

Support:
- service type
- supplier/partner
- optional Product
- supplier cost
- customer price
- service snapshot

## Phase 2 — Multi-service Request

Support multiple service lines from different suppliers.

Support:
- add
- edit
- remove
- totals
- validation
- persistence
- history

## Phase 3 — Request → Order

On customer acceptance:
- preserve Request
- create/activate canonical Order
- create Order Items from accepted services
- freeze commercial snapshot
- preserve supplier/customer financial values

## Phase 4 — Order Financial Blocks

Add/reuse:
- Customer Payments
- Supplier Settlements

Ensure both remain active after Order creation.

## Phase 5 — Booking Integration

Create Booking from Order Item where required.

Do not duplicate commercial truth.

Ensure payment continuation remains possible.

## Phase 6 — Hardening

Test:
- catalog service
- non-catalog service
- multiple suppliers
- missing Product
- supplier changes
- pricing
- customer payment
- supplier settlement
- partial payment
- partial supplier payment
- booking
- repeated submissions
- lifecycle transitions
- RBAC
- historical snapshots
- regression of existing flows

---

# 27. MANDATORY TEST MATRIX

At minimum:

### Service Builder

- add catalog service
- add non-catalog service
- select supplier
- supplier without Product
- select Product
- no Product
- edit service
- remove service
- multiple services
- different suppliers

### Pricing

- supplier cost
- customer price
- different currencies if existing architecture supports them
- markup integration where applicable
- Live Sales discount
- supplier floor
- frozen accepted price

### Request → Order

- all accepted services copied
- Request preserved
- Order Items created exactly once
- Product optional
- supplier preserved
- supplier cost preserved
- customer price preserved
- snapshot preserved

### Payments

- customer payment
- multiple customer payments
- partial customer payment
- full customer payment
- supplier settlement
- partial supplier settlement
- multiple supplier settlements
- payment history
- RBAC
- idempotency

### Booking

- Order Item → Booking
- multiple bookings
- booking status changes
- payment continues after Booking
- commercial snapshot unchanged

### Regression

- existing catalog sales
- existing Request lifecycle
- existing Order lifecycle
- existing Booking lifecycle
- existing manual payment
- existing Storefront
- existing Supplier Markup
- existing CommissionPolicy

---

# 28. IMPORTANT NON-GOALS

Do NOT:

- replace Product with a new entity;
- make Product mandatory for Live Sales;
- make one supplier mandatory per Order;
- merge supplier cost with customer price;
- merge customer payments with supplier settlements;
- treat Booking as the financial endpoint;
- duplicate the commercial service form inside Booking;
- delete Request after Order creation;
- delete Order after Booking creation;
- redefine CommissionPolicy;
- bypass Supplier Markup architecture;
- use `hotelKey` or `hotelExternalId` as a universal TravelHUB identifier without architectural proof;
- introduce a new Quote/Proposal entity if existing Quote/Sale architecture already provides the required concept.

---

# 29. REQUIRED FINAL IMPLEMENTATION REPORT

Return:

## A. Architecture findings

What existing entities were reused and why.

## B. Data model changes

Exact changes.

## C. API changes

Exact endpoints/DTO changes.

## D. UI changes

Exact screens/components.

## E. Payment integration

How customer payments and supplier settlements reuse the existing finance architecture.

## F. Booking integration

How Order Items become Bookings.

## G. Snapshot/history

What is frozen and when.

## H. RBAC

Permissions used/added.

## I. Tests

Exact suite/file counts and results.

## J. Typecheck/build

Backend and frontend results.

## K. Regression

Existing flows verified.

## L. Known limitations

Anything intentionally deferred.

## M. Git safety

Do NOT commit or push unless explicitly instructed by the owner.

---

# 30. FINAL BUSINESS RULES

The implementation must preserve these rules:

1. Request is the workspace for customer demand and assembling the offer.
2. `+ Добавить услугу` allows the manager to build a package from multiple suppliers.
3. Supplier is selected from the central Partner/Supplier directory.
4. Supplier does not need to have a catalog Product or API integration.
5. Product is optional for a service.
6. One Order may contain services from many suppliers.
7. Order is the frozen commercial truth after customer acceptance.
8. Customer payments and supplier settlements are separate financial flows.
9. Payments continue after Booking.
10. Booking is operational fulfillment, not financial completion.
11. Request remains historical after Order creation.
12. Order remains historical/active after Booking.
13. Supplier cost and customer price are always separate.
14. Accepted commercial values are frozen in Order snapshots.
15. Supplier-specific identifiers such as `hotelKey` and `hotelExternalId` must not be treated as universal TravelHUB identifiers without evidence.
16. Existing Storefront commission and Supplier Markup mechanisms remain separate.
17. Existing lifecycle, RBAC, audit, payment, and booking architecture must be reused wherever possible.

# END
