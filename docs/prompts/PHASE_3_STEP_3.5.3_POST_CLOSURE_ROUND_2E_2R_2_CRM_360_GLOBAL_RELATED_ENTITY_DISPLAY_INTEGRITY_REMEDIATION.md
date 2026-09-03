# PHASE 3 --- STEP 3.5.3 --- PLATFORM CRM

## POST-CLOSURE ROUND 2E.2R.2 --- CRM 360 GLOBAL RELATED-ENTITY DISPLAY INTEGRITY REMEDIATION

### CUSTOMER 360 + PARTNER 360 / ALL TABS / ALL SELECTABLE RECORD TYPES / UUID & TECHNICAL-ID LEAKAGE CLOSURE

**Все ответы разработчика, evidence, отчёты и roadmap updates --- строго
на русском.**

------------------------------------------------------------------------

# 1. STATUS

Предыдущий Round 2E.2R.1 сообщил:

``` text
VERDICT A
Final HEAD: 85511ec
Step 3.5.3 — RE-CLOSED
```

Этот VERDICT **отменяется фактическим browser runtime**.

Пользователь после `85511ec` визуально подтвердил, что в реальном
интерфейсе UUID по-прежнему отображаются как primary visible labels.

Конкретный подтверждённый runtime пример в AZ locale:

``` text
Müştəri
b764c1cc-8036-463e-1186-1350a6f58cf9
→ /app/crm/customers/b764c1cc-8036-463e-1186-1350a6f58cf9

Satıcı tərəfdaş
aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
→ /app/crm/partners/aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
```

Expected semantics:

``` text
Müştəri
<canonical Customer/User human-readable name>
→ /app/crm/customers/b764c1cc-8036-463e-1186-1350a6f58cf9

Satıcı tərəfdaş
<canonical Partner/company human-readable name>
→ /app/crm/partners/aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
```

Следовательно:

``` text
Round 2E.2R.1 — VERDICT B / RUNTIME FAIL
Step 3.5.3 — OPEN
Round 2E.2R.2 — CURRENT
Step 3.5A — BLOCKED / NOT STARTED
```

**Browser runtime пользователя является authority.**

------------------------------------------------------------------------

# 2. CRITICAL SCOPE EXPANSION

Не исправлять только одну страницу, один Order или два известных UUID.

Пользователь уточнил обязательный scope:

> Проверить и исправить отображение связанных сущностей **на всех
> вкладках и во всех записях таблиц как Customer 360, так и Partner
> 360**.

Это системная remediation всего CRM 360 presentation layer.

Нужно проверить:

``` text
1. все actual tabs Customer 360;
2. все actual tabs Partner 360;
3. все таблицы/списки внутри них;
4. все selectable/clickable records;
5. detail / drawer / modal / expanded view / dedicated details page,
   открываемые из этих записей;
6. все related-entity references внутри таких views.
```

Нельзя закрыть round проверкой одной representative записи.

------------------------------------------------------------------------

# 3. PRIMARY CONTRACT

Для любой resolvable related entity:

``` text
VISIBLE PRIMARY LABEL
= canonical human-readable business value

HREF / INTERNAL IDENTITY / LOOKUP KEY
= canonical UUID/ID
```

Примеры:

``` text
Customer/User  → Tatiana Pedersen
Partner        → Baku Tours Pro
Order          → ORD-00000959
Booking        → BKG-00000959
Payment        → PAY-00000557
Service        → Baku City Tour
```

UUID разрешён:

``` text
в href
API identity
React key
internal state
foreign key
```

UUID **не разрешён как primary visible label**, если связанная сущность
существует и может быть разрешена.

------------------------------------------------------------------------

# 4. REPOSITORY BASELINE

Начать с actual repository state.

Expected previous reported HEAD:

``` text
85511ec
```

Но actual repo является authority.

До изменений выполнить:

``` bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -80
git diff
git diff --check
```

Зафиксировать:

``` text
Starting HEAD
origin/master
HEAD == origin/master
85511ec reachable
bdd8e62 reachable
e4b38a3 reachable
1a3aa23 reachable
worktree
```

Не откатывать legitimate предыдущие изменения.

------------------------------------------------------------------------

# 5. FIRST TASK --- INVENTORY ACTUAL CRM 360 SURFACES

До исправлений составить **реальный inventory из source + runtime**, а
не использовать предполагаемый список.

## Customer 360

Перечислить все actual tabs/sections:

``` text
tab name
route/query tab key
component
API endpoint
table/list component
whether rows are selectable
what opens after selection
```

Ожидаемые примеры могут включать:

``` text
Overview
Orders
Bookings
Payments
Partners
Activity
Notes
...
```

Но actual repository/runtime --- authority.

## Partner 360

То же самое.

Ожидаемые примеры могут включать:

``` text
Overview
Orders
Bookings
Users
Customers
Services
Activity
Notes
...
```

Не придумывать отсутствующие вкладки.

------------------------------------------------------------------------

# 6. DO NOT REPEAT THE PREVIOUS EVIDENCE FAILURE

Предыдущие rounds заявляли:

``` text
UUID leakage = 0
```

хотя пользователь продолжал видеть UUID.

Поэтому запрещено считать достаточным:

``` text
grep
source inspection
unit test only
single API response
single selected record
single locale
single tab
```

Final closure требует согласования:

``` text
source
+ API
+ runtime
+ browser presentation
```

------------------------------------------------------------------------

# 7. MANDATORY EXACT REGRESSION RECORDS

Следующие IDs являются обязательными regression cases, если записи всё
ещё существуют:

``` text
Customer UUID:
b764c1cc-8036-463e-1186-1350a6f58cf9

Partner UUID:
aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
```

Для них доказать:

``` text
DB/API canonical identity
canonical display name
visible browser label
href
click target
```

**Запрещено hardcode этих UUID или display names в production code.**

Если запись больше не существует --- доказать это DB/API evidence и
выбрать эквивалентную populated запись, но исходный case всё равно
должен быть объяснён.

------------------------------------------------------------------------

# 8. GLOBAL CUSTOMER 360 AUDIT

Для **каждой actual Customer 360 вкладки**, содержащей таблицу/список
записей:

1.  открыть вкладку;
2.  проверить visible table cells;
3.  выбрать/открыть записи;
4.  проверить полный detail surface;
5.  найти все related-entity fields;
6.  определить canonical display authority;
7.  проверить href;
8.  проверить click target.

Особенно проверить, где applicable:

``` text
Customer/User
Partner
Order
Booking
Payment
Service/Product/Listing
Employee/Owner/Assignee
Supplier
other entity references
```

Не добавлять новые поля только ради аудита.

------------------------------------------------------------------------

# 9. GLOBAL PARTNER 360 AUDIT

То же для **каждой actual Partner 360 вкладки** с таблицей/списком.

Проверить:

``` text
table row
selected record
detail/drawer/modal/page
all relation fields
all links
all fallbacks
```

User explicitly confirmed UUID leakage occurs for Partner-related
surfaces too.

------------------------------------------------------------------------

# 10. ALL RECORD TYPES, NOT ONLY ORDERS

Scope включает **все selectable record types**, реально существующие в
CRM 360.

Минимально, если существуют:

``` text
Orders
Bookings
Payments
Partners
Users
Customers
Services/Products/Listings
```

Также любые другие actual table/list record types, обнаруженные
inventory.

Не ограничиваться `orders/[id]` и `bookings/[id]`.

------------------------------------------------------------------------

# 11. TABLE ROW + SELECTED DETAIL ARE BOTH IN SCOPE

Каждая surface имеет два independent gates:

``` text
A. table/list presentation
B. selected-record presentation
```

Example FAIL:

``` text
Table:
Tatiana Pedersen

Selected detail:
b764c1cc-8036-463e-1186-1350a6f58cf9
```

Это всё ещё FAIL.

Обратный вариант тоже FAIL.

------------------------------------------------------------------------

# 12. RELATED-ENTITY TYPES

Проверить все actual related entity references.

Canonical expectations:

  Entity                    Visible label                     Internal identity
  ------------------------- --------------------------------- -------------------
  Customer/User             canonical full/display name       UUID
  Partner                   canonical company/partner name    UUID
  Order                     canonical order business code     UUID
  Booking                   canonical booking business code   UUID
  Payment                   canonical payment business code   UUID
  Service/Product/Listing   canonical title/name              UUID
  Employee/Owner/Assignee   canonical person/display name     UUID
  Supplier                  canonical supplier/company name   UUID

Последние два применимы только если уже существуют на in-scope CRM
surfaces.

------------------------------------------------------------------------

# 13. CUSTOMER VS USER IDENTITY MUST BE EXPLICIT

Не предполагать:

``` text
User.id == Customer.id
```

Если CRM Customer и auth/platform User являются разными entities,
определить canonical mapping.

Для каждого visible person reference должно быть понятно:

``` text
какая entity отображается
какое имя является canonical
какой 360/details route является canonical
какой UUID должен быть href identity
```

Нельзя исправить label и оставить ссылку на неправильный тип сущности.

------------------------------------------------------------------------

# 14. PARTNER IDENTITY MUST BE EXPLICIT

Для Partner:

``` text
visible = canonical Partner/company display name
href = canonical Platform CRM Partner 360 route
identity = Partner UUID
```

Не смешивать:

``` text
Platform CRM Partner 360
Partner Workspace
Supplier
Seller
Storefront tenant
```

без доказанного canonical mapping.

------------------------------------------------------------------------

# 15. BUSINESS OBJECT REFERENCES

Where displayed:

``` text
Order   → business code
Booking → business code
Payment → business code
Service/Product/Listing → canonical title
```

Не использовать UUID как label при наличии business identifier.

------------------------------------------------------------------------

# 16. ROOT-CAUSE TRACE --- REQUIRED

Для каждого класса дефекта проследить:

``` text
DB
→ ORM/query
→ service
→ DTO/API
→ frontend type
→ page/component
→ detail renderer
→ browser DOM
```

В отчёте указать root cause per entity type или shared root cause.

Possible causes:

``` text
backend returns raw FK only
backend display projection missing
wrong batch lookup key
frontend ignores displayName
frontend type missing field
renderer chooses id before name
generic metadata renderer prints raw FK
detail page uses different DTO than table
locale-specific branch uses old field
fallback uses UUID too early
wrong route mapping
```

------------------------------------------------------------------------

# 17. TRACE THE TWO USER-OBSERVED UUIDs END-TO-END

Mandatory.

## Customer

``` text
b764c1cc-8036-463e-1186-1350a6f58cf9
```

Trace:

``` text
DB record
→ canonical display value
→ API field
→ frontend received field
→ rendered visible text
→ href
→ click destination
```

## Partner

``` text
aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
```

Same trace.

Report exact reason why `85511ec` did not change what the user saw.

------------------------------------------------------------------------

# 18. DETERMINE WHY PREVIOUS FIX FAILED

This is mandatory.

Previous report claimed backend batch resolution + frontend labels were
fixed.

Determine whether failure came from:

``` text
wrong endpoint fixed
wrong component fixed
different detail page actually rendered
stale alternate renderer
locale branch not updated
API response missing enrichment in real path
frontend reads old field
different record type
runtime service not rebuilt
route points to another component
fallback masks display field
```

Do not proceed to VERDICT A without explaining this contradiction.

------------------------------------------------------------------------

# 19. SHARED RESOLUTION LAYER

If multiple CRM surfaces duplicate logic such as:

``` text
customerId → label
partnerId → label
orderId → label
```

prefer a consistent reusable projection/presentation contract where
architecturally appropriate.

But do **not** introduce an over-generalized global resolver that
guesses entity types.

Correct reuse is typed:

``` text
CustomerReference
PartnerReference
OrderReference
...
```

or equivalent existing project conventions.

------------------------------------------------------------------------

# 20. FORBIDDEN FAKE FIXES

Forbidden:

``` text
hide UUID
truncate UUID
first 8 chars
replace with "-"
replace with "User"
replace with "Partner"
replace with "Unknown" when resolvable
regex-detect UUID and guess route
hardcode known names
hardcode known UUIDs
browser-only mapping dictionary
client-side N+1 fetch per visible relation
```

Fix actual data projection/presentation authority.

------------------------------------------------------------------------

# 21. UNRESOLVED REFERENCES

If relation cannot resolve, classify:

``` text
optional relation absent
deleted entity
orphan/legacy FK
RBAC restriction
data-integrity defect
wrong FK
unsupported entity type
```

Report:

``` text
count
entity type
example
reason
expected behavior
```

Do not silently turn unresolved UUID into `-`.

Resolvable UUID leakage must be 0.

------------------------------------------------------------------------

# 22. BACKEND BATCHING / N+1

If enrichment is backend-side:

``` text
collect IDs
→ unique IDs
→ batched findMany/query
→ Map
→ project DTO
```

No:

``` text
findUnique per row
findUnique per field
request per relation
```

Provide query-count or source-level evidence sufficient to demonstrate
no N+1.

------------------------------------------------------------------------

# 23. PRISMA / CROSS-SCHEMA SAFETY

Preserve prior architecture:

``` text
Order.sellerPartnerId = canonical seller Partner attribution
```

Do not reintroduce nonexistent relations such as invalid `include.order`
/ `include.product` where schema does not define them.

Cross-schema lookup must use actual IDs and batching.

------------------------------------------------------------------------

# 24. SUBJECT AUTHORITY / SECURITY

Display enrichment must not alter dataset membership.

Verify:

``` text
Customer A → only authorized Customer A commercial records
Partner A → only authorized Partner A commercial records
```

A related entity may be displayed only if the underlying record
legitimately references it and RBAC permits it.

Required:

``` text
cross-customer leakage = 0
cross-partner leakage = 0
```

------------------------------------------------------------------------

# 25. CUSTOMER PAYMENT OWNERSHIP MUST NOT REGRESS

Preserve canonical ownership:

``` text
Payment.customerId
OR
Payment.orderId → Order.customerId
```

If known representative dataset remains unchanged, re-check previous
expected customer/payment set.

Display enrichment must not change payment membership.

------------------------------------------------------------------------

# 26. PARTNER ATTRIBUTION MUST NOT REGRESS

Preserve existing canonical Partner attribution, including:

``` text
Order.sellerPartnerId
```

and actual existing Booking/Payment derivation paths.

Presentation fix must not change attribution.

------------------------------------------------------------------------

# 27. PARTNER PAYMENTS CONTRADICTION --- FINAL RECONCILIATION

Previous report claimed user had referred to a Partner Customer detail
panel rather than Partner 360.

Do not simply repeat that statement.

Revalidate actual runtime and record:

``` text
Partner 360 visible tabs
Partner-related customer detail tabs
routes
component names
```

Then classify precisely.

If Partner 360 Payments truly does not exist:

``` text
Partner 360 → Payments = N/A
```

with browser/source evidence.

------------------------------------------------------------------------

# 28. FILTER/I18N REGRESSION FROM bdd8e62

Preserve all legitimate prior fixes:

``` text
Customer Orders status
Customer Bookings status
Customer Payments status
Partner Orders status
Partner Bookings status
Partner Users status
crm.col.partner
```

No duplicate filters.

No client-side filtering of unbounded paginated datasets.

------------------------------------------------------------------------

# 29. LOCALIZATION

Mandatory browser audit:

``` text
RU
AZ
EN
```

For all affected relation labels and detail surfaces.

Required:

``` text
raw i18n keys = 0
raw enums = 0
mixed UI locale = 0
unintended UUID labels = 0
```

Person/company names and business codes remain canonical business
content, not UI translation keys.

------------------------------------------------------------------------

# 30. ALL-RECORD DATASET AUDIT

User requirement is not merely "one sample per tab."

For each in-scope endpoint/surface, perform a dataset-level audit
sufficient to detect unresolved references across **all
returned/accessible records**, not just current first page.

Where server pagination exists:

``` text
iterate pages/cursors or query underlying canonical dataset
```

For every record, inspect all relation IDs that should resolve.

Produce counts:

``` text
records audited
relation references audited
resolved references
legitimately absent references
unresolved references
UUID-visible candidates
```

Final:

``` text
resolvable unresolved references = 0
```

Do not implement expensive browser iteration if API/DB audit can prove
dataset integrity; browser still requires representative presentation
verification per surface.

------------------------------------------------------------------------

# 31. PAGINATION SAFETY

Audit must not be limited to:

``` text
first 20
current page
first cursor
```

This project has already had first-page ownership defects.

Dataset-level audit must cover all applicable pages/records.

------------------------------------------------------------------------

# 32. MANDATORY BROWSER MATRIX

For every actual tab containing selectable records:

  -----------------------------------------------------------------------------------------------
  Context    Tab     Table       Record   Detail   Related      UUID    Deep     RU     AZ     EN
                     label   selectable   opened      refs   leakage   links               
                      PASS                         checked                                 
  ---------- ----- ------- ------------ -------- --------- --------- ------- ------ ------ ------
  Customer   ...                                                                           
  360                                                                                      

  Partner    ...                                                                           
  360                                                                                      
  -----------------------------------------------------------------------------------------------

No blank rows for actual in-scope tabs.

------------------------------------------------------------------------

# 33. MANDATORY ENTITY-REFERENCE MATRIX

  ----------------------------------------------------------------------------------------------------
  Context    Tab     Record   Relation type   Related   Expected   Actual    Href    Click    Result
                                              ID        display    display           target   
  ---------- ------- -------- --------------- --------- ---------- --------- ------- -------- --------
  Customer                    Customer/User                                                   
  360                                                                                         

  Customer                    Partner                                                         
  360                                                                                         

  Partner                     Customer/User                                                   
  360                                                                                         

  Partner                     Partner                                                         
  360                                                                                         
  ----------------------------------------------------------------------------------------------------

Continue for every actual relation type encountered.

------------------------------------------------------------------------

# 34. MANDATORY DATASET AUDIT MATRIX

  ---------------------------------------------------------------------------------------
  Surface/API        Total   Relation   Resolved   Legitimately   Unresolved UUID leakage
                   records       refs                    absent                candidates
                   audited                                                   
  ------------- ---------- ---------- ---------- -------------- ------------ ------------
  Customer ...                                                               

  Partner ...                                                                
  ---------------------------------------------------------------------------------------

No first-page-only evidence.

------------------------------------------------------------------------

# 35. TABLE ↔ DETAIL PARITY

For each record type:

  -------------------------------------------------------------------------------
  Context/Tab   Relation    Table          Detail         Same        Result
                            presentation   presentation   canonical   
                                                          identity?   
  ------------- ----------- -------------- -------------- ----------- -----------
                                                                      

  -------------------------------------------------------------------------------

If table and detail use different label semantics → FAIL.

------------------------------------------------------------------------

# 36. DEEP-LINK VERIFICATION

For each related entity type encountered:

``` text
visible human-readable label
→ href contains canonical ID
→ click
→ correct entity/details/360 opens
```

At least one browser click proof per entity type and per context where
applicable.

Wrong href with correct label = FAIL.

------------------------------------------------------------------------

# 37. API CONTRACT TESTS

Add tests for relation projections used by CRM 360.

Where backend changed, verify:

``` text
ID preserved
display field populated
business code populated
missing relation behavior
batch resolution
subject isolation
```

Tests must use more than one related entity where batching matters.

------------------------------------------------------------------------

# 38. FRONTEND BEHAVIOR TESTS

Add/update tests for actual components used by runtime.

Mandatory assertions:

``` text
human-readable label rendered
raw UUID not rendered as primary label
correct href
fallback only for genuinely unresolved relation
```

Cover both:

``` text
Customer 360 path
Partner 360 path
```

and every shared renderer/component changed.

------------------------------------------------------------------------

# 39. PREVENT FALSE-POSITIVE TESTS

A test that passes because fixture already contains a display name
without exercising actual resolution is insufficient.

Fixtures must include:

``` text
relation ID
expected resolved display value
```

and verify the production mapping path.

------------------------------------------------------------------------

# 40. CLEAN RUNTIME AUTHORITY

After implementation:

``` text
restart backend/frontend changed services
verify actual build/commit
hard reload browser
```

No DB reset.

No reseed.

No volume deletion.

Record actual runtime commit/version if application exposes it;
otherwise prove process was restarted from current checkout.

------------------------------------------------------------------------

# 41. BROWSER EVIDENCE MUST USE THE FAILING PATH

Mandatory final proof must include the exact class of path where user
still sees defect.

For the two known IDs, if still present:

``` text
Customer:
b764c1cc-8036-463e-1186-1350a6f58cf9

Partner:
aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
```

Final screenshot/DOM evidence must show human-readable labels, while
href retains canonical UUID.

------------------------------------------------------------------------

# 42. TARGETED REGRESSIONS

Verify:

``` text
Customer Activity
Partner Activity
Customer Notes
Partner Notes
History remains removed
status filters
pagination
stale-request handling where existing
```

No unrelated redesign.

------------------------------------------------------------------------

# 43. FULL REGRESSION

Run actual repository commands:

``` text
Backend TSC
Backend build
Backend full tests
Frontend TSC
Frontend build
Frontend full tests
```

Prior baseline:

``` text
Backend 1236/1236 PASS
Frontend 243/243 PASS
Skipped 0
```

Counts may increase.

Required:

``` text
0 failed
0 new skipped
```

------------------------------------------------------------------------

# 44. SCHEMA / MIGRATION

Expected:

``` text
Schema = 0
Migration = 0
```

If schema/migration appears necessary:

**STOP before creating it** and report why presentation/projection
remediation cannot solve the issue.

------------------------------------------------------------------------

# 45. OUT OF SCOPE

Do not start:

``` text
Step 3.5A
Partner CRM Foundation implementation
Workforce implementation
Supplier/Procurement implementation
Partner Workspace redesign
new CRM entity model
global navigation redesign
History restoration
DB reset/reseed
```

------------------------------------------------------------------------

# 46. REPORT HISTORY CORRECTION

Preserve historical reports, but correct qualification additively.

Required history:

``` text
2E.2R initially reported A → later invalidated
2E.2R.1 initially reported A at 85511ec → invalidated by user browser runtime
2E.2R.2 opened for global CRM 360 display integrity remediation
```

Do not delete prior evidence.

------------------------------------------------------------------------

# 47. ROADMAP

Update canonical roadmap additively.

Before success:

``` text
Step 3.5.3 — OPEN
Round 2E.2R.2 — CURRENT
Step 3.5A — BLOCKED
```

After all gates:

``` text
Round 2E.2R.2 — FULLY CLOSED
Step 3.5.3 — RE-CLOSED
```

Preserve Workforce Step 3.50 and `e4b38a3` history.

Then reread roadmap for exact NEXT.

Expected if unchanged:

``` text
PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION
```

Do not start it.

------------------------------------------------------------------------

# 48. REPORT FILE

Create:

``` text
docs/prompts/PHASE_3_STEP_3.5.3_POST_CLOSURE_ROUND_2E_2R_2_CRM_360_GLOBAL_RELATED_ENTITY_DISPLAY_INTEGRITY_REMEDIATION_REPORT.md
```

Report strictly in Russian.

------------------------------------------------------------------------

# 49. GIT DISCIPLINE

Before staging:

``` bash
git diff --check
git status --short
git diff
```

Stage exact files only.

Forbidden:

``` bash
git add .
git add -A
git push --force
```

After commit/push:

``` bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

Required:

``` text
HEAD == origin/master
```

------------------------------------------------------------------------

# 50. VERDICT A GATES

VERDICT A разрешён только если одновременно выполнено:

1.  actual repository baseline captured;
2.  `85511ec` preserved/reachable;
3.  `e4b38a3` preserved/reachable;
4.  actual Customer 360 tab inventory complete;
5.  actual Partner 360 tab inventory complete;
6.  all table/list surfaces identified;
7.  all selectable record types identified;
8.  all selected-record presentation paths identified;
9.  exact known Customer UUID traced;
10. exact known Partner UUID traced;
11. reason previous `85511ec` fix failed explained;
12. Customer 360 all applicable tabs audited;
13. Partner 360 all applicable tabs audited;
14. table presentation audited;
15. selected-record presentation audited;
16. all actual related entity types inventoried;
17. Customer/User display resolution PASS;
18. Partner display resolution PASS;
19. Order display resolution PASS;
20. Booking display resolution PASS;
21. Payment display resolution PASS;
22. Service/Product/Listing display resolution PASS where applicable;
23. Employee/Owner display resolution PASS where applicable;
24. Supplier display resolution PASS where applicable;
25. resolvable UUID primary labels = 0;
26. raw DB IDs as unintended labels = 0;
27. wrong business codes = 0;
28. wrong deep links = 0;
29. Customer/User click targets correct;
30. Partner click targets correct;
31. Order click targets correct;
32. Booking click targets correct;
33. Payment click targets correct;
34. Service/Product click targets correct where applicable;
35. table/detail parity PASS;
36. dataset audit covers all applicable pages/records;
37. no first-page-only audit;
38. unresolved resolvable references = 0;
39. legitimate unresolved references classified;
40. no hardcoded UUID/name fixes;
41. no UUID regex guessing;
42. no N+1 introduced;
43. no invalid Prisma relations introduced;
44. subject authority preserved;
45. cross-customer leakage = 0;
46. cross-partner leakage = 0;
47. Customer Payment ownership preserved;
48. Partner attribution preserved;
49. Partner Payments contradiction fully reconciled;
50. previous status filters preserved;
51. `crm.col.partner` preserved;
52. RU PASS;
53. AZ PASS;
54. EN PASS;
55. raw i18n keys = 0;
56. raw enums = 0;
57. mixed locale = 0;
58. mandatory browser matrix complete;
59. mandatory entity-reference matrix complete;
60. mandatory dataset audit matrix complete;
61. table-vs-detail matrix complete;
62. targeted backend tests PASS if backend changed;
63. targeted frontend tests PASS;
64. backend full tests = 0 FAIL;
65. frontend full tests = 0 FAIL;
66. new skipped = 0;
67. backend TSC PASS;
68. backend build PASS;
69. frontend TSC PASS;
70. frontend build PASS;
71. clean runtime performed;
72. exact failing path revalidated;
73. known Customer UUID no longer visible as primary label;
74. known Partner UUID no longer visible as primary label;
75. Activity smoke PASS;
76. Notes smoke PASS;
77. History remains removed;
78. schema = 0;
79. migration = 0;
80. previous reports corrected additively;
81. roadmap updated additively;
82. Workforce history preserved;
83. P0 = 0;
84. P1 = 0;
85. no unresolved in-scope P2;
86. report created;
87. exact staging used;
88. commit/push complete;
89. HEAD == origin/master;
90. Step 3.5A not started.

------------------------------------------------------------------------

# 51. VERDICT RULE

Success only:

``` text
VERDICT A — PHASE 3 STEP 3.5.3 /
POST-CLOSURE ROUND 2E.2R.2 /
CRM 360 GLOBAL RELATED-ENTITY DISPLAY INTEGRITY REMEDIATION /
CUSTOMER 360 + PARTNER 360 /
ALL TABS + ALL SELECTABLE RECORD TYPES /
UUID & TECHNICAL-ID LEAKAGE CLOSURE /
FULLY CLOSED

ROUND 2E.2R.1 — SUPERSEDED / INVALIDATED BY RUNTIME
STEP 3.5.3 — RE-CLOSED
```

Otherwise:

``` text
VERDICT B — PHASE 3 STEP 3.5.3 /
POST-CLOSURE ROUND 2E.2R.2 /
CRM 360 GLOBAL RELATED-ENTITY DISPLAY INTEGRITY REMEDIATION /
INCOMPLETE

STEP 3.5.3 — OPEN
STEP 3.5A — BLOCKED
```

No conditional VERDICT A.

------------------------------------------------------------------------

# 52. REQUIRED FINAL RESPONSE FORMAT

``` text
VERDICT:

REPOSITORY
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
85511ec preserved:
e4b38a3 preserved:
Worktree:

WHY 2E.2R.1 FAILED
Exact reason:
Wrong endpoint/component/runtime path:
Evidence:

CRM 360 INVENTORY
Customer 360 tabs:
Customer selectable record types:
Partner 360 tabs:
Partner selectable record types:

EXACT USER RUNTIME CASES
Customer UUID:
Canonical display:
API:
Browser visible:
Href:
Click result:

Partner UUID:
Canonical display:
API:
Browser visible:
Href:
Click result:

ROOT CAUSE
Backend:
DTO/API:
Frontend:
Renderer:
Fallback:
Locale-specific behavior:

CUSTOMER 360 GLOBAL AUDIT
[all tabs/surfaces]

PARTNER 360 GLOBAL AUDIT
[all tabs/surfaces]

DATASET AUDIT
Records audited:
Relation refs audited:
Resolved:
Legitimately absent:
Unresolved:
UUID leakage candidates:

RELATED ENTITY RESOLUTION
Customer/User:
Partner:
Order:
Booking:
Payment:
Service/Product/Listing:
Employee/Owner:
Supplier:
Other:
Unresolved relations:

TABLE VS DETAIL
Customer 360:
Partner 360:

DEEP LINKS
Customer/User:
Partner:
Order:
Booking:
Payment:
Service/Product:
Other:
Wrong links:

PARTNER PAYMENTS RECONCILIATION
Partner 360:
Partner-related Customer detail:
Conclusion:

FILTER/I18N REGRESSION
Customer Orders:
Customer Bookings:
Customer Payments:
Partner Orders:
Partner Bookings:
Partner Users:
crm.col.partner:

LOCALIZATION
RU:
AZ:
EN:
Raw i18n keys:
Raw enums:
Mixed locale:

SECURITY / AUTHORITY
Cross-customer leakage:
Cross-partner leakage:
Customer Payment ownership:
Partner attribution:

REGRESSIONS
Customer Activity:
Partner Activity:
Customer Notes:
Partner Notes:
History:

TESTS
Backend targeted:
Backend full:
Backend TSC:
Backend build:
Frontend targeted:
Frontend full:
Frontend TSC:
Frontend build:
Skipped:

SCHEMA:
MIGRATION:

FILES CHANGED:

REPORT HISTORY CORRECTION
2E.2R:
2E.2R.1:
2E.2R.2:

ROADMAP
Step 3.5.3:
Round 2E.2R.2:
Workforce Step 3.50 preserved:
Exact NEXT:

P0:
P1:
P2:

REPORT:
COMMIT:
PUSH:
HEAD == origin/master:

NEXT:
```

------------------------------------------------------------------------

# 53. STOP

После успешного Round 2E.2R.2:

``` text
Round 2E.2R.2 — FULLY CLOSED
Step 3.5.3 — RE-CLOSED
```

**STOP.**

Не начинать `PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION` без
отдельного задания.
