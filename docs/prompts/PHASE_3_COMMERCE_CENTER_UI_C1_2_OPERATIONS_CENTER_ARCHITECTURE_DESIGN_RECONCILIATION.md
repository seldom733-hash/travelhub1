# PHASE 3 — COMMERCE CENTER UI-C1.2
## OPERATIONS CENTER — ARCHITECTURE & DESIGN RECONCILIATION

### DESIGN / ARCHITECTURE PROMPT
### NO PRODUCTION IMPLEMENTATION IN THIS STEP

---

# 0. EXECUTION MODE

Выполнить **только UI-C1.2 — OPERATIONS CENTER — ARCHITECTURE & DESIGN RECONCILIATION**.

Это **design / architecture reconciliation stage**.

НЕ выполнять production implementation.

Цель этапа — определить и зафиксировать canonical architecture, visual system, navigation model, KPI grouping model, Payments integration model, period/filter semantics, RBAC/entitlement behavior и implementation phasing для будущего единого Operations Center.

---

# 1. CANONICAL BASELINE

Считать принятыми:

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED AFTER R3
```

UI-C1.1 R3 acceptance SHA:

```text
7a722bd2c5e6c54033b6e1bccd3b57d5c76cbe35
```

Следующие этапы:

```text
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

UI-C1.2 выполняется ПЕРЕД UI-C2.

---

# 2. CORE PRODUCT DECISION

TravelHub должен иметь единый визуальный рабочий центр:

```text
ЦЕНТР ОПЕРАЦИЙ

[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]
```

Но **не** как одна длинная страница, где четыре реестра идут вертикально друг под другом.

Canonical rule:

```text
ONE OPERATIONS CENTER SHELL
+
ONE ACTIVE DOMAIN TAB
```

Одновременно отображается контент только активной вкладки.

---

# 3. SIDEBAR OWNERSHIP

Левое меню сохраняет доменную принадлежность разделов.

Canonical sidebar:

```text
ОПЕРАЦИИ
├── Заявки
├── Заказы
└── Бронирования

ФИНАНСЫ
└── Платежи
```

При этом все четыре раздела используют общий Operations Center shell.

Canonical ownership rule:

```text
DOMAIN OWNERSHIP ≠ WORKFLOW CONTEXT
```

То есть:

```text
Платежи:
DOMAIN OWNERSHIP = FINANCE
WORKFLOW CONTEXT = OPERATIONS CENTER
```

---

# 4. CANONICAL URL / DEEP LINK MODEL

Не ломать существующие canonical URLs без веской архитектурной причины.

Preferred target:

```text
/app/requests
/app/orders
/app/bookings
/app/payments
```

Каждый route рендерит общий Operations Center shell с соответствующей active tab.

Пример:

```text
/app/orders
→ Operations Center
→ active tab = Заказы
```

```text
/app/payments
→ Operations Center
→ active tab = Платежи
```

Не использовать только один URL вида:

```text
/app/operations?tab=...
```

как единственный canonical route, если это ломает:

- deep links;
- browser history;
- direct navigation;
- permission-aware routing;
- tests;
- existing bookmarks;
- canonical entity navigation.

Query-param tab может быть рассмотрен только как secondary UX mechanism, но не как единственный route contract без явного ADR.

---

# 5. TARGET OPERATIONS CENTER SHELL

Canonical page structure:

```text
┌──────────────────────────────────────────────────────────────┐
│ Breadcrumbs                                                  │
│ ЦЕНТР ОПЕРАЦИЙ                            Period / Actions    │
│                                                              │
│ [ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]          │
├──────────────────────────────────────────────────────────────┤
│ ACTIVE DOMAIN KPI AREA                                       │
│                                                              │
│ ATTENTION / EXCEPTION AREA (where applicable)                │
│                                                              │
│ Search | Filters | Date scope | Reset | Export               │
│                                                              │
│ Result summary / selection tools (if applicable)             │
│                                                              │
│ Registry table                                               │
│                                                              │
│ Pagination                                                   │
└──────────────────────────────────────────────────────────────┘
```

Shared shell must own:

- page max-width;
- page header geometry;
- tabs;
- KPI zone geometry;
- group spacing;
- toolbar geometry;
- search placement;
- filters layout;
- period/date control placement;
- export action placement;
- table container;
- loading state;
- empty state;
- error state;
- pagination area;
- responsive behavior.

Business domains provide their own data/configuration.

---

# 6. UNIFICATION PRINCIPLE

```text
UNIFIED STRUCTURE
≠
IDENTICAL BUSINESS CONTENT
```

Operations Center should NOT force:

- Requests to behave like Orders;
- Orders to behave like Bookings;
- Payments to inherit Order lifecycle;
- identical KPI sets;
- identical filters;
- identical table columns.

The shared shell defines **visual and interaction grammar**.

Each domain defines **business semantics**.

---

# 7. TAB MODEL

Canonical tabs:

```text
Заявки
Заказы
Бронирования
Платежи
```

Requirements:

1. Active tab must match current canonical route.
2. Tab switching must navigate to canonical route.
3. Browser Back/Forward must work.
4. Direct URL opening must select correct tab.
5. Tabs must be permission-aware.
6. Hidden tab is NOT a security boundary.
7. Server access remains authoritative.
8. Tab labels RU/AZ/EN.
9. Keyboard accessible.
10. Clear active state.
11. No fake unavailable domain.
12. If user lacks access to a tab, do not render it.
13. Direct URL must still be server-protected.

---

# 8. SIDEBAR ↔ TAB SYNCHRONIZATION

Required behavior:

```text
Sidebar → Заявки
= /app/requests
= Operations Center / active Requests tab

Sidebar → Заказы
= /app/orders
= Operations Center / active Orders tab

Sidebar → Бронирования
= /app/bookings
= Operations Center / active Bookings tab

Sidebar → Финансы → Платежи
= /app/payments
= Operations Center / active Payments tab
```

Active sidebar item must reflect **domain ownership**, not shell name.

Example:

```text
/app/payments
```

must highlight:

```text
ФИНАНСЫ
└── Платежи
```

not an invented new sidebar item `Центр операций`.

---

# 9. KPI SYSTEM — CORE DESIGN DECISION

Do NOT model KPI as one flat endless grid.

Canonical KPI system:

```text
OperationsKpiOverview
├── Total KPI
├── Semantic KPI Group(s)
└── Attention / Exception Group(s)
```

Shared primitives can be conceptualized as:

```text
<OperationsKpiOverview>
  <OperationsTotalKpi />
  <OperationsKpiGroup />
  <OperationsAttentionGroup />
</OperationsKpiOverview>
```

Names are illustrative; this stage is design/architecture, not implementation.

---

# 10. TOTAL KPI CONTRACT

Existing accepted Total labels:

```text
Requests  → Всего заявок
Orders    → Всего заказов
Bookings  → Всего бронирований
```

Payments needs canonical total wording to be derived from actual domain semantics.

Do not invent without source audit.

Total card visual contract:

```text
- same visual language as ordinary KPI cards
- NOT full-width
- approximately 15–20% larger than ordinary KPI
- slightly larger label/value typography
- visually prominent but compact
```

This is an already accepted UI rule and must be preserved.

---

# 11. REQUESTS KPI ARCHITECTURE

Requests are NOT required to use lifecycle arrows if their state model is not truly sequential.

Preferred architecture:

```text
TOTAL
[ Всего заявок ]

STATUS OVERVIEW
[ status cards based on actual canonical Request statuses ]

ATTENTION
[ actionable subsets requiring operator attention ]
```

Important:

- all actual statuses must remain represented;
- labels must come from canonical localized status mapping;
- no raw enums;
- Attention can repeat a status or subset only if its purpose changes from overview to action queue;
- clicking KPI/attention should drill/filter server-side.

Do not invent current Request status list; audit actual backend source of truth.

---

# 12. ORDERS KPI ARCHITECTURE — P0 DESIGN REQUIREMENT

Orders must NOT be rendered as one flat grid.

Use semantic separation.

Canonical concept:

```text
TOTAL
[ Всего заказов ]


ЖИЗНЕННЫЙ ЦИКЛ ЗАКАЗА

[ A ] → [ B ] → [ C ] → [ D ] → ...


ПРОБЛЕМНЫЕ / EXCEPTION STATES

[ ... ] [ ... ] [ ... ]


СТАТУСЫ ОПЛАТЫ

[ ... ] [ ... ] [ ... ] [ ... ]
```

The lifecycle cards may use a visual connected-flow treatment inspired by the approved reference:

```text
[ State 1 ] → [ State 2 ] → [ State 3 ] → ...
```

But:

- do not copy non-canonical status names;
- inspect actual Order status enum/state machine;
- only truly sequential lifecycle states belong in lifecycle flow;
- terminal/exception states may need separate group;
- exact grouping must be justified by backend state semantics.

---

# 13. ORDER PAYMENT STATUS KPI GROUP

Orders must have a separate payment-status KPI group.

Important:

```text
ORDER LIFECYCLE STATUS
≠
PAYMENT STATUS
≠
REFUND STATUS
```

Do not collapse dimensions.

Audit actual backend/payment enums and determine:

- actual payment statuses;
- actual refund states or semantics;
- whether refund is a payment status, separate dimension, or derived aggregate;
- whether payment method is a type and not a status.

No UI-invented status dimension.

---

# 14. BOOKINGS KPI ARCHITECTURE

Booking canonical status machine contains multiple lifecycle and exception states.

Known canonical Booking statuses:

```text
NEW
PREPARING_REQUEST
SENT_TO_SUPPLIER
AWAITING_CONFIRMATION
CONFIRMED
IN_SERVICE
COMPLETED
NEEDS_CLARIFICATION
SUPPLIER_REJECTED
CHANGE_REQUESTED
CANCELLATION_REQUESTED
CANCELLED
PROBLEM
```

Canonical design should classify them semantically.

Possible high-level grouping to reconcile:

```text
TOTAL

LIFECYCLE FLOW
- normal forward process states

ATTENTION / EXCEPTIONS
- clarification/change/cancellation/problem states

TERMINAL EXCEPTIONS
- supplier rejected / cancelled if business semantics justify separate grouping
```

Do not automatically classify every non-happy-path state as “Требует внимания”.

Example:

```text
CANCELLED
```

is terminal, but may not require action.

The design report must provide a justified classification for every Booking status.

---

# 15. PAYMENTS TAB — DOMAIN RECONCILIATION BEFORE DESIGN

Payments is a new Operations Center tab but belongs to Finance in sidebar.

Do NOT design the Payments tab from assumptions.

First audit the existing implementation/domain:

```text
Payment entity
PaymentStatus enum
Payment method/type
Refund model/entity
Refund status
StripeEvent
Payment ↔ Order relation
Booking ↔ Order ↔ Payment relationship
payment audit/history
payment permissions
workspace/tenant scoping
existing finance read models
D7 amount authority
```

Report actual findings before proposing final UI.

---

# 16. PAYMENTS DOMAIN OWNERSHIP

Canonical high-level rule:

```text
Order
├── Payment(s)
├── Refund(s)
└── Booking(s)
```

D7 authority must remain intact:

```text
Order = canonical financial truth for commerce totals
Booking = linked Order financial truth
```

Do not redesign D7 in UI-C1.2.

Payments Center should operate on actual payment/refund records or authoritative financial operations, not duplicate Order rows unless the current backend model genuinely only supports order-level payment state.

This stage must explicitly determine the correct aggregate.

---

# 17. PAYMENTS VS FINANCE / ANALYTICS

Must remain distinct.

```text
OPERATIONS CENTER / PAYMENTS

answers:
"What is happening with this concrete payment/refund?"
```

Possible operational surfaces:

- payment record;
- order reference;
- client;
- amount;
- payment state;
- refund state;
- payment method;
- transaction timestamps;
- operational exceptions;
- allowed actions;
- audit/history.

Versus:

```text
FINANCE / ANALYTICS

answers:
"What is happening with the business finances overall?"
```

Examples:

- GMV;
- TravelHub Revenue;
- Commission;
- Take Rate;
- Provider Payables;
- Payouts;
- Provider Fees;
- reconciliation;
- financial trends.

Do not turn Payments tab into a duplicate Finance Analytics page.

---

# 18. PAYMENT KPI DESIGN — ONLY AFTER DOMAIN AUDIT

Potential structure:

```text
TOTAL

PAYMENT STATES
[ ... ]

REFUND STATES
[ ... ]

ATTENTION / FAILURES
[ ... ]
```

But exact cards must come from source-of-truth.

Do NOT invent:

```text
UNPAID
PARTIALLY_PAID
PAID
REFUNDED
FAILED
```

unless these are proven by actual backend model.

If some values are derived aggregates rather than enums, report that explicitly.

---

# 19. ATTENTION BLOCK

Operations Center may include a reusable attention pattern.

Canonical behavior:

```text
ATTENTION
= actionable operational queue
≠ decorative KPI group
```

Requirements:

- server-authoritative;
- clickable;
- filters/drills registry;
- clear reason;
- clear count;
- no client-only derived stale counts;
- entitlement/RBAC aware.

Examples to validate against actual state models:

Requests:
- supplier timeout;
- waiting decision;
- review;
- payment timeout.

Orders:
- problem;
- suspended;
- waiting data;
- unpaid;
- refund required.

Bookings:
- awaiting supplier;
- needs clarification;
- change requested;
- cancellation requested;
- problem.

Payments:
- failed payment;
- failed refund;
- unresolved discrepancy;
- manual review.

These are examples only. Final report must separate:
- actual supported conditions;
- future ideas;
- rejected assumptions.

---

# 20. KPI CLICK / DRILL-DOWN CONTRACT

Every interactive KPI should have explicit behavior.

Canonical:

```text
KPI click
→ reset page = 1
→ apply server-side filter
→ refresh table
→ refresh KPI scope if filter semantics require
→ URL state if architecture chooses canonical query params
```

No client-side fake filtering.

Selected KPI state must be visible.

"Total" should clear corresponding status filter/group filter.

---

# 21. SEARCH CONTRACT

Canonical toolbar order:

```text
[ Search ]
[ Primary status filter ]
[ Additional filters ]
[ Date type ]
[ From ]
[ To ]
[ Reset ]
[ Export ]
```

Exact controls depend on tab.

Search:

- first in toolbar;
- server-side;
- debounce approximately 300–400ms;
- Enter may trigger immediate query;
- typing must not be blocked by loading;
- clearing resets page 1;
- changing search resets page 1;
- no explicit Search button required;
- preserve backend semantics.

Audit actual server search capabilities for each domain.

---

# 22. PERIOD / DATE FILTER ARCHITECTURE

Do NOT put three permanent date ranges on a page.

Preferred UX:

```text
[ Date type ▼ ] [ From ] [ To ]
```

if multiple backend-supported date dimensions exist.

For each tab, audit actual backend date semantics.

Examples:

Requests may have:
- createdAt;
- service date;
- SLA deadline.

Orders may have:
- createdAt;
- other actual lifecycle dates.

Bookings may have:
- createdAt;
- service date.

Payments may have:
- createdAt;
- paidAt;
- refundedAt.

Do not expose a Date type unless backend query semantics exist or are deliberately included in future implementation scope.

---

# 23. KPI / TABLE PERIOD CONSISTENCY — P0

Canonical rule:

```text
FILTER / PERIOD
      ↓
SAME BACKEND QUERY SCOPE
   ↙             ↘
 KPI            TABLE
```

KPI and table must share exactly the same active scope.

No stale KPI.

No client-side counting.

No date filter on table if KPI remains global.

Known current debt:

```text
Requests list supports date range
Requests KPI endpoint remains global
```

UI-C1.2 report must decide whether:

A. period remains hidden on Requests until backend KPI scope is extended;
or
B. backend KPI scope extension becomes a prerequisite implementation item.

Do not silently expose inconsistent period behavior.

---

# 24. FILTER STATE / TAB SWITCHING

Design and document whether filters persist when switching tabs.

Recommended principle:

```text
Tab-specific filters remain tab-specific.
```

Do not carry incompatible status filters across domains.

Potential shared state:

- date range, only if semantics remain explicit;
- search, usually reset unless business reason exists.

If date range persists between tabs, date type semantics must remain visible and unambiguous.

Report chosen contract.

---

# 25. TABLE DESIGN SYSTEM

Shared registry table grammar:

- table header;
- row density;
- row hover;
- ref/id style;
- primary/secondary text;
- status badge placement;
- money formatting;
- date formatting;
- empty cells;
- action cells;
- sticky behavior if any;
- pagination;
- loading skeleton;
- empty state;
- error state.

But columns remain domain-specific.

---

# 26. REQUEST TABLE — DESIGN AUDIT

Audit current Request table.

Document:

- columns;
- search fields;
- status filters;
- date fields;
- price fields;
- supplier/client fields;
- relation links;
- export behavior.

Pricing note:

Current Request UI includes fields such as:

```text
Цена витрины
Подтв. цена
```

Do NOT redesign these in UI-C1.2.

A future separate pricing/commission reconciliation is needed before changing semantics.

---

# 27. ORDER TABLE — DESIGN AUDIT

Audit current Order registry and classify:

- reference;
- client;
- seller/partner;
- lifecycle status;
- payment status;
- amount;
- created/service date;
- booking relation;
- actions;
- current quick-preview behavior.

If quick-preview exists, determine whether it fits the future Operations Center design or should be removed/refactored later.

No implementation now.

---

# 28. BOOKING TABLE — DESIGN AUDIT

Audit:

- booking reference;
- linked order;
- service/provider;
- service date;
- lifecycle status;
- financial/payment status presentation;
- passengers/travelers;
- actions;
- search/filter capabilities.

Ensure Booking financial display does not create a new financial authority independent of linked Order.

---

# 29. PAYMENTS TABLE — DESIGN PROPOSAL AFTER AUDIT

Only after actual backend audit.

Possible columns, subject to source support:

```text
Payment reference
Date
Order
Client
Amount
Paid
Refunded
Due / refundable where semantically valid
Payment method
Payment status
Refund status
Operational action
```

Must mark each proposed column as one of:

```text
EXISTING SOURCE
DERIVED SERVER-SIDE
REQUIRES BACKEND WORK
REJECTED
```

---

# 30. PAYMENTS DETAIL / NAVIGATION QUESTION

UI-C1.2 must decide architecture for payment drill-down:

Options to evaluate:

```text
A. Dedicated /app/payments/[id]
B. Order Detail finance/payment sub-section
C. Drawer/preview from Payments registry
D. Hybrid
```

Do not implement.

Evaluate against:

- auditability;
- transaction history;
- refund operations;
- RBAC;
- deep links;
- operational workflow;
- relation to Order;
- D7;
- future finance reconciliation.

Provide recommended target.

---

# 31. HELP / BUSINESS DICTIONARY INTEGRATION

Preserve accepted Help architecture.

KPI cards/statuses should support contextual Help.

Canonical metadata authority:

```text
BACKEND DOMAIN/QUERY SERVICES
= business calculation authority

SHARED TYPED METRIC/HELP REGISTRY
= metric/status metadata authority

i18n
= localized presentation text authority

HELP UI / KPI POPOVER
= consumers only
```

For each KPI/status group, define stable topic/metric IDs.

No independent frontend formulas.

---

# 32. STATUS NAMING

Canonical rule:

```text
one status
→ one canonical localized label
```

The same status label must be used in:

- KPI card;
- filter;
- table badge;
- detail badge;
- Help;
- export where applicable.

No raw enum leakage.

No alternative synonyms per surface without explicit UX rationale.

---

# 33. VISUAL KPI GROUPING

The reference concept uses grouping as a visual hierarchy.

Operations Center should evaluate a reusable pattern:

```text
KPI OVERVIEW

TOTAL

GROUP TITLE
[ card ][ card ][ card ]

GROUP TITLE
[ card ][ card ]

ATTENTION
[ actionable card ][ actionable card ]
```

For Orders lifecycle, evaluate connected flow-card geometry.

Important:

```text
same design language
≠ identical card shape for every semantic group
```

A lifecycle-flow card can differ from ordinary status KPI while preserving tokens:

- typography;
- border/radius family;
- spacing;
- interaction;
- selected state;
- help affordance.

---

# 34. ORDER LIFECYCLE FLOW DESIGN

Design/architecture report must answer:

1. Which actual Order statuses are linear forward lifecycle?
2. Which are terminal?
3. Which are exception/problem states?
4. Which can transition back?
5. Is a strictly left-to-right arrow representation truthful?
6. If state machine is not purely linear, should arrows show "primary happy path" only?
7. How are counts displayed?
8. What happens on narrow screens?
9. How is selected filter state shown?
10. How does Help explain each state?

Do not force a misleading linear model if the backend state machine is branching.

---

# 35. BOOKING LIFECYCLE FLOW DESIGN

Apply the same analysis to Booking.

Known state machine is branching.

Therefore report must determine whether to show:

A. main happy-path flow + exception groups;
B. grouped status cards without arrows;
C. hybrid.

Do not visually imply impossible transitions.

---

# 36. OPERATIONS CENTER RESPONSIVE CONTRACT

Desktop:

```text
Tabs
KPI groups
Attention
Toolbar
Table
Pagination
```

Tablet:

- tabs scroll or wrap in controlled manner;
- KPI groups adapt;
- toolbar wraps predictably;
- table remains usable.

Mobile:

- tabs horizontally scrollable or compact;
- KPI groups stack;
- filters use responsive panel/sheet if needed;
- no horizontal page overflow;
- table strategy explicitly defined.

Design report must recommend a mobile registry pattern:
- responsive table;
- horizontal table scroll;
- cards;
- hybrid.

No implementation.

---

# 37. LOADING / EMPTY / ERROR STATES

Operations Center shell must define canonical states.

Loading:
- do not block search typing unnecessarily;
- preserve toolbar;
- skeleton or progressive table loading.

Empty:
- explain whether no data exists vs current filters returned zero results;
- clear/reset action.

Error:
- retry action;
- do not leak sensitive backend details.

Permission denied:
- follow canonical 403/404 semantics depending on context.

---

# 38. SECURITY / AUTHORITY

Must preserve:

```text
server-side RBAC
workspace isolation
tenant isolation
404-like wrong-context behavior
D5 Order action authority
D6 Booking action authority
D7 finance authority
audit immutability
```

Client-hidden tabs/buttons are not a security boundary.

Wrong tenant/workspace/business context:

```text
NOT FOUND / no existence leakage
```

403 only where existence is intentionally knowable under canonical policy.

---

# 39. ENTITLEMENTS / WORKSPACE CONTEXT

Respect canonical hierarchy:

```text
IDENTITY
→ WORKSPACE CONTEXT
→ TENANT / PARTNER SCOPE
→ PLAN / ENTITLEMENTS
→ BUSINESS CAPABILITIES
→ ROLE / PERMISSIONS
```

Operations Center tab visibility must be derived from actual capabilities.

Do not assume every role sees all four tabs.

Examples only:

```text
Operator:
Requests / Orders / Bookings

Finance:
Orders / Payments

Admin:
all authorized tabs
```

Final report must derive from actual permission model.

---

# 40. PLATFORM VS PARTNER

UI-C1.2 report must audit whether Operations Center applies to:

```text
PLATFORM
PARTNER Marketplace Basic
PARTNER Storefront Pro
```

Do not assume identical capabilities.

Need matrix:

| Capability | PLATFORM | Marketplace Basic | Storefront Pro |
|---|---|---|---|
| Requests | | | |
| Orders | | | |
| Bookings | | | |
| Payments | | | |

State:

```text
VISIBLE
HIDDEN
READ-ONLY
NOT APPLICABLE
REQUIRES BACKEND/ENTITLEMENT WORK
```

---

# 41. PAYMENT ACCESS / PII / PCI

Payments design must explicitly address:

- no raw card PAN;
- no CVV;
- safe payment method display;
- provider transaction IDs;
- masking;
- PII exposure;
- audit access;
- refund action permissions;
- finance-role restrictions.

Do not expose sensitive gateway payloads.

---

# 42. EXPORTS

Audit existing CSV/XLSX support per domain.

Shared action placement may be unified, but backend behavior remains domain-specific.

Report:

| Tab | CSV | XLSX | Backend filter parity | Permission | Notes |
|---|---|---|---|---|---|

Export must respect active filters and tenant/workspace scope.

---

# 43. URL FILTER STATE

Evaluate query-param state for:

- search;
- status;
- date type;
- date from/to;
- page;
- sort.

Benefits:

- deep links;
- browser back;
- reproducibility;
- Help links.

But do not force if current router architecture makes this unsafe.

Make an explicit design decision.

---

# 44. PERFORMANCE

Operations Center should not load four registries at once.

Canonical rule:

```text
ONLY ACTIVE TAB FETCHES ACTIVE DOMAIN DATA
```

Do not prefetch huge KPI/table payloads for all tabs unless justified.

Define:

- loading behavior;
- cache behavior;
- request cancellation on tab switch;
- pagination;
- search debounce;
- KPI/table query consolidation where possible.

---

# 45. ANALYTICS / TELEMETRY

Design optional product telemetry for Operations Center itself:

- tab opened;
- KPI clicked;
- filter applied;
- attention item opened;
- export triggered.

Do not mix product telemetry with business KPI authority.

No implementation required.

---

# 46. ACCESSIBILITY

Design must include:

- tabs with correct ARIA semantics;
- keyboard left/right navigation if using tablist;
- visible focus;
- KPI cards as buttons/links if interactive;
- non-color-only status meaning;
- accessible table;
- filter labels;
- responsive focus order;
- screen reader-friendly counts.

---

# 47. OPERATIONS CENTER COMPONENT ARCHITECTURE

Propose reusable component architecture.

Illustrative:

```text
OperationsCenterShell
OperationsCenterHeader
OperationsCenterTabs
OperationsKpiOverview
OperationsTotalKpi
OperationsKpiGroup
OperationsLifecycleFlow
OperationsAttentionGroup
OperationsToolbar
OperationsSearch
OperationsFilterGroup
OperationsPeriodFilter
OperationsRegistryTable
OperationsPagination
OperationsLoadingState
OperationsEmptyState
OperationsErrorState
```

Domain adapters/config:

```text
RequestsOperationsConfig
OrdersOperationsConfig
BookingsOperationsConfig
PaymentsOperationsConfig
```

No production code in UI-C1.2.

---

# 48. PAYMENT DOMAIN GAP MATRIX

Mandatory.

Produce:

| Requirement | Existing backend support | Source | Gap | Proposed stage |
|---|---|---|---|---|
| Payment registry | | | | |
| Payment detail | | | | |
| Payment statuses | | | | |
| Refund statuses | | | | |
| Payment method | | | | |
| Search | | | | |
| Date filters | | | | |
| KPI aggregation | | | | |
| Audit/history | | | | |
| Actions/refund | | | | |
| RBAC | | | | |
| Tenant isolation | | | | |
| Export | | | | |

Do not mark PASS without concrete source evidence.

---

# 49. REQUESTS GAP MATRIX

Mandatory:

| Capability | Current | Needed for Operations Center | Gap |
|---|---|---|---|
| KPI by active filters | | | |
| Period KPI parity | | | |
| Search | | | |
| Status filters | | | |
| Attention counts | | | |
| Export | | | |
| Help | | | |
| URL state | | | |

Known issue:

```text
Request KPI endpoint global
```

must appear explicitly.

---

# 50. ORDERS GAP MATRIX

Include:

- lifecycle KPI grouping;
- payment KPI grouping;
- exception grouping;
- current aggregates;
- search;
- period;
- table;
- export;
- Help;
- attention;
- URL state.

---

# 51. BOOKINGS GAP MATRIX

Include:

- 13 canonical statuses;
- classification into visual groups;
- KPI aggregation;
- period;
- search;
- table;
- export;
- Help;
- attention;
- URL state.

---

# 52. ADRS / DECISIONS REQUIRED

At minimum produce explicit decisions for:

```text
ADR-OPS-001 Operations Center route model
ADR-OPS-002 Sidebar ownership vs tab context
ADR-OPS-003 Shared registry shell
ADR-OPS-004 KPI semantic grouping model
ADR-OPS-005 Order lifecycle flow visualization
ADR-OPS-006 Booking lifecycle visualization
ADR-OPS-007 Period/filter scope contract
ADR-OPS-008 KPI/table scope consistency
ADR-OPS-009 Payment operational aggregate
ADR-OPS-010 Payments vs Finance boundary
ADR-OPS-011 Permission-aware tabs
ADR-OPS-012 URL filter state
ADR-OPS-013 Responsive registry model
```

Names may differ, but decisions must be explicit and traceable.

---

# 53. IMPLEMENTATION PHASING — PROPOSED TARGET

After design acceptance, propose a detailed implementation sequence.

Expected structure:

```text
UI-C1.2A — Operations Center Shared Shell
UI-C1.2B — Requests Registry Migration
UI-C1.2C — Orders Registry Migration
UI-C1.2D — Bookings Registry Migration
UI-C1.2E — Payments Backend/Read Model Prerequisites
UI-C1.2F — Payments Registry Integration
UI-C1.2G — KPI Semantic Grouping / Lifecycle Flow
UI-C1.2H — Attention / Period / Filter Reconciliation
UI-C1.2I — Help / i18n / Accessibility
UI-C1.2J — Browser / Security / Regression Closure
UI-C1.2K — Git Hard Closure
```

This is a starting proposal.

Final phase ordering must reflect actual discovered gaps.

Do not implement any of these in UI-C1.2 design stage.

---

# 54. RELATION TO UI-C2

UI-C2 remains:

```text
COMMERCE RELATION CHAIN
Request → Order → Booking
```

UI-C1.2 must NOT implement it.

Operations Center may link to detail pages, but relation-chain component remains future scope.

---

# 55. RELATION TO D8

D8 remains NOT STARTED.

Do not absorb D8 temporal visibility work into UI-C1.2.

---

# 56. PRICING / COMMISSION — OUT OF SCOPE

Marketplace commission architecture requires separate reconciliation.

Potential conceptual model discussed:

```text
Supplier Price
+ TravelHub Commission Amount
= Selling Price
```

and potentially:

```text
supplierPrice
commissionPolicyId
commissionType
commissionRate
commissionAmount
sellingPrice
currency
pricingSnapshotAt
```

Do NOT implement or canonize this in UI-C1.2.

Only note current Request/Order pricing labels if relevant to registry design.

---

# 57. DEFINITION OF DONE — DESIGN STAGE

UI-C1.2 can receive `VERDICT A` only if it delivers:

```text
1. canonical Operations Center architecture
2. 4-tab navigation contract
3. sidebar ownership contract
4. canonical URL strategy
5. shared registry shell design
6. semantic KPI grouping model
7. Order lifecycle KPI design based on real statuses
8. Booking lifecycle KPI design based on real statuses
9. Payments domain audit
10. Payments vs Finance boundary
11. Payment KPI/table proposal based on source truth
12. period/filter contract
13. KPI/table scope consistency contract
14. permission/entitlement matrix
15. responsive model
16. Help/i18n/accessibility contract
17. gap matrices
18. ADR decisions
19. implementation phasing
20. security preservation
21. UI-C2 not started
22. D8 not started
23. Git hard closure if docs are committed
```

---

# 58. AUTOMATIC VERDICT B CONDITIONS

Return `VERDICT B` if any:

```text
- one giant vertically stacked page is proposed
- Payments is placed in sidebar under Operations instead of Finance without explicit approved change
- current canonical URLs are replaced without migration justification
- Payment statuses are invented
- Order statuses are invented
- Booking status grouping ignores actual canonical state machine
- lifecycle arrows imply impossible transitions
- KPI and table scopes can diverge
- client-side KPI counting is proposed
- Payments duplicates Finance analytics
- D7 financial authority is replaced
- all four tabs fetch simultaneously without justification
- hidden tabs are treated as security
- PLATFORM/PARTNER/entitlement differences are ignored
- UI-C2 is started
- D8 is started
- production implementation is performed in this design stage
```

---

# 59. REQUIRED REPORT STRUCTURE

Final report:

```text
1. Executive Summary
2. Canonical Baseline
3. Current Registry Audit
4. Operations Center Architecture
5. Sidebar Ownership
6. Canonical Route / Deep-Link Model
7. Shared Shell Contract
8. Tab Navigation Contract
9. KPI Design System
10. Requests KPI Model
11. Orders State-Machine Audit
12. Orders Lifecycle KPI Flow
13. Orders Exception / Payment KPI Groups
14. Bookings State-Machine Audit
15. Bookings KPI Grouping
16. Payments Domain Audit
17. Payment / Refund Source-of-Truth
18. Payments Operational Aggregate Decision
19. Payments vs Finance Boundary
20. Payments KPI Model
21. Payments Table / Detail Model
22. Attention Model
23. Search Contract
24. Filter Contract
25. Date / Period Contract
26. KPI ↔ Table Scope Contract
27. URL Filter-State Contract
28. Table Design System
29. Requests Gap Matrix
30. Orders Gap Matrix
31. Bookings Gap Matrix
32. Payments Gap Matrix
33. Workspace / Entitlement Matrix
34. RBAC / Security
35. Help / Business Dictionary Integration
36. Localization
37. Accessibility
38. Responsive Design
39. Loading / Empty / Error States
40. Performance
41. Component Architecture
42. ADR Decisions
43. Implementation Phasing
44. Non-Scope / Deferred Items
45. Acceptance Matrix
46. Git Hard Closure
47. Final Verdict
48. TRUE NEXT
```

---

# 60. REQUIRED FINAL VERDICT FORMAT

If design reconciliation passes:

```text
VERDICT A — UI-C1.2 —
OPERATIONS CENTER
ARCHITECTURE & DESIGN RECONCILIATION ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED

UI-C1.2 DESIGN CONTRACT — ACCEPTED

PRODUCTION IMPLEMENTATION — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

FINAL SHA:
<40-char SHA>

TRUE NEXT:
UI-C1.2A — OPERATIONS CENTER SHARED SHELL IMPLEMENTATION
```

If not:

```text
VERDICT B — UI-C1.2 DESIGN RECONCILIATION FAILED

UI-C1.2 — NOT ACCEPTED
PRODUCTION IMPLEMENTATION — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

---

# 61. FINAL DESIGN PRINCIPLES

```text
ONE OPERATIONS CENTER
≠
ONE GIANT PAGE
```

```text
SHARED SHELL
≠
IDENTICAL BUSINESS SEMANTICS
```

```text
DOMAIN OWNERSHIP
≠
WORKFLOW CONTEXT
```

```text
PAYMENTS
= FINANCE-OWNED OPERATIONAL CAPABILITY
+ OPERATIONS CENTER TAB
```

```text
KPI GROUPING
SHOULD EXPLAIN THE BUSINESS PROCESS,
NOT JUST DISPLAY ENUM COUNTS
```

```text
SERVER-SIDE AUTHORITY
ALWAYS PREVAILS OVER CLIENT PRESENTATION
```
