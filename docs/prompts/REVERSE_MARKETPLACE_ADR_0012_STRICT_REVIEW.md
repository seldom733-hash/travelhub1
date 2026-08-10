# REVERSE MARKETPLACE ADR-0012 — STRICT REVIEW PROMPT

**Project:** TravelHub
**Artifact under review:** `docs/adr/ADR-0012-reverse-marketplace-bounded-context.md`
**Mode:** STRICT ARCHITECTURE REVIEW / DOCUMENTATION FIXES ONLY
**Canonical active item:** ADR-0012 Strict Review
**Forbidden:** Step 2.2A implementation

# 1. MISSION

Perform an independent strict review of ADR-0012.

Do not approve from the implementation report. Read the actual ADR, current canonical Roadmap, Deferred Decisions Map, relevant existing ADRs, contracts and current domain structure.

Primary question:

Does ADR-0012 establish a safe, unambiguous and implementable ownership boundary for Reverse Marketplace so that Step 2.2A may begin after approval without creating a second commerce stack, leaking cross-seller data, confusing Catalog inventory with Seller capability, or violating existing bounded-context ownership?

# 2. REVIEW BOUNDARY

Allowed:
- documentation inspection;
- ADR/Roadmap/DD-map consistency fixes;
- minimal documentation-only review fixes.

Forbidden:
- Prisma/schema changes;
- migrations;
- backend/frontend implementation;
- reverse.* module/entity/API creation;
- Step 2.2A;
- BuyerRequest/matching/proposal implementation;
- runtime behavior changes.

# 3. BASELINE

Report:
- branch / HEAD;
- dirty state;
- pre-existing Step 2.5B changes separately;
- files attributable to ADR creation;
- files changed by strict review.

Confirm runtime code remains untouched.

# 4. ADR STATUS / SEQUENCE

Verify:
- ADR number follows repository convention;
- ADR status is Proposed before review;
- Roadmap active item is ADR-0012 Strict Review;
- 2.2A is blocked until ADR approval;
- Roadmap does NOT already mark ADR approved;
- no other item is simultaneously NEXT.

If review passes, documentation may update ADR status and Roadmap to approved and advance unique NEXT to Step 2.2A.

# 5. BOUNDED CONTEXT DECISION

Verify the decision is explicit, not merely recommended:

Reverse Marketplace = first-class bounded context `reverse.*`.

Review whether a separate PostgreSQL schema is consistent with ADR-0001 and ADR-0011.

Check that the ADR defines purpose narrowly enough:
request-led acquisition/orchestration, not a parallel transaction system.

# 6. OWNERSHIP MATRIX

Verify exclusive canonical ownership for:

- Seller Commercial Capabilities → reverse.*
- BuyerRequest → reverse.*
- Matching/Distribution → reverse.*
- Seller Proposal → reverse.*
- Communication/messages → communication.*
- Partner identity → Security/CRM
- PublicSellerProfile → Catalog
- Product/pricing/inventory/availability → Catalog
- Lead/Opportunity/Quote/CheckoutIntent/Sale → Sales
- Order → Order
- Booking → Booking
- Finance → Finance

Flag any dual-write or ambiguous ownership.

# 7. LEGAL LOCATION VS COVERAGE

Verify as hard invariant:

Seller legal/registration/office country is not authoritative selling coverage.

A Baku/Azerbaijan seller can be eligible for Turkey hotels/tours if its declared/authorized capability says so.

Check matching cannot silently fall back to legal country.

# 8. CAPABILITY VS INVENTORY

Verify:
- capability is seller-declared commercial eligibility;
- capability is not Product;
- capability is not inventory;
- capability is not availability;
- capability is not price;
- published Product is not required for capability;
- Product publication does not automatically grant capability.

Critically check that placing capabilities in reverse.* does not shadow Catalog authority.

# 9. LIMITED-SCOPE 2.2A SAFETY

Execution Sequence review approved 2.2A–F before 1.8A–D only under limited scope.

Verify ADR preserves:
- lightweight service-category declarations;
- destination coverage;
- no dependency on normalized room/unit/rate-plan/period structures;
- no live inventory dependency;
- no accidental implementation of Service Templates.

If ADR language like Country→Region→City/WORLDWIDE prematurely freezes taxonomy that DD-028 says is unresolved, correct it to conceptual/example semantics.

# 10. BUYERREQUEST OWNERSHIP

Verify BuyerRequest is a reverse.* demand entity and explicitly not:
Lead, Opportunity, Quote, Sale, Order, Booking or Communication.

Check ADR does not prematurely freeze:
- exact lifecycle enum;
- all category-specific fields;
- final schema;
- final API.

# 11. MATCHING / DISTRIBUTION

Verify matching/distribution facts belong to reverse.* and are:
- server-authoritative;
- auditable;
- eligibility-based;
- own-scope enforced;
- not client forgeable;
- not automatic Sales entity creation.

The illustrative funnel `1 → 70 → 25 → 6` must remain illustrative, not a business constant.

# 12. MATCHED != CONTACT DISCLOSED

Verify this is architectural and explicit.

Matching/distribution must not automatically expose:
- phone;
- email;
- WhatsApp;
- passport;
- raw Customer data;
- unnecessary PII.

Exact disclosure policy may remain deferred.

Check compatibility with anti-disintermediation requirements.

# 13. SELLER PROPOSAL

Verify:
- 0..N proposals per BuyerRequest;
- Seller owns/accesses only own proposal scope;
- proposal is reverse.*;
- proposal is not Sales Quote;
- no second pricing/Quote engine;
- pre-Quote amount is non-binding;
- binding authority remains canonical Quote/Checkout/Sale.

# 14. COMMUNICATION BOUNDARY

Verify Communication remains `communication.*` / CML-*.

Reverse Marketplace may reference conversation context but must not own message lifecycle.

Check strict cross-Seller isolation:
Seller A cannot access Seller B conversation/proposal merely because both matched the same request.

# 15. SALES CONVERGENCE

Verify one canonical downstream pipeline:

BuyerRequest
→ Proposal
→ canonical Sales conversion
→ canonical Checkout/Sale
→ OrderRequested
→ Order
→ Booking
→ Finance.

Reject any possibility of:
- BuyerRequestOrder;
- ProposalOrder;
- reverse Checkout;
- reverse Payment;
- reverse Booking;
- parallel Quote engine.

# 16. DD-030 — CONVERSION POINT

Critically review the decision to defer Proposal→Sales target to DD-030.

Questions:
- Can 2.2A–2.2E truly proceed without choosing Lead vs Opportunity vs Quote?
- Does 2.2E Communication need a canonical Sales entity?
- Is DD-030 hard-gated before 2.2F?
- Is DD-030 described consistently in Roadmap and DD map?

If safe, retain defer.
If the ambiguity leaks into earlier data contracts, mark CHANGES REQUIRED or resolve documentation appropriately.

Do not invent a conversion choice merely to close the DD.

# 17. ACQUISITION SOURCE

Verify current repository truth for `BUYER_REQUEST`.

Check:
- enum exists from 2.5B;
- reverse-originated conversion must preserve it;
- publication ≠ acquisition;
- conversion cannot silently replace it with DIRECT/MARKETPLACE;
- no runtime changes are made in this ADR.

# 18. ENTITLEMENT VS CAPABILITY

This boundary must be precise.

Verify:
- capability declaration does not itself necessarily authorize participation;
- onboarding/approval does not automatically grant all Reverse Marketplace entitlements;
- exact entitlement product rules may be deferred;
- Step 2.2A can still model capability without hardcoding roles/org size.

Check whether matching's “eligible + entitlement” language depends on an undefined authority. If so, document the authority/gate without prematurely implementing it.

# 19. SMALL-ORGANIZATION MODEL

Verify ADR does not assume one employee = one role.

One employee may hold permissions/capabilities for multiple operational functions.

Security must be capability/permission/object-scope driven, not hardcoded SALES_MANAGER/OPERATOR assumptions.

# 20. CROSS-CONTEXT ACCESS

Review ADR against ADR-0001.

If cross-schema read-by-ID is allowed, ensure:
- no cross-context writes;
- no inappropriate cross-schema FK ownership coupling if prohibited by existing architecture;
- commands/events/owner services are used for mutations;
- read dependencies are explicitly listed.

# 21. EVENT / RELIABILITY BOUNDARY

Verify ADR does not freeze premature event names.

Architecture principles should preserve:
- owner publishes owned facts;
- existing outbox/inbox reliability;
- idempotent async behavior;
- no reverse-specific event bus;
- retry cannot broaden eligibility/disclosure;
- conversion cannot duplicate Sales entities.

# 22. ID STRATEGY

Review `BRQ-*` against actual `ids.md`.

Important:
If `BRQ-*` is only a working prefix and not registered, ADR must not present it as final.

Proposal prefix must not be invented without registry review.

Ensure implementation gates are explicit.

# 23. REJECTED ALTERNATIVES

Verify ADR meaningfully addresses at least:
1. BuyerRequest in Sales;
2. capabilities in Catalog;
3. infer capabilities only from Products;
4. match by legal country;
5. Proposal immediately = Quote;
6. second reverse checkout/order stack;
7. chat inside reverse.*;
8. Lead per matched Seller.

Reasons must follow canonical ownership/invariants, not preference alone.

# 24. PRIVACY / MULTI-TENANCY THREAT REVIEW

Perform explicit threat review for:
- Seller guessing BuyerRequest IDs;
- Seller reading unmatched request;
- Seller reading another Seller proposal;
- Seller reading another Seller conversation;
- Seller forging capability/coverage;
- Seller self-marking MATCHED/DISTRIBUTED;
- matching retry leaking request to newly ineligible Seller;
- admin/support access being confused with tenant access.

ADR should contain sufficient principles for 2.2A–E implementation reviews to enforce these.

# 25. NAMING / DOMAIN SEMANTICS

Check `reverse.*` and “Reverse Marketplace” terminology for collision/confusion with:
- returns/refunds;
- reverse logistics;
- payment reversal.

If repository context makes collision plausible, document terminology rationale. Do not rename without evidence.

# 26. ROADMAP CONSISTENCY

Verify:
- CURRENT CANONICAL EXECUTION SEQUENCE references ADR-0012;
- active item is ADR review;
- 2.2A remains blocked before approval;
- limited-scope rule remains;
- DD-030 gate appears before 2.2F;
- no stale generic “Reverse Marketplace ADR” status contradicts ADR-0012.

# 27. DD MAP CONSISTENCY

Verify DD-030:
- unique ID;
- correct register totals;
- DEFERRED status;
- exact prerequisite before 2.2F;
- no contradiction with older deferred conversion-point wording.

If an older DD already represented the same decision, do not keep duplicates: reconcile documentation.

# 28. ADR CONSEQUENCES

Ensure consequences include both benefits and costs:
- new bounded context/schema;
- new ownership surface;
- extra cross-context contracts;
- privacy/security burden;
- matching/distribution audit requirements;
- eventual Sales conversion mapping;
- migration/operational complexity.

An ADR should not list only benefits.

# 29. IMPLEMENTATION READINESS FOR STEP 2.2A

Before approval, answer:

Can an implementation agent now build Step 2.2A without deciding:
- where capabilities live;
- whether legal country controls coverage;
- whether Product inventory is required;
- whether capabilities are Catalog data;
- whether capability equals entitlement;
- whether Service Templates must be implemented first?

All must be unambiguous.

# 30. REQUIRED REVIEW FIXES

Make only documentation fixes that are directly justified.

Possible examples:
- soften premature taxonomy freeze;
- clarify entitlement authority;
- clarify illustrative funnel;
- add threat-model language;
- add costs/consequences;
- reconcile duplicate DD;
- correct Roadmap status.

Do not implement runtime behavior.

# 31. APPROVAL GATES

Approve only if all pass:

1. reverse.* ownership explicit;
2. ownership matrix non-overlapping;
3. legal location != coverage;
4. capabilities != Product/inventory;
5. 2.2A limited scope safe;
6. BuyerRequest owner clear;
7. matching owner/security clear;
8. Proposal != Quote;
9. Communication remains CML;
10. one Sales/Order pipeline;
11. DD-030 safe and hard-gated;
12. BUYER_REQUEST preserved;
13. entitlement boundary clear;
14. cross-Seller isolation clear;
15. contact disclosure boundary clear;
16. cross-context writes prohibited;
17. reliability principles compatible;
18. IDs not prematurely frozen;
19. Roadmap/DD-map consistent;
20. Step 2.2A implementation-ready.

# 32. IF APPROVED

Documentation-only state transition is allowed:

- ADR-0012: Proposed → Accepted (use repository's canonical ADR status wording);
- Roadmap: ADR Strict Review → APPROVED;
- unique NEXT → Step 2.2A;
- Step 2.2A becomes NEXT, not DONE;
- preserve pairing rule: 2.2A implementation must later stop for separate Strict Review.

Do not begin 2.2A in this pass.

# 33. FINAL REPORT FORMAT

Return exactly:

# REVERSE MARKETPLACE ADR-0012 — STRICT REVIEW — ОТЧЁТ

## 1. Verdict
One of:
`REVERSE MARKETPLACE ADR-0012 STRICT REVIEW COMPLETED — APPROVED`
`REVERSE MARKETPLACE ADR-0012 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
`REVERSE MARKETPLACE ADR-0012 STRICT REVIEW COMPLETED — CHANGES REQUIRED`
`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. ADR status review
## 5. Bounded-context decision
## 6. Ownership matrix
## 7. Legal location vs coverage
## 8. Capability vs inventory
## 9. Limited-scope 2.2A
## 10. BuyerRequest ownership
## 11. Matching / Distribution
## 12. Contact disclosure boundary
## 13. Seller Proposal
## 14. Communication boundary
## 15. Sales convergence
## 16. DD-030 review
## 17. Acquisition source
## 18. Entitlement boundary
## 19. Small-organization compatibility
## 20. Cross-context access
## 21. Events / reliability
## 22. ID strategy
## 23. Rejected alternatives
## 24. Privacy / multi-tenancy threat review
## 25. Naming review
## 26. Roadmap consistency
## 27. Deferred Decisions consistency
## 28. Consequences
## 29. Step 2.2A implementation readiness
## 30. Contradictions found
## 31. Review fixes
## 32. Architecture decision status
## 33. Out-of-scope confirmation
## 34. Exact files changed during review

Final line repeats verdict.

# 34. STOP CONDITION

After Strict Review and permitted documentation fixes:

STOP.

Do NOT implement Step 2.2A.
Do NOT create reverse.* schema/tables/modules.
Do NOT begin 2.2B.

If approved, the canonical unique NEXT becomes:
`PHASE 2 — STEP 2.2A — Seller Commercial Capabilities & Destination Coverage`.

Wait for a separate Step 2.2A implementation prompt.
