# PHASE 2 — STEP 2.2A — SELLER COMMERCIAL CAPABILITIES & DESTINATION COVERAGE — STRICT REVIEW

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.2A  
**Mode:** STRICT REVIEW ONLY  
**Implementation changes:** FORBIDDEN unless required to fix a confirmed Step 2.2A defect found by this review  
**Next implementation step:** Step 2.2B MUST NOT START in this pass

---

# 1. MISSION

Perform an independent, adversarial STRICT REVIEW of the completed implementation:

**PHASE 2 — STEP 2.2A — Seller Commercial Capabilities & Destination Coverage**

The implementation report claims:

`PHASE 2 STEP 2.2A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Do not approve from the report alone.

Inspect repository truth, migration truth, runtime behavior, tests, ownership boundaries, security, Roadmap status and ADR/DD compliance.

The review must determine whether Step 2.2A is safe to mark:

`STRICT REVIEW COMPLETED — APPROVED`

or whether confirmed defects require:

`STRICT REVIEW COMPLETED — CHANGES REQUIRED`

or:

`ARCHITECTURE DECISION REQUIRED`.

---

# 2. CANONICAL EXECUTION GATE

This review is the only active item.

Canonical rule:

`2.2A implementation → 2.2A STRICT REVIEW → APPROVED → 2.2B`

Therefore:

- DO NOT implement Step 2.2B;
- DO NOT create BuyerRequest;
- DO NOT implement matching/distribution;
- DO NOT implement Seller Proposal;
- DO NOT implement Reverse Marketplace communication;
- DO NOT implement Proposal → Sales conversion;
- DO NOT start Service Templates 1.8A–1.8D;
- DO NOT execute the Universal Pricing Model Amendment;
- DO NOT change the execution sequence except to mark 2.2A approved and 2.2B NEXT if this review passes.

---

# 3. BASELINE TO VERIFY

Do not assume the report is correct.

Reported baseline:

- branch `master`;
- reported HEAD `36096d0`;
- Step 2.5B changes may still be present in the working tree;
- ADR-0012 is approved;
- Step 2.2A implementation is uncommitted;
- migration reported:
  `20260810194155_add_reverse_seller_capabilities`;
- reported migrations total: 31;
- frontend reportedly unchanged.

First inspect:

- `git status`;
- `git diff`;
- `git log`;
- migration status;
- Prisma schema;
- actual files changed.

Separate:
1. pre-existing dirty changes;
2. Step 2.2A changes;
3. review-fix changes made by this pass.

Do not accidentally rewrite unrelated work.

---

# 4. CANONICAL SOURCES TO INSPECT

At minimum inspect the latest repository versions of:

## Architecture / planning

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- `CURRENT CANONICAL EXECUTION SEQUENCE`;
- ADR-0012 — Reverse Marketplace bounded context;
- ADR-0001 — modular-monolith ownership / cross-context rules;
- ADR-0005 — PublicSellerProfile / Catalog ownership;
- ADR-0007 — acquisition boundary;
- ADR-0011 — Communication bounded-context precedent;
- `TRAVELHUB_DEFERRED_DECISIONS_MAP.md`;
- DD-028;
- Service Templates / Pricing amendments only insofar as they constrain 2.2A;
- `docs/contracts/ids.md`.

## Existing implementation

- `backend/prisma/schema.prisma`;
- Step 2.2A migration;
- `backend/src/modules/reverse/**`;
- `backend/src/app.module.ts`;
- permissions / RBAC;
- field validation / forbidden keys;
- IdsService;
- canonical location references / `locations.ts`;
- Catalog Category model;
- CRM Partner model;
- storefront own-scope precedent;
- global ValidationPipe / exception filter;
- AuditLog conventions.

## Tests

- `reverse-capabilities.e2e-spec.ts`;
- capability validation unit tests;
- acquisition-source-propagation test changed by 2.2A;
- relevant auth/RBAC/storefront/catalog tests.

---

# 5. REVIEW PRINCIPLE

Review code, schema and runtime behavior — not implementation intent.

For every important claim ask:

1. Is it actually implemented?
2. Is it enforced server-side?
3. Is there a DB-level invariant where appropriate?
4. Is it covered by a meaningful test?
5. Can it be bypassed through another endpoint/path?
6. Does it violate another bounded context?
7. Does it prematurely freeze a deferred decision?

Tests that merely repeat implementation assumptions are insufficient.

---

# 6. ADR-0012 OWNERSHIP — HARD GATE

Verify that Step 2.2A follows the approved Reverse Marketplace ownership.

Expected:

`reverse.*` owns Seller Commercial Capabilities.

Verify:

- PostgreSQL `reverse` schema exists;
- `ReverseModule` is correctly registered;
- capability persistence belongs to `reverse.*`;
- capability history belongs to `reverse.*`;
- Catalog does NOT own capability;
- CRM does NOT own capability;
- Sales does NOT own capability;
- Security does NOT own capability;
- no hidden cross-context writer exists.

Cross-domain reads by trusted ID/reference may be permitted by ADR-0001.

Any ownership contradiction with ADR-0012 is a HARD FAILURE or architecture-decision gate.

---

# 7. CAPABILITY SEMANTICS

Verify that a Seller Capability means:

**seller-declared commercial eligibility / ability to serve a category and destination coverage**

and NOT:

- Product;
- Tariff;
- inventory;
- Availability;
- reservation;
- Seller entitlement;
- publication approval;
- Lead;
- Opportunity;
- Quote;
- Sale;
- BuyerRequest;
- matching result.

Confirm model and APIs do not accidentally collapse these concepts.

---

# 8. CAPABILITY ≠ CATALOG PRODUCT

Critical invariant:

A Seller may declare:

`HOTEL → Turkey`

without having a published Hotel Product.

Verify capability create/update/activate/accept-request operations:

- do not create Product;
- do not create Tariff;
- do not create Availability;
- do not create AvailabilityReservation;
- do not mutate Catalog pricing;
- do not mutate Catalog inventory;
- do not require live Product existence unless canonical Roadmap explicitly requires it.

This must be proven by repository inspection and targeted tests.

---

# 9. CATEGORY AUTHORITY / DD-028

The implementation claims Category is a reference to existing `catalog.Category`.

Verify:

- no second Reverse Marketplace category taxonomy was created;
- `categoryId` resolves server-side to Catalog;
- Category must exist;
- Category must satisfy the correct lifecycle state;
- `categorySlug` is only a snapshot/convenience value, not authority;
- category cannot be forged or silently changed;
- category immutability after capability creation is deliberate and consistent with Roadmap;
- DD-028 has NOT been prematurely resolved.

If Category semantics are insufficient for future Reverse Marketplace use, record the limitation but do not invent a second taxonomy during review.

---

# 10. SELLER IDENTITY / AUTHORITY

Verify Seller identity is derived from authenticated actor / Partner context.

Client must not choose:

- `sellerId`;
- `partnerId`;
- owner;
- createdBy;
- status;
- version;
- lifecycle timestamps;
- server-owned category snapshot.

Attempted mass assignment must be rejected or safely ignored according to established API conventions.

Verify no endpoint permits creating/updating capability for another Seller by supplying an ID.

---

# 11. LEGAL LOCATION ≠ DESTINATION COVERAGE — HARD INVARIANT

This is one of the core reasons Step 2.2A exists.

Example:

A company legally registered in Azerbaijan may sell Hotels in Turkey.

Verify:

- CRM/legal country is NOT copied into capability destinations;
- Seller legal address is NOT authoritative for coverage;
- registration country does NOT limit coverage unless a future entitlement/legal rule explicitly does so;
- Seller AZ/Baku can declare `HOTEL → TR`;
- persisted coverage remains TR;
- AZ is not implicitly inserted;
- no hidden defaulting exists in create/update paths.

This invariant must be server-side and test-proven.

---

# 12. DESTINATION REPRESENTATION

Reported representation includes:

- `{countryCode}`;
- `{countryCode, cityCode}`;
- `{worldwide: true}`.

Review whether this is safe as a limited Step 2.2A representation without prematurely freezing the future destination hierarchy.

Verify:

- country code validation;
- uppercase/canonical normalization;
- city belongs to country;
- unknown city behavior;
- empty destinations behavior;
- duplicate destinations;
- deterministic sorting;
- `worldwide` exclusivity;
- unknown keys;
- malformed JSON;
- oversized lists;
- fake/reserved country values such as `WW`;
- no implicit legal-country fallback.

Do not demand Region implementation if DD-028 defers it.

But verify the current representation can evolve without claiming to be the final Country→Region→City taxonomy.

---

# 13. WORLDWIDE SEMANTICS

Verify `worldwide: true`:

- is explicit;
- cannot be combined ambiguously with country/city rows;
- cannot be forged through `countryCode: "WW"`;
- normalizes deterministically;
- does not mean entitlement;
- does not create Products or availability;
- can be disabled/changed through normal capability mutation with CAS.

---

# 14. ONE SELLER / MULTIPLE CAPABILITIES

Verify Seller can hold multiple capabilities for different Catalog categories.

Example:

Seller:
- HOTEL → Turkey;
- TOUR → Georgia;
- TRANSFER → Azerbaijan.

No global single-capability assumption may exist.

---

# 15. DUPLICATE SEMANTICS

Reported DB invariant:

`@@unique([sellerId, categoryId])`.

Verify this is correct for Step 2.2A.

Check:

- duplicate create for same Seller/category gives controlled conflict;
- same category for different Sellers is allowed;
- inactive capability semantics are clear;
- reactivation is used instead of creating duplicate historical capability;
- duplicate destination entries inside a capability are rejected/normalized consistently.

No raw Prisma P2002 should leak as uncontrolled 500.

---

# 16. ACCEPTS BUYER REQUESTS

Verify `acceptsBuyerRequests` is only a Seller preference/eligibility input at this stage.

Expected:

- safe default `false`;
- Seller can enable/disable own capability;
- CAS protected;
- same-value update is no-op according to documented semantics;
- disabling does not delete capability;
- enabling does NOT create BuyerRequest;
- enabling does NOT create Lead;
- enabling does NOT create Opportunity;
- enabling does NOT create Quote;
- enabling does NOT create Sale;
- enabling does NOT create matching/distribution state;
- enabling does NOT grant entitlement.

The flag must not self-promote Seller into future matching eligibility beyond what Step 2.2C will define.

---

# 17. CAPABILITY ≠ ENTITLEMENT

Hard review point.

The report states entitlement product rules remain deferred to Step 2.2C.

Verify no capability field or lifecycle transition silently acts as entitlement.

Check whether:
- approved Partner automatically receives an unstated entitlement;
- ACTIVE capability is treated as legal/contractual permission;
- `acceptsBuyerRequests=true` is treated as entitlement;
- Product publication is treated as entitlement.

If entitlement is genuinely absent, document this explicitly.

Do NOT implement entitlement in this review.

---

# 18. LIFECYCLE

Reported lifecycle:

`DRAFT → ACTIVE → INACTIVE`
with `INACTIVE → ACTIVE`.

Verify all transitions.

Expected:
- create → DRAFT unless canonical source says otherwise;
- DRAFT → ACTIVE;
- ACTIVE → INACTIVE;
- INACTIVE → ACTIVE;
- invalid transitions rejected;
- no-op same-state does not mutate version/history unless repository convention explicitly says otherwise;
- no hard delete required for normal lifecycle;
- activation/deactivation timestamps reflect actual transition;
- timestamps are UTC;
- `updatedAt` is not substituted for lifecycle milestones.

Check transition races.

---

# 19. CAS / CONCURRENCY

Every mutable operation that requires optimistic concurrency must use canonical CAS semantics.

Review:

- destination update;
- accepts-request update;
- activate;
- deactivate.

Verify:

- expectedVersion required where intended;
- stale version → controlled 409;
- update is atomic;
- version increments once;
- concurrent conflicting mutations yield one winner;
- loser does not write history/audit;
- no read-then-write race bypasses CAS.

Where possible, inspect SQL/Prisma update strategy rather than trusting tests.

---

# 20. RBAC

Reported permissions:

- `reverse.capability.read_own`;
- `reverse.capability.write_own`.

Verify permissions are integrated into the existing capability-driven security model.

Review:
- PARTNER permissions;
- BUYER denial;
- anonymous denial;
- pending/ineligible Partner denial;
- staff behavior;
- ADMIN convention;
- no accidental global read/write privilege;
- no hardcoded role gate that contradicts the project's small-organization model.

Important:
If the implementation deliberately requires PARTNER actor semantics in addition to permission, determine whether this is consistent with the existing own-scope architecture or an unjustified hardcoded role restriction.

Do not approve contradictory reasoning such as simultaneously claiming “no hardcoded roles” while service code hardcodes roles without an established actor-type invariant.

---

# 21. OWN-SCOPE / IDOR — HARD SECURITY GATE

Verify all capability surfaces:

- list;
- get;
- history;
- update destinations;
- accepts requests;
- activate;
- deactivate.

A Seller must never read or mutate another Seller's capability.

Expected external behavior should follow existing neutral-resource conventions (reported 404).

Test:
- own capability;
- foreign capability;
- guessed ID/code;
- foreign history;
- forged sellerId;
- forged partnerId;
- pagination/query manipulation.

Look for IDOR through both numeric/internal IDs and public codes.

---

# 22. PARTNER ELIGIBILITY

Review the `assertEligible` behavior.

Verify the canonical conditions for Seller to manage capabilities.

Reported:
- actor is Partner-context;
- `partnerId != null`;
- CRM Partner ACTIVE.

Check against current Partner onboarding/approval architecture.

Ensure:
- pending/unapproved Partner cannot manage capabilities if canonical rules forbid it;
- Partner identity is not derived from request payload;
- CRM is read-only from Reverse Marketplace.

Do not retroactively redefine Step 1.10 onboarding.

---

# 23. API SURFACE

Inspect all endpoints under:

`/api/v1/partner/reverse/capabilities`

Verify:

- only Step 2.2A operations exist;
- no public matching endpoint;
- no BuyerRequest endpoint;
- no Proposal endpoint;
- no hidden admin/global listing unless canonical;
- pagination bounded;
- deterministic ordering;
- validation pipe applies;
- HTTP status codes match project conventions;
- request IDs/errors use global exception behavior.

---

# 24. MASS ASSIGNMENT / SERVER-OWNED FIELDS

Review DTOs plus explicit forbidden-key guards.

Try fields including:

- id;
- code;
- sellerId;
- partnerId;
- ownerId;
- status;
- version;
- categorySlug;
- acceptsBuyerRequests at creation if server-owned there;
- createdAt;
- updatedAt;
- activatedAt;
- deactivatedAt;
- createdById;
- categoryId on update;
- nested unknown destination fields.

Determine whether rejection happens at DTO layer or domain layer.

400 vs 422 differences are acceptable only if consistent and documented; no privilege bypass may result.

---

# 25. HISTORY

Verify `SellerCapabilityHistory` is meaningful and transactionally correct.

Expected facts:
- created;
- destinations_updated;
- accepts_requests_updated;
- activated;
- deactivated.

Check:
- actor;
- timestamp;
- from/to or changed fields;
- no entry for failed mutation;
- no duplicate entry for no-op if documented as no-op;
- foreign Seller cannot read history;
- history does not contain unnecessary PII.

---

# 26. SECURITY AUDIT LOG

Verify capability mutations produce appropriate `security.AuditLog` records according to existing conventions.

Check:
- successful mutations only;
- correct actor;
- resource identity;
- action name;
- request/correlation metadata where convention requires it;
- no PII;
- failed 409/422 does not leave misleading success audit.

---

# 27. FAILURE ATOMICITY

Add/inspect tests proving failed operations do not partially mutate:

- capability row;
- version;
- history;
- AuditLog;
- Outbox;
- Catalog;
- Sales.

At minimum inspect:
- validation failure;
- stale CAS;
- duplicate create;
- invalid lifecycle;
- foreign-object attempt.

If transaction boundaries are insufficient, this is a review defect.

---

# 28. EVENTS / OUTBOX

Implementation intentionally emits no Reverse events in 2.2A.

Review whether this is valid.

Do NOT require speculative events merely because EventBus exists.

Verify:
- no consumer currently needs capability events;
- no hidden event contract is mandated by Roadmap/ADR;
- no accidental Outbox rows are produced;
- future 2.2C can read authoritative capability state without event reconstruction.

If an event is canonically required, flag it. Otherwise approve “no event yet”.

---

# 29. CATALOG ISOLATION

Explicitly prove Step 2.2A writes zero Catalog commercial state.

No writes to:
- Category;
- Product;
- Tariff;
- Availability;
- AvailabilityReservation;
- PublicSellerProfile.

Catalog reads for Category validation are acceptable if ADR-compliant.

---

# 30. SALES ISOLATION

Explicitly prove Step 2.2A creates/mutates zero:

- Lead;
- Opportunity;
- Quote;
- CheckoutIntent;
- Sale;
- OrderRequested;
- Order;
- Booking;
- Payment.

Capability declaration is not demand and not a Sales entity.

---

# 31. REVERSE SCOPE ISOLATION

At the end of 2.2A, verify `reverse.*` contains only the Step 2.2A-owned persistence needed for capabilities/history.

It must NOT yet contain:

- BuyerRequest;
- RequestDistribution;
- Match;
- SellerProposal;
- reverse-owned Communication;
- reverse-owned Quote;
- reverse-owned Order.

If implementation created speculative tables for future steps, review them as scope violations.

---

# 32. COMMUNICATION ISOLATION

ADR-0011 remains authoritative for Communication.

Step 2.2A must not create messaging/chat structures.

Future BuyerRequest/Proposal context will reference Communication rather than create a second messaging domain.

Verify no communication ownership leak was introduced.

---

# 33. ID CONTRACT

Verify:

- `CAP-*` is registered in `docs/contracts/ids.md`;
- generation uses canonical atomic IdsService behavior;
- collision behavior is safe;
- format matches project convention;
- no unapproved `BRQ-*` or Proposal prefix was registered prematurely;
- internal DB IDs vs public business codes are not confused.

---

# 34. MIGRATION REVIEW

Inspect migration SQL directly.

Verify:

- additive migration;
- creates `reverse` schema correctly;
- enum/table/index definitions match Prisma;
- only intended intra-schema FK exists;
- no forbidden cross-schema FK;
- no destructive backfill;
- no `db push`;
- migration replay works from clean DB;
- migrate status up to date;
- Prisma migration drift = 0.

If development DB checksum was manually altered in earlier work, ensure this migration itself is reproducible from clean state and no hidden local-only assumption exists.

---

# 35. INDEX / QUERY REVIEW

Review whether indexes support the actual and immediate future access patterns without speculative overengineering.

Reported:
- seller;
- seller+status;
- status+category;
- status+acceptsBuyerRequests;
- seller+category unique.

Verify likely 2.2C matching queries can at least start from category/status/accept flag without full-table pathological behavior.

Do not build ranking indexes prematurely.

---

# 36. DESTINATION JSONB REVIEW

Because destinations are reportedly JSONB, review this choice critically.

Check:
- validation is entirely server-authoritative;
- data shape cannot drift;
- queries required by Step 2.2C are feasible;
- current indexes do not falsely imply destination matching performance;
- JSONB does not prematurely freeze hierarchy;
- lack of normalized destination rows is consciously limited/deferred.

If future matching cannot safely/efficiently query this representation, determine whether this is:
- acceptable deferred implementation detail;
- Step 2.2A defect;
- architecture-decision requirement.

Do not approve blindly because unit validation passes.

---

# 37. PAGINATION / DETERMINISM

Verify own-list:

- bounded limit;
- offset validation;
- total;
- deterministic order;
- tie-breaker;
- no cross-Seller rows;
- stable behavior under same timestamps.

Reported order:
`createdAt desc, id desc`.

Inspect actual implementation.

---

# 38. TEST QUALITY

Do not merely count tests.

Review whether tests actually prove invariants.

Reported:
- 13 validation unit tests;
- 18 Step 2.2A E2E tests;
- full backend E2E 614/614;
- backend unit 327/327;
- frontend 135/135.

Inspect tests for:
- false positives;
- assertions after wrong request;
- global-zero/shared-DB assumptions;
- cleanup leaks;
- order dependence;
- overly broad catches;
- missing concurrency assertions;
- DB assertions against correct Seller;
- test-generated side effects.

Fix test hygiene if necessary.

---

# 39. SHARED-DB TEST HYGIENE

Given prior TravelHub regressions, explicitly review cleanup.

No suite should assume global Outbox/Audit/History zero unless isolated.

Prefer:
- own aggregate IDs;
- eventType filters;
- before/after delta;
- deterministic cleanup.

Verify PartnerCreated rows and Step 2.2A rows are cleaned without deleting other suites' data.

---

# 40. ACQUISITION SOURCE REGRESSION FIX

Step 2.2A reportedly changed the Step 2.5B assertion from:

“reverse schema does not exist”

to:

“reverse schema exists but runtime is limited to Step 2.2A”.

Review this carefully.

Confirm:
- change is now semantically correct;
- it does not weaken the original 2.5B invariant that Reverse Marketplace acquisition was not implemented at that time;
- BUYER_REQUEST acquisition propagation remains independent of BuyerRequest entity implementation;
- test does not accidentally allow future reverse entities prematurely.

---

# 41. FRONTEND SCOPE

Frontend is reported unchanged.

Verify Step 2.2A did not accidentally introduce incomplete UI.

Backend-only Step 2.2A is acceptable if Roadmap schedules Partner Cabinet UI later.

Do not implement UI during review.

---

# 42. ROADMAP STATUS

Before review completion, Roadmap should say effectively:

`2.2A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

and `2.2B` blocked/not started.

If review passes:

update only the canonical status needed to reflect:

`2.2A STRICT REVIEW COMPLETED — APPROVED`

and:

`NEXT = 2.2B`

according to the Roadmap's status semantics.

Do not mark 2.2B started.

---

# 43. DEFERRED DECISIONS

Verify the implementation did not silently resolve deferred matters including:

- full destination Country→Region→City hierarchy;
- entitlement rules;
- matching ranking;
- SLA;
- recommendations;
- BuyerRequest lifecycle;
- Proposal lifecycle;
- contact disclosure;
- Service Templates;
- Pricing Model;
- dynamic pricing;
- multi-currency.

If a new unresolved architecture question is discovered, determine whether it:
- can remain documented deferred;
- blocks 2.2B;
- requires ADR before approval.

Do not create DD noise for ordinary implementation details.

---

# 44. REQUIRED TARGETED TEST MATRIX

At minimum, confirm or add tests for these behaviors:

1. anonymous → 401;
2. BUYER cannot manage capability;
3. ineligible/pending Partner denied;
4. Seller AZ can create HOTEL coverage TR without AZ injection;
5. multiple categories per Seller;
6. own list/get;
7. foreign capability neutral denial;
8. forged seller/owner fields rejected;
9. acceptsBuyerRequests ON/OFF;
10. acceptsBuyerRequests no-op;
11. capability mutation creates no BuyerRequest/Sales/Catalog side effects;
12. activate;
13. deactivate;
14. reactivate;
15. invalid lifecycle;
16. stale CAS;
17. concurrent conflicting mutation → exactly one winner;
18. duplicate Seller/category → controlled conflict;
19. history;
20. audit;
21. worldwide;
22. `WW` fake-country rejected;
23. malformed/duplicate destination rejected;
24. failure atomicity;
25. pagination isolation/determinism;
26. no Product/Tariff/Availability/Reservation creation;
27. no Lead/Opportunity/Quote/Sale creation;
28. no BuyerRequest/Proposal/matching tables/entities;
29. no capability-generated outbox events;
30. clean migration replay.

Tests may cover multiple requirements each.

Do not inflate test count solely to match this list.

---

# 45. REVIEW-FIX POLICY

If STRICT REVIEW finds a clear Step 2.2A defect:

You MAY fix it in this pass if:
- scope is unambiguous;
- no new architecture decision is required;
- fix remains inside Step 2.2A;
- relevant targeted tests are added/updated;
- full regression is rerun.

Document every review fix separately.

If fixing requires choosing new domain ownership, final destination taxonomy, entitlement model, matching architecture, or another unresolved cross-domain authority:

STOP with:

`ARCHITECTURE DECISION REQUIRED`.

---

# 46. REGRESSION

After any review fixes run, at minimum:

Backend:
- TypeScript compile;
- unit tests;
- Step 2.2A targeted E2E;
- relevant auth/RBAC/storefront/catalog regression;
- full serial E2E.

Database:
- migration status;
- clean replay;
- drift check.

Frontend:
- TypeScript;
- Vitest;
- production build

even though frontend was not changed, to preserve repository regression convention.

Report exact counts from actual run.

Do not copy counts from the implementation report.

---

# 47. APPROVAL CRITERIA

Approve Step 2.2A only if all are true:

- ADR-0012 ownership correct;
- no cross-domain writes;
- capability ≠ Product/inventory;
- capability ≠ entitlement;
- legal country ≠ destination coverage;
- Category authority remains Catalog;
- DD-028 not prematurely frozen;
- own-scope/IDOR safe;
- RBAC safe;
- CAS/concurrency safe;
- lifecycle deterministic;
- history/audit correct;
- mass assignment blocked;
- failure atomicity proven;
- no premature BuyerRequest/matching/Proposal;
- no speculative events required;
- migration clean;
- tests meaningful and green;
- Roadmap status accurate.

---

# 48. REQUIRED FINAL REPORT

Return:

# PHASE 2 — STEP 2.2A — SELLER COMMERCIAL CAPABILITIES & DESTINATION COVERAGE — STRICT REVIEW — ОТЧЁТ

## 1. Verdict
One of:

`PHASE 2 STEP 2.2A STRICT REVIEW COMPLETED — APPROVED`

`PHASE 2 STEP 2.2A STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

`PHASE 2 STEP 2.2A STRICT REVIEW COMPLETED — CHANGES REQUIRED`

`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. ADR-0012 ownership
## 5. Schema / persistence review
## 6. Capability semantics
## 7. Category authority / DD-028
## 8. Legal location vs destination coverage
## 9. Destination model
## 10. Worldwide semantics
## 11. Capability vs Product / inventory
## 12. Capability vs entitlement
## 13. Accepts Buyer Requests
## 14. Lifecycle
## 15. RBAC
## 16. Own-scope / IDOR
## 17. Mass assignment / validation
## 18. CAS / concurrency
## 19. History / audit
## 20. Failure atomicity
## 21. Events / outbox
## 22. Catalog isolation
## 23. Sales isolation
## 24. Reverse Marketplace scope isolation
## 25. Communication isolation
## 26. IDs
## 27. Migration / drift / replay
## 28. Indexes / query paths
## 29. JSONB destination assessment
## 30. Test quality / shared-DB hygiene
## 31. Acquisition-source regression check
## 32. Frontend scope
## 33. Roadmap / execution-sequence status
## 34. Deferred decisions
## 35. Review fixes
## 36. Regression results
## 37. Architecture decision status
## 38. Exact files changed during review
## 39. Out-of-scope confirmation
## 40. Exact NEXT item

If approved, exact NEXT must be:

`PHASE 2 — STEP 2.2B — BUYER REQUEST FOUNDATION`

Do not implement it.

Final line repeats verdict.

---

# 49. STOP CONDITION

After this STRICT REVIEW:

STOP.

If approved:
- mark 2.2A approved according to canonical Roadmap convention;
- set 2.2B as NEXT;
- DO NOT implement 2.2B.

If changes required:
- do not advance sequence.

If architecture decision required:
- do not advance sequence.

No BuyerRequest, matching, Proposal, Communication extension, Sales conversion, Service Templates or Pricing work may start in this pass.
