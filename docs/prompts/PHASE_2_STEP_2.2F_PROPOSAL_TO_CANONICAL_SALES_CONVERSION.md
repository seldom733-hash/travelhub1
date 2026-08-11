# PHASE 2 — STEP 2.2F — PROPOSAL → CANONICAL SALES CONVERSION

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.2F  
**Mode:** IMPLEMENTATION  
**Canonical owners:** Reverse Marketplace (`reverse.*`) + Sales (`sales.*`)  
**Prerequisites:**  
- Step 2.2E STRICT REVIEW `APPROVED WITH REVIEW FIXES`  
- DD-030 `DECIDED` — canonical conversion target = **Opportunity (`OPP-*`)**  
**Next after completion:** STOP and wait for separate STRICT REVIEW

---

# 1. MISSION

Implement the canonical conversion from a selected Reverse Marketplace SellerProposal into the existing Sales pipeline.

The approved DD-030 path is:

`BuyerRequest`
→ `selected SellerProposal`
→ `Opportunity`
→ `Quote`
→ `CheckoutIntent`
→ `Sale`
→ `OrderRequested`
→ `Order`
→ `Booking`
→ `Finance`

The Step 2.2F implementation must create the **first canonical Sales-owned object: Opportunity**.

Do NOT skip directly to Quote.

Do NOT create a parallel Reverse Marketplace commerce pipeline.

Hard invariants:

- `SellerProposal → reverse.*`
- selection fact → `reverse.*`
- `Opportunity → sales.*`
- Proposal amount is NON-BINDING
- canonical binding commercial authority begins later in Sales Quote
- `BUYER_REQUEST` acquisition source must propagate
- one selected Proposal → at most one canonical Sales path
- no cross-domain direct Prisma writes
- no contact disclosure side effect
- no BuyerRequestOrder / ProposalOrder / ReverseQuote / ReverseCheckout / ReverseSale / ReverseBooking

---

# 2. CANONICAL SOURCES — READ FIRST

Before changing code inspect the latest repository truth:

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- `CURRENT CANONICAL_EXECUTION_SEQUENCE`
- `TRAVELHUB_DEFERRED_DECISIONS_MAP.md`
- DD-030 decision
- ADR-0012
- ADR-0001
- ADR-0007
- ADR-0009
- ADR-0011
- Steps 2.2A–2.2E implementation + Strict Review
- current `reverse.*` schema
- BuyerRequest
- BuyerRequestDistribution
- SellerProposal
- pre-sale Communication
- current Sales:
  - Lead
  - Opportunity
  - Quote
  - QuoteItem
  - CheckoutIntent
  - Sale
  - SalesService
  - Sales controllers
  - acquisitionSource handling
  - sales history/audit/events
- Step 2.5B acquisition propagation
- ID contracts
- permissions/RBAC
- field validation
- existing owner-service transaction patterns
- Step 2.4 Sales→Catalog owner-service transaction precedent

If this prompt conflicts with the accepted DD-030/Roadmap/ADR, the accepted canonical source wins.

---

# 3. DO NOT RE-DECIDE DD-030

DD-030 is already resolved.

Chosen target:

`Opportunity (OPP-*, sales.*)`

Do NOT:
- redirect conversion to Lead;
- redirect conversion directly to Quote;
- reopen DD-030;
- introduce a new conversion target.

If repository implementation has materially changed since DD-030 and makes the decision impossible, STOP with:

`ARCHITECTURE DECISION REQUIRED`

and explain the contradiction.

Otherwise implement Opportunity target exactly.

---

# 4. CURRENT → TARGET

## Current

Reverse path:

`BuyerRequest`
→ Matching/Distribution
→ SellerProposal
→ pre-sale Communication

No Sales entity is created.

## Target

Buyer selects one eligible SellerProposal.

Then:

1. Reverse records the canonical selection/conversion state.
2. Sales owner creates exactly one canonical Opportunity.
3. Opportunity stores immutable/provenance refs required by DD-030.
4. Acquisition source is `BUYER_REQUEST`.
5. Proposal remains Reverse-owned and non-binding.
6. No Quote is created automatically unless Roadmap explicitly assigns a later sub-action inside 2.2F after Opportunity creation. Default: Opportunity only.

The implementation pass must not silently collapse Opportunity→Quote into one step unless Roadmap explicitly requires it.

---

# 5. SELECTION OWNERSHIP — HARD GATE

Proposal selection is a `reverse.*` business fact.

Buyer selects a SellerProposal belonging to the BuyerRequest owned by that Buyer.

Reverse must own:

- selected Proposal reference/state;
- selection timestamp;
- conversion reference/status as needed;
- version/CAS;
- history/audit if canonical.

Sales must NOT directly mutate reverse tables.

Reverse must NOT directly write sales tables.

Use owner services / application orchestration consistent with ADR-0001.

---

# 6. OPPORTUNITY OWNERSHIP

Opportunity belongs to `sales.*`.

Sales owner service must create it.

Reverse may invoke a trusted Sales owner method.

Do not use Prisma directly from Reverse to insert into `sales.Opportunity`.

No hidden cross-domain writer.

---

# 7. ATOMIC OWNER-SERVICE ORCHESTRATION

DD-030 selected a single atomic owner-service transaction if repository architecture supports it.

Preferred implementation:

`Reverse selection command`
→ one DB transaction
→ validate Reverse state
→ mark selected
→ call Sales owner method with same transaction/context
→ create Opportunity
→ write Reverse/Sales history/audit as owner services
→ commit

If shared transaction context is not currently possible safely, use an idempotent staged approach only if it preserves:

- no selected-without-conversion corruption;
- no conversion-without-selection ambiguity;
- retry safety;
- one Proposal → one Opportunity.

Do not invent distributed-system machinery unnecessarily.

---

# 8. BUYER AUTHORITY

Only the Buyer who owns BuyerRequest may select/convert a Proposal.

Server-derived authority:

`actor.customerId == buyerRequest.buyerId`

Client must not choose:
- buyerId;
- customerId;
- ownerId.

Cross-Buyer selection → neutral denial according to current anti-enumeration conventions.

---

# 9. PROPOSAL ELIGIBILITY

Selected Proposal must:

- exist;
- belong to the BuyerRequest;
- belong to a Seller that had canonical Distribution;
- be in eligible lifecycle state;
- normally be `SUBMITTED`;
- not be `WITHDRAWN`;
- not belong to another BuyerRequest;
- not belong to another Seller context.

No forged Proposal ID may bypass.

---

# 10. BUYERREQUEST ELIGIBILITY

BuyerRequest must be in a conversion-eligible state.

At minimum:

- DRAFT → reject
- CANCELLED → reject
- SUBMITTED → eligible

If existing lifecycle has future selected/converted state after Step 2.2F, implement only what Roadmap now requires.

Do not invent extra lifecycle states unnecessarily.

---

# 11. ONE WINNER PER BUYERREQUEST

Required invariant:

A BuyerRequest may have N Proposals, but only one canonical commercial path may be selected/converted at a time.

Implement a DB/domain invariant that prevents:

- Proposal A and B both becoming selected concurrently;
- two Opportunities from two different Proposals for the same BuyerRequest unless Roadmap explicitly supports reselection before conversion.

DD-030 says:

`one selected Proposal → one canonical Sales path`

and concurrent A/B selection must yield one winner.

Use DB uniqueness/CAS, not in-memory logic only.

---

# 12. ONE OPPORTUNITY PER PROPOSAL

Add a canonical provenance link that enforces:

`selected Proposal → at most one Opportunity`

Likely implementation implication from DD-030:

Opportunity stores unique `proposalId` reference/snapshot ID.

Because ADR-0001 may prohibit cross-schema FK, use a trusted ref without cross-schema FK if that is the project convention.

DB uniqueness should protect duplicate conversion.

Do not rely only on service-level checks.

---

# 13. PROVENANCE ON OPPORTUNITY

DD-030 requires Sales provenance sufficient to answer:

- originating BuyerRequest;
- selected Proposal;
- selected Seller;
- acquisition source;
- correlation/causation.

Review current Opportunity schema.

Add minimum necessary additive fields, likely conceptual refs:

- buyerRequestId;
- proposalId;
- sellerId / partnerId;
- acquisitionSource;
- perhaps preSaleThreadId only if Roadmap explicitly requires it;
- conversion/request lineage if canonical.

Do not copy full BuyerRequest/Proposal snapshots unnecessarily.

Do not add cross-schema FKs if prohibited.

---

# 14. LEAD MUST REMAIN NULL / OPTIONAL

DD-030 explicitly rejected Lead.

Opportunity must be created without creating Lead.

Expected:

`Opportunity.leadId = null`

unless current Opportunity implementation handles this differently but still preserves no Lead creation.

Add an E2E proof:

- 0 new Lead rows
- 1 new Opportunity row

---

# 15. OPPORTUNITY CUSTOMER

BuyerRequest.buyerId / CRM Customer must map to canonical `Opportunity.customerId`.

Use trusted server-side mapping.

Client cannot choose a different customer.

No Buyer PII disclosure is required.

---

# 16. OPPORTUNITY SELLER / OWNER

Selected Seller must be represented using canonical Sales ownership semantics.

Do not use PublicSellerProfile as commercial authority.

Resolve from:

- Proposal.sellerId / partnerId
- canonical Partner identity

Then map to Opportunity ownership fields according to existing Sales model.

If Opportunity currently lacks an explicit Partner/seller dimension, implement only the minimum additive provenance field required by DD-030.

Do not misuse `assignedToId` if it means internal staff owner rather than Seller.

This distinction must be verified carefully.

---

# 17. TITLE / DESCRIPTION SEED

Opportunity may receive a generated server-owned title/context derived from:

- BuyerRequest code/category;
- Seller public/business-safe identity if appropriate;
- Proposal code.

Do not trust client title as commercial authority.

Proposal text may be used only as non-binding context/seed.

Preserve anti-disintermediation/privacy boundaries.

---

# 18. PROPOSAL AMOUNT — NON-BINDING

Hard invariant:

Proposal amount/currency MUST NOT become:

- Opportunity authoritative price;
- Quote price;
- Checkout total;
- Sale amount.

If stored on Opportunity at all, store only as clearly named negotiation/proposal hint/snapshot.

Do not reuse generic `amount` field if that would imply canonical deal value unless Roadmap explicitly defines it as non-binding estimate.

Prefer explicit provenance/hint semantics.

---

# 19. QUOTE MUST NOT BE AUTO-CREATED UNLESS CANONICAL

DD-030 selected:

`Proposal → Opportunity → Quote`

Step 2.2F primary target is Opportunity.

Do not auto-create Quote merely because Opportunity was created unless the canonical Roadmap now explicitly includes that behavior inside 2.2F.

Default safe behavior:

- Opportunity created in `NEW`
- Quote remains zero rows
- later Sales workflow creates canonical Quote

Add E2E assertion for no Quote side effect if this remains the canonical Step 2.2F scope.

---

# 20. PRODUCT/TARIFF GAP

DD-030 established:

- Opportunity can exist without Product/Tariff;
- Quote requires canonical Product/Tariff.

Therefore conversion must succeed even where selected Proposal has no published Product.

Do NOT:
- fabricate Product;
- fabricate Tariff;
- create shadow pricing;
- create ReverseQuote.

Document that Quote creation remains dependent on canonical Catalog/Product/Tariff prerequisites.

---

# 21. ACQUISITION SOURCE

Hard invariant:

`acquisitionSource = BUYER_REQUEST`

must be server-derived.

Client cannot choose source.

Opportunity must store/propagate source according to DD-030.

Then later Quote/Checkout/Sale must preserve it.

---

# 22. CHECKOUT DIRECT HARDCODE GAP — CRITICAL

DD-030 identified an existing gap:

CheckoutIntent creation currently derives/forces `DIRECT`.

Step 2.2F must inspect the actual current code and determine the minimum canonical fix so request-led path can preserve `BUYER_REQUEST`.

Do NOT broadly redesign acquisition.

Required behavior:

- normal direct Checkout flow remains DIRECT;
- Reverse Marketplace derived flow becomes BUYER_REQUEST;
- client cannot forge source;
- source comes from trusted upstream Sales context;
- Quote/Opportunity provenance determines server-side source.

If Checkout creation currently has no safe upstream path for source, implement the smallest owner-correct extension necessary.

Do not add publication channel logic.

---

# 23. QUOTE ACQUISITION SOURCE

Inspect whether Quote currently stores acquisitionSource.

If it does:
- populate from Opportunity.

If it does not:
- determine minimum safe propagation design required so Checkout can derive BUYER_REQUEST server-side without client authority.

Possible implementation:
- Quote stores acquisitionSource;
or
- Checkout derives via Opportunity relation.

Choose based on existing schema/lifecycle.

Do not invent a duplicate Acquisition entity.

Document exact propagation chain.

---

# 24. SALE / ORDER / BOOKING PROPAGATION

Verify existing downstream path already preserves acquisition source.

DD-030 says Order/Booking propagation is already prepared by Step 2.5B.

Add targeted regression proving Reverse path source would not be lost once Sales advances.

Do not implement unrelated Payment/Settlement/Analytics work.

---

# 25. CONTACT DISCLOSURE

Conversion must NOT change disclosure state.

No Buyer phone/email exposed.

No Seller private contact exposed.

No ContactDisclosure entity/state unless already canonical.

`MATCHED ≠ CONTACT DISCLOSED`
`CHAT EXISTS ≠ CONTACT DISCLOSED`
`CONVERTED ≠ CONTACT DISCLOSED`

unless a later approved policy says otherwise.

---

# 26. COMMUNICATION CONTINUITY

Pre-sale CML thread remains in `communication.*`.

No message migration.

No Sales-owned chat.

If Opportunity stores threadId as provenance, it must be a trusted ref only and only if canonical Roadmap says it is needed.

Do not create duplicate communication state.

---

# 27. CONVERSION API

Implement the minimum Buyer-facing conversion/select command.

Likely conceptual endpoint:

`POST /api/v1/reverse/requests/:requestId/proposals/:proposalId/select`

or repository-consistent equivalent.

Do not blindly use this exact path if conventions differ.

Required input should be minimal:

- `expectedVersion` for BuyerRequest/selection CAS if needed.

Do not accept:
- sellerId;
- customerId;
- opportunityId;
- amount;
- acquisitionSource;
- quoteId;
- selected=true;
- converted=true;
- contactDisclosure;
- salesOwner.

Server derives all.

---

# 28. RBAC / PERMISSIONS

Introduce/reuse a minimal Buyer capability for Proposal selection/conversion.

Conceptually:

`reverse.proposal.select_own`

or repository-consistent equivalent.

Only Buyer owner may invoke.

PARTNER must not select its own Proposal.

ADMIN behavior must be deliberate and not silently bypass object scope unless canonical.

---

# 29. MASS ASSIGNMENT

Reject forged fields:

- buyerId/customerId;
- sellerId/partnerId;
- opportunityId;
- leadId;
- quoteId;
- acquisitionSource;
- amount/currency as authoritative;
- selected/converted flags;
- timestamps;
- conversion status;
- owner/assignedTo;
- correlation/causation;
- contactDisclosed.

ExpectedVersion is the only client concurrency control field if used.

---

# 30. SELECTION STATE MODEL

Implement the minimum Reverse-owned state needed to represent selection/conversion.

Possible additive fields on BuyerRequest or SellerProposal may include:

- selectedProposalId;
- selectedAt;
- convertedOpportunityId;
- convertedAt;
- selection version.

Choose the smallest model consistent with Roadmap.

Do not add:
- ACCEPTED/WON/LOST if not required;
- duplicate conversion tables without need.

Hard requirement:
state must make retries and concurrent selection safe.

---

# 31. CAS / CONCURRENCY

Required races:

1. Buyer selects same Proposal twice.
2. Buyer selects Proposal A and B concurrently.
3. BuyerRequest cancel vs selection.
4. Proposal withdraw vs selection.
5. duplicate conversion retry after timeout.
6. concurrent creation of Opportunity for same Proposal.

Expected:

- one winner;
- one Opportunity max;
- no selected-without-opportunity;
- no opportunity-without-selected;
- loser → controlled 409/422 according to conventions;
- history/audit single canonical fact.

Use controlled interleaving tests where necessary.

---

# 32. REQUEST CANCEL RACE

Ensure BuyerRequest cannot become successfully converted after cancellation already committed.

Use lock/CAS semantics consistent with previous strict-review fixes.

Do not rely on READ COMMITTED read alone if it leaves stale-selection race.

---

# 33. PROPOSAL WITHDRAW RACE

Ensure withdrawn Proposal cannot be selected if withdrawal committed first.

If selection commits first, later withdrawal behavior must be explicitly guarded or documented.

Normally once converted, withdrawal should not invalidate already-created canonical Opportunity silently.

Decide based on Roadmap/lifecycle and test.

---

# 34. IDEMPOTENT RETRY

Retry after network timeout should be safe.

If same Proposal was already selected and Opportunity exists:
- return existing canonical result or documented idempotent success;
- do not create another Opportunity.

Do not report false 500/P2002.

---

# 35. HISTORY / AUDIT

Record meaningful facts:

Reverse:
- Proposal selected / request selection
- conversion reference

Sales:
- Opportunity created from BuyerRequest/Proposal provenance

Audit must contain:
- actor;
- request/proposal/opportunity refs;
- no PII;
- no Proposal message body;
- no contact disclosure.

Failed operations must not leave success audit/history.

---

# 36. EVENTS / OUTBOX

DD-030 decided no new event is required because no current consumer exists.

Therefore default:
- direct owner-service orchestration;
- no ProposalSelected/Converted event;
- no OpportunityCreated event solely for this feature.

If existing Sales always emits a canonical Opportunity event, preserve existing convention.

Do not invent speculative Reverse events.

---

# 37. FAILURE ATOMICITY

Failed conversion must leave no partial:

- selectedProposalId without Opportunity;
- Opportunity without selection;
- duplicate Opportunity;
- partial history;
- misleading audit;
- Quote;
- Checkout;
- Sale;
- Order;
- Booking.

One transaction should rollback all owner-service writes where architecture supports it.

---

# 38. NO LEAD

Add hard assertions:

- no Lead created
- no Lead transition
- Opportunity.leadId remains null or canonical optional state

Lead was explicitly rejected by DD-030.

---

# 39. NO QUOTE SIDE EFFECT

Unless Roadmap explicitly changed after DD-030:

- no Quote created during conversion
- no QuoteItem
- no Checkout
- no Sale
- no OrderRequested
- no Order
- no Booking
- no Payment

Opportunity is the Step 2.2F convergence target.

---

# 40. NO CATALOG SIDE EFFECT

Conversion creates/modifies zero:

- Product
- Tariff
- Availability
- AvailabilityReservation
- Category
- PublicSellerProfile

No hold/reservation.

---

# 41. NO COMMUNICATION SIDE EFFECT

Selection/conversion does not:
- create CML thread;
- send message;
- expose contacts;
- mutate existing thread.

Existing communication remains historical/ongoing according to 2.2E.

---

# 42. OPPORTUNITY LIFECYCLE

Create Opportunity in canonical initial state, likely `NEW`.

Do not auto-transition to OPEN/WON.

Do not auto-create Quote.

Future Sales flow manages it.

If current Sales service automatically opens opportunity on create, inspect and document actual behavior.

---

# 43. OPPORTUNITY API / SERVICE REUSE

Prefer extending existing SalesService with a dedicated owner method such as conceptual:

`createOpportunityFromBuyerRequestSelection(...)`

Do not call generic public DTO-based create method with forged internal fields.

The trusted owner method should accept server-derived trusted context.

Reuse:
- ID generation;
- history;
- audit;
- validation;
- transaction patterns.

---

# 44. CROSS-DOMAIN TRANSACTION PATTERN

Follow actual TravelHub owner-service precedent.

If transaction client is passed between modules:
- ownership services still own writes;
- no direct cross-module Prisma calls;
- avoid circular module dependencies.

If module dependency becomes cyclic:
resolve through application/orchestration layer or existing dependency pattern.

Do not use `forwardRef` as a shortcut without understanding architecture.

---

# 45. MIGRATION

Likely additive schema changes may be required.

Potential:
- Reverse selection refs/state
- Opportunity provenance refs
- acquisitionSource on Opportunity/Quote if missing
- unique indexes

Migration rules:
- additive
- no fabricated backfill
- nullable legacy-safe fields
- no cross-schema FK
- no db push
- clean replay
- drift 0

Do not rewrite historical rows.

---

# 46. INDEXES / UNIQUENESS

At minimum consider:

- unique Opportunity.proposalId
- BuyerRequest selected proposal uniqueness/state
- query by buyerRequestId
- query by acquisitionSource if needed
- proposal/request selection lookup

Use only justified indexes.

---

# 47. REQUIRED TARGETED TESTS

At minimum prove:

1. anonymous denied;
2. PARTNER cannot select Proposal;
3. Buyer can select Proposal on own request;
4. cross-Buyer denied;
5. Proposal must belong to request;
6. Proposal must belong to distributed Seller;
7. DRAFT Proposal rejected;
8. WITHDRAWN Proposal rejected;
9. CANCELLED BuyerRequest rejected;
10. DRAFT BuyerRequest rejected;
11. selection creates exactly one Opportunity;
12. zero Lead;
13. zero Quote;
14. zero Checkout/Sale/Order/Booking/Payment;
15. Opportunity.leadId null/optional as canonical;
16. Opportunity.customerId = BuyerRequest buyer;
17. Opportunity seller/partner provenance correct;
18. Opportunity buyerRequestId provenance;
19. Opportunity proposalId provenance;
20. acquisitionSource = BUYER_REQUEST;
21. client cannot forge acquisitionSource;
22. client cannot forge canonical amount;
23. Proposal amount not copied into binding Sales price;
24. zero Product/Tariff requirement for Opportunity conversion;
25. selected Proposal recorded in Reverse;
26. only one selected Proposal per BuyerRequest;
27. concurrent A/B selection → one winner;
28. duplicate same Proposal selection idempotent/safe;
29. concurrent duplicate conversion → one Opportunity;
30. request cancel vs selection race;
31. proposal withdraw vs selection race;
32. failure atomicity;
33. history/audit;
34. no contact disclosure;
35. no Communication mutation;
36. no Catalog mutation;
37. no new speculative events;
38. Checkout DIRECT legacy path remains DIRECT;
39. request-led acquisition path can later derive BUYER_REQUEST server-side;
40. migration replay/drift.

One test may prove multiple invariants.

---

# 48. ACQUISITION PROPAGATION REGRESSION

This is a major Step 2.2F responsibility because DD-030 identified Checkout hardcoded DIRECT.

Add tests for both:

### Existing direct flow

`Direct Quote/Checkout → DIRECT`

must remain unchanged.

### Request-led flow

`BuyerRequest → Proposal → Opportunity → Quote → Checkout`

must resolve `BUYER_REQUEST` server-side.

If 2.2F does not yet create Quote, test the Sales data model/API required so later Quote creation from this Opportunity will carry BUYER_REQUEST correctly.

Do not fake the downstream state.

---

# 49. FULL REGRESSION

Run:

Backend:
- tsc
- unit
- Step 2.2F targeted E2E
- 2.2E
- 2.2D
- 2.2C
- 2.2B
- 2.2A
- Sales foundation
- Quote/Checkout
- Sale completion
- 2.5/2.5A/2.5B
- RBAC/privacy
- full serial E2E

Frontend:
- tsc
- vitest
- production build

DB:
- migrate status
- clean replay
- drift

Report exact counts.

---

# 50. DOCUMENTATION

Create/update architecture documentation covering:

- DD-030 target = Opportunity
- selection owner = Reverse
- Opportunity owner = Sales
- atomic owner-service orchestration
- provenance
- non-binding Proposal money
- binding authority starts at Quote
- no Lead
- no direct Quote
- acquisition source propagation
- contact disclosure unchanged
- Communication continuity
- Product/Tariff gap before Quote
- idempotency/concurrency
- failure atomicity
- no parallel pipeline

Update event/API/ID docs only if actual contracts change.

---

# 51. ROADMAP UPDATE

Only after implementation and green regression:

Mark:

`2.2F IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Set active item:

`Step 2.2F STRICT REVIEW`

Do not advance to Service Templates return point yet.

The Universal Pricing Model Amendment remains scheduled at the canonical post-2.2F return point only after 2.2F Strict Review approval.

Do not mark 2.2F approved in this pass.

---

# 52. ARCHITECTURE STOP CONDITIONS

STOP with:

`ARCHITECTURE DECISION REQUIRED`

if implementation proves:

- Opportunity cannot safely represent selected Seller path anymore;
- DD-030 contradicts current repository;
- Sales owner cannot create Opportunity without changing bounded-context ownership;
- selection/conversion cannot be made consistent without a new cross-domain transaction decision;
- Opportunity requires Product/Tariff unexpectedly;
- contact disclosure becomes mandatory for conversion;
- conversion would require parallel Quote/Checkout/Order pipeline;
- new Pricing Engine is required to create Opportunity.

Do not stop for ordinary implementation defects.

---

# 53. REQUIRED FINAL REPORT

Return:

# PHASE 2 — STEP 2.2F — PROPOSAL → CANONICAL SALES CONVERSION — ОТЧЁТ

## 1. Verdict
`PHASE 2 STEP 2.2F IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
or
`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. Current → Target mapping
## 5. DD-030 compliance
## 6. Reverse selection ownership
## 7. Sales Opportunity ownership
## 8. Cross-domain orchestration
## 9. Buyer authority
## 10. Proposal eligibility
## 11. BuyerRequest eligibility
## 12. One-winner cardinality
## 13. One-Opportunity-per-Proposal invariant
## 14. Selection state model
## 15. Opportunity provenance
## 16. Lead exclusion
## 17. Opportunity customer mapping
## 18. Seller/Partner mapping
## 19. Opportunity lifecycle
## 20. Proposal money non-binding semantics
## 21. Quote boundary
## 22. Product/Tariff implications
## 23. Acquisition source propagation
## 24. Checkout DIRECT gap fix
## 25. Contact disclosure
## 26. Communication continuity
## 27. RBAC / permissions
## 28. API surface
## 29. Mass assignment
## 30. CAS / concurrency
## 31. Request cancel race
## 32. Proposal withdraw race
## 33. Idempotency / retry
## 34. History / audit
## 35. Events / outbox
## 36. Failure atomicity
## 37. Sales isolation downstream
## 38. Catalog isolation
## 39. Communication isolation
## 40. Migration
## 41. Indexes / uniqueness
## 42. Targeted tests
## 43. Acquisition regression
## 44. Full regression
## 45. Runtime verification
## 46. Issues found/fixed
## 47. Documentation changes
## 48. Deferred work
## 49. Architecture decision status
## 50. Out-of-scope confirmation
## 51. Exact files changed

Final line repeats verdict.

---

# 54. STOP CONDITION

After implementation and validation:

**STOP.**

Do NOT perform Step 2.2F Strict Review in the same pass.

Do NOT begin Universal Pricing Model Amendment.

Do NOT begin 1.8A–1.8D.

Wait for a separate Step 2.2F STRICT REVIEW prompt.
