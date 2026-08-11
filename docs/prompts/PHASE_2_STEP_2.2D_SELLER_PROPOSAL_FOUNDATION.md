# PHASE 2 — STEP 2.2D — SELLER PROPOSAL FOUNDATION

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.2D  
**Mode:** IMPLEMENTATION  
**Canonical owner:** Reverse Marketplace (`reverse.*`)  
**Prerequisite:** Step 2.2C Strict Review `APPROVED WITH REVIEW FIXES`  
**Next after completion:** STOP and wait for separate STRICT REVIEW

---

## 1. MISSION

Implement the canonical **Seller Proposal Foundation** for Reverse Marketplace.

A Seller who has actually received a BuyerRequest through canonical Step 2.2C distribution may create and manage a Seller Proposal for that BuyerRequest.

Hard invariants:

- `SellerProposal → reverse.*`
- Proposal is NOT canonical Sales Quote.
- Proposal price/amount is NON-BINDING unless the Roadmap explicitly says otherwise.
- Proposal does NOT create Lead/Opportunity/Quote/Sale/Order/Booking automatically.
- Seller may only read/write its own Proposal.
- Buyer may only read Proposals related to its own BuyerRequest.
- Other Sellers must never see another Seller's Proposal.
- Proposal creation requires an actual canonical distribution to that Seller.
- Cancelled BuyerRequest must not accept a new Proposal.
- `BUYER_REQUEST` acquisition source must remain preservable for Step 2.2F conversion.

## 2. CANONICAL SOURCES — READ FIRST

Inspect latest repository truth before changing code:

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- `CURRENT CANONICAL EXECUTION SEQUENCE`;
- ADR-0012;
- Step 2.2A implementation + Strict Review;
- Step 2.2B implementation + Strict Review;
- Step 2.2C implementation + Strict Review;
- `TRAVELHUB_DEFERRED_DECISIONS_MAP.md`;
- DD-030;
- ADR-0001;
- ADR-0007;
- ADR-0011;
- current `reverse.*` schema;
- BuyerRequest;
- BuyerRequestDistribution;
- SellerCapability;
- Catalog Category;
- CRM Partner/Seller;
- Sales Opportunity/Quote/Checkout/Sale contracts;
- permissions/RBAC;
- AuditLog/history conventions;
- EventBus/outbox/inbox;
- ID registry;
- privacy/PII patterns.

If this prompt conflicts with current Roadmap or approved ADRs, Roadmap/ADR wins.

## 3. OWNERSHIP

ADR-0012 is authoritative.

`SellerProposal → reverse.*`

Proposal must NOT be owned by Sales, Catalog, CRM, Communication, Order or Booking.

Reverse may READ trusted refs from BuyerRequest/Distribution/Seller identity according to ADR-0001.

No cross-context writes.

## 4. PROPOSAL ≠ SALES QUOTE — HARD GATE

SellerProposal is a Reverse Marketplace commercial response.

It is NOT `sales.Quote`, `sales.Opportunity`, `sales.Sale`, Checkout or Order.

Do not reuse Sales Quote table as Proposal persistence.
Do not create a second binding Quote engine.
Binding commercial authority remains canonical Sales Quote/Checkout/Sale.

## 5. NON-BINDING COMMERCIAL INDICATION

Proposal may contain commercial indication such as indicative amount, currency, description, included services, exclusions, validity hint, seller notes or service option summary.

But Proposal is NON-BINDING.

Do not make Proposal amount authoritative for Checkout/Sale.
Do not freeze Sales money contract into Proposal prematurely.

If current Roadmap defines exact Proposal money semantics, follow it.
If binding authority is ambiguous: `ARCHITECTURE DECISION REQUIRED`.

## 6. CREATION ELIGIBILITY

Seller may create Proposal only if all applicable conditions hold:

1. BuyerRequest exists.
2. BuyerRequest was canonically distributed to this Seller.
3. Distribution belongs to authenticated Seller.
4. BuyerRequest is in a state that allows proposals.
5. Seller remains eligible to act according to current security rules.
6. Proposal lifecycle permits create.
7. Contact disclosure is NOT required merely to create Proposal.

Seller must NOT create Proposal by supplying arbitrary BuyerRequest ID without distribution.

## 7. SELLER SELF-SCOPE

Seller identity must be server-derived.

Client must not choose sellerId, partnerId, distribution seller, ownerId or createdBy.

All Seller Proposal mutations must enforce own-scope.
Seller A must not read/update/delete/submit Seller B Proposal.
Use neutral 404 where canonical anti-enumeration convention applies.

## 8. BUYER OWN-SCOPE

Buyer may only read Proposals for BuyerRequests owned by that Buyer.

Buyer must not read Proposal for another Buyer's request.
Do not expose Seller-internal fields unnecessarily.

If Buyer Proposal listing/detail is not required in 2.2D Roadmap, implement only the minimum required backend foundation.

## 9. CROSS-SELLER ISOLATION — HARD GATE

If one BuyerRequest is distributed to Seller A and Seller B:

- A sees only A Proposal;
- B sees only B Proposal;
- A cannot infer B Proposal content;
- A cannot modify B Proposal;
- A cannot access B future conversation;
- Seller-facing list/counts must not reveal competitor data unless Roadmap explicitly allows it.

## 10. PROPOSAL CARDINALITY

Inspect Roadmap.

Expected invariant:

`BuyerRequest → 0..N Seller Proposals`

At least one Seller may submit one Proposal per BuyerRequest.

If multiple revisions/versions are needed, prefer one Proposal aggregate with version/history instead of duplicate active Proposal rows unless Roadmap says otherwise.

Define DB uniqueness appropriately, likely `unique(buyerRequestId, sellerId)` or equivalent.

## 11. PROPOSAL LIFECYCLE

Implement only minimum lifecycle required by 2.2D.

Likely concepts may include DRAFT, SUBMITTED, WITHDRAWN/CANCELLED only if canonical Roadmap supports them.

Do NOT prematurely add ACCEPTED, SELECTED, CONVERTED, QUOTED, WON or LOST unless explicitly part of 2.2D.

Buyer selection/conversion belongs to later flow if Roadmap assigns it there.

## 12. BUYERREQUEST STATE GATE

Proposal creation/submission must be blocked if request is not proposal-eligible.

At minimum:
- DRAFT request → no Proposal;
- CANCELLED request → no new Proposal;
- SUBMITTED/distributed request → may Proposal.

If BuyerRequest is cancelled after Proposal exists, keep Proposal history and define future write/submit behavior honestly.

## 13. DISTRIBUTION GATE

A Proposal must reference a canonical distribution or prove distribution existence server-side.

Do not let client forge distributionId, sellerId or matched state.

If Proposal stores distributionId, validate it belongs to the same BuyerRequest and authenticated Seller.

## 14. PROPOSAL MONEY

If amount is implemented:

- explicit currency;
- Decimal, not JS float, for authoritative persistence;
- non-negative;
- max bounds;
- server-validated;
- no silent currency conversion;
- no mixing with Quote binding totals;
- no Checkout usage.

If amount is optional/PRICE_ON_REQUEST-like, represent absence honestly. Do not fabricate zero.

## 15. BUDGET RELATION

BuyerRequest budget is a non-binding hint.
Proposal may be above or below Buyer budget unless Roadmap says otherwise.
Do not automatically reject Proposal merely because it exceeds budget unless canonical rule exists.
Do not transform budget into Proposal price.

## 16. VALIDITY / EXPIRY

If Proposal validity is required by Roadmap, model explicitly.
Do not reuse Sales Quote expiry semantics blindly.
Proposal expiry/validity is a Reverse Marketplace fact.

## 17. DESCRIPTION / INCLUDED SERVICES

If Proposal includes structured/free-text content:

- preserve PII/contact policy;
- enforce size limits;
- validate structure;
- prevent HTML/script injection;
- avoid unbounded deeply nested JSON.

Do not claim DLP-level safety unless actually implemented.

## 18. CONTACT DISCLOSURE / ANTI-DISINTERMEDIATION

Hard invariant:

`PROPOSAL EXISTS ≠ CONTACT DISCLOSED`

Seller must not embed phone, email, WhatsApp, Telegram, URL/website or social handle if current anti-disintermediation policy forbids it at this stage.

If exact disclosure policy is deferred, implement conservative validation and document limitations.
Do not automatically disclose Buyer contact in Proposal endpoints.

## 19. BUYER VIEW PROJECTION

Buyer-facing Proposal projection may include Proposal code, permitted Seller public identity/reference, indicative amount/currency, description, included/excluded services, submittedAt, status and validity hint.

Must not include Seller internal CRM data, other Seller proposals through wrong scope, internal audit fields, hidden scoring/ranking or private distribution data.

Use purpose-built projection.

## 20. SELLER VIEW PROJECTION

Seller may read its own Proposal and safe BuyerRequest context.
Do not expose Buyer contact PII.
Do not expose other Sellers.

## 21. RBAC / PERMISSIONS

Introduce minimum permissions consistent with repository convention.

Conceptually:
- `reverse.proposal.read_own`
- `reverse.proposal.write_own`
- Buyer proposal read permission if required

Inspect naming patterns before finalizing.

PARTNER gets own Proposal scope only.
BUYER gets only own-request Proposal read if Step 2.2D requires it.

## 22. MASS ASSIGNMENT

Reject forged server-owned fields such as:

- id;
- code;
- sellerId;
- partnerId;
- buyerRequestId where route-owned;
- distributionId where server-derived;
- buyerId;
- status;
- version;
- createdBy;
- submittedAt;
- withdrawnAt;
- convertedAt;
- quoteId;
- saleId;
- contactDisclosed;
- selected;
- acquisitionSource;
- timestamps;
- actor/correlation fields.

No client can self-mark Proposal selected/accepted/converted.

## 23. CAS / CONCURRENCY

Use canonical optimistic concurrency.

Required proof:
- stale version → 409;
- concurrent updates → one winner;
- submit vs update race;
- withdraw vs submit race if supported;
- BuyerRequest cancel vs Proposal submit;
- duplicate create same Seller/request → one Proposal;
- duplicate submit no duplicate milestones.

Final aggregate state/history must be deterministic.

## 24. DUPLICATE CREATE / IDEMPOTENCY

Likely one Proposal per Seller per BuyerRequest.
Retries must not create duplicates.
DB uniqueness should enforce this.

Do not silently create Proposal versions as new rows unless Roadmap requires it.

## 25. HISTORY / AUDIT

Record meaningful Proposal facts:
- created;
- updated;
- submitted;
- withdrawn/cancelled if supported.

Include actor, timestamp, from/to state and changed fields.

No contact PII in history/audit.
Failed CAS/validation/IDOR must not leave success audit/history.

## 26. EVENTS / OUTBOX

Do not invent a broad Proposal event catalog.

If no consumer exists in 2.2D, no event may be preferable.
If future 2.2E/2.2F requires a durable fact event, introduce only if Roadmap/contracts clearly require it.

If introduced: reverse-owned, versioned, no PII, outbox/inbox, idempotent, no Sales event.

## 27. NO COMMUNICATION YET

Do not create chat/thread automatically unless Step 2.2D explicitly requires it.
Default: Step 2.2E owns BuyerRequest/Proposal Communication.
No reverse-owned chat.

## 28. NO SALES CONVERSION

Proposal create/update/submit must create zero:

- Lead;
- Opportunity;
- Quote;
- CheckoutIntent;
- Sale;
- OrderRequested;
- Order;
- Booking;
- Payment.

Step 2.2F owns conversion.
DD-030 remains deferred until its gate.

## 29. DD-030 COMPATIBILITY

Step 2.2D must not prematurely decide whether Proposal converts into Lead, Opportunity or Quote.

Proposal schema should support future conversion without forcing one target now.
No salesQuoteId required unless Roadmap explicitly demands it.

## 30. ACQUISITION SOURCE

Proposal originates from BuyerRequest.
Future conversion must preserve `BUYER_REQUEST`.
Do not allow Proposal payload to override acquisition source.
Do not create Sales/Order now.

## 31. CATALOG / PRODUCT ISOLATION

Proposal may reference request/category context but must not create Product/Tariff, alter Availability, reserve inventory or modify Catalog.

Proposal may exist independently of live Product.

## 32. PRICING MODEL BOUNDARY

Do not implement Universal Pricing Model or 1.8A–1.8D here.
Proposal commercial indication is not the future Catalog Pricing Engine.

No period pricing, RatePlan engine, availability calendar, dynamic pricing or pricing formula language.

## 33. SELLER IDENTITY / PUBLIC PROFILE

Determine what Seller identity Buyer sees.
Do not expose internal Partner legal/private profile.
If public Seller profile is allowed, use canonical public-profile authority/read model.

## 34. PRIVACY / PII

Proposal must not contain unnecessary Buyer PII.
Seller-supplied content must not leak prohibited Seller contact info if current policy forbids it.
Buyer-facing response must be tenant-safe.
Cross-Seller isolation is mandatory.

## 35. API SURFACE

Minimal surface may include:

Seller:
- create Proposal for distributed request;
- list own Proposals;
- get own Proposal;
- update DRAFT;
- submit;
- withdraw/cancel if canonical.

Buyer:
- list Proposals for own BuyerRequest;
- get Proposal related to own BuyerRequest.

Do not add select/accept Proposal unless Roadmap assigns it to 2.2D; do not add conversion/chat/contact/payment/booking actions.

## 36. MIGRATION

Additive only.

Expected reverse-owned persistence:
- SellerProposal;
- Proposal history if needed;
- enum/indexes/unique constraints.

No prohibited cross-schema FK.
No destructive backfill.
No db push.
Clean replay.
Drift 0.

## 37. ID STRATEGY

Inspect `ids.md`.
If Proposal is user-facing, register a canonical business prefix according to repository conventions and use atomic IdsService.
Do not invent arbitrary prefix without registry review.

## 38. INDEXES / QUERY PATHS

Support:
- Seller own list;
- BuyerRequest → Proposals;
- Seller+BuyerRequest unique lookup;
- status where needed.

Use deterministic pagination/order.
Avoid speculative analytics/ranking indexes.

## 39. FAILURE ATOMICITY

Failed create/update/submit must leave no partial Proposal mutation, version, history, audit, outbox, Sales, Communication or Catalog side effects.

Test stale CAS, invalid distribution, cancelled request, foreign Seller, invalid money/content.

## 40. REQUIRED TESTS

At minimum prove:

1. anonymous denied;
2. BUYER cannot create Seller Proposal;
3. unmatched Seller cannot create Proposal;
4. distributed Seller can create Proposal;
5. Seller A cannot create Proposal on Seller B distribution;
6. cancelled BuyerRequest rejects new Proposal;
7. DRAFT BuyerRequest rejects Proposal;
8. one Seller/request → one Proposal;
9. concurrent duplicate create → one Proposal;
10. Seller own list/get;
11. cross-Seller IDOR denied;
12. Buyer own-request Proposal list;
13. cross-Buyer Proposal access denied;
14. Proposal amount/currency validation;
15. Proposal amount is non-binding;
16. BuyerRequest budget does not become Proposal price;
17. server-owned fields rejected;
18. contact/PII rules enforced;
19. DRAFT update;
20. submit lifecycle;
21. invalid lifecycle;
22. stale CAS;
23. concurrent update;
24. submit/update race;
25. request cancel vs submit race;
26. history;
27. audit;
28. no duplicate Proposal on retry;
29. no Communication/chat side effect;
30. no Lead/Opportunity/Quote/Sale;
31. no Order/Booking/Payment;
32. no Catalog/Product/Tariff/Availability mutation;
33. acquisition source not forgeable;
34. no cross-Seller leak;
35. migration replay/drift;
36. pagination/determinism.

One test may prove multiple invariants.

## 41. FULL REGRESSION

Run:

Backend:
- TypeScript compile;
- full unit;
- Step 2.2D targeted E2E;
- Step 2.2C regression;
- Step 2.2B regression;
- Step 2.2A regression;
- Step 2.5B acquisition regression;
- relevant RBAC/privacy/event tests;
- full serial E2E.

Frontend:
- TypeScript;
- Vitest;
- production build.

DB:
- migrate status;
- clean replay;
- drift.

Report exact counts.

## 42. DOCUMENTATION

Create/update Step 2.2D architecture documentation covering ownership, Proposal ≠ Quote, non-binding money, distribution prerequisite, Seller/Buyer scope, lifecycle, contact/privacy boundary, anti-disintermediation, CAS/concurrency, history/audit, event rationale, no Sales conversion, DD-030 compatibility, BUYER_REQUEST propagation and 2.2E/2.2F compatibility.

## 43. ROADMAP UPDATE

Only after implementation and green regression:

Mark:

`2.2D IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Set active item:

`Step 2.2D STRICT REVIEW`

Keep Step 2.2E blocked/not started.
Do not mark 2.2D approved in this implementation pass.

## 44. ARCHITECTURE STOP CONDITIONS

STOP with `ARCHITECTURE DECISION REQUIRED` if implementation requires:

- making Proposal a Sales Quote;
- binding Proposal price as Checkout authority;
- resolving DD-030 now;
- contact-disclosure policy not canonically defined;
- new Communication ownership;
- auto-Sales conversion;
- cross-context write;
- new Pricing Engine;
- Service Templates implementation;
- parallel Order/Booking pipeline.

## 45. REQUIRED FINAL REPORT

Return:

# PHASE 2 — STEP 2.2D — SELLER PROPOSAL FOUNDATION — ОТЧЁТ

## 1. Verdict
`PHASE 2 STEP 2.2D IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
or
`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. Current → Target mapping
## 5. reverse.* ownership
## 6. Proposal domain semantics
## 7. Proposal vs Sales Quote
## 8. Distribution prerequisite
## 9. Seller own-scope
## 10. Buyer own-scope
## 11. Cross-Seller isolation
## 12. Proposal cardinality
## 13. Lifecycle
## 14. BuyerRequest status gate
## 15. Money/currency semantics
## 16. Budget relationship
## 17. Validity/expiry
## 18. Content / anti-disintermediation
## 19. Contact disclosure boundary
## 20. Seller/Buyer projections
## 21. RBAC / permissions
## 22. Mass assignment
## 23. CAS / concurrency
## 24. Duplicate/idempotency semantics
## 25. History / audit
## 26. Events / outbox
## 27. Communication isolation
## 28. Sales isolation
## 29. DD-030 compatibility
## 30. Acquisition source
## 31. Catalog / Pricing isolation
## 32. API surface
## 33. Migration
## 34. IDs
## 35. Indexes / query paths
## 36. Targeted tests
## 37. Full regression
## 38. Runtime verification
## 39. Issues found/fixed
## 40. Documentation changes
## 41. Deferred decisions
## 42. Architecture decision status
## 43. Out-of-scope confirmation
## 44. Exact files changed

Final line repeats verdict.

## 46. STOP CONDITION

After implementation and validation: STOP.

Do NOT perform Step 2.2D Strict Review in the same pass.
Do NOT start Step 2.2E.
Do NOT implement Reverse Marketplace chat.
Do NOT implement Proposal → Sales conversion.
Do NOT execute Universal Pricing Model Amendment.
Do NOT implement Service Templates 1.8A–1.8D.

Wait for a separate Step 2.2D STRICT REVIEW prompt.
