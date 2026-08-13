# Finance Domain Foundation (Phase 2 Step 2.10)

## 1. Purpose

Create the Finance domain foundation: module, identifiers, money contract,
master-data models (Currency/ExchangeRate/Tax/TaxRule) and Finance Center
read/write paths for those reference entities. Payment/Refund/Invoice/
Settlement/Payout/LedgerTransaction are **deferred** (2.12–2.14, 2.10A/2.10B):
aggregate models exist in the schema, client write-paths do not (→ 404).

## 2. Ownership boundary

- **Finance owns** `finance.*` schema exclusively. No other module writes
  Finance master data; Settings does not duplicate currency/tax reference.
- Cross-domain writes: **zero** — Finance master CRUD creates no
  Order/Booking/Product/Availability rows and never touches
  `Order.paymentStatus` (e2e #8).
- Order.paymentStatus / Booking payment facts remain owned by their domains;
  Finance payment writes arrive with 2.12+ under canonical authority.

## 3. Current → Target reconciliation

Baseline had no Finance module/identifiers (no Stripe/Payout code existed).
Created: `finance` schema (10 foundation models), `FinanceModule`, master-data
endpoints, RBAC `finance.*` permissions (verified already granted to
FINANCE/ADMIN; DIRECTOR read-only), identifiers CUR-/FXR-/TAX-/TXR-.

## 4. Aggregates / models

`finance.Currency`, `ExchangeRate`, `Tax`, `TaxRule` (master data, Step 2.10);
deferred (schema-only): `Payment`, `PaymentTerms`, `Refund`, `Invoice`,
`Commission`, `CommissionAccrual` (2.10A/2.10B, 2.12–2.14).
No FKs across schemas (cross-schema reads only per ADR). TaxRule references
Tax by UUID resolved server-side (unknown → 422).

## 5. Money representation

- Never float. Decimals stored as Prisma `Decimal` (rate 10,6; tax rate 12,2).
- API: Decimal strings (`rate: "1.7"`, `"18"` — Decimal.js normalizes trailing
  zeros). `finance.money.ts` centralizes the contract.
- `validateRate`: >0, ≤6 decimal places. `validateTaxRate`: ≥0, ≤2 places.

## 5A. PaymentTerms boundary (STRICT REVIEW 2.10)

Frozen terms в цепочке `Quote → CheckoutIntent → Sale → OrderRequested →
Order` (2.3B) — **единственный authoritative источник** payment terms
(`scheme/prepaymentType/prepaymentValue/initialAmount/remainingAmount`,
DECIMAL(12,2), half-up; источник денег — frozen Checkout total).
`finance.PaymentTerms` (PMT-*) — schema-only placeholder (Roadmap назначает
Finance владение PMT-*), без writer-а/consumer-а/событий: не является
конкурирующим источником и не фиксирует семантику. Жёсткое правило для
2.12: если Finance PaymentTerms будет материализоваться — ТОЛЬКО как
проекция из frozen Order-снапшота (никогда не пересчёт), поля идентичны
контракту 2.3B. Слово schema-only само по себе не authority — ревью
классифицирует модель как SAFE PLACEHOLDER с этим boundary.

## 6. Status vocabulary

Master data uses `isActive` boolean (no lifecycle). Payment/refund status
vocabulary is NOT introduced in foundation — it belongs to 2.12+ (Screen
Design codes; no premature enums).

## 7. Ledger/transaction authority

Deferred to 2.10A (`LedgerTransaction`). Foundation introduces no ledger and no
money movement; it only manages reference data.

## 8. Payment vs ledger distinction

Not applicable in foundation (no payment writes). Boundary documented: Payment
= PSP fact; LedgerTransaction = internal double-entry; neither exists yet.

## 9. Identifiers

`CUR-`, `FXR-`, `TAX-`, `TXR-` + 8-digit sequence via shared `ids.nextCode`
(same pattern as SAL-/ORD-/BRQ-). Registered in `docs/contracts/ids.md`.

## 10. Lifecycle / fact creation authority

Master data created by FINANCE/ADMIN only (`finance.*.manage`). Creation is
server-authoritative: `id/code/createdAt/updatedAt/version` are forged-rejected
(422 via `assertNoForbiddenKeys` on **raw** body — ValidationPipe whitelist
would otherwise silently strip them).

## 11. Idempotency

Duplicate `isoCode` → controlled 409 (unique constraint + ConflictError), no
raw Prisma/500. TaxRule duplicate periods not yet relevant (2.12+).

## 12. Concurrency

Single-writer module; `code` generation inside the same transaction as row
creation (no interleaved duplicates). CAS not required for reference data.

## 13. Atomicity / outbox

Master-data writes are plain transactions (no events in foundation). Future
Finance events must follow ADR-0010 envelope + outbox/inbox + correlation.

## 14. Correlation/causation

N/A in foundation (no domain events emitted). Enforced for future Finance
events per ADR-0010.

## 15. PII/PCI boundary

Master data contains no PII/PCI. Audit details are minimal (`{ code }`) — no
PII, no card data, no customer data. Payment/PCI handling deferred to 2.12+.

## 16. RBAC

- `finance.currency.manage` / `finance.exchange_rate.manage` /
  `finance.tax.manage`: FINANCE + ADMIN.
- DIRECTOR: read-only Finance center (finance.payment/refund/invoice/commission
  read grants; no master-data manage).
- All other roles → 403. Anonymous → 401. Verified in e2e #1/#2.

## 17. Legacy compatibility

No legacy Finance state exists; additive schema, no backfill, no changes to
existing tables. `migrate diff` live→schema: no difference.

## 18. Order/Booking/Availability isolation

Proven by e2e #8: Order count unchanged after Finance writes; no Availability/
Product/acquisition rows touched; `Order.paymentStatus` untouched.

## 19. Migration

`2026…_add_finance_domain_foundation` — purely additive `finance` schema
(tables + indexes + enums). Applied via `migrate dev`; e2e harness replays real
migrations on every run (fresh-replay proof). No `db push`.

## 20. Deferred downstream Finance work

2.10A ledger/transactions; 2.10B provider fee/settlement/payout; 2.10C temporal
milestones (paidAt/authorizedAt/capturedAt — NOT added in foundation, asserted
by e2e #11); 2.12 Payment; 2.13 Refund; 2.14 Invoice; commission accrual.
