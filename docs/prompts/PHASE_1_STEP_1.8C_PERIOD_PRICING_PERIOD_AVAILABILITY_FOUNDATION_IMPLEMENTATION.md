# PHASE 1 — STEP 1.8C — PERIOD PRICING & PERIOD AVAILABILITY FOUNDATION — IMPLEMENTATION

**Project:** TravelHub  
**Phase:** 1  
**Step:** 1.8C  
**Mode:** IMPLEMENTATION  
**Entry gate:** `PHASE 1 STEP 1.8B STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`  
**Canonical Rate Plan:** existing `catalog.Tariff`  
**Exact next after implementation:** `STEP 1.8C STRICT REVIEW` — do not start 1.8D in this pass.

---

## 1. Mission

Implement the canonical **Period Pricing & Period Availability Foundation** for TravelHub.

The purpose of Step 1.8C is to make annual, seasonal and date-dependent commercial calendars first-class, generic seller tooling across service categories.

A Seller must be able to express commercial rules such as:

- Hotel:
  - Jan–Mar: 100 AZN/night;
  - Apr–May: 130 AZN/night;
  - Jun–Aug: 190 AZN/night;
  - New Year dates: 250 AZN/night;
  - selected dates unavailable / stop-sell;
- Tour:
  - summer price;
  - winter price;
  - holiday surcharge/override;
  - selected departure/service dates unavailable;
- Transfer:
  - normal-season price;
  - holiday price;
  - selected dates unavailable;
- Excursion / Activity:
  - weekday/weekend/season/date-dependent commercial rules where category policy permits;
- Car Rental:
  - low/high season;
  - selected-date override;
  - period availability.

This must be **generic**, not Hotel-specific.

The foundation must preserve the already approved chain:

`Product → ServiceUnit → Tariff/Rate Plan → CommercialPeriod → Quote/Checkout`

and the invariant:

`Pricing ≠ Availability`.

Do not implement a second pricing domain or second Rate Plan model.

---

## 2. Mandatory execution gate

Before changing code, verify repository truth:

- Step 1.8B is actually `STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`;
- current Roadmap sets Step 1.8C as exact NEXT;
- Step 1.8D has not started;
- no conflicting newer Amendment exists.

If the current canonical Roadmap differs from this prompt:

> CURRENT CANONICAL ROADMAP WINS.

Do not silently reinterpret a conflict.

If the conflict changes ownership, cardinality, precedence or the meaning of CommercialPeriod:

`ARCHITECTURE DECISION REQUIRED`.

---

## 3. Mandatory sources to inspect

Read the latest repository versions of at least:

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- `CURRENT CANONICAL EXECUTION SEQUENCE`
- `docs/prompts/TRAVELHUB_DEFERRED_DECISIONS_MAP.md`
- DD-024
- DD-026
- DD-027
- DD-028 if relevant to category taxonomy
- DD-029
- `docs/architecture/universal-pricing-model.md`
- `docs/architecture/rate-plan-foundation.md`
- `docs/architecture/service-unit-foundation.md`
- Service Templates / Period Pricing & Availability Amendment
- Step 1.8A implementation + strict review
- Step 1.8B implementation + strict review
- ADR-0001 and other referenced Catalog/Sales/Availability ADRs
- Prisma schema:
  - Product
  - ServiceUnit
  - Tariff
  - TariffHistory
  - Availability
  - AvailabilityReservation
  - Quote / QuoteItem
  - CheckoutIntent
- Catalog public read models and `priceFrom`
- Quote tariff resolution
- Availability/reservation services
- existing date utilities / validation
- permissions
- API/ID/event contracts
- relevant E2E/unit tests.

Do not implement from this prompt alone.

---

## 4. Repository baseline

Record before implementation:

- branch;
- HEAD;
- origin relation;
- git status;
- pre-existing dirty files;
- migration count/status;
- drift;
- backend/frontend baseline tests relevant to 1.8C.

Do not reset or overwrite unrelated dirty work.

---

# PART A — CANONICAL DOMAIN MODEL

## 5. CommercialPeriod ownership

`CommercialPeriod` belongs to the canonical Catalog commercial structure.

Expected ownership:

`catalog.*`

It is subordinate to a canonical `Tariff` / Rate Plan.

Do not create:

- `pricing.*` bounded context unless current Roadmap explicitly requires it;
- a second RatePlan;
- a Hotel-specific seasonal-price table;
- a Seller-specific arbitrary pricing engine outside Catalog.

---

## 6. Canonical hierarchy

Preserve:

`Product`
→ `ServiceUnit`
→ `Tariff / Rate Plan`
→ `CommercialPeriod`

CommercialPeriod must not attach directly to Product if that bypasses the canonical Rate Plan.

CommercialPeriod must inherit Seller/Product/ServiceUnit commercial scope through its Tariff, not through client-forged ownership fields.

---

## 7. CommercialPeriod purpose

A CommercialPeriod represents a **bounded service-date commercial rule**.

It may express, where supported by the canonical Roadmap:

- date range;
- price override;
- availability/stop-sell fact;
- category-supported commercial conditions;
- priority/specificity metadata only where required for deterministic resolution.

It is NOT:

- a Quote;
- a booking;
- inventory reservation;
- payment;
- Product publication;
- Rate Plan lifecycle;
- arbitrary dynamic-pricing script.

---

## 8. Annual price calendar as first-class workflow — HARD REQUIREMENT

The model must support a Seller entering a full year without creating one row per day.

Example:

- 01 Jan–31 Mar → 100
- 01 Apr–31 May → 130
- 01 Jun–31 Aug → 190
- 01 Sep–20 Dec → 120
- 21 Dec–05 Jan → 250

The system must support period-based annual setup and specific date overrides.

Do not require 365 manual records for ordinary seasonal pricing.

---

## 9. Date-only boundary

Step 1.8C must remain **date-based** unless the current Roadmap explicitly says otherwise.

Use canonical date-only semantics for service/stay dates.

Do not introduce:

- exact departure time;
- time-slot pricing;
- timezone-aware instant pricing;
- hourly availability;
- local-time DST rules;

unless the current Roadmap has already moved the Step 2.8A prerequisite ahead of 1.8C.

If exact-time semantics are required to satisfy the requested implementation:

`ARCHITECTURE DECISION REQUIRED`.

---

## 10. Currency authority

CommercialPeriod must not create an independent currency authority.

Canonical rule:

> Rate Plan owns one commercial currency.

Period price inherits the Tariff currency.

Do not add freely mutable `CommercialPeriod.currency`.

If a physical currency column is somehow required by existing schema conventions, it must be server-derived and immutable and must never diverge from Tariff; prefer no duplicate currency fact.

---

## 11. Base price fallback

Preserve the 1.8B transition contract:

- applicable CommercialPeriod price → authoritative for that service date;
- no applicable CommercialPeriod price → base/FIXED `Tariff.price` fallback where pricing mode permits;
- `PRICE_ON_REQUEST` remains inquiry-only and must not become numeric merely because periods exist unless the canonical Roadmap explicitly defines such a transition.

Do not delete or repurpose legacy `Tariff.price`.

---

# PART B — DATE RANGE AND PRECEDENCE

## 12. Date range semantics

Define exact semantics for period boundaries.

Prefer explicit inclusive service dates if that matches current architecture:

`startDate <= serviceDate <= endDate`

But verify existing date conventions first.

Document:

- inclusive/exclusive boundary;
- validation of start <= end;
- leap day;
- year boundary;
- periods spanning Dec→Jan;
- storage type;
- UTC/date-only conversion rules.

No timezone drift from a date-only commercial calendar.

---

## 13. Overlap policy — HARD GATE

Overlapping periods must have deterministic behavior.

Do not rely on database row order or `createdAt`.

Implement the precedence/specificity rules required by the canonical Roadmap.

At minimum, explicitly resolve how these interact:

- broad seasonal range;
- narrower holiday range;
- exact-date override;
- category-supported conditional rule.

Example:

- Jun 1–Aug 31 → 190
- Jul 10–Jul 15 → 230
- Jul 12 → 260

Jul 12 must resolve deterministically.

If Roadmap defines specificity ordering, implement exactly that.

If no authoritative precedence exists and multiple valid designs would produce different customer prices:

`ARCHITECTURE DECISION REQUIRED`.

---

## 14. Exact-date overrides

Support seller-friendly date overrides without forcing destructive edits to the seasonal range.

An override should coexist with a broader period and win according to canonical specificity.

Do not duplicate or split broad periods automatically unless this is already the approved design.

---

## 15. Same-specificity conflict

Two rules with equal applicability/specificity must not produce nondeterministic pricing.

Choose only an already-authorized strategy, e.g.:

- reject conflicting overlap;
- explicit priority;
- unique constraint;
- deterministic versioned precedence.

Do not invent hidden “latest row wins” unless Roadmap explicitly authorizes it.

---

# PART C — CATEGORY-DEPENDENT CONDITIONS

## 16. Generic conditions

The latest Roadmap may allow category-supported conditions such as:

- day of week;
- occupancy;
- PAX;
- duration;
- tier.

Implement only the 1.8C foundation required by Roadmap.

Do not build the full 1.8D restrictions/resolution engine prematurely.

---

## 17. CategorySchema authority

Where a condition is category-dependent, CategorySchema/taxonomy must remain server-authoritative.

A Seller must not be able to enable arbitrary unsupported dimensions.

Examples:

- Hotel may allow occupancy-related pricing;
- Tour may allow per-person/tier conditions;
- Transfer may allow trip/vehicle-related commercial variants;
- Car Rental may allow duration/day basis.

Do not hardcode Hotel logic globally.

---

## 18. PriceBasis separation

Preserve:

`priceBasis ≠ pricing condition`

Examples:

- `PER_NIGHT` describes what the amount is for;
- `DAY_OF_WEEK` determines when a period/rule applies.

Do not create compound enum values such as:

`PER_ROOM_PER_NIGHT_WEEKEND`.

---

# PART D — PERIOD AVAILABILITY

## 19. Pricing ≠ Availability — HARD GATE

The Seller may need to express:

- a price for a period;
- whether the service is sellable during a period.

These are separate facts even if managed in one annual-calendar workflow.

Do not infer:

- no price → unavailable;
- zero price → unavailable;
- unavailable → delete price;
- stop-sell → archive Rate Plan.

---

## 20. Existing Availability ownership

Inspect the existing `Availability` / `AvailabilityReservation` architecture before changing anything.

Do not create a second inventory truth.

If period availability can be represented by extending the existing canonical Availability model safely, do so.

If Roadmap explicitly mandates a CommercialPeriod availability fact, preserve its relationship to canonical inventory and document authority.

If the requested annual availability model conflicts with existing Availability ownership/cardinality:

`ARCHITECTURE DECISION REQUIRED`.

---

## 21. Stop-sell semantics

A Seller must be able to mark dates/ranges unavailable without destroying pricing history.

Stop-sell/unavailable must:

- be explicit;
- be reversible where lifecycle permits;
- not delete the Rate Plan;
- not mutate Quote already frozen;
- not fabricate zero inventory if canonical inventory model uses another representation.

---

## 22. Availability vs capacity

Do not confuse:

- commercial sellability / stop-sell;
- actual capacity/inventory count;
- held/reserved capacity.

If Step 1.8C only owns period sellability foundation, do not build capacity engine changes beyond what Roadmap mandates.

---

# PART E — MULTI-DATE ATOMIC HOLD COMPATIBILITY

## 23. DD-027 gate

The annual/date model must be compatible with future/required multi-date atomic holds.

For a stay/service spanning multiple dates, no successful hold may occur if one required date is unavailable.

Example hotel stay:

Jul 10, Jul 11, Jul 12.

If Jul 11 is unavailable, the entire hold must fail atomically.

---

## 24. No partial hold

Never allow:

- date 1 reserved;
- date 2 reserved;
- date 3 failed;
- partial reservation left behind.

If Step 1.8C Roadmap explicitly requires implementation of the multi-date hold contract now, implement transactionally and test rollback.

If it requires only compatibility/foundation, do not prematurely redesign Booking; prove the data model can support the later atomic operation.

Follow the latest Roadmap exactly.

---

# PART F — SELLER WORKFLOW / API

## 25. Seller annual-calendar workflow

Backend API must make a future UI workflow practical.

The Seller should be able to:

1. choose Product;
2. choose ServiceUnit;
3. choose Rate Plan;
4. create one or more date periods;
5. assign period price;
6. set period sellability where supported;
7. add specific-date overrides;
8. inspect the resulting annual commercial calendar;
9. edit/delete/archive rules according to canonical lifecycle;
10. see conflicts before they silently affect customers.

Do not implement frontend unless Roadmap explicitly includes it in 1.8C.

---

## 26. API shape

Design API consistently with current Catalog conventions.

Possible resource shape should be evaluated against repository conventions, e.g.:

- `/rate-plans/:id/commercial-periods`
- `/commercial-periods/:id`

Do not invent duplicate endpoint families.

Document actual API in `docs/contracts/api.md`.

---

## 27. Bulk period creation

Annual pricing needs efficient entry.

If canonical Roadmap permits, support safe bulk creation/update of multiple periods in one request/transaction.

Requirements:

- all-or-nothing;
- conflict validation across the batch;
- ownership checked once authoritatively but each row validated;
- no partial annual calendar on error.

If bulk API is not required by Roadmap, ensure model/API still does not make annual setup impractical and document deferred bulk UX.

---

## 28. Copy/recurrence helpers

Do not prematurely create a recurrence language.

If Roadmap only requires stored resolved periods, keep recurrence/import helpers deferred.

Seller convenience must not introduce a second pricing authority.

---

# PART G — LIFECYCLE / OWNERSHIP / SECURITY

## 29. Ownership

Seller identity must be derived from authenticated actor / parent Product/Tariff.

Do not accept:

- partnerId;
- ownerId;
- arbitrary productId mismatch;
- foreign serviceUnitId;
- foreign tariff ownership.

---

## 30. Parent eligibility

Define mutation gates from existing Catalog lifecycle.

At minimum inspect:

- Product status;
- ServiceUnit status;
- Rate Plan status.

Do not allow a Seller to add sellable periods under an ineligible archived chain unless current Roadmap deliberately permits draft preparation.

Use existing 1.8A/1.8B conventions.

---

## 31. RBAC

Implement permissions using current Catalog permission conventions.

Verify:

- PARTNER own-scope;
- BUYER denied;
- MODERATOR no accidental commercial write;
- ADMIN/staff according to existing authority.

No role-name shortcuts that bypass permission policy.

---

## 32. IDOR

Test guessed IDs for:

- Rate Plan;
- CommercialPeriod;
- annual-calendar list;
- update/delete/lifecycle;
- bulk operations.

Cross-Seller access must be denied according to canonical neutral-response conventions.

---

## 33. Mass assignment

Loudly reject server-owned / future-step facts.

At minimum protect:

- id/code;
- partnerId;
- productId;
- serviceUnit ownership;
- tariff ownership;
- currency;
- createdAt/updatedAt;
- history/audit;
- Quote/Checkout/Sale refs;
- reservation/hold facts;
- arbitrary resolver result;
- client-defined specificity if server-derived;
- client-defined priority unless explicitly part of contract;
- timezone/time-slot facts;
- 1.8D enforcement state.

---

# PART H — MONEY / VALIDATION

## 34. Decimal money

Use canonical Decimal money handling.

Validate:

- non-negative;
- max matching DB precision;
- scale;
- zero;
- no NaN/Infinity;
- no silent JS float rounding;
- stable serialization.

---

## 35. POR interaction

A `PRICE_ON_REQUEST` Rate Plan must not accidentally become bindable through a period numeric price unless current canonical model explicitly permits period-specific transition from POR to fixed.

If not explicitly authorized:

- reject numeric CommercialPeriod pricing for POR;
or
- keep it non-bindable.

Choose only the Roadmap-authorized behavior.

---

## 36. Validation of annual ranges

Test:

- one-day period;
- full year;
- leap year;
- Dec→Jan representation;
- invalid reverse range;
- duplicate exact date;
- overlapping broad/narrow rules;
- equal-specificity collision;
- max range/row count if bounded;
- malformed dates.

---

# PART I — RESOLUTION FOUNDATION

## 37. Deterministic price resolution

Implement only the resolution capability required by Step 1.8C.

For a service date and Rate Plan, the system must be able to determine the applicable commercial price according to canonical precedence.

Expected conceptual behavior:

1. validate Rate Plan is eligible;
2. identify applicable CommercialPeriods;
3. apply deterministic specificity/precedence;
4. determine period price if present;
5. otherwise use base `Tariff.price` fallback where permitted;
6. independently determine sellability/availability;
7. never bind POR as numeric;
8. return original Rate Plan currency.

Do not implement 1.8D restriction enforcement beyond the Step 1.8C contract.

---

## 38. Resolver location

Do not create a second pricing bounded context.

Place resolution where the current architecture/Roadmap says it belongs.

If Catalog owns period resolution but Sales owns binding Quote, preserve that boundary:

- Catalog can resolve commercial facts;
- Sales Quote remains binding snapshot authority.

---

## 39. Quote integration

If Step 1.8C requires Quote to use date-specific pricing, integrate minimally and server-authoritatively.

The client must not submit the authoritative resolved amount.

Quote should resolve from:

- canonical Rate Plan;
- service date(s);
- applicable period rules;
- availability eligibility.

Then freeze the resulting amount/currency according to existing Quote semantics.

Do not reprice frozen Quote later.

---

## 40. Legacy Quote compatibility

Legacy Rate Plans without CommercialPeriods must continue to quote using existing base/FIXED behavior.

No period row may become mandatory.

---

## 41. Multi-date pricing

If a service spans multiple service dates and the current Roadmap requires per-date pricing, define aggregation precisely.

Example Hotel:

- Jul 10 → 190
- Jul 11 → 190
- Jul 12 holiday → 250

Stay total should derive deterministically from applicable date prices and Rate Plan basis.

Do not guess aggregation semantics for categories whose duration/basis model is not yet authoritative.

If required aggregation cannot be derived from current basis/date model:

`ARCHITECTURE DECISION REQUIRED`.

---

# PART J — PUBLIC READ MODEL

## 42. Public `priceFrom`

Update public price surfaces only as required by the canonical model.

With periods, `priceFrom` semantics must be explicit.

Do not silently change it to an arbitrary minimum across all historical/future periods.

Determine from Roadmap whether it means:

- current applicable price;
- lowest future available price;
- base price;
- other canonical window.

If Roadmap already defines it, implement exactly.

If it does not and implementation choice materially changes Marketplace ranking/customer expectations:

`ARCHITECTURE DECISION REQUIRED`.

---

## 43. POR public behavior

Preserve 1.8B reviewed semantics:

- POR may remain visible as inquiry-only;
- it must not contribute numeric `priceFrom`;
- it must not sort as zero;
- it must not create binding Quote.

---

## 44. Unavailable period public behavior

A Rate Plan with a price but unavailable for requested dates must not be presented as bookable for those dates.

Do not erase the price fact merely because availability is false.

---

# PART K — HISTORY / AUDIT / CONCURRENCY

## 45. CommercialPeriod history

Follow established Catalog history conventions.

Record meaningful facts such as:

- created;
- updated;
- deleted/archived if lifecycle uses soft state;
- price changed;
- date range changed;
- availability/stop-sell changed.

Do not dump unbounded request bodies.

---

## 46. Audit

Use SecurityService/audit conventions.

Audit must identify:

- actor;
- action;
- target;
- correlation/request context where standard.

No PII or giant annual-calendar dumps.

---

## 47. Lost-update protection

Do not repeat previously fixed 1.8A/1.8B lost-update defects.

Concurrent edits to the same CommercialPeriod must not silently overwrite each other.

Use repository-standard optimistic version/CAS or equivalent canonical mechanism.

Stale update → deterministic conflict.

---

## 48. Period conflict race

Two concurrent requests must not both create equal-specificity conflicting rules that violate canonical overlap constraints.

DB constraints alone may be insufficient for date-range overlap.

Use transaction/locking/advisory/exclusion strategy only if compatible with current architecture.

Prove with controlled concurrency E2E.

---

## 49. Bulk atomicity

If bulk annual-calendar mutation exists:

- all rows commit;
or
- none commit.

History/audit must match committed result only.

---

# PART L — MIGRATION

## 50. Migration requirements

Migration must be:

- additive;
- fresh-deploy-safe;
- replayable;
- no `db push`;
- no destructive Tariff rewrite;
- no fabricated CommercialPeriods for legacy tariffs;
- no fake yearly backfill;
- correct FK actions;
- indexed for actual resolver queries.

---

## 51. Legacy/null semantics

Existing Rate Plans may have zero CommercialPeriods.

That means:

> no period-specific override exists.

It must not mean corrupt data.

Legacy base pricing remains valid.

---

## 52. Index review

At minimum evaluate query paths around:

- tariffId;
- date range applicability;
- status;
- exact-date overrides;
- seller/parent scope through Tariff;
- resolver ordering.

Do not add speculative indexes unrelated to actual queries.

---

# PART M — REQUIRED TEST MATRIX

## 53. Unit tests

Add focused validation/resolution tests for at least:

- date parsing;
- start/end validation;
- Decimal;
- overlap/specificity;
- exact-date precedence;
- fallback to base price;
- POR;
- category condition allowlist;
- availability/sellability separation;
- malformed payload;
- forbidden keys.

---

## 54. Targeted E2E — minimum scenarios

Create a dedicated Step 1.8C E2E suite.

At minimum prove:

1. Seller creates broad seasonal period for own Rate Plan.
2. Cross-Seller Rate Plan denied.
3. Legacy Rate Plan with no periods still works.
4. Full-year period accepted.
5. One-day exact override accepted.
6. Invalid reverse date range rejected.
7. Exact-date override wins broad season.
8. Narrow holiday range wins broad season.
9. Equal-specificity conflict handled deterministically.
10. Base Tariff price fallback when no period applies.
11. Rate Plan currency inherited; client cannot forge period currency.
12. Decimal price validation.
13. Zero price remains zero, not missing/unavailable.
14. POR cannot become bindable improperly.
15. Period price does not mutate Tariff base price.
16. Period availability does not delete period price.
17. unavailable requested date is not bookable.
18. available requested date remains eligible.
19. no AvailabilityReservation side effect from calendar CRUD.
20. no Quote/Sale/Order side effect from calendar CRUD.
21. Quote for applicable date uses resolved period price if Step 1.8C owns Quote integration.
22. Quote outside periods uses base price.
23. frozen Quote does not change after later period edit.
24. legacy Quote remains compatible.
25. Product/ServiceUnit/RatePlan parent eligibility enforced.
26. archived Rate Plan cannot produce new binding price.
27. archived/ineligible ServiceUnit does not produce bookable result.
28. cross-category Hotel scenario.
29. Tour scenario.
30. Transfer scenario.
31. Excursion/Activity scenario where taxonomy exists.
32. Car Rental scenario.
33. leap-day behavior.
34. year-boundary behavior.
35. concurrent stale PATCH → one conflict/no lost update.
36. concurrent conflicting period create cannot create nondeterministic state.
37. bulk mutation atomicity if bulk endpoint implemented.
38. multi-date availability compatibility/atomic hold behavior exactly as Roadmap requires.
39. no 1.8D restriction engine created.
40. no time-slot/timezone model created.
41. public POR remains non-numeric.
42. public requested-date price/read model behaves canonically.
43. migration replay/drift clean.
44. no PII/security leakage in history/audit.

Do not chase a number if one scenario legitimately proves several requirements, but report exact coverage.

---

# PART N — FULL REGRESSION

## 55. Backend

Run repository-standard:

- TypeScript compile;
- unit tests;
- Step 1.8C targeted E2E;
- Step 1.8B;
- Step 1.8A;
- Catalog/Product/CategorySchema;
- legacy Tariff;
- Availability;
- Reservation/hold;
- Quote;
- Checkout;
- Sale;
- Order;
- Reverse 2.2A–2.2F;
- Step 2.4;
- Step 2.5/2.5A/2.5B;
- RBAC/security;
- full serial E2E.

Report exact counts.

---

## 56. Frontend

Even if frontend is untouched:

- tsc;
- vitest;
- production build.

Report exact counts.

---

## 57. Database

Run:

- migrate status;
- clean replay;
- drift check.

Report migration count.

---

# PART O — DOCUMENTATION

## 58. Architecture document

Create/update a canonical architecture document for Step 1.8C, e.g.:

`docs/architecture/period-pricing-availability-foundation.md`

It must document:

- ownership;
- hierarchy;
- annual-calendar workflow;
- date semantics;
- overlap precedence;
- base fallback;
- POR;
- currency;
- category conditions;
- pricing vs availability;
- stop-sell;
- multi-date compatibility;
- Quote boundary;
- 1.8D boundary;
- 2.8A time-model boundary;
- concurrency;
- legacy compatibility.

---

## 59. API contract

Update `docs/contracts/api.md` for actual endpoints only.

No speculative API.

---

## 60. IDs

If a new business ID prefix is introduced, register it in `docs/contracts/ids.md`.

Do not introduce a prefix if existing ID conventions say internal UUID is sufficient.

---

## 61. Events

Do not create domain events unless there is an actual current consumer or the Roadmap explicitly requires them.

If no event is needed, document that decision.

---

## 62. Roadmap

At implementation completion only, set:

`STEP 1.8C IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Do **not** mark DONE/APPROVED.

Update `CURRENT CANONICAL EXECUTION SEQUENCE`:

- active item becomes `Step 1.8C STRICT REVIEW`;
- 1.8D remains blocked/not started.

---

# PART P — ARCHITECTURE STOP CONDITIONS

## 63. Return `ARCHITECTURE DECISION REQUIRED` if any of these are unresolved

- CommercialPeriod ownership conflicts with existing Catalog/Availability ownership.
- Roadmap does not define overlap precedence and different choices change customer price.
- `priceFrom` with future periods lacks authoritative semantics and must be changed now.
- period availability conflicts with canonical Availability/inventory truth.
- multi-date hold requirement cannot be implemented/kept compatible without changing Booking ownership.
- category duration/occupancy/PAX aggregation is required but not defined.
- exact-time/timezone pricing becomes necessary before Step 2.8A.
- POR + period price semantics are ambiguous and materially affect bindability.
- currency would need to vary per period.
- a second pricing authority appears necessary.

Ordinary coding bugs do not require ADR.

---

# PART Q — STRICT OUT OF SCOPE

## 64. Do not implement

Unless the latest Roadmap explicitly moved them into 1.8C, do not implement:

- Step 1.8D full restrictions engine;
- arbitrary rule DSL;
- dynamic/yield pricing;
- AI pricing;
- competitor pricing;
- supplier/channel-manager integrations;
- display FX engine;
- time-slot/exact departure/timezone-aware model before 2.8A;
- contact disclosure;
- Reverse changes;
- Payment/Settlement changes;
- frontend annual calendar UI;
- Step 2.6.

---

# PART R — REQUIRED FINAL REPORT

## 65. Final report format

Return:

# PHASE 1 — STEP 1.8C — PERIOD PRICING & PERIOD AVAILABILITY FOUNDATION — ОТЧЁТ

1. Verdict  
2. Repository baseline  
3. Sources inspected  
4. Roadmap / DD compliance  
5. Current → target mapping  
6. Domain ownership  
7. Canonical hierarchy  
8. CommercialPeriod schema  
9. Annual-calendar workflow  
10. Date-only semantics  
11. Date boundary semantics  
12. Currency authority  
13. Base price fallback  
14. POR interaction  
15. Overlap policy  
16. Specificity / precedence  
17. Exact-date overrides  
18. Same-specificity conflicts  
19. Category-dependent conditions  
20. PriceBasis separation  
21. Pricing vs Availability  
22. Existing Availability integration  
23. Stop-sell semantics  
24. Capacity/inventory boundary  
25. Multi-date hold compatibility  
26. Seller workflow/API  
27. Bulk mutation semantics  
28. Ownership / RBAC  
29. IDOR  
30. Mass assignment  
31. Money/Decimal validation  
32. Resolver behavior  
33. Resolver ownership  
34. Quote integration  
35. Legacy Quote compatibility  
36. Multi-date pricing behavior  
37. Public price/read-model behavior  
38. POR public behavior  
39. Unavailable-date public behavior  
40. Lifecycle / parent eligibility  
41. History  
42. Audit  
43. Concurrency / CAS  
44. Conflict race handling  
45. Bulk atomicity  
46. Migration  
47. Legacy/null semantics  
48. Indexes/query paths  
49. Hotel validation  
50. Tour validation  
51. Transfer validation  
52. Excursion/Activity validation  
53. Car Rental validation  
54. Targeted tests  
55. Full backend regression  
56. Frontend regression  
57. Migration replay/drift  
58. Runtime verification  
59. Issues found/fixed  
60. Documentation changes  
61. Events/outbox status  
62. Architecture decision status  
63. Deferred work  
64. Roadmap update  
65. Exact files changed  
66. Out-of-scope confirmation  
67. Exact NEXT item

Final verdict must be one of:

- `PHASE 1 STEP 1.8C IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
- `PHASE 1 STEP 1.8C BLOCKED — ARCHITECTURE DECISION REQUIRED`
- `PHASE 1 STEP 1.8C IMPLEMENTATION INCOMPLETE — CHANGES REQUIRED`

---

## 66. STOP

After implementation and regression:

**STOP.**

Do not perform Step 1.8C STRICT REVIEW in the same pass.

Do not start Step 1.8D.

If successful, final line:

`PHASE 1 STEP 1.8C IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
