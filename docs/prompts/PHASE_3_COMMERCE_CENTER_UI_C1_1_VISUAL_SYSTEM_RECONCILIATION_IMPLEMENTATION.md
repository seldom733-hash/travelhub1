# PHASE 3 — COMMERCE CENTER UI CONSISTENCY — UI-C1.1 COMMERCE CENTER VISUAL SYSTEM RECONCILIATION — IMPLEMENTATION

## ROLE — MANDATORY

Ты работаешь как **Staff/Principal Product Designer + Enterprise SaaS Design-System Architect + Staff Frontend Engineer + UX Consistency Reviewer + Accessibility Reviewer + QA/Release Engineer**.

Это production implementation stage, который следует после принятого UI-C1.

Главная задача — сделать:

```text
Заявки
Заказы
Бронирования
```

визуально тремя разделами **одного Commerce Center**, а не тремя независимо оформленными модулями.

Это не cosmetic polish.

Это **Visual Design System Reconciliation** для:

```text
/app/requests
/app/orders
/app/bookings

/app/requests/[id]
/app/orders/[id]
/app/bookings/[id]
```

---

# 1. CANONICAL BASELINE — DO NOT REOPEN

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

COMMERCE UI DESIGN CONTRACT — ACCEPTED
HELP / BUSINESS DICTIONARY CONTRACT — ACCEPTED
DEBT REGISTER — QUALIFIED AND ACCEPTED

UI-C1 — ACCEPTED

UI-C1 FINAL SHA:
e839ede70d2b2736b24f9ebf95bc1f05bc4c1c31

UI-C1.1 — STARTING
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

UI-C1 already established:

```text
EntityDetailShell
EntityDetailHeader
shared breadcrumbs
shared StatusBadge foundation
Link-based canonical back navigation
```

Do not replace these with another parallel system.

---

# 2. CRITICAL PRODUCT OBJECTIVE

После UI-C1.1 пользователь должен визуально воспринимать:

```text
Requests
Orders
Bookings
```

как один продуктовый центр.

Unified means:

```text
same visual grammar
same typography hierarchy
same page geometry
same card geometry
same field hierarchy
same table grammar
same filter grammar
same spacing rhythm
same responsive behavior
```

But:

```text
UNIFIED VISUAL SYSTEM
≠
IDENTICAL BUSINESS CONTENT
```

Request, Order и Booking сохраняют свои business fields, statuses, actions, filters, columns и applicable sections.

---

# 3. SCOPE

UI-C1.1 включает:

```text
A. Registry/List Page Geometry
B. Registry Header
C. KPI Card Visual System
D. Search / Filters / Toolbar Visual System
E. Table Visual System
F. Pagination / Summary Visual System
G. Detail Page Geometry
H. Detail Section Card System
I. Typography Scale
J. Field Label / Value System
K. Buttons / Actions Visual System
L. Status Badge Geometry/Typography
M. Spacing / Grid / Density
N. Loading / Empty / Error Presentation
O. Responsive Reconciliation
P. Accessibility Visual Baseline
Q. Cross-page Browser Visual Qualification
```

---

# 4. HARD BUSINESS-LOGIC BOUNDARY

UI-C1.1 унифицирует **presentation**, но не меняет canonical business semantics.

Forbidden:

```text
new Order KPI formulas
new Booking KPI formulas
new Request KPI formulas
Booking KPI semantic migration
Order KPI semantic reconciliation
Commerce Relation Chain
Business Timeline extraction
Audit History unification
Request SEC-UI-01 remediation
Typed Metric/Help Registry
/app/help
D8
```

Особенно:

```text
KPI CARD VISUAL SYSTEM      → YES
KPI BUSINESS LOGIC CHANGE   → NO
```

Bookings final KPI contract уже спроектирован отдельно, но его business implementation не выполнять здесь.

Если `/app/bookings` сейчас не имеет тех же KPI cards, что другие registries:

```text
do NOT fabricate data
do NOT create frontend counts
do NOT implement future Booking KPI semantics
```

Можно подготовить reusable visual component, но не показывать fake/unsupported cards.

---

# 5. STARTING GIT EVIDENCE

Before changes:

```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```

Expected lineage:

```text
UI-C1 SHA:
e839ede70d2b2736b24f9ebf95bc1f05bc4c1c31
```

If unrelated local changes exist:

```text
STOP
do not overwrite
report exact files
```

---

# 6. FIRST TASK — COMPLETE VISUAL INVENTORY

До изменения UI выполнить audit всех 6 страниц:

```text
/app/requests
/app/orders
/app/bookings

/app/requests/[id]
/app/orders/[id]
/app/bookings/[id]
```

Не начинать массовую замену классов до завершения inventory.

Create table:

| Visual Role | Requests List | Orders List | Bookings List | Request Detail | Order Detail | Booking Detail |
|---|---|---|---|---|---|---|
| page padding | | | | | | |
| max/full width | | | | | | |
| page title size | | | | | | |
| page title weight | | | | | | |
| subtitle/meta | | | | | | |
| section gap | | | | | | |
| card radius | | | | | | |
| card border | | | | | | |
| card padding | | | | | | |
| card title size | | | | | | |
| card title weight | | | | | | |
| field label size | | | | | | |
| field value size | | | | | | |
| field value weight | | | | | | |
| grid gap | | | | | | |
| button height | | | | | | |
| input height | | | | | | |
| badge height/padding | | | | | | |
| table header size | | | | | | |
| table cell size | | | | | | |
| table row padding | | | | | | |

Report actual classes/tokens.

---

# 7. CANONICAL COMMERCE VISUAL TOKENS

На основе:

```text
existing accepted design contract
existing Design System
current PageHeader/StatusBadge/Shell primitives
actual six-page audit
```

принять один canonical visual token contract.

Prefer semantic shared primitives/classes over arbitrary per-page Tailwind combinations.

Required semantic roles:

```text
commerce.page
commerce.pageHeader
commerce.pageTitle
commerce.pageSubtitle

commerce.section
commerce.sectionTitle

commerce.card
commerce.cardHeader
commerce.cardTitle
commerce.cardBody

commerce.fieldLabel
commerce.fieldValue
commerce.fieldMeta

commerce.kpiCard
commerce.kpiLabel
commerce.kpiValue
commerce.kpiMeta

commerce.toolbar
commerce.input
commerce.select
commerce.button

commerce.table
commerce.tableHeader
commerce.tableCell
commerce.tableReference
commerce.tableMeta

commerce.status

commerce.empty
commerce.loading
commerce.error
```

Implementation can use:

```text
shared React primitives
shared Tailwind constants
CVA
existing design-system abstraction
```

according to repo architecture.

Do not introduce a second styling framework.

---

# 8. TYPOGRAPHY — MANDATORY

Create one semantic typography hierarchy.

At minimum define and enforce:

```text
PAGE TITLE
SECTION TITLE
CARD TITLE
KPI LABEL
KPI VALUE
FIELD LABEL
FIELD VALUE
SECONDARY VALUE
TABLE HEADER
TABLE CELL
REFERENCE / ID
META / TIMESTAMP
EMPTY / HELP TEXT
BUTTON TEXT
BADGE TEXT
```

For every role define:

```text
font-size
font-weight
line-height
letter-spacing if applicable
text color role
text transform if applicable
```

Important:

```text
same semantic role
→ same typography
→ Requests / Orders / Bookings
```

Do not leave local arbitrary `text-xs`, `text-sm`, `font-medium`, `font-semibold`, `uppercase` combinations for equivalent semantic roles.

If uppercase is used for card headings, use it consistently where the same semantic role applies.

---

# 9. PAGE GEOMETRY — LIST PAGES

Unify:

```text
/app/requests
/app/orders
/app/bookings
```

Canonical requirements:

```text
same outer page padding
same content width strategy
same top offset
same title/header geometry
same section vertical rhythm
same toolbar placement
same KPI region geometry where KPI exists
same table region geometry
same pagination placement
```

Business-specific widgets may be absent.

Absence must not distort overall visual language.

---

# 10. REGISTRY HEADER

The three registry pages must share a recognizable header pattern.

At minimum reconcile:

```text
page title
optional subtitle/summary
primary action placement
secondary action placement
top spacing
bottom spacing
responsive wrapping
```

Do not force an action onto a page that does not support it.

---

# 11. KPI CARD VISUAL SYSTEM

Implement/reconcile one reusable KPI visual primitive, e.g.:

```text
<CommerceKpiCard />
```

or repo-compatible equivalent.

Visual contract:

```text
same height strategy
same padding
same radius
same border/background
same KPI label typography
same KPI value typography
same secondary/meta typography
same icon/help position capability
same hover/focus state capability
same selected/drill-down state capability
same responsive grid behavior
```

KPI content remains domain-specific.

Do not change backend count semantics.

Do not create fake Booking KPI data.

---

# 12. KPI GRID

Where KPI cards exist:

```text
same grid gap
same card minimum width
same responsive breakpoints
same vertical alignment
same density
```

If counts differ between modules, layout must remain balanced.

Do not add meaningless filler cards for symmetry.

---

# 13. SEARCH / FILTER / TOOLBAR SYSTEM

Requests / Orders / Bookings must share visual rules for:

```text
search
selects
date filters
status filters
reset
apply
secondary controls
```

Unify:

```text
control height
border
radius
font size
placeholder style
label style
horizontal/vertical gaps
focus state
disabled state
toolbar container
responsive wrapping
```

Do not force identical filter sets.

---

# 14. TABLE VISUAL SYSTEM

All three registries must look like variants of one Commerce table.

Unify:

```text
outer container
border/radius
header background
header typography
header height
cell typography
cell padding
row height
row divider
hover state
focus/keyboard state where applicable
reference/ID style
status placement
date/time presentation style
money alignment
action-cell geometry
empty state
loading state
```

Do not force identical columns.

Canonical principle:

```text
same table grammar
different business columns
```

---

# 15. TABLE REFERENCES / IDS

Request, Order and Booking reference numbers must use one visual role.

Example semantics:

```text
MKT-REQ-...
MKT-ORD-...
MKT-BKG-...
```

Unify:

```text
font family decision
font size
font weight
link style
hover/focus
```

Do not use monospace on one entity and standard font on another unless there is a documented design-system reason applying consistently.

---

# 16. PAGINATION / RESULT SUMMARY

Where applicable unify:

```text
record count
page count
previous/next
page buttons
page-size control
spacing
typography
disabled state
```

Do not change pagination API/business behavior.

---

# 17. DETAIL PAGE GEOMETRY

UI-C1 already introduced shared shell.

UI-C1.1 must reconcile the **inside** of:

```text
Request Detail
Order Detail
Booking Detail
```

Unify:

```text
content padding
content width strategy
column geometry
section gaps
card gaps
right-rail geometry capability
vertical rhythm
```

Do not replace `EntityDetailShell`.

Improve it only if necessary to establish canonical visual geometry.

---

# 18. DETAIL SECTION CARD SYSTEM

Create/reconcile shared:

```text
<EntitySectionCard />
```

or equivalent.

All equivalent detail cards must share:

```text
border
radius
background
padding
header spacing
body spacing
title typography
internal grid
divider rules
empty presentation
```

Examples:

```text
Клиент
Поставщик
Услуга
Заказ
Бронирование
Пассажиры
Финансы
Детали
Примечания
```

These cards have different business content but the same visual grammar.

---

# 19. FIELD LABEL / VALUE SYSTEM

This is mandatory.

Create one hierarchy:

```text
FIELD LABEL
↓
FIELD VALUE
↓
OPTIONAL META
```

Unify:

```text
label font size
label weight
label color
label→value gap

value font size
value weight
value color
value line-height

meta font size
meta color
meta spacing
```

Apply to equivalent fields across all three detail pages.

No page-specific typography for the same semantic role without explicit rationale.

---

# 20. FIELD GRID

Unify:

```text
1-column mobile
2-column / appropriate desktop grid
column gaps
row gaps
alignment
long text wrapping
long IDs
emails
phones
money
dates
```

Do not truncate critical data without accessible way to see it.

---

# 21. MONEY / DATE / REFERENCE PRESENTATION

Visual formatting must be consistent.

But business authority remains unchanged.

Financial hard rule:

```text
backend = value authority
frontend = formatting only
```

D7 remains untouched.

No new client-side financial calculations.

---

# 22. BUTTON / ACTION VISUAL SYSTEM

Unify visual grammar for:

```text
primary
secondary
destructive
link action
icon action
disabled
loading/busy
```

Across Request/Order/Booking.

But preserve action authority:

```text
Order   → D5 server authority
Booking → D6 server authority
Request → SEC-UI-01 still open until scheduled remediation
```

UI-C1.1 may normalize button appearance only.

Do not broaden Request permissions/actions.

---

# 23. STATUS BADGE VISUAL SYSTEM

UI-C1 established shared `StatusBadge`.

Now reconcile its visual geometry:

```text
font
line-height
padding
radius
icon spacing if applicable
multi-badge gap
wrapping
```

Keep separate domains:

```text
Lifecycle
Payment
Refund
```

No status semantic changes.

---

# 24. LOADING / EMPTY / ERROR STATES

Unify presentation for:

```text
page loading
table loading
empty registry
empty card
detail loading
detail not found
generic error
```

Security preservation:

```text
wrong tenant/workspace/context
→ 404-like
→ no existence leakage
```

Do not convert isolation into client-side 403 messaging.

---

# 25. RESPONSIVE DESIGN — ALL SIX PAGES

Browser qualification is required for:

```text
Requests List
Orders List
Bookings List
Request Detail
Order Detail
Booking Detail
```

At:

```text
Desktop: ≥1280
Tablet: 768–1279
Mobile: <768
```

Required:

```text
no horizontal page overflow
tables handled intentionally
filters wrap/stack correctly
KPI cards reflow correctly
detail cards stack correctly
actions remain usable
badges remain readable
titles do not collide
long values wrap safely
```

Do not qualify responsiveness only from class inspection.

Use actual browser evidence.

---

# 26. VISUAL PARITY QUALIFICATION

This stage requires visual evidence, not only unit tests.

Capture comparable screenshots for:

```text
Requests List
Orders List
Bookings List
```

and:

```text
Request Detail
Order Detail
Booking Detail
```

Prefer same viewport and representative data.

Then create explicit parity matrix:

| Visual Role | Requests | Orders | Bookings | Unified? |
|---|---|---|---|---|
| page title | | | | |
| page padding | | | | |
| KPI card | | | | |
| filters | | | | |
| table header | | | | |
| table cells | | | | |
| reference | | | | |
| status badge | | | | |
| detail card | | | | |
| card title | | | | |
| field label | | | | |
| field value | | | | |
| action buttons | | | | |
| spacing rhythm | | | | |

Any equivalent semantic role that remains visibly inconsistent requires explanation or remediation.

---

# 27. BEFORE → AFTER VISUAL INVENTORY

Report exact changes:

| Token / Role | Before Request | Before Order | Before Booking | Canonical After |
|---|---|---|---|---|
| page title | | | | |
| page padding | | | | |
| card padding | | | | |
| card radius | | | | |
| card title | | | | |
| field label | | | | |
| field value | | | | |
| section gap | | | | |
| input height | | | | |
| button height | | | | |
| table header | | | | |
| table cell | | | | |
| KPI label | | | | |
| KPI value | | | | |
| badge | | | | |

No vague:

```text
looks consistent
mostly unified
similar
```

Use exact classes/tokens/components.

---

# 28. SHARED COMPONENT INVENTORY

After implementation list:

```text
existing shared components reused
new shared components introduced
old duplicate patterns removed
remaining duplicates and rationale
```

Potential components:

```text
CommerceRegistryPage
CommerceRegistryHeader
CommerceKpiCard
CommerceToolbar
CommerceTable
EntityDetailShell
EntityDetailHeader
EntitySectionCard
EntityField
StatusBadge
CommerceEmptyState
CommerceErrorState
```

Do not create abstractions just to satisfy naming.

Prefer useful reuse with clear semantic ownership.

---

# 29. DUPLICATION GATE

Search touched pages for repeated visual class bundles.

Equivalent semantic blocks should not maintain three independent style definitions when a shared primitive/token is reasonable.

Report remaining duplication.

Do not over-abstract business-specific markup.

---

# 30. ACCESSIBILITY

For touched components verify:

```text
semantic heading order
table semantics
label/control association
keyboard focus
visible focus state
button/link semantics
status not color-only
sufficient interaction target size
icon-only actions have accessible names
responsive zoom usability
```

---

# 31. I18N

Touched visible strings must remain RU/AZ/EN compatible.

Visual system must support:

```text
long Russian labels
Azerbaijani characters
English labels
```

No fixed widths that break localization.

No raw i18n keys.

---

# 32. SECURITY / AUTHORITY PRESERVATION

Must preserve:

```text
server-side RBAC
workspace isolation
tenant isolation
cross-context 404-like behavior
D5 Order action authority
D6 Booking action authority
D7 financial authority
audit immutability
PII/PCI safety
```

Request:

```text
SEC-UI-01 remains OPEN
```

Do not falsely close it.

---

# 33. TESTING

Add/update targeted tests for shared visual primitives where useful.

Test semantics/structure rather than fragile pixel snapshots.

At minimum qualify:

```text
shared KPI component
shared section card
shared field hierarchy
shared registry/table primitives if introduced
EntityDetailShell remains compatible
EntityDetailHeader remains compatible
StatusBadge remains compatible
```

---

# 34. REGRESSION GATES

Run actual repo commands.

At minimum:

```text
frontend typecheck
frontend build
frontend relevant tests
UI-C1 component regression
D5 relevant regression
D6 relevant regression
D7 relevant regression if finance rendering touched
```

If one known pre-existing frontend test still fails:

```text
identify exact test
prove unchanged from baseline
do not hide it
```

---

# 35. NO BUSINESS COUNT REGRESSION

For list pages verify that visual migration does not change:

```text
record counts
filters
search
pagination
status values
sorting
KPI values
```

Before/after representative values should reconcile.

Visual refactor must not silently alter queries.

---

# 36. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_COMMERCE_CENTER_UI_C1_1_VISUAL_SYSTEM_RECONCILIATION_IMPLEMENTATION_REPORT.md
```

Predominantly Russian.

Required sections:

1. Executive Summary
2. Canonical Baseline
3. Starting Git State
4. Six-Page Visual Audit
5. Before Visual Inventory
6. Canonical Commerce Visual Token Contract
7. Typography System
8. Registry Page Geometry
9. Registry Header
10. KPI Card Visual System
11. Filters/Search/Toolbar
12. Table Visual System
13. Pagination/Summary
14. Detail Page Geometry
15. Detail Section Card System
16. Field Label/Value System
17. Button/Action Visual System
18. Status Badge System
19. Loading/Empty/Error
20. Responsive Reconciliation
21. Accessibility
22. i18n
23. Shared Component Inventory
24. Duplication Audit
25. Business/Security Authority Preservation
26. Tests
27. Regression/Build Results
28. Browser Visual Qualification
29. Visual Parity Matrix
30. Before→After Token Matrix
31. Remaining Debt / Explicit Non-Scope
32. File Change Inventory
33. Acceptance Matrix
34. Git Hard Closure
35. Findings
36. Final Verdict
37. TRUE NEXT

---

# 37. ACCEPTANCE MATRIX — DO NOT SHORTEN

| Gate | Result | Exact Evidence |
|---|---|---|
| UI-C1 baseline SHA reconciled | | |
| Starting HEAD == origin/master | | |
| No unrelated local changes overwritten | | |
| D5 preserved | | |
| D6 preserved | | |
| D7 preserved | | |
| All 3 registry pages audited before changes | | |
| All 3 detail pages audited before changes | | |
| Exact before typography documented | | |
| Exact before card geometry documented | | |
| Exact before page geometry documented | | |
| Canonical visual token contract established | | |
| One page-title typography role | | |
| One section-title typography role | | |
| One card-title typography role | | |
| One KPI-label typography role | | |
| One KPI-value typography role | | |
| One field-label typography role | | |
| One field-value typography role | | |
| One meta-text typography role | | |
| One table-header typography role | | |
| One table-cell typography role | | |
| One reference/ID typography role | | |
| Registry outer geometry unified | | |
| Registry headers visually unified | | |
| KPI card geometry unified where applicable | | |
| No fake Booking KPI introduced | | |
| No KPI business logic changed | | |
| KPI grid behavior unified where applicable | | |
| Filter control height unified | | |
| Filter typography unified | | |
| Filter spacing unified | | |
| Table outer geometry unified | | |
| Table header geometry unified | | |
| Table cell geometry unified | | |
| Table row density unified | | |
| Reference presentation unified | | |
| Status placement visually reconciled | | |
| Pagination visual grammar unified | | |
| EntityDetailShell preserved/reused | | |
| EntityDetailHeader preserved/reused | | |
| Detail content geometry unified | | |
| Detail card geometry unified | | |
| Detail card title typography unified | | |
| Detail field label typography unified | | |
| Detail field value typography unified | | |
| Detail field spacing unified | | |
| Long values handled safely | | |
| Money visual formatting consistent | | |
| Date/time visual formatting consistent | | |
| Button geometry reconciled | | |
| StatusBadge geometry reconciled | | |
| Lifecycle/payment/refund semantics unchanged | | |
| Loading presentation reconciled | | |
| Empty presentation reconciled | | |
| Error presentation reconciled | | |
| Cross-context 404 semantics preserved | | |
| Order D5 action authority preserved | | |
| Booking D6 action authority preserved | | |
| Request SEC-UI-01 remains open | | |
| D7 backend financial authority preserved | | |
| No frontend financial recomputation introduced | | |
| List record counts unchanged | | |
| Existing filters behavior unchanged | | |
| Existing search behavior unchanged | | |
| Existing pagination behavior unchanged | | |
| Existing KPI values unchanged | | |
| Requests List desktop browser PASS | | |
| Orders List desktop browser PASS | | |
| Bookings List desktop browser PASS | | |
| Request Detail desktop browser PASS | | |
| Order Detail desktop browser PASS | | |
| Booking Detail desktop browser PASS | | |
| Representative tablet browser PASS | | |
| Representative mobile browser PASS | | |
| No horizontal page overflow | | |
| Tables intentionally responsive | | |
| Filters responsive | | |
| KPI cards responsive | | |
| Detail cards responsive | | |
| RU visual qualification PASS | | |
| AZ visual qualification PASS | | |
| EN visual qualification PASS | | |
| Accessibility baseline PASS | | |
| Visual parity matrix complete | | |
| Before→After exact token matrix complete | | |
| Shared component inventory complete | | |
| Duplication audit complete | | |
| File change inventory complete | | |
| Frontend typecheck PASS | | |
| Frontend build PASS | | |
| Relevant frontend tests PASS/classified | | |
| D5 regression PASS | | |
| D6 regression PASS | | |
| D7 regression PASS if applicable | | |
| Commerce Relation Chain NOT started | | |
| Business Timeline extraction NOT started | | |
| Audit unification NOT started | | |
| SEC-UI-01 remediation NOT started | | |
| Booking KPI semantic implementation NOT started | | |
| Orders KPI semantic implementation NOT started | | |
| Help implementation NOT started | | |
| D8 NOT started | | |
| Final porcelain empty | | |
| HEAD == origin/master | | |
| One canonical 40-char Final SHA | | |

Any critical gate:

```text
FAIL
NOT PROVEN
```

→ VERDICT B.

---

# 38. GIT HARD CLOSURE

Before commit:

```bash
git status --short
git status --porcelain=v1
git diff --stat
git diff --check
```

Commit only UI-C1.1 scope + report.

Push.

Then:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```

Required:

```text
$ git status --porcelain=v1
<NO OUTPUT>

$ git rev-parse HEAD
<ONE 40-CHAR SHA>

$ git rev-parse origin/master
<SAME SHA>
```

---

# 39. VERDICT A

Only if all critical gates pass:

```text
VERDICT A — PHASE 3 COMMERCE CENTER UI CONSISTENCY — UI-C1.1 COMMERCE CENTER VISUAL SYSTEM RECONCILIATION PASSED

UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED

FINAL SHA:
<one canonical 40-char SHA>

TRUE NEXT:
UI-C2 — COMMERCE RELATION CHAIN

UI-C3+ — NOT STARTED
D8 — NOT STARTED
```

Then STOP.

---

# 40. VERDICT B

If any critical gate fails:

```text
VERDICT B — PHASE 3 COMMERCE CENTER UI CONSISTENCY — UI-C1.1 FAILED

UI-C1 — REMAINS ACCEPTED
UI-C1.1 — NOT ACCEPTED

TRUE NEXT:
UI-C1.1 REMEDIATION

UI-C2 — NOT STARTED
D8 — NOT STARTED
```

List exact blockers.

Then STOP.

---

# 41. HARD STOP

After UI-C1.1 implementation, report and Git closure:

```text
STOP
```

Do not start UI-C2 in the same run.
