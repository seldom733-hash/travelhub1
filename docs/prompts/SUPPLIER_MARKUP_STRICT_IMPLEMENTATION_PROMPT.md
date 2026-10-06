# TRAVELHUB — SUPPLIER MARKUP STRICT IMPLEMENTATION PROMPT

**Document type:** Strict developer implementation prompt  
**Status:** APPROVED FOR IMPLEMENTATION  
**Baseline:** `SUPPLIER_MARKUP_IMPLEMENTATION_DESIGN.md`  
**Scope:** Supplier pricing / TravelHUB Markup  
**Repository:** `seldom733-hash/travelhub1`  
**Branch:** `master`

---

# 0. EXECUTION CONTRACT

Implement the approved **«Наценка TravelHUB»** architecture exactly as specified below.

This is an implementation task, not a redesign task.

The implementation must:

- inspect the current repository before modifying anything;
- preserve existing working behavior outside the approved scope;
- keep Storefront seller commission completely separate;
- use existing supplier registries as the capability source;
- use server-authoritative pricing;
- never trust client-provided commercial prices;
- never apply markup twice;
- never allow a final customer price below the supplier price;
- never accept zero/negative supplier price as commercial money;
- preserve accepted historical pricing;
- add tests and evidence for every mandatory invariant.

Do **not** invent APIs, interfaces, supplier methods, permissions, enums, or registry concepts that do not exist or are not explicitly authorized below.

Do **not** implement Booking → Order in this task.

Do **not** modify `CommissionPolicy` to implement Markup.

Do **not** commit or push until all implementation and verification gates in this prompt pass.

---

# 1. APPROVED BUSINESS MODEL

The new pricing layer applies to platform supplier integrations registered in the supplier registries.

There is **no `isTestSupplier` flag**.

Do not create one.

The pricing scope is defined by:

```text
supplier registry
+
service capability
+
supplierCode + serviceType
```

Current platform supplier integrations include:

```text
SUMMERTOUR
KOMPAS
ANEX
KAZUNION
AZAL
AVIASALES
```

and future registered suppliers.

Storefront sellers are a separate concept represented by `PartnerStorefront`.

Existing Storefront seller commission remains untouched.

---

# 2. COMMERCIAL FLOW

The approved flow is:

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
        ↓
Frozen Commercial Snapshot
        ↓
Request
        ↓
Order
```

Formula:

```text
markupAmount = supplierLivePrice × markupRate

publicPrice = supplierLivePrice + markupAmount
```

Individual discount:

```text
customerFinalPrice = publicPrice - discountAmount
```

Mandatory invariant:

```text
customerFinalPrice >= supplierLivePrice
```

---

# 3. NON-GOALS

Do NOT:

- replace Storefront seller commissions;
- modify `CommissionPolicy`;
- redesign finance commission accounting;
- introduce an FX subsystem;
- redesign supplier adapters beyond the exact pricing integration required;
- invent supplier capabilities;
- make WhatsApp a special pricing/business object;
- allow selling below supplier price;
- weaken existing Order conversion money gates;
- implement Booking → Order;
- create `isTestSupplier`;
- trust client-side commercial price fields;
- introduce a `refreshPrice` method to `FlightSupplier`.

---

# 4. MANDATORY PRE-FLIGHT REPOSITORY INSPECTION

Before changing code, inspect and document the actual current implementation of:

1. `SupplierAdapterRegistry`
2. `FlightSupplierRegistry`
3. supplier adapter registrations
4. `supplier-aggregator`
5. Universal Search pricing path
6. supplier `refreshPrice` paths
7. supplier sync/Tariff paths
8. Request price fields and acceptance
9. Request `availableActions`
10. Request → Order conversion
11. existing money utilities under `sales.money`
12. `CommissionPolicy`
13. `PERMISSIONS`
14. existing discount primitives
15. AZAL controller
16. flight types:
   - `FlightSearchResult`
   - `FlightPrice`
17. all existing supplier/service hardcoded lists
18. `SUPPLIER_LABELS`
19. hardcoded flight options
20. `D:\travelhub_v1\backend_price_chain.log`

Do not assume file names from this prompt if the repository has moved code. Locate the real implementation first.

Create a concise preflight evidence section in the final report.

---

# 5. SUPPLIER CAPABILITY SOURCE OF TRUTH

The implementation must use:

```text
SupplierAdapterRegistry
+
FlightSupplierRegistry
```

as the runtime source for supplier/service capabilities.

Current service types confirmed by the approved audit:

```text
tours
hotels
flights
```

Known matrix examples:

```text
SUMMERTOUR + tours
KOMPAS     + tours
ANEX       + tours
ANEX       + hotels
KAZUNION   + tours
AZAL       + flights
AVIASALES  + flights
```

Do not hardcode these into the pricing matrix.

The matrix must expand automatically when a new registered supplier or service capability appears.

Do not use the CRM `Supplier` model as a substitute for supplier integration registry data unless the current architecture explicitly requires it for an existing unrelated purpose.

---

# 6. MARKUP RULE MASTER DATA

Introduce a separate `MarkupRule` concept.

It must NOT be implemented through `CommissionPolicy`.

The rule must support, as applicable to the existing persistence architecture:

```text
code
supplierCode
serviceType
rate
status
version
effectiveFrom
effectiveTo
created/updated metadata
history
```

Lifecycle:

```text
DRAFT → ACTIVE → ARCHIVED
```

Rate representation:

```text
0.05 = 5%
```

not:

```text
5
```

The implementation must enforce one valid active rule for a given:

```text
supplierCode + serviceType
```

and must prevent overlapping active/effective rules according to the chosen schema constraints/service validation.

Historical rule versions must remain reproducible.

---

# 7. NOT_CONFIGURED

A newly discovered supplier/service combination must be distinguishable from an explicit 0% rule.

Required states:

```text
NOT_CONFIGURED
0%
5%
...
```

Runtime behavior:

```text
NOT_CONFIGURED → effective markup 0%
```

Do not silently present `NOT_CONFIGURED` as if an explicit 0% rule had been configured.

The admin UI must visibly distinguish them.

---

# 8. CENTRAL PRICING SERVICE

Create/use one centralized pricing service responsible for resolving and applying markup.

Conceptually:

```text
SupplierPricingService.resolve(...)
SupplierPricingService.apply(...)
```

Use the existing money calculation primitives under:

```text
sales.money
```

Do not introduce a second money arithmetic implementation.

The service must return enough structured information to preserve:

```text
supplierPrice
supplierCurrency
markupRate
markupAmount
publicPrice
markupRuleCode
markupRuleVersion
configuration state
```

The exact class/module names may follow repository conventions, but the architecture must remain centralized.

---

# 9. NO DOUBLE MARKUP

Markup must be applied exactly once.

Mandatory invariant:

```text
supplier price
    ↓
ONE markup calculation
    ↓
public price
```

Do not independently apply markup in:

- aggregator;
- refresh;
- sync;
- catalog read;
- Request;
- Order.

If multiple paths need the selling price, they must use the same pricing service or carry an explicitly identified already-calculated price.

Mandatory regression test:

```text
supplier = 1000
markup = 5%

expected public = 1050
```

The implementation must prove that a second processing step does not produce:

```text
1102.50
```

---

# 10. PUBLIC PRICE

Public price is:

```text
supplierLivePrice + markupAmount
```

Example:

```text
supplier = 1000
markup = 5%
markupAmount = 50
public = 1050
```

Public price is not TravelHUB commission.

Do not merge these concepts.

---

# 11. LIVE SALES / INDIVIDUAL DISCOUNT

Live Sales is channel-independent.

It can originate from:

- WhatsApp;
- phone;
- office;
- chat;
- other live communication.

Do not introduce channel-specific pricing logic.

Flow:

```text
Supplier Live Price
→ Markup
→ Public Price
→ Individual Discount
→ Customer Final Price
```

Individual discount:

- belongs to the specific customer/offer;
- does not modify Public Price;
- does not modify MarkupRule;
- does not become a global rule;
- must be calculated server-side;
- must be frozen when accepted.

Reuse existing discount primitives where compatible.

---

# 12. SUPPLIER PRICE FLOOR

Mandatory server-side invariant:

```text
customerFinalPrice >= supplierPrice
```

Reject any operation that violates it.

Also reject:

```text
supplierPrice <= 0
```

as a commercial price.

Do not allow:

```text
0
negative
missing
NaN
invalid currency
```

to become an accepted commercial snapshot.

Client-side validation is not authoritative.

---

# 13. REQUEST ACCEPTANCE GATE

`customerAccept` must not create an accepted Request without valid commercial money.

Required acceptance conditions include:

```text
supplierPrice > 0
currency present
public price valid
final customer price valid
final customer price >= supplier price
```

If any condition fails:

```text
reject
```

Do not create an accepted snapshot.

Do not weaken existing downstream gates.

---

# 14. CONVERT ACTION GATE

`availableActions.convert` must reflect the same commercial-money predicate.

If accepted money is missing or invalid:

```text
convert = false
```

The UI must not advertise an action that is guaranteed to fail.

Existing Order conversion validation remains mandatory defence-in-depth.

---

# 15. FLIGHT ARCHITECTURE — CRITICAL

Flights do NOT necessarily pass through `supplier-aggregator`.

The approved audit establishes a separate path:

```text
POST /supplier/azal/search
        ↓
FlightSupplierRegistry fan-out
```

Therefore Phase 2 MUST implement markup in the actual flight fan-out response normalization path.

Do not route flights through an invented aggregator path.

---

# 16. FLIGHT SEARCH MARKUP

For:

```text
POST /supplier/azal/search
```

the implementation must:

1. obtain the authoritative supplier flight price;
2. resolve the applicable:

```text
AZAL + flights
```

MarkupRule;
3. calculate markup exactly once;
4. expose the resulting selling/display price;
5. preserve supplier price separately.

The client must not become the source of supplier price.

---

# 17. FLIGHT REQUEST PRICE AUTHORITY — CRITICAL

The existing AZAL request path includes a client-provided:

```text
displayedPrice: body.price
```

This must no longer be authoritative.

The implementation MUST ensure:

```text
client body.price
        ≠
server commercial price authority
```

The client may select a flight and send request parameters, but the commercial displayed/accepted price must be derived server-side from the supplier-side selected flight price and applicable MarkupRule.

Mandatory test:

```text
client supplies manipulated body.price
        ↓
server ignores it for commercial calculation
        ↓
server derives authoritative price
```

A manipulated client price must never lower or otherwise arbitrarily redefine the accepted supplier/selling price.

---

# 18. FLIGHT FRESHNESS — CRITICAL

`FlightSupplier` does NOT have `refreshPrice`.

Do NOT create or invent:

```text
FlightSupplier.refreshPrice()
```

Flight freshness must use the existing flight search model.

The approved source is:

```text
FlightSearchResult.collectedAt
```

and:

```text
FlightPrice = { amount, currency }
```

Therefore:

```text
supplierPriceFetchedAt = FlightSearchResult.collectedAt
```

must be recorded in the commercial snapshot.

When the flight price is older than the configured TTL:

```text
re-search
```

must be performed.

Do NOT attempt to refresh the flight by calling a nonexistent `refreshPrice`.

The freshness mechanism must be:

```text
search
→ collectedAt
→ TTL evaluation
→ re-search if expired
→ use new supplier price
```

---

# 19. FLIGHT REQUEST FRESHNESS

At flight request/acceptance:

1. identify the selected flight;
2. determine its `collectedAt`;
3. evaluate TTL;
4. if fresh, use the authoritative search result;
5. if stale, re-search;
6. obtain current supplier-side amount/currency;
7. calculate markup;
8. validate floor;
9. freeze the resulting commercial snapshot.

The implementation must not use stale client-provided price as a substitute.

---

# 20. PRICE SNAPSHOT

Freeze, at minimum:

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
supplierPriceFetchedAt
supplierPriceExpiresAt
customerAcceptedAt
```

Also preserve existing commercial context required to reproduce the offer:

```text
pinnedRequirements
productSnapshot
travelerCount
supplier offer identifiers
```

Do not create a competing second snapshot architecture.

---

# 21. SNAPSHOT IMMUTABILITY

Once commercial terms are accepted:

```text
Request/Order accepted price
```

must not change merely because:

- MarkupRule changes;
- supplier price changes later;
- a new rule version becomes active.

A new commercial negotiation must produce a new accepted pricing state.

Historical Orders must remain reproducible.

---

# 22. CURRENCY

Do not introduce FX.

Markup calculation occurs in the supplier offer currency:

```text
supplier currency
=
markup calculation currency
=
public price currency
```

If an existing customer-facing flow performs currency conversion, keep that as a separate explicit concern.

Do not silently convert inside MarkupRule.

---

# 23. PERMISSIONS

Create/use only declared canonical permissions:

```text
pricing.markup.read
pricing.markup.manage
```

If individual discount authority needs a separate permission, use:

```text
sales.discount.grant
```

only if it is actually added to the canonical permission registry and fits the repository's RBAC conventions.

Do NOT make the admin markup UI depend on:

```text
supplier.search.*
```

The audit established that these existing permission identifiers are undeclared and can produce fail-closed 403 behavior.

The new pricing admin endpoints must use the new pricing permissions.

---

# 24. ADMIN MATRIX

The admin matrix must be dynamically generated from runtime supplier capabilities.

Conceptually:

```text
             tours   hotels   flights
Summer         5%       —        —
Kompas         7%       —        —
Anex           6%       5%       —
Kazunion       5%       —        —
AZAL            —       —        3%
Aviasales       —       —        2%
```

Do not hardcode rows/columns.

Use:

```text
supplier registry
+
capabilities
```

The UI must distinguish:

```text
NOT_CONFIGURED
0%
configured %
```

---

# 25. HARDcoded SUPPLIER LIST CLEANUP

During Phase 4, locate and replace relevant presentation-only hardcoded supplier/service lists with registry-driven data.

Explicitly inspect:

```text
SUPPLIER_LABELS
hardcoded flight options
```

Do not create a new duplicate supplier list while removing an old one.

Only change unrelated UI where it is directly part of this approved capability-matrix cleanup.

---

# 26. TARIFF / STATIC CATALOG

If the repository writes public selling prices to Tariff/static catalogue:

```text
Supplier Price
→ centralized markup
→ stored public price
```

must be used.

The catalog read path must not apply markup a second time.

Do not blindly add markup to a price that is already marked up.

---

# 27. ZERO-PRICE FALLBACKS

The audit identified supplier paths that can use:

```text
amount: 0
```

when an offer is not found.

The implementation must not interpret this as a valid commercial price.

Phase 3 provides the safety boundary:

```text
supplierPrice <= 0 → reject
```

Phase 5 must additionally remove/replace inappropriate zero-price fallbacks where the supplier contract permits a correct unavailable/not-found representation.

Preferred semantic outcome:

```text
PRICE_UNAVAILABLE / NOT_FOUND
```

rather than:

```text
0
```

Do not invent a new supplier error enum if the existing architecture already has an appropriate unavailable representation.

---

# 28. DEBUG LOG CLEANUP

Phase 5 must inspect and remove the debug artifact:

```text
D:\travelhub_v1\backend_price_chain.log
```

Do not leave development-only pricing debug logging in the final implementation unless explicitly justified and controlled by the existing logging architecture.

---

# 29. IMPLEMENTATION PHASES

## PHASE 0 — Preflight / Baseline

Before code changes:

- inspect repository;
- identify actual modules;
- identify current schema;
- identify current permissions;
- identify existing money/discount utilities;
- identify supplier price boundaries;
- identify flight paths;
- identify Request acceptance/conversion;
- record baseline test results.

Do not modify code during baseline inspection.

---

## PHASE 1 — Pricing Foundation

Implement:

- MarkupRule persistence;
- status/version/effective period;
- history/audit;
- canonical permissions;
- centralized pricing service;
- money calculation;
- rule resolution;
- NOT_CONFIGURED semantics;
- concurrency protection.

Tests:

- 0.05 representation;
- active rule resolution;
- NOT_CONFIGURED;
- explicit 0%;
- rule conflicts;
- history;
- authorization;
- stale-version conflict.

---

## PHASE 2 — Supplier Price Integration

Connect centralized markup to all real supplier pricing boundaries.

### Tours/hotels

Cover applicable:

- Universal Search;
- refresh paths;
- supplier sync paths.

### Flights

Explicitly cover:

```text
POST /supplier/azal/search
```

through:

```text
FlightSupplierRegistry fan-out
→ response normalization
→ markup
```

and:

```text
POST /supplier/azal/request
→ authoritative supplier-side price
→ markup
→ authoritative displayedPrice
```

Do not assume flights use `supplier-aggregator`.

Tests:

- correct markup;
- zero markup;
- NOT_CONFIGURED;
- automatic matrix expansion;
- no double markup;
- flight search markup;
- flight request markup;
- client cannot override flight displayed price.

---

## PHASE 3 — Commercial Snapshot and Gates

Implement:

- supplier price snapshot;
- supplier currency;
- markup snapshot;
- public price;
- individual discount;
- final price;
- source;
- freshness;
- accepted timestamp.

Acceptance must reject:

```text
supplierPrice <= 0
missing supplier price
missing currency
invalid public price
invalid final price
final < supplier
```

Add/verify:

```text
customerAccept
availableActions.convert
Order conversion
```

Do not weaken Order conversion validation.

### Flight-specific Phase 3 requirement

Use:

```text
supplierPriceFetchedAt = FlightSearchResult.collectedAt
```

and TTL-based re-search.

Do not introduce `FlightSupplier.refreshPrice`.

Flight request displayed price must be server-derived.

---

## PHASE 4 — Admin Matrix and Live Sales

Implement:

- dynamic Supplier × Service Type matrix;
- MarkupRule management;
- pricing RBAC;
- NOT_CONFIGURED UI;
- individual discount flow;
- server-side floor validation;
- Request → Order propagation.

The admin UI must use:

```text
pricing.markup.read
pricing.markup.manage
```

and not depend on `supplier.search.*`.

Remove relevant hardcoded:

```text
SUPPLIER_LABELS
flight options
supplier/service options
```

where they are part of the approved matrix cleanup.

---

## PHASE 5 — Hardening / Reconciliation

Address:

- zero-price fallbacks;
- stale supplier prices;
- static catalogue reconciliation;
- misleading pricing copy;
- remaining directly relevant hardcoded supplier lists;
- `D:\travelhub_v1\backend_price_chain.log`.

Ensure no new zero-price fallback can bypass Phase 3 gates.

---

## PHASE 6 — Final Verification

Run all relevant:

- backend unit tests;
- backend integration tests;
- frontend tests;
- e2e tests;
- RBAC tests;
- pricing tests;
- flight pricing tests;
- Request acceptance tests;
- Order conversion tests;
- concurrency tests;
- idempotency tests;
- Storefront commission regression tests.

---

# 30. MANDATORY TEST MATRIX

At minimum, prove:

### Rule resolution

```text
configured 5%
configured 0%
NOT_CONFIGURED
new supplier
new service
```

### Calculation

```text
1000 × 5% = 50
public = 1050
```

### Floor

```text
supplier 1000
public 1050
discount 30
final 1020 → PASS
```

```text
supplier 1000
public 1050
discount 60
final 990 → REJECT
```

### Invalid supplier price

```text
0 → REJECT
negative → REJECT
missing → REJECT
```

### No double markup

```text
1000 → 1050
not → 1102.50
```

### Flight

```text
search result
→ collectedAt
→ markup
→ displayed/public price
```

```text
client body.price manipulated
→ ignored as commercial authority
```

```text
TTL expired
→ re-search
→ new supplier price
```

### Snapshot

Changing the active MarkupRule after acceptance must not mutate accepted Request/Order pricing.

### Storefront commission

Existing commission tests remain green and `CommissionPolicy` behavior is unchanged.

---

# 31. SECURITY REQUIREMENTS

The server is authoritative for:

- supplier price;
- markup rate;
- markup amount;
- public price;
- individual discount calculation;
- final price;
- floor validation;
- accepted snapshot.

Never trust client-provided:

```text
displayedPrice
supplierPrice
markupAmount
publicPrice
finalPrice
```

where the server can derive them from authoritative data.

Client fields may identify a selected product/flight or request parameters, but not override commercial authority.

---

# 32. IDEMPOTENCY / CONCURRENCY

Where existing mutation endpoints support idempotency, preserve it.

Markup rule mutations must be protected against stale concurrent updates.

Repeated acceptance/conversion must not create contradictory pricing snapshots.

Repeated flight requests must not accept a stale manipulated client price.

---

# 33. STORE FRONT COMMISSION REGRESSION

Mandatory:

```text
MarkupRule
    ≠
CommissionPolicy
```

Do not alter:

- seller commission semantics;
- commission rates;
- commission snapshots;
- accrual behavior;
- seller attribution.

If markup increases an Order's commercial amount and therefore indirectly changes a commission amount calculated from that Order, that is an expected downstream effect. The commission mechanism itself must remain unchanged.

---

# 34. NO SILENT ARCHITECTURAL CHANGES

If implementation discovers that the repository cannot support a requirement exactly as written:

1. stop at the affected boundary;
2. document the conflict;
3. do not invent a substitute architecture;
4. do not silently weaken the invariant;
5. report the exact file/module/schema conflict.

Do not proceed by guessing.

---

# 35. FINAL ACCEPTANCE GATES

Implementation is accepted only if all are true:

### Gate A — Dynamic registry

```text
new supplier capability
→ automatically visible in pricing matrix
```

### Gate B — Rule isolation

```text
MarkupRule separate from CommissionPolicy
```

### Gate C — Single calculation

```text
markup applied exactly once
```

### Gate D — Floor

```text
final >= supplier
```

### Gate E — Invalid money

```text
supplier <= 0 → never accepted
```

### Gate F — Snapshot

```text
accepted price is immutable
```

### Gate G — Request

```text
no valid commercial money
→ no CUSTOMER_ACCEPTED
→ no convert action
```

### Gate H — Flights

```text
search fan-out markup works
request markup works
client price cannot override
```

### Gate I — Flight freshness

```text
collectedAt stored
TTL expiry → re-search
no FlightSupplier.refreshPrice invented
```

### Gate J — RBAC

```text
pricing.markup.*
declared and enforced
```

### Gate K — Storefront

```text
existing CommissionPolicy behavior unchanged
```

### Gate L — Hardening

```text
debug artifact removed
relevant hardcoded pricing/supplier presentation lists removed
```

---

# 36. STOP CONDITIONS

Stop and report instead of improvising if:

- a required model does not exist and schema semantics are ambiguous;
- supplier registry cannot provide a capability without introducing unsupported behavior;
- flight authoritative price cannot be obtained from the existing flight search architecture;
- an existing endpoint has incompatible semantics that cannot safely be changed under this scope;
- a migration would destroy historical pricing data;
- an existing commission test would require changing CommissionPolicy;
- a permission cannot be declared consistently with the repository's RBAC architecture;
- a required supplier operation would require inventing an API such as `FlightSupplier.refreshPrice`.

---

# 37. REQUIRED FINAL REPORT

At completion, produce:

## A. Changed files

List every changed file.

## B. Schema

List:

- migrations;
- new/changed tables;
- indexes;
- constraints;
- historical/version fields.

## C. APIs

List:

- new endpoints;
- changed endpoints;
- request/response behavior;
- authorization.

## D. Pricing flow

Show:

```text
supplier
→ markup
→ public
→ individual discount
→ final
→ snapshot
```

for both:

```text
tour/hotel
flight
```

## E. Flight authority

Explicitly prove:

```text
body.price
```

is not the commercial authority.

## F. Flight freshness

Explicitly prove:

```text
FlightSearchResult.collectedAt
→ supplierPriceFetchedAt
→ TTL
→ re-search
```

and confirm no `FlightSupplier.refreshPrice` was introduced.

## G. Tests

Report:

- baseline;
- added;
- final;
- failures;
- exact regression results.

## H. Mandatory invariants

Provide evidence for every Gate A–L.

## I. Known limitations

Only list genuine remaining limitations.

## J. Git state

Report:

```text
branch
HEAD
working tree
commit
push
```

Do not commit or push until all gates pass.

---

# 38. FINAL IMPLEMENTATION PRINCIPLE

The implementation must preserve this exact architecture:

```text
Supplier Capability Registry
        ↓
Supplier × Service Type
        ↓
MarkupRule
        ↓
Authoritative Supplier Live Price
        ↓
ONE Markup Calculation
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

For flights:

```text
FlightSupplierRegistry
        ↓
Flight Search
        ↓
FlightSearchResult.collectedAt
        ↓
TTL
        ↓
re-search if stale
        ↓
Authoritative FlightPrice
        ↓
ONE Markup Calculation
        ↓
Server-authoritative displayedPrice
        ↓
Frozen Commercial Snapshot
```

The existing Storefront seller commission remains a separate untouched subsystem.

**Do not implement beyond this scope. Do not invent missing APIs. Do not trust client commercial prices. Do not apply markup twice. Do not allow supplierPrice <= 0. Do not introduce `isTestSupplier`. Do not introduce `FlightSupplier.refreshPrice`. Do not implement Booking → Order.**
