# PHASE 3 --- COMMERCE CENTER UI-C1.2

## VISUAL COMPOSITION & STATUS KPI CONTRACT --- MICRO-CLOSURE

### DESIGN / ARCHITECTURE MICRO-CLOSURE PROMPT

### NO PRODUCTION IMPLEMENTATION

------------------------------------------------------------------------

## 0. EXECUTION MODE

Выполнить **только UI-C1.2 Visual Composition & Status KPI Contract
Micro-Closure**.

Это короткий design/architecture closure поверх уже выполненного:

``` text
UI-C1.2 — Operations Center Architecture & Design Reconciliation
checkpoint SHA:
07f85578b645a77c743d9898597fcf16bfb2a736
```

Текущий checkpoint считать:

``` text
ARCHITECTURE / ROUTING / PAYMENTS DOMAIN / SECURITY — QUALIFIED
VISUAL PAGE COMPOSITION — INCOMPLETE
ALL-STATUS KPI CONTRACT — INCOMPLETE
UI-C1.2 OVERALL — NOT YET ACCEPTED
```

Цель micro-closure --- закрыть **ровно два P0 вопроса**:

1.  жёстко зафиксировать canonical visual page composition для всех 4
    вкладок Operations Center;
2.  зафиксировать canonical правило
    `all actual statuses → visible KPI card`.

Никакой production implementation в этом этапе.

------------------------------------------------------------------------

# 1. BASELINE --- DO NOT REOPEN

Не переоткрывать без реального противоречия:

``` text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED AFTER R3
```

Сохранить решения UI-C1.2:

``` text
ONE OPERATIONS CENTER
≠
ONE GIANT PAGE

SHARED SHELL
≠
IDENTICAL BUSINESS SEMANTICS

DOMAIN OWNERSHIP
≠
WORKFLOW CONTEXT

PAYMENTS
= FINANCE-OWNED OPERATIONAL CAPABILITY
+ OPERATIONS CENTER TAB
```

Canonical tabs:

``` text
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]
```

Canonical sidebar ownership:

``` text
ОПЕРАЦИИ
├── Заявки
├── Заказы
└── Бронирования

ФИНАНСЫ
└── Платежи
```

Canonical routes:

``` text
/app/requests
/app/orders
/app/bookings
/app/payments
```

UI-C2 и D8 остаются NOT STARTED.

------------------------------------------------------------------------

# 2. WHY MICRO-CLOSURE IS REQUIRED

Текущий UI-C1.2 contract корректно определяет:

-   shared shell;
-   tabs;
-   routing;
-   Payments ownership;
-   semantic KPI grouping;
-   filters;
-   server authority;
-   implementation phasing.

Но описание вида:

``` text
ACTIVE DOMAIN KPI AREA
```

оставляет слишком большую свободу реализации.

После предыдущих UI-C1.1 R1/R2 regressions это недопустимо.

Canonical visual composition должна быть такой же обязательной частью
design contract, как routing или RBAC.

------------------------------------------------------------------------

# 3. GLOBAL CANONICAL PAGE COMPOSITION --- P0

Для всех четырёх registry tabs вертикальная структура должна следовать
одному grammar:

``` text
┌──────────────────────────────────────────────────────────────┐
│ BREADCRUMBS / PAGE CONTEXT                                  │
│ ЦЕНТР ОПЕРАЦИЙ                         PERIOD / ACTIONS      │
│                                                              │
│ [ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]          │
├──────────────────────────────────────────────────────────────┤
│ TOTAL KPI                                                    │
├──────────────────────────────────────────────────────────────┤
│ PRIMARY STATUS / LIFECYCLE KPI GROUP                        │
├──────────────────────────────────────────────────────────────┤
│ SECONDARY / EXCEPTION KPI GROUP — where applicable          │
├──────────────────────────────────────────────────────────────┤
│ PAYMENT / REFUND KPI GROUP — where applicable               │
├──────────────────────────────────────────────────────────────┤
│ ATTENTION — where actionable conditions exist               │
├──────────────────────────────────────────────────────────────┤
│ SEARCH | FILTERS | DATE SCOPE | RESET | EXPORT              │
├──────────────────────────────────────────────────────────────┤
│ RESULT / SELECTION SUMMARY — if applicable                  │
│ REGISTRY TABLE                                               │
├──────────────────────────────────────────────────────────────┤
│ PAGINATION                                                   │
└──────────────────────────────────────────────────────────────┘
```

Canonical rule:

> **Vertical section order is binding. Responsive wrapping is allowed,
> but implementation may not arbitrarily reorder, merge, flatten or omit
> semantic zones without a new approved design decision.**

A zone that is genuinely not applicable to a domain may be absent.

Do not create empty decorative zones merely for symmetry.

------------------------------------------------------------------------

# 4. TOTAL KPI --- BINDING VISUAL CONTRACT

Total KPI remains a separate aggregate card.

Accepted labels:

``` text
Requests → Всего заявок
Orders   → Всего заказов
Bookings → Всего бронирований
```

Payments total label must follow the actual payment aggregate chosen by
accepted UI-C1.2 Payments domain contract.

Visual contract:

``` text
TOTAL CARD
- not full-width
- approximately 15–20% larger than ordinary status KPI
- slightly larger label typography
- slightly larger value typography
- same border/radius/color family
- same interaction language
```

Do not revert to a full-width Total hero.

------------------------------------------------------------------------

# 5. GLOBAL STATUS KPI RULE --- P0

Canonical rule:

``` text
EVERY ACTUAL CANONICAL STATUS
→ ONE VISIBLE STATUS KPI CARD
```

This applies to:

``` text
Requests
Orders
Bookings
Payments / Refunds where actual status dimensions exist
```

A status must NOT become `filter-only` merely because an older KPI
contract aggregated it into another metric.

Status KPI cards may be organized into semantic groups.

They may NOT be hidden solely to preserve an older compact KPI set.

------------------------------------------------------------------------

# 6. AGGREGATE KPI VS STATUS KPI

Distinguish:

``` text
STATUS KPI
= count for one actual canonical status

AGGREGATE KPI
= count combining multiple statuses or derived business condition
```

Both may coexist.

Example:

``` text
[ SENT_TO_SUPPLIER ]
[ AWAITING_CONFIRMATION ]

and optionally:

[ Ожидают подтверждения ]
= aggregate of both
```

But aggregate KPI does NOT replace the two canonical status cards.

If duplicate information would overload the page, aggregate metrics may
be moved to:

-   Attention;
-   summary;
-   Help;
-   analytics;

but the canonical status cards remain visible in Operations Center
unless a later approved ADR explicitly changes this rule.

------------------------------------------------------------------------

# 7. REQUESTS --- CANONICAL WIREFRAME

Audit the real RequestStatus enum and use **all actual statuses**.

Do not invent statuses from reference/mockup.

Binding structure:

``` text
ЦЕНТР ОПЕРАЦИЙ
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]

[ Всего заявок ]

СТАТУСЫ ЗАЯВОК
[ status ][ status ][ status ][ status ]
[ status ][ status ][ status ][ status ]
[ ... all actual Request statuses ... ]

ТРЕБУЕТ ВНИМАНИЯ
[ actionable condition ]
[ actionable condition ]
[ ... only where server-authoritative ... ]

[ Search ]
[ Status ]
[ Additional filters ]
[ Date type / From / To — ONLY when KPI/table scope parity exists ]
[ Reset ]
[ CSV ][ XLSX ]

TABLE

PAGINATION
```

Requirements:

-   all actual Request statuses visible;
-   status order documented;
-   Attention is separate from status overview;
-   Attention may reference a status/subset, but is an actionable queue;
-   Request period must not be exposed while KPI endpoint remains
    globally scoped unless backend parity is implemented first.

------------------------------------------------------------------------

# 8. ORDERS --- CANONICAL WIREFRAME

Orders have a special semantic layout.

Binding structure:

``` text
ЦЕНТР ОПЕРАЦИЙ
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]

[ Всего заказов ]

ЖИЗНЕННЫЙ ЦИКЛ ЗАКАЗА

[ state ] → [ state ] → [ state ] → [ state ] → [ state ]
                         ...
[ remaining happy-path states in canonical order ]

REWORK / ПРОБЛЕМНЫЕ / EXCEPTION STATES
[ status ][ status ][ status ] ...

СТАТУСЫ ОПЛАТЫ
[ payment status ][ payment status ][ payment status ] ...

СТАТУСЫ ВОЗВРАТОВ
[ refund status ... ]   ← ONLY if refund is a real separate status dimension

ТРЕБУЕТ ВНИМАНИЯ
[ actionable detector ][ actionable detector ] ...

[ Search ]
[ Lifecycle status ]
[ Payment status ]
[ Additional filters ]
[ Date scope ]
[ Reset ]
[ CSV ][ XLSX ]

TABLE

PAGINATION
```

------------------------------------------------------------------------

# 9. ORDER LIFECYCLE FLOW --- TRUTHFULNESS RULE

Lifecycle flow may visually use connected/arrow cards only for a
truthful primary path.

Required:

``` text
actual Order state machine
→ identify happy-path sequence
→ preserve canonical order
→ render only truthful forward flow with arrows
```

If states branch or loop:

``` text
DO NOT imply false transition with arrow
```

Use separate visual groups/badges for:

-   rework;
-   suspended/problem;
-   terminal exceptions;
-   other branches.

All actual Order lifecycle statuses must still have visible status cards
somewhere in the KPI composition.

------------------------------------------------------------------------

# 10. ORDER PAYMENT CARDS

Orders must preserve separate business dimensions:

``` text
ORDER LIFECYCLE
≠
PAYMENT STATUS
≠
REFUND STATUS
```

Every actual canonical payment status gets a visible card in the Payment
Status group.

If refund status is a separate actual canonical enum/dimension, every
actual refund status gets a visible card in its own group.

Do not convert:

-   payment method;
-   refund amount;
-   due amount;
-   refundable amount;

into fake statuses.

------------------------------------------------------------------------

# 11. BOOKINGS --- CANONICAL WIREFRAME

Known canonical BookingStatus:

``` text
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

Binding rule:

``` text
13 actual Booking statuses
→ 13 visible status KPI cards
```

Recommended composition:

``` text
ЦЕНТР ОПЕРАЦИЙ
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]

[ Всего бронирований ]

ОСНОВНОЙ ЖИЗНЕННЫЙ ЦИКЛ
[ NEW ] → [ PREPARING_REQUEST ] → [ SENT_TO_SUPPLIER ]
→ [ AWAITING_CONFIRMATION ] → [ CONFIRMED ]
→ [ IN_SERVICE ] → [ COMPLETED ]

ИЗМЕНЕНИЯ / ТРЕБУЮТ РЕШЕНИЯ
[ NEEDS_CLARIFICATION ]
[ CHANGE_REQUESTED ]
[ CANCELLATION_REQUESTED ]
[ PROBLEM ]

ТЕРМИНАЛЬНЫЕ ИСКЛЮЧЕНИЯ
[ SUPPLIER_REJECTED ]
[ CANCELLED ]

ТРЕБУЕТ ВНИМАНИЯ
[ server-authoritative actionable subsets only ]

[ Search ]
[ Status ]
[ Additional filters ]
[ Date scope ]
[ Reset ]
[ CSV ][ XLSX ]

TABLE

PAGINATION
```

The exact localized group titles may be refined, but classification must
be justified by the real state machine.

------------------------------------------------------------------------

# 12. OLD BOOKING 6-KPI CONTRACT --- SUPERSEDED FOR OPERATIONS CENTER PRESENTATION

Previously accepted aggregate Booking KPI semantics may remain as:

-   metric IDs;
-   Help topics;
-   aggregate calculations;
-   compatibility/read-model metrics;
-   analytics summaries.

But for Operations Center visual presentation:

``` text
OLD 6 KPI CONTRACT
≠
VISIBLE STATUS CARD LIMIT
```

Explicitly:

``` text
NEW
PREPARING_REQUEST
NEEDS_CLARIFICATION
CHANGE_REQUESTED
CANCELLATION_REQUESTED
PROBLEM
```

must NOT remain `filter-only`.

All 13 canonical statuses require visible cards.

If an old aggregate overlaps status cards, document the overlap rule.

------------------------------------------------------------------------

# 13. BOOKINGS FLOW --- DO NOT LIE ABOUT BRANCHES

Booking state machine is branching.

Therefore:

``` text
happy path
= arrows allowed

branch / exception
= no misleading arrows
```

Do not imply:

``` text
NEEDS_CLARIFICATION → CHANGE_REQUESTED
```

or any other transition unless actual state machine supports it.

The flow communicates business progression, not decorative sequence.

------------------------------------------------------------------------

# 14. PAYMENTS --- CANONICAL WIREFRAME

Use only actual Payment / Refund domain findings from UI-C1.2 audit.

Do not invent statuses.

Binding high-level structure:

``` text
ЦЕНТР ОПЕРАЦИЙ
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]

[ Total payment aggregate ]

СТАТУСЫ ПЛАТЕЖЕЙ
[ every actual Payment status ]

СТАТУСЫ ВОЗВРАТОВ
[ every actual Refund status ]
← only if Refund has a real separate status dimension

ТРЕБУЕТ ВНИМАНИЯ
[ failed / pending approval / pending execution / etc. ]
← only actual server-authoritative conditions

[ Search ]
[ Payment status ]
[ Refund status ]
[ Date type ]
[ From ][ To ]
[ Reset ]
[ CSV ][ XLSX ]

TABLE

PAGINATION
```

Payments remains:

``` text
DOMAIN OWNERSHIP = FINANCE
WORKFLOW CONTEXT = OPERATIONS CENTER
```

------------------------------------------------------------------------

# 15. PAYMENTS ≠ FINANCE ANALYTICS

Do not place these as operational status KPI cards unless they are
directly required for payment workflow:

``` text
GMV
TravelHub Revenue
Commission
Take Rate
Provider Payables
Payouts
Provider Fees
financial trends
```

These belong to Finance / Analytics surfaces.

Payments tab is an operational journal/work center.

------------------------------------------------------------------------

# 16. ATTENTION --- BINDING PLACEMENT

Attention is always after semantic KPI groups and before toolbar:

``` text
STATUS / LIFECYCLE GROUPS
↓
ATTENTION
↓
TOOLBAR
```

Attention is optional per domain, but when present its placement is
canonical.

Attention card:

``` text
= actionable server-authoritative condition
≠ ordinary status card
≠ decorative duplicate
```

Click:

``` text
apply corresponding server-side filter/query
reset page = 1
refresh registry
preserve scope authority
```

------------------------------------------------------------------------

# 17. TOOLBAR --- BINDING ORDER

Canonical interaction order:

``` text
[ Search ]
[ Primary status filter ]
[ Secondary/business filters ]
[ Date type ]
[ From ]
[ To ]
[ Reset ]
[ Export ]
```

Controls that do not apply may be absent.

Do not arbitrarily place Export before Search or split primary filters
into unrelated page zones without an approved responsive reason.

------------------------------------------------------------------------

# 18. KPI CLICK CONTRACT

Status KPI:

``` text
click
→ status filter
→ page = 1
→ server query
→ table refresh
```

Total KPI:

``` text
click
→ clear status dimension filter
→ page = 1
→ server query
```

Attention:

``` text
click
→ actionable server-side detector/filter
→ page = 1
→ table refresh
```

No client-only filtering/counting.

------------------------------------------------------------------------

# 19. KPI ↔ TABLE SCOPE --- P0

Canonical:

``` text
ACTIVE SEARCH / FILTER / PERIOD SCOPE
              ↓
        BACKEND QUERY SCOPE
          ↙           ↘
        KPI           TABLE
```

No state where:

``` text
TABLE = filtered
KPI = global
```

while UI implies they represent the same scope.

Requests period remains hidden until this parity is available.

------------------------------------------------------------------------

# 20. CARD GEOMETRY

Ordinary status cards across all domains use one design family:

``` text
same base height logic
same border/radius family
same internal padding
same label hierarchy
same value hierarchy
same Help affordance
same selected state
same hover/focus language
```

Semantic variants allowed:

``` text
Lifecycle flow card
Ordinary status card
Attention card
Total card
```

But each variant must be explicitly defined, not page-specific
improvisation.

------------------------------------------------------------------------

# 21. GROUP GEOMETRY

Define a reusable semantic group grammar:

``` text
GROUP TITLE
optional description/help
KPI GRID / FLOW
```

Shared:

-   title typography;
-   title-to-grid spacing;
-   group-to-group spacing;
-   responsive wrapping;
-   card gaps.

Orders/Bookings lifecycle flow may use a special flow layout, but group
outer geometry remains shared.

------------------------------------------------------------------------

# 22. RESPONSIVE COMPOSITION

Desktop:

``` text
Header
Tabs
Total
Semantic groups
Attention
Toolbar
Table
Pagination
```

Tablet:

same semantic order; grids/flow wrap.

Mobile:

same semantic order; no reordering that changes business hierarchy.

Tabs may horizontally scroll.

KPI flow may wrap/scroll according to approved design, but canonical
lifecycle order must remain understandable.

No horizontal page overflow.

------------------------------------------------------------------------

# 23. VISUAL ACCEPTANCE EVIDENCE

This micro-closure is design-only, so production screenshots are not
required.

However, final report MUST include four explicit canonical wireframes:

``` text
Requests
Orders
Bookings
Payments
```

Each must show:

-   tabs;
-   Total;
-   every semantic KPI group;
-   Attention placement;
-   toolbar placement;
-   table;
-   pagination.

Do not use only prose such as `ACTIVE DOMAIN KPI AREA`.

------------------------------------------------------------------------

# 24. STATUS COVERAGE MATRICES --- MANDATORY

Produce one matrix per domain.

Example:

  --------------------------------------------------------------------------
  Canonical      Visible KPI Group       Localized   Click       Help ID
  status                card             label       filter      
                                         source                  
  ----------- -------------- ----------- ----------- ----------- -----------
  STATUS_X               YES Lifecycle   ...         ...         ...

  --------------------------------------------------------------------------

Requirements:

``` text
Requests: every actual Request status
Orders: every actual Order lifecycle status
Orders Payment: every actual payment status
Bookings: all 13 Booking statuses
Payments: every actual Payment status
Refunds: every actual Refund status if applicable
```

No canonical status may have:

``` text
Visible KPI card = NO
```

unless the report identifies a concrete source contradiction and returns
VERDICT B for this micro-closure.

------------------------------------------------------------------------

# 25. AGGREGATE OVERLAP MATRIX

Where aggregate metrics coexist with individual status cards, document:

  ------------------------------------------------------------------------------------
  Aggregate     Included                       Visible Double-counting   Purpose
                statuses/condition         separately? meaning           
  ------------- -------------------- ----------------- ----------------- -------------

  ------------------------------------------------------------------------------------

This is especially required for legacy Booking aggregate KPIs.

Do not imply that semantic groups are mutually exclusive unless they
actually are.

------------------------------------------------------------------------

# 26. OUT OF SCOPE --- HARD BLOCK

Do NOT implement:

``` text
OperationsCenterShell production code
registry migrations
Payments backend changes
Requests KPI backend changes
new status enums
new state transitions
UI-C2 Commerce Relation Chain
D8
pricing / commission redesign
SEC-UI-01 remediation
```

Do not alter D5/D6/D7.

------------------------------------------------------------------------

# 27. REQUIRED DOCUMENT UPDATE

Update the UI-C1.2 design contract/report so that this micro-closure
becomes binding.

Do not leave contradictory language such as:

``` text
some canonical statuses remain filter-only
```

for Operations Center presentation.

If old text is retained for historical context, mark it explicitly:

``` text
SUPERSEDED FOR OPERATIONS CENTER VISUAL PRESENTATION
```

------------------------------------------------------------------------

# 28. REQUIRED ADR / ADDENDUM

Create a traceable design decision, for example:

``` text
ADR-OPS-014 — Canonical Operations Center Visual Composition
ADR-OPS-015 — All Canonical Statuses Require Visible KPI Cards
```

Exact numbering may adapt if repository already uses another next ADR
number.

The decision must state:

``` text
Vertical section order is canonical.
All actual canonical statuses are represented by visible status KPI cards.
Aggregate KPIs do not replace status cards.
```

------------------------------------------------------------------------

# 29. ACCEPTANCE GATES

Micro-closure receives VERDICT A only if:

``` text
P0-1 Global vertical composition fixed          PASS
P0-2 Requests wireframe fixed                   PASS
P0-3 Orders wireframe fixed                     PASS
P0-4 Bookings wireframe fixed                   PASS
P0-5 Payments wireframe fixed                   PASS
P0-6 All Request statuses visible               PASS
P0-7 All Order statuses visible                 PASS
P0-8 All Order payment statuses visible         PASS
P0-9 All 13 Booking statuses visible            PASS
P0-10 All actual Payment statuses visible       PASS
P0-11 Refund statuses handled truthfully        PASS
P0-12 Aggregate/status distinction fixed        PASS
P0-13 Attention placement fixed                 PASS
P0-14 Toolbar placement fixed                   PASS
P0-15 KPI/table scope authority preserved       PASS
P0-16 D5/D6/D7 preserved                        PASS
P0-17 No production implementation              PASS
P0-18 UI-C2 not started                         PASS
P0-19 D8 not started                            PASS
P0-20 Git hard closure                          PASS
```

------------------------------------------------------------------------

# 30. AUTOMATIC VERDICT B CONDITIONS

Return VERDICT B if:

``` text
- ACTIVE DOMAIN KPI AREA remains undefined
- any actual canonical status is intentionally filter-only
- old Booking 6-KPI contract is used to hide the other statuses
- Total becomes full-width
- Orders statuses are flattened into one undifferentiated grid
- Order lifecycle arrows imply false transitions
- Booking branch states are presented as a false linear chain
- Payment/refund statuses are invented
- Attention is mixed into ordinary status cards without semantic distinction
- KPI/table scopes may diverge
- production implementation starts
- UI-C2 starts
- D8 starts
```

------------------------------------------------------------------------

# 31. REQUIRED REPORT STRUCTURE

``` text
1. Executive Summary
2. Baseline / Checkpoint
3. Reason for Micro-Closure
4. Canonical Global Page Composition
5. Total KPI Contract
6. Status KPI Contract
7. Aggregate vs Status KPI
8. Requests Canonical Wireframe
9. Requests Status Coverage Matrix
10. Orders Canonical Wireframe
11. Order State-Machine Classification
12. Orders Status Coverage Matrix
13. Orders Payment/Refund Coverage
14. Bookings Canonical Wireframe
15. Booking 13-Status Coverage Matrix
16. Legacy Booking Aggregate Compatibility
17. Payments Canonical Wireframe
18. Payments/Refund Status Coverage Matrix
19. Attention Contract
20. Toolbar Contract
21. KPI Click / Drill Contract
22. KPI ↔ Table Scope Contract
23. Card / Group Geometry
24. Responsive Composition
25. ADR Addendum
26. Superseded Language
27. Non-Scope
28. Acceptance Matrix
29. Git Hard Closure
30. Final Verdict
31. TRUE NEXT
```

------------------------------------------------------------------------

# 32. GIT HARD CLOSURE

If documentation changes are committed:

``` bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Required:

``` text
porcelain = empty
HEAD == origin/master
one canonical 40-char SHA
```

------------------------------------------------------------------------

# 33. REQUIRED FINAL VERDICT

If all gates pass:

``` text
VERDICT A — UI-C1.2
VISUAL COMPOSITION & STATUS KPI CONTRACT
MICRO-CLOSURE ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED

UI-C1.2
OPERATIONS CENTER
ARCHITECTURE & DESIGN CONTRACT — ACCEPTED

FINAL SHA:
<40-char SHA>

PRODUCTION IMPLEMENTATION — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2A — OPERATIONS CENTER SHARED SHELL IMPLEMENTATION
```

If any P0 gate fails:

``` text
VERDICT B — UI-C1.2
VISUAL COMPOSITION & STATUS KPI CONTRACT
MICRO-CLOSURE FAILED

UI-C1.2 — NOT ACCEPTED
UI-C1.2A — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

------------------------------------------------------------------------

# 34. FINAL BINDING PRINCIPLES

``` text
ONE SHARED PAGE GRAMMAR
+
DOMAIN-SPECIFIC BUSINESS CONTENT
```

``` text
TOTAL
→ STATUS / LIFECYCLE GROUPS
→ EXCEPTIONS / PAYMENT / REFUND GROUPS
→ ATTENTION
→ TOOLBAR
→ TABLE
→ PAGINATION
```

``` text
EVERY ACTUAL CANONICAL STATUS
→ VISIBLE KPI CARD
```

``` text
AGGREGATE KPI
≠
REPLACEMENT FOR STATUS KPI
```

``` text
VISUAL COMPOSITION
IS PART OF THE ARCHITECTURE CONTRACT,
NOT AN IMPLEMENTATION DETAIL.
```
