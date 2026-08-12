# PHASE 1 — STEP 1.8D — COMMERCIAL RESTRICTIONS / OVERRIDES FOUNDATION — STRICT REVIEW

**Project:** TravelHub  
**Phase:** 1  
**Step:** 1.8D  
**Mode:** STRICT REVIEW / REVIEW FIXES ONLY  
**Entering status:** `PHASE 1 STEP 1.8D IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`  
**Canonical concept:** Catalog-owned Commercial Restrictions / Overrides  
**Exact NEXT if APPROVED:** `STEP 2.6 — REMOVE BOOTSTRAP ORDER CREATION`  
**Hard stop:** do not start Step 2.6 in this review pass.

## 1. Mission

Perform an adversarial STRICT REVIEW of the actual Step 1.8D implementation.

Do not approve from the implementation report alone.

Verify from repository truth that Step 1.8D correctly implements a single, deterministic, Catalog-owned commercial restriction authority that composes safely with Product, ServiceUnit, Tariff / canonical Rate Plan, CommercialPeriod, public Marketplace pricing, Quote pre-binding evaluation, Checkout/Sale freeze semantics, Availability / AvailabilityReservation, CategorySchema restrictions, history/audit and concurrency/CAS.

Final verdict must be exactly one of:

- `PHASE 1 STEP 1.8D STRICT REVIEW COMPLETED — APPROVED`
- `PHASE 1 STEP 1.8D STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 1 STEP 1.8D STRICT REVIEW COMPLETED — CHANGES REQUIRED`
- `PHASE 1 STEP 1.8D STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 2. Execution-sequence gate

Before any review fix, inspect the current canonical Roadmap.

Expected sequence:

`1.8D implementation → 1.8D STRICT REVIEW → RETURN TO ORIGINAL SEQUENCE AT STEP 2.6`

During this pass:
- DO NOT start Step 2.6;
- DO NOT remove bootstrap Order creation;
- DO NOT start Step 2.8A;
- DO NOT implement frontend calendar 3.29I;
- DO NOT add supplier/channel-manager/dynamic pricing;
- DO NOT add timezone/time-slot rules;
- DO NOT create a generic rules DSL.

If approved, update Roadmap honestly, mark 1.8D approved, set exact NEXT to Step 2.6 and STOP.

## 3. Baseline

Record branch, HEAD, origin relation, git status, tracked/untracked files, migration count/status, drift, current Roadmap status, active execution item and whether 1.8D is committed.

Separate pre-existing dirty state, Step 1.8D implementation and review fixes. Do not reset/delete unrelated work.

## 4. Mandatory sources

Inspect latest:
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- CURRENT CANONICAL EXECUTION SEQUENCE
- `docs/prompts/TRAVELHUB_DEFERRED_DECISIONS_MAP.md`
- DD-026
- DD-028
- Universal Pricing Model
- Service Templates / Period Pricing & Availability decisions
- Step 1.8A implementation + Strict Review
- Step 1.8B implementation + Strict Review
- Step 1.8C implementation + Strict Review
- `docs/architecture/universal-pricing-model.md`
- `docs/architecture/rate-plan-foundation.md`
- `docs/architecture/period-pricing-foundation.md`
- `docs/architecture/commercial-restrictions-overrides-foundation.md`
- ADR-0001
- Prisma Product, ServiceUnit, Tariff, TariffHistory, CommercialPeriod, CommercialPeriodHistory, CommercialRestriction, CommercialRestrictionHistory, Availability, AvailabilityReservation, Quote/QuoteItem, CheckoutIntent, Sale
- restriction evaluator/validation/service/controller
- period resolver
- rate-plan service
- public-catalog service
- sales service/controller/contracts/validation
- permissions
- API/ID contracts
- targeted Step 1.8D tests
- regressions for 1.8A–1.8C, Quote/Checkout/Sale, Availability and public catalog.

If an older prompt conflicts with current canonical Roadmap: CURRENT CANONICAL ROADMAP WINS.

## 5. Catalog ownership — HARD GATE

Verify all mutable restriction facts are owned by `catalog.*`.

No cross-domain writer may mutate restriction state.

Sales may consume restrictions read-only before binding.

Reject Sales-owned, Booking-owned, Order-owned, Reverse-owned restrictions or second generic rules service outside Catalog.

## 6. Tariff.restrictions reconciliation — CRITICAL

Implementation report states:
- BASE = `Tariff.restrictions`
- PERIOD/DATE = `CommercialRestriction`
- TARIFF scope in entity forbidden.

Review whether this really creates one authority per scope rather than two overlapping authorities.

Check:
1. same semantic restriction cannot exist in both Tariff.restrictions and CommercialRestriction at effective base scope;
2. supported keys align;
3. unknown base keys are rejected;
4. evaluator merges base/scoped values deterministically;
5. a more-specific rule can correctly override a broader one where canonical behavior allows;
6. absence is not accidentally confused with explicit false.

If duplicate authority is possible, fix or return architecture decision required.

## 7. Legacy Tariff.restrictions semantics

Verify legacy rows remain valid, no destructive backfill exists and unknown historical keys do not silently become binding semantics.

Document how known vs unknown legacy keys behave.

## 8. CommercialRestriction schema

Inspect actual model.

Verify code, tariffId, commercialPeriodId if PERIOD-scoped, scope, type, typed value representation, status, version, actor/creator, timestamps, archivedAt and history relation.

No unbounded generic rule JSON DSL.

## 9. Scope consistency

Reported scopes are DATE and PERIOD, with TARIFF entity scope forbidden.

Verify DATE has a valid date target; PERIOD has valid CommercialPeriod target; CommercialPeriod belongs to same Tariff; ownership cannot drift; client cannot forge cross-Tariff period attachment.

## 10. FK/delete semantics — CRITICAL

Inspect delete actions.

Determine whether Product/Tariff/CommercialPeriod hard delete can erase authoritative sellability history or Quote provenance.

If normal production flow can erase commercial evidence needed for audit/disputes, fix or return architecture decision required.

## 11. STOP_SELL semantics — HARD GATE

Implementation report says DATE-scoped STOP_SELL in CommercialRestriction and period stop-sell from 1.8C CommercialPeriod sellability.

Review whether this is a coherent single-authority split.

Check whether a DATE stop-sell can override PERIOD sellable=true, whether a DATE rule can reopen a period stop-sell, whether reopening is intended, and whether duplicate STOP_SELL sources exist.

Do not invent reopen semantics without canonical authority.

## 12. MIN_STAY semantics

Verify bounds, integer/unit semantics, category support, required duration context, fail-closed behavior and no Hotel-only core assumption.

Check interaction with base maxStay metadata.

## 13. ADVANCE_BOOKING semantics

Verify date-only contract, range, inclusive boundary, today authority, UTC date-only behavior, past dates, leap/year boundaries and absence of hour/minute/timezone semantics.

## 14. CTA semantics

CLOSED_TO_ARRIVAL must apply to requested start date only where category supports arrival semantics.

Interior-date CTA must not incorrectly block an already-started range unless canonical policy explicitly says so.

## 15. CTD semantics

CLOSED_TO_DEPARTURE must apply to requested end/departure date. Review exact range arithmetic and off-by-one behavior.

## 16. Deferred MAX_STAY / occupancy/PAX assessment

Compare the report's deferral with the current Roadmap. If 1.8D explicitly requires a dimension now, implementation is incomplete. Current Roadmap wins.

## 17. CategorySchema allowedRestrictions

Review exact authority, allowed values, absent field semantics, legacy behavior, Product schema snapshot/version behavior and absence of client mutation.

## 18. Legacy-safe default = all types — CRITICAL

Report says missing allowedRestrictions means all types.

Assess whether that safely preserves legacy compatibility or unintentionally grants CTA/CTD/etc. to categories that never declared them.

If Roadmap defines this, follow it. If not and behavior materially changes Seller capabilities, return architecture decision required.

## 19. Cross-category compatibility

Validate accommodation, tour, transfer, excursion/activity and car rental. No Hotel-only core fields.

## 20. Precedence — HARD GATE

Reported precedence: `DATE > PERIOD-attached > BASE`.

Reconstruct from code.

Verify insertion order and createdAt are irrelevant, archived rules ignored, same-tier contradiction rejected and base never unexpectedly beats a specific rule.

## 21. Explicit override / relaxation semantics — CRITICAL

Determine whether a more-specific rule can intentionally relax a broader presence/boolean restriction where business policy allows.

Example:
BASE CTA=true.

Can a specific date explicitly say CTA=false/open?

If absence merely falls back to base and there is no explicit negative override, then the model only adds restrictions and cannot truly override them.

Determine whether this matches canonical semantics. Do not call the model “overrides” if required relaxation cannot be expressed.

## 22. Same-tier ambiguity

Create contradictory same-type/scope/specificity rules. Expected controlled 422 on create/update/activate/concurrent write, and fail-closed runtime for bad legacy state.

## 23. Cross-type conflicts

Review logically conflicting combinations such as MIN_STAY > base MAX_STAY while allowing valid coexistence such as CTA + stop-sell.

## 24. Evaluator purity

Verify `evaluateRestrictions()` is pure/deterministic, uses injected today, has no hidden system clock/DB order and returns explainable applied provenance.

## 25. Resolver composition

Restrictions must compose with 1.8C price resolution without separate divergent policy paths in Quote, public catalog and priceFrom.

## 26. Fail-closed behavior

Verify missing required evaluation context does not become silently allowed, while unrelated categories are not blocked unnecessarily.

## 27. Quote pre-binding gate — HARD GATE

Before Quote is binding, Catalog price and restrictions must be server-resolved and ineligible context rejected.

Client cannot forge eligibility.

## 28. restrictionSnapshot

Review exact contents, bounded size, no PII/untrusted dumps, sufficient provenance and immutability after issue.

## 29. Snapshot versioning assessment

Determine whether lack of explicit snapshot version makes future interpretation ambiguous. Add minimal version only if needed now.

## 30. Quote ISSUE freeze — CRITICAL

Reproduce:
1. valid Quote issued;
2. Seller adds stop-sell;
3. Seller changes price;
4. Seller changes min-stay/CTA/CTD.

Already-issued Quote must preserve approved freeze semantics and not be silently repriced/invalidated solely by current Catalog edits.

## 31. Checkout/Sale freeze compatibility

Trace actual flow and verify no post-issue current-Catalog restriction re-resolution was reintroduced.

## 32. No silent repricing

Restriction changes must never silently mutate frozen monetary fields.

## 33. Public priceFrom policy — CRITICAL

Review reported eligible-set policy against canonical Universal Pricing semantics.

Potential issues:
- base FIXED always may advertise a price while all relevant dates are stop-sold;
- global minimum may reflect inaccessible future context;
- DATE-scope restrictions may be only partially considered;
- exact search horizon may still be deferred.

Do not approve policy merely because JS/SQL agree if the underlying business contract is wrong.

## 34. JS/raw SQL parity

Verify with shared fixtures:
- base only;
- period cheaper than base;
- period stop-sold;
- DATE_OVERRIDE stop-sold;
- advance booking;
- archived restriction;
- POR;
- archived RatePlan;
- inactive Product/ServiceUnit.

Displayed value and sort key must match.

## 35. Stop-sell completeness logic

Review what “fully stop-sold” means for a period and whether SQL can correctly determine it without excessive/incorrect assumptions.

## 36. Public projection/privacy

No restriction history/audit/internal actor/version leaks publicly.

## 37. Availability separation — HARD GATE

Prove:
- restrictions allow + capacity 0 → inventory blocks;
- capacity >0 + stop-sell → restriction blocks;
- restriction CRUD changes zero slots;
- restriction CRUD creates/releases zero holds.

## 38. 1.8C sellability reconciliation

Document clearly the relationship among CommercialPeriod sellability, CommercialRestriction STOP_SELL and Availability capacity.

No duplicate authority.

## 39. Multi-date MIN_STAY

Verify duration arithmetic and accommodation N-night semantics without globalizing Hotel assumptions.

## 40. CTA interior behavior

Test multiple interior dates.

## 41. CTD end-date behavior

Test exact departure/end date and off-by-one cases.

## 42. Stop-sell across ranges

For hotel-like ranges, a stop-sold required interior date should block new binding flow. Do not apply globally without category semantics.

## 43. API surface

Review create/list/get/update/archive/activate/history and route consistency with 1.8C.

## 44. Partner mutation gate

Report says PARTNER own-scope under DRAFT Product. Verify every mutation path uses authoritative current Product state in transaction.

## 45. Staff/ADMIN semantics

Review consistency with 1.8B and 1.8C permissions, especially archive/activate via `catalog.rate_plan.publish`.

## 46. MODERATOR/BUYER semantics

Verify denied behavior according to canonical conventions.

## 47. IDOR

Cross-Seller guessed Tariff, CommercialPeriod, CommercialRestriction and history must not leak.

## 48. Mass assignment

Attempt forged id/code/tariffId/commercialPeriodId mismatch/partner/product/status/version/history/audit/createdBy/timestamps/resolved eligibility/Quote snapshot/Availability counters/reservation IDs/timezone/time-slot/future restriction types.

Loud reject.

## 49. JSON safety

Review both `Tariff.restrictions` and `restrictionSnapshot`: bounded shape, no prototype-pollution keys, no arbitrary nested objects, no script/html injection where relevant and no huge payload.

## 50. Version CAS

Stale PATCH → 409. Prove final DB state/history and no lost update.

## 51. Advisory-lock consistency — CRITICAL

Report says restriction lock is Tariff-level and separate from period lock.

Review races between restriction and period mutation, especially:
- CommercialPeriod archived while PERIOD restriction created;
- restriction activated while period archived.

Independent lock namespaces must not leave active restriction attached to ineligible period.

## 52. Duplicate-create race

Expected controlled success/conflict, no raw 500 and no duplicate active rules.

## 53. Lifecycle races

Test PATCH vs archive, PATCH vs activate and archive vs activate.

## 54. Audit/history race

One committed transition → one matching history/audit fact. Failed/stale request → none.

## 55. CommercialRestrictionHistory

Verify created/updated/archived/activated facts, actor, occurredAt and from/to values where relevant.

## 56. Delete safety

Prove RESTRICT behavior and parent hard-delete consequences. Commercial evidence must not be silently destroyed.

## 57. History consistency

Ensure 1.8D follows the same history conventions as TariffHistory and CommercialPeriodHistory.

## 58. Migration review

Inspect both migrations:
- `add_commercial_restrictions`
- `add_quoteitem_restriction_snapshot`

Verify additive, fresh-deploy-safe, no destructive backfill, safe defaults/FKs/enums and no manual DB hacks.

## 59. Drift verification

Implementation report says `migrate diff` was not run due to missing shadowDatabaseUrl.

Use the repository's actual canonical drift verification procedure. Do not claim drift 0 from a command that did not execute.

Run supported schema comparison/fresh replay and report exact evidence.

## 60. CRS-* ID contract

Verify prefix registered once, generated server-side atomically, client cannot forge and no collision-retry hack exists.

## 61. Hotel validation

Prove min-stay, advance booking, CTA, CTD, stop-sell, date override and period relation.

## 62. Tour validation

Unsupported hotel-only restrictions rejected unless CategorySchema permits them.

## 63. Transfer validation

No forced min-stay/CTA/CTD unless category explicitly permits them.

## 64. Excursion/activity validation

Date-only restrictions must not introduce time-slot behavior.

## 65. Car rental validation

Duration/minimum-rental semantics only where category declares them.

## 66. Unit coverage audit

Implementation reports 27 targeted unit tests. Map assertions to precedence, override direction, stop-sell, min-stay, advance, CTA, CTD, date boundaries, unsupported dimensions, ambiguity, archived rules, provenance and fail-closed behavior.

## 67. E2E coverage audit

Implementation reports 20 targeted E2E tests. Do not approve by count.

At minimum prove:
1. create;
2. list/get/history;
3. update;
4. archive;
5. activate;
6. own-scope;
7. cross-Seller;
8. BUYER denied;
9. MODERATOR denied;
10. admin/staff semantics;
11. forged fields;
12. category allowlist;
13. stop-sell;
14. stop-sell does not mutate price;
15. stop-sell does not mutate Availability;
16. min-stay fail/pass;
17. advance fail/pass;
18. CTA start;
19. CTA interior non-block;
20. CTD end;
21. base/period/date precedence;
22. ability or inability to relax broader restriction explicitly;
23. same-tier ambiguity 422;
24. concurrent duplicate create;
25. stale PATCH 409;
26. lifecycle races;
27. Quote pre-binding restriction block;
28. Quote issue snapshot;
29. Seller edits restriction after issue → frozen Quote remains valid;
30. Seller edits price after issue → frozen Quote remains valid;
31. Checkout/Sale no post-binding re-resolution;
32. priceFrom stop-sell;
33. priceFrom advance booking;
34. JS/raw SQL parity;
35. POR non-bindable;
36. archived RatePlan/period/restriction behavior;
37. Hotel;
38. Tour;
39. Transfer;
40. Activity;
41. Car Rental;
42. no timezone/time-slot;
43. no Reservation side effects;
44. no Sales/Order/Booking rows from restriction CRUD;
45. migration replay;
46. no PII/public leakage.

Add critical missing tests.

## 68. Regression-test evolution

Inspect modifications to 1.8A–1.8C or Sales/public-catalog tests. Ensure prior assertions were not weakened merely to make 1.8D pass.

## 69. Backend regression

After review fixes run TypeScript compile/build, all unit tests, targeted 1.8D E2E, 1.8C, 1.8B, 1.8A, Quote, Checkout, Sale, public Catalog, Availability/reservations/Step 2.4, Reverse 2.2A–2.2F, Step 2.5/2.5A/2.5B, RBAC/security and full serial E2E.

Report exact counts.

## 70. Frontend regression

Even if unchanged, run tsc, vitest and production build. Report exact counts.

## 71. DB regression

Run migrate status, fresh replay and repository-standard drift verification. Report exact migration count.

## 72. Runtime verification

Use real AppModule/E2E runtime:

`Product → ServiceUnit → RatePlan → CommercialPeriod → CommercialRestriction → pre-binding Quote`

Demonstrate valid date, stop-sold date, min-stay fail, advance-booking fail, CTA, CTD, issued Quote freeze after Seller edits and one non-Hotel category.

## 73. Documentation

Review/update:
- `docs/architecture/commercial-restrictions-overrides-foundation.md`
- `docs/architecture/universal-pricing-model.md`
- `docs/architecture/period-pricing-foundation.md`
- `docs/architecture/rate-plan-foundation.md`
- `docs/contracts/api.md`
- `docs/contracts/ids.md`
- Roadmap.

Docs must describe actual code.

## 74. Roadmap update

Only if approved, set Step 1.8D to:
- `✅ STRICT REVIEW COMPLETED — APPROVED`
or
- `✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

Then update CURRENT CANONICAL EXECUTION SEQUENCE.

Expected exact NEXT:
`STEP 2.6 — REMOVE BOOTSTRAP ORDER CREATION`

Verify against actual current Roadmap before writing it.

Do not start Step 2.6.

## 75. Architecture stop conditions

Return `PHASE 1 STEP 1.8D STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED` if review uncovers unresolved architecture such as:
- Tariff.restrictions and CommercialRestriction cannot form one authority;
- explicit negative/unset override semantics are required but cannot be represented;
- public priceFrom eligible-set policy is undefined and materially changes ranking/customer promise;
- Quote freeze conflicts with current restriction revalidation;
- stop-sell conflicts with Availability ownership;
- CategorySchema legacy default changes Seller capabilities without authority;
- date-only advance/CTA/CTD cannot work correctly before 2.8A;
- commercial history cannot be retained safely.

Do not invent a decision silently.

## 76. Allowed review fixes

Allowed:
- single-authority bugs;
- precedence/override bugs;
- category gates;
- validation;
- priceFrom errors;
- Quote freeze regressions;
- availability separation;
- RBAC/IDOR;
- concurrency/CAS;
- history/audit;
- migration/index issues;
- tests/docs/Roadmap synchronization.

## 77. Forbidden

Do not implement:
- Step 2.6;
- Step 2.8A;
- time-slot/timezone model;
- generic rules DSL;
- dynamic/AI pricing;
- supplier/channel-manager integrations;
- FX engine;
- frontend commercial calendar;
- Step 3.29I;
- new pricing authority;
- new availability/hold engine.

## 78. Required final report

# PHASE 1 — STEP 1.8D — STRICT REVIEW — ОТЧЁТ

1. Verdict
2. Repository baseline
3. Sources inspected
4. Roadmap/DD compliance
5. Catalog ownership
6. Single restriction authority
7. Tariff.restrictions reconciliation
8. Legacy restriction semantics
9. CommercialRestriction schema
10. Scope consistency
11. FK/delete semantics
12. STOP_SELL semantics
13. MIN_STAY semantics
14. ADVANCE_BOOKING semantics
15. CTA semantics
16. CTD semantics
17. Deferred MAX_STAY/occupancy/PAX assessment
18. CategorySchema allowedRestrictions
19. Legacy-safe category default review
20. Cross-category compatibility
21. Precedence model
22. Explicit override/relaxation semantics
23. Same-tier ambiguity
24. Cross-type conflicts
25. Evaluator purity
26. Price/restriction resolver composition
27. Fail-closed behavior
28. Quote pre-binding gate
29. restrictionSnapshot
30. Snapshot versioning assessment
31. Quote ISSUE freeze
32. Checkout/Sale freeze compatibility
33. No silent repricing
34. Public priceFrom policy
35. JS/raw SQL parity
36. Stop-sell completeness logic
37. Public projection/privacy
38. Availability separation
39. 1.8C sellability reconciliation
40. Multi-date MIN_STAY
41. CTA interior behavior
42. CTD end-date behavior
43. Stop-sell across ranges
44. API surface
45. Partner mutation gate
46. Staff/ADMIN semantics
47. MODERATOR/BUYER semantics
48. IDOR
49. Mass assignment
50. JSON safety
51. Version CAS
52. Advisory-lock consistency
53. Duplicate-create race
54. Lifecycle races
55. Audit/history race
56. CommercialRestrictionHistory
57. Delete safety
58. History consistency
59. Migration review
60. Drift verification
61. CRS-* ID contract
62. Hotel validation
63. Tour validation
64. Transfer validation
65. Excursion/Activity validation
66. Car Rental validation
67. Unit coverage audit
68. E2E coverage audit
69. Regression-test evolution
70. Backend regression
71. Frontend regression
72. DB regression
73. Runtime verification
74. Issues found/fixed
75. Documentation changes
76. Roadmap update
77. Architecture decision status
78. Out-of-scope confirmation
79. Exact files changed
80. **Exact NEXT item**

Final line must repeat the verdict.

## 79. STOP

After Step 1.8D STRICT REVIEW: STOP.

If approved, report exact NEXT from synchronized Roadmap.

Expected:
`STEP 2.6 — REMOVE BOOTSTRAP ORDER CREATION`

Do not implement it in the same pass.
