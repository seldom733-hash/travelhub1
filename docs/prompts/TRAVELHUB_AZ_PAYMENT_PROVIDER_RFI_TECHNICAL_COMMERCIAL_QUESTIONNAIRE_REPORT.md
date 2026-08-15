# TRAVELHUB — AZ PAYMENT PROVIDER RFI — TECHNICAL & COMMERCIAL QUESTIONNAIRE — STEP REPORT

## Verdict

`TRAVELHUB AZ PAYMENT PROVIDER RFI PREPARED — COMMERCIAL & TECHNICAL CONFIRMATION REQUIRED`

The RFI questionnaire (ADR-0015 §25 missing authority) is now operationally
ready to send to local CBA-licensed Azerbaijan acquiring/payment candidates.
No provider is selected; ADR-0015 remains `PROPOSED — BLOCKED`; Step 2.12B
remains `BLOCKED — COMMERCIAL CONFIRMATION REQUIRED`.

## 1. What this step produces

- **Provider-facing RFI questionnaire** — `docs/commercial/az-payment-provider-rfi.md`
  (sender-ready; sections: provider/contracting entity, merchant onboarding,
  currency presentment/settlement/payout, card acquiring, PCI/tokenization,
  3DS2, Apple Pay/Google Pay, payment API, API idempotency, payment identity,
  webhooks, webhook authentication, race/callback ordering, sandbox, refunds,
  disputes, settlement/reconciliation, fees, marketplace/sub-merchants,
  native split, partner payouts, commercial proposal, operations/security/
  privacy, requested documentation, mandatory matrix, evidence standard,
  requested next steps, cover email).
- **Internal evaluation workbook** — `docs/commercial/az-payment-provider-rfi-internal-workbook.md`
  (NOT to be sent; response-handling protocol, A–E classification, 12 hard
  gates, interpretation rules, evidence standard, per-provider verdict
  template, candidate comparison matrix, 2.12C native-split guardrail).
- **Roadmap/ADR reconciliation** — Roadmap 2.12B entry and ADR-0015 §25 now
  reference the RFI as the commercial-confirmation vehicle.

## 2. Scope discipline

- 0 production code; 0 schema/migrations; 0 webhook routes; 0 PSP adapters;
  0 SDK dependencies; 0 credentials/merchant IDs/account secrets.
- 0 provider responses received yet — `COMMERCIAL CONFIRMATION REQUIRED`.
- No provider approved; no `KNOWN_PAYMENT_PROVIDER_CODES` change; no ADR-0015
  status change; Step 2.12B implementation not started; Step 2.12C not started.

## 3. Why RFI, and what happens after responses

Per ADR-0015, global PSPs are verified-disqualified for canonical V1 (no AZN
settlement for an AZ merchant). The only verified path is a CBA-licensed local
AZ acquirer; onboarding eligibility, technical capability proofs, commercial
quotes and sandbox access are unprovable from public documents. The RFI is the
evidence-collection vehicle. After responses:

1. preserve original answers/attachments verbatim;
2. score every candidate against the workbook's single matrix;
3. reconcile claims with ADR-0015's verified-fact base;
4. classify each candidate A–E; record verdicts per workbook §7 template;
5. only verified evidence may move ADR-0015 to `ACCEPTED`;
6. then Roadmap 2.12B may become `READY FOR IMPLEMENTATION`;
7. execute the existing 2.12B implementation prompt;
8. native split absence → separate 2.12C architecture/business reconciliation
   (ledger-orchestrated payout rail 2.10B), never a silent SPLIT replacement.

## 4. Candidate set (unchanged, NOT approved)

Millikart, Kapital Bank, Azericard, Goldenpay, Pashabank, Birbank, Payme.az —
all require the same confirmation. Global fallback (Adyen/Rapyd/Checkout.com
cross-border with FX) is documented in ADR-0015 §4 as a separate business
decision, NOT approved here.

## 5. Artifact integrity

Roadmap artifact checker: PASS — 0 WARN / 0 FAIL (post-update verified);
checker regression suite green. See the provenance footer below.

## 6. Next step

- Awaiting provider responses (commercial confirmation) — the single remaining
  blocker for 2.12B.
- Then: score per workbook → ADR-0015 ACCEPTED (evidence-only) → Roadmap
  2.12B READY FOR IMPLEMENTATION → existing 2.12B implementation prompt.

REPOSITORY EVIDENCE
repository: travelhub_v1 (local canonical identity)
branch: master
head: 18f410d
origin: 18f410d
worktree_clean: false (unrelated untracked prompts)
migration_count: 57
reviewed_state: COMMIT
reviewed_diff_base: 0cf8b5f
reviewed_diff_head: 18f410d
persistence_status: PERSISTED
persistence_sha: 18f410d
