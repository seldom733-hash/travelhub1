# TravelHUB --- Unified Finance Center

## Implementation prompt for OpenCode / coding agent

**Repository:** `seldom733-hash/travelhub1`\
**Last known audit baseline:** 2026-10-10, branch `master`, HEAD
`90da728`. Re-check the actual checkout before editing; do not assume
the repository has not advanced.

## 1. Mandatory rules

1.  Inspect repository instructions, current branch/HEAD, `git status`,
    Prisma schema/migrations, current finance services/controllers/RBAC,
    supplier/order/booking lifecycle, catalog/calendar pricing, and
    tests before changing code.
2.  The audit below is a baseline, not a substitute for checking the
    current code. Reuse newer existing work; do not duplicate it.
3.  Do not discard, reset, stash, or overwrite unrelated changes. Use
    additive migrations; do not edit applied migrations. Do not commit
    or push unless explicitly requested.
4.  Preserve production-ready client Payment/Refund/Dispute behavior,
    including idempotency, CAS/concurrency protection, due guards,
    history, and status transitions.
5.  Use decimal-safe money/FX arithmetic, database Decimal types, a
    documented rounding policy, validation, transactions, authorization,
    audit provenance, and idempotency/concurrency protection.
6.  Never claim a test passed unless it was actually run. Do not treat
    schema/API/UI scaffolding as a completed business process.
7.  Implement incrementally, run focused tests after each phase, then
    relevant regressions. Report actual commands and results.
8.  If a critical business event cannot be identified safely, report the
    exact blocker rather than silently guessing.

## 2. Confirmed decisions

### AZN is the unified display and management currency

Display customer-facing prices in AZN in the catalog, calendars, offer
cards, requests and orders. The Finance Center uses AZN for customer
receipts/debt, supplier obligations/payout management equivalents,
expected margin and management reporting, so AZN totals can be added and
subtracted.

**Do not discard source-currency facts.** For supplier prices and actual
payments in non-AZN currencies, preserve original amount and currency
alongside the AZN management equivalent. Actual bank settlement can
differ from management conversion and must be represented transparently.

### Supplier-specific current FX rates

An administrator maintains a current rate for each
`(supplier, source currency)` pair, expressed as
`1 unit of source currency = N AZN`. Example: Summer USD→AZN may differ
from Kompas USD→AZN. These are manually maintained supplier-specific
rates, not hard-coded constants and not automatically fetched market
rates.

-   Support all currencies used by suppliers; the UI may display a
    supplier-row/currency-column matrix, but the underlying storage
    should remain extensible.
-   Store rate, source currency, target currency AZN, supplier, update
    timestamp and actor.
-   Keep auditable rate history: old/new value, timestamp and admin
    identity.
-   AZN→AZN is always 1.
-   Rates must be positive valid decimals. Missing rate must cause a
    clear controlled error; never silently substitute 1 or another
    supplier's rate.
-   Add permission-protected admin UI/API for current rates and history.
-   No external FX feed is required.

### FX snapshots and price flow

When converting a supplier price, preserve an immutable snapshot with
supplier, original amount/currency, applied rate, target AZN amount,
conversion timestamp and rate-history/version reference when feasible.
Freeze source cost, AZN cost, markup/discount inputs and final customer
price in the existing commercial snapshot at the current request/order
acceptance gate.

Flow: 1. Read supplier price/currency. 2. Read that supplier's current
rate to AZN. 3. Convert using exact decimal arithmetic and documented
rounding. 4. Apply the existing TravelHUB markup/discount rules in their
existing intended order. 5. Display the final customer price in AZN. 6.
Freeze commercial terms at request submission/price acceptance according
to the existing lifecycle.

Changing a current rate affects future calculations only. It must not
rewrite already submitted requests, accepted prices, confirmed orders,
historical payments or obligations. Do not create a second pricing
engine. Inspect existing markup logic and document/test the actual
formula; do not silently change markup semantics.

### Supplier obligation versus payout

The last audit found no production supplier-payable workflow. Add a
distinct `SupplierObligation` model unless current code inspection
proves a newer existing model already fulfills this role.

-   **Supplier obligation:** amount owed for a confirmed supplier
    service/order item.
-   **Payout:** actual outgoing payment. Reuse/extend existing `Payout`
    foundation.
-   **Settlement:** retain a distinct meaning; do not conflate it with
    obligations or actual payout.

An obligation must include supplier, order/order-item/service
references, source supplier amount/currency, frozen AZN management
equivalent, applied rate snapshot, status, timestamps and provenance.
Status semantics at minimum: `OPEN`, `PARTIALLY_PAID`, `CLOSED`,
`CANCELLED`, `ADJUSTED`. Preserve history rather than silently
deleting/re-writing financial facts.

Create the obligation idempotently when the supplier confirms the
service/booking (or the exact equivalent event in current architecture),
not when a customer merely submits a request. First identify the real
lifecycle event and document why it is the correct trigger. Missing
commercial snapshot/rate is `UNKNOWN`/blocked, never zero. Support
multiple suppliers/services per order at item/service level.

### Partial payouts

Allow multiple partial payouts per obligation. Initial scope: one payout
allocates to one obligation. A payout represents money actually sent and
should include amount, actual/source currency where relevant, AZN
management equivalent, supplier/payee, method, occurred-at timestamp,
external/provider reference, actor/provenance, reason and optional
evidence.

-   Use existing idempotency semantics; same-reference/same-payload
    replay is safe, divergent replay is a controlled conflict.
-   Transactionally protect remaining amount against concurrent payouts.
-   Update paid/remaining/status atomically.
-   Reject overpayment unless an explicitly designed advance workflow
    exists.
-   Preserve actual bank movement amount/currency separately from
    obligation AZN equivalent. If the actual payment FX differs,
    represent FX variance; do not silently change the frozen obligation.

### Profit is not cash flow

Implement distinct metrics: - **Expected gross margin (AZN):** frozen
final customer price AZN minus frozen supplier cost AZN from commercial
snapshot. Missing data = `UNKNOWN`, not zero. - **Customer cash received
(AZN):** existing Payment source of truth and refund semantics; do not
double-count Order projection fields. - **Customer debt (AZN):**
existing Order/payment source of truth. - **Supplier obligation
total/paid/remaining (AZN):** obligation source of truth. - **Supplier
cash paid (AZN):** actual payout records, not obligation amount. - **Net
cash flow:** only when actual incoming/outgoing movement sources are
explicit and complete. - **Actual profit:** only under a documented
recognition policy. Initial accrual-lite policy may recognize
revenue/cost at an approved order/service-confirmation event, with
cancellations/refunds/adjustments represented explicitly. If current
lifecycle cannot identify this event reliably, mark actual profit
unavailable rather than inventing it.

Never label `captured client payments − supplier payouts` as profit.
Platform commission income, ProviderFee (PSP expense), supplier cost,
refunds, penalties and FX variance are separate concepts. Do not treat
ProviderFee or commission accrual as supplier payout; do not double
count markup/commission in gross margin and a second income line. Mark
partial metrics and disclose excluded components.

## 3. Last known audit findings --- verify first

The read-only audit dated 2026-10-10 reported: - Client payments and
refund/chargeback workflows are production-ready. `Payment` is source of
truth; `Order.paidAmount`, `refundedAmount`, `paymentStatus` are
projections. - `Currency`/`ExchangeRate` are master data, but no
conversion engine/UI exists. - `commercialSnapshot` freezes commercial
terms but has no profit consumer. - `ProviderFee`, `Settlement`,
`Payout`, `LedgerTransaction` are foundations; write routes/business
wiring are missing or incomplete. - No supplier obligation/payable model
existed. - No production ledger postings are generated from
capture/refund/payout. - Finance UI lacked overview, supplier payouts,
debts, profit and reconciliation. - Existing payout/ledger tests are
foundation tests, not proof of end-to-end payout workflow. - Existing
permissions had read rights but no payout write permission. - Baseline
HEAD was `90da728`; verify current state.

## 4. Implementation phases

### Phase 0 --- inspect and map

Check current Git state and instructions. Map supplier pricing →
catalog/calendar → request acceptance → commercial snapshot →
order/booking lifecycle; currency schema/UI/RBAC;
payment/refund/payout/ledger services; supplier-confirmation event and
supplier/order-item cardinality. Proceed when safe; list genuine
blockers.

### Phase 1 --- FX rates and conversion

Implement supplier-specific rates and append-only/auditable history,
admin CRUD/UI/RBAC, decimal-safe conversion service, catalog/calendar
AZN display, server-side rate selection and frozen commercial snapshots.
Add tests for missing rates, invalid rates, supplier-specific
differences, rounding, and proving current-rate changes do not mutate
old requests/orders. Preserve existing markup behavior.

### Phase 2 --- supplier obligations and payouts

Add `SupplierObligation` with additive migration, idempotent creation on
verified supplier-confirmation event, read/write API/RBAC, partial
payout API/UI reusing `Payout`, atomic remaining/status updates,
overpayment/concurrency/idempotency protections, cancellation/adjustment
handling and audit trail. Test duplicate lifecycle events, partial/full
payouts, overpayment, concurrent payouts, replay/conflict, missing
snapshot/rate, unauthorized access and rollback.

### Phase 3 --- finance/profit services

Add backend queries for expected margin, customer received/debt,
supplier obligation paid/remaining, supplier cash paid, and actual
profit only when supported by recognition policy. Return
`UNKNOWN`/availability metadata for incomplete data. Avoid double
counting payments/projections/refunds/commission/ProviderFee/payout.
Test cancellations, refunds, multiple suppliers, adjustments, missing
snapshots and rounding.

### Phase 4 --- unified Finance Center UI

Extend the existing Finance navigation, reusing `/app/payments` rather
than forking it. Provide: 1. Overview --- customer receipts/debt,
supplier payouts/debt, expected margin, actual profit and cash flow only
when supported. 2. Client payments --- existing workflow. 3. Supplier
payouts --- list/create, supplier/date/status filters. 4. Debts ---
customer debt and supplier obligations with drilldown. 5. Profit ---
expected margin by order/supplier/service/period and supported actual
profit. 6. FX rates --- supplier-by-currency current rates and history.
7. Reconciliation/Ledger --- show as a reliable reconciliation feature
only after actual posting sources are wired.

Main management totals are AZN. Show source currency/amount beside AZN
equivalent where relevant. Distinguish zero from unknown/unavailable.
Make KPI cards drill down to source records.

### Phase 5 --- ledger and cash flow

After domain events are reliable, wire successful capture, processed
refund, payout and explicit reversal/adjustment events to the existing
append-only ledger, with idempotency, source provenance, occurred-at
timestamps and retry safety. Use the repository's transaction/outbox
conventions. No entry for failed operations; no duplicate posting on
retries. Do not call it double-entry accounting unless balanced
double-entry behavior is truly implemented.

### Phase 6 --- regression and verification

Run focused unit/E2E tests, existing payment/refund regressions,
request/order/booking lifecycle tests, currency/markup/catalog/calendar
tests, RBAC tests, Prisma validation/generation, migration checks,
lint/typecheck/build commands supported by the repo. Investigate known
baseline failures separately; do not change unrelated behavior silently.

## 5. API, RBAC and integrity

Follow existing route/DTO conventions for FX rate
list/current/history/mutations, obligations list/detail, payout
list/create/detail, and finance overview/profit/debt queries.

Separate read permissions from write permissions. Add least-privilege
permissions for finance overview, obligation read, payout write, FX-rate
management/history and profit/reconciliation. Payment-read permission
must not imply payout-write or FX-admin access.

All amounts, FX rates, supplier IDs, order/item links and remaining
balances must be validated server-side. Do not trust client-supplied AZN
totals or applied rates. Mutations require transactions,
audit/provenance and duplicate/concurrency protection.

Explicitly test: missing rate; AZN identity conversion; rate changes
after request/order; missing snapshot; request expiry/rejection before
supplier confirmation; duplicate confirmation; multiple suppliers;
cancellation/rejection/adjustment; partial payouts; concurrent
overspend; duplicate provider reference same/divergent payload; actual
payment in different currency; FX variance; refund/chargeback not
creating supplier payout; ProviderFee not being supplier cost;
commission not being payout; decimal rounding; unauthorized rate/payout
mutation; retry without duplicate obligation/payout/ledger entry.

## 6. Acceptance criteria

-   [ ] Admin can maintain different USD→AZN/EUR→AZN rates per supplier;
    history records old/new rate, actor and timestamp.
-   [ ] Catalog and calendars show converted AZN prices for non-AZN
    supplier prices.
-   [ ] Requests/orders are priced in AZN and preserve source
    amount/currency/rate snapshot.
-   [ ] Missing rates fail clearly; no silent fallback.
-   [ ] Rate edits do not rewrite submitted requests or confirmed
    orders.
-   [ ] Supplier confirmation creates exactly one obligation with source
    and AZN snapshot.
-   [ ] Multiple partial payouts correctly update remaining balance;
    full payment closes obligation; overpayment/concurrent overspend are
    prevented.
-   [ ] Payout records actual outgoing movement, distinct from
    obligation.
-   [ ] Cancellations/adjustments preserve auditable history.
-   [ ] Overview totals are in AZN and derived from correct
    source-of-truth records.
-   [ ] Expected margin comes from frozen commercial snapshots; missing
    data is UNKNOWN.
-   [ ] Profit, cash flow, customer receipts/debt, supplier obligations
    and payouts are separate metrics.
-   [ ] Refunds, ProviderFee, commission and FX variance are not double
    counted.
-   [ ] Read/write permissions are separate and tested.
-   [ ] Relevant regressions pass or pre-existing failures are
    explicitly isolated and reported.
-   [ ] UI never labels an incomplete foundation as production-ready.

## 7. Final report required

Report current branch and starting/ending HEAD; exact changed files by
schema/migration/backend/API-RBAC/frontend/tests; migration purpose; FX
formula and rounding policy; supplier-confirmation trigger;
expected/actual profit formulas and excluded components; commands
actually run and real test counts; known pre-existing failures;
unfinished items and blockers; and whether changes were committed/pushed
(default: neither).

Do not finish with a generic "done". Map every acceptance criterion to a
test or explicitly mark it unverified.
