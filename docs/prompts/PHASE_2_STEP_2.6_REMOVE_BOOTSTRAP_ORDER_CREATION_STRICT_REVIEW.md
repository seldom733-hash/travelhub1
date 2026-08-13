# PHASE 2 — STEP 2.6 — REMOVE BOOTSTRAP ORDER CREATION
## STRICT REVIEW PROMPT

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.6 — Remove Bootstrap Order Creation  
**Mode:** STRICT REVIEW  
**Implementation verdict under review:** `PHASE 2 STEP 2.6 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`  
**Baseline reported by implementation:** branch `master`, HEAD `53b2042` (v0.15.0), 42/42 migrations  
**Canonical next implementation step if and only if this review is approved:** Step 2.7  
**Hard stop:** DO NOT implement Step 2.7 in this pass.

---

# 1. REVIEW MISSION

Perform an independent, adversarial STRICT REVIEW of Step 2.6.

Do **not** merely confirm the implementation report.

The implementation claims that the temporary production Order creation path:

`POST /orders/bootstrap → bootstrapOrder() → Order`

has been removed and that the only normal production Order writer is now:

`Sale completion → OrderRequested → canonical Order consumer → Order → OrderCreated`.

Your job is to prove or disprove that claim from the repository, runtime behavior, schema, tests, permissions, docs and full regression.

The central invariant under review is:

> **NORMAL PRODUCTION ORDER CREATION = CANONICAL `OrderRequested` FLOW ONLY.**

A passing review must establish that bootstrap was not merely hidden, renamed, moved, converted to admin-only behavior, or preserved indirectly through another production writer.

---

# 2. SOURCE-OF-TRUTH / SEQUENCE GATE

Before reviewing code:

1. inspect the current `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
2. verify Step 2.6 is `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`;
3. verify Step 2.6 STRICT REVIEW is the active item;
4. verify Step 2.7 has not already been started;
5. inspect the canonical Step 2.6 requirements and relevant dependency notes;
6. inspect approved Step 2.4, 2.5, 2.5A, 2.5B contracts/reviews;
7. inspect Reverse Marketplace 2.2F conversion boundary;
8. inspect 1.8A–1.8D contracts where they affect frozen commercial facts.

If the current Roadmap conflicts with this prompt, the current Roadmap wins. Report the conflict explicitly.

---

# 3. REPOSITORY BASELINE — INDEPENDENTLY VERIFY

Report:

- branch;
- HEAD;
- origin/master relation;
- dirty/untracked files;
- whether implementation changes are committed or uncommitted;
- migration count/status;
- exact diff relevant to Step 2.6.

Do not trust the reported baseline `53b2042` without checking.

Separate:
- Step 2.6 implementation changes;
- unrelated pre-existing changes;
- review fixes made during this pass.

---

# 4. CLAIM-BY-CLAIM REVIEW MATRIX

Build a matrix:

| Claim | Evidence | Verdict |
|---|---|---|
| `/orders/bootstrap` removed | route search + runtime | PASS/FAIL |
| bootstrap service authority removed | service/write audit | PASS/FAIL |
| only canonical production writer remains | repository-wide write audit | PASS/FAIL |
| canonical consumer unchanged/correct | code + e2e | PASS/FAIL |
| 2.5A temporal contract preserved | code/tests | PASS/FAIL |
| 2.5B acquisition preserved | code/tests | PASS/FAIL |
| no second availability hold | code/db/e2e | PASS/FAIL |
| no Booking/Payment side effects | code/db/e2e | PASS/FAIL |
| legacy Orders remain usable | e2e | PASS/FAIL |
| test fixture is truly test-only | module/import/build audit | PASS/FAIL |
| Step 2.7 not started | repository search | PASS/FAIL |

Do not issue approval until every hard-gate claim has direct evidence.

---

# 5. BOOTSTRAP ROUTE REMOVAL — HARD GATE

Repository-wide search for all variants:

- `/orders/bootstrap`
- `orders/bootstrap`
- `bootstrap`
- `bootstrapOrder`
- `createBootstrapOrder`
- old bootstrap DTO names
- `BootstrapOrderDto`
- `BootstrapItemDto`
- old route aliases

Inspect controller registration and module routing, not just source text.

Runtime-test at minimum:

- anonymous POST `/api/v1/orders/bootstrap`;
- BUYER;
- PARTNER;
- ADMIN;
- malformed payload;
- plausible legacy payload.

All must be unable to create an Order.

Also test likely aliases:

- `/orders/create`
- `/orders/manual`
- `/orders/admin-create`
- `/orders/init`

A hidden 403/410/admin-only/feature-flagged bootstrap path is a review failure unless explicitly required by current canonical docs.

Historical documentation references are allowed only when clearly historical and non-operative.

---

# 6. PRODUCTION ORDER WRITER AUDIT — CRITICAL HARD GATE

Perform a repository-wide write audit.

Search for:

- `order.create(`
- `tx.order.create(`
- `order.createMany`
- `order.upsert`
- raw SQL INSERT into Order
- repository abstractions wrapping Order writes
- command handlers
- seed/dev endpoints
- staff/admin helpers
- test helpers accidentally imported by production
- migration/data scripts

Classify every Order creation write:

1. canonical production `OrderRequested` consumer;
2. legitimate test-only setup;
3. migration/data maintenance;
4. forbidden alternative production writer.

**Category 4 must be zero.**

Do not accept “only one obvious writer” without repository-wide evidence.

---

# 7. TEST-ONLY FIXTURE ISOLATION — HARD GATE

Implementation reports a new:

`backend/test/fixtures/create-order.fixture.ts`

Review it adversarially.

Verify:

- it is under test-only source;
- it is not imported from `src/`;
- it is not registered in any production module;
- it is not exposed by HTTP;
- production build does not bundle/use it;
- it does not create a backdoor executable from production runtime;
- it is used only for controlled test setup.

Also review whether the fixture fabricates business facts in ways that make tests falsely pass.

In particular, fixture-created Orders must not be used as proof that the canonical production consumer correctly propagates:
- frozen money;
- acquisition;
- temporal facts;
- correlation/causation;
- availability reservation references.

Those claims need canonical-flow tests.

---

# 8. CANONICAL `OrderRequested` CONSUMER — HARD GATE

Inspect the actual consumer and Order service path.

Verify the canonical flow remains:

`OrderRequested`
→ contract validation
→ Inbox/idempotency
→ Order-owned transaction
→ business/public IDs
→ Order
→ OrderItems
→ OrderTraveler snapshot
→ canonical history/audit
→ `OrderCreated` Outbox
→ atomic commit.

Review for regressions caused by bootstrap cleanup:

- deleted shared helper still needed by consumer;
- altered default values;
- lost validation;
- changed transaction boundaries;
- changed event metadata;
- changed ID allocation;
- changed traveler snapshot;
- changed acquisition;
- changed temporal facts.

Do not accept a green build as proof of semantic equivalence.

---

# 9. ORDERREQUESTED AUTHORITY / FROZEN SNAPSHOT

Verify Order is created from approved frozen upstream facts rather than mutable current state.

Inspect exact `OrderRequested` contract and producer.

Verify preservation of applicable canonical fields:

- Sale identity;
- Quote/Checkout references;
- buyer/customer;
- items;
- quantities;
- travelers;
- money;
- currency;
- payment terms;
- service date/context;
- acquisition source/channel;
- availability reservation refs;
- correlation/causation.

Flag any runtime re-read/repricing from mutable Product/Tariff/CommercialPeriod/Restriction state that violates the frozen commercial snapshot.

---

# 10. SALES → ORDER OWNERSHIP

Verify:

- Sales publishes `OrderRequested`;
- Sales does not directly write Order tables;
- Order consumer owns persistence;
- no controller/service introduced a new cross-domain write;
- no direct reverse.* → Order write exists.

A direct Sales/Reverse/Booking write into Order is a hard failure unless already canonically approved.

---

# 11. STEP 2.5A TEMPORAL CONTRACT — HARD GATE

Re-read the approved 2.5A contract/review and verify exact current semantics.

At minimum test/inspect:

- `createdAt` persistence meaning;
- `submittedAt` or equivalent canonical creation milestone;
- later milestones remain null until real transitions;
- `updatedAt` is not treated as business milestone;
- history/event `occurredAt`;
- server ownership of milestone timestamps;
- fixture paths do not mask production regressions.

Run the 2.5A targeted suite independently.

---

# 12. STEP 2.5B ACQUISITION PROPAGATION — HARD GATE

Implementation report says `acquisitionSource=DIRECT` in the canonical positive journey.

Do not assume that this alone proves 2.5B.

Review the approved acquisition model and test multiple canonical sources that currently exist.

Verify:
- source/channel is frozen upstream;
- Order does not infer it from endpoint, URL, Product or Seller;
- lifecycle changes do not rewrite it;
- Reverse Marketplace origin remains distinguishable where approved;
- Marketplace/Storefront/API/MANUAL-DIRECT semantics remain intact according to current enums/contracts.

If tests cover only `DIRECT`, add review coverage for at least one non-DIRECT canonical source when the current system supports it.

---

# 13. REVERSE MARKETPLACE → SALES → ORDER — HARD REVIEW

Implementation report states Reverse regression passes.

Inspect Step 2.2F's actual approved conversion boundary.

Prove there is no:
- Reverse direct Order writer;
- special bootstrap replacement;
- Proposal → Order shortcut;
- acquisition loss.

Where the existing architecture supports a complete canonical journey, test:

`BuyerRequest → Proposal → canonical Sales conversion → Sale → OrderRequested → Order`.

If the approved 2.2F boundary stops before Sale completion, document that exact boundary and run the strongest valid regression without fabricating missing behavior.

---

# 14. UNIVERSAL PRICING / SERVICE TEMPLATE REGRESSION

Review 1.8A–1.8D integration only to the extent Step 2.6 can affect it.

Verify canonical Order creation does not:
- reprice current Tariff;
- re-resolve CommercialPeriod;
- re-evaluate CommercialRestriction as a new binding price;
- overwrite frozen Quote/Sale commercial facts;
- depend on removed bootstrap DTO defaults.

Run relevant targeted suites.

---

# 15. MONEY AUTHORITY — HARD GATE

Inspect actual numeric path from frozen upstream commercial state into Order.

Verify:
- no client-provided Order total;
- no client-provided currency;
- no current-Tariff repricing;
- no fallback zero;
- no float conversion;
- Decimal/string precision preserved;
- Order totals equal frozen canonical upstream totals.

Test at least one non-trivial Decimal amount.

---

# 16. AVAILABILITY / CAPACITY — HARD GATE

Verify:

> `Sale completion = capacity reservation/hold`
>
> `Order creation != second capacity decrement`

Inspect both Sale completion and Order consumer.

Test:
- normal canonical Order creation does not create another hold;
- duplicate OrderRequested does not duplicate hold;
- concurrent duplicate does not duplicate hold;
- failure/retry does not leak a second reservation.

If current data model permits, compare reservation counts/IDs before and after Order consumption.

---

# 17. BOOKING / PAYMENT ISOLATION — HARD GATE

After canonical Order creation assert zero unintended creation of:

- Booking;
- BookingRequested;
- Payment;
- Refund;
- Settlement/Payout;
- Step 2.7 lifecycle artifacts.

Search code as well as DB state.

---

# 18. STEP 2.7 NON-IMPLEMENTATION — HARD GATE

Repository-wide search for newly introduced or modified:

- `OrderReadyForBooking`
- `BookingRequested`
- fulfillment/close transitions
- supplier processing
- new Order lifecycle endpoints
- Step 2.7 Roadmap status

If Step 2.7 work was started in the same implementation pass, do not approve 2.6 until scope contamination is understood and corrected.

---

# 19. RBAC / PERMISSION CLEANUP

Implementation claims `order.import` was removed.

Verify:

- permission constant removed where appropriate;
- role matrices do not retain it;
- seed/reconciliation behavior safely removes stale permission links;
- no migration/reset is required unexpectedly;
- permission cleanup cannot revoke unrelated permissions;
- ADMIN does not retain an equivalent direct Order-create capability under another permission.

Review production authorization behavior, not just constants.

---

# 20. SECURITY RECONCILIATION REVIEW

Implementation mentions ADMIN reconciliation removing stale permission links at seed.

Inspect this carefully.

Questions:
- Is reconciliation deterministic?
- Is it idempotent?
- Does it operate only on known stale permission(s)?
- Can it accidentally delete custom/valid links?
- Does it run in production and, if so, is that already an approved security pattern?
- Is changing security seed behavior actually required for Step 2.6?

If this introduces a new global permission-reconciliation architecture, return `ARCHITECTURE DECISION REQUIRED`.

---

# 21. MASS-ASSIGNMENT / ALTERNATIVE CREATION

Inspect all Order mutation endpoints.

Attempt to forge creation-authority fields through PATCH/action routes:

- id/code/order number;
- saleId/quoteId/checkoutId;
- buyer/customer/partner ownership;
- money/currency;
- payment terms;
- acquisition;
- traveler snapshots;
- reservation IDs;
- submittedAt/other milestones;
- status/history/version;
- correlation/causation.

No update/action route may function as indirect Order creation.

---

# 22. ID CONTRACT / CONCURRENCY

Verify approved:
- `ORD-*`;
- `TH-YYYY-######`;
- BusinessSequence/IdsService behavior.

Review the implementation report's note that fixture uses server-owned codes.

Test canonical consumer—not fixture—for:
- uniqueness;
- concurrent allocation;
- duplicate event delivery;
- no counter reset;
- no client-forged code.

---

# 23. IDEMPOTENCY / EXACTLY-ONCE BUSINESS EFFECT

Test both sequential and concurrent duplicate `OrderRequested`.

Assert:
- one Order;
- one OrderCreated;
- one set of OrderItems;
- one traveler snapshot set;
- one history creation milestone;
- no duplicate capacity reservation;
- Inbox dedup state correct;
- no raw unique-constraint 500.

Do not equate transport delivery with exactly-once execution; verify business effect.

---

# 24. TRANSACTION / FAILURE ATOMICITY

Review transaction boundaries.

Inject or simulate failure where practical at meaningful points:
- after Inbox claim/before Order;
- after Order/before children;
- before OrderCreated outbox;
- duplicate concurrent insert.

Expected invariant: no partial canonical Order graph and no consumed-event state that permanently loses Order creation.

Use existing failure-injection patterns if available; do not introduce production test hooks.

---

# 25. CORRELATION / CAUSATION

Inspect actual event envelope.

Verify:
- `OrderCreated.correlationId` follows canonical inherited correlation;
- `OrderCreated.causationId` references the triggering `OrderRequested.eventId`;
- requestId is not substituted for causation;
- retries do not generate contradictory lineage;
- test fixture-generated events are not used as sole evidence.

---

# 26. PII / TRAVELER SNAPSHOT

Review canonical consumer's traveler snapshot and emitted/audit metadata.

Verify no new leakage from removal/refactor:
- passport/document details;
- unnecessary contact PII;
- raw DTO dumps;
- error logging;
- AuditLog metadata;
- EventBus payload beyond approved contract.

Run existing PII/redaction tests and inspect changed test fixtures.

---

# 27. LEGACY ORDER COMPATIBILITY

Implementation claims historical bootstrap-created Orders remain readable/manageable.

Review the new test critically.

Ensure it does not merely create a current-schema synthetic row that fails to represent legacy conditions.

At minimum verify:
- existing Order without canonical creation provenance remains readable;
- allowed current lifecycle actions still work;
- no migration/backfill is implicitly required;
- historical acquisition/timestamps are not rewritten;
- deletion of bootstrap code does not break deserialization/projection.

If real legacy fixture data exists, prefer it.

---

# 28. API / DOCS CLEANUP

Review `docs/contracts/api.md` and current public/internal API docs.

Verify:
- bootstrap is not advertised;
- direct Order create is not documented elsewhere;
- canonical creation path is described correctly;
- historical docs remain historical, not authoritative current contracts;
- Roadmap status is accurate.

Do not require destructive editing of historical reports.

---

# 29. FRONTEND / CLIENT AUDIT

Repository-wide search outside `node_modules`.

Verify zero live calls to:
- `/orders/bootstrap`;
- replacement aliases;
- direct Order-create clients.

Run frontend typecheck/tests/build.

---

# 30. TEST MIGRATION QUALITY

Implementation migrated many old bootstrap-dependent tests to a fixture.

Review whether this reduced production-flow coverage.

For each migrated suite, classify why fixture use is valid.

Particularly inspect:
- acquisition-source-propagation;
- auth-rbac;
- business-event-envelope;
- buyer-cabinet;
- communication;
- order-canonical-events;
- order-temporal-contract;
- phase1;
- phase2-entry-audit;
- pii-redaction;
- rbac-actions;
- request-context.

Where a test's purpose is specifically canonical Order creation semantics, it must use the canonical flow, not a direct DB fixture.

Fix tests that became tautological or stopped exercising production behavior.

---

# 31. COMMENT / DEAD-CODE REVIEW

Implementation reports an explanatory bootstrap comment remains in controller and a comment change in consumer.

Review:
- comments are accurate;
- no dead imports/types/constants remain;
- no obsolete bootstrap terminology misleads future implementation;
- no test-only naming leaks into production.

A historical explanatory comment is acceptable if useful, but active code should not imply a callable bootstrap feature.

---

# 32. MIGRATION / SCHEMA REVIEW

Implementation says no migration.

Verify schema truly did not need change.

Confirm:
- no bootstrap-only DB constraint/table remains that should be removed for correctness;
- removing it would not be destructive/unnecessary;
- `Order.saleId @unique` or equivalent still enforces intended cardinality;
- current schema supports legacy Orders.

Do not demand a migration solely for cleanup.

Run migrate status/fresh replay/drift procedure supported by repo.

---

# 33. REQUIRED TARGETED TESTS

At minimum run or add review tests proving:

1. anonymous bootstrap POST unavailable;
2. BUYER bootstrap unavailable;
3. PARTNER bootstrap unavailable;
4. ADMIN bootstrap unavailable;
5. legacy payload unavailable;
6. aliases unavailable;
7. no alternative production writer;
8. canonical flow creates exactly one Order;
9. duplicate event = one Order;
10. concurrent duplicate = one Order;
11. exactly one OrderCreated;
12. no duplicate items/travelers/history;
13. frozen money exact;
14. temporal fields exact;
15. non-DIRECT acquisition preserved where supported;
16. availability reservation unchanged;
17. no Booking;
18. no Payment;
19. correlation/causation exact;
20. PII boundary;
21. legacy Order compatibility;
22. test fixture not production-importable/registered;
23. stale `order.import` permission cleanup correct;
24. Step 2.7 artifacts absent.

Report exact test counts.

---

# 34. REQUIRED CANONICAL E2E JOURNEY

Independently rerun the real journey:

`Quote`
→ `CheckoutIntent`
→ required terms/service context
→ `Sale`
→ complete Sale
→ `OrderRequested`
→ consumer
→ exactly one `Order`
→ OrderItems/OrderTraveler
→ exactly one `OrderCreated`.

Assert from DB/events, not only HTTP response:
- valid IDs;
- frozen money;
- service context;
- acquisition;
- temporal fields;
- reservation identity/count;
- correlation/causation;
- no Booking;
- no Payment;
- no Step 2.7 transition.

---

# 35. FULL REGRESSION

Run independently:

## Backend
- TypeScript compile/build;
- full unit suite;
- targeted Step 2.6 suite;
- Order consumer;
- 2.5A;
- 2.5B;
- 2.4 Sale completion;
- Quote/Checkout/Sale;
- Reverse 2.2A–2.2F relevant suites;
- 1.8A–1.8D relevant suites;
- Availability;
- RBAC/security;
- PII;
- full serial E2E.

## Frontend
- TypeScript;
- vitest;
- production build.

## Database
- migrate status;
- fresh migration replay;
- supported drift check.

Report actual counts. Do not copy implementation counts unless reproduced.

---

# 36. REVIEW-FIX POLICY

If review finds a local Step 2.6 defect, fix it in this same STRICT REVIEW pass when safe and architecture-neutral.

Examples:
- missed bootstrap alias;
- stale permission;
- unsafe test fixture import;
- missing negative test;
- regression in consumer;
- stale API docs;
- missing acquisition regression;
- local idempotency bug.

After every review fix:
1. add/update regression test;
2. rerun targeted tests;
3. rerun full required regression;
4. list the fix explicitly in final report.

Do not begin Step 2.7.

---

# 37. ARCHITECTURE STOP CONDITIONS

Return:

`ARCHITECTURE DECISION REQUIRED`

if review proves any of the following:

1. a legitimate production flow still requires direct Order creation;
2. MANUAL/DIRECT orders cannot pass through canonical Sales flow and policy is undefined;
3. Reverse Marketplace requires a second Order writer;
4. one Sale legitimately needs multiple Orders but current uniqueness forbids it;
5. test fixture migration exposes a missing production factory/command boundary requiring redesign;
6. permission reconciliation introduces a new cross-cutting security architecture;
7. removing bootstrap breaks a supported external API and deprecation policy is undefined;
8. canonical consumer cannot preserve required frozen facts;
9. Step 2.6 correctness requires implementing Step 2.7.

Do not silently decide these inside code.

---

# 38. APPROVAL CRITERIA

Approve only if all are true:

- production bootstrap route is gone;
- no equivalent route exists;
- bootstrap service authority is gone;
- only canonical production Order writer remains;
- test fixture is test-only;
- canonical consumer remains correct;
- frozen commercial facts preserved;
- temporal contract preserved;
- acquisition contract preserved;
- Reverse path remains canonical;
- no second availability hold;
- no Booking/Payment/2.7 side effects;
- IDs/idempotency/concurrency/atomicity correct;
- RBAC/mass-assignment secure;
- PII boundary preserved;
- legacy Orders remain usable;
- docs/frontend cleaned;
- full regressions green;
- Roadmap updated honestly.

---

# 39. ROADMAP UPDATE ON APPROVAL

Only if review passes, update Step 2.6 to the current canonical approved status, preferably:

`PHASE 2 STEP 2.6 STRICT REVIEW COMPLETED — APPROVED`

or:

`PHASE 2 STEP 2.6 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

according to actual findings and Roadmap conventions.

Then update `CURRENT CANONICAL EXECUTION SEQUENCE` so that:

- Step 2.6 is approved/done;
- **Step 2.7 becomes NEXT**;
- do not mark Step 2.7 started.

If review fails, Step 2.7 remains blocked.

---

# 40. REQUIRED FINAL REPORT

Return:

# PHASE 2 — STEP 2.6 — REMOVE BOOTSTRAP ORDER CREATION — STRICT REVIEW REPORT

## 1. Verdict

Exactly one:

`PHASE 2 STEP 2.6 STRICT REVIEW COMPLETED — APPROVED`

`PHASE 2 STEP 2.6 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

`PHASE 2 STEP 2.6 STRICT REVIEW COMPLETED — CHANGES REQUIRED`

`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline

## 3. Sources inspected

## 4. Implementation claims independently verified

## 5. Bootstrap route removal

## 6. Bootstrap service-path removal

## 7. Production Order writer audit

List every writer and classification.

## 8. Test fixture isolation

## 9. Canonical OrderRequested consumer

## 10. Frozen contract / money authority

## 11. Step 2.5A temporal contract

## 12. Step 2.5B acquisition contract

## 13. Reverse Marketplace regression

## 14. 1.8A–1.8D regression

## 15. Availability isolation

## 16. Booking/Payment isolation

## 17. Step 2.7 non-implementation

## 18. RBAC / `order.import` cleanup

## 19. Security reconciliation review

## 20. Mass-assignment / alternative creation

## 21. IDs

## 22. Idempotency / concurrency

## 23. Inbox/Outbox atomicity

## 24. Correlation / causation

## 25. PII / traveler snapshot

## 26. Legacy Order compatibility

## 27. API/docs/frontend cleanup

## 28. Test migration quality

## 29. Migration/schema

## 30. Targeted tests

Exact counts/results.

## 31. Full backend regression

Exact counts/results.

## 32. Frontend regression

Exact counts/results.

## 33. DB regression

## 34. Issues found

## 35. Review fixes applied

For every fix: defect → change → regression proof.

## 36. Architecture decision status

## 37. Roadmap update

## 38. Out-of-scope confirmation

Confirm Step 2.7 was not implemented.

## 39. Exact files changed during review

Separate implementation files from review-fix files.

## 40. Exact NEXT item

If approved:

`PHASE 2 — STEP 2.7`

If not approved:

`STEP 2.6 REMEDIATION / RE-REVIEW`

Final line must repeat the verdict exactly.

---

# 41. STOP

After STRICT REVIEW:

**STOP.**

Even if approved, do **not** implement Step 2.7 in this pass.

Step 2.7 requires a separate implementation prompt.
