# PHASE 1 — STEP 1.8B — TARIFF → CANONICAL RATE PLAN FOUNDATION

**Project:** TravelHub  
**Phase:** 1  
**Step:** 1.8B  
**Mode:** IMPLEMENTATION  
**Previous approved gate:** `UNIVERSAL PRICING MODEL AMENDMENT STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`  
**Canonical NEXT:** `PHASE 1 — STEP 1.8B — TARIFF → CANONICAL RATE PLAN FOUNDATION`  
**Next after completion:** STOP and wait for separate STRICT REVIEW

---

# 1. MISSION

Extend the existing `Tariff` model into the **single canonical Rate Plan foundation** for TravelHub.

Do NOT create a parallel `RatePlan` entity.

The approved canonical commercial graph is:

`Product`
→ `ServiceUnit`
→ `Tariff / Rate Plan`
→ `CommercialPeriod / Pricing Rule`
→ resolved authoritative price

Step 1.8B owns the Rate Plan foundation only.

Step 1.8B must implement the structural/commercial semantics required so Step 1.8C can later add annual/seasonal/date-based pricing without redesign.

Hard invariants:

- `Tariff IS the canonical Rate Plan foundation`
- `ServiceUnit ≠ Rate Plan`
- `Rate Plan ≠ CommercialPeriod`
- one canonical commercial currency per Rate Plan
- Seller-defined Rate Plan name preserved verbatim
- legacy Tariff price remains a truthful base/FIXED fallback
- Proposal pricing remains unrelated/non-binding Reverse data
- no second pricing authority
- no CommercialPeriod implementation yet
- no annual/seasonal calendar implementation yet
- no Availability redesign yet
- no second hold engine
- pricing remains Catalog-owned

---

# 2. CANONICAL SOURCES — READ FIRST

Before changing code inspect latest repository truth:

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- `CURRENT CANONICAL EXECUTION SEQUENCE`
- `TRAVELHUB_DEFERRED_DECISIONS_MAP.md`
- DD-024
- DD-026
- DD-027
- DD-029
- `docs/architecture/universal-pricing-model.md`
- `docs/architecture/service-templates-decision-gates.md`
- Step 1.8A implementation + Strict Review
- ADR-0001
- existing `Tariff`
- `Product`
- `ServiceUnit`
- `Category`
- `CategorySchema`
- `Availability`
- `AvailabilityReservation`
- Quote / QuoteItem
- CheckoutIntent
- Sale
- current Catalog APIs/services/permissions
- IDs contracts
- audit/history conventions
- migration conventions
- existing Tariff tests
- existing Quote/Checkout tests

If prompt wording conflicts with the accepted Universal Pricing review or Roadmap, accepted canonical docs win.

---

# 3. DO NOT REOPEN UNIVERSAL PRICING

Universal Pricing Model is already approved.

Do NOT redesign:

- annual/seasonal pricing;
- date overrides;
- DAY_OF_WEEK specificity;
- overlap resolution;
- occupancy/PAX semantics;
- CommercialPeriod;
- missing-price semantics;
- multi-date availability;
- multi-currency authority;
- Step 2.8A timing boundary.

This step creates the Rate Plan foundation those later mechanisms depend on.

---

# 4. OWNERSHIP — HARD GATE

Rate Plan remains in:

`catalog.*`

Existing Tariff is the owner object.

Do NOT introduce:

- `sales.RatePlan`
- `reverse.RatePlan`
- `booking.RatePlan`
- `order.RatePlan`
- second Catalog pricing aggregate representing the same concept

No cross-domain writes.

If existing Tariff cannot safely be extended in Catalog without duplicate authority:

`ARCHITECTURE DECISION REQUIRED`

---

# 5. TARIFF → RATE PLAN

The implementation must extend current Tariff rather than replace it.

Preserve legacy compatibility.

The resulting Tariff/Rate Plan must conceptually represent:

- Seller-defined commercial plan name;
- parent Product;
- optional/new canonical ServiceUnit attachment;
- one commercial currency;
- price basis;
- refundability;
- cancellation-policy reference/foundation;
- inclusions/meal plan where category permits;
- restrictions metadata/foundation;
- PRICE_ON_REQUEST foundation;
- legacy/base fixed price compatibility;
- future CommercialPeriod compatibility.

Do not make Tariff itself a period row.

---

# 6. SERVICEUNIT RELATION

Step 1.8B owns the Tariff ↔ ServiceUnit relation.

Implement a legacy-safe relation, conceptually:

`Tariff.serviceUnitId`

Requirements:

- additive;
- nullable for legacy Tariffs if necessary;
- server-authoritative;
- ServiceUnit must belong to the same Product;
- ServiceUnit must belong to the same Seller/Partner ownership scope;
- client cannot attach Tariff to another Seller's ServiceUnit;
- no cross-Product mismatch;
- legacy Product-only Tariffs remain readable/valid.

Do not require destructive backfill.

---

# 7. LEGACY TARIFF COMPATIBILITY

Existing Tariff fields such as:

- price
- currency
- validFrom
- validTo

must be reviewed carefully.

Approved transition:

- existing `Tariff.price` remains a truthful Seller-entered base/FIXED price;
- after 1.8C, CommercialPeriod facts become authoritative where applicable;
- if no applicable CommercialPeriod exists and Rate Plan is eligible for base/FIXED pricing, legacy/base Tariff price may act as fallback;
- no fabricated price;
- no destructive migration.

Document exact semantics.

Do not silently repurpose legacy `validFrom/validTo` as CommercialPeriod stay dates if they currently mean a broader validity window.

---

# 8. SELLER-DEFINED RATE PLAN NAME

Seller name must be preserved verbatim, with only safe trim if repository convention allows.

Examples:

- `Room Only — Refundable`
- `Breakfast Included — Non-refundable`
- `Private Transfer`
- `Premium Tour`
- `Daily Flexible Rate`

Do not auto-normalize into taxonomy names.

Do not translate or rewrite Seller wording.

---

# 9. RATE PLAN IDENTITY

Review whether existing Tariff already has a business code.

If yes:
- preserve it;
- do not create a second Rate Plan prefix.

If no:
- introduce one only if repository conventions require user-facing business IDs.

Do not create both Tariff code and RatePlan code.

ID authority must remain server-side.

---

# 10. COMMERCIAL CURRENCY

Hard invariant:

> one canonical commercial currency per Rate Plan

Implement currency as authoritative Rate Plan-level fact.

Requirements:

- ISO currency validation;
- immutable or tightly controlled once published/commercially used according to Catalog convention;
- CommercialPeriods in 1.8C inherit this currency;
- periods must not casually mix currencies;
- future display FX does not alter binding currency.

Do not implement FX.

---

# 11. PRICE BASIS FOUNDATION

Implement Rate Plan-level price-basis foundation.

Approved semantic contract must support concepts equivalent to:

- PER_UNIT
- PER_ROOM
- PER_PERSON
- PER_NIGHT
- PER_DAY
- PER_HOUR
- PER_TRIP
- PER_SERVICE
- PACKAGE_TOTAL

However the Strict Review clarified:

> price basis is a single semantic tag, while quantity and duration are separate dimensions.

Do NOT implement ambiguous compound strings like:

`PER_ROOM_PER_NIGHT`

unless repository design explicitly requires a normalized internal structure.

Example:

100 per room per night

may be represented semantically as:
- basis = PER_NIGHT
- unit quantity = 1 room
- duration = 3 nights

The exact physical enum may be finalized here, but must align with the approved semantic contract.

---

# 12. CATEGORY-SPECIFIC BASIS ALLOWLIST

Not every Category should allow every basis.

Use CategorySchema/category-owned rules where appropriate.

Examples:

Hotel:
- PER_NIGHT
- PER_ROOM
- possibly PACKAGE_TOTAL

Transfer:
- PER_TRIP
- PER_SERVICE

Car Rental:
- PER_DAY

Excursion:
- PER_PERSON

Do not hardcode all category rules directly inside a monolithic Tariff service if CategorySchema already owns commercial metadata.

If CategorySchema must be extended to express allowed bases, do so only if Roadmap supports it and keep ownership in Catalog.

---

# 13. REFUNDABILITY

Add/refine a canonical Rate Plan refundability semantic.

Possible concept:
- refundable
- non-refundable
- partially/refund-policy-driven

Do not invent a second cancellation engine.

If exact refundability enum is premature, prefer minimal explicit semantics aligned with existing cancellation policy architecture.

Do not let free-text alone determine binding refundability.

---

# 14. CANCELLATION POLICY FOUNDATION

Rate Plan may reference a cancellation policy.

Inspect whether Catalog/Sales already has a canonical cancellation-policy concept.

If yes:
- reference/reuse it.

If no:
- implement only a minimal reference/foundation if Roadmap explicitly requires it;
- otherwise defer actual policy engine to 1.8D.

Do not create a full restriction/cancellation engine here.

If ownership cannot be determined:

`ARCHITECTURE DECISION REQUIRED`

---

# 15. INCLUSIONS / MEAL PLAN

Rate Plan may contain category-specific inclusions.

Hotel examples:
- Room Only
- Breakfast Included
- Half Board
- Full Board

Tour examples:
- transfers included
- meals included
- guide included

Do not create hotel-only global mandatory fields.

Prefer:
- CategorySchema-driven inclusion dimensions;
- structured canonical attributes;
- optional normalized refs where taxonomy exists.

Seller display name remains separate.

---

# 16. RESTRICTIONS FOUNDATION

Step 1.8B may store restriction metadata/foundation.

Examples:
- minimum stay
- maximum stay
- advance booking requirement
- closed-to-arrival/departure flags
- occupancy restrictions

But actual behavior/enforcement belongs to 1.8D unless Roadmap explicitly says otherwise.

Do not merge restrictions into Availability counters.

Do not implement a rules engine here.

---

# 17. PRICE_ON_REQUEST FOUNDATION

Approved model distinguishes:

1. normal priced Rate Plan;
2. intentional inquiry-only Rate Plan;
3. accidental/missing price gap.

Step 1.8B must create an explicit foundation for intentional Rate Plan-level `PRICE_ON_REQUEST`.

Hard invariant:

`missing price != PRICE_ON_REQUEST`

Do not infer PRICE_ON_REQUEST from null price alone.

Possible implementation:
- explicit pricingMode / priceAvailabilityMode;
- explicit boolean/state;
- another canonical representation consistent with Universal Pricing docs.

Do not overfreeze future 1.8C period-level inquiry-only semantics.

---

# 18. BASE/FIXED PRICE FOUNDATION

Preserve a canonical fixed/base price path.

A Rate Plan should support simple Sellers that only need one price.

Example:

`Sedan Transfer — 35 AZN per trip`

This must not require CommercialPeriod creation.

Legacy Tariff.price may satisfy this foundation.

Do not convert fixed pricing into artificial daily periods.

---

# 19. NO COMMERCIALPERIOD YET

Strict prohibition:

Do NOT implement:

- CommercialPeriod model;
- period rows;
- annual calendar;
- seasonal calendar;
- date overrides;
- date-specific price tables;
- weekday/weekend rules;
- occupancy-specific price rows;
- duration tiers;
- source precedence engine;
- resolver.

Those belong to Step 1.8C.

---

# 20. NO PRICING RESOLVER YET

Do not implement final universal `resolvePrice(...)` in 1.8B.

You may create internal helper semantics needed for validating Rate Plan fields only.

Step 1.8C owns actual period/rule resolution.

---

# 21. NO AVAILABILITY REDESIGN

Do not modify availability ownership/mechanics except the minimum structural compatibility if absolutely required.

No:
- new hold engine;
- new multi-date reservation behavior;
- ServiceUnit inventory counters;
- RatePlan-owned availability engine.

Existing Step 2.4 remains canonical.

---

# 22. PRODUCT / SERVICEUNIT / TARIFF CONSISTENCY

Hard validation:

If Tariff.serviceUnitId exists:

- ServiceUnit.productId == Tariff.productId
- ServiceUnit.partnerId == Product.partnerId
- Seller owns/manage Product/ServiceUnit
- no foreign ServiceUnit attachment
- no archived/ineligible unit attachment if Catalog policy forbids it

Server must validate these relationships.

Do not trust client IDs.

---

# 23. LEGACY PRODUCT-ONLY TARIFFS

Legacy Tariffs without ServiceUnit must remain valid.

Do not force every existing Tariff into a fabricated ServiceUnit.

Step 1.8B migration must be additive.

If Product later gains units, legacy Tariffs may remain Product-level until explicit Seller migration/reconciliation.

Document this honestly.

---

# 24. RATE PLAN LIFECYCLE

Inspect existing Tariff lifecycle/status model.

If Tariff currently lacks lifecycle:
- determine whether 1.8B should add a minimal DRAFT/PUBLISHED/ARCHIVED-like lifecycle consistent with Catalog;
- or reuse Product/ServiceUnit publication constraints.

Do not invent a second moderation engine.

Any publication behavior must align with:
- Product state;
- ServiceUnit state;
- Catalog moderation rules.

If Rate Plan publication lifecycle is already implied by parent publication, document and reuse it.

---

# 25. PUBLICATION ELIGIBILITY

A publicly usable Rate Plan must not exist under an ineligible parent chain.

Conceptually:

Product eligible
AND
ServiceUnit eligible if attached
AND
Rate Plan eligible

Do not expose a Tariff attached to archived/private ServiceUnit as public/bindable.

If public Tariff APIs exist, enforce parent chain server-side.

---

# 26. MUTABILITY

Define safe edit rules.

Protect immutable:
- seller/partner;
- product ownership;
- business code;
- source ownership;
- historical provenance.

Controlled mutable fields may include:
- Seller-defined Rate Plan name;
- refundability;
- inclusions;
- cancellation policy ref;
- restrictions metadata;
- price basis;
- fixed/base price;
- PRICE_ON_REQUEST mode.

If published/commercially-used Tariffs require restricted edits or re-publication, follow existing Catalog conventions.

Do not mutate downstream frozen Quote/Sale facts.

---

# 27. API SURFACE

Implement only minimum Rate Plan management consistent with existing Catalog API.

Potential capabilities:

- create Tariff/Rate Plan under Product / ServiceUnit;
- list Rate Plans;
- get Rate Plan;
- update;
- publish/archive if lifecycle belongs here.

Do not create pricing calendar endpoints.

Do not create period pricing endpoints.

Do not add public resolver API.

---

# 28. RBAC

Reuse/extensively align with existing Catalog permissions.

Seller/Partner:
- own Product/ServiceUnit/Rate Plan only.

Staff/Admin:
- according to Catalog conventions.

Moderator:
- according to existing moderation model.

Do not create redundant permissions unless needed.

If new permission is required, name consistently and document.

---

# 29. MASS ASSIGNMENT

Client must not forge:

- id;
- code;
- partnerId;
- sellerId;
- product owner;
- serviceUnit owner;
- business status outside lifecycle action;
- currency if server-derived in a specific path;
- category;
- schema version;
- audit fields;
- createdAt/updatedAt;
- CommercialPeriod fields;
- acquisitionSource;
- Quote/Sale refs;
- availability;
- reservation;
- pricing source authority if not public-settable.

Use strict forbidden-key conventions.

---

# 30. VALIDATION

Validate:

- ServiceUnit/Product relationship;
- name length/content;
- currency;
- basis enum;
- base price Decimal precision/range;
- refundability state;
- structured inclusions;
- restrictions metadata;
- PRICE_ON_REQUEST consistency;
- null semantics;
- no contradictory base price + inquiry-only state if canonical contract forbids it.

No JS float as canonical money.

---

# 31. MONEY / DECIMAL

Review current Tariff price storage.

Use Decimal.

Define:
- precision;
- scale;
- non-negative constraints;
- zero semantics.

Do not use zero to mean:
- missing price;
- PRICE_ON_REQUEST.

If zero is a legitimate free service price, represent it explicitly as zero and distinguish from null/missing.

---

# 32. LEGACY `validFrom/validTo`

Review current Tariff temporal fields.

Strict requirement from Universal Pricing review:

Legacy Tariff.validFrom/validTo are NOT silently reinterpreted as stay-date CommercialPeriods if their current meaning is broader commercial/booking validity.

Document actual meaning.

If needed, rename only if migration-safe and Roadmap supports it.

Prefer compatibility over destructive semantic rewrite.

---

# 33. HISTORY / AUDIT

Follow existing Catalog conventions.

Record meaningful Rate Plan facts such as:
- created;
- updated;
- attached to ServiceUnit;
- publication state changes;
- archive.

Do not dump sensitive/unbounded structures into audit.

No failed-action history.

No duplicate no-op history.

---

# 34. EVENTS / OUTBOX

Do not invent RatePlan events without real consumers.

If existing Catalog publication event patterns require it, reuse them.

No speculative event solely because a new semantic foundation exists.

---

# 35. QUOTE COMPATIBILITY

Existing Quote flows may read Tariff.

This is a critical regression area.

Ensure:
- legacy Quote creation continues to work;
- Tariff price remains available as base/fixed price;
- new Rate Plan fields do not break Quote snapshot;
- Quote does not yet depend on CommercialPeriod;
- binding price semantics remain unchanged until 1.8C explicitly extends resolution.

Do not silently change production pricing of existing Quotes.

---

# 36. CHECKOUT / SALE COMPATIBILITY

No change to:
- Checkout pricing authority;
- Sale snapshot;
- OrderRequested money;
- Order snapshot.

Step 1.8B only extends Catalog semantics.

No repricing.

---

# 37. REVERSE MARKETPLACE COMPATIBILITY

Reverse SellerProposal remains non-binding.

Do not wire SellerProposal directly to Rate Plan pricing.

Capability ≠ Product/ServiceUnit/Tariff.

No Reverse writes into Catalog Rate Plans.

---

# 38. CROSS-CATEGORY VALIDATION

Implementation must work for:

## Hotel
ServiceUnit:
`Premium Double Ocean Side`

Rate Plans:
- `Room Only — Refundable`
- `Breakfast Included — Non-refundable`

## Tour
ServiceUnit:
`Premium Tour Package`

Rate Plans:
- `Standard`
- `Premium`
- `Private`

## Transfer
ServiceUnit:
`Minivan`

Rate Plan:
- `Private Transfer`

## Excursion
Rate Plan with per-person basis and category-driven inclusion semantics.

## Car Rental
Rate Plan with per-day basis.

No global hotel-only fields.

---

# 39. MIGRATION

Migration must be additive and legacy-safe.

Potential changes:
- Tariff.serviceUnitId nullable
- currency refinements
- price basis
- refundability
- inquiry/PRICE_ON_REQUEST state
- structured metadata
- indexes

Rules:
- no fabricated ServiceUnit mapping;
- no destructive rewrite of existing Tariffs;
- no forced backfill to new business semantics unless truthful;
- no `db push`;
- clean replay;
- drift 0.

---

# 40. INDEXES

Review query paths:

- Product → Tariffs
- ServiceUnit → Rate Plans
- partner/owner scoped lists
- status
- code
- maybe currency

Avoid speculative analytics indexes.

No duplicate index where unique constraint already covers query.

---

# 41. CONCURRENCY

Test meaningful races:

- duplicate create under same external identity if any;
- update vs publish;
- ServiceUnit archive vs Rate Plan attach/publish;
- Product archive vs Rate Plan publish;
- concurrent update to price/mode;
- conflicting inquiry-only vs fixed-price updates.

If Catalog has no CAS/version convention, use status-conditional atomic updates consistent with 1.8A.

Do not invent inconsistent concurrency rules.

---

# 42. REQUIRED UNIT TESTS

At minimum:

- name preservation;
- currency validation;
- basis validation;
- Product/ServiceUnit relationship validation;
- PRICE_ON_REQUEST consistency;
- Decimal validation;
- forbidden keys;
- structured inclusions/restrictions validation.

---

# 43. REQUIRED E2E TESTS

At minimum prove:

1. Seller creates Rate Plan under own Product/ServiceUnit.
2. Seller-defined name preserved verbatim.
3. business identity server-owned.
4. foreign Product denied.
5. foreign ServiceUnit denied.
6. ServiceUnit must belong to same Product.
7. legacy Product-only Tariff remains valid.
8. nullable serviceUnitId supports legacy.
9. fixed/base price works without CommercialPeriod.
10. PRICE_ON_REQUEST is explicit, not inferred from null.
11. zero price remains distinguishable from missing/POR.
12. one currency per Rate Plan.
13. invalid currency rejected.
14. valid price basis accepted.
15. invalid basis rejected.
16. category-incompatible basis rejected where CategorySchema rules exist.
17. refundability semantics persist.
18. inclusions/meal plan category-driven.
19. cancellation/restriction foundation persists.
20. no CommercialPeriod rows exist.
21. no annual/seasonal pricing implemented.
22. no Availability mutation.
23. no AvailabilityReservation mutation.
24. no Reverse mutation.
25. no Quote/Checkout/Sale/Order/Booking side effects on Rate Plan create/update.
26. existing Quote creation with legacy Tariff remains green.
27. cross-category Hotel fixture.
28. Tour fixture.
29. Transfer fixture.
30. Car Rental or Excursion fixture.
31. publish/parent eligibility if lifecycle implemented.
32. update/archive concurrency.
33. pagination/deterministic ordering.
34. migration replay/drift.

One test may cover multiple invariants.

---

# 44. FULL REGRESSION

Run:

## Backend

- tsc
- unit
- Step 1.8B targeted E2E
- Step 1.8A
- Product/CategorySchema
- Tariff legacy tests
- Availability
- Step 2.4
- Quote
- Checkout
- Sale
- Reverse 2.2A–2.2F
- Step 2.5/2.5A/2.5B
- RBAC/security
- full serial E2E

## Frontend

Even if no UI changes:
- tsc
- vitest
- production build

## DB

- migrate status
- clean replay
- drift 0

Report exact counts.

---

# 45. RUNTIME VERIFICATION

Use real AppModule/E2E runtime.

Demonstrate:

`Seller Product → ServiceUnit → Tariff/Rate Plan`

for at least:
- Hotel
- non-Hotel category

and verify:
- base/fixed price path;
- PRICE_ON_REQUEST path;
- no CommercialPeriod;
- no Availability side effects;
- legacy Quote compatibility.

---

# 46. DOCUMENTATION

Create/update canonical architecture doc such as:

`docs/architecture/rate-plan-foundation.md`

Document:

- Tariff = Rate Plan foundation;
- ServiceUnit relation;
- legacy compatibility;
- Seller-defined name;
- currency;
- basis;
- refundability;
- cancellation/inclusions/restriction foundation;
- PRICE_ON_REQUEST;
- legacy/base price;
- no CommercialPeriod yet;
- future 1.8C relation;
- pricing ≠ availability.

Update:
- API contract if endpoints changed;
- IDs contract if needed;
- Roadmap.

---

# 47. ROADMAP UPDATE

Only after implementation + green regression:

Set:

`Step 1.8B IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Active item:

`Step 1.8B STRICT REVIEW`

Do not mark 1.8B approved.

Do not start 1.8C.

---

# 48. ARCHITECTURE STOP CONDITIONS

STOP with:

`ARCHITECTURE DECISION REQUIRED`

if implementation proves:

- Tariff cannot safely become the sole Rate Plan foundation;
- ServiceUnit relation requires destructive legacy migration;
- current Tariff price cannot coexist safely with future CommercialPeriod;
- cancellation policy ownership is unresolved and blocks Rate Plan;
- CategorySchema cannot govern cross-category commercial metadata;
- 1.8B would require implementing CommercialPeriod or a second pricing authority;
- pricing ownership would need to leave Catalog.

Do not stop for ordinary bugs.

---

# 49. OUT OF SCOPE

Do not implement:

- Step 1.8B STRICT REVIEW;
- Step 1.8C;
- CommercialPeriod;
- annual/seasonal calendar;
- date overrides;
- DAY_OF_WEEK rules;
- occupancy/PAX price rows;
- duration/tier pricing engine;
- final resolver;
- multi-date holds;
- Step 2.8A;
- Partner Cabinet pricing UI;
- import engine;
- supplier/channel-manager integration;
- dynamic pricing;
- FX;
- Step 2.6.

---

# 50. REQUIRED FINAL REPORT

# PHASE 1 — STEP 1.8B — TARIFF → CANONICAL RATE PLAN FOUNDATION — ОТЧЁТ

1. Verdict  
2. Repository baseline  
3. Sources inspected  
4. DD-024 / Universal Pricing compliance  
5. Catalog ownership  
6. Tariff → Rate Plan semantics  
7. ServiceUnit relation  
8. Legacy Tariff compatibility  
9. Seller-defined Rate Plan name  
10. ID strategy  
11. Currency authority  
12. Price basis  
13. Category-specific basis rules  
14. Refundability  
15. Cancellation policy foundation  
16. Inclusions / meal plan  
17. Restrictions foundation  
18. PRICE_ON_REQUEST foundation  
19. Base/FIXED price semantics  
20. Legacy validFrom/validTo semantics  
21. Rate Plan lifecycle  
22. Publication eligibility  
23. Mutability  
24. API surface  
25. RBAC / own-scope  
26. Mass assignment  
27. Validation  
28. Decimal / money semantics  
29. History / audit  
30. Events / outbox  
31. Quote compatibility  
32. Checkout / Sale compatibility  
33. Reverse Marketplace compatibility  
34. Hotel validation  
35. Tour validation  
36. Transfer validation  
37. Excursion validation  
38. Car Rental validation  
39. Migration  
40. Indexes  
41. Concurrency  
42. Targeted tests  
43. Full regression  
44. Runtime verification  
45. Issues found/fixed  
46. Documentation changes  
47. Roadmap update  
48. Architecture decision status  
49. Out-of-scope confirmation  
50. Exact files changed  
51. Exact NEXT item

Final verdict must be exactly one of:

`PHASE 1 STEP 1.8B IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

or

`ARCHITECTURE DECISION REQUIRED`

---

# 51. STOP

After implementation and validation:

**STOP.**

Do not perform 1.8B STRICT REVIEW in the same pass.

Do not start 1.8C.

Wait for a separate 1.8B STRICT REVIEW prompt.
