# TRAVELHUB — ROADMAP RECONCILIATION PROMPT
## Add Step 2.12I — PSP Contract & Money-Flow Architecture Reconciliation

**Mode:** repository-first / documentation-only  
**Target:** canonical TravelHub repository  
**Primary artifact:** `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`  
**Related ADR:** `docs/adr/ADR-0015-payment-provider-selection.md`  
**Expected status:** `⏳ PLANNED — DEFERRED UNTIL PSP/AGGREGATOR COMMERCIAL AGREEMENT`

---

# 1. Objective

Perform a **documentation-only Roadmap/ADR reconciliation** that creates an explicit future step for reconciling TravelHub's final payment money-flow architecture **after a real payment aggregator/PSP has been commercially selected and its contract/API capabilities are available**.

Add:

> **PHASE 2 — STEP 2.12I — PSP CONTRACT & MONEY-FLOW ARCHITECTURE RECONCILIATION**

This pass MUST NOT implement the step.

The purpose is to ensure that the future work cannot disappear between provider selection, Step 2.12B and Step 2.12C.

---

# 2. Current context to preserve

Repository truth must be verified first. Do not trust this prompt blindly.

Expected current state from the preceding work:

- Step 2.12A — Payment Provider Abstraction — approved after strict review.
- Step 2.12H — External API Idempotency Contract — approved after strict review.
- Step 2.12B — Buyer Card / Wallet Payment — currently BLOCKED pending provider/commercial confirmation.
- ADR-0015 — Payment Provider Selection — `PROPOSED — BLOCKED`.
- Provider-facing Azerbaijan PSP RFI exists under `docs/commercial/`.
- No canonical production PSP has yet been selected.
- Step 2.12C has not started.
- Commission policy remains TravelHub-owned; PSP must not become commission-policy authority.
- ProviderFee and TravelHub Commission are separate concepts.

If repository evidence differs, report the discrepancy and use repository truth.

---

# 3. Business/architecture intent to record

TravelHub intends to use a licensed/acquiring payment aggregator/PSP as the card-processing boundary.

The desired high-level pattern is:

```text
PAY-IN

Buyer
  ↓
PSP-hosted / PSP-tokenized card entry
  ↓
Aggregator / Acquirer
  ↓
PSP API + authenticated webhook/callback
  ↓
TravelHub payment lifecycle
```

TravelHub's target security boundary is:

```text
TravelHub application/backend
MUST NOT receive or persist raw card credentials
such as PAN, CVV/CVC or equivalent sensitive authentication data.
```

The future partner-money flow may be one of at least two models:

```text
MODEL A — NATIVE PSP SPLIT

Buyer
  → PSP
  → native split
      → TravelHub commission/platform allocation
      → Partner allocation
```

or:

```text
MODEL B — SETTLEMENT / LEDGER / PAYOUT

Buyer
  → PSP pay-in
  → settlement according to provider/contract model
  → TravelHub ledger/accounting orchestration
  → TravelHub commission
  → partner payable
  → PSP/bank payout API
  → Partner
```

**Neither model may be selected by this documentation pass.**

---

# 4. Critical legal wording rule

Do NOT write as an established legal fact:

> "Azerbaijani law prohibits TravelHub from storing card data."

unless the repository contains a verified legal source that establishes exactly that proposition.

Instead record the architecture/security requirement independently:

> TravelHub V1 SHALL use a hosted/tokenized provider-controlled card-data boundary and SHALL NOT intentionally receive or persist raw PAN, CVV/CVC or equivalent sensitive authentication data in TravelHub application storage.

Possible legal/regulatory/contractual bases — Azerbaijan law, CBA requirements, PCI DSS, card-scheme rules, acquiring contract or other requirements — MUST be verified separately when the selected provider and contractual model are known.

Do not fabricate legal citations.

---

# 5. Why Step 2.12I is deferred

The final money-flow architecture cannot be determined safely before provider selection because it depends on verified provider and contractual facts including:

- merchant onboarding model;
- whether TravelHub may collect payment relating to services supplied by independent partners;
- merchant-of-record / marketplace / agent model, where applicable;
- sub-merchant model;
- KYB/KYC responsibilities;
- settlement ownership and timing;
- safeguarding/holding restrictions, if any;
- native split availability;
- exact split API semantics;
- payout/transfer API availability;
- AZN payout support;
- beneficiary/partner onboarding;
- provider-side idempotency;
- webhook/event semantics;
- refunds;
- disputes/chargebacks;
- fee allocation;
- settlement/reconciliation reporting;
- commercial contract terms.

Therefore Step 2.12I MUST remain:

> `⏳ PLANNED — DEFERRED UNTIL PSP/AGGREGATOR COMMERCIAL AGREEMENT`

until sufficient provider evidence exists.

---

# 6. Step 2.12I entry to add to Roadmap

Add a canonical Roadmap entry with semantics equivalent to the following, adapting formatting to the actual Roadmap style:

## Step 2.12I — PSP Contract & Money-Flow Architecture Reconciliation

**Status:**  
`⏳ PLANNED — DEFERRED UNTIL PSP/AGGREGATOR COMMERCIAL AGREEMENT`

**Purpose:**  
Reconcile the final TravelHub pay-in, settlement, commission and partner-payout architecture against the **selected PSP/aggregator's executed/approved commercial model and verified technical capabilities** before committing to the runtime implementation of the downstream money flow.

**Hard prerequisites:**

1. canonical PSP/provider selected through ADR-0015;
2. ADR-0015 accepted or equivalent approved provider decision exists;
3. merchant onboarding eligibility confirmed;
4. provider technical documentation available;
5. sandbox/test access available or explicitly accounted for;
6. commercial/contractual money-flow model sufficiently known;
7. marketplace/partner-funds treatment explicitly confirmed;
8. native split capability explicitly confirmed or rejected;
9. payout capability explicitly confirmed or rejected.

---

# 7. Mandatory questions Step 2.12I must resolve later

The future implementation/reconciliation prompt MUST answer at least:

### 7.1 Card-data boundary

- Which PSP-hosted/tokenized mechanism is used?
- Can PAN/CVV ever reach TravelHub backend?
- What safe token/payment-method references may TravelHub store?
- What masked metadata may be retained?
- What is the actual PCI boundary?

Hard target:

```text
raw PAN persistence = 0
CVV/CVC persistence = 0
TravelHub-hosted raw card form = 0
```

unless a later explicit security/legal architecture decision changes the boundary.

### 7.2 Pay-in

- Which provider API creates payment?
- Which identifiers are canonical?
- Provider-side idempotency semantics?
- 3DS2 flow?
- Apple Pay / Google Pay integration?
- Webhook signature/authentication?
- Duplicate and out-of-order event behavior?
- Multi-instance processing behavior?

### 7.3 Contractual marketplace model

Explicitly determine whether TravelHub is contractually/regulatorily allowed to:

- accept buyer money for partner-supplied services;
- hold/receive settlement before partner payment;
- deduct TravelHub commission;
- initiate partner payouts;
- onboard or reference partners/sub-merchants.

Technical existence of a payout endpoint is NOT sufficient proof.

### 7.4 Settlement

Determine:

- who receives settlement;
- settlement currency;
- settlement timing;
- gross/net representation;
- ProviderFee representation;
- reconciliation source;
- settlement IDs;
- mapping to internal Settlement/Ledger facts.

### 7.5 Commission

Preserve:

```text
TravelHub Commission policy authority = TravelHub Finance domain
PSP/provider = NOT commission policy authority
ProviderFee ≠ TravelHub Commission
```

The PSP may execute a precomputed allocation if supported, but MUST NOT silently become the source of TravelHub commission rates/policy.

### 7.6 Partner payout

Determine:

- whether payout is provider-supported;
- legal/contractual permission;
- recipient model;
- AZN support;
- KYB/KYC;
- payout identity;
- idempotency;
- status callbacks;
- retries;
- failure handling;
- reconciliation.

### 7.7 Refund/dispute effects

Determine how the chosen model handles:

- full refund;
- partial refund;
- refund after partner allocation/payout;
- chargeback/dispute;
- lost dispute;
- provider fees;
- TravelHub commission adjustment;
- partner receivable/payable adjustment.

---

# 8. Explicit 2.12C guardrail

This is a HARD requirement.

Do NOT modify Step 2.12C from `SPLIT_AT_PAYMENT` to a settlement/payout model during this pass.

Do NOT claim that native split is unavailable merely because local PSPs are expected not to support it.

Do NOT claim that payout orchestration is the selected architecture.

Instead add an explicit dependency/decision edge:

```text
Selected PSP + commercial/technical evidence
        ↓
Step 2.12I
        ↓
determine money-flow model
        ├── native split proven/approved
        │      → reconcile/continue Step 2.12C SPLIT_AT_PAYMENT
        │
        └── native split unavailable/inappropriate
               → separate architecture/business decision
               → explicitly reconcile Step 2.12C before implementation
```

There MUST be no silent substitution.

---

# 9. Relationship with Step 2.12B

Do not incorrectly force all of Step 2.12I to happen before any 2.12B work.

The Roadmap should distinguish:

### 2.12B
Provider-specific buyer payment/card-wallet integration.

### 2.12I
Final reconciliation of the broader contractual money flow:

```text
pay-in
→ settlement
→ commission treatment
→ partner payable
→ split OR payout
→ refund/dispute consequences
```

If repository sequencing shows that a minimal provider adapter/payment implementation can occur before the full money-flow decision, preserve that possibility.

However, production activation of any money flow that depends on marketplace collection, split, partner settlement or payout MUST be gated by the relevant verified contract/capability decisions.

---

# 10. Relationship with existing foundations

Step 2.12I must inspect and reconcile, not replace, existing foundations such as:

- Payment;
- Provider abstraction;
- External API idempotency;
- ProviderFee;
- Settlement;
- Payout;
- Ledger;
- CommissionPolicy;
- Commission;
- CommissionAccrual;
- Refund;
- Dispute-related contracts where present.

Do not redesign these now.

The future Step 2.12I may identify incompatibilities and require a dedicated ADR before implementation.

---

# 11. ADR-0015 update

Update ADR-0015 documentation minimally to state that provider selection alone does not authorize an assumed marketplace money-flow model.

Add a forward dependency to Step 2.12I:

> After commercial/provider selection, TravelHub must reconcile the selected provider's actual contractual and technical money-flow capabilities before implementing or changing split/settlement/payout architecture.

Also record:

- hosted/tokenized card-data boundary is a TravelHub target requirement;
- raw PAN/CVV storage by TravelHub is not part of the planned V1 architecture;
- native split is a capability to verify, not an assumption;
- payout API is not equivalent to native split;
- existence of payout capability does not itself establish legal/contractual authority for TravelHub to collect and redistribute partner funds.

Keep ADR-0015 `PROPOSED — BLOCKED` unless repository evidence already satisfies its acceptance conditions.

---

# 12. RFI reconciliation

Inspect the existing provider-facing RFI and internal workbook.

Do NOT rewrite them wholesale.

Confirm they ask enough questions to support Step 2.12I later, especially:

- hosted/tokenized card collection;
- PAN/CVV boundary;
- marketplace/sub-merchant model;
- settlement destination;
- native split;
- payout;
- KYB/KYC;
- contractual permission to receive partner-related funds;
- refund/dispute behavior;
- reconciliation.

If a genuinely required question is absent, add the smallest documentation-only amendment.

Do not change provider answers or invent capabilities.

---

# 13. Roadmap dependency chain

After repository verification, document a dependency chain equivalent to:

```text
2.12A APPROVED
   ↓
2.12H APPROVED
   ↓
2.12B PROVIDER SELECTION / COMMERCIAL CONFIRMATION
   ↓
ADR-0015 ACCEPTED
   ↓
provider-specific integration work
   ↓
2.12I PSP CONTRACT & MONEY-FLOW ARCHITECTURE RECONCILIATION
   ↓
explicit decision:
   native SPLIT_AT_PAYMENT
   OR
   separately approved settlement/ledger/payout architecture
   ↓
affected downstream implementation
```

Adapt the exact placement if the canonical Roadmap has a more accurate dependency structure.

Do not renumber existing steps.

---

# 14. No implementation in this pass

Forbidden:

- PSP SDK installation;
- payment adapter implementation;
- webhook routes;
- webhook consumers;
- card forms;
- PAN/CVV fields;
- tokenization runtime;
- payment runtime changes;
- payout runtime;
- settlement runtime;
- split runtime;
- Commission runtime;
- Ledger runtime;
- schema changes;
- migrations;
- production tests;
- provider credentials;
- secrets;
- provider selection;
- invented commercial terms;
- invented legal conclusions.

Expected production diff:

```text
backend/src = 0
frontend = 0
prisma schema = 0
migrations = 0
runtime config = 0
dependencies = 0
```

---

# 15. Required deliverables

Create/update only appropriate documentation artifacts.

At minimum:

1. canonical Roadmap entry for Step 2.12I;
2. minimal ADR-0015 forward-reference/reconciliation note;
3. RFI/workbook amendment only if required by verified gap;
4. implementation/reconciliation report, suggested path:

```text
docs/prompts/TRAVELHUB_STEP_2.12I_PSP_CONTRACT_MONEY_FLOW_ARCHITECTURE_ROADMAP_RECONCILIATION_REPORT.md
```

The report must state:

- repository evidence inspected;
- exact Roadmap insertion;
- exact dependency edges;
- ADR change;
- whether RFI required amendment;
- negative checks;
- artifact-integrity result;
- persistence/provenance.

---

# 16. Artifact integrity

Run the repository's existing Roadmap artifact-integrity checker.

Expected final state:

```text
WARN = 0
FAIL = 0
```

If a new unrelated baseline issue appears, do not hide it.

Report it separately.

Do not fabricate PASS counts.

---

# 17. Git discipline

Before changes:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse @{upstream}
```

Do not touch unrelated untracked prompt files.

Do NOT use:

```bash
git add .
git add -A
```

Stage only the explicit files modified by this pass.

Review:

```bash
git diff --check
git diff --cached --stat
git diff --cached
```

---

# 18. Commit and push

After all checks pass, commit the documentation reconciliation.

Suggested commit:

```bash
git commit -m "docs: add PSP contract and money-flow reconciliation gate"
```

Push the current canonical branch:

```bash
git push
```

Then verify:

```bash
git rev-parse HEAD
git rev-parse @{upstream}
git status --short
```

If the repository uses the established two-commit provenance/footer pattern, follow that actual repository convention instead of blindly using a single commit.

Do not claim `PUSHED` unless upstream SHA proves it.

---

# 19. Repository evidence footer

The final report MUST include the repository's established provenance footer, including at least:

```text
REPOSITORY EVIDENCE

branch:
reviewed_base_sha:
implementation_or_docs_commit_sha:
provenance_footer_commit_sha:   # if applicable
final_head_sha:
upstream_sha:
push_status: PUSHED | NOT PUSHED
worktree_clean: true | false
artifact_integrity:
persistence_status:
release_status:
```

If worktree is not clean because unrelated untracked prompts already existed, list/classify them without staging or deleting them.

---

# 20. Release

This is documentation/architecture-roadmap reconciliation only.

Expected:

```text
RELEASE: NOT APPLICABLE
```

Do not create a production release/tag/deployment.

---

# 21. Required final verdict

If successful, final response should use:

```text
TRAVELHUB STEP 2.12I PSP CONTRACT & MONEY-FLOW ARCHITECTURE ROADMAP RECONCILIATION COMPLETED

Step 2.12I:
- status: PLANNED — DEFERRED UNTIL PSP/AGGREGATOR COMMERCIAL AGREEMENT
- implementation: NOT STARTED
- purpose: final provider-contract / pay-in / settlement / commission / partner-payout reconciliation

Card-data boundary:
- TravelHub raw PAN persistence: NOT PLANNED
- TravelHub CVV/CVC persistence: NOT PLANNED
- hosted/tokenized PSP boundary: REQUIRED TARGET
- legal basis: NOT INVENTED; provider/contract/regulatory verification deferred

Money-flow:
- native SPLIT_AT_PAYMENT: NOT ASSUMED
- settlement/ledger/payout: NOT ASSUMED
- final model decision: DEFERRED TO 2.12I AFTER VERIFIED PROVIDER EVIDENCE
- silent replacement of 2.12C: FORBIDDEN

ADR-0015:
- status: <actual status>
- Step 2.12I forward dependency: RECORDED

RFI:
- existing questionnaire reviewed: YES
- amendment required: YES/NO
- provider selected: NO

Negative checks:
- production code: 0
- schema/migrations: 0
- PSP/webhook/runtime: 0

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
- obtain PSP/aggregator commercial + technical confirmation
- ADR-0015 → ACCEPTED only from verified evidence
- continue provider integration according to Roadmap
- execute Step 2.12I only when provider contract/capabilities are sufficiently known
```

---

# 22. HARD STOP

After the documentation changes, checks, commit and push:

**STOP.**

Do NOT:

- select a provider;
- start Step 2.12B implementation;
- start Step 2.12I implementation;
- start Step 2.12C;
- implement payout;
- implement native split;
- modify payment runtime.

The next action still depends on external PSP/aggregator commercial and technical evidence.
