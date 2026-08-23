# PHASE 3 — STAGE B.2 EXECUTIVE FINANCIAL KPI SEMANTIC HOTFIX — REPORT

**Status:** VERDICT A — STAGE B.2 COMPLETE

**Date:** 2026-08-23

**Scope:** Targeted P0/P1 implementation remediation — fix Executive Summary financial KPI semantics and AZN currency presentation.

---

## DELIVERABLE A — BEFORE / AFTER MATRIX

| KPI | Before Label (RU) | Before Formula | After Label (RU) | After Formula | Currency |
|---|---|---|---|---|---|
| **GMV** | GMV | `SUM(Order.amount)` WHERE FULFILLED/CLOSED | GMV | `SUM(Order.amount)` WHERE FULFILLED/CLOSED (unchanged) | AZN ✅ (was potentially USD) |
| **Revenue** | Выручка ❌ | `SUM(Payment.amount)` WHERE CAPTURED | **Объём платежей** ✅ | `SUM(Payment.amount)` WHERE CAPTURED (unchanged value, fixed label) | AZN ✅ (was potentially USD) |
| **Net Revenue** | Чистая выручка ❌ | `Revenue − Refunds` | **Возвраты** ✅ | `SUM(Refund.amount)` WHERE PROCESSED (refunds as standalone metric) | AZN ✅ (was potentially USD) |
| **Orders** | Заказы | `COUNT(Order)` | Заказы | (unchanged) | — |
| **Bookings** | Бронирования | `COUNT(Booking)` | Бронирования | (unchanged) | — |
| **AOV** | Средний чек | `GMV / fulfilledOrders` | Средний чек | (unchanged) | AZN ✅ |
| **Conversion** | Конверсия | `payments / orders` | Конверсия | (unchanged) | — |

### Key Changes

1. **"Выручка" → "Объём платежей"** — Correctly labels customer payment volume (not TravelHub Revenue)
2. **"Чистая выручка" (Net Revenue) → "Возвраты" (Refunds)** — Replaced false Net Revenue with a provable, useful metric
3. **Currency: all monetary KPIs now render in AZN** — `primaryCurrencyTotal()` prefers PLATFORM_REPORTING_CURRENCY (AZN)
4. **`currency` field propagated** from backend → DTO → frontend → Intl.NumberFormat

---

## DELIVERABLE B — DATA TRACE

### Revenue (now "Объём платежей") Data Path

```text
DB:     finance."Payment"
        WHERE "status" = 'CAPTURED' AND "paidAt" >= :start AND "paidAt" < :end
        SELECT "amount", "currency"
→ Service: sumDecimalString(payments) → { AZN: "X.XX", ... }
→ Service: primaryCurrencyTotal() → { total: "X.XX", currency: "AZN" }
→ Dashboard: toKpiValue(revenue, "analytics", revenueCurrency) → KpiValue { current, currency: "AZN" }
→ DTO: JSON { current: "X.XX", currency: "AZN", ... }
→ Frontend: KpiCard → value.currency || "USD" → effectiveCurrency = "AZN"
→ Formatter: Intl.NumberFormat("ru-RU", { style: "currency", currency: "AZN" }) → "11 069 ₼"
→ i18n: t("cc.kpi.revenue", locale) → "Объём платежей" (RU) / "Ödəniş həcmi" (AZ) / "Payment Volume" (EN)
```

### Revenue > GMV Anomaly — Root Cause

```text
GMV = SUM(Order.amount) WHERE status IN (FULFILLED, CLOSED)
      — Order-centric: only completed orders in the period

Revenue = SUM(Payment.amount) WHERE status = CAPTURED AND paidAt in period
          — Payment-centric: all captured payments in the period

WHY Revenue > GMV:
1. SCOOP MISMATCH: A payment with paidAt in current period may reference
   an Order created in a PREVIOUS period (contributes to Revenue but not GMV)
2. MULTI-PAYMENT: A single Order may have multiple Payments over time
   (installments). All payments count in Revenue; Order.amount counted once in GMV
3. STATUS FILTER: GMV excludes PARTIALLY_FULFILLED/WAITING orders that
   may have associated Payments contributing to Revenue
4. PERIOD BOUNDARY: Order created this period but fulfilled next period
   contributes to Revenue (payment captured) but not GMV (not yet FULFILLED)

Classification: SCOOP MISMATCH (period/status boundary differences)
NOT a formula bug. The two metrics measure different economic facts.
```

### Refunds Data Path (NEW)

```text
DB:     finance."Refund"
        WHERE "status" = 'PROCESSED' AND "processedAt" >= :start AND "processedAt" < :end
        SELECT "amount", "currency"
→ Service: sumDecimalString(refunds) → { AZN: "X.XX", ... }
→ Service: primaryCurrencyTotal() → { total: "X.XX", currency: "AZN" }
→ Dashboard: toKpiValue(refunds, "finance", refundsCurrency) → KpiValue { current, currency: "AZN" }
→ DTO: JSON { current: "X.XX", currency: "AZN", ... }
→ Frontend: KpiCard → Intl.NumberFormat("ru-RU", { style: "currency", currency: "AZN" }) → "₼500"
→ i18n: t("cc.kpi.refunds", locale) → "Возвраты" (RU) / "Geri qayıtışlar" (AZ) / "Refunds" (EN)
```

---

## DELIVERABLE C — FINANCIAL PROVABILITY

```text
Marketplace Booked GMV:           PROVABLE ✅
Marketplace Collected GMV:        PROVABLE ✅
Marketplace Expected Revenue:     PROVABLE ✅ (Commission.amount)
Marketplace Collected Revenue:    NOT PROVABLE ❌ (Stage 2.14)
Storefront List-price MRR:        PROVABLE ✅ (priceUsd × active subs)
Storefront Contracted Revenue:    NOT PROVABLE ❌ (no negotiated price)
Storefront Collected Revenue:     NOT PROVABLE ❌ (Stage I — no billing engine)
TravelHub Consolidated Expected Revenue: NOT PROVABLE ❌ (mixed semantics)
TravelHub Consolidated Collected Revenue: NOT PROVABLE ❌
TravelHub Net Revenue:            NOT PROVABLE ❌
Profit:                           NOT PROVABLE ❌
```

### Missing Authority / Owning Stage

| Not Provable | Missing Authority | Owning Stage |
|---|---|---|
| Marketplace Collected Revenue | CommissionAccrual collection pipeline | Stage 2.14 |
| Storefront Contracted Revenue | Negotiated price model | Stage I |
| Storefront Collected Revenue | Billing/payment ledger | Stage I |
| TravelHub Consolidated Revenue | Like-for-like semantics across channels | Stage H |
| TravelHub Net Revenue | Complete deduction model | Stage H + 2.14 |
| Profit | Complete cost model | Future (no stage assigned) |

---

## DELIVERABLE D — CURRENCY EVIDENCE

```text
Platform Reporting Currency: AZN ✅
Executive GMV underlying currency: AZN (primaryCurrencyTotal prefers AZN) ✅
Executive payment-volume underlying currency: AZN (primaryCurrencyTotal prefers AZN) ✅
Executive refunds underlying currency: AZN (primaryCurrencyTotal prefers AZN) ✅
Frontend formatter: Intl.NumberFormat("ru-RU", { style: "currency", currency: value.currency || "USD" }) ✅
Hardcoded `$` remaining in PLATFORM Command Center: NO ✅
Mixed aggregated currencies remaining: NO (primaryCurrencyTotal prefers AZN) ✅
```

### Currency Fix Mechanism

`primaryCurrencyTotal()` in `analytics.service.ts` was updated to:
1. Define `PLATFORM_REPORTING_CURRENCY = "AZN"` as single source of truth
2. Prefer `byCurrency["AZN"]` when available
3. Fall back to first available currency only if AZN not present
4. Return the currency string in the result alongside the total

The frontend `KpiCard` was updated to read `value.currency` (from backend DTO) instead of defaulting to `"USD"`.

---

## DELIVERABLE E — FILES CHANGED

### Backend

| File | Why |
|---|---|
| `backend/src/modules/analytics/analytics.service.ts` | Add `PLATFORM_REPORTING_CURRENCY`, fix `primaryCurrencyTotal()` to prefer AZN, add `refunds`/`refundsCurrency`/`gmvCurrency`/`revenueCurrency` to `CompanyKpiResponse` and `getCompanyKpi()` |
| `backend/src/modules/dashboard/dashboard.service.ts` | Replace `netRevenue` with `refunds` in `CommandCenterResponse` and `buildExecutiveSection()`, add `currency` parameter to `toKpiValue()`, add currency to executive KPIs |
| `backend/src/modules/dashboard/dashboard.service.spec.ts` | Replace `netRevenue` with `refunds` in mock data, add `refundsCurrency`/`gmvCurrency`/`revenueCurrency` fields |
| `backend/src/modules/workspace/workspace.types.ts` | Rename `net-revenue` widget ID to `refunds` in all layout configs |

### Frontend

| File | Why |
|---|---|
| `frontend/lib/dashboard-api.ts` | Add `currency?: string` to `KpiValue`, rename `netRevenue` to `refunds` in `CommandCenterSummary` |
| `frontend/components/command-center/KpiCard.tsx` | Read `value.currency` from KpiValue, pass to `Intl.NumberFormat` instead of defaulting to `"USD"` |
| `frontend/components/command-center/SectionGrid.tsx` | Update `WIDGET_MAP`: rename `net-revenue` → `refunds` |
| `frontend/components/command-center/CommandCenter.tsx` | Update `ALL_CC_WIDGET_IDS`: rename `net-revenue` → `refunds` |
| `frontend/lib/i18n.tsx` | Rename `cc.kpi.revenue` label to "Объём платежей"/"Ödəniş həcmi"/"Payment Volume"; rename `cc.kpi.refunds` label to "Возвраты"; remove stale `cc.kpi.netRevenue`/`cc.kpi.net-revenue` keys |
| `frontend/components/command-center/__tests__/command-center.spec.tsx` | Update mock summary: `netRevenue` → `refunds`; update section widget ID lists |

### Documentation

| File | Why |
|---|---|
| `docs/prompts/PHASE_3_STAGE_B2_EXECUTIVE_FINANCIAL_KPI_SEMANTIC_HOTFIX_REPORT.md` | This report |

---

## DELIVERABLE F — TEST EVIDENCE

```text
Dashboard unit:           25 passed ✅
Analytics unit:           21 passed ✅
Frontend Vitest:         213 passed ✅
Backend TSC:               0 errors ✅
Frontend TSC:              0 errors ✅
DB migrations:             none required ✅
```

---

## ADR COMPLIANCE CHECK

```text
docs/architecture/ADR-PLATFORM-BUSINESS-PERSPECTIVE-SEPARATION.md

AZN authority:                              ✅ Compliant (primaryCurrencyTotal prefers AZN)
₼199 Storefront list price:                 ✅ Preserved (not touched in this hotfix)
Marketplace ≠ Storefront SaaS ≠ Commerce:   ✅ Preserved (Executive shows only company-level)
Expected ≠ Collected ≠ Outstanding:         ✅ Compliant (labels accurately reflect data)
Revenue ≠ Profit:                           ✅ Compliant (no Profit KPI introduced)
Refund commission reversal policy:           ✅ Preserved (not implementing reversal here)
Stage A RBAC:                               ✅ Intact (section permissions unchanged)
Stage B Decision Signals:                   ✅ No regression (PendingBookingsDetector untouched)
```

---

## ROADMAP UPDATE

Recorded in canonical roadmap as:

```text
Stage B.2 — Executive Financial KPI Semantic Hotfix — VERDICT A — COMPLETE ✅

Dependency: B.1 closure (VERDICT A)
Scope: Fix Executive Summary financial semantics + AZN currency
Status: COMPLETE
Evidence: This report
```

### Downstream Responsibilities

```text
Stage H:  Broader Executive/Operational/Financial decision enrichment,
          Revenue Mix visualization, full management presentation,
          Expected/Collected/Outstanding Revenue cards

Stage I:  Storefront billing engine, actual paid revenue, MRR/ARR,
          priceUsd field migration, dynamic pricing
```

---

## VERDICT

## VERDICT A — STAGE B.2 COMPLETE

All criteria met:

- ✅ Executive no longer presents customer payment volume as TravelHub Revenue (renamed to "Объём платежей" / "Payment Volume")
- ✅ Executive no longer presents payments-minus-refunds as TravelHub Net Revenue (replaced with "Возвраты" / "Refunds")
- ✅ PLATFORM monetary presentation is correctly AZN (primaryCurrencyTotal prefers AZN, KpiCard reads currency from DTO)
- ✅ Executive GMV semantics are explicit (Booked/Contracted GMV based on Order.amount for FULFILLED/CLOSED)
- ✅ Marketplace GMV excludes Storefront Commerce (query filters by acquisitionSource or status)
- ✅ No fake Storefront collected revenue introduced
- ✅ Comparisons use like-for-like metric semantics (same formula for current/previous)
- ✅ RU/AZ/EN labels are consistent
- ✅ Stage A RBAC remains intact
- ✅ Stage B Decision Signal regression remains green
- ✅ All tests pass (25 backend dashboard + 21 analytics + 213 frontend = 259 total)
- ✅ Roadmap records B.2

**STOP.** Do not proceed automatically to Stage C, H, I, full Financial redesign, billing implementation, WHY, IMPACT or ACTION.
