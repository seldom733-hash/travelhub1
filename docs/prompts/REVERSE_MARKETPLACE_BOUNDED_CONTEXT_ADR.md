# REVERSE MARKETPLACE — BOUNDED CONTEXT & OWNERSHIP ADR
## ADR CREATION PROMPT

**Project:** TravelHub
**Mode:** ARCHITECTURE DECISION RECORD — DOCUMENTATION ONLY
**Canonical prerequisite:** CURRENT CANONICAL EXECUTION SEQUENCE
**Status before execution:** Execution Sequence Strict Review APPROVED WITH REVIEW FIXES
**Unique NEXT:** Reverse Marketplace ADR

# 1. MISSION

Create the formal ADR required by the canonical Roadmap before Step 2.2A.

The ADR must decide the bounded-context and ownership model for Reverse Marketplace without implementing schema, modules, APIs, migrations, permissions, events or UI.

The decision must make Steps 2.2A–2.2F implementable without ambiguity.

# 2. REQUIRED SOURCES

Inspect at minimum:
- current `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- `CURRENT CANONICAL EXECUTION SEQUENCE`;
- Reverse Marketplace amendment and its Strict Review fixes;
- ADR-0001 modular-monolith/domain ownership rules;
- ADR-0005 PublicSellerProfile/catalog boundary;
- ADR-0007 acquisition boundary;
- ADR-0011 Communication bounded-context precedent;
- current Sales architecture: Lead, Opportunity, Quote, CheckoutIntent, Sale;
- current Communication/CML model;
- current Catalog/Product ownership;
- current Security/CRM partner identity;
- current Order/Booking pipeline;
- Deferred Decisions Map.

Use repository truth, not earlier reports alone.

# 3. DECISION TO MAKE

Decide whether Reverse Marketplace is a first-class bounded context, expected canonical owner:

`reverse.*`

The ADR must explicitly accept, reject, or modify this recommendation.

Do not leave ownership as “recommended” after this ADR.

If `reverse.*` is accepted, define its precise ownership and boundaries.

# 4. DOMAIN PURPOSE

Define Reverse Marketplace as demand-led commerce:

Buyer creates a commercial request based on desired service/travel requirements rather than selecting only an already published storefront offer.

Eligible Sellers may receive the request and submit proposals.

A selected proposal must converge into the existing canonical Sales pipeline.

Reverse Marketplace must NOT become a second commerce/order stack.

# 5. SELLER LOCATION ≠ SELLING COVERAGE

Canonical invariant:

A Seller's legal/registration/office country does NOT define where the Seller may sell services.

Example that must remain valid:

A Seller located in Baku/Azerbaijan may sell hotels or tours in Turkey.

Eligibility must be based on declared/authorized commercial capabilities and destination coverage, not seller legal location.

# 6. SELLER COMMERCIAL CAPABILITIES OWNERSHIP

Decide owner of:
- service categories the Seller can sell;
- destination countries/regions/cities the Seller covers;
- accepts Buyer Requests ON/OFF;
- capability lifecycle/status;
- capability own-scope;
- capability audit facts.

Expected owner if ADR accepts bounded context:
`reverse.*`

Explicitly distinguish from:
- Security/CRM partner identity;
- Catalog Product;
- PublicSellerProfile;
- inventory;
- pricing;
- availability.

Capabilities are seller-declared commercial eligibility, NOT inventory authority.

# 7. BUYER REQUEST OWNERSHIP

Decide canonical owner of BuyerRequest.

Expected:
`reverse.*`

Define conceptual responsibility:
- request identity;
- buyer ownership;
- category/service intent;
- destination/service-area intent;
- dates/date flexibility where applicable;
- travelers/PAX requirements where applicable;
- budget/preferences where allowed;
- lifecycle;
- privacy/disclosure state;
- matching/distribution facts.

Do NOT freeze every field or lifecycle enum unless current Roadmap already requires it.

# 8. MATCHING / DISTRIBUTION OWNERSHIP

Decide who owns the fact that a BuyerRequest was evaluated/distributed/matched to a Seller.

Expected:
`reverse.*`

Required:
- server-authoritative;
- auditable;
- deterministic eligibility foundation;
- no client self-promotion;
- unmatched Seller cannot access request;
- Seller cannot forge its own eligibility through payload;
- distribution does NOT create Lead/Opportunity/Quote/Sale automatically.

Distinguish:
`MATCHED / DISTRIBUTED`
from
`CONTACT DISCLOSED`.

# 9. SELLER PROPOSAL OWNERSHIP

Decide canonical owner of Seller Proposal.

Expected:
`reverse.*`

Required invariants:
- one BuyerRequest may receive 0..N Seller Proposals;
- strict per-Seller isolation;
- Proposal is NOT canonical Sales Quote;
- Proposal must not create a second Quote/pricing engine;
- any proposal amount before canonical Quote is non-binding unless Roadmap explicitly decides otherwise;
- binding commercial authority remains canonical Sales Quote/Checkout/Sale.

# 10. COMMUNICATION BOUNDARY

Communication remains owned by existing Communication bounded context / `CML-*`.

Reverse Marketplace must not implement a second chat system.

Define allowed context references, conceptually:
- BuyerRequest;
- Buyer;
- Seller;
- optionally Proposal.

Communication owns messages/conversation lifecycle.
Reverse Marketplace owns request/proposal/matching facts.

Define IDOR/cross-Seller privacy expectation:
Seller A cannot read Seller B's proposal/conversation unless an explicit future policy permits it.

# 11. SALES CONVERGENCE

Decide the architectural convergence rule:

Reverse Marketplace demand/proposals MUST enter the existing canonical Sales pipeline.

No:
- BuyerRequestOrder;
- ProposalOrder;
- reverse Checkout;
- reverse Payment;
- reverse Booking;
- parallel Quote engine.

Target canonical flow must remain conceptually:

BuyerRequest
→ Seller Proposal
→ canonical Sales conversion point
→ Opportunity/Quote as decided
→ Checkout
→ Sale
→ OrderRequested
→ Order
→ Booking
→ Finance.

# 12. CONVERSION POINT

The previous amendment deferred exact Proposal→Sales conversion point:
Lead vs Opportunity vs Quote.

This ADR must determine whether ownership can be finalized while conversion point remains deferred.

Preferred approach:
- decide bounded-context ownership now;
- define a hard prerequisite that the exact conversion command/target is resolved before Step 2.2F;
- do not force a premature conversion choice if evidence is insufficient.

If Step 2.2A–2.2E can proceed safely without it, record that.
If not, resolve it now.

# 13. ACQUISITION SOURCE

Preserve Step 2.5B canonical attribution.

Reverse Marketplace-originated commerce must eventually carry:
`BUYER_REQUEST`
(or the current canonical enum value if repository differs).

Required:
- publication channel ≠ acquisition source;
- conversion to Sales must not replace BUYER_REQUEST with DIRECT/MARKETPLACE;
- immutable propagation continues through canonical downstream pipeline.

Do not modify code in this ADR.

# 14. PRODUCTS ≠ CAPABILITIES

Explicitly decide:

Catalog Product is not the source of truth for whether a Seller is commercially capable of responding to Buyer Requests.

A Seller may be eligible for:
HOTEL + Turkey
without currently having a published hotel Product or live inventory.

Conversely, Product ownership/publication must not automatically grant every Reverse Marketplace capability unless explicitly synchronized by future policy.

# 15. SERVICE TEMPLATES LIMITED-SCOPE COMPATIBILITY

Respect the approved execution-sequence review:

2.2A–2.2F may proceed before 1.8A–1.8D only under limited scope:
- capabilities use lightweight seller-declared service categories + destination coverage;
- matching does not depend on live inventory;
- matching does not require normalized room/unit/tariff/period structures;
- Service Templates remain later commercial modeling.

Do not pull 1.8A–1.8D implementation into this ADR.

# 16. PRIVACY / CONTACT DISCLOSURE

Define boundary:
`MATCHED ≠ CONTACT DISCLOSED`.

Matching/distribution alone must not automatically reveal protected buyer contact information.

The exact contact-disclosure policy may remain deferred to its canonical later step, but the ADR must preserve the boundary.

No seller-wide access to BuyerRequest PII.

# 17. SECURITY / OBJECT SCOPE

Define architectural security principles:
- Buyer owns own requests;
- Seller sees only requests distributed/matched to that Seller under canonical rules;
- Seller sees only its own Proposal;
- other Sellers' proposals are isolated;
- ADMIN/system capabilities do not justify ordinary tenant leakage;
- object scope is server-authoritative;
- role names must not replace capability/entitlement checks where project policy uses permissions.

Preserve small-organization compatibility: one employee may have multiple capabilities/permissions.

# 18. ENTITLEMENTS

Determine ownership boundary for “Seller is allowed to participate in Buyer Requests”.

Do not hardcode organization size or role names.

If entitlement product rules are still deferred:
- keep exact entitlement rules deferred;
- define that capability declaration alone does not necessarily grant commercial entitlement;
- approval/onboarding alone does not automatically grant all Reverse Marketplace entitlements.

# 19. EVENTS

Do not freeze a large event catalog.

The ADR may define event ownership principles only:
- reverse.* publishes facts it owns;
- Sales publishes Sales facts;
- Communication publishes Communication facts;
- downstream conversion uses canonical contracts;
- matching/distribution must not masquerade as Sales events.

Future event names/versions remain implementation-step decisions unless Roadmap already fixes them.

# 20. ID STRATEGY

Review current working `BRQ-*` planning.

Decide whether ADR needs to freeze IDs now.

Preferred:
- BuyerRequest needs canonical ID registration at implementation;
- Seller Proposal needs its own canonical prefix if required;
- do not invent prefixes without checking ID registry/conventions.

If names/prefixes remain deferred, explicitly state implementation gate.

# 21. BOUNDED-CONTEXT WRITE RULE

If `reverse.*` is accepted:

Reverse Marketplace may write only its owned state.

It may READ trusted references from:
- Security/CRM;
- Catalog;
- Sales;
- Communication metadata where contractually appropriate.

It must not directly write:
- catalog.*;
- sales.*;
- order.*;
- booking.*;
- finance.*;
- communication.*.

Cross-context mutations occur through owner services/commands/events according to canonical architecture.

# 22. FAILURE / RELIABILITY BOUNDARY

Define architecture expectations without implementing:
- matching/distribution facts must be replay/idempotency-safe where async;
- proposal conversion must not duplicate canonical Sales objects;
- retries must not expose a request to an ineligible Seller;
- event reliability uses existing platform mechanisms, not a reverse-specific event bus.

# 23. REQUIRED ADR CONTENT

Create the next ADR number according to repository convention.

ADR must contain at minimum:
1. Title
2. Status
3. Date
4. Context
5. Problem
6. Decision
7. Bounded context
8. Ownership table
9. Allowed dependencies
10. Forbidden dependencies/writes
11. Seller capability semantics
12. BuyerRequest ownership
13. Matching/distribution ownership
14. Proposal ownership
15. Communication boundary
16. Sales convergence
17. Acquisition propagation
18. Privacy/contact-disclosure boundary
19. Security/object-scope principles
20. Service Templates compatibility
21. Consequences
22. Deferred decisions
23. Implementation prerequisites
24. Rejected alternatives
25. Roadmap impact

Follow existing ADR style if repository uses a different canonical structure.

# 24. REJECTED ALTERNATIVES TO ADDRESS

At minimum analyze/reject or justify:
- put BuyerRequest in Sales;
- put capabilities in Catalog;
- infer capabilities only from published Products;
- match Sellers by legal country;
- create Proposal as Sales Quote immediately;
- create a second Reverse Marketplace checkout/order pipeline;
- put request chat inside reverse.*;
- auto-create Leads for every matched Seller.

# 25. ROADMAP UPDATE

After ADR creation, update canonical Roadmap only as needed to:
- reference the new ADR;
- mark ADR creation as `IMPLEMENTED/CREATED — WAITING FOR STRICT REVIEW` or equivalent;
- keep Reverse Marketplace ADR as active review target;
- DO NOT mark ADR APPROVED;
- DO NOT advance NEXT to 2.2A until separate ADR Strict Review approves it.

The execution sequence must remain authoritative.

# 26. DEFERRED DECISIONS MAP

Update only if this ADR actually resolves an existing deferred ownership decision or creates a clearly necessary new deferred decision.

Do not mark conversion point decided unless ADR truly decides it.

# 27. NO IMPLEMENTATION

Absolutely no:
- Prisma schema;
- migrations;
- Nest modules/controllers/services;
- permissions;
- frontend;
- tests for runtime behavior;
- reverse.* tables;
- BuyerRequest API;
- capability API;
- proposal API;
- matching engine.

Documentation/ADR only.

# 28. CONSISTENCY CHECK

Before finalizing, verify ADR against:
- ADR-0001;
- ADR-0005;
- ADR-0007;
- ADR-0011;
- current Roadmap;
- CURRENT CANONICAL EXECUTION SEQUENCE;
- Reverse Marketplace invariants;
- Service Templates limited-scope rule;
- Step 2.5B BUYER_REQUEST attribution.

Any contradiction must be resolved or reported.

# 29. REQUIRED FINAL REPORT

Return:

# REVERSE MARKETPLACE ADR — ОТЧЁТ

## 1. Verdict
`REVERSE MARKETPLACE ADR CREATED — WAITING FOR STRICT REVIEW`
or
`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. ADR number / file
## 5. Decision summary
## 6. Bounded-context decision
## 7. Ownership map
## 8. Seller Commercial Capabilities
## 9. BuyerRequest
## 10. Matching / Distribution
## 11. Seller Proposal
## 12. Communication boundary
## 13. Sales convergence
## 14. Conversion-point decision/defer status
## 15. Acquisition source
## 16. Products vs Capabilities
## 17. Service Templates compatibility
## 18. Privacy / contact disclosure
## 19. Security / object scope
## 20. Entitlements boundary
## 21. Events/reliability
## 22. ID strategy
## 23. Rejected alternatives
## 24. Consequences
## 25. Deferred decisions
## 26. Roadmap changes
## 27. Consistency check
## 28. Architecture decision status
## 29. Out-of-scope confirmation
## 30. Exact files changed

# 30. STOP CONDITION

After ADR creation and documentation updates:

STOP.

Do NOT perform ADR Strict Review in the same pass.
Do NOT start Step 2.2A.
Do NOT implement reverse.*.

Wait for a separate ADR Strict Review prompt.
