# PHASE 3 — STEP 3.5 — PLATFORM CRM
## ROUND 5A — RUNTIME PARITY / STALE BUILD / ROUTE-DATA-RENDER AUTHORITY REMEDIATION
## REPORTED VERDICT A vs OBSERVED LOCALHOST RUNTIME MISMATCH

---

# 1. STATUS

Previous report claimed:

```text
VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM ROUND 5 /
CORE SERVICE + ORDER + BOOKING DETAIL ROUTES /
EXACT ENTITY NAVIGATION /
PAYMENT + REFUND BUSINESS CONTEXT /
CUSTOMER ↔ PARTNER COMMERCIAL RELATIONSHIP
FULLY IMPLEMENTED AND RUNTIME-VERIFIED
```

Reported commit:

```text
2d1d004
HEAD == origin/master: YES
```

However manual browser inspection of the actual localhost runtime does not match the reported result.

Therefore the previous VERDICT A is NOT accepted yet.

Current qualification:

```text
VERDICT B — IMPLEMENTATION REPORT DOES NOT MATCH OBSERVED RUNTIME
```

This round is NOT a new feature round.

Its sole purpose is to determine and fix why:

```text
source/reported runtime evidence
!=
actual browser runtime observed by user
```

---

# 2. OBSERVED CONTRADICTION

Round 5 report claims:

```text
Customer 360 → Партнёры
Marie Park → Baku Tours Pro
2 orders
1 booking
206.92 AZN
```

But actual browser observation did not show the expected Partners table.

During execution the UI also exposed:

```text
crm.detail.partners
```

instead of the translated tab label.

The browser was on:

```text
/app/crm/customers/<Marie-Park-id>?tab=payments
```

and showed Payment:

```text
PAY-00000959
50.88 AZN
Оплата за заказ ORD-00000959 (TH-2026-000959)
CAPTURED
```

After the reported Round 5 completion, the user reports that the expected situation still has not changed.

---

# 3. DO NOT ASSUME "CACHE"

Do NOT immediately conclude:

```text
browser cache
```

or:

```text
restart dev server
```

without evidence.

Determine the exact running source/build/process first.

Possible causes include, but are not limited to:

```text
stale frontend process
stale backend process
stale Next build
wrong working tree
wrong port/process
wrong route component
wrong API base URL
frontend and backend running from different SHAs
source changed but runtime not rebuilt/restarted
new endpoint not actually called
endpoint returns correct data but frontend drops it
frontend receives data but render branch is wrong
tab key mismatch
i18n key mismatch
browser testing different environment than automated verification
```

---

# 4. FIRST GATE — REPOSITORY AUTHORITY

Prove actual repository state.

Required commands/evidence:

```text
git rev-parse HEAD
git rev-parse origin/master
git status --short
git log -1 --oneline
```

Expected:

```text
HEAD = 2d1d004...
origin/master = 2d1d004...
```

If not:

```text
STOP
```

and explain mismatch before touching production code.

Also report:

```text
repository absolute path
current branch
working tree dirty/clean
```

---

# 5. RUNNING PROCESS AUTHORITY

Identify the actual processes serving:

```text
Frontend localhost:3000
Backend/API actual port
```

Report:

```text
PID
command line
working directory
start time
port
```

Do not assume the process was started from the current repository.

Hard question:

```text
Which exact filesystem checkout is serving localhost:3000?
```

Must be answered with evidence.

---

# 6. FRONTEND RUNTIME SHA

Establish whether the frontend being served corresponds to commit:

```text
2d1d004
```

Use the least invasive reliable mechanism available.

Inspect:

```text
running process cwd
build timestamps
.next artifacts where relevant
source timestamps
process start time vs commit/build time
```

If needed, add TEMPORARY diagnostic evidence locally, but do not leave debug UI/code in final production commit.

Required conclusion:

```text
Frontend runtime:
CURRENT / STALE / WRONG WORKTREE / UNKNOWN
```

`UNKNOWN` cannot receive VERDICT A.

---

# 7. BACKEND RUNTIME SHA

Perform the same authority check for backend.

Important because a prior CRM issue was caused by stale:

```text
backend/dist
```

Determine:

```text
backend process cwd
whether ts-node/dev source or dist is running
dist build timestamp if applicable
process start time
current source SHA
```

Required conclusion:

```text
Backend runtime:
CURRENT / STALE / WRONG WORKTREE / UNKNOWN
```

---

# 8. API BASE URL AUTHORITY

Determine the exact API URL used by the browser frontend.

Report:

```text
frontend origin:
API base URL:
backend target host:
backend target port:
```

Do not infer from intended `.env`.

Inspect actual runtime configuration/code.

---

# 9. MARIE PARK IDENTITY

Resolve the exact Customer record being viewed.

Browser previously showed:

```text
Marie Park
CRM-00000067
```

Resolve:

```text
customer UUID
customer code
name
email
```

Confirm that the API and browser refer to the same record.

No testing against another Marie Park or another seeded Customer.

---

# 10. DIRECT PARTNERS API PROOF

Call the exact endpoint implemented in Round 5 for the exact Marie Park ID.

Expected endpoint conceptually:

```text
GET /api/v1/customers/:id/partners
```

Use actual prefix/runtime route.

Capture:

```text
HTTP status
response body
total
items
partner IDs
partner codes
partner names
orders count
bookings count
commercial metric/value
CRM enrichment
```

Round 5 report specifically claimed:

```text
Marie Park
→ Baku Tours Pro
→ 2 orders
→ 1 booking
→ 206.92 AZN
```

Prove or disprove this against the current running backend.

---

# 11. API / DB PARITY

Do not stop at API response.

Verify the claimed commercial relationship against canonical DB data.

For Marie Park and Baku Tours Pro prove the join path used, for example only if canonical:

```text
Customer
→ Orders
→ Partner
```

and/or:

```text
Customer
→ Booking
→ Service/Product
→ Partner
```

Report actual rows/counts supporting:

```text
2 orders
1 booking
206.92 AZN
```

If 206.92 is displayed, define exactly what it means:

```text
sum of order totals?
paid amount?
captured amount?
gross commercial value?
other?
```

No unlabeled/ambiguous monetary aggregate.

---

# 12. FRONTEND NETWORK PROOF — PARTNERS TAB

Open exact route:

```text
/app/crm/customers/<Marie-Park-id>?tab=partners
```

Capture browser/network evidence.

Required:

```text
request URL
HTTP status
response payload summary
whether request occurs at all
```

Classification:

```text
A. Request not sent
B. Request sent to wrong URL
C. Request returns error
D. Request returns empty
E. Request returns correct Baku Tours Pro row
```

Only E permits moving to render investigation without backend remediation.

---

# 13. ROUTE → DATA → RENDER TRACE

Trace the exact data path:

```text
URL ?tab=partners
↓
tab resolver
↓
Customer 360 page
↓
API function
↓
GET customers/:id/partners
↓
response parsing
↓
component state
↓
render branch
↓
Partners table
```

Identify the exact break point.

Report file + function/component for each stage.

---

# 14. TAB KEY AUTHORITY

The observed raw key:

```text
crm.detail.partners
```

must be investigated.

Verify:

```text
tab id
query param value
translation key
RU value
AZ value
EN value
```

Expected conceptual mapping:

```text
tab id: partners
query: ?tab=partners
RU: Партнёры
AZ: ...
EN: Partners
```

Raw translation keys visible in browser:

```text
FORBIDDEN
```

---

# 15. PARTNERS TABLE REQUIRED FINAL RENDER

If canonical data confirms the reported relationship, Marie Park → Partners must visibly render a row.

Conceptual target:

| Партнёр | Заказы | Бронирования | Коммерческий показатель | Последняя активность | CRM |
|---|---:|---:|---:|---|---|
| Baku Tours Pro | 2 | 1 | 206.92 AZN* | canonical value | canonical CRM state / — |

`*` Only if 206.92 has a proven semantic definition.

If last activity or CRM metadata is not canonically available, use honest absence rather than fabricated data.

---

# 16. PARTNER LINK

The Baku Tours Pro identity/code/name must navigate to:

```text
exact Partner 360
```

not Partners list.

Verify:

```text
native Link
exact partner ID
refresh
Back
```

---

# 17. REVERSE RELATIONSHIP PROOF

Round 5 also claimed:

```text
Baku Tours Pro → 18 distinct commercial customers
```

Open exact Partner 360:

```text
/app/crm/partners/<id>?tab=customers
```

Prove:

```text
total = 18 distinct commercial customers
```

and show actual rows.

Verify Marie Park appears if the claimed commercial relationship exists.

Hard parity:

```text
Marie Park → Baku Tours Pro
AND
Baku Tours Pro → Marie Park
```

must both be true.

---

# 18. DISTINCTNESS

Verify the 18 Partner customers are:

```text
18 distinct Customers
```

not:

```text
18 Orders
18 Bookings
18 PartnerCustomerRelation rows
```

Prove distinct key.

---

# 19. PAYMENT RUNTIME PARITY

Round 5 claimed:

```text
PAY-00000959
→ Order ORD-00000959
→ TH-2026-000959
```

The screenshot shows this context, so preserve it.

But verify exact runtime/API source.

Required Payment evidence:

```text
Payment ID
amount
currency
status
Order ID
Order code
Order human/business number
Booking context if canonically attributable
Service context if canonically attributable
```

Do not regress currently visible:

```text
Оплата за заказ ORD-00000959 (TH-2026-000959)
```

---

# 20. PAYMENT DETAIL NAVIGATION

The Order reference in Payment context must navigate to:

```text
/app/orders/<exact-id>
```

Verify:

```text
exact Order
stable URL
refresh
Back
```

If Booking/Service context is displayed, verify their exact links too.

---

# 21. REFUND RUNTIME PARITY

Round 5 claimed:

```text
RFD-F8DB5871781F
→ Order ORD-00000959
→ Payment PAY-00000959
→ "Partial refund — customer dissatisfaction"
```

Open Marie Park:

```text
?tab=refunds
```

Verify actual visible runtime.

Required:

```text
Refund ID
amount
currency
status
source Payment
source Order
reason
Booking/Service context only if canonical
```

---

# 22. REFUND REASON AUTHORITY

Prove that:

```text
Partial refund — customer dissatisfaction
```

comes from the canonical Refund reason field/source.

Do NOT use:

```text
cancellation reason
seed description
frontend hardcoded string
```

unless that is actually the canonical refund reason.

---

# 23. ORDER DETAIL RUNTIME

Round 5 claimed:

```text
/app/orders/:id
```

exists.

From CRM click:

```text
ORD-00000959
```

Required:

```text
exact Order opens
correct customer
correct partner
correct status
correct total/currency
canonical child items/bookings/payments/refunds where implemented
refresh works
Back works
```

---

# 24. BOOKING DETAIL RUNTIME

From a real Customer 360 / Partner 360 Booking reference:

```text
click Booking
→ /app/bookings/:id
```

Verify exact object.

---

# 25. PRODUCT/SERVICE DETAIL RUNTIME

From Partner 360 → Services:

```text
click real Service/Product
→ /app/catalog/:id
```

Verify exact object.

---

# 26. STALE BUILD REMEDIATION

If frontend/backend runtime is stale:

1. prove it;
2. rebuild/restart the correct service;
3. document exact command;
4. verify correct process cwd;
5. repeat API/browser evidence.

Do not modify business logic merely to compensate for stale runtime.

---

# 27. WRONG WORKTREE REMEDIATION

If localhost is being served from another checkout/worktree:

```text
STOP using that runtime
```

Start the intended repository/worktree.

Report:

```text
old cwd
new cwd
old SHA
new SHA
```

---

# 28. WRONG ROUTE / COMPONENT REMEDIATION

If code was added to a component not used by:

```text
/app/crm/customers/[id]
```

fix the actual route/component.

Delete or avoid duplicate dead implementations.

One Customer 360 implementation remains authoritative.

---

# 29. API CONTRACT REMEDIATION

If backend endpoint returns correct data but frontend contract mismatches:

fix:

```text
API type
field mapping
response envelope
state assignment
render mapping
```

Do not create a second redundant endpoint unless necessary.

---

# 30. ERROR ≠ EMPTY

If Partners request fails:

do NOT render:

```text
Партнёров нет
```

Render an honest error state.

Only render empty when:

```text
request succeeded
AND
canonical result total = 0
```

Same for Partner 360 → Customers.

---

# 31. I18N HARD GATE

After remediation search/test for visible raw CRM keys.

At minimum verify:

```text
crm.detail.partners
```

does not appear.

Required:

```text
RU PASS
AZ PASS
EN PASS
raw keys = 0
```

---

# 32. NO NEW FUNCTIONAL SCOPE

Do NOT start:

```text
Storefront Pro CRM
Marketplace Basic CRM completion
Partner Shared Sidebar implementation
new Finance module
Payment Detail
Refund Detail
F.1–F.13
S.1–S.19
```

This is runtime parity remediation only.

---

# 33. BROWSER CACHE CONTROL

After proving process/build authority, perform a controlled browser verification:

```text
hard reload
fresh tab
direct URL navigation
```

If needed, use a clean browser session.

But browser cache alone is not an acceptable root-cause statement without evidence.

---

# 34. REQUIRED RUNTIME AUTHORITY MATRIX

| Layer | Expected SHA/source | Actual source/process | Current? | Evidence |
|---|---|---|---|---|
| Git HEAD | 2d1d004 | | | |
| origin/master | 2d1d004 | | | |
| Frontend process | 2d1d004 checkout | | | |
| Frontend build | current | | | |
| Backend process | 2d1d004 checkout | | | |
| Backend build/dist | current | | | |
| Browser API target | intended backend | | | |

---

# 35. REQUIRED CUSTOMER → PARTNER MATRIX

| Check | Expected | Actual | PASS |
|---|---|---|---|
| Customer | Marie Park / CRM-00000067 | | |
| Partners API HTTP | 200 | | |
| Partner | Baku Tours Pro | | |
| Orders | 2 | | |
| Bookings | 1 | | |
| Commercial value | 206.92 AZN only if semantically proven | | |
| Tab label | Партнёры | | |
| Raw key | absent | | |
| Partner row visible | yes | | |
| Exact Partner 360 link | yes | | |

---

# 36. REQUIRED PARTNER → CUSTOMER MATRIX

| Check | Expected from Round 5 report | Actual | PASS |
|---|---|---|---|
| Partner | Baku Tours Pro | | |
| Distinct customers | 18 | | |
| Marie Park present | yes if relation claim is valid | | |
| Customer row visible | yes | | |
| Exact Customer 360 link | yes | | |
| Duplicate customers | 0 | | |

---

# 37. REQUIRED FINANCIAL CONTEXT MATRIX

| Entity | Expected | Actual | PASS |
|---|---|---|---|
| PAY-00000959 | Order ORD-00000959 / TH-2026-000959 | | |
| Payment Order link | exact Order Detail | | |
| RFD-F8DB5871781F | source Payment + Order | | |
| Refund reason | canonical reason | | |
| Refund Order link | exact Order Detail | | |
| Refund Payment reference | canonical | | |

---

# 38. REQUIRED DETAIL ROUTE MATRIX

| Entity | Expected route | Exact object opens? | Refresh | Back | PASS |
|---|---|---|---|---|---|
| Order | /app/orders/:id | | | | |
| Booking | /app/bookings/:id | | | | |
| Product/Service | /app/catalog/:id | | | | |

---

# 39. TESTS

Run focused tests for the actual root cause.

If root cause was runtime/build only:

```text
do not invent meaningless code tests
```

Still run existing relevant regression suites.

If code remediation is required, add focused regression coverage for:

```text
Partners tab fetch/render
raw i18n key
error != empty
commercial relationship mapping
reverse Partner customers mapping
```

---

# 40. BUILD GATES

Required:

```text
Backend TSC
Frontend TSC
Backend build
Frontend build
relevant backend tests
relevant frontend tests
```

Report exact results/counts.

---

# 41. BROWSER EVIDENCE IS MANDATORY

VERDICT A cannot be based only on:

```text
curl
unit tests
database query
source inspection
```

The defect is a browser/runtime parity defect.

Required actual browser evidence after final restart/build:

```text
Customer 360 → Партнёры
Partner 360 → Клиенты
Customer 360 → Платежи
Customer 360 → Возвраты
Order Detail
Booking Detail
Service/Product Detail
```

---

# 42. NO SELF-REPORTED RUNTIME WITHOUT ENVIRONMENT IDENTITY

Every browser/runtime claim must identify:

```text
URL
running frontend process
running backend process
repository path
HEAD SHA
```

This prevents evidence from a different runtime/environment being used as proof.

---

# 43. PRODUCTION CODE CHANGE POLICY

Production code may change ONLY if runtime tracing proves a code defect.

If root cause is solely:

```text
stale build
stale process
wrong worktree
```

then:

```text
Production code changed: NO
```

Do not create a cosmetic commit just to close the round.

---

# 44. REQUIRED ROOT CAUSE

Final report must select and prove one or more concrete causes:

```text
STALE_FRONTEND
STALE_BACKEND
WRONG_WORKTREE
WRONG_API_TARGET
WRONG_ROUTE_COMPONENT
API_CONTRACT_MISMATCH
RENDER_LOGIC_DEFECT
I18N_DEFECT
OTHER — explicitly proven
```

Forbidden:

```text
probably cache
seems stale
likely restart issue
```

---

# 45. ACCEPTANCE CRITERIA

VERDICT A only if ALL applicable criteria pass:

1. Git HEAD proven.
2. origin/master proven.
3. Repository path proven.
4. Working tree state reported.
5. Frontend PID/process proven.
6. Frontend cwd proven.
7. Frontend runtime freshness proven.
8. Backend PID/process proven.
9. Backend cwd proven.
10. Backend runtime freshness proven.
11. Browser API base URL proven.
12. Exact Marie Park identity proven.
13. Partners API called for exact Marie Park.
14. Partners API returns canonical data or discrepancy is corrected.
15. Marie Park → Baku Tours Pro relationship proven from DB.
16. `2 orders` proven.
17. `1 booking` proven.
18. `206.92 AZN` semantic definition proven if displayed.
19. Browser sends Partners API request.
20. Browser receives successful Partners response.
21. Customer 360 renders Baku Tours Pro.
22. Customer 360 tab displays `Партнёры`.
23. `crm.detail.partners` raw key is absent.
24. Baku Tours Pro links to exact Partner 360.
25. Baku Tours Pro → Customers runtime works.
26. `18 distinct customers` proven or corrected.
27. Marie Park appears in reverse relation when canonical.
28. Duplicate commercial customers = 0.
29. Error != empty preserved.
30. PAY-00000959 context preserved.
31. PAY-00000959 Order link opens exact Order.
32. RFD-F8DB5871781F context runtime-verified.
33. Refund source Payment is canonical.
34. Refund source Order is canonical.
35. Refund reason source is canonical.
36. Order Detail runtime PASS.
37. Booking Detail runtime PASS.
38. Product/Service Detail runtime PASS.
39. Direct refresh PASS for detail routes.
40. Back navigation PASS.
41. RU PASS.
42. AZ PASS.
43. EN PASS.
44. Raw i18n keys = 0.
45. Runtime authority matrix supplied.
46. Customer → Partner matrix supplied.
47. Partner → Customer matrix supplied.
48. Financial context matrix supplied.
49. Detail route matrix supplied.
50. Exact root cause proven.
51. Root cause fixed.
52. Final browser evidence is from the same localhost runtime the user observes.
53. Backend TSC PASS.
54. Frontend TSC PASS.
55. Backend build PASS.
56. Frontend build PASS.
57. Relevant tests PASS.
58. No unrelated scope implemented.
59. Unrelated files committed = 0.
60. If code changed, commit pushed.
61. HEAD == origin/master after any code change.
62. If no code changed, no unnecessary commit created.

---

# 46. VERDICT

Success:

```text
VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM ROUND 5A /
LOCALHOST RUNTIME PARITY /
FRONTEND + BACKEND BUILD AUTHORITY /
CUSTOMER ↔ PARTNER RENDER /
PAYMENT + REFUND CONTEXT /
CORE DETAIL ROUTES
FULLY RECONCILED AND BROWSER-VERIFIED
```

Failure:

```text
VERDICT B — PLATFORM CRM ROUND 5A RUNTIME PARITY NOT PROVEN
```

No conditional VERDICT A.

---

# 47. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.5_PLATFORM_CRM_ROUND_5A_RUNTIME_PARITY_REMEDIATION_REPORT.md
```

---

# 48. FINAL RESPONSE FORMAT

```text
VERDICT:

ROOT CAUSE:
Classification:
Evidence:

REPOSITORY:
Path:
Branch:
HEAD:
origin/master:
Working tree:

FRONTEND RUNTIME:
PID:
Command:
CWD:
Port:
Process start:
Build/source freshness:
Classification:

BACKEND RUNTIME:
PID:
Command:
CWD:
Port:
Process start:
dist/source freshness:
Classification:

API TARGET:
Frontend origin:
API base:
Backend target:

MARIE PARK:
UUID:
Code:
Email:

PARTNERS API:
URL:
HTTP:
Total:
Rows:

CUSTOMER → PARTNER:
Partner:
Orders:
Bookings:
Commercial value:
Commercial value semantic:
DB join path:
PartnerCustomerRelation required?:

PARTNERS TAB:
URL:
Request sent:
Response:
Rendered rows:
Tab label:
Raw keys:
Exact Partner link:

PARTNER → CUSTOMERS:
Partner:
Distinct customers:
Marie Park present:
Duplicates:
Exact Customer links:

PAYMENT:
Payment:
Amount:
Status:
Order:
Order number:
Booking context:
Service context:
Exact links:

REFUND:
Refund:
Amount:
Status:
Source Payment:
Source Order:
Reason:
Reason canonical source:
Booking context:
Service context:
Exact links:

ORDER DETAIL:
URL:
Exact entity:
Refresh:
Back:

BOOKING DETAIL:
URL:
Exact entity:
Refresh:
Back:

SERVICE DETAIL:
URL:
Exact entity:
Refresh:
Back:

RUNTIME AUTHORITY MATRIX:
...

CUSTOMER → PARTNER MATRIX:
...

PARTNER → CUSTOMER MATRIX:
...

FINANCIAL CONTEXT MATRIX:
...

DETAIL ROUTE MATRIX:
...

I18N:
RU:
AZ:
EN:
Raw keys:

Backend TSC:
Frontend TSC:
Backend build:
Frontend build:
Backend tests:
Frontend tests:

Production code changed:
Files changed:
Unrelated files:
Commit:
HEAD:
origin/master:
HEAD == origin/master:

Report:
Remaining findings:
Next canonical stage:
```

---

# 49. STOP

After the report:

```text
STOP
```

Do NOT start Storefront Pro CRM.

The Platform CRM remains open until the actual localhost browser observed by the user matches the accepted Round 5 behavior.
