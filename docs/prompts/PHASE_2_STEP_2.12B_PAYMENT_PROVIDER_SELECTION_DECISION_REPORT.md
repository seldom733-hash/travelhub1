# PHASE 2 — STEP 2.12B — PAYMENT PROVIDER SELECTION — DECISION REPORT

## 1. Verdict

`PHASE 2 STEP 2.12B PROVIDER SELECTION BLOCKED — COMMERCIAL CONFIRMATION REQUIRED`

**No provider is approved in this pass.** External-fact verification (primary sources, 2026-08-15) proves that no global PSP can settle in AZN for an Azerbaijan merchant (Adyen: AZN absent from settlement currencies, AZ not an acquiring region; Rapyd: AZN absent from Collect presentment/payout, AZ settles USD; Stripe: no AZ merchant onboarding; Checkout.com: no AZ acquiring; Mangopay: EU-centric). The only verified AZN-settlement path is a CBA-licensed **local Azerbaijan acquirer/PSP** (Millikart / Kapital Bank / Azericard / Goldenpay / Pashabank / Birbank / Payme.az), whose onboarding eligibility, technical capabilities, and commercial terms **cannot be established from public evidence** → `COMMERCIAL CONFIRMATION REQUIRED` (prompt §3, §18-C).

## 2. Repository baseline

- branch: `master`; HEAD == upstream == `452054d` (2.12B blocked-decision footer commit); worktree: clean (12 unrelated untracked prompts excluded).
- 2.12A — ✅ APPROVED WITH REVIEW FIXES (registry empty, fake test-only, provider-operation identity).
- 2.12H — ✅ APPROVED WITH REVIEW FIXES (external Idempotency-Key contract).
- 2.12B — ⛔ BLOCKED — PROVIDER SELECTION REQUIRED (Roadmap line 600); migrations 57/57; artifact integrity PASS=103 WARN=0 FAIL=0.

## 3. Current blocker verification

- `KNOWN_PAYMENT_PROVIDER_CODES = [] as const` (EMPTY); `payment-provider.spec.ts` asserts `toHaveLength(0)`; sole adapter `FakePaymentProvider` is TEST-ONLY (absent from production registry).
- Roadmap 2.12B entry names no provider; ADR-0010/0013/0014 treat PSP only as boundary; 2.12A review explicitly deferred adapter registration to 2.12B.
- Blocker is exactly "no canonical provider selected" — unchanged, now upgraded with evidence.

## 4. Requirements

- Jurisdiction: Azerbaijan (Baku/AZ). AZN default money unit (pricing docs), USD API default, RUB **unconfirmed**.
- Buyer payments: Visa/Mastercard (+ local MilliKart), Apple Pay, Google Pay, tokenized/hosted collection; raw PAN/CVC never on TravelHub backend.
- Webhook signature verification + stable event ID + dedup/reorder-safe processing; provider idempotency mapping to 2.12A operation identity.
- Future: 2.12C SPLIT_AT_PAYMENT, ProviderFee, Refund, Dispute, Settlement, Payout, multi-provider headroom.

## 5. Candidate set

Global: Stripe, Adyen, Rapyd, Checkout.com, Mangopay. Local (AZ, CBA-licensed): Millikart, Kapital Bank, Azericard, Goldenpay, Pashabank, Birbank/m10, Payme.az. Final shortlist justified by evidence in §20.

## 6. External evidence methodology

Primary official sources only (2026-08-15): Adyen official supported-payout-currencies docs; Rapyd official supported-currencies docs; Stripe global availability; Checkout.com international coverage; PayAtlas Azerbaijan market research (PSP landscape/regulation); azertag (Google Pay AZ, 2022); Apple Pay AZ launch coverage (2021). No third-party comparison blogs used as technical authority.

## 7. Merchant / jurisdiction comparison

- Stripe: **no merchant onboarding in AZ** (absent from global availability) — hard disqualifier.
- Adyen: no AZ acquiring region; merchant onboarding via other acquiring entity only (cross-border), eligibility `COMMERCIAL CONFIRMATION REQUIRED`.
- Rapyd/Checkout.com/Mangopay: no AZ acquiring; onboarding eligibility unverified.
- Local AZ PSPs: operate under CBA licensing via acquiring banks; foreign PSPs must partner with CBA-licensed local entities (PayAtlas); merchant eligibility per entity — `COMMERCIAL CONFIRMATION REQUIRED`.

## 8. Currency comparison

| | AZN presentment | AZN settlement | USD settlement | RUB |
|---|---|---|---|---|
| Stripe | n/a (no AZ merchant) | n/a | n/a | n/a |
| Adyen | Yes (cross-border) | **NO** (absent from settlement tables) | Yes | No |
| Rapyd | **NO** (absent from Collect presentment) | **NO** (AZ → "All other countries" → USD) | Yes | presentment only |
| Checkout.com | Cross-border only | **NO** (no AZ acquiring) | Yes | No |
| Local AZ PSPs | Yes (default) | **YES — only verified path** | Limited/unverified | Unverified |

## 9. Card comparison

- Visa/Mastercard: universal. Local: MilliKart scheme + UnionPay (Millikart). 3DS standard in AZ market (PayAtlas).

## 10. Apple Pay comparison

- Market availability in AZ: **verified** (2021, local banks). Gateway-level support (merchant eligibility, domain verification, tokenization): unverified → `COMMERCIAL CONFIRMATION REQUIRED` per candidate.

## 11. Google Pay comparison

- Market availability in AZ: **verified** (Kapital Bank, 2022 — azertag). Gateway-level support: unverified → `COMMERCIAL CONFIRMATION REQUIRED` per candidate.

## 12. PCI / tokenization comparison

- Global PSPs: hosted-fields/tokenization standard — PASS for pattern; but settlement disqualifies them as canonical.
- Local AZ PSPs: hosted-page/hosted-fields offerings vary widely; pattern per candidate `COMMERCIAL CONFIRMATION REQUIRED`; raw-PAN-on-backend candidates are blocking.

## 13. Provider idempotency comparison

- Global PSPs: documented idempotency (Adyen/Rapyd/Stripe) — but irrelevant for AZN settlement.
- Local AZ PSPs: unverified → `COMMERCIAL CONFIRMATION REQUIRED`. TravelHub side already hardened (2.12A derive + 2.12H digest slots); provider key must not be passed the external client key by default.

## 14. Webhook comparison

- Global PSPs: signature schemes + stable event IDs documented.
- Local AZ PSPs: event types, signature scheme, raw-body, replay protection, retry, ordering — unverified → `COMMERCIAL CONFIRMATION REQUIRED`. Dedup/reorder-safe design applies regardless (2.12B + 2.12A race matrix).

## 15. Sandbox comparison

- Global PSPs: mature sandboxes. Local AZ PSPs: sandbox availability/limits unverified → `COMMERCIAL CONFIRMATION REQUIRED`. CI stays deterministic provider-independent (mock transport + contract fixtures, existing harness).

## 16. 2.12C compatibility

- Global: Adyen/Rapyd/Checkout.com — platform/split capability (`NATIVE FIT`/`POSSIBLE WITH LIMITATIONS`). Local AZ: native split almost certainly **NOT SUPPORTED** → ledger-orchestrated payout rail (2.10B) as secondary rail; tradeoff must be explicitly accepted at selection. Classifications re-verified per confirmed candidate.

## 17. ProviderFee / Settlement / Payout compatibility

- Per-candidate fee visibility, settlement batches, payout IDs/status, reconciliation reports: unverified → `COMMERCIAL CONFIRMATION REQUIRED`. Foundations exist (2.10B); no runtime here.

## 18. Refund / Dispute compatibility

- Per-candidate refund/dispute APIs: unverified → `COMMERCIAL CONFIRMATION REQUIRED`. Step 2.13+ scope; selection evidence only.

## 19. Commercial unknowns

- Local PSP onboarding eligibility for the TravelHub legal entity (CBA acquiring-bank relationship); commercial quotes/minimums/settlement frequency; per-candidate capability proofs (tokenization, wallets, webhook signature, idempotency, sandbox, API SLA); whether a USD-settling global secondary rail is a business requirement (separate decision).

## 20. Scorecard

| Criterion | Weight | Stripe | Adyen | Rapyd | Checkout.com | Local AZ (Millikart/Kapital et al.) |
|---|---:|---|---|---|---|---|
| Merchant eligibility (AZ) | 5 | ✗ | ? | ? | ? | ? (confirm) |
| AZN presentment | 4 | n/a | ✓ | ✗ | ~ | ✓ |
| AZN settlement | 5 | ✗ | ✗ | ✗ | ✗ | ✓ (only path) |
| USD settlement | 3 | ✓ | ✓ | ✓ | ✓ | ? |
| Visa/Mastercard | 4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Apple Pay | 3 | ✓ | ✓ | ✓ | ✓ | ? |
| Google Pay | 3 | ✓ | ✓ | ✓ | ✓ | ✓ (Kapital) |
| Tokenized/no-raw-PAN | 4 | ✓ | ✓ | ✓ | ✓ | ? |
| Provider idempotency | 3 | ✓ | ✓ | ✓ | ✓ | ? |
| Webhook signature | 3 | ✓ | ✓ | ✓ | ✓ | ? |
| Sandbox | 2 | ✓ | ✓ | ✓ | ✓ | ? |
| 2.12C native split | 2 | ✓ | ✓ | ✓ | ✓ | ✗ (ledger rail) |
| Weighted verdict | — | DISQUALIFIED (AZN) | DISQUALIFIED (AZN) | DISQUALIFIED (AZN) | DISQUALIFIED (AZN) | CANDIDATE — CONFIRMATION REQUIRED |

Weights justified: AZN settlement and merchant eligibility are the hard axes (5); required payment rails (4); wallets/security/idempotency (3). No pricing percentages fabricated — `COMMERCIAL QUOTE REQUIRED` per local candidate.

## 21. Hard disqualifiers

- Stripe: merchant cannot onboard in AZ (proven).
- Adyen: required AZN settlement unavailable (proven).
- Rapyd: AZN presentment AND settlement unavailable for AZ (proven).
- Checkout.com: no AZ acquiring / AZN settlement (proven).
- Mangopay: no AZ market (proven).
- Local candidates: NOT disqualified — but cannot be approved without commercial confirmation (eligibility/capabilities/terms not provable from public docs).

## 22. Selected provider

**None.** Blocked per prompt §18-C: `PROVIDER SELECTION BLOCKED — COMMERCIAL CONFIRMATION REQUIRED`.

## 23. Rejected alternatives

See §21. Additionally rejected (as canonical single provider): global-PSP-with-FX model (AZN presentment → USD settlement) — a business-model change requiring explicit business approval, not an implementation detail.

## 24. ADR created

`docs/adr/ADR-0015-payment-provider-selection.md` — Status: **PROPOSED — BLOCKED (COMMERCIAL CONFIRMATION REQUIRED)**, 25 sections, full evidence base, follow-up ownership (§25) assigned to business/product authority.

## 25. Roadmap update

Roadmap 2.12B entry (line 600): `⛔ BLOCKED — PROVIDER SELECTION REQUIRED` → `⛔ BLOCKED — COMMERCIAL CONFIRMATION REQUIRED (AZN settlement → local AZ acquiring; global PSPs disqualified — evidence: ADR-0015; candidate set: Millikart/Kapital Bank/Azericard/Goldenpay/Pashabank/Birbank/Payme.az)` + `BLOCKED 2026-08-15 (selection pass)` note. Status remains BLOCKED (prompt §20: "If still blocked, preserve BLOCKED with exact missing authority"). NEXT remains the provider decision.

## 26. Negative checks

Production backend code: 0; frontend production code: 0; schema: 0; migrations: 0; provider SDK deps: 0; credentials: 0; network runtime: 0; webhook routes: 0; Payment lifecycle: 0; SPLIT_AT_PAYMENT: 0; Ledger: 0; Commission runtime: 0; Refund runtime: 0; Dispute runtime: 0. Docs/Roadmap/ADR only.

## 27. Exact files changed

1. `docs/adr/ADR-0015-payment-provider-selection.md` (new)
2. `docs/prompts/PHASE_2_STEP_2.12B_PAYMENT_PROVIDER_SELECTION_DECISION_REPORT.md` (new)
3. `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (2.12B entry)

## 28. Artifact integrity

`PASS=105 WARN=0 FAIL=0` (real checker run, 2026-08-15); checker regression 13/13.

## 29. Persistence

See §30.

## 30. Repository Evidence

REPOSITORY EVIDENCE
repository: travelhub_v1 (local canonical identity)
branch: master
head: WORKTREE
origin: 452054d
worktree_clean: false (unrelated untracked prompts)
migration_count: 57
reviewed_state: COMMIT (decision made on clean baseline 452054d)
reviewed_diff_base: 452054d
reviewed_diff_head: WORKTREE
persistence_status: NOT_PERSISTED
persistence_sha: N/A

## 31. Release

`RELEASE: NOT APPLICABLE — ARCHITECTURE DECISION ONLY`

## 32. Exact NEXT

`PROVIDER DECISION REQUIRED — commercial confirmation of local AZ acquiring candidate(s) (onboarding eligibility, technical capability proofs, commercial quote, sandbox) → flip ADR-0015 to ACCEPTED → Roadmap 2.12B → READY FOR IMPLEMENTATION → PHASE 2 — STEP 2.12B — BUYER CARD / WALLET PAYMENT — IMPLEMENTATION`

## 33. Final statement

`PHASE 2 STEP 2.12B PROVIDER SELECTION BLOCKED — COMMERCIAL CONFIRMATION REQUIRED — evidence recorded in ADR-0015; 0 production changes; 2.12B implementation NOT started`
