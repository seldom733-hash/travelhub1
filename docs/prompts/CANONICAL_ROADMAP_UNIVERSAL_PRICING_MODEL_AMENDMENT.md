# CANONICAL ROADMAP — UNIVERSAL PRICING MODEL AMENDMENT

**Project:** TravelHub  
**Mode:** CANONICAL ROADMAP AMENDMENT — DOCUMENTATION ONLY  
**Execution timing:** EXECUTE ONLY AT THE CANONICAL SERVICE TEMPLATES RETURN POINT, IMMEDIATELY BEFORE 1.8A–1.8D  
**Implementation:** FORBIDDEN

## 1. Mission

Amend the canonical Roadmap so future Steps 1.8A–1.8D implement a universal, category-configurable Pricing Model rather than merely `price + validFrom + validTo`.

Canonical separation:

> **Service Template defines WHAT is sold. Pricing Model defines HOW it is priced. Availability defines WHETHER it can be sold. Reservation/Hold defines temporary capacity commitment.**

> **Period Pricing is a universal pricing dimension for applicable service categories, not a Hotel-specific feature.**

## 2. Execution-sequence rule — critical

DO NOT execute this amendment while Reverse Marketplace remains the canonical active sequence.

Preserve the current sequence through ADR-0012 / 2.2A–2.2F and their separate Strict Reviews.

At the Service Templates return point, require:

`2.2F STRICT REVIEW APPROVED`
→ `Universal Pricing Model Amendment`
→ `Amendment STRICT REVIEW`
→ resolve relevant DD/ADR gates
→ `1.8A`
→ review
→ `1.8B`
→ review
→ `1.8C`
→ review
→ `1.8D`
→ review
→ return to the canonical original Phase 2 return point.

Update `CURRENT CANONICAL EXECUTION SEQUENCE` in the amendment, but never advance/replace the current Reverse Marketplace NEXT prematurely.

## 3. Sources to inspect

Read the latest repository truth:
- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- `CURRENT CANONICAL EXECUTION SEQUENCE`;
- `TRAVELHUB_DEFERRED_DECISIONS_MAP.md`;
- Service Templates / Period Pricing amendment and review fixes;
- ADR-0001, ADR-0005, ADR-0007, ADR-0012;
- Category, CategorySchema, Product, Tariff, Availability, AvailabilityReservation;
- Quote/QuoteItem, CheckoutIntent, Sale;
- Catalog, Partner Cabinet and Marketplace architecture.

Reconcile anything changed since this prompt was prepared.

## 4. Business requirement

TravelHub must support different seller pricing practices without creating a separate service template for every pricing combination.

Examples include:
- Hotels/apartments: per unit/night, season, holiday override, occupancy, meal/rate plan.
- Tours: per person, Adult/Child/Infant, departure/date, season, package.
- Excursions: per group, PAX tiers, date override.
- Transfers: per vehicle, route/zone, passenger tier, season.
- Car/yacht/equipment rental: per day/hour, duration tiers, season.
- Bespoke/MICE/luxury: Price on Request.

## 5. Service Template ≠ Pricing Model

Forbid template explosion such as “Hotel seasonal pricing template” vs “Hotel fixed pricing template”.

A Service Template describes the sellable service/unit and its normalized attributes. Seller-defined commercial names remain preserved verbatim.

A category/template may declare which Pricing dimensions are allowed/required, but actual seller prices are separate commercial facts.

## 6. Universal composable Pricing Model

The Roadmap must recognize category-configurable pricing dimensions without necessarily freezing final enum names now:

- fixed;
- per unit;
- per night/day/hour;
- per person;
- per group;
- per vehicle;
- per package/booking;
- period/season;
- exact date/date-range override;
- weekday/day-of-week;
- PAX/quantity tiers;
- age bands;
- occupancy;
- duration tiers;
- route/zone;
- service variant / Rate Plan;
- add-ons/surcharges;
- minimum charge/threshold;
- Price on Request.

The architecture must allow compatible composition but not arbitrary nonsensical combinations.

Illustrative combinations:
- Hotel: `PER_UNIT_PER_NIGHT + RATE_PLAN + PERIOD + OCCUPANCY + DATE_OVERRIDE`
- Tour: `PER_PERSON + AGE_BAND + DATE/DEPARTURE + PERIOD`
- Excursion: `PER_GROUP + PAX_TIER + DATE_OVERRIDE`
- Transfer: `PER_VEHICLE + ROUTE + VARIANT + PERIOD`
- Rental: `PER_DAY + DURATION_TIER + VARIANT + PERIOD`

## 7. Category compatibility matrix

Require a future server-authoritative compatibility definition for each category/template:
- allowed dimensions;
- required dimensions;
- forbidden dimensions;
- mutually exclusive dimensions;
- composable dimensions.

Frontend must not invent compatibility.

## 8. Annual / period pricing

Period Pricing is universal for compatible categories.

The model must support Seller commercial periods such as:
- 01 Jan–31 Mar → 80
- 01 Apr–31 May → 110
- 01 Jun–31 Aug → 180
- 01 Sep–31 Oct → 120
- 01 Nov–31 Dec → 85

The Partner Cabinet must later allow annual price entry without 365 manual rows:
- Add period;
- select date range;
- assign price;
- seasons;
- special/holiday periods;
- calendar;
- bulk update;
- copy period;
- copy previous year/another year where safe.

Data-entry mechanism must not define a second pricing model.

## 9. Date overrides and deterministic precedence

Support specific date/date-range overrides over normal periods.

The Roadmap must require deterministic precedence and overlap handling. Conceptually, more-specific rules override less-specific rules, e.g.:

`exact override > special period > regular period > base/default`

but final precedence across all supported dimensions must be explicitly decided before implementation.

No “first row wins”. Resolve:
- overlapping periods;
- weekday inside season;
- occupancy + period;
- age/PAX + period;
- route + period;
- manual vs supplier/imported price;
- source priority.

## 10. PAX / age / occupancy / duration / route

Explicitly preserve:
- PAX/group tiers where total is not simply price × persons;
- configurable Adult/Child/Infant age bands; do not globally hardcode age ranges;
- accommodation occupancy pricing distinct from generic PAX;
- duration tiers for rentals/long stays;
- route/zone pricing for transfer-like services.

## 11. Rate Plan / Tariff

Preserve physical/service unit ≠ commercial variant/Rate Plan.

Review DD-024 and current `Tariff`.

Before 1.8B, decide whether to:
A. extend Tariff into the commercial variant/rate-plan concept;
B. retain Tariff under another canonical commercial variant;
C. formally refactor/replace it.

Do not create duplicate Tariff and RatePlan authorities.

## 12. Add-ons / surcharges

Recognize optional components such as breakfast, extra bed, child seat, Meet & Greet, luggage, late checkout, equipment, etc.

Potential adjustments may be fixed/percentage/per-unit where supported.

Do not build a free-form seller formula language.

## 13. Price on Request

Recognize `PRICE_ON_REQUEST` for services without authoritative numeric publication price.

It is NOT a fabricated zero or marketing number and must not enter binding Checkout as if a numeric price existed.

It must converge through the approved Reverse Marketplace/Sales Quote flow.

## 14. Pricing source vs pricing dimension

Distinguish HOW price is structured from WHERE price came from.

Future source examples may include:
- manual base;
- manual period;
- date override;
- imported file;
- supplier API;
- channel manager;
- future dynamic rule.

Names remain illustrative unless canonical.

There must be one deterministic authoritative resolved price for a requested commercial context.

## 15. Server-side Price Resolution

Require a canonical server-side resolver conceptually based on:

`commercial unit + variant/rate plan + date/time + duration + PAX/age/occupancy + route/zone + add-ons + applicable authoritative rules → resolved price`

Frontend may edit/display rules but MUST NOT independently calculate binding price.

## 16. Quote / Checkout / Sale authority

Preserve existing binding flow.

Catalog resolves current commercial price. Canonical Sales Quote freezes the binding offer according to existing rules. Checkout/Sale use frozen facts.

Later Catalog price changes must not mutate frozen Quote/Checkout/Sale.

No implicit reprice after binding.

## 17. “From price”

Marketplace `from N` must be server-derived from actual authoritative sellable pricing.

Seller must not type an arbitrary “from price” that cannot actually be bought.

If numeric price is unavailable, expose the appropriate non-numeric commercial state such as Price on Request.

## 18. Pricing ≠ Availability ≠ Reservation

Price may exist when availability is zero. Availability may exist when price is absent.

Availability remains category-dependent: date/date-range/departure/time-slot/open-date as canonically allowed.

Reservation/Hold remains Catalog-owned; do not create a second hold engine.

For accommodation multi-night stays, all required dates must eventually be validated/reserved atomically. If current model cannot support this safely, require `ARCHITECTURE DECISION REQUIRED`.

## 19. Step 2.8A gate

Preserve the approved execution rule:
- date-based period pricing/availability may be implemented before 2.8A;
- exact-time/time-slot/timezone-aware semantics require the canonical 2.8A time model.

At the pre-1.8 pass, 1.8C must remain date-based unless 2.8A has already been completed.

## 20. Manual entry and imports

The same canonical Pricing Model may later be populated by:
- manual UI;
- commercial calendar;
- Excel/CSV;
- supplier API;
- channel manager.

Imports are input methods, not separate pricing authorities/models.

## 21. Partner Cabinet implications

Future Seller workflow should support:
1. create/select service unit;
2. configure variant/Rate Plan;
3. choose allowed pricing model;
4. define base/period rules;
5. define overrides;
6. define availability separately;
7. preview calendar;
8. validate gaps/conflicts;
9. publish/update.

Annual calendar should support ranges, seasons, holidays, bulk operations and availability overlay.

No frontend implementation in this amendment.

## 22. Marketplace implications

Marketplace requests server-resolved pricing using selected context: dates, occupancy, PAX composition, duration, route, variant, etc.

Next.js/React must not replicate binding Pricing Engine logic.

## 23. Reverse Marketplace compatibility

Preserve ADR-0012:
Seller Commercial Capability ≠ Product/pricing/inventory.

A Seller may be eligible for `HOTEL + Turkey` without published period pricing.

Proposal amount may remain non-binding where allowed. Binding authority converges to canonical Sales Quote.

Do not make 2.2A–2.2F depend on Pricing implementation unless latest repository truth proves a hard dependency.

## 24. Multi-currency / tax / fee boundaries

Reconcile DD-029. Pricing facts must carry explicit currency; no silent conversion.

Do not implement FX.

Review existing authority for seller price, taxes, fees, commission, markup and payment fees. Do not silently merge them into one rule. Defer unresolved authority explicitly.

## 25. Cancellation/refundability boundary

Rate Plan may reference cancellation/refundability conditions, but do not bury arbitrary policy logic inside period-price rows if policy has separate ownership.

## 26. Typed commercial semantics

Forbid an uncontrolled generic JSON rules engine as the sole pricing authority unless separately approved.

Require extensibility with typed/server-validated semantics suitable for validation, querying, precedence, audit, analytics, migration and binding price resolution.

## 27. Audit / concurrency / validation

Future pricing changes must be auditable: actor, time, commercial unit/rate plan, affected context/dates, source, before/after.

Require safe concurrent editing according to repository CAS/version conventions.

Require detection/handling of:
- invalid ranges;
- duplicate overrides;
- conflicting overlaps;
- invalid currency;
- incompatible dimensions;
- uncovered dates where price is required.

Never fabricate a price to fill a gap.

## 28. DD reconciliation

Review at minimum:
- DD-024 Tariff vs Rate Plan;
- DD-025 Seller unit identity / CategorySchema nesting;
- DD-026 period semantics / price basis / occupancy / overlap / precedence;
- DD-027 availability granularity / multi-date holds;
- DD-028 taxonomy;
- DD-029 multi-currency.

Expand/reconcile DD-026 to cover universal Pricing Model questions:
- dimensions;
- composability;
- compatibility matrix;
- precedence/overlap;
- age/PAX;
- occupancy;
- duration;
- route/zone;
- add-ons;
- source priority;
- resolution authority;
- gap semantics.

Create new DDs only for genuinely separate unresolved questions after checking the current register. Keep counts and next-ID correct.

## 29. CategorySchema boundary

Review whether CategorySchema can define service structure plus allowed/required pricing dimensions without storing Seller annual prices.

If not sufficient, require architecture decision before affected implementation.

## 30. Required Step 1.8A shape

Refine 1.8A to focus on:

**Service Templates & Seller Commercial Units**

It defines WHAT is sold:
- category schema/template;
- seller commercial/service unit;
- seller-defined names preserved;
- normalized attributes;
- identity/nesting.

Actual annual price facts are not stored in the Service Template.

## 31. Required Step 1.8B shape

Refine conceptually to:

**Pricing Model & Commercial Variant / Rate Plan Foundation**

Must cover:
- DD-024;
- price basis;
- category-configurable dimensions;
- compatibility/composability;
- currency;
- Price on Request;
- typed validation;
- authoritative model.

Classify implementation dimensions into MVP vs extension points before implementation.

## 32. Required Step 1.8C shape

Refine conceptually to:

**Commercial Calendar — Period Pricing, Overrides & Availability**

Must cover:
- annual periods;
- seasons;
- holiday/date overrides;
- bulk/calendar backend support;
- availability separately;
- stop-sell;
- overlap validation;
- date-based scope under 2.8A gate;
- multi-date accommodation compatibility;
- no second reservation engine.

## 33. Required Step 1.8D shape

Refine conceptually to:

**Server-side Price Resolution & Commercial Validation**

Must cover:
- deterministic resolution;
- precedence;
- compatible dimensions;
- gap/conflict behavior;
- authoritative resolved price;
- Marketplace consumption;
- Quote binding handoff;
- no frontend binding-price authority;
- no post-freeze reprice.

Reconcile rather than silently overwrite if latest Roadmap gives 1.8D another canonical responsibility.

## 34. MVP vs extension points

Do NOT require every dimension in the first implementation.

Before 1.8B, classify:
- MVP / REQUIRED NOW;
- EXTENSION / DEFERRED.

Choose based on launch categories and requirements, while avoiding a foundation that makes deferred dimensions require destructive redesign.

## 35. Canonical execution sequence update

This amendment must update `CURRENT CANONICAL EXECUTION SEQUENCE` in the same pass.

Schedule this amendment and its Strict Review at the Service Templates return point before 1.8A–1.8D.

Do not alter the currently active Reverse Marketplace NEXT.

## 36. No implementation

Documentation only.

Forbidden:
- Prisma/schema/migrations;
- NestJS/Next.js;
- API/tests;
- Pricing Engine;
- Tariff/CategorySchema runtime refactor;
- Availability runtime changes;
- Partner/Marketplace UI.

## 37. Required Roadmap self-test

After amendment, a fresh agent must be able to answer from the Roadmap:

1. What is a Service Template?
2. What is a Pricing Model?
3. What is Availability?
4. What is Reservation/Hold?
5. Can period pricing apply outside Hotels?
6. How does a Hotel enter annual pricing?
7. Can holiday dates override seasons?
8. Can Tours use Adult/Child pricing?
9. Can Transfers use route pricing?
10. Can Rentals use duration pricing?
11. Is Proposal amount binding?
12. Who resolves binding price?
13. Can frontend calculate it?
14. What happens on overlapping rules?
15. How does Tariff relate to Rate Plan?
16. Can pricing exist without availability?
17. Can capability exist without pricing/inventory?
18. What is Price on Request?
19. Which dimensions are MVP?
20. Which decisions block 1.8A–1.8D?

Each answer must be explicit or explicitly deferred with a named gate.

## 38. Required final report

Return exactly:

# CANONICAL ROADMAP UNIVERSAL PRICING MODEL AMENDMENT — ОТЧЁТ

## 1. Verdict
`CANONICAL ROADMAP UNIVERSAL PRICING MODEL AMENDMENT COMPLETED — WAITING FOR STRICT REVIEW`
or
`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Execution timing / active NEXT preservation
## 4. Sources inspected
## 5. Existing pricing model assessment
## 6. Core separation
## 7. Service Template vs Pricing Model
## 8. Universal pricing dimensions
## 9. Annual/period pricing
## 10. Date overrides / precedence
## 11. PAX / age-band pricing
## 12. Occupancy pricing
## 13. Duration / quantity pricing
## 14. Route / zone pricing
## 15. Rate Plan / Tariff
## 16. Add-ons / surcharges
## 17. Price on Request
## 18. Category compatibility matrix
## 19. Price source / authority
## 20. Server-side resolution
## 21. Quote / Checkout / Sale compatibility
## 22. Pricing vs Availability
## 23. Reservation compatibility
## 24. Partner Cabinet implications
## 25. Marketplace implications
## 26. Reverse Marketplace compatibility
## 27. Multi-currency / tax boundary
## 28. DD-024–DD-029 reconciliation
## 29. New/updated deferred decisions
## 30. Step 1.8A changes
## 31. Step 1.8B changes
## 32. Step 1.8C changes
## 33. Step 1.8D changes
## 34. MVP vs extension points
## 35. Canonical execution-sequence update
## 36. Contradictions found
## 37. Architecture decision status
## 38. Out-of-scope confirmation
## 39. Exact files changed

Final line repeats the verdict.

## 39. Stop condition

After amendment:
STOP.

Do NOT run its Strict Review in the same pass.
Do NOT implement 1.8A–1.8D.
Do NOT implement Pricing Engine.
Do NOT change the currently active Reverse Marketplace implementation item.

Wait for a separate Strict Review prompt.

## 40. Scheduling note

This prompt is intentionally prepared in advance.

**Execute it only when the canonical execution sequence reaches the Service Templates return point immediately before 1.8A–1.8D.**

At execution time:
1. re-read the latest Roadmap;
2. re-read the latest DD Map;
3. reconcile architecture added since this prompt was prepared;
4. run this amendment;
5. run a separate Strict Review;
6. only then proceed toward 1.8A–1.8D.
