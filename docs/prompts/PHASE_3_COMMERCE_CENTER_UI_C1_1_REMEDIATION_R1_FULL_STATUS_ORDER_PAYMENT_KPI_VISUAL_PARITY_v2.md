# PHASE 3 — COMMERCE CENTER UI CONSISTENCY — UI-C1.1 REMEDIATION R1 — FULL STATUS KPI + ORDER PAYMENT KPI + VISUAL PARITY

## ROLE — MANDATORY

Ты работаешь как **Staff/Principal Full-Stack Engineer + Enterprise SaaS UX Architect + Data Contract Reviewer + Security/RBAC Reviewer + QA/Release Engineer**.

Это remediation уже выполненного, но **НЕ ПРИНЯТОГО** UI-C1.1. Нельзя переходить к UI-C2, пока remediation не закрыт.

---

# 1. CANONICAL CURRENT STATUS

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

UI-C1 — ACCEPTED
UI-C1 FINAL SHA:
e839ede70d2b2736b24f9ebf95bc1f05bc4c1c31

UI-C1.1 — NOT ACCEPTED
VERDICT B

UI-C1.1 reported implementation SHA:
a531346
```

Причины непринятия UI-C1.1:

```text
1. Bookings registry still has no KPI zone
2. KPI visual parity across Requests / Orders / Bookings not achieved
3. Detail section-card migration is partial
4. Search/filter ordering is inconsistent/not proven
5. Live-search/no-search-button contract not implemented/proven
6. Git lineage/final SHA evidence incomplete
```

---

# 2. NEW CANONICAL KPI PRODUCT DECISION

Для Commerce Center принимается:

```text
REQUESTS
→ KPI card for TOTAL
→ KPI card for EVERY canonical Request lifecycle status

ORDERS
→ KPI card for TOTAL
→ KPI card for EVERY canonical Order lifecycle status
→ SEPARATE ADDITIONAL KPI GROUP for EVERY canonical Order payment status/type

BOOKINGS
→ KPI card for TOTAL
→ KPI card for EVERY canonical Booking lifecycle status
```

Мы больше НЕ ограничиваемся агрегированными 4–6 KPI-карточками. Все фактические состояния объекта должны быть видны отдельными KPI cards.

---

# 3. SOURCE OF TRUTH — DO NOT INVENT STATUSES

Перед реализацией определить actual canonical enums/backend contracts из repo:

```text
Prisma schema
DTOs
backend domain/state-machine services
query services
existing filters
existing i18n status maps
tests
```

Нельзя придумывать status, использовать устаревший UI-only status, создавать aliases без backend contract или считать status frontend heuristics.

Report exact source file + enum values.

---

# 4. REQUEST STATUS KPI CONTRACT

По текущему UI известны:

```text
NEW
CHECKING
SUPPLIER_TIMEOUT
PRICE_CHANGED
CUSTOMER_ACCEPTED
CONFIRMED
CONVERTED
REJECTED
UNAVAILABLE
EXPIRED
CUSTOMER_PAYMENT_TIMEOUT
CANCELLED_BY_CUSTOMER
```

Но source inspection обязателен.

После подтверждения:

```text
TOTAL
+
one KPI card per every canonical Request status
```

Если canonical enum отличается — использовать actual backend truth.

---

# 5. BOOKING STATUS KPI CONTRACT

Known accepted BookingStatus contract:

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

Mandatory:

```text
TOTAL
+
one KPI card per every canonical Booking status
```

Если current repo реально противоречит accepted canonical contract — STOP и report contradiction.

---

# 6. ORDER STATUS KPI CONTRACT

Перед реализацией подтвердить actual canonical OrderStatus enum.

Known lifecycle statuses include at least:

```text
NEW
IN_PROCESSING
WAITING_FOR_DATA
READY_FOR_BOOKING
SENT_TO_BOOKING
PARTIALLY_FULFILLED
FULFILLED
READY_FOR_CLOSURE
PROBLEM
SUSPENDED
CLOSED
CANCELLED
```

Mandatory:

```text
TOTAL
+
one KPI card per every canonical Order lifecycle status
```

Grouped cards вроде `Активные` не могут заменять карточки по каждому status. Если aggregate cards сохраняются, они только дополнительные.

---

# 7. ORDER PAYMENT KPI GROUP — MANDATORY

В Orders должна появиться отдельная группа:

```text
СТАТУСЫ ОПЛАТЫ
```

Она НЕ смешивается с lifecycle statuses.

Mandatory:

```text
one KPI card per every canonical payment status/type
```

Перед реализацией подтвердить actual payment enum/canonical payment state model из backend.

Примеры `UNPAID / PARTIALLY_PAID / PAID / REFUNDED / PARTIALLY_REFUNDED` НЕ использовать без подтверждения repo.

Если payment status derived/read-model — использовать backend-authoritative contract.

---

# 8. TOTAL VS STATUS CARDS

`TOTAL` — aggregate/superset, не mutually exclusive bucket.

Lifecycle:

```text
sum(all canonical lifecycle status counts) = TOTAL
```

только если каждая entity имеет ровно один lifecycle status и scope одинаков.

Payment cards reconcile отдельно. Lifecycle и payment counts между собой не суммировать.

---

# 9. KPI VISUAL GROUPING

## Requests

```text
ЗАЯВКИ
[ TOTAL ]

СТАТУСЫ ЗАЯВОК
[ status ][ status ][ ... ]
```

## Orders

```text
ЗАКАЗЫ
[ TOTAL ]

СТАТУСЫ ЗАКАЗОВ
[ status ][ status ][ ... ]

СТАТУСЫ ОПЛАТЫ
[ payment ][ payment ][ ... ]
```

## Bookings

```text
БРОНИРОВАНИЯ
[ TOTAL ]

СТАТУСЫ БРОНИРОВАНИЙ
[ status ][ status ][ ... ]
```

Использовать один shared Commerce KPI visual language.

---

# 10. KPI CARD VISUAL SYSTEM

Use/reuse `<CommerceKpiCard />` или repo-compatible equivalent.

All cards share:

```text
same height strategy
same padding
same radius
same border/background
same label typography
same value typography
same meta style
same hover/focus
same selected state
same responsive behavior
```

Разрешены semantic status/payment colors, но geometry/typography едины.

---

# 11. KPI DRILL-DOWN

Каждая status KPI card должна быть drill-down capable:

```text
click status card
→ apply exact server-side status filter
→ page = 1
→ table refresh
```

Total:

```text
click TOTAL
→ clear lifecycle status filter
→ preserve unrelated filters
→ page = 1
```

Order payment KPI:

```text
click payment card
→ apply exact server-side payment filter
→ page = 1
```

No client-side filtering. Selected card state обязателен.

---

# 12. SEARCH / FILTER CANONICAL ORDER

Across `/app/requests`, `/app/orders`, `/app/bookings`:

```text
1. SEARCH
2. PRIMARY STATUS FILTER
3. ADDITIONAL BUSINESS FILTERS
4. PAYMENT FILTER (Orders)
5. DATE RANGE
6. RESET/CLEAR if applicable
7. EXPORT / UTILITY ACTIONS
```

Search всегда первый control.

---

# 13. LIVE SEARCH — NO SEARCH BUTTON

Canonical behavior:

```text
NO explicit "Поиск/Search" button
```

Server-side live search with debounce:

```text
input
→ draft query
→ debounce ~300–400 ms
→ page = 1
→ server request
→ table refresh
```

Requirements:

```text
typing automatically searches
clear automatically refreshes
query change resets page to 1
Enter may trigger immediate search
input remains editable while loading
stale response cannot overwrite newer query
```

---

# 14. FILTER INTERACTION CONSISTENCY

Status/payment/date filter changes:

```text
→ apply immediately
→ page = 1
→ server request
```

Requests / Orders / Bookings должны ощущаться одной filtering system.

---

# 15. DETAIL CARD COMPLETION

Previous UI-C1.1 only partially migrated detail sections.

Для каждого visible card/section in:

```text
/app/requests/[id]
/app/orders/[id]
/app/bookings/[id]
```

classify:

```text
A. shared EntitySectionCard / EntityField
B. intentionally different semantic container
```

Для B — explicit rationale.

Equivalent business-information cards must share canonical card title, label/value typography, padding, grid and gaps.

---

# 16. REGISTRY VISUAL PARITY

All three registries share:

```text
page header grammar
KPI grammar
toolbar grammar
table grammar
pagination grammar
spacing rhythm
```

Количество KPI может отличаться, но страницы должны выглядеть sibling pages одного Commerce Center.

---

# 17. RESPONSIVE KPI GRID

Because cards cover every status:

```text
desktop → multi-column responsive grid
tablet  → fewer columns
mobile  → 1–2 columns depending usable width
```

No horizontal overflow, unreadably small text, clipped labels or collisions.

---

# 18. BACKEND KPI AUTHORITY

All counts server-authoritative.

Forbidden:

```text
fetch full list and count client-side
count current page rows
derive counts from visible table
duplicate formulas in frontend
one API request per card
```

Prefer one aggregate response per registry.

Zero-count canonical statuses MUST still return/render as cards.

---

# 19. WORKSPACE / TENANT SECURITY

Every aggregation respects:

```text
workspace context
tenant/partner scope
RBAC
business context
```

No client-supplied partnerId authority. Cross-context must not leak counts.

---

# 20. KPI FILTER RECONCILIATION

Define one canonical rule for how KPI counts react to:

```text
workspace/tenant
date range
search
business filters
selected lifecycle status
selected payment status
```

Apply consistently across all 3 registries and document.

---

# 21. I18N / ACCESSIBILITY

Every KPI label: RU/AZ/EN.

Clickable KPI cards must have button/link semantics, keyboard access, visible focus, accessible selected state.

No raw enum names in visible UI where localized label exists.

---

# 22. BROWSER QUALIFICATION — REQUIRED

For Requests / Orders / Bookings verify:

```text
TOTAL visible
all canonical lifecycle status cards visible
zero-count cards visible
counts populated from backend
card click filters table
selected state visible
search first
no Search button
live search works
filters auto-apply
```

Orders additionally:

```text
all canonical payment cards visible
payment KPI group separate
payment card filters table correctly
```

Bookings hard gate:

```text
KPI zone MUST now exist
```

---


# 22A. CANONICAL STATUS NAMING PARITY — MANDATORY

Для каждого canonical lifecycle/payment status должен существовать **один canonical business label на язык**, используемый согласованно на всех Commerce surfaces.

Required surfaces:

```text
KPI CARD
FILTER OPTION
TABLE STATUS BADGE
DETAIL PAGE STATUS BADGE
```

Canonical rule:

```text
ONE CANONICAL STATUS CODE
        ↓
ONE CANONICAL BUSINESS TERM PER LOCALE
        ├── KPI card
        ├── filter
        ├── table badge
        └── detail badge
```

Это применяется отдельно к:

```text
Request lifecycle statuses
Order lifecycle statuses
Order payment statuses/types
Booking lifecycle statuses
```

Нельзя иметь для одного canonical code неосознанно разные термины, например:

```text
CONFIRMED

KPI:      Подтверждены
Filter:   Подтвержденные
Table:    Подтверждено
Detail:   Подтвержден
```

если продуктовый контракт не предусматривает отдельные грамматические display variants.

По умолчанию для этого remediation:

```text
KPI label
=
Filter label
=
Table badge label
=
Detail badge label
```

для одного status code и locale.

`TOTAL` является aggregate metric, а не status, поэтому:

```text
Всего заявок
Всего заказов
Всего бронирований
```

не подпадает под status-label equality.

---

# 22B. SINGLE I18N / BUSINESS LABEL AUTHORITY

Не хранить независимые literal labels для одного статуса в:

```text
KPI component
filter component
table
detail page
```

Использовать один canonical i18n/business mapping либо единый shared resolver, совместимый с существующей архитектурой.

Required:

```text
status code
→ canonical localization key/resolver
→ RU/AZ/EN label
→ all surfaces consume same authority
```

Не создавать параллельную status dictionary только ради KPI.

Если current code содержит conflicting labels, выполнить inventory и reconcile их.

---

# 22C. ORDER LIFECYCLE VS PAYMENT NAMING

В Orders поддерживать два независимых naming domains:

```text
ORDER LIFECYCLE STATUS
KPI ↔ lifecycle filter ↔ table lifecycle badge ↔ detail lifecycle badge

ORDER PAYMENT STATUS/TYPE
KPI ↔ payment filter ↔ table payment badge ↔ detail payment badge
```

Не использовать payment terminology для lifecycle и наоборот.

Если таблица или detail page сейчас не показывает payment status там, где соответствующая поверхность отсутствует, не добавлять бессмысленный duplicate badge только ради symmetry; report `N/A` with rationale.

Но на всех реально существующих surfaces термин должен совпадать.

---

# 22D. STATUS NAMING RECONCILIATION MATRIX

Report complete matrix:

| Entity/Domain | Canonical Code | KPI RU | Filter RU | Table RU | Detail RU | KPI AZ | Filter AZ | Table AZ | Detail AZ | KPI EN | Filter EN | Table EN | Detail EN | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

Matrix must cover:

```text
every Request lifecycle status
every Order lifecycle status
every Order payment status/type
every Booking lifecycle status
```

Allowed result:

```text
PASS
N/A — surface genuinely does not exist/apply
FAIL
```

Every `N/A` requires exact rationale.

No canonical status may be omitted.

---

# 22E. NAMING HARD GATES

Mandatory:

```text
No raw enum visible where localized business label exists
No KPI-only synonym
No filter-only synonym
No table-only synonym
No detail-only synonym
RU parity
AZ parity
EN parity
```

If a deliberate grammatical variant is truly required, it must be:

```text
explicitly documented
derived from the same canonical semantic definition
tested
consistent by surface across all entities
```

Do not introduce grammatical variants casually during this remediation.


# 23. SCREENSHOT EVIDENCE

Capture:

```text
Requests registry — KPI + toolbar
Orders registry — lifecycle KPI + payment KPI + toolbar
Bookings registry — KPI + toolbar
```

At least desktop + representative responsive evidence.

---

# 24. RECONCILIATION TABLES

Lifecycle:

| Entity | Canonical Status | Backend source | RU | AZ | EN | Count | Drill-down filter |
|---|---|---|---|---|---|---:|---|

Orders payment:

| Canonical Payment Status/Type | Backend source | RU | AZ | EN | Count | Drill-down filter |
|---|---|---|---|---|---:|---|

No canonical status may be omitted.

---

# 25. SEARCH/FILTER QUALIFICATION TABLE

| Registry | Search first | Search button absent | Debounce | Clear refresh | Page reset | Status auto | Payment auto | Date behavior |
|---|---|---|---|---|---|---|---|---|
| Requests | | | | | | | N/A | |
| Orders | | | | | | | | |
| Bookings | | | | | | | N/A | |

---

# 26. DETAIL CARD PARITY TABLE

| Section | Request | Order | Booking | Shared primitive | Exact exception/rationale |
|---|---|---|---|---|---|

Cover all visible detail sections.

---

# 27. TESTS — MANDATORY

Backend:

```text
Request aggregate counts by every status
Order aggregate counts by every lifecycle status
Order aggregate counts by every payment status/type
Booking aggregate counts by every status
workspace/tenant isolation
filter/date/search scope
zero-count statuses returned
reconciliation to total
```

Frontend:

```text
all status cards render
zero-count cards render
Order payment group renders
card selection applies exact filter
search debounce
clear search
page reset
no Search submit button
status/payment filters auto-apply
```

---

# 28. REGRESSION GATES

Run actual repo commands:

```text
frontend typecheck
frontend build
frontend relevant tests
D5 regression
D6 regression
D7 regression
```

Preserve D5/D6/D7 authority and SEC-UI-01 remains open.

---

# 29. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_COMMERCE_CENTER_UI_C1_1_REMEDIATION_R1_FULL_STATUS_PAYMENT_KPI_VISUAL_PARITY_REPORT.md
```

Required sections:

1. Executive Summary
2. Canonical Baseline
3. Starting Git State
4. Git Lineage Reconciliation
5. Actual Request Status Source
6. Actual Order Status Source
7. Actual Booking Status Source
8. Actual Order Payment Status Source
9. KPI Backend Contract
10. Requests KPI Implementation
11. Orders Lifecycle KPI Implementation
12. Orders Payment KPI Implementation
13. Bookings KPI Implementation
14. KPI Drill-down
15. KPI Reconciliation
16. Search/Filter Canonical Contract
17. Live Search Implementation
18. Detail Card Completion
19. Registry Visual Parity
20. Responsive Qualification
21. i18n
22. Accessibility
23. Security/Scope Preservation
24. Tests
25. Regression/Build Results
26. Browser Qualification
27. Screenshot Evidence
28. Lifecycle Reconciliation Table
29. Payment Reconciliation Table
30. Search/Filter Qualification Table
31. Detail Card Parity Table
32. Status Naming Reconciliation Matrix
33. File Change Inventory
34. Acceptance Matrix
35. Findings
36. Git Hard Closure
37. Final Verdict
38. TRUE NEXT

---

# 30. ACCEPTANCE MATRIX — DO NOT SHORTEN

| Gate | Result | Exact Evidence |
|---|---|---|
| UI-C1 accepted baseline preserved | | |
| UI-C1.1 prior commit lineage reconciled | | |
| Actual Request status enum/source proven | | |
| Actual Order status enum/source proven | | |
| Actual Booking status enum/source proven | | |
| Actual Order payment enum/source proven | | |
| Requests TOTAL card implemented | | |
| Requests card for every canonical status | | |
| Requests zero-count statuses visible | | |
| Orders TOTAL card implemented | | |
| Orders card for every canonical lifecycle status | | |
| Orders zero-count lifecycle statuses visible | | |
| Orders separate payment KPI group implemented | | |
| Orders card for every canonical payment status/type | | |
| Orders zero-count payment statuses visible | | |
| Bookings KPI zone implemented | | |
| Bookings TOTAL card implemented | | |
| Bookings card for every canonical Booking status | | |
| Bookings zero-count statuses visible | | |
| No canonical lifecycle status omitted | | |
| No canonical payment status omitted | | |
| No invented status | | |
| No client-side KPI counting | | |
| No current-page counting | | |
| No one-request-per-card N+1 | | |
| KPI counts server-authoritative | | |
| KPI tenant/workspace scope enforced | | |
| Cross-context count leakage absent | | |
| Lifecycle totals reconcile | | |
| Payment totals reconcile by documented rule | | |
| KPI drill-down server-side | | |
| KPI click resets page to 1 | | |
| Selected KPI state visible | | |
| Search is first — Requests | | |
| Search is first — Orders | | |
| Search is first — Bookings | | |
| No Search button — Requests | | |
| No Search button — Orders | | |
| No Search button — Bookings | | |
| Live server-side search — Requests | | |
| Live server-side search — Orders | | |
| Live server-side search — Bookings | | |
| Search debounce proven | | |
| Clear search auto-refresh proven | | |
| Search change page reset proven | | |
| Status filters auto-apply consistently | | |
| Order payment filter auto-applies | | |
| Toolbar ordering unified | | |
| Request detail cards fully classified/migrated | | |
| Order detail cards fully classified/migrated | | |
| Booking detail cards fully classified/migrated | | |
| Shared card geometry across detail pages | | |
| Shared card title typography | | |
| Shared field label typography | | |
| Shared field value typography | | |
| Requests registry browser PASS | | |
| Orders registry browser PASS | | |
| Bookings registry browser PASS | | |
| Bookings KPI visible in browser | | |
| Orders payment KPI visible in browser | | |
| Dense KPI grid responsive | | |
| No horizontal overflow | | |
| Canonical status naming source established | | |
| Request KPI/filter/table/detail labels reconciled | | |
| Order lifecycle KPI/filter/table/detail labels reconciled | | |
| Order payment KPI/filter/table/detail labels reconciled | | |
| Booking KPI/filter/table/detail labels reconciled | | |
| No KPI-only status synonyms | | |
| No filter-only status synonyms | | |
| No table-only status synonyms | | |
| No detail-only status synonyms | | |
| No raw enum visible where localized label exists | | |
| Status Naming Reconciliation Matrix complete | | |
| RU status naming parity PASS | | |
| AZ status naming parity PASS | | |
| EN status naming parity PASS | | |
| RU PASS | | |
| AZ PASS | | |
| EN PASS | | |
| Accessibility PASS | | |
| Backend targeted KPI tests PASS | | |
| Frontend targeted KPI/search tests PASS | | |
| Frontend typecheck PASS | | |
| Frontend build PASS | | |
| D5 regression PASS | | |
| D6 regression PASS | | |
| D7 regression PASS | | |
| SEC-UI-01 remains open | | |
| UI-C2 NOT started | | |
| Help implementation NOT started | | |
| D8 NOT started | | |
| Final porcelain empty | | |
| HEAD == origin/master | | |
| One canonical 40-char Final SHA | | |

Any critical gate FAIL or NOT PROVEN → VERDICT B.

---

# 31. GIT HARD CLOSURE

Before final commit:

```bash
git status --short
git status --porcelain=v1
git diff --stat
git diff --check
```

Commit only remediation scope + report, push, then:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -8 --oneline
```

Required:

```text
porcelain EMPTY
HEAD == origin/master
FULL 40-CHAR SHA
```

Do NOT report short SHA as canonical Final SHA.

---

# 32. VERDICT A

Only when all critical gates pass:

```text
VERDICT A — UI-C1.1 REMEDIATION R1 — FULL STATUS KPI + ORDER PAYMENT KPI + VISUAL PARITY PASSED

UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED AFTER REMEDIATION

FINAL SHA:
<one full canonical 40-char SHA>

TRUE NEXT:
UI-C2 — COMMERCE RELATION CHAIN

D8 — NOT STARTED
```

Then STOP.

---

# 33. VERDICT B

If any critical gate fails:

```text
VERDICT B — UI-C1.1 REMEDIATION R1 FAILED

UI-C1 — REMAINS ACCEPTED
UI-C1.1 — NOT ACCEPTED

TRUE NEXT:
UI-C1.1 REMEDIATION R2

UI-C2 — NOT STARTED
D8 — NOT STARTED
```

List exact blockers and STOP.

---

# 34. HARD STOP

After remediation report and Git closure:

```text
STOP
```

Do not start UI-C2 in the same run.
