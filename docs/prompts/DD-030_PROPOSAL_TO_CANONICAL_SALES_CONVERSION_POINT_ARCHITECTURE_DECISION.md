# DD-030 — PROPOSAL → CANONICAL SALES CONVERSION POINT — ARCHITECTURE DECISION / RESOLUTION

**Project:** TravelHub  
**Mode:** ARCHITECTURE / DEFERRED DECISION RESOLUTION ONLY  
**Decision:** DD-030 — Proposal → Canonical Sales Conversion Point  
**Current boundary:** Step 2.2E STRICT REVIEW APPROVED WITH REVIEW FIXES  
**Blocked implementation:** Step 2.2F — Proposal → Canonical Sales Conversion  
**Implementation in this pass:** FORBIDDEN

---

## 1. Mission

Resolve DD-030 before Step 2.2F.

Determine the **single canonical conversion point** through which a selected Reverse Marketplace `SellerProposal` enters the existing Sales pipeline.

Candidates that MUST be investigated against actual repository truth:

1. `Lead`
2. `Opportunity`
3. `Quote`

Do not choose from naming or intuition. Inspect actual schemas, services, lifecycle rules, tests, ADRs and contracts.

Required invariant:

`BuyerRequest → selected SellerProposal → EXISTING SALES PIPELINE → Checkout → Sale → OrderRequested → Order → Booking → Finance`

No parallel Reverse Marketplace commercial pipeline is permitted.

---

## 2. Hard stop — documentation/decision only

DO NOT:

- implement Step 2.2F;
- modify runtime schema for conversion;
- create conversion migrations;
- add conversion controllers/services/DTOs/events;
- implement Proposal selection/acceptance;
- create Lead/Opportunity/Quote as runtime behavior;
- implement contact disclosure;
- modify Checkout/Sale/Order/Booking behavior;
- implement Service Templates or Universal Pricing;
- modify frontend/UI.

Repository code and tests may be inspected/read/run.

Only documentation required to resolve DD-030 and synchronize the canonical Roadmap may be changed.

After the decision: **STOP**.

---

## 3. Confirm canonical baseline

Verify from repository:

- 2.2A–2.2E are completed and STRICT REVIEW approved;
- 2.2F is NOT IMPLEMENTED and is NEXT only after DD-030;
- SellerProposal owner = `reverse.*`;
- Proposal ≠ canonical Sales Quote;
- Proposal amount is non-binding indication;
- binding commercial authority belongs to Sales;
- matching/distribution does not auto-create Sales entities;
- Proposal creation/submission does not auto-create Sales entities;
- acquisition source = `BUYER_REQUEST`;
- no `BuyerRequestOrder`, `ProposalOrder`, ReverseQuote, ReverseCheckout, ReverseSale, ReversePayment or ReverseBooking.

Record branch, HEAD, git status and current Roadmap status. Do not delete/reset unrelated files.

---

## 4. Sources that MUST be inspected

### Canonical documents

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- `CURRENT CANONICAL EXECUTION SEQUENCE`
- `TRAVELHUB_DEFERRED_DECISIONS_MAP.md`
- DD-030
- ADR-0001
- ADR-0005
- ADR-0007
- ADR-0009 where relevant
- ADR-0011 + amendment
- ADR-0012
- Reverse Marketplace amendments/reviews

### Reverse Marketplace implementation

Inspect actual:
- BuyerRequest;
- BuyerRequestDistribution;
- SellerProposal;
- Proposal lifecycle/history;
- pre-sale Communication;
- 2.2A–2.2E architecture docs/tests.

### Existing Sales implementation

Inspect actual:
- Lead;
- Opportunity;
- Quote;
- CheckoutIntent;
- Sale;
- Sales services/controllers;
- Lead→Opportunity behavior;
- Opportunity→Quote behavior;
- Quote lifecycle;
- checkout creation;
- Sale creation/completion;
- OrderRequested publishing;
- acquisitionSource handling;
- Sales E2E/unit tests;
- API/event/ID contracts.

Repository implementation wins over assumptions.

---

## 5. Core decision question

Answer:

> After the Buyer chooses one SellerProposal, what is the **first canonical Sales-owned entity** that should represent this selected commercial path?

Possible final paths include:

`SellerProposal → Lead → ...`

`SellerProposal → Opportunity → ...`

`SellerProposal → Quote → ...`

Only one may become canonical.

---

## 6. Lead candidate

Prove what Lead means in TravelHub.

Determine:

- whether Lead is unqualified/acquired demand;
- whether it precedes qualification;
- whether Seller/product/commercial path is normally unknown at Lead stage;
- whether Lead naturally converts to Opportunity;
- whether a selected Proposal is already more qualified than a Lead;
- whether creating Lead would duplicate BuyerRequest as another demand entity;
- whether Lead can represent one selected Seller-specific path;
- what side effects Lead creation has.

Mandatory question:

> Would `SellerProposal → Lead` duplicate BuyerRequest and move an already qualified Seller-specific journey backward in the funnel?

If yes, reject Lead.

---

## 7. Opportunity candidate

Determine:

- whether Opportunity is the canonical qualified commercial deal;
- whether it is Seller/Partner specific;
- whether it can connect Buyer + Seller + commercial context;
- whether it normally precedes Quote;
- whether it may exist without Lead;
- whether existing code permits server-side creation from another acquisition source;
- whether it is the natural boundary after Buyer chooses one Seller;
- whether it allows Proposal to remain non-binding while Sales later creates the binding Quote.

Mandatory question:

> Does Opportunity represent the first Sales-owned qualified path after one SellerProposal is selected?

Prove from repository.

---

## 8. Quote candidate

Determine:

- whether Quote can exist independently;
- whether Opportunity is mandatory;
- whether Quote is draft, formal, binding, accepted, or otherwise authoritative;
- what fields Product/Tariff/pricing it requires;
- whether Quote freezes commercial terms;
- whether it leads directly to Checkout;
- whether direct Proposal→Quote skips mandatory Sales stages;
- whether Proposal data is sufficient to create a valid Quote;
- whether direct conversion would accidentally elevate non-binding Proposal money to binding authority.

Hard invariant:

**SellerProposal must never be reclassified or reused as canonical Quote.**

If Quote is chosen, Sales must create a **new canonical Quote** from trusted/revalidated facts.

---

## 9. Special discriminator — Catalog/Product dependency

SellerProposal may exist independently of a published Product.

Inspect whether:

- Opportunity can exist without Product/Tariff;
- Quote can exist without Product/Tariff;
- Quote requires canonical pricing facts not available in Proposal;
- direct Proposal→Quote would create a hidden/shadow Product or pricing authority.

Do not solve Service Templates here.

If current Quote cannot safely exist without Product/pricing prerequisites, that is evidence against Quote as the first convergence target.

---

## 10. Commercial authority map

Document authority:

- BuyerRequest = demand;
- Distribution = eligibility/routing;
- SellerProposal = non-binding Seller indication;
- Communication = negotiation context;
- selected Proposal = selection/provenance, not binding price;
- chosen Sales target = determine role;
- canonical Quote = determine when formal/binding terms begin;
- Checkout = frozen checkout intent;
- Sale = canonical sale;
- Order = frozen order snapshot.

State exactly where binding commercial terms first become canonical.

---

## 11. Selection ≠ conversion

Explicitly separate:

1. Buyer selects Proposal;
2. Reverse records selection if this belongs to Reverse;
3. conversion command crosses into Sales;
4. Sales creates/reuses canonical target;
5. normal Sales lifecycle continues.

Selection itself must not automatically mean Checkout/Sale/Order.

Determine ownership of Proposal selection.

---

## 12. One winning commercial path

One BuyerRequest may have N SellerProposals.

Required invariant for Step 2.2F:

- only selected Proposal may initiate canonical Sales conversion;
- non-selected Proposals remain historical;
- matching must not fan out Sales entities;
- Proposal submission must not fan out Sales entities;
- no `70 matched Sellers → 70 Leads/Opportunities/Quotes`.

Determine whether only one Proposal may be selected/converted per BuyerRequest at a time and record the required cardinality.

---

## 13. Idempotency / reselection semantics

Define, without implementing:

- duplicate selection;
- duplicate conversion request;
- retry after timeout;
- concurrent conversion of same Proposal;
- simultaneous selection of Proposal A and B;
- selection B after A already converted;
- Proposal withdrawal during conversion;
- BuyerRequest cancellation during conversion.

Required goal:

**one selected commercial path → at most one canonical Sales path**, enforceable/idempotent at DB/domain level.

---

## 14. Provenance

Canonical Sales must retain enough provenance to answer:

- originating BuyerRequest;
- selected SellerProposal;
- selected Seller;
- acquisition source;
- correlation/causation.

Determine whether existing Sales fields are sufficient.

If additive refs will be required in Step 2.2F, document them as implementation implications only. Do not modify schema now.

---

## 15. Proposal data transfer rules

Classify Proposal fields such as:

- amount;
- currency;
- validUntil;
- content/title/notes;
- Seller;
- BuyerRequest ref.

For each classify as:

- provenance;
- negotiation hint;
- seed data requiring Sales validation;
- forbidden as binding authority.

Proposal amount must not silently become binding Quote/Sale price.

---

## 16. Pricing rule

DD-030 must remain compatible with later Universal Pricing / Service Templates.

Minimum safe rule:

- Proposal price = non-binding;
- canonical Sales price must be created/validated by Sales authority;
- no fabricated future price;
- no frontend-authoritative calculation;
- no Reverse pricing engine;
- no shadow Quote engine.

If existing Sales cannot create a valid canonical Quote from current data, identify the prerequisite instead of bypassing Sales authority.

---

## 17. Buyer / Seller identity

Determine canonical mapping:

- Reverse Seller → Partner/Sales owner;
- BuyerRequest Buyer → Customer/Buyer identity expected by Sales.

PublicSellerProfile is presentation, not commercial authority.

Do not make Proposal selection automatically disclose private contact details.

`MATCHED ≠ CONTACT DISCLOSED`

and

`CHAT EXISTS ≠ CONTACT DISCLOSED`

remain true unless an already-approved policy explicitly changes them.

State whether conversion itself changes contact disclosure. Default must be **NO** unless canonical evidence proves otherwise.

---

## 18. Communication continuity

Pre-sale CML conversation remains owned by Communication.

Determine how Sales may reference context without:
- migrating messages;
- copying chat;
- creating Sales-owned chat;
- creating second Communication domain.

---

## 19. Acquisition source

`BUYER_REQUEST` must survive conversion.

Inspect how acquisition source currently propagates through:
- Sales target;
- Quote;
- Checkout;
- Sale;
- Order;
- Booking.

Document any Step 2.2F gap.

Do not re-derive source from UI/publication channel.

---

## 20. Cross-domain ownership/write pattern

Determine the safe implementation pattern for future Step 2.2F.

Evaluate repository precedent for:
- owner service orchestration;
- application orchestration;
- event-driven handoff.

Reject:
- Sales directly writing `reverse.*`;
- Reverse directly writing `sales.*`;
- Prisma as hidden cross-domain writer.

If selection is Reverse-owned, Reverse owner must mutate selection. If Sales target is Sales-owned, Sales owner must create it.

---

## 21. Transaction / atomicity implications

Selection and conversion cross bounded contexts.

Determine what Step 2.2F must guarantee:

- atomic owner-service transaction if supported;
- or idempotent staged transition with safe retry;
- no selected-without-conversion corruption;
- no conversion-without-selection ambiguity;
- no duplicate Sales paths.

Use existing modular-monolith patterns. Do not invent distributed-system complexity unnecessarily.

---

## 22. Eventing

Determine whether any new event is actually required.

Possible concepts:
- ProposalSelected;
- ProposalConverted;
- OpportunityCreated;
- QuoteCreated.

Do not add events without real consumers or canonical project need.

Record whether direct owner-service orchestration is sufficient.

---

## 23. Security contract for future 2.2F

Require proof that:

- only Buyer owner can select/convert own BuyerRequest;
- Proposal belongs to that request;
- Proposal belongs to correct Seller;
- Proposal is in eligible lifecycle state;
- unmatched Seller cannot be injected;
- cross-Buyer selection denied;
- cross-Seller mutation denied;
- client cannot forge acquisition source;
- client cannot forge canonical price;
- client cannot forge Sales owner;
- no privilege escalation through payload.

---

## 24. Lifecycle mapping

Map actual repository statuses for:

- BuyerRequest;
- SellerProposal;
- Lead;
- Opportunity;
- Quote.

Determine the minimum valid transition mapping.

Do not invent unnecessary statuses.

If future Proposal `SELECTED`/`CONVERTED` state is required, say who owns it and why, but do not implement it.

---

## 25. Decision matrix — mandatory

Produce:

| Criterion | Lead | Opportunity | Quote |
|---|---|---|---|
| avoids duplicate demand | PASS/PARTIAL/FAIL | | |
| represents selected Seller path | | | |
| preserves Proposal ≠ Quote | | | |
| supports non-binding Proposal | | | |
| fits current Sales lifecycle | | | |
| does not skip mandatory stage | | | |
| works without shadow Product | | | |
| supports BUYER_REQUEST | | | |
| supports provenance | | | |
| minimizes new architecture | | | |
| converges to existing Checkout/Sale | | | |
| safe/idempotent for 2.2F | | | |

Every cell must be supported by repository evidence or clearly marked inference.

---

## 26. Three mandatory tests of the architecture

### A. Lead duplication test

> Is BuyerRequest already the acquired demand record, making Lead after Proposal selection a duplicate/earlier funnel representation?

### B. Opportunity fit test

> Is Opportunity the first canonical Sales-owned qualified deal after Buyer selects one Seller, with formal Quote created later?

### C. Direct Quote skip test

> Would Proposal→Quote skip mandatory Opportunity/qualification or incorrectly promote non-binding Proposal facts to binding commercial authority?

Answer all three explicitly.

---

## 27. Expected hypothesis — NOT a predecision

A plausible architecture is:

`BuyerRequest → selected SellerProposal → Opportunity → Quote → Checkout → Sale → OrderRequested → Order → Booking`

because BuyerRequest already represents demand, Proposal is Seller-specific but non-binding, and a selected Seller may represent a qualified deal before formal Quote.

**This is only a hypothesis.**

Do not choose Opportunity unless actual TravelHub Sales implementation proves it is correct.

Repository truth wins.

---

## 28. Required final DD-030 decision

State exactly:

### Chosen conversion target
`Lead` / `Opportunity` / `Quote`

### Canonical convergence path
Exact existing Sales sequence.

### Why chosen
Repository-backed reasoning.

### Why Lead rejected/accepted

### Why Opportunity rejected/accepted

### Why Quote rejected/accepted

### Proposal selection owner

### Binding authority
Where formal/binding price and terms begin.

### Provenance requirements

### Acquisition propagation

### Idempotency/cardinality invariant

### Contact-disclosure effect

### Product/Catalog prerequisite, if any

### Step 2.2F implementation contract
What 2.2F must implement and prove.

---

## 29. DD-030 update

If resolved, update `TRAVELHUB_DEFERRED_DECISIONS_MAP.md`:

- DD-030 → `DECIDED`;
- decision date;
- chosen target;
- rationale;
- rejected alternatives;
- invariants;
- implementation consequences;
- references/evidence.

Do not alter unrelated deferred decisions.

---

## 30. Roadmap update

If DD-030 is resolved:

- mark DD-030 gate resolved;
- keep Step 2.2F `NOT IMPLEMENTED`;
- update 2.2F contract with chosen conversion target;
- set exact NEXT:

`PHASE 2 — STEP 2.2F — PROPOSAL → CANONICAL SALES CONVERSION`

- preserve CURRENT CANONICAL EXECUTION SEQUENCE;
- do not mark 2.2F started/completed.

If unresolved:
- keep 2.2F blocked;
- record exact reason;
- return `ARCHITECTURE DECISION REQUIRED` or `CHANGES REQUIRED`.

---

## 31. ADR requirement

Determine whether DD-030 resolution itself is sufficient or a new formal ADR is required.

If ADR-0012 already establishes Reverse ownership and canonical convergence into Sales, and DD-030 merely chooses the existing Sales entry point without changing bounded-context ownership, prefer resolving DD-030 without inventing another ADR.

If the decision changes ownership or contradicts accepted ADRs, stop with:

`ARCHITECTURE DECISION REQUIRED`

---

## 32. Validation

This is documentation-only.

You may run existing tests/read code to verify semantics, but do not add runtime implementation.

At completion verify:
- production code unchanged;
- schema/migrations unchanged;
- frontend unchanged;
- only intended documentation changed.

---

## 33. Required final report

Return:

# DD-030 — PROPOSAL → CANONICAL SALES CONVERSION POINT — DECISION REPORT

## 1. Verdict
Exactly one:
- `DD-030 RESOLVED — APPROVED FOR ROADMAP INTEGRATION`
- `DD-030 RESOLVED WITH DOCUMENTATION FIXES — APPROVED FOR ROADMAP INTEGRATION`
- `DD-030 NOT RESOLVED — CHANGES REQUIRED`
- `ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. Existing Reverse Marketplace flow
## 5. Existing Sales lifecycle
## 6. Lead semantics
## 7. Opportunity semantics
## 8. Quote semantics
## 9. Decision matrix
## 10. Lead duplication test
## 11. Opportunity fit test
## 12. Direct Quote skip test
## 13. Chosen conversion target
## 14. Canonical convergence path
## 15. Rejected alternatives
## 16. Proposal selection ownership
## 17. Binding commercial authority
## 18. Proposal data transfer rules
## 19. Product/Catalog implications
## 20. Buyer/Seller identity implications
## 21. Contact disclosure
## 22. Communication continuity
## 23. Acquisition source propagation
## 24. Provenance requirements
## 25. Correlation/causation
## 26. Idempotency/cardinality
## 27. Concurrent/re-selection semantics
## 28. Cross-domain ownership/write pattern
## 29. Transaction/atomicity implications
## 30. Eventing decision
## 31. Security requirements for 2.2F
## 32. Lifecycle mapping
## 33. No-parallel-pipeline proof
## 34. DD-030 update
## 35. Roadmap update
## 36. ADR requirement
## 37. Validation performed
## 38. Exact files changed
## 39. Out-of-scope confirmation
## 40. Exact NEXT item

If resolved, exact NEXT:

`PHASE 2 — STEP 2.2F — PROPOSAL → CANONICAL SALES CONVERSION`

and the report must state the chosen target that 2.2F must use.

---

## 34. Stop condition

After DD-030 resolution:

**STOP.**

Do not implement Step 2.2F.

Wait for a separate implementation prompt.

Final line must repeat the DD-030 verdict.
