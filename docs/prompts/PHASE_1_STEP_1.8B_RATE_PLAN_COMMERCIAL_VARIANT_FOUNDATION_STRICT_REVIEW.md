# PHASE 1 — STEP 1.8B — RATE PLAN / COMMERCIAL VARIANT FOUNDATION — STRICT REVIEW

**Project:** TravelHub  
**Phase:** 1  
**Step:** 1.8B  
**Mode:** STRICT REVIEW / REVIEW FIXES ONLY  
**Entering status:** `PHASE 1 STEP 1.8B IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`  
**Canonical semantic:** Existing `Tariff` is the single canonical Rate Plan foundation  
**Next only if APPROVED:** `STEP 1.8C — PERIOD PRICING & PERIOD AVAILABILITY FOUNDATION — IMPLEMENTATION`

## 1. Mission

Perform an adversarial STRICT REVIEW of the actual Step 1.8B implementation. Do not approve from the implementation report alone.

Verify from repository truth that existing `Tariff` has been safely extended into the single canonical Rate Plan foundation while preserving legacy Tariff compatibility, ServiceUnit ownership/attachment, one canonical currency, single-tag price-basis semantics, explicit PRICE_ON_REQUEST semantics, fixed/base price compatibility, refundability/inclusions/restriction foundation, Catalog ownership, Quote/Checkout compatibility, strict separation from 1.8C CommercialPeriod/date pricing, no pricing resolver, no availability redesign, no second RatePlan entity and no second pricing authority.

Final verdict must be exactly one of:

- `PHASE 1 STEP 1.8B STRICT REVIEW COMPLETED — APPROVED`
- `PHASE 1 STEP 1.8B STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 1 STEP 1.8B STRICT REVIEW COMPLETED — CHANGES REQUIRED`
- `PHASE 1 STEP 1.8B STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 2. Execution-sequence gate

Current sequence must be:

`1.8B implementation → 1.8B STRICT REVIEW → 1.8C`

During this review do not start 1.8C, CommercialPeriod, annual/seasonal calendar, date overrides, pricing resolver, multi-date hold changes, 1.8D or Step 2.6.

If approved, mark 1.8B DONE/APPROVED according to canonical status rules, set exact NEXT to Step 1.8C from current Roadmap and STOP.

## 3. Canonical source of truth

Before changing anything, inspect the current canonical Roadmap and do not use older copies as higher authority.

Mandatory sources:

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- `CURRENT CANONICAL EXECUTION SEQUENCE`
- `docs/prompts/TRAVELHUB_DEFERRED_DECISIONS_MAP.md`
- DD-024
- DD-026
- DD-027
- DD-029
- `docs/architecture/universal-pricing-model.md`
- `docs/architecture/service-templates-decision-gates.md`
- `docs/architecture/service-unit-foundation.md`
- `docs/architecture/rate-plan-foundation.md`
- Step 1.8A implementation + Strict Review
- ADR-0001
- Prisma `Tariff`
- `TariffHistory`
- `ServiceUnit`
- `Product`
- `CategorySchema`
- `Availability`
- `AvailabilityReservation`
- Quote / QuoteItem
- CheckoutIntent
- Sale
- Catalog services/controllers/validation
- permissions
- ID/API contracts
- targeted 1.8B tests
- legacy Tariff/Quote/Checkout tests

If an older prompt conflicts with the latest Roadmap:

> CURRENT CANONICAL ROADMAP WINS.

## 4. Baseline

Inspect branch/HEAD, relation to origin/master, git status, tracked/untracked files, migration count/status, drift, current Roadmap status, active execution item and whether 1.8B implementation is committed.

Separate pre-existing dirty state, 1.8B implementation and review fixes. Do not delete/reset unrelated user work.

## 5. Tariff = canonical Rate Plan — HARD GATE

Verify there is exactly one canonical concept.

PASS only if existing Tariff is extended, no parallel `RatePlan` model/table/service exists, no duplicate pricing authority exists and docs consistently treat Tariff/Rate Plan as one object.

Search repository-wide for accidental new `RatePlan` entity.

## 6. Catalog ownership

Verify Rate Plan remains `catalog.*`.

No writes to Sales, Reverse, Order, Booking or Communication. No hidden cross-domain writer.

## 7. ServiceUnit relationship

Reported: `Tariff.serviceUnitId → ServiceUnit`, nullable, ON DELETE SET NULL.

Verify additive and legacy-safe semantics, same Product, same Seller/Partner scope, foreign unit denial, archived unit denial where required and no client cross-linking.

Review whether `ON DELETE SET NULL` is safe for future commercial history and legacy semantics.

## 8. Product-only legacy Tariffs

Verify old Tariffs without ServiceUnit still read, still quote, still work in fixed/base pricing, are not forced into fake ServiceUnits and remain nullable/truthful.

No fabricated migration.

## 9. Seller-defined Rate Plan name

Verify persistence remains verbatim apart from documented trim.

Examples:
- `Room Only — Refundable`
- `Breakfast Included — Non-refundable`
- `Private Transfer`
- `Premium Tour`

No auto-translation, taxonomy replacement or case normalization beyond canonical safe behavior.

## 10. ID strategy

Inspect whether Tariff already had canonical business identity.

Verify no duplicate Rate Plan prefix, no second code system, client cannot forge code and existing IDs remain stable.

## 11. One currency per Rate Plan — HARD GATE

Verify implementation enforces one canonical commercial currency per Tariff/Rate Plan.

Check ISO validation, legacy currency compatibility, create/update semantics and that future 1.8C periods cannot casually override currency.

## 12. Currency immutability — CRITICAL

Implementation report says currency is immutable and changing it requires a new plan.

Test PARTNER update, staff update, archive/activate transitions and legacy Tariff behavior.

Determine whether immutability applies to all actors or only Partner. If staff may change it, document why and prove downstream safety.

No silent currency mutation after commercial use.

## 13. Display FX isolation

Verify no display FX implementation entered 1.8B. Binding currency remains original Rate Plan currency.

## 14. PriceBasis enum review

Inspect actual enum against approved semantics.

Universal Pricing STRICT REVIEW clarified: basis is a single semantic tag; quantity/duration are separate dimensions.

Verify enum does not encode contradictory compounds. If both `PER_ROOM` and `PER_NIGHT` exist, document exact arithmetic semantics. If physical enum choice is still ambiguous for 1.8C, fix now.

## 15. CategorySchema allowedBases

Reported: `CategorySchema.tariffRules.allowedBases`.

Verify Catalog owns the taxonomy, category-incompatible basis is rejected, missing/legacy schema remains legacy-safe, Seller cannot forge allowedBases and no hotel-only hardcoding exists.

Define absent `allowedBases` behavior explicitly.

## 16. Cross-category basis validation

Prove model supports Hotel, Transfer, Tour, Excursion and Car Rental without category-specific global columns.

## 17. Legacy `Tariff.price` — HARD GATE

Verify current price remains a truthful base/FIXED Seller-entered price. No destructive reinterpretation, removal or fabricated migration.

## 18. Legacy price → future CommercialPeriod transition

Canonical future contract:

- if applicable CommercialPeriod exists → period price authoritative;
- otherwise → legacy `Tariff.price` acts as base/FIXED fallback where applicable.

CommercialPeriod is NOT implemented in 1.8B.

Verify 1.8B does not permanently declare legacy price always authoritative, does not create a second base-price field unnecessarily, does not prematurely create period resolver and does not reinterpret legacy `validFrom/validTo` as stay-date CommercialPeriod.

## 19. FIXED pricing

A simple Seller must be able to use `pricingMode = FIXED` without CommercialPeriod.

Verify price/currency/basis coherence, public use and legacy Quote compatibility.

## 20. PRICE_ON_REQUEST — HARD GATE

Verify POR is explicit, null price alone does not imply POR, missing price remains distinct, POR persists without fake zero and does not flow into Quote as a binding amount.

## 21. POR + price consistency

Review allowed combinations:
- Can POR retain legacy `price`?
- If yes, is it ignored but historical?
- If no, is it cleared/rejected?
- Can FIXED have null?
- What does zero mean?

No contradictory state like `PRICE_ON_REQUEST + authoritative public fixed price`.

## 22. Zero-price semantics

Verify zero is distinguishable from missing and POR. Legitimately free service may be zero if allowed.

## 23. Public POR behavior — CRITICAL

Implementation report says POR is excluded from PDP list, `priceFrom`, price sort and Partner Cabinet `priceFrom`.

Review whether hiding POR from the public Rate Plan list entirely is canonical.

Universal Pricing defined POR as an intentional inquiry-only offer. Distinguish:
- visibility;
- numeric priceFrom inclusion;
- instant bindability.

If policy only requires POR exclusion from binding price / `from N`, fix over-hiding.

This is a high-priority review point.

## 24. `priceFrom` semantics

At 1.8B before periods:
- FIXED/base Tariffs may contribute;
- POR must not contribute numeric price;
- ARCHIVED must not contribute;
- inactive parent chain must not contribute.

No null→zero or POR price leakage.

Review Marketplace cards, PDP, public search, Partner Cabinet and price sorting.

## 25. Raw SQL review

If raw SQL is used for `priceFrom` / price sort, inspect injection safety, parameterization, schema/table quoting, enum handling, NULL behavior, Decimal ordering, Product/ServiceUnit/status joins and public/tenant filters.

No user-controlled interpolation.

## 26. Refundability semantics

Inspect actual enum/field. Verify deterministic state, no duplicate cancellation engine and legacy compatibility.

## 27. Cancellation policy foundation

Verify whether implementation added a real ref, metadata placeholder or none.

If no canonical cancellation-policy entity exists, ensure 1.8B did not create an orphan ref. Enforcement remains 1.8D.

## 28. Inclusions

Reported JSONB metadata.

Review structure, bounds, schema/category validation, XSS/plain-text safety and lack of Hotel-only mandatory fields.

## 29. Restrictions

Reported JSONB metadata.

Review no enforcement engine yet, no Availability mutation, bounded structure and future 1.8D compatibility.

## 30. RatePlan status

Reported `ACTIVE / ARCHIVED`.

Review whether absence of DRAFT is deliberate: parent Product DRAFT controls mutability/publication.

Verify ACTIVE under DRAFT Product does not mean public.

## 31. PARTNER edit gate

Reported PARTNER edits only while parent Product DRAFT.

Verify transactional Product re-read, no TOCTOU, published Product update → conflict, staff semantics and currency immutability.

## 32. Archive / activate

Verify idempotency, concurrent PATCH on ARCHIVED → conflict, parent Product/ServiceUnit eligibility on activate and no activation under archived unit/product.

## 33. Parent lifecycle visibility

If Product/ServiceUnit becomes archived/unpublished after Rate Plan ACTIVE, public query must hide the plan. Historical state may remain ACTIVE if deliberate.

## 34. PARTNER own-scope / IDOR

Verify own create/list/get/update/history. Cross-Seller create/read/update/lifecycle must deny neutrally.

## 35. Staff / ADMIN / MODERATOR / BUYER

Reported staff/ADMIN read/write; MODERATOR/BUYER 403.

Verify against Catalog conventions and document deliberate semantics.

## 36. Permission reuse

Review reuse of `catalog.product.*` and `catalog.rate_plan.publish`. Ensure no permission widening.

## 37. Mass assignment

Attempt forged:
id, code, productId on forbidden update paths, partnerId, owner, foreign serviceUnit, status, currency update, createdAt, updatedAt, history, commercialPeriods, calendar, availability, reservations, resolvedPrice, pricingRules, overrides, stopSell, moderation facts.

Must fail loudly according to existing validation conventions.

## 38. Decimal / money

Verify Prisma Decimal, bounds, scale, negative rejection, too-many decimals, serialization, zero handling and no JS float authority.

## 39. Product/ServiceUnit transaction validation

Verify Product status/ownership, ServiceUnit status and Product↔ServiceUnit relation are checked authoritatively inside mutation transaction.

## 40. updateMany / status CAS

Reported update/archive/activate use atomic `updateMany` + count-check.

Verify real race safety and final DB state.

## 41. Lost-update behavior — HIGH PRIORITY

If two concurrent PATCH requests target the same ACTIVE plan with different fields, can one silently overwrite the other?

Step 1.8A review previously fixed lost-update.

Determine whether RatePlan needs equivalent version/CAS protection.

Do not call a mechanism CAS if only status conditional update exists and content-version conflicts are not protected.

If lost update is possible and violates canonical concurrency semantics, fix it.

## 42. ServiceUnit archive race

Controlled interleaving:
- RatePlan create/attach vs ServiceUnit archive;
- RatePlan activate vs ServiceUnit archive.

No usable active plan may survive attached to a now-ineligible unit because of stale validation.

## 43. Product state race

Controlled interleaving:
- PARTNER PATCH vs Product leaving DRAFT;
- activate vs Product archive/unpublish.

No stale authorization/state.

## 44. Legacy `validFrom/validTo`

Review actual current meaning.

Do not silently reinterpret them as stay/service-date CommercialPeriods if historically they meant broader tariff validity.

Document exact semantics.

## 45. Legacy Quote compatibility — HARD GATE

Run actual Quote creation using legacy Tariff.

Verify still succeeds, same amount/currency semantics, no ServiceUnit requirement and no CommercialPeriod requirement.

## 46. New FIXED RatePlan Quote behavior

If new ServiceUnit-attached FIXED RatePlan can be quoted, verify base/FIXED price only and no hidden resolver.

POR must not bind a numeric Quote unless explicit inquiry→quote flow exists.

## 47. Checkout / Sale / Order

Verify no change to downstream price authority/snapshots. No repricing from RatePlan after freeze.

## 48. CommercialPeriod hard boundary

1.8B must NOT implement:
- CommercialPeriod;
- annual calendar;
- seasonal periods;
- holiday/date overrides;
- DAY_OF_WEEK rules;
- occupancy/PAX/duration pricing engine;
- pricing resolver.

Those belong to 1.8C / 1.8D according to current Roadmap.

## 49. Availability hard boundary

Prove RatePlan CRUD does not create or mutate Availability / AvailabilityReservation and does not implement stop-sell via price deletion.

## 50. Reverse isolation

Prove no mutation of capabilities, BuyerRequest, Distribution, Proposal or Opportunity.

## 51. Migration review

Inspect actual `add_rate_plan_foundation`.

Verify additive, self-contained, fresh-deploy-safe, legacy-safe, no destructive rewrite, no fabricated serviceUnitId, truthful defaults, safe enum/FK changes, clean replay and drift 0.

## 52. TariffHistory ON DELETE CASCADE — CRITICAL

Review Tariff deletion semantics.

Can Tariff be physically deleted through normal production flow? If yes, can history be erased? Does Product deletion cascade Tariff? Can historical Quote refs survive?

If normal domain operations can erase RatePlan history unexpectedly, fix or return architecture decision requirement.

## 53. ServiceUnit ON DELETE SET NULL

Review whether loss of ServiceUnit provenance on physical delete is acceptable under actual hard-delete conventions. Prefer soft archive/restrict semantics if commercial history requires identity retention.

## 54. History / audit

Review TariffHistory and Security audit for create, update, archive, activate, actors, timestamps, no-op behavior, failure behavior and no giant/unbounded JSON payload dumps.

## 55. Events/outbox

Implementation says none.

Verify no hidden outbox and no current consumer requiring RatePlan events.

## 56. Cross-category validation

Prove Hotel, Tour, Transfer, Excursion and Car Rental semantics without global Hotel-only fields.

## 57. Targeted coverage audit

Do not approve by count alone.

At minimum prove:
1. own Product/ServiceUnit create;
2. name verbatim;
3. foreign Product denied;
4. foreign ServiceUnit denied;
5. Product/ServiceUnit mismatch denied;
6. archived ServiceUnit denied;
7. legacy Product-only Tariff valid;
8. fixed price without CommercialPeriod;
9. explicit POR;
10. missing != POR;
11. zero != missing/POR;
12. one currency;
13. currency immutable;
14. valid basis;
15. invalid basis;
16. category-incompatible basis;
17. refundability;
18. inclusions;
19. restrictions;
20. archive/activate;
21. parent eligibility;
22. public inactive hidden;
23. POR not numeric priceFrom;
24. POR visibility semantics reviewed;
25. no Availability mutation;
26. no Reservation;
27. no CommercialPeriod;
28. no Reverse mutation;
29. no Sales side effects on CRUD;
30. legacy Quote compatibility;
31. new FIXED Quote if supported;
32. concurrent PATCH lost-update behavior;
33. archive/PATCH race;
34. Product state/PATCH race;
35. ServiceUnit archive/attach race;
36. pagination;
37. raw SQL semantics;
38. migration replay/drift;
39. TariffHistory delete safety.

Add missing tests where necessary.

## 58. Pre-existing Sales flake assessment

Review whether reported flaky Sales test is truly unrelated to 1.8B. Do not alter unrelated Sales code unless 1.8B causes regression unreliability.

## 59. Full regression

After review fixes run exact final results.

Backend:
- tsc
- unit
- targeted 1.8B E2E
- Step 1.8A regression
- Catalog/Product/CategorySchema
- legacy Tariff tests
- Availability
- Step 2.4
- Quote
- Checkout
- Sale
- Reverse 2.2A–2.2F
- Step 2.5 / 2.5A / 2.5B
- RBAC/security
- full serial E2E

Frontend:
- tsc
- vitest
- production build

DB:
- migrate status
- clean migration replay
- drift check

Report exact final counts.

## 60. Runtime verification

Use real repository-standard AppModule/E2E runtime.

Demonstrate Product → ServiceUnit → RatePlan for Hotel and at least one non-Hotel category.

Also demonstrate FIXED path, POR path, public/read-model behavior, legacy Quote compatibility and no CommercialPeriod/Availability side effects.

## 61. Documentation review

Inspect and update only when necessary:
- `docs/architecture/rate-plan-foundation.md`
- `docs/architecture/universal-pricing-model.md`
- `docs/contracts/api.md`
- `docs/contracts/ids.md`
- Roadmap

Docs must state Tariff = Rate Plan, legacy/base price, ServiceUnit relation, currency, basis, POR, public POR semantics, no CommercialPeriod yet and 1.8C ownership of annual/seasonal/date pricing.

## 62. Roadmap update

If approved:

Set Step 1.8B to:
`✅ STRICT REVIEW COMPLETED — APPROVED`
or
`✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

Then update CURRENT CANONICAL EXECUTION SEQUENCE, set Step 1.8C as exact NEXT and do not start 1.8C.

Current Step 1.8C scope from latest Roadmap includes CommercialPeriod/date pricing, annual/seasonal calendar as first-class workflow, date overrides, deterministic precedence/specificity, category-supported day-of-week/occupancy/PAX/duration/tier conditions, price ≠ availability, multi-date atomic hold compatibility and date-only boundary before 2.8A.

## 63. Architecture stop conditions

Return `PHASE 1 STEP 1.8B STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED` if review proves:
- Tariff cannot safely remain sole Rate Plan foundation;
- price-basis semantics cannot represent common cross-category pricing;
- current `Tariff.price` conflicts irreconcilably with future CommercialPeriod authority;
- POR visibility/binding semantics require unresolved business decision blocking 1.8C;
- cancellation-policy ownership blocks RatePlan foundation;
- hard-delete behavior makes commercial history unsafe and cannot be fixed locally;
- pricing ownership would need to leave Catalog.

Ordinary bugs → review fixes.

## 64. Strict out-of-scope

Do NOT implement:
- Step 1.8C;
- CommercialPeriod;
- annual calendar;
- seasonal price editor;
- holiday/date overrides;
- day-of-week resolver;
- occupancy/PAX/duration pricing engine;
- availability redesign;
- multi-date hold changes;
- Step 1.8D restrictions engine;
- supplier pricing;
- channel manager;
- dynamic pricing;
- FX engine;
- frontend commercial calendar;
- Step 3.29I;
- Step 2.6.

## 65. Required final report

# PHASE 1 — STEP 1.8B — STRICT REVIEW — ОТЧЁТ

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current implementation reconstructed
5. Roadmap compliance
6. Tariff = Rate Plan verification
7. Catalog ownership
8. ServiceUnit relationship
9. Legacy Product-only Tariffs
10. Seller-defined Rate Plan name
11. ID strategy
12. Currency authority
13. Currency immutability
14. PriceBasis semantics
15. CategorySchema allowedBases
16. Cross-category basis semantics
17. Legacy Tariff.price
18. Legacy price transition to future CommercialPeriod
19. FIXED semantics
20. PRICE_ON_REQUEST semantics
21. POR + price consistency
22. Zero-price semantics
23. Public POR visibility/bindability
24. priceFrom semantics
25. Raw SQL review
26. Refundability
27. Cancellation-policy foundation
28. Inclusions
29. Restrictions
30. Status model
31. PARTNER edit gate
32. Archive/activate
33. Parent visibility behavior
34. RBAC / own-scope / IDOR
35. Permissions
36. Mass assignment
37. Decimal / money validation
38. Product/ServiceUnit transaction safety
39. updateMany/status CAS review
40. Lost-update review
41. ServiceUnit archive race
42. Product state race
43. Legacy validFrom/validTo semantics
44. Legacy Quote compatibility
45. New FIXED RatePlan Quote compatibility
46. Checkout/Sale/Order compatibility
47. CommercialPeriod boundary
48. Availability isolation
49. Reverse isolation
50. Migration
51. TariffHistory delete safety
52. ServiceUnit delete semantics
53. History/audit
54. Events/outbox
55. Hotel validation
56. Tour validation
57. Transfer validation
58. Excursion validation
59. Car Rental validation
60. Targeted coverage audit
61. Pre-existing flake assessment
62. Full regression
63. Runtime verification
64. Issues found/fixed
65. Documentation changes
66. Roadmap update
67. Architecture decision status
68. Out-of-scope confirmation
69. Exact files changed
70. **Exact NEXT item**

Final line must repeat the verdict.

## 66. STOP

After Step 1.8B STRICT REVIEW:

**STOP.**

If approved, exact NEXT:

`STEP 1.8C — PERIOD PRICING & PERIOD AVAILABILITY FOUNDATION — IMPLEMENTATION`

Do not implement 1.8C in the same pass.
