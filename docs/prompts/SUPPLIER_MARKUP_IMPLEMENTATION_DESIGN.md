# TRAVELHUB — SUPPLIER MARKUP IMPLEMENTATION DESIGN

**Status:** OWNER DESIGN / PRE-IMPLEMENTATION  
**Scope:** Test suppliers only  
**Source:** `SUPPLIER_MARKUP_ARCHITECTURE_AUDIT_REPORT.md`

## 1. Commercial model

The new markup layer applies to **platform supplier integrations** registered in the supplier registries.

There is **no `isTestSupplier` flag** in the supplier registry and the implementation must not invent or search for one.

The scope boundary is defined by the supplier integration registries and the pricing key:

```text
supplierCode + serviceType
```

This is separate from the concept of real Storefront sellers, which are represented by `PartnerStorefront` and use the existing TravelHUB sales-commission model.

Pricing flow:

```text
Supplier Live Price
        ↓
TravelHUB Markup %
        ↓
Public Selling Price
        ↓
Live Sales → Individual Customer Discount
        ↓
Customer Final Price
```

Known current platform supplier integrations include Summer, Kompas, Anex, Kazunion, AZAL and Aviasales, with future integrations handled dynamically.

For `PartnerStorefront` sellers the existing **TravelHUB sales commission** remains unchanged. `CommissionPolicy`, commission accruals, commission snapshots and seller attribution are outside this change.

## 2. Dynamic capability matrix

The source of truth is the runtime supplier registration:

```text
SupplierAdapterRegistry
        +
FlightSupplierRegistry
        ↓
Supplier × Service Type
```

A new supplier or a new service registered for an existing supplier must automatically expand the matrix. Markup logic must never hardcode supplier names.

Currently confirmed supplier service types are:

- `tours`
- `hotels`
- `flights`

The additional Anex service is confirmed as `ANEX × hotels`. Future services must appear when an integration actually registers them.

## 3. MarkupRule

Create a separate master-data concept, independent of `CommissionPolicy`.

Matching key:

```text
supplierCode + serviceType
```

Lifecycle:

```text
DRAFT → ACTIVE → ARCHIVED
```

Rule must support version, effective dates, history, audit and optimistic concurrency.

Recommended stored rate:

```text
0.05 = 5%
0.07 = 7%
```

A newly discovered combination is displayed as **NOT_CONFIGURED**. Runtime behavior is 0% until an explicit rule is configured. UI must distinguish `NOT_CONFIGURED` from an explicitly configured `0%`.

## 4. Pricing formula

```text
markupAmount = supplierLivePrice × markupRate
publicPrice  = supplierLivePrice + markupAmount
```

Use existing `sales.money` arithmetic and rounding.

Markup is applied exactly once at the supplier-price → selling-price boundary.

Mandatory regression invariant:

```text
NO DOUBLE MARKUP
```

Example:

```text
supplier = 1000
markup = 5%
public = 1050
```

The implementation must not apply another 5% later in catalog read paths, Request, or Order.

## 5. Live Sales

Live Sales is channel-independent: WhatsApp, telephone, office, chat and other live communication channels use the same commercial logic.

```text
Supplier Live Price
→ Markup
→ Public Price
→ Individual Discount
→ Customer Final Price
```

Example:

```text
supplier = 1000
markup = 5%
public = 1050
discount = 30
final = 1020
```

Individual discount:

- belongs only to the specific customer/offer;
- never changes public price;
- never changes MarkupRule;
- is not exposed to other customers;
- is frozen when accepted.

## 6. Supplier price floor

Mandatory server-side invariant:

```text
Customer Final Price >= Supplier Live Price
```

Any operation violating it must be rejected. Client-side checks are not sufficient.

## 7. Frozen commercial snapshot

At customer acceptance, freeze the commercial facts required to reproduce the accepted offer:

```text
supplierCode
serviceType
supplierPrice
supplierCurrency
markupRate
markupAmount
markupRuleCode
markupRuleVersion
publicPrice
individualDiscount
discountType
discountValue
discountAmount
customerFinalPrice
customerCurrency
priceSource = PUBLIC | LIVE_SALES
pricingCalculatedAt
customerAcceptedAt
supplierPriceFetchedAt
supplierPriceExpiresAt
```

Existing `pinnedRequirements`, `productSnapshot`, traveler count and offer identifiers remain part of the commercial context.

Do not create a competing second snapshot concept.

## 8. Request → Order integrity

A Request must never become `CUSTOMER_ACCEPTED` without a valid accepted amount and currency.

Required:

1. `customerAccept` rejects missing commercial money.
2. `availableActions.convert` is false when accepted money is missing.
3. Existing Order conversion money-gate remains as defence-in-depth.
4. Guest checkout must eventually provide valid commercial pricing before conversion.
5. Supplier `amount: 0` fallbacks must not be accepted as valid commercial prices.

The known error:

```text
Request has no accepted price/currency
```

must be fixed by preventing the invalid state, not by weakening the Order gate.

## 9. Dynamic supplier price

Supplier prices are live/dynamic.

For live offers, an expired supplier price snapshot must require refresh/recheck according to the configured freshness rule.

Accepted commercial conditions remain frozen. If the supplier reprices after acceptance, do not silently mutate the accepted Request/Order; create a new commercial iteration if renegotiation is needed.

Do not invent an FX subsystem in this implementation. Markup is calculated in the supplier offer currency. Currency conversion, if required elsewhere, remains a separate concern.

## 10. Flights

AZAL and Aviasales are supported structurally as:

```text
AZAL + flights
Aviasales + flights
```

Flights have a **separate application path** and must not be assumed to pass through `supplier-aggregator`.

Current AZAL flow includes:

```text
POST /supplier/azal/search
        ↓
FlightSupplierRegistry fan-out
```

and therefore Phase 2 must cover both flight pricing boundaries:

1. markup during normalization of the FlightSupplier fan-out search response;
2. markup during `POST /supplier/azal/request`.

### Flight request price authority

The flight request path must not trust a client-supplied `displayedPrice`.

The implementation must replace the current client-derived value:

```text
displayedPrice = body.price
```

with a server-authoritative value derived from the supplier flight price and the applicable MarkupRule.

The client may identify/select the flight and provide request parameters, but it must not determine the commercial selling price.

Do not invent unsupported `refreshPrice` or availability behavior for `FlightSupplier`. Respect its existing interface.

## 11. Static catalogue

If an existing sync writes public selling prices into Tariff, it must use the same centralized pricing calculation.

The catalog read path must never apply markup again.

Future reconciliation between live supplier prices and static `priceFrom` may be a separate hardening phase.

## 12. Permissions and audit

Recommended new permissions:

```text
pricing.markup.read
pricing.markup.manage
```

For individual discounts either introduce `sales.discount.grant` or explicitly approve an existing sales permission.

Every new permission must be declared in the canonical `PERMISSIONS` registry.

Markup rule mutations require audit/history and version/CAS protection. Conflicting active rules must produce a conflict rather than two active overlapping rules.

## 13. Implementation phases

### Phase 1 — Foundation
- `MarkupRule` + history
- permissions
- rule service
- pricing resolve/apply service
- CAS/audit
- unit tests

### Phase 2 — Supplier price integration
Connect centralized markup calculation to every actual supplier-price boundary.

For tour/hotel paths, cover the applicable Universal Search, refresh and supplier sync paths.

For flights, explicitly cover both independent FlightSupplier paths:

```text
POST /supplier/azal/search
    → FlightSupplierRegistry fan-out
    → server-side markup during response normalization

POST /supplier/azal/request
    → server-side markup / authoritative displayedPrice
```

Do not assume flights pass through `supplier-aggregator`.

Tests:
- correct markup
- zero markup
- NOT_CONFIGURED
- automatic matrix expansion
- no double markup
- flight search markup
- flight request markup
- client cannot override flight displayed price

### Phase 3 — Request snapshot and gates
Implement supplier-price and markup snapshot, public price, individual discount, source and freshness.

Acceptance must reject:

```text
supplierPrice <= 0
missing supplier price
missing currency
invalid final price
final price < supplier price
```

No accepted commercial snapshot may contain a zero or negative supplier base.

Add acceptance and convert-action money gates without weakening Order conversion validation.

For flight requests, `displayedPrice` must be server-derived from the supplier-side selected flight price plus the applicable markup. A client-supplied price must never become the accepted commercial amount.

### Phase 4 — Admin matrix and Live Sales
Implement dynamic matrix, rule editing and individual discount flow.

The admin markup UI must use only the new:

```text
pricing.markup.read
pricing.markup.manage
```

permissions and its own pricing endpoints/services.

It must not depend on the existing `supplier.controller` permissions.

The audit identified undeclared `supplier.search.*` permissions that fail closed with 403; the markup matrix must not inherit that defect.

Also remove relevant hardcoded supplier/service presentation lists, including `SUPPLIER_LABELS` and hardcoded flight options, in favor of the runtime supplier/capability registry where applicable.

### Phase 5 — Sync and hardening
Address:

- zero-price fallbacks;
- stale prices;
- static-price reconciliation;
- misleading copy;
- relevant hardcoded supplier/service lists not removed in Phase 4;
- removal of the debug artifact `D:\travelhub_v1\backend_price_chain.log`.

Zero/invalid supplier-price fallbacks must not be allowed to become commercial prices even before this phase; Phase 3 acceptance gates are the safety boundary.

### Phase 6 — Final hardening
Run backend/frontend/e2e, RBAC, concurrency, idempotency, pricing and Storefront commission regression suites.

## 14. Mandatory invariants

```text
new supplier → capability appears automatically
new supplier service → capability appears automatically

publicPrice = supplierPrice + markupAmount

finalPrice = publicPrice - individualDiscount

finalPrice >= supplierPrice

individualDiscount does not alter publicPrice

MarkupRule != CommissionPolicy

accepted price is frozen

missing accepted money → no Order conversion

markup is applied exactly once

changing MarkupRule does not change already accepted Request/Order
```

## 15. Explicit non-goals

This work does not:

- replace Storefront seller commissions;
- modify `CommissionPolicy`;
- redesign finance commission accounting;
- create a new commerce engine;
- introduce FX;
- redesign supplier adapters;
- invent new service types;
- make WhatsApp a special commerce channel;
- allow selling below supplier price;
- remove existing Order money gates;
- implement Booking → Order lifecycle.

## 16. Approval boundary

Target architecture:

```text
Supplier Capability Registry
        ↓
Supplier × Service Type
        ↓
MarkupRule
        ↓
Supplier Live Price
        ↓
Public Price
        ↓
Live Sales Individual Discount
        ↓
Customer Final Price
        ↓
Frozen Commercial Snapshot
        ↓
Request
        ↓
Order
```

The existing Storefront seller commission remains a separate untouched subsystem.

This document is an implementation-design baseline. A separate strict implementation prompt must be issued before code changes, migrations, commit or push.
