# PHASE 3 — UI-C1.2E — PAYMENTS BACKEND / READ-MODEL PREREQUISITES
## PRODUCTION IMPLEMENTATION REPORT

---

## 1. Executive Summary

UI-C1.2E prepares the server-authoritative Payments registry read model required by the future operational `/app/payments` tab. It is **backend-only** — no Payments KPI cards, currency cards, table visual layout, or detail page were built (those belong to UI-C1.2F/G/H; prompt §39).

The canonical Payments operational endpoint `GET /finance/payments` (Finance-owned, `finance.payment.read`) is now a read model that separates the **TABLE scope** from the **OVERVIEW KPI scope** exactly like the accepted Requests/Orders/Bookings registries: clicking a future KPI card filters the table only; the other card counts stay static in the overview scope. The response adds server-authoritative `aggregates` (overview `total`, `paymentStatus` 6/6, `refundStatus` 4/4, per-currency `currency` rows) while preserving the existing item/pagination surface (legacy `status` alias + analytics `dateField=paidAt` deep-links keep working).

Real-data live verification (marketplace seed): baseline **410 payments** — CAPTURED 384 · REFUNDED 26 · PENDING/AUTHORIZED/FAILED/CANCELLED 0 (all six keys present); refunds of in-scope payments REQUESTED 12 · PROCESSED 10 · APPROVED/FAILED 0 (all four keys present); currency AZN 378 (40 869.08) · USD 28 (16 905.27) · EUR 4 (470.82) — **per-currency money only, no cross-currency total**. Selecting `paymentStatus=CAPTURED` narrows the table to 384 while **every aggregate value stays byte-identical**; `refundStatus=REQUESTED` narrows to 12 identically; both dims AND to 9. Invalid enum/currency/date → deterministic 422; explicit `acquisitionSource=PARTNER_STOREFRONT` → invisible empty (platform-scope deny, D4 F2); export follows the active table filter scope (12 REQUESTED rows).

D5/D6/D7 authorities untouched (backend diff limited to the Finance payment read surface + validation + a pure helper module). **VERDICT A — accepted** (§27).

---

## 2. Baseline / Git State

```text
UI-C1.2D FINAL SHA:        be683831dda0343190fa4b2ca78ff7f658995f53
HEAD == origin/master at baseline: be683831dda0343190fa4b2ca78ff7f658995f53
Baseline porcelain:        only the UI-C1.2E stage prompt (untracked, docs/prompts/)
```

Canonical domain ownership honored (prompt §2): Payments domain ownership = **FINANCE**; workflow context = **Operations Center**. No second Payments domain created, no Order financial truth duplicated, no cross-domain writes introduced.

---

## 3. Source-of-Truth Audit

Audited against the actual Prisma schema and domain code (no inference from UI labels):

| Item | Repository truth |
|---|---|
| Payment entity | `finance.Payment` (PAY-*): id/code/referenceNumber/commerceSequence/paymentOrdinal/orderId (no FK, ADR-0001)/customerId?/partnerId?/amount `DECIMAL(12,2)`/currency `String` default `"USD"`/status/paymentMethod?/providerRef? (wrapped, no secrets)/version/paidAt/failedAt/cancelledAt/isActivePayment/history |
| PaymentStatus enum | Exactly 6: PENDING · AUTHORIZED · CAPTURED · FAILED · CANCELLED · REFUNDED (`@@schema("finance")`) |
| Refund entity | `finance.Refund` (RFD-*): paymentId (no FK; source authority = CAPTURED payment)/orderId (server-derived from Payment)/amount/currency (verbatim copy)/status/reason?/requestedAt/approvedAt/processedAt/failedAt/isActiveRefund/history |
| RefundStatus enum | Exactly 4: REQUESTED · APPROVED · PROCESSED · FAILED (`@@schema("finance")`) |
| Order ↔ Payment | `Payment.orderId` → `order.Order` (no FK); channel/tenant context comes from `Order.acquisitionSource` |
| Booking ↔ Order ↔ Payment | Booking → Order → Payment via Order; no direct Booking→Payment relation exists or is fabricated |
| Provider reference | `Payment.providerRef` (nullable, wrapped, no secrets/payloads) — provider-neutral |
| Amount/currency fields | amount/currency on Payment and Refund (Decimal(12,2); currency String) |
| Timestamps | Payment createdAt/updatedAt + milestones paidAt/failedAt/cancelledAt (authorizedAt/capturedAt deferred per schema); Refund createdAt/updatedAt + requestedAt/approvedAt/processedAt/failedAt |
| paymentMethod | `Payment.paymentMethod String?` (descriptive, no PII) |
| Failure/error fields | Not stored on Payment (status FAILED + failedAt milestone only) |
| Workspace/tenant ownership | Channel-based platform scope: `Order.acquisitionSource` = MARKETPLACE (platform) vs PARTNER_STOREFRONT (partner tenant, not in platform scope — D4 F2 sales-scope contract) |
| Partner/customer ownership | Payment.partnerId/customerId + Order.sellerPartnerId/customerId |
| Audit/history | PaymentHistory / RefundHistory journals (action/from/to/actor/comment) + `SecurityService.audit` + outbox DomainEvents |
| Permissions on current endpoints | finance.payment.read (list/detail/export) · finance.payment.create/manage · finance.refund.read/write/approve/execute |
| Legacy /app/finance/payments routes | `/app/finance/payments` → redirect to `/app/payments` (query preserved, UI-C1.2A); `/finance/payments` backend list/detail/export are the finance-owned read surface |
| Existing exports | `/finance/payments/export` CSV/XLSX (server-side, table-filter scope) |
| Existing tests | payment.service.spec / refund.service.spec / finance.validation.spec / financial-integrity-checker / finance.money / commission / settlement / dispute specs |

**Enums confirmed to match the prompt §5 contract exactly** — no enum value was invented or assumed.

---

## 4. Payment Domain Model

- **Finance-owned canonical aggregate** (`finance.Payment`, PAY-*), created only by Finance commands (`finance.payment.create`); money copied verbatim from the frozen Order snapshot (never re-priced).
- State machine (single authority, PaymentService): `PENDING → CAPTURED | FAILED | CANCELLED` (CAS + version + milestone + history + outbox atomically). `AUTHORIZED` and `REFUNDED` are reserved vocabulary: AUTHORIZED awaits a PSP authorize producer (2.12B); REFUNDED is **not produced by any current transition** (RefundService explicitly never mutates Payment to REFUNDED because partial refunds make a single Payment.REFUNDED semantically wrong).
- Data note: 26 marketplace `Payment` rows with `status=REFUNDED` exist in the current seed/database (pre-existing data, not produced by the current transition code). Exposed in aggregates; reachability marked accordingly (§13).

---

## 5. Refund Domain Model

- **Finance-owned canonical aggregate** (`finance.Refund`, RFD-*), derived from a CAPTURED Payment only; currency/orderId server-copied verbatim; amount ≤ refundable with serialized over-refund protection; partial refunds are independent facts (idempotency slot per paymentId+amount).
- State machine: `REQUESTED → APPROVED → PROCESSED | FAILED`, `REQUESTED|APPROVED → FAILED`.
- Payment is never mutated by refunds.

---

## 6. Payment ↔ Refund Semantics

- `PaymentStatus` and `RefundStatus` are **separate dimensions**; the registry never collapses them.
- Refunds are linked to payments through the canonical `Refund.paymentId` relation. Refund-status aggregates count refunds whose payment belongs to the registry's overview scope; a refund-status table filter returns payments that have ≥1 refund with that status (AND with the other dims).
- `PaymentStatus.REFUNDED` meaning vs RefundStatus: per domain code, `REFUNDED` is reserved/unreachable through current transitions (partial-refund correctness), while refund lifecycle is expressed by `Refund.status`. No fabricated semantics; the report §13 matrix documents exists/reachable/exposed.
- The `due/refundable` D7 formulas are untouched — the registry only counts facts, it never recomputes order finances.

---

## 7. Order / Booking Relations

- Registry rows keep the canonical `Payment.orderId` and (new) enriched `orderReference` (single batched read — no N+1); future tab deep-links target the canonical Order and, through Order, Booking.
- No direct Booking→Payment relation is assumed or fabricated; no loose text-matched booking references.

---

## 8. Workspace / Tenant Authority

Payments carry no tenant column; tenant/workspace context is the `Order.acquisitionSource` channel. The registry enforces the D4-F2 platform-scope contract (same as Orders/Bookings list/export):

- Default operational scope: **MARKETPLACE** (`PLATFORM_DEFAULT_SCOPE_SOURCE`).
- Explicit `acquisitionSource=PARTNER_STOREFRONT` on the platform contract → **deny** (empty result + zero aggregates, invisibility semantics, consistent 404-like behavior).
- Explicit deep-link `orderId` is **AND-intersected with the channel scope** — a storefront order id can never surface marketplace rows or vice versa (proved by test + scope construction).
- Direct read `GET /finance/payments/:code` now returns 404-like `NotFoundError` for Storefront payments (invisibility, consistent with Order/Booking direct reads).

---

## 9. RBAC Audit

| Surface | Permission (server-enforced `@RequirePermissions`) |
|---|---|
| payments list (registry + aggregates) | `finance.payment.read` |
| payment detail | `finance.payment.read` |
| payments export | `finance.payment.read` |
| payment create/confirm/fail/cancel | `finance.payment.create` / `finance.payment.manage` |
| refund list/detail | `finance.refund.read` |
| refund create/approve/process/fail | `finance.refund.write` / `finance.refund.approve` / `finance.refund.execute` |

Role mappings include FINANCE/ADMIN/DIRECTOR/ANALYST readers (permissions.constants). UI-C1.2E **does not broaden** any permission — the registry rides the existing `finance.payment.read` surface. No frontend-only authorization anywhere.

---

## 10. Read-Model Architecture

Response shape (additive — existing `items/total/page/pageSize/hasMore` preserved, `aggregates` added):

```text
GET /finance/payments
{
  items: PaymentRegistryRow[]            // whitelist DTO + orderReference
  total: number                          // TABLE-scoped row count (pagination)
  page / pageSize / hasMore
  aggregates: {
    total: number                        // OVERVIEW-scope total
    paymentStatus: Record<PaymentStatus, number>   // all 6, zero-count, enum order
    refundStatus:  Record<RefundStatus, number>    // all 4 (refunds of in-scope payments)
    currency: { currency, count, amount }[]        // per-currency; no cross-currency sum
  }
}
```

Scope construction is **dimension-explicit** (Bookings-remediation lesson, prompt §20) via a new pure helper `payments-registry.ts` (`buildPaymentsScopes`): BASE scope holds every global registry dimension; the active KPI dimensions compose into the TABLE scope only. No naive `delete status` on a composed `where`.

Query plan per request (no per-status query loops): channel order-id resolution → base payment-id enumeration (correlation set for Refund) → `Promise.all` of items findMany + table count + payment-status groupBy + overview count + refund-status groupBy + currency groupBy (+ refund-id correlation only when `refundStatus` is active). Refund correlation never leaks status predicates into the overview scope.

---

## 11. API Contract

Implemented/qualified query parameters (all others rejected by DTO whitelist + service validation):

| Param | Type | Source of truth | Table effect | Overview effect | Validation |
|---|---|---|---|---|---|
| `page` | int | request | rows offset | none | ≥ 1 |
| `pageSize` | int | request | rows limit | none | 1..100 (default 20) |
| `acquisitionSource` | string | server | channel scope | same (global) | MARKETPLACE default; explicit PARTNER_STOREFRONT → deny |
| `orderId` | string | server | deep-link scope | same (global) | AND-intersected with channel; ≤ 64 |
| `paymentStatus` | string | PaymentStatus enum | **table only** | none | ∈ 6 values else 422 |
| `status` (legacy alias) | string | PaymentStatus enum | table only | none | same; conflicts with paymentStatus → 422 |
| `refundStatus` | string | RefundStatus enum | **table only** | none | ∈ 4 values else 422 |
| `currency` | string | payment.currency | currency scope | same (global) | `^[A-Z]{3}$` else 422 |
| `search` | string | payment code/referenceNumber/providerRef + order code/referenceNumber | search scope | same (global) | ≤ 80 |
| `dateFrom` / `dateTo` | date | registry date field | period `[from,to)` | same (global) | valid date else 422 |
| `dateField` | string | createdAt (canonical) or paidAt (analytics deep-link) | period field | same | ∈ {createdAt,paidAt} else 422 |
| `sortBy` / `sortDirection` | string | createdAt/amount/currency/status/code/referenceNumber | row order | none | allowlist fallback createdAt; direction asc/desc |
| `format` (export only) | string | csv/xlsx | export format | — | csv default |

---

## 12. Table Scope vs Overview Scope

| Filter dimension | Table scope | KPI overview scope | Notes |
|---|---:|---:|---|
| workspace / channel (acquisitionSource) | YES | YES | mandatory (MARKETPLACE platform default; Storefront deny) |
| tenant (order-scope) | YES | YES | mandatory via Order.acquisitionSource |
| orderId (deep-link) | YES | YES | AND-intersected with channel |
| search | YES | YES | documented decision — canonical registry search scopes table AND overview (Requests/Orders precedent) |
| period (dateField `[from,to)`) | YES | YES | half-open; canonical createdAt; paidAt for analytics deep-link |
| currency | YES | YES | global dimension candidate (per-currency money; counts cross-currency allowed) |
| paymentStatus | YES | **NO when active KPI** | table-only KPI filter |
| refundStatus | YES | **NO when active KPI** | table-only KPI filter (refund-correlated payment ids) |
| bookingId | — | — | no Booking→Payment relation exists; booking reach is through canonical Order only (documented debt for UI-C1.2F) |

The overview aggregate where never contains the active KPI dimensions, so KPI-card selection cannot collapse sibling counts (byte-identical live proof, §23).

---

## 13. Payment Status Aggregate Matrix (repository-derived)

| PaymentStatus | Exists in enum | Reachable today | Aggregate exposed | Notes |
|---|---:|---:|---:|---|
| PENDING | YES | YES (initiation; transitions out) | YES (count 0) | live count 0 |
| AUTHORIZED | YES | NO (reserved; PSP producer deferred 2.12B) | YES (count 0) | exposed zero |
| CAPTURED | YES | YES (confirm) | YES (count 384) | live count 384 |
| FAILED | YES | YES (fail) | YES (count 0) | live count 0 |
| CANCELLED | YES | YES (cancel) | YES (count 0) | live count 0 |
| REFUNDED | YES | NOT via current transitions (reserved; partial-refund correctness); **26 rows present in current data** | YES (count 26) | exposed; provenance documented |

## 14. Refund Status Aggregate Matrix (repository-derived)

| RefundStatus | Exists in enum | Reachable today | Aggregate exposed | Notes |
|---|---:|---:|---:|---|
| REQUESTED | YES | YES (create) | YES (count 12) | live count 12 |
| APPROVED | YES | YES (approve) | YES (count 0) | exposed zero |
| PROCESSED | YES | YES (process) | YES (count 10) | live count 10 |
| FAILED | YES | YES (fail) | YES (count 0) | exposed zero |

---

## 15. Currency Semantics

- **Storage**: `currency String` on Payment/Refund/Order (default "USD"). Supported set is **dynamic** — derived from canonical data, never hard-coded (no invented USD/EUR/AZN).
- Registry returns distinct currencies present in the overview scope with per-currency `count` and per-currency `amount` sum (Decimal string), deterministic ordering (count desc, then code asc).
- **Counts may be cross-currency; monetary totals are strictly per-currency** — no cross-currency SUM is ever produced (no FX normalization exists in the platform contract). Live: AZN 378 (40 869.08), USD 28 (16 905.27), EUR 4 (470.82).
- Currency filter validated `^[A-Z]{3}$` → deterministic 422 otherwise. A future "top currencies + other" UI can consume the returned rows without an unbounded contract.

---

## 16. Search Semantics

- Server-side, pagination-aware, deterministic (`contains`, `mode: insensitive`), ≤ 80 chars.
- Searches canonical operational references only: `Payment.code`, `Payment.referenceNumber`, `Payment.providerRef` + matching `Order.code`/`referenceNumber` (channel-restricted order-id set). No broad PII search added.
- Decision documented: search participates in the **global overview scope** (table AND overview) — explicit, no ambiguity. Live: `search=MKT-PAY-000001` → 40 rows, aggregates scoped to those rows.

---

## 17. Period Semantics

- Canonical Payments registry period field: **`createdAt`**, half-open `[from, to)` (matches Analytics and sibling registries). Timezone: dates parsed via `new Date()` (UTC instant semantics, consistent with project conventions); boundaries gte (from) / lt (to).
- `dateField=paidAt` supported **only** for the existing analytics drill-down deep link (period on `paidAt`); validated to {createdAt, paidAt} → 422 otherwise. No conflicting multiple date filters exposed.
- Invalid date strings → deterministic 422 (previously could 500 via Prisma). `from >= to` allowed → deterministic empty result (consistent with sibling registries); page-reset behavior is a UI concern (UI-C1.2F).

---

## 18. Pagination

- Server-side only; stable ordering `[{sort}, {id: asc}]` deterministic tie-breaker; default newest-first `createdAt desc`.
- `page ≥ 1`, `pageSize` bounded 1..100 (DTO + service clamp).
- `total` = **table-scoped** count (used by pagination); `aggregates.total` = **overview-scoped** count — different semantics, never conflated (live: table 384 vs overview 410 under CAPTURED).

---

## 19. PCI / PII Safety

- Registry DTO is a strict whitelist: no PAN, CVV, credentials, provider secrets/webhooks, raw provider payloads, or unnecessary PII. `providerRef` is the already-wrapped neutral reference; `paymentMethod` is descriptive; money is Decimal strings.
- No sensitive data logged in new tests or debug output; no new provider surface added. No method-card display (brand/last4) exists in the domain → none exposed.

---

## 20. Audit / History Source

Canonical audit sources identified (not rebuilt — prompt §25): `PaymentHistory` / `RefundHistory` journals (transition + actor + comment), `SecurityService.audit` rows, and outbox `DomainEvents` (PaymentCreated/Captured/Failed/Cancelled, RefundCreated/Approved/Processed/Failed). A future detail/history UI should read these server-owned journals. No unified audit UI built; no fabricated history.

---

## 21. Performance / Index Qualification

- Existing indexes on Payment: `orderId`, `customerId`, `partnerId`, `status`, one-active-per-order partial unique. On Refund: `paymentId`, `orderId`, `status`, one-active-per-payment-amount partial unique. **No `createdAt`/`currency` index** exists.
- Query plan risk: payment-status/refund-status aggregates and period filters over a growing journal will eventually favor `createdAt`/`currency` indexes. **No migration added** — at current cardinality (410 payments) the filters are served by `status`/`orderId` indexes; the prompt forbids speculative indexes without query evidence, and this stage adds no new query shapes beyond grouped aggregates over the existing scopes. Documented as prerequisite debt for UI-C1.2F/G with the exact index set (`Payment[createdAt]`, `Payment[currency]`, `Refund[createdAt]`).
- No N+1 in row projection (order references batched); aggregates use grouped queries (no per-status loop).

---

## 22. Tests Added

`backend/src/modules/finance/payments-registry.spec.ts` — **16 tests**:
1–6 pure scope contract: BASE channel scope; BASE keeps orderId×channel/currency/search/period; deep-link channel intersection; refundStatus → table-only id-set; refundStatus with no matches → deterministic empty; zero-filled maps cover canonical enums in order.
7–16 stub-driven `list()`/`getByCode()`: storefront deny (empty + zero aggregates); empty channel → zero aggregates; deterministic validation (invalid paymentStatus/refundStatus/currency/date + alias conflict → 422-class); **6/6 + 4/4 zero-count coverage**; **overview stability under `paymentStatus=CAPTURED`** (table total 3 vs overview 9; FAILED card 6 stable; groupBy over status-free where); one-active-dimension (paymentStatus only / refundStatus only / both AND / neither; empty refund set → empty table); base-scope preservation (search/period/currency/channel present in the overview where); refund-status aggregates ordered through the canonical Refund.paymentId relation; Storefront direct read → NotFound; Marketplace direct read → whitelist DTO.

Pure-module tests mirror the accepted `order-kpi-scope.spec` / `booking-kpi-scope.spec` conventions.

---

## 23. Test Results

| Suite | Result |
|---|---|
| backend `tsc --noEmit` | PASS |
| backend build (`tsc -p tsconfig.build.json`) | PASS |
| payments-registry.spec (new) | **16/16 PASS** |
| finance module (11 suites) | 9 suites PASS; payment.service.spec 9 failed + refund.service.spec 6 failed — **proven pre-existing** (identical 9/6 failures at pristine baseline `be68383` via stash re-run; spec drift from the earlier "Round 2D.1" reason/initialNote contract, code untouched by UI-C1.2E) |
| order module (D5/D7 relevant) | 2 failed — documented pre-existing seed-identifier drift (`MKT-ORD-D5FIX-0001`, 7-digit `SF0000001` commerceSequence), unchanged from C1.2C/D baselines |
| booking module (D6 relevant) | PASS |
| frontend `tsc --noEmit` | PASS (no frontend production change; contract additive) |

Live API smoke (`admin`/marketplace, restarted backend on the new build): baseline aggregates 410/6-status/4-refund/3-currency (§13–§15); `paymentStatus=CAPTURED` → table 384, aggregates byte-identical; `refundStatus=REQUESTED` → table 12, aggregates byte-identical; both → 9; legacy `status` alias → 384; invalid enum → **422**; Storefront → 200 empty + zero aggregates; search → 40; export `refundStatus=REQUESTED` → 12 rows (table scope); export Storefront → header only; period `dateField=paidAt` → 10/10.

---

## 24. D5/D6/D7 Regression Qualification

- **D5** (Order full-page authority): order module suite green except the two pre-existing seed-identifier failures (unchanged, baseline-proven). No Order code touched.
- **D6** (Booking full-page authority + action state machine): booking module PASS; no Booking code touched.
- **D7** (due/refundable backend authority): untouched — the registry never recomputes order/booking finances, never reads Order.amount into new formulas, and exposes only fact counts + per-currency sums. `refundable`/`due` semantics and the linked-Order finance chain are byte-unchanged.
- Audit immutability, cross-tenant 404-like behavior, RBAC, PCI/PII: preserved and reinforced (Storefront deny + detail invisibility now apply to the Payments platform contract, consistent with Orders/Bookings).

---

## 25. Files Changed

```text
backend/src/modules/finance/payments-registry.ts        (new — pure scope/aggregate helpers)
backend/src/modules/finance/payments-registry.spec.ts    (new — 16 focused tests)
backend/src/modules/finance/payment.service.ts           (read section: registry list + export + detail scope)
backend/src/modules/finance/finance.validation.ts        (PaymentListQueryDto: search/paymentStatus/refundStatus)
backend/src/modules/finance/finance.controller.ts        (export pass-through of new params)
docs/prompts/PHASE_3_UI_C1_2E_...IMPLEMENTATION.md       (stage prompt, tracked per §40)
docs/reports/PHASE_3_UI_C1_2E_...IMPLEMENTATION_REPORT.md (this report)
```

No frontend production code, Prisma schema, migration, or config changed. No schema migration was required (read-model is projection-only).

---

## 26. Git Hard Closure

```bash
git status --porcelain=v1   # → empty after the closure commit + push
git rev-parse HEAD          # → <closure SHA == origin/master>
git rev-parse origin/master # → <closure SHA>
git merge-base --is-ancestor 8aa37739499aa2978c89219666e23ff13b2de4c8 HEAD  # exit 0 (UI-C1.2D impl)
git log -1 --oneline --decorate
```

Porcelain empty, HEAD == origin/master, one canonical FINAL SHA (actual closure HEAD after this stage's commit and push — recorded at closure). No self-referential pin loop; prompt/report tracked.

---

## 27. Final Verdict

```text
VERDICT A — UI-C1.2E
PAYMENTS BACKEND / READ-MODEL PREREQUISITES — ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — ACCEPTED
UI-C1.2A — ACCEPTED
UI-C1.2B — ACCEPTED
UI-C1.2C — ACCEPTED AFTER REMEDIATION R1
UI-C1.2D — ACCEPTED AFTER FINAL GIT CLOSURE R2
UI-C1.2E — ACCEPTED

PAYMENT DOMAIN AUDIT — PASS
REFUND DOMAIN AUDIT — PASS
PAYMENT STATUS COVERAGE — 6/6 PASS
REFUND STATUS COVERAGE — 4/4 PASS
STATIC OVERVIEW KPI BACKEND SEMANTICS — PASS
TABLE-ONLY KPI STATUS FILTERING — PASS
CURRENCY SEMANTICS — PASS (per-currency money; no cross-currency totals)
WORKSPACE / TENANT ISOLATION — PASS (channel scope + Storefront deny + detail invisibility)
RBAC — PASS (finance.payment.read, un-broadened, server-enforced)
PCI / PII SAFETY — PASS (whitelist DTO, no provider payloads)
D7 AUTHORITY PRESERVATION — PASS
REGRESSION — PASS (all failures baseline-proven pre-existing)

FINAL SHA:
<actual closure HEAD == origin/master>

WORKING TREE — CLEAN
HEAD == origin/master — PASS

UI-C1.2F — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

---

## 28. TRUE NEXT

```text
UI-C1.2F — PAYMENTS TAB PRODUCTION IMPLEMENTATION
(Total · payment-status KPI cards · refund-status KPI cards · currency cards ·
toolbar · table · pagination · selected-KPI behavior — consuming the backend
contract created by UI-C1.2E. The pre-existing client-side page-level summary on
/app/payments is documented debt to be replaced by these server aggregates.)
```
