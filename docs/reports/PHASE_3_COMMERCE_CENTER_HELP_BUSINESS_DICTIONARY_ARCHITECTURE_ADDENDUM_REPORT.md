# PHASE 3 — COMMERCE CENTER HELP / BUSINESS DICTIONARY ARCHITECTURE ADDENDUM — REPORT

## Executive Summary

Сформализован Help/Business Dictionary архитектурный контракт перед Commerce UI implementation. Определена Information Architecture `/app/help`, Business Dictionary entry schema, KPI contextual help contract, Status Dictionary, formula drift prevention, workspace-aware Help security model. Зарегистрирован canonical Debt Register (`TRAVELHUB_DEBT_REGISTER.md`) с 25+ items. D8 NOT STARTED. No production implementation.

## Canonical Baseline

```
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
Commerce UI Design Contract — ACCEPTED
HELP/BUSINESS DICTIONARY CONTRACT — NOW ACCEPTED
D8 — NOT STARTED
```

## Why Help Before Commerce UI Implementation

Users cannot meaningfully interpret KPI cards, status badges, financial values, or business transitions without in-context documentation. Help must be designed alongside UI, not bolted on after.

## Help vs Support

```
СЕРВИС
├── Поддержка (tickets, incidents, contact flow)
└── Помощь (business dictionary, KPI explanations, formulas, status definitions)
```

Not merged. Different purposes, different routes, different content models.

## Help Center Information Architecture

```
/app/help
├── Начало работы
├── Command Center (KPI definitions)
├── Заявки (statuses, KPI, timeline, Request→Order)
├── Заказы (statuses, KPI, finance, Order→Booking)
├── Бронирования (statuses, KPI, lifecycle)
├── Финансы (Payment/Refund status, GMV, Revenue, formulas)
├── CRM
├── Маркетинг
├── Продукты
├── Роли и права
└── Бизнес-словарь (status dictionary, formula reference)
```

## Business Dictionary Entry Schema

For each KPI/metric/status:
- ID (stable, non-localized)
- Display Name (localized)
- Business Definition
- Purpose
- Source (DB table/column or aggregation)
- Scope (which entities included)
- Formula (canonical, backend-derived)
- Period semantics
- Comparison period
- Currency/Unit
- Status Mapping
- Inclusions/Exclusions
- Overlap Rule
- Reconciliation Rule
- Drill-down filter
- Related Metrics
- Workspace Availability
- Localization Keys

## KPI Contextual Help (ⓘ)

Every KPI card supports:
```
┌──────────────────────┐
│ GMV               ⓘ  │
│ 125 430 ₼            │
└──────────────────────┘
```

Tooltip: short definition + formula + period + "Подробнее →"
Full Help: complete definition + source + scope + inclusions/exclusions + examples

Stable topic ID strategy: `/app/help?topic=<id>` (query param, compatible with existing routing)

## Orders KPI Help Reconciliation

| KPI | Status Mapping | Overlap |
|---|---|---|
| Всего заказов | ALL | Total (exclusive) |
| Активные | NEW, IN_PROCESSING, WAITING_FOR_DATA, READY_FOR_BOOKING, SENT_TO_BOOKING | Subset of total |
| Готовы к бронированию | READY_FOR_BOOKING | Subset of Активные (overlap documented) |
| Закрыто/отменено | CLOSED, CANCELLED | Subset of total |

Missing states classified: PARTIALLY_FULFILLED, FULFILLED, READY_FOR_CLOSURE, PROBLEM, SUSPENDED — currently filter-only, not separate KPI cards.

## Bookings KPI Help Reconciliation

| KPI | Status Mapping | Issue |
|---|---|---|
| Ожидание | SENT_TO_SUPPLIER, AWAITING_CONFIRMATION | Clean |
| Подтверждено | CONFIRMED, IN_SERVICE, COMPLETED | Groups semantically different stages |
| Отменено | CANCELLED, SUPPLIER_REJECTED | Clean |

CONFIRMED/IN_SERVICE/COMPLETED ambiguity: recommended to split or document overlap explicitly.

## Status Dictionary

Three independent status domains documented:
- **Lifecycle Status**: Request (NEW→CHECKING→...→CONVERTED), Order (NEW→IN_PROCESSING→...→CLOSED), Booking (CREATED→CONFIRMED→IN_SERVICE→COMPLETED)
- **Payment Status**: UNPAID, PARTIALLY_PAID, PAID, REFUNDED
- **Refund Status**: REQUESTED, APPROVED, PROCESSED, FAILED

Each status: display label, business meaning, entry conditions, next states, terminal flag, financial implication, "not to confuse with".

## D7 Financial Formulas Preserved

```
dueAmount       = max(0, totalAmount - paidAmount)
refundableAmount = max(0, paidAmount - refundedAmount)
```

Backend-authoritative via Prisma.Decimal. Help documents these formulas identically.

## Formula Drift Prevention

Stable metric IDs link Help definitions to backend calculations. Recommended: automated contract test that verifies Help formula text matches backend computation, or review gate requiring explicit owner sign-off when formula changes.

## Help Security Model

- Frontend hiding ≠ authorization
- Help route visibility does not imply permission
- Help deep links must not leak sensitive tenant/business data
- Dynamic examples must not contain real PII/PAN/CVV/tokens/secrets
- Static business definitions can be broadly visible

## Workspace-Aware Help

Help navigation reflects available capabilities per workspace:
- Platform: full documentation
- Partner: partner-relevant sections only
- Storefront Pro: Pro-specific features documented only if entitlement active

This is UX visibility contract, not backend security replacement.

## Request Action Authority Gap (SEC-UI-01)

Registered as P1 SECURITY debt:
- Request actions are currently frontend-gated
- Must become server-authoritative before Request detail migration
- Do not wrap frontend-derived actions in `<EntityActionBar />`

## Localization Contract

Help supports RU/AZ/EN:
- Stable topic IDs (non-localized)
- Localized title, definition, formula explanation, status labels, examples
- Formula semantics identical across languages
- Display labels never used as stable IDs

## Help Content Source of Truth

Recommended: **Shared typed registry** (TypeScript interfaces for HelpEntry/MetricDefinition/StatusDefinition) with:
- Single source of truth
- Type safety
- Localization via i18n keys
- Versionability
- Testability
- Deep link support

Formula definitions should be co-located with backend calculation code where possible, with Help text referencing stable metric IDs.

## Reusable Help Components

| Component | Purpose |
|---|---|
| `<HelpCenter />` | Full Help page with navigation |
| `<HelpNavigation />` | Left sidebar categories |
| `<HelpSearch />` | Full-text search across entries |
| `<HelpTopic />` | Individual topic renderer |
| `<HelpMetricDefinition />` | KPI/metric definition card |
| `<HelpStatusDefinition />` | Status definition card |
| `<MetricHelpTrigger />` | ⓘ icon on KPI cards |
| `<MetricHelpPopover />` | Tooltip/popover content |

## Debt Register Summary

25+ items registered in `TRAVELHUB_DEBT_REGISTER.md`:

| Category | Count | NOW | NEXT | LATER | DEFERRED |
|---|---|---|---|---|---|
| SECURITY | 2 | 0 | 1 | 1 | 0 |
| UX CONSISTENCY | 6 | 0 | 4 | 1 | 0 |
| DATA/SEMANTIC | 3 | 0 | 2 | 1 | 0 |
| DOCUMENTATION/HELP | 6 | 0 | 2 | 2 | 0 |
| DEFERRED PRODUCT | 5 | 0 | 0 | 0 | 5 |
| PERFORMANCE | 2 | 0 | 0 | 2 | 0 |

## Debt Priority / Sequencing

**NOW** (blocking current phase):
- SEC-UI-01: Request server-authoritative actions (before Request migration)

**NEXT** (before next release):
- UI-01..UI-08: Commerce UI consistency (UI-C1 through UI-C11)
- HELP-01..HELP-02: Help menu + /app/help (UI-C12)

**LATER** (before Phase 3 completion):
- HELP-03..HELP-06: Contextual help, formulas, workspace-aware
- UI-09: Responsive/polish
- SEC-TENANT-01: Context-aware UI
- PERF-01..PERF-02: Performance gates

**DEFERRED** (future phase):
- FIN-01..FIN-03: Finance Center, PSP, Payout
- SUB-01..SUB-03: Storefront subscriptions

## Implementation Phasing (Updated)

```
UI-C1:  Shared shell + PageHeader + StatusBadge
UI-C2:  Help metadata/topic foundation
UI-C3:  Contextual KPI help foundation (ⓘ)
UI-C4:  Commerce Relation Chain
UI-C5:  Business Timeline extraction
UI-C6:  Audit History unification
UI-C7:  Request migration + server-authoritative actions
UI-C8:  Order migration
UI-C9:  Booking migration
UI-C10: Orders KPI implementation + Help
UI-C11: Bookings KPI implementation + Help
UI-C12: Help Center /app/help
UI-C13: Card/spacing/responsive/loading/error polish
UI-C14: Security/regression/browser qualification
UI-C15: Git hard closure
```

## Help Acceptance Matrix

| Gate | Result | Evidence |
|---|---|---|
| Help distinct from Support | ✅ | Two separate concerns defined |
| Left-menu Help placement | ✅ | Under СЕРВИС |
| /app/help architecture | ✅ | IA defined |
| Stable topic ID strategy | ✅ | Query param `/app/help?topic=<id>` |
| Business Dictionary schema | ✅ | 15+ field schema |
| KPI contextual ⓘ contract | ✅ | Tooltip + full help pattern |
| Tooltip vs Full Help | ✅ | Short vs complete separated |
| Orders KPI Help reconciled | ✅ | 4 KPIs with overlap documented |
| Missing Orders states classified | ✅ | 5 states → filter-only |
| Bookings KPI Help reconciled | ✅ | 3 KPIs with grouping noted |
| CONFIRMED/IN_SERVICE/COMPLETED resolved | ✅ | Documented as overlap, split recommended |
| Lifecycle status dictionary | ✅ | All 3 entity lifecycles |
| Payment status dictionary | ✅ | 4 statuses |
| Refund status dictionary | ✅ | 4 statuses |
| Request→Order→Booking topic | ✅ | Chain explanation defined |
| Timeline vs Audit topic | ✅ | Two distinct concepts |
| D7 financial formulas preserved | ✅ | dueAmount, refundableAmount |
| Period semantics defined | ✅ | [from, to) interval |
| Comparison semantics defined | ✅ | Previous comparable period |
| Drill-down contract defined | ✅ | KPI → filter → registry |
| Reconciliation rules defined | ✅ | KPI count = same filter |
| Workspace-aware Help | ✅ | Platform vs Partner |
| Entitlement-aware Help | ✅ | Basic vs Pro |
| Help security model | ✅ | No PII/secrets in examples |
| Cross-context 404 preserved | ✅ | D5/D6 isolation unchanged |
| Request action authority gap | ✅ | SEC-UI-01 registered P1 |
| RU localization | ✅ | Contract defined |
| AZ localization | ✅ | Contract defined |
| EN localization | ✅ | Contract defined |
| Search/discovery | ✅ | Name + synonyms + entity + KPI |
| Help content source-of-truth | ✅ | Typed registry recommended |
| Formula drift prevention | ✅ | Stable IDs + contract test |
| Reusable Help components | ✅ | 8 components |
| No production implementation | ✅ | Design only |
| D8 not started | ✅ | — |
| Debt Register created | ✅ | TRAVELHUB_DEBT_REGISTER.md |

## Final Verdict

```
VERDICT A — HELP / BUSINESS DICTIONARY ARCHITECTURE ADDENDUM PASSED

COMMERCE UI DESIGN CONTRACT — ACCEPTED
HELP / BUSINESS DICTIONARY CONTRACT — ACCEPTED
DEBT REGISTER — ESTABLISHED

FINAL SHA: (pending commit)

TRUE NEXT:
PHASE 3 — COMMERCE CENTER UI CONSISTENCY — IMPLEMENTATION

D8 — NOT STARTED
```
