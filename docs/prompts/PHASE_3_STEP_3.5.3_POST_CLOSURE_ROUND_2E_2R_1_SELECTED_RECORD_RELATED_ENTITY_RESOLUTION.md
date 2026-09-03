# PHASE 3 --- STEP 3.5.3 --- PLATFORM CRM

## POST-CLOSURE ROUND 2E.2R.1 --- CUSTOMER 360 + PARTNER 360 SELECTED-RECORD RELATED-ENTITY RESOLUTION

### DETAIL VIEW UUID/TECHNICAL-ID LEAKAGE REMEDIATION + RUNTIME CONTRADICTION CLOSURE

**Все ответы разработчика, evidence, отчёт и roadmap updates --- строго
на русском.**

------------------------------------------------------------------------

## 1. STATUS / WHY THIS ROUND EXISTS

Предыдущий `Round 2E.2R`, reported Final HEAD `bdd8e62`, **не
принимается как final closure**.

После отчёта пользователь повторно проверил реальный browser runtime и
подтвердил, что основной дефект не исправлен:

``` text
CRM → Клиенты → Customer 360 → Заказы
→ выбрать конкретный заказ
→ detail view выбранного заказа
```

Связанный пользователь по-прежнему отображается UUID вместо
human-readable имени.

Semantic example:

``` text
НЕПРАВИЛЬНО:
<user UUID>

ПРАВИЛЬНО:
Tatiana Pedersen
→ соответствующий Customer/User 360
```

Пользователь подтвердил тот же класс дефекта в `CRM → Partner 360`.

Поэтому:

``` text
Round 2E.2R — VERDICT B / RUNTIME DEFECT REMAINS
Step 3.5.3 — OPEN
Round 2E.2R.1 — CURRENT
Step 3.5A — BLOCKED
```

Browser runtime observation имеет приоритет над предыдущим claim
`UUID leakage = 0`.

------------------------------------------------------------------------

## 2. CRITICAL SCOPE CORRECTION

Предыдущая проверка была недостаточной: она в основном проверила
строки/ячейки таблиц.

Нужно проверить **оба уровня**:

``` text
A. table row/cell
B. selected row → opened/expanded/detail record view
```

Нельзя закрыть finding, проверив только A.

------------------------------------------------------------------------

## 3. PRIMARY OBJECTIVE

Системно исправить related-entity presentation в:

``` text
CRM → Customer 360
CRM → Partner 360
```

для:

``` text
Orders
Bookings
Payments
```

где эти surfaces реально присутствуют.

Проверять все реально отображаемые references:

``` text
Customer/User
Partner
Order
Booking
Payment
Service/Product/Listing
```

Canonical rule:

``` text
VISIBLE PRIMARY LABEL = canonical human-readable business/display value
IDENTITY / HREF / LOOKUP KEY = canonical UUID/ID
```

------------------------------------------------------------------------

## 4. REPOSITORY-FIRST

Actual repository is authority.

До изменений:

``` bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -60
git diff
git diff --check
```

Зафиксировать:

``` text
Starting HEAD
origin/master
HEAD == origin/master
bdd8e62 reachable
e4b38a3 reachable
1a3aa23 reachable
worktree
```

Не откатывать legitimate fixes из `bdd8e62` и Workforce roadmap update
`e4b38a3`.

------------------------------------------------------------------------

## 5. MANDATORY BROWSER REPRODUCTION

### Customer 360

Открыть populated Customer:

``` text
CRM → Клиенты → Customer 360 → Orders
→ выбрать реальный Order
→ открыть detail view
```

Зафиксировать для каждого relation field:

``` text
entity type
related UUID
current visible text
expected canonical display value
current href
expected href
```

Обязательно воспроизвести User/Customer UUID defect.

### Partner 360

Открыть populated Partner:

``` text
CRM → Партнёры → Partner 360 → Orders
→ выбрать реальный Order
→ открыть detail view
```

Зафиксировать те же данные.

Source-level assertion вместо browser reproduction запрещён.

------------------------------------------------------------------------

## 6. REQUIRED DETAIL SURFACES

Обязательно проверить selected-record details:

``` text
Customer 360 → Orders
Customer 360 → Bookings
Customer 360 → Payments

Partner 360 → Orders
Partner 360 → Bookings
Partner 360 → Payments
```

Если surface действительно отсутствует в текущем runtime, требуется
`N/A + browser + source evidence`, а не предположение.

------------------------------------------------------------------------

## 7. PARTNER PAYMENTS CONTRADICTION --- BLOCKER

Предыдущий отчёт заявил:

``` text
Partner Payments → N/A / no Payments tab
```

Но пользователь ранее наблюдал:

``` text
Partner 360 → Платежи → Status filter exists
```

Обязательно:

1.  clean runtime;
2.  открыть actual Partner 360;
3.  перечислить visible tabs;
4.  зафиксировать route/conditional rendering;
5.  определить, является ли Payments:
    -   реальной вкладкой;
    -   conditional/data-dependent вкладкой;
    -   nested section;
    -   другой surface, ошибочно принятой за Partner 360;
    -   действительно отсутствующей;
6.  reconciliation evidence включить в отчёт.

До reconciliation VERDICT A запрещён.

------------------------------------------------------------------------

## 8. CANONICAL DISPLAY CONTRACT

  Entity                    Visible primary value             Identity / href
  ------------------------- --------------------------------- -----------------
  Customer/User             canonical display/full name       UUID
  Partner                   canonical partner/company name    UUID
  Order                     canonical business order code     UUID
  Booking                   canonical business booking code   UUID
  Payment                   canonical business payment code   UUID
  Service/Product/Listing   canonical title/name              UUID

Actual repository fields are authority.

UUID допустим в route/internal identity, но не как primary label при
resolvable entity.

------------------------------------------------------------------------

## 9. EXPLICIT USER EXAMPLE

Запрещено:

``` text
User
aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
```

если entity разрешается.

Required:

``` text
User
Tatiana Pedersen
→ correct Customer/User 360 using canonical ID
```

Не hardcode имя/ID.

------------------------------------------------------------------------

## 10. ROOT-CAUSE TRACE

Для каждого failing relation проследить:

``` text
DB/source
→ service query
→ DTO/API payload
→ frontend API type
→ detail renderer
→ visible browser output
```

Классифицировать root cause:

``` text
backend returns only FK
DTO omits display value
frontend ignores available display value
generic detail renderer renders raw ID
fallback prioritizes UUID
cross-schema resolution missing
wrong entity mapping
deep-link mapper wrong
```

Не предполагать причину заранее.

------------------------------------------------------------------------

## 11. API EVIDENCE

Для минимум:

``` text
1 failing Customer Order
1 failing Partner Order
```

показать безопасный API payload fragment:

``` text
record ID
business code
related entity ID
related display value if projected
```

Без JWT/secrets.

Определить, где должен быть fix: backend, frontend, shared renderer или
combination.

------------------------------------------------------------------------

## 12. GENERIC RENDERER SAFETY

Если detail views используют generic `label → raw value` renderer,
исправление должно быть typed/semantic.

Запрещено:

``` text
UUID regex → guessed entity type
global UUID auto-link
substring/hide UUID
```

Correct:

``` text
known relation type
→ canonical entity projection
→ canonical display value
→ canonical route
```

------------------------------------------------------------------------

## 13. CUSTOMER/USER RESOLUTION

Не предполагать `User UUID == Customer UUID`.

Если существует mapping auth User ↔ CRM Customer, использовать canonical
repository mapping.

Required:

``` text
visible = canonical person/customer display name
href = correct Customer/User 360/details target
```

------------------------------------------------------------------------

## 14. PARTNER RESOLUTION

Required:

``` text
visible = canonical Partner/company name
href = Platform CRM Partner 360 canonical route
```

Не подменять Partner 360 ссылкой на Partner Workspace без canonical UX
evidence.

------------------------------------------------------------------------

## 15. BUSINESS ENTITY RESOLUTION

Where displayed:

``` text
Order   → business Order code + canonical ID link
Booking → business Booking code + canonical ID link
Payment → business Payment code + canonical ID link
Service/Product/Listing → canonical title/name + canonical ID link
```

Не показывать raw UUID, если business label существует.

------------------------------------------------------------------------

## 16. NO FAKE FIXES

Forbidden:

``` text
hide UUID
truncate UUID
first 8 chars
"-"
generic "User"/"Partner"
"Unknown" for resolvable entity
hardcoded names/IDs
frontend lookup per row/relation
invented Prisma relation
```

Если relation genuinely unresolved, классифицировать:

``` text
deleted entity
orphan/legacy data
optional absent relation
RBAC restriction
wrong stored ID
data integrity defect
```

------------------------------------------------------------------------

## 17. CUSTOMER 360 GATES

### Orders

Выбрать реальный Order и проверить все existing references:

``` text
Customer/User
Partner
Service/Product
Booking/Payment if displayed
```

### Bookings

Выбрать real Booking и проверить:

``` text
Customer/User
Partner
Order
Service/Product
```

где present.

### Payments

Выбрать real Payment и проверить:

``` text
Customer/User
Partner
Order
Service/Product
```

где present.

Если Service/Product не входит в actual Payment detail contract:
`N/A + evidence`.

------------------------------------------------------------------------

## 18. PARTNER 360 GATES

### Orders

Mandatory. User confirmed defect here.

Проверить все displayed references.

### Bookings

Проверить:

``` text
Customer/User
Order
Service/Product
other displayed references
```

### Payments

После reconciliation наличия вкладки проверить все displayed references,
если surface exists.

------------------------------------------------------------------------

## 19. TABLE ↔ DETAIL PARITY

Для каждой selected record сравнить table row и detail view.

FAIL examples:

``` text
table: Tatiana Pedersen
detail: <UUID>
```

или:

``` text
table: ORD-00000959
detail: <Order UUID>
```

Обе поверхности должны использовать одну canonical business identity
semantics.

------------------------------------------------------------------------

## 20. DEEP LINKS

Для каждого clickable relation:

``` text
visible label = canonical human-readable value
href = canonical entity route using canonical ID
click result = correct entity
```

Минимум runtime proof по одному:

``` text
Customer/User
Partner
Order
Booking if displayed
Payment if displayed
Service/Product if displayed
```

Correct label + wrong href = FAIL.

------------------------------------------------------------------------

## 21. BACKEND / CROSS-SCHEMA SAFETY

Если enrichment нужен на backend:

``` text
collect IDs
→ batch query
→ Map<ID, entity>
→ DTO projection
```

или valid Prisma relations, которые реально существуют.

Forbidden:

``` text
N+1
query per field
invalid include.order
invalid include.product
```

Preserve known authority:

``` text
Order.sellerPartnerId = canonical Partner Order attribution
```

Не менять ownership/attribution ради presentation.

------------------------------------------------------------------------

## 22. SECURITY

Display enrichment не должен расширять subject authority.

Required:

``` text
cross-customer leakage = 0
cross-partner leakage = 0
wrong-entity relation leakage = 0
```

------------------------------------------------------------------------

## 23. PRESERVE bdd8e62 FILTER/I18N FIXES

Не регрессировать:

``` text
Customer Orders Status localization
Customer Bookings Status localization
Customer Payments Status localization
Partner Orders Status
Partner Bookings Status
Partner Users Status
crm.col.partner
RU/AZ/EN
```

Partner Users отдельно revalidate:

``` text
actual tab/entity
endpoint
status field
query behavior
pagination
```

------------------------------------------------------------------------

## 24. I18N

Affected surfaces:

``` text
RU PASS
AZ PASS
EN PASS
raw i18n keys = 0
raw enums = 0
mixed UI locale = 0
```

Не переводить person/company names или business codes без отдельной
content-localization architecture.

------------------------------------------------------------------------

## 25. TARGETED TESTS

Frontend behavior tests должны открывать/render selected-record detail и
доказывать:

``` text
canonical display name/code shown
raw UUID not primary visible label
correct href generated
```

Минимум:

``` text
Customer Order detail → Customer/User
Partner Order detail → Customer/User
Booking detail relation
Payment detail relation
Partner relation
Service/Product relation where applicable
```

Если backend projection меняется, добавить tests:

``` text
related ID preserved
display field resolved
correct mapping
missing relation behavior
cross-subject isolation
batch resolution
```

------------------------------------------------------------------------

## 26. RUNTIME DATA

Использовать populated records.

Можно reuse, если существуют:

``` text
Customer: CRM-00000089
Partner: Baku Tours Pro
```

Но current DB --- authority.

В отчёте:

``` text
subject name/code + UUID
selected Order code + UUID
selected Booking code + UUID
selected Payment code + UUID
related UUID → resolved visible label
```

------------------------------------------------------------------------

## 27. MANDATORY DETAIL-VIEW MATRIX

Каждая ячейка: `PASS`, `FAIL` или `N/A + evidence`.

  ---------------------------------------------------------------------------------------------------------------
  Surface    Selected   Customer/User   Partner   Order   Booking   Payment   Service/Product   UUID      Deep
             record                                                                             leakage   links
  ---------- ---------- --------------- --------- ------- --------- --------- ----------------- --------- -------
  Customer                                                                                                
  Orders                                                                                                  

  Customer                                                                                                
  Bookings                                                                                                

  Customer                                                                                                
  Payments                                                                                                

  Partner                                                                                                 
  Orders                                                                                                  

  Partner                                                                                                 
  Bookings                                                                                                

  Partner                                                                                                 
  Payments                                                                                                
  ---------------------------------------------------------------------------------------------------------------

**No blank cells.**

------------------------------------------------------------------------

## 28. MANDATORY TABLE-VS-DETAIL MATRIX

  -----------------------------------------------------------------------
  Surface     Relation    Table       Detail      Canonical   Result
                          visible     visible     identity    
                                                  semantics   
                                                  same?       
  ----------- ----------- ----------- ----------- ----------- -----------
  Customer                                                    
  Orders                                                      

  Customer                                                    
  Bookings                                                    

  Customer                                                    
  Payments                                                    

  Partner                                                     
  Orders                                                      

  Partner                                                     
  Bookings                                                    

  Partner                                                     
  Payments                                                    
  -----------------------------------------------------------------------

No blank cells for existing surfaces.

------------------------------------------------------------------------

## 29. TECHNICAL-ID AUDIT

Inspect selected detail views for unintended visible:

``` text
UUID
database IDs
foreign keys
raw technical keys
raw i18n keys
raw enums
```

Do not flag legitimate business codes such as `ORD-*`, `BKG-*`, `PAY-*`,
`CRM-*`.

Required:

``` text
resolvable unintended UUID primary labels = 0
```

------------------------------------------------------------------------

## 30. CLEAN RUNTIME

Final evidence requires:

``` text
restart changed services
hard browser reload
no DB reset
no reseed
no volume deletion
```

Runtime/browser evidence is mandatory.

------------------------------------------------------------------------

## 31. FULL REGRESSION

Run actual repository commands:

``` text
Backend TSC
Backend build
Backend full tests
Frontend TSC
Frontend build
Frontend full tests
```

Prior accepted baseline:

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

## 32. FOCUSED REGRESSIONS

Verify:

``` text
Customer Payment ownership unchanged:
Payment.customerId OR Payment.orderId → Order.customerId

Customer Activity loads
Partner Activity loads
Customer Notes loads
Partner Notes loads
History remains removed
```

If known dataset unchanged:

``` text
CRM-00000089
Payments = 4
Activity PAYMENT = 4
```

Otherwise recalculate expected set.

------------------------------------------------------------------------

## 33. SCHEMA / MIGRATION

Expected:

``` text
Schema = 0
Migration = 0
```

If developer believes schema/migration is necessary: **STOP before
creating it** and report blocker.

------------------------------------------------------------------------

## 34. REPORT + ROADMAP CORRECTION

Do not delete previous report/history.

Additive correction must state:

``` text
Round 2E.2R initially reported VERDICT A at bdd8e62
post-report browser validation found unresolved selected-record UUID leakage
therefore Round 2E.2R final qualification = VERDICT B / superseded by 2E.2R.1
```

Roadmap:

``` text
Round 2E.2R.1 — CURRENT
Step 3.5.3 — OPEN
```

Only after full PASS:

``` text
Round 2E.2R.1 — FULLY CLOSED
Step 3.5.3 — RE-CLOSED
```

Preserve Workforce Step 3.50 / `e4b38a3`.

------------------------------------------------------------------------

## 35. REPORT FILE

Create:

``` text
docs/prompts/PHASE_3_STEP_3.5.3_POST_CLOSURE_ROUND_2E_2R_1_SELECTED_RECORD_RELATED_ENTITY_RESOLUTION_REPORT.md
```

------------------------------------------------------------------------

## 36. GIT DISCIPLINE

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

## 37. ACCEPTANCE CRITERIA

VERDICT A only if:

1.  Actual repository baseline captured.
2.  `bdd8e62` and `e4b38a3` preserved/reachable.
3.  Customer selected-Order UUID defect reproduced before fix.
4.  Partner selected-record UUID defect reproduced before fix.
5.  Root cause traced through API/frontend/detail renderer.
6.  Customer Orders detail audited.
7.  Customer Bookings detail audited.
8.  Customer Payments detail audited.
9.  Partner Orders detail audited.
10. Partner Bookings detail audited.
11. Partner Payments contradiction reconciled.
12. Partner Payments detail audited if present.
13. Resolvable Customer/User UUID primary labels = 0.
14. Resolvable Partner UUID primary labels = 0.
15. Resolvable Order UUID primary labels = 0.
16. Resolvable Booking UUID primary labels = 0.
17. Resolvable Payment UUID primary labels = 0.
18. Resolvable Service/Product UUID primary labels = 0 where displayed.
19. Canonical human-readable values shown.
20. Canonical IDs retained for identity/href.
21. All applicable deep links open correct entities.
22. Wrong-entity links = 0.
23. Table/detail presentation semantics consistent.
24. No UUID-regex guessing.
25. No hardcoded names/IDs.
26. No fake generic fallback for resolvable entity.
27. Legitimately unresolved relations classified.
28. No N+1 introduced.
29. No invalid Prisma relation introduced.
30. Subject authority preserved.
31. Cross-customer leakage = 0.
32. Cross-partner leakage = 0.
33. bdd8e62 Status/i18n fixes preserved.
34. Partner Users filter authority demonstrated.
35. `crm.col.partner` remains fixed.
36. Partner Payments contradiction explicitly resolved.
37. RU/AZ/EN PASS.
38. Raw i18n keys = 0.
39. Raw enums = 0.
40. Mixed locale = 0.
41. Targeted detail tests PASS.
42. Backend full suite = 0 FAIL.
43. Frontend full suite = 0 FAIL.
44. New skipped tests = 0.
45. Backend TSC/build PASS.
46. Frontend TSC/build PASS.
47. Clean runtime performed.
48. Browser proof covers every applicable selected-record detail.
49. API evidence covers representative Customer Order and Partner Order.
50. Detail-view matrix complete.
51. Table-vs-detail matrix complete.
52. Customer Payment ownership regression PASS.
53. Activity/Notes smoke PASS.
54. History remains removed.
55. Schema = 0.
56. Migration = 0.
57. Round 2E.2R report corrected additively.
58. Roadmap updated additively.
59. Workforce roadmap history preserved.
60. P0 = 0.
61. P1 = 0.
62. No unresolved in-scope P2.
63. Report created.
64. Exact staging.
65. Commit/push complete.
66. HEAD == origin/master.
67. Step 3.5A not started.

------------------------------------------------------------------------

## 38. VERDICT RULE

Success only:

``` text
VERDICT A — PHASE 3 STEP 3.5.3 /
POST-CLOSURE ROUND 2E.2R.1 /
CUSTOMER 360 + PARTNER 360 /
SELECTED-RECORD RELATED-ENTITY RESOLUTION /
DETAIL VIEW UUID/TECHNICAL-ID LEAKAGE REMEDIATION +
RUNTIME CONTRADICTION CLOSURE /
FULLY CLOSED

ROUND 2E.2R — SUPERSEDED / FINAL RUNTIME QUALIFICATION CORRECTED
STEP 3.5.3 — RE-CLOSED
```

Otherwise:

``` text
VERDICT B — PHASE 3 STEP 3.5.3 /
POST-CLOSURE ROUND 2E.2R.1 /
CUSTOMER 360 + PARTNER 360 /
SELECTED-RECORD RELATED-ENTITY RESOLUTION /
INCOMPLETE

STEP 3.5.3 — OPEN
```

No conditional VERDICT A.

------------------------------------------------------------------------

## 39. REQUIRED FINAL RESPONSE FORMAT

``` text
VERDICT:

REPOSITORY
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
bdd8e62 preserved:
e4b38a3 preserved:
Worktree:

RUNTIME REPRODUCTION
Customer 360 selected Order:
Before User/Customer visible:
Partner 360 selected Order:
Before related entity visible:
Partner Payments contradiction:

ROOT CAUSE
Backend projection:
Frontend mapping:
Detail renderer:
Deep-link mapping:

CUSTOMER 360 DETAIL AUDIT
Orders:
Bookings:
Payments:

PARTNER 360 DETAIL AUDIT
Orders:
Bookings:
Payments:

RELATED ENTITY RESOLUTION
Customer/User:
Partner:
Order:
Booking:
Payment:
Service/Product:
Unresolved relations:

UUID / TECHNICAL-ID AUDIT
Resolvable UUID primary labels:
Raw database IDs:
Raw i18n keys:
Raw enums:

DEEP LINKS
Customer/User:
Partner:
Order:
Booking:
Payment:
Service/Product:
Wrong links:

TABLE VS DETAIL
Customer Orders:
Customer Bookings:
Customer Payments:
Partner Orders:
Partner Bookings:
Partner Payments:

PRESERVED 2E.2R FIXES
Customer Orders Status:
Customer Bookings Status:
Customer Payments Status:
Partner Orders Status:
Partner Bookings Status:
Partner Users Status:
crm.col.partner:
Partner Payments status/tab:

LOCALIZATION
RU:
AZ:
EN:
Mixed locale:

SECURITY
Cross-customer leakage:
Cross-partner leakage:
RBAC:

REGRESSIONS
Customer Payment ownership:
Customer Activity:
Partner Activity:
Customer Notes:
Partner Notes:
History removed:

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

REPORT CORRECTION
Round 2E.2R:

ROADMAP
Round 2E.2R.1:
Step 3.5.3:
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

## 40. STOP

После успешного Round 2E.2R.1:

``` text
Round 2E.2R.1 — FULLY CLOSED
Step 3.5.3 — RE-CLOSED
```

**STOP.**

Не начинать `PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION` без
отдельного задания.
