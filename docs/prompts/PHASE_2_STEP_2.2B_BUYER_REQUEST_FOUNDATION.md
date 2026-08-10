# PHASE 2 — STEP 2.2B — BUYER REQUEST FOUNDATION

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.2B  
**Mode:** IMPLEMENTATION  
**Canonical owner:** Reverse Marketplace (`reverse.*`)  
**Prerequisite:** Step 2.2A Strict Review `APPROVED WITH REVIEW FIXES`  
**Next after completion:** STOP and wait for separate STRICT REVIEW

---

# 1. MISSION

Implement the canonical **Buyer Request Foundation** for Reverse Marketplace.

Buyer Request is the demand-led entry point where a Buyer describes what they want to buy without selecting an already-published Marketplace offer.

Canonical business example:

> Buyer wants a hotel in Turkey for specific dates/guest composition.  
> Buyer creates a request.  
> The request is owned by `reverse.*`.  
> It is NOT yet distributed/matched in Step 2.2B.  
> It does NOT automatically create Lead/Opportunity/Quote/Sale/Order/Booking.

This step creates only the BuyerRequest foundation and Buyer-owned CRUD/lifecycle required by the Roadmap.

---

# 2. CANONICAL SOURCES — READ FIRST

Before changing code inspect latest repository truth:

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- `CURRENT CANONICAL EXECUTION SEQUENCE`;
- ADR-0012;
- Step 2.2A implementation + Strict Review fixes;
- `TRAVELHUB_DEFERRED_DECISIONS_MAP.md`;
- DD-030;
- ADR-0001;
- ADR-0007;
- ADR-0011;
- current `reverse.*` schema/module;
- existing Buyer identity/account model;
- Communication model;
- Sales model;
- Category/CategorySchema;
- current location/date utilities;
- permissions/RBAC conventions;
- IDs registry;
- audit/history patterns;
- event/outbox conventions.

If current Roadmap differs from this prompt, Roadmap wins.

---

# 3. HARD OWNERSHIP

ADR-0012 is authoritative.

`BuyerRequest → reverse.*`

BuyerRequest must NOT be owned by:
- Sales;
- CRM;
- Catalog;
- Communication;
- Order;
- Booking.

No cross-context writes.

Reverse may READ trusted refs from:
- Buyer identity/account;
- Catalog Category;
- existing destination primitives;
- other approved contexts.

---

# 4. BUYERREQUEST ≠ SALES ENTITY

Hard invariant:

Creating BuyerRequest MUST NOT automatically create:
- Lead;
- Opportunity;
- Quote;
- CheckoutIntent;
- Sale;
- OrderRequested;
- Order;
- Booking;
- Payment.

Step 2.2C handles matching/distribution later.
Step 2.2F handles Proposal → Sales conversion later.

---

# 5. BUYERREQUEST ≠ COMMUNICATION

Do not create a second chat/message system.

BuyerRequest may later become a Communication context through existing `communication.*`, but Step 2.2B must not implement reverse-owned chat.

---

# 6. BUYERREQUEST ID

Review current ID registry.

If `BRQ-*` is still only a working prefix and Step 2.2B is the canonical implementation point, register the final BuyerRequest business prefix consistently with repository conventions.

If another prefix is already canonical, use it.

Do not invent Seller Proposal prefix in this step.

Use canonical atomic IdsService sequence if business codes are required.

---

# 7. MINIMAL DOMAIN MODEL

Implement a first-class BuyerRequest aggregate in `reverse.*`.

It should support at minimum:

- internal ID;
- canonical business code;
- buyer/customer reference;
- category/service intent;
- destination/service-area intent;
- requested service date/date range or date flexibility as supported by current date model;
- traveler/PAX requirements where applicable;
- optional buyer budget/preferences only if canonical Roadmap supports them;
- acquisition source or source marker consistent with `BUYER_REQUEST`;
- lifecycle/status;
- version/CAS;
- created/updated timestamps;
- lifecycle milestone timestamps where justified;
- createdBy / actor;
- history/audit.

Do not over-model future category-specific commercial fields.

Use extensibility carefully.

---

# 8. CATEGORY / SERVICE INTENT

BuyerRequest category must reference the existing canonical Catalog Category authority.

Do not create a second request-category taxonomy.

Category must be validated server-side.

Do not require Product existence.

A request can exist even if zero Products are currently published.

---

# 9. DESTINATION INTENT

BuyerRequest destination means where the Buyer wants the service.

Do not derive it from Buyer home/legal location.

Support the minimal destination representation consistent with current Roadmap/Step 2.2A primitives.

Do not prematurely freeze unresolved Region hierarchy.

If destination model cannot safely represent the Step 2.2B requirements without resolving DD-028:
`ARCHITECTURE DECISION REQUIRED`.

---

# 10. DATES / FLEXIBILITY

Use current canonical date semantics.

Do not invent timezone-aware time-slot behavior before Step 2.8A.

For this step, date-only/date-range semantics are acceptable where supported.

BuyerRequest may support:
- exact date;
- date range;
- flexible date indicator/window

only if Roadmap supports it.

Do not overfit Hotel stays to every category.

---

# 11. PAX / TRAVELER REQUIREMENTS

BuyerRequest may express demand requirements such as:
- number of adults;
- number of children;
- number of infants;
- total travelers;
- other minimal PAX structure.

Do NOT collect unnecessary sensitive traveler PII at request stage.

Avoid:
- passport;
- passport number;
- document expiry;
- raw personal documents;
- unnecessary birth dates unless explicitly required.

Request-stage demand should be PII-minimal.

---

# 12. BUDGET / PREFERENCES

If Roadmap allows buyer budget/preferences:

Store only demand hints/preferences, not binding price.

Examples:
- budget range;
- hotel category preference;
- meal preference;
- room preference;
- transport preference.

These are NOT binding commercial facts.

Do not turn them into Quote/Sale price.

---

# 13. LIFECYCLE

Implement only the minimum lifecycle needed by Step 2.2B.

Do NOT freeze more states than required.

At minimum distinguish:
- editable/draft request;
- submitted/open request;
- buyer-cancelled/closed request where canonical.

Do not implement:
- MATCHED;
- DISTRIBUTED;
- PROPOSAL_RECEIVED;
- SELECTED;
- CONVERTED

unless Roadmap explicitly assigns those states to BuyerRequest at 2.2B.

Matching/distribution facts belong to Step 2.2C.

Proposal facts belong to 2.2D.

Conversion belongs to 2.2F.

---

# 14. SUBMISSION SEMANTICS

If BuyerRequest supports draft → submitted:

Submission must be a server-authoritative lifecycle transition.

Do not use `updatedAt` as submitted milestone.

Use explicit milestone timestamp if canonical temporal style requires it.

Submitted request becomes eligible for future 2.2C matching, but Step 2.2B itself must not perform matching.

---

# 15. BUYER OWN-SCOPE

Buyer must only access own requests.

All Buyer-facing operations require server-derived Buyer identity.

Buyer must not:
- read another Buyer's request;
- mutate another Buyer's request;
- forge buyerId/customerId/ownerId in payload;
- guess BRQ code/UUID to gain access.

Use neutral 404/anti-enumeration behavior if repository convention supports it.

---

# 16. ADMIN / STAFF ACCESS

Do not automatically add global staff CRUD unless Roadmap explicitly requires it.

If existing internal/admin conventions require read support, keep it capability-driven and separate from Buyer own-scope.

Do not confuse admin visibility with tenant ownership.

---

# 17. RBAC / PERMISSIONS

Introduce minimum permissions using existing naming conventions.

Conceptually:
- `reverse.request.read_own`
- `reverse.request.write_own`

But inspect current permission naming before finalizing.

BUYER should receive own-scope request permissions.

PARTNER must not gain BuyerRequest mutation rights.

Step 2.2C later gives Seller access only after server-authoritative distribution/matching.

---

# 18. API SURFACE

Create minimal Buyer-owned API consistent with repository conventions.

Likely shape conceptually:

- create;
- list own;
- get own;
- update editable request;
- submit;
- cancel;
- history if current patterns expose it.

Do not create:
- seller request inbox;
- matching endpoints;
- distribution commands;
- proposal endpoints;
- proposal selection;
- communication/chat endpoints;
- Sales conversion endpoints.

---

# 19. MASS ASSIGNMENT

Block server-owned fields.

At minimum:
- id;
- code;
- buyerId/customerId/ownerId;
- status;
- version except expectedVersion control field;
- matching/distribution state;
- proposal state;
- seller IDs;
- acquisition source if server-owned;
- createdBy;
- lifecycle timestamps;
- createdAt/updatedAt;
- correlation/causation;
- entitlement fields.

Use existing forbidden-key conventions.

---

# 20. ACQUISITION SOURCE

BuyerRequest is the canonical origin for future reverse-marketplace commerce.

Preserve canonical value:
`BUYER_REQUEST`

Do not let client choose another source.

Do not yet create Sale/Order.

Document that future 2.2F conversion must preserve this source through canonical Sales → Order pipeline.

---

# 21. PII / CONTACT DISCLOSURE

Hard privacy invariant:

`BuyerRequest exists ≠ Seller can see Buyer contact information`

Step 2.2B has NO seller distribution yet.

BuyerRequest API must not accidentally expose:
- email;
- phone;
- WhatsApp;
- passport;
- raw CRM profile;
- unnecessary PII.

Future Step 2.2C distribution must receive only permitted request facts.
Future contact disclosure policy remains separate.

---

# 22. HISTORY / AUDIT

Create history/audit for meaningful request changes:

- created;
- updated;
- submitted;
- cancelled/closed.

Record:
- actor;
- timestamp;
- from/to lifecycle if applicable;
- changed fields where appropriate.

Do not put contact PII in history/audit.

No history for failed operations.

---

# 23. CAS / CONCURRENCY

Use canonical optimistic concurrency for mutable BuyerRequest aggregate.

Required:
- stale expectedVersion → 409;
- concurrent conflicting update → one winner;
- submit vs update race deterministic;
- cancel vs update/submit race deterministic;
- no duplicate lifecycle milestones.

Use transaction + CAS patterns consistent with Step 2.2A and Sales.

---

# 24. DUPLICATE / IDEMPOTENCY SEMANTICS

Define duplicate create behavior carefully.

Do not deduplicate separate legitimate Buyer requests merely because fields are equal.

If request creation endpoint does not yet use idempotency key, document that Step 2.2B does not guarantee HTTP create idempotency unless Roadmap requires it.

Do not invent a hidden duplicate heuristic.

Lifecycle transition commands should be idempotent/no-op or conflict according to existing conventions.

---

# 25. FAILURE ATOMICITY

Failed mutation must not leave partial:
- request row;
- history;
- audit;
- outbox;
- Sales entity;
- Catalog entity;
- Communication entity.

Prove with tests:
- invalid payload;
- stale CAS;
- invalid lifecycle;
- foreign-object attempt.

---

# 26. EVENTS

Do not invent broad event catalog.

Emit a BuyerRequest event only if Step 2.2C or an existing consumer genuinely requires it and Roadmap mandates it now.

If no current consumer:
prefer no event to speculative event.

If event is needed for future distribution trigger, inspect Roadmap carefully:
- owner reverse.*;
- outbox/inbox;
- no PII;
- versioned;
- correlation/causation;
- idempotent consumer boundary later.

Do not create matching/distribution side effects in Step 2.2B.

---

# 27. NO MATCHING / DISTRIBUTION

Absolutely no:
- seller eligibility query as side effect of create/submit;
- matched Seller records;
- distribution records;
- request inbox;
- ranking;
- SLA;
- recommendation engine;
- seller notifications;
- Lead creation per match.

Step 2.2C owns this.

---

# 28. NO SELLER ACCESS YET

PARTNER/Seller must NOT list/read BuyerRequests merely because:
- category matches capability;
- destination matches coverage;
- acceptsBuyerRequests=true.

That access starts only after Step 2.2C server-authoritative distribution/matching.

Add negative E2E proof.

---

# 29. NO SELLER PROPOSAL

No SellerProposal model/API in Step 2.2B.

No proposal price/amount fields.

No proposal lifecycle.

No proposal business prefix.

2.2D owns proposals.

---

# 30. NO SALES CONVERSION

No Lead/Opportunity/Quote/Checkout/Sale creation.

DD-030 remains deferred before 2.2F.

Step 2.2B must not resolve DD-030.

---

# 31. NO SERVICE TEMPLATES / PRICING

Do not implement:
- 1.8A–1.8D;
- Universal Pricing Model Amendment;
- period pricing;
- tariff refactor;
- room/service units;
- availability.

BuyerRequest should be able to exist independently of live Product inventory.

---

# 32. MIGRATION

Migration must be:
- additive;
- reproducible;
- no destructive reset;
- no fake backfill;
- no db push;
- no cross-schema FK if ADR-0001 prohibits it.

Use reverse schema.

If history table references request, intra-schema FK may be appropriate.

Verify:
- migrate status;
- clean replay;
- drift 0.

---

# 33. INDEXES / QUERY PATHS

Support immediate access paths:
- Buyer own list;
- status;
- category;
- submitted/open state;
- future Step 2.2C matching candidate query without implementing matching.

Avoid speculative ranking indexes.

If destinations are JSONB, document future query implications.

---

# 34. REQUIRED TESTS

At minimum cover:

1. anonymous denied;
2. PARTNER denied from Buyer own API;
3. BUYER create;
4. category ref validation;
5. destination validation;
6. request can exist with zero Products;
7. list own;
8. get own;
9. cross-Buyer IDOR neutral denial;
10. forged buyer/customer/owner fields rejected;
11. draft update;
12. submit;
13. submitted request protected from forbidden edit if lifecycle requires;
14. cancel/close;
15. stale CAS → 409;
16. concurrent update → one winner;
17. submit vs update race;
18. cancel vs submit race;
19. history;
20. audit;
21. no Seller access;
22. no matching/distribution rows;
23. no Proposal;
24. no Lead/Opportunity/Quote/Sale;
25. no Order/Booking/Payment;
26. no Product/Tariff/Availability side effects;
27. no contact PII leakage;
28. BUYER_REQUEST source server-owned;
29. failure atomicity;
30. pagination/deterministic own list.

Do not inflate tests artificially; one test may prove multiple invariants.

---

# 35. RUNTIME VERIFICATION

Use isolated test/runtime environment.

Demonstrate:

Buyer
→ create BuyerRequest
→ update
→ submit
→ list/get own

and prove:
- another Buyer cannot read it;
- Seller cannot read it yet;
- no matching;
- no Sales entity;
- no Product dependency;
- no contact disclosure.

---

# 36. FULL REGRESSION

Run:

Backend:
- tsc;
- unit;
- Step 2.2B targeted E2E;
- Step 2.2A regression;
- acquisition/Order regression as relevant;
- auth/RBAC;
- full serial E2E.

Frontend:
- tsc;
- vitest;
- next build.

Database:
- migrate status;
- clean replay;
- drift.

Report exact counts.

---

# 37. ROADMAP UPDATE

Only after implementation and green regression:

Mark Step 2.2B as:

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Canonical active item becomes:
`Step 2.2B STRICT REVIEW`

Step 2.2C remains blocked/not started.

Do not mark 2.2B approved in the implementation pass.

---

# 38. ARCHITECTURE STOP CONDITIONS

STOP with:

`ARCHITECTURE DECISION REQUIRED`

if implementation requires:
- moving BuyerRequest into Sales/CRM/Catalog;
- resolving DD-030 now;
- implementing matching to make request valid;
- Seller access before distribution;
- creating second Communication system;
- resolving full destination taxonomy;
- implementing Service Templates/Pricing;
- cross-context write;
- binding Proposal/Quote logic;
- new privacy/contact disclosure policy not derivable from ADR.

---

# 39. REQUIRED FINAL REPORT

Return:

# PHASE 2 — STEP 2.2B — BUYER REQUEST FOUNDATION — ОТЧЁТ

## 1. Verdict
`PHASE 2 STEP 2.2B IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
or
`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. Current → Target mapping
## 5. reverse.* ownership
## 6. BuyerRequest schema/model
## 7. ID strategy
## 8. Category intent
## 9. Destination intent
## 10. Date/flexibility semantics
## 11. PAX / traveler requirements
## 12. Budget/preferences
## 13. Lifecycle
## 14. Buyer own-scope
## 15. RBAC / permissions
## 16. API surface
## 17. Mass assignment / validation
## 18. Acquisition source
## 19. Privacy / PII
## 20. History / audit
## 21. CAS / concurrency
## 22. Duplicate/idempotency semantics
## 23. Failure atomicity
## 24. Events / outbox
## 25. No matching/distribution
## 26. No Seller access
## 27. No Proposal
## 28. No Sales conversion
## 29. Catalog / Product isolation
## 30. Migration
## 31. Indexes / query paths
## 32. Targeted tests
## 33. Full regression
## 34. Runtime verification
## 35. Issues found/fixed
## 36. Documentation changes
## 37. Deferred decisions
## 38. Architecture decision status
## 39. Out-of-scope confirmation
## 40. Exact files changed

Final line repeats verdict.

---

# 40. STOP CONDITION

After implementation and validation:

STOP.

Do NOT perform Step 2.2B Strict Review in the same pass.
Do NOT start Step 2.2C.
Do NOT implement matching/distribution.
Do NOT implement Seller Proposal.
Do NOT implement Reverse Marketplace chat.
Do NOT implement Sales conversion.
Do NOT execute Universal Pricing Model Amendment.
Do NOT implement 1.8A–1.8D.

Wait for a separate Step 2.2B STRICT REVIEW prompt.
