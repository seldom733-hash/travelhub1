# TRAVELHUB — ROADMAP RECONCILIATION PROMPT
## Step 2.12I — PSP Contract, Provider Fees & Money-Flow Architecture Reconciliation

**Mode:** repository-first / documentation-only  
**Primary target:** canonical TravelHub Roadmap  
**Related ADR:** ADR-0015 — Payment Provider Selection  
**Status to establish:** `⏳ PLANNED — DEFERRED UNTIL PSP/AGGREGATOR COMMERCIAL AGREEMENT`

---

# 1. Objective

Perform a documentation-only reconciliation that adds/updates the future mandatory step:

> **PHASE 2 — STEP 2.12I — PSP CONTRACT, PROVIDER FEES & MONEY-FLOW ARCHITECTURE RECONCILIATION**

The step MUST be planned now but MUST NOT be implemented now.

Its purpose is to force a repository-backed reconciliation after a real PSP/payment aggregator has been selected and sufficient commercial, contractual and technical evidence is available.

The future reconciliation must determine:

- card-data boundary;
- pay-in architecture;
- settlement architecture;
- all PSP/acquirer/provider fees;
- TravelHub Commission treatment;
- partner payable;
- native split versus payout architecture;
- partner payout fees;
- refund/dispute/chargeback fee treatment;
- FX/wallet/other provider charges;
- reconciliation/accounting sources of truth.

No monetary-flow assumption may be invented in this pass.

---

# 2. Repository-first rule

Before editing anything, verify actual repository state.

Expected preceding state may include:

- Step 2.12A approved;
- Step 2.12H approved;
- Step 2.12B blocked pending provider/commercial confirmation;
- ADR-0015 proposed/blocked;
- Azerbaijan provider RFI and internal workbook;
- ProviderFee / Settlement / Payout foundations;
- CommissionPolicy / Commission / CommissionAccrual foundations;
- Step 2.12C not started.

These are expectations, not authority.

If repository truth differs, use repository truth and report the discrepancy.

---

# 3. Card-data boundary

Record the TravelHub V1 architecture target:

```text
Buyer
  ↓
PSP-hosted / PSP-tokenized card collection
  ↓
Aggregator / Acquirer
  ↓
PSP API + authenticated webhook/callback
  ↓
TravelHub
```

TravelHub SHALL NOT intentionally receive or persist:

```text
raw PAN
CVV/CVC
equivalent sensitive authentication data
```

TravelHub may store only provider-safe references and metadata permitted by the eventual contract/security architecture, for example:

```text
providerPaymentId
providerPaymentMethodId/token
masked PAN metadata / last4 where permitted
card brand
payment status
amount/currency
provider references
timestamps
```

Do NOT assert a specific Azerbaijani statutory prohibition unless verified legal authority exists in the repository.

The architecture requirement remains valid independently of whether its basis is PCI DSS, card-scheme rules, CBA requirements, acquiring contract, local law, or a combination.

---

# 4. ProviderFee is NOT TravelHub Commission — HARD INVARIANT

The Roadmap entry MUST explicitly preserve:

```text
ProviderFee ≠ TravelHub Commission
```

Definitions:

### ProviderFee

External cost charged by:

- PSP;
- payment aggregator;
- acquiring bank;
- card processor;
- scheme/intermediary where exposed through the provider;
- payout provider;
- FX/payment rail where contractually charged.

ProviderFee is a cost/fact associated with external payment infrastructure.

### TravelHub Commission

TravelHub platform revenue governed by TravelHub's Finance-owned commission policy.

Its policy authority remains:

```text
finance.CommissionPolicy
```

The selected PSP MUST NOT silently become the authority for TravelHub commission rates or commercial policy.

---

# 5. Mandatory future provider-fee contract

Step 2.12I MUST reconcile the selected provider's complete fee model from verified commercial/API/reconciliation evidence.

At minimum investigate:

```text
acquiring/payment fee
fixed transaction fee
percentage transaction fee
minimum transaction fee
Apple Pay fee
Google Pay fee
3DS fee
tokenization/card-on-file fee
settlement fee
payout/transfer fee
refund fee
chargeback/dispute fee
FX/conversion fee or spread
cross-border/international-card fee
failed-payment fee, if any
monthly/platform fee, if transaction-attributable or accounting-relevant
reserve/holdback effects
other provider charges
VAT/tax applied to provider fees
```

Do not assume all providers expose or charge all categories.

Do not invent rates.

---

# 6. Provider fee source-of-truth hierarchy

The future 2.12I reconciliation MUST explicitly determine the authoritative source for each ProviderFee.

Preferred principle:

> When the PSP/acquirer supplies an actual finalized fee through settlement/reconciliation/API evidence, TravelHub should record the actual provider-reported monetary fact rather than silently recomputing it from a hardcoded percentage.

The future reconciliation MUST classify each fee source, for example:

```text
PROVISIONAL / ESTIMATED
ACTUAL / PROVIDER-REPORTED
ADJUSTED
FINAL / RECONCILED
```

only if such states fit the actual repository/domain model.

Do NOT add these states now.

The future step must answer:

1. Is fee known at payment creation?
2. At authorization?
3. At capture?
4. Only at settlement?
5. Can it change after settlement?
6. Can refund/dispute produce additional fees?
7. Is the provider fee supplied per transaction or only per batch?
8. Can it be deterministically allocated from settlement batch to Payment?
9. Is VAT/tax separately exposed?
10. What happens if API and settlement report disagree?

---

# 7. Hardcoded provider rates forbidden as accounting truth

Do NOT establish:

```text
providerFee = paymentAmount * 2%
```

or any similar production accounting rule merely from a commercial tariff.

A tariff may be useful for:

- estimation;
- UI preview;
- forecasting;
- validation;
- anomaly detection.

But where the provider later supplies the actual charged fee, the future accounting/reconciliation contract must define how that actual amount supersedes or reconciles the estimate.

Any provider fee calculation fallback must require an explicit later architecture decision and documented authority.

---

# 8. Full money-flow reconciliation

Step 2.12I must eventually map the selected provider's actual contract into one or more explicit money flows.

Illustrative only — NOT a decision:

```text
Buyer payment / Gross
        ↓
PSP acquiring/payment processing
        ↓
ProviderFee(s)
        ↓
Settlement
        ↓
TravelHub accounting / Ledger
        ↓
TravelHub Commission
        ↓
Partner payable
        ↓
PSP/bank payout
        ↓
Payout ProviderFee
        ↓
Partner receives funds
```

The future reconciliation MUST identify monetary equations using the provider's actual contract.

It must explicitly distinguish concepts such as:

```text
gross buyer payment
captured amount
refunded amount
provider acquiring fee
provider refund fee
provider chargeback fee
FX fee/spread
settled gross
settled net
TravelHub Commission
partner payable
payout amount
payout provider fee
partner received amount
```

Do not collapse them into a single generic "commission".

---

# 9. Who economically bears ProviderFee — REQUIRED DECISION

The selected PSP's fee existence does NOT answer who economically bears it.

Step 2.12I MUST obtain explicit business/contract/accounting authority for this.

Possible models to evaluate later include, without selecting one now:

```text
A. TravelHub absorbs ProviderFee as its own expense.

B. ProviderFee reduces the amount economically payable to the partner,
   where contractually/legal/business-approved.

C. Some fees are borne by TravelHub and others by the partner.

D. Buyer-facing surcharge/fee exists where legally and commercially permitted.

E. Provider contract directly allocates fees in a native marketplace/split model.
```

No model may be inferred merely from API behavior.

The Roadmap MUST mark **economic fee bearer** as an explicit decision required by Step 2.12I.

---

# 10. Example — conceptual only

A future verified contract might yield facts such as:

```text
Buyer gross payment        100.00 AZN
TravelHub Commission        15.00 AZN
Provider acquiring fee       2.50 AZN
```

These MUST remain separate facts.

It is forbidden to silently transform this into:

```text
TravelHub Commission = 12.50 AZN
```

unless an explicit commercial/accounting contract actually defines such a concept — in which case it still must not overwrite the original commission and provider-fee facts.

The example is explanatory only and MUST NOT become fixture/master-data/rate authority.

---

# 11. Native split versus settlement/payout

Do NOT decide this now.

The future decision tree must remain explicit:

```text
Selected PSP + verified commercial/technical evidence
                    ↓
                 2.12I
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
native split supported      native split unavailable /
and approved                unsuitable / not permitted
        ↓                       ↓
reconcile Step 2.12C        separate architecture/business ADR
SPLIT_AT_PAYMENT            before changing Step 2.12C
```

A payout API is NOT equivalent to native `SPLIT_AT_PAYMENT`.

There must be no silent replacement of Step 2.12C.

---

# 12. Marketplace/legal/contractual gate

Step 2.12I MUST explicitly verify whether the selected provider's commercial/regulatory model permits TravelHub to:

- accept payment for partner-supplied services;
- receive settlement relating to partner transactions;
- deduct/retain TravelHub Commission;
- hold or account for partner payable amounts;
- initiate partner payouts;
- use sub-merchants/beneficiaries/connected accounts;
- perform or delegate partner KYB/KYC.

Technical existence of `POST /payout` is NOT sufficient authority.

Do not fabricate legal conclusions.

---

# 13. Pay-in fees

For buyer payment processing, determine later:

- fee trigger;
- provisional versus final amount;
- fixed + percentage components;
- domestic vs international cards;
- wallet-specific fees;
- 3DS fees;
- FX;
- tax/VAT;
- reversal behavior;
- settlement representation;
- provider reference;
- reconciliation mapping.

---

# 14. Payout fees

If partner payout is used, Step 2.12I MUST separately determine:

- payout fee;
- fixed/percentage structure;
- who bears it;
- whether fee is deducted from payout or billed separately;
- AZN support;
- provider payout ID;
- payout status;
- failure/retry behavior;
- payout reversal;
- provider idempotency;
- settlement/reconciliation source.

Never merge payout fees with acquiring fees.

---

# 15. Refund fee treatment

Step 2.12I MUST determine from provider evidence:

- whether original acquiring fee is returned;
- partially returned;
- retained;
- whether a separate refund fee exists;
- whether partial refunds affect fees proportionally;
- whether provider reports actual refund fee;
- how settlement adjustments appear;
- how TravelHub Commission adjustment remains separate from ProviderFee adjustment.

---

# 16. Chargeback/dispute fee treatment

Determine:

- dispute/chargeback fee;
- when it is charged;
- whether it is refunded if TravelHub wins;
- liability allocation;
- settlement adjustment;
- provider reference;
- relationship to original Payment;
- relationship to partner payable;
- relationship to TravelHub Commission adjustments.

Do not infer liability from technical status alone.

---

# 17. FX treatment

If any provider flow uses currency conversion, Step 2.12I MUST determine:

- original presentment currency;
- settlement currency;
- payout currency;
- provider FX rate;
- spread/markup;
- explicit FX fee if any;
- timestamp/rate source;
- actual settled amount;
- reconciliation source;
- who economically bears FX cost.

AZN presentment MUST NOT be treated as proof of AZN settlement.

---

# 18. Settlement reconciliation

The future step MUST map provider evidence to internal foundations.

At minimum:

```text
Payment
ProviderFee
Settlement
Ledger
Commission
CommissionAccrual
Payout
Refund
Dispute-related facts where present
```

The reconciliation must answer:

- what provider artifact closes the accounting uncertainty;
- whether API state or settlement report is authoritative;
- how batch settlement maps to individual payments;
- how late adjustments are represented;
- how duplicate settlement imports are prevented;
- how divergence is detected;
- how immutable accounting facts are corrected.

Do not implement this now.

---

# 19. ProviderFee idempotency and identity

Step 2.12I MUST define how an actual provider fee is identified and deduplicated.

Potential evidence inputs may include:

```text
provider transaction ID
settlement ID
fee line ID
payout ID
refund ID
dispute ID
provider reference
```

The future implementation must prevent:

- duplicate fee facts from webhook + settlement import;
- duplicate fee facts after retry;
- silently overwriting a different amount;
- assigning one provider fee to the wrong payment/payout.

Exact keys must come from the selected provider contract.

---

# 20. RFI requirements

Inspect:

```text
docs/commercial/az-payment-provider-rfi.md
docs/commercial/az-payment-provider-rfi-internal-workbook.md
```

or actual repository paths.

Confirm the RFI requests enough evidence for:

- transaction/acquiring fees;
- fixed/percentage components;
- settlement fees;
- payout fees;
- refund fees;
- dispute/chargeback fees;
- wallet fees;
- FX;
- VAT/tax;
- gross/net settlement;
- transaction-level fee data;
- settlement/batch reports;
- actual fee availability timing;
- fee reversals/adjustments;
- who is contractually charged.

If a material gap exists, make the smallest documentation-only amendment.

Do not rewrite provider-facing material unnecessarily.

---

# 21. Roadmap entry

Add/update a canonical entry equivalent to:

> **Step 2.12I — PSP Contract, Provider Fees & Money-Flow Architecture Reconciliation**  
> **Status:** `⏳ PLANNED — DEFERRED UNTIL PSP/AGGREGATOR COMMERCIAL AGREEMENT`

Purpose:

> After canonical PSP selection and sufficient commercial/technical evidence, reconcile card-data boundary, pay-in, ProviderFee, settlement, TravelHub Commission, partner payable, native split versus payout, refunds/disputes/FX and reconciliation before downstream production money-flow implementation.

Hard prerequisites:

1. ADR-0015 accepted/equivalent provider decision;
2. merchant onboarding confirmed;
3. provider API docs;
4. sandbox/test capability;
5. commercial tariff/quote;
6. contractual marketplace model;
7. settlement model;
8. actual fee/reconciliation evidence;
9. native split explicitly supported/rejected;
10. payout explicitly supported/rejected.

---

# 22. Dependency chain

Record a dependency chain equivalent to:

```text
2.12A APPROVED
   ↓
2.12H APPROVED
   ↓
2.12B provider/commercial selection
   ↓
ADR-0015 ACCEPTED
   ↓
provider-specific buyer-payment integration as Roadmap permits
   ↓
2.12I PSP CONTRACT, PROVIDER FEES & MONEY-FLOW RECONCILIATION
   ↓
explicit downstream decision
   ├── native SPLIT_AT_PAYMENT
   └── separately approved settlement/ledger/payout architecture
```

Do not renumber existing steps.

---

# 23. ADR-0015 minimal amendment

Update ADR-0015 minimally to establish:

- provider selection does not itself decide the final marketplace money flow;
- hosted/tokenized card boundary is the target;
- ProviderFee is separate from TravelHub Commission;
- provider commercial tariff is not automatically accounting truth;
- actual provider-reported fee/reconciliation evidence should be used where available;
- economic bearer of fees is a later explicit business/accounting decision;
- native split is not assumed;
- payout is not native split;
- Step 2.12I is the mandatory post-selection reconciliation gate.

Do NOT move ADR-0015 to ACCEPTED without actual evidence.

---

# 24. No runtime implementation

Forbidden in this pass:

```text
PSP SDK
provider adapter
HTTP/network PSP integration
webhook route
card UI/form
PAN/CVV fields
tokenization runtime
Payment runtime changes
ProviderFee runtime changes
Settlement runtime changes
Payout runtime changes
Ledger runtime changes
Commission runtime changes
Refund/Dispute runtime changes
schema changes
migration
new production tests
credentials/secrets
provider selection
fee rates
commercial assumptions
```

Expected non-doc diff:

```text
0
```

---

# 25. Artifact integrity

Run the existing Roadmap artifact checker and its regression tests.

Final expected baseline:

```text
WARN = 0
FAIL = 0
```

Use actual PASS counts only.

Do not hide unrelated findings.

---

# 26. Required report

Create a report, suggested path:

```text
docs/prompts/TRAVELHUB_STEP_2.12I_PSP_PROVIDER_FEES_MONEY_FLOW_ROADMAP_RECONCILIATION_REPORT.md
```

It must include:

- repository evidence inspected;
- exact Step 2.12I Roadmap entry;
- ProviderFee hard invariant;
- fee categories captured;
- economic-fee-bearer decision deferred;
- actual-vs-estimated fee rule;
- 2.12C guardrail;
- ADR-0015 amendment;
- RFI review/amendment;
- negative checks;
- artifact integrity;
- persistence/provenance.

---

# 27. Git / persistence

Before edits:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse @{upstream}
```

Never use:

```bash
git add .
git add -A
```

Stage only explicit documentation files.

Check:

```bash
git diff --check
git diff --cached --stat
git diff --cached
```

Suggested commit:

```bash
git commit -m "docs: add PSP provider-fee and money-flow reconciliation gate"
```

Push:

```bash
git push
```

If the repository uses the established two-commit report/footer pattern, preserve it.

After push:

```bash
git rev-parse HEAD
git rev-parse @{upstream}
git status --short
```

Do not claim PUSHED unless HEAD/upstream evidence supports it.

---

# 28. REPOSITORY EVIDENCE footer

The report MUST include:

```text
REPOSITORY EVIDENCE

branch:
reviewed_base_sha:
docs_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:
artifact_integrity:
persistence_status:
release_status:
```

Do not stage/delete unrelated untracked prompts.

---

# 29. Release

Documentation/architecture planning only:

```text
RELEASE: NOT APPLICABLE
```

No tag/deployment/release.

---

# 30. Required final verdict

Use a verdict equivalent to:

```text
TRAVELHUB STEP 2.12I PSP CONTRACT, PROVIDER FEES & MONEY-FLOW ROADMAP RECONCILIATION COMPLETED

Step 2.12I:
- status: PLANNED — DEFERRED UNTIL PSP/AGGREGATOR COMMERCIAL AGREEMENT
- implementation: NOT STARTED

Card-data boundary:
- raw PAN persistence: NOT PLANNED
- CVV/CVC persistence: NOT PLANNED
- hosted/tokenized PSP boundary: REQUIRED TARGET

Provider fees:
- ProviderFee ≠ TravelHub Commission: PRESERVED
- acquiring fee: MUST BE RECONCILED FROM PROVIDER EVIDENCE
- payout fee: MUST BE RECONCILED SEPARATELY
- refund/dispute/FX/wallet/other fees: MUST BE RECONCILED
- hardcoded provider rates as final accounting truth: FORBIDDEN
- actual provider-reported fee where available: PREFERRED ACCOUNTING SOURCE
- economic bearer of ProviderFee: DEFERRED — EXPLICIT BUSINESS/ACCOUNTING DECISION REQUIRED

Money-flow:
- native SPLIT_AT_PAYMENT: NOT ASSUMED
- settlement/ledger/payout: NOT ASSUMED
- 2.12C silent replacement: FORBIDDEN
- final model: DEFERRED TO 2.12I AFTER VERIFIED CONTRACT/API EVIDENCE

ADR-0015:
- status: <actual>
- Step 2.12I dependency: RECORDED

RFI:
- fee evidence requirements reviewed: YES
- amendment: YES/NO

Negative checks:
- production code: 0
- schema/migrations: 0
- PSP runtime/webhooks: 0
- provider selected: NO
- fee rates invented: 0

Artifact integrity:
- PASS: <actual>
- WARN: 0
- FAIL: 0

Persistence:
- branch: <actual>
- docs commit: <sha>
- final HEAD: <sha>
- upstream: <sha>
- push_status: PUSHED

RELEASE: NOT APPLICABLE

NEXT:
- obtain aggregator/PSP commercial + technical evidence
- keep ADR-0015 BLOCKED until evidence is sufficient
- execute 2.12I only after provider agreement/capabilities are known
```

---

# 31. HARD STOP

After documentation reconciliation, artifact checks, commit and push:

**STOP.**

Do NOT:

- choose a PSP;
- implement 2.12B;
- implement 2.12I;
- start 2.12C;
- implement ProviderFee changes;
- implement payout;
- implement split;
- add provider fee rates.

The next architecture decision remains dependent on real PSP/aggregator commercial and technical evidence.
