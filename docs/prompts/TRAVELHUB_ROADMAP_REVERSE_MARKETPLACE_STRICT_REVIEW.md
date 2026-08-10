# TRAVELHUB — CANONICAL ROADMAP REVERSE MARKETPLACE AMENDMENT — STRICT REVIEW

**Task type:** STRICT REVIEW of canonical roadmap amendment only  
**Primary target:** `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`  
**Review target:** Reverse Marketplace / Buyer Requests / Seller Commercial Capabilities amendment  
**Current implementation boundary:** Phase 2 Step 2.4 completed; **Step 2.5 has NOT started**  
**Implementation work:** FORBIDDEN

---

# 1. MISSION

Perform a strict, adversarial architecture review of the actual amended canonical Roadmap.

Do NOT approve based on the amendment report alone.

Inspect the actual current Roadmap text, existing ADRs/contracts/architecture documentation where necessary, and verify that the Reverse Marketplace amendment is internally consistent with the already approved TravelHub architecture.

The amendment introduced or changed concepts around:

- Step 2.2A — Seller Commercial Capabilities & Destination Coverage;
- Step 2.2B — Buyer Request / Reverse Marketplace Foundation;
- Step 2.2C — Buyer Request Matching & Distribution;
- Step 2.2D — Seller Proposal Foundation;
- Step 2.2E — Buyer Request / Proposal Communication;
- Step 2.2F — Proposal → Canonical Sales Conversion;
- Step 2.5B acquisition propagation;
- Partner Cabinet;
- Buyer Cabinet;
- pre-sale Communication/Chat;
- analytics/funnels;
- Reverse Marketplace E2E;
- cross-cutting invariants;
- ownership/dependency analysis.

Your job is to determine whether these additions are safe, canonical, non-duplicative, correctly owned, and correctly sequenced.

---

# 2. REVIEW RULES

This is a documentation/architecture review.

You MAY:

- inspect repository code/schema/tests to verify existing architecture;
- inspect ADRs/contracts/docs;
- correct local defects, contradictions, omissions or ambiguous wording in the Roadmap;
- add clarifying roadmap text where required to preserve existing architecture;
- update a directly related architecture/deferred-decision document only if the Roadmap would otherwise contradict an already-approved source of truth.

You MUST NOT:

- implement Reverse Marketplace;
- modify Prisma schema;
- create migrations;
- create backend/frontend functionality;
- add controllers/services/DTOs;
- add runtime permissions;
- add events to production code;
- implement matching;
- implement Seller capabilities;
- implement BuyerRequest;
- implement Proposal;
- implement chat;
- start Step 2.5.

If a required correction would change an already-approved fundamental architecture rather than merely clarify/integrate it, STOP and report:

`ARCHITECTURE DECISION REQUIRED`

Do not silently invent the decision.

---

# 3. VERIFY BASELINE FIRST

Before reviewing, establish:

- exact HEAD/branch;
- dirty/untracked files;
- exact current canonical Roadmap path;
- whether only documentation was changed by the amendment;
- current completion state through Step 2.4;
- Step 2.5 not started;
- existing ADR ownership boundaries;
- current Sales/Communication/Partner/Catalog/CRM/Order/Booking ownership.

Do not overwrite user-supplied prompt files.

---

# 4. MASTER PLAN INTEGRITY

Verify that the amendment obeys the canonical Master Plan change rules:

- no existing Step deleted;
- no existing Step renumbered;
- additive A/B/C-style steps used correctly;
- no completed Step silently rewritten into a materially different contract;
- no contradiction with previously approved Step 1.x / 2.1–2.4 semantics;
- no accidental claim that logical numbering determines execution order.

Specifically verify whether inserting `2.2A–2.2F` between 2.2 and 2.3 is document-safe even though 2.3–2.4 are already implemented.

The Roadmap must explicitly distinguish:

**logical architecture position** from **actual implementation sequence**.

---

# 5. CORE BUSINESS MODEL REVIEW

Verify that the Roadmap correctly represents two acquisition paths:

### Product-led
`Marketplace/Storefront → Product → Sales → Quote → Checkout → Sale → OrderRequested → Order`

### Request-led
`BuyerRequest → Matching → Seller Proposal → selection → canonical Sales → Quote → Checkout → Sale → OrderRequested → Order`

There must NOT be a second:

- Quote engine;
- Checkout;
- Sale;
- Order;
- Booking;
- Payment;
- Settlement;
- Finance pipeline.

Search the amended Roadmap for wording that could accidentally authorize parallel transaction models.

Fix ambiguous local wording if necessary.

---

# 6. LEGAL LOCATION VS COMMERCIAL COVERAGE

Strictly verify the canonical invariant:

`Partner legal/physical location ≠ Seller commercial destination coverage`

The Roadmap must NOT imply matching by:

`Partner.countryCode == Request.destinationCountry`.

Example that must remain valid:

- Seller legally registered in Azerbaijan;
- Seller commercial capability includes Hotels in Turkey;
- Buyer requests Hotel in Antalya;
- Seller may be eligible regardless of legal country.

Verify consistency with:

- Partner registration/onboarding;
- Partner profile;
- CRM/Seller identity;
- Marketplace;
- future custom domains;
- Partner Cabinet.

Ensure legal country is not repurposed as destination coverage anywhere in the new text.

---

# 7. PRODUCTS VS CAPABILITIES

Verify:

`Published Catalog Products ≠ Seller Commercial Capabilities`

A Seller may be able to respond to demand even without a currently published Product for that destination/service.

But also verify that the amendment does NOT accidentally allow Seller capabilities to become:

- a shadow Catalog;
- a Product lifecycle substitute;
- an inventory authority;
- a pricing authority;
- an availability authority.

Capabilities describe commercial eligibility/ability to respond, not authoritative sellable inventory.

Add this distinction if missing.

---

# 8. SELLER COMMERCIAL CAPABILITIES OWNERSHIP

The report says ownership is effectively “Partner own-scope”, which is a scope statement, not necessarily a bounded-context owner.

This MUST be reviewed.

Determine from ADR-0001/current modules whether Seller Commercial Capabilities should canonically belong to:

- Partner/Seller domain;
- Catalog;
- Sales;
- Security/Entitlement;
- another existing owner;
- or require an explicit architecture decision.

Do NOT leave ownership as merely “Partner own-scope” if the roadmap ownership map is supposed to name the canonical owner.

Also distinguish:

- domain owner;
- who may edit;
- who may approve/moderate;
- who consumes the capability.

If ownership cannot be safely derived:

`ARCHITECTURE DECISION REQUIRED`.

---

# 9. BUYER REQUEST OWNERSHIP

The report states BuyerRequest has a “new owner / working schema to be decided at implementation”.

Review whether that is sufficiently canonical.

A Master Plan should not casually introduce a cross-domain business entity without an ownership boundary.

Determine whether existing architecture clearly supports ownership by:

- Marketplace;
- Sales;
- CRM;
- Buyer/Account;
- a new Reverse Marketplace bounded context;
- another owner.

Do NOT invent a new bounded context just because it is convenient.

If the existing ADRs do not make ownership safely derivable, explicitly flag:

`ARCHITECTURE DECISION REQUIRED`

and explain exactly what decision is needed before Step 2.2B implementation.

A deferred physical schema name is acceptable; an undefined domain owner may not be.

---

# 10. MATCHING / DISTRIBUTION OWNERSHIP

“Server-side orchestration” is not sufficient as a bounded-context owner.

Review the actual Roadmap ownership map.

Clarify:

- who owns eligibility rules;
- who reads Seller capabilities;
- who owns BuyerRequest;
- who records matching/delivery facts;
- who may trigger distribution;
- whether matching is orchestration or a domain fact;
- whether distribution history belongs to BuyerRequest owner.

Matching must not become a hidden cross-domain writer.

ADR-0001 boundaries must remain intact.

---

# 11. SELLER PROPOSAL OWNERSHIP

“Seller own-scope” is also not a bounded-context owner.

Determine whether Proposal is owned by:

- BuyerRequest/Reverse Marketplace owner;
- Sales;
- another existing domain.

Verify Proposal does not duplicate canonical Quote.

The Roadmap must distinguish:

**Proposal**
= competitive/pre-commercial response to a BuyerRequest

from:

**Quote**
= canonical Sales commercial offer.

Review whether money authority is sufficiently deferred so Proposal pricing does not silently become a second binding-price contract.

---

# 12. REQUEST → SALES CONVERSION

Review Step 2.2F very carefully.

The amendment intentionally defers whether meaningful engagement converts through:

- Lead;
- Opportunity;
- Quote;
- another existing Sales stage.

Verify this deferral is safe.

At minimum, the Roadmap must establish:

- matching does not create Leads;
- delivery does not create Leads;
- Seller response does not automatically create duplicate CRM/Sales entities unless the future conversion contract says so;
- Buyer selection cannot bypass required Sales commercial invariants;
- selected Proposal cannot directly create Order;
- canonical Quote/Checkout/Sale remains authoritative.

If implementation of 2.2A–2.2F cannot begin safely until this conversion point is decided, record it as an explicit prerequisite/deferred architecture decision.

---

# 13. SERVICE TAXONOMY REVIEW

Verify the amendment does not prematurely hardcode a brittle tourism taxonomy.

Check that:

- service families/types are extensible;
- capability compatibility is data/config/reference-driven where appropriate;
- no hidden rule like `HOTEL → HOTEL OR TOUR` is embedded as canonical logic;
- taxonomy ownership is not confused with Catalog Product ownership;
- category schema and Seller capability taxonomy relationships are acknowledged.

Determine whether the existing Category/Schema system can be reused or whether the relationship must remain deferred.

Do not invent a second category system without justification.

---

# 14. DESTINATION MODEL REVIEW

Verify country-level + WORLDWIDE is presented as an initial capability, not the final geography model.

Future refinement:

`Country → Region → City/Destination`

must not conflict with:

- localization;
- Product destinations;
- availability;
- Seller legal addresses;
- buyer current location.

Check whether a canonical destination/reference owner already exists.

If not, ensure the Roadmap defers implementation ownership cleanly rather than creating competing destination taxonomies.

---

# 15. MATCHING SECURITY / IDOR

Verify the future matching/distribution requirements guarantee:

- unmatched Seller cannot fetch Request by guessed code/id;
- matched but not delivered/eligible Seller semantics are defined or deferred safely;
- Seller A cannot inspect Seller B match/proposal/conversation;
- BUYER sees only own requests;
- internal roles require explicit permissions;
- matching eligibility is server-authoritative;
- Seller cannot forge destination/service capabilities through request payloads;
- distribution state cannot be self-promoted by Seller.

The Roadmap need not define endpoint details now, but these must be future implementation invariants.

---

# 16. PRIVACY / CONTACT DISCLOSURE

Verify:

`MATCHED ≠ CONTACT DISCLOSED`

and ensure this applies to:

- BuyerRequest distribution;
- Seller Proposal;
- Communication;
- Partner views;
- analytics/events.

Check that no roadmap wording permits raw CRM Customer projection into Seller-facing Request DTOs.

Verify whether the report's reference to “3.37C disclosure policy” actually corresponds to a real existing or newly added Roadmap step.

If `3.37C` does NOT exist, do not cite it as an owner of the decision. Fix the roadmap/reporting model by either:

- keeping disclosure stage explicitly deferred in 3.37A/B / Deferred Decisions; or
- adding an additive 3.37C only if that is consistent with Master Plan conventions and genuinely necessary.

Do not invent a phantom step.

---

# 17. COMMUNICATION REUSE

Verify Step 2.2E correctly reuses `Communication = CML-*`.

Check against existing Communication foundation:

- participant/context consistency;
- Buyer own-scope;
- Partner own-scope;
- neutral 404/IDOR behavior;
- NOTE/INTERNAL visibility;
- direction semantics;
- audit/history;
- anti-disintermediation.

Ensure BuyerRequest/Proposal are communication **contexts**, not a reason to create a second messaging storage/domain.

Also ensure adding pre-sale contexts does not force premature full Chat implementation before 3.37A/B.

---

# 18. ACQUISITION SOURCE REVIEW

Review the `BUYER_REQUEST` addition to Step 2.5B.

Verify:

- acquisition source is not publication channel;
- source is immutable once canonical commercial flow is created;
- it can propagate through Quote/Sale/Order/Booking/Payment/Settlement/Analytics where those entities support it;
- no Step 2.5 implementation dependency is accidentally introduced;
- existing acquisition values remain valid;
- naming fits existing conventions.

If `BUYER_REQUEST` is only a working name, Roadmap must say so clearly and define the decision point before implementation.

Do not require Step 2.5 to understand an entity that does not exist yet.

---

# 19. PARTNER ONBOARDING REVIEW

Verify capability capture in onboarding is optional/minimal enough not to turn Step 1.10 into a retrospective implementation dependency.

Required principle:

- initial capability/coverage may be captured during onboarding;
- canonical management lives in future Partner capability flow;
- capability remains editable;
- legal country is independent;
- approval/Partner status does not automatically grant all Buyer Request entitlements.

Existing completed Step 1.10 must not become retroactively “incomplete”.

---

# 20. SMALL-ORGANIZATION ACCESS MODEL

Verify the amendment remains compatible with the previously established requirement that a small organization may have one employee handling tourists, suppliers and sales.

Do not introduce hardcoded role gates such as “only SALES_MANAGER can receive Buyer Requests”.

Roadmap should favor:

- permissions;
- capabilities;
- entitlements;
- admin-managed access;

while preserving tenant/object scope.

Do not implement the access-management feature in this review.

---

# 21. BUYER / PARTNER CABINET REVIEW

Verify Step 3.29/3.30 additions are UI/read-model requirements and do not create new domain ownership.

Partner Cabinet should eventually expose:

- Commercial Capabilities;
- Destination Coverage;
- Buyer Request Inbox;
- Proposals;
- related communications.

Buyer Cabinet should expose:

- My Requests;
- status/lifecycle;
- Received Proposals;
- selected Proposal;
- conversations.

Check strict tenant/own-scope wording.

---

# 22. ANALYTICS / EVENTS REVIEW

Verify the request-led funnel is analytics-ready without prematurely requiring event proliferation.

Distinguish:

- domain/business events;
- behavioral events;
- AuditLog;
- history;
- analytics read models.

A suggested sequence such as:

`BuyerRequestCreated → Matched → Delivered → SellerResponded → ProposalViewed → ProposalSelected → Quote → ...`

must not imply every label is already a canonical event.

Ensure event names are finalized only when implementation defines a real business fact/consumer/read-model need.

Also verify acquisition comparison with Marketplace/Storefront/Direct/API/Custom Domain remains coherent.

---

# 23. REVERSE MARKETPLACE E2E REVIEW

Verify the new additive `3.46X` entry does not violate numbering conventions.

The future journey must prove:

- Buyer creates request;
- Seller eligibility based on capabilities/coverage;
- Seller legal country irrelevant to destination matching;
- multiple Seller proposals;
- strict cross-Seller isolation;
- unmatched Seller denied;
- no PII disclosure merely from matching;
- contextual communication;
- selection;
- convergence into canonical Sales;
- downstream Order/Booking/Finance/Documents;
- no duplicate transaction pipeline.

If `3.46X` is literally written with placeholder `X`, determine whether canonical Roadmap conventions allow placeholders. If not, replace it with a concrete additive substep such as `3.46A` (provided it does not conflict with an existing step).

---

# 24. STEP 2.5 DEPENDENCY REVIEW

This is a key output.

Determine from the actual Roadmap and repository whether Step 2.5:

`OrderRequested → Order`

can proceed before implementation of 2.2A–2.2F.

Expected answer is YES unless a real hard dependency exists, because:

- Step 2.4 already emits `OrderRequested`;
- 2.5 completes an existing downstream flow;
- Reverse Marketplace is an upstream acquisition path;
- acquisition source extension in 2.5B is additive.

But do not assume. Verify.

If YES, state explicitly:

`STEP 2.5 MAY PROCEED AFTER THIS ROADMAP REVIEW IS APPROVED.`

If NO, identify the exact blocker.

---

# 25. ROADMAP STATUS / COMPLETION MARKERS

Verify that adding logical Steps 2.2A–2.2F after 2.2 does not make completed 2.3/2.4 misleading.

The Roadmap should make clear that:

- these are newly added post-baseline capabilities;
- they are NOT already implemented;
- completed 2.3/2.4 remain completed;
- implementation sequence may resume at 2.5;
- later Reverse Marketplace execution will be scheduled explicitly.

Fix status wording if necessary.

---

# 26. DEFERRED DECISIONS REVIEW

Verify all unresolved items are explicitly tracked and not disguised as implementation details.

At minimum inspect:

- BuyerRequest canonical owner;
- Seller Capability canonical owner;
- Matching/distribution owner;
- Seller Proposal canonical owner;
- final BuyerRequest/Proposal ID prefixes;
- BuyerRequest lifecycle;
- Proposal lifecycle;
- service taxonomy ownership/relationship to Catalog categories;
- destination reference ownership;
- ranking/SLA/rating/AI;
- Proposal → Lead/Opportunity/Quote conversion point;
- Buyer Request entitlement rules;
- contact disclosure stage;
- proposal money/binding authority.

If any is a prerequisite for implementation, mark it as such.

---

# 27. REQUIRED SEARCHES / CONTRADICTION CHECK

Perform repository/doc searches for at least:

- `BuyerRequest`
- `BUYER_REQUEST`
- `Reverse Marketplace`
- `Commercial Capabilities`
- `Destination Coverage`
- `Proposal`
- `3.37C`
- `3.46X`
- acquisition source/channel enums or docs
- Partner country/location semantics
- Communication context semantics
- existing Product/Category ownership
- Sales Lead/Opportunity/Quote ownership
- ADR-0001 cross-context write rules.

Report stale or contradictory references.

---

# 28. DOCUMENTATION-ONLY REGRESSION

Because production code is not supposed to change, full runtime/e2e regression is not automatically required.

However:

- verify git diff;
- verify no production code/schema/migration changed;
- if review corrections remain documentation-only, do not waste time rerunning the entire 500+ test suite unless repository policy requires it;
- if any code changed unexpectedly, STOP and investigate.

A documentation-only review should report tests as `NOT REQUIRED — documentation-only`, not fabricate a green runtime result.

---

# 29. REVIEW-FIX POLICY

If you find local documentation defects, fix them during review.

Examples:

- ambiguous owner labels;
- phantom `3.37C`;
- placeholder `3.46X`;
- wording that suggests capabilities own inventory/pricing;
- unclear dependency status;
- accidental retroactive incompleteness of Step 1.10;
- Proposal/Quote ambiguity;
- incorrect acquisition propagation wording.

After each fix, re-review the affected dependency.

Do not broaden scope into implementation.

---

# 30. APPROVAL BAR

Approve only if all of the following are true:

1. No existing step was deleted/renumbered.
2. Reverse Marketplace is a second acquisition path, not a second transaction system.
3. Legal location and commercial coverage are independent.
4. Product and Seller capability are independent.
5. Capabilities do not become shadow Catalog/inventory/pricing authority.
6. Distribution does not create Sales entities automatically.
7. Buyer contact data is protected.
8. Cross-Seller isolation is explicit.
9. Communication foundation is reused.
10. Proposal does not duplicate Quote.
11. Proposal selection converges into canonical Sales.
12. Acquisition semantics remain coherent.
13. Ownership is either resolved or explicitly blocked by `ARCHITECTURE DECISION REQUIRED`.
14. Deferred decisions are visible.
15. Step 2.5 dependency status is explicit.
16. No implementation work was performed.

---

# 31. REQUIRED OUTPUT

Return a structured report:

## 1. Verdict

One of:

`CANONICAL ROADMAP REVERSE MARKETPLACE STRICT REVIEW COMPLETED — APPROVED`

`CANONICAL ROADMAP REVERSE MARKETPLACE STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

`CANONICAL ROADMAP REVERSE MARKETPLACE STRICT REVIEW — CHANGES REQUIRED`

`ARCHITECTURE DECISION REQUIRED`

## 2. Baseline

Exact HEAD/branch and changed/untracked files.

## 3. Sources inspected

Roadmap + ADR/contracts/docs/code used to validate ownership/boundaries.

## 4. Amendment integrity

Renumber/delete/status result.

## 5. Ownership review

Exact owner findings for:
- Partner identity;
- Seller Commercial Capabilities;
- Catalog Product;
- BuyerRequest;
- Matching/Distribution;
- Seller Proposal;
- Communication;
- Sales;
- Order;
- Booking;
- Finance.

## 6. Core invariants

Pass/fail each major invariant.

## 7. Reverse Marketplace → Sales convergence

Prove no parallel transaction system.

## 8. Privacy/security/IDOR

Review result.

## 9. Communication review

Review result.

## 10. Acquisition review

Review result.

## 11. Partner/Buyer Cabinet integration

Review result.

## 12. Analytics/E2E readiness

Review result.

## 13. Deferred decisions

Exact unresolved decisions and whether each blocks implementation of 2.2A–2.2F.

## 14. Step 2.5 dependency verdict

Explicitly state whether Step 2.5 may proceed now.

## 15. Review fixes

Exact documentation fixes made during strict review.

## 16. Regression/testing

State documentation-only status honestly.

## 17. Files changed

Exact list.

## 18. Architecture decision status

Explicit YES/NO and rationale.

## 19. Out-of-scope confirmation

Confirm no implementation started.

---

# 32. STOP CONDITION

After Strict Review:

STOP.

Do NOT start Step 2.5.

Do NOT start 2.2A.

Do NOT implement Reverse Marketplace.

Wait for approval/next prompt.

If approved and no architecture blocker exists, final report must include:

`STEP 2.5 MAY PROCEED AFTER THIS ROADMAP REVIEW IS APPROVED.`

Final line must be the selected verdict.
