# UNIVERSAL PRICING MODEL AMENDMENT — STRICT REVIEW

**Project:** TravelHub  
**Mode:** STRICT REVIEW / DOCUMENTATION REVIEW / REVIEW FIXES ONLY  
**Entering status:** `UNIVERSAL PRICING MODEL AMENDMENT COMPLETED — WAITING FOR STRICT REVIEW`  
**Previous approved implementation:** `PHASE 1 STEP 1.8A STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`  
**Blocked implementation:** `Step 1.8B`  
**Exact NEXT if approved:** `PHASE 1 — STEP 1.8B — TARIFF → CANONICAL RATE PLAN FOUNDATION`

---

## 1. Mission

Perform an adversarial STRICT REVIEW of the integrated Universal Pricing Model Amendment.

Do **not** approve from the amendment report alone.

Inspect repository truth and verify that the amendment creates a coherent, universal, deterministic and implementation-ready pricing architecture for TravelHub before Step 1.8B begins.

This review is documentation-only except for documentation review fixes.

The review must prove that the architecture can support real Seller pricing workflows across multiple service categories, especially:

- fixed pricing;
- annual/seasonal price calendars;
- holiday/event overrides;
- weekday/weekend pricing;
- occupancy/PAX pricing;
- duration pricing;
- tier/group pricing;
- intentional PRICE_ON_REQUEST;
- future supplier/API/channel-manager pricing;
- future dynamic/revenue-management pricing;

without creating:

- a second pricing authority;
- Hotel-only architecture;
- frontend pricing authority;
- fabricated future prices;
- ambiguity between Pricing, Availability and Reservation/Hold;
- ambiguity between Product, ServiceUnit, Rate Plan and CommercialPeriod;
- unsafe overlap/precedence behavior;
- premature implementation of Step 1.8B/1.8C.

Final verdict must be exactly one of:

- `UNIVERSAL PRICING MODEL AMENDMENT STRICT REVIEW COMPLETED — APPROVED`
- `UNIVERSAL PRICING MODEL AMENDMENT STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `UNIVERSAL PRICING MODEL AMENDMENT STRICT REVIEW COMPLETED — CHANGES REQUIRED`
- `ARCHITECTURE DECISION REQUIRED`

---

# PART A — EXECUTION / BASELINE

## 2. Execution-sequence gate

Verify current sequence from the canonical Roadmap:

`1.8A APPROVED`
→ `Universal Pricing Model Amendment COMPLETED`
→ `Universal Pricing Model Amendment STRICT REVIEW`
→ `1.8B`
→ `1.8B STRICT REVIEW`
→ `1.8C`
→ `1.8C STRICT REVIEW`
→ `1.8D`
→ `1.8D STRICT REVIEW`

Step 1.8B must remain BLOCKED during this review.

Do not start:
- Prisma implementation;
- migrations;
- Rate Plan implementation;
- CommercialPeriod;
- pricing resolver;
- availability changes;
- Partner Cabinet UI.

If approved, set exact NEXT to Step 1.8B and STOP.

---

## 3. Repository baseline

Inspect:

- branch;
- HEAD;
- `git status`;
- dirty/untracked files;
- current Roadmap status;
- current Deferred Decisions Map;
- `docs/architecture/universal-pricing-model.md`.

Separate:

1. pre-existing Step 1.8A dirty changes;
2. Universal Pricing Amendment documentation changes;
3. review fixes made during this pass.

Confirm amendment itself changed only documentation.

---

## 4. Sources of truth

Review at minimum:

- `docs/architecture/universal-pricing-model.md`;
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- `TRAVELHUB_DEFERRED_DECISIONS_MAP.md`;
- DD-024…DD-029;
- Service Templates / Period Pricing & Availability amendment;
- Service Templates Decision Gates;
- Step 1.8A architecture/review;
- ADR-0001;
- Step 2.4 reservation/hold architecture;
- Step 2.3 / 2.3A Quote/Checkout binding contracts;
- Step 2.5 Order frozen snapshot contract;
- current Prisma models for Product, ServiceUnit, Tariff, Availability and AvailabilityReservation.

Repository truth wins over the implementation report.

---

# PART B — COMMERCIAL GRAPH

## 5. Canonical graph — HARD GATE

Verify the amendment consistently defines:

`Product`
→ `ServiceUnit`
→ `Tariff / Rate Plan`
→ `CommercialPeriod / Pricing Rule`
→ `resolved authoritative price`

Check all affected Roadmap sections for contradictory older assumptions.

Must be clear that:

- Product ≠ ServiceUnit;
- ServiceUnit ≠ Rate Plan;
- Rate Plan ≠ CommercialPeriod;
- ServiceUnit is not a price row;
- Product is not the final universal price authority once unit/rate-plan pricing applies;
- Rate Plan defines the commercial offer/rules;
- CommercialPeriod/Pricing Rule supplies temporal/conditional price facts.

---

## 6. Tariff → Rate Plan foundation

DD-024 reportedly remains DECIDED.

Verify the amendment does not create a second `RatePlan` concept alongside `Tariff`.

Step 1.8B must explicitly own the extension of existing Tariff into the canonical Rate Plan foundation.

If documents imply both Tariff and RatePlan as separate competing entities, this is a blocker.

---

## 7. ServiceUnit attachment

Verify future Tariff/Rate Plan attachment to ServiceUnit is unambiguous.

Check that:

- ServiceUnit remains structural;
- price is not moved onto ServiceUnit;
- Step 1.8B owns the relation;
- legacy Product/Tariff compatibility has not been silently ignored.

The amendment may defer exact migration strategy to 1.8B, but must not make legacy-safe implementation impossible.

---

# PART C — UNIVERSALITY

## 8. Cross-category architecture — HARD GATE

Verify the model is not Hotel-specific.

It must fit, without changing universal core semantics:

- Hotel / Apartment;
- Tour;
- Transfer;
- Excursion / Activity;
- Car Rental.

Category-specific dimensions belong to CategorySchema/rules.

Reject global mandatory fields such as:
- room occupancy;
- meal plan;
- nights;
- adult/child;
- vehicle capacity

unless explicitly optional/category-governed.

---

## 9. Hotel validation

Prove architecture supports:

ServiceUnit:
`Premium Double Ocean Side`

Rate Plans:
- Room Only — Refundable
- Breakfast Included — Refundable
- Breakfast Included — Non-refundable

Pricing:
- winter;
- spring;
- summer;
- New Year override;
- optional weekend rule;
- optional occupancy dimension.

Availability remains separate nightly inventory.

---

## 10. Tour validation

Prove:

- seasonal pricing;
- package-total or per-person basis;
- Adult/Child/group dimensions where allowed;
- departure/date pricing;
- Standard/Premium/Private Rate Plans.

No forced nightly semantics.

---

## 11. Transfer validation

Prove:

`Minivan → Private Transfer`

can use:
- fixed per-trip price;
- seasonal period;
- event override;
- passenger/group tier.

No room/night assumptions.

---

## 12. Excursion validation

Prove:
- per-person/ticket basis;
- optional Adult/Child dimension;
- seasonal/date price;
- future time-slot support without prematurely bypassing Step 2.8A.

---

## 13. Car Rental validation

Prove:
- per-day basis;
- seasonal price;
- duration tiers;
- holiday override;
- inventory separate from price.

---

# PART D — SELLER PRICING MODES

## 14. Fixed pricing

Verify fixed pricing is genuinely first-class and not forced into artificial daily rows.

A Seller with:

`Airport Transfer / Sedan = 35 AZN per trip`

must have a natural canonical representation.

---

## 15. Annual/seasonal calendar — HARD GATE

This is a core business requirement.

Verify the Roadmap explicitly freezes annual/seasonal calendar pricing as a first-class Seller workflow for **all applicable categories**, not only Hotels.

A Seller with a full yearly tariff must be able conceptually to enter:

- Jan–Mar;
- Apr–May;
- Jun–Aug;
- Sep–Nov;
- December;
- New Year override;

as periods/rules rather than 365 manual rows.

If this is only mentioned in UI notes but not canonical pricing architecture, review fails.

---

## 16. Holiday/event overrides

Verify explicit date/date-range overrides can supersede a base/seasonal price without deleting or rewriting the underlying season.

Examples:
- New Year;
- Formula 1;
- conference;
- festival;
- local peak dates.

---

## 17. Day-of-week semantics

The report says day-of-week is modeled as a condition within a period.

Review this carefully.

Ensure it does not contradict the stated precedence hierarchy.

If `DAY_OF_WEEK` is a condition inside PERIOD, documents must not simultaneously describe it as an independent global precedence layer in a way that yields two interpretations.

Fix wording if needed.

---

## 18. Occupancy/PAX

Verify CategorySchema controls whether dimensions exist.

Avoid universal Adult/Child assumptions.

Review interaction with:
- price basis;
- quantity;
- group tiers;
- specificity.

---

## 19. Duration pricing

Verify compatibility with:
- per night;
- per day;
- per hour;
- per trip;
- per service;
- package total.

Review whether duration tiers are conditions/rules rather than a second pricing engine.

---

## 20. Tier / volume pricing

Verify no ambiguity between:

`1–3 persons = 100 total`

and:

`1–3 persons = 100 per person`.

Price basis and quantity arithmetic must make this explicit.

---

## 21. Lead-time / last-minute pricing

Confirm this remains a future extension point and does not silently become required in initial 1.8B/1.8C.

The initial architecture must remain extensible without becoming a revenue-management engine now.

---

# PART E — PRICE BASIS / ARITHMETIC

## 22. Price basis

Review the conceptual basis list:

- PER_UNIT
- PER_ROOM
- PER_PERSON
- PER_NIGHT
- PER_DAY
- PER_HOUR
- PER_TRIP
- PER_SERVICE
- PACKAGE_TOTAL

Check for semantic overlap.

In particular review whether combinations such as `PER_ROOM` + `PER_NIGHT` require a compound basis or separate dimensions.

Do not approve an enum design that cannot unambiguously express common pricing.

The amendment may leave exact physical enum design to 1.8B, but must freeze the semantic contract.

---

## 23. Quantity/duration arithmetic

Hard requirement:

resolver output must make arithmetic explainable.

Verify conceptual output includes enough to distinguish:
- unit amount;
- basis;
- quantity;
- duration/count;
- total.

No hidden multiplication rules.

---

# PART F — SOURCE / METHOD / PROVENANCE

## 24. Price source ≠ pricing method

Verify clear separation.

Source examples:
- MANUAL;
- IMPORT;
- API_SUPPLIER;
- CHANNEL_MANAGER.

Method examples:
- FIXED;
- PERIOD;
- DATE_OVERRIDE;
- conditional pricing;
- future dynamic rule.

Ensure `IMPORT` is not treated as a pricing formula.

---

## 25. Spreadsheet import

Verify CSV/XLS is only an input mechanism.

No parallel Excel pricing engine.

Imported rows must conceptually reconcile into the same canonical pricing model.

---

## 26. Provenance

Future price resolution must be explainable.

Review whether provenance is sufficient to answer:
- who/source supplied the price;
- which rule/period matched;
- which override won;
- which authoritative amount/currency was used.

Do not overfreeze implementation schema.

---

# PART G — TEMPORAL SEMANTICS

## 27. Date boundaries

Report freezes `validFrom` / `validTo` as date-only inclusive.

Review consistency with existing Tariff and Availability semantics.

Search for exclusive-end assumptions.

If existing contracts conflict, do not silently approve two temporal conventions.

Either reconcile documentation or return architecture/changes required as appropriate.

---

## 28. Commercial timezone

Review the statement that date-only pricing uses service/Product commercial timezone.

Critical question:

Does the current Product/ServiceUnit model actually have a canonical commercial timezone or an authoritative way to derive it?

If not, the amendment must not pretend that this is already solved.

Possible outcomes:
- existing canonical timezone authority exists → document it;
- timezone is only needed at 2.8A → state that clearly;
- unresolved timezone authority blocks exact semantics → architecture decision/deferred gate.

Do not fabricate a timezone field.

---

## 29. Step 2.8A gate

Verify:
- pure date-based period pricing may proceed before 2.8A;
- exact departure/time-slot/timezone-sensitive behavior remains gated by 2.8A where necessary.

No accidental implementation-order contradiction.

---

# PART H — OVERLAPS / PRECEDENCE

## 30. Same-priority overlap — HARD GATE

The report states matching same-priority overlap → 422.

Review whether this is sufficient when pricing dimensions differ.

Example:

Rule A:
`Summer, occupancy ANY`

Rule B:
`Summer, occupancy 2`

These overlap in dates but may be intentionally resolved by specificity.

Therefore distinguish:
- invalid ambiguous overlap;
- valid overlap resolved mechanically by specificity.

The docs must not reject all temporal overlap if conditional specificity intentionally permits it.

---

## 31. Precedence hierarchy — CRITICAL

Reported hierarchy:

1. exact/specific DATE_OVERRIDE;
2. more specific conditional override;
3. seasonal/PERIOD;
4. DAY_OF_WEEK condition;
5. base/FIXED.

But the same report says DAY_OF_WEEK is a condition *inside* a period.

Resolve any conceptual contradiction.

Review whether precedence should instead be represented through:
- rule class;
- condition specificity;
- explicit priority;
- base fallback.

The result must be server-testable and deterministic.

No vague “more specific wins”.

---

## 32. Specificity

Mechanically define enough for future implementation.

Review at least:
- exact date vs range;
- occupancy exact vs ANY;
- PAX tier;
- duration tier;
- weekday condition;
- Rate Plan-scoped rule;
- base fallback.

If two rules have equal specificity and overlap, behavior must be explicit.

---

## 33. Manual override vs automation

Report says authorized manual override may supersede automated sources within scope.

Review whether this is:
- a frozen invariant;
- or merely a future safe principle.

Avoid an undefined situation where:
- supplier API;
- channel manager;
- manual override;
- dynamic engine

all publish competing authoritative rows.

At minimum freeze deterministic source authority/precedence requirement.

Do not invent integrations.

---

# PART I — MISSING PRICE / PRICE ON REQUEST

## 34. No fabricated future price — HARD GATE

Verify Roadmap says that absence of authoritative future price means:

- no extrapolation;
- no today's-price fallback;
- no zero;
- no stale price;
- no fabricated instant-bindable offer.

This requirement is central to Sellers who do not know future supplier/hotel/air prices.

---

## 35. PRICE_ON_REQUEST

Review the distinction:

`missing/misconfigured price ≠ intentional PRICE_ON_REQUEST`

Step 1.8B reportedly owns typed PRICE_ON_REQUEST state.

Verify that this is a coherent Rate Plan-level semantic.

Questions:
- can a Rate Plan be intentionally inquiry-only?
- can only some periods be inquiry-only?
- what happens if a normally priced Rate Plan has a gap?

Do not force an answer beyond scope if it belongs to 1.8C, but identify any implementation-blocking ambiguity before 1.8B.

---

# PART J — CURRENCY

## 36. One canonical currency per Rate Plan

Verify this is consistent with DD-029.

Review migration implications for current Tariff.

Do not allow arbitrary currency changes between periods unless architecture explicitly supports them.

---

## 37. Display conversion

Verify:
- display FX ≠ binding price;
- original amount/currency retained;
- no FX engine introduced.

---

# PART K — PRICING / AVAILABILITY / HOLD

## 38. Pricing ≠ Availability — HARD GATE

Verify no document collapses price and inventory.

Must permit logically:
- price exists + inventory available;
- price exists + sold out;
- inventory exists + no bindable price;
- neither.

---

## 39. Stop-sell

Verify stop-sell is not represented by deleting price.

Review where it belongs conceptually:
- saleability/availability restriction;
- Rate Plan restriction;
- CommercialPeriod control.

The architecture must be coherent enough for 1.8C without inventing a second inventory engine.

---

## 40. Step 2.4 reservation engine

Hard invariant:

Step 2.4 remains the only hold/reservation mechanics.

No Pricing-owned hold.

No Sales/Order/Booking-owned inventory engine.

---

## 41. Multi-date reservation compatibility — CRITICAL

The report says:

> N nights → N reservation rows, single Step 2.4 engine; reservationIds contract revisited at 1.8C.

Verify this does not prematurely freeze a physical implementation that conflicts with existing `AvailabilityReservation`.

The actual invariant needed is:

> all required inventory dates must be reserved atomically through the canonical Catalog reservation engine.

Whether that means N rows or another safe representation should not be overfrozen unless DD-027 explicitly decided it.

Fix documentation if it overcommits.

---

# PART L — BINDING / SNAPSHOTS

## 42. Quote/Checkout/Sale freeze

Verify compatibility with existing binding authority.

Once frozen:
- later price edits do not mutate Quote/Sale;
- later calendar edits do not reprice Order;
- current Catalog is not used to reconstruct historical amount.

---

## 43. Future snapshot fields

Review proposed conceptual snapshot requirements.

Do not force fields that are not required.

But future snapshot must retain enough to reconstruct/explain the binding commercial fact without repricing.

Check:
- ServiceUnit ref;
- Rate Plan ref;
- rule/period ref;
- basis;
- currency;
- unit amount;
- quantity/duration;
- total;
- service date/range;
- relevant conditions.

---

# PART M — SERVER RESOLVER

## 44. Single authoritative resolver

Verify architecture requires one server-authoritative resolution path.

No frontend resolver.
No Partner Cabinet-only resolver.
No Marketplace-specific alternative price engine.

Exact service/API name may remain implementation-specific.

---

## 45. Resolver input sufficiency

Review conceptual inputs.

A universal resolver may need:
- ServiceUnit;
- Rate Plan;
- service date/range;
- occupancy/PAX;
- quantity;
- duration;
- currency context.

Check whether category-specific dimensions can be passed safely without hardcoding all categories into one signature.

Prefer structured context/extensible conditions over an ever-growing list if architecture requires it.

Do not overfreeze function signature.

---

## 46. Resolver output

Must support explainability and downstream snapshotting.

Verify output conceptually includes:
- resolved price;
- currency;
- basis;
- total arithmetic;
- matched rule;
- provenance;
- applicable commercial conditions.

---

# PART N — MARKETPLACE / PARTNER CABINET

## 47. “From N” semantics

Verify `from N` cannot be:
- historical minimum;
- expired;
- unpublished;
- unavailable arbitrary price.

A documented future search horizon/policy may remain deferred.

Server authority is mandatory.

---

## 48. Buyer-selected dates

After dates/conditions are selected:

server resolves price and separately evaluates availability.

No frontend calculation from annual calendar.

---

## 49. Partner annual calendar workflow

Verify Roadmap/3.29I now explicitly supports future UX for:
- year/month calendar;
- period selection;
- bulk entry;
- copy period;
- copy season/year where safe;
- overrides;
- weekday/weekend;
- PAX/occupancy matrix;
- stop-sell;
- availability bulk edit;
- resolved-price preview;
- validation before publish.

No frontend implementation now.

---

# PART O — STEP BOUNDARIES

## 50. Step 1.8B boundary — HARD GATE

Verify 1.8B owns only the Rate Plan foundation needed before period pricing.

Expected scope:

- existing Tariff extended, not duplicated;
- Tariff ↔ ServiceUnit;
- Seller-defined Rate Plan name;
- currency;
- price-basis semantics;
- refundability;
- cancellation-policy ref;
- inclusions/meal plan where category permits;
- restrictions metadata/foundation;
- PRICE_ON_REQUEST foundation;
- compatibility with CommercialPeriod.

Review whether current Tariff `price` fields create a migration/authority ambiguity.

The Roadmap must tell 1.8B whether old Tariff price:
- remains temporary/base price;
- migrates conceptually into base pricing;
- becomes legacy compatibility;
- is superseded later by 1.8C.

If this is not clear enough to implement 1.8B safely, flag it now.

---

## 51. Step 1.8C boundary — HARD GATE

Verify 1.8C owns:
- CommercialPeriod/date pricing;
- annual/seasonal calendar;
- overrides;
- deterministic rule resolution;
- applicable conditions;
- price/availability coordination without ownership merge;
- multi-date hold compatibility.

Ensure 1.8B does not accidentally implement 1.8C.

---

## 52. Step 1.8D boundary

The amendment report says restrictions engine belongs to 1.8D.

Verify Roadmap makes the split coherent:

1.8B:
Rate Plan restriction **foundation/metadata**

1.8D:
restriction **behavior/enforcement** if that is the intended design.

No contradictory ownership.

---

# PART P — DEFERRED DECISIONS

## 53. DD-024…DD-029

Verify all remain legitimately DECIDED.

Do not keep a DD marked DECIDED if this amendment has introduced a new unresolved contradiction into its subject.

Particularly inspect:
- DD-024 Tariff/Rate Plan;
- DD-026 period temporal/pricing semantics;
- DD-027 availability/multi-date;
- DD-029 currency.

---

## 54. Need for new DD

Only create a new Deferred Decision if review uncovers a real architectural choice that:
- is not already decided;
- cannot safely be resolved from existing architecture;
- does not block immediate implementation.

If it blocks 1.8B, do not merely defer it:
return `ARCHITECTURE DECISION REQUIRED`.

---

# PART Q — CONTRADICTION SCAN

## 55. Mandatory repository-wide documentation scan

Search for stale assumptions including:

- one price per Product;
- Tariff as only `{name, price, currency}`;
- price stored directly on ServiceUnit;
- Hotel-only period pricing;
- mandatory long-range future prices;
- missing price = zero;
- pricing = availability;
- pricing = hold;
- frontend-authoritative pricing;
- annual calendar absent;
- duplicate RatePlan concept;
- direct sequence `1.8A → 1.8B`;
- 1.8B already implementing periods;
- 1.8C implementing Rate Plan identity from scratch;
- multiple currencies within one Rate Plan;
- multi-date holds described inconsistently.

Fix stale canonical documentation within review scope.

Do not rewrite historical reports merely because they describe past state accurately.

---

# PART R — REVIEW FIXES

## 56. Allowed fixes

Allowed:
- Roadmap wording;
- Universal Pricing architecture doc;
- Deferred Decisions Map factual synchronization;
- execution sequence;
- cross-reference corrections;
- contradictions;
- ambiguous precedence rules;
- temporal semantics clarification;
- step-boundary clarification;
- legacy Tariff transition clarification.

Forbidden:
- Prisma;
- migrations;
- backend/frontend production code;
- API implementation;
- permissions;
- events;
- actual resolver;
- Rate Plan implementation;
- CommercialPeriod implementation;
- UI.

---

# PART S — VALIDATION

## 57. Documentation-only validation

Because this pass is documentation-only, do not fabricate code regression work.

At minimum verify:
- `git diff`;
- changed-file scope;
- no production code touched by this review;
- Roadmap status consistency;
- execution-sequence consistency;
- internal links/step references where practical.

If repository policy requires markdown lint/checks, run them and report exact results.

Do not claim full backend/frontend regression was required unless code changed.

---

# PART T — ROADMAP UPDATE

## 58. Approval update

If review passes:

Set Universal Pricing Model Amendment status to:

`STRICT REVIEW COMPLETED — APPROVED`

or:

`STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

Then:

- unblock Step 1.8B;
- set Step 1.8B as `▶ NEXT`;
- update CURRENT CANONICAL EXECUTION SEQUENCE;
- do not start Step 1.8B.

If review fails:
- keep 1.8B BLOCKED.

---

# PART U — ARCHITECTURE STOP CONDITIONS

## 59. Return ARCHITECTURE DECISION REQUIRED if

Review proves any of these cannot be resolved from accepted architecture:

- Tariff cannot safely become Rate Plan foundation;
- current Tariff price authority conflicts irreconcilably with CommercialPeriod;
- no canonical temporal/timezone semantics can be established;
- universal pricing requires category-specific core models;
- deterministic overlap/precedence cannot be frozen;
- multi-date reservation requires a second hold engine;
- pricing ownership must move outside Catalog;
- legacy compatibility requires destructive redesign.

Ordinary documentation ambiguity is not an ADR.

---

# PART V — REQUIRED FINAL REPORT

## 60. Final report format

# UNIVERSAL PRICING MODEL AMENDMENT — STRICT REVIEW — ОТЧЁТ

1. Verdict  
2. Repository baseline  
3. Sources inspected  
4. Documentation-only scope verification  
5. Canonical commercial graph  
6. Tariff → Rate Plan decision  
7. ServiceUnit attachment semantics  
8. Cross-category universality  
9. Hotel validation  
10. Tour validation  
11. Transfer validation  
12. Excursion validation  
13. Car Rental validation  
14. Fixed pricing  
15. Annual/seasonal calendar  
16. Date/event overrides  
17. Day-of-week semantics  
18. Occupancy/PAX semantics  
19. Duration pricing  
20. Tier/volume pricing  
21. Lead-time extension boundary  
22. Price basis review  
23. Quantity/duration arithmetic  
24. Price source vs method  
25. Import semantics  
26. Provenance/explainability  
27. Date boundary semantics  
28. Commercial timezone review  
29. Step 2.8A dependency  
30. Same-priority overlap  
31. Precedence model  
32. Specificity model  
33. Manual-vs-automation precedence  
34. Missing-price semantics  
35. PRICE_ON_REQUEST semantics  
36. Currency authority  
37. Display FX boundary  
38. Pricing vs Availability  
39. Stop-sell boundary  
40. Step 2.4 hold compatibility  
41. Multi-date hold review  
42. Quote/Checkout/Sale freeze  
43. Future snapshot contract  
44. Canonical resolver  
45. Resolver input/output extensibility  
46. Marketplace “from N”  
47. Buyer-selected date resolution  
48. Partner annual-calendar UX contract  
49. Step 1.8B boundary  
50. Legacy Tariff price transition  
51. Step 1.8C boundary  
52. Step 1.8D boundary  
53. DD-024…DD-029 status  
54. New DD/ADR assessment  
55. Contradictions found  
56. Review fixes made  
57. Validation performed  
58. Roadmap update  
59. Architecture decision status  
60. Out-of-scope confirmation  
61. Exact files changed  
62. **Exact NEXT item**

Final line must repeat the verdict.

---

# 61. STOP

After the review:

**STOP.**

If approved:

`Exact NEXT = PHASE 1 — STEP 1.8B — TARIFF → CANONICAL RATE PLAN FOUNDATION`

Do not implement Step 1.8B in the same pass.
