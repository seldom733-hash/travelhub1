# UNIVERSAL PRICING MODEL AMENDMENT — CANONICAL ROADMAP INTEGRATION

**Project:** TravelHub  
**Mode:** ARCHITECTURE / ROADMAP AMENDMENT — DOCUMENTATION ONLY  
**Previous approved item:** `PHASE 1 STEP 1.8A STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`  
**Canonical NEXT:** `Universal Pricing Model Amendment`  
**Implementation in this pass:** FORBIDDEN  
**Purpose:** freeze the universal Seller pricing model before Step 1.8B and Step 1.8C.

---

## 1. Mission

Integrate a canonical **Universal Pricing Model** into the existing TravelHub Roadmap before implementation of Step 1.8B.

The model must support how real Sellers price different service categories, including Sellers who already have a complete annual/seasonal price schedule.

This amendment must define **one extensible pricing architecture** for applicable TravelHub service categories without creating Hotel-only assumptions and without implementing production code.

The amendment must answer:

1. How does a Seller enter a simple fixed price?
2. How does a Seller enter a full annual/seasonal price calendar?
3. How are holidays/events represented?
4. How are weekday/weekend differences represented?
5. How are occupancy/PAX/group dimensions represented?
6. How are duration-based prices represented?
7. How are tier/volume prices represented?
8. How can future advance-purchase/last-minute rules fit?
9. How can future supplier/API/channel-manager prices fit?
10. How can future dynamic/revenue-management pricing fit?
11. How is deterministic precedence resolved?
12. What is the authoritative commercial price at a requested date/conditions?
13. How does this integrate with `ServiceUnit → Tariff → future CommercialPeriod`?
14. How does pricing remain independent from Availability and Reservation/Hold?
15. How does TravelHub avoid forcing Sellers to predict unknown future prices?

This is a Roadmap/architecture amendment only.

---

# PART A — HARD INVARIANTS

## 2. Preserve approved architecture

The amendment MUST preserve:

`Category → CategorySchema → Product → ServiceUnit → Tariff/Rate Plan → Commercial pricing`

Approved decisions:

- `ServiceUnit` is the Catalog-owned Seller commercial/service structural unit.
- Seller-defined names remain verbatim.
- `Tariff` is the canonical Rate Plan foundation.
- pricing is Catalog-owned.
- pricing ≠ availability.
- pricing ≠ reservation/hold.
- Step 2.4 remains the only availability reservation/hold engine.
- Quote/Checkout/Sale freeze authoritative commercial facts.
- Order never reprices from current Catalog.
- capability ≠ live inventory.
- frontend is never authoritative for pricing.
- no fabricated future price.

Do not reopen DD-024…DD-029 unless actual repository truth shows a contradiction.

---

## 3. Universal, not Hotel-specific

The pricing model must work for applicable categories such as:

- Hotel / Apartment;
- Tour;
- Transfer;
- Excursion / Activity;
- Car Rental;
- future service categories.

CategorySchema determines which pricing dimensions/modes are allowed for a category.

Do not put hotel-specific concepts into universal core fields.

Examples such as `room`, `night`, `adult/child`, `vehicle` may be category rules, not global mandatory fields.

---

# PART B — CANONICAL COMMERCIAL GRAPH

## 4. Pricing attachment point

Freeze the conceptual graph:

`Product`
→ `ServiceUnit`
→ `Tariff / Rate Plan`
→ `CommercialPeriod / Pricing Rule`
→ resolved authoritative price

The amendment must clarify:

- Product is not the final universal price authority once ServiceUnits exist;
- ServiceUnit is not itself a price row;
- Tariff/Rate Plan describes the commercial offer/rules;
- CommercialPeriod/rule provides date/condition-sensitive price facts.

Step 1.8B will extend Tariff as Rate Plan and establish the ServiceUnit relation.

Step 1.8C will implement period/date pricing and availability according to the approved sequence.

Do not implement either here.

---

# PART C — PRICING INPUT MODES

## 5. Pricing modes are first-class Seller workflows

The Roadmap must explicitly recognize multiple Seller pricing-entry patterns.

A Seller must not be forced into one pricing style.

At minimum freeze support for the following semantic modes.

### 5.1 Fixed price

Use when the Seller has one price for a broad validity horizon.

Example:

`Airport Transfer / Sedan → 35 AZN per trip`

The price remains authoritative only within its declared validity/rule scope.

---

## 6. Annual / seasonal price calendar — REQUIRED FIRST-CLASS MODE

This is a hard requirement.

A Seller may already possess an annual price schedule.

TravelHub must allow the Seller to enter that schedule as **commercial periods**, not by manually entering 365 separate dates.

Example:

| Period | Price |
|---|---:|
| 01 Jan – 31 Mar | 100 |
| 01 Apr – 31 May | 130 |
| 01 Jun – 31 Aug | 180 |
| 01 Sep – 30 Nov | 130 |
| 01 Dec – 30 Dec | 150 |
| 31 Dec – 02 Jan | 250 |

The exact overlapping New Year example must be handled by canonical precedence/validation rather than undefined behavior.

This workflow is applicable beyond Hotels:

- Hotel: seasonal nightly room rate;
- Tour: seasonal package/departure price;
- Transfer: seasonal transfer price;
- Car Rental: seasonal daily rate;
- Excursion: seasonal ticket/service price.

The Roadmap must state explicitly:

> Annual/seasonal calendar pricing is a canonical Seller pricing-entry option for all applicable service categories, not a Hotel-specific feature.

---

## 7. Date/date-range override

Seller may define exceptional price overrides for:

- public holidays;
- festivals;
- sporting events;
- conferences;
- New Year;
- local peak dates;
- Seller-defined special dates.

Example:

Base summer period:
`01 Jun – 31 Aug = 180`

Override:
`Formula 1 weekend = 300`

The override must not require editing/deleting the base season.

---

## 8. Day-of-week pricing

Support semantics equivalent to:

- Mon–Thu = 100
- Fri–Sun = 130

or category-specific subsets.

This may combine with seasonal periods.

The model must define precedence against base/seasonal periods and date overrides.

Do not let frontend choose precedence.

---

## 9. Occupancy / PAX pricing

The architecture must support category-specific quantity/occupancy dimensions.

Examples:

Hotel:
- single occupancy;
- double occupancy;
- extra guest.

Tour:
- Adult;
- Child;
- Infant;
- private group.

Transfer:
- passenger/group bands where the Seller prices this way.

Excursion:
- Adult / Child ticket.

Do not freeze one universal Adult/Child schema for every category.

CategorySchema should determine permitted pricing dimensions.

---

## 10. Duration-based pricing

Support pricing basis/rules such as:

- per night;
- per day;
- per hour;
- per trip;
- per service;
- package total.

Examples:

Car Rental:
`1–3 days = 60/day`
`4–7 days = 52/day`

Guide:
`2 hours = 80`
`4 hours = 140`

Do not implement duration engine in this amendment; freeze compatibility and ownership.

---

## 11. Tier / volume pricing

Support future-safe semantics for:

- passenger count;
- participant count;
- units;
- group-size bands;
- duration bands where applicable.

Examples:

`1–3 persons = 100 total`
`4–7 persons = 160 total`

or:

`1–5 tickets = 20/person`
`6–10 = 18/person`

The model must avoid ambiguous mixing of total-price and per-person price basis.

---

## 12. Advance-purchase / last-minute rules

Recognize rule-based pricing based on booking lead time.

Examples:

- book 30+ days ahead → discount;
- within 48 hours → last-minute price.

This is an extension point unless Roadmap evidence explicitly requires it in initial 1.8B/1.8C.

Do not turn initial manual period pricing into a full revenue-management engine.

---

## 13. Length-of-stay / minimum-stay restrictions

Distinguish:

- **price calculation**
from
- **commercial restriction**.

Examples:
- minimum 3 nights over New Year;
- maximum stay;
- specific arrival/departure restrictions.

Decide whether these belong to Tariff/Rate Plan restrictions or pricing rule conditions.

Do not merge restrictions into Availability counts.

---

## 14. Package/inclusion pricing

Rate Plan may represent different commercial packages over the same ServiceUnit.

Hotel example:

ServiceUnit:
`Premium Double Ocean Side`

Rate Plans:
- Room Only — Refundable
- Breakfast Included — Refundable
- Breakfast Included — Non-refundable

Tour example:
- Standard
- Premium
- Private

The pricing model must allow each Rate Plan to have its own commercial periods/rules.

---

# PART D — PRICE SOURCE VS PRICING METHOD

## 15. Separate authority source from pricing method

Freeze two distinct semantic axes.

### Price source

Where did the authoritative price fact originate?

Conceptual examples:

- MANUAL
- IMPORT
- API_SUPPLIER
- CHANNEL_MANAGER
- future trusted external source

### Pricing method/rule

How is the price determined?

Conceptual examples:

- FIXED
- PERIOD
- DATE_OVERRIDE
- DAY_OF_WEEK
- OCCUPANCY/PAX
- DURATION_TIER
- future LEAD_TIME_RULE
- future DYNAMIC_RULE

Do not conflate these.

Do not freeze exact enum names if naming belongs to implementation review, but freeze the distinction.

---

## 16. CSV/XLS is not a pricing authority

A spreadsheet import is an **input method**, not a separate commercial pricing model.

Example:

Seller uploads annual Excel tariff.

TravelHub validates and imports it into canonical:
- Rate Plans;
- CommercialPeriods;
- overrides/rules.

After import, canonical Catalog records become the pricing facts used by the platform according to source provenance.

Do not build CSV/XLS import now.

---

# PART E — PRICE BASIS

## 17. Canonical price basis

Freeze a generic price-basis concept.

It must be able to express semantics equivalent to:

- PER_UNIT
- PER_ROOM
- PER_PERSON
- PER_NIGHT
- PER_DAY
- PER_HOUR
- PER_TRIP
- PER_SERVICE
- PACKAGE_TOTAL

Exact enum names may be finalized in 1.8B.

The Roadmap must state which layer owns the basis.

Preferred rule:

> Price basis is a Rate Plan-level commercial semantic unless a category-specific rule proves that a period must override it.

Avoid storing contradictory bases on every price row without need.

---

## 18. Quantity and price basis

Define how basis interacts with quantity.

Example:

`100 USD PER_ROOM PER_NIGHT`

for:
- 3 nights
- quantity 1 room

is not the same as:
`100 USD PACKAGE_TOTAL`.

The future resolver must produce explicit:
- unit amount;
- quantity;
- duration/count where relevant;
- total.

No implicit arithmetic contract.

---

# PART F — TEMPORAL MODEL

## 19. Date-only first boundary

Freeze initial 1.8C pricing periods as date-based where possible.

Use a deterministic date semantic.

The amendment must choose and document boundary semantics.

Preferred if compatible with repository:

`validFrom` and `validTo` are date-only and inclusive.

Example:
`2026-06-01` through `2026-08-31` includes both dates.

Do not silently mix timestamps with date-only seasonal prices.

---

## 20. Timezone

Date-only pricing is interpreted according to the service/product commercial timezone when required.

Do not invent a global UTC business date if it changes local Seller dates.

Exact departures/time slots/timezone-aware inventory remain conditionally dependent on Step 2.8A.

Preserve Roadmap gate:

- date-based period pricing can proceed before 2.8A;
- exact time-slot/departure semantics may require 2.8A.

---

# PART G — OVERLAP / PRECEDENCE

## 21. Deterministic resolver — HARD REQUIREMENT

For any requested commercial context, server resolution must be deterministic.

No two equal-authority price facts may ambiguously win.

The amendment must freeze precedence semantics.

A valid conceptual hierarchy should normally distinguish:

1. exact/specific date override;
2. more specific conditional override;
3. applicable seasonal/period price;
4. day-of-week adjustment/rule;
5. base/fixed price.

However, review the interaction carefully.

It may be safer to model day-of-week as a condition inside a period rather than globally ranking it.

The final amendment must choose one unambiguous approach.

---

## 22. Same-priority overlap

Same-priority overlapping rules that can both match the same commercial context must either:

- be rejected at write/publish time; or
- have an explicit deterministic priority field/rule.

Do not rely on:
- database row order;
- createdAt;
- last write;
- frontend order.

If explicit priority is introduced conceptually, define who controls it and validation constraints.

---

## 23. Specificity

If specificity participates in resolution, define it mechanically.

Examples:
- exact date is more specific than date range;
- occupancy=2 rule is more specific than occupancy=ANY;
- explicit Rate Plan period is more specific than base price.

Avoid vague “most specific wins” without a server-testable definition.

---

# PART H — PRICE RESOLUTION

## 24. Canonical server resolver

Roadmap must require a single server-authoritative resolution path conceptually equivalent to:

`resolvePrice(serviceUnit, ratePlan, serviceDate/dateRange, occupancy/PAX, quantity, duration, currency context)`

It must return enough data to explain:

- matched Rate Plan;
- matched pricing rule/period;
- price basis;
- currency;
- unit price;
- quantity/duration;
- resolved total;
- provenance/source;
- rule/period identity.

Exact API belongs to implementation.

Do not create frontend pricing authority.

---

## 25. Explainability

The resolved price should be traceable to the authoritative commercial rule.

This matters for:
- support;
- disputes;
- Quote snapshots;
- audit;
- Seller debugging.

Do not require exposing internal pricing logic to Buyer UI, but backend must know why a price was selected.

---

# PART I — MISSING / UNKNOWN FUTURE PRICE

## 26. No fabricated future price — HARD GATE

Many Sellers do not know airline/hotel/supplier costs months in advance.

TravelHub must not require them to invent a future price.

If no authoritative price exists for requested dates:

- no silent extrapolation;
- no stale-price fallback;
- no fake zero;
- no automatic use of today's price.

The result is not instant-bindable at a price unless another explicit commercial flow applies.

---

## 27. PRICE_ON_REQUEST / inquiry semantics

The architecture may support semantics equivalent to `PRICE_ON_REQUEST` where the category/flow allows it.

But distinguish:

- no price because Seller forgot/misconfigured;
- intentionally inquiry-based commercial offer.

Do not treat every missing price as PRICE_ON_REQUEST.

Exact status/model may be deferred to 1.8B/1.8C if necessary, but the distinction must be frozen in Roadmap.

---

# PART J — CURRENCY

## 28. Seller commercial currency

Preserve DD-029.

Canonical binding price retains Seller/commercial currency.

Prefer one canonical currency per Rate Plan unless repository evidence requires period-level currency.

Changing currency inside periods of one Rate Plan creates ambiguity and should not be allowed casually.

If multiple currencies are required, separate Rate Plans may be the safer model.

Resolve/document.

---

## 29. Display conversion

Marketplace may later display approximate converted prices.

Hard invariant:

`display currency conversion ≠ binding commercial price`

Original authoritative:
- amount;
- currency

must remain preserved.

Do not implement FX in this amendment.

---

# PART K — AVAILABILITY SEPARATION

## 30. Pricing ≠ Availability

A pricing row/period must not carry inventory counters as if price and stock are one fact.

Possible states:

- price exists + availability exists;
- price exists + sold out;
- availability exists + no bindable price;
- neither exists.

The future resolver may combine pricing and availability for offerability, but ownership/facts remain separate.

---

## 31. Stop-sell

Stop-sell must not be implemented by deleting price.

It is a commercial availability/saleability control.

Exact implementation belongs to 1.8C/Partner Cabinet.

---

## 32. Multi-date stays

For hotel/apartment-style stays:

- price may resolve per required night;
- availability must hold every required night atomically;
- price resolution and inventory reservation remain separate operations/contracts.

Do not implement multi-date hold here.

Preserve DD-027 and Step 2.4 single hold engine.

---

# PART L — QUOTE / CHECKOUT / SALE

## 33. Freeze boundary

Catalog pricing determines the authoritative offer **before binding**.

Once canonical Quote/Checkout/Sale freezes commercial facts:

- later price changes do not mutate them;
- later seasonal calendar edits do not reprice existing Sale/Order;
- Order never asks current Catalog to reconstruct historical amount.

Document compatibility with existing Step 2.3/2.3A/2.4/2.5 contracts.

---

## 34. Snapshot requirements for future implementation

Do not implement schema now, but Roadmap should require future Quote snapshot to retain sufficient facts such as:

- serviceUnit ref;
- Rate Plan ref;
- pricing rule/period ref where appropriate;
- price basis;
- authoritative currency;
- unit price;
- quantity/duration;
- total;
- service date/range;
- relevant commercial conditions.

Only freeze fields that are necessary conceptually; exact schema belongs to implementation review.

---

# PART M — MARKETPLACE

## 35. “From N” price

Marketplace may show:

`from 100 USD`

only if computed server-side from authoritative eligible commercial periods/rules under a documented policy.

Do not simply take:
- minimum historical price;
- expired price;
- unpublished price;
- unavailable arbitrary row.

The exact search horizon/policy may be deferred to Marketplace implementation, but authority rule must be acknowledged.

---

## 36. Buyer-selected dates

After Buyer selects dates/conditions, Marketplace must use server resolution:

`ServiceUnit → Rate Plan → pricing rule/period → price`

and separately evaluate availability.

No frontend recomputation from downloaded annual calendar.

---

# PART N — PARTNER CABINET UX CONTRACT

## 37. Seller pricing workflow

Freeze the conceptual workflow:

1. Seller selects Product.
2. Seller selects ServiceUnit.
3. Seller creates/selects Rate Plan.
4. Seller chooses pricing method.
5. Seller sets price basis/currency.
6. Seller defines base/fixed price or commercial periods.
7. Seller adds seasonal periods.
8. Seller adds holiday/event/date overrides.
9. Seller optionally adds allowed day-of-week/PAX/duration/tier conditions.
10. System validates overlaps/precedence.
11. System previews resolved calendar.
12. Seller enters availability separately.
13. Seller publishes through canonical Catalog rules.

This is the basis for later Partner Cabinet UI.

---

## 38. Annual calendar UX

Roadmap must explicitly require a future calendar/bulk management UX supporting applicable categories:

- year/month calendar;
- period selection;
- bulk price entry;
- copy period;
- copy season;
- copy year where safe;
- holiday/date override;
- weekday/weekend rules;
- occupancy/PAX matrix where category allows;
- stop-sell;
- availability bulk edit;
- preview resolved price;
- validation errors before publish.

Do not implement frontend now.

---

## 39. Import UX

Future import may include:

- CSV;
- XLS/XLSX;
- supplier file;
- API;
- channel manager.

All must map into the same canonical Rate Plan + CommercialPeriod/rule model.

No parallel “Excel pricing engine”.

---

# PART O — FUTURE AUTOMATION

## 40. External supplier/API pricing

Architecture must permit a future trusted external source to update canonical future prices.

Requirements conceptually:
- source provenance;
- idempotent reconciliation;
- no client spoofing;
- conflict policy with manual overrides;
- immutable downstream Quote/Sale snapshots.

Do not implement connectors.

---

## 41. Dynamic / revenue-management pricing

Reserve future extension for:
- demand;
- occupancy;
- booking lead time;
- competitor signals;
- events;
- AI recommendations.

But dynamic pricing must ultimately produce or resolve an authoritative Catalog price under the same binding contract.

Do not create a second downstream pricing authority.

---

## 42. Manual override over automation

The amendment must address future precedence between:
- supplier/API price;
- dynamic rule;
- manual Seller override.

A safe principle is:

> explicit authorized manual override may supersede automated source within a defined scope, with provenance/audit.

Do not freeze an unsafe rule without checking existing architecture.

At minimum require deterministic source precedence.

---

# PART P — CROSS-CATEGORY VALIDATION

## 43. Hotel / apartment

Validate:

ServiceUnit:
`Premium Double Ocean Side`

Rate Plans:
- Room Only Refundable
- Breakfast Included Non-refundable

Pricing:
- winter;
- spring;
- summer;
- New Year override;
- weekend rule if Seller uses it;
- occupancy dimensions if applicable.

Availability remains nightly inventory, separate.

---

## 44. Tour

Validate:

ServiceUnit/package:
`Premium Tour Package`

Pricing:
- seasonal;
- departure/date;
- Adult/Child or group bands where applicable;
- package total or per-person basis.

Do not require hotel nightly semantics.

---

## 45. Transfer

Validate:

ServiceUnit:
`Minivan`

Rate Plan:
`Private Transfer`

Pricing:
- fixed per trip;
- seasonal period;
- event/date override;
- optional passenger/group tier.

No room/night assumptions.

---

## 46. Excursion / activity

Validate:
- per-person ticket;
- Adult/Child where schema allows;
- seasonal/date pricing;
- future exact time slot dependent on 2.8A if needed.

---

## 47. Car rental

Validate:
- per-day basis;
- seasonal rates;
- duration bands;
- holiday override;
- vehicle inventory separate.

---

# PART Q — ROADMAP INTEGRATION

## 48. Required Roadmap changes

Update the single canonical Roadmap.

Do not create a second competing Roadmap.

At minimum integrate:

1. Universal Pricing Model invariants.
2. Pricing modes.
3. Annual/seasonal calendar as first-class workflow.
4. Price source vs pricing method distinction.
5. Price basis.
6. deterministic overlap/precedence.
7. missing-price semantics.
8. currency authority.
9. pricing/availability separation.
10. Quote/Sale freeze compatibility.
11. Marketplace implications.
12. Partner Cabinet annual-calendar/bulk UX.
13. future import/API/dynamic extension points.
14. cross-category applicability.

---

## 49. Step 1.8B contract update

Update 1.8B so its future implementation explicitly owns the Rate Plan foundation.

Expected responsibilities include:

- Tariff → canonical Rate Plan extension;
- attach Tariff to ServiceUnit;
- Seller-defined Rate Plan name;
- commercial currency;
- price basis;
- refundability;
- cancellation-policy ref;
- inclusions/meal plan where category supports it;
- restrictions;
- compatibility with future CommercialPeriod.

Do not implement.

---

## 50. Step 1.8C contract update

Update 1.8C so its future implementation owns:

- CommercialPeriod/date pricing;
- fixed/base price compatibility if placed there;
- annual/seasonal calendar;
- date overrides;
- deterministic precedence;
- category-supported conditions;
- availability relationship;
- multi-date atomic hold compatibility;
- date-only boundary before 2.8A.

Do not implement.

---

## 51. Step 1.8D contract review

Ensure 1.8D remains compatible with:
- resolved server pricing;
- Marketplace display;
- Partner publication/consumption contract.

Do not expand it unnecessarily.

---

## 52. Step 3.29I Partner Commercial Calendar

Update/confirm that later Partner Cabinet implementation includes:

- annual calendar;
- bulk pricing;
- copy periods;
- overrides;
- stop-sell;
- availability management;
- import workflow extension.

Do not implement frontend.

---

# PART R — EXECUTION SEQUENCE

## 53. Update CURRENT CANONICAL EXECUTION SEQUENCE

On successful amendment integration, set:

`Universal Pricing Model Amendment → IMPLEMENTATION/DOCUMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

and active item:

`Universal Pricing Model Amendment STRICT REVIEW`

Step 1.8B remains blocked until this amendment is approved.

After amendment STRICT REVIEW approval:

`NEXT = Step 1.8B`

Do not start 1.8B in this pass.

---

# PART S — DEFERRED DECISIONS

## 54. Deferred Decisions Map

Review DD-024…DD-029.

They are already DECIDED from the Service Templates return point.

Do not reopen them merely to restate Universal Pricing.

Add a new DD only if this amendment discovers a genuinely unresolved architectural choice that cannot safely be frozen now.

If such a decision blocks 1.8B:

`ARCHITECTURE DECISION REQUIRED`

and make that decision/ADR the next gate.

---

# PART T — DOCUMENTATION

## 55. Canonical architecture document

Create a dedicated architecture document such as:

`docs/architecture/universal-pricing-model.md`

It must document:

- commercial graph;
- pricing modes;
- annual/seasonal calendar;
- overrides;
- source vs method;
- basis;
- temporal semantics;
- precedence;
- missing price;
- currency;
- availability separation;
- Quote freeze;
- Marketplace;
- Partner Cabinet;
- future external/dynamic pricing;
- cross-category examples.

Do not describe unimplemented schema/API as already existing.

Clearly mark conceptual/future contracts.

---

# PART U — NO CODE

## 56. Forbidden changes

This pass must not change:

- Prisma schema;
- migrations;
- backend production code;
- frontend production code;
- API endpoints;
- permissions;
- events;
- unit/E2E implementation tests.

Documentation-only verification does not require production regression.

If code changes appear in git status from Step 1.8A, distinguish them from this pass and do not claim this amendment created them.

---

# PART V — CONSISTENCY REVIEW

## 57. Mandatory contradiction scan

Before finishing, search Roadmap/docs for contradictory statements such as:

- Tariff still treated only as a raw Product price;
- one price per Product assumptions;
- Hotel-only period pricing;
- mandatory future price;
- pricing merged with availability;
- frontend-calculated price;
- annual calendar omitted;
- ServiceUnit price fields implied;
- 1.8B/1.8C responsibilities overlapping ambiguously;
- old execution sequence jumping directly 1.8A → 1.8B.

Fix documentation contradictions within scope.

---

## 58. Do not overfreeze implementation

The amendment must freeze architecture and behavior, not unnecessary physical schema.

Do not prematurely mandate:
- exact Prisma model names beyond already approved concepts;
- every enum value;
- every future dynamic rule;
- supplier integration protocol;
- FX provider;
- UI component structure.

Leave implementation freedom where it does not affect canonical semantics.

---

# PART W — VERDICT

## 59. Allowed verdicts

Return exactly one:

### Success
`UNIVERSAL PRICING MODEL AMENDMENT COMPLETED — WAITING FOR STRICT REVIEW`

### Blocked
`UNIVERSAL PRICING MODEL AMENDMENT — CHANGES REQUIRED`

### Architecture gate
`ARCHITECTURE DECISION REQUIRED`

Do not mark the amendment APPROVED in the implementation/documentation pass itself.

Approval belongs to the separate STRICT REVIEW.

---

## 60. Required final report

# UNIVERSAL PRICING MODEL AMENDMENT — ОТЧЁТ

1. Verdict  
2. Repository baseline  
3. Sources inspected  
4. Existing pricing model assessment  
5. Canonical commercial graph  
6. Universal pricing invariants  
7. Fixed pricing  
8. Annual/seasonal calendar pricing  
9. Date/date-range overrides  
10. Day-of-week pricing  
11. Occupancy/PAX pricing  
12. Duration pricing  
13. Tier/volume pricing  
14. Advance-purchase / last-minute extension  
15. Restrictions vs pricing  
16. Package/inclusion pricing  
17. Price source vs pricing method  
18. Import semantics  
19. Price basis  
20. Quantity/duration arithmetic contract  
21. Temporal semantics  
22. Timezone / Step 2.8A dependency  
23. Overlap rules  
24. Precedence rules  
25. Specificity semantics  
26. Canonical server resolver  
27. Explainability/provenance  
28. Missing-price semantics  
29. PRICE_ON_REQUEST semantics  
30. Currency authority  
31. Display conversion boundary  
32. Pricing vs Availability  
33. Stop-sell boundary  
34. Multi-date compatibility  
35. Quote/Checkout/Sale freeze compatibility  
36. Future snapshot requirements  
37. Marketplace implications  
38. “From N” semantics  
39. Partner Cabinet workflow  
40. Annual calendar UX contract  
41. Import UX extension  
42. External supplier/API extension  
43. Dynamic/revenue-management extension  
44. Manual-vs-automation precedence  
45. Hotel validation  
46. Tour validation  
47. Transfer validation  
48. Excursion validation  
49. Car Rental validation  
50. Step 1.8B changes  
51. Step 1.8C changes  
52. Step 1.8D compatibility  
53. Step 3.29I changes  
54. Deferred Decisions Map status  
55. Contradictions found/fixed  
56. Architecture decision status  
57. Roadmap update  
58. Execution Sequence update  
59. Out-of-scope confirmation  
60. Exact files changed  
61. **Exact NEXT item**

Final line:

`UNIVERSAL PRICING MODEL AMENDMENT COMPLETED — WAITING FOR STRICT REVIEW`

---

## 61. STOP

After integrating the amendment:

**STOP.**

Do not perform its STRICT REVIEW in the same pass.

Do not start Step 1.8B.

The exact NEXT must be:

`Universal Pricing Model Amendment STRICT REVIEW`

unless an actual unresolved architecture gate is discovered.
