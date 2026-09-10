# PHASE 3 — D12 CRM / KPI Drill-down Routing — Qualification Report

## 1. Executive Summary

D12 implementation addresses proven routing/context gaps in the KPI drill-down system. Four frontend files were modified, one architecture document was created. All changes are minimal, targeted, and preserve existing behavior.

**Changes:**
1. Bookings page: fixed `from`/`to` param reading (context propagation fix)
2. CRM page: added `preset` param preservation
3. Command Center KpiCard: added optional `href` navigation prop
4. Command Center SectionGrid: added `WIDGET_ROUTES` mapping for KPI drill-down

---

## 2. Baseline

```text
HEAD:           de4a2cbc27a349e1b50fa363e6b9df0d14735ec9
ORIGIN:         de4a2cbc27a349e1b50fa363e6b9df0d14735ec9
COMMIT:         de4a2cb
STATUS:         HEAD == origin/master, D12 artifacts committed and pushed
BUILD:          frontend build PASS (next build)
TYPECHECK:      frontend tsc --noEmit PASS, backend tsc --noEmit PASS
TESTS:          43/44 PASS (1 pre-existing formatPrice failure, unrelated to D12)
```

---

## 3. Architecture Decisions

### AD-1 — Command Center KPI Navigation

**Decision:** Command Center KPI cards navigate to operational/CRM target surfaces.

**Implementation:** `WIDGET_ROUTES` mapping in `SectionGrid.tsx` maps widget IDs to routes. `KpiCard` accepts optional `href` prop and renders as `<Link>` when provided.

**Mapping:**
| Widget | Route |
|---|---|
| orders | `/app/orders` |
| bookings | `/app/bookings` |
| orders-fulfilled | `/app/orders?status=FULFILLED` |
| bookings-confirmed | `/app/bookings?status=CONFIRMED` |
| bookings-completed | `/app/bookings?status=COMPLETED` |
| payments-captured | `/app/payments?paymentStatus=CAPTURED` |
| refunds-processed | `/app/payments?refundStatus=PROCESSED` |
| marketplace-partners | `/app/crm?tab=partners&entitled=true` |
| marketplace-customers | `/app/crm?tab=customers` |
| partners | `/app/crm?tab=partners&entitled=true` |
| customers | `/app/crm?tab=customers` |
| marketplace-orders | `/app/orders` |
| storefront-orders | `/app/orders` |

**Deferred (no honest target):** GMV, Revenue, Commission, Refunds (amount), AOV, Sessions, Net Payments.

### AD-2 — Customer 360 Period Semantics

**Decision:** Customer 360 remains entity-level / full-history surface. No period-scoped queries added.

**Implementation:** No changes to Customer 360. Period context from Analytics is not propagated to Customer 360 detail (by design).

### AD-3 — Parameter Naming

**Decision:** Canonical cross-page drill-down uses `from`/`to`/`preset`/`fromAnalytics`. Operations targets accept legacy `dateFrom`/`dateTo` as aliases.

**Implementation:** Bookings page now reads `from`/`to` with `dateFrom`/`dateTo` fallback (matching Orders page pattern).

---

## 4. Implementation

### Changed Files

| File | Purpose | Lines Changed |
|---|---|---|
| `frontend/app/app/bookings/page.tsx` | R1: Add `from`/`to` param reading with `dateFrom`/`dateTo` fallback | 2 lines (L514-515) |
| `frontend/app/app/crm/page.tsx` | R3: Add `preset` param reading and display | ~10 lines (props, state, badge) |
| `frontend/components/command-center/KpiCard.tsx` | AD-1: Add optional `href` prop for navigation | ~20 lines (import, prop, Link wrapper) |
| `frontend/components/command-center/SectionGrid.tsx` | AD-1: Add `WIDGET_ROUTES` mapping and pass `href` to KpiCard | ~25 lines (mapping + render) |

### New Files

| File | Purpose |
|---|---|
| `docs/architecture/TRAVELHUB_CRM_KPI_DRILLDOWN_ROUTING.md` | Canonical routing contract documentation |

---

## 5. Routing Matrix

| KPI Source | Destination | Status After D12 |
|---|---|---|
| Analytics → Orders | `/app/orders` | ✅ EXISTS |
| Analytics → Bookings | `/app/bookings` | ✅ FIXED (period preserved) |
| Analytics → Customers | `/app/crm?tab=customers` | ✅ EXISTS |
| Analytics → Partners | `/app/crm?tab=partners` | ✅ EXISTS |
| Analytics → Partner 360 | `/app/crm/partners/{id}` | ✅ EXISTS |
| Analytics → Payments | `/app/payments` | ✅ EXISTS |
| Command Center → Orders | `/app/orders` | ✅ NEW (AD-1) |
| Command Center → Bookings | `/app/bookings` | ✅ NEW (AD-1) |
| Command Center → CRM | `/app/crm` | ✅ NEW (AD-1) |
| Command Center → Payments | `/app/payments` | ✅ NEW (AD-1) |
| Command Center → Finance | NONE | ✅ DEFERRED (correct) |

---

## 6. Parameter Propagation Evidence

### Bookings Fix

```typescript
// Before (broken):
initialDateFrom={sp.get("dateFrom") ?? ""}
initialDateTo={sp.get("dateTo") ?? ""}

// After (fixed):
initialDateFrom={sp.get("from") ?? sp.get("dateFrom") ?? ""}
initialDateTo={sp.get("to") ?? sp.get("dateTo") ?? ""}
```

Analytics drill-down `?from=2026-08-01&to=2026-08-31` now correctly initializes Bookings Center date filters.

### CRM Preset

```typescript
// New:
initialPreset={sp.get("preset") ?? undefined}
```

CRM page now reads and displays `preset` in the period badge: `📊 MONTH (2026-08-01 → 2026-08-31)`.

---

## 7. Bookings Fix Evidence

| Test Case | Before D12 | After D12 |
|---|---|---|
| `/app/bookings?from=2026-08-01&to=2026-08-31` | Date filters empty | ✅ Date filters set |
| `/app/bookings?dateFrom=2026-08-01&dateTo=2026-08-31` | ✅ Works | ✅ Still works |
| `/app/bookings?from=X&dateFrom=Y` | N/A | `from` takes precedence |
| `/app/bookings` (no params) | ✅ Empty | ✅ Empty |

---

## 8. Command Center Evidence

| KPI Widget | Before D12 | After D12 |
|---|---|---|
| orders | Non-clickable div | ✅ Link to `/app/orders` |
| bookings | Non-clickable div | ✅ Link to `/app/bookings` |
| orders-fulfilled | Non-clickable div | ✅ Link to `/app/orders?status=FULFILLED` |
| marketplace-partners | Non-clickable div | ✅ Link to `/app/crm?tab=partners&entitled=true` |
| gmv | Non-clickable div | ✅ Non-clickable (deferred, correct) |
| revenue | Non-clickable div | ✅ Non-clickable (deferred, correct) |
| commission | Non-clickable div | ✅ Non-clickable (deferred, correct) |

---

## 9. CRM Evidence

| Param | Before D12 | After D12 |
|---|---|---|
| `from` | ✅ Read | ✅ Read |
| `to` | ✅ Read | ✅ Read |
| `preset` | ❌ Dropped | ✅ Read and displayed |
| `tab` | ✅ Read | ✅ Read |
| `entitled` | ✅ Read | ✅ Read |

---

## 10. D10 Regression

| Check | Status |
|---|---|
| Partner attribution (`Order.sellerPartnerId`) | ✅ Unchanged |
| Partner 360 drill-down | ✅ Works |
| Partner scope isolation | ✅ Preserved |
| `resolveTableCellDrilldown()` | ✅ Unchanged |

---

## 11. D11 Regression

| Check | Status |
|---|---|
| KPI formulas | ✅ Unchanged |
| Status semantics | ✅ Unchanged |
| Cross-center scope differences | ✅ Documented, unchanged |
| KPI dictionary authority | ✅ Preserved |

---

## 12. D8 Regression

| Check | Status |
|---|---|
| Period format (`YYYY-MM-DD`) | ✅ Unchanged |
| `[start, endExclusive)` semantics | ✅ Unchanged |
| UTC server-authoritative | ✅ Unchanged |
| No new date parser | ✅ Confirmed |

---

## 13. Security / IDOR Evidence

| Check | Status |
|---|---|
| Partner A → Partner B | ✅ DENIED (server-side) |
| Unauthorized Customer | ✅ DENIED |
| Unauthorized Order | ✅ DENIED |
| Unauthorized Booking | ✅ DENIED |
| Unauthorized Payment | ✅ DENIED |
| Frontend ID as auth proof | ✅ NOT USED |
| Backend remains authority | ✅ Confirmed |

---

## 14. Tests

| Suite | Result |
|---|---|
| Frontend unit tests | 43/44 PASS |
| Pre-existing formatPrice failure | Unrelated to D12 |
| Backend typecheck | ✅ PASS |
| Frontend typecheck | ✅ PASS |

---

## 15. Build

| Check | Result |
|---|---|
| `next build` | ✅ PASS |
| TypeScript compilation | ✅ PASS |
| Static page generation | ✅ 46/46 pages |

---

## 16. Remaining Gaps

| Gap | Classification | D12 Action |
|---|---|---|
| Finance drill-downs (GMV, Revenue, Commission) | DEFERRED | No target exists |
| Customer 360 period support | BY DESIGN (AD-2) | Full-history surface |
| Sessions target page | NOT STARTED | No honest target |
| `formatPrice` test failure | PRE-EXISTING | Unrelated to D12 |

---

## 17. Git Evidence

```text
COMMIT:  de4a2cb
HEAD:    de4a2cbc27a349e1b50fa363e6b9df0d14735ec9
ORIGIN:  de4a2cbc27a349e1b50fa363e6b9df0d14735ec9
STATUS:  HEAD == origin/master, working tree clean (D12 artifacts)
DIFF CHECK: PASS
DIFF:    frontend/app/app/bookings/page.tsx (2 lines)
         frontend/app/app/crm/page.tsx (~10 lines)
         frontend/components/command-center/KpiCard.tsx (~20 lines)
         frontend/components/command-center/SectionGrid.tsx (~25 lines)
```

---

## 18. Final Verdict

```text
D12 VERDICT:             A — D12 CLOSED
CURRENT TRUE NEXT:       D13 — Voucher
FINANCE:                 NOT STARTED / DEFERRED
ARCHITECTURE DECISIONS:  AD-1 (Command Center routing), AD-2 (Customer 360 full-history), AD-3 (param naming)
CHANGES:                 4 frontend files, 1 architecture doc
ROUTING CONTRACT:        docs/architecture/TRAVELHUB_CRM_KPI_DRILLDOWN_ROUTING.md
BOOKINGS CONTEXT:        FIXED (from/to with dateFrom/dateTo fallback)
COMMAND CENTER:          IMPLEMENTED (WIDGET_ROUTES + KpiCard href)
CRM:                     PRESET PRESERVED
D10 REGRESSION:          NONE
D11 REGRESSION:          NONE
D8 REGRESSION:           NONE
SECURITY:                PRESERVED (no IDOR, server-side authority intact)
TESTS:                   43/44 PASS (1 pre-existing unrelated)
BUILD:                   PASS
REMAINING GAPS:          Finance drill-downs (deferred), Customer 360 period (by design)
NEXT AUTHORIZED ACTION:  D13 — Voucher
```
