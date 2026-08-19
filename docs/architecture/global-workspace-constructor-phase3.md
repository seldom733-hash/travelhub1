# Global Page / Workspace Constructor — Architecture Addendum

## 1. Purpose

Единый конструктор рабочих страниц для TravelHub — общеплатформенный механизм, а не отдельная функция для каждой страницы.

Задача: определить каноническую архитектуру `Workspace Constructor Framework`, которую переиспользуют Dashboard, Analytics, CRM, Sales, Finance и другие рабочие центры.

**Ключевой принцип:**
```
ONE GLOBAL WORKSPACE CONSTRUCTOR
→ CONFIGURES PRESENTATION
→ NOT BUSINESS AUTHORITY
```

## 2. Scope

**В scope:**
- Widget Registry (единый каталог виджетов)
- Page Registry (список страниц с policy)
- Layout Hierarchy (system → role → user)
- Constructor Enable/Disable per page
- Grid/Responsive model
- Drag/Drop/Resize semantics
- Persistence strategy (user layouts)
- API contract (backend/future)
- RBAC hard boundary
- Versioning/Migration strategy
- Rollout phases

**Не в scope (Non-Goals):**
- Actual widget rendering (делает frontend в Step 3.2+)
- Widget business logic (делает backend read models)
- Admin UI для управления page/widget defaults
- Import/Export layouts
- Cross-page layout templates
- Mobile constructor (auto-flow на мобильных)

## 3. Page Registry

Единый registry страниц с constructor policy.

| pageId | title | constructorEnabled | defaultWidgets | requiredWidgets | roleDefaults | minCols | maxCols | version |
|---|---|---|---|---|---|---:|---:|---|
| `command-center` | Command Center | true | [gmv, revenue, orders, bookings, conversion, aov, funnel, commission, payments] | [reconciliation] | DIRECTOR: +[refundRate]; FINANCE: +[netPayments] | 4 | 12 | 1 |
| `analytics` | Analytics Center | true | [kpi-summary, time-series, comparison] | [kpi-summary] | — | 4 | 12 | 1 |
| `crm` | CRM | false | [customer-list, contacts, activities] | [customer-list] | — | 4 | 8 | 1 |
| `catalog` | Catalog Center | false | [product-list, moderation-queue] | [product-list] | — | 4 | 8 | 1 |
| `orders` | Order Center | false | [order-list, fulfillment] | [order-list] | — | 4 | 8 | 1 |
| `bookings` | Booking Center | false | [booking-list, confirmations] | [booking-list] | — | 4 | 8 | 1 |
| `partner/*` | Partner Cabinet | false | [my-products, orders, stats] | [my-products] | — | 4 | 8 | 1 |

### Page Classes

**Constructor Enabled** — пользователь может персонализировать layout (Command Center, Analytics).

**Constructor Disabled** — фиксированный layout, бизнес-критические страницы (CRM, Orders, Bookings, Settings).

**Future candidates** — Marketing, Support, Reports, Employee Analytics, Documents.

## 4. Widget Registry

Единый каталог виджетов с metadata.

### Widget Types

| Type | Description |
|---|---|
| `kpi-card` | KPI metric card (value + comparison + delta) |
| `chart` | Line/bar/pie chart |
| `time-series` | Time-based trend chart |
| `table` | Data table with rows |
| `status-summary` | Status breakdown |
| `alert` | Attention/alert card |
| `funnel` | Conversion funnel visualization |
| `list` | Entity list (customers, products) |
| `custom` | Custom domain widget |

### Widget Registry (Command Center initial set)

| widgetId | type | pageTypes | category | title | permission | minSize | maxSize | defaultSize | movable | resizable | removable | required | dataSource |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `gmv` | kpi-card | command-center | KPI | GMV | analytics.read | 1×1 | 2×2 | 1×1 | yes | no | yes | no | Dashboard summary → gmv |
| `revenue` | kpi-card | command-center | KPI | Revenue | analytics.read | 1×1 | 2×2 | 1×1 | yes | no | yes | no | Dashboard summary → revenue |
| `net-revenue` | kpi-card | command-center | KPI | Net Revenue | analytics.read | 1×1 | 2×2 | 1×1 | yes | no | yes | no | Dashboard summary → netRevenue |
| `orders` | kpi-card | command-center | KPI | Orders | analytics.read | 1×1 | 2×2 | 1×1 | yes | no | yes | no | Dashboard summary → ordersCreated |
| `bookings` | kpi-card | command-center | KPI | Bookings | analytics.read | 1×1 | 2×2 | 1×1 | yes | no | yes | no | Dashboard summary → bookingsRequested |
| `aov` | kpi-card | command-center | KPI | AOV | analytics.read | 1×1 | 2×2 | 1×1 | yes | no | yes | no | Dashboard summary → averageOrderValue |
| `conversion` | kpi-card | command-center | KPI | Conversion | analytics.read | 1×1 | 2×2 | 1×1 | yes | no | yes | no | Dashboard summary → conversionRate |
| `funnel` | funnel | command-center | chart | Conversion Funnel | analytics.read | 2×2 | 4×3 | 3×2 | yes | yes | yes | no | Dashboard summary → funnelConversion |
| `commission` | kpi-card | command-center | KPI | Commission | finance.commission.read | 1×1 | 2×2 | 1×1 | yes | no | yes | no | Dashboard summary → commissionAccrued |
| `reconciliation` | alert | command-center | alert | Reconciliation | finance.reconciliation.read | 2×1 | 4×2 | 3×1 | yes | yes | no | yes | Dashboard summary → reconciliationStatus |
| `payments` | kpi-card | command-center | KPI | Payments | finance.payment.read | 1×1 | 2×2 | 1×1 | yes | no | yes | no | Dashboard summary → paymentsCaptured |
| `net-payments` | kpi-card | command-center | KPI | Net Payments | finance.payment.read | 1×1 | 2×2 | 1×1 | yes | no | yes | no | Dashboard summary → netPayments |
| `sessions` | kpi-card | command-center | KPI | Sessions | analytics.read | 1×1 | 2×2 | 1×1 | yes | no | yes | no | Dashboard summary → marketplaceSessions |
| `partners` | kpi-card | command-center | KPI | Partners | analytics.read | 1×1 | 2×2 | 1×1 | yes | no | yes | no | Dashboard summary → activePartners |
| `customers` | kpi-card | command-center | KPI | Customers | crm.customer.read | 1×1 | 2×2 | 1×1 | yes | no | yes | no | Dashboard summary → newCustomers |
| `revenue-trend` | time-series | command-center | chart | Revenue Trend | analytics.read | 2×2 | 6×4 | 3×2 | yes | yes | yes | no | Dashboard trends → revenue |
| `orders-trend` | time-series | command-center | chart | Orders Trend | analytics.read | 2×2 | 6×4 | 3×2 | yes | yes | yes | no | Dashboard trends → orders |
| `bookings-trend` | time-series | command-center | chart | Bookings Trend | analytics.read | 2×2 | 6×4 | 3×2 | yes | yes | yes | no | Dashboard trends → bookings |

### Grid System

| Field | Value |
|---|---|
| Columns | 12 (desktop), 8 (tablet), 4 (mobile) |
| Row height | 60px (fixed) |
| Widget min size | 1×1 (KPI) / 2×2 (chart) |
| Widget max size | 2×2 (KPI) / 6×4 (chart) |
| Gap | 12px |
| Responsive | Auto-flow, no overlapping, column collapse |

### Responsive Behavior

- **Desktop (≥1280px):** 12-column grid, full widget set, drag/drop enabled
- **Tablet (≥768px):** 8-column grid, widgets auto-reflow, no drag/drop
- **Mobile (<768px):** 4-column stack, widgets auto-flow, no drag/drop, no resize

## 5. Layout Hierarchy

```text
SYSTEM DEFAULT (code-defined, page registry)
    ↓
ROLE DEFAULT (optional, role → layout mapping)
    ↓
USER LAYOUT (personal overrides)
```

### System Default

Canonical layout для каждой страницы. Определяется:
- `PageRegistry.defaultWidgets` — какие widgets видны по умолчанию
- `PageRegistry.requiredWidgets` — обязательные (не удаляемые)
- Grid positions — кодовая конфигурация

### Role Default (Future)

Опциональный layout по роли:
- DIRECTOR: больше KPI, меньше operational detail
- FINANCE: financial widgets prominent
- SALES_MANAGER: sales pipeline widgets
- ANALYST: more comparison/trend widgets

Хранение: code-defined defaults (future: admin config).

### User Layout

Персональная настройка поверх system/role layout:
- добавление/скрытие widgets
- изменение порядка
- resize виджетов
- widget-specific config (period, visualization type)

## 6. Constructor Enable/Disable

### Page Policy

| Page | constructorEnabled | Reason |
|---|---|---|
| Command Center | **true** | Executive/management page, personalization value |
| Analytics Center | **true** | Power users need custom views |
| CRM | **false** | Business-critical workflow, fixed layout |
| Catalog Center | **false** | Operational form-based, no constructor value |
| Order Center | **false** | Transactional workflow |
| Booking Center | **false** | Transactional workflow |
| Settings | **false** | Security-critical |
| Partner Cabinet | **false** (future) | Partner-specific, limited customization |

### User Toggle

Даже если `constructorEnabled = true`, пользователь может:
- оставаться в **View Mode** (default, read-only)
- переключаться в **Customize Mode** (drag/drop/resize)

Toggle не меняет policy — только режим UI.

## 7. Widget Policy

### Per-Widget Properties

| Property | Description |
|---|---|
| `visible` | Show by default |
| `removable` | Can be hidden (unless `required`) |
| `movable` | Can be repositioned |
| `resizable` | Can change size |
| `required` | Always present, cannot be hidden |

### Required Widgets

Required widgets:
- всегда видны
- не могут быть удалены пользователем
- могут быть movable/resizable если policy разрешает
- восстанавливаются при invalid user config

Пример: `reconciliation` — required, потому что reconciliation status важен для compliance.

## 8. RBAC / Security

### Hard Boundary

```
RBAC ALWAYS WINS
```

Backend/API проверяют permissions для каждого widget:
- widget с `permission: "finance.payment.read"` — hidden если нет этого permission
- frontend НЕ является security boundary
- constructor НЕ может обойти partner scope

### Partner Isolation

- Partner A видит только свои widgets с данными
- Partner A не может добавить internal widget (нет permission)
- BUYER: constructor не доступен (внешняя роль)

### Saved Config Security

- `widgetId` валидируется через Widget Registry
- `pageId` валидируется через Page Registry
- `config` валидируется через `configSchema`
- Нельзя сохранить arbitrary query/SQL/route
- Partner scope resolves server-side

## 9. Persistence

### User Layout Storage

**Approach:** JSON column в существующей user settings/profile.

```
Table: UserWorkspaceLayout
- id: UUID
- userId: UUID (FK → User)
- pageId: STRING (e.g., "command-center")
- layoutVersion: INTEGER
- widgets: JSONB (positions, sizes, visibility, config)
- updatedAt: TIMESTAMP
- createdAt: TIMESTAMP
```

**Widget entry in JSON:**
```json
{
  "widgetId": "gmv",
  "x": 0, "y": 0, "w": 1, "h": 1,
  "visible": true,
  "config": {}
}
```

### Role Default Storage

**Approach:** Code-defined defaults (no DB initially).

Role defaults live in `PageRegistry`:
```ts
roleDefaults: {
  DIRECTOR: { widgets: [...], positions: {...} },
  FINANCE: { widgets: [...], positions: {...} },
}
```

Future: admin-managed config in DB if Roadmap requires.

## 10. Reset Semantics

```text
User reset → Role Default (if exists) → else System Default
```

- Reset удаляет user layout record
- Page перерендерывается с system default
- Required widgets всегда восстанавливаются

## 11. Versioning / Migration

### Layout Schema Version

Each `UserWorkspaceLayout` has `layoutVersion`.

**Migration strategy:**
1. System default has canonical version
2. User layout version checked against system version
3. If mismatch:
   - valid widgets: keep
   - removed/renamed widgets: ignore (skip with log)
   - new required widgets: add to layout
   - grid changes: reflow to valid positions
4. Page loads with safe fallback, never crashes

### Invalid / Removed Widget

If user layout contains unknown widgetId:
- widget silently ignored
- layout preserves other widgets
- telemetry logs migration issue
- no raw error to user

## 12. API Contract (Future)

Conceptual API (не реализуется в этом pass):

```
GET    /api/v1/workspace/page/:pageId          → Page definition
GET    /api/v1/workspace/page/:pageId/layout    → User layout (or default)
PUT    /api/v1/workspace/page/:pageId/layout    → Save user layout
DELETE /api/v1/workspace/page/:pageId/layout    → Reset to default
GET    /api/v1/workspace/widgets                → Widget registry (filtered by permissions)
```

### Backend Responsibility

- Validate widgetId/pageId against registries
- Enforce RBAC (filter widgets by permission)
- Persist user layout
- Resolve partner scope
- Return merged layout (system + role + user)

### Frontend Responsibility

- Render grid
- Drag/drop
- Resize
- Customize mode toggle
- Responsive behavior
- Widget rendering

## 13. Data Fetch Strategy

### Command Center (Step 3.1 existing)

```
GET /api/v1/dashboard/command-center → summary (all sections)
GET /api/v1/dashboard/command-center/trends → lazy time series
```

**Constructor preserves this pattern:**
- Page-level aggregation (Command Center summary)
- Widget visibility is frontend concern only
- Backend returns same payload regardless of visible widgets
- No per-widget API calls (no N+1 fan-out)

### Future Pages

Constructor should reuse page-level aggregation, not create per-widget data fetching.

## 14. Period / Comparison / Currency Integration

### Period Inheritance

```text
Widget inherits page-level period
```

- Global period selector (page-level)
- Widgets inherit page period by default
- Optional widget-specific period override (future, if design allows)
- Override shown in widget UI (badge: "Custom period")

### Comparison

- Page-level comparison setting
- Widgets that support comparison inherit page setting
- Comparison forwarded to Step 3.3

### Multi-Currency

- Currency-separated aggregation (Step 3.3 semantics)
- No fake combined totals
- Widget displays single currency or currency groups

## 15. Command Center Integration

### Default Layout (Step 3.2 first consumer)

**Section: Executive Summary (top row)**
```
| GMV | Revenue | Net Revenue | Orders | Bookings | AOV | Conversion |
|  1  |    2    |      3      |   4    |    5     |  6  |     7      |
```

**Section: Operational (middle)**
```
| Funnel (3×2) | Commission | Reconciliation (required) |
```

**Section: Financial (middle-right)**
```
| Payments | Net Payments |
```

**Section: Marketplace (bottom)**
```
| Sessions | Partners | Customers |
```

**Section: Trends (bottom)**
```
| Revenue Trend (3×2) | Orders Trend (3×2) | Bookings Trend (3×2) |
```

### Widget Catalog (Command Center)

21 backend KPIs → 18 widget registry entries (3 financial merged/deferred).

User can:
- add: hidden-by-default widgets (net-payments, sessions, partners, customers)
- hide: optional widgets (aov, conversion, sessions, partners)
- move: any movable widget
- resize: charts and alerts
- NOT hide: reconciliation (required)

## 16. Employee Analytics Future Support

Constructor framework is ready for:
- Employee Activity widget
- Employee KPI widget
- Team Performance widget
- SLA widget
- Workload widget

But NOT implemented now. Framework supports future page registration:
```
pageId: "employee-analytics"
constructorEnabled: true
defaultWidgets: [...]
```

## 17. Rollout Strategy

### Wave A — Constructor Foundation (future step)
- Widget Registry (code-defined)
- Page Registry (code-defined)
- Layout Hierarchy (system/role/user)
- Persistence (UserWorkspaceLayout)
- Basic grid component

### Wave B — Step 3.2 Dashboard UI (next)
- Command Center as first consumer
- Default layout rendering
- Period selector integration
- KPI cards + trends

### Wave C — Customize Mode (future)
- Drag/drop
- Resize
- Widget catalog panel
- Save/reset

### Wave D — Analytics Pages
- Analytics Center with constructor
- Time-based analytics widgets

### Wave E — Other Workspaces
- CRM, Sales, Support, etc.
- Each page gets constructor policy

## 18. Authority Gaps

| Gap | Status | Impact |
|---|---|---|
| Company timezone | Not available | Non-blocking (UTC fallback) |
| Reporting/base currency | Not available | Non-blocking (currency-separated) |
| Alert thresholds (SLA, anomaly) | Not available | Deferred (alert widgets future) |
| Role default layouts | Code-defined only | Non-blocking (system default sufficient) |
| Widget config schemas | Not defined | Non-blocking (initial widgets have no config) |
| Mobile constructor | Deferred | Non-blocking (auto-flow on mobile) |

## 19. Acceptance Criteria

Architecture is complete when:

- [x] Global mechanism defined (one constructor, not per-page)
- [x] Page enable/disable defined
- [x] Widget enable/disable defined
- [x] System/role/user hierarchy defined
- [x] RBAC hard boundary defined
- [x] Storage strategy selected
- [x] Versioning/migration strategy selected
- [x] Grid/responsive strategy selected
- [x] API contract proposed
- [x] Step 3.2 integration defined
- [x] Command Center KPI catalog defined
- [x] No blocking authority gap

## 20. Diagram: Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    TRAVELHUB PLATFORM                     │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Command Center│  │  Analytics   │  │     CRM      │  │
│  │  (Step 3.2)  │  │  (Step 3.4)  │  │  (Step 3.6)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│  ┌──────┴──────────────────┴──────────────────┴───────┐  │
│  │         WORKSPACE CONSTRUCTOR FRAMEWORK            │  │
│  │                                                    │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  │  │
│  │  │Page Registry│  │Widget Reg │  │Layout Store│  │  │
│  │  └────────────┘  └────────────┘  └────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
│                          │                              │
│  ┌───────────────────────┴──────────────────────────┐   │
│  │          STEP 3.3 ANALYTICS FOUNDATION           │   │
│  │    (read models, period, money, attribution)     │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                              │
│  ┌───────────────────────┴──────────────────────────┐   │
│  │           CANONICAL DOMAIN FACTS                 │   │
│  │   (Orders, Payments, Bookings, Commissions)      │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```
