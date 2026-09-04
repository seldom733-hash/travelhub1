# PHASE 3 — COMMERCE CENTER UI-C1.2C
## ORDERS REGISTRY MIGRATION — PRODUCTION IMPLEMENTATION
## REFERENCE-MATCH LIFECYCLE KPI FLOW

### IMPLEMENTATION PROMPT
### PRODUCTION CODE REQUIRED

---

# 0. EXECUTION MODE

Выполнить:

```text
UI-C1.2C — ORDERS REGISTRY MIGRATION
```

Accepted baseline:

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 DESIGN CONTRACT — ACCEPTED
UI-C1.2A — ACCEPTED
UI-C1.2B — ACCEPTED
```

Accepted UI-C1.2B SHA:

```text
ec85deb963d1ba9943ecb1ef890a66b45cda2460
```

UI-C2 and D8 remain NOT STARTED.

This stage is **production UI implementation** for the Orders registry.

The `/app/orders` tab must visibly change.

---

# 1. OBJECTIVE

Migrate `/app/orders` from the transitional shell-wrapped registry into the accepted semantic Operations Center Orders design.

Required outcome:

```text
/app/orders
→ OperationsCenterShell
→ Orders active
→ canonical Total
→ lifecycle process-flow cards
→ alternative/rework statuses
→ exception statuses
→ payment-status KPI group
→ server-side drill/filter behavior
→ canonical toolbar
→ table/pagination in shared frame
→ browser-qualified reference-match visual implementation
```

This is an **Orders-only** stage.

Do not implement Bookings lifecycle migration yet.

Do not implement Payments full registry integration yet.

---

# 2. P0 — SUPPLIED VISUAL REFERENCE IS THE SOURCE OF TRUTH

The user supplied an Orders Center reference image showing lifecycle cards arranged sequentially through the business lifecycle.

For the **Orders lifecycle flow**, that supplied image is the binding visual source of truth.

This means the implementation must reproduce the reference as closely as practicable in:

```text
CARD SILHOUETTE / SHAPE
CARD OUTLINE GEOMETRY
CORNER TREATMENT
PROPORTIONS
WIDTH / HEIGHT RELATION
CONNECTOR SHAPE
ARROW SHAPE
ARROW POSITION
CARD-TO-CARD SPACING
INTERNAL PADDING
LABEL POSITION
VALUE POSITION
TYPOGRAPHIC SCALE
FLOW RHYTHM
ROW WRAPPING / CONTINUATION
VISUAL WEIGHT
```

Important:

```text
"similar cards"
≠
accepted
```

```text
standard rectangular CommerceKpiCard + simple → icon
≠
accepted
```

The lifecycle cards must have the **same visual form/silhouette logic as the supplied reference**.

If the implementation agent cannot access the reference image during implementation/qualification:

```text
STOP
DO NOT APPROXIMATE FROM MEMORY
REPORT REFERENCE ASSET UNAVAILABLE
VERDICT B
```

Do not invent an alternative card shape.

---

# 3. UNIFIED DESIGN SYSTEM ≠ IDENTICAL CARD SHAPE

Binding rule:

```text
UNIFIED OPERATIONS CENTER DESIGN SYSTEM
≠
IDENTICAL KPI CARD GEOMETRY
```

Requests may use standard registry/status KPI cards.

Orders lifecycle uses a **special reference-matched process-card form**.

The shared family still applies to:

- typography family;
- border/color tokens;
- interaction behavior;
- focus states;
- Help affordances;
- spacing system;
- selected state semantics.

But the actual lifecycle-card silhouette/geometry is Orders-specific.

---

# 4. ORDER STATUS SOURCE OF TRUTH

Use the actual canonical `OrderStatus` enum:

```text
NEW
IN_PROCESSING
WAITING_FOR_DATA
READY_FOR_BOOKING
SENT_TO_BOOKING
PARTIALLY_FULFILLED
FULFILLED
READY_TO_CLOSE
CLOSED
CANCELLED
PROBLEM
SUSPENDED
```

Do not invent statuses.

Do not remove a real enum status because it is rarely reached.

Do not expose raw enum text if a canonical localized label exists.

---

# 5. ORDER STATE-MACHINE TRUTH

Actual known transition semantics:

```text
NEW → IN_PROCESSING

IN_PROCESSING → WAITING_FOR_DATA
WAITING_FOR_DATA → IN_PROCESSING

IN_PROCESSING | WAITING_FOR_DATA → READY_FOR_BOOKING

READY_FOR_BOOKING → SENT_TO_BOOKING

SENT_TO_BOOKING | PARTIALLY_FULFILLED → FULFILLED

FULFILLED | READY_TO_CLOSE → CLOSED

active → CANCELLED

active minus PROBLEM → PROBLEM

active minus SUSPENDED → SUSPENDED
```

Important truthfulness finding:

```text
READY_TO_CLOSE
```

is a canonical real status but currently has **no known entry transition** in the audited state machine.

Therefore:

```text
READY_TO_CLOSE = visible KPI card
BUT
NO FALSE incoming lifecycle arrow
```

---

# 6. ADR-OPS-015 — ALL ORDER STATUSES VISIBLE

Binding rule:

```text
EVERY ACTUAL CANONICAL STATUS
→ ONE VISIBLE STATUS KPI CARD
```

For Orders:

```text
12 OrderStatus
→ 12 visible lifecycle/status cards
```

No canonical status may remain only in a dropdown/filter.

---

# 7. CANONICAL ORDERS KPI COMPOSITION

Required vertical composition:

```text
[ Всего заказов ]

ЖИЗНЕННЫЙ ЦИКЛ
[ reference-matched lifecycle flow ]

АЛЬТЕРНАТИВНЫЕ / REWORK STATES
[ WAITING_FOR_DATA ]
[ PARTIALLY_FULFILLED ]
[ READY_TO_CLOSE ]

ИСКЛЮЧЕНИЯ
[ PROBLEM ]
[ SUSPENDED ]
[ CANCELLED ]

СТАТУС ОПЛАТЫ
[ UNPAID ]
[ PARTIALLY_PAID ]
[ PAID ]
[ REFUNDED ]

ATTENTION
[ only real server-authoritative actionable queues ]

TOOLBAR

TABLE

PAGINATION
```

Do not flatten these into one undifferentiated KPI grid.

---

# 8. TOTAL KPI

Canonical label:

```text
Всего заказов
```

with AZ/EN equivalents.

Visual rule:

```text
- not full-width
- approximately 15–20% larger than ordinary non-lifecycle status KPI
- same Operations Center family
- click clears OrderStatus dimension
- page resets to 1
- URL updates
- server refresh
```

Do not use `Все заказы`.

---

# 9. HAPPY-PATH LIFECYCLE FLOW

The primary reference-matched process flow must use only truthful sequential transitions.

Canonical visual happy path:

```text
NEW
→ IN_PROCESSING
→ READY_FOR_BOOKING
→ SENT_TO_BOOKING
→ FULFILLED
→ CLOSED
```

These are the cards that should read visually as one process chain.

They should use the exact supplied reference-card shape.

---

# 10. DO NOT DRAW FALSE ARROWS

The following must remain visible but must NOT be forced into a false linear chain:

```text
WAITING_FOR_DATA
PARTIALLY_FULFILLED
READY_TO_CLOSE
PROBLEM
SUSPENDED
CANCELLED
```

Rules:

- `WAITING_FOR_DATA` is rework/alternative state.
- `PARTIALLY_FULFILLED` is an alternative fulfilment state.
- `READY_TO_CLOSE` is real but has no audited producer.
- `PROBLEM`, `SUSPENDED`, `CANCELLED` are exception/terminal-adjacent states.

No visual connector may imply a transition that the backend state machine does not support.

---

# 11. REFERENCE-MATCH CARD COMPONENT

Create a dedicated component, e.g.:

```tsx
<OrderLifecycleKpiCard />
```

and a flow wrapper, e.g.:

```tsx
<OrderLifecycleFlow />
<OrderLifecycleConnector />
```

Exact names may differ.

Do NOT implement lifecycle flow by styling the existing standard `CommerceKpiCard` into a generic rectangle if that loses the reference shape.

The dedicated component must encode the reference geometry intentionally.

---

# 12. REFERENCE GEOMETRY ACCEPTANCE

Before implementation, inspect the supplied image and document:

```text
reference card width
reference card height
width:height ratio
corner/radius/chamfer shape
left/right edge form
connector placement
arrow length
arrowhead geometry
horizontal gap
vertical gap
internal label offset
internal value offset
line-height
font scale
```

The report must include a measured/estimated reference geometry table.

Example report shape:

| Property | Reference | Implemented | Delta |
|---|---:|---:|---:|
| card aspect ratio | ... | ... | ... |
| card height | ... | ... | ... |
| horizontal gap | ... | ... | ... |
| connector centerline | ... | ... | ... |
| label top offset | ... | ... | ... |

Do not fabricate measurements if the image is unavailable.

---

# 13. DESKTOP FLOW COMPOSITION

At desktop width `1680`:

The happy-path lifecycle chain should visually resemble the supplied screenshot as closely as possible.

Requirements:

- cards read left-to-right as one process;
- connectors align optically;
- no connector floats too high/low;
- card shapes match;
- card widths/heights match the reference style;
- labels do not distort the card;
- values remain visually dominant;
- flow is centered/aligned consistently within Orders content width.

If the reference uses staggered/angled/chevron-like edges, reproduce them.

Do not normalize them into rounded rectangles.

---

# 14. TABLET / MOBILE FLOW

At narrower widths, semantic order must remain truthful.

Allowed:

```text
wrap the lifecycle chain
horizontal scroll for the process flow
responsive continuation
```

But:

- do not reorder statuses;
- do not drop connectors between still-adjacent happy-path cards;
- do not create arrows across wrapped rows that imply impossible geometry;
- do not turn exception cards into happy-path cards.

If the reference form does not scale cleanly to 390px, preserve the same silhouette with a responsive compact variant.

---

# 15. PAYMENT STATUS SOURCE OF TRUTH

Orders have a separate payment-status dimension.

Use the actual canonical `OrderPaymentStatus` values already audited:

```text
UNPAID
PARTIALLY_PAID
PAID
REFUNDED
```

Binding rule:

```text
4 actual OrderPaymentStatus
→ 4 visible payment-status KPI cards
```

Do not merge payment status into lifecycle status.

---

# 16. PAYMENT KPI GROUP

Required:

```text
СТАТУС ОПЛАТЫ

[ Не оплачено ]
[ Частично оплачено ]
[ Оплачено ]
[ Возвращено ]
```

Use actual canonical localized labels from source.

The payment cards are **standard KPI/status cards**, not reference lifecycle process cards.

No arrows.

Click:

```text
payment card
→ set paymentStatus
→ page=1
→ update URL
→ server-side table refresh
```

Selected state required.

---

# 17. ORDER REFUND STATUS — DO NOT FAKE

UI-C1.2 design contract includes a future RefundStatus group:

```text
REQUESTED
APPROVED
PROCESSED
FAILED
```

But Order-level refund aggregates were explicitly staged behind later backend/read-model work.

Therefore for UI-C1.2C:

```text
DO NOT fabricate Order refund KPI counts.
```

If current backend already exposes canonical server-authoritative Order refund aggregates, prove it and use them.

Otherwise:

```text
refund KPI group = DEFERRED TO UI-C1.2E/F/G
```

Document this explicitly.

---

# 18. ORDERS ATTENTION

Use only existing server-authoritative detector/filter semantics.

Potential real actionable conditions may include:

```text
PROBLEM
SUSPENDED
WAITING_FOR_DATA
other existing detector filters
```

But do not merely duplicate status cards as Attention.

Attention must represent:

```text
actionable queue / detector
not decorative status summary
```

Click:

```text
Attention
→ server detector/filter
→ page=1
→ URL state
→ table refresh
```

If no distinct real detector exists, omit the Attention zone with no empty container.

---

# 19. KPI CLICK CONTRACT

Lifecycle/status cards:

```text
click
→ status=<OrderStatus>
→ page=1
→ URL update
→ server-side list fetch
```

Payment cards:

```text
click
→ paymentStatus=<OrderPaymentStatus>
→ page=1
→ URL update
→ server-side list fetch
```

Total:

```text
click
→ clear lifecycle status
→ do not necessarily clear payment status unless canonical Total contract requires it
→ document exact behavior
```

Prefer explicit dimension reset behavior:

```text
Total Orders = clear lifecycle + payment filters
```

if "Всего заказов" semantically means the complete current non-status-filtered registry scope.

Document and test.

---

# 20. KPI ↔ TABLE SAME-SCOPE RULE

Orders should preserve the stronger existing pattern where lifecycle/payment aggregates are computed from the same filtered `where`.

Binding:

```text
ACTIVE FILTER/PERIOD
        ↓
same server-side where/query scope
     ↙             ↘
    KPI            TABLE
```

Do not regress Orders into the Requests interim model where KPI is global and table filtered.

Verify actual code.

If there is any current scope divergence, report it as P0 and do not disguise it.

---

# 21. SEARCH

Search first in toolbar.

Required:

```text
server-side
~350ms debounce
Enter immediate optional
clear → page=1
URL synchronized
loading does not block typing
```

No client-side table filtering.

---

# 22. TOOLBAR

Canonical order:

```text
[ Search ]
[ Lifecycle status ]
[ Payment status ]
[ Additional supported filters ]
[ Date type if supported ]
[ From ]
[ To ]
[ Reset ]
[ CSV ]
[ XLSX ]
```

Use only filters actually supported by backend.

Do not invent Date type if backend supports only `createdAt`.

If only createdAt exists:

```text
[ From ][ To ]
```

with clear semantics and Help/label.

---

# 23. PERIOD

Known audited Orders contract:

```text
date range = createdAt
```

If list and aggregates already share the same filtered `where`, expose the period.

Required:

```text
dateFrom/dateTo
→ same server query scope
→ KPI + table refresh together
```

Use half-open semantics `[from,to)` if that is the canonical backend behavior.

Document timezone.

If implementation discovers otherwise, do not guess.

---

# 24. URL STATE

Canonical implemented subset should include actual supported dimensions, e.g.:

```text
?search=
&status=
&paymentStatus=
&dateFrom=
&dateTo=
&page=
```

and sort if actually supported.

Requirements:

- direct URL works;
- reload restores filters;
- Back/Forward restores state;
- card clicks update URL;
- reset normalizes URL;
- no route-update loop;
- no incompatible hidden state outside URL for registry filters.

---

# 25. TABLE PRESERVATION

Preserve current Orders business table semantics.

Do not redesign:

```text
financial source of truth
D7 amounts
pricing/commission architecture
relation semantics
Order actions
```

UI-C1.2C is a registry migration.

No D5 action authority changes.

No D7 finance calculation changes.

---

# 26. MONEY / DATE PRESENTATION

Use canonical locale-aware formatting.

Do not:

```text
manual string concatenation
raw Decimal serialization
raw ISO date in UI unless intentionally designed
```

RU/AZ/EN parity required.

---

# 27. STATUS LABEL CONSISTENCY

For every OrderStatus and OrderPaymentStatus:

```text
KPI label
filter label
table badge
detail badge
Help label
```

must resolve to one canonical localized label source.

No raw enum strings visible.

---

# 28. HELP AFFORDANCE

Lifecycle cards should support the accepted Help/Business Dictionary direction.

Future/full Help remains UI-C1.2I, but touched cards should use stable semantic IDs where infrastructure exists.

For example:

```text
orders.status.new
orders.status.inProcessing
orders.payment.unpaid
```

Exact ID scheme must follow existing typed registry contract if already implemented.

Do not create a second ad hoc Help taxonomy.

---

# 29. ACCESSIBILITY

All clickable KPI cards must be real accessible controls.

Required:

- keyboard reachable;
- visible focus;
- selected state programmatic;
- arrow/connector itself not focusable unless interactive;
- connector hidden from screen readers if decorative;
- flow container has meaningful accessible label;
- status cards retain readable names;
- no click-only div;
- Help icon accessible.

---

# 30. REFERENCE CARD SHAPE + ACCESSIBILITY

The exact visual shape must not reduce hit-target usability.

Required minimum:

- whole card clickable;
- hit target remains practical;
- CSS clip-path / pseudo-elements must not remove keyboard focus outline visibility;
- if pseudo-elements create the reference silhouette, focus ring must follow or clearly surround the interactive card;
- no invisible overlay blocks adjacent card clicks.

---

# 31. RESPONSIVE QUALIFICATION

Mandatory widths:

```text
1680
768
390
```

At each width verify:

```text
Total
happy-path lifecycle flow
alternative/rework cards
exception cards
payment cards
toolbar
table
pagination
```

No page-level horizontal overflow.

If lifecycle flow uses its own horizontal scroll on mobile, it must be contained.

---

# 32. REFERENCE SIDE-BY-SIDE ACCEPTANCE — P0

Mandatory browser evidence:

```text
REFERENCE IMAGE
vs
IMPLEMENTED ORDERS LIFECYCLE
```

Same or closely comparable visual scale.

Report must explicitly compare:

```text
shape
silhouette
card proportions
connector geometry
arrow geometry
spacing
label/value placement
overall rhythm
```

Automatic VERDICT B if the report only says:

```text
"similar"
"same design language"
"used shared card component"
```

without visual comparison.

---

# 33. REFERENCE MATCH THRESHOLD

This is not pixel-perfect brand cloning from an external product; it is a user-approved internal visual target.

Acceptance standard:

```text
MAXIMALLY CLOSE WITHIN CURRENT TRAVELHUB DESIGN SYSTEM
```

Preserve TravelHub:

- typography family;
- accessibility;
- localization;
- permission behavior;
- responsive requirements.

But the **card form/silhouette and flow mechanics must remain recognizably the supplied reference**.

---

# 34. FOCUSED TESTS — REQUIRED

Add/adjust tests for:

1. 12/12 OrderStatus visible;
2. happy-path status order;
3. no false arrow to `READY_TO_CLOSE`;
4. no false arrows to exception states;
5. lifecycle card uses dedicated reference component/variant;
6. all happy-path cards rendered in flow;
7. all rework/alternative statuses rendered;
8. all exception statuses rendered;
9. 4/4 OrderPaymentStatus visible;
10. lifecycle card click applies server-side `status`;
11. payment card click applies `paymentStatus`;
12. selected lifecycle card state;
13. selected payment card state;
14. Total reset behavior;
15. URL state write/restore;
16. period behavior;
17. KPI/table same-scope behavior;
18. no client KPI counting;
19. no raw enum labels;
20. RU/AZ/EN;
21. accessible cards;
22. connector semantics/decorative ARIA;
23. responsive flow wrapper;
24. no Requests card regression;
25. no D5/D7 authority regression.

---

# 35. REGRESSION TESTS

Run:

```text
frontend typecheck
frontend build
focused Orders registry tests
Operations Center shell tests
Requests registry tests
commerce detail-system tests
frontend full suite
```

Run appropriate accepted D5/D6/D7 regression coverage.

No backend change is expected unless the current Orders registry implementation exposes a genuine blocker.

If backend expansion becomes necessary:

```text
STOP
REPORT GAP
DO NOT SILENTLY EXPAND SCOPE
```

---

# 36. BROWSER QUALIFICATION

Mandatory `/app/orders` checks at:

```text
1680
768
390
```

Verify:

- Operations Center shell;
- Orders active;
- `Всего заказов`;
- all 12 OrderStatus visible;
- happy-path flow;
- reference shape reproduced;
- connectors align;
- no false arrows;
- alternative/rework group;
- exception group;
- 4 payment status cards;
- selected lifecycle filtering;
- selected payment filtering;
- URL state;
- period;
- Reset;
- table refresh;
- no raw enum;
- RU/AZ/EN;
- no horizontal page overflow.

---

# 37. CROSS-PAGE VISUAL RULE

Do not force Orders cards to be the same size as Requests cards.

Binding:

```text
REQUESTS STATUS CARD SIZE
may differ from
ORDERS LIFECYCLE CARD SIZE
```

The Orders lifecycle reference determines its own dimensions/proportions.

This is intentional.

Do not "normalize" lifecycle cards to Requests merely for grid uniformity.

---

# 38. PAYMENTS CURRENCY CARDS — FUTURE CONTRACT, NOT C SCOPE

Do not implement `/app/payments` currency cards in UI-C1.2C.

But preserve the accepted future requirement:

```text
Payments registry will have:
- 6/6 PaymentStatus cards
- 4/4 RefundStatus cards
- separate compact Currency filter/KPI cards
```

Currency cards are a secondary filter dimension, not lifecycle/status cards.

Implementation belongs to Payments stages:

```text
UI-C1.2E/F/G
```

Do not mix them into Orders.

---

# 39. NON-SCOPE — HARD BLOCK

Do NOT implement:

```text
UI-C1.2D Bookings migration
UI-C1.2E general backend/read-model prerequisites
UI-C1.2F Payments full integration
UI-C1.2G cross-domain final KPI grouping beyond Orders work required here
UI-C1.2H global Attention/period reconciliation
UI-C1.2I full Help qualification
UI-C1.2J/K final closure
UI-C2
D8
pricing/commission redesign
new Order statuses
new Order transitions
new payment statuses
```

---

# 40. AUTOMATIC VERDICT B CONDITIONS

Return VERDICT B if any occur:

```text
- fewer than 12 OrderStatus cards visible
- happy path rendered as ordinary rectangular KPI cards instead of reference form
- card silhouette does not match the supplied reference
- simple "standard card + arrow icon" substitution
- no side-by-side reference comparison
- false arrow into READY_TO_CLOSE
- false arrow into exception states
- payment statuses mixed into lifecycle flow
- fewer than 4 OrderPaymentStatus cards visible
- raw enum text visible
- client-side status filtering
- KPI/table scope regresses
- Total becomes full-width hero
- Orders card dimensions forcibly normalized to Requests cards
- D5 action authority weakened
- D7 finance authority changed
- UI-C1.2D started
- UI-C2 started
- D8 started
```

---

# 41. STATUS COVERAGE MATRIX — REQUIRED

Report:

| OrderStatus | Visible KPI | Group | In flow? | Has incoming arrow? | Has outgoing arrow? | Localized label | Server count |
|---|---:|---|---:|---:|---:|---|---|
| NEW | YES | Happy path | YES | NO | YES | ... | ... |
| ... | ... | ... | ... | ... | ... | ... | ... |

All 12 must be YES.

---

# 42. PAYMENT COVERAGE MATRIX — REQUIRED

Report:

| OrderPaymentStatus | Visible KPI | Localized label | Filter param | Count source |
|---|---:|---|---|---|
| UNPAID | YES | ... | ... | server |
| PARTIALLY_PAID | YES | ... | ... | server |
| PAID | YES | ... | ... | server |
| REFUNDED | YES | ... | ... | server |

All 4 must be YES.

---

# 43. VISUAL REFERENCE MATCH MATRIX — REQUIRED

Report:

| Property | Reference | Implementation | Result |
|---|---|---|---|
| Card silhouette | ... | ... | PASS/FAIL |
| Edge/corner geometry | ... | ... | PASS/FAIL |
| Aspect ratio | ... | ... | PASS/FAIL |
| Connector form | ... | ... | PASS/FAIL |
| Arrowhead form | ... | ... | PASS/FAIL |
| Card gap | ... | ... | PASS/FAIL |
| Label placement | ... | ... | PASS/FAIL |
| Value placement | ... | ... | PASS/FAIL |
| Flow rhythm | ... | ... | PASS/FAIL |
| Responsive adaptation | ... | ... | PASS/FAIL |

Any P0 visual FAIL:

```text
VERDICT B
```

---

# 44. BEFORE / AFTER EVIDENCE

Required:

```text
BEFORE UI-C1.2C
- shell-wrapped Orders registry
- flat/transitional lifecycle/payment KPI presentation

AFTER UI-C1.2C
- reference-matched lifecycle process cards
- truthful happy-path connectors
- separate alternative/rework group
- separate exceptions group
- separate 4-card payment-status group
- canonical toolbar/table/pagination
```

Include desktop screenshots and the reference comparison.

---

# 45. GIT HARD CLOSURE

Required:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Acceptance:

```text
porcelain = empty
HEAD == origin/master
one canonical 40-char SHA
```

---

# 46. REQUIRED REPORT STRUCTURE

```text
1. Executive Summary
2. Accepted Baseline
3. Implementation Scope
4. Visual Reference Availability
5. Reference Geometry Audit
6. OrderStatus Source of Truth
7. State-Machine Truth
8. Total KPI
9. Lifecycle Flow Architecture
10. Reference-Matched Card Component
11. Happy-Path Flow
12. Alternative/Rework States
13. Exception States
14. No-False-Arrow Proof
15. OrderPaymentStatus Source of Truth
16. Payment KPI Group
17. Refund Deferral / Authority
18. Attention
19. KPI Click Contract
20. KPI ↔ Table Scope
21. Search
22. Filters
23. Period
24. URL State
25. Toolbar
26. Reset
27. Table Preservation
28. Money / Date Formatting
29. Status Label Consistency
30. Help
31. i18n
32. Accessibility
33. Responsive
34. Focused Tests
35. Regression Tests
36. Browser Qualification
37. Reference Side-by-Side Evidence
38. Status Coverage Matrix
39. Payment Coverage Matrix
40. Visual Reference Match Matrix
41. Before / After Evidence
42. Security Preservation
43. Non-Scope Verification
44. Git Hard Closure
45. Final Verdict
46. TRUE NEXT
```

---

# 47. REQUIRED FINAL VERDICT

If all gates pass:

```text
VERDICT A — UI-C1.2C
ORDERS REGISTRY MIGRATION
PRODUCTION IMPLEMENTATION ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — ACCEPTED
UI-C1.2A — ACCEPTED
UI-C1.2B — ACCEPTED

UI-C1.2C — ACCEPTED

FINAL SHA:
<40-char SHA>

ORDER STATUS KPI COVERAGE — 12/12
ORDER PAYMENT KPI COVERAGE — 4/4
REFERENCE LIFECYCLE CARD SHAPE — PASS
REFERENCE CONNECTOR GEOMETRY — PASS
NO FALSE LIFECYCLE ARROWS — PASS
KPI/TABLE SERVER SCOPE — PASS
VISIBLE UI CHANGE — CONFIRMED

UI-C1.2D — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2D — BOOKINGS REGISTRY MIGRATION
```

If any P0 fails:

```text
VERDICT B — UI-C1.2C
ORDERS REGISTRY MIGRATION FAILED

UI-C1.2C — NOT ACCEPTED
UI-C1.2D — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

---

# 48. FINAL BINDING PRINCIPLE

```text
ORDERS LIFECYCLE
IS A PROCESS VISUALIZATION,
NOT A FLAT KPI GRID.
```

```text
THE SUPPLIED REFERENCE
IS THE VISUAL SOURCE OF TRUTH
FOR THE LIFECYCLE CARD SHAPE.
```

```text
MATCH:
SHAPE
SILHOUETTE
PROPORTIONS
CONNECTORS
ARROWS
SPACING
INTERNAL COMPOSITION
```

while preserving:

```text
TravelHub business truth
real OrderStatus transitions
server-side filtering
RBAC
workspace/tenant isolation
D5
D7
accessibility
RU/AZ/EN
```
