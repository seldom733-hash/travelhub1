# PHASE 1 — STEP 1.8C — PERIOD PRICING & PERIOD AVAILABILITY FOUNDATION — STRICT REVIEW

**Project:** TravelHub  
**Phase:** 1  
**Step:** 1.8C  
**Mode:** STRICT REVIEW / REVIEW FIXES ONLY  
**Entering status:** `PHASE 1 STEP 1.8C IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`  
**Canonical concept:** `catalog.CommercialPeriod` (`CPR-*`)  
**Next only if APPROVED:** exact next item from CURRENT CANONICAL EXECUTION SEQUENCE  
**Hard stop:** do not start 1.8D, 2.8A, Step 2.6 or frontend calendar implementation in this pass.

## 1. Mission

Perform an adversarial STRICT REVIEW of the actual Step 1.8C implementation.

Do not approve from the implementation report alone.

Verify from repository truth that Step 1.8C correctly implements:

- date-based CommercialPeriod pricing;
- annual/seasonal calendar foundation;
- date/date-range overrides;
- deterministic precedence/specificity;
- legacy Tariff.price fallback;
- PRICE_ON_REQUEST safety;
- period availability / sellability without merging inventory ownership;
- Quote/Checkout server-authoritative integration;
- concurrency/idempotency;
- cross-category compatibility;
- legacy compatibility;
- clean boundary with Step 1.8D and Step 2.8A.

Final verdict must be exactly one of:

- `PHASE 1 STEP 1.8C STRICT REVIEW COMPLETED — APPROVED`
- `PHASE 1 STEP 1.8C STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 1 STEP 1.8C STRICT REVIEW COMPLETED — CHANGES REQUIRED`
- `PHASE 1 STEP 1.8C STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 2. Baseline

Record branch, HEAD, origin relation, git status, tracked/untracked files, migration count/status, drift, current Roadmap status, active execution item and whether Step 1.8C implementation is committed.

Separate pre-existing dirty state, Step 1.8C implementation and review fixes. Do not reset/delete unrelated work.

## 3. Mandatory sources

Inspect latest:

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- `CURRENT CANONICAL EXECUTION SEQUENCE`
- `docs/prompts/TRAVELHUB_DEFERRED_DECISIONS_MAP.md`
- DD-024, DD-026, DD-027, DD-028 if relevant, DD-029
- `docs/architecture/universal-pricing-model.md`
- `docs/architecture/rate-plan-foundation.md`
- `docs/architecture/service-unit-foundation.md`
- `docs/architecture/period-pricing-foundation.md`
- Step 1.8A implementation + Strict Review
- Step 1.8B implementation + Strict Review
- ADR-0001
- Prisma models Product, ServiceUnit, Tariff, CommercialPeriod, Availability, AvailabilityReservation, Quote/QuoteItem, CheckoutIntent
- Catalog public read models
- Quote resolution path
- Checkout service-date handling
- Sale completion
- period validation/resolution
- permissions
- API/ID/event contracts
- targeted Step 1.8C tests
- legacy 1.8B/Quote tests

If an older prompt conflicts with current Roadmap: CURRENT CANONICAL ROADMAP WINS.

## 4. CommercialPeriod ownership — HARD GATE

Verify `CommercialPeriod` is owned by `catalog.*`.

Reject Sales-owned, Reverse-owned, Booking-owned period pricing, a second pricing bounded context, or direct cross-domain writers.

## 5. Canonical hierarchy

Verify:

`Product → ServiceUnit → Tariff/Rate Plan → CommercialPeriod`

CommercialPeriod must not bypass Tariff. `Tariff` remains sole Rate Plan foundation.

## 6. Denormalized productId review

Report says CommercialPeriod stores both tariffId and productId.

Prove productId is server-derived, cannot be forged, cannot drift from Tariff.productId, cannot be reassigned independently and cannot influence scope incorrectly.

## 7. FK/delete semantics — CRITICAL

Report says period→tariff CASCADE and period→product CASCADE.

Review actual hard-delete semantics. Determine whether commercial history or price provenance can be erased through normal domain operations. Check whether 1.8B TariffHistory RESTRICT prevents destructive parent deletion. Check whether Quote snapshots remain sufficient if a period row disappears.

If normal production flow can erase commercial history required for disputes/audit, fix or return architecture decision required.

## 8. Date-only semantics — HARD GATE

Verify CommercialPeriod uses true date-only semantics.

Check DB type, API serialization, JS Date conversion, parsing, normalization and weekday derivation.

Seller-entered `2026-08-12` must not shift because of timezone conversion.

## 9. Inclusive boundaries

Verify exact contract, preferably `startDate <= serviceDate <= endDate` if that matches canonical docs.

Test start, end, one-day range, leap day, year boundary and Dec→Jan.

## 10. Timezone / Step 2.8A boundary

Report says weekday logic is UTC and exact timezone/time-slot deferred to 2.8A.

Prove this does not convert a local timestamp into a different business date. If exact local-time semantics are actually needed now, return architecture decision required rather than inventing timezone architecture.

## 11. CommercialPeriod kinds

Review `PERIOD` and `DATE_OVERRIDE`.

Verify no parallel exact-date table exists and DATE_OVERRIDE remains an override classification, not second pricing authority.

## 12. Annual/seasonal calendar — HARD GATE

Prove a Seller can represent a full year with a small number of ranges rather than 365 rows. Verify bulk API practicality and atomicity.

## 13. Exact-date override

Broad season plus exact date must resolve deterministically to exact override.

## 14. Multi-day holiday override — CRITICAL

Determine whether canonical date/date-range overrides can represent multi-day holidays/events.

Example: Jul 10–15 override against Jun–Aug season.

If DATE_OVERRIDE is one-day only and Roadmap requires date-range overrides, implementation is incomplete. If narrower PERIOD is the approved mechanism, docs and precedence must say so explicitly.

## 15. DD-026 precedence — HARD GATE

Reconstruct the actual algorithm from code.

Verify it matches accepted DD-026 and Universal Pricing review, not just the implementation report.

## 16. DATE_OVERRIDE precedence

Review exact vs multi-day overrides, overlapping overrides and same-priority conflicts. No hidden createdAt/database-order winner.

## 17. PERIOD specificity

Report says specificity uses min/maxNights + weekdays.

Review mechanical scoring with counterexamples. Ensure it is deterministic and future-compatible with 1.8D.

## 18. Date-range specificity — CRITICAL

Does a narrower date range count as more specific?

Example:
- Jun 1–Aug 31
- Jul 10–Jul 15

If both are PERIOD with equal conditions, what happens?

If ambiguous 422 is returned, verify that matches canonical holiday-range design.

## 19. Same-priority overlap

Prove ambiguity is blocked on create, update, activate, bulk and runtime. No route may create nondeterministic active rules.

## 20. Update-created ambiguity

PATCH must revalidate overlap/conflict under authoritative lock.

## 21. Activate-created ambiguity

Reactivation must revalidate against current active rules.

## 22. weekdays

Review allowed range, uniqueness, empty semantics, ordering, weekday numbering, category authorization and date-only evaluation.

## 23. minNights/maxNights

Determine whether they are pricing conditions, booking restrictions or both.

If used for pricing selection, ensure 1.8D still owns enforcement semantics.

## 24. Occupancy/PAX boundary

Compare actual implementation with current Roadmap. If 1.8C explicitly requires occupancy/PAX pricing foundations, full deferral to 1.8D may be incomplete. Current Roadmap wins.

## 25. CategorySchema authority

Verify category-dependent conditions are server-authorized. No global Hotel-only assumptions.

## 26. Decimal price compatibility — CRITICAL

CommercialPeriod uses Decimal(14,2) per report. Compare downstream Tariff/Quote/Sale/Order money precision.

If a valid period amount can overflow downstream binding fields, this is a defect.

## 27. Currency authority / duplication — CRITICAL

CommercialPeriod reportedly has `currency` even though Rate Plan owns one canonical currency.

Verify:
- period.currency is server-derived;
- client cannot set it;
- update cannot change it;
- it can never diverge;
- resolver trusts canonical Tariff authority.

If it can drift, fix. If redundant but immutable, document why.

## 28. Base price fallback

Verify applicable period wins; otherwise FIXED Tariff.price fallback where permitted. No hidden stale cache.

## 29. Gap semantics

Clarify whether schema can represent a true period-only Rate Plan with no base price.

If Tariff.price remains NOT NULL, determine whether this contradicts current Roadmap's missing-price/season-only Seller use cases.

Do not invent a decision if Roadmap already defines it.

## 30. PRICE_ON_REQUEST

POR must remain inquiry-only.

Test period create/resolution/Quote/public priceFrom. Numeric period must not accidentally bind POR.

## 31. Zero-price semantics

Zero must remain a legitimate amount if allowed, distinct from missing, unavailable and POR.

## 32. isAvailable semantics — CRITICAL

Determine exactly whether `isAvailable` means commercial stop-sell/sellability or actual inventory availability.

It must not ambiguously replace canonical Availability capacity.

## 33. Pricing ≠ Availability — HARD GATE

Verify price can exist when unavailable, unavailable does not erase price, zero does not mean unavailable and calendar CRUD creates no reservation holds.

## 34. Existing Availability integration

If CommercialPeriod says sellable but Availability is sold out, what wins? If period stop-sells but inventory exists, what wins?

Document composition as separate gates.

## 35. Stop-sell naming/semantics

If `isAvailable=false` is really stop-sell, assess whether naming/API/docs are clear enough to avoid treating it as capacity truth.

Fix semantic ambiguity if necessary.

## 36. Multi-date pricing — CRITICAL

Inspect actual N-night logic.

For Jul 10–13, determine which service dates are priced and how holiday override affects total. Checkout date should normally not be charged for nightly stay if that is canonical.

Do not assume Hotel semantics for all categories.

## 37. Multi-date availability

If any required date is stop-sold/unavailable, overall offer must not be bindable.

## 38. Multi-date hold boundary

Compare implementation with DD-027/current Roadmap.

If 1.8C only requires compatibility, prove compatibility. If it requires actual atomic hold now, implementation may be incomplete.

## 39. Reservation contract compatibility

Review whether future multi-date holds can fit existing AvailabilityReservation and OrderRequested reservation cardinality without breaking frozen contracts.

Flag architecture issue if not.

## 40. Quote addItem integration

Verify serviceDate, Tariff eligibility, Product context, POR, archived RatePlan, stop-sell and ambiguity are resolved server-side. Client must not submit authoritative price or period winner.

## 41. Quote snapshot

Inspect whether frozen QuoteItem retains enough facts for commercial disputes.

At minimum amount/currency/serviceDate/tariff ref must remain sufficient. Consider whether CommercialPeriod ref/code is needed for provenance; do not require it if canonical snapshot already suffices.

## 42. Checkout serviceDate mutation — HIGH RISK

Trace `setCheckoutServiceDate`.

If Checkout can change serviceDate after Quote price is frozen, determine whether price becomes stale.

A change Jul 1→Dec 31 must not keep an invalid old price silently.

Fix according to canonical binding rules.

## 43. Quote vs Checkout authority

Verify where price becomes binding and whether serviceDate may still mutate after that point.

## 44. Sale completion re-verify — CRITICAL

Report says completeSale re-verifies current CommercialPeriod and fails if price changed/period archived.

This may violate canonical frozen-snapshot semantics.

Determine binding stage from Roadmap/Step 2.3/2.3A.

If an already-issued/binding Quote can be invalidated solely because Seller later edits Catalog price, this may be a serious defect.

Never silently reprice.

If binding-stage semantics are not actually decided, return architecture decision required.

## 45. No silent repricing

Whatever revalidation remains, frozen amount must never be replaced silently with current Catalog price.

## 46. Legacy Quote regression

Legacy Tariff without periods must continue exact prior behavior.

## 47. Public priceFrom semantics — CRITICAL

Implementation report says `MIN(active period prices) COALESCE legacy min Tariff.price`.

Verify this matches current canonical meaning of `from N`.

Potential problems:
- historical or irrelevant low-season prices;
- stop-sold periods;
- far-future prices;
- Product sort mismatch;
- base fallback incorrectly ignored.

If Roadmap intentionally deferred search horizon/policy, Step 1.8C must not invent an arbitrary global minimum without authority.

## 48. Availability-aware priceFrom

Determine whether stop-sold periods contribute. Check RatePlan/Product/ServiceUnit/POR eligibility and any canonical date horizon.

## 49. COALESCE/fallback aggregate review

Compare SQL aggregate semantics to per-date resolver semantics.

`COALESCE(minPeriodPrice, legacyMin)` is not the same as “period price for requested date, else base”.

Prove current use is correct for the specific `priceFrom` contract.

## 50. Price sort consistency

Displayed `priceFrom` and sort key must use same semantic value.

POR must not sort as zero.

## 51. API surface

Review list/create/bulk/PATCH/archive/activate, status codes, pagination and projections.

## 52. Bulk atomicity

Inject one invalid/conflicting row and prove zero period rows and zero success audit/history facts commit.

## 53. Own-scope / IDOR

Cross-Seller guessed Tariff/period/bulk/lifecycle endpoints must deny consistently.

## 54. Permissions — CRITICAL CONSISTENCY CHECK

Report says PARTNER and ADMIN have period permissions, while BUYER/MODERATOR/staff get 403.

Step 1.8B reportedly allowed staff/ADMIN RatePlan management.

Determine whether denying staff for child periods is intentional and documented. If inconsistent without rationale, fix or document.

## 55. Mass assignment

Attempt id/code/tariffId/productId/partnerId/currency/status/version/createdBy/timestamps/priority/timeSlot/timezone/reservation/Quote/Sale/capacity/1.8D fields.

Loud reject.

## 56. Version CAS

Prove stale PATCH → 409 and no lost update.

## 57. Advisory lock

Review `pg_advisory_xact_lock(hashtext(...tariffId))`.

All conflict-producing paths—create, bulk, update, activate—must use compatible locking.

## 58. Concurrent duplicate create

No raw 500, no nondeterministic duplicate active rules.

## 59. Update/archive/activate races

Test PATCH vs archive, PATCH vs activate and archive vs activate.

No impossible final state or duplicate transition facts.

## 60. CommercialPeriod history

Determine whether a history model exists. If not, determine whether SecurityService audit alone satisfies current Catalog history conventions.

Do not fabricate a history table without canonical need.

## 61. Audit

No giant annual-calendar dumps or PII. Actor/action/target must be traceable.

## 62. Events/outbox

No speculative events without consumer.

## 63. Migration review

Inspect `20260812085430_add_period_pricing_availability`.

Verify additive, fresh-deploy-safe, no fake backfill, safe dates/Decimal/FKs/defaults, clean replay and drift 0.

## 64. Indexes/query paths

Compare indexes to actual resolver hot path. Identify missing obvious composite indexes but avoid speculative tuning.

## 65. Hotel validation

Prove seasonal nightly pricing, holiday override, multi-date aggregation and stop-sell independence.

## 66. Tour validation

Prove seasonal/service-date price without global Hotel-night assumptions.

## 67. Transfer validation

Prove per-trip seasonal/date override semantics.

## 68. Excursion/Activity validation

Prove date/day-of-week foundation without time-slot implementation before 2.8A.

## 69. Car Rental validation

Prove per-day seasonal price and duration compatibility.

## 70. Targeted coverage audit

Do not approve by test count.

At minimum prove:
1. own create;
2. cross-Seller denial;
3. full-year season;
4. one-day override;
5. multi-day holiday override where canonical;
6. invalid dates;
7. inclusive boundaries;
8. leap day;
9. year boundary;
10. exact override precedence;
11. narrower holiday precedence;
12. equal-specificity conflict;
13. PATCH conflict revalidation;
14. activate conflict revalidation;
15. bulk conflict atomicity;
16. base fallback;
17. POR safety;
18. zero price;
19. currency authority;
20. period price does not mutate Tariff.price;
21. price/availability independence;
22. stop-sell;
23. no Reservation side effect;
24. Quote period price;
25. legacy Quote;
26. frozen Quote after period edit;
27. Checkout serviceDate mutation;
28. Sale completion after Seller price edit;
29. archived RatePlan;
30. archived parent chain;
31. public priceFrom semantics;
32. price sort consistency;
33. POR public non-numeric;
34. Hotel;
35. Tour;
36. Transfer;
37. Excursion;
38. Car Rental;
39. stale PATCH;
40. duplicate-create race;
41. lifecycle races;
42. multi-date pricing;
43. multi-date availability;
44. hold compatibility;
45. timeSlot forbidden;
46. no 1.8D engine;
47. migration replay/drift;
48. no cross-domain writes;
49. no PII leakage.

Add critical missing tests.

## 71. 1.8B regression-test evolution

Inspect modifications to prior 1.8B tests. Ensure assertions were evolved because canonical behavior changed, not weakened to make 1.8C pass.

## 72. Backend regression

Run tsc, unit, targeted 1.8C E2E, 1.8B, 1.8A, Catalog, Availability, Step 2.4, Quote, Checkout, Sale, Order, Reverse 2.2A–F, Step 2.5/2.5A/2.5B, RBAC/security and full serial E2E.

Report exact counts.

## 73. Frontend regression

Run tsc, vitest and production build even if frontend was untouched.

The implementation report only explicitly stated frontend tsc; STRICT REVIEW must verify the full canonical frontend regression.

## 74. DB regression

Run migrate status, clean replay and drift check. Report migration count.

## 75. Runtime verification

Use real AppModule/E2E runtime.

Demonstrate:
`Product → ServiceUnit → RatePlan → CommercialPeriod → Quote`

for:
- seasonal date;
- exact override;
- no-period fallback;
- unavailable date;
- POR;
- at least one non-Hotel category.

## 76. Documentation

Review/update:
- `docs/architecture/period-pricing-foundation.md`
- `docs/architecture/universal-pricing-model.md`
- `docs/architecture/rate-plan-foundation.md`
- `docs/contracts/api.md`
- `docs/contracts/ids.md`
- Roadmap.

Docs must match actual behavior.

## 77. CPR-* ID contract

Verify prefix registered once, atomic generation, no client authority and no collision-retry hack.

## 78. Roadmap update

Only if approved:

Set Step 1.8C to:
- `✅ STRICT REVIEW COMPLETED — APPROVED`
or
- `✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

Then inspect latest CURRENT CANONICAL EXECUTION SEQUENCE and set the exact NEXT item.

Do not assume it is automatically 1.8D without reading the Roadmap.

Do not start NEXT.

## 79. Architecture stop conditions

Return `PHASE 1 STEP 1.8C STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED` if unresolved issues materially affect architecture, including:
- period currency independent authority;
- date/timezone semantics requiring 2.8A;
- undefined overlap precedence;
- undefined Marketplace priceFrom semantics;
- ambiguous Quote freeze vs Sale re-verification binding stage;
- CommercialPeriod isAvailable conflicting with canonical Availability;
- multi-date holds incompatible with Step 2.4;
- required occupancy/duration semantics undefined;
- commercial history unsafe under hard delete.

Ordinary bugs → review fixes.

## 80. Allowed review fixes

Allowed:
- precedence/overlap bugs;
- date bugs;
- currency authority;
- POR leaks;
- priceFrom bugs;
- Quote integration;
- freeze/revalidation bugs where canonical contract is clear;
- availability/sellability confusion;
- concurrency;
- RBAC/IDOR;
- migration/index issues;
- tests/docs/Roadmap synchronization.

## 81. Strict out-of-scope

Do not implement:
- Step 1.8D full restrictions engine;
- arbitrary pricing DSL;
- time-slot/timezone model before 2.8A;
- supplier/channel-manager pricing;
- dynamic/AI pricing;
- FX engine;
- frontend annual calendar;
- Step 2.6+.

## 82. Required final report

# PHASE 1 — STEP 1.8C — STRICT REVIEW — ОТЧЁТ

1. Verdict
2. Repository baseline
3. Sources inspected
4. Roadmap/DD compliance
5. Catalog ownership
6. Canonical hierarchy
7. Denormalized productId review
8. FK/delete semantics
9. Date-only semantics
10. Inclusive boundaries
11. Timezone/2.8A boundary
12. CommercialPeriod kinds
13. Annual/seasonal workflow
14. Exact-date override
15. Multi-day holiday override
16. DD-026 precedence
17. DATE_OVERRIDE precedence
18. PERIOD specificity
19. Date-range specificity
20. Same-priority conflicts
21. Update conflict validation
22. Activate conflict validation
23. Weekday conditions
24. minNights/maxNights semantics
25. Occupancy/PAX boundary
26. CategorySchema authority
27. Decimal precision compatibility
28. Currency authority/duplication
29. Base price fallback
30. Gap semantics
31. PRICE_ON_REQUEST
32. Zero-price semantics
33. isAvailable semantics
34. Pricing vs Availability
35. Existing Availability integration
36. Stop-sell semantics
37. Multi-date pricing
38. Multi-date availability
39. Multi-date hold compatibility
40. Reservation contract compatibility
41. Quote addItem integration
42. Quote snapshot
43. Checkout serviceDate mutation
44. Quote vs Checkout authority
45. Sale completion re-verification
46. No silent repricing
47. Legacy Quote regression
48. Public priceFrom semantics
49. Availability-aware priceFrom
50. COALESCE/fallback aggregate review
51. Price sort consistency
52. API surface
53. Bulk atomicity
54. Own-scope/IDOR
55. Permissions
56. Mass assignment
57. Version CAS
58. Advisory lock
59. Concurrent duplicate create
60. Update/archive/activate races
61. CommercialPeriod history
62. Audit
63. Events/outbox
64. Migration
65. Indexes/query paths
66. Hotel validation
67. Tour validation
68. Transfer validation
69. Excursion/Activity validation
70. Car Rental validation
71. Targeted coverage audit
72. 1.8B regression-test evolution review
73. Backend regression
74. Frontend regression
75. DB migration replay/drift
76. Runtime verification
77. Issues found/fixed
78. Documentation changes
79. Roadmap update
80. Architecture decision status
81. Out-of-scope confirmation
82. Exact files changed
83. **Exact NEXT item**

Final line must repeat the verdict.

## 83. STOP

After Step 1.8C STRICT REVIEW: **STOP**.

Do not execute the next Roadmap item in the same pass.

If approved, report the exact NEXT item from the synchronized canonical Roadmap.
