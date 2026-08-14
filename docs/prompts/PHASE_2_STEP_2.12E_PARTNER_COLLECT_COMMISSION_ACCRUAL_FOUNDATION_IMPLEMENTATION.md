# PHASE 2 — STEP 2.12E — PARTNER_COLLECT / COMMISSION ACCRUAL FOUNDATION — IMPLEMENTATION PROMPT

## 0. MODE

**IMPLEMENTATION · REPOSITORY-FIRST · ADR-0013 + STEP 2.14E ARE CANONICAL · STRICT SCOPE**

Implement only:

`PHASE 2 — STEP 2.12E — PARTNER_COLLECT / COMMISSION ACCRUAL FOUNDATION`

This step exists to materialize the **PARTNER_COLLECT CommissionAccrual path** defined by ADR-0013 and enabled by the approved Commission Policy foundation from Step 2.14E.

Do not infer execution order from numbering.

---

# 1. CURRENT DEPENDENCY STATE — VERIFY, DO NOT ASSUME

Expected state to verify from the repository:

- Step 2.13A — APPROVED;
- ADR-0013 — DECIDED;
- Step 2.14E — STRICT REVIEW APPROVED;
- Step 2.14 — BLOCKED;
- Step 2.12E — NEXT backend dependency;
- Step 2.12A — NOT STARTED;
- Step 2.12B — NOT STARTED;
- Step 2.12C — NOT STARTED;
- Step 2.12D — NOT STARTED;
- Step 2.12F — NOT STARTED;
- Step 2.12G — NOT STARTED;
- Step 2.14F — PLANNED UI only;
- Commission Policy UI reconciliation completed;
- `GET /commission-policies/:code/history` remains a future UI prerequisite unless repository now proves otherwise.

Do not start any of those other steps in this pass.

---

# 2. PRIMARY OBJECTIVE

Implement the minimal canonical **PARTNER_COLLECT → CommissionAccrual** foundation.

The result must establish:

1. canonical trigger/producer for PARTNER_COLLECT accrual;
2. canonical source authority;
3. immutable/frozen commission calculation inputs;
4. deterministic use of the already-approved CommissionPolicy;
5. server-owned CommissionAccrual financial fact;
6. idempotency/cardinality/concurrency guarantees;
7. Finance ownership;
8. RBAC/read surface if Roadmap requires it;
9. events only where canonical;
10. zero PSP split;
11. zero Ledger posting;
12. zero Invoice runtime;
13. zero Settlement/Payout execution;
14. zero Refund/Dispute commission adjustment;
15. zero hardcoded rates.

This step must not implement SPLIT_AT_PAYMENT.

---

# 3. REQUIRED CANONICAL SOURCES

Before coding inspect actual current files:

## Architecture / roadmap

- current `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- ADR-0013 Commission Policy Contract;
- Commission Dependency Reconciliation report;
- Step 2.14 BLOCKED report;
- Step 2.14E architecture/report/strict-review report;
- Finance Commission Policy UI reconciliation report;
- Finance Domain Foundation;
- Pricing & Financial Snapshot;
- Payment Flow;
- Refund Flow;
- Dispute Foundation;
- Ledger foundation;
- ProviderFee / Settlement / Payout foundation;
- Finance Temporal Contract.

## Production code

- Prisma schema;
- existing `Commission`;
- existing `CommissionAccrual`;
- `CommissionPolicy`;
- `CommissionPolicyHistory`;
- CommissionPolicy resolver;
- Order / OrderItem frozen money;
- acquisition/channel fields;
- seller/partner identity fields;
- Quote/Checkout/Sale/Order flow;
- Payment Flow;
- Refund Flow;
- Dispute;
- EventBus/outbox/inbox;
- IdsService;
- RBAC;
- AuditLog/history;
- canonical money helpers.

## Contracts

- api.md;
- events.md;
- ids.md;
- RBAC matrix.

Do not trust previous reports if current code differs.

---

# 4. FIRST HARD GATE — PARTNER_COLLECT SEMANTICS

Confirm from ADR-0013 and Roadmap:

`PARTNER_COLLECT` means the Partner collects buyer money and TravelHub later has a receivable represented by `CommissionAccrual`.

Do not reinterpret PARTNER_COLLECT as:

- PSP split;
- payout;
- settlement;
- provider fee;
- invoice;
- ledger posting;
- direct Payment capture by TravelHub.

If repository semantics conflict, STOP:

`PHASE 2 STEP 2.12E BLOCKED — ARCHITECTURE DECISION REQUIRED`

---

# 5. SECOND HARD GATE — TRIGGER AUTHORITY

Determine the exact canonical producer trigger from ADR-0013 / Roadmap.

Possible candidates may include:

- Order creation;
- Sale completion;
- Payment CAPTURED;
- fulfillment.

Do **not** choose by intuition.

The reconciliation/ADR previously indicated PARTNER_COLLECT recognition at **Order creation**; verify this is still canonical.

If actual ADR says Order creation is the recognition trigger:

- producer must consume the canonical Order-created fact or equivalent canonical boundary;
- do not wait for Payment CAPTURED;
- do not require PSP;
- do not derive trigger from mutable UI state.

If trigger authority is ambiguous, STOP.

---

# 6. THIRD HARD GATE — SELLER/PARTNER SNAPSHOT

ADR-0013 requires frozen seller attribution and one-seller fail-closed semantics.

Before any CommissionAccrual producer can run, verify whether the required `sellerPartnerId` is already frozen in the canonical commercial/order chain.

If not yet present:

- do not use live Catalog lookup;
- do not infer current owner from Product;
- do not create accrual without historical seller authority.

If `Order.sellerPartnerId` or equivalent is missing and this step is the explicit canonical place to add it, implement the minimal additive freeze path.

If ownership/freeze location is unresolved, STOP.

Hard invariant:

**Historical CommissionAccrual must never depend on current mutable Catalog seller ownership.**

---

# 7. COMMISSION POLICY SOURCE

Use only the approved Finance-owned CommissionPolicy authority from Step 2.14E.

Rules:

- no hardcoded percentage;
- no ProviderFee-derived rate;
- no PSP-derived rate;
- no Catalog commission rate;
- no Settings commission rate;
- no frontend-supplied rate.

Policy resolution must use canonical:

- channel;
- business instant;
- deterministic resolver;
- fail-closed behavior.

`NO_POLICY` must not silently become 0%.

`NO_COMMISSION_CHANNEL` must not create CommissionAccrual.

---

# 8. POLICY SELECTION / FREEZE BOUNDARY

ADR-0013 defines Quote ISSUE as the canonical policy selection/freeze boundary.

Step 2.12E must consume **frozen commission snapshot facts**, not re-resolve current policy at Order creation, if the snapshot path is already implemented.

Before coding determine:

1. Is commission policy snapshot already frozen at Quote ISSUE?
2. Is it propagated through Checkout → Sale → Order?
3. Does Order contain all fields necessary to calculate/reproduce CommissionAccrual?
4. Is the sellerPartnerId frozen?

If the freeze path is not yet implemented, classify whether this step is required to implement it as a prerequisite.

If current Step 2.12E cannot safely operate without adding the freeze chain, do so only if ADR/Roadmap assigns it as a prerequisite to 2.12E.

Never resolve current policy at accrual time as a shortcut.

---

# 9. FROZEN COMMISSION SNAPSHOT CONTRACT

The frozen snapshot must be sufficient to reproduce history without current policy lookup.

At minimum inspect/require canonical equivalents of:

- CommissionPolicy identity/code;
- policy version;
- CommissionChannel;
- rate type;
- rate;
- calculation base;
- currency;
- calculated commission amount or enough immutable inputs to deterministically calculate it;
- sellerPartnerId;
- selected/frozen business instant;
- source commercial aggregate;
- rounding semantics/version if needed.

Do not copy unnecessary policy metadata.

If the schema cannot support historical reproducibility, STOP or implement the minimal additive snapshot path required by ADR.

---

# 10. CALCULATION BASE

ADR-0013 decided:

- frozen discounted `Order.total`;
- tax-exclusive by construction;
- order-level;
- before Refund;
- multi-seller fail-closed.

Verify actual Order money semantics match ADR-0013.

Do not:

- read live Product/Tariff;
- add tax;
- subtract Refund;
- subtract Dispute;
- subtract ProviderFee;
- convert FX;
- recompute discounts.

Commission base must be the frozen authoritative commercial amount.

---

# 11. COMMISSION CALCULATION

V1:

`PERCENTAGE`

Use canonical Decimal authority.

Conceptually:

`commissionAmount = round(base × frozenRate)`

but exact rounding must use ADR-0013 / existing money helper.

No JS float.

No `Number()` / `parseFloat()` authority.

Do not calculate with current policy rate.

Rate representation remains canonical decimal fraction, e.g.:

`0.15 = 15%`

No fixed/hybrid/tiered logic.

---

# 12. COMMISSION vs COMMISSION ACCRUAL

Reconcile existing schema models.

The ADR must remain authoritative.

Expected conceptual separation:

### Commission
Platform commission financial fact / calculation result or another canonical fact defined by ADR.

### CommissionAccrual
Receivable due from Partner to TravelHub for PARTNER_COLLECT.

Do not create two rows representing the same truth unless ADR explicitly requires both.

Before implementation determine whether PARTNER_COLLECT producer should:

- create Commission only;
- create CommissionAccrual only;
- create Commission + CommissionAccrual linked;
- another exact ADR-defined model.

If current ADR does not unambiguously resolve which table is the primary fact, STOP.

Do not guess from names.

---

# 13. SOURCE IDENTITY / CARDINALITY

Define the business identity of one CommissionAccrual.

Determine whether it is:

- one per Order;
- one per Commission fact;
- one per seller/order;
- one per collection model.

Do not use amount as idempotency identity.

Do not create a key that prevents future legitimate adjustment facts.

Required:

- one canonical accrual for the same source fact;
- replay does not duplicate;
- divergent replay does not silently return incompatible fact;
- future adjustment model remains additive.

---

# 14. IDENTIFIER

Use existing CommissionAccrual ID convention.

The prior architecture referenced `CAA-*`; verify actual ids.md/schema.

Requirements:

- server-owned;
- IdsService;
- same transaction as create;
- unique;
- no random public code alternative.

If prefix is different in the actual repository, use actual canonical prefix.

---

# 15. IMMUTABILITY

CommissionAccrual is a financial fact.

Prefer append-only semantics.

Do not allow arbitrary update/delete.

Frozen fields must never be rewritten:

- source;
- sellerPartnerId;
- amount;
- currency;
- policy/code/version;
- rate/base;
- collection model.

If future lifecycle requires settlement state, do not invent it here unless Roadmap explicitly assigns it.

---

# 16. TEMPORAL CONTRACT

Determine exact producer-backed temporal fields.

ADR/Finance Temporal Contract previously deferred `accruedAt` until recognition semantics existed.

Now Step 2.12E may activate it.

If canonical trigger is Order creation:

- `accruedAt` must represent actual accrual recognition time;
- server-owned UTC;
- first-only;
- not client-supplied;
- not backfilled for legacy history.

Do not invent:

- settledAt;
- paidAt;
- reversedAt;
- collectedAt

unless this step explicitly owns them.

---

# 17. EVENT CONTRACT

ADR-0013 identified:

`CommissionAccrued`

as the canonical durable event for future consumers.

Verify this remains canonical.

If yes:

- producer = Finance/Commission accrual authority;
- payload minimal;
- no PII;
- include only durable business refs/money facts needed by future consumers;
- outbox transactionally atomic with accrual;
- correlation/causation inherited correctly;
- actor semantics correct.

Expected consumers may be future 2.12D/2.14A/2.14, but no consumer must be invented here unless Roadmap explicitly requires it.

---

# 18. OUTBOX / INBOX / IDEMPOTENCY

If producer is event-driven:

- use InboxEvent;
- dedup by consumerId + eventId;
- domain unique invariant;
- narrow P2002 handling;
- unknown P2002 must not silently no-op.

If producer is synchronous/internal command, define equivalent idempotency invariant.

No duplicate CommissionAccrual on replay/concurrency.

---

# 19. DIVERGENT REPLAY — HARD GATE

Explicitly guard against previously found Finance defect class:

**existing fact + divergent payload must NOT return silent success.**

Compare material frozen business fields, including where relevant:

- source;
- sellerPartnerId;
- amount;
- currency;
- policy/version;
- rate;
- base;
- collection model.

Identical replay → no-op/same effect according to convention.

Divergent replay → controlled conflict.

---

# 20. CONCURRENCY

Test real concurrency.

At minimum:

### Case A — duplicate identical source
Two concurrent accrual attempts for same source.

Expected:
- one fact;
- controlled second outcome/no-op;
- no raw 500.

### Case B — divergent payload
Same business identity but divergent amount/rate/source snapshot.

Expected:
- one canonical fact;
- divergent loser → controlled conflict;
- never silent success.

### Case C — producer replay
Same source event replay.

Expected:
- exactly one CommissionAccrual;
- one CommissionAccrued event.

---

# 21. RBAC

CommissionAccrual is financial read data.

Derive actual permission naming from current RBAC conventions and ADR-0013.

Do not reuse `finance.commission.manage` for accrual mutation if accrual is event-created immutable fact.

Likely needs read permission, but verify actual Roadmap.

Management of policy remains separate from read of accrual facts.

PARTNER must not automatically get internal Finance read access.

If later Partner Cabinet needs own accrual statements, defer to explicit scoped permission/UI step.

---

# 22. READ API

If Step 2.12E includes CommissionAccrual read API:

Implement:

- list;
- detail;
- bounded pagination;
- whitelist filters;
- Decimal string serialization;
- 401/403/404;
- no PII.

Potential filters only if supported:

- sellerPartnerId;
- source/order;
- channel;
- date range.

Do not expose arbitrary Prisma filtering.

Do not add mutation API for immutable accrual.

---

# 23. MASS ASSIGNMENT

If there is any command/API surface, forged financial fields must be rejected.

Server-owned:

- code;
- sellerPartnerId if source-derived;
- source refs;
- amount;
- currency;
- policy snapshot;
- rate;
- base;
- accruedAt;
- actor/correlation/causation;
- createdAt;
- version/internal fields.

Use raw body forbidden-key checks where applicable.

---

# 24. PAYMENT BOUNDARY

PARTNER_COLLECT must not require Payment CAPTURED if ADR says Order creation is recognition trigger.

Do not mutate:

- Payment;
- paymentStatus;
- paidAmount;
- Payment milestones.

No PSP code.

No SPLIT_AT_PAYMENT.

---

# 25. REFUND BOUNDARY

Refund adjustment strategy is deferred.

Therefore Step 2.12E:

- does not mutate original CommissionAccrual on Refund;
- does not reduce accrual;
- does not create reversal/adjustment fact unless ADR/Roadmap explicitly assigns it now;
- does not re-resolve policy.

Document future compensating-fact strategy.

---

# 26. DISPUTE BOUNDARY

Current ADR decision:

`DEFER UNTIL LIABILITY OUTCOME`

Therefore:

- OPENED Dispute does not mutate accrual;
- no hold;
- no reversal;
- no commission adjustment.

Do not invent chargeback accounting.

---

# 27. LEDGER BOUNDARY

Step 2.12D remains NOT STARTED.

CommissionAccrual creation must create:

`0 LedgerTransaction`

unless actual Roadmap has been changed and dependency is resolved.

No accounting posting.

No double-entry.

No balances.

---

# 28. PROVIDER FEE BOUNDARY

ProviderFee remains external PSP/bank cost.

CommissionAccrual must not:

- net ProviderFee;
- derive amount from ProviderFee;
- create ProviderFee.

ProviderFee ≠ Commission.

---

# 29. SETTLEMENT / PAYOUT BOUNDARY

Do not:

- create Settlement;
- create Payout;
- mark accrual settled;
- calculate payout net;
- write bank rail data.

Those are later concerns.

---

# 30. INVOICE BOUNDARY

Step 2.14 remains BLOCKED and Invoice runtime not started.

Do not create:

- buyer invoice;
- partner commission invoice;
- invoice line;
- invoice status projection.

CommissionAccrual may be a future source for partner commission invoice, but do not implement it here.

---

# 31. SELLER / MULTI-SELLER FAIL-CLOSED

Critical invariant.

If source commercial/order contains:

- no sellerPartnerId;
- ambiguous seller;
- multiple sellers where V1 only supports one seller;

then:

- no CommissionAccrual;
- controlled failure / no-op according to canonical producer semantics;
- no live Catalog lookup.

Do not fabricate seller identity.

---

# 32. CHANNEL FAIL-CLOSED

Only commission-bearing channel should accrue.

Expected V1 from ADR:

- MARKETPLACE → applicable;
- PARTNER_STOREFRONT → no commission;
- DIRECT → no commission;
- BUYER_REQUEST → no commission.

No accrual for no-commission channels.

Do not convert “no policy” into 0-amount accrual.

---

# 33. POLICY ABSENCE / AMBIGUITY

If frozen snapshot is the canonical contract, absence of a required frozen policy snapshot at accrual time must fail closed.

Do not re-resolve current policy to repair missing history.

If ambiguity should have been prevented at Quote ISSUE, treat it as an invariant violation / controlled failure according to architecture.

No silent fallback rate.

---

# 34. MIGRATION

Only additive Prisma migration.

Possible changes may include:

- sellerPartnerId snapshot;
- commission snapshot fields;
- CommissionAccrual provenance/unique/index fields;
- accruedAt.

Only add fields actually required by ADR-0013 / 2.12E.

Requirements:

- nullable-first for legacy if needed;
- no fabricated historical backfill;
- no `db push`;
- no destructive change to approved Payment/Refund/Dispute rows;
- existing schema-only Commission/Accrual tables preserved safely.

Fresh replay required.

---

# 35. LEGACY COMPATIBILITY

Legacy Orders without seller/commission snapshot:

- remain readable;
- do not receive fabricated current commission;
- do not auto-accrue using today's policy;
- no backfill from live Catalog.

Legacy empty foundation Commission/Accrual tables evolve additively.

---

# 36. REQUIRED NEGATIVE E2E

At minimum prove:

1. no-commission channel → no accrual;
2. missing seller snapshot → no accrual;
3. ambiguous/multi-seller → no accrual;
4. missing frozen commission snapshot → fail closed;
5. invalid/corrupt frozen rate → fail closed;
6. amount/currency cannot be client-forged;
7. duplicate replay → no duplicate;
8. divergent replay → controlled conflict;
9. concurrent duplicate → one accrual;
10. unknown P2002 not silently swallowed;
11. Refund does not mutate accrual;
12. Dispute does not mutate accrual;
13. Payment untouched;
14. Ledger count unchanged;
15. ProviderFee unchanged;
16. Settlement/Payout unchanged;
17. Invoice count unchanged;
18. no PSP/webhook side effects;
19. no live Catalog seller/rate lookup;
20. no hardcoded rates;
21. no raw 500.

---

# 37. REQUIRED POSITIVE E2E

At minimum prove canonical PARTNER_COLLECT flow:

1. commission-bearing channel;
2. valid sellerPartnerId frozen;
3. valid CommissionPolicy selected/frozen at canonical boundary;
4. frozen rate/version propagated;
5. frozen base/currency propagated;
6. Order creation trigger;
7. exactly one CommissionAccrual;
8. canonical CAA-* code;
9. correct Decimal amount;
10. correct sellerPartnerId;
11. correct policy/version provenance;
12. accruedAt server-owned;
13. one history/audit fact if canonical;
14. exactly one CommissionAccrued event if canonical;
15. correlation/causation correct;
16. replay idempotent;
17. concurrent duplicate safe;
18. no unrelated finance/domain side effects.

---

# 38. MULTI-PATH REGRESSION

At minimum preserve:

- DIRECT flow;
- BUYER_REQUEST flow;
- MARKETPLACE flow;
- PARTNER_STOREFRONT if present;
- Payment;
- Refund;
- Dispute;
- Order lifecycle;
- Booking lifecycle;
- pricing snapshot;
- CommissionPolicy.

No previously approved acquisition semantics may be changed just to make Commission easier.

---

# 39. WRITE-PATH AUDIT — HARD GATE

After implementation repo-wide enumerate all production writers for:

- CommissionPolicy;
- Commission;
- CommissionAccrual;
- sellerPartnerId snapshot;
- commission snapshot;
- accruedAt.

Classify each.

Expected:

- CommissionPolicy writer remains Step 2.14E service;
- CommissionAccrual has exactly one canonical producer;
- no cross-domain direct Finance writes into Order if snapshot fields are Order-owned.

If seller/commission snapshots live in Order, writes must be Order-owned via canonical event/creation flow.

---

# 40. CROSS-DOMAIN OWNERSHIP

Finance must not directly mutate Order after creation.

If commission snapshot is carried into Order:

- snapshot should arrive through canonical event payload/frozen creation contract;
- Order owns its persisted fields;
- Finance policy is read during freeze boundary according to ADR.

Do not create direct Finance→Order write.

---

# 41. EVENT LINEAGE

If CommissionAccrual is event-driven:

- correlation must inherit canonical chain;
- causation = triggering event ID;
- actor semantics appropriate to event producer;
- no disconnected random correlation;
- no client-forged lineage.

---

# 42. SECURITY / PII

CommissionAccrual event/API must not expose:

- passport;
- customer personal details;
- bank account;
- card data;
- PSP credentials.

sellerPartnerId and financial refs are business identifiers, not justification for broad PII payloads.

---

# 43. DOCUMENTATION

Create/update:

- `docs/architecture/partner-collect-commission-accrual-foundation.md`;
- api.md if read surface exists;
- events.md for CommissionAccrued if canonical;
- ids.md if CAA-* not already registered;
- ADR-0013 only for non-semantic clarification;
- Roadmap v3;
- temporal/readiness docs if accruedAt becomes canonical;
- pricing snapshot architecture if commission snapshot propagation is added.

Do not modify ADR decisions casually.

---

# 44. IMPLEMENTATION REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.12E_PARTNER_COLLECT_COMMISSION_ACCRUAL_FOUNDATION_IMPLEMENTATION_REPORT.md`

Required sections:

1. Verdict
2. Repository baseline
3. Sources inspected
4. ADR-0013 reconciliation
5. Step 2.14E dependency
6. PARTNER_COLLECT semantics
7. Trigger authority
8. Seller/partner snapshot
9. Policy source
10. Selection/freeze boundary
11. Frozen commission snapshot
12. Calculation base
13. Decimal/rate/rounding
14. Commission vs CommissionAccrual
15. Source identity/cardinality
16. IDs
17. Immutability
18. Temporal contract
19. Event contract
20. Outbox/inbox
21. Idempotency
22. Divergent replay
23. Concurrency
24. RBAC
25. Read API
26. Mass assignment
27. Payment boundary
28. Refund boundary
29. Dispute boundary
30. Ledger boundary
31. ProviderFee boundary
32. Settlement/Payout boundary
33. Invoice boundary
34. Multi-seller behavior
35. Channel behavior
36. Policy absence/ambiguity
37. Migration
38. Legacy compatibility
39. Negative coverage
40. Positive coverage
41. Multi-path regression
42. Write-path audit
43. Cross-domain ownership
44. Event lineage
45. Security/PII
46. Issues found
47. Fixes applied
48. Backend regression
49. Frontend regression
50. DB regression
51. Files changed
52. Deferred scope
53. Architecture decision status
54. Roadmap update
55. Exact NEXT
56. Final canonical statement

---

# 45. REQUIRED REGRESSION

Run actual project commands.

## Backend

- TypeScript check;
- build;
- unit;
- targeted e2e:
  - CommissionPolicy;
  - new CommissionAccrual suite;
  - pricing snapshot;
  - sales/quote/order creation;
  - payment;
  - refund;
  - dispute;
  - ledger;
  - provider fee/settlement/payout;
  - RBAC;
  - event envelope;
  - acquisition propagation;
  - temporal readiness;
- full serial e2e.

## Frontend

Even if unchanged:

- tsc;
- Vitest;
- production build.

## DB

- migrate status;
- live DB → schema diff;
- fresh migration replay through harness.

Report actual counts only.

---

# 46. 2.12A–G CONTAINMENT

Explicitly prove:

### 2.12A
0 PSP adapter integration.

### 2.12B
0 webhook/provider authorization-capture extension.

### 2.12C
0 SPLIT_AT_PAYMENT runtime.

### 2.12D
0 Ledger posting.

### 2.12F
0 partial Payment implementation.

### 2.12G
0 ProviderFee feeType/granularity evolution.

2.12E may only implement PARTNER_COLLECT CommissionAccrual.

---

# 47. 2.14 / 2.14A–F CONTAINMENT

Do not implement:

- Step 2.14 Invoice runtime;
- 2.14A settlement lifecycle;
- 2.14B payout attempts/lifecycle;
- 2.14F UI;
- partner commission invoice;
- buyer invoice;
- version history UI endpoint unless explicitly required by this backend step (normally no).

Step 2.14 remains BLOCKED until dependency chain says otherwise.

---

# 48. HARD STOP CONDITIONS

STOP with:

`PHASE 2 STEP 2.12E BLOCKED — ARCHITECTURE DECISION REQUIRED`

if any of the following is unresolved:

1. PARTNER_COLLECT trigger is ambiguous;
2. Commission vs CommissionAccrual fact semantics remain ambiguous;
3. sellerPartnerId freeze authority is unresolved;
4. frozen commission snapshot location is unresolved;
5. 2.12E would require current-policy re-resolution instead of frozen snapshot;
6. multi-seller support is required but V1 one-seller invariant cannot be enforced;
7. calculation base differs from ADR-0013;
8. commission amount requires tax/FX semantics not defined;
9. implementation requires Payment CAPTURED despite ADR saying Order recognition;
10. implementation requires PSP split;
11. implementation requires Ledger posting;
12. Refund adjustment must be implemented now but policy is deferred;
13. Dispute adjustment requires liability outcome not yet available;
14. existing schema has conflicting CommissionAccrual authority;
15. safe idempotency identity cannot be defined;
16. historical backfill would require mutable live lookup.

Do not guess around a stop condition.

---

# 49. ROADMAP UPDATE

After successful implementation only:

Step 2.12E →

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

NEXT →

`PHASE 2 — STEP 2.12E — STRICT REVIEW`

Do not mark approved.

Do not start 2.12A/B/C/D.

Do not resume 2.14.

---

# 50. ALLOWED FINAL VERDICTS

Successful implementation:

`PHASE 2 STEP 2.12E IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Architecture blocker:

`PHASE 2 STEP 2.12E BLOCKED — ARCHITECTURE DECISION REQUIRED`

Repository mismatch:

`PHASE 2 STEP 2.12E BLOCKED — REPOSITORY BASELINE MISMATCH`

---

# 51. FINAL HARD STOP

After implementation, migration, tests, docs, Roadmap update and implementation report:

**STOP.**

Do not perform Strict Review in this pass.

Do not start 2.12A, 2.12B, 2.12C, 2.12D, 2.12F, 2.12G.

Do not resume Step 2.14.

The only NEXT item after successful implementation is:

`PHASE 2 — STEP 2.12E — STRICT REVIEW`
