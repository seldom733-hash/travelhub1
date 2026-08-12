# PHASE 1 --- STEP 1.8D --- COMMERCIAL RESTRICTIONS / OVERRIDES FOUNDATION --- IMPLEMENTATION PROMPT

## 0. EXECUTION MODE

You are implementing **exactly one canonical roadmap item**:

**PHASE 1 --- STEP 1.8D --- COMMERCIAL RESTRICTIONS / OVERRIDES
FOUNDATION**

This is an **IMPLEMENTATION PASS**, not a Strict Review.

Current canonical state:

-   Step 1.8A --- Service Template / Seller Commercial Structure
    Foundation --- **STRICT REVIEW APPROVED**.
-   Step 1.8B --- Tariff / Commercial Variant (Rate Plan) Foundation ---
    **STRICT REVIEW APPROVED WITH REVIEW FIXES**.
-   Universal Pricing Model Amendment --- **STRICT REVIEW APPROVED WITH
    REVIEW FIXES**.
-   Step 1.8C --- Period Pricing & Period Availability Foundation ---
    **STRICT REVIEW APPROVED WITH REVIEW FIXES**.
-   **Step 1.8D --- Commercial Restrictions / Overrides Foundation ---
    NEXT / UNBLOCKED.**
-   Step 1.8D STRICT REVIEW is a separate next pass and MUST NOT be
    performed now.
-   After Step 1.8D + its successful STRICT REVIEW, canonical execution
    returns to **Step 2.6 --- Remove Bootstrap Order Creation**.

### Hard execution rule

Follow:

`Implementation → STOP → Strict Review → APPROVED → next item`

Do **not**: - perform the 1.8D Strict Review in this pass; - start Step
2.6; - jump to Step 2.8A; - implement Partner Commercial Calendar UI
(3.29I); - implement a revenue-management engine; - implement a
channel-manager rules engine; - implement supplier/API/dynamic
pricing; - implement time-slot/exact-departure/timezone-aware commercial
rules; - silently redesign 1.8A/1.8B/1.8C contracts.

If implementation reveals a genuine ownership conflict, incompatible
canonical invariant, destructive migration requirement, or a decision
that cannot safely be derived from approved architecture:

`ARCHITECTURE DECISION REQUIRED`

and STOP instead of inventing architecture.

------------------------------------------------------------------------

# 1. AUTHORITATIVE SOURCES --- INSPECT BEFORE CODING

Before changing code, inspect the repository and reconcile the
implementation against the **current repository state**, not
assumptions.

At minimum inspect:

1.  `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`

    -   Step 1.8D;
    -   Step 1.8C and its STRICT REVIEW fixes;
    -   Universal Pricing Model section;
    -   CURRENT CANONICAL EXECUTION SEQUENCE;
    -   DD-026 / DD-028;
    -   Step 2.8A conditional dependency;
    -   ownership map.

2.  `docs/architecture/universal-pricing-model.md`

3.  `docs/architecture/service-templates-decision-gates.md`

    -   especially DD-026 and DD-028.

4.  `docs/architecture/service-unit-foundation.md`

5.  `docs/architecture/rate-plan-foundation.md`

6.  `docs/architecture/period-pricing-foundation.md`

7.  Current Prisma schema and migrations for:

    -   Product;
    -   ServiceUnit;
    -   Tariff;
    -   TariffHistory;
    -   CommercialPeriod;
    -   CommercialPeriodHistory;
    -   Availability;
    -   AvailabilityReservation;
    -   Quote / QuoteItem;
    -   CheckoutIntent / Sale.

8.  Current Catalog services/controllers/validation:

    -   rate-plan;
    -   commercial-period;
    -   period-resolution;
    -   public catalog;
    -   CategorySchema validation;
    -   permissions/RBAC;
    -   shared validation;
    -   IDs.

9.  Current Sales integration with Catalog pricing:

    -   Quote issue/freeze semantics;
    -   `QuoteItem.serviceDate`;
    -   checkout behavior;
    -   Sale completion;
    -   no-reprice-after-binding contract.

10. Existing tests for:

    -   1.8A;
    -   1.8B;
    -   1.8C;
    -   Quote/Checkout/Sale;
    -   public catalog;
    -   availability/reservations;
    -   RBAC/object scope.

Do not trust this prompt over newer canonical repository documentation
if the repository contains an explicitly later approved amendment. If a
contradiction exists, report it before implementation.

------------------------------------------------------------------------

# 2. STEP OBJECTIVE

Implement the minimum canonical **Commercial Restrictions / Overrides
Foundation** needed to make sellability rules deterministic and
server-authoritative across Rate Plans and date-based commercial
periods.

The foundation must support, at minimum:

-   stop-sell semantics;
-   minimum stay / minimum duration where applicable;
-   advance-booking restriction;
-   closed-to-arrival;
-   closed-to-departure;
-   deterministic scoped overrides;
-   category-safe extensibility;
-   server-authoritative restriction evaluation;
-   audit/history for mutable sellable terms introduced/changed by this
    step;
-   compatibility with the existing pricing resolver;
-   compatibility with public Marketplace display and binding Quote
    flow.

This step is **not** a general-purpose rule engine.

------------------------------------------------------------------------

# 3. NON-NEGOTIABLE DOMAIN INVARIANTS

## 3.1 Canonical commercial graph

Preserve:

`Product → ServiceUnit → Tariff/Rate Plan → CommercialPeriod / commercial rules → server-resolved commercial result`

Do not create a parallel RatePlan, pricing, availability, restriction,
or quote authority.

## 3.2 Ownership

Commercial restrictions introduced here are **Catalog-owned**.

Do not move mutable commercial facts into: - Sales; - Order; -
Booking; - Reverse Marketplace; - Communication; - Finance.

Cross-domain reads must respect existing ADR/ownership rules.

## 3.3 Pricing ≠ Availability ≠ Restrictions

Keep these concepts distinct:

-   **Pricing** answers how much.
-   **Availability** answers how much capacity can be sold.
-   **AvailabilityReservation/Hold** answers what capacity has been
    committed/held.
-   **Commercial restriction** answers whether the commercial terms
    allow the requested sale/stay/arrival/departure in the evaluated
    context.

A restriction MUST NOT become an inventory counter.

A stop-sell MUST NOT delete a price.

A stop-sell MUST NOT fabricate zero availability history by rewriting
inventory facts unless an already-approved Catalog contract explicitly
requires that representation.

## 3.4 Stop-sell ≠ delete price

If a date/range is stop-sold: - historical/commercial price facts
remain; - the server marks the commercial context non-sellable; -
public/binding flows must not treat the retained price as
instant-bindable.

## 3.5 Server is authoritative

Frontend MUST NOT calculate binding: - price; - restriction
precedence; - stop-sell; - minimum stay; - booking-window eligibility; -
CTA/CTD eligibility.

The server resolver/evaluator is the only authority.

## 3.6 No fabricated price

Preserve the Universal Pricing hard gate:

If there is no authoritative price for the requested context, do not: -
extrapolate; - use stale/future unrelated price; - fabricate zero; -
silently substitute current/base price contrary to approved precedence.

`PRICE_ON_REQUEST` is intentional Rate Plan semantics, not a generic
fallback for missing data.

## 3.7 Quote freeze

Preserve the approved 1.8C Strict Review fix:

**Catalog is authoritative before Quote binding/issue. After binding,
Seller calendar/restriction edits MUST NOT reprice or invalidate the
already frozen Quote merely by re-reading current Catalog state.**

Do not reintroduce `verifyCheckoutPeriodPrices`-style post-binding
re-resolution.

If current Sales lifecycle has an explicit pre-binding evaluation point,
restrictions are evaluated there and the relevant provenance/snapshot
must be frozen consistently with existing Quote semantics.

## 3.8 Date-only boundary

1.8D remains within the currently approved **UTC date-only** commercial
boundary.

Do not invent: - Product timezone; - ServiceUnit timezone; - commercial
timezone authority; - exact departure time; - time slots; -
timezone-aware restriction evaluation.

Those depend on Step 2.8A.

## 3.9 Universal, not Hotel-specific

The model must work across categories.

Hotel-like terms such as min nights / CTA / CTD may be
category-supported, but generic core must not assume every Product is a
hotel.

Use CategorySchema or the existing normalized Catalog mechanism to
determine which restriction dimensions are valid for a category.

Examples: - accommodation: min stay, CTA, CTD, advance booking; -
tour/excursion: duration/booking-window semantics where supported; -
transfer/car rental/other services: only dimensions explicitly supported
by category contracts.

No hardcoded `if category == HOTEL` architecture if the repository
already provides schema-driven extensibility.

------------------------------------------------------------------------

# 4. REQUIRED DESIGN DECISION INSIDE IMPLEMENTATION

Before writing the migration, inspect the actual 1.8B/1.8C schema and
determine the **smallest additive representation** for restrictions.

Preferred architecture must satisfy all of the following:

1.  No second pricing engine.
2.  No second availability engine.
3.  No generic arbitrary-expression DSL.
4.  No unbounded JSON rule language that becomes an undocumented rules
    engine.
5.  Restrictions are typed and mechanically validatable.
6.  Scope is explicit.
7.  Specificity/precedence is deterministic.
8.  Same-scope ambiguous conflicts are rejected.
9.  Historical changes are auditable.
10. Future dimensions can be added additively.

Possible implementation shapes include: - typed restriction fields on an
appropriate existing Catalog commercial entity; - a dedicated
Catalog-owned typed restriction/override entity; - a narrowly structured
hybrid.

Do **not** choose based on convenience alone. Reconcile with the
existing `Tariff.restrictions` metadata introduced in 1.8B. That field
was a structured metadata/extension point, not permission to create two
competing authorities.

### Mandatory reconciliation

Explicitly answer in implementation documentation:

-   What is authoritative now: `Tariff.restrictions`, a new typed
    entity, or a defined split?
-   If `Tariff.restrictions` remains, what exact role does it have?
-   How are legacy rows interpreted?
-   Is any migration/backfill needed?
-   Can the new model be additive?
-   How are unsupported/unknown restriction keys handled?
-   How is duplicate authority prevented?

If the current schema makes a safe single authority impossible without
changing an approved contract:

`ARCHITECTURE DECISION REQUIRED`

------------------------------------------------------------------------

# 5. MINIMUM RESTRICTION SET

Implement the smallest typed set required by the Roadmap.

## 5.1 STOP_SELL

Must support a scoped commercial stop-sell without deleting: - Tariff; -
CommercialPeriod; - price; - Availability rows.

Evaluation result must be explicitly non-sellable.

## 5.2 MIN_STAY / MIN_DURATION

Support a minimum requested service/stay duration where the category
permits it.

Requirements: - positive integer/typed bounded value; - no negative/zero
nonsense; - do not globally call every duration "nights"; -
accommodation can project the concept as nights; - other categories may
use a category-supported duration semantic.

If current 1.8C has legacy `minNights/maxNights` or equivalent fields,
reconcile rather than duplicate them.

## 5.3 ADVANCE_BOOKING

Support minimum advance-booking lead time in a date-only-safe form.

Because Step 2.8A is not implemented: - do not introduce
hour/minute/timezone semantics; - use a deterministic date-based
contract if safe; - define exactly how "today" and service date are
compared in UTC date-only semantics; - reject impossible values.

Do not implement last-minute/revenue-management pricing.

## 5.4 CLOSED_TO_ARRIVAL (CTA)

Where category-supported: - requested start/arrival date may be
blocked; - existing in-progress stay/range semantics must not be
confused with inventory.

## 5.5 CLOSED_TO_DEPARTURE (CTD)

Where category-supported: - requested end/departure date may be
blocked; - define date-range semantics precisely.

CTA/CTD must not become globally mandatory for categories that do not
have arrival/departure semantics.

------------------------------------------------------------------------

# 6. SCOPE MODEL

Restrictions/overrides must have an explicit scope.

At minimum reconcile whether restrictions apply to:

-   Rate Plan base;
-   CommercialPeriod;
-   exact date/date override;
-   category-supported condition;
-   service date or service date range.

The implementation must make scope mechanically testable.

Do not infer precedence from: - row order; - insertion order; -
`createdAt`; - frontend ordering; - arbitrary database return order.

------------------------------------------------------------------------

# 7. DETERMINISTIC PRECEDENCE

Preserve approved Universal Pricing precedence and extend it only as
necessary for restrictions.

Existing price precedence is conceptually:

1.  exact/specific `DATE_OVERRIDE`;
2.  more specific conditional override;
3.  applicable seasonal/`PERIOD`;
4.  `DAY_OF_WEEK` condition inside a period;
5.  base/`FIXED`.

For restrictions:

-   the server must deterministically identify all applicable
    restriction facts;
-   more specific scoped facts may override broader facts only by an
    explicitly documented mechanical rule;
-   same-priority/same-specificity contradictory facts matching the same
    context must be rejected at write time where possible;
-   runtime ambiguity must fail closed/deterministically, not guess;
-   `createdAt` is never precedence.

### Critical semantic rule

A more specific override may intentionally override a broader commercial
rule, but the implementation must document **which dimensions define
specificity**.

Example class of valid behavior: - broad summer rule; - narrower
holiday/date override; - exact date wins.

Example class of invalid behavior: - two equally specific active rules
for the same scope/context with contradictory stop-sell or min-stay
values and no deterministic authority.

Return a controlled domain error, normally `422`, consistent with
current 1.8C conflict semantics.

------------------------------------------------------------------------

# 8. RESOLVER / EVALUATOR CONTRACT

Do not create two independent decision paths.

Inspect the existing 1.8C `period-resolution` implementation and either
safely extend it or introduce a narrowly composed Catalog resolver so
that price + restriction evaluation cannot disagree.

The server result should be explainable.

At minimum the resolved commercial result should be able to communicate
internally:

-   Rate Plan identity;
-   ServiceUnit identity where applicable;
-   service date/range;
-   matched CommercialPeriod / override identity;
-   resolved price provenance;
-   sellable / non-sellable;
-   stop-sell reason/source;
-   applied restriction identities;
-   min stay/duration;
-   advance-booking requirement;
-   CTA/CTD result where applicable;
-   basis;
-   currency;
-   quantity/duration dimensions already supported by canonical pricing;
-   deterministic failure reason.

Do not expose internal IDs/fields publicly unless current public DTO
policy permits them.

------------------------------------------------------------------------

# 9. PUBLIC MARKETPLACE CONTRACT

Preserve:

-   public Catalog only exposes eligible/published commercial offers;
-   `PRICE_ON_REQUEST` remains inquiry-only;
-   ARCHIVED/DRAFT-ineligible commercial structures remain hidden
    according to existing rules;
-   public `priceFrom` is server-derived;
-   frontend does not recompute commercial eligibility.

### 9.1 `priceFrom`

Audit the current 1.8C `priceFrom` implementation.

A price from a stop-sold or otherwise commercially ineligible context
MUST NOT be advertised as an immediately sellable authoritative "from"
price if that contradicts the documented policy.

Do not casually redefine `priceFrom`. Document the exact eligible-set
policy and add regression tests.

### 9.2 PDP/date selection

After the Buyer selects a service date/range: - server resolves price; -
server evaluates restrictions; - availability remains a separate
evaluation; - only an eligible result can proceed into binding
commercial flow.

No frontend-only eligibility.

------------------------------------------------------------------------

# 10. QUOTE / CHECKOUT / SALE INTEGRATION

Inspect the actual Sales flow before changing it.

Required behavior:

1.  Before binding Quote:
    -   Catalog resolves authoritative price;
    -   Catalog evaluates applicable restrictions;
    -   non-sellable context fails deterministically.
2.  Quote snapshot/provenance:
    -   preserve existing 1.8C `serviceDate` provenance;
    -   add only the minimum restriction provenance/snapshot necessary
        to explain the binding decision if the current model requires
        it;
    -   do not overbuild a future rules snapshot system.
3.  After Quote is binding/issued:
    -   do not re-read current Catalog restrictions merely because
        Seller later edited them;
    -   do not silently invalidate or reprice the frozen Quote;
    -   preserve canonical Quote freeze semantics.
4.  Checkout/Sale:
    -   do not introduce a second commercial resolver;
    -   do not mutate Catalog;
    -   do not bypass AvailabilityReservation/Step 2.4 capacity
        semantics.

If a restriction legally/business-wise must invalidate already-issued
Quotes, that is a new commercial policy decision and MUST NOT be
invented in this step.

------------------------------------------------------------------------

# 11. AVAILABILITY INTEGRATION

Restrictions are not Availability counters.

However, the final pre-binding commercial eligibility result must
compose correctly with current availability checks.

Verify:

-   stop-sell blocks sale even if capacity \> 0;
-   no capacity blocks sale even if restrictions allow;
-   price can exist while stop-sold;
-   price can exist while capacity is zero;
-   availability does not overwrite restriction facts;
-   restriction writes do not create/release AvailabilityReservation
    holds;
-   multi-date future compatibility is preserved.

Do not implement a second hold engine.

------------------------------------------------------------------------

# 12. MULTI-DATE / RANGE SEMANTICS

The Roadmap already preserves future multi-date compatibility.

For a requested date range, define deterministic restriction evaluation.

At minimum test:

-   min-stay against requested range;
-   CTA on start date;
-   CTD on end/departure date;
-   stop-sell on any required service date according to the chosen
    category semantics;
-   period transitions inside a range;
-   exact-date override inside a broader season.

Do not fabricate time-slot behavior.

Do not silently alter Step 2.4 hold cardinality unless this step
actually touches multi-date reservations and the approved DD-027
contract requires it.

------------------------------------------------------------------------

# 13. CATEGORYSCHEMA / NORMALIZED TAXONOMY

DD-028 establishes Catalog ownership of normalized dictionaries.

Requirements:

-   supported restriction dimensions are Catalog-owned;
-   Reverse Marketplace is a consumer, not owner;
-   preserve Seller source/original values where the current
    normalization contract requires it;
-   do not introduce uncontrolled global marketing enums;
-   unsupported restriction dimensions for a category must fail
    loudly/deterministically;
-   do not silently ignore forged/unknown keys.

If CategorySchema needs an additive restriction capability declaration,
implement it minimally and document migration/compatibility behavior.

------------------------------------------------------------------------

# 14. API SURFACE

Implement the minimum Partner/internal API needed to manage
restrictions/overrides consistently with 1.8A--1.8C conventions.

Reuse existing endpoint hierarchy where possible.

The API must support as applicable:

-   list;
-   create;
-   update;
-   archive/deactivate;
-   activate/reactivate if consistent with existing Catalog lifecycle;
-   history;
-   bulk operation only if required to make the canonical
    annual/seasonal workflow viable without 365 manual operations.

Do not implement 3.29I frontend/calendar UI.

### API rules

-   server-derived ownership;
-   PARTNER own-scope;
-   internal permissions per existing Catalog conventions;
-   neutral IDOR behavior consistent with nearby endpoints;
-   forbidden/mass-assignment keys fail loudly (`422`);
-   client cannot forge:
    -   partnerId;
    -   productId where server-derived;
    -   tariff ownership;
    -   IDs/codes;
    -   history/audit actor;
    -   version;
    -   timestamps;
    -   Sales/Quote/Order refs;
    -   resolved price;
    -   resolved eligibility;
    -   availability counters.

------------------------------------------------------------------------

# 15. RBAC / OBJECT SCOPE

Follow existing Catalog permission architecture.

Verify:

-   PARTNER can manage only own commercial structures;
-   Partner A cannot read/write Partner B restrictions;
-   BUYER cannot use Partner management endpoints;
-   MODERATOR does not gain commercial write power unless already
    canonically granted;
-   ADMIN/internal access follows current permissions, not role-name
    assumptions;
-   permission constants are registered consistently;
-   public endpoints never expose private management/history/audit
    fields.

Do not weaken existing 1.8A--1.8C guards.

------------------------------------------------------------------------

# 16. CONCURRENCY / CAS / IDEMPOTENCY

Commercial restrictions are mutable sellable terms and require
deterministic concurrency behavior.

Use existing Catalog conventions:

-   version-CAS where mutable entities are versioned;
-   stale update → controlled `409`;
-   no last-write-wins for concurrent conflicting PATCH;
-   create/update overlap/conflict checks must be race-safe;
-   use transaction/advisory locking if needed and consistent with 1.8C;
-   duplicate retries must not create duplicate active rules;
-   archive/activate should be idempotent if consistent with existing
    lifecycle;
-   failed validation must leave no partial rows/history/audit.

Test concurrency, not only sequential behavior.

------------------------------------------------------------------------

# 17. AUDIT / HISTORY

Roadmap explicitly requires audit/history for changes to sellable terms.

At minimum ensure changes introduced by 1.8D are reconstructable:

-   created;
-   updated;
-   activated;
-   archived;
-   stop-sell changes;
-   restriction value/scope changes.

Preserve existing: - `TariffHistory`; - `CommercialPeriodHistory`; -
SecurityService audit conventions.

Do not duplicate history authorities unnecessarily.

History must not be silently deleted by parent cleanup if current
approved delete-safety semantics require retention/restriction.

Do not dump sensitive/free-form payloads into security audit logs.

------------------------------------------------------------------------

# 18. MIGRATION SAFETY

Migration must be:

-   additive where possible;
-   fresh-deploy-safe;
-   deterministic;
-   replayable;
-   no manual DB edits;
-   no destructive reinterpretation of legacy Tariff/CommercialPeriod
    data;
-   no fabricated backfill values.

After migration verify:

-   `prisma migrate status`;
-   clean migration replay on e2e DB;
-   schema drift = 0.

If a destructive migration appears necessary, STOP and report.

------------------------------------------------------------------------

# 19. IDS

If a new first-class entity is introduced:

-   use the canonical ID service;
-   assign a stable prefix;
-   register it in `docs/contracts/ids.md`;
-   generate IDs atomically;
-   test concurrency;
-   do not invent random UUID/public-code behavior inconsistent with
    current conventions.

If no new first-class entity is needed, do not create a prefix merely
for symmetry.

------------------------------------------------------------------------

# 20. VALIDATION

Validation must cover at least:

-   invalid/unknown restriction type;
-   unsupported type for category;
-   negative/zero invalid values;
-   invalid date/range;
-   invalid scope;
-   contradictory values;
-   ambiguous equal-specificity overlap;
-   forged ownership/system fields;
-   stale version;
-   archived/ineligible parent Rate Plan;
-   archived/ineligible ServiceUnit/Product as applicable;
-   date-only boundary;
-   forbidden time-slot/timezone fields;
-   unsupported arbitrary rule JSON/DSL.

Use controlled 4xx domain responses, not raw Prisma/500 errors.

------------------------------------------------------------------------

# 21. REQUIRED TEST MATRIX

Add targeted unit/e2e coverage sufficient to prove the contract.

At minimum cover:

## 21.1 Basic lifecycle

1.  create restriction;
2.  list own;
3.  get/history;
4.  update;
5.  archive;
6.  activate/reactivate if supported;
7.  idempotent lifecycle retry.

## 21.2 Ownership / RBAC

8.  Partner own-scope success;
9.  foreign Partner read denied;
10. foreign Partner update denied;
11. BUYER denied management;
12. MODERATOR denied write unless current permission explicitly allows
    it;
13. ADMIN/internal permitted according to current permission model;
14. forged partner/product/tariff IDs rejected.

## 21.3 Stop-sell

15. price exists + capacity exists + stop-sell =\> non-sellable;
16. stop-sell does not delete price;
17. removing/overriding stop-sell restores eligibility where all other
    gates pass;
18. public `priceFrom` does not advertise an ineligible stop-sold
    context contrary to policy.

## 21.4 Min stay/duration

19. request below minimum =\> 422/non-sellable;
20. exact minimum =\> allowed;
21. unsupported category dimension =\> 422;
22. broader rule + narrower override =\> deterministic result.

## 21.5 Advance booking

23. service date too close =\> blocked;
24. boundary date =\> deterministic allowed/blocked according to
    documented inclusive semantics;
25. UTC date-only behavior is deterministic;
26. no timezone/time-of-day invention.

## 21.6 CTA / CTD

27. CTA blocks arrival/start date;
28. CTA does not incorrectly block an already-started range solely
    because an interior date has CTA;
29. CTD blocks departure/end date;
30. CTA/CTD unsupported category =\> rejected.

## 21.7 Precedence / ambiguity

31. base restriction + period restriction;
32. period + exact date override;
33. narrower/specific rule wins;
34. equal-specificity contradiction rejected `422`;
35. DB return/insertion order does not affect resolution;
36. archived rule ignored.

## 21.8 Pricing composition

37. restriction evaluation does not change numeric price unless an
    already-approved pricing rule does so;
38. price can remain resolvable while commercial result is non-sellable;
39. missing price remains missing and is not converted to POR;
40. POR remains inquiry-only;
41. period price precedence from 1.8C remains unchanged.

## 21.9 Quote freeze

42. pre-binding restriction violation blocks Quote;
43. valid pre-binding context can issue Quote;
44. after Quote ISSUE, Seller adds stop-sell =\> frozen Quote is not
    silently repriced/rejected by current Catalog re-read;
45. after Quote ISSUE, Seller changes min-stay/CTA/CTD =\> frozen Quote
    semantics remain consistent with approved binding contract;
46. `QuoteItem.serviceDate` provenance remains intact.

## 21.10 Availability separation

47. restrictions allow + no capacity =\> unavailable via Availability,
    not restriction mutation;
48. capacity exists + stop-sell =\> blocked;
49. restriction write creates zero AvailabilityReservation holds;
50. restriction archive creates/releases zero holds.

## 21.11 Concurrency

51. parallel PATCH with same version =\> one winner, one `409`;
52. concurrent duplicate/overlapping create =\> deterministic one
    success / controlled conflict as appropriate;
53. failed race leaves no duplicate history/audit success records.

## 21.12 Regression boundaries

54. no time-slot fields accepted;
55. no exact-departure/timezone authority introduced;
56. no Sales/Order/Booking/Finance rows created by restriction CRUD;
57. no Reverse Marketplace mutations;
58. 1.8A/1.8B/1.8C behavior remains green;
59. public Catalog remains safe;
60. full backend/frontend regression remains green.

You may combine scenarios where one test proves multiple requirements,
but the final report must map tests to these obligations.

------------------------------------------------------------------------

# 22. UNIT TESTS

Add unit tests for the pure restriction resolver/evaluator.

At minimum prove:

-   deterministic applicability;
-   specificity ordering;
-   stop-sell;
-   min stay/duration;
-   advance-booking boundary;
-   CTA;
-   CTD;
-   unsupported dimensions;
-   ambiguity;
-   archived rules ignored;
-   date-only UTC semantics;
-   composition with 1.8C price resolution;
-   explainable provenance.

Prefer pure deterministic functions for rule evaluation where practical.

------------------------------------------------------------------------

# 23. FULL REGRESSION

Before declaring implementation complete, run at minimum:

### Backend

-   TypeScript compile / build;
-   all unit tests;
-   targeted 1.8D e2e;
-   1.8C period-pricing regression;
-   1.8B Rate Plan regression;
-   1.8A ServiceUnit regression;
-   Quote/Checkout/Sale regression;
-   public Catalog regression;
-   availability/reservation regression;
-   RBAC/object-scope regression;
-   full e2e suite.

### Frontend

Even if frontend code is unchanged: - TypeScript check; - unit/vitest
suite; - production build.

### Database

-   migrate status;
-   clean migration replay;
-   drift check.

Do not report green tests that were not actually executed.

If a pre-existing flaky test appears, isolate and prove whether it is
unrelated; do not casually waive a failing full regression.

------------------------------------------------------------------------

# 24. DOCUMENTATION

Update the canonical documentation in the same pass.

At minimum:

1.  Create/update an architecture document such as:
    -   `docs/architecture/commercial-restrictions-overrides-foundation.md`
2.  Update:
    -   `docs/contracts/api.md` for new endpoints;
    -   `docs/contracts/ids.md` only if a new prefix/entity exists;
    -   permission documentation if applicable;
    -   `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`.
3.  Architecture doc must explicitly describe:
    -   owner;
    -   entity/model choice;
    -   relationship to `Tariff.restrictions`;
    -   supported restriction types;
    -   category support;
    -   scope;
    -   precedence;
    -   ambiguity behavior;
    -   stop-sell semantics;
    -   pricing vs availability vs restrictions;
    -   Quote freeze;
    -   date-only boundary;
    -   concurrency;
    -   history/audit;
    -   public projection;
    -   out-of-scope items;
    -   future extension points.

------------------------------------------------------------------------

# 25. ROADMAP UPDATE RULE

At the end of successful implementation, update the Roadmap honestly.

Step 1.8D must become:

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Do **not** mark it: - APPROVED; - DONE; - STRICT REVIEW COMPLETED.

Update `CURRENT CANONICAL EXECUTION SEQUENCE` so the active item
becomes:

`Step 1.8D — STRICT REVIEW`

Do not advance to Step 2.6 until Strict Review approves 1.8D.

Preserve the canonical return point:

`RETURN TO ORIGINAL SEQUENCE AT: Step 2.6 (Remove Bootstrap Order Creation)`

------------------------------------------------------------------------

# 26. OUT OF SCOPE --- HARD STOP

Do not implement:

-   Step 1.8D Strict Review;
-   Step 2.6;
-   Step 2.8A;
-   time-slot pricing/restrictions;
-   exact departure time;
-   timezone-aware commercial rules;
-   revenue management;
-   dynamic pricing;
-   supplier/API pricing;
-   channel-manager synchronization;
-   FX/multi-currency engine;
-   Partner Commercial Calendar UI 3.29I;
-   arbitrary rule DSL;
-   second pricing engine;
-   second availability engine;
-   second hold engine;
-   new Quote engine;
-   Reverse Marketplace changes unless a regression fix is strictly
    necessary and documented.

------------------------------------------------------------------------

# 27. IMPLEMENTATION QUALITY GATES

Implementation is incomplete if any of these remain unproven:

-   single restriction authority;
-   deterministic precedence;
-   category-safe behavior;
-   own-scope security;
-   conflict/overlap safety;
-   concurrency/CAS;
-   audit/history;
-   pricing/availability separation;
-   Quote freeze preservation;
-   public priceFrom correctness;
-   migration replay/drift;
-   full regression.

Do not optimize for "tests pass" by weakening existing assertions or
deleting meaningful regression coverage.

Any test evolution caused by the new canonical model must be explained
in the final report.

------------------------------------------------------------------------

# 28. FINAL REPORT FORMAT

Return a detailed report with at least the following sections:

1.  **Verdict**
2.  **Repository baseline**
3.  **Sources inspected**
4.  **Current → Target mapping**
5.  **Architecture / domain ownership**
6.  **Authoritative restriction model**
7.  **Tariff.restrictions reconciliation**
8.  **Schema + migration**
9.  **Restriction types implemented**
10. **CategorySchema / supported dimensions**
11. **Scope model**
12. **Deterministic precedence**
13. **Ambiguity/conflict behavior**
14. **Server resolver/evaluator**
15. **Stop-sell semantics**
16. **Min stay/duration semantics**
17. **Advance-booking semantics**
18. **CTA/CTD semantics**
19. **Pricing composition**
20. **Availability separation**
21. **Quote freeze / Sales integration**
22. **Public Marketplace / priceFrom**
23. **Partner/internal API**
24. **RBAC / own-scope / IDOR**
25. **Mass assignment / forbidden keys**
26. **Concurrency / CAS / idempotency**
27. **Audit/history**
28. **Migration / IDs**
29. **Targeted unit tests**
30. **Targeted e2e tests**
31. **1.8A--1.8C regression**
32. **Quote/Checkout/Sale regression**
33. **Availability regression**
34. **Public Catalog regression**
35. **Full backend regression**
36. **Frontend regression**
37. **Migration status / drift**
38. **Issues found and fixed**
39. **Documentation changes**
40. **Roadmap changes**
41. **Architecture decision status**
42. **Deferred / future extension points**
43. **Out-of-scope confirmation**
44. **Exact files changed**
45. **Exact NEXT item**

For every test claim include actual counts/results.

For every review-fix-like correction discovered during implementation,
explain: - defect; - risk; - fix; - test proving it.

------------------------------------------------------------------------

# 29. REQUIRED FINAL VERDICT

If implementation and all required checks succeed, the final line must
be exactly:

`PHASE 1 STEP 1.8D IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

If blocked by an unresolved architecture issue, use:

`ARCHITECTURE DECISION REQUIRED`

and explain the exact conflict without starting later steps.

If implementation is incomplete or regression is red, do not claim
completion.

------------------------------------------------------------------------

# 30. STOP CONDITION

After producing the implementation report:

**STOP.**

Do not: - perform STRICT REVIEW; - commit/push unless the surrounding
execution environment explicitly instructs you to do so; - start Step
2.6; - start any later Roadmap item.

The only legitimate next operational item after a successful
implementation pass is:

**PHASE 1 --- STEP 1.8D --- STRICT REVIEW**
