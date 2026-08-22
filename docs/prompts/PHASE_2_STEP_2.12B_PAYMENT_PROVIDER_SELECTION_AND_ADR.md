# PHASE 2 — STEP 2.12B — PAYMENT PROVIDER SELECTION & ADR
## REPOSITORY-FIRST · EXTERNAL-FACT-VERIFIED · NO PSP IMPLEMENTATION · DECISION PASS ONLY

## 0. MODE

**ARCHITECTURE DECISION / PROVIDER SELECTION ONLY · NO PRODUCTION PSP CODE**

Current canonical state:

`PHASE 2 STEP 2.12B BLOCKED — PROVIDER SELECTION REQUIRED`

This pass exists to select the canonical production payment provider or explicitly approved provider set required before Step 2.12B implementation.

Do not implement adapters, webhook handlers, credentials, network clients, Apple Pay, Google Pay, card processing, SPLIT_AT_PAYMENT, or provider-specific runtime in this pass.

The only acceptable outcome is an evidence-backed provider decision or an explicit continued blocker.

---

# 1. PRIMARY OBJECTIVE

Select and formally approve the provider configuration for:

`PHASE 2 — STEP 2.12B — BUYER CARD / WALLET PAYMENT`

The decision must answer:

1. Which PSP/provider is canonical for V1?
2. Is V1 single-provider or multi-provider?
3. Which payment methods are actually supported in V1?
4. Which currencies are actually supported in V1?
5. Which merchant/business jurisdictions are supported?
6. Which webhook/signature protocol will 2.12B implement?
7. Which provider-side idempotency mechanism will map from the approved 2.12A provider-operation identity?
8. Which sandbox/testing mode exists?
9. Does the provider support Apple Pay / Google Pay for the relevant merchant geography?
10. Does the provider support TravelHub’s marketplace/split roadmap later in 2.12C, or is another provider/rail required?
11. What PCI scope does the integration impose?
12. What payout/settlement limitations affect later Finance steps?

---

# 2. REPOSITORY BASELINE — VERIFY FIRST

Before decision work, record:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -20
```

Verify:

- 2.12A approved;
- 2.12H approved;
- 2.12B blocked only on provider selection;
- current Roadmap entry;
- current provider registry remains empty in production;
- fake provider remains test-only;
- 2.12C not started.

Do not modify production code.

---

# 3. EXTERNAL FACT VERIFICATION — HARD GATE

Provider selection must not be made from generic assumptions or stale memory.

For every candidate, verify from current official provider documentation and/or current commercial/merchant eligibility information:

- supported merchant countries;
- supported settlement countries;
- supported currencies;
- supported presentment currencies;
- AZN support;
- USD support;
- RUB support;
- card networks;
- Apple Pay availability;
- Google Pay availability;
- merchant onboarding eligibility for TravelHub’s legal entity/jurisdiction;
- webhook/event support;
- webhook signature verification mechanism;
- provider-side idempotency support;
- sandbox/test environment;
- marketplace/platform capabilities;
- split/connected-account/platform-fee capabilities if relevant for 2.12C;
- refund/dispute APIs;
- settlement/payout APIs;
- provider fee visibility;
- API versioning;
- SDK/API maturity;
- PCI/tokenization approach.

Do not rely on third-party comparison blogs as primary authority for technical capabilities.

Official provider docs are the primary source.

If provider commercial eligibility requires account-specific confirmation, classify it:

`COMMERCIAL CONFIRMATION REQUIRED`

Do not silently assume eligibility.

---

# 4. CANDIDATE SET

Start from candidates already mentioned or implied in the repository, but do not treat mention as approval.

Potential candidates may include:

- Stripe;
- Adyen;
- Mangopay;
- Checkout.com;
- Rapyd;
- direct bank/acquirer integrations;
- other provider(s) justified by current official support.

The final candidate set must be justified.

Do not force all listed names into the shortlist.

---

# 5. TRAVELHUB V1 REQUIREMENTS

Build the provider decision from actual TravelHub requirements.

At minimum evaluate:

### Merchant / jurisdiction
- TravelHub legal entity country;
- merchant onboarding eligibility;
- partner marketplace model;
- any marketplace/platform merchant constraints.

### Buyer payments
- card payments;
- Apple Pay;
- Google Pay;
- tokenized/provider-hosted card collection;
- no raw PAN/CVC on TravelHub backend.

### Currency
Explicitly verify requirements for:

- AZN;
- USD;
- RUB.

Distinguish:

- presentment currency;
- settlement currency;
- payout currency;
- conversion availability.

Do not treat these as equivalent.

### Future roadmap
Evaluate compatibility with:

- 2.12C SPLIT_AT_PAYMENT;
- ProviderFee;
- Refund;
- Dispute;
- Settlement;
- Payout;
- Commission;
- future multi-provider architecture.

---

# 6. SINGLE PROVIDER VS MULTI-PROVIDER V1

Choose deliberately.

Preferred default architecture is **single canonical production provider for V1** unless repository/business requirements already justify multi-provider runtime.

Reasons to avoid premature multi-provider implementation:

- webhook complexity;
- status normalization complexity;
- reconciliation;
- duplicate provider policies;
- operational support;
- test matrix explosion.

If multi-provider V1 is chosen, document the hard business reason.

Do not choose multi-provider merely because 2.12A supports abstraction.

---

# 7. PROVIDER SCORECARD

Create a normalized comparison table.

Minimum columns:

| Criterion | Weight | Provider A | Provider B | Provider C | Evidence |
|---|---:|---|---|---|---|

Required criteria:

1. Merchant eligibility / jurisdiction
2. AZN presentment
3. USD presentment
4. RUB presentment
5. Settlement currency support
6. Visa/Mastercard
7. Apple Pay
8. Google Pay
9. Tokenized/no-raw-card integration
10. Provider idempotency support
11. Webhook reliability/signature mechanism
12. Sandbox quality
13. Refund API
14. Dispute/chargeback API
15. Marketplace/platform support
16. Native split compatibility for 2.12C
17. Provider fee reporting
18. Settlement reporting
19. Payout support
20. API documentation/maturity
21. Operational complexity
22. Commercial unknowns
23. Lock-in/reversibility

Weights must be justified from TravelHub priorities.

Do not fabricate pricing percentages.

If pricing cannot be verified publicly or depends on merchant negotiation, mark:

`COMMERCIAL QUOTE REQUIRED`

---

# 8. HARD DISQUALIFIERS

A candidate must be rejected for V1 if any required condition is proven false, such as:

- merchant cannot onboard in TravelHub jurisdiction;
- required card acquiring unavailable;
- required payment method unavailable;
- webhook authenticity cannot be securely verified;
- no provider idempotency support and no safe equivalent can be designed;
- integration requires raw card handling contrary to architecture;
- no viable sandbox/test path;
- provider materially blocks required near-term roadmap without an explicit alternative.

Do not average a hard blocker away with a score.

---

# 9. AZN / USD / RUB — SPECIAL REVIEW

Do not merely ask whether the provider “supports” a currency.

For each provider verify:

### AZN
- can buyer be charged in AZN?
- can merchant settle in AZN?
- if not, what conversion occurs?
- any local acquiring/bank dependency?

### USD
- presentment;
- settlement;
- wallet/card support.

### RUB
- current merchant/payment availability;
- geographic/regulatory restrictions;
- settlement/presentment distinctions.

If current restrictions make RUB unavailable, document that truth rather than inventing support.

If RUB is a business requirement that no candidate safely satisfies, escalate:

`ARCHITECTURE/BUSINESS DECISION REQUIRED`

---

# 10. APPLE PAY / GOOGLE PAY

Verify actual provider support for the selected merchant geography.

Distinguish:

- provider technically supports wallet;
- merchant country is eligible;
- card network/currency is eligible;
- browser/device integration requirement;
- domain verification requirement;
- frontend SDK requirement.

Do not mark wallet support PASS based only on a global provider feature page.

---

# 11. PCI / CARD-DATA BOUNDARY

For each candidate determine integration pattern:

- provider-hosted checkout;
- hosted fields/elements;
- client-side tokenization;
- direct card API.

TravelHub target:

`raw PAN/CVC never reaches TravelHub backend`

unless an explicit future security/PCI decision approves otherwise.

Any candidate/integration requiring raw card handling is disfavored/blocking.

---

# 12. WEBHOOK CONTRACT FITNESS

For each candidate verify:

- immutable event ID;
- event types;
- signature scheme;
- timestamp/replay protection;
- raw-body requirement;
- retry policy;
- duplicate delivery behavior;
- ordering guarantees or explicit lack thereof;
- event retrieval API if available.

2.12B must be able to implement durable dedup + reorder-safe processing.

---

# 13. PROVIDER IDEMPOTENCY FITNESS

Verify current official provider API idempotency semantics:

- key/header name;
- scope;
- retention window if documented;
- identical retry behavior;
- divergent request behavior;
- endpoint support;
- network timeout recovery semantics.

Assess compatibility with 2.12A provider-operation identity.

Do not pass the external client `Idempotency-Key` directly by default.

---

# 14. 2.12C SPLIT_AT_PAYMENT FITNESS

2.12B must not implement split, but provider selection should avoid an obvious dead end.

For each candidate verify whether it supports:

- marketplace/platform accounts;
- connected/sub-merchant accounts;
- split/destination payments;
- platform fee;
- delayed transfer;
- payout orchestration;
- KYC/KYB obligations.

Classify:

- `2.12C NATIVE FIT`
- `2.12C POSSIBLE WITH LIMITATIONS`
- `2.12C NOT SUPPORTED`
- `REQUIRES COMMERCIAL CONFIRMATION`

Provider can still be selected for 2.12B with a known future secondary rail only if architecture explicitly accepts that tradeoff.

---

# 15. PROVIDER FEE / SETTLEMENT / PAYOUT FIT

Evaluate future data availability, not implementation.

Verify whether provider exposes:

- per-transaction provider fees;
- settlement batches;
- payout IDs;
- payout status;
- reconciliation reports;
- balance transactions or equivalent.

This affects future ProviderFee/Settlement/Payout producers.

Do not implement them here.

---

# 16. REFUND / DISPUTE FIT

Verify provider exposes:

- refund creation/status;
- partial refunds;
- dispute/chargeback events;
- evidence APIs if relevant;
- liability outcome.

Do not start Refund/Dispute provider runtime here.

This is selection evidence only.

---

# 17. TEST / SANDBOX STRATEGY

Provider selection must support deterministic CI-independent testing.

Define:

### CI
- mock transport / contract fixtures;
- deterministic signature tests;
- no dependence on live PSP.

### Optional external sandbox
- smoke verification only;
- never required for every unit/e2e run.

Document sandbox account prerequisites.

---

# 18. PROVIDER SELECTION DECISION

Choose one:

### A. SINGLE PROVIDER APPROVED
Example structure:

`V1 canonical provider = <provider>`

### B. APPROVED PROVIDER SET
Only if multi-provider V1 is justified.

### C. PROVIDER SELECTION BLOCKED — COMMERCIAL CONFIRMATION REQUIRED
If onboarding/currency/platform capability cannot be established from public evidence.

### D. PROVIDER SELECTION BLOCKED — BUSINESS REQUIREMENTS CONFLICT
If required AZN/USD/RUB/wallet/platform criteria cannot be satisfied together.

Do not select a provider simply to unblock Roadmap.

---

# 19. REQUIRED ADR

Create:

`docs/adr/ADR-XXXX-payment-provider-selection.md`

Use the next canonical ADR number from repository state.

Required sections:

1. Status
2. Context
3. Decision
4. Selected provider/provider set
5. V1 payment rails
6. Merchant jurisdiction assumptions
7. Currency support
8. Card support
9. Apple Pay
10. Google Pay
11. PCI/tokenization boundary
12. Provider idempotency
13. Webhook/signature contract
14. Event dedup identity
15. Callback ordering guarantees/non-guarantees
16. Sandbox/testing
17. 2.12C compatibility
18. ProviderFee/Settlement/Payout compatibility
19. Refund/Dispute compatibility
20. Rejected alternatives
21. Commercial unknowns
22. Consequences
23. Reversibility
24. Security constraints
25. Follow-up implementation ownership

Do not include secret credentials or merchant IDs.

---

# 20. ROADMAP UPDATE

If provider is approved:

Update 2.12B from:

`⛔ BLOCKED — PROVIDER SELECTION REQUIRED`

to:

`⏳ READY FOR IMPLEMENTATION — PROVIDER APPROVED: <provider>`

or canonical equivalent.

NEXT:

`PHASE 2 — STEP 2.12B — BUYER CARD / WALLET PAYMENT — IMPLEMENTATION`

Do not mark implementation started/completed.

If still blocked, preserve BLOCKED with exact missing authority.

---

# 21. DECISION REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.12B_PAYMENT_PROVIDER_SELECTION_DECISION_REPORT.md`

Required sections:

1. Verdict
2. Repository baseline
3. Current blocker verification
4. Requirements
5. Candidate set
6. External evidence methodology
7. Merchant/jurisdiction comparison
8. Currency comparison
9. Card comparison
10. Apple Pay comparison
11. Google Pay comparison
12. PCI/tokenization comparison
13. Provider idempotency comparison
14. Webhook comparison
15. Sandbox comparison
16. 2.12C compatibility
17. ProviderFee/Settlement/Payout compatibility
18. Refund/Dispute compatibility
19. Commercial unknowns
20. Scorecard
21. Hard disqualifiers
22. Selected provider
23. Rejected alternatives
24. ADR created
25. Roadmap update
26. Negative checks
27. Exact files changed
28. Artifact integrity
29. Persistence
30. Repository Evidence
31. Release
32. Exact NEXT
33. Final statement

Cite external official provider evidence in the report if the execution environment supports durable source references.

---

# 22. NEGATIVE CHECKS

This pass must change:

- production backend code: 0;
- frontend production code: 0;
- schema: 0;
- migrations: 0;
- provider SDK deps: 0;
- credentials: 0;
- network runtime: 0;
- webhook routes: 0;
- Payment lifecycle: 0;
- SPLIT_AT_PAYMENT: 0;
- Ledger: 0;
- Commission runtime: 0;
- Refund runtime: 0;
- Dispute runtime: 0.

Docs/Roadmap/ADR only.

---

# 23. ARTIFACT INTEGRITY

Run:

- checker regression;
- real Roadmap artifact-integrity checker.

Hard requirement:

`FAIL = 0`

Prefer:

`WARN = 0`

---

# 24. GIT PERSISTENCE — REQUIRED

Before staging:

```bash
git status --short
git diff --stat
git diff
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
```

Never use:

```bash
git add .
git add -A
```

Stage only:

- provider-selection ADR;
- provider-selection decision report;
- Roadmap change;
- narrowly related docs if genuinely required.

Inspect staged diff.

Suggested commit:

```bash
git commit -m "docs(finance): select canonical payment provider for step 2.12B"
```

Push normally, never force.

Verify HEAD == upstream before claiming PUSHED.

---

# 25. REPOSITORY EVIDENCE

Use:

`docs/prompts/REPOSITORY_EVIDENCE_FOOTER_TEMPLATE.md`

Populate actual repository/branch/HEAD/upstream/worktree state/persistence SHA/push status.

Use the established two-commit provenance/footer pattern if required.

Never fabricate future SHA.

---

# 26. RELEASE

No production release.

Record:

`RELEASE: NOT APPLICABLE — ARCHITECTURE DECISION ONLY`

---

# 27. FINAL RESPONSE — APPROVED PROVIDER

```text
PHASE 2 STEP 2.12B PAYMENT PROVIDER SELECTION COMPLETED — PROVIDER APPROVED

Provider:
- canonical V1 provider: <provider>
- provider model: SINGLE | MULTI
- merchant jurisdiction eligibility: <verified>
- card payments: <verified>
- Apple Pay: <verified>
- Google Pay: <verified>
- AZN: <presentment/settlement truth>
- USD: <truth>
- RUB: <truth>
- PCI/card collection: TOKENIZED/HOSTED — RAW PAN/CVC BACKEND = 0
- provider idempotency: <verified>
- webhook signature: <verified>
- stable event ID/dedup: <verified>
- sandbox: <verified>
- 2.12C compatibility: <classification>

Commercial unknowns:
- <actual>

ADR:
- <path>

Artifact integrity:
- PASS=<N> WARN=<N> FAIL=0

Persistence:
- branch: <actual>
- decision commit: <sha>
- provenance/footer commit: <sha or N/A>
- final HEAD: <sha>
- upstream: <sha>
- push_status: PUSHED
- worktree_clean: true|false

RELEASE: NOT APPLICABLE

NEXT: PHASE 2 — STEP 2.12B — BUYER CARD / WALLET PAYMENT — IMPLEMENTATION
```

---

# 28. FINAL RESPONSE — STILL BLOCKED

If provider cannot be safely selected:

```text
PHASE 2 STEP 2.12B PROVIDER SELECTION BLOCKED — <EXACT REASON>

Verified blockers:
- <actual>

Candidates evaluated:
- <actual>

Missing authority:
- <commercial confirmation / business requirement / jurisdiction decision>

Roadmap:
- 2.12B remains BLOCKED

NEXT:
- <exact decision required>
```

---

# 29. HARD STOP

After:

- repository verification;
- current official provider evidence collection;
- candidate comparison;
- scorecard;
- provider decision;
- ADR;
- Roadmap update;
- decision report;
- artifact checker;
- explicit staging;
- commit;
- push;
- Repository Evidence;

**STOP.**

Do not implement provider runtime in this pass.

Do not start 2.12C.

If a provider is approved, the next separate pass may execute the already prepared 2.12B implementation prompt.
