# PHASE 2 --- STEP 2.2F --- PROPOSAL → CANONICAL SALES CONVERSION --- STRICT REVIEW

**Project:** TravelHub\
**Phase:** 2\
**Step:** 2.2F\
**Mode:** STRICT REVIEW / REVIEW FIXES ONLY\
**Entering status:**
`PHASE 2 STEP 2.2F IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`\
**DD-030:** DECIDED --- canonical conversion target =
`Opportunity (OPP-*)`

------------------------------------------------------------------------

## 1. Mission

Perform an adversarial STRICT REVIEW of the actual Step 2.2F
implementation.

Do not trust the implementation report by itself. Verify repository
truth: code, schema, migrations, tests, runtime behavior, contracts,
ADRs, Deferred Decisions Map and canonical Roadmap.

The canonical convergence must remain:

`BuyerRequest → selected SellerProposal → Opportunity → Quote → CheckoutIntent → Sale → OrderRequested → Order → Booking → Finance`

Step 2.2F itself may create only the first Sales-owned commercial
object:

`Opportunity`

Hard invariant:

> Selecting one eligible SellerProposal creates exactly one canonical
> Sales Opportunity, without creating Lead, Quote, Checkout, Sale,
> Order, Booking, Payment, Catalog inventory, a parallel commercial
> pipeline, or contact disclosure.

If review defects are found, fix only defects necessary to make Step
2.2F conform to the approved architecture, then rerun all required
regression.

Do **not** start the next Roadmap item in this pass.

------------------------------------------------------------------------

## 2. Repository baseline

Record and verify:

-   branch;
-   HEAD;
-   relation to `origin/master`;
-   `git status`;
-   tracked modifications;
-   untracked files;
-   migration count/status;
-   drift status;
-   current Roadmap status for 2.2F;
-   DD-030 status;
-   current `CURRENT CANONICAL EXECUTION SEQUENCE` active item.

Do not silently modify unrelated dirty files.

------------------------------------------------------------------------

## 3. Mandatory sources

Inspect at minimum:

### Canonical planning / architecture

-   `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
-   `CURRENT CANONICAL EXECUTION SEQUENCE`
-   `docs/prompts/TRAVELHUB_DEFERRED_DECISIONS_MAP.md`
-   DD-030
-   ADR-0001
-   ADR-0005
-   ADR-0007
-   ADR-0009 where relevant
-   ADR-0011 + amendment
-   ADR-0012

### Reverse Marketplace

-   BuyerRequest schema/service/controller/history
-   BuyerRequestDistribution
-   SellerProposal schema/service/controller/history
-   2.2A--2.2E architecture docs and strict-review fixes
-   pre-sale Communication implementation
-   permissions
-   validation / anti-disintermediation

### Sales / downstream

-   Lead
-   Opportunity
-   Opportunity history
-   Quote / QuoteItem
-   CheckoutIntent
-   Sale
-   SalesService/controllers/contracts
-   acquisition-source propagation
-   OrderRequested
-   Step 2.5 / 2.5A / 2.5B

### Step 2.2F

Inspect every file actually changed by implementation, including
migration, schema, services/controllers, permissions, E2E, docs and
Roadmap.

Repository truth wins over report text.

------------------------------------------------------------------------

## 4. DD-030 compliance --- HARD GATE

DD-030 is already DECIDED. Do not redesign it.

Verify:

-   selected SellerProposal converts to `Opportunity`;
-   Lead is not created;
-   Proposal does not convert directly to Quote;
-   Proposal remains non-binding;
-   binding commercial authority remains canonical Sales Quote;
-   Reverse owns selection;
-   Sales owns Opportunity;
-   one selected Proposal creates at most one canonical Sales path;
-   acquisition source is `BUYER_REQUEST`;
-   conversion does not disclose contacts.

If implementation materially contradicts DD-030, verdict must be
`CHANGES REQUIRED`.

Use `ARCHITECTURE DECISION REQUIRED` only if the approved decision can
no longer be implemented safely without changing architecture.

------------------------------------------------------------------------

## 5. Bounded-context ownership

Prove:

### Reverse owns

-   BuyerRequest selection state;
-   SellerProposal selection/conversion references;
-   Reverse histories.

### Sales owns

-   Opportunity;
-   Opportunity history;
-   Sales-owned audit/business facts.

Reject:

-   Reverse service directly creating Opportunity via Prisma;
-   Sales service directly mutating Reverse tables;
-   hidden cross-domain writers;
-   a second Reverse-owned Opportunity/Quote/Sale concept.

Trusted context references are allowed only according to ADR-0001.

------------------------------------------------------------------------

## 6. Owner-service transaction

Inspect the real transaction.

Expected conceptual sequence:

1.  resolve authenticated Buyer;
2.  lock/re-read BuyerRequest;
3.  verify Buyer ownership;
4.  verify request eligibility;
5.  resolve/lock SellerProposal;
6.  verify Proposal belongs to request;
7.  verify Proposal eligibility;
8.  enforce one-winner invariant;
9.  invoke Sales owner method using the same transaction;
10. create canonical Opportunity;
11. persist Reverse selection/conversion facts;
12. persist history/audit;
13. commit.

Prove there is no:

-   escaped transaction client;
-   nested independent transaction;
-   stale pre-lock authority;
-   success audit outside atomic transaction;
-   partial selection without Opportunity;
-   orphan Opportunity without selection.

------------------------------------------------------------------------

## 7. Buyer authority / IDOR

Prove:

-   only Buyer owning the BuyerRequest can select;
-   `actor.customerId` is authoritative;
-   cross-Buyer access cannot reveal another request/proposal;
-   guessed Proposal ID cannot bypass request ownership;
-   Proposal must belong to the same BuyerRequest;
-   Seller/PARTNER cannot select;
-   client cannot supply authoritative buyer/customer/seller identity.

Response semantics must follow established neutral anti-enumeration
conventions.

------------------------------------------------------------------------

## 8. BuyerRequest eligibility

Review actual enum and guards.

Expected:

-   `SUBMITTED` → eligible;
-   `DRAFT` → denied;
-   `CANCELLED` → denied.

Prefer explicit allow-list.

Do not allow future/terminal states accidentally through logic such as
only checking `status !== CANCELLED`.

------------------------------------------------------------------------

## 9. Proposal eligibility

Review actual enum and guards.

Expected:

-   `SUBMITTED` → eligible;
-   `DRAFT` → denied;
-   `WITHDRAWN` → denied.

Verify Proposal belongs to the request and to its trusted Seller
context.

Do not fabricate a distribution-revocation lifecycle if none exists;
document the actual model.

------------------------------------------------------------------------

## 10. One winner per BuyerRequest

Adversarially prove that two different SellerProposals cannot both win.

Test:

-   Proposal A then Proposal B sequentially;
-   A vs B concurrently.

Expected:

-   exactly one selected Proposal;
-   exactly one canonical Opportunity;
-   losing selection returns controlled conflict;
-   no loser history/audit success fact;
-   no partial state.

------------------------------------------------------------------------

## 11. `selectedProposalId @unique` schema review

The implementation report indicates
`BuyerRequest.selectedProposalId @unique`.

Review whether this constraint:

-   enforces a real invariant;
-   is merely redundant because a Proposal already belongs to one
    BuyerRequest;
-   encodes any incorrect cardinality;
-   creates future legacy/migration risk.

Do not remove it only because it is redundant.

If it is misleading or harmful, fix it and explain why.

One-winner-per-request must not depend on a misunderstood uniqueness
constraint.

------------------------------------------------------------------------

## 12. One Opportunity per Proposal

Prove DB-level idempotency.

Inspect actual constraints such as:

-   `Opportunity.proposalId @unique`;
-   `SellerProposal.convertedOpportunityId @unique`.

Test:

-   sequential duplicate;
-   concurrent duplicate;
-   retry after response loss.

Expected:

-   one Opportunity;
-   deterministic idempotent result or controlled conflict according to
    contract;
-   no P2002→500 leakage.

------------------------------------------------------------------------

## 13. Cross-invariant consistency

Prove these references cannot disagree:

-   `BuyerRequest.selectedProposalId`;
-   `SellerProposal.convertedOpportunityId`;
-   `Opportunity.proposalId`;
-   `Opportunity.buyerRequestId`;
-   `Opportunity.sellerId`;
-   `Opportunity.customerId`.

Try to construct mismatched tuples.

Because cross-schema FKs may intentionally be absent, owner-service
validation must provide equivalent domain safety.

------------------------------------------------------------------------

## 14. Legacy / NULL semantics

Verify all new provenance/conversion fields are legacy-safe.

No fabricated backfill.

NULL must honestly mean:

-   no selection;
-   no conversion;
-   no Reverse provenance,

rather than an inferred historical value.

Existing non-Reverse Opportunities must remain valid.

------------------------------------------------------------------------

## 15. Opportunity provenance

Verify Opportunity stores the minimum trusted provenance needed for
canonical continuation:

-   BuyerRequest ref;
-   Proposal ref;
-   Seller/Partner ref;
-   Buyer/Customer ref;
-   acquisition source.

No public DTO may control these facts.

Do not use `PublicSellerProfile` as commercial authority.

Avoid unnecessary commercial snapshot duplication.

------------------------------------------------------------------------

## 16. Seller vs internal Sales owner

High-risk semantic check.

If Opportunity has both `sellerId` and `assignedToId`, prove:

-   Seller/Partner identity is not stored in a field meaning internal
    Sales employee;
-   internal Sales owner is not treated as the Seller;
-   later Quote creation can identify the correct Seller;
-   naming and semantics are unambiguous.

Fix only a real architecture/semantic defect.

------------------------------------------------------------------------

## 17. Lead exclusion

Hard DD-030 invariant.

Selection must create:

-   zero Lead;
-   zero LeadHistory;
-   zero Lead event/outbox fact.

If Opportunity has `leadId`, Reverse-created Opportunity must preserve
truthful null semantics unless canonical model explicitly requires
otherwise.

Search for indirect helper behavior that could create a Lead
automatically.

------------------------------------------------------------------------

## 18. Opportunity initial lifecycle

Verify actual initial Opportunity status.

Expected canonical initial state is `NEW` if that is the current Sales
model.

No automatic:

-   qualification;
-   WON/LOST;
-   Quote;
-   Checkout;
-   Sale.

History must agree with row state.

------------------------------------------------------------------------

## 19. Proposal money remains non-binding

Inspect every transferred field.

Proposal:

-   amount;
-   currency;
-   validUntil;
-   content/notes

must not become binding:

-   Opportunity commercial amount;
-   Quote price;
-   Checkout amount;
-   Sale amount.

If any Proposal value is copied as context, naming must make its
non-binding nature explicit.

No silent repricing or price authority.

------------------------------------------------------------------------

## 20. Quote boundary

Selection itself must create:

-   zero Quote;
-   zero QuoteItem.

No hidden call to quote generation.

Canonical binding authority begins later in Sales Quote.

------------------------------------------------------------------------

## 21. Product / Tariff independence

Reverse Proposal → Opportunity must work even when there is no:

-   Product;
-   Tariff;
-   Availability;
-   AvailabilityReservation.

No shadow Catalog entities.

No fabricated Product/Tariff.

No dependency on Universal Pricing or Service Templates.

------------------------------------------------------------------------

## 22. Opportunity acquisition source

Verify:

`Opportunity.acquisitionSource = BUYER_REQUEST`

is derived server-side.

Client cannot submit or override acquisition source.

Unknown/forged source must not be accepted through generic payload
spreading.

------------------------------------------------------------------------

## 23. Quote acquisition propagation

Implementation reportedly changed Quote creation so request-led
Opportunity propagates `BUYER_REQUEST`.

Review **all Quote creation paths**.

Prove:

-   Quote from Reverse Opportunity → `BUYER_REQUEST`;
-   client cannot override it;
-   ordinary/direct Opportunity retains correct source;
-   Quote without Reverse provenance remains truthful;
-   legacy behavior is preserved.

Do not let a request-led Opportunity accidentally become a DIRECT Quote.

------------------------------------------------------------------------

## 24. Checkout DIRECT-gap review --- CRITICAL

Implementation reportedly changed Checkout source from hardcoded DIRECT
to:

`quote.acquisitionSource ?? DIRECT`

Verify this is safe.

Answer explicitly:

1.  Is Quote acquisitionSource server-authoritative?
2.  Can any public client forge it?
3.  Are legacy Quote NULLs possible?
4.  Is fallback DIRECT truthful for those legacy/non-request-led rows?
5.  Can another Checkout path still lose BUYER_REQUEST?
6.  Are MARKETPLACE and PARTNER_STOREFRONT still representable?
7.  Is publication channel still distinct from acquisition source?

If Quote source is client-forgeable, fix before approval.

------------------------------------------------------------------------

## 25. End-to-end acquisition attribution

Prove the canonical chain can preserve:

`BuyerRequest` → Opportunity `BUYER_REQUEST` → Quote `BUYER_REQUEST` →
CheckoutIntent `BUYER_REQUEST` → Sale `BUYER_REQUEST` → OrderRequested
`BUYER_REQUEST` → Order `BUYER_REQUEST` → Booking `BUYER_REQUEST`

Do not create these downstream objects inside selection just to prove
propagation. Advance the normal canonical lifecycle in separate E2E
steps.

------------------------------------------------------------------------

## 26. DIRECT flow regression

Prove existing direct/non-Reverse flow remains `DIRECT`.

No new nullable source or fallback may accidentally produce:

-   `BUYER_REQUEST`;
-   NULL;
-   wrong attribution.

------------------------------------------------------------------------

## 27. Other acquisition sources

Inspect current enum and paths:

-   MARKETPLACE;
-   PARTNER_STOREFRONT;
-   DIRECT;
-   BUYER_REQUEST.

Step 2.2F must not collapse future/current channel semantics into only
DIRECT vs BUYER_REQUEST.

Publication channel ≠ acquisition source remains invariant.

------------------------------------------------------------------------

## 28. Contact disclosure

Conversion must not disclose contacts.

Verify zero:

-   buyer email/phone exposure;
-   seller private contact exposure;
-   contact-disclosed flag mutation;
-   Communication enrichment with private identity.

Maintain:

`MATCHED ≠ CONTACT DISCLOSED`

`CHAT EXISTS ≠ CONTACT DISCLOSED`

`CONVERTED ≠ CONTACT DISCLOSED`

------------------------------------------------------------------------

## 29. Communication isolation

Selection must create/mutate zero:

-   CommunicationThread;
-   CML message;
-   membership;
-   conversation state.

Do not copy chat content into Opportunity.

Communication remains owned by `communication.*`.

------------------------------------------------------------------------

## 30. Catalog isolation

Selection must write zero:

-   Product;
-   Tariff;
-   Availability;
-   AvailabilityReservation;
-   Category;
-   PublicSellerProfile.

Capability ≠ inventory remains intact.

------------------------------------------------------------------------

## 31. Downstream Sales isolation

During selection itself verify zero new:

-   Quote;
-   QuoteItem;
-   CheckoutIntent;
-   Sale;
-   OrderRequested;
-   Order;
-   Booking;
-   Payment.

Only Opportunity is allowed.

------------------------------------------------------------------------

## 32. API contract

Review actual public endpoint, expected to be equivalent to:

`POST /buyer/requests/:requestId/proposals/:proposalId/select`

Request body should contain only the minimum concurrency input, e.g.:

`{ expectedVersion }`

Verify:

-   strict DTO/validation;
-   unknown keys rejected;
-   IDs are validated;
-   expectedVersion type/range correct;
-   error semantics consistent with project conventions.

------------------------------------------------------------------------

## 33. Mass assignment

Explicitly attempt forged:

-   buyerId;
-   customerId;
-   sellerId;
-   partnerId;
-   opportunityId;
-   leadId;
-   quoteId;
-   acquisitionSource;
-   amount;
-   currency;
-   selected;
-   converted;
-   selectedAt;
-   convertedAt;
-   convertedOpportunityId;
-   owner;
-   assignedToId;
-   contactDisclosed;
-   actor;
-   correlationId;
-   causationId.

The implementation report mentioned a previous missing `converted`
forbidden key. Verify the protection is systematic, not brittle
patch-by-patch.

------------------------------------------------------------------------

## 34. RBAC / ADMIN semantics

Verify `reverse.proposal.select_own`.

Expected:

-   BUYER → own request only;
-   PARTNER → denied;
-   unauthenticated → denied;
-   unrelated Buyer → neutral denial;
-   ADMIN semantics explicit and consistent with current architecture.

If ADMIN intentionally does not bypass object scope, document that.

Do not change merely for stylistic consistency.

------------------------------------------------------------------------

## 35. Request cancel race

Adversarially test:

### Cancel commits first

Selection must fail.

### Selection commits first

Opportunity and selection remain durable.

Later request cancellation must not silently delete the Opportunity or
rewrite Sales history.

Do not invent automatic Sales cancellation unless already canonical.

------------------------------------------------------------------------

## 36. Proposal withdraw race

Adversarially test:

### Withdraw commits first

Selection denied.

### Selection commits first

Withdrawal must follow the canonical converted/selected guard and must
not invalidate the already-created Opportunity.

No partial state.

------------------------------------------------------------------------

## 37. Idempotent same-Proposal retry

Important edge case:

A successful selection may increment BuyerRequest/Proposal versions. A
retry after response loss may therefore arrive with the **old
expectedVersion**.

Verify the service recognizes an already-successfully-selected same
Proposal and returns/reuses the canonical Opportunity according to
idempotency policy rather than incorrectly failing solely on stale
version.

No duplicate success history/audit.

------------------------------------------------------------------------

## 38. A/B reselection

After Proposal A wins, selecting Proposal B must not silently switch the
winner.

Expected:

-   controlled conflict;
-   A remains selected;
-   Opportunity A remains canonical;
-   zero Opportunity B.

No reselection policy is approved in Step 2.2F.

------------------------------------------------------------------------

## 39. Failure atomicity

Where repository test patterns permit, force failures:

-   after Opportunity creation but before Reverse update;
-   before commit after history/audit preparation;
-   stale CAS;
-   unique conflict.

Expected rollback:

-   zero orphan Opportunity;
-   zero selected-without-Opportunity;
-   zero success history;
-   zero success audit.

Do not add unsafe production-only fault hooks.

------------------------------------------------------------------------

## 40. History and audit

Verify actual canonical facts, e.g.:

-   BuyerRequest proposal selected;
-   SellerProposal selected/converted;
-   Opportunity created from BuyerRequest Proposal selection;
-   audit `proposal.selected`;
-   audit Sales Opportunity creation from BuyerRequest.

Check:

-   correct actor;
-   correct refs;
-   exactly-once first success;
-   idempotent retry behavior;
-   no PII;
-   no Proposal content;
-   no fabricated status transition.

------------------------------------------------------------------------

## 41. Events / outbox

Implementation report says no new events.

Verify:

-   no speculative event definitions;
-   no unnecessary outbox rows;
-   no event emitted without a consumer merely to mirror audit/history.

If existing canonical Opportunity creation already mandates an event,
preserve it; do not create a second Reverse-specific event.

------------------------------------------------------------------------

## 42. Migration / index review

Inspect migration reported as:

`20260811120000_add_proposal_to_opportunity_conversion`

Verify:

-   additive;
-   nullable legacy-safe;
-   no destructive rewrite;
-   no fabricated backfill;
-   no forbidden cross-schema FK;
-   constraint names compatible with error handling;
-   clean replay;
-   migration status up to date;
-   drift 0;
-   no `db push`.

Review indexes for:

-   Opportunity.proposalId;
-   Opportunity.buyerRequestId;
-   Opportunity.sellerId;
-   BuyerRequest selectedProposal lookup.

Remove/fix only meaningful harmful duplication.

------------------------------------------------------------------------

## 43. Response privacy

Inspect select response.

Buyer may receive safe conversion result such as Proposal/Opportunity
public refs/status as appropriate.

Must not expose:

-   seller private contacts;
-   raw hidden Partner data;
-   internal Sales staff secrets;
-   audit internals;
-   CRM-only data;
-   buyer private data unnecessarily.

------------------------------------------------------------------------

## 44. Trusted Sales method security

Inspect `SalesService.createOpportunityFromBuyerRequestSelection(...)`
or actual equivalent.

Prove:

-   it is an internal trusted owner method;
-   it is not a public mass-assignment surface;
-   caller supplies only trusted, already-validated Reverse refs;
-   Sales validates Sales-owned invariants;
-   source is forced/validated;
-   generic Opportunity API cannot impersonate Reverse conversion.

------------------------------------------------------------------------

## 45. Generic Opportunity regression

Existing Sales flows must continue working.

Verify:

-   Lead→Opportunity flow;
-   ordinary/direct Opportunity creation;
-   non-Reverse Opportunity with null Reverse refs;
-   lifecycle/history behavior.

Reverse provenance must not become mandatory globally.

------------------------------------------------------------------------

## 46. Quote / Checkout regression

Test at minimum:

-   Reverse Opportunity → Quote → `BUYER_REQUEST`;
-   ordinary/direct Opportunity → expected direct source;
-   Quote without Opportunity → canonical existing behavior;
-   client cannot forge source;
-   request-led Quote → Checkout `BUYER_REQUEST`;
-   direct Quote → Checkout `DIRECT`;
-   price snapshot and Quote authority unchanged.

------------------------------------------------------------------------

## 47. Order / Booking regression

Run Step 2.5B downstream tests.

Verify:

-   OrderRequested accepts BUYER_REQUEST;
-   Order stores BUYER_REQUEST;
-   Booking stores BUYER_REQUEST;
-   DIRECT still works;
-   no source drift during retries/lifecycle.

------------------------------------------------------------------------

## 48. Targeted coverage audit

Do not accept "15/15" only by count.

Map tests to requirements and add missing coverage.

Must prove at least:

-   successful conversion;
-   Buyer ownership;
-   PARTNER denial;
-   cross-Buyer IDOR;
-   request eligibility;
-   Proposal eligibility;
-   request/proposal mismatch;
-   sequential A/B winner;
-   concurrent A/B winner;
-   same-Proposal retry;
-   concurrent duplicate;
-   stale-version retry;
-   cancel race;
-   withdraw race;
-   mass assignment;
-   no Lead;
-   no Quote/downstream creation;
-   no Catalog writes;
-   no Communication writes;
-   provenance consistency;
-   BUYER_REQUEST propagation;
-   DIRECT regression;
-   failure atomicity.

------------------------------------------------------------------------

## 49. Full regression

After review fixes run and report exact final counts.

### Backend

-   `tsc --noEmit`
-   unit tests
-   Step 2.2F targeted E2E
-   2.2E
-   2.2D
-   2.2C
-   2.2B
-   2.2A
-   Sales / Opportunity
-   Quote
-   Checkout
-   Sale completion
-   Step 2.5
-   Step 2.5A
-   Step 2.5B
-   RBAC/security/privacy
-   full serial E2E
-   production build if repository convention requires it

### Frontend

Even though Step 2.2F is backend-only:

-   tsc
-   vitest
-   production build

### Database

-   migrate status
-   clean migration replay
-   drift check

Report exact counts.

------------------------------------------------------------------------

## 50. Runtime verification

Use actual repository-standard runtime/E2E AppModule, not only mocks.

Prove real flow:

`BuyerRequest → SellerProposal → select → Opportunity`

Then separately advance existing canonical Sales lifecycle enough to
prove:

`Opportunity(BUYER_REQUEST) → Quote(BUYER_REQUEST) → Checkout(BUYER_REQUEST)`

Also prove a normal direct flow remains `DIRECT`.

------------------------------------------------------------------------

## 51. Documentation / API contract review

Inspect and synchronize as required:

-   `docs/architecture/reverse-proposal-to-sales-conversion.md`
-   `docs/architecture/acquisition-source-propagation.md`
-   `docs/contracts/ids.md`
-   `docs/contracts/api.md`
-   Roadmap v3
-   Deferred Decisions Map only if factual synchronization is required

### Mandatory API-doc check

The implementation report introduced a public Buyer selection endpoint.
If project conventions require public endpoints in
`docs/contracts/api.md`, omission is a review defect.

Document:

-   endpoint;
-   permission;
-   own-scope;
-   request;
-   response;
-   idempotency;
-   error semantics;
-   contact-disclosure/privacy boundary.

No new business ID prefix should be created:

-   BuyerRequest = BRQ-\*
-   Proposal = PRP-\*
-   Opportunity = OPP-\*

------------------------------------------------------------------------

## 52. Roadmap update and exact NEXT

If review passes:

-   mark Step 2.2F according to canonical status semantics as STRICT
    REVIEW APPROVED / DONE;
-   keep DD-030 DECIDED;
-   update `CURRENT CANONICAL EXECUTION SEQUENCE`;
-   determine NEXT from the **current Roadmap**, not from memory.

**Do not automatically jump to Step 2.6.**

The accepted execution sequence contains a post-2.2F return point for
the Service Templates / pricing planning gates before implementation of
1.8A--1.8D where applicable.

Read the actual latest Roadmap and quote the **exact NEXT item** in the
final report.

If a documentation amendment / Universal Pricing decision gate is next,
that is the next item.

------------------------------------------------------------------------

## 53. Allowed review fixes

Allowed:

-   Step 2.2F correctness fixes;
-   security/IDOR fixes;
-   transaction/concurrency/idempotency fixes;
-   acquisition propagation fixes;
-   migration/index fixes;
-   tests;
-   API/docs synchronization;
-   Roadmap status synchronization.

Forbidden:

-   starting Universal Pricing implementation;
-   starting 1.8A--1.8D;
-   starting Step 2.6;
-   contact disclosure;
-   notifications;
-   attachments;
-   frontend Marketplace implementation;
-   speculative auto-Quote creation;
-   Reverse pricing engine;
-   second commercial pipeline.

------------------------------------------------------------------------

## 54. Verdict rules

Return exactly one:

### Approved

`PHASE 2 STEP 2.2F STRICT REVIEW COMPLETED — APPROVED`

### Approved with fixes

`PHASE 2 STEP 2.2F STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

### Changes required

`PHASE 2 STEP 2.2F STRICT REVIEW COMPLETED — CHANGES REQUIRED`

### Architecture blocker

`ARCHITECTURE DECISION REQUIRED`

Do not approve with red mandatory tests, unresolved ownership ambiguity
or unproven concurrency invariants.

------------------------------------------------------------------------

## 55. Required final report

Return:

# PHASE 2 --- STEP 2.2F --- STRICT REVIEW --- ОТЧЁТ

1.  Verdict\
2.  Repository baseline\
3.  Sources inspected\
4.  DD-030 compliance\
5.  Bounded-context ownership\
6.  Owner-service transaction\
7.  Buyer authority / IDOR\
8.  BuyerRequest eligibility\
9.  Proposal eligibility\
10. One-winner invariant\
11. selectedProposalId schema review\
12. One-Opportunity-per-Proposal\
13. Cross-invariant consistency\
14. Legacy/null semantics\
15. Opportunity provenance\
16. Seller vs internal Sales owner\
17. Lead exclusion\
18. Opportunity lifecycle\
19. Proposal money semantics\
20. Quote boundary\
21. Product/Tariff independence\
22. Opportunity acquisition source\
23. Quote acquisition source\
24. Checkout DIRECT-gap review\
25. End-to-end attribution\
26. DIRECT-flow regression\
27. Other acquisition sources\
28. Contact disclosure\
29. Communication isolation\
30. Catalog isolation\
31. Downstream Sales isolation\
32. API contract\
33. Mass assignment\
34. RBAC / ADMIN semantics\
35. Request-cancel race\
36. Proposal-withdraw race\
37. Idempotent retry\
38. A/B reselection\
39. Failure atomicity\
40. History / audit\
41. Events / outbox\
42. Migration / index review\
43. Response privacy\
44. Trusted Sales method security\
45. Generic Opportunity regression\
46. Quote / Checkout regression\
47. Order / Booking regression\
48. Targeted coverage audit\
49. Full regression\
50. Runtime verification\
51. Documentation / API contract review\
52. Issues found / fixed\
53. Roadmap update\
54. Architecture decision status\
55. Out-of-scope confirmation\
56. Exact files changed\
57. **Exact NEXT item**

Final line must repeat the verdict.

------------------------------------------------------------------------

## 56. STOP

After completing Step 2.2F STRICT REVIEW:

**STOP.**

Do not execute the NEXT item in the same pass.

The final report must state the exact NEXT item from the synchronized
canonical Roadmap, but its implementation/review starts only from a
separate prompt.
