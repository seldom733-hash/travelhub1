# PHASE 3 — STEP 3.5 — PLATFORM CRM
## ROUND 4 — DEDICATED 360 PAGES / DEEP LINKS / ENTITY REFERENCE NAVIGATION CONTRACT
## CUSTOMER 360 + PARTNER 360 + CLICKABLE SERVICES / ORDERS / BOOKINGS
## FINAL UX NAVIGATION REMEDIATION

---

# 1. PURPOSE

Platform CRM Round 3 is accepted as:

```text
PLATFORM CRM FINAL CLOSED
```

from a data-depth / placeholder / runtime perspective.

Before moving to Storefront Pro CRM, apply one final UX/navigation improvement:

```text
Customer 360
Partner 360
```

should become first-class dedicated pages rather than being limited to an embedded side panel/detail pane.

Additionally, entity references inside CRM tables should become navigable using real URLs.

This remediation establishes a reusable CRM navigation pattern that can later be applied to Storefront Pro CRM.

---

# 2. GOALS

Implement:

```text
CRM → Клиенты → Customer 360 dedicated page
CRM → Партнёры → Partner 360 dedicated page
```

with:

```text
stable deep links
breadcrumbs
browser Back/Forward support
refresh-safe routing
new-tab behavior
clickable entity references
```

Also implement a project-level UX contract for entity references used in CRM tables:

```text
Service   → Service detail
Order     → Order detail
Booking   → Booking detail
Customer  → Customer 360
Partner   → Partner 360
```

where canonical detail routes already exist.

---

# 3. DO NOT USE MODAL AS PRIMARY 360 SURFACE

Do NOT convert Customer 360 / Partner 360 into a modal.

Reason:

```text
360 pages contain multiple tabs
embedded tables
cross-links
deep-link value
browser navigation
potential future expansion
```

A modal or narrow side panel is not the correct primary workspace.

---

# 4. DEDICATED ROUTES

Preferred conceptual routes:

```text
/app/crm/customers/:id
/app/crm/partners/:id
```

BUT:

Do not force these exact paths if the application already has a canonical route convention.

First inspect current routing.

Required outcome:

```text
one stable dedicated route per Customer
one stable dedicated route per Partner
```

---

# 5. CURRENT LIST PAGES

Keep top-level CRM navigation:

```text
CRM
├── Клиенты
└── Партнёры
```

Do NOT add:

```text
Customer 360
Partner 360
```

as top-level tabs.

---

# 6. LIST → DETAIL FLOW

From:

```text
CRM → Клиенты
```

click customer identity → dedicated Customer 360.

From:

```text
CRM → Партнёры
```

click partner identity → dedicated Partner 360.

Use real `<Link>` / framework link semantics.

Avoid purely imperative `onClick` navigation for core entity links.

---

# 7. CUSTOMER 360 PAGE

Dedicated page must preserve Round 3 functionality:

```text
Обзор
Заказы
Бронирования
Платежи
Партнёрские связи
Возвраты
История
```

No data regression.

---

# 8. PARTNER 360 PAGE

Dedicated page must preserve Round 3 functionality:

```text
Обзор
Услуги
Заказы
Бронирования
Клиенты
Витрина
```

No placeholder regression.

---

# 9. BREADCRUMBS

Use the existing breadcrumb architecture if present.

Customer example:

```text
CRM / Клиенты / Marie Park
```

Partner example:

```text
CRM / Партнёры / Absheron Peninsula Tours
```

Breadcrumbs must be actual navigation where appropriate.

---

# 10. BACK NAVIGATION

Dedicated pages should support:

```text
browser Back
browser Forward
refresh
deep link
```

Do not rely only on a custom "Назад" button.

A visible back affordance may be added if consistent with design system, but browser history must work naturally.

---

# 11. REFRESH-SAFE ENTITY SELECTION

Current entity selection must be encoded in URL.

Forbidden:

```text
selectedCustomer state only in React memory
selectedPartner state only in React memory
```

because refresh must not lose context.

---

# 12. NEW TAB SUPPORT

Core entity references must support native browser semantics:

```text
Ctrl + click
Cmd + click
Middle click
Open link in new tab
```

Use actual links.

---

# 13. ENTITY REFERENCE NAVIGATION CONTRACT

Establish this UX rule for CRM:

```text
Entity identifier and/or primary entity name
→ clickable when a canonical detail route exists
```

Examples:

```text
Customer code/name → Customer 360
Partner code/name → Partner 360
Order code         → Order Detail
Booking code       → Booking Detail
Service code/name  → Service/Product Detail
```

Do NOT make every cell clickable.

---

# 14. CLICKABLE FIELDS — SERVICES

In Partner 360 → Услуги:

Make canonical entity reference clickable.

Preferred:

```text
service code
service title/name
```

Both may point to the same canonical service detail if that matches current UX.

Do not make:

```text
status
type
dates
prices
```

into links unless they represent another canonical entity.

---

# 15. CLICKABLE FIELDS — ORDERS

In:

```text
Customer 360 → Заказы
Partner 360  → Заказы
```

make at least:

```text
order number/code
```

a link to canonical Order Detail.

If customer/partner name is also shown and links to its own entity, that is acceptable.

---

# 16. CLICKABLE FIELDS — BOOKINGS

In:

```text
Customer 360 → Бронирования
Partner 360  → Бронирования
```

make at least:

```text
booking number/code
```

a link to canonical Booking Detail.

---

# 17. CLICKABLE FIELDS — CUSTOMERS

In Partner 360 → Клиенты:

```text
customer code/name
→ Customer 360
```

---

# 18. CLICKABLE FIELDS — PARTNERS

In Customer 360 → Партнёрские связи:

```text
partner code/name
→ Partner 360
```

where Platform role has permission.

---

# 19. PAYMENTS / REFUNDS

Do not invent new Payment/Refund detail pages.

If canonical detail destination already exists:

```text
payment reference → canonical payment detail
refund reference  → canonical refund detail
```

Otherwise:

```text
related order/payment reference
→ existing canonical destination
```

Do not create dead links.

---

# 20. SERVICE DETAIL ROUTE

Before linking Service:

Discover actual canonical product/service detail route.

Possible domains may include:

```text
Catalog
Product
Service
Tour
Accommodation
other service entity
```

Do not hardcode a guessed route.

---

# 21. ORDER DETAIL ROUTE

Discover actual canonical Platform Order detail route.

Do not link to a broad filtered Orders list if a real detail route exists.

If no detail route exists:

```text
report gap
```

Do not fabricate a fake detail page solely for this remediation unless explicitly approved.

---

# 22. BOOKING DETAIL ROUTE

Same rule:

```text
use canonical Booking detail
```

or document missing capability.

---

# 23. ACTIVE CRM NAVIGATION STATE

When user is on:

```text
/app/crm/customers/:id
```

CRM / Клиенты context should remain visibly active.

When user is on:

```text
/app/crm/partners/:id
```

CRM / Партнёры context should remain visibly active.

Do not lose left-sidebar active state because route is deeper.

---

# 24. TAB ROUTING

Evaluate whether 360 tabs should be URL-addressable.

Preferred if consistent with current app:

```text
/app/crm/customers/:id?tab=orders
```

or nested route equivalent.

Benefits:

```text
share exact tab
refresh preserves tab
Back/Forward works
```

Do not introduce complex nested routing if current architecture already has a simpler stable pattern.

At minimum:

```text
entity deep link is mandatory
tab deep link is strongly preferred
```

---

# 25. DEFAULT TAB

Default 360 tab:

```text
Обзор
```

Must work on direct route load.

---

# 26. INVALID TAB

If URL contains unsupported tab:

```text
fallback safely to Overview
```

or current route convention.

No blank page/runtime crash.

---

# 27. ENTITY NOT FOUND

Dedicated route:

```text
unknown customer
unknown partner
```

must show canonical `404 / not found` behavior.

Do not silently return list or empty 360.

---

# 28. FORBIDDEN

Unauthorized role accessing deep link:

```text
→ canonical forbidden behavior
```

Frontend route accessibility does not bypass backend permissions.

---

# 29. DEEP LINK SECURITY

Direct URL to:

```text
Customer 360
Partner 360
```

must invoke same backend authorization as list-origin navigation.

No IDOR.

---

# 30. DATA LOADING

Dedicated page must fetch entity by route id.

Do not depend on data previously loaded in the list.

---

# 31. SIDE PANEL — OPTIONAL FUTURE ROLE

Current side panel/detail pane does not need to survive as the primary path.

Options:

```text
A. remove it
B. keep only as Quick Preview
```

For this remediation, prefer the simplest coherent UX.

Do NOT maintain two competing full 360 implementations.

If Quick Preview remains:

```text
summary only
+ "Открыть Customer 360"
+ "Открыть Partner 360"
```

Full tabbed 360 belongs on dedicated page.

---

# 32. NO DUPLICATE 360 COMPONENTS

Reuse extracted/shared Customer360 / Partner360 components where practical.

Do not maintain:

```text
Customer360Panel
Customer360Page
```

with duplicated business logic.

Prefer shared content component with page wrapper if needed.

---

# 33. TABLE ROW CLICK POLICY

Do not make full table row click mandatory if it conflicts with text selection/action controls.

Preferred core contract:

```text
primary entity reference is a link
```

A full-row click may be retained only if it does not break accessibility or nested controls.

---

# 34. VISUAL LINK AFFORDANCE

Entity references should look interactive.

Use existing design system.

Avoid:

```text
plain text that secretly has onClick
```

Required:

```text
keyboard focus
hover/focus state
link semantics
```

---

# 35. ACCESSIBILITY

Links must be:

```text
keyboard reachable
screen-reader understandable
not dependent on color only
```

No nested interactive elements inside interactive rows.

---

# 36. LIST PAGINATION

Do not regress:

```text
20-row default
filtered total
multi-page navigation
```

for Clients/Partners.

---

# 37. 360 EMBEDDED TABLE PAGINATION

Preserve Round 3 bounded tables.

If >20:

```text
pagination = 20
```

where already implemented / applicable.

---

# 38. DESTINATION DATA PARITY

Navigation to Order/Booking/Service detail must point to the exact selected entity.

No broad unfiltered destination.

---

# 39. CROSS-LINK LOOP

Required working examples:

```text
Partner 360
→ Customer
→ Customer 360
→ Partner relation
→ Partner 360
```

and:

```text
Partner 360
→ Order
→ Order Detail
```

No dead cycle.

---

# 40. BREADCRUMB SEMANTICS

Breadcrumbs represent hierarchy, not browser history.

Correct:

```text
CRM / Партнёры / Partner Name
```

Not:

```text
Dashboard / Previous Page / Partner
```

---

# 41. PLATFORM SIDEBAR

Reuse existing Platform left sidebar.

Do not start Partner sidebar implementation.

---

# 42. STORE­FRONT PRO CRM

Do not start Storefront Pro CRM here.

This pattern will be reused later.

---

# 43. MARKETPLACE BASIC CRM

Do not modify beyond shared regression.

---

# 44. I18N

All new:

```text
breadcrumbs
buttons
not found
open detail
tab labels if touched
```

must resolve in:

```text
RU
AZ
EN
```

Raw keys = 0.

---

# 45. ERROR / EMPTY

Preserve Round 2/3 contract:

```text
API error ≠ zero
not found ≠ empty relation
forbidden ≠ no records
```

---

# 46. ROUTE INVENTORY — REQUIRED

Before implementation:

| Entity | Current list route | Current detail mechanism | Canonical detail route available? | Target |
|---|---|---|---|---|
| Customer | | side panel/page | | |
| Partner | | side panel/page | | |
| Service | | | | |
| Order | | | | |
| Booking | | | | |
| Payment | | | | |
| Refund | | | | |

---

# 47. CLICKABLE REFERENCE MATRIX — REQUIRED

| Surface | Field | Entity | Destination | Exists? | Action |
|---|---|---|---|---|---|
| Partner 360 Services | code/name | Service | | | |
| Partner 360 Orders | order code | Order | | | |
| Partner 360 Bookings | booking code | Booking | | | |
| Partner 360 Customers | customer | Customer | | | |
| Customer 360 Orders | order code | Order | | | |
| Customer 360 Bookings | booking code | Booking | | | |
| Customer 360 Partner Relations | partner | Partner | | | |
| Customer 360 Payments | reference | Payment/Order | | | |
| Customer 360 Refunds | reference | Refund/Order | | | |

---

# 48. BROWSER ACCEPTANCE — CUSTOMER 360

Required:

```text
CRM → Clients
click customer link
dedicated route opens
refresh keeps same customer
Back returns to Clients
Forward returns to Customer 360
direct URL works
breadcrumb works
tabs work
Ctrl/Cmd/Middle click supported by link semantics
```

---

# 49. BROWSER ACCEPTANCE — PARTNER 360

Required:

```text
CRM → Partners
click partner link
dedicated route opens
refresh keeps same partner
Back returns to Partners
Forward returns to Partner 360
direct URL works
breadcrumb works
tabs work
```

---

# 50. BROWSER ACCEPTANCE — SERVICE LINK

From Partner 360 → Services:

```text
click service code/name
→ correct service detail
```

No global/unfiltered catalog destination unless that is the only canonical detail behavior and is explicitly documented.

---

# 51. BROWSER ACCEPTANCE — ORDER LINK

From both:

```text
Customer 360
Partner 360
```

click an order → exact Order detail.

---

# 52. BROWSER ACCEPTANCE — BOOKING LINK

From both 360 contexts:

```text
click booking
→ exact Booking detail
```

---

# 53. BROWSER ACCEPTANCE — CUSTOMER/PARTNER CROSS-LINKS

Verify:

```text
Partner 360 → Customer 360
Customer 360 → Partner 360
```

where real relations exist.

---

# 54. NATIVE NEW-TAB EVIDENCE

Because real links are required, verify at least one entity link supports:

```text
Ctrl/Cmd + click
```

or equivalent browser link behavior.

Do not implement custom `window.open` as the default substitute.

---

# 55. TESTS — ROUTES

Add/update focused tests for:

```text
Customer 360 route
Partner 360 route
unknown id
forbidden id
default tab
invalid tab if tab URL-state is implemented
```

---

# 56. TESTS — LINKS

Where feasible verify generated hrefs for:

```text
customer
partner
service
order
booking
```

Avoid brittle tests tied to DOM styling.

---

# 57. REGRESSION

Must preserve:

```text
Customer 360 Round 3 data
Partner 360 Round 3 data
Refunds
History
Services
Orders
Bookings
Customers
Storefront
permissions
i18n
error/zero boundaries
pagination
```

---

# 58. BUILD GATES

Required:

```text
Backend TSC
Frontend TSC
Backend build
Frontend build
relevant backend tests
relevant frontend tests
```

Report exact results.

---

# 59. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.5_PLATFORM_CRM_ROUND_4_DEDICATED_360_DEEP_LINK_ENTITY_NAVIGATION_REPORT.md
```

---

# 60. REQUIRED BEFORE / AFTER

Report:

```text
BEFORE

Customer 360:
detail pane / current mechanism

Partner 360:
detail pane / current mechanism

Entity references:
mostly non-clickable / current state


AFTER

Customer 360:
dedicated route = ...

Partner 360:
dedicated route = ...

Service reference:
href = ...

Order reference:
href = ...

Booking reference:
href = ...
```

---

# 61. HARD ACCEPTANCE CRITERIA

VERDICT A only if ALL applicable items pass:

1. Customer 360 has a dedicated stable route.
2. Partner 360 has a dedicated stable route.
3. Customer 360 is not added as a top-level CRM tab.
4. Partner 360 is not added as a top-level CRM tab.
5. Customer list → Customer 360 works.
6. Partner list → Partner 360 works.
7. Customer 360 refresh preserves entity.
8. Partner 360 refresh preserves entity.
9. Browser Back works naturally from Customer 360.
10. Browser Back works naturally from Partner 360.
11. Browser Forward works naturally.
12. Direct Customer 360 URL works.
13. Direct Partner 360 URL works.
14. Unknown Customer returns proper not-found behavior.
15. Unknown Partner returns proper not-found behavior.
16. Unauthorized deep link is denied.
17. Customer 360 retains all Round 3 tabs/data.
18. Partner 360 retains all Round 3 tabs/data.
19. Breadcrumbs work for Customer 360.
20. Breadcrumbs work for Partner 360.
21. CRM active navigation state is preserved on detail routes.
22. Service code/name is clickable where canonical detail route exists.
23. Order code is clickable in Customer 360.
24. Order code is clickable in Partner 360.
25. Booking code is clickable in Customer 360.
26. Booking code is clickable in Partner 360.
27. Customer reference is clickable from Partner 360.
28. Partner reference is clickable from Customer 360.
29. No dead entity links.
30. Detail links target exact entity, not broad unfiltered lists.
31. Native new-tab link semantics work.
32. No hidden-onClick-only pseudo-links for core entity navigation.
33. Keyboard accessibility PASS.
34. No nested interactive-element regressions.
35. Side panel is removed or reduced to non-duplicated Quick Preview.
36. No duplicate 360 business logic maintained.
37. URL/tab state behavior is documented.
38. Invalid tab is handled safely where applicable.
39. pageSize=20 does not regress.
40. Error != empty does not regress.
41. Refunds does not regress.
42. History does not regress.
43. Partner Services does not regress.
44. Partner Orders does not regress.
45. Partner Bookings does not regress.
46. Partner Customers does not regress.
47. Partner Storefront does not regress.
48. Platform CRM RBAC does not regress.
49. RU PASS.
50. AZ PASS.
51. EN PASS.
52. Raw i18n keys = 0.
53. Platform sidebar does not regress.
54. Storefront Pro CRM is NOT started.
55. Marketplace Basic CRM is NOT started.
56. Partner Shared Sidebar implementation is NOT started.
57. F.1–F.13 remain NOT STARTED.
58. S.1–S.19 remain NOT STARTED.
59. Backend TSC PASS.
60. Frontend TSC PASS.
61. Backend build PASS.
62. Frontend build PASS.
63. Relevant backend tests PASS.
64. Relevant frontend tests PASS.
65. Route inventory supplied.
66. Clickable reference matrix supplied.
67. Browser Customer 360 evidence supplied.
68. Browser Partner 360 evidence supplied.
69. Browser Service link evidence supplied.
70. Browser Order link evidence supplied.
71. Browser Booking link evidence supplied.
72. Customer↔Partner cross-link evidence supplied.
73. Production changes limited to navigation/360 UX scope.
74. Unrelated files committed = 0.
75. Push complete.
76. HEAD == origin/master.

---

# 62. VERDICT

Success:

```text
VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM ROUND 4 /
DEDICATED CUSTOMER 360 + PARTNER 360 PAGES /
DEEP LINKS / ENTITY REFERENCE NAVIGATION CONTRACT
FULLY IMPLEMENTED AND RUNTIME-VERIFIED
```

Failure:

```text
VERDICT B — PLATFORM CRM ROUND 4 UX NAVIGATION INCOMPLETE
```

---

# 63. FINAL RESPONSE FORMAT

```text
VERDICT:

ROUTE INVENTORY:
...

CUSTOMER 360:
Route:
Breadcrumb:
Back/Forward:
Refresh:
Direct URL:
Tabs:
Not found:
Forbidden:

PARTNER 360:
Route:
Breadcrumb:
Back/Forward:
Refresh:
Direct URL:
Tabs:
Not found:
Forbidden:

ENTITY REFERENCES:
Service:
Order:
Booking:
Customer:
Partner:
Payment:
Refund:

CLICKABLE REFERENCE MATRIX:
...

SIDE PANEL:
Removed / Quick Preview:
Shared components:

ACTIVE NAV STATE:
TAB URL STATE:

BROWSER:
Customer 360:
Partner 360:
Service link:
Order link:
Booking link:
Customer ↔ Partner:
New-tab semantics:

REGRESSION:
Customer 360 Round 3:
Partner 360 Round 3:
Refunds:
History:
RBAC:
Pagination:
Error/empty:
i18n:

Backend TSC:
Frontend TSC:
Backend build:
Frontend build:
Backend tests:
Frontend tests:

Production code changed:
DB schema changed:
Migration:
Files changed:

Platform CRM status:
Storefront Pro CRM status:
Marketplace Basic CRM status:
Partner Shared Sidebar implementation:
F.1–F.13:
S.1–S.19:

Report:
Commit:
HEAD:
origin/master:
HEAD == origin/master:
Unrelated files:

Remaining findings:
Next canonical stage:
```

---

# 64. STOP

After report:

```text
STOP
```

Do NOT automatically begin Storefront Pro CRM.

We will visually inspect Customer 360 and Partner 360 dedicated pages first.
