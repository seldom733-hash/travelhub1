# PHASE 1 — STEP 1.8B — TARIFF → CANONICAL RATE PLAN FOUNDATION — STRICT REVIEW

**Project:** TravelHub  
**Phase:** 1  
**Step:** 1.8B  
**Mode:** STRICT REVIEW / REVIEW FIXES ONLY  
**Entering status:** `PHASE 1 STEP 1.8B IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`  
**Canonical semantic:** Existing `Tariff` is the single canonical Rate Plan foundation  
**Next only if APPROVED:** `PHASE 1 — STEP 1.8C — COMMERCIAL PERIOD / PERIOD PRICING & AVAILABILITY FOUNDATION`

---

## 1. Mission

Perform an adversarial STRICT REVIEW of the actual Step 1.8B implementation. Do not approve from the implementation report alone.

Verify from repository truth that existing `Tariff` has been safely extended into the single canonical Rate Plan foundation while preserving legacy Tariff compatibility, ServiceUnit ownership/attachment, one canonical currency, single-tag price-basis semantics, explicit PRICE_ON_REQUEST semantics, fixed/base price compatibility, refundability/inclusions/restriction foundation, Catalog ownership, Quote/Checkout compatibility, strict separation from 1.8C CommercialPeriod/date pricing, no pricing resolver, no availability redesign, no second RatePlan entity and no second pricing authority.

Final verdict must be exactly one of:

- `PHASE 1 STEP 1.8B STRICT REVIEW COMPLETED — APPROVED`
- `PHASE 1 STEP 1.8B STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 1 STEP 1.8B STRICT REVIEW COMPLETED — CHANGES REQUIRED`
- `ARCHITECTURE DECISION REQUIRED`

## 2. Execution-sequence gate

Current sequence must be:

`1.8B implementation → 1.8B STRICT REVIEW → 1.8C`

During this review do not start 1.8C, CommercialPeriod, annual/seasonal calendar, date overrides, pricing resolver, multi-date hold changes, 1.8D or Step 2.6.

If approved, mark 1.8B DONE/APPROVED according to canonical status rules, set exact NEXT to Step 1.8C from current Roadmap and STOP.

## 3. Baseline

Inspect branch/HEAD, origin relation, git status, tracked/untracked files, migration count/status, drift, current Roadmap status, active execution item and whether 1.8B is committed.

Separate pre-existing dirty state, 1.8B implementation and review fixes. Do not delete/reset unrelated work.

## 4. Mandatory sources

Inspect latest:

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- `CURRENT CANONICAL EXECUTION SEQUENCE`
- `docs/prompts/TRAVELHUB_DEFERRED_DECISIONS_MAP.md`
- DD-024, DD-026, DD-027, DD-029
- `docs/architecture/universal-pricing-model.md`
- Universal Pricing STRICT REVIEW fixes
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
- Catalog service/controller/validation
- rate-plan service/controller/validation
- permissions
- ID/API contracts
- targeted 1.8B tests
- legacy Tariff/Quote/Checkout tests

Roadmap and accepted Universal Pricing decisions are authoritative.

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

## 18. FIXED pricing

A simple Seller must be able to use `pricingMode = FIXED` without CommercialPeriod.

Verify price/currency/basis coherence, public use and legacy Quote compatibility.

## 19. PRICE_ON_REQUEST — HARD GATE

Verify POR is explicit, null price alone does not imply POR, missing price remains distinct, POR persists without fake zero and does not flow into Quote as a binding amount.

## 20. POR + price consistency

Review allowed combinations:
- Can POR retain legacy `price`?
- If yes, is it ignored but historical?
- If no, is it cleared/rejected?
- Can FIXED have null?
- What does zero mean?

No contradictory state like `PRICE_ON_REQUEST + authoritative public fixed price`.

## 21. Zero-price semantics

Verify zero is distinguishable from missing and POR. Legitimately free service may be zero if allowed.

## 22. Public POR behavior — CRITICAL

Implementation report says POR is excluded from PDP list, `priceFrom`, price sort and Partner Cabinet `priceFrom`.

Review whether **hiding POR from the public Rate Plan list entirely** is canonical.

Universal Pricing defined POR as an intentional inquiry-only offer. Distinguish:
- visibility;
- numeric priceFrom inclusion;
- instant bindability.

If policy only requires POR exclusion from binding price / `from N`, fix over-hiding.

This is a high-priority review point.

## 23. Refundability semantics

Inspect enum/field. Verify deterministic state, no duplicate cancellation engine and legacy compatibility.

## 24. Cancellation policy foundation

Verify whether implementation added a real ref, metadata placeholder or none.

If no canonical cancellation-policy entity exists, ensure 1.8B did not create an orphan ref. Enforcement remains 1.8D.

## 25. Inclusions

Reported JSONB metadata.

Review structure, bounds, schema/category validation, XSS/plain-text safety and lack of Hotel-only mandatory fields.

## 26. Restrictions

Reported JSONB metadata.

Review no enforcement engine yet, no Availability mutation, bounded structure and future 1.8D compatibility.

## 27. RatePlan status

Reported `ACTIVE / ARCHIVED`.

Review whether absence of DRAFT is deliberate: parent Product DRAFT controls mutability/publication.

Verify ACTIVE under DRAFT Product does not mean public.

## 28. PARTNER edit gate

Reported PARTNER edits only while parent Product DRAFT.

Verify transactional Product re-read, no TOCTOU, published Product update → 409, staff semantics and currency immutability.

## 29. Archive / activate

Verify idempotency, concurrent PATCH on ARCHIVED → 409, parent Product/ServiceUnit eligibility on activate and no activation under archived unit/product.

## 30. Parent lifecycle visibility

If Product/ServiceUnit becomes archived/unpublished after Rate Plan ACTIVE, public query must hide the plan. Historical state may remain ACTIVE if deliberate.

## 31. PARTNER own-scope

Verify own create/list/get/update. Cross-Seller create/read/update must deny neutrally.

## 32. Staff / ADMIN / MODERATOR / BUYER

Reported staff/ADMIN read/write; MODERATOR/BUYER 403.

Verify against Catalog conventions and document deliberate semantics.

## 33. Permission reuse

Review reuse of `catalog.product.*` and new `catalog.rate_plan.publish`. Ensure no permission widening.

## 34. Forbidden keys

Attempt forged 1.8C/1.8D and owner facts:
commercialPeriods, calendar, availability, reservation, period pricing, dynamic rules, source priority, internal status, partnerId, owner, foreign serviceUnit, currency update, audit/timestamps.

Must fail loudly.

## 35. Single-source forbidden-key protection

Verify create/update/lifecycle do not drift into separate incomplete lists.

## 36. Decimal/money

Verify Prisma Decimal, bounds, scale, negative rejection, too-many decimals, coercion, zero and no JS-float authority.

## 37. Product/ServiceUnit transaction validation

Verify Product status/ownership, ServiceUnit status and relationship are checked authoritatively inside mutation transaction.

## 38. updateMany status CAS

Reported update/archive/activate use atomic `updateMany` + count-check.

Verify final states and race safety.

## 39. Lost-update behavior — HIGH PRIORITY

If two concurrent PATCH requests target same ACTIVE plan with different changes, can one silently overwrite the other?

Step 1.8A review fixed lost-update. Determine whether RatePlan needs equivalent version/CAS protection.

If no protection exists and lost update is possible, fix.

## 40. ServiceUnit archive race

Test create/attach or activate while ServiceUnit archives. No usable active plan attached to an ineligible unit after committed archive.

## 41. Product state race

Test PARTNER PATCH vs Product publish and activate vs Product archive/unpublish. No stale authorization/state.

## 42. Public Rate Plan query

Review filtering:
- Product eligible;
- ServiceUnit eligible;
- RatePlan ACTIVE;
- pricingMode;
- legacy product-only Tariff.

No private/archived leaks.

## 43. `priceFrom` semantics

At 1.8B before periods:
- FIXED/base Tariffs may contribute;
- POR must not contribute numeric price;
- ARCHIVED must not contribute;
- inactive parent chain must not contribute.

No null→zero or POR price leakage.

## 44. Raw SQL review

If raw SQL is used for priceFrom/sort, inspect injection safety, parameterization, schema quoting, enum/NULL/Decimal behavior and visibility joins.

## 45. Partner Cabinet `priceFrom`

Verify Seller management can still see/manage POR plans even if they do not contribute to numeric `priceFrom`.

## 46. Legacy Quote compatibility — HARD GATE

Run actual Quote creation using legacy Tariff.

Verify same amount/currency semantics, no ServiceUnit requirement and no CommercialPeriod requirement.

## 47. New RatePlan Quote behavior

If new ServiceUnit-attached FIXED Rate Plan can be quoted, verify base price only and no hidden resolver.

POR must not bind a numeric Quote unless an explicit inquiry→quote flow exists.

## 48. Checkout / Sale / Order

Verify no change to downstream price authority/snapshots. No repricing from RatePlan after freeze.

## 49. Availability isolation

Prove RatePlan CRUD does not create or mutate Availability / AvailabilityReservation.

## 50. Reverse isolation

Prove no mutation of capabilities, BuyerRequest, Distribution, Proposal or Opportunity.

## 51. Migration review

Inspect `add_rate_plan_foundation`.

Verify additive, self-contained, fresh-deploy-safe, legacy-safe, truthful defaults, safe enums/FKs, clean replay and drift 0.

## 52. TariffHistory ON DELETE CASCADE — CRITICAL

Review Tariff deletion semantics.

Can Tariff be physically deleted through normal production flow? If yes, can history be erased? Does Product deletion cascade Tariff? Can historical Quote refs survive?

If normal domain operations can erase RatePlan history, fix.

## 53. ServiceUnit ON DELETE SET NULL

Review whether losing ServiceUnit provenance on physical deletion is acceptable under actual hard-delete conventions. Prefer soft archive/restrict semantics if commercial history requires identity retention.

## 54. TariffHistory

Review created/updated/archived/activated facts, actors, timestamps, changed fields, failure/no-op semantics and JSON size.

## 55. Security audit

Verify success-only audit, actor/object refs, no unbounded metadata and idempotent action semantics.

## 56. Events/outbox

Implementation says none.

Verify no hidden outbox and no current consumer requiring events.

## 57. Cross-category validation

Prove Hotel, Tour, Transfer, Excursion and Car Rental semantics.

## 58. Targeted coverage audit

Do not approve by count.

At minimum prove:
1. own Product/ServiceUnit create;
2. name verbatim;
3. foreign Product denied;
4. foreign ServiceUnit denied;
5. Product/ServiceUnit mismatch denied;
6. legacy Product-only Tariff valid;
7. fixed price no CommercialPeriod;
8. explicit POR;
9. missing != POR;
10. zero != missing/POR;
11. one currency;
12. currency immutable;
13. valid/invalid/category-incompatible basis;
14. refundability;
15. inclusions;
16. restrictions;
17. archive/activate;
18. parent eligibility;
19. public inactive hidden;
20. POR not in numeric priceFrom;
21. POR visibility semantics;
22. no Availability/Reservation;
23. no CommercialPeriod;
24. no Reverse mutation;
25. no Sales side effects on CRUD;
26. legacy Quote;
27. new FIXED Quote if supported;
28. concurrent PATCH lost-update behavior;
29. archive/PATCH race;
30. Product publish/PATCH race;
31. ServiceUnit archive/activate race;
32. pagination;
33. raw SQL semantics;
34. migration replay/drift;
35. TariffHistory delete safety.

Add missing tests.

## 59. Pre-existing sales-center flake

Review whether reported flaky Sales test is truly unrelated to 1.8B. Do not alter unrelated Sales code unless 1.8B causes regression unreliability.

## 60. Full regression

After fixes run exact final counts.

Backend:
- tsc
- unit
- 1.8B targeted E2E
- 1.8A
- Product/CategorySchema
- legacy Tariff
- Availability
- Step 2.4
- Quote
- Checkout
- Sale
- Reverse 2.2A–2.2F
- Step 2.5/2.5A/2.5B
- RBAC/security
- full serial E2E

Frontend:
- tsc
- vitest
- production build

DB:
- migrate status
- clean replay
- drift

## 61. Runtime verification

Use actual AppModule/E2E runtime.

Demonstrate Product → ServiceUnit → RatePlan for Hotel and non-Hotel, FIXED path, POR path, public/read-model behavior, legacy Quote compatibility and no CommercialPeriod/Availability side effects.

## 62. Documentation review

Inspect Rate Plan architecture doc, universal-pricing-model.md, API contract, Roadmap and IDs if changed.

Docs must state:
- Tariff = Rate Plan;
- legacy/base price;
- ServiceUnit relation;
- currency;
- basis;
- POR;
- no CommercialPeriod yet;
- public POR semantics;
- 1.8C owns periods.

## 63. Roadmap update

If approved:

Set:
`Step 1.8B STRICT REVIEW COMPLETED — APPROVED`
or
`APPROVED WITH REVIEW FIXES`

Then:
- set Step 1.8C as exact NEXT;
- update CURRENT CANONICAL EXECUTION SEQUENCE;
- do not start 1.8C.

## 64. Architecture stop conditions

Return `ARCHITECTURE DECISION REQUIRED` if review proves:
- Tariff cannot safely remain sole Rate Plan foundation;
- price-basis semantics cannot represent common cross-category pricing;
- current Tariff.price conflicts irreconcilably with future CommercialPeriod authority;
- POR visibility/binding semantics require unresolved business decision blocking 1.8C;
- cancellation policy ownership blocks RatePlan foundation;
- hard-delete behavior makes commercial history unsafe and cannot be fixed locally;
- pricing ownership must leave Catalog.

Ordinary bugs → review fixes.

## 65. Required final report

# PHASE 1 — STEP 1.8B — STRICT REVIEW — ОТЧЁТ

1. Verdict  
2. Repository baseline  
3. Sources inspected  
4. DD-024 / Universal Pricing compliance  
5. Tariff = Rate Plan proof  
6. Catalog ownership  
7. ServiceUnit relation  
8. Legacy product-only Tariffs  
9. Seller-defined Rate Plan name  
10. ID strategy  
11. Currency authority  
12. Currency immutability  
13. PriceBasis review  
14. CategorySchema allowedBases  
15. Cross-category basis semantics  
16. Legacy Tariff.price  
17. FIXED semantics  
18. PRICE_ON_REQUEST semantics  
19. POR + price consistency  
20. Zero-price semantics  
21. Public POR behavior  
22. Refundability  
23. Cancellation policy foundation  
24. Inclusions  
25. Restrictions  
26. RatePlan lifecycle  
27. PARTNER edit gate  
28. Archive/activate  
29. Parent visibility behavior  
30. PARTNER own-scope  
31. Staff/ADMIN/MODERATOR/BUYER semantics  
32. Permissions  
33. Mass assignment  
34. Decimal/money validation  
35. Product/ServiceUnit transaction safety  
36. updateMany/CAS review  
37. Lost-update review  
38. ServiceUnit archive race  
39. Product state race  
40. Public RatePlan query  
41. priceFrom semantics  
42. Raw SQL review  
43. Partner Cabinet priceFrom  
44. Legacy Quote compatibility  
45. New RatePlan Quote compatibility  
46. Checkout/Sale/Order compatibility  
47. Availability isolation  
48. Reverse isolation  
49. Migration  
50. TariffHistory delete safety  
51. ServiceUnit delete semantics  
52. History/audit  
53. Events/outbox  
54. Hotel validation  
55. Tour validation  
56. Transfer validation  
57. Excursion validation  
58. Car Rental validation  
59. Targeted coverage audit  
60. Pre-existing flake assessment  
61. Full regression  
62. Runtime verification  
63. Issues found/fixed  
64. Documentation review  
65. Roadmap update  
66. Architecture decision status  
67. Out-of-scope confirmation  
68. Exact files changed  
69. **Exact NEXT item**

Final line must repeat the verdict.

## 66. STOP

After Step 1.8B STRICT REVIEW:

**STOP.**

If approved, exact NEXT must be Step 1.8C according to synchronized Roadmap.

Do not implement 1.8C in the same pass.
