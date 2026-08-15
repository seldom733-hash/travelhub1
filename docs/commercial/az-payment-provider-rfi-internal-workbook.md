# TravelHub — AZ Payment Provider RFI — Internal Evaluation Workbook

**Internal — do not send in provider-facing copy.**
Companion to `docs/commercial/az-payment-provider-rfi.md` (the sendable questionnaire).
Decision dependency: `docs/adr/ADR-0015-payment-provider-selection.md`.
Roadmap dependency: Phase 2 — Step 2.12B — Buyer Card / Wallet Payment.

## 1. Purpose

Score candidate responses against a single matrix, reconcile evidence with
ADR-0015, and produce one verdict per candidate. Only verified evidence may
move ADR-0015 to `ACCEPTED`; only then may Roadmap 2.12B become
`READY FOR IMPLEMENTATION`.

## 2. Response handling protocol

1. Preserve original answers/attachments verbatim (immutable record).
2. Unanswered critical questions remain **gaps** — never inferred as supported.
3. Compare all candidates against the **same** matrix (section 4 below).
4. Reconcile every claimed capability with ADR-0015's verified-fact base
   (global-PSP disqualifications, AZN-settlement requirement).
5. Decide single-provider vs approved provider set.
6. Only verified evidence may move ADR-0015 to `ACCEPTED`.
7. Then Roadmap 2.12B may become `READY FOR IMPLEMENTATION`.
8. Execute the existing 2.12B implementation prompt.
9. Do **not** silently replace 2.12C `SPLIT_AT_PAYMENT` with payout
   orchestration. If native split is unavailable, run a separate
   architecture/business reconciliation for 2.12C.

## 3. TravelHub evaluation classification

- **A — APPROVED FOR V1:** all hard requirements confirmed.
- **B — APPROVED WITH EXPLICIT LIMITATIONS:** V1 viable with accepted limitations.
- **C — TECHNICALLY SUITABLE — COMMERCIAL APPROVAL PENDING**
- **D — COMMERCIAL SUITABILITY — TECHNICAL EVIDENCE INSUFFICIENT**
- **E — DISQUALIFIED**

## 4. Hard gates before Step 2.12B implementation

1. Azerbaijan merchant onboarding confirmed.
2. AZN presentment confirmed.
3. AZN settlement confirmed, or business explicitly accepts another settlement currency.
4. Tokenized/hosted card collection confirmed.
5. Provider API idempotency documented.
6. Webhook cryptographic verification documented.
7. Stable payment/event correlation documented.
8. Sandbox access confirmed.
9. Marketplace model confirmed.
10. Native split explicitly confirmed or rejected.
11. Commercial proposal received.
12. Technical documentation received.

Any gate unmet → candidate cannot be classified A (B requires explicit
business acceptance of the limitation; E for disqualifying gaps).

## 5. Interpretation rules (hard distinctions)

- `AZN acquiring` ≠ `AZN settlement`
- `Apple Pay available in Azerbaijan` ≠ `provider enables Apple Pay for TravelHub`
- `webhook exists` ≠ `webhook is cryptographically authenticated`
- `retry supported` ≠ `payment creation is idempotent`
- `payout supported` ≠ `native SPLIT_AT_PAYMENT`
- `ordinary merchant acquiring` ≠ `marketplace/sub-merchant model`

Provider selection must be based on written commercial and technical evidence,
not assumptions.

## 6. Evidence standard

Architecture-critical **SUPPORTED** claims require one of: official
documentation, written technical confirmation, written commercial
confirmation, or sandbox evidence. Critical evidence set:

- AZN settlement;
- merchant eligibility;
- tokenization;
- API idempotency;
- webhook signature;
- webhook event identity;
- marketplace legal/commercial model;
- native split;
- partner payout.

Unanswered does not mean supported.

## 7. Provider verdict template

```text
TRAVELHUB PAYMENT PROVIDER EVALUATION — <PROVIDER>

Merchant:
- Azerbaijan onboarding: ...
- marketplace model: ...

Currency:
- AZN presentment: ...
- AZN settlement: ...
- USD: ...
- RUB: ...

Payment:
- Visa/Mastercard: ...
- tokenized/no-PAN backend: ...
- 3DS2: ...
- Apple Pay: ...
- Google Pay: ...

API:
- create-payment idempotency: ...
- stable payment ID: ...
- timeout retry safety: ...

Webhook:
- stable event ID: ...
- cryptographic signature: ...
- retry semantics: ...
- duplicate delivery: ...
- ordering: ...

Operations:
- sandbox: ...
- refunds: ...
- disputes: ...
- provider fee data: ...
- settlement/reconciliation: ...

Marketplace:
- sub-merchants: ...
- native split: ...
- exact TravelHub-supplied split amount: ...
- AZN partner payout: ...

Commercial:
- quote received: YES | NO
- reserve/deposit: ...
- onboarding conditions: ...

Evidence gaps:
- ...

Classification: A | B | C | D | E

ADR-0015:
- ACCEPTABLE FOR ACCEPTANCE
or
- REMAINS BLOCKED

Step 2.12B:
- READY FOR IMPLEMENTATION
or
- BLOCKED
```

## 8. Candidate comparison matrix (fill per candidate)

| Criterion | Millikart | Kapital Bank | <candidate> |
|---|---|---|---|
| Onboarding (AZ legal entity) | | | |
| AZN presentment | | | |
| AZN settlement | | | |
| Tokenized/no-PAN | | | |
| 3DS2 | | | |
| Apple Pay | | | |
| Google Pay | | | |
| Create-payment idempotency | | | |
| Stable payment ID | | | |
| Webhook signature | | | |
| Stable webhook event ID | | | |
| Sandbox | | | |
| Partial refunds | | | |
| Dispute events | | | |
| Fee data (transaction-level) | | | |
| Marketplace model | | | |
| Native split (2.12C) | | | |
| AZN partner payout | | | |
| Quote received | | | |
| Classification | | | |

## 9. 2.12C guardrail

Native split is **NOT** equivalent to a later payout after centralized
settlement. If the selected provider cannot accept an exact precomputed
commission/split amount at payment/capture time, `SPLIT_AT_PAYMENT` (2.12C)
must go through the ledger-orchestrated payout rail (2.10B) — a separate
architecture/business reconciliation required before 2.12C starts. This
trade-off must be explicitly accepted by the business at provider-selection
time.
