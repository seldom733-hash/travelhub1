# TRAVELHUB CANONICAL ROADMAP AMENDMENT
## SERVICE TEMPLATES / SELLER COMMERCIAL STRUCTURE / RATE PLANS / PERIOD PRICING & AVAILABILITY

**Project:** TravelHub  
**Document type:** Canonical Roadmap Amendment — planning only  
**Mode:** ROADMAP UPDATE / NO IMPLEMENTATION  
**Target document:** `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`

---

# 1. PURPOSE

Update the canonical TravelHub Roadmap so that Catalog/Partner commercial modeling supports real tourism inventory without forcing Sellers into fixed TravelHub product names or speculative long-range dynamic pricing.

The target business model is:

`TravelHub category/service template`
→ `Seller maps/imports own commercial data`
→ `Seller-defined commercial entity`
→ `Rate Plan / Commercial Variant`
→ `Commercial Period`
→ `Price`
→ `Availability`
→ `Quote snapshot`
→ existing Checkout / Sale / Order pipeline.

This amendment is planning/documentation only.

Do NOT implement schema, migrations, backend, frontend, APIs, events or permissions in this task.

---

# 2. BUSINESS PROBLEM

TravelHub serves heterogeneous tourism Sellers.

Examples:

- hotels have their own room names;
- tour operators have their own package names;
- accommodation and meal combinations differ;
- refund/cancellation conditions differ;
- the same room/service can be sold under multiple rate plans;
- prices often become known only for a limited future period;
- Sellers may not know reliable hotel/airfare/package prices months in advance;
- availability also changes by commercial period/date.

Therefore TravelHub MUST NOT require Sellers to select a fixed global commercial product name such as:

`STANDARD_ROOM`
`DELUXE_ROOM`
`FAMILY_ROOM`

as the authoritative identity of their real inventory.

TravelHub standardizes **structure and comparable attributes**, not Seller commercial naming.

---

# 3. CANONICAL PRINCIPLE — PRESERVE SELLER NAMES

Add the following invariant to the Roadmap:

> **Seller-defined commercial names are preserved verbatim; TravelHub standardizes attributes, not names.**

Example:

Hotel A:

`Deluxe Room Sea View`

Hotel B:

`Premium Double Ocean Side`

Hotel C:

`Superior Sea Facing Room`

TravelHub must preserve those original Seller names.

TravelHub may separately normalize comparable attributes such as:

- accommodation type;
- room class where applicable;
- view;
- occupancy;
- bed configuration;
- area;
- balcony;
- accessibility;
- meal plan;
- amenities.

Normalized attributes are for:

- filtering;
- search;
- comparison;
- matching;
- analytics;
- validation.

They MUST NOT replace the Seller's original commercial name.

---

# 4. TEMPLATE PRINCIPLE

Add:

> **Template defines structure; Seller provides values.**

TravelHub owns category/service schemas.

Seller maps its own real-world inventory into those schemas.

Conceptually:

`Category`
→ `CategorySchema / ServiceTemplate`
→ Seller commercial entity
→ normalized attributes.

Do not create a second independent template engine if the existing `CategorySchema` foundation can be extended safely.

Before implementation, the agent must inspect the existing Category/CategorySchema architecture and determine whether extension is sufficient.

If not:

`ARCHITECTURE DECISION REQUIRED`.

---

# 5. HOTEL EXAMPLE

TravelHub Hotel template may define fields such as:

## Hotel-level

- hotel name;
- star/category where applicable;
- address/location;
- facilities;
- check-in/check-out rules.

## Room-level

- Seller room name — authoritative original name;
- optional normalized room class;
- area;
- max adults;
- max children;
- max guests;
- bed configuration;
- bedroom count;
- view;
- balcony/terrace;
- smoking policy;
- accessibility attributes;
- amenities.

Example Seller value:

`Deluxe Room Sea View`

Normalized TravelHub attributes may be:

`view = SEA`
`maxAdults = 2`
`maxChildren = 1`
`area = 37`
`balcony = true`

TravelHub must not rename the room.

---

# 6. ROOM ≠ RATE PLAN

Explicitly add the invariant:

> **Physical/service unit and commercial rate plan are different concepts.**

One room:

`Deluxe Room Sea View`

may have:

- `Room Only — Refundable`
- `Breakfast — Refundable`
- `Breakfast — Non-refundable`
- `Half Board — Refundable`
- `All Inclusive — Non-refundable`

These are not five different rooms.

Canonical conceptual hierarchy:

`Hotel`
→ `Room`
→ `RatePlan`
→ `CommercialPeriod`
→ `Price`
→ `Availability`.

Do not encode meal plan/refundability directly into the Room identity if those values vary commercially.

---

# 7. TOUR EXAMPLE

The same template philosophy must apply to Tours.

A Seller may provide its own package name.

TravelHub Tour template may normalize applicable fields such as:

- Seller package/tour name;
- destination;
- duration;
- departure/service period;
- hotel;
- room/accommodation;
- occupancy;
- meal plan;
- flight included/not included;
- transfer included/not included;
- excursions;
- insurance;
- baggage;
- passenger composition;
- cancellation/refund conditions.

Do not assume all Tours contain flights or hotels.

Category-dependent schemas must remain extensible.

---

# 8. OTHER SERVICE TYPES

The architecture must be extendable to categories such as:

## Transfer

- Seller service name;
- origin/destination;
- vehicle class;
- passenger capacity;
- baggage capacity;
- private/shared;
- time/date applicability.

## Excursion / Activity

- Seller activity name;
- duration;
- language;
- group/private;
- meeting point;
- start time;
- participant capacity.

## Car rental

- Seller vehicle/class name;
- category;
- transmission;
- seats;
- baggage;
- pickup/dropoff conditions.

Do not hardcode Hotel assumptions into the generic commercial model.

---

# 9. PERIOD-BASED COMMERCIAL MODEL

The primary initial pricing model must be:

> **Seller publishes authoritative commercial terms for a defined validity/service period.**

Example:

`01 Sep – 15 Sep`
- price: 150 USD/night
- availability: 5 rooms

`16 Sep – 30 Sep`
- price: 170 USD/night
- availability: 3 rooms

A Seller is NOT required to provide a price for dates for which it does not yet know a reliable commercial price.

No fabricated future price.

No mandatory long-range forecast.

No requirement that every Product be sellable for all future dates.

---

# 10. PERIOD PRICING — NOT DYNAMIC PRICING ENGINE

Do NOT define the initial model as an algorithmic dynamic-pricing engine.

Initial canonical source should be equivalent to:

`MANUAL_PERIOD`

or another final name selected during implementation.

Future extensibility may permit:

- `DATE_OVERRIDE`;
- `API_SUPPLIER`;
- `CHANNEL_MANAGER`;
- `DYNAMIC_RULE`.

These future names are illustrative, NOT frozen enums by this amendment.

The Roadmap must explicitly defer final source/enumeration design until implementation.

---

# 11. PRICE AND AVAILABILITY ARE SEPARATE FACTS

Add invariant:

> **Pricing answers “how much”; Availability answers “how much can be sold”; Reservation/Hold answers “how much has been committed/held”.**

They must not be collapsed into one field/entity.

Example commercial period:

`01–15 Sep`

Pricing:
`150 USD/night`

Availability:
`5 rooms`

Reservation:
`2 rooms currently held/committed`

Effective remaining capacity is derived according to the Catalog-owned reservation model.

Do not create a second reservation engine.

---

# 12. PRESERVE EXISTING AVAILABILITY RESERVATION OWNERSHIP

Step 2.4 already established Catalog-owned capacity reservation/hold behavior.

This amendment must preserve:

`Catalog owns availability`
and
`Catalog owns availability reservation mechanics`.

Future period availability must extend/reconcile with that foundation.

It MUST NOT introduce:

- Sales-owned inventory;
- Order-owned inventory;
- Booking-owned duplicate inventory;
- a second hold/reservation mechanism.

If the existing Availability model cannot safely support period/date inventory:

`ARCHITECTURE DECISION REQUIRED`.

---

# 13. COMMERCIAL PERIOD SEMANTICS

A commercial period needs explicit temporal semantics.

At implementation time distinguish where required:

- sales validity period;
- service/stay/departure period;
- booking window.

Do NOT silently assume these are always the same.

Example:

Seller may publish on 01 August:

`booking valid until 20 August`

for:

`stay/service dates 01–15 September`.

The initial implementation may support a simpler subset, but the Roadmap must prevent the schema from permanently conflating these concepts.

Final temporal fields/enums are deferred until implementation review.

---

# 14. PRICE UNIT / BASIS

Price cannot be interpreted without a basis.

Future implementation must support category-appropriate price basis, for example:

- per room / night;
- per person;
- per package;
- per vehicle;
- per service;
- per group.

Do NOT freeze this list in the amendment.

The selected basis must be explicit and deterministic so Quote can calculate a binding amount.

---

# 15. OCCUPANCY / PAX DIMENSION

For accommodation and tours, price may depend on occupancy/passenger composition.

Examples:

- single;
- double;
- triple;
- 2 adults + 1 child;
- child age bands.

The Roadmap must acknowledge this requirement.

Do NOT prematurely implement a universal occupancy pricing matrix in this amendment.

During implementation, determine the minimum canonical model necessary for current categories.

Avoid encoding occupancy only inside a free-text Seller name.

---

# 16. RATE PLAN

Introduce/planning-require a distinct commercial concept equivalent to `RatePlan` / `CommercialVariant`.

Final entity name is NOT frozen by this amendment.

A Rate Plan may determine applicable commercial conditions such as:

- meal plan;
- refundable/non-refundable;
- cancellation policy reference;
- included services;
- commercial restrictions;
- price basis.

A Rate Plan belongs to / references the Seller's actual commercial unit/service.

It is not the same as:

- Product;
- Room;
- Quote;
- Checkout;
- Sale.

---

# 17. AVAILABILITY GRANULARITY

Roadmap must support future category-dependent availability semantics.

Possible shapes include:

- date;
- date range;
- departure;
- time slot;
- open date.

Existing roadmap concepts such as `DATE_ONLY`, `TIME_SLOT`, `DATE_RANGE`, `OPEN_DATE` must be reconciled rather than duplicated.

Hotel availability may require per-night inventory.

Tour availability may require departure capacity.

Transfer availability may require slot/vehicle capacity.

Do not force one category's availability model onto every category.

---

# 18. STOP SELL / RESTRICTIONS

Plan future support for commercial restrictions such as:

- stop sell;
- minimum stay;
- maximum stay;
- minimum advance booking;
- maximum advance booking;
- closed to arrival;
- closed to departure.

These are NOT all mandatory for the first implementation.

The Roadmap should classify them as extensible commercial restrictions and define the minimum subset in the implementation step.

Do not prematurely implement a full hotel channel-manager rules engine.

---

# 19. MARKETPLACE DISPLAY

When price depends on period/date, Marketplace must not imply that one static price applies universally.

Before service dates/conditions are selected, cards/search may display a truthful value such as:

`from 90 USD`

only if that value is derived from currently valid/available authoritative commercial periods according to a defined server-side rule.

After Buyer selects dates/occupancy/options, TravelHub must resolve:

- applicable Seller commercial unit;
- applicable Rate Plan;
- applicable period;
- authoritative price;
- availability.

Do not allow frontend-only price calculation.

---

# 20. QUOTE BINDING AUTHORITY

Preserve the already implemented commercial snapshot principle.

Flow:

`Catalog commercial data`
→ server resolves applicable price/availability
→ canonical Quote
→ Quote freezes binding commercial terms
→ Checkout freezes/uses Quote authority
→ Sale snapshot
→ Order.

After Quote becomes binding according to existing lifecycle:

- later Seller price changes MUST NOT reprice that Quote;
- later Product text changes MUST NOT mutate frozen commercial facts;
- Checkout/Sale/Order must not recalculate from current Catalog.

Existing Step 2.3/2.3A/2.4 invariants remain authoritative.

---

# 21. SELLER WORKFLOW

Future Partner Cabinet must provide a workflow similar to:

1. Seller selects service category/template.
2. Seller creates/imports its own commercial entity.
3. Seller preserves its original name.
4. Seller fills normalized TravelHub attributes.
5. Seller creates one or more Rate Plans.
6. Seller defines applicable commercial period(s).
7. Seller sets price.
8. Seller sets availability.
9. Seller publishes/activates according to existing moderation/lifecycle rules.
10. Seller updates future periods as commercial information becomes known.

TravelHub should support bulk period editing/import later where appropriate.

---

# 22. IMPORT / MAPPING PRINCIPLE

The model must support the idea that Sellers are effectively importing/mapping their own commercial data into TravelHub's canonical structure.

Initial implementation may be manual UI/API entry.

Future extensions may include:

- CSV/XLSX import;
- supplier API;
- hotel channel manager;
- tour operator feed;
- mapping/reconciliation UI.

Do NOT implement these integrations in this amendment.

The canonical schema should avoid making them impossible.

---

# 23. NORMALIZATION / TAXONOMY

TravelHub may maintain normalized dictionaries for comparable attributes such as:

- meal plan;
- bed type;
- view;
- amenities;
- service class;
- vehicle class.

But normalization must not destroy Seller source values.

Where useful preserve:

`source/original value`
+
`normalized TravelHub value`.

Do not create uncontrolled global enums for every possible Seller marketing term.

Taxonomies must be extensible.

---

# 24. LOCALIZATION

Seller original names/content and normalized taxonomy are separate concerns.

Do NOT solve multilingual Seller content in this amendment.

Future localization/AI translation must not overwrite the canonical Seller source value.

This remains compatible with the existing deferred multilingual-content work.

---

# 25. REVERSE MARKETPLACE COMPATIBILITY

This amendment must remain compatible with planned Steps 2.2A–2.2F.

Reverse Marketplace matching may use normalized:

- category/service capabilities;
- destination coverage;
- commercial attributes.

But:

`Product ≠ Capability`
and
`Commercial inventory ≠ Seller capability`.

A Seller may be capable of selling hotels in Turkey even if a particular hotel/period is not currently published.

Do not collapse Seller Commercial Capabilities into Product/RatePlan/Availability.

---

# 26. PROPOSED ROADMAP ADDITIONS

Update the canonical Roadmap with additive steps without renumbering/deleting existing steps.

Choose exact logical placement after inspecting the current Roadmap.

Recommended logical additions:

## Step 1.8A — Service Template / Seller Commercial Structure Foundation

Scope:

- extend/reconcile CategorySchema as canonical service template foundation;
- preserve Seller-defined names;
- normalized comparable attributes;
- category-specific schemas;
- Room/service unit distinction;
- no pricing engine yet.

## Step 1.8B — Rate Plan / Commercial Variant Foundation

Scope:

- separate commercial unit from Rate Plan;
- meal plan / refundability / included-service dimensions;
- explicit price basis;
- category-dependent extensibility.

## Step 1.8C — Period Pricing & Period Availability Foundation

Scope:

- bounded commercial periods;
- authoritative period price;
- period/date/departure/slot availability;
- reconcile with Catalog-owned AvailabilityReservation;
- no speculative future pricing;
- no second hold engine.

## Step 1.8D — Commercial Restrictions / Overrides Foundation

Scope:

- minimal stop-sell and override model;
- future extension points for stay/advance/arrival/departure restrictions;
- do not build a full revenue-management engine.

## Step 3.x — Partner Commercial Calendar / Bulk Management UI

Place this in the appropriate Partner Cabinet/UI sequence after inspecting existing 3.x numbering.

Scope:

- calendar/period view;
- bulk price editing;
- bulk availability editing;
- stop sell;
- create/copy periods;
- import/mapping UX;
- original Seller name + normalized attributes.

Do NOT invent a conflicting number if an appropriate existing Step can be amended instead.

---

# 27. ACTUAL IMPLEMENTATION SEQUENCE

Document the difference between:

- logical Roadmap placement;
- actual implementation sequence.

These additions are logically close to Catalog foundation.

They do NOT retroactively invalidate completed Phase 1 work.

They do NOT block Step 2.5 Order Creation Consumer.

Recommended current execution remains:

`2.5`
→ `2.5A`
→ `2.5B`
→ Reverse Marketplace ADR
→ `2.2A–2.2F`
→ then schedule the commercial-template/rate-plan/period work at the earliest safe Catalog/Partner expansion point before Marketplace/Partner UI depends on it.

During amendment review, determine whether some of 1.8A–D must be implemented before Reverse Marketplace 2.2A–F.

Do not silently change execution order without documenting dependency reasoning.

---

# 28. DEPENDENCY REVIEW REQUIRED

The amendment agent must explicitly analyze dependencies with:

- CategorySchema;
- Product;
- Tariff;
- Availability;
- AvailabilityReservation;
- Partner storefront;
- Quote;
- CheckoutIntent;
- Sale snapshot;
- Order;
- Booking;
- Step 2.8A service-date semantics;
- Partner Cabinet;
- Marketplace search/PDP;
- Reverse Marketplace capabilities/matching.

Identify whether current `Tariff` already represents part of proposed `RatePlan`.

Do not create duplicate concepts under new names.

If `Tariff` is already the correct owner/model, amend/extend it rather than introducing `RatePlan`.

---

# 29. REQUIRED ARCHITECTURAL QUESTIONS

The Roadmap amendment must leave explicit decisions/prerequisites for implementation where current sources are insufficient:

1. Is existing `Tariff` the canonical Rate Plan?
2. Does CategorySchema support nested/repeatable Seller commercial units such as Hotel Rooms?
3. What owns Seller room/service-unit identity?
4. Are commercial periods attached to Tariff, Product variant, or another Catalog-owned entity?
5. How does period availability reconcile with current Availability?
6. What is the canonical price basis model?
7. How is occupancy represented?
8. Are sales validity and service validity separate in the first implementation?
9. How are overlapping commercial periods resolved?
10. What is server precedence for base period vs date override?
11. How are availability holds allocated across multi-date hotel stays?
12. Which normalized taxonomies are global vs category-specific?

Do not guess if repository/ADR does not answer.

Mark:

`ARCHITECTURE DECISION REQUIRED`

where a formal ADR is genuinely needed.

---

# 30. SECURITY / TENANT ISOLATION

Future implementation must preserve:

- Seller can manage only own commercial entities;
- Seller cannot write another Seller's Room/RatePlan/Price/Availability;
- public Marketplace sees only publishable/active data;
- internal fields are not leaked;
- mass assignment blocked;
- price/availability authority is server-side;
- Buyer cannot forge resolved price;
- Seller cannot forge ownership through payload;
- availability reservations remain server-authoritative.

Small-organization capability model remains compatible; avoid hardcoded UI-role assumptions.

---

# 31. AUDITABILITY

Future commercial changes must be auditable where they affect sellable terms.

At minimum Roadmap should anticipate audit/history for meaningful changes to:

- price;
- availability;
- stop sell;
- commercial period;
- Rate Plan status/terms.

Do not require storing every UI edit as a domain event.

Define exact history/event scope during implementation.

---

# 32. CONCURRENCY

Period availability must eventually support atomic reservation under concurrency.

Required invariant:

Two Buyers competing for the last available unit cannot both successfully reserve it.

Preserve the Step 2.4 atomic hold invariant.

For multi-date services such as hotels, all required dates must be reserved atomically or the operation must fail/rollback.

This requirement must be visible in the Roadmap even if detailed implementation is later.

---

# 33. OUT OF SCOPE FOR THIS AMENDMENT

Do NOT implement:

- dynamic pricing algorithms;
- AI pricing;
- competitor pricing;
- yield/revenue management;
- supplier API integrations;
- channel manager integrations;
- CSV/XLSX import;
- multilingual translation;
- payment changes;
- Order changes;
- Booking changes;
- Reverse Marketplace implementation;
- frontend calendar;
- schema/migrations/code.

This task changes only canonical planning documentation.

---

# 34. ROADMAP INTEGRITY RULES

When editing `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`:

- preserve all existing Steps;
- do not delete completed work;
- do not renumber existing Steps;
- add substeps/additive amendments;
- preserve Reverse Marketplace amendment and its Strict Review fixes;
- preserve status markers;
- mark new steps `⏳ NOT IMPLEMENTED`;
- distinguish logical placement from actual implementation sequence;
- update dependency/ownership sections if needed;
- update deferred decisions;
- update cross-cutting invariants.

Do not create a second canonical Roadmap.

---

# 35. STRICT REVIEW PREPARATION

The resulting Roadmap amendment must be reviewable for:

- duplicate concepts;
- Catalog ownership;
- Tariff vs RatePlan collision;
- CategorySchema reuse;
- Room naming;
- period temporal semantics;
- pricing authority;
- availability authority;
- reservation concurrency;
- Quote snapshot compatibility;
- Reverse Marketplace compatibility;
- Partner Cabinet dependencies;
- Marketplace display correctness;
- scope creep into revenue management.

---

# 36. REQUIRED FINAL REPORT

After updating the canonical Roadmap, return:

## 1. Verdict

`CANONICAL ROADMAP SERVICE TEMPLATES / PERIOD PRICING & AVAILABILITY AMENDMENT COMPLETED — WAITING FOR STRICT REVIEW`

## 2. Baseline

Branch, HEAD, dirty files.

## 3. Sources inspected

Roadmap, ADRs, schema, Catalog, Tariff, Availability, Quote/Checkout/Sale, Partner UI plans.

## 4. Existing model assessment

Especially:

- CategorySchema;
- Tariff;
- Availability;
- AvailabilityReservation.

## 5. Roadmap changes

Exact added/amended sections.

## 6. Seller-name invariant

How original names are preserved.

## 7. Template model

How TravelHub structure differs from Seller values.

## 8. Room/service-unit vs RatePlan

Final planning terminology or deferred decision.

## 9. Period pricing

Exact planning semantics.

## 10. Period availability

Exact planning semantics.

## 11. Reservation compatibility

How Step 2.4 foundation is preserved.

## 12. Quote/Checkout/Sale compatibility

Confirm no reprice after binding snapshot.

## 13. Marketplace implications

Date/period-aware price display.

## 14. Partner Cabinet implications

Future management UI.

## 15. Reverse Marketplace compatibility

Capability ≠ inventory.

## 16. Dependency analysis

Logical vs actual implementation order.

## 17. Architecture decisions/deferred decisions

Exact list.

## 18. Out-of-scope confirmation

Confirm no implementation.

## 19. Files changed

Must be documentation only.

Final line:

`CANONICAL ROADMAP SERVICE TEMPLATES / PERIOD PRICING & AVAILABILITY AMENDMENT COMPLETED — WAITING FOR STRICT REVIEW`

---

# 37. STOP CONDITION

After Roadmap amendment and report:

**STOP.**

Do NOT implement the new steps.

Do NOT continue Step 2.5 in the same run.

Do NOT perform Strict Review in the same run.

Wait for a separate Strict Review prompt.
