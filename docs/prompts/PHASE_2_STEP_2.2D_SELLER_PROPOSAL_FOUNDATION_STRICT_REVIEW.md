# PHASE 2 — STEP 2.2D — SELLER PROPOSAL FOUNDATION — STRICT REVIEW

**Project:** TravelHub
**Phase:** 2
**Step:** 2.2D
**Mode:** STRICT REVIEW ONLY
**Canonical owner:** Reverse Marketplace (`reverse.*`)
**Implementation status:** `PHASE 2 STEP 2.2D IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
**Next only if APPROVED:** Step 2.2E — Buyer Request / Proposal Communication

## 1. Mission

Perform an independent, adversarial STRICT REVIEW of Step 2.2D. Do not approve from the implementation report alone. Inspect actual schema, migration, services/controllers, permissions, seller/buyer scope, distribution prerequisite, lifecycle, money, anti-disintermediation, concurrency, tests, documentation, ADR/DD compliance and Roadmap.

Final verdict:
- `PHASE 2 STEP 2.2D STRICT REVIEW COMPLETED — APPROVED`
- `PHASE 2 STEP 2.2D STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 2 STEP 2.2D STRICT REVIEW COMPLETED — CHANGES REQUIRED`
- `ARCHITECTURE DECISION REQUIRED`

## 2. Execution gate

Sequence: `2.2D implementation → 2.2D STRICT REVIEW → APPROVED → 2.2E`.

Do not start 2.2E, chat/contact disclosure, 2.2F conversion, Service Templates or Universal Pricing. If approved, update Roadmap, set 2.2E as unique NEXT and STOP.

## 3. Baseline

Inspect branch/HEAD, git status/diff/log, migration status, dirty 2.2C review fixes vs 2.2D changes, package-lock diff and commit state. Separate pre-existing changes, 2.2D implementation and review fixes. Do not rewrite unrelated files.

## 4. Canonical sources

Read latest Roadmap + CURRENT CANONICAL EXECUTION SEQUENCE; ADR-0012/0001/0007/0011; Deferred Decisions Map + DD-030; Step 2.2A/B/C implementations and reviews; reverse-seller-proposals.md; ids.md; schema; migration `20260811090154_add_reverse_seller_proposals`; proposal service/controller/validation; permissions; field-validation; BuyerRequest; Distribution; SellerCapability; CRM Partner; Catalog Category; Sales Quote/Checkout/Sale; AuditLog; EventBus/outbox; 2.2D tests.

Roadmap/accepted ADRs are authoritative.

## 5. Ownership — hard gate

Verify `SellerProposal → reverse.*`. No writes to Sales, Catalog, CRM, Communication, Order or Booking. Cross-context reads only under ADR-0001. Any cross-context write is a hard failure.

## 6. Proposal semantics

Proposal is a Seller commercial response to Buyer demand, not Product, Sales Quote, Opportunity, Sale, Checkout, Order or Communication thread.

## 7. Proposal ≠ Sales Quote — hard gate

Prove no `sales.Quote`, QuoteItem, Checkout or Sale is created. Proposal amount is non-binding; Proposal validity is not Sales Quote expiry; submit does not call Sales.

## 8. Distribution prerequisite

Seller may create only if canonical distribution exists for that authenticated Seller and request. Foreign/missing/forged distribution must fail neutrally. Seller cannot propose on arbitrary BuyerRequest ID.

## 9. Seller own-scope / IDOR

Verify list/get/history/update/submit/withdraw are scoped by server-derived `actor.partnerId`. Seller A cannot access Seller B via UUID, PRP code, request ID or distribution ID.

## 10. Buyer own-scope

Buyer may read only submitted/visible Proposals for BuyerRequests owned by that Buyer. Cross-Buyer access denied. DRAFT hidden if that is current policy. Buyer mutation forbidden unless Roadmap says otherwise.

## 11. Cardinality / uniqueness

Verify one canonical Proposal per `(buyerRequestId,sellerId)`, controlled 409 on duplicate and concurrent create, but multiple Sellers can each create proposals for the same BuyerRequest.

## 12. Lifecycle

Review actual lifecycle, reportedly `DRAFT → SUBMITTED → WITHDRAWN`. Verify valid/invalid transitions, repeat submit/withdraw no-op semantics, milestones, update-in-DRAFT only, and absence of ACCEPTED/SELECTED/CONVERTED states.

## 13. BuyerRequest state gate

DRAFT/CANCELLED requests must reject new Proposal. Existing Proposal after request cancellation is retained historically and further submit/update semantics are explicit and safe.

## 14. Request cancel vs Proposal submit — critical concurrency

Use controlled interleavings. Determine whether Proposal can commit SUBMITTED after BuyerRequest cancellation already committed. READ COMMITTED documentation alone is not enough if impossible state can occur. Fix locally if needed; architecture decision only if canonical consistency contract is unresolved.

## 15. Money / Decimal

Verify Decimal(12,2), max `9_999_999_999.99`, currency validation, exact serialization, negative/overflow/extra-decimal behavior, zero semantics, null semantics and no JS-float authority.

## 16. Price on Request

`amount = NULL` must mean no numeric price, not zero. API/list/detail/lifecycle must preserve this honestly.

## 17. Non-binding authority

Search for any use of Proposal amount to populate Quote/Checkout/Sale/Payment/reservation. There must be none.

## 18. Buyer budget

BuyerRequest budget is hint only. Proposal above budget is allowed unless Roadmap says otherwise; budget cannot become Proposal default or validation authority.

## 19. Validity

Review `validUntil` as reverse-owned date-only hint. No accidental Sales Quote expiry semantics or hidden lifecycle effect.

## 20. Content validation

Review all seller-supplied text for length, plain-text semantics, XSS/script, control chars, whitespace/null clearing, oversized input and injection-safe serialization.

## 21. Anti-disintermediation — critical

Aggressively test contact bypasses: normal/obfuscated email, phone with spaces/dashes, `wa.me`, Telegram/social handles, bare domains, URLs without protocol, multiline/Unicode variants. Documentation must not claim full DLP if regex-only.

## 22. ISO-date false positive

Verify phone-regex date exclusion is narrow: legitimate ISO dates pass, real phone-like values still fail, and exception does not open a bypass.

## 23. Contact disclosure boundary

`PROPOSAL EXISTS/SUBMITTED ≠ CONTACT DISCLOSED`. No Buyer contact in Seller projection, no private Seller contact in Buyer projection, no disclosure state or auto-communication.

## 24. Seller projection

Must not expose Buyer PII, other Seller data, hidden audit/security fields or future Sales refs. Safe BuyerRequest context only.

## 25. Buyer projection / Seller identity — critical

Review exposure of raw `sellerId`. Determine whether Buyer should receive internal Partner UUID or canonical public seller identity/profile reference. Inspect ADR-0005/PublicSellerProfile. If raw internal identity violates API boundary, fix projection. Do not expose legal/private Partner data.

## 26. RBAC

Review `reverse.proposal.read_own` for PARTNER and BUYER own-request and `write_own` for PARTNER. Ensure service enforces actor-specific scope; permission alone must not broaden access. Review ADMIN ALL behavior deliberately.

## 27. Mass assignment

Reject forged id/code/seller/partner/buyer/request/distribution/status/version/createdBy/lifecycle timestamps/accepted-selected-converted/quoteId/saleId/contactDisclosed/acquisitionSource/timestamps/actor/correlation fields. Lifecycle commands must loudly reject unexpected mutable fields where repo policy requires it.

## 28. CAS / concurrency

Verify atomic expectedVersion CAS, one version increment, stale 409, loser no history/audit, deterministic update/update, submit/update, withdraw/submit, repeat submit, and final state assertions.

## 29. Clearing semantics

Review null/empty/whitespace semantics for description/notes/amount/validUntil. Avoid ambiguous null vs empty persistence.

## 30. Duplicate P2002 handling

Map only the intended unique constraint to duplicate Proposal 409. Do not swallow unrelated P2002 as duplicate Proposal.

## 31. History / audit

Verify created/updated/submitted/withdrawn history, actor/from-to/fields, no PII, no failed/no-op duplicate facts, and success-only AuditLog.

## 32. Events / outbox

Verify no Proposal events/outbox if intentionally absent. Assess whether 2.2E/2.2F can read canonical state directly without requiring unsafe coupling. Do not invent speculative events.

## 33. Communication isolation

Proposal operations create zero CML/chat/message/thread. 2.2E owns communication.

## 34. Sales isolation

Proposal operations create zero Lead/Opportunity/Quote/Checkout/Sale/OrderRequested/Order/Booking/Payment. DD-030 remains deferred.

## 35. DD-030 compatibility

Proposal schema must not prematurely freeze `leadId/opportunityId/quoteId/saleId` conversion target. Prefer no target until DD-030 is resolved before 2.2F.

## 36. Acquisition source

Proposal cannot override source. Future 2.2F must preserve `BUYER_REQUEST`; no downstream write now.

## 37. Catalog / Pricing isolation

No Product/Tariff/Availability/Reservation, period pricing, RatePlan or Pricing Engine writes. Proposal amount remains reverse-owned indication only.

## 38. Reverse schema scope

Expected reverse models after 2.2D: SellerCapability+history, BuyerRequest+history, BuyerRequestDistribution, SellerProposal+history. No ProposalSelection/Conversation/ContactDisclosure/MatchScore/Sales mirror/Quote mirror/Order mirror.

## 39. Migration

Inspect SQL: additive, reverse-owned, correct Decimal/enums/unique/indexes, only intended intra-schema FK, no cross-schema FK, clean replay, drift 0, no db push.

## 40. PRP ID

Verify PRP registered once, atomic IdsService, DB unique, no client authority.

## 41. Indexes / pagination

Review Seller own list, BuyerRequest proposal list, seller+request unique, status indexes, deterministic order/tie-breaker, bounded limits, own-scope totals and no DRAFT/competitor leakage.

## 42. Failure atomicity

Failed create/update/submit/withdraw/duplicate/foreign access/request-status/money/contact validation leaves no partial Proposal/version/history/audit/outbox/Sales/Communication/Catalog side effect.

## 43. Test quality / shared-DB hygiene

Inspect 2.2D tests and four updated legacy reverse-table assertions. Avoid global counts, global deletes, random-order assumptions or leaked proposal/history/audit data. Review `package-lock.json`: keep only if dependency-state change is intentional; revert if npm-install noise.

## 44. Required targeted review proof

Confirm or add meaningful proof for:
1. anonymous denied;
2. BUYER cannot create Proposal;
3. unmatched Seller denied;
4. distributed Seller create;
5. foreign distribution denied;
6. Seller A cannot use Seller B distribution;
7. DRAFT request rejects;
8. CANCELLED request rejects;
9. one Proposal per seller/request;
10. concurrent duplicate create;
11. different Sellers get separate Proposals;
12. Seller own list/get;
13. cross-Seller 404;
14. Buyer own-request list/detail;
15. cross-Buyer denied;
16. DRAFT hidden from Buyer;
17. raw Seller identity boundary;
18. Decimal min/max/precision;
19. overflow pre-DB rejection;
20. NULL Price on Request;
21. zero amount semantics;
22. no FX;
23. budget non-binding;
24. validity semantics;
25. XSS/plain-text safety;
26. email bypasses;
27. phone bypasses;
28. URL/social bypasses;
29. ISO-date false-positive regression;
30. no contact disclosure;
31. Seller projection no Buyer PII;
32. Buyer projection no private Partner data;
33. mass-assignment;
34. DRAFT update;
35. clear-field semantics;
36. submit;
37. withdraw;
38. repeat submit no duplicate milestone;
39. invalid lifecycle;
40. stale CAS;
41. update/update final state;
42. submit/update final state;
43. withdraw/submit final state;
44. request-cancel vs submit controlled race;
45. history;
46. audit;
47. zero Proposal outbox events;
48. no Communication;
49. no Sales/Order/Booking;
50. no Catalog/Pricing mutation;
51. source not forgeable;
52. migration replay/drift;
53. pagination/determinism;
54. legacy reverse-table assertions meaningful.

One test may prove multiple invariants.

## 45. Review-fix policy

Local 2.2D defects may be fixed. For each: root cause, minimal safe change, regression proof, full regression. Do not start 2.2E.

Return `ARCHITECTURE DECISION REQUIRED` only if review needs a decision on binding Proposal authority, DD-030 target, contact-disclosure policy, seller public-identity ownership, Communication ownership, new Pricing Engine/Service Templates, parallel Sales/Order pipeline or cross-context writes.

## 46. Full regression

Run actual current results:

Backend:
- tsc;
- unit;
- Step 2.2D targeted E2E;
- Step 2.2C/B/A regressions;
- Step 2.5B acquisition;
- relevant RBAC/privacy/Sales isolation;
- full serial E2E.

Frontend:
- tsc;
- vitest;
- production build.

DB:
- migrate status;
- clean replay;
- drift.

Report exact counts.

## 47. Roadmap update

Before approval: 2.2D waiting Strict Review; 2.2E blocked.

If approved:
- mark 2.2D `STRICT REVIEW COMPLETED — APPROVED` or `APPROVED WITH REVIEW FIXES`;
- set exact NEXT to `PHASE 2 — STEP 2.2E — BUYER REQUEST / PROPOSAL COMMUNICATION`;
- do not start 2.2E.

## 48. Approval criteria

Approve only if ownership, Proposal≠Quote, non-binding money, distribution prerequisite, Seller/Buyer scope, cross-Seller isolation, cardinality, lifecycle, cancel-submit consistency, Decimal bounds, Price on Request, anti-disintermediation, contact-disclosure boundary, safe projections, RBAC/mass-assignment, CAS, history/audit, no Communication, no Sales conversion, DD-030 preservation, no Catalog/Pricing mutation, migration and regression all pass.

## 49. Required final report

Return:

# PHASE 2 — STEP 2.2D — SELLER PROPOSAL FOUNDATION — STRICT REVIEW — ОТЧЁТ

## 1. Verdict
## 2. Repository baseline
## 3. Sources inspected
## 4. ADR-0012 ownership
## 5. Proposal domain semantics
## 6. Proposal vs Sales Quote
## 7. Distribution prerequisite
## 8. Seller own-scope
## 9. Buyer own-scope
## 10. Cross-Seller isolation
## 11. Cardinality / uniqueness
## 12. Lifecycle
## 13. BuyerRequest status gate
## 14. Request cancel vs submit concurrency
## 15. Money / Decimal
## 16. Price on Request
## 17. Non-binding authority
## 18. Buyer budget relation
## 19. Validity semantics
## 20. Content validation
## 21. Anti-disintermediation
## 22. Contact disclosure boundary
## 23. Seller projection
## 24. Buyer projection / Seller identity
## 25. RBAC
## 26. Mass assignment
## 27. CAS / concurrency
## 28. Field clearing semantics
## 29. Duplicate create handling
## 30. History / audit
## 31. Events / outbox
## 32. Communication isolation
## 33. Sales isolation
## 34. DD-030 compatibility
## 35. Acquisition source
## 36. Catalog / Pricing isolation
## 37. Reverse schema scope
## 38. Migration
## 39. PRP ID strategy
## 40. Indexes / pagination
## 41. Failure atomicity
## 42. Test quality / shared-DB hygiene
## 43. Review fixes
## 44. Regression results
## 45. Documentation / Roadmap
## 46. Deferred decisions
## 47. Architecture decision status
## 48. Exact files changed during review
## 49. Out-of-scope confirmation
## 50. Exact NEXT item

If approved, Exact NEXT:

`PHASE 2 — STEP 2.2E — BUYER REQUEST / PROPOSAL COMMUNICATION`

Final line repeats verdict.

## 50. Stop condition

After Strict Review STOP.

If approved, update Roadmap, set 2.2E as NEXT, but do not implement 2.2E.

Do not implement chat/contact disclosure, Proposal→Sales conversion, Service Templates or Universal Pricing. Wait for separate Step 2.2E implementation prompt.
