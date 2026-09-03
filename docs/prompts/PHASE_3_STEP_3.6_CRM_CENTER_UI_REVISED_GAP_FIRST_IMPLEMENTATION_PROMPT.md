# PHASE 3 --- STEP 3.6 --- CRM CENTER UI

## REVISED IMPLEMENTATION PROMPT

### GAP-FIRST / CRM ANALYTICS UI PRIMARY / EXISTING CRM SURFACES REGRESSION-ONLY

**Все ответы разработчика, implementation notes, evidence, отчёты и
roadmap updates --- строго на русском.**

------------------------------------------------------------------------

## 1. PURPOSE OF THIS REVISED PROMPT

Предыдущий prompt для Step 3.6 был слишком широким и мог привести к
ненужной переработке уже готовых CRM surfaces.

Этот prompt **заменяет предыдущий Step 3.6 prompt**.

Ключевой принцип:

``` text
НЕ ПЕРЕДЕЛЫВАТЬ ТО, ЧТО УЖЕ РЕАЛИЗОВАНО И ПРОВЕРЕНО.

Сначала:
ROADMAP DISCOVERY
→ REPO/UI DISCOVERY
→ GAP ANALYSIS

Затем:
IMPLEMENT ONLY THE REAL STEP 3.6 GAP.
```

На текущем accepted baseline уже существуют и ранее визуально
проверялись:

``` text
CRM Center
Customers list
Partners list
Customer 360
Partner 360
Activity
Notes
Orders / Bookings / Payments и другие существующие 360 surfaces
server-side filters / pagination where implemented
related-entity display names instead of UUID
RU / AZ / EN
Payment / Refund customer attribution
Partner attribution
```

Поэтому эти surfaces в Step 3.6 являются прежде всего **REGRESSION
BASELINE**, а не основанием для их полного redesign/refactor.

Главный ожидаемый новый UI GAP:

``` text
CRM ANALYTICS UI
```

Но это должно быть подтверждено canonical roadmap + current repository.

------------------------------------------------------------------------

## 2. AUTHORITATIVE BASELINE

Accepted status:

``` text
Step 3.5.3 — FULLY RE-CLOSED
Step 3.5A — FULLY CLOSED
Step 3.5B — FULLY CLOSED
Step 3.5C — FULLY CLOSED
Step 3.5D — FULLY CLOSED
Step 3.5E — FULLY CLOSED
Step 3.5E.1 — FULLY CLOSED
```

Repository baseline:

``` text
Starting HEAD expected: 7e52f68
origin/master expected: 7e52f68
```

Mandatory history/baselines to preserve:

``` text
7e52f68 — Step 3.5E.1 closure
7e4fe8c — RefundAdapter customer attribution fix
9674ce0 — Step 3.5E CRM Analytics Read Model
e4b38a3 — canonical Workforce / Employee Performance Management roadmap history
```

Do not rollback or overwrite these decisions.

------------------------------------------------------------------------

## 3. EXACT STAGE

Implement only:

``` text
PHASE 3 — STEP 3.6 — CRM CENTER UI
```

Do not automatically begin NEXT.

Do not implement:

``` text
Supplier / Procurement
Workforce / Employee Performance Management
future CRM stages
future Full Analytics capabilities
unrelated redesign
```

------------------------------------------------------------------------

## 4. GATE 1 --- CANONICAL ROADMAP DISCOVERY

Before changing production code, open:

``` text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Find exact canonical definition of:

``` text
PHASE 3 — STEP 3.6 — CRM CENTER UI
```

Report:

``` text
exact scope
dependencies
required UI surfaces
required analytics consumer(s)
Platform scope
Partner scope
acceptance criteria
explicit exclusions
exact NEXT stage
```

Do not infer the Step 3.6 scope from the title alone.

If canonical roadmap materially contradicts this prompt:

``` text
STOP
VERDICT B
report exact conflict
do not silently choose a new architecture
```

------------------------------------------------------------------------

## 5. GATE 2 --- CURRENT UI DISCOVERY

Before implementation inspect actual current source/runtime.

Determine whether these already exist and work:

  Surface                   Exists   Functional   Visually complete Step 3.6 action
  ----------------------- -------- ------------ ------------------- -----------------
  CRM Center                                                        
  Customers                                                         
  Partners                                                          
  Customer 360                                                      
  Partner 360                                                       
  Activity                                                          
  Notes                                                             
  Related-entity labels                                             
  CRM Analytics UI                                                  

Do not assume absence/presence.

Use current repository and browser runtime.

------------------------------------------------------------------------

## 6. GAP-FIRST DECISION

After roadmap + repository discovery produce:

``` text
STEP 3.6 REQUIRED
-
ALREADY IMPLEMENTED
-
ACTUAL GAP
```

Example structure:

``` text
Canonical requirement:
CRM Center UI

Already implemented:
Customers
Partners
Customer 360
Partner 360
Activity
Notes
...

Missing:
CRM Analytics consumer UI
```

If this is what repository evidence confirms, **only implement the
missing CRM Analytics UI and minimal navigation/integration required for
it**.

Do not rewrite working Customers/Partners/360 pages.

------------------------------------------------------------------------

# PRIMARY IMPLEMENTATION --- CRM ANALYTICS UI

## 7. EXISTING ANALYTICS AUTHORITY

Step 3.5E / 3.5E.1 already established backend/read-model/API authority.

Expected architecture, to be verified from source:

``` text
AnalyticsService
    ↓
getCrmAnalytics()
    ↓
GET /analytics/crm
```

Expected scope authority:

``` text
PLATFORM
→ cross-partner CRM analytics

PARTNER
→ current Partner only
```

Do not create a second analytics engine.

------------------------------------------------------------------------

## 8. NO FRONTEND BUSINESS-METRIC ENGINE

Forbidden:

``` text
fetch all Customers and count in frontend
fetch all PCR rows and aggregate in frontend
recalculate lifecycle metrics in React
derive source breakdown from current table page
invent new CRM KPI formulas
```

Required:

``` text
backend/read model/API
        ↓
frontend presentation
```

The server remains metric authority.

------------------------------------------------------------------------

## 9. EXACT METRIC CONTRACT --- READ FROM REPO

Do not hardcode an assumed metric list from this prompt.

Read actual current:

``` text
AnalyticsService.getCrmAnalytics()
DTO/types
controller response
tests
Step 3.5E.1 report
```

Step 3.5E.1 reported:

``` text
8/8 metrics reconciled
```

Identify those exact current metrics.

Produce:

  --------------------------------------------------------------------------------
  Metric     API field  Meaning    Format     Population   Period      UI
                                                           semantics   component
  ---------- ---------- ---------- ---------- ------------ ----------- -----------
                                                                       

  --------------------------------------------------------------------------------

------------------------------------------------------------------------

## 10. repeatCustomers --- MUST REMAIN ABSENT

Step 3.5E.1 explicitly removed:

``` text
repeatCustomers
```

Reason:

``` text
no canonical business definition existed
```

Therefore:

``` text
repeatCustomers API → ABSENT
repeatCustomers UI → ABSENT
repeatCustomers frontend derivation → FORBIDDEN
```

Do not reintroduce it under another label.

------------------------------------------------------------------------

## 11. CRM ANALYTICS PAGE / SECTION

If canonical Step 3.6 requires a dedicated CRM Analytics page, implement
it within the existing application information architecture.

Do not invent a second design system.

Audit and reuse existing components from:

``` text
Command Center
Analytics
CRM
shared KPI cards
shared charts
date controls
comparison controls
loading skeletons
empty states
error states
formatters
```

Expected visual structure should be derived from actual available
metrics.

Possible structure only if supported by API:

``` text
CRM Analytics
│
├─ period controls
├─ KPI summary
├─ lifecycle breakdown
├─ source breakdown
├─ manager breakdown
└─ other canonical API-backed CRM analytics
```

Do not display a block just because it appears in this example.

------------------------------------------------------------------------

## 12. NAVIGATION

Integrate CRM Analytics into existing CRM navigation only where
canonical roadmap requires it.

Possible hierarchy:

``` text
CRM
├ Customers
├ Partners
└ Analytics
```

But **actual existing navigation + roadmap wins**.

Do not unnecessarily reorganize CRM Center.

Do not rename working sections without canonical reason.

------------------------------------------------------------------------

## 13. PLATFORM VS PARTNER CONSUMER

Determine from canonical roadmap exactly which consumer UI belongs to
Step 3.6.

Possible backend capability:

``` text
Platform → cross-partner
Partner → own Partner
```

This does NOT automatically mean both UIs must be built in this step.

Produce:

  -------------------------------------------------------------------------
  Consumer           Backend supported   Canonical Step 3.6 Action
                                                UI required 
  --------------- -------------------- -------------------- ---------------
  Platform CRM                                              
  Analytics                                                 

  Partner CRM                                               
  Analytics                                                 
  -------------------------------------------------------------------------

Implement only required consumer(s).

If Partner UI belongs to a later Partner Workspace stage:

``` text
DEFER
```

Do not prematurely implement it.

------------------------------------------------------------------------

## 14. PLATFORM CRM ≠ PARTNER WORKSPACE

Mandatory:

``` text
Platform CRM
=
TravelHub manages Customers and Partners

Partner Workspace CRM
=
Partner manages its own customer relationships/business
```

Do not merge their navigation or authority.

------------------------------------------------------------------------

## 15. PERIOD CONTROLS

Audit what `/analytics/crm` actually supports.

If API supports:

``` text
dateFrom
dateTo
period
comparison
```

use the supported controls.

If comparison is not supported:

``` text
DO NOT fake comparison in frontend.
```

If period is supported, use the same date/timezone semantics already
proven in backend.

------------------------------------------------------------------------

## 16. BREAKDOWNS

For every breakdown exposed by the API:

``` text
API categories
→ localized UI labels
→ correct values
```

Do not silently drop:

``` text
null
unassigned
unknown
other
```

if they are legitimate canonical buckets.

If null bucket should not exist according to backend contract, report it
as a defect instead of hiding it.

------------------------------------------------------------------------

## 17. NUMERIC RECONCILIATION

For every displayed CRM Analytics metric:

``` text
API value = UI value
```

For breakdowns:

``` text
API category map = UI category map
```

No frontend recomputation.

Produce complete evidence:

  Metric/Breakdown     API   UI   Equal
  ------------------ ----- ---- -------
                                

------------------------------------------------------------------------

## 18. ZERO / EMPTY DATA

The analytics UI must correctly distinguish:

``` text
0
empty population
no data for period
loading
API error
unauthorized
```

Do not show blank cards.

Do not convert legitimate zero into `—` unless existing design contract
explicitly does so.

------------------------------------------------------------------------

## 19. FORMATTING

Use shared formatters for:

``` text
integer
decimal
percentage
currency
date
date range
```

Do not format values inconsistently with existing Analytics/Command
Center.

------------------------------------------------------------------------

## 20. I18N

CRM Analytics must work in:

``` text
RU
AZ
EN
```

Required:

``` text
raw i18n keys = 0
raw backend enums = 0
mixed locale = 0
hardcoded RU on AZ/EN = 0
```

Localize:

``` text
page title
KPI labels
breakdown labels
filters
period controls
empty state
error state
tooltips
chart legends
```

------------------------------------------------------------------------

## 21. ENTITLEMENT / PERMISSION AUTHORITY

Do not create frontend-only security.

Preserve:

``` text
Entitlement ≠ Permission
Frontend hidden ≠ server denial
```

Step 3.5E.1 accepted that current `/analytics/crm` authority does not
use a separate Basic/Pro tier gate and relies on canonical
permission/workspace/scope authority.

Verify current source before implementation.

Do not add an arbitrary Pro-only gate merely because the UI is new.

Also do not claim:

``` text
"read-only means Basic"
```

as a general architectural rule.

------------------------------------------------------------------------

## 22. SECURITY

Use actual current permissions.

Verify at minimum:

``` text
authorized actor → ALLOW
missing analytics permission → DENY
Partner → Platform cross-scope → DENY
Partner A → Partner B data → DENY
```

If only Platform UI is in Step 3.6, Partner API scope must still remain
regression-tested if supported by backend.

------------------------------------------------------------------------

# EXISTING CRM SURFACES --- REGRESSION ONLY

## 23. DO NOT REDESIGN WORKING CRM

The following are **not primary implementation targets** if current
repository/runtime confirms they are already complete:

``` text
CRM Center
Customers list
Partners list
Customer 360
Partner 360
Activity
Notes
existing filters
existing pagination
existing localization
related entity labels
```

For these:

``` text
VERIFY
DO NOT REWRITE
```

Production changes are allowed only if the Step 3.6 integration actually
causes or exposes a concrete defect.

------------------------------------------------------------------------

## 24. CUSTOMER 360 REGRESSION

Smoke-test actual existing Customer 360.

Do not add/reinvent tabs.

Verify representative data on actual tabs.

At minimum ensure:

``` text
page loads
tab navigation works
Activity works
Notes works
existing commercial tabs work
deep links work
human-readable labels remain
```

------------------------------------------------------------------------

## 25. PARTNER 360 REGRESSION

Same principle.

Do not add a Payments tab merely because Customer 360 has one.

Use actual current Partner 360 topology.

Verify:

``` text
page loads
actual tabs work
Activity
Notes
commercial relations
Storefront where present
human-readable labels
deep links
```

------------------------------------------------------------------------

## 26. UUID DISPLAY REGRESSION

Previously fixed display rule must remain:

``` text
visible label → human-readable business value
href/internal identity → UUID/ID
```

Representative audit:

``` text
Customer → name
Partner → company name
Order → ORD-...
Booking → BKG-...
Payment → PAY-...
Refund → RFD-...
Product/Service → title
```

Required:

``` text
resolvable UUID visible labels = 0
```

This is regression verification, not a reason to refactor all 360
components again.

------------------------------------------------------------------------

## 27. ACTIVITY / NOTES REGRESSION

Preserve:

``` text
CrmActivity shared timeline
History tab remains removed
cursor pagination
source/date filters
localized events
deep links
Operational Notes
Notes → Activity live projection
```

Do not build another Activity model.

------------------------------------------------------------------------

## 28. PAYMENT / REFUND REGRESSION --- HARD GATE

Preserve:

``` text
Payment.customerId
OR
Payment.orderId → Order.customerId
```

and:

``` text
Refund
→ Payment
→ customerId
OR
→ Payment → Order → customerId
```

Mandatory baseline:

``` text
7e4fe8c preserved
```

Required regression evidence:

``` text
REFUND CrmActivity customerId null = 0
cross-customer Payment leakage = 0
cross-customer Refund leakage = 0
missing Payment Activity = 0
missing Refund Activity = 0
```

Use one representative Customer with Refunds and reconcile:

``` text
DB/source
→ CrmActivity
→ API
→ Customer 360 Activity UI
```

Counts must be internally consistent.

------------------------------------------------------------------------

## 29. PARTNER ATTRIBUTION REGRESSION

Preserve:

``` text
Order.sellerPartnerId
```

No cross-partner leakage.

No invalid Prisma relations.

No N+1.

------------------------------------------------------------------------

# IMPLEMENTATION DISCIPLINE

## 30. NO UNNECESSARY BACKEND WORK

Expected Step 3.6 implementation should primarily be
frontend/integration if the analytics API already satisfies canonical
requirements.

Expected:

``` text
new backend engine = 0
new CRM analytics formulas = 0
schema = 0
migration = 0
```

If actual UI requirement cannot be supported by current API:

``` text
STOP
report exact missing backend contract
classify whether it is an in-scope Step 3.6 gap
do not invent a large backend extension silently
```

Small DTO/API projection corrections may be made only if strictly
required and fully evidenced.

------------------------------------------------------------------------

## 31. NO N+1 / NO CLIENT-SIDE AGGREGATION

Forbidden:

``` text
N+1 relation lookups
client-side KPI aggregation
client-side population counting
fetch-all to build analytics
invalid Prisma relations
```

------------------------------------------------------------------------

## 32. CLEAN RUNTIME

Before browser acceptance:

``` text
build current checkout
stop stale frontend/backend
clear stale .next if necessary
restart from current HEAD
login via actual browser UI
confirm valid HttpOnly travelhub.auth
hard reload
```

Do not treat curl/localStorage token as equivalent to browser session.

------------------------------------------------------------------------

## 33. BROWSER-FIRST ACCEPTANCE

Step 3.6 is a UI stage.

Source/tests alone cannot close it.

Use actual browser.

For CRM Analytics prove:

``` text
navigation
page rendering
all KPI cards
all breakdowns
period controls
loading
zero/empty
error
RU
AZ
EN
permissions
API→UI numeric parity
```

Capture actual representative values in report.

------------------------------------------------------------------------

## 34. EXISTING CRM BROWSER SMOKE

Do not perform a giant redesign audit.

Perform focused smoke regression:

``` text
Customers opens
Customer 360 opens
Partners opens
Partner 360 opens
Activity opens
Notes opens
known related labels remain human-readable
known Refund Activity remains visible
```

If a regression is found:

``` text
STOP premature closure
fix only the concrete regression
retest
```

------------------------------------------------------------------------

## 35. TARGETED TESTS

Add tests for new Step 3.6 implementation, especially:

``` text
CRM Analytics page/component
API integration
metric rendering
breakdown rendering
period controls if supported
loading state
empty state
error state
permission/navigation behavior
RU/AZ/EN keys
repeatCustomers absent
```

Do not create tests for fake functionality not in canonical scope.

------------------------------------------------------------------------

## 36. FULL REGRESSION

Run:

``` text
Backend full tests
Backend TSC
Backend build

Analytics targeted tests

Frontend targeted tests
Frontend full tests
Frontend TSC
Frontend build
```

Required:

``` text
0 failures
0 new skipped
```

Analytics targeted baseline:

``` text
65/65 PASS
```

or a higher current count with 0 failures/skips.

Report exact counts.

------------------------------------------------------------------------

## 37. PRESERVE PRIOR CLOSURES

Regression smoke:

``` text
Step 3.5.3
Step 3.5A
Step 3.5B
Step 3.5C
Step 3.5D
Step 3.5E
Step 3.5E.1
```

Especially:

``` text
Customer/Partner Activity
Operational Notes
Customer↔Partner relationship
Partner intake
Payment ownership
Refund ownership
Partner attribution
analytics scope/security
```

------------------------------------------------------------------------

## 38. STEP 3.50 MUST REMAIN

Preserve:

``` text
Step 3.50 — Workforce / Employee Performance Management
```

`e4b38a3` must remain reachable.

Do not implement Step 3.50.

------------------------------------------------------------------------

## 39. SUPPLIER / PROCUREMENT EXCLUDED

Do not implement:

``` text
Supplier
Purchase
PurchaseItem
SupplierPayment
CostAllocation
COGS
Supplier Payables
procurement profitability
```

------------------------------------------------------------------------

# REQUIRED EVIDENCE

## 40. GAP ANALYSIS MATRIX

Before implementation:

  -------------------------------------------------------------------------
  Canonical              Already Evidence                 Gap? Action
  Step 3.6          implemented?                               
  requirement                                                  
  ------------- ---------------- ------------ ---------------- ------------
                                                               

  -------------------------------------------------------------------------

This matrix is mandatory.

The purpose is to prevent rewriting already completed CRM functionality.

------------------------------------------------------------------------

## 41. CRM ANALYTICS UI MATRIX

If confirmed in scope:

  ------------------------------------------------------------------------
  UI block     API field(s)  Existing shared    New component Result
                            component reused                  
  ------------ ------------ ---------------- ---------------- ------------
                                                              

  ------------------------------------------------------------------------

------------------------------------------------------------------------

## 42. METRIC RECONCILIATION MATRIX

  Metric     API value   UI value   Equal
  -------- ----------- ---------- -------
                                  

For breakdowns:

  Breakdown   API map   UI map     Equal
  ----------- --------- -------- -------
                                 

All current canonical metrics must be covered.

------------------------------------------------------------------------

## 43. CONSUMER TOPOLOGY MATRIX

  Consumer     API support   Step 3.6 UI scope   Implemented UI Result
  ---------- ------------- ------------------- ---------------- --------
  Platform                                                      
  Partner                                                       

No premature consumer UI.

------------------------------------------------------------------------

## 44. I18N MATRIX

  Surface                RU   AZ   EN   Raw keys   Raw enums   Mixed locale
  -------------------- ---- ---- ---- ---------- ----------- --------------
  CRM Analytics                                              
  Existing CRM smoke                                         

------------------------------------------------------------------------

## 45. SECURITY MATRIX

  Actor                Surface/API          Expected   Actual
  -------------------- -------------------- ---------- --------
  Authorized           CRM Analytics                   
  Missing permission   CRM Analytics                   
  Partner A            Partner A scope                 
  Partner A            Partner B scope                 
  Partner              Platform CRM scope              

Use only applicable/current actors.

------------------------------------------------------------------------

## 46. EXISTING CRM REGRESSION MATRIX

  Surface           Before   After     Regression
  ----------------- -------- ------- ------------
  CRM Center        PASS             
  Customers         PASS             
  Customer 360      PASS             
  Partners          PASS             
  Partner 360       PASS             
  Activity          PASS             
  Notes             PASS             
  Related labels    PASS             
  Refund Activity   PASS             

Expected regression count:

``` text
0
```

------------------------------------------------------------------------

## 47. GIT DISCIPLINE

Before implementation:

``` bash
git status --short
git rev-parse HEAD
git rev-parse --verify @{u}
git diff --check
```

Expected:

``` text
HEAD = 7e52f68
origin/master = 7e52f68
worktree clean
```

Before commit inspect exact diff.

Stage exact files only.

Forbidden:

``` bash
git add .
git add -A
git push --force
```

------------------------------------------------------------------------

## 48. IMPLEMENTATION REPORT

Create:

``` text
docs/prompts/PHASE_3_STEP_3.6_CRM_CENTER_UI_IMPLEMENTATION_REPORT.md
```

Report must clearly distinguish:

``` text
ALREADY IMPLEMENTED BEFORE STEP 3.6
vs
NEWLY IMPLEMENTED IN STEP 3.6
```

This distinction is mandatory.

Do not claim existing Customers/Partners/360 functionality as new Step
3.6 work.

------------------------------------------------------------------------

## 49. ROADMAP UPDATE

Only after all acceptance gates pass:

update:

``` text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Rules:

``` text
additive history
no silent renumbering
preserve Step 3.50
preserve prior closure history
record actual Step 3.6 GAP implemented
mark Step 3.6 COMPLETE only after browser evidence
read exact NEXT
do not start NEXT
```

------------------------------------------------------------------------

# VERDICT

## 50. VERDICT A HARD GATES

VERDICT A requires:

1.  Starting HEAD verified as `7e52f68`.
2.  Clean starting worktree.
3.  Canonical Step 3.6 read.
4.  Exact canonical scope reported.
5.  GAP matrix completed before implementation.
6.  Existing CRM surfaces correctly classified as existing vs missing.
7.  No unnecessary redesign/refactor of working CRM surfaces.
8.  Actual missing Step 3.6 UI implemented.
9.  If CRM Analytics is canonical GAP, it consumes existing
    `/analytics/crm`.
10. No second analytics engine.
11. No frontend metric aggregation.
12. Exact current analytics contract read from repository.
13. All canonical current metrics rendered correctly.
14. `repeatCustomers` absent.
15. API→UI metric parity PASS.
16. Breakdown parity PASS.
17. Period semantics match API.
18. No fake comparison.
19. Platform/Partner consumer topology matches roadmap.
20. No premature Partner UI if deferred.
21. Permission authority preserved.
22. Scope isolation preserved.
23. Cross-partner leakage = 0.
24. RU PASS.
25. AZ PASS.
26. EN PASS.
27. Raw i18n keys = 0.
28. Raw enums = 0.
29. Mixed locale = 0.
30. Loading state PASS.
31. Zero/empty state PASS.
32. Error state PASS.
33. Unauthorized state PASS.
34. Navigation/deep link PASS.
35. Existing CRM Center regression PASS.
36. Customers regression PASS.
37. Customer 360 regression PASS.
38. Partners regression PASS.
39. Partner 360 regression PASS.
40. Activity regression PASS.
41. Notes regression PASS.
42. History remains removed.
43. Related-entity UUID leakage regression = 0.
44. Payment ownership regression PASS.
45. Refund ownership regression PASS.
46. REFUND Activity null customerId = 0.
47. Missing Payment Activity = 0.
48. Missing Refund Activity = 0.
49. Cross-customer leakage = 0.
50. Refund DB→Activity→API→UI representative reconciliation PASS.
51. Partner attribution regression PASS.
52. No N+1 introduced.
53. No invalid Prisma relations.
54. Schema = 0 unless explicitly justified blocker.
55. Migration = 0 unless explicitly justified blocker.
56. Clean current runtime used.
57. Browser UI login/session valid.
58. Stale runtime excluded.
59. Analytics targeted tests 65/65 or higher, 0 FAIL.
60. Backend full tests 0 FAIL.
61. Backend TSC PASS.
62. Backend build PASS.
63. Frontend targeted PASS.
64. Frontend full tests 0 FAIL.
65. Frontend TSC PASS.
66. Frontend build PASS.
67. No new skipped tests.
68. Step 3.5.3 regression PASS.
69. Step 3.5A regression PASS.
70. Step 3.5B regression PASS.
71. Step 3.5C regression PASS.
72. Step 3.5D regression PASS.
73. Step 3.5E regression PASS.
74. Step 3.5E.1 regression PASS.
75. `7e4fe8c` preserved.
76. `e4b38a3` preserved.
77. Step 3.50 preserved.
78. Supplier/Procurement not implemented.
79. Workforce/Performance not implemented.
80. Report clearly separates existing vs new work.
81. Roadmap updated only after evidence.
82. Exact NEXT reread.
83. NEXT not started.
84. Real Final HEAD recorded.
85. HEAD == origin/master.
86. Final worktree clean.
87. P0 = 0.
88. P1 = 0.
89. No unresolved in-scope P2.

------------------------------------------------------------------------

## 51. SUCCESS VERDICT

Use exact canonical topology discovered from roadmap.

Example only if CRM Analytics is confirmed as the actual remaining Step
3.6 GAP:

``` text
VERDICT A — PHASE 3 — STEP 3.6 /
CRM CENTER UI /
EXISTING CRM SURFACES PRESERVED +
CRM ANALYTICS UI IMPLEMENTED OVER EXISTING SHARED ANALYTICS API +
API→UI RECONCILIATION +
RU/AZ/EN +
SECURITY + RUNTIME + REGRESSION VERIFIED /
FULLY CLOSED
```

Otherwise use the actual canonical result.

------------------------------------------------------------------------

## 52. FAILURE VERDICT

If any mandatory in-scope gate fails:

``` text
VERDICT B — PHASE 3 — STEP 3.6 /
CRM CENTER UI /
INCOMPLETE

STEP 3.6 — OPEN
NEXT — BLOCKED
```

No conditional VERDICT A.

------------------------------------------------------------------------

## 53. REQUIRED FINAL RESPONSE

``` text
VERDICT:

REPOSITORY
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
Worktree:
7e52f68 preserved:
7e4fe8c preserved:
9674ce0 preserved:
e4b38a3 preserved:

CANONICAL STEP 3.6
Exact scope:
Dependencies:
Required consumers:
Required surfaces:
Exclusions:
Exact NEXT:

GAP ANALYSIS
[mandatory matrix]

ALREADY IMPLEMENTED BEFORE STEP 3.6
CRM Center:
Customers:
Partners:
Customer 360:
Partner 360:
Activity:
Notes:
Related labels:
Other:

NEWLY IMPLEMENTED IN STEP 3.6
[exact list]

CRM ANALYTICS
Canonical scope:
Route:
API:
Exact metric contract:
repeatCustomers:
Period:
Comparison:
Breakdowns:
Platform consumer:
Partner consumer:
Navigation:
Result:

API → UI RECONCILIATION
[complete metric matrix]
[complete breakdown matrix]

I18N
RU:
AZ:
EN:
Raw keys:
Raw enums:
Mixed locale:

SECURITY
Permission:
Platform scope:
Partner scope:
Cross-partner:
Unauthorized:

EXISTING CRM REGRESSION
CRM Center:
Customers:
Customer 360:
Partners:
Partner 360:
Activity:
Notes:
History:
Related labels:
UUID leakage:

PAYMENT / REFUND
Payment ownership:
Refund ownership:
REFUND null customerId:
Missing Payment Activity:
Missing Refund Activity:
Cross-customer leakage:
Representative Customer:
DB Refund count:
CrmActivity Refund count:
API Refund count:
UI Refund count:

RUNTIME
Validation HEAD:
Backend rebuilt:
Frontend rebuilt:
Stale processes excluded:
.next:
Browser UI login:
HttpOnly session:

TESTS
Analytics:
Backend targeted:
Backend full:
Backend skipped:
Backend TSC:
Backend build:
Frontend targeted:
Frontend full:
Frontend skipped:
Frontend TSC:
Frontend build:

SCHEMA:
MIGRATION:
BACKEND PRODUCTION CHANGES:
FRONTEND PRODUCTION CHANGES:

STEP 3.50 PRESERVED:
SUPPLIER / PROCUREMENT:
WORKFORCE / PERFORMANCE:

FILES CHANGED:
REPORT:
ROADMAP:
COMMIT:
PUSH:

P0:
P1:
P2:

STEP 3.6 STATUS:
NEXT:
```

------------------------------------------------------------------------

## 54. STOP

After Step 3.6 is successfully closed:

``` text
STEP 3.6 — FULLY CLOSED
```

Report the exact NEXT stage from the canonical roadmap.

**STOP. Do not begin NEXT without a separate implementation prompt.**
