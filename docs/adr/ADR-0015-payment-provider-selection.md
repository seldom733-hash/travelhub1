# ADR-0015 — Payment Provider Selection: AZN Settlement Requires Local Azerbaijan Acquiring; Global PSPs Deferred

- **Status:** PROPOSED — BLOCKED (2026-08-15) — awaiting **commercial confirmation** from local Azerbaijan acquirer/PSP candidates. Not accepted; no provider approved.
- **Context:** Step 2.12B (Buyer Card / Wallet Payment) requires a canonical production PSP. Repository evidence: Baku/AZ jurisdiction, AZN is the default money unit (pricing docs), USD is the API default unit, RUB is **unconfirmed** as a requirement. External-fact verification against current official provider documentation was performed (2026-08-15); primary sources only.
- **Related:** ADR-0001 (modular monolith), ADR-0010 (business event envelope), ADR-0013 (commission policy contract), ADR-0014 (tenant isolation), Steps 2.12A (provider abstraction), 2.12H (external idempotency), 2.12C (SPLIT_AT_PAYMENT, future), 2.10/2.10A/2.10B (Finance/Ledger/Settlement/Payout foundation).

## 1. Status

**PROPOSED — BLOCKED — COMMERCIAL CONFIRMATION REQUIRED.**

The only verified path to **AZN settlement** for a TravelHub (Azerbaijan) merchant is a **CBA-licensed local Azerbaijan acquirer/PSP**. No candidate's onboarding eligibility, technical capabilities, or commercial terms can be established from public evidence alone; account-level confirmation is required before any approval. No provider is selected in this ADR.

## 2. Context

Step 2.12B was blocked (`PROVIDER SELECTION REQUIRED`, 2026-08-15) because no canonical provider existed. This ADR records the external-fact-verified analysis performed to unblock it, the hard disqualifiers applied to global PSPs, and the exact commercial confirmation required from the local candidates.

Repository evidence (verified 2026-08-15):

- Jurisdiction: Baku, Azerbaijan (`countryCode=AZ`, `cityCode=BAKU`).
- Money units: AZN default in pricing documentation; USD default in API surface; RUB **not confirmed** as a requirement (no canonical requirement found).
- 2.12A: `KNOWN_PAYMENT_PROVIDER_CODES = []` (EMPTY); `FakePaymentProvider` is TEST-ONLY; adapter registration deferred to 2.12B.
- 2.12H: external `Idempotency-Key` contract APPROVED (digest slotKey, DB backstop).
- Payment lifecycle authority: `PaymentService` (single writer); `Payment` frozen-money snapshots; AUTHORIZED/REFUNDED reserved vocabulary.
- 2.12C (SPLIT_AT_PAYMENT), ProviderFee, Refund, Dispute, Settlement, Payout: foundations exist (2.10B) but provider runtime is NOT implemented.

## 3. Decision

**No provider is approved in this pass.** The canonical V1 provider selection is blocked pending commercial confirmation from local Azerbaijan acquiring candidates. Global PSPs are **not** approved as the canonical V1 provider because none can settle in AZN for an Azerbaijan merchant (verified below).

## 4. Selected provider / provider set

**None.** Recommended candidate set for the commercial-confirmation process (not approved):

- **Primary:** Millikart (leading independent Azerbaijan card processor; Visa, Mastercard, MilliKart, UnionPay; merchant acquiring via CBA-licensed partner banks) or **Kapital Bank** acquiring (largest Azerbaijan acquirer; Google Pay live since 2022).
- **Alternatives:** Azericard, Goldenpay, Pashabank, Birbank/m10, Payme.az — all require the same confirmation.
- **Global fallback (documented, NOT approved):** Adyen / Rapyd / Checkout.com cross-border presentment with USD/EUR settlement — only acceptable if the business explicitly accepts FX conversion (AZN presentment → non-AZN settlement) as a **separate business decision**.

## 5. V1 payment rails

Target V1 rails (unchanged from Step 2.12B prompt): card payments (Visa/Mastercard, local MilliKart scheme), Apple Pay, Google Pay, tokenized/provider-hosted card collection; raw PAN/CVC must never reach the TravelHub backend. The confirming provider must expose hosted-fields/tokenization — to be confirmed per candidate.

## 6. Merchant jurisdiction assumptions

- TravelHub legal entity: Azerbaijan (assumed from repo evidence: Baku/AZ, AZN default).
- Azerbaijan regulation: foreign PSPs cannot operate directly without a CBA license or partnership with a CBA-licensed local entity (PayAtlas market research, 2026-01). Local company registration facilitates merchant onboarding with local acquiring banks.
- Onboarding eligibility for the specific legal entity: **COMMERCIAL CONFIRMATION REQUIRED** per candidate.

## 7. Currency support

Verified from current official provider documentation (2026-08-15):

| Currency | Global PSPs (Stripe/Adyen/Rapyd/Checkout.com) | Local AZ acquiring (Millikart/Kapital Bank et al.) |
|---|---|---|
| AZN presentment | Adyen: yes (cross-border); Rapyd: **no** (absent from Collect presentment list); Stripe: n/a (no AZ merchant) | Yes (default local currency) |
| AZN settlement | **None** — Adyen: AZN absent from all settlement-currency tables, AZ not an acquiring region; Rapyd: AZN absent from payout list, settlement for AZ = "All other countries → USD"; Checkout.com: no AZ acquiring, 20 settlement currencies, AZN not local | Yes (default) — **only verified path** |
| USD presentment | Yes (all) | Via local PSPs' multi-currency where supported (limited) |
| USD settlement | Yes | Limited / COMMERCIAL CONFIRMATION REQUIRED |
| RUB presentment | Rapyd: yes; others: partial | Unverified |
| RUB settlement | No (AZ entity settles USD/EUR) | Unverified |
| FX conversion | Presentment → settlement conversion offered (Adyen/Rapyd) | Unverified |

## 8. Card support

- Visa/Mastercard: universal (global and local). Millikart also processes the local MilliKart scheme and UnionPay (millikart.az news).
- Required: 3DS authentication (standard in AZ market; PayAtlas: 3DS strongly recommended, non-3DS carries higher chargeback risk).

## 9. Apple Pay

- **Verified available in Azerbaijan** (launched 2021 with local banks).
- Per-candidate gateway support (merchant country eligibility, domain verification, tokenization): **COMMERCIAL CONFIRMATION REQUIRED**.

## 10. Google Pay

- **Verified available in Azerbaijan** (Kapital Bank enabled Google Pay across Azerbaijan, 2022; azertag).
- Per-candidate gateway support: **COMMERCIAL CONFIRMATION REQUIRED**.

## 11. PCI / tokenization boundary

- Architecture invariant (unchanged): `raw PAN/CVC never reaches TravelHub backend`; provider-hosted checkout or hosted-fields/tokenization required.
- Per-candidate integration pattern (hosted page vs. hosted fields vs. client-side tokenization): **COMMERCIAL CONFIRMATION REQUIRED**. Any candidate requiring raw card handling on TravelHub backend is disfavored/blocking.

## 12. Provider idempotency

- Per-candidate provider-side idempotency (key name, scope, retention, divergent behavior): **unverified — COMMERCIAL CONFIRMATION REQUIRED**.
- TravelHub-side contract already hardened: 2.12A provider-operation identity (`deriveProviderOperationKey`, server-derived, retry-stable) + 2.12H external `Idempotency-Key` (digest slotKey, DB unique backstop, crash-window fault injection). The confirming provider must not be passed the external client key by default.

## 13. Webhook / signature contract

- Per-candidate: event types, signature scheme, raw-body requirement, timestamp/replay protection, retry policy, duplicate delivery, ordering guarantees: **unverified — COMMERCIAL CONFIRMATION REQUIRED**.
- 2.12B must implement durable dedup + reorder-safe processing against the actual signature scheme.

## 14. Event dedup identity

- Per-candidate immutable event ID: **unverified — COMMERCIAL CONFIRMATION REQUIRED** (must support a stable webhook event identity; TravelHub will add its own inbox-dedup layer regardless).

## 15. Callback ordering guarantees / non-guarantees

- Global PSPs: no cross-event ordering guarantee (documented). Local candidates: **unverified**.
- Architecture assumption (unchanged): webhook events are unordered and may be delivered more than once; processing must be reorder-safe (2.12B design, PSP-local multi-instance race matrix documented in 2.12A).

## 16. Sandbox / testing

- CI must stay deterministic and provider-independent: mock transport + contract fixtures + deterministic signature tests (existing 2.12A/2.12H harnesses).
- Optional external sandbox: smoke verification only; **sandbox access is a required confirmation item** (accounts/credentials/limits per candidate).

## 17. 2.12C compatibility

- Global PSPs: Adyen/Rapyd/Checkout.com — marketplace/platform accounts, split/destination, platform fees → `2.12C NATIVE FIT` or `2.12C POSSIBLE WITH LIMITATIONS` (commercial confirmation).
- Local AZ PSPs: simple gateways; native split/destination almost certainly unsupported → `2.12C NOT SUPPORTED NATIVELY`. Mitigation path (already architecture-supported): TravelHub-owned Settlement/Payout modeling (2.10B ledger) with per-merchant payout orchestration as a secondary rail. **This tradeoff must be explicitly accepted by the business** when a local provider is selected.
- Classifications to be re-verified per confirmed candidate.

## 18. ProviderFee / Settlement / Payout compatibility

- Per-candidate: per-transaction fee visibility, settlement batches, payout IDs/status, reconciliation reports, balance transactions: **unverified — COMMERCIAL CONFIRMATION REQUIRED**.
- These feed future ProviderFee/Settlement/Payout producers (2.10B foundations exist); no runtime implemented here.

## 19. Refund / Dispute compatibility

- Per-candidate: refund creation/status, partial refunds, dispute/chargeback events, evidence API: **unverified — COMMERCIAL CONFIRMATION REQUIRED**.
- Refund/Dispute provider runtime is Step 2.13+; selection evidence only.

## 20. Rejected alternatives (for canonical V1, single-provider AZN-settlement path)

- **Stripe** — hard disqualifier: no merchant onboarding in Azerbaijan (Stripe global availability; Azerbaijan absent). Cross-border "via partners" (PayAtlas) is informal and requires a local partner anyway.
- **Adyen** — not acceptable as single canonical provider: Azerbaijan is not an acquiring region; **AZN is absent from all settlement-currency tables** (official supported-payout-currencies page); no AZN settlement.
- **Rapyd** — not acceptable as single canonical provider: **AZN absent from Collect presentment and payout lists**; Azerbaijan falls under "All other countries — USD" settlement (official supported-currencies page). Would impose forced FX (AZN-presented funds settle USD).
- **Checkout.com** — not acceptable as single canonical provider: no direct acquiring in Azerbaijan (APAC/MENAP/UK/EEA/US); AZN settlement unavailable for an AZ entity.
- **Mangopay** — not acceptable: EU-centric marketplace PSP; Azerbaijan not a supported merchant market.
- Rationale: forcing AZN-priced buyers through a non-AZN-settling rail converts every AZN transaction through FX with settlement currency risk — a business-model change, not an implementation detail.

## 21. Commercial unknowns

- Local AZ PSP onboarding eligibility for the TravelHub legal entity (CBA-licensed acquiring bank relationship).
- Commercial terms, pricing, minimums, settlement frequency (AZN) — `COMMERCIAL QUOTE REQUIRED` per candidate.
- Per-candidate technical capability proofs: hosted-fields/tokenization, Apple Pay/Google Pay, webhook signature scheme, provider-side idempotency, sandbox access, API maturity/SLA.
- Whether a global secondary rail (USD settlement, e.g., Adyen via local partner) is a business requirement — separate business decision.

## 22. Consequences

- 2.12B remains **BLOCKED** (provider selection not made); no provider adapter, webhook route, or network runtime is added in this pass.
- No schema/migration/API change; RBAC/public surface unchanged; PaymentService remains the only lifecycle authority.
- The verified disqualification of global PSPs for AZN settlement is durable and reusable for the final decision.
- An architecture risk is explicitly recorded: if the business selects a local PSP (likely without native split), 2.12C SPLIT_AT_PAYMENT must use the ledger-orchestrated payout rail (2.10B) — accepted tradeoff required at selection time.

## 23. Reversibility

- Fully reversible: no code, schema, or runtime changes were made by this decision. The selection remains open; any later approved provider can be implemented against the unchanged 2.12A/2.12H contracts.
- ADR status flips from PROPOSED to ACCEPTED only after commercial confirmation.

## 24. Security constraints

- Raw PAN/CVC never on TravelHub backend (unchanged invariant).
- Webhook authenticity must be verifiable (signature + timestamp/replay protection) — required of the selected provider.
- No credentials, merchant IDs, or account secrets in this ADR or any repository artifact.
- TravelHub-side protections remain: digest slotKeys (2.12H), server-derived provider-operation identity (2.12A), single Payment lifecycle authority.

## 25. Follow-up implementation ownership

1. **Business/product authority**: select local AZ candidate(s) and obtain commercial confirmation (onboarding eligibility, commercial quote, technical capability proofs, sandbox access). The RFI vehicle is ready: sendable questionnaire `docs/commercial/az-payment-provider-rfi.md` + internal scoring workbook `docs/commercial/az-payment-provider-rfi-internal-workbook.md` (verdict template, hard-gate matrix, 2.12C guardrail). Responses must be scored per workbook §8 and reconciled against this ADR before any ACCEPTED flip.
2. Record the confirmed provider decision in this ADR (flip to ACCEPTED) + Roadmap 2.12B entry.
3. Implement Step 2.12B against the existing contract (2.12A adapter boundary + 2.12H idempotency + PaymentService authority + webhook dedup/reorder/multi-instance + PCI tokenized-only).
4. If 2.12C native split is unavailable on the selected rail — record the accepted secondary-rail (ledger-orchestrated payout) tradeoff before 2.12C starts.
