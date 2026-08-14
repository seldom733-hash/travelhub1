# PHASE 2 — COMMISSION DEPENDENCY RECONCILIATION
## Steps 2.12C / 2.12E / 2.14E → unblock Step 2.14

### MODE
**REPOSITORY-FIRST · ARCHITECTURE RECONCILIATION ONLY · NO PRODUCTION IMPLEMENTATION**

This pass exists because:

`PHASE 2 STEP 2.14 BLOCKED — ARCHITECTURE DECISION REQUIRED`

Stop-condition #4 was confirmed: the repository does not currently define a canonical Commission formula/rate/base/source authority, while the relevant responsibility is distributed across planned Steps **2.12C**, **2.12E**, and **2.14E**.

Do **not** implement any of those steps in this pass.

---

# 1. OBJECTIVE

Perform an independent, adversarial reconciliation of the Commission domain and establish the **canonical dependency order and ownership contract** required to unblock Step 2.14.

The reconciliation must answer, from repository evidence wherever possible:

1. What exactly is `Commission` in TravelHub?
2. What exactly is `CommissionAccrual`?
3. What is the difference between:
   - `ProviderFee`;
   - TravelHub `Commission`;
   - `CommissionAccrual`;
   - `Settlement`;
   - `Payout`;
   - Invoice financial facts?
4. Who owns commission policy?
5. Where does a commission rate/rule come from?
6. What is the commission calculation base?
7. At what lifecycle boundary is the applicable policy selected?
8. At what boundary is the rate/base/formula frozen?
9. At what boundary does a commission become a durable financial fact?
10. How do `SPLIT_AT_PAYMENT` and `PARTNER_COLLECT` differ?
11. Which responsibility belongs to 2.12C, 2.12E, 2.14E, and 2.14?
12. Which step must be implemented first?
13. Can Step 2.14 Invoice be implemented independently after reconciliation, or must it remain coupled to Commission?
14. Which questions are genuinely absent from the repository and therefore require an explicit architecture decision?

The result must be sufficiently precise that the next implementation prompt does not need to invent financial semantics.

---

# 2. NON-GOALS / HARD SCOPE

This is **not an implementation pass**.

Do NOT:

- modify production TypeScript;
- modify Prisma schema;
- create migrations;
- create Commission/Invoice runtime writers;
- create PSP adapters;
- create webhook endpoints;
- create ledger posting;
- implement settlement/payout runtime;
- implement partial payments;
- implement tax/FX engines;
- add hardcoded commission rates;
- choose an arbitrary percentage;
- silently infer a commission formula from industry convention;
- silently mark 2.12C, 2.12E, 2.14E, or 2.14 completed;
- begin 2.14A or later steps.

Allowed changes are **documentation / Roadmap reconciliation artifacts only**, and only after the evidence has been established.

---

# 3. BASELINE — VERIFY, DO NOT ASSUME

Start from the actual repository state.

Verify and report:

- current branch;
- current commit;
- dirty/clean worktree;
- latest applied migration;
- Roadmap statuses for:
  - 2.10;
  - 2.10A;
  - 2.10B;
  - 2.10C;
  - 2.11;
  - 2.12;
  - 2.12A–2.12G;
  - 2.13;
  - 2.13A;
  - 2.14;
  - 2.14A+ where relevant;
- confirm Step 2.14 is currently BLOCKED;
- confirm 2.12C / 2.12E / 2.14E are NOT STARTED unless repository facts prove otherwise.

Do not rely on the previous report as authority.

---

# 4. REQUIRED SOURCES

Inspect at minimum:

## Roadmap / architecture

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3*`
- current Roadmap copy in repository
- Screen Design / Finance Center documentation
- architecture docs for:
  - Finance Domain Foundation;
  - LedgerTransaction;
  - ProviderFee / Settlement / Payout;
  - Finance Temporal Contract;
  - Pricing & Financial Snapshot;
  - Payment Flow;
  - Refund Flow;
  - Chargeback / Dispute;
  - blocked Step 2.14;
- ADRs relevant to ownership, cross-domain reads/writes, events, provenance.

## Contracts

- `docs/contracts/api.md`
- `docs/contracts/events.md`
- `docs/contracts/ids.md`
- RBAC matrix / permission constants.

## Production code/schema

Repo-wide inspect/search for:

- `Commission`
- `CommissionAccrual`
- `commission`
- `rate`
- `fee`
- `ProviderFee`
- `Settlement`
- `Payout`
- `Invoice`
- `Payment`
- `Refund`
- `Dispute`
- `Order`
- `Quote`
- `Sale`
- `Tariff`
- partner/seller/channel concepts
- acquisition/source/channel fields
- money snapshot fields
- pricing/tax/FX rules
- any percentage or fixed-fee fields that could plausibly be mistaken for commission policy.

Also inspect legacy only as **evidence**, never as automatic authority.

---

# 5. FIRST HARD GATE — TERMINOLOGY

Build a repository-backed terminology table.

At minimum:

| Concept | Meaning | Owner | Mutable policy or immutable fact? | Existing runtime? | Planned step |
|---|---|---|---|---|---|
| ProviderFee | ? | ? | ? | ? | ? |
| Commission policy/rule | ? | ? | ? | ? | ? |
| Commission | ? | ? | ? | ? | ? |
| CommissionAccrual | ? | ? | ? | ? | ? |
| Settlement | ? | ? | ? | ? | ? |
| Payout | ? | ? | ? | ? | ? |
| Invoice | ? | ? | ? | ? | ? |

Hard requirement:

**ProviderFee MUST NOT be reused as TravelHub Commission merely because both are “fees”.**

If repository semantics conflict, stop and report the conflict.

---

# 6. SECOND HARD GATE — CURRENT COMMISSION MODELS

Inspect the actual Prisma models for `Commission` and `CommissionAccrual`.

For each field, classify it as:

- identity;
- source/provenance;
- frozen money fact;
- lifecycle;
- policy reference;
- calculation input;
- calculation result;
- audit/provenance metadata.

Determine what is **missing** to calculate a commission reproducibly.

Specifically answer whether the current models contain:

- rate;
- rate type;
- fixed amount;
- percentage;
- base;
- rule/policy ID;
- channel;
- seller/partner dimension;
- product/category dimension;
- effectiveFrom/effectiveTo;
- priority;
- currency semantics;
- rounding semantics;
- calculation version;
- source payment/order/sale;
- gross/net base;
- refund/dispute adjustment semantics.

Do not propose fields yet. First establish facts.

---

# 7. THIRD HARD GATE — COMMISSION POLICY AUTHORITY

Determine whether a canonical policy authority already exists.

Search all plausible locations:

- Finance;
- Sales;
- Catalog;
- Partner/Seller;
- Settings;
- Product/Tariff;
- Quote;
- Checkout;
- Sale;
- Order;
- Payment;
- legacy.

Classify result as exactly one of:

### A. EXISTING AUTHORITY
A repository-backed commission policy already exists and can be reused.

### B. PARTIAL AUTHORITY
Some inputs exist, but formula/base/rate selection is incomplete.

### C. NO AUTHORITY
No canonical policy exists.

Do not upgrade B/C to A by inference.

---

# 8. COMMISSION BASE RECONCILIATION

Enumerate all plausible frozen monetary facts already present, including at least:

- Quote snapshot;
- CheckoutIntent;
- Sale;
- Order;
- OrderItem;
- Payment;
- Refund.

For each candidate base answer:

- Is it frozen?
- Is it canonical at the relevant point?
- Is currency frozen?
- Does it include discount?
- Does it include tax?
- Is it before/after refund?
- Is it per-order or per-line?
- Can it represent multi-seller/multi-item cases?
- Would using it require repricing or mutable lookup?

Do **not** choose the base merely because it is convenient.

If Roadmap does not define gross/net/tax/discount treatment, mark that as an unresolved architecture decision.

---

# 9. RATE / RULE SOURCE RECONCILIATION

Determine which dimensions the repository indicates commission rules may depend on.

Explicitly investigate:

- channel/acquisition channel;
- partner/seller;
- product/service;
- category;
- geography;
- currency;
- payment method/provider;
- contract/tariff;
- effective dates;
- fixed vs percentage;
- min/max/cap;
- priority/fallback.

For every dimension classify:

- `REQUIRED BY EXISTING CONTRACT`
- `SUPPORTED BY EVIDENCE BUT NOT YET CONTRACTED`
- `NOT SUPPORTED / DO NOT INVENT`

Pay special attention to **Step 2.14E — Channel-Based Rules** and its statement that rates must not be hardcoded.

---

# 10. POLICY VS FACT — REQUIRED SEPARATION

The reconciliation must explicitly distinguish:

### Mutable configuration
Example conceptual category: “commission policy/rule”.

from

### Frozen transaction fact
The exact rate/base/formula/result that applied to a particular commercial transaction.

A historical commission must remain reproducible even if the mutable policy changes later.

Determine from repository evidence where freeze should occur.

If the repository does not decide this, mark it `ARCHITECTURE DECISION REQUIRED`.

Do not solve it by silently reading the current rule at reporting time.

---

# 11. LIFECYCLE BOUNDARY

Evaluate candidate boundaries:

- Quote ISSUE;
- Checkout creation/binding;
- Sale creation;
- Order creation;
- Payment creation;
- Payment CAPTURED;
- Settlement;
- Invoice issuance.

For each, state whether it is suitable for:

1. policy selection;
2. policy freeze;
3. commission recognition/accrual;
4. invoicing.

Use existing lifecycle semantics as evidence.

Do not conflate “rate frozen” with “commission accrued”.

---

# 12. SPLIT_AT_PAYMENT — STEP 2.12C

Read the exact Roadmap entry and all references.

Determine the minimum intended responsibility of 2.12C.

At minimum reconcile:

- whether this is a **collection mechanism** or a **policy engine**;
- native PSP split semantics;
- when TravelHub’s share becomes known;
- whether the PSP receives a precomputed frozen commission amount or computes it;
- whether 2.12C is allowed to own rate selection;
- what provider-neutral facts must exist before PSP-specific split logic;
- whether real implementation depends on 2.12A/2.12B.

Hard gate:

**Do not let PSP mechanics become the canonical source of commission business policy unless repository contracts explicitly say so.**

---

# 13. PARTNER_COLLECT — STEP 2.12E

Read the exact Roadmap entry and all references.

Determine the minimum intended responsibility of 2.12E.

At minimum reconcile:

- meaning of `PARTNER_COLLECT`;
- why it produces `CommissionAccrual`;
- what event/fact triggers accrual;
- whether accrual is receivable owed by Partner to TravelHub;
- whether it depends on Payment CAPTURED;
- whether it can exist without PSP split;
- whether it needs Invoice;
- whether it needs Settlement/Payout;
- what happens on Refund/Dispute.

Do not invent accounting entries.

---

# 14. CHANNEL-BASED RULES — STEP 2.14E

Read the exact Roadmap entry and all references.

Determine whether 2.14E is intended to be:

- the commission policy master-data owner;
- a selector over policies owned elsewhere;
- an extension of a more general policy engine;
- only a channel override layer.

Explicitly reconcile the statement:

> “Никаких hardcoded ставок”

with the absence of rate/policy authority.

Answer whether **2.14E must precede 2.12C and 2.12E** for business-policy reasons even though its numeric label is later.

This is a central question of this pass.

---

# 15. COMMISSION VS PAYMENT

Determine:

- whether commission is calculated from Payment or from the commercial snapshot;
- whether Payment merely triggers recognition;
- whether failed/cancelled Payment creates any commission fact;
- whether CAPTURED Payment is required for SPLIT_AT_PAYMENT;
- whether PARTNER_COLLECT has the same trigger;
- whether multiple payment attempts must produce one or multiple commission facts.

Do not implement partial-payment semantics (2.12F).

If partial payment changes the answer materially, document the dependency.

---

# 16. COMMISSION VS REFUND

Reconcile existing Refund semantics with future commission semantics.

Answer:

- does Refund mutate an existing Commission fact?
- should historical commission be overwritten?
- would adjustment require a new compensating fact?
- is this defined anywhere?
- which future step owns it?

Hard gate:

**Never rewrite historical financial facts to make current totals look correct.**

If adjustment semantics are absent, explicitly defer them.

---

# 17. COMMISSION VS DISPUTE / CHARGEBACK

Same analysis for Dispute.

Current provider-neutral Dispute foundation must not be retroactively given financial netting semantics.

Determine whether dispute/chargeback should:

- affect policy;
- affect accrual;
- create an adjustment;
- wait for PSP-specific chargeback work.

If not defined, defer.

---

# 18. COMMISSION VS PROVIDER FEE

Prove the distinction with concrete source and destination semantics.

At minimum:

- ProviderFee = external PSP/bank cost;
- Commission = TravelHub commercial revenue/share — only if repository evidence supports this exact statement.

Determine whether one may be calculated independently of the other.

Do not net ProviderFee into Commission unless explicitly contracted.

---

# 19. COMMISSION VS LEDGER

Step 2.12D is deferred.

Determine:

- whether Commission/CommissionAccrual creation should automatically post LedgerTransaction;
- whether that is explicitly assigned to 2.12D or another step;
- whether 2.14 can create commission facts while ledger posting remains deferred.

No ledger writer may be added in this pass.

---

# 20. COMMISSION VS SETTLEMENT / PAYOUT

Reconcile:

- TravelHub commission;
- amount owed to Partner;
- Settlement;
- Payout.

Determine whether payout amount can be derived without a canonical commission fact.

Identify dependencies on planned settlement/payout evolution (including 2.14A/2.14B if present).

Do not invent net payout formulas.

---

# 21. INVOICE INDEPENDENCE GATE

Revisit the decision not to implement “half of Step 2.14”.

Determine from repository facts whether Invoice is genuinely independent.

Answer:

1. What is the Invoice source authority?
2. Buyer invoice, Partner invoice, commission invoice, or multiple concepts?
3. Does Invoice require Commission amount?
4. Does PARTNER_COLLECT require an invoice for accrued commission?
5. Can an invoice be issued from frozen Order/Payment facts without commission?
6. Would implementing Invoice first create the wrong invoice concept?

Classify:

- `INVOICE CAN PROCEED INDEPENDENTLY`
- `INVOICE DEPENDS ON COMMISSION CONTRACT`
- `INVOICE SEMANTICS THEMSELVES REQUIRE ARCHITECTURE DECISION`

No implementation in this pass.

---

# 22. DEPENDENCY GRAPH — REQUIRED OUTPUT

Produce a directed dependency graph for at least:

- 2.12A
- 2.12B
- 2.12C
- 2.12D
- 2.12E
- 2.12F
- 2.12G
- 2.13
- 2.13A
- 2.14
- 2.14A
- 2.14B
- 2.14E

Separate:

### Hard prerequisite
Cannot implement correctly without it.

### Soft/future dependency
Can implement now with an additive extension later.

### Independent
No dependency.

Do not infer execution order from numbering.

---

# 23. DECISION MATRIX — REQUIRED

Create a matrix similar to:

| Question | Repository answer | Evidence | Decision status | Owning step |
|---|---|---|---|---|
| Commission policy owner | ... | ... | RESOLVED / ADR REQUIRED | ... |
| Rate source | ... | ... | ... | ... |
| Calculation base | ... | ... | ... | ... |
| Rounding | ... | ... | ... | ... |
| Freeze boundary | ... | ... | ... | ... |
| Accrual trigger | ... | ... | ... | ... |
| SPLIT_AT_PAYMENT behavior | ... | ... | ... | ... |
| PARTNER_COLLECT behavior | ... | ... | ... | ... |
| Refund adjustment | ... | ... | ... | ... |
| Dispute adjustment | ... | ... | ... | ... |
| Ledger posting | ... | ... | ... | ... |
| Invoice dependency | ... | ... | ... | ... |

Every unresolved row must remain unresolved. Do not fill gaps with preference.

---

# 24. ARCHITECTURE DECISION THRESHOLD

An architecture decision is required if any of these remain undefined after repo-first reconciliation:

1. canonical commission policy owner;
2. canonical rate source;
3. commission calculation base;
4. percentage/fixed formula semantics;
5. discount/tax treatment;
6. policy selection dimensions;
7. freeze boundary;
8. SPLIT_AT_PAYMENT vs PARTNER_COLLECT business semantics;
9. historical adjustment model where required for the next implementation;
10. Invoice type/source semantics required by 2.14.

If any required item is unresolved, do **not** pretend reconciliation alone solved it.

Return:

`COMMISSION RECONCILIATION COMPLETED — ARCHITECTURE DECISION REQUIRED`

and enumerate the smallest possible set of decisions the architect/product owner must make.

---

# 25. DO NOT ASK FOR AN ARBITRARY PERCENTAGE

If an ADR is required, do not ask:

> “What commission percentage should we use?”

Instead identify the structural decision.

Example:

- policy scope/dimensions;
- base definition;
- rate type;
- freeze boundary;
- collection model;
- adjustment strategy.

Actual business rates should be configurable master data, not architecture constants, unless the repository explicitly says otherwise.

---

# 26. EXPECTED TARGET ARCHITECTURE — ONLY IF SUPPORTED

You may derive a target architecture only to the extent supported by repository evidence.

A likely separation might be:

`CommissionPolicy/Rule (mutable configuration)`
→ `frozen commission calculation snapshot`
→ collection mode:
`SPLIT_AT_PAYMENT` or `PARTNER_COLLECT`
→ immutable Commission / CommissionAccrual fact
→ later Ledger/Settlement/Invoice adjustments.

However, this is **not authority**.

Validate or reject this shape against the repository. Do not implement it merely because it is reasonable.

---

# 27. EXECUTION ORDER — REQUIRED

At the end, establish exactly one of:

### RESULT A — ORDER FULLY DETERMINED
Example format:

`2.14E foundation → strict review → 2.12C → strict review → 2.12E → strict review → resume 2.14`

Use only if evidence supports it.

### RESULT B — PARTIALLY DETERMINED
State what can safely start and what remains blocked.

### RESULT C — ARCHITECTURE DECISION REQUIRED FIRST
No implementation step may start until specified decisions are made.

The exact NEXT item must be singular and unambiguous.

---

# 28. ROADMAP UPDATE RULES

Roadmap may be updated only to reflect findings.

Required:

- keep 2.14 as BLOCKED until its dependency is genuinely resolved;
- do not mark 2.12C/2.12E/2.14E implemented;
- add explicit prerequisite edges discovered in this reconciliation;
- update authoritative execution sequence if stale;
- preserve already APPROVED steps;
- do not reopen 2.13/2.13A unless a real incompatibility is proven.

---

# 29. REQUIRED NEGATIVE CHECKS

Before verdict, prove:

1. no production implementation was added;
2. no schema/migration change;
3. no hardcoded commission rate;
4. no ProviderFee reused as Commission;
5. no mutable Catalog/Settings value silently made historical authority;
6. no PSP behavior invented;
7. no ledger auto-posting added;
8. no Refund/Dispute historical facts mutated;
9. no Settlement/Payout formula invented;
10. no 2.12C/2.12E/2.14E false completion marker;
11. 2.14 remains blocked unless all required architecture is resolved;
12. no later step was started.

---

# 30. TEST / REGRESSION POLICY

Because this is documentation-only reconciliation:

- full regression is not automatically required if production code/schema remain byte-for-byte unchanged;
- verify git diff to prove that;
- if any executable code/schema/config is changed accidentally, STOP and revert it;
- if Roadmap/docs have automated lint/tests, run the relevant checks.

Report the existing approved baseline separately from tests actually executed in this pass. Never claim old test counts as newly executed.

---

# 31. REQUIRED REPORT

Create:

`docs/prompts/PHASE_2_COMMISSION_DEPENDENCY_RECONCILIATION_2.12C_2.12E_2.14E_REPORT.md`

The report must include:

1. Verdict
2. Repository baseline
3. Sources inspected
4. Why Step 2.14 blocked
5. Terminology reconciliation
6. Existing schema facts
7. Policy authority audit
8. Commission base audit
9. Rate/rule source audit
10. Policy-vs-fact separation
11. Freeze boundary analysis
12. 2.12C responsibility
13. 2.12E responsibility
14. 2.14E responsibility
15. Payment interaction
16. Refund interaction
17. Dispute interaction
18. ProviderFee distinction
19. Ledger boundary
20. Settlement/Payout boundary
21. Invoice independence verdict
22. Dependency graph
23. Decision matrix
24. Unresolved architecture decisions
25. Roadmap changes
26. Negative checks
27. Tests actually executed
28. Exact execution order
29. Exact NEXT item
30. Final canonical status line

---

# 32. ACCEPTABLE FINAL VERDICTS

Use exactly one:

### If repository evidence fully resolves the architecture

`PHASE 2 COMMISSION DEPENDENCY RECONCILIATION COMPLETED — EXECUTION ORDER ESTABLISHED`

### If some implementation can proceed but later decisions remain

`PHASE 2 COMMISSION DEPENDENCY RECONCILIATION COMPLETED — PARTIAL ORDER ESTABLISHED`

### If architecture/product decisions are required before implementation

`PHASE 2 COMMISSION DEPENDENCY RECONCILIATION COMPLETED — ARCHITECTURE DECISION REQUIRED`

Do not use `IMPLEMENTATION COMPLETED`.

---

# 33. STOP CONDITIONS

Immediately stop implementation planning and report evidence if:

1. Roadmap assigns conflicting ownership for commission policy;
2. `Commission` and `CommissionAccrual` semantics conflict between schema/docs;
3. 2.12C requires PSP-specific facts that depend on unimplemented 2.12A/2.12B and no provider-neutral seam exists;
4. 2.12E requires an invoice/accounting model that is undefined;
5. 2.14E is too underspecified to establish policy authority;
6. frozen commercial snapshots cannot support the required commission base;
7. multi-seller/multi-line semantics make an order-level commission base ambiguous;
8. Refund/Dispute adjustment semantics are required immediately but undefined;
9. implementing any candidate next step would require a hardcoded rate/formula;
10. Invoice semantics cannot be distinguished (buyer invoice vs partner commission invoice);
11. any proposed solution would mutate historical money facts after policy changes;
12. the reconciliation discovers that an already APPROVED step encoded incompatible commission semantics.

---

# 34. FINAL INSTRUCTION

Be adversarial.

The purpose is **not** to find a way to resume coding as quickly as possible.

The purpose is to ensure that TravelHub has exactly one reproducible Commission business contract before money-producing code is introduced.

A correct result may be:

`ARCHITECTURE DECISION REQUIRED`.

That is preferable to implementing a plausible but non-canonical financial model.

Do not start the next implementation step in this pass.
