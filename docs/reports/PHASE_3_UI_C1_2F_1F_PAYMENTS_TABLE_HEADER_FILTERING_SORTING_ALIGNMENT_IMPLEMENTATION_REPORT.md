# PHASE 3 — UI-C1.2F.1F — IMPLEMENTATION REPORT
## Payments Table-Header Filtering + Sorting Alignment

> Implementation of the accepted Operations Center table-header filtering pattern on
> `/app/payments`, aligned with the accepted Requests (UI-C1.2F.1G), Orders
> (UI-C1.2F.1D) and Bookings (UI-C1.2F.1E) registries. All evidence captured on a
> fresh dev runtime from the implementation working tree.

---

## Git Baseline

```
BASELINE SHA: 2db72e6c8e6e419b6c93df20d6ead5217b5cc6db
(current HEAD at start: 3b6fba0e6c951ac2344133830346783ba1788cf9 — baseline is an ancestor)
```

## Files Changed

```text
frontend/app/app/payments/page.tsx      (functional — header filters + multi-dimension canonicalization)
frontend/lib/payments-registry.spec.tsx (NEW — 35 tests, UI-C1.2F + UI-C1.2F.1F contracts)
docs/prompts/PHASE_3_UI_C1_2F_1F_PAYMENTS_TABLE_HEADER_FILTERING_SORTING_ALIGNMENT_IMPLEMENTATION.md  (stage prompt, tracked)
docs/reports/PHASE_3_UI_C1_2F_1F_PAYMENTS_TABLE_HEADER_FILTERING_SORTING_ALIGNMENT_IMPLEMENTATION_REPORT.md  (this report)
```

Backend changes: NONE (not required).

---

## Implementation Summary (audit-first)

**Table-column audit (actual model)** — code / createdAt / amount / **currency** /
**status** / method / order / paidAt / providerRef. The row DTO has no refund
field and the table has **no Refund column** → per the audit-first rule the
RefundStatus header filter is **N/A** (no invented header filter for a column that
does not exist). RefundStatus remains a full KPI-card + URL + server-query
dimension.

**Toolbar audit** — Payments toolbar already was `[Search][Reset][CSV][XLSX]`
(paymentStatus/refundStatus/currencyCard never lived in the toolbar on this page),
so "removed from toolbar" is structurally true; nothing needed deleting.

Changes made:
1. **PaymentStatus header filter** — the sortable «Статус» column now composes
   `SortableHeader field="status"` + shared `TableHeaderFilter`
   (`id="payments-filter-status"`, options from the canonical 6-value array,
   `onChange={applyPaymentStatus}`) — same state as the PaymentStatus KPI cards.
2. **Currency header filter** — the «Валюта» column (non-sortable) now hosts a
   shared `TableHeaderFilter` (`id="payments-filter-currency"`) whose options are
   the **server-authoritative dynamic currency list** (`aggregates.currency`) and
   whose value maps to **`currencyCard`** (table-only) — never the global
   `currency` scope.
3. **Deterministic multi-dimension deep-link canonicalization** (new) —
   `PaymentsWithParams` now performs PURE render-time derivation when 2+ of
   `paymentStatus`/`refundStatus`/`currencyCard` arrive together
   (precedence paymentStatus > refundStatus > currencyCard, mirroring the KPI
   group order) so the first render never shows two active specific KPIs, and a
   single `useEffect` normalizes the URL once via `router.replace` preserving all
   unrelated params (search/sort/period). No render-phase router/history/setState
   mutation (UI-C1.2F.1D-R2 contract).

No changes to: the 6/6 PaymentStatus + 4/4 RefundStatus enums, one-active-KPI
mutual exclusion (already correct), currency vs currencyCard distinction, sorting
surface (`code/createdAt/amount/status/paidAt` — untouched), Header Period
semantics, finance ownership/RBAC.

---

## Runtime Qualification (fresh dev runtime, current working tree)

### Structural
```text
toolbar <select>:            NO (never present)
#payments-filter-status:     YES (aria-label "Все статусы")
#payments-filter-currency:   YES (aria-label "Все валюты", options Все/AZN/USD/EUR)
Total (unbounded):           410 · pressed count: 1
```

### CASE A — PaymentStatus header → CAPTURED
```text
before URL: /app/payments
after  URL: /app/payments?paymentStatus=CAPTURED
pressed:    exactly 1 — Зачислен 384 (true); Total 410 static (overview not re-scoped)
header:     payments-filter-status ACTIVE
table:      1–20 из 384, every row Зачислен
```

### CASE B — RefundStatus dimension (header N/A — no refund column exists)
RefundStatus verified as a full KPI dimension from CAPTURED state:
```text
clicked KPI Обработан (PROCESSED) → URL /app/payments?refundStatus=PROCESSED
pressed: exactly 1 — Обработан 10; payment-status header INACTIVE
table:   10 PROCESSED rows (server-filtered)
```

### CASE C — Currency header → currencyCard
```text
header Валюта → USD → URL /app/payments?currencyCard=USD
pressed: exactly 1 — USD card (28 · …); currency header ACTIVE, status header inactive
table:   1–20 из 28, every row USD
```

### CASE D — Cross-dimension exclusivity chain
```text
1 CAPTURED (KPI)        → ?paymentStatus=CAPTURED    pressed 1, dims 1
2 PROCESSED (refund KPI)→ ?refundStatus=PROCESSED    pressed 1, dims 1
3 AZN (currency card)   → ?currencyCard=AZN          pressed 1, dims 1
4 CAPTURED (KPI)        → ?paymentStatus=CAPTURED    pressed 1, dims 1
```
Every transition: specific pressed count = 1 and exactly one table-only URL param.

### CASE E — Invalid multi-dimension deep links
```text
?paymentStatus=CAPTURED&refundStatus=PROCESSED
  → canonical URL ?paymentStatus=CAPTURED (refundStatus dropped) · pressed 1 · no warning

?paymentStatus=CAPTURED&currencyCard=USD&sortBy=amount&sortDirection=asc&dateFrom=2026-09-01
  → canonical URL ?sortBy=amount&sortDirection=asc&dateFrom=2026-09-01&paymentStatus=CAPTURED
    (currencyCard dropped; search/sort/period PRESERVED) · pressed 1

?refundStatus=PROCESSED&currencyCard=USD
  → canonical URL ?refundStatus=PROCESSED (currencyCard dropped) · pressed 1
```
Network for the canonicalized state carried exactly ONE KPI dimension:
`/finance/payments?paymentStatus=CAPTURED&dateFrom=2026-09-01&sortBy=amount&sortDirection=asc&page=1&pageSize=20`. No render warning, no request storm.

### CASE F — Sort coexistence
`?paymentStatus=CAPTURED&sortBy=amount&sortDirection=asc` — status survived sort and
vice-versa; table server-sorted ascending (13,86 → 30,60) within CAPTURED scope.

### CASE G — Period coexistence
`?dateFrom=2026-09-01&dateTo=2026-10-01&paymentStatus=CAPTURED`:
overview = Sep global (Total 52, Зачислен card 49 — static overview, period-recomputed);
table = Sep CAPTURED (1–20 из 49). Same proven pattern for refundStatus and currencyCard.

### CASE H — Total vs Reset
```text
Total from ?paymentStatus=CAPTURED&search=PAY-0045&dateFrom..&dateTo..
  → ?dateFrom=2026-09-01&dateTo=2026-10-01&search=PAY-0045
    (paymentStatus cleared; SEARCH + period PRESERVED — Total ≠ Reset)
Reset from ?…&paymentStatus=CAPTURED&search=PAY-
  → ?dateFrom=…&dateTo=…&sortBy=…&sortDirection=… (KPI + search cleared; period preserved)
```

### CASE I — Reload / Popstate
```text
Reload ?dateFrom=2026-09-01&dateTo=2026-10-01&refundStatus=PROCESSED
  → restored: Обработан pressed (3 = Sep aggregate), Total 52, period inputs set, URL unchanged.
Popstate (two real history entries): E1 = refundStatus PROCESSED Sep, E2 = paymentStatus CAPTURED Oct
  history.back()    → E1 fully restored (Обработан pressed 3, Total 52)
  history.forward() → E2 fully restored (Зачислен pressed 36, Total 36)
```

### Export scope
```text
CSV with CAPTURED + Oct active fired:
GET /api/v1/finance/payments/export?paymentStatus=CAPTURED&dateFrom=2026-10-01&dateTo=2026-11-01&format=csv → 200
```

### Invalid enum / currency handling (Payments 422 contract, actual)
```text
paymentStatus=BOGUS → 422 "invalid paymentStatus BOGUS"
refundStatus=BOGUS  → 422 "invalid refundStatus BOGUS"
currencyCard=XYZ    → 200 total=0 (currency domain is an open server-authoritative set; scoped empty, no silent fallback)
paymentStatus=CAPTURED → 200 total=384
```

### Console
Across all scenarios (A–I, invalid probes, export):
```text
Router render warnings        — 0
React warnings                — 0
Hydration mismatches          — 0
Uncaught exceptions           — 0
Infinite update warnings      — 0
```
Only entries: devtools/HMR info + two browser-generated "422" resource notices from
the deliberate BOGUS probes (expected noise, classified separately).

### Accessibility / Responsive
- Header filters: real `<button>`s with ids + accessible names ("Все статусы" /
  "Все валюты"), `aria-expanded`/`aria-haspopup="listbox"`, keyboard + Escape
  (shared TableHeaderFilter contract unchanged).
- Sort and filter are distinct controls in the Статус column; Валюта column hosts
  only the filter (column is not sortable — no invented sort).
- KPI `aria-pressed` correct in every case; filter state perceivable via funnel
  fill + KPI aria-pressed + URL (not color-only).
- Responsive smoke at 671 px viewport: header controls operable, table usable, no
  overlap blocking sorting/filtering.

### Security
```text
SECURITY REGRESSION SURFACE — NONE / BACKEND UNCHANGED
```
No backend/security code changed. finance.payment.read RBAC, workspace scoping and
cross-context isolation ride the unchanged /finance/payments service path (D7-era
qualification stands).

---

## Tests / Build

| Suite | Result |
|---|---|
| payments-registry.spec.tsx (NEW) | 35/35 PASS |
| orders-registry.spec.tsx | 72/72 PASS |
| bookings-registry.spec.tsx | 62/62 PASS |
| requests-registry.spec.tsx | 74/74 PASS |
| table-header-filter.spec.tsx | 25/25 PASS |
| operations-center-shell.spec.tsx | 19/19 PASS |
| **Targeted total** | **287/287 PASS** |
| Full vitest | 677/678 — the 1 failure is the known pre-existing `i18n.spec.ts` formatPrice NBSP test (unchanged, unrelated) |
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx next build` | PASS (exit 0) |

New tests cover the UI-C1.2F.1F mandate: toolbar has no KPI selects; PaymentStatus +
Currency header filters present via shared TableHeaderFilter; RefundStatus header
N/A (no refund column) while the dimension stays KPI+URL+query; header↔KPI same
state; cross-dimension exclusivity (each apply clears both other dims); multi-filter
deep-link canonicalization is pure-render with post-render router.replace; page
reset; search/period/sort survival; Total vs Reset; URL derivation on reload;
replace-semantics popstate; static aggregates; single-dimension table query;
export scope; verbatim pass-through of table-only dims; a11y markers.

---

## Git Hard Closure

```
IMPLEMENTATION SHA: 17ea8b601ba0cd2171b7d2b7c8c3553389af962e
FINAL SHA:           17ea8b601ba0cd2171b7d2b7c8c3553389af962e

git status --porcelain=v1        → <NO OUTPUT>
HEAD == origin/master            → 17ea8b601ba0cd2171b7d2b7c8c3553389af962e
2db72e6 (baseline) ancestor      → PASS (exit 0)

git log -5 --oneline --decorate
17ea8b6 (HEAD -> master, origin/master, origin/HEAD) feat: align Payments filters with table headers (UI-C1.2F.1F)
3b6fba0 docs: add final SHA to UI-C1.2F.1E implementation report
2db72e6 feat: align Bookings status filter with table header (UI-C1.2F.1E)
22d1653 docs: add final SHA to UI-C1.2F.1B qualification report
fd53a89 docs: finalize UI-C1.2F.1B qualification (shared Header Period)
```

```
VERDICT A — UI-C1.2F.1F ACCEPTED

PAYMENTS TABLE-HEADER FILTERING + SORTING ALIGNMENT — PASS

PAYMENT STATUS REMOVED FROM TOOLBAR   — PASS (never present — toolbar [Search][Reset][CSV][XLSX])
REFUND STATUS REMOVED FROM TOOLBAR    — PASS (never present)
CURRENCY COLUMN FILTER ALIGNED        — PASS (Валюта column → currencyCard)

PAYMENT STATUS HEADER FILTER          — PASS
REFUND STATUS HEADER FILTER           — N/A — no Refund column exists in the audited table;
                                         refundStatus stays a full KPI+URL+server dimension
CURRENCY HEADER FILTER                — PASS
SHARED TableHeaderFilter              — PASS

KPI ↔ HEADER SAME STATE               — PASS
ONE ACTIVE KPI ACROSS 3 DIMENSIONS    — PASS
MULTI-FILTER DEEP-LINK NORMALIZATION  — PASS
NO RENDER-PHASE ROUTER MUTATION       — PASS

URL AUTHORITY                         — PASS
PAGE RESET                            — PASS
TOTAL RESET                           — PASS
REGISTRY RESET                        — PASS

STATIC KPI OVERVIEW                   — PASS
PERIOD + KPI FILTER SCOPE             — PASS
SEARCH + KPI FILTER                   — PASS
SORT + KPI FILTER                     — PASS
SORT/FILTER INDEPENDENT               — PASS

RELOAD                                — PASS
POPSTATE RESTORE                      — PASS
TAB SWITCH PERIOD-ONLY                — PASS (shell-owned; unchanged)
SERVER-SIDE FILTERING                 — PASS
EXPORT SCOPE                          — PASS
INVALID ENUM/CURRENCY HANDLING        — PASS (422 for enums; open-set currency → scoped empty)

SECURITY REGRESSION SURFACE           — NONE / BACKEND UNCHANGED
ACCESSIBILITY                         — PASS
RESPONSIVE                            — PASS
CONSOLE ERRORS                        — 0

PAYMENTS TESTS                        35/35
REQUESTS REGRESSION                   74/74
ORDERS REGRESSION                     72/72
BOOKINGS REGRESSION                   62/62
TARGETED TOTAL                        287/287
FULL VITEST                           677/678 (1 pre-existing NBSP)
TSC                                   PASS
BUILD                                 PASS

WORKING TREE CLEAN                    — PASS
HEAD == origin/master                 — PASS
BASELINE ANCESTRY                     — PASS
GIT HARD CLOSURE                      — PASS
```

STOP — no next stage started. Awaiting independent review.
