# PHASE 2 — STEP 2.2A — SELLER COMMERCIAL CAPABILITIES & DESTINATION COVERAGE

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.2A  
**Mode:** IMPLEMENTATION  
**Canonical owner:** Reverse Marketplace (`reverse.*`)  
**Prerequisite:** ADR-0012 `Accepted` / Strict Review `APPROVED WITH REVIEW FIXES`  
**After completion:** STOP and wait for separate STRICT REVIEW.

---

# 1. MISSION

Implement the first runtime foundation of the Reverse Marketplace bounded context:

**Seller Commercial Capabilities & Destination Coverage.**

The platform must be able to answer, server-authoritatively:

> “What categories/services is this Seller commercially capable of offering, in what destinations, and does the Seller currently accept Buyer Requests?”

This is NOT inventory, NOT Product publication, NOT pricing, NOT availability, NOT BuyerRequest matching yet.

Primary real-world invariant:

> A Seller registered/located in Baku/Azerbaijan may sell hotels or tours in Turkey. Seller legal/registration/office country MUST NOT determine commercial destination coverage.

---

# 2. CANONICAL SOURCES — READ BEFORE CHANGES

Inspect actual repository state, not reports alone:

- `docs/adr/ADR-0012-reverse-marketplace-bounded-context.md`
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- `docs/prompts/TRAVELHUB_DEFERRED_DECISIONS_MAP.md`
- ADR-0001
- ADR-0005
- ADR-0007
- ADR-0011
- `docs/contracts/ids.md`
- current Prisma schema
- Security/RBAC/CRM/Partner/Catalog conventions
- audit/history/event/outbox conventions
- existing Category / CategorySchema model
- existing Partner/Seller identity/profile model
- existing permission reconciliation/seeding approach

Verify baseline and dirty tree before editing. Do not overwrite unrelated uncommitted Step 2.5B / ADR work.

---

# 3. HARD OWNERSHIP BOUNDARY

ADR-0012 is authoritative:

`Seller Commercial Capabilities → reverse.*`

Do NOT put capability ownership into:

- `catalog.*`;
- PublicSellerProfile;
- Product;
- CRM;
- Sales;
- Security.

Existing domains remain authoritative for their own facts.

`reverse.*` may hold trusted references/IDs to Seller/Partner/category/destination concepts according to ADR-0001, but MUST NOT perform cross-context writes.

---

# 4. LIMITED-SCOPE RULE

Step 2.2A executes BEFORE Service Templates 1.8A–1.8D.

Therefore implement only lightweight commercial eligibility declarations needed for future request distribution.

Do NOT require or implement:

- Room types;
- Seller service-unit templates;
- Rate Plans;
- Tariff redesign;
- period pricing;
- period availability;
- inventory;
- live availability;
- normalized Hotel/Room attributes;
- CSV import;
- channel manager;
- supplier API;
- dynamic pricing.

Capability ≠ inventory.

---

# 5. DOMAIN MODEL

Design the minimal additive `reverse.*` persistence model needed for Seller capabilities.

The model must support at least:

1. Seller reference.
2. Service/category capability.
3. Destination coverage.
4. Whether Buyer Requests are accepted.
5. Capability lifecycle/status.
6. audit/history.
7. optimistic concurrency/versioning where mutable aggregate conventions require it.
8. timestamps using repository conventions.

Prefer a model that supports multiple capabilities per Seller.

Do not assume one Seller has only one category or one destination.

---

# 6. SERVICE / CATEGORY CAPABILITY

Capability represents a Seller declaration that it can commercially serve a category/service class.

Examples are illustrative only:

- HOTEL
- TOUR
- EXCURSION
- TRANSFER
- CAR_RENTAL

Do NOT hardcode a closed TravelHub-wide taxonomy unless the existing canonical Category model already provides the authoritative identifier.

Prefer referencing the existing category/taxonomy authority rather than creating a competing taxonomy.

If the existing Category model cannot safely serve as the reference without transferring ownership or freezing unresolved DD-028 taxonomy:

`ARCHITECTURE DECISION REQUIRED`

and STOP.

---

# 7. DESTINATION COVERAGE

Coverage means where the Seller can commercially offer the declared service.

Requirements:

- legal/registration country MUST NOT be used as implicit coverage;
- coverage must be explicitly declared;
- one capability may cover multiple destinations;
- future hierarchy expansion must remain possible;
- server-side matching later must be able to evaluate coverage deterministically.

Do NOT prematurely freeze unresolved destination taxonomy into a rigid Country→Region→City schema merely because examples use those levels.

Use the smallest safe model consistent with existing location/destination primitives.

If no canonical location primitive exists, implement a deliberately extensible representation and document the limitation rather than inventing a full geography platform.

---

# 8. WORLDWIDE / BROAD COVERAGE

If broad/worldwide coverage is required by the current Roadmap wording, do not encode it as a fake country.

Represent broad scope explicitly.

It must remain distinguishable from a concrete destination.

Do not fabricate child destination rows.

---

# 9. ACCEPTS BUYER REQUESTS

Seller must have an explicit server-persisted ability to opt in/out of receiving Buyer Requests.

Required semantics:

- default must be safe;
- Seller can enable/disable only within own scope and permission;
- disabled Seller will later be ineligible for distribution;
- changing this flag does NOT delete capability/history;
- enabling it does NOT itself grant entitlement;
- enabling it does NOT create BuyerRequest, Lead, Opportunity, Quote or Product.

Document chosen default and rationale.

---

# 10. CAPABILITY != ENTITLEMENT

ADR-0012 is authoritative:

Capability declaration does NOT automatically mean the Seller is commercially entitled to participate.

Do not invent the final entitlement product model in 2.2A.

2.2A must preserve a future entitlement gate for Step 2.2C.

Do NOT:
- equate Seller approval with entitlement;
- equate Product publication with entitlement;
- grant entitlement from a client payload;
- hardcode organization size/role as entitlement.

---

# 11. CAPABILITY LIFECYCLE

Implement the minimum lifecycle necessary for safe operations.

Do not over-design future moderation/ranking.

Lifecycle must at minimum distinguish usable active capability from non-active state and support truthful disable/deactivation semantics.

If exact lifecycle names are not canonical, choose minimal repository-consistent names and document them.

Avoid destructive deletion for business facts where auditability requires preservation.

---

# 12. OWN-SCOPE / MULTI-TENANCY

Seller-side mutation/read must enforce object scope server-side.

A Seller may:
- read own capabilities;
- create/update/deactivate own allowed capability declarations if permission permits.

A Seller must NOT:
- read another Seller's private capability configuration through ID guessing;
- mutate another Seller's capability;
- forge `sellerId` in payload;
- promote itself into another Seller scope.

Prefer server-derived Seller identity/scope.

ADMIN/support privileges must not accidentally become tenant ownership.

Follow existing project conventions for administrative reads if present.

---

# 13. SMALL-ORGANIZATION COMPATIBILITY

Do not assume one employee = one operational role.

Use permissions/capabilities/object scope.

Avoid service logic such as:

`if role === SALES_MANAGER`

unless an existing canonical permission mechanism requires it.

One employee may legitimately perform multiple functions.

---

# 14. RBAC / PERMISSIONS

Introduce the minimum Reverse Marketplace capability permissions using existing naming/reconciliation conventions.

Choose names consistent with repository patterns, for example conceptually:

- reverse.capability.read
- reverse.capability.write

But inspect existing permission naming before finalizing.

Define least-privilege matrix.

Do not automatically give raw capability access to unrelated KPI/analytics roles.

Buyer must not mutate Seller capabilities.

Document exact role/permission mapping.

---

# 15. API SURFACE

Create a minimal operational API for capability management consistent with existing Nest conventions.

It should support, as appropriate:

- list own Seller capabilities;
- get one own capability;
- create;
- update commercial category/destination declaration where lifecycle permits;
- enable/disable accepting Buyer Requests;
- deactivate/archive capability;
- history/read audit trail if repository patterns expose domain history.

Do not create BuyerRequest inbox/matching endpoints.

Do not create public marketplace endpoints.

Do not create frontend.

---

# 16. MASS-ASSIGNMENT PROTECTION

Client must not control server-owned fields.

Protect at minimum:

- id/code;
- sellerId / tenant owner;
- status transitions not allowed by operation;
- version;
- timestamps;
- audit actor;
- entitlement state;
- matching/distribution state;
- system flags.

Forged server-owned keys must be rejected according to existing validation conventions.

---

# 17. CONCURRENCY

Use repository CAS/version conventions for mutable capability aggregates.

Concurrent conflicting updates must not silently overwrite each other.

Expected behavior should align with existing project semantics, typically stale `expectedVersion → 409`.

Prove with E2E.

---

# 18. HISTORY / AUDIT

Capability changes are security/commercial eligibility facts and must be auditable.

Record meaningful mutations, including:

- creation;
- category/service change if allowed;
- coverage change;
- accepts-requests change;
- lifecycle change.

Capture actor, timestamp, before/after or equivalent canonical milestone representation.

Do not place Buyer PII into these records.

---

# 19. EVENTS

Do not invent a large Reverse Marketplace event catalog.

Only emit events if an existing architectural convention genuinely requires them for this step.

If events are introduced:
- owner = reverse.*;
- existing outbox mechanism;
- no reverse-specific bus;
- no BuyerRequest/matching event names prematurely;
- correlation/causation conventions preserved;
- payload contains no unnecessary PII.

Document why each event is needed.

No event is preferable to speculative events.

---

# 20. CATALOG ISOLATION

E2E must prove capability operations do NOT:

- create Product;
- publish Product;
- create Tariff;
- create Availability;
- create AvailabilityReservation;
- modify Catalog pricing/inventory.

A Seller may be capable of selling HOTEL in Turkey while having zero live hotel Products.

This is a required architectural proof.

---

# 21. LEGAL COUNTRY ISOLATION TEST

Required E2E scenario:

1. Seller legal/registration location = Azerbaijan/Baku (using actual available Seller/Partner identity fields).
2. Seller declares capability for hotel/tour service in Turkey.
3. Persistence succeeds if otherwise authorized.
4. Read model returns Turkey coverage.
5. No logic rewrites coverage to Azerbaijan.
6. No implicit Azerbaijan coverage is created solely from legal location.

This test represents the user's core business requirement.

---

# 22. MULTI-CAPABILITY TEST

Required scenario:

Same Seller can hold multiple commercial capabilities, e.g.:

- HOTEL → Turkey
- TOUR → Turkey
- TRANSFER → another supported destination

without overwriting the other declarations.

Do not hardcode these exact category names if canonical test fixtures use different category IDs.

---

# 23. CROSS-SELLER ISOLATION TEST

Create Seller A and Seller B.

Prove:

- A can read/update A;
- B can read/update B;
- A cannot read B private capability by ID/code;
- A cannot mutate B;
- forged `sellerId=B` does not transfer ownership.

Use the repository's canonical 403/404 anti-enumeration behavior.

---

# 24. ACCEPTS-REQUESTS TESTS

Prove:

- explicit default;
- authorized enable;
- authorized disable;
- CAS conflict;
- history/audit fact;
- no BuyerRequest/Lead/Opportunity/Quote/Sale created;
- no entitlement automatically granted.

---

# 25. NO MATCHING YET

Step 2.2A must NOT implement matching/distribution.

Do not create:

- matched Seller records;
- delivery records;
- request inbox;
- ranking;
- SLA;
- Seller recommendation engine;
- Lead-per-match behavior.

These belong to later steps.

---

# 26. NO BUYERREQUEST YET

Do not create BuyerRequest schema/API in 2.2A.

BRQ-* remains reserved/working for Step 2.2B and must not be prematurely registered solely for 2.2A.

Do not invent Proposal IDs.

---

# 27. PRIVACY

Capabilities should contain Seller commercial configuration, not Buyer PII.

Ensure:
- no customer contact data;
- no passport data;
- no request-specific Buyer data;
- no accidental Seller-secret leakage across tenants.

API response should expose only required capability fields.

---

# 28. MIGRATION

Migration must be:

- additive;
- reproducible from clean DB;
- Prisma migrate-based;
- no destructive reset;
- no fabricated backfill;
- no `db push` as canonical migration mechanism.

Verify:
- migrate deploy;
- migrate status;
- fresh replay;
- drift.

If new schema `reverse` is introduced, migration must create it consistently with repository schema conventions.

---

# 29. ID STRATEGY

Inspect `docs/contracts/ids.md`.

If Capability needs a business code, register a prefix through the existing ID registry/IdsService conventions.

Do not invent `BRQ-*` for capability.

Do not invent a Proposal prefix.

If no business code is necessary at this layer and repository conventions permit UUID-only internal aggregates, justify that decision.

---

# 30. VALIDATION

Validate at least:

- category/service reference exists and is usable;
- destination representation is structurally valid;
- duplicates according to chosen aggregate semantics;
- invalid lifecycle transitions;
- forbidden server-owned fields;
- expectedVersion;
- seller own-scope;
- malformed identifiers.

Return repository-standard error envelopes/requestId.

---

# 31. DUPLICATE SEMANTICS

Define deterministic duplicate behavior.

Examples to resolve:
- same Seller + same service/category + same destination;
- overlapping broad and specific coverage;
- repeated create retry.

Do not silently create ambiguous duplicate eligibility facts.

Use DB constraints where appropriate and document the chosen rule.

Do not build a full geographic overlap engine if destination hierarchy is deferred.

---

# 32. QUERY / READ MODEL

Provide deterministic ordering/pagination if list endpoints follow existing operational patterns.

At minimum allow the future 2.2C matching layer to query active capabilities by:
- Seller;
- service/category;
- accepts-requests state;
- destination coverage representation.

Do not implement matching itself.

Add indexes justified by those access paths.

---

# 33. TEST REQUIREMENTS

Add focused unit tests for pure validation/normalization/lifecycle helpers if created.

Add E2E coverage for at least:

1. anonymous denied;
2. Buyer denied from Seller capability mutation;
3. authorized Seller create;
4. Baku/Azerbaijan Seller → Turkey coverage;
5. multi-capability Seller;
6. list/get own scope;
7. cross-Seller IDOR denied;
8. forged sellerId/server-owned fields denied;
9. accepts requests ON/OFF;
10. lifecycle deactivate;
11. CAS stale update → 409;
12. concurrent update → one winner where applicable;
13. duplicate semantics;
14. history/audit;
15. no Product/Tariff/Availability/Reservation side effects;
16. no Lead/Opportunity/Quote/Sale side effects;
17. no BuyerRequest/matching/distribution entities;
18. capability ≠ entitlement proof;
19. migration/fresh DB behavior;
20. failure atomicity.

Use delta-based/shared-DB-safe assertions; do not introduce global-count flakes.

---

# 34. FAILURE ATOMICITY

For failed mutations (validation/CAS/ownership):

prove no partial:
- capability mutation;
- history;
- audit;
- outbox;
- Catalog/Sales side effect.

Transactions must follow repository conventions.

---

# 35. DOCUMENTATION

Create/update architecture documentation for Step 2.2A covering:

- purpose;
- ownership;
- schema/model;
- legal-country ≠ coverage;
- capability ≠ inventory;
- capability ≠ entitlement;
- limited-scope before Service Templates;
- API;
- permissions/object scope;
- lifecycle;
- concurrency;
- audit;
- duplicate semantics;
- destination representation;
- indexes/query paths;
- deferred decisions;
- compatibility with 2.2B/2.2C.

Update `ids.md` only if a new business prefix is actually introduced.

Update contracts only if implementation truly creates a contract.

---

# 36. ROADMAP UPDATE

Only after implementation succeeds and regression passes:

Mark Step 2.2A as:

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Do NOT mark it APPROVED/DONE yet.

Canonical active/NEXT state must become:

`Step 2.2A STRICT REVIEW`

Step 2.2B remains blocked until 2.2A Strict Review approval.

Preserve the canonical pairing rule.

---

# 37. FULL REGRESSION

Run repository-appropriate full validation, including:

Backend:
- TypeScript compile;
- unit tests;
- full serial E2E;
- migration status/replay.

Frontend:
- TypeScript;
- unit/vitest;
- production build.

Frontend is expected to remain unchanged, but regression still must prove no breakage.

Report exact counts.

---

# 38. STOP / ARCHITECTURE DECISION CONDITIONS

STOP with `ARCHITECTURE DECISION REQUIRED` if implementation would require any of:

- moving capabilities into Catalog/Sales/CRM instead of reverse.*;
- introducing a second taxonomy authority;
- resolving DD-028 in a way not safely inferable;
- making Product/inventory mandatory for capability;
- implementing entitlement product rules now;
- introducing Service Templates early;
- cross-domain writes;
- matching/distribution implementation to make capability work;
- changing ADR-0012 ownership;
- inventing a parallel commerce pipeline.

Do not silently decide these.

---

# 39. REQUIRED FINAL REPORT

Return:

# PHASE 2 — STEP 2.2A — SELLER COMMERCIAL CAPABILITIES & DESTINATION COVERAGE — ОТЧЁТ

## 1. Verdict
`PHASE 2 STEP 2.2A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
or
`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. Current → Target mapping
## 5. reverse.* ownership
## 6. Schema / persistence model
## 7. Service/category capability
## 8. Destination coverage
## 9. Legal location vs coverage
## 10. Accepts Buyer Requests
## 11. Capability vs entitlement
## 12. Lifecycle
## 13. RBAC / permissions
## 14. Own-scope / IDOR
## 15. API surface
## 16. Validation / mass-assignment
## 17. Concurrency / CAS
## 18. History / audit
## 19. Events / reliability
## 20. Catalog isolation
## 21. Sales isolation
## 22. Reverse Marketplace isolation
## 23. Duplicate semantics
## 24. Query paths / indexes
## 25. Migration
## 26. IDs
## 27. Targeted tests
## 28. Full regression
## 29. Runtime verification
## 30. Issues found/fixed
## 31. Documentation changes
## 32. Deferred decisions
## 33. Architecture decision status
## 34. Out-of-scope confirmation
## 35. Exact files changed

Final line repeats verdict.

---

# 40. FINAL STOP

After implementation and verification:

STOP.

Do NOT perform Step 2.2A Strict Review in the same pass.
Do NOT start Step 2.2B.
Do NOT implement BuyerRequest.
Do NOT implement matching/distribution.
Do NOT implement Seller Proposal.
Do NOT implement frontend.

Wait for a separate Strict Review prompt.
