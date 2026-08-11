# PHASE 2 — STEP 2.2C — MATCHING & DISTRIBUTION

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.2C  
**Mode:** IMPLEMENTATION  
**Canonical owner:** Reverse Marketplace (`reverse.*`)  
**Prerequisite:** Step 2.2B Strict Review `APPROVED WITH REVIEW FIXES`  
**Next after completion:** STOP and wait for separate STRICT REVIEW

## 1. Mission

Implement the canonical Matching & Distribution foundation for Reverse Marketplace.

The system must evaluate SUBMITTED BuyerRequests and determine which Sellers are eligible to receive them using server-authoritative rules.

Canonical flow:

`BuyerRequest SUBMITTED → eligibility evaluation → durable per-Seller distribution/match fact → Seller can read only requests distributed to that Seller → Step 2.2D Proposal`

Hard invariants:

- `MATCHED / DISTRIBUTED ≠ CONTACT DISCLOSED`
- Matching does not auto-create Lead/Opportunity/Quote/Sale/Order/Booking.
- Seller cannot self-match.
- Seller legal/registration country does not determine coverage.
- Capability ≠ Product/inventory.
- Capability ≠ entitlement.

## 2. Sources to inspect first

Read latest repository truth:
- canonical Roadmap and `CURRENT CANONICAL EXECUTION SEQUENCE`;
- ADR-0012, ADR-0001, ADR-0007, ADR-0011;
- Deferred Decisions Map, DD-028, DD-030;
- Step 2.2A + Strict Review;
- Step 2.2B + Strict Review;
- current `reverse.*` schema;
- SellerCapability;
- BuyerRequest;
- Catalog Category;
- CRM Partner/Seller identity;
- permissions/RBAC;
- AuditLog;
- EventBus/outbox/inbox;
- current query/index/location helpers.

Roadmap wins if this prompt conflicts with it.

## 3. Ownership

`Matching / Distribution → reverse.*`

Do not write matching state into Catalog, Sales, CRM, Communication, Order or Booking.

Cross-context reads are allowed only under existing ADR-0001 rules.

## 4. No Sales fan-out

Creating/distributing matches must create zero:
- Lead;
- Opportunity;
- Quote;
- CheckoutIntent;
- Sale;
- OrderRequested;
- Order;
- Booking;
- Payment.

Never create one Lead per matched Seller.

DD-030 remains deferred until Step 2.2F.

## 5. No contact disclosure

Matching/distribution must not expose Buyer:
- email;
- phone;
- WhatsApp;
- Telegram;
- passport/document data;
- raw Customer profile;
- address.

Seller gets only a purpose-built, PII-minimal request projection.

## 6. Server-authoritative eligibility

Seller/client must not be able to:
- add itself to a request;
- submit sellerIds as authoritative targets;
- mark itself matched/distributed;
- forge another Seller's distribution;
- bypass category;
- bypass destination coverage;
- bypass capability state;
- bypass `acceptsBuyerRequests`;
- bypass Seller eligibility;
- bypass entitlement if canonically required.

Authoritative matching inputs must come from server-owned state.

## 7. Minimum eligibility gates

Reconstruct exact Roadmap semantics, but expected gates include:

1. BuyerRequest is distributable, normally `SUBMITTED`.
2. Seller/Partner identity is eligible/active.
3. SellerCapability is `ACTIVE`.
4. Capability category matches BuyerRequest category.
5. Capability destination coverage matches request destination.
6. `acceptsBuyerRequests = true`.
7. Entitlement gate if a canonical entitlement authority exists.

Do not invent a new entitlement model.

If entitlement is mandatory but no canonical authority exists, stop with `ARCHITECTURE DECISION REQUIRED`.

## 8. Category matching

Use canonical `catalog.Category` identity/reference.

Do not match by free-text category labels.

Do not infer capability from Product publication.

No second Reverse taxonomy.

## 9. Destination coverage matching

Core business proof:

Seller legal/office location = Baku/Azerbaijan  
Seller capability = HOTEL → Turkey  
BuyerRequest = HOTEL → Turkey  
→ Seller may be eligible.

Conversely, legal location in Turkey without a capability covering Turkey must not match.

Legal country must never be fallback coverage.

## 10. Destination semantics

Using current Step 2.2A/2.2B destination representation, explicitly define/test:

- worldwide capability;
- country capability vs country request;
- country capability vs city request in same country;
- city capability vs same city request;
- city capability vs different city;
- country mismatch;
- any open/flexible destination semantics if supported.

Do not freeze Region hierarchy while DD-028 remains deferred.

If current JSONB representation cannot support deterministic matching safely, stop with `ARCHITECTURE DECISION REQUIRED`.

## 11. BuyerRequest status gate

Do not distribute DRAFT or CANCELLED requests.

SUBMITTED means eligible for evaluation only.

If request is cancelled after distribution:
- no new distributions;
- existing durable history is not deleted;
- Seller projection must not pretend it remains open;
- future Proposal must later reject cancelled request.

## 12. Distribution persistence

Implement the minimal reverse-owned durable per-Seller fact required to prove that a request was distributed/matched to a Seller.

Expected fields may include:
- id;
- buyerRequestId;
- sellerId;
- state/status if materially required;
- matched/distributed timestamp;
- version if mutable;
- createdAt/updatedAt;
- audit/history metadata where needed.

Do not include Proposal, chat, pricing, ranking, contact disclosure or Sales refs prematurely.

DB must enforce uniqueness for `(buyerRequestId, sellerId)` or equivalent.

## 13. Matched vs distributed terminology

Inspect current Roadmap.

If `eligible`, `matched`, and `distributed` are distinct business facts required by 2.2C, model only the minimum necessary distinctions.

Do not introduce speculative lifecycle complexity.

Document exact meaning of each persisted state.

## 14. Idempotency

Repeated or concurrent matching of the same request must not duplicate per-Seller distribution.

Require:
- DB uniqueness;
- transactional/idempotent write logic;
- retry safety;
- no duplicate history/audit;
- no duplicate Seller visibility.

## 15. Matching trigger

Determine the canonical trigger model from the current Roadmap:

- explicit server command;
- async event triggered by submitted request;
- another approved mechanism.

Do not invent background polling.

If 2.2B intentionally emitted no event and 2.2C now needs an event, this is the correct step to add a canonical event/consumer only if justified.

## 16. Events / outbox / inbox

If events are introduced:
- reverse owns reverse facts;
- existing outbox/inbox only;
- versioned contract;
- no PII;
- correlation/causation preserved;
- idempotent consumer;
- retry-safe;
- no reverse-specific event bus.

Do not emit Sales events.

If events are not needed, document why explicit orchestration is safe.

## 17. Seller request inbox/read model

Seller may now read only BuyerRequests actually distributed to that Seller.

Required:
- own distributed list;
- own distributed detail;
- bounded pagination;
- deterministic order;
- strict seller scope.

No global request list.

Unmatched Seller sees nothing.

## 18. Seller projection/privacy

Do not return the raw BuyerRequest row blindly.

Seller-safe projection may include only necessary demand facts, e.g.:
- request code;
- category;
- destination;
- dates;
- PAX;
- non-binding budget if allowed;
- safe preferences if allowed;
- distributedAt.

Must not include Buyer contact PII or unnecessary internal Customer IDs.

### Critical preferences rule

Step 2.2B Strict Review established that preferences are not a full DLP-safe store.

Therefore do not blindly expose arbitrary `preferences` JSON to Sellers.

Prefer:
- omit preferences initially; or
- explicit safe whitelist/projection.

Document the choice.

## 19. Cross-Seller isolation

If Seller A and Seller B both receive the same request:

- A may not read B's distribution row;
- A may not infer B's future Proposal;
- A may not access B's future conversation;
- B's identity/count must not leak unless Roadmap explicitly permits it.

## 20. Buyer-facing distribution state

Do not expose Seller identities/counts to Buyer unless Roadmap explicitly requires it.

If Buyer needs a summary, keep it minimal and non-sensitive.

No Proposal semantics yet.

## 21. Matching reasons/auditability

System must be able to explain positive distribution sufficiently for audit:

- request;
- Seller;
- time;
- actor/system;
- relevant eligibility reason/state.

Avoid storing massive durable exclusion rows unless canonical Roadmap requires them.

## 22. Ranking/scoring

Do not implement:
- AI/ML ranking;
- SLA scoring;
- rating weights;
- conversion probability;
- paid boosts.

Do not hardcode illustrative funnel numbers such as `1 → 70 → 25 → 6`.

If deterministic order/limit is required, use simple canonical rules only.

## 23. Entitlement gate

Preserve `Capability ≠ Entitlement`.

If entitlement authority exists, read it only.

If Roadmap requires entitlement but authority is unresolved, stop with `ARCHITECTURE DECISION REQUIRED`.

Do not create entitlement tables here unless Roadmap explicitly says so.

## 24. Eligibility races

Review races:
- capability deactivated during matching;
- acceptsBuyerRequests turned off;
- Seller becomes inactive;
- request cancelled.

No new distribution may commit for an ineligible Seller/request at commit time.

Do not delete prior audit history silently.

## 25. No Proposal / no chat / no Sales conversion

Do not create:
- SellerProposal;
- Proposal ID;
- proposal amount;
- CML/chat automatically unless Roadmap explicitly assigns that to 2.2C;
- Lead/Opportunity/Quote/Sale.

Steps 2.2D, 2.2E and 2.2F own those concerns.

## 26. RBAC / permissions

Introduce minimum capability-driven permissions consistent with repository conventions.

Seller may read only own distributed requests.

Seller must never have a permission/API allowing it to self-create distribution.

Buyer must not mutate Seller distribution facts.

Internal/system matching command, if any, must have explicit authority.

## 27. Mass assignment

Reject forged server-owned fields, including:
- sellerId;
- buyerRequestId where route/server-owned;
- status;
- matchedAt/distributedAt;
- eligibility reason;
- rank/score;
- contactDisclosed;
- proposalId;
- Buyer contact data;
- version;
- timestamps;
- actor/system fields.

## 28. Concurrency

Required proof:
- concurrent matching runs;
- duplicate delivery/retry;
- request cancel vs matching;
- capability deactivate vs matching;
- acceptsBuyerRequests off vs matching;
- Seller deactivate vs matching.

Expected:
- no duplicate rows;
- no impossible eligibility result;
- no duplicate history/audit;
- deterministic final state.

## 29. Failure atomicity / batch semantics

If matching many Sellers:
define whether the batch is:
- one transaction; or
- per-Seller idempotent writes with observable run semantics.

No untracked partial state.

A retry must safely converge.

No Sales/Proposal/Communication side effects on partial failure.

## 30. JSONB destination matching

This is a major implementation gate.

Step 2.2A allowed JSONB as a deferred representation; Step 2.2C now needs real matching.

Use a correct deterministic approach, e.g.:
- narrow candidates by indexed status/category/accept flags;
- evaluate normalized coverage using pure application logic;
- or use safe SQL JSONB containment where semantics are exact.

Do not use string matching.

Document scalability implications honestly.

If correctness cannot be guaranteed, stop with architecture decision.

## 31. Pure eligibility helper

Prefer unit-testable matching logic with inputs such as:
- request status/category/destination;
- capability status/category/destination/accept flag;
- Seller status;
- entitlement if available.

Output:
- eligible true/false;
- optional reason codes.

No writes from the pure helper.

## 32. Query/index strategy

Review/add indexes justified by actual matching:
- BuyerRequest status/category;
- SellerCapability status/category;
- acceptsBuyerRequests;
- Seller;
- distribution uniqueness;
- Seller own inbox.

Avoid speculative ranking indexes.

## 33. Migration

Additive only.

Expected reverse-owned persistence only.

No prohibited cross-schema FK.
No destructive backfill.
No `db push`.
Clean replay.
Drift 0.

## 34. IDs

Introduce a business prefix only if distribution is genuinely user-facing and repository conventions require it.

Do not invent Proposal prefix.

UUID-only internal distribution may be preferable.

## 35. Required E2E/unit proof

At minimum prove:

1. anonymous cannot invoke privileged matching;
2. Seller cannot self-match;
3. DRAFT request not distributable;
4. CANCELLED request not distributable;
5. SUBMITTED request distributable;
6. category mismatch excluded;
7. inactive capability excluded;
8. acceptsBuyerRequests=false excluded;
9. inactive Seller excluded;
10. AZ/Baku Seller with HOTEL→TR capability matches TR hotel request;
11. legal country alone does not match;
12. country coverage matches same-country city request if canonical;
13. city coverage matches same city;
14. city coverage excludes other city;
15. worldwide matches valid destination;
16. capability with zero Products can match;
17. entitlement handled canonically;
18. duplicate matching run creates no duplicate distribution;
19. concurrent matching is idempotent;
20. cancel vs matching race safe;
21. capability disable vs matching race safe;
22. cross-Seller isolation;
23. unmatched Seller list/get denied;
24. distributed Seller list/get allowed only safe projection;
25. no Buyer contact PII;
26. arbitrary preferences do not leak;
27. Seller cannot see another Seller distribution;
28. no Proposal;
29. no Communication unless explicitly canonical;
30. no Lead/Opportunity/Quote/Sale;
31. no Order/Booking/Payment;
32. no Catalog mutation;
33. history/audit;
34. failure atomicity;
35. pagination/determinism;
36. migration replay/drift.

One test may prove multiple invariants.

## 36. Full regression

Run:
- backend TypeScript compile;
- full unit;
- Step 2.2C targeted E2E;
- Step 2.2B regression;
- Step 2.2A regression;
- Step 2.5B acquisition regression;
- relevant auth/RBAC/event tests;
- full serial E2E;
- frontend TypeScript;
- frontend Vitest;
- production build;
- migrate status;
- clean replay;
- drift.

Report exact counts.

## 37. Documentation

Document:
- ownership;
- matching trigger;
- eligibility gates;
- legal country != coverage;
- capability != entitlement;
- destination matching semantics;
- distribution persistence;
- idempotency;
- Seller inbox;
- safe Seller projection;
- `MATCHED != CONTACT DISCLOSED`;
- cross-Seller isolation;
- concurrency/failure semantics;
- events/outbox;
- indexes/query strategy;
- deferred ranking/SLA/entitlement/contact disclosure;
- compatibility with Step 2.2D.

## 38. Roadmap update

Only after green implementation/regression:

Mark:

`2.2C IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Set active item:

`Step 2.2C STRICT REVIEW`

Keep Step 2.2D blocked/not started.

Do not mark 2.2C approved in this pass.

## 39. Architecture stop conditions

STOP with `ARCHITECTURE DECISION REQUIRED` if implementation requires:
- moving matching ownership out of reverse.*;
- inventing entitlement authority;
- resolving DD-028 globally;
- second taxonomy;
- legal country as coverage;
- auto-Sales creation;
- contact disclosure policy;
- Proposal implementation;
- Communication ownership change;
- Service Templates/Pricing;
- unsafe JSONB matching;
- cross-context writes.

## 40. Required final report

Return:

# PHASE 2 — STEP 2.2C — MATCHING & DISTRIBUTION — ОТЧЁТ

## 1. Verdict
`PHASE 2 STEP 2.2C IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
or
`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. Current → Target mapping
## 5. reverse.* ownership
## 6. Matching trigger
## 7. Eligibility model
## 8. Category match
## 9. Destination coverage match
## 10. Legal location vs coverage
## 11. Capability vs entitlement
## 12. BuyerRequest status gate
## 13. Distribution persistence model
## 14. Matched vs distributed semantics
## 15. Idempotency / duplicate prevention
## 16. Seller request inbox/read model
## 17. Seller projection / privacy
## 18. Cross-Seller isolation
## 19. Contact disclosure boundary
## 20. Buyer-facing distribution semantics
## 21. RBAC / permissions
## 22. Mass assignment
## 23. Concurrency
## 24. Failure atomicity
## 25. Batch semantics
## 26. Events / outbox / inbox
## 27. JSONB destination matching
## 28. Query paths / indexes
## 29. Ranking / limits
## 30. Catalog isolation
## 31. Sales isolation
## 32. Communication isolation
## 33. No Proposal
## 34. Migration
## 35. IDs
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

## 41. STOP CONDITION

After implementation and validation: STOP.

Do NOT perform Step 2.2C Strict Review in the same pass.
Do NOT start Step 2.2D.
Do NOT implement Seller Proposal.
Do NOT implement Reverse Marketplace chat.
Do NOT implement Sales conversion.
Do NOT execute Universal Pricing Model Amendment.
Do NOT implement Service Templates 1.8A–1.8D.

Wait for a separate Step 2.2C STRICT REVIEW prompt.
