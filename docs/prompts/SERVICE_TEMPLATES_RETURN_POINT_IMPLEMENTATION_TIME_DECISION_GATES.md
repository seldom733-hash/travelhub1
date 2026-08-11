# SERVICE TEMPLATES RETURN POINT --- IMPLEMENTATION-TIME DECISION GATES --- STRICT RESOLUTION

**Project:** TravelHub\
**Mode:** ARCHITECTURE / ROADMAP DECISION GATE --- DOCUMENTATION ONLY\
**Previous approved item:**
`PHASE 2 STEP 2.2F STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`\
**Canonical NEXT:** `Service Templates return point (conditional)`\
**Implementation in this pass:** FORBIDDEN\
**Goal:** resolve the implementation-time gates required before Steps
1.8A--1.8D.

------------------------------------------------------------------------

## 1. Mission

Resolve, against the actual repository and approved architecture, the
Service Templates / Period Pricing & Availability implementation-time
gates identified by the canonical execution sequence:

-   DD-025 / Step 1.8A --- Seller service-unit identity and
    `CategorySchema` nesting/repeatability;
-   DD-024 / Step 1.8B --- existing `Tariff` vs canonical Rate Plan
    semantics;
-   DD-026 / Step 1.8C --- period pricing temporal semantics, price
    basis, occupancy/PAX dimensions, overlap and precedence;
-   DD-027 / Step 1.8C --- availability granularity and multi-date
    atomic holds;
-   DD-028 --- taxonomy ownership;
-   DD-029 --- multi-currency display/authority.

This is a **decision-resolution pass**, not implementation.

Do not create schema, migrations, backend/frontend code, APIs, UI,
pricing engine, availability engine or import subsystem.

The output must leave Steps 1.8A--1.8D implementable without reopening
fundamental semantics.

------------------------------------------------------------------------

## 2. Baseline

Record:

-   branch;
-   HEAD;
-   git status;
-   current migration count/status;
-   Roadmap active item;
-   status of 2.2F;
-   status of DD-024...DD-029;
-   existing Service Templates / Period Pricing amendment status;
-   any Universal Pricing / seller-pricing amendment already present in
    Roadmap.

Do not overwrite unrelated dirty work.

------------------------------------------------------------------------

## 3. Mandatory sources

Inspect repository truth, at minimum:

-   `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
-   `CURRENT CANONICAL EXECUTION SEQUENCE`;
-   `TRAVELHUB_DEFERRED_DECISIONS_MAP.md`;
-   Service Templates / Period Pricing & Availability amendment;
-   Universal Pricing / seller-pricing amendment if present;
-   ADR-0001;
-   ADR-0005;
-   ADR-0007 where acquisition/publication distinction matters;
-   Step 2.4 availability reservation architecture;
-   Step 2.5 Order snapshot contract;
-   Step 2.5B acquisition propagation where relevant;
-   `schema.prisma`;
-   Category / CategorySchema;
-   Product;
-   Tariff;
-   Availability;
-   AvailabilityReservation;
-   Quote / QuoteItem;
-   CheckoutIntent;
-   Sale;
-   Order / OrderItem;
-   Partner/Catalog ownership docs;
-   Marketplace/Partner Cabinet roadmap sections;
-   IDs/events/API contracts only where affected by decisions.

Repository truth wins over previous prose.

------------------------------------------------------------------------

# PART A --- GLOBAL COMMERCIAL MODEL

## 4. Hard invariants

Preserve:

1.  `Template defines structure; Seller provides values`.
2.  Seller-defined commercial names are preserved verbatim.
3.  TravelHub standardizes attributes, not seller naming.
4.  Physical/service unit ≠ commercial Rate Plan.
5.  Pricing ≠ Availability ≠ Reservation/Hold.
6.  Catalog owns product/service commercial inventory.
7.  Sales/Order/Booking do not become inventory owners.
8.  Existing Step 2.4 hold engine remains the only reservation/hold
    engine.
9.  Binding commercial facts freeze at canonical Quote/Checkout/Sale
    boundaries according to existing architecture.
10. Later Catalog price changes never mutate frozen downstream
    commercial facts.
11. Seller capability ≠ live inventory.
12. No fabricated future price.
13. No mandatory long-range forecast.
14. Server is authoritative for price and availability resolution.
15. Frontend-only pricing logic is forbidden.

If a proposed decision breaks one of these, stop with
`ARCHITECTURE DECISION REQUIRED`.

------------------------------------------------------------------------

# PART B --- DD-025 / STEP 1.8A

## 5. Determine whether CategorySchema can support Seller service units

Inspect the actual Category/CategorySchema model.

Determine whether it can safely express category-specific
nested/repeatable commercial units, for example:

-   Hotel → Room Types;
-   Tour → package/service variants;
-   Transfer → vehicle/service variants;
-   Car Rental → vehicle classes;
-   Excursion → ticket/service variants;
-   other categories without hardcoding Hotel assumptions.

The required conceptual behavior:

`Category template → Seller creates/imports own named service unit → TravelHub stores normalized attributes + preserves seller name`

Example:

Seller name: `Premium Double Ocean Side`

Normalized structure may contain: - occupancy; - bed type; - view; -
room class; - size; - amenities.

The original name remains unchanged.

### Decide DD-025

Choose and document one:

**A. EXTEND CategorySchema**\
Existing CategorySchema is the canonical foundation and can be safely
extended for nested/repeatable seller units.

**B. NEW CATALOG CONCEPT REQUIRED**\
CategorySchema cannot safely represent unit identity/lifecycle and a
distinct Catalog-owned service-unit concept is required.

Do not choose B merely for elegance. Prefer extension if existing
architecture supports it cleanly.

If B changes bounded-context architecture materially, require a formal
ADR before 1.8A implementation.

------------------------------------------------------------------------

## 6. Seller unit identity

Resolve:

-   what constitutes a persistent Seller commercial/service unit;
-   whether it needs its own stable business identity;
-   relationship to Product;
-   relationship to CategorySchema;
-   relationship to Rate Plan/Tariff;
-   whether seller unit names are mutable;
-   whether normalized attributes are versioned with schema;
-   behavior when CategorySchema version changes;
-   whether old published units remain readable;
-   how moderation/publication applies.

Do not assign a new ID prefix unless actual implementation will require
a distinct business entity. If ID naming is premature, explicitly defer
only the identifier while resolving semantics.

------------------------------------------------------------------------

# PART C --- DD-024 / STEP 1.8B

## 7. Tariff vs Rate Plan

Inspect actual `Tariff` fields and usage.

Determine whether existing Tariff is semantically the canonical
commercial Rate Plan or merely a price row.

Canonical Rate Plan concept may include:

-   seller-defined name;
-   meal plan / inclusions;
-   refundability;
-   cancellation-policy reference;
-   restrictions;
-   occupancy/PAX applicability;
-   price basis;
-   valid commercial period(s);
-   availability relationship.

Hard invariant:

`Service Unit ≠ Rate Plan`

Examples for one hotel room: - Room Only --- Refundable - Breakfast
Included --- Refundable - Breakfast Included --- Non-refundable

Examples outside hotels: - Tour Standard / Private / Premium; - Transfer
Sedan / Minivan with cancellation variants; - excursion Adult / Child or
package rules where category semantics require it.

### Decide DD-024

Choose:

**A. Tariff IS the canonical Rate Plan foundation and must be
extended.**

or

**B. Tariff is not semantically sufficient and a new RatePlan concept is
required.**

Avoid duplicate `Tariff` + `RatePlan` concepts representing the same
thing.

If A, specify which existing Tariff fields remain canonical and what
dimensions 1.8B must add.

If B, explain migration/compatibility with Availability and Step 2.4
before approval.

------------------------------------------------------------------------

# PART D --- DD-026 / UNIVERSAL SELLER PRICING

## 8. Required pricing-entry modes

The platform must support seller pricing practices across service
categories, not only hotels.

Resolve a canonical pricing-source/mode model that can support at least:

### 8.1 Fixed price

One price until manually changed or within a broad validity period.

### 8.2 Seasonal / annual calendar pricing

Seller can enter an entire year as commercial periods, e.g.:

-   Jan--Mar = 100;
-   Apr--May = 130;
-   summer = 180;
-   New Year = 250;
-   other dates = base period.

This is a required first-class manual workflow, not an edge case.

### 8.3 Date/date-range overrides

Specific holidays, events or exceptional dates override a broader
season.

### 8.4 Day-of-week pricing

Example: weekday vs weekend.

### 8.5 Occupancy / PAX pricing

Examples: - per room; - per person; - adult/child; - occupancy 1/2/3; -
group-size bands.

Do not freeze category-specific matrices globally; resolve the generic
dimensions and extension mechanism.

### 8.6 Duration-based pricing

Examples: - per night; - per day; - per hour; - per trip; - per
service; - package total.

### 8.7 Tier / volume pricing

Where relevant: - 1--3 passengers; - 4--7 passengers; - group tiers.

### 8.8 Last-minute / advance-purchase rules

Recognize as a possible rule-based extension, but do not force dynamic
pricing into initial implementation if it would overcomplicate
1.8B/1.8C.

### 8.9 External supplier/API/channel-manager pricing

Future authoritative source.

### 8.10 Dynamic/revenue-management pricing

Future extension point, not required for first manual implementation.

------------------------------------------------------------------------

## 9. Price source vs price rule

Resolve whether the model must distinguish:

-   source of price (`MANUAL`, `IMPORT`, `API_SUPPLIER`,
    `CHANNEL_MANAGER`, etc.);
-   pricing method/rule (`FIXED`, `PERIOD`, `DATE_OVERRIDE`,
    `DAY_OF_WEEK`, etc.).

Do not prematurely freeze enum names if Roadmap conventions require
implementation-time naming, but freeze the semantics and precedence
requirements.

CSV/XLS import may be a future UX/input method; it must not become a
separate pricing authority if it merely populates canonical manual
periods.

------------------------------------------------------------------------

## 10. Price basis

Resolve the generic concept of `price basis`.

At minimum support semantics equivalent to:

-   PER_UNIT;
-   PER_ROOM;
-   PER_PERSON;
-   PER_NIGHT;
-   PER_DAY;
-   PER_HOUR;
-   PER_TRIP;
-   PACKAGE_TOTAL.

Do not force every category to use every basis.

Determine whether basis belongs to: - Rate Plan/Tariff; - period price
row; - service unit; - category schema rule.

Prefer the level that prevents contradictory prices.

------------------------------------------------------------------------

## 11. Temporal semantics

Resolve precisely:

-   inclusive/exclusive date boundaries;
-   date-only vs timestamp;
-   timezone ownership;
-   seller/service location timezone where relevant;
-   whether price period is `[validFrom, validTo]` date-only;
-   how exact departures/time slots defer to Step 2.8A time model.

Canonical sequence already states:

> date-based period pricing/availability does not require Step 2.8A;
> exact time-slot/departure/timezone-aware modeling may require Step
> 2.8A.

Preserve this.

If 1.8C can safely start date-only, explicitly define that boundary.

------------------------------------------------------------------------

## 12. Overlap and precedence

This must be resolved before implementation.

Example:

-   Summer: Jun 1--Aug 31 = 180
-   Weekend rule = 200
-   Jul 4 override = 260

The server must deterministically resolve one authoritative price.

Define precedence semantics such as conceptual:

`exact/date override > narrower explicit period > day-of-week rule > broader seasonal/base period`

But do not blindly adopt this example. Validate against the existing
model and choose a deterministic rule.

Resolve: - whether overlapping same-priority periods are forbidden; -
tie-breaking; - validation at write time; - no frontend precedence
authority.

------------------------------------------------------------------------

## 13. Missing-price semantics

Resolve:

If Seller has no valid price for requested date/conditions:

-   do not fabricate;
-   do not silently use stale period;
-   result should be unavailable for instant binding price, or
    `price on request` only where the product/business flow explicitly
    supports non-binding inquiry.

Marketplace "from N" must use only authoritative currently valid
commercial periods according to a server-side rule.

------------------------------------------------------------------------

# PART E --- DD-027 / AVAILABILITY

## 14. Availability granularity

Resolve category-dependent availability without forcing one model
globally:

-   DATE_ONLY;
-   DATE_RANGE;
-   DEPARTURE;
-   TIME_SLOT;
-   OPEN_DATE.

Map these to existing schema capabilities.

Determine which are safe for 1.8C before Step 2.8A.

------------------------------------------------------------------------

## 15. Inventory unit

Resolve what `slotsTotal` means by category/service unit.

Examples: - hotel room count; - tour seats; - transfer vehicle
capacity/booking units; - excursion seats; - rental vehicle units.

Do not assume all availability is "people".

CategorySchema/template rules may define inventory semantics.

------------------------------------------------------------------------

## 16. Multi-date stays --- hard requirement

For hotel/apartment-like services, a stay spanning multiple nights must
reserve availability for **every required date**.

Example: check-in 10 Aug, check-out 13 Aug → inventory required for
nights 10, 11, 12.

Required invariant:

> A multi-date reservation succeeds atomically for all required dates or
> fails entirely.

No partial holds.

Review existing Step 2.4:

`Availability(productId, tariffId, date)`\
`AvailabilityReservation`

Determine whether current model can implement atomic multi-row
reservation safely.

### Decide DD-027

Choose:

**A. Existing Availability + AvailabilityReservation can be
extended/reused for atomic multi-date holds.**

or

**B. Existing model is insufficient and requires architecture change.**

If B, `ARCHITECTURE DECISION REQUIRED` before 1.8C.

No second hold engine.

------------------------------------------------------------------------

## 17. Price vs availability independence

A date can have: - price but zero availability; - availability but no
bindable price; - both; - neither.

Do not merge price and inventory into one state.

Stop-sell is availability/commercial-saleability behavior, not price
deletion.

------------------------------------------------------------------------

# PART F --- DD-028 TAXONOMY

## 18. Taxonomy ownership

Resolve ownership of normalized commercial attributes used by:

-   template validation;
-   Marketplace filters;
-   comparison;
-   Reverse matching;
-   analytics.

Determine relationship between: - Category; - CategorySchema; -
normalized attribute definitions; - seller-provided values; - localized
display labels.

Hard requirements: - Seller original commercial name remains verbatim; -
normalized attributes are platform-owned vocabulary; - taxonomy must not
be owned by Reverse Marketplace; - Reverse may READ normalized
attributes/capabilities for matching; - no duplicated taxonomy per UI
surface.

Choose the canonical owner, expected to remain Catalog unless repository
evidence requires otherwise.

------------------------------------------------------------------------

# PART G --- DD-029 MULTI-CURRENCY

## 19. Currency authority

Resolve:

-   Seller-entered price currency;
-   whether each Rate Plan/price period may have currency;
-   whether currency must be consistent within a Rate Plan;
-   Marketplace display conversion vs commercial binding currency;
-   Quote binding currency;
-   FX source is not to be invented if absent.

Hard invariant:

> Display conversion ≠ binding commercial price mutation.

If TravelHub displays an approximate converted currency, preserve
original seller currency and mark conversion as display-only until a
canonical FX architecture exists.

Do not implement FX in this pass.

Determine whether Step 1.8B/1.8C may proceed with
single-currency-per-RatePlan semantics while display conversion remains
deferred.

------------------------------------------------------------------------

# PART H --- YEARLY PRICE INPUT UX CONTRACT

## 20. Annual price calendar as mandatory seller workflow

Explicitly add to Roadmap requirements that sellers may populate a year
(or other long horizon) by defining reusable periods/rules instead of
entering every date manually.

Required conceptual workflow:

1.  Seller selects service unit.
2.  Seller selects Rate Plan/Tariff.
3.  Seller chooses pricing method.
4.  Seller defines base/seasonal periods.
5.  Seller adds holiday/event/date overrides.
6.  Seller optionally defines day-of-week or occupancy/PAX dimensions
    where supported.
7.  System validates overlaps/precedence.
8.  System previews resolved calendar.
9.  Seller enters availability independently.
10. Seller publishes through existing moderation/publication rules.

Partner Cabinet later needs: - calendar view; - bulk edit; - copy
period; - copy year/season where safe; - stop-sell; - availability bulk
edit; - price overrides; - import as input convenience if later
approved.

Do not implement UI now.

------------------------------------------------------------------------

# PART I --- ROADMAP SYNCHRONIZATION

## 21. Required Roadmap changes

Update the canonical Roadmap in this same pass so decisions are SSOT.

At minimum:

-   resolve/update DD-024...DD-029 statuses;
-   add the resolved semantics to 1.8A--1.8D prerequisites/contracts;
-   ensure annual/seasonal calendar pricing is a first-class required
    pricing-entry option for **all applicable service categories**, not
    hotel-only;
-   preserve category-specific applicability;
-   preserve Step 2.8A conditional time-slot dependency;
-   preserve Step 2.4 single hold engine;
-   preserve Quote/Checkout/Sale frozen commercial authority;
-   update `CURRENT CANONICAL EXECUTION SEQUENCE`.

Do not create a second Roadmap.

------------------------------------------------------------------------

## 22. Determine exact implementation sequence

After resolving the gates, determine whether the safe next
implementation order remains:

`1.8A → STRICT REVIEW → 1.8B → STRICT REVIEW → 1.8C → STRICT REVIEW → 1.8D → STRICT REVIEW`

or whether repository evidence requires a prerequisite ADR before one of
them.

Do not implement any step.

If all gates resolve without ADR, expected NEXT should normally become:

`Step 1.8A — Service Template / Seller Service Unit Foundation`

Use the **exact current Roadmap title**, not this shorthand, in the
final report.

If an ADR is required, that ADR becomes NEXT instead.

------------------------------------------------------------------------

# PART J --- DECISION QUALITY CHECKS

## 23. Cross-category examples

Validate decisions against at least:

### Hotel/apartment

Room/service-unit name + multiple Rate Plans + seasonal yearly price +
holiday override + nightly inventory.

### Tour

Seller package/tour variant + departure/date price + PAX/occupancy where
applicable + seat inventory.

### Transfer

Vehicle/service variant + per-trip/per-vehicle price + date/period
price + capacity/inventory semantics.

### Excursion/activity

Ticket/service variant + per-person/category price + departure/time-slot
future extension + seats.

### Car rental

Vehicle class/unit + per-day price + seasonal periods + vehicle
inventory.

A model that only works for hotels fails review.

------------------------------------------------------------------------

## 24. No premature overengineering

Do not require initial implementation of:

-   AI pricing;
-   competitor pricing;
-   revenue management;
-   automatic demand surge pricing;
-   channel manager;
-   supplier APIs;
-   FX trading engine;
-   every possible occupancy matrix;
-   every time-slot model;
-   CSV/XLS import engine.

They may remain extension points.

The first implementation must, however, have an architecture that does
not block them.

------------------------------------------------------------------------

## 25. Architecture decision stop conditions

Return `ARCHITECTURE DECISION REQUIRED` if repository evidence proves
any of:

1.  CategorySchema cannot safely represent/anchor Seller service units
    without a new bounded concept.
2.  Tariff cannot be reconciled with Rate Plan without parallel
    duplicate commercial concepts.
3.  Existing Availability/Reservation cannot support atomic multi-date
    holds safely.
4.  Currency semantics would require changing canonical Quote/Sale money
    authority.
5.  Taxonomy ownership conflicts with existing ADR ownership.
6.  Pricing precedence cannot be made deterministic within existing
    Catalog ownership.

If an ADR is required, specify the exact question and make that ADR the
NEXT item.

------------------------------------------------------------------------

## 26. Regression/testing

This pass is documentation/architecture only.

Production regression is normally **NOT REQUIRED** if no
code/schema/migration changes occur.

Still verify via repository inspection that proposed decisions are
compatible with actual schema/contracts.

If any production code is changed accidentally, revert it unless
strictly required for documentation tooling; do not smuggle
implementation into this pass.

------------------------------------------------------------------------

## 27. Allowed changes

Allowed:

-   canonical Roadmap;
-   Deferred Decisions Map;
-   architecture decision/planning documentation;
-   dependency analysis;
-   execution sequence.

Forbidden:

-   Prisma schema;
-   migrations;
-   backend;
-   frontend;
-   APIs;
-   tests as implementation;
-   UI;
-   pricing engine;
-   availability engine.

------------------------------------------------------------------------

## 28. Verdicts

Return exactly one:

### Fully resolved

`SERVICE TEMPLATES RETURN POINT DECISION GATES COMPLETED — APPROVED FOR IMPLEMENTATION`

### Resolved with documentation fixes

`SERVICE TEMPLATES RETURN POINT DECISION GATES COMPLETED — APPROVED WITH REVIEW FIXES`

### Still unresolved

`SERVICE TEMPLATES RETURN POINT DECISION GATES COMPLETED — CHANGES REQUIRED`

### ADR needed

`ARCHITECTURE DECISION REQUIRED`

------------------------------------------------------------------------

## 29. Required final report

# SERVICE TEMPLATES RETURN POINT --- DECISION GATES --- ОТЧЁТ

1.  Verdict\
2.  Repository baseline\
3.  Sources inspected\
4.  Global invariants\
5.  DD-025 decision --- Seller unit / CategorySchema\
6.  Seller unit identity semantics\
7.  DD-024 decision --- Tariff vs Rate Plan\
8.  Canonical Rate Plan semantics\
9.  DD-026 decision --- pricing model\
10. Supported pricing-entry modes\
11. Annual/seasonal calendar pricing\
12. Price source vs pricing method\
13. Price basis\
14. Temporal semantics\
15. Overlap / precedence\
16. Missing-price semantics\
17. DD-027 decision --- availability\
18. Availability granularity\
19. Inventory-unit semantics\
20. Multi-date atomic hold compatibility\
21. Pricing ≠ Availability ≠ Reservation\
22. DD-028 decision --- taxonomy ownership\
23. DD-029 decision --- currency authority\
24. Cross-category validation\
25. Marketplace implications\
26. Partner Cabinet implications\
27. Reverse Marketplace compatibility\
28. Quote/Checkout/Sale compatibility\
29. Step 2.4/2.5 compatibility\
30. Step 2.8A conditional dependency\
31. Deferred extension points\
32. Architecture decision status\
33. Roadmap changes\
34. Deferred Decisions Map changes\
35. Execution Sequence update\
36. Out-of-scope confirmation\
37. Exact files changed\
38. **Exact NEXT item**

Final line repeats verdict.

------------------------------------------------------------------------

## 30. STOP

After resolving and documenting the Service Templates return-point
gates:

**STOP.**

Do not implement Step 1.8A or any other next item in the same pass.

The report must name the exact NEXT item from the synchronized Roadmap.
