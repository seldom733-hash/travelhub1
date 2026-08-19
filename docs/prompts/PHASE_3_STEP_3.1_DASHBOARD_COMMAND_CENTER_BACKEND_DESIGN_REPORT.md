# TRAVELHUB — PHASE 3 — STEP 3.1 — DASHBOARD / COMMAND CENTER BACKEND — DESIGN REPORT

## 1. Executive Summary

**VERDICT A — DESIGN COMPLETED — READY FOR IMPLEMENTATION**

Step 3.1 Dashboard / Command Center Backend designed as **orchestration layer** over Step 3.3 Analytics Foundation. Single summary endpoint + lazy trends endpoint. No new schema, permissions, or analytics foundation.

## 2. Repository State

| Item | Value |
|---|---|
| HEAD | `59b7a39` |
| Branch | `master` |
| Step 3.3 | APPROVED |
| Step 2.17B | BLOCKED |

## 3. Roadmap Contract

> **Step 3.1 — Dashboard / Command Center Backend**
> Aggregated KPI/read models без владения operational entities.

- Scope: Backend aggregation of Step 3.3 read models
- Prerequisites: Step 3.3 (Analytics Foundation) — ✅ APPROVED
- Consumers: Step 3.2 (Dashboard UI)
- Relation to 3.3: First consumer, must reuse all Step 3.3 contracts

## 4. Existing Dashboard Inventory

| Component | Location | Current responsibility | Reusable? | Replace? | Notes |
|---|---|---|---:|---:|---|
| Dashboard page | `frontend/app/app/dashboard/page.tsx` | Work center links | Yes (keep) | No | Step 3.2 will enhance |
| Shell sidebar | `frontend/components/Shell.tsx` | Navigation | Yes | No | Step 3.1 backend-only |
| Analytics endpoints | `backend/src/modules/analytics/` | 5 read models | **Yes** | No | Core dependency |
| Analytics service | `analytics.service.ts` | Period/metric/comparison | **Yes** | No | Orchestrated by Step 3.1 |
| Analytics controller | `analytics.controller.ts` | API routes | **Yes** | No | Step 3.1 creates new controller |
| Permissions | `permissions.constants.ts` | `analytics.read` | **Yes** | No | Reused |

## 5. Selected API Architecture

**Option C: Hybrid Summary + Lazy Trends**

```
GET /api/v1/dashboard/command-center          → Summary (all sections)
GET /api/v1/dashboard/command-center/trends   → Time series (lazy)
```

### Rationale

1. Single round trip for initial Dashboard load
2. Trends loaded on demand (user opens charts)
3. Failure isolation — trends failure doesn't break summary
4. Reuses Step 3.3 services directly
5. Bounded payload (~2KB summary, ~10KB trends)

## 6. Command Center Sections

| Section | KPIs | Source |
|---|---|---|
| Executive Summary | GMV, Revenue, Net Revenue, Orders, Bookings, AOV, Conversion | Company KPI |
| Operational Overview | Fulfilled, Confirmed, Completed, Payments, Refunds, Funnel | Company KPI + Funnel |
| Financial Summary | Commission, Reconciliation, Payments, Net Payments | Company KPI + Reconciliation |
| Marketplace Activity | Sessions, Partners, Customers | Company KPI |

## 7. KPI Selection Matrix

| KPI | Command Center? | Why | Source | Drill-down |
|---|---|---|---|---|
| GMV | ✅ | Core business metric | Company KPI → gmv | Analytics Center |
| Revenue | ✅ | Revenue health | Company KPI → revenue | Analytics Center |
| Net Revenue | ✅ | Revenue after refunds | Company KPI → netRevenue | Analytics Center |
| Orders Created | ✅ | Order volume | Company KPI → ordersCreated | Order Center |
| Bookings Requested | ✅ | Booking volume | Company KPI → bookingsRequested | Booking Center |
| AOV | ✅ | Order value trend | Company KPI → averageOrderValue | Analytics Center |
| Conversion Rate | ✅ | Funnel efficiency | Derived (payments/orders) | Analytics Center |
| Orders Fulfilled | ✅ | Operational health | Company KPI → ordersFulfilled | Order Center |
| Bookings Confirmed | ✅ | Booking pipeline | Company KPI → bookingsConfirmed | Booking Center |
| Bookings Completed | ✅ | Completion rate | Company KPI → bookingsCompleted | Booking Center |
| Payments Captured | ✅ | Payment health | Company KPI → paymentsCaptured | Finance |
| Refunds Processed | ✅ | Refund monitoring | Company KPI → refundsProcessed | Finance |
| Commission Accrued | ✅ | Revenue share | Company KPI → commissionAccrued | Finance |
| Reconciliation | ✅ | Financial integrity | Financial Reconciliation | Finance |
| Marketplace Sessions | ✅ | Traffic | Company KPI → marketplaceSessions | Analytics Center |
| Storefront Sessions | ✅ | Storefront traffic | Company KPI → storefrontSessions | Analytics Center |
| Active Partners | ✅ | Partner health | Company KPI → activePartners | Partner Center |
| New Customers | ✅ | Growth | Company KPI → newCustomers | CRM |

## 8. Step 3.3 Reuse Matrix

| Step 3.3 API | Dashboard usage | Forward params |
|---|---|---|
| Company KPI | `getCompanyKpi()` | preset, startDate, endDate, timezone, comparison |
| Partner Performance | `getPartnerPerformance()` | preset, startDate, endDate, timezone, partnerId |
| Conversion Funnel | `getConversionFunnel()` | preset, startDate, endDate, timezone |
| Time Series | `getTimeSeries()` | preset, startDate, endDate, timezone, metric, granularity |
| Financial Reconciliation | `getFinancialReconciliation()` | preset, startDate, endDate, timezone |

## 9. Permissions Matrix

| Section/KPI | Permission | ADMIN | DIRECTOR | ANALYST | MARKETER | FINANCE | SALES_MANAGER | PARTNER | BUYER |
|---|---|---|---|---|---|---|---|---|---|
| Executive Summary | analytics.read | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (own) | ❌ |
| Operational | analytics.read | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (own) | ❌ |
| Financial | analytics.read | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (own) | ❌ |
| Marketplace | analytics.read | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (own) | ❌ |
| Trends | analytics.read | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (own) | ❌ |

## 10. Multi-Currency Contract

- Reuses Step 3.3 currency-separated aggregation
- Each monetary KPI: `{ current, currency, previous, delta, deltaPercent }`
- Primary currency for backward compatibility
- No FX conversion
- No fake combined totals

## 11. Period / Comparison

- All period parameters forwarded to Step 3.3
- Half-open boundaries: `[start, endExclusive)`
- Comparison: preceding equivalent period
- No dashboard-specific date semantics

## 12. Performance / Query Strategy

- Summary: ~4 parallel DB queries via Step 3.3
- Trends: ~1 DB query per bucket (Step 3.3 handles)
- No N+1, no cross-domain joins
- No cache in Step 3.1 (can add later)

## 13. Cache Decision

**No cache in Step 3.1.** Dashboard reads directly from Step 3.3 services. Caching deferred to Step 3.2 or later if latency requires it.

## 14. Characterization Gaps

| Contract | Existing test | Gap | Required? |
|---|---|---|---:|
| Dashboard summary | None | Create e2e | Yes |
| Dashboard trends | None | Create e2e | Yes |
| Period forwarding | Step 3.3 tests | Verify | No |
| Partner isolation | Step 3.3 e2e | Verify | Yes |
| Multi-currency | Step 3.3 tests | Verify | Yes |
| Authorization | Step 3.3 e2e | Verify | Yes |

## 15. Implementation Waves

| Wave | Scope | Tests |
|---|---|---|
| 0 | Module skeleton, DTOs | Characterization |
| 1 | Query contract | Unit |
| 2 | Orchestration service | Unit |
| 3 | Controller / RBAC | Unit |
| 4 | E2E / Security | E2E |
| 5 | Regression / Docs | Full regression |

## 16. Authority Gaps

| Gap | Impact | Status |
|---|---|---|
| Company timezone | Low | Reuse Step 3.3 |
| Alert thresholds | Medium | Deferred |
| KPI targets | Low | Deferred |
| SLA targets | Low | Deferred |

**No blocking authority gaps.**

## 17. Negative Checks

| Check | Value |
|---|---|
| Production backend implementation | 0 |
| Frontend implementation | 0 |
| Schema changes | 0 |
| Migrations | 0 |
| Permission changes | 0 |
| Step 3.3 behavior changes | 0 |
| New analytics foundation | 0 |
| Money authority changes | 0 |
| FX implementation | 0 |
| Company timezone invented | 0 |
| Employee Analytics implementation | 0 |
| Employee scoring | 0 |
| Step 2.17B changes | 0 |
| Frozen targets changed | 0 |
| Phase 2 exit claimed | 0 |
| Step 3.2 implementation | 0 |
| Release | 0 |

## 18. Verdict

**PHASE 3 STEP 3.1 DASHBOARD / COMMAND CENTER BACKEND DESIGN COMPLETED — READY FOR IMPLEMENTATION**

### Conditions met:
- ✅ Roadmap scope verified
- ✅ Existing implementation inventoried
- ✅ Step 3.3 reuse explicit
- ✅ KPI set bounded (18 cards)
- ✅ Period/comparison contract fixed
- ✅ Multi-currency contract fixed
- ✅ RBAC/scope fixed
- ✅ API architecture selected (Option C)
- ✅ Performance/query risks documented
- ✅ Test gaps known
- ✅ Implementation waves defined
- ✅ No unresolved blocking authority gap

## 19. Persistence

Commit: design document + report

## 20. NEXT

`NEXT: PHASE 3 — STEP 3.1 — DASHBOARD / COMMAND CENTER BACKEND — IMPLEMENTATION`

## 21. Repository Evidence

| Evidence | Value |
|---|---|
| HEAD | `59b7a39` |
| Branch | `master` |
| Design doc | `docs/architecture/dashboard-command-center-backend-3.1.md` |
| Design report | `docs/prompts/PHASE_3_STEP_3.1_DASHBOARD_COMMAND_CENTER_BACKEND_DESIGN_REPORT.md` |
| Schema changes | 0 |
| Implementation | 0 (design only) |
