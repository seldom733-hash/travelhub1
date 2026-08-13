# PHASE 2 — STEP 2.6 — REMOVE BOOTSTRAP ORDER CREATION
## FINAL IMPLEMENTATION PROMPT

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.6 — Remove Bootstrap Order Creation  
**Mode:** IMPLEMENTATION  
**Prerequisite:** Step 1.8D STRICT REVIEW APPROVED / APPROVED WITH REVIEW FIXES  
**Canonical return point:** RETURN TO ORIGINAL SEQUENCE AT STEP 2.6  
**Next item after implementation:** Step 2.6 STRICT REVIEW  
**Hard stop:** Step 2.7 MUST NOT be started in this task.

---

# 1. MISSION

Implement exactly canonical Roadmap Step 2.6:

> Remove the temporary `/orders/bootstrap` Order-creation path so that a normal production Order can be created only through the canonical commercial/event-driven flow.

Canonical flow:

`Quote → CheckoutIntent → Sale → Sale completion → OrderRequested → Outbox/EventBus → Order-owned consumer → Order → OrderCreated`

Step 2.6 is a legacy-path removal / invariant-hardening step, not an Order redesign.

Target invariant:

> **NORMAL ORDER CREATION = CANONICAL FLOW ONLY.**

No user/staff/partner HTTP endpoint, helper, fixture endpoint, service shortcut, seed path or compatibility method may remain capable of creating a normal production Order outside the canonical `OrderRequested` consumer unless the current canonical Roadmap explicitly permits it.

Do not begin Step 2.7.

# 2. CANONICAL SEQUENCE GATE

Inspect the latest `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`.

Verify:
- Step 1.8D STRICT REVIEW is approved;
- CURRENT CANONICAL EXECUTION SEQUENCE names Step 2.6 as NEXT;
- Step 2.7 remains blocked until Step 2.6 implementation + separate STRICT REVIEW.

Current Roadmap wins over this prompt if they conflict.

# 3. REPOSITORY INVENTORY

Before deletion inspect/report:
1. branch/HEAD/origin relation;
2. dirty/untracked files;
3. Roadmap;
4. Steps 2.4, 2.5, 2.5A, 2.5B implementation/reviews;
5. Order schema/controller/service/module;
6. exact `/orders/bootstrap` route;
7. bootstrap DTO/validation/contracts;
8. every internal bootstrap method;
9. repository-wide `bootstrap` references;
10. every direct Prisma/raw Order write;
11. test fixtures/helpers and seeds creating Orders;
12. frontend/API clients using bootstrap;
13. docs/OpenAPI references;
14. canonical OrderRequested consumer;
15. Inbox/Outbox/EventBus;
16. ORD-* and TH-YYYY-###### allocation;
17. 2.5A temporal fields;
18. 2.5B acquisition fields;
19. Reverse 2.2F conversion;
20. Booking/Payment/Availability dependencies;
21. RBAC/audit/security tests.

Build `CURRENT → TARGET` before editing.

# 4. CURRENT → TARGET

Expected current coexistence:

Canonical:
`Sale → OrderRequested → Order consumer → Order`

Temporary:
`POST /orders/bootstrap → direct/legacy Order creation`

Target:
- bootstrap route gone;
- bootstrap-only DTO/validation/service logic removed if unused;
- no frontend/client bootstrap calls;
- no normal direct-create Order API;
- canonical consumer remains functional;
- 2.5A temporal facts preserved;
- 2.5B acquisition propagation preserved;
- Step 2.7 functionality not introduced.

# 5. OWNERSHIP — HARD GATE

Preserve approved boundaries.

Sales owns Quote/CheckoutIntent/Sale/frozen commercial snapshot/Sale completion/OrderRequested publication.

Order owns Order/OrderItem/OrderTraveler/OrderHistory/business IDs/OrderRequested consumption/OrderCreated.

Catalog owns Product/commercial facts/availability/holds.

Booking owns Booking.

Sales MUST NOT directly write Order tables.

# 6. REMOVE `/orders/bootstrap`

Remove the actual production route and all exposure:
- route decorator/controller method;
- bootstrap DTO imports;
- Swagger/OpenAPI exposure;
- current API docs;
- frontend/client references;
- aliases/versioned equivalents.

Required negative runtime assertion:

`POST /api/v1/orders/bootstrap` cannot create an Order and follows canonical removed-route behavior (normally 404).

Do not preserve it as 410/403/admin-only/feature-flagged/deprecated-but-working unless Roadmap explicitly requires that.

Do not replace it with `/orders/create`, `/orders/manual`, `/orders/init`, `/orders/admin-create`, etc.

# 7. REMOVE THE CAPABILITY, NOT ONLY THE ROUTE — CRITICAL

Trace bootstrap into service/domain code.

Remove bootstrap-only methods such as `bootstrapOrder`, `createBootstrapOrder`, or arbitrary DTO-driven creation APIs if they exist only for legacy creation.

If bootstrap and canonical consumer share low-level Order-owned transaction logic, preserve shared canonical logic and remove only the alternative authority.

Do not duplicate consumer logic.

# 8. DIRECT ORDER WRITE AUDIT — HARD GATE

Search repository-wide for:
- Prisma `order.create/createMany/upsert`;
- transaction equivalents;
- raw INSERT;
- seed/dev commands;
- fixture utilities.

Classify each remaining write:
1. canonical production consumer;
2. legitimate test fixture;
3. migration/data maintenance;
4. forbidden alternative production writer.

Category 4 must be zero.

# 9. CANONICAL CREATION AUTHORITY

Re-verify:

`OrderRequested → validation → Inbox dedup → Order transaction → IDs → Order → items → travelers → history/audit → OrderCreated Outbox → commit`

Do not reconstruct from mutable Product/Quote state.
Do not create a second consumer/event.
Do not use HTTP bootstrap DTO as canonical authority.

# 10. ORDERREQUESTED CONTRACT PRESERVATION

Preserve authoritative frozen facts actually approved in repository:
- Sale/Checkout/Quote identities as applicable;
- buyer/customer;
- frozen items/quantity;
- traveler context;
- currency/totals;
- payment terms;
- acquisition source/channel;
- service date/context;
- reservation refs;
- correlation/causation.

If canonical consumer currently depends on a bootstrap DTO, decouple it safely. Do not retain bootstrap API for code reuse.

# 11. STEP 2.5A TEMPORAL REGRESSION — HARD GATE

Preserve actual approved temporal contract:
- createdAt = persistence time;
- submittedAt/equivalent set only at canonical milestone;
- confirmed/cancelled/fulfilled/closed not fabricated;
- updatedAt not a business milestone;
- history/event occurredAt intact;
- temporal fields server-owned.

# 12. STEP 2.5B ACQUISITION REGRESSION — HARD GATE

Preserve immutable acquisition context through Order.

Do not infer source/channel from Product, URL, endpoint, Seller or request headers.

Verify current canonical values including MARKETPLACE/PARTNER_STOREFRONT/API/MANUAL-DIRECT and BUYER_REQUEST/Reverse semantics where approved.

# 13. REVERSE MARKETPLACE REGRESSION

Inspect actual approved 2.2F Proposal → Sales conversion.

Ensure Reverse-originated business still reaches Order through canonical Sales/Sale/OrderRequested flow.

No special Reverse bootstrap path.
No reverse.* ownership changes.

# 14. 1.8A–1.8D REGRESSION

Bootstrap removal must not alter:
- ServiceUnit;
- Rate Plan/Tariff;
- CommercialPeriod;
- CommercialRestriction;
- frozen Quote price;
- restrictionSnapshot;
- Quote freeze;
- service-date semantics;
- availability ownership.

Order consumes frozen upstream facts; it does not reprice.

# 15. MONEY AUTHORITY — HARD GATE

No client-supplied or recalculated Order money.

Preserve frozen upstream subtotal/discount/total/currency/payment terms using existing Decimal/string conventions.

No fallback/zero fabrication.

# 16. AVAILABILITY — HARD GATE

Preserve:

`Sale completion = capacity hold`
`Order creation ≠ second capacity decrement`

No hold recreation/release/new engine.
Duplicate OrderRequested must not duplicate availability reservation.

# 17. BOOKING ISOLATION

Do not implement:
- OrderReadyForBooking;
- BookingRequested;
- Booking creation;
- fulfillment;
- close;
- supplier processing.

These belong to Step 2.7+.

# 18. PAYMENT ISOLATION

No Payment/Refund/Settlement/Payout creation or Finance redesign.

# 19. RBAC / SECURITY

Verify:
- no role has hidden direct-create endpoint;
- no permission can invoke removed bootstrap behavior;
- no arbitrary actor/customer/partner IDs trusted;
- no mass-assignment creation bypass;
- existing read/manage permissions unchanged unless strictly required.

Do not add replacement create permission.

# 20. MASS ASSIGNMENT

Clients must not forge creation authority including:
id/code/order number, Sale/Quote/Checkout refs, ownership, money/currency, payment terms, acquisition, travelers, reservation IDs, temporal milestones, status/history/version, timestamps, correlation/causation.

# 21. ID CONTRACT

Preserve canonical `ORD-*` and `TH-YYYY-######`.

Canonical consumer remains allocator; no client IDs; no counter reset; concurrency uniqueness remains.

# 22. IDEMPOTENCY / CONCURRENCY

Prove:
- duplicate OrderRequested → one Order;
- concurrent duplicate → one Order;
- one OrderCreated;
- no duplicate items/travelers;
- no duplicate availability reservation;
- one Sale cannot obtain a second normal Order through an alternative writer.

# 23. INBOX / OUTBOX ATOMICITY

No partial state:
- Inbox consumed without Order;
- Order without required children;
- Order without required OrderCreated outbox;
- duplicate OrderCreated;
- partial travelers.

Do not redesign event infrastructure.

# 24. CORRELATION / CAUSATION

Preserve approved lineage:
- OrderCreated correlation inherits OrderRequested chain;
- causationId points to OrderRequested eventId according to current envelope;
- no Order/Sale/HTTP request code substituted as causal identity.

# 25. PII / TRAVELERS

Preserve minimum approved OrderTraveler snapshot.

No broad CRM copy; no PII in logs/audit/outbox/error messages; bootstrap request payload cannot remain traveler authority.

# 26. AUDIT / HISTORY

Remove obsolete bootstrap-only audit constants/actions only if truly unused.

Preserve canonical creation history/audit.
Do not fabricate 2.7 lifecycle facts.
Do not rewrite historical records to pretend legacy Orders were canonical.

# 27. API / DOC CLEANUP

Search current documentation for `/orders/bootstrap`, `bootstrap order`, and direct Order-create examples.

Current canonical API docs must no longer advertise it.

Historical implementation/review reports may retain clearly historical references; do not falsify history.

# 28. FRONTEND / CLIENT CLEANUP

Search frontend for bootstrap calls.

If present, move callers to already-existing canonical commercial flow; do not invent a replacement direct-create endpoint.

If absent, prove it.

# 29. TEST FIXTURE MIGRATION — IMPORTANT

Do not retain production bootstrap merely because tests use it.

For tests needing Orders:
1. use real canonical flow when testing production behavior;
2. for narrow downstream setup, use explicit test-only fixture/helper or controlled DB setup according to project conventions;
3. never register test helper in production;
4. never weaken production invariants for test convenience.

Document migrated bootstrap-dependent tests.

# 30. REPOSITORY-WIDE POST-CHECK

Search after changes for:
- `/orders/bootstrap`;
- `orders/bootstrap`;
- `bootstrapOrder`;
- `createBootstrapOrder`;
- bootstrap DTO names;
- direct production Order writes;
- raw INSERTs.

Classify every remaining match.

Allowed remnants: historical docs or explicit negative tests. No active production bootstrap path.

# 31. DATABASE / MIGRATION

Expected: no schema migration if this is application/API cleanup.

Do not create migration for ceremony.

If a constraint is genuinely required to enforce one creation authority, explain necessity and use additive Prisma migration only. No db push/destructive reset/unrelated cleanup.

# 32. LEGACY DATA COMPATIBILITY

Historical bootstrap-created Orders remain readable/manageable.

Remove ability to create new bootstrap Orders; do not delete/rewrite old Orders, acquisition, timestamps or money.

# 33. REQUIRED NEGATIVE TESTS

At minimum:
1. POST /orders/bootstrap unavailable;
2. BUYER no direct create;
3. PARTNER no direct create;
4. ADMIN no hidden bootstrap;
5. no alias direct-create route;
6. malformed direct create cannot bypass consumer;
7. update cannot mass-assign creation authority;
8. duplicate OrderRequested = one Order;
9. concurrent duplicate = one Order;
10. one OrderCreated;
11. no second availability reservation;
12. no Booking;
13. no Payment;
14. no premature Step 2.7 event;
15. no PII leak;
16. historical Order readable;
17. canonical flow creates Order;
18. acquisition survives;
19. temporal fields survive;
20. frozen money survives;
21. Reverse-origin canonical flow regression where current 2.2F contract permits.

# 34. REQUIRED POSITIVE E2E

Prove:

`Quote → CheckoutIntent → payment terms/service context → Sale → complete Sale → OrderRequested → consumer → exactly one Order → items/travelers → OrderCreated`

Assert:
- bootstrap unavailable;
- Sale correct;
- IDs valid;
- frozen totals/currency unchanged;
- no repricing;
- temporal contract correct;
- acquisition correct;
- existing reservation unchanged;
- correlation/causation correct;
- no Booking/Payment/BookingRequested;
- no lifecycle advancement beyond approved creation state.

# 35. REVERSE POSITIVE REGRESSION

Where existing tests permit:

`BuyerRequest → Proposal → 2.2F canonical Sales conversion → Sale → OrderRequested → Order`

If current 2.2F intentionally stops earlier, run the strongest existing reverse-to-sales regression and document exact boundary. Do not fabricate missing behavior.

# 36. PRICING/SERVICE TEMPLATE REGRESSION

Run relevant 1.8A–1.8D regression proving no damage to ServiceUnit, RatePlan, period pricing, restrictions, Quote freeze and public priceFrom.

# 37. FULL BACKEND REGRESSION

Run:
- TypeScript compile/build;
- all unit;
- targeted 2.6;
- Order consumer;
- 2.5A temporal;
- 2.5B acquisition;
- 2.4 Sale completion;
- Quote/Checkout/Sale;
- Reverse 2.2A–2.2F;
- 1.8A–1.8D relevant suites;
- Availability reservation;
- RBAC/security;
- full serial E2E.

Report exact real counts.

# 38. FRONTEND REGRESSION

Run frontend tsc, vitest and production build. Report exact results.

# 39. DB REGRESSION

Run repository-standard migrate status, fresh replay and supported drift verification. Report exact migration count and do not claim unexecuted commands.

# 40. ARCHITECTURE STOP CONDITIONS

Return `ARCHITECTURE DECISION REQUIRED` if:
1. bootstrap is required by an approved production flow;
2. canonical consumer cannot create all required normal Orders;
3. Reverse conversion requires a second Order writer;
4. MANUAL/DIRECT canonically requires direct Order creation and this is unresolved;
5. externally documented bootstrap retirement compatibility is unresolved;
6. one Sale legitimately creates multiple Orders but current uniqueness conflicts;
7. production Order creation remains split across writers;
8. canonical consumer depends architecturally on bootstrap HTTP boundary;
9. correctness requires implementing Step 2.7.

Do not hide architecture choices as local fixes.

# 41. ALLOWED FIXES

Allowed:
- remove route/DTO/bootstrap-only service method;
- tighten creation method visibility;
- migrate tests away from production bootstrap;
- remove frontend/client references;
- update API/docs;
- remove truly unused bootstrap-only permission/audit constants;
- fix local canonical-consumer regressions exposed by removal;
- add tests;
- minimal constraint hardening if demonstrably necessary.

# 42. FORBIDDEN SCOPE

Do NOT implement:
- Step 2.7;
- OrderReadyForBooking/BookingRequested;
- Step 2.8 Booking creation;
- Step 2.8A time-slot/timezone;
- Finance/Payment;
- new pricing/dynamic pricing;
- frontend commercial calendar;
- new Reverse features;
- replacement direct Order-create/admin-create endpoint;
- second Order consumer;
- new event framework.

# 43. ADVERSARIAL SELF-REVIEW

Before completion inspect:
- hidden second writer;
- route aliases;
- test-only code registered in production;
- bootstrap DTO used as canonical authority;
- consumer regression;
- Sale/Order uniqueness;
- duplicate/concurrent delivery;
- Inbox/Outbox atomicity;
- frozen money;
- 2.5A temporal semantics;
- 2.5B acquisition;
- Reverse acquisition;
- availability double reservation;
- Booking/Payment side effects;
- PII/RBAC;
- stale docs/frontend calls;
- historical Order compatibility.

Fix confirmed local defects.

# 44. ROADMAP UPDATE

Only after implementation/tests pass:

Set Step 2.6 to `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW` using current Roadmap status convention.

Update CURRENT CANONICAL EXECUTION SEQUENCE:
- active item = Step 2.6 STRICT REVIEW;
- Step 2.7 remains pending/blocked.

Do NOT mark 2.6 APPROVED/DONE.

# 45. REQUIRED FINAL REPORT

# PHASE 2 — STEP 2.6 — REMOVE BOOTSTRAP ORDER CREATION — ОТЧЁТ

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target mapping
5. Bootstrap endpoint removal
6. Bootstrap service-path removal
7. Repository-wide direct Order writer audit
8. Canonical Order creation authority
9. OrderRequested contract preservation
10. Step 2.5A temporal regression
11. Step 2.5B acquisition regression
12. Reverse Marketplace regression
13. Universal Pricing / Service Template regression
14. Money snapshot
15. Availability isolation
16. Booking isolation
17. Payment isolation
18. RBAC/security
19. Mass assignment
20. IDs
21. Idempotency
22. Concurrency
23. Inbox/Outbox atomicity
24. Correlation/causation
25. PII/traveler
26. Audit/history
27. API/docs cleanup
28. Frontend/client cleanup
29. Test fixture migration
30. Legacy Order compatibility
31. Migration
32. Targeted tests
33. Backend full regression
34. Frontend regression
35. DB regression
36. Runtime canonical journey
37. Issues found/fixed
38. Architecture decision status
39. Documentation changes
40. Roadmap update
41. Out-of-scope confirmation
42. Exact files changed
43. **Exact NEXT item**

Verdict when successful:

`PHASE 2 STEP 2.6 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Exact NEXT must be:

`PHASE 2 — STEP 2.6 — STRICT REVIEW`

unless the synchronized current Roadmap says otherwise.

# 46. STOP

After Step 2.6 implementation: **STOP**.

Do not perform Step 2.6 STRICT REVIEW in the same pass.
Do not start Step 2.7.
