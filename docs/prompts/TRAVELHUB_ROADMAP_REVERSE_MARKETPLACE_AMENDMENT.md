# TRAVELHUB — CANONICAL ROADMAP AMENDMENT
## REVERSE MARKETPLACE / BUYER REQUESTS / SELLER COMMERCIAL CAPABILITIES

**Task type:** Canonical Roadmap amendment only  
**Target:** `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`  
**Boundary:** Step 2.4 completed; Step 2.5 NOT started.  
**Implementation:** FORBIDDEN.

## 1. Goal
Update the canonical roadmap to support a second demand path:
- Product-led: Marketplace/Storefront → Product → Sales.
- Request-led: BuyerRequest → matching → Seller proposals → selection → existing Sales.

Do not delete or renumber existing steps. New requirements must use additive A/B/C substeps, consistent with the Master Plan.

## 2. Non-negotiable invariants
1. `Partner legal location ≠ Seller commercial destination coverage`.
2. `Published Products ≠ Seller Commercial Capabilities`.
3. BuyerRequest is demand, not automatically Lead/Opportunity/Quote/Sale/Order/Booking.
4. Matching/delivery does not automatically create Sales entities.
5. `MATCHED ≠ CONTACT DISCLOSED`.
6. Seller proposals/conversations are isolated per Seller.
7. Selected Proposal converges into canonical Sales.
8. Reverse Marketplace must NOT create parallel Checkout/Order/Booking/Payment.
9. Acquisition source is preserved end-to-end.
10. Capability/destination matching is server-authoritative.

## 3. Add Step 2.2A — Seller Commercial Capabilities & Destination Coverage
Add after Step 2.2 without renumbering anything.

Define an independent Seller capability profile covering:
- service categories/types Seller can sell/respond to;
- destinations served;
- accepts Buyer Requests ON/OFF;
- active/lifecycle state as required;
- entitlement/capability eligibility;
- auditability;
- Partner own-scope management and internal management where required.

Country of company registration MUST NOT determine sales coverage.

Initial coverage may be country-level + `WORLDWIDE`, but architecture must permit:
`Country → Region → City/Destination`.

Capabilities must not be inferred only from published Catalog Products.

Service taxonomy must be extensible, e.g. Accommodation/Hotel/Apartment/Villa; Tours/Packages; Transport/Transfer/Car Rental; Activities/Excursion/Guide. Do not hardcode cross-category exceptions. Seller should explicitly declare which Buyer Request service types it can answer.

## 4. Add Step 2.2B — Buyer Request / Reverse Marketplace Foundation
Introduce canonical buyer-demand concept, working name `BuyerRequest`, working prefix `BRQ-*` subject to ID-registry verification.

BuyerRequest may contain category-dependent:
- service type/category;
- destination;
- dates/range/flexibility;
- travelers;
- budget/currency;
- preferences/requirements;
- safe free-form requirements;
- lifecycle/timestamps;
- buyer own-scope;
- privacy;
- audit/history;
- source/acquisition context.

Do not freeze exact lifecycle enum in this amendment.

BuyerRequest is NOT Lead, Opportunity, Quote, Sale, Order, Booking, or Communication.

## 5. Privacy invariant
A matched Seller may receive commercially necessary request facts, but matching/distribution must not automatically disclose phone, email, WhatsApp, passport data, raw CRM Customer data, or unnecessary PII. Existing anti-disintermediation rules remain authoritative.

## 6. Add Step 2.2C — Buyer Request Matching & Distribution
Baseline conceptual eligibility:
`active/approved Seller`
AND `eligible to receive Buyer Requests`
AND `service capability matches`
AND `destination coverage matches`
AND `required entitlement/capability permits participation`.

Buyer location and Seller legal country are NOT authoritative destination-matching criteria.

Example: Buyer in Azerbaijan requests HOTEL / Antalya / Turkey. Eligible Seller may be legally located in Azerbaijan, Turkey, UAE, Georgia, Germany, etc., if capability/coverage matches.

Distribution must be auditable. Ranking/SLA/rating/AI may be future work.

## 7. Distribution ≠ Lead creation
Example:
`1 BuyerRequest → 70 matched → 25 delivered → 6 responses`
must NOT automatically create 70 or 25 Leads.

Defer the exact meaningful-engagement conversion point to the Proposal→Sales architecture step. It must reconcile Lead vs Opportunity vs other existing Sales stage rather than invent a duplicate model.

## 8. Add Step 2.2D — Seller Proposal Foundation
One BuyerRequest may receive `0..N` Seller-specific proposals.

Proposal is a competitive/pre-commercial response and is NOT automatically canonical Quote.

It may later contain offered configuration, dates, description, amount/currency, inclusions/exclusions, validity, conditions, notes, structured service details.

Strict isolation:
- Seller A cannot see Seller B proposal/price/conversation;
- Buyer sees only proposals belonging to own request;
- internal access follows permissions.

Do not create a second Quote engine.

## 9. Add Step 2.2E — Buyer Request / Proposal Communication
Reuse existing `Communication = CML-*`; do NOT create a second messaging domain.

Context concept:
`BuyerRequest + Buyer + Seller [+ Proposal]`.

A Buyer may have independent conversations with several Sellers for the same request. Enforce Buyer own-scope, Partner own-scope, participant/context consistency, neutral IDOR behavior, anti-disintermediation, audit/history, cross-Seller isolation, and future attachments/notifications compatibility.

Amend Step 3.37A so Chat Completion supports BuyerRequest/Proposal as well as Order/Booking contexts. Step 3.37B anti-disintermediation must apply to pre-sale request chat too.

## 10. Add Step 2.2F — Proposal → Canonical Sales Conversion
When Buyer selects a proposal, DO NOT create BuyerRequestOrder, ProposalOrder, ReverseMarketplaceOrder, separate Checkout, Payment, or Booking.

Target:
`BuyerRequest → Matching → Proposal → Buyer selection → existing Sales Opportunity/Quote → Checkout → Sale → OrderRequested → Order → Booking → Finance`.

The implementation step must reconcile whether conversion begins at Lead, Opportunity, Quote, or another already-existing Sales stage.

Canonical rule:
**Reverse Marketplace is another commercial acquisition path, not another transaction system.**

## 11. Amend Step 2.5B — Acquisition Channel
Add working acquisition/source value `BUYER_REQUEST` (final naming must be reconciled with current conventions).

It must propagate immutably where applicable:
`BuyerRequest/Proposal → Quote/Sale → Order → Booking → Payment → Settlement → Analytics`.

Publication channel remains distinct from acquisition channel.

## 12. Partner onboarding/cabinet
Amend roadmap so onboarding may initially capture:
- services sold;
- countries/destinations served;
- accepts Buyer Requests.

These remain editable after registration. Registration country is never reused as coverage. Detailed management belongs in Partner Cabinet.

Amend Step 3.29 Partner Cabinet Full to include:
- Commercial Capabilities;
- Destination Coverage;
- Buyer Request Inbox;
- Seller Proposals;
- request-related communications.

Keep capability/permission-driven access compatible with small organizations where one employee may perform several functions.

## 13. Buyer Cabinet
Amend Step 3.30 Buyer Cabinet Full with:
- My Requests;
- request lifecycle/status;
- Received Proposals;
- selected proposal;
- request-related conversations.

Strict BUYER own-scope.

## 14. Admin/platform management
Roadmap must account for future management of:
- service capability taxonomy;
- destination/reference taxonomy;
- eligibility/moderation;
- entitlement rules for receiving Buyer Requests.

Do not hardcode commercial prices/plans or rely solely on fixed role names.

## 15. Analytics readiness
Require reconstructable request-led funnel from canonical facts/events/timestamps:
`BuyerRequestCreated → Matched → Delivered → SellerResponded → ProposalViewed → ProposalSelected → Quote → Checkout → Sale → Order`.

Do not finalize all event names now unless justified by real facts/consumers.

Amend Phase 3 analytics so Product-led Marketplace, Storefront, Buyer Request, Direct/Manual, future Custom Domain/API can be compared.

Future metrics may include request count, matching/delivery rate, seller response rate, time-to-first-proposal, proposals/request, selection rate, Request→Quote/Sale/Order conversion.

## 16. Future Reverse Marketplace E2E
Add an additive `3.46X` substep (do not renumber existing steps) proving:
`BUYER → BuyerRequest → matching → multiple isolated Seller proposals → contextual communication → selection → canonical Sales → Quote → Checkout → Sale → OrderRequested → Order → Booking → Payment/Documents → Fulfillment`.

Also prove:
- legal country does not determine destination eligibility;
- capability/coverage does;
- unmatched Seller cannot access request;
- Seller A cannot access Seller B proposal/conversation;
- Buyer PII is not disclosed merely by matching;
- no duplicate transaction pipeline exists.

## 17. Cross-cutting section
Add a Reverse Marketplace / Commercial Capabilities subsection containing all non-negotiable invariants above, including editable/auditable capabilities, server-authoritative matching, acquisition propagation, and taxonomy extensibility.

## 18. Dependency analysis
Current state:
- 2.1 completed
- 2.2 completed
- 2.3 completed
- 2.3A completed
- 2.3B completed
- 2.4 completed
- **2.5 NOT started**

Do NOT infer implementation order from numbering alone.

2.2A–2.2F are logically upstream acquisition/Sales capabilities. Step 2.5 is downstream completion of an already active `OrderRequested` flow.

Unless a real hard dependency is discovered, preserve the ability to execute Step 2.5 before implementing Reverse Marketplace.

Document this explicitly.

## 19. Consistency review
After editing, reconcile against at least:
1.10, 1.11, 1.16, 2.1, 2.2, 2.3, 2.3A, 2.3B, 2.4, 2.5, 2.5B, 2.16, 3.3, 3.5, 3.7, 3.12, 3.29, 3.30, 3.37A/B, 3.46, and cross-cutting Security/Ownership, Traceability, Analytics, Publication vs Acquisition.

Check duplicate ownership, contradictions, PII leakage, IDOR, and accidental parallel commercial pipelines.

## 20. Ownership report required
Report ownership for:
- Partner identity;
- Seller Commercial Capabilities;
- Catalog Product;
- BuyerRequest;
- matching/distribution;
- Seller Proposal;
- Communication;
- Sales Quote/Sale;
- Order;
- Booking;
- Finance.

If ownership cannot safely be derived, return `ARCHITECTURE DECISION REQUIRED` rather than inventing it.

## 21. DO NOT IMPLEMENT
Do not modify Prisma/schema/migrations/backend/frontend/controllers/services/DTOs/events/permissions/tests. Do not implement BuyerRequest, capabilities, matching, proposals, chat, analytics. Do not start Step 2.5. This task edits canonical planning/documentation only.

## 22. Required report
Return:
1. Verdict
2. Baseline
3. Changes made
4. Final summaries of 2.2A–2.2F
5. Existing steps amended
6. Canonical invariants
7. Ownership map
8. Dependency analysis and explicit answer whether 2.5 can proceed first
9. Deferred decisions (lifecycle enums, final IDs, taxonomy, destination hierarchy, ranking, Proposal→Sales conversion point, entitlements, contact disclosure stage)
10. Out-of-scope confirmation
11. Exact files changed

Verdict line:
`CANONICAL ROADMAP REVERSE MARKETPLACE AMENDMENT COMPLETED — WAITING FOR STRICT REVIEW`

## 23. STOP CONDITION
After roadmap edit and report, STOP. Do not begin Step 2.2A, Step 2.5, Reverse Marketplace implementation, schema work, or UI work. Wait for separate STRICT REVIEW.
