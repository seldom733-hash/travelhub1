# PHASE 3 — STEP 3.2 — PLATFORM COMMAND CENTER UI — DESIGN & UX CONTRACT

> **ЯЗЫК:** все ответы исполнителя пользователю, промежуточные статусы, пояснения и итоговый summary — на русском языке. Английский допустим для кода, команд, путей, API routes, identifiers и канонических технических статусов.

---

## 1. REPOSITORY BASELINE

| Field | Value |
|---|---|
| Repository | `seldom733-hash/travelhub1` |
| Branch | `master` |
| Base SHA | `369f7d9` |
| Workspace | Clean (only untracked docs/prompts) |
| Backend | NestJS + Prisma + TypeScript |
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 |
| Backend port | 4000 |
| Frontend port | 3000 |
| API proxy | `/api/v1/*` → backend via `next.config.ts` rewrites |
| Auth | HttpOnly cookie `travelhub.auth` + `GET /api/v1/auth/session` |
| i18n | Client-side `LocaleProvider` RU/AZ/EN (no URL prefix) |
| Existing nav | 8 items (sidebar via `Shell.tsx`) |
| Drag-and-drop lib | **NOT installed** |
| Chart lib | **NOT installed** |
| Animation lib | **NOT installed** |

---

## 2. SCOPE / NON-GOALS

### In Scope

- Platform Command Center UI (first visual consumer of Workspace Constructor)
- Route `/app/command-center`
- Page-level data fetching (Step 3.1 aggregation)
- Period/comparison controls
- KPI card rendering per section
- Lazy trends/charts
- Workspace Constructor / effective layout integration
- Layout edit/save/reset/version-conflict UX
- Responsive behavior (desktop → mobile)
- Accessibility (WCAG 2.1 AA intent)
- Localization (RU/AZ/EN)
- Security (RBAC, partner isolation, frontend gating)

### Explicitly Out of Scope

- Partner Command Center UI
- Organization switcher
- Second analytics engine
- New KPI formulas
- Backend changes (Step 3.1/3.3/3.3E authority untouched)
- Schema/migration changes
- New permissions
- Admin UI for system/role defaults
- Employee Analytics
- Import/export layouts
- User templates
- Release/deploy

---

## 3. REPOSITORY-FIRST MAPPING

| Design Capability | Existing Code / Contract | Status | Reuse / Extend / New | Target File (Future) | Risk |
|---|---|---|---|---|---|
| Application Shell | `Shell.tsx` (sidebar + auth + RBAC) | Exists | Extend (add nav items) | `components/Shell.tsx` | LOW |
| Platform Route | `/app/dashboard` (work center hub) | Exists | Reuse for `/app/command-center` | `app/app/command-center/page.tsx` | LOW |
| Navigation | 8 items in `NAV` array in Shell.tsx | Exists | Extend (add Command Center) | `components/Shell.tsx` | LOW |
| Page Header | `PageHeader.tsx` (title + breadcrumbs + actions) | Exists | Reuse | `components/PageHeader.tsx` | NONE |
| Period Selector | **NOT implemented** | GAP | New component | `components/PeriodSelector.tsx` | MEDIUM |
| Comparison Indicator | **NOT implemented** | GAP | New component | `components/ComparisonBadge.tsx` | LOW |
| KPI Card | `Kpi.tsx` (simple label+value+icon) | Exists | Replace (too simple for Command Center) | `components/command-center/KpiCard.tsx` | MEDIUM |
| Trend Visualization | **NOT implemented** (no chart lib) | GAP | New (need chart lib) | `components/command-center/TrendChart.tsx` | HIGH |
| Section Container | **NOT implemented** | GAP | New component | `components/command-center/SectionCard.tsx` | LOW |
| Widget Grid | **NOT implemented** (no grid lib) | GAP | New (CSS Grid or lib) | `components/command-center/WidgetGrid.tsx` | MEDIUM |
| Layout Edit Mode | `useWorkspaceCustomize` hook exists | Exists | Reuse + wrap in UI | `components/command-center/CustomizeBar.tsx` | MEDIUM |
| Widget Registry Integration | `useWorkspaceLayout` + `useWorkspaceAvailableWidgets` hooks | Exists | Reuse | — | NONE |
| Effective Layout Loading | `useWorkspaceLayout(pageId)` | Exists | Reuse | — | NONE |
| Layout Save/Reset | `workspaceApi.saveLayout/resetLayout` | Exists | Reuse | — | NONE |
| API Client | `lib/api.ts` (fetch + cookie auth + error handling) | Exists | Reuse | — | NONE |
| RBAC Handling | `useCurrentUser` + `Shell` redirect + `@RequirePermissions` backend | Exists | Reuse | — | NONE |
| Loading/Error/Empty | Ad-hoc per page (no shared pattern) | Partial | Extend (standardize) | `components/command-center/CommandCenterStates.tsx` | LOW |
| Responsive | Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`) | Exists | Extend | — | LOW |
| Localization | `i18n.tsx` DICT + `t()` function | Exists | Extend (add keys) | `lib/i110n.tsx` | LOW |
| Workspace API Client | `lib/workspace-api.ts` (types + 4 endpoints) | Exists | Reuse | — | NONE |
| Workspace Hooks | `lib/use-workspace.ts` (3 hooks) | Exists | Reuse | — | NONE |

---

## 4. INFORMATION ARCHITECTURE

### 4.1 Platform Command Center Sections

Based on Step 3.1 backend authority, the Platform Command Center has **4 sections with real data** and **2 sections with GAP status**.

#### Section A — Executive Summary (7 KPIs)

| KPI | Backend Field | Source | Format | Semantic Polarity |
|---|---|---|---|---|
| GMV | `sections.executive.gmv` | Step 3.3 CompanyKpi | Currency | ↑ positive |
| Revenue | `sections.executive.revenue` | Step 3.3 CompanyKpi | Currency | ↑ positive |
| Net Revenue | `sections.executive.netRevenue` | Step 3.3 CompanyKpi | Currency | ↑ positive |
| Orders Created | `sections.executive.ordersCreated` | Step 3.3 CompanyKpi | Count | ↑ positive |
| Bookings Requested | `sections.executive.bookingsRequested` | Step 3.3 CompanyKpi | Count | ↑ positive |
| AOV | `sections.executive.averageOrderValue` | Step 3.3 CompanyKpi | Currency | ↑ positive |
| Conversion Rate | `sections.executive.conversionRate` | Dashboard-computed | Percentage | ↑ positive |

**Business Purpose:** High-level business health — marketplace GMV, revenue, order flow, conversion.

**Intended Audience:** DIRECTOR, FINANCE, ANALYST, SALES_MANAGER, OPERATOR, ADMIN.

**Empty behavior:** `current: 0` with `previous: null` → show "0" without delta.

**Error behavior:** Transport error → skeleton → retry button. 403 → redirect to `/app/dashboard`.

#### Section B — Operational (6 KPIs)

| KPI | Backend Field | Source | Format | Semantic Polarity |
|---|---|---|---|---|
| Orders Fulfilled | `sections.operational.ordersFulfilled` | Step 3.3 CompanyKpi | Count | ↑ positive |
| Bookings Confirmed | `sections.operational.bookingsConfirmed` | Step 3.3 CompanyKpi | Count | ↑ positive |
| Bookings Completed | `sections.operational.bookingsCompleted` | Step 3.3 CompanyKpi | Count | ↑ positive |
| Payments Captured | `sections.operational.paymentsCaptured` | Step 3.3 CompanyKpi | Count | ↑ positive |
| Refunds Processed | `sections.operational.refundsProcessed` | Step 3.3 CompanyKpi | Count | ↓ **negative** (more refunds = worse) |
| Funnel Conversion | `sections.operational.funnelConversion` | Step 3.3 ConversionFunnel | Percentage | ↑ positive |

**Business Purpose:** Operational pipeline health — fulfillment, booking lifecycle, payment capture, refund anomalies, funnel.

**Semantic Polarity Note:** `refundsProcessed` uses ↓ negative polarity — growth in refunds is NOT positive. All other operational KPIs use ↑ positive.

#### Section C — Financial (4 KPIs)

| KPI | Backend Field | Source | Format | Semantic Polarity |
|---|---|---|---|---|
| Commission Accrued | `sections.financial.commissionAccrued` | Step 3.3 CompanyKpi | Currency | ↑ positive |
| Reconciliation Status | `sections.financial.reconciliationStatus` | Step 3.3 FinancialReconciliation | Count (ledger entries) | → neutral (informational) |
| Total Payments | `sections.financial.totalPayments` | Step 3.3 FinancialReconciliation | Currency | → neutral |
| Net Payments | `sections.financial.netPayments` | Step 3.3 FinancialReconciliation | Currency | ↑ positive |

**Business Purpose:** Financial health — commission revenue, reconciliation coverage, payment flow.

**Multi-Currency Rule:** Each monetary KPI carries a `currency` field. Display as `{value} {currency}`. NO fake cross-currency totals. Currency-separated summary.

#### Section D — Marketplace (4 KPIs)

| KPI | Backend Field | Source | Format | Semantic Polarity |
|---|---|---|---|---|
| Marketplace Sessions | `sections.marketplace.marketplaceSessions` | Step 3.3 CompanyKpi | Count | ↑ positive |
| Storefront Sessions | `sections.marketplace.storefrontSessions` | Step 3.3 CompanyKpi | Count | ↑ positive |
| Active Partners | `sections.marketplace.activePartners` | Step 3.3 CompanyKpi | Count | ↑ positive |
| New Customers | `sections.marketplace.newCustomers` | Step 3.3 CompanyKpi | Count | ↑ positive |

**Business Purpose:** Marketplace ecosystem health — traffic, partner activity, customer acquisition.

#### Section E — Partner Management (GAP)

| KPI | Source | Status |
|---|---|---|
| Partner applications | Step 3.1 API: **no endpoint** | GAP |
| Verification/onboarding | Step 3.1 API: **no endpoint** | GAP |
| Active/inactive partners | `activePartners` exists in Marketplace, but not partner-specific | GAP |
| Quality/performance | Step 3.1 API: **no endpoint** | GAP |

**Action:** Section E is NOT rendered in Command Center v1. When Step 3.2 implementation proceeds, this section is deferred until backend authority exists. Document as future section with `partnerManagement: []`.

#### Section F — Moderation (GAP)

| KPI | Source | Status |
|---|---|---|
| Listings awaiting review | Step 3.1 API: **no endpoint** | GAP |
| Moderation backlog | Step 3.1 API: **no endpoint** | GAP |
| SLA | Step 3.1 API: **no endpoint** | GAP |

**Action:** Section F is NOT rendered. Moderation data requires dedicated backend authority. Deferred.

#### Section G — Support / Risk (GAP)

| KPI | Source | Status |
|---|---|---|
| Complaints | Step 3.1 API: **no endpoint** | GAP |
| Disputes | Step 3.1 API: **no endpoint** | GAP |
| Fraud/risk | Step 3.1 API: **no endpoint** | GAP |

**Action:** Section G is NOT rendered. Requires dedicated backend.

#### Section H — Employees / Operations (GAP)

| KPI | Source | Status |
|---|---|---|
| Workload | Step 3.1 API: **no endpoint** | GAP |
| Task completion | Step 3.1 API: **no endpoint** | GAP |

**Action:** Section H is NOT rendered. Employee Analytics is a future Phase 3 step.

**Hard Rule:**

```
FOUNDATION ATTRIBUTION ≠ EMPLOYEE PERFORMANCE SCORING
```

---

## 5. API-TO-UI CONTRACT

### 5.1 Primary Data Flow

```
User opens /app/command-center
→ Frontend calls GET /api/v1/dashboard/command-center?preset=MONTH&comparison=true
→ Backend orchestrates Step 3.3 read models (CompanyKpi, ConversionFunnel, FinancialReconciliation)
→ Response: CommandCenterResponse (period + 4 sections + attribution metadata)
→ Frontend maps sections → registered widgets via Widget Registry
→ Lazy: user clicks "Show Trends" → GET /api/v1/dashboard/command-center/trends?metric=revenue&granularity=DAY
```

### 5.2 Summary Endpoint Contract

| UI Element | Endpoint | Response Path | Semantic Meaning | Format | Permission | Empty | Error |
|---|---|---|---|---|---|---|---|
| GMV Card | `GET /dashboard/command-center` | `sections.executive.gmv.current` | Gross merchandise value | `{amount} {currency}` | `analytics.read` | `0 {currency}` | Skeleton → retry |
| Revenue Card | same | `sections.executive.revenue` | Revenue from payments | `{amount} {currency}` | same | `0 {currency}` | same |
| Net Revenue Card | same | `sections.executive.netRevenue` | Revenue minus refunds | `{amount} {currency}` | same | `0 {currency}` | same |
| Orders Card | same | `sections.executive.ordersCreated` | Orders created in period | `count` | same | `0` | same |
| Bookings Card | same | `sections.executive.bookingsRequested` | Bookings requested | `count` | same | `0` | same |
| AOV Card | same | `sections.executive.averageOrderValue` | GMV / orders | `{amount} {currency}` | same | `—` | same |
| Conversion Card | same | `sections.executive.conversionRate` | payments / orders × 100 | `XX.XX%` | same | `0.00%` | same |
| Fulfilled Card | same | `sections.operational.ordersFulfilled` | Orders fulfilled | `count` | same | `0` | same |
| Confirmed Card | same | `sections.operational.bookingsConfirmed` | Bookings confirmed | `count` | same | `0` | same |
| Completed Card | same | `sections.operational.bookingsCompleted` | Bookings completed | `count` | same | `0` | same |
| Payments Card | same | `sections.operational.paymentsCaptured` | Payments captured | `count` | same | `0` | same |
| Refunds Card | same | `sections.operational.refundsProcessed` | Refunds processed | `count` | same | `0` | same |
| Funnel Card | same | `sections.operational.funnelConversion` | last/first stage % | `XX.XX%` | same | `0.00%` | same |
| Commission Card | same | `sections.financial.commissionAccrued` | Commission accrued | `{amount} {currency}` | same | `0 {currency}` | same |
| Reconciliation Card | same | `sections.financial.reconciliationStatus.current` | Ledger entries count | `count` | same | `0` | same |
| Total Payments Card | same | `sections.financial.totalPayments` | Total payments | `{amount} {currency}` | same | `0 {currency}` | same |
| Net Payments Card | same | `sections.financial.netPayments` | Payments minus refunds | `{amount} {currency}` | same | `0 {currency}` | same |
| Sessions Card | same | `sections.marketplace.marketplaceSessions` | Marketplace sessions | `count` | same | `0` | same |
| Storefront Sessions Card | same | `sections.marketplace.storefrontSessions` | Storefront sessions | `count` | same | `0` | same |
| Partners Card | same | `sections.marketplace.activePartners` | Active partners | `count` | same | `0` | same |
| Customers Card | same | `sections.marketplace.newCustomers` | New customers | `count` | same | `0` | same |
| Revenue Trend | `GET /dashboard/command-center/trends` | `buckets[].value` | Time series | chart data | same | empty chart | skeleton |
| Orders Trend | same | `buckets[].value` | Time series | chart data | same | empty chart | same |
| Bookings Trend | same | `buckets[].value` | Time series | chart data | same | empty chart | same |

### 5.3 Query Parameters

| Parameter | Type | Required | Default | Behavior |
|---|---|---|---|---|
| `preset` | enum | yes | `MONTH` | `TODAY`, `LAST_3_DAYS`, `LAST_7_DAYS`, `MONTH`, `LAST_6_MONTHS`, `YEAR`, `CUSTOM` |
| `startDate` | string (YYYY-MM-DD) | only if CUSTOM | — | Custom start date |
| `endDate` | string (YYYY-MM-DD) | only if CUSTOM | — | Custom end date |
| `timezone` | string (IANA) | no | UTC | Business timezone |
| `comparison` | boolean | no | `true` | Show comparison period |
| `metric` | string | trends only | `orders` | Metric for time series |
| `granularity` | enum | trends only | auto | `HOUR`, `DAY`, `WEEK`, `MONTH` |

### 5.4 Loading Strategy

```
INITIAL LOAD:
  → Single request: GET /dashboard/command-center?preset=MONTH&comparison=true
  → Response maps to all 4 sections + 21 KPI cards

LAZY TRENDS:
  → Triggered by user clicking "Show Trends" on a section or widget
  → Single request: GET /dashboard/command-center/trends?metric=revenue&granularity=DAY
  → No per-widget fan-out

PERIOD CHANGE:
  → Single re-request: GET /dashboard/command-center?preset=NEW_PERIOD&comparison=true
  → Abort previous in-flight request (AbortController)
  → Replace stale response (no merge)
```

### 5.5 Cancellation / Race Behavior

- Use `AbortController` per request
- On period change: abort previous, fire new
- On unmount: abort all
- No stale response suppression needed (single-flight, not streaming)

### 5.6 Retry Policy

- Transport error: show error state + manual retry button
- 401: redirect to `/login?next=...`
- 403: show "Access denied" + redirect to `/app/dashboard` after 3s
- 5xx: show error state + retry button
- No automatic retry (user-initiated only)

---

## 6. TIME / PERIOD UX CONTRACT

### 6.1 Period Selector

**Placement:** Top toolbar, right side of page header. Visible always.

**Presets:**

| Preset Label (RU) | Preset Label (EN) | Preset Label (AZ) | Preset Value |
|---|---|---|---|
| Сегодня | Today | Bu gün | `TODAY` |
| 3 дня | 3 Days | 3 gün | `LAST_3_DAYS` |
| 7 дней | 7 Days | 7 gün | `LAST_7_DAYS` |
| Месяц | Month | Ay | `MONTH` |
| 6 месяцев | 6 Months | 6 ay | `LAST_6_MONTHS` |
| Год | Year | İl | `YEAR` |
| Свой период | Custom | Xüsusi | `CUSTOM` |

**Custom Range Interaction:**
- Click "Custom" → two date pickers appear (start, end)
- Date format: `DD.MM.YYYY` in display, `YYYY-MM-DD` in API
- Validation: start ≤ end, both within reasonable range (not future beyond today)
- Apply button appears after both dates selected
- On apply: fire new request with `preset=CUSTOM&startDate=...&endDate=...`

**Active Selection:**
- Highlighted preset button (blue bg)
- Custom shows both dates as text "01.01.2026 — 31.01.2026"

**Timezone Display:**
- Show timezone label: "UTC" or "Asia/Baku" or "Europe/Moscow"
- Default: UTC (no company timezone authority exists)
- User can select timezone from dropdown (IANA validation)
- Not stored in URL — session-level preference

**Half-Open Semantics:**
- Backend uses `[startInstant, endExclusiveInstant)`
- User sees "January 1 — January 31" (inclusive labels)
- No technical noise ("endExclusive") in UI

### 6.2 Comparison Toggle

**Placement:** Toggle button next to period selector.

**Behavior:**
- Default: ON (comparison shown)
- Toggle OFF → hides comparison delta, hides `previous` values
- Comparison period is auto-calculated by Step 3.3:
  - Calendar presets → previous equivalent calendar period
  - Custom → immediately preceding equivalent-duration interval

**Display:**
- Delta shown as: `+12.5%` (green) or `-3.2%` (red)
- Polarity-aware: for `refundsProcessed`, green means decrease, red means increase
- Delta null → no delta shown (not "0%")

### 6.3 URL State

**Decision:** Period state stored in URL query params.

```
/app/command-center?preset=MONTH&comparison=true&timezone=UTC
/app/command-center?preset=CUSTOM&startDate=2026-01-01&endDate=2026-01-31
```

**Browser Navigation:**
- Back/forward updates period state
- Period changes push to history (not replace)

### 6.4 Mobile Interaction

- Period selector collapses to dropdown on mobile
- Custom range: native date inputs on mobile
- Comparison toggle remains accessible

---

## 7. WIDGET AND LAYOUT CONTRACT

### 7.1 Workspace Constructor Integration

**Page ID:** `command-center`

**Backend:** `GET /api/v1/workspaces/command-center` → `EffectiveLayout`

**Registry:** 19 widgets registered for `command-center` page (from `WIDGET_REGISTRY`).

### 7.2 Widget Inventory

| # | Widget ID | Type | Default | Required | Movable | Removable | Size |
|---|---|---|---|---|---|---|---|
| 1 | `gmv` | kpi-card | ✅ | no | yes | yes | 1×1 |
| 2 | `revenue` | kpi-card | ✅ | no | yes | yes | 1×1 |
| 3 | `net-revenue` | kpi-card | ✅ | no | yes | yes | 1×1 |
| 4 | `orders` | kpi-card | ✅ | no | yes | yes | 1×1 |
| 5 | `bookings` | kpi-card | ✅ | no | yes | yes | 1×1 |
| 6 | `aov` | kpi-card | ✅ | no | yes | yes | 1×1 |
| 7 | `conversion` | kpi-card | ✅ | no | yes | yes | 1×1 |
| 8 | `funnel` | funnel | ✅ | no | yes | yes | 3×2 |
| 9 | `commission` | kpi-card | ✅ | no | yes | yes | 1×1 |
| 10 | `reconciliation` | alert | ✅ | **YES** | yes | **NO** | 3×1 |
| 11 | `payments` | kpi-card | ❌ | no | yes | yes | 1×1 |
| 12 | `net-payments` | kpi-card | ❌ | no | yes | yes | 1×1 |
| 13 | `sessions` | kpi-card | ❌ | no | yes | yes | 1×1 |
| 14 | `partners` | kpi-card | ❌ | no | yes | yes | 1×1 |
| 15 | `customers` | kpi-card | ❌ | no | yes | yes | 1×1 |
| 16 | `revenue-trend` | time-series | ❌ | no | yes | yes | 3×2 |
| 17 | `orders-trend` | time-series | ❌ | no | yes | yes | 3×2 |
| 18 | `bookings-trend` | time-series | ❌ | no | yes | yes | 3×2 |
| 19 | `funnel` | funnel (reused) | ✅ | no | yes | yes | 3×2 |

### 7.3 Default Layout

System default layout shows 10 widgets (the `defaultWidgets` array from `PAGE_REGISTRY`):

```
Row 1: [gmv] [revenue] [net-revenue] [orders]
Row 2: [bookings] [aov] [conversion] [funnel(3)]
Row 3: [commission(3)] [reconciliation(3)]
```

Grid: 4 columns on desktop, auto-reflow on smaller screens.

### 7.4 Role Defaults

| Role | Additional Visible Widgets |
|---|---|
| DIRECTOR | + payments, net-payments, sessions, partners, customers (15 total) |
| FINANCE | + payments, net-payments (12 total) |
| DEFAULT (others) | 10 widgets (system default) |

### 7.5 Layout Edit Mode

**Entry:** "Customize" button in toolbar (only if `constructorEnabled=true` and user has at least one widget permission).

**Edit Mode UI:**
- Grid overlay visible (light borders between cells)
- Widget cards become draggable (desktop only)
- Resize handles appear on resizable widgets (funnel, trends)
- "Add Widget" panel slides in from right (list of available widgets not yet in layout)
- "Remove" button on each removable widget (× icon top-right)
- Required widget (`reconciliation`) has no remove button
- "Save" and "Cancel" buttons appear in toolbar
- "Reset to Default" button in customize panel

**Save:**
- Calls `PUT /api/v1/workspaces/command-center/layout`
- Optimistic: show new layout immediately
- On failure: revert to previous layout + show error toast

**Cancel:**
- Discard draft, return to current saved layout

**Reset:**
- Calls `DELETE /api/v1/workspaces/command-center/layout`
- Returns to system/role default

**Version Conflict:**
- If backend returns different `layoutVersion` than expected → show conflict dialog: "Layout was changed elsewhere. Reload or overwrite?"

**Unsaved Changes Warning:**
- On navigation away with unsaved draft → browser `beforeunload` prompt

### 7.6 Mobile Layout

- Drag/drop DISABLED on mobile (≤768px)
- Widgets stacked vertically in default order
- Customize button hidden on mobile
- All widgets visible (no hiding on mobile — responsive CSS handles sizing)

---

## 8. VISUAL SYSTEM AND COMPONENT CONTRACT

### 8.1 Page Frame

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar (240px)  │  Content Area                        │
│                  │  ┌─────────────────────────────────┐ │
│  TravelHub       │  │ PageHeader:                      │ │
│  Logo            │  │   Breadcrumb: Home / Cmd Center  │ │
│                  │  │   Title: Command Center           │ │
│  Nav Items       │  │   Actions: [Period] [Compare]    │ │
│  ──────────      │  │              [Customize]         │ │
│  ...             │  └─────────────────────────────────┘ │
│                  │  ┌─────────────────────────────────┐ │
│  User Info       │  │ Widget Grid (12-col)              │ │
│  Logout          │  │   ┌───┐ ┌───┐ ┌───┐ ┌───┐      │ │
│                  │  │   │GMV│ │Rev│ │Net│ │Ord│      │ │
│                  │  │   └───┘ └───┘ └───┘ └───┘      │ │
│                  │  │   ┌───┐ ┌───┐ ┌───────┐         │ │
│                  │  │   │Bkg│ │AOV│ │Funnel │         │ │
│                  │  │   └───┘ └───┘ └───────┘         │ │
│                  │  │   ┌───────┐ ┌───────────────┐   │ │
│                  │  │   │Comm.  │ │ Reconciliation │   │ │
│                  │  │   └───────┘ └───────────────┘   │ │
│                  │  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 8.2 KPI Card Component

```
┌─────────────────────────┐
│ ↗ Revenue               │  ← title + polarity arrow
│ $12,450.00              │  ← primary value (bold, large)
│ ↑ +12.5% vs prev month  │  ← delta (polarity-colored)
│ ─────────────────────── │
│ ▁▂▃▅▇▆▄▃▁              │  ← sparkline (optional, lazy)
└─────────────────────────┘
```

**Specs:**
- Title: 11px, uppercase, tracking-wide, slate-400
- Value: 18px, bold, slate-900 (or currency-colored)
- Delta: 12px, green-600 (positive) or red-600 (negative)
- Sparkline: 64px × 24px, brand color line
- Border: 1px slate-200, rounded-xl
- Shadow: sm → md on hover
- Skeleton: pulsing slate-100 blocks

**Semantic Polarity per KPI:**

| KPI | ↑ Growth = Positive? | Color Logic |
|---|---|---|
| GMV | YES | green=up, red=down |
| Revenue | YES | green=up, red=down |
| Net Revenue | YES | green=up, red=down |
| Orders | YES | green=up, red=down |
| Bookings | YES | green=up, red=down |
| AOV | YES | green=up, red=down |
| Conversion | YES | green=up, red=down |
| Fulfilled | YES | green=up, red=down |
| Confirmed | YES | green=up, red=down |
| Completed | YES | green=up, red=down |
| Payments Captured | YES | green=up, red=down |
| **Refunds Processed** | **NO** | **red=up, green=down** |
| Funnel Conversion | YES | green=up, red=down |
| Commission | YES | green=up, red=down |
| Sessions | YES | green=up, red=down |
| Partners | YES | green=up, red=down |
| Customers | YES | green=up, red=down |

### 8.3 Section Container

```
┌─ Executive Summary ─────────────────────────────────────┐
│  [KPI] [KPI] [KPI] [KPI]                               │
│  [KPI] [KPI] [KPI] [──────── Funnel ────────]          │
└─────────────────────────────────────────────────────────┘
```

- Section title: 14px, bold, slate-900
- Section subtitle: 12px, slate-500 (optional description)
- Grid: responsive columns (4 on desktop, 2 on tablet, 1 on mobile)
- Gap: 12px
- Background: transparent (cards have own bg)

### 8.4 Trend Chart

```
┌─ Revenue Trend ─────────────────────────────────────────┐
│  $15k │         ╱╲                                      │
│       │    ╱╲╱╱    ╲╲╱╲                                │
│  $10k │╱╱              ╲╲                               │
│       │                   ╲                              │
│  $5k  │                     ╲╱                          │
│       └──────────────────────────────                   │
│        Jan   Feb   Mar   Apr   May                      │
│  ─── Current    - - - Previous                          │
└─────────────────────────────────────────────────────────┘
```

- Line chart with optional comparison overlay
- X-axis: time buckets (DAY/WEEK/Month)
- Y-axis: value (currency or count)
- Tooltip: bucket label + value + date range
- No-data: "No data for this period" message
- Responsive: full width, height 200-300px

### 8.5 Chart Library Decision

**Repository has NO chart library installed.**

**Options:**
1. `recharts` — React-native, composable, MIT, 16k+ stars
2. `chart.js` + `react-chartjs-2` — canvas-based, lighter
3. `@nivo/bar` — declarative, beautiful defaults

**Recommended:** `recharts` — best React integration, composable API, well-suited for line charts and sparklines. Install as part of Step 3.2 implementation.

### 8.6 Drag-and-Drop Library Decision

**Repository has NO DnD library installed.**

**Options:**
1. `@dnd-kit/core` — modern, accessible, lightweight
2. `react-beautiful-dnd` — deprecated but mature
3. Native HTML5 DnD API — no library, limited

**Recommended:** `@dnd-kit/core` — actively maintained, keyboard accessible, touch support, closest to WCAG compliance. Install as part of Step 3.2 implementation.

---

## 9. NAVIGATION CONTRACT

### 9.1 Current Navigation (Shell.tsx)

```
🏠 Рабочий стол        /app/dashboard
📚 Catalog Center      /app/catalog
🧾 Order Center        /app/orders
📑 Booking Center      /app/bookings
🤝 CRM mini            /app/crm
📋 Partner onboarding  /app/partners/onboarding
🛡 Seller profiles     /app/seller-profiles
👥 Пользователи        /app/users
```

### 9.2 Target Platform Navigation

```
🏠 Command Center      /app/command-center         ← NEW (Step 3.2)
📦 Marketplace         /app/marketplace             ← DEFERRED
🤝 Partners            /app/partners                ← DEFERRED
🔍 Moderation          /app/moderation              ← DEFERRED
💰 Sales               /app/sales                   ← DEFERRED
🧾 Orders              /app/orders                  ← EXISTS
📑 Bookings            /app/bookings                ← EXISTS
👤 Customers           /app/customers               ← DEFERRED
💳 Finance             /app/finance                 ← DEFERRED
🎧 Support             /app/support                 ← DEFERRED
📊 Analytics           /app/analytics               ← DEFERRED
👥 Employees           /app/employees               ← DEFERRED
📢 Marketing           /app/marketing               ← DEFERRED
📄 Documents           /app/documents               ← DEFERRED
⚙️ Settings            /app/settings                ← DEFERRED
```

### 9.3 Step 3.2 Navigation Changes

**Add to Shell.tsx NAV array:**

```typescript
{ href: "/app/command-center", icon: "📊", label: "Command Center", permission: "analytics.read" }
```

**Position:** FIRST item (before "Рабочий стол") — Command Center is the primary Platform workspace.

**Reclassify existing pages:**
- `/app/dashboard` remains as "Рабочий стол" (work center hub)
- Command Center is the primary analytics/business overview
- Other centers remain as operational work centers

### 9.4 Active State

- Command Center active when pathname starts with `/app/command-center`
- Highlight with blue bg + right border (same pattern as existing nav)

### 9.5 Breadcrumb

```
Home / Command Center
```

Simple two-level breadcrumb. No deeper hierarchy needed for v1.

### 9.6 Partner Menu

**NOT added to Platform sidebar.** Partner workspace is a separate scope. Platform users never see Partner-specific navigation.

---

## 10. STATE MATRIX

| State | Page | Section | Widget | User Action | Recovery |
|---|---|---|---|---|---|
| Initial Loading | Skeleton layout | Skeleton per section | Skeleton KPI cards | Wait | Auto-resolves |
| Summary Loaded | Full layout | All sections rendered | All KPI values shown | — | — |
| Lazy Trends Loading | — | — | Chart shows skeleton | Click "Show Trends" | Auto-resolves |
| Empty Business Dataset | Full layout | Sections with zero values | "0" in cards | — | — |
| Metric Not Applicable | — | — | "—" dash | — | — |
| Partial Section Data | — | Some KPIs missing | Missing KPI shows "—" | — | — |
| Stale Cached Data | — | — | — | — | Auto-resolves on refetch |
| Validation Error | — | — | — | Invalid date range | Fix dates |
| Unauthenticated (401) | Redirect to /login | — | — | Login | Auto-redirect |
| Forbidden (403) | Redirect to /app/dashboard | — | — | — | Auto-redirect |
| Server Error (5xx) | Error page | — | — | Retry button | Manual retry |
| Network Offline | Offline banner | — | — | Wait/retry | Auto-resolve when online |
| Period Switch Race | — | — | — | — | AbortController cancels stale |
| Layout Loading | Skeleton layout | — | — | Wait | Auto-resolves |
| Layout Editing | Grid overlay | — | Draggable cards | Save/Cancel | Cancel reverts |
| Unsaved Layout | — | — | — | Navigate away | beforeunload prompt |
| Layout Save Success | Toast "Saved" | — | — | — | Auto-dismiss 3s |
| Layout Save Failure | Toast "Error" | — | — | Retry save | Manual retry |
| Layout Version Conflict | Conflict dialog | — | — | Reload/Overwrite | User choice |
| Permission Revoked | Redirect to /app/dashboard | — | — | — | Auto-redirect |
| Unknown Future Widget | — | — | Silently ignored | — | — |

**Hard Distinction:**

```
ZERO VALUE ≠ NO DATA ≠ NOT APPLICABLE ≠ FORBIDDEN ≠ FAILED
```

- **ZERO VALUE:** `current: 0` → show "0" (legitimate business state)
- **NO DATA:** `current: null` → show "—" (no records in period)
- **NOT APPLICABLE:** metric doesn't apply → hide widget or show "N/A"
- **FORBIDDEN:** 403 → redirect, never show data
- **FAILED:** 5xx/network → error state, never show partial

---

## 11. RESPONSIVE CONTRACT

### 11.1 Breakpoints

Based on Tailwind defaults (already used in repository):

| Name | Width | Columns | Sidebar |
|---|---|---|---|
| Desktop Wide | ≥1280px (xl) | 12 | Visible (240px) |
| Desktop | ≥1024px (lg) | 12 | Visible (240px) |
| Tablet | ≥768px (md) | 8 | Collapsed (icon-only, 64px) |
| Mobile | <768px | 4 | Hidden (hamburger toggle) |

### 11.2 Desktop (≥1024px)

- Full sidebar (240px) + content area
- KPI grid: 4 columns
- Charts: full width within section
- Customize mode: full drag/drop + resize

### 11.3 Tablet (768px–1023px)

- Collapsed sidebar (icon-only, 64px)
- Content fills remaining space
- KPI grid: 2 columns
- Charts: full width
- Customize mode: drag/drop works, resize limited

### 11.4 Mobile (<768px)

- Sidebar hidden (hamburger in header)
- KPI grid: 1 column (full width cards)
- Charts: full width, scrollable horizontally
- Customize mode: **DISABLED** (button hidden)
- Widgets stacked vertically
- Period selector: dropdown instead of button group
- Comparison toggle: hidden (default ON)

### 11.5 Touch Targets

- Minimum 44×44px for interactive elements (WCAG 2.5.5)
- Period selector buttons: 44px height on mobile
- KPI card: tappable (future drill-down)

---

## 12. ACCESSIBILITY CONTRACT

### 12.1 Semantic Structure

- `<h1>` for page title ("Command Center")
- `<h2>` for section titles ("Executive Summary", "Financial Overview")
- `<h3>` for widget titles (within cards)
- `<nav>` for sidebar navigation
- `<main>` for content area
- `<aside>` for sidebar

### 12.2 Keyboard Navigation

- Tab through: period selector → comparison toggle → customize button → widgets (in grid order)
- Enter/Space on period preset: select period
- Enter/Space on customize button: toggle edit mode
- Arrow keys in edit mode: move selected widget (future)
- Escape: exit customize mode without saving
- Focus visible: 2px blue outline on all interactive elements

### 12.3 Screen Reader

- KPI cards: `aria-label="Revenue: $12,450, up 12.5% from previous month"`
- Delta: `aria-label="increased 12.5%"` (not just color)
- Charts: `role="img"` with `aria-label="Revenue trend chart showing data from January to June 2026"`
- Period selector: `role="radiogroup"` with `aria-label="Select time period"`
- Customize mode: `aria-live="polite"` region announces "Customize mode active"

### 12.4 Color Independence

- Delta: arrow icon (↑/↓) + text, not just color
- Status: text label, not just color
- Charts: line patterns or labels, not just color

### 12.5 Reduced Motion

- `@media (prefers-reduced-motion: reduce)`: disable animations
- Skeleton pulse: disabled
- Hover transitions: disabled
- Chart animations: disabled

---

## 13. LOCALIZATION CONTRACT

### 13.1 Translation Keys

New keys to add to `DICT` in `i18n.tsx`:

```
"cmd_center.title" → { ru: "Command Center", en: "Command Center", az: "İdarəetmə Mərkəzi" }
"cmd_center.period.today" → { ru: "Сегодня", en: "Today", az: "Bu gün" }
"cmd_center.period.3d" → { ru: "3 дня", en: "3 Days", az: "3 gün" }
"cmd_center.period.7d" → { ru: "7 дней", en: "7 Days", az: "7 gün" }
"cmd_center.period.month" → { ru: "Месяц", en: "Month", az: "Ay" }
"cmd_center.period.6m" → { ru: "6 месяцев", en: "6 Months", az: "6 ay" }
"cmd_center.period.year" → { ru: "Год", en: "Year", az: "İl" }
"cmd_center.period.custom" → { ru: "Свой период", en: "Custom", az: "Xüsusi" }
"cmd_center.compare" → { ru: "Сравнение", en: "Comparison", az: "Müqayisə" }
"cmd_center.customize" → { ru: "Настроить", en: "Customize", az: "Fərdiləşdir" }
"cmd_center.save" → { ru: "Сохранить", en: "Save", az: "Saxla" }
"cmd_center.cancel" → { ru: "Отмена", en: "Cancel", az: "Ləğv et" }
"cmd_center.reset" → { ru: "Сбросить", en: "Reset", az: "Sıfırla" }
"cmd_center.show_trends" → { ru: "Показать тренды", en: "Show Trends", az: "Trendləri göstər" }
"cmd_center.no_data" → { ru: "Нет данных за период", en: "No data for this period", az: "Dövr üçün məlumat yoxdur" }
"cmd_center.section.executive" → { ru: "Обзор", en: "Executive Summary", az: "İcra Xülasəsi" }
"cmd_center.section.operational" → { ru: "Операционный", en: "Operational", az: "Əməliyyat" }
"cmd_center.section.financial" → { ru: "Финансовый", en: "Financial", az: "Maliyyə" }
"cmd_center.section.marketplace" → { ru: "Маркетплейс", en: "Marketplace", az: "Bazar" }
```

### 13.2 Number/Date Formatting

- Use `Intl.NumberFormat` with locale tag from `LOCALE_TAGS`
- Currency: `Intl.NumberFormat(locale, { style: 'currency', currency: kpi.currency })`
- Percent: `Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 2 })`
- Date range: `Intl.DateTimeFormat(locale, { dateStyle: 'medium' })`
- No hard-coded number formats

### 13.3 Hard-Coded Strings

**Rule:** No hard-coded user-visible strings in component code. All go through `t()` function.

---

## 14. SECURITY CONTRACT

### 14.1 Permission

- Platform Command Center requires: `analytics.read`
- Backend guard: `@RequirePermissions("analytics.read")` on both endpoints
- Frontend gating: Shell renders nav item only if user has `analytics.read`

### 14.2 RBAC Matrix

| Role | Access to Command Center | Access to All KPIs |
|---|---|---|
| ADMIN | ✅ | ✅ |
| DIRECTOR | ✅ | ✅ |
| FINANCE | ✅ | ✅ |
| ANALYST | ✅ | ✅ |
| SALES_MANAGER | ✅ | ✅ |
| OPERATOR | ✅ | ✅ |
| MODERATOR | ✅ (analytics.read only) | ✅ |
| MARKETER | ✅ (analytics.read only) | ✅ |
| PARTNER | ❌ (redirected to /partner) | ❌ |
| BUYER | ❌ (redirected to /account) | ❌ |

### 14.3 Partner Isolation

- No `partnerId` parameter exposed in Command Center UI
- Platform Command Center shows aggregate platform data
- Partner-specific analytics is a separate future scope
- Backend `resolvePartnerScope()` does NOT apply here (platform-level query)

### 14.4 Frontend Security

- Frontend gating is UX only — backend is authoritative
- Layout config cannot expand permissions
- Widget visibility controlled by backend RBAC filtering
- No sensitive data in layout JSON (no user IDs, partner IDs, financial formulas)

---

## 15. PERFORMANCE CONTRACT

### 15.1 Request Budget

| Metric | Budget |
|---|---|
| Initial summary request | < 2s (p95) |
| Lazy trends request | < 1s (p95) |
| Layout load | < 500ms (p95) |
| Layout save | < 1s (p95) |
| Total initial render | < 3s (FCP) |

### 15.2 Data Fetch Strategy

```
Page Load:
  1. GET /workspaces/command-center (layout) — immediate
  2. GET /dashboard/command-center?preset=... (summary) — immediate
  3. Parallel: both requests fire simultaneously

Trends:
  4. GET /dashboard/command-center/trends?metric=... — lazy (on demand)

NO per-widget fan-out.
```

### 15.3 Bundle Impact

- `recharts`: ~40KB gzipped (tree-shakeable)
- `@dnd-kit/core`: ~10KB gzipped
- Total additional: ~50KB gzipped
- Recommendation: dynamic import for DnD (only in customize mode)

### 15.4 Cache

- Layout: client-side state (no stale-while-revalidate)
- Summary: refetch on period change (no persistent cache)
- Trends: refetch on metric change
- No SWR/React Query currently in repo — add only if justified

---

## 16. TEST STRATEGY (FUTURE IMPLEMENTATION)

### Unit/Component Tests

- KPI card rendering (value, currency, delta, polarity)
- Period selector (preset selection, custom range, validation)
- Comparison toggle (on/off, delta display)
- State rendering (loading, empty, error, forbidden)
- Widget mapping (registry → component)
- Unknown widget handling (silently ignored)
- Layout edit/save/conflict UX
- Localization (RU/AZ/EN labels)
- Query construction (preset, dates, timezone)

### Integration Tests

- Summary endpoint → widget mapping
- Lazy trends loading
- Period/timezone propagation
- Request cancellation on period change
- Partial/error responses
- Effective layout integration
- Unauthorized/403 handling
- Cache separation

### Accessibility Tests

- Keyboard navigation (tab order, enter/space)
- Focus management (visible focus, trap in customize)
- ARIA labels (KPI cards, charts, period selector)
- No color-only semantics
- Chart text alternative

### Responsive Tests

- Desktop (12-col), tablet (8-col), mobile (4-col)
- No horizontal overflow
- Widget ordering maintained
- Mobile toolbar/date range

### Regression

- Existing 150 frontend Vitest tests remain PASS
- Frontend tsc PASS
- Frontend production build PASS
- No backend authority changes
- No schema/migration changes

---

## 17. 20 REQUIRED DESIGN DECISIONS

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Canonical route | `/app/command-center` | Under `/app/*` internal routes, consistent with existing pattern |
| 2 | Page ID | `command-center` | Matches `PAGE_REGISTRY` entry |
| 3 | Shell integration | Add first nav item in `Shell.tsx` NAV array | Pattern already exists |
| 4 | Section order | Executive → Operational → Financial → Marketplace | Business priority: health → operations → money → ecosystem |
| 5 | KPI/widget inventory | 21 KPIs mapped to 19 widgets (from backend + registry) | Backend authority is source of truth |
| 6 | Required widgets | `reconciliation` only | Design authority from architecture addendum |
| 7 | API-to-widget mapping | See §5.2 table | Direct field mapping, no computation |
| 8 | Loading strategy | Single summary request + lazy trends | Step 3.1 orchestration model preserved |
| 9 | Period selector | Dropdown/button group in toolbar | Standard dashboard pattern |
| 10 | Comparison representation | Delta arrow + percentage, polarity-aware | UX best practice |
| 11 | Currency display | `{amount} {currency}` per KPI | No fake totals |
| 12 | KPI polarity | See §8.2 table | Refunds = negative growth |
| 13 | Drill-down | `drillDown.target` from backend → future deep link | Not implemented in v1 |
| 14 | Loading/empty/error | See §10 state matrix | Strict zero vs null distinction |
| 15 | Layout edit/save | `useWorkspaceCustomize` hook + save/reset buttons | Existing foundation |
| 16 | Responsive | Tailwind breakpoints, 12/8/4 col grid | Existing CSS system |
| 17 | Accessibility | WCAG 2.1 AA intent, keyboard, ARIA | Compliance target |
| 18 | Localization | Extend `DICT` in `i18n.tsx` | Existing pattern |
| 19 | Test matrix | See §16 | Comprehensive coverage |
| 20 | Deferred gaps | Partner mgmt, Moderation, Support, Employees, Marketing sections | No backend authority |

---

## 18. IMPLICIT DECISIONS

| Decision | Choice | Rationale |
|---|---|---|
| Chart library | `recharts` (install) | Best React integration, tree-shakeable, MIT |
| DnD library | `@dnd-kit/core` (install) | Accessible, modern, keyboard support |
| State management | React state (useState/useCallback) | Existing pattern, no Redux/Zustand |
| URL state | Query params for period/comparison | Browser back/forward support |
| Error handling | try/catch + error state | Existing `api.ts` pattern |
| No SWR/React Query | Direct fetch | Existing pattern, add only if justified |

---

## 19. AUTHORITY GAPS

| Gap | Blocking Step 3.2? | Notes |
|---|---|---|
| No company reporting timezone | NO | UTC fallback, user can select timezone |
| No Partner analytics backend | NO | Platform-only scope |
| No Moderation analytics backend | NO | Section deferred |
| No Support/Risk analytics backend | NO | Section deferred |
| No Employee analytics backend | NO | Future step |
| No chart library installed | NO | Install in implementation |
| No DnD library installed | NO | Install in implementation |
| No Sparkline component | NO | Build in implementation |
| Drill-down targets not implemented | NO | Future enhancement |

---

## 20. ACCEPTANCE CRITERIA — DESIGN PASS

| Criterion | Status |
|---|---|
| Correct repo/branch/ancestry verified | ✅ |
| Current frontend inventory completed | ✅ |
| Step 3.1/3.3/3.3E contracts mapped | ✅ |
| Platform-only scope explicit | ✅ |
| Partner Command Center explicitly deferred | ✅ |
| Route/pageId/navigation decisions defined | ✅ |
| All Platform sections mapped to real authority or gaps | ✅ |
| API-to-widget table complete | ✅ |
| Period/timezone/comparison UX defined | ✅ |
| Currency and finance semantics safe | ✅ |
| Widget/layout/edit/conflict contract defined | ✅ |
| Full state matrix exists | ✅ |
| Responsive/accessibility/localization contracts exist | ✅ |
| Performance and test strategies exist | ✅ |
| No production code/schema/migration changes | ✅ |
| Implementation waves executable | ✅ |
| Blockers and open decisions explicit | ✅ |
| Artifacts committed and pushed | PENDING |
| HEAD == upstream and worktree clean | PENDING |

---

## 21. IMPLEMENTATION WAVES

### Wave 1: Route + Shell Integration
- **Files:** `app/app/command-center/page.tsx`, `components/Shell.tsx`
- **Dependencies:** None
- **Acceptance:** Route accessible, nav item visible, auth works
- **Tests:** Navigation rendering, auth redirect

### Wave 2: Typed API Client + State Layer
- **Files:** `lib/command-center-api.ts`, `lib/use-command-center.ts`
- **Dependencies:** Wave 1
- **Acceptance:** Summary fetched, typed response, loading/error states
- **Tests:** API mapping, error handling, period change

### Wave 3: Period/Comparison Controls
- **Files:** `components/command-center/PeriodSelector.tsx`, `components/command-center/ComparisonToggle.tsx`
- **Dependencies:** Wave 2
- **Acceptance:** Period selection works, comparison toggle, custom range
- **Tests:** Preset selection, custom validation, URL state sync

### Wave 4: Summary Sections + KPI Cards
- **Files:** `components/command-center/KpiCard.tsx`, `components/command-center/SectionCard.tsx`, `components/command-center/ExecutiveSection.tsx`, etc.
- **Dependencies:** Wave 2
- **Acceptance:** All 21 KPIs rendered with correct values, polarity, currency
- **Tests:** KPI rendering, polarity, currency formatting, empty states

### Wave 5: Lazy Trends/Charts
- **Files:** `components/command-center/TrendChart.tsx`, `components/command-center/Sparkline.tsx`
- **Dependencies:** Wave 2, `recharts` installed
- **Acceptance:** Trends load on demand, chart renders, no fan-out
- **Tests:** Lazy loading, chart rendering, metric switching

### Wave 6: Workspace Constructor Integration
- **Files:** `components/command-center/WidgetGrid.tsx`, integration with `useWorkspaceLayout`
- **Dependencies:** Waves 1-4
- **Acceptance:** Effective layout loads, widgets positioned per registry
- **Tests:** Layout load, widget mapping, required widget present

### Wave 7: Layout Edit/Save/Reset/Conflict UX
- **Files:** `components/command-center/CustomizeBar.tsx`, `components/command-center/WidgetPalette.tsx`
- **Dependencies:** Wave 6, `@dnd-kit/core` installed
- **Acceptance:** Enter/exit customize, drag/drop, save, reset, conflict dialog
- **Tests:** Edit mode, save, reset, version conflict, unsaved warning

### Wave 8: Responsive/Accessibility/Localization
- **Files:** All components updated
- **Dependencies:** Waves 1-7
- **Acceptance:** All breakpoints work, keyboard accessible, RU/AZ/EN labels
- **Tests:** Responsive, accessibility, i18n

### Wave 9: Component/Integration/Regression Tests
- **Files:** Test files across all waves
- **Dependencies:** Waves 1-8
- **Acceptance:** All new tests PASS, existing 150 tests PASS
- **Tests:** Full suite

### Wave 10: Full Frontend Verification
- **Files:** None (verification only)
- **Dependencies:** Wave 9
- **Acceptance:** tsc PASS, Vitest PASS, production build PASS
- **Tests:** Regression gate
