# PHASE 2 — STEP 2.12I — PSP CONTRACT, PROVIDER FEES & MONEY-FLOW ARCHITECTURE ROADMAP RECONCILIATION — REPORT

## Verdict

`TRAVELHUB STEP 2.12I PSP CONTRACT, PROVIDER FEES & MONEY-FLOW ROADMAP RECONCILIATION COMPLETED`

Step 2.12I is now planned as a mandatory post-selection reconciliation gate:
**⏳ PLANNED — DEFERRED UNTIL PSP/AGGREGATOR COMMERCIAL AGREEMENT**. No runtime
implementation was performed; no provider was selected; no fee rates were
invented.

## 1. Repository evidence inspected

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` — 2.12 series
  (2.12, 2.12A, 2.12B, 2.12C–2.12G, 2.12H) entries; 2.12B BLOCKED — COMMERCIAL
  CONFIRMATION REQUIRED; 2.12C SPLIT_AT_PAYMENT ⏳ NOT STARTED; 2.12G ProviderFee
  short entry.
- `docs/adr/ADR-0015-payment-provider-selection.md` — PROPOSED — BLOCKED;
  global PSPs verified-disqualified for AZN settlement; local CBA-licensed AZ
  acquiring is the only verified path; commercial confirmation required.
- `docs/commercial/az-payment-provider-rfi.md` — sendable questionnaire.
- `docs/commercial/az-payment-provider-rfi-internal-workbook.md` — internal
  scoring workbook (A–E classification, hard gates, verdict template, 2.12C
  guardrail).
- `docs/prompts/TRAVELHUB_AZ_PAYMENT_PROVIDER_RFI_TECHNICAL_COMMERCIAL_QUESTIONNAIRE_REPORT.md`
  — prior RFI step report.
- Step 2.10B foundations (`ProviderFee` / `Settlement` / `Payout` schema-only,
  no runtime), CommissionPolicy/Commission/CommissionAccrual foundations
  (2.12E APPROVED).

Repository truth matched the prompt's expected preceding state; no discrepancy.

## 2. Exact Step 2.12I Roadmap entry

Added after 2.12G, before 2.13 (numeric order preserved; existing steps not
renumbered):

```
· **Step 2.12I --- PSP Contract, Provider Fees & Money-Flow Architecture
  Reconciliation** ⏳ PLANNED — DEFERRED UNTIL PSP/AGGREGATOR COMMERCIAL
  AGREEMENT (2026-08-15 documentation-only reconciliation — report path; реализация
  НЕ начата; REQUIRED post-selection gate перед downstream production money-flow)
```

Entry records: card-data boundary (hosted/tokenized target; raw PAN/CVV/CVC NOT
PLANNED); ProviderFee ≠ TravelHub Commission hard invariant; tariff ≠ accounting
truth; actual provider-reported fee preferred; hardcoded rates forbidden as
final truth; economic fee bearer deferred (models A–E); money-flow concepts not
collapsed into one "commission"; native split not assumed; payout ≠ native
split; 2.12C silent replacement forbidden; marketplace/legal gate (POST /payout
≠ authority); pay-in/payout/refund/chargeback/FX/settlement reconciliation;
ProviderFee identity/dedup from provider contract; 10 hard prerequisites;
dependency chain 2.12A → 2.12H → 2.12B selection → ADR-0015 ACCEPTED →
provider-specific integration → 2.12I → explicit downstream decision.

## 3. ProviderFee hard invariant

Preserved verbatim in Roadmap and ADR-0015:

- **ProviderFee** = external cost/fact charged by PSP / aggregator / acquiring
  bank / card processor / scheme-intermediary / payout provider / FX rail.
- **TravelHub Commission** = TravelHub platform revenue governed by
  `finance.CommissionPolicy` (Finance-owned).
- The selected PSP must NOT become the authority for TravelHub commission rates
  or commercial policy.

## 4. Fee categories captured

acquiring/payment fee; fixed transaction fee; percentage transaction fee;
minimum transaction fee; Apple Pay fee; Google Pay fee; 3DS fee;
tokenization/card-on-file fee; settlement fee; payout/transfer fee; refund fee;
chargeback/dispute fee; FX/conversion fee or spread; cross-border/international
card fee; failed-payment fee; monthly/platform fee; reserve/holdback effects;
other provider charges; VAT/tax on provider fees. No rates invented; no
assumption that every provider exposes or charges all categories.

## 5. Economic-fee-bearer decision deferred

Step 2.12I requires an explicit business/accounting authority. Models A–E
recorded (TravelHub absorbs / partner payable reduction / mixed / buyer
surcharge / native marketplace allocation) — none selected now; never inferred
from API behavior.

## 6. Actual-vs-estimated fee rule

Tariff may be used for estimation/UI preview/forecasting/validation/anomaly
detection only. Where the provider supplies an actual finalized fee through
settlement/reconciliation/API evidence, the provider-reported monetary fact is
the preferred accounting source; hardcoded-rate fallback requires an explicit
later architecture decision and documented authority. Example fact separation
(100.00 gross / 15.00 Commission / 2.50 provider fee) must never silently
collapse into Commission = 12.50.

## 7. 2.12C guardrail

Decision tree recorded: selected PSP + verified evidence → 2.12I → either
native split supported and approved → reconcile 2.12C SPLIT_AT_PAYMENT, or
native split unavailable → separate architecture/business ADR before changing
2.12C. Payout API is NOT native SPLIT_AT_PAYMENT; no silent replacement.

## 8. ADR-0015 amendment

Added §24A "Step 2.12I boundaries": provider selection does not decide final
money flow; hosted/tokenized card boundary target; ProviderFee ≠ TravelHub
Commission; tariff not automatically accounting truth; actual provider-reported
fee preferred; economic bearer is a later explicit decision; native split not
assumed; payout not native split; Step 2.12I is the mandatory post-selection
reconciliation gate. ADR-0015 remains **PROPOSED — BLOCKED** (no evidence to
move to ACCEPTED; nothing in this pass moves it).

## 9. RFI review / amendment

`docs/commercial/az-payment-provider-rfi.md` §19 amended minimally: added
"fixed and percentage fee components" and "who is contractually charged for
each fee (TravelHub, partner, or buyer)" to the transaction-level fee data list.
No other provider-facing material rewritten; RFI continues to cover VAT/tax,
gross/net, refund/chargeback fees, timing/finality, settlement/batch reports,
wallet fees, FX and payout fees. Workbook unchanged (already carries the
evidence standard and fee-data row in the candidate matrix).

## 10. Negative checks

- production code changed: **0**
- schema/migrations: **0**
- PSP runtime/webhooks/adapters/SDK: **0**
- provider selected: **NO**
- fee rates invented: **0**
- ADR-0015 moved to ACCEPTED: **NO**
- 2.12B/2.12C/2.12I implemented: **NO**

Non-doc diff: **0**. Changed/added files are documentation only: Roadmap entry,
ADR-0015 §24A, RFI §19 amendment, this report.

## 11. Artifact integrity

`node scripts/check-roadmap-artifacts.mjs`: see the provenance footer below for
actual PASS count; WARN = 0; FAIL = 0. Checker regression suite green.

## 12. Persistence / provenance

See the provenance footer below (populated post-commit).

## 13. Next step

- Obtain aggregator/PSP commercial + technical evidence (via the RFI).
- Keep ADR-0015 BLOCKED until evidence is sufficient.
- Execute 2.12I only after provider agreement/capabilities are known.

REPOSITORY EVIDENCE
repository: travelhub_v1 (local canonical identity)
branch: master
head: 4f86119
origin: 4f86119
worktree_clean: false (unrelated untracked prompts)
migration_count: 57
reviewed_state: COMMIT
reviewed_diff_base: dba468c
reviewed_diff_head: 4f86119
persistence_status: PERSISTED
persistence_sha: 4f86119
reviewed_base_sha: dba468c
docs_commit_sha: 4f86119
provenance_footer_commit_sha: 4f86119
final_head_sha: 4f86119
upstream_sha: 4f86119
push_status: PUSHED
artifact_integrity: PASS=109 WARN=0 FAIL=0
release_status: NOT APPLICABLE

RELEASE: NOT APPLICABLE
