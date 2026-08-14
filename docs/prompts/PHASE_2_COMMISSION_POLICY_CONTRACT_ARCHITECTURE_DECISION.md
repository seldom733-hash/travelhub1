# PHASE 2 — COMMISSION POLICY CONTRACT — ARCHITECTURE DECISION PROMPT

## 0. MODE

**ARCHITECTURE DECISION ONLY · REPOSITORY-FIRST · NO PRODUCTION IMPLEMENTATION**

This pass exists because:

`PHASE 2 COMMISSION DEPENDENCY RECONCILIATION COMPLETED — ARCHITECTURE DECISION REQUIRED`

and because Step 2.14 remains:

`PHASE 2 STEP 2.14 BLOCKED — ARCHITECTURE DECISION REQUIRED`

The repository currently has no canonical Commission policy authority, rate source, base definition, freeze boundary, collection-mode policy, or adjustment strategy.

Do not write production code in this pass.

---

# 1. PRIMARY OBJECTIVE

Produce a canonical **Commission Policy Contract** for TravelHub that is precise enough to unblock:

1. Step 2.14E — Channel-Based Commission Rules foundation;
2. Step 2.12E — PARTNER_COLLECT CommissionAccrual;
3. Step 2.12C — SPLIT_AT_PAYMENT native PSP split, after 2.12A/2.12B prerequisites;
4. Step 2.14 — Invoice / Commission Flow.

This is not a rate-setting exercise.

The goal is to define **structure, ownership, semantics, lifecycle boundaries and invariants**, not actual commercial percentages.

---

# 2. REQUIRED INPUTS

Read and reconcile the actual repository sources:

- current canonical Roadmap v3;
- Commission Dependency Reconciliation report;
- blocked Step 2.14 report;
- ADR-0006 and related ADRs;
- Finance Domain Foundation;
- Pricing & Financial Snapshot;
- Payment Flow;
- Refund Flow;
- Chargeback / Dispute Foundation;
- ProviderFee / Settlement / Payout foundation;
- Ledger foundation;
- Finance Temporal Contract;
- schema.prisma;
- existing Commission / CommissionAccrual models;
- acquisition/channel concepts;
- Storefront / seller / partner / Catalog structures;
- api.md / events.md / ids.md;
- RBAC matrix;
- Screen Design Finance Center;
- legacy only as evidence, never automatic authority.

Do not rely on generic SaaS marketplace conventions unless explicitly marked as a proposal requiring approval.

---

# 3. CURRENT FACTS THAT MUST BE PRESERVED

Unless direct repository evidence contradicts them, preserve:

- ProviderFee = external PSP/bank cost;
- TravelHub Commission = platform commercial revenue/share;
- CommissionAccrual = receivable owed by Partner to TravelHub under PARTNER_COLLECT;
- Storefront SaaS subscription is a distinct commercial model;
- Payment ≠ Commission;
- Settlement ≠ Commission;
- Payout ≠ Commission;
- Invoice ≠ Commission;
- current frozen commercial snapshots do not contain commission facts;
- current Payment/Refund/Dispute flows do not calculate commission;
- historical money must not be reconstructed from mutable current policy;
- hardcoded rates are forbidden;
- 2.12C SPLIT_AT_PAYMENT depends on real PSP prerequisites 2.12A/2.12B;
- 2.14E must provide/own the missing policy layer unless the ADR establishes a more canonical owner.

---

# 4. OUTPUT REQUIREMENT

Create a formal ADR:

`docs/architecture/adr/ADR-COMMISSION-POLICY-CONTRACT.md`

Use the repository’s real ADR numbering convention if one exists. If the next ADR number is determinable from the repo, use it instead of the placeholder.

Also create a decision report:

`docs/prompts/PHASE_2_COMMISSION_POLICY_CONTRACT_ARCHITECTURE_DECISION_REPORT.md`

Do not modify production code/schema.

---

# 5. DECISION 1 — POLICY OWNER

Choose exactly one canonical owner for mutable Commission policy.

Evaluate at minimum:

### Option A — Finance-owned policy
Finance owns commission rules because Commission is a Finance fact.

### Option B — Catalog-owned commercial rule
Catalog owns the commercial rule because rate depends on product/service/channel.

### Option C — Sales/commercial-owned policy
Sales owns policy selection as part of frozen transaction terms.

### Option D — Separate commercial-policy aggregate with Finance ownership
A dedicated Finance/Commercial policy model, read by Sales at freeze time.

Do not choose based on elegance.

Judge against:
- existing domain ownership;
- cross-schema write rules;
- freeze requirements;
- channel-based rules;
- historical reproducibility;
- future partner/seller contracting.

The ADR must name the **single source of truth**.

---

# 6. DECISION 2 — POLICY DIMENSIONS

Determine which dimensions are supported for the first canonical version.

At minimum decide the status of:

- channel / acquisition channel;
- partner/seller;
- product/service;
- category;
- storefront;
- geography;
- currency;
- payment method;
- PSP/provider;
- customer segment;
- effective date;
- priority;
- fallback/default.

For each dimension classify:

- `V1 REQUIRED`
- `V1 SUPPORTED OPTIONAL`
- `DEFERRED`
- `FORBIDDEN AS POLICY DIMENSION`

Do not include dimensions only because marketplaces often use them.

---

# 7. DECISION 3 — COMMISSION RATE TYPES

Define which rule forms V1 supports.

Possible candidates:

- percentage of base;
- fixed amount;
- hybrid fixed + percentage;
- tiered;
- min/max cap.

The ADR must explicitly choose the allowed V1 set.

If only percentage/fixed are justified, defer hybrid/tiered.

Actual rates remain data, never architecture constants.

---

# 8. DECISION 4 — CALCULATION BASE

This is a hard financial decision.

Define the exact canonical base.

Candidates may include:

- gross Order total;
- discounted Order total;
- OrderItem line total;
- amount before tax;
- amount after tax;
- Payment captured amount;
- another frozen amount.

The ADR must explicitly state:

- whether discount is included;
- whether tax is included;
- whether refunds/disputes alter the original base;
- whether commission is order-level or item-level;
- whether multiple sellers/partners require line-level allocation.

If current schema lacks frozen seller/partner identity at the required base granularity, the ADR must state the required snapshot addition.

Do not permit live Catalog lookup to identify historical seller/partner.

---

# 9. DECISION 5 — ROUNDING

Define:

- Decimal authority;
- rounding mode;
- rounding scale;
- whether rounding occurs per line or after aggregate;
- how multiple line commissions sum.

Default should align with existing canonical money contract unless there is a documented reason to differ.

No JS float.

---

# 10. DECISION 6 — POLICY SELECTION TIME

Separate:

1. when mutable Commission policy is selected;
2. when selected policy is frozen;
3. when the Commission fact/accrual is recognized.

Evaluate candidate boundaries:

- Quote ISSUE;
- Checkout binding;
- Sale creation;
- Order creation;
- Payment creation;
- Payment CAPTURED.

The ADR must define these separately.

A later policy change must not alter already-frozen commercial transactions.

---

# 11. DECISION 7 — FROZEN COMMISSION SNAPSHOT

Define the minimum immutable snapshot needed to reproduce historical Commission.

At minimum consider:

- policyId/code;
- policy version;
- rule type;
- rate/fixed amount;
- calculation base amount;
- base currency;
- calculated commission amount;
- channel;
- partner/seller identity;
- source commercial aggregate;
- selectedAt/frozenAt;
- rounding contract version.

Do not copy unnecessary mutable policy data.

The snapshot must be sufficient to reproduce the fact without current policy lookup.

---

# 12. DECISION 8 — COLLECTION MODEL

Define canonical semantics for:

### SPLIT_AT_PAYMENT
TravelHub share is collected through PSP/native split.

### PARTNER_COLLECT
Partner collects buyer money; TravelHub later has a receivable represented by CommissionAccrual.

The ADR must state:

- whether both use the same policy/rate/base;
- what differs only in collection mechanism;
- what event triggers recognition;
- whether the commission fact exists before collection;
- whether Commission and CommissionAccrual are separate facts or different representations.

Do not let PSP decide business policy.

---

# 13. DECISION 9 — COMMISSION FACT vs COMMISSION ACCRUAL

Define exact semantics of existing models:

### Commission
What does one row mean?

### CommissionAccrual
What does one row mean?

Possible distinctions:
- calculation/frozen platform fee fact;
- receivable due from partner;
- collected amount;
- accounting recognition.

Pick canonical meanings from repository-compatible architecture.

Avoid two tables representing the same financial truth.

---

# 14. DECISION 10 — RECOGNITION TRIGGER

For each collection model define when durable facts are created.

Examples to evaluate:

### SPLIT_AT_PAYMENT
- policy frozen before Payment;
- Commission recognized on Payment CAPTURED;
- PSP split later executes collection.

### PARTNER_COLLECT
- policy frozen before/at Order;
- CommissionAccrual recognized on Order/Sale/Payment/fulfillment event.

Do not use examples as authority.

Choose exact triggers and justify them.

---

# 15. DECISION 11 — REFUND ADJUSTMENT STRATEGY

Define how later Refund affects Commission history.

Allowed architecture patterns to evaluate:

### Immutable original + compensating adjustment fact
Preferred for append-only financial truth.

### Mutable commission amount
High risk; use only if repository explicitly supports it.

The ADR must decide:

- whether processed Refund creates a commission adjustment;
- full vs partial refund treatment;
- proportional vs recalculated adjustment;
- which future step owns implementation;
- whether original Commission/Accrual is ever mutated.

Do not implement the adjustment now.

---

# 16. DECISION 12 — DISPUTE / CHARGEBACK ADJUSTMENT STRATEGY

Define whether an OPENED Dispute changes Commission immediately.

Given current Dispute foundation has no won/lost liability outcome, decide whether V1 should:

- do nothing until liability outcome exists;
- create hold/adjustment later;
- another explicitly justified strategy.

Do not invent chargeback accounting in the ADR if provider outcome semantics do not exist.

The likely safe result may be `DEFER UNTIL LIABILITY OUTCOME`, but justify from current architecture.

---

# 17. DECISION 13 — INVOICE CONCEPT SET

Resolve the ambiguity identified during reconciliation.

Define whether TravelHub has:

1. Buyer transaction invoice/receipt;
2. Partner commission invoice;
3. both;
4. other document types.

For each concept define:

- issuer;
- recipient;
- source fact;
- amount authority;
- currency;
- trigger;
- relationship to Commission;
- whether Step 2.14 owns it.

Do not merge buyer invoice and partner commission invoice if they represent different obligations.

---

# 18. DECISION 14 — MULTI-SELLER / PARTNER SNAPSHOT

Reconciliation found that historical seller identity may not be frozen at OrderItem level.

The ADR must decide whether V1 Commission requires:

- frozen `partnerId/sellerId` on OrderItem or upstream frozen snapshot;
- one seller per Order invariant;
- another canonical structure.

Live Catalog lookup after freeze is forbidden for historical commission attribution.

If schema must evolve, specify the required additive snapshot change for a future implementation step.

---

# 19. DECISION 15 — CHANNEL AUTHORITY

Step 2.14E is channel-based.

Define the canonical `channel` vocabulary/source.

Potential existing facts:
- `AcquisitionSource`;
- storefront/channel codes;
- DIRECT / BUYER_REQUEST / MARKETPLACE;
- another field.

Do not reuse AcquisitionSource as Commission channel unless semantics actually match.

If a separate CommissionChannel vocabulary is needed, justify it.

---

# 20. DECISION 16 — EFFECTIVE-DATE / VERSIONING

Mutable policy must be historically deterministic.

Define:

- effectiveFrom;
- effectiveTo;
- version;
- active/inactive;
- overlap handling;
- precedence/specificity;
- same-tier ambiguity behavior.

Prefer fail-closed for ambiguous matching.

Do not use createdAt as policy precedence.

---

# 21. DECISION 17 — POLICY PRECEDENCE

If multiple dimensions/rules can match, define deterministic precedence.

Possible examples:
- partner+channel override;
- channel rule;
- platform default.

Do not adopt this order automatically.

The ADR must state exact V1 precedence and same-tier conflict behavior.

If V1 intentionally allows only one dimension to avoid precedence complexity, state that explicitly.

---

# 22. DECISION 18 — RBAC / POLICY MANAGEMENT

Define who may:

- read Commission policy;
- create/update/archive/activate policy;
- read Commission facts;
- read CommissionAccrual;
- manage adjustments later.

Use actual project role model.

Do not automatically grant OPERATOR or PARTNER.

Partner may eventually see own commission statements, but that is not the same as policy management.

---

# 23. DECISION 19 — EVENT CONTRACT

Determine which events future steps will require.

Possible concepts:
- CommissionPolicySelected/Frozen;
- CommissionAccrued;
- CommissionAdjusted.

Do not create events in this ADR.

Decide only:
- which facts deserve durable events;
- producer;
- consumer boundary;
- minimal payload/provenance.

Avoid speculative events with no consumer/contract.

---

# 24. DECISION 20 — LEDGER BOUNDARY

Preserve Step 2.12D separation.

Decide whether:

- Commission/Accrual creation is independent of ledger posting;
- later ledger posting consumes Commission/Accrual events;
- original Commission fact is not a ledger transaction.

No double-entry design in this ADR unless Roadmap explicitly requires it now.

---

# 25. DECISION 21 — SETTLEMENT / PAYOUT BOUNDARY

Define enough semantics to avoid future confusion:

- Commission determines platform entitlement;
- Settlement determines obligation reconciliation;
- Payout determines money transfer to Partner.

Do not define full settlement formula unless required.

State what inputs settlement will eventually consume.

---

# 26. DECISION 22 — PROVIDER FEE BOUNDARY

Explicitly state:

- ProviderFee is external cost;
- it does not change the canonical Commission rate/base unless future policy explicitly introduces net-of-provider-fee pricing;
- V1 does not silently net ProviderFee into Commission.

If future rules may use it, mark deferred.

---

# 27. DECISION 23 — TAX / FX BOUNDARY

Define V1:

- whether Commission base is tax-inclusive/exclusive;
- whether Commission currency must equal transaction currency;
- whether FX conversion is forbidden until a canonical frozen FX contract exists.

If repository cannot support cross-currency Commission yet, define V1 same-currency only.

Do not invent live FX.

---

# 28. REQUIRED ADR INVARIANTS

The ADR must state explicit invariants, including at minimum:

1. no hardcoded rates;
2. one canonical mutable policy authority;
3. historical Commission never depends on current policy lookup;
4. no JS float money authority;
5. frozen seller/partner/channel attribution;
6. policy selection deterministic;
7. ambiguous policy resolution fails closed;
8. Commission ≠ ProviderFee;
9. Commission ≠ Settlement/Payout;
10. original financial facts are not rewritten for Refund/Dispute corrections;
11. SPLIT_AT_PAYMENT and PARTNER_COLLECT share business policy unless ADR explicitly says otherwise;
12. PSP does not own commission business rules;
13. cross-domain writes remain prohibited;
14. all future modifications are additive-first.

---

# 29. REQUIRED TARGET DATA MODEL — DESIGN ONLY

Without changing schema, specify the minimum future data model needed.

For each proposed model/field mark:

- `REQUIRED`
- `OPTIONAL V1`
- `DEFERRED`

Potential concepts:

### CommissionPolicy / CommissionRule
- code;
- status;
- version;
- rateType;
- rate;
- fixedAmount;
- currency semantics;
- channel;
- partner;
- effective period;
- priority.

### Frozen commission snapshot
Where it belongs:
- Quote?
- Checkout?
- Sale?
- Order/OrderItem?
- dedicated snapshot entity?

### Commission fact
- source;
- amount/currency;
- frozen rule provenance;
- collection model.

### CommissionAccrual
- partner receivable;
- source Commission;
- outstanding/settlement refs only if later canonical.

Do not over-model.

---

# 30. MIGRATION / COMPATIBILITY PLAN — DESIGN ONLY

Specify implementation migration strategy:

- additive nullable-first;
- no fabricated backfill;
- legacy Orders without commission snapshot remain valid;
- no live lookup backfill;
- future facts use new contract;
- how empty foundation Commission/CommissionAccrual tables evolve.

If a uniqueness/index change is required, describe safe evolution.

No migrations in this pass.

---

# 31. EXECUTION ORDER AFTER ADR

Using the decisions above, produce one exact implementation order.

The reconciliation suggested:

`ADR → 2.14E → Strict Review → 2.12E → ... → 2.12A/2.12B → 2.12C → resume 2.14`

But verify this against the ADR.

Explicitly position:

- any required frozen seller/partner snapshot step;
- 2.14E;
- 2.12E;
- 2.12A;
- 2.12B;
- 2.12C;
- 2.12D;
- resume 2.14;
- 2.14A/B if applicable.

Do not use numeric ordering automatically.

---

# 32. DECISION QUALITY GATE

Every decision must include:

- Decision;
- Repository evidence;
- Alternatives considered;
- Why rejected;
- Consequences;
- Future extension point.

If repository evidence does not determine a decision, mark it as:

`REQUIRES PRODUCT/ARCHITECT APPROVAL`

Do not hide uncertainty.

---

# 33. HUMAN DECISION MINIMIZATION

The agent should resolve everything that follows logically from existing architecture.

Only escalate truly absent business choices.

At the end provide a short **Human Decisions Required** section.

Examples of legitimate human decisions:
- whether V1 supports percentage only vs percentage+fixed;
- exact commission base tax treatment if no source defines it;
- policy dimension set if Roadmap only says “channel-based” but not partner overrides;
- invoice concept set if both buyer and partner invoice are plausible.

Do not ask humans to choose implementation details that architecture already determines.

---

# 34. ROADMAP UPDATE POLICY

Only after ADR is approved by the architecture decision pass:

- Step 2.14 remains BLOCKED until its prerequisites are implemented;
- mark `Commission Policy Contract ADR` as decided;
- update dependency edges;
- set exact NEXT implementation step;
- do not mark 2.14E / 2.12C / 2.12E implemented.

This pass may propose Roadmap changes but must not falsely mark implementation complete.

---

# 35. REQUIRED DECISION REPORT

Create:

`docs/prompts/PHASE_2_COMMISSION_POLICY_CONTRACT_ARCHITECTURE_DECISION_REPORT.md`

Required sections:

1. Verdict
2. Repository baseline
3. Sources inspected
4. Existing facts preserved
5. Policy owner decision
6. Policy dimensions
7. Rate types
8. Calculation base
9. Rounding
10. Policy selection boundary
11. Freeze boundary
12. Frozen snapshot contract
13. Collection model
14. Commission vs CommissionAccrual
15. Recognition triggers
16. Refund adjustment strategy
17. Dispute adjustment strategy
18. Invoice concept set
19. Multi-seller/partner snapshot
20. Channel authority
21. Effective-date/versioning
22. Policy precedence
23. RBAC
24. Event contract
25. Ledger boundary
26. Settlement/Payout boundary
27. ProviderFee boundary
28. Tax/FX boundary
29. Target data model
30. Migration/compatibility plan
31. ADR invariants
32. Human decisions required
33. Exact implementation order
34. Roadmap changes proposed/applied
35. Architecture decision status
36. Exact NEXT item
37. Final canonical statement

---

# 36. ALLOWED FINAL VERDICTS

Use exactly one:

### All required structural decisions resolved

`PHASE 2 COMMISSION POLICY CONTRACT — ARCHITECTURE DECISION COMPLETED`

### Some business choices still require human approval

`PHASE 2 COMMISSION POLICY CONTRACT — HUMAN DECISION REQUIRED`

### Repository contradictions prevent a safe decision

`PHASE 2 COMMISSION POLICY CONTRACT — BLOCKED BY CONFLICTING CANONICAL SOURCES`

Do not use `IMPLEMENTATION COMPLETED`.

---

# 37. IF HUMAN DECISION IS REQUIRED

Return a compact decision sheet, not an open-ended question.

For each unresolved item provide:

- Decision ID;
- exact question;
- Option A;
- Option B;
- Option C if necessary;
- architectural consequence of each;
- recommended option **only if recommendation follows from project architecture**, clearly labeled as recommendation rather than fact.

Do not ask for actual rate percentages.

Example format:

`CD-01 — Commission Base Tax Treatment`
- A: discounted total incl. tax
- B: discounted total excl. tax
- consequence...
- recommendation...

---

# 38. NEGATIVE CHECKS

Before completion prove:

1. 0 production code changes;
2. 0 schema changes;
3. 0 migrations;
4. 0 hardcoded rates;
5. 0 PSP implementation;
6. 0 ledger posting;
7. 0 settlement/payout implementation;
8. 0 commission accrual runtime;
9. 0 Invoice runtime;
10. 0 false completion status for 2.14/2.14E/2.12C/2.12E;
11. no rollback of approved 2.12/2.13/2.13A;
12. documentation preserves historical truth.

---

# 39. HARD STOP

After:

- ADR;
- decision report;
- allowed Roadmap architecture metadata update;

STOP.

Do not implement 2.14E.
Do not implement 2.12C.
Do not implement 2.12E.
Do not resume Step 2.14.

The next implementation step must be launched in a separate prompt after the architecture decision is accepted.
