# PHASE 3 — D9 Export Framework Requalification Report

## 1. Executive Summary

Audit-first requalification of the existing Export Framework (13 export
endpoints, one shared `ExportService`, CSV + XLSX via ExcelJS ^4.4.0)
against the canonical reference-number, temporal (D8), scope/tenant, RBAC,
CSV/XLSX, localization, and presentation contracts. The framework is
**largely conformant**: exports are permission-parity-guarded, canonical
`referenceNumber` (MKT-*) is the business-reference column with legacy
`code` correctly classified, temporal filters reuse D8 `parseDateParam`
(fail-closed 400 before DB access), storefront deny/empty-scope behavior is
enforced server-side, and runtime downloads were verified by content
(including XLSX readback). One material security finding was identified:
**CSV formula injection is unmitigated** (user-controlled strings beginning
with `= + - @` are serialized verbatim). Per §25, this pass stops at the
requalification report with a remediation matrix — no production code was
changed.

## 2. Baseline SHA

- Branch `master`; audit start `338e695c0b9daddb3c0d7e7a347f59250a261308`
  (= `origin/master`; D8 CLOSED, D9 = TRUE NEXT per the reconciled roadmap;
  no earlier D-track prerequisite open; D10–D12 downstream and untouched).

## 3. Canonical Sources

- Roadmaps (master §16 D-track; v3 D-track lines 2568–2603) — D8 ✅, D9 TRUE NEXT.
- `TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md` (relations by FK/UUID).
- D8 contract: `docs/architecture/temporal-readiness.md` §§16–17.
- Reference presentation: Pre-Step 3.12 canonical-reference reports
  (`referenceNumber` MKT-* canonical display; `code` legacy/deprecated for
  presentation; UUID never user-facing).
- ADR-OPS-001 (payments URL = `PAY-*` code; display = `referenceNumber`).
- Current source tree + git (authority hierarchy §3 applied).

## 4. Export Inventory (complete)

| Export | Surface | Entity | Format | Endpoint | Scope | Status |
|---|---|---|---|---|---|---|
| Orders | Operations Center | Order | CSV+XLSX | `GET /orders/export` | staff (`order.read`), storefront-deny | OK |
| Bookings | Operations Center | Booking | CSV+XLSX | `GET /bookings/export` | staff (`booking.read`), channel-scoped | OK |
| Requests | Operations Center | Request | CSV+XLSX | `GET /requests/export` | staff (`order.read`), bounded 10 000 | OK |
| Payments | Finance Center | Payment | CSV+XLSX | `GET /finance/payments/export` | staff (`finance.payment.read`) | OK |
| Products | Catalog | Product | CSV+XLSX | `GET /products/export` | role-dependent (`productReadScope`), partner own-scope | OK |
| Customers | CRM | Customer | CSV+XLSX | `GET /customers/export` | staff, marketplace-customer scope | OK |
| Partners | CRM | Partner | CSV+XLSX | `GET /partners/export` | staff (`crm.partner.read`) | OK |
| Customer 360 ×4 | CRM 360 | Orders/Bookings/Payments/Partners per customer | CSV+XLSX | `GET /customers/:id/{orders,bookings,payments,partners}/export` | staff (`crm.customer.read`) | OK |
| Support cases | Support | Case | CSV+XLSX | `GET /support/cases/export` | actor-scoped (`support.case.read`) | OK |
| Users | Admin | User | CSV+XLSX | `GET /users/export` | admin (`settings.write`) | OK |
| Partner performance | Analytics | aggregate | CSV+XLSX | `GET /analytics/partner-performance/export` | `analytics.read` | OK |

Shared serializer: `backend/src/modules/shared/export/export.service.ts`
(`toCsv`, `toXlsx` via ExcelJS).

## 5. Export Contract Matrix (principal exports)

| Export | Canonical reference | Legacy code leakage | Dates | Money | Scope | i18n | Status |
|---|---|---|---|---|---|---|---|
| Orders | `Reference` = `referenceNumber ?? code` | `code` not exported as reference (row field unused by columns) | ISO-8601 UTC instants (`createdAt`, `updatedAt`, `paidAt`) | decimal string + ISO currency code (machine contract) | server where-builder | headers EN | OK |
| Bookings | `Reference` = `referenceNumber ?? code` | same | ISO-UTC + `serviceDate` | decimal + currency | channel + storefront-deny | headers EN | OK |
| Requests | `№ Заявки` = `referenceNumber` | none | ISO-UTC + `requestedServiceDate` | decimal strings | same filters as list; capped 10 000 | headers RU | OK |
| Payments | `Reference` = `referenceNumber`; separate `Code` column | `Code` = legacy technical id (classified TECHNICAL; retained alongside canonical `Reference`) | ISO-UTC (`createdAt`, `paidAt`; `dateField` selectable) | decimal + currency | registry parity incl. `search` (UI-C1.2E) | headers EN | OK |
| Products | partner-scoped rows | — | `PublishedAt`/`CreatedAt` ISO-UTC | `PriceFrom` decimal | `productListScope` enforced before filters | headers EN | OK |
| Customers | `Code` column = CRM-* code (entity has no `referenceNumber`) | n/a (canonical for CRM domain) | ISO-UTC | n/a | marketplace-customer scope | headers EN | OK |
| Analytics | partnerId/name (aggregates) | — | period via preset/CUSTOM | decimal aggregates | `analytics.read` | headers EN | OK |

## 6. Identifier / Reference Number Audit

- Internal UUIDs are exported as `ID`/`* ID` columns — classified
  **TECHNICAL** (support/audit/join keys); not mixed with business
  references; retained deliberately.
- Canonical business reference: `referenceNumber ?? code` fallback pattern
  (Orders/Bookings) and `referenceNumber` (Payments/Requests) — legacy
  `code` is never presented as the primary reference where
  `referenceNumber` exists. Payments keeps a parallel `Code` column
  (PAY-*) — classified **TECHNICAL**, consistent with ADR-OPS-001 (URL
  identifier = `PAY-*` code) and not a violation of the display contract.
- No `findByAnyIdentifier`-style mixing; `number` (TH-*) is not exported
  as a competing reference for Orders.

## 7. Temporal Audit

- All export endpoints consume D8 `parseDateParam` for `dateFrom`/`dateTo`
  (Orders, Bookings, CRM customers; payments registry validator; Catalog
  via shared list query) — malformed dates fail closed with canonical 400
  **before DB access** (runtime-proven).
- Exported instants are `toISOString()` UTC — no silent local-time render.
- Bookings export `serviceDate` separately from `createdAt` — service-local
  calendar date is not merged with entity time (D8 §17.2 respected).
- Period semantics match the registry dimension of each entity
  (`createdAt` for Operations, `publishedAt` for Catalog incl. end-of-day
  variance, activity via `Order.createdAt` for CRM customers; Payments
  `dateField` selectable). No second temporal interpretation introduced.
- KPI semantics untouched (D11 boundary).

## 8. Scope / Tenant / RBAC Audit

- All 13 exports guarded by `@RequirePermissions` exactly matching their
  registry read authority (see §4) — no export-broader-than-read case.
- Partner own-scope: Catalog export runs through
  `CatalogAccessPolicy.productListScope` (partnerId in `where` before
  filters) — runtime-proven (Partner A export contained exactly 1 row,
  Tenant B product absent).
- Storefront isolation: explicit `isDeniedStorefrontScope` deny →
  empty dataset on platform Orders/Bookings exports (runtime-proven:
  header-only file); D4 F2 cross-check comments in code; payments/CRM
  scoped via acquisitionSource where-builder and marketplace-customer
  scope respectively.
- Users export (`settings.write`) exposes account metadata (no
  password/token columns present — verified against column list).

## 9. Filter Consistency

- Orders: status/paymentStatus/search/customerId/dates/acquisitionSource/
  sellerPartnerId/cancelledWithin/paymentFailed/pendingRefund — same
  `buildOrderWhere` as list (no pagination: full-dataset export, documented
  here as intentional).
- Bookings: status (CSV multi), orderId (AND-intersected with channel scope
  — never overwritten), dates, sellerPartnerId, source.
- Payments: full registry parity incl. `search`, `dateField`,
  paymentStatus/refundStatus (UI-C1.2E).
- Requests: status/customerId/partnerId/search/dates transferred to
  `listRequests` (same authoritative query as the registry), bounded at
  10 000 rows — cap documented here.
- Catalog: `ListProductsQuery` parity (status/category/type/search/dates).

## 10. Column Semantics

Suspicious-column classification results:
- `ID`, `Partner ID`, `Customer ID`, `Order ID`, `Booking IDs`,
  `Payment IDs` → **TECHNICAL** (support/audit value; deterministic).
- Payments `Code` → **TECHNICAL** (URL identifier per ADR-OPS-001).
- `Reference`/`№ Заявки`/`Order Reference` → **CANONICAL**.
- No duplicate competing business-reference columns; no raw JSON blobs; no
  tokens/secrets; statuses exported as canonical enum values (machine
  contract; localization of enum labels is a presentation-layer concern
  and is handled by the UI, not the data export).
- Support/users exports verified free of password/token/moderation-private
  fields.

## 11. CSV Audit

- UTF-8 with BOM (`\uFEFF`) — Excel compatibility preserved (existing
  behavior, kept).
- Delimiter `,`; quoting/escaping correct for quotes/commas/newlines
  (`csvEscape`); deterministic column order and headers; `null/undefined`
  → empty string; trailing newline.
- **FINDING D9-F1 (security, P1):** no formula-injection mitigation for
  cells beginning with `= + - @` (tab/CR). User-controlled values reach
  exports (product titles, customer/company names, payment method,
  support titles). Affected: all CSV exports. Contract: prompt §15.
  Mitigation (for the separate remediation pass): canonical
  escape-to-text strategy (prefix `'` for formula-leading cells) applied in
  `csvEscape` only, documented, with readback tests; machine-consumers
  warning documented.

## 12. XLSX Audit

- ExcelJS ^4.4.0; single worksheet, styled header row (bold/fill);
  deterministic column order; column widths set.
- Values are raw (no formulas, no hidden sheets, no metadata beyond
  sheet name). Readback test (this pass): parsed `xl/worksheets/sheet1.xml`
  + `sharedStrings.xml` — header row `ID, Reference, Status, …` and data
  row values match the CSV dataset exactly (`MKT-ORD-00000266`, `95.68`,
  ISO instants). Content-Type
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
  filenames deterministic (`orders_export.xlsx`).
- Date cells are serialized strings (ISO), not native date cells —
  acceptable for the current machine contract; no precision lost.
- Formula-injection exposure in XLSX is nil in practice (values written as
  strings/shared strings, not formulas) — but the same mitigation should
  be considered for parity in the remediation pass.

## 13. Performance / Large Export Audit

- Strategy: **load-all-rows into memory** (`findMany` without pagination;
  XLSX buffer fully materialized; CSV string built in memory).
- Representative measurement (current dataset): Orders export of 508 rows →
  203 KB CSV / 102 KB XLSX in ~0.16 s. Bookings 162 KB, Payments 139 KB,
  Requests 186 KB (bounded 10 000), Customers 27 KB.
- Scaling assessment: memory grows linearly with dataset; the bounded
  Requests cap (10 000) and the current data volumes (orders table ≈ 10³
  rows) keep heap use far below risk thresholds. Batch enrichment uses
  batched `findMany` + Maps (no N+1). No streaming/cursor infrastructure
  exists; per §17 and §25, no queue/job system is introduced — current
  contract is acceptable; revisit only if datasets reach ~10⁵–10⁶ rows.
- Exports are synchronous request-scoped work on the Node event loop;
  generation is fast (sub-second at current scale); no rate-limit gate on
  exports exists — acceptable at current scale, noted for the remediation
  matrix as informational (P3).

## 14. Localization

- Requests export uses canonical RU headers (`№ Заявки`, `Статус`, …);
  other exports use EN headers. Enum/status labels are canonical enum
  values (machine contract). Reference numbers/IDs never localized
  (correct). No per-request locale negotiation exists for exports —
  classified as consistent current behavior, not a defect (single-locale
  header sets are deterministic per surface).

## 15. Security / PII

- No passwords/tokens/reset fields/internal auth fields in any export
  column set (verified per controller column definitions).
- CRM customers export includes contact PII (email/phone) — guarded by
  `crm.customer.read`, which is the existing read authority for the CRM
  registry (parity holds; not broader).
- Traveler PII is **not** part of any export column set (orders export
  aggregates booking references, not traveler names/passports).
- Support export is actor-scoped via `support.listCases(actor, …)`.
- No evidence of export permission broader than read authority anywhere
  (§4 table).

## 16. Runtime Evidence (backend :4000, final-HEAD code)

| Case | Result |
|---|---|
| Orders CSV (2026 window) | 200, `text/csv; charset=utf-8`, `orders_export.csv`, BOM + 24 headers + 508 rows; `MKT-ORD-*` references; ISO-UTC dates; `95.68` decimal money |
| Orders XLSX (same window) | 200, correct MIME, `orders_export.xlsx`, `Microsoft Excel 2007+`; **readback parsed**: header + data rows match CSV exactly; no formulas |
| Payments CSV | 200, 17 headers; `Code` PAY-* + `Reference` MKT-PAY-*-N; `Order Reference` = MKT-ORD-* |
| Bookings CSV | 200, `serviceDate` exported separately from `createdAt` |
| Requests CSV | 200, RU headers, canonical refs, converted order ref resolved |
| Catalog (Partner A, own scope) | 200, exactly 1 own product row; Tenant B product **absent** |
| Orders export as PARTNER A | 403 (permission parity) |
| Anonymous export | 401 |
| Malformed `dateFrom=bad` | 400 canonical `dateFrom must be a valid date` + requestId |
| `acquisitionSource=PARTNER_STOREFRONT` on platform export | 200 header-only (server-side deny, 0 rows) |
| Empty window | 200, header-only CSV (2 lines) |
| Customers / Partners / Users / Support / Analytics / Customer-360 exports | 200 with plausible datasets |

## 17. Automated Test Evidence

- Export behavior is exercised by the D8 focused suites:
  `date-param.registry-matrix.spec.ts` (371 lines, includes export-surface
  date-validation matrix), `payments-registry.spec.ts`,
  `request-kpi-date-scope.spec.ts` — **4 suites / 63 tests PASS at HEAD**.
- Backend `typecheck`: PASS.
- No XLSX readback test exists in the repo — recorded as informational
  (P3) in the remediation matrix; this pass performed the readback
  manually (§12).
- Pre-existing unrelated frontend failure (`formatPrice` az-AZ NBSP)
  unchanged and out of D9 scope.

## 18. Findings / Remediation Matrix

| Finding | Severity | Contract | Affected exports | Fix (separate targeted pass) |
|---|---|---|---|---|
| D9-F1: CSV formula injection unmitigated (`= + - @` leading cells serialized verbatim) | **P1 — security** | §15 formula-injection gate | all CSV exports (user-controlled text columns) | canonical text-escape in `csvEscape` for formula-leading cells + readback tests + documented consumer note |
| D9-F2: Payments export carries both `Code` (PAY-*) and `Reference` (MKT-PAY-*) | P3 — informational | §7 classification; ADR-OPS-001 | payments export | none required (Code = TECHNICAL URL identifier); optionally document column roles |
| D9-F3: `serviceDate` serialized as UTC instant (midnight) for 715/719 rows; 4 rows carry non-midnight time | P3 — informational | §14 DATE_ONLY classification | bookings export | optional normalization to date-only string; preserve values |
| D9-F4: no XLSX readback test in repo | P3 — test debt | §23 | all XLSX exports | add readback spec (parse workbook, assert headers/rows) |
| D9-F5: no rate/permission throttle on full-dataset exports | P3 — informational | §17 | all exports | acceptable at current scale; revisit at ~10⁵ rows |

## 19. Final Verdict

**VERDICT B — VALID SYSTEM FAIL / REMEDIATION REQUIRED.**

The framework is substantially conformant (references, temporal, scope,
RBAC, runtime output, tests/build all pass), but the §15 formula-injection
gate is a concrete, demonstrable security gap (D9-F1, P1) that prevents
`VERDICT A` under the §31 hard-stop conditions. Per §25: this pass stops
at the report; remediation (minimal, `csvEscape`-scoped) belongs to a
separate targeted pass.

## 20. Roadmap / TRUE NEXT

- D9 remains **open** (B). The canonical roadmap D9 row keeps
  `⬜ NOT STARTED` — amended this pass to `⬜ (REMEDIATION REQUIRED, D9-F1)`
  semantics only via this report; no roadmap status promotion.
- Next roadmap item stays blocked until D9-F1 is remediated and a follow-up
  closure pass confirms A. D10+ untouched.

## 21. Git Closure

- Production code changed in this pass: **NONE** (report + prompt only).
- Fixtures (`d9_rq_a`, `d9_rq_buyer`) deleted after runtime evidence
  (verified `DELETE 2`); no test data remains.
- Baseline `338e695…` → closure commit recorded with final SHA;
  `HEAD == origin/master`, clean tree after push.
