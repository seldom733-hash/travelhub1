# TravelHub — Step 3.1 Dashboard / Command Center Backend — Design Document

## 1. Purpose

Step 3.1 provides the **backend orchestration layer** for the Dashboard / Command Center page. It aggregates KPI data from Step 3.3 Analytics Foundation read models into a single response suitable for the Dashboard UI (Step 3.2).

Command Center answers: **"What is happening in the business now, and where does management need to pay attention?"**

Detailed Analytics answers: **"Why did this happen and how does the metric behave in detail?"**

These two levels must not be mixed.

## 2. Current State

### Step 3.3 Analytics Foundation (APPROVED)

Available read models:
- `GET /api/v1/analytics/company-kpi` — Company KPI Summary
- `GET /api/v1/analytics/partner-performance` — Partner Performance
- `GET /api/v1/analytics/conversion-funnel` — Conversion Funnel
- `GET /api/v1/analytics/time-series` — Time Series
- `GET /api/v1/analytics/financial-reconciliation` — Financial Reconciliation

Available resolvers:
- Period resolver (7 presets + CUSTOM)
- Comparison resolver (calendar + custom)
- Granularity resolver (auto-select + override)

### Frontend Current State

- `app/app/dashboard/page.tsx` — Simple "Рабочий стол" with work center links
- No KPI cards, no analytics data, no period selector
- Navigation: Shell.tsx sidebar with work center links

### Backend Current State

- No dashboard module/service/controller
- No existing dashboard endpoints
- All analytics data lives in AnalyticsService

## 3. Dependencies

```
Step 3.3 (Analytics Foundation) ──→ Step 3.1 (Dashboard Backend) ──→ Step 3.2 (Dashboard UI)
```

Step 3.1 is the **first consumer** of Step 3.3. It must not create a parallel analytics foundation.

## 4. Step 3.3 Reuse Contract

Step 3.1 MUST reuse (not recreate):

| Step 3.3 Contract | How Step 3.1 uses it |
|---|---|
| Period resolver | Forward `preset`/`startDate`/`endDate`/`timezone` to Step 3.3 |
| Comparison resolver | Forward `comparison=true` to Step 3.3 |
| Granularity resolver | Forward `granularity` to Step 3.3 for time series |
| Company KPI Summary | Call `AnalyticsService.getCompanyKpi()` |
| Partner Performance | Call `AnalyticsService.getPartnerPerformance()` |
| Conversion Funnel | Call `AnalyticsService.getConversionFunnel()` |
| Time Series | Call `AnalyticsService.getTimeSeries()` |
| Financial Reconciliation | Call `AnalyticsService.getFinancialReconciliation()` |
| Multi-currency | Reuse Step 3.3 currency-separated aggregation |
| Actor Attribution | Forward attribution metadata from Step 3.3 |
| Half-open boundaries | `[start, endExclusive)` — no dashboard-specific semantics |

**Forbidden:**
- Creating parallel period/money/metric contracts
- Reimplementing any Step 3.3 calculation
- Adding new monetary aggregation logic
- Creating FX conversion
- Inventing company timezone

## 5. Users / Permissions

### RBAC Matrix

| Role | Command Center Access | Scope | Permission |
|---|---|---|---|
| ADMIN | ✅ Full | Company-wide | `analytics.read` |
| DIRECTOR | ✅ Full | Company-wide | `analytics.read` |
| ANALYST | ✅ Full | Company-wide | `analytics.read` |
| MARKETER | ✅ Full | Company-wide | `analytics.read` |
| FINANCE | ❌ No access | — | — |
| SALES_MANAGER | ❌ No access | — | — |
| OPERATOR | ❌ No access | — | — |
| MODERATOR | ❌ No access | — | — |
| PARTNER | ✅ Partner scope | Own partner only | `analytics.read` (via Step 3.3 isolation) |
| BUYER | ❌ No access | — | — |

### Partner Isolation

Reuses Step 3.3 `resolvePartnerScope()` pattern:
- PARTNER role → automatically scoped to own `partnerId`
- Cannot query other partners' data
- Scope enforced at query boundary

## 6. Command Center Sections

### Section 1: Executive Summary

Primary KPI cards for management overview.

### Section 2: Operational Overview

Operational metrics requiring attention.

### Section 3: Financial Summary

Financial health indicators.

### Section 4: Marketplace Activity

Marketplace/partner activity metrics.

## 7. KPI Catalog

### Section 1: Executive Summary

| KPI | Business meaning | Source | Period | Comparison | Currency | Permission | Drill-down |
|---|---|---|---|---|---|---|---|
| GMV | Gross Merchandise Value | Company KPI → `gmv` | ✅ | ✅ | Multi-currency | `analytics.read` | Analytics Center |
| Revenue | Payment revenue | Company KPI → `revenue` | ✅ | ✅ | Multi-currency | `analytics.read` | Analytics Center |
| Net Revenue | Revenue - Refunds | Company KPI → `netRevenue` | ✅ | ✅ | Multi-currency | `analytics.read` | Analytics Center |
| Orders Created | Total orders | Company KPI → `ordersCreated` | ✅ | ✅ | Count | `analytics.read` | Order Center |
| Bookings Requested | Total bookings | Company KPI → `bookingsRequested` | ✅ | ✅ | Count | `analytics.read` | Booking Center |
| AOV | Average Order Value | Company KPI → `averageOrderValue` | ✅ | ✅ | Multi-currency | `analytics.read` | Analytics Center |
| Conversion Rate | Payments / Orders | Derived from KPI | ✅ | ✅ | Percentage | `analytics.read` | Analytics Center |

### Section 2: Operational Overview

| KPI | Business meaning | Source | Period | Comparison | Currency | Permission | Drill-down |
|---|---|---|---|---|---|---|---|
| Orders Fulfilled | Completed orders | Company KPI → `ordersFulfilled` | ✅ | ✅ | Count | `analytics.read` | Order Center |
| Bookings Confirmed | Confirmed bookings | Company KPI → `bookingsConfirmed` | ✅ | ✅ | Count | `analytics.read` | Booking Center |
| Bookings Completed | Completed bookings | Company KPI → `bookingsCompleted` | ✅ | ✅ | Count | `analytics.read` | Booking Center |
| Payments Captured | Successful payments | Company KPI → `paymentsCaptured` | ✅ | ✅ | Count | `analytics.read` | Finance |
| Refunds Processed | Refund count | Company KPI → `refundsProcessed` | ✅ | ✅ | Count | `analytics.read` | Finance |
| Funnel Conversion | Impression → Completion | Conversion Funnel | ✅ | ❌ | Count | `analytics.read` | Analytics Center |

### Section 3: Financial Summary

| KPI | Business meaning | Source | Period | Comparison | Currency | Permission | Drill-down |
|---|---|---|---|---|---|---|---|
| Commission Accrued | Platform commission | Company KPI → `commissionAccrued` | ✅ | ❌ | Multi-currency | `analytics.read` | Finance |
| Reconciliation Status | Payment vs Ledger | Financial Reconciliation | ✅ | ❌ | Multi-currency | `analytics.read` | Finance |
| Total Payments | Payment volume | Reconciliation → `totalPayments` | ✅ | ❌ | Multi-currency | `analytics.read` | Finance |
| Net Payments | Payments - Refunds | Reconciliation → `netPayments` | ✅ | ❌ | Multi-currency | `analytics.read` | Finance |

### Section 4: Marketplace Activity

| KPI | Business meaning | Source | Period | Comparison | Currency | Permission | Drill-down |
|---|---|---|---|---|---|---|---|
| Marketplace Sessions | Unique visitors | Company KPI → `marketplaceSessions` | ✅ | ✅ | Count | `analytics.read` | Analytics Center |
| Storefront Sessions | Storefront visitors | Company KPI → `storefrontSessions` | ✅ | ✅ | Count | `analytics.read` | Analytics Center |
| Active Partners | Published products | Company KPI → `activePartners` | ✅ | ❌ | Count | `analytics.read` | Partner Center |
| New Customers | New registrations | Company KPI → `newCustomers` | ✅ | ✅ | Count | `analytics.read` | CRM |

## 8. Period / Comparison Contract

### Query Parameters

```
GET /api/v1/dashboard/command-center?preset=MONTH&comparison=true
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `preset` | enum | Yes | TODAY, LAST_3_DAYS, LAST_7_DAYS, MONTH, LAST_6_MONTHS, YEAR, CUSTOM |
| `startDate` | string | No | YYYY-MM-DD (required for CUSTOM) |
| `endDate` | string | No | YYYY-MM-DD (required for CUSTOM) |
| `timezone` | string | No | IANA timezone; default UTC |
| `comparison` | boolean | No | Include comparison period; default true |

### Behavior

- All period parameters forwarded to Step 3.3 resolvers
- Half-open boundaries: `[start, endExclusive)`
- Comparison: preceding equivalent period
- No dashboard-specific date semantics

## 9. Currency / Money Contract

### Multi-Currency Strategy

Reuses Step 3.3 currency-separated aggregation:
- Each monetary KPI returns per-currency breakdown
- Primary currency field (backward compatible, no FX authority)
- No fake `USD + EUR = total` aggregation
- No FX conversion

### Response Shape

```json
{
  "gmv": {
    "current": "150.00",
    "currency": "USD",
    "previous": "120.00",
    "delta": "30.00",
    "deltaPercent": 25.00
  }
}
```

## 10. Trends / Time Series

### Time Series Contract

Reuse Step 3.3 Time Series:
```
GET /api/v1/dashboard/command-center/trends?preset=MONTH&metric=orders
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `preset` | enum | Yes | Period preset |
| `startDate` | string | No | CUSTOM start |
| `endDate` | string | No | CUSTOM end |
| `timezone` | string | No | IANA timezone |
| `metric` | string | No | orders, bookings, payments, customers, commissions |
| `granularity` | enum | No | HOUR, DAY, WEEK, MONTH, QUARTER, YEAR (auto-select if omitted) |

### Supported Metrics

- `orders` — Order count per bucket
- `bookings` — Booking count per bucket
- `payments` — Payment count (CAPTURED) per bucket
- `customers` — Customer count per bucket
- `commissions` — Commission count per bucket

## 11. Attention / Alerts

### Alert Cards

Step 3.1 does NOT implement automated business alerts. Alert thresholds require canonical authority that does not yet exist.

**Documented gap:** Alert threshold authority (e.g., "overdue booking > 24h", "payment failure rate > 5%") is deferred to Step 3.2 or later with explicit business authority.

### Operational Exceptions (Data-Driven)

The Command Center CAN surface operational data that implies attention:
- Refunds processed (count from Step 3.3)
- Bookings not confirmed (from funnel)
- Partner performance anomalies (from Partner Performance)

But NO automated threshold-based alerting in Step 3.1.

## 12. Drill-Down

### Drill-Down Metadata

Each KPI card includes a `drillDown` hint:

```json
{
  "metric": "gmv",
  "drillDown": {
    "target": "analytics",
    "query": { "preset": "MONTH", "metric": "orders" }
  }
}
```

The `drillDown.target` is a logical key, NOT a frontend URL. Step 3.2 maps keys to routes.

### Drill-Down Targets

| Target | Description |
|---|---|
| `analytics` | Analytics Center — detailed metrics |
| `orders` | Order Center — order list |
| `bookings` | Booking Center — booking list |
| `finance` | Finance — payments/reconciliation |
| `partners` | Partner Center — partner list |

## 13. API Architecture

### Selected: Option C — Hybrid Summary + Lazy Sections

```
GET /api/v1/dashboard/command-center          → Summary (all sections)
GET /api/v1/dashboard/command-center/trends   → Time series (lazy)
```

### Rationale

1. **Summary endpoint** returns all KPI cards in one response — single round trip for Dashboard initial load
2. **Trends endpoint** is separate — time series data is larger and only needed when user opens charts
3. **Failure isolation** — trends failure doesn't break summary
4. **Reuses Step 3.3** — summary calls Step 3.3 Company KPI; trends calls Step 3.3 Time Series
5. **Payload bounded** — summary is ~2KB; trends is ~10KB depending on granularity

### Response Contract

#### Summary Response

```json
{
  "period": {
    "start": "2026-08-01T00:00:00.000Z",
    "endExclusive": "2026-09-01T00:00:00.000Z",
    "timezone": "UTC",
    "preset": "MONTH"
  },
  "comparison": {
    "start": "2026-07-01T00:00:00.000Z",
    "endExclusive": "2026-08-01T00:00:00.000Z"
  },
  "sections": {
    "executive": {
      "gmv": { "current": "150.00", "currency": "USD", "previous": "120.00", "delta": "30.00", "deltaPercent": 25.00, "drillDown": { "target": "analytics" } },
      "revenue": { ... },
      "netRevenue": { ... },
      "ordersCreated": { ... },
      "bookingsRequested": { ... },
      "averageOrderValue": { ... },
      "conversionRate": { ... }
    },
    "operational": {
      "ordersFulfilled": { ... },
      "bookingsConfirmed": { ... },
      "bookingsCompleted": { ... },
      "paymentsCaptured": { ... },
      "refundsProcessed": { ... },
      "funnelConversion": { ... }
    },
    "financial": {
      "commissionAccrued": { ... },
      "reconciliation": { ... },
      "totalPayments": { ... },
      "netPayments": { ... }
    },
    "marketplace": {
      "marketplaceSessions": { ... },
      "storefrontSessions": { ... },
      "activePartners": { ... },
      "newCustomers": { ... }
    }
  },
  "attribution": {
    "actionFields": [...],
    "ownershipFields": [...],
    "outcomeFields": [...]
  }
}
```

#### Trends Response

```json
{
  "period": { ... },
  "granularity": "DAY",
  "metric": "orders",
  "buckets": [
    { "label": "2026-08-01", "start": "...", "endExclusive": "...", "value": 42 },
    { "label": "2026-08-02", "start": "...", "endExclusive": "...", "value": 38 }
  ]
}
```

## 14. Authorization / Scope

### Permission Check

- All endpoints require `analytics.read` permission
- Permission enforced by `@RequirePermissions("analytics.read")` decorator
- Guards: JwtAuthGuard → PermissionsGuard (APP_GUARD chain)

### Partner Scope

- PARTNER role: automatically scoped to own `partnerId`
- Cannot query other partners' data
- Scope enforced at query boundary via `resolvePartnerScope()`
- Internal roles (ADMIN, DIRECTOR, etc.): full company scope

## 15. Consistency Model

- **Near-real-time**: Dashboard reads from same DB as Step 3.3
- No separate read model or projection
- No eventual consistency gap
- Data freshness = Step 3.3 data freshness

## 16. Performance / Query Budget

### Query Count

Summary endpoint makes ~4 downstream calls:
1. `AnalyticsService.getCompanyKpi()` — Company KPI
2. `AnalyticsService.getPartnerPerformance()` — Partner Performance (optional, for partner section)
3. `AnalyticsService.getConversionFunnel()` — Funnel
4. `AnalyticsService.getFinancialReconciliation()` — Reconciliation

All calls can be parallelized via `Promise.all()`.

### Optimization

- Summary endpoint: ~4 DB queries (parallel)
- Trends endpoint: ~1 DB query per bucket (Step 3.3 handles)
- No N+1 aggregation storm
- No expensive cross-domain joins

### Cache

**No cache in Step 3.1.** Dashboard reads directly from Step 3.3 services. Caching can be added later if latency becomes an issue.

## 17. Empty / Partial / Error Semantics

### Empty State

```json
{
  "gmv": { "current": "0.00", "currency": "USD", "previous": null, "delta": null, "deltaPercent": null }
}
```

### No Data

- Valid zero: `current: "0.00"` — means no activity in period
- No comparison: `previous: null` — means comparison not requested or unavailable
- Forbidden section: HTTP 403 — user lacks permission

### Error Handling

Reuses Step 3.3 error handling:
- Invalid period → 400 (BadRequestException)
- Invalid timezone → 400
- Unauthorized → 401
- Forbidden → 403
- No dashboard-specific error format

## 18. Observability

- Request ID: reused from `RequestContext` (X-Request-Id header)
- Latency: step 3.3 services log their own query timing
- Error count: standard NestJS exception filter
- No invasive telemetry in Step 3.1

## 19. Frontend Consumer Contract

Step 3.2 (Dashboard UI) will consume:
- `GET /api/v1/dashboard/command-center` — Summary
- `GET /api/v1/dashboard/command-center/trends` — Time series

Response shapes are stable and explicit:
- Period info included
- Comparison period included
- Currency separated
- Drill-down hints included
- No frontend reverse-engineering required

## 20. Characterization Gaps

| Contract | Existing test | Gap | Required before implementation? |
|---|---|---|---:|
| Dashboard summary endpoint | None | Create e2e test | Yes |
| Dashboard trends endpoint | None | Create e2e test | Yes |
| Period forwarding to Step 3.3 | Step 3.3 unit tests | Verify forwarding | No |
| Partner isolation | Step 3.3 e2e tests | Verify dashboard isolation | Yes |
| Multi-currency | Step 3.3 unit tests | Verify dashboard multi-currency | Yes |
| Authorization | Step 3.3 e2e tests | Verify dashboard auth | Yes |
| Empty state | Step 3.3 e2e tests | Verify dashboard empty state | Yes |

## 21. Implementation Waves

### Wave 0 — Characterization
- Create dashboard module skeleton
- Create DTO types
- Verify Step 3.3 service injection works

### Wave 1 — DTO / Query Contract
- Define `DashboardQueryDto`
- Define `CommandCenterResponse` interface
- Define `TrendResponse` interface

### Wave 2 — Orchestration Service
- Create `DashboardService`
- Implement `getCommandCenter()` — parallel Step 3.3 calls
- Implement `getTrends()` — forward to Step 3.3 Time Series

### Wave 3 — Controller / RBAC
- Create `DashboardController`
- Add `@RequirePermissions("analytics.read")`
- Register module in `AppModule`

### Wave 4 — E2E / Security
- Create `dashboard-command-center.e2e-spec.ts`
- Test authorization, partner isolation, period presets
- Test empty state, invalid input

### Wave 5 — Regression / Docs
- Full backend unit suite
- Full serial e2e suite
- Frontend tsc/Vitest
- DB drift check
- Design doc update

## 22. Risks / Authority Gaps

### Non-Blocking Gaps

| Gap | Impact | Resolution |
|---|---|---|
| Company timezone | Low — optional IANA, UTC fallback | Reuse Step 3.3 contract |
| Alert thresholds | Medium — no automated alerts | Deferred to Step 3.2+ |
| KPI target values | Low — no target comparison | Deferred to later |
| SLA targets | Low — no SLA monitoring | Deferred to later |

### Blocking Gaps

None. All required authority exists in Step 3.3.

## 23. Non-Goals

Step 3.1 does NOT:
- Implement Dashboard UI (Step 3.2)
- Create new analytics read models
- Add new permissions
- Modify Step 3.3 behavior
- Implement automated alerts
- Implement employee analytics
- Add schema/migrations
- Implement FX conversion
- Create company timezone authority
- Modify Step 2.17B

## 24. Acceptance Criteria

1. `GET /api/v1/dashboard/command-center` returns aggregated KPI summary
2. `GET /api/v1/dashboard/command-center/trends` returns time series data
3. All period presets work (TODAY through CUSTOM)
4. Comparison periods work
5. Multi-currency values are currency-separated
6. Partner isolation works (PARTNER scoped to own data)
7. BUYER gets 403
8. Unauthorized gets 401
9. Invalid period gets 400
10. Empty state returns valid zero values
11. No schema changes
12. Full backend unit suite passes
13. Full serial e2e suite passes
14. Frontend tsc/Vitest passes
15. DB drift = 0
