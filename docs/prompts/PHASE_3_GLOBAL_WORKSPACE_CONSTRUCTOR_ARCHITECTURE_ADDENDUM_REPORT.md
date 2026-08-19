# PHASE 3 — GLOBAL PAGE / WORKSPACE CONSTRUCTOR — ARCHITECTURE ADDENDUM — REPORT

## 1. Executive Summary

**VERDICT A — READY FOR IMPLEMENTATION SEQUENCING**

Глобальный конструктор рабочих страниц определён как единый Workspace Constructor Framework для TravelHub. Архитектура охватывает Page Registry, Widget Registry, Layout Hierarchy (system→role→user), persistence, RBAC, grid system, versioning и Command Center Integration.

## 2. Repository State

| Item | Value |
|---|---|
| HEAD | `a33e92c` |
| Branch | `master` |
| Step 3.1 | APPROVED |
| Step 3.3 | APPROVED |
| Worktree | clean |

## 3. Selected Architecture

**Global Workspace Constructor Framework** — единый механизм для всех рабочих страниц.

```text
SYSTEM DEFAULT → ROLE DEFAULT → USER LAYOUT
```

- Page/Widget Registry: code-defined (future: admin config)
- Constructor can be enabled/disabled per page
- RBAC always wins over layout
- Frontend renders, backend validates/persists

## 4. Page Registry

| pageId | constructorEnabled | requiredWidgets | Notes |
|---|---|---|---|
| command-center | **true** | reconciliation | First consumer (Step 3.2) |
| analytics | **true** | kpi-summary | Power user page |
| crm | **false** | customer-list | Business workflow |
| catalog | **false** | product-list | Operational forms |
| orders | **false** | order-list | Transactional |
| bookings | **false** | booking-list | Transactional |
| partner/* | **false** | my-products | Partner scope |

## 5. Widget Registry

18 widgets для Command Center:

| Category | Widgets |
|---|---|
| KPI Cards | GMV, Revenue, Net Revenue, Orders, Bookings, AOV, Conversion, Commission, Payments, Net Payments, Sessions, Partners, Customers |
| Charts | Funnel |
| Time Series | Revenue Trend, Orders Trend, Bookings Trend |
| Alerts | Reconciliation (required) |

## 6. Layout Hierarchy

- **System Default:** PageRegistry.defaultWidgets + grid positions (code)
- **Role Default:** code-defined per role (future: admin config)
- **User Layout:** personal overrides (DB: UserWorkspaceLayout JSON)

## 7. Grid / Responsive

| Viewport | Columns | Drag/Drop | Resize |
|---|---|---|---|
| Desktop ≥1280px | 12 | ✅ | ✅ |
| Tablet ≥768px | 8 | ❌ | ❌ |
| Mobile <768px | 4 | ❌ | ❌ |

## 8. Persistence

**User Layout:** JSON column in `UserWorkspaceLayout` table.

```json
{
  "widgetId": "gmv",
  "x": 0, "y": 0, "w": 1, "h": 1,
  "visible": true,
  "config": {}
}
```

**Role Defaults:** code-defined in PageRegistry.

**Reset:** User → Role Default → System Default.

## 9. API Contract (Future)

```
GET    /api/v1/workspace/page/:pageId           → Page definition
GET    /api/v1/workspace/page/:pageId/layout     → User layout
PUT    /api/v1/workspace/page/:pageId/layout     → Save layout
DELETE /api/v1/workspace/page/:pageId/layout     → Reset layout
GET    /api/v1/workspace/widgets                 → Widget registry
```

## 10. RBAC / Security

- Backend validates widget permissions independently
- Constructor cannot bypass partner scope
- Saved config validated against registries
- Frontend is NOT security boundary

## 11. Command Center Integration

Step 3.2 Dashboard UI uses constructor framework:
- 18 widget registry entries from 21 backend KPIs
- Default layout: curated subset of KPIs
- Widget catalog for add/hide
- Period inherits page-level selector
- Reconciliation required (cannot be hidden)

## 12. Versioning / Migration

- `layoutVersion` field in UserWorkspaceLayout
- Invalid/removed widgets silently ignored
- New required widgets added automatically
- Grid changes reflow to valid positions
- Page never crashes on version mismatch

## 13. Data Fetch Strategy

- Page-level aggregation (existing Step 3.1 pattern)
- Backend returns full payload regardless of widget visibility
- No per-widget API calls (no N+1)
- Constructor is pure presentation layer

## 14. Step 3.2 Impact

Step 3.2 (Dashboard UI) is the **first consumer** of the constructor framework:
- Default layout rendering
- Widget grid component
- Period selector integration
- KPI cards + trend charts
- Ready for future customize mode

## 15. Roadmap Impact

The constructor addendum is a **cross-cutting architecture foundation** under Step 3.2+, not a separate step. It does not change Roadmap numbering.

## 16. Rollout Waves

| Wave | Scope |
|---|---|
| A | Constructor foundation (widget/page registry, persistence) |
| B | Step 3.2 Dashboard UI (first consumer) |
| C | Customize mode (drag/drop, resize, save) |
| D | Analytics pages |
| E | Other workspaces (CRM, Sales, etc.) |

## 17. Authority Gaps

| Gap | Status | Impact |
|---|---|---|
| Company timezone | Not available | Non-blocking (UTC fallback) |
| Reporting currency | Not available | Non-blocking (currency-separated) |
| Alert thresholds | Not available | Deferred |
| Role default layouts | Code-defined | Non-blocking |
| Mobile constructor | Deferred | Non-blocking |

## 18. Negative Checks

| Check | Value |
|---|---|
| Production backend changes | 0 |
| Production frontend changes | 0 |
| Schema changes | 0 |
| Migrations | 0 |
| New permissions | 0 |
| Step 3.1 changes | 0 |
| Step 3.3 changes | 0 |
| Step 2.17B changes | 0 |
| Dashboard UI implementation | 0 |
| Employee Analytics implementation | 0 |
| Release | 0 |

## 19. Files Changed

| File | Description |
|---|---|
| `docs/architecture/global-workspace-constructor-phase3.md` | Architecture design document |

## 20. Persistence

- `git diff --check`: PASS
- Design document saved
- No code changes (design-only pass)
- Ready for commit

## 21. Verdict

**PHASE 3 GLOBAL PAGE / WORKSPACE CONSTRUCTOR ARCHITECTURE ADDENDUM COMPLETED — READY FOR IMPLEMENTATION SEQUENCING**

## 22. NEXT

`NEXT: PHASE 3 — STEP 3.2 — DASHBOARD / COMMAND CENTER UI — DESIGN & IMPLEMENTATION`

Step 3.2 использует constructor framework как первый consumer.

## 23. Repository Evidence

| Evidence | Value |
|---|---|
| HEAD | `a33e92c` |
| Branch | `master` |
| Files changed | 1 (design document) |
| Production code changes | 0 |
| Schema changes | 0 |
