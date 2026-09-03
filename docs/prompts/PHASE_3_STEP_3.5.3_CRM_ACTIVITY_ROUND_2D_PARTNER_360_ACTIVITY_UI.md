# PHASE 3 --- STEP 3.5.3 --- PLATFORM CRM

## ROUND 2D --- PARTNER 360 ACTIVITY UI

### PARTNER SUBJECT AUTHORITY + UNIFIED ACTIVITY TIMELINE + FILTERS + CURSOR PAGINATION + I18N + RUNTIME EVIDENCE

**Все ответы разработчика, отчёт и roadmap updates --- строго на
русском.**

## 1. Контекст

``` text
Round 2A   Read Model Foundation                  ✅ CLOSED
Round 2B   Activity API + RBAC                    ✅ CLOSED
Round 2C   Customer 360 Activity UI               ✅ CLOSED
Round 2C.1 Runtime/I18N/History/Backfill          ✅ CLOSED
Round 2C.2 Commercial Cross-View Consistency      ✅ RE-CLOSED
Round 2C.2R Payment Ownership Remediation         ✅ CLOSED (990e599)
Round 2D   Partner 360 Activity UI                ⏭ CURRENT
```

Не регрессировать исправление `990e599`.

## 2. Цель

Добавить в **Platform CRM → Partner 360** canonical вкладку `Activity`,
используя существующий `CrmActivity` engine и Customer 360 UX pattern.

Критически важно: Partner Activity --- не копия Customer Activity с
заменой ID. Для каждого source type должна быть доказана canonical
Partner subject authority.

## 3. Repository-first

Перед изменениями:

``` bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -120
git diff
git diff --check
```

Зафиксировать repository/branch/HEAD/origin/worktree и reachable
`990e599`. Не reset/revert legitimate work.

## 4. Audit до implementation

Исследовать actual repository:

-   Partner 360 page/tabs/components;
-   Partner detail API;
-   `CrmActivity` schema/service/controller;
-   source adapters;
-   Customer Activity component/API contract;
-   RBAC;
-   i18n;
-   canonical detail routes.

Не придумывать contract.

## 5. Partner Subject Authority Matrix

До production changes заполнить:

  ------------------------------------------------------------------------
  Source             Canonical Partner Direct/derived    Round 2D
                     authority                           supported
  ------------------ ----------------- ----------------- -----------------
  ORDER                                                  

  BOOKING                                                

  PAYMENT                                                

  REFUND                                                 

  OPERATIONAL_NOTE                                       

  CUSTOMER_HISTORY                                       

  Other registered                                       
  sources                                                
  ------------------------------------------------------------------------

Из существующей архитектуры проверить `Order.sellerPartnerId` как
canonical Order Partner attribution.

Для derived sources использовать actual schema, например:

``` text
Booking.orderId → Order.sellerPartnerId
Payment.orderId → Order.sellerPartnerId
Refund → canonical Payment/Order path → Order.sellerPartnerId
```

Не использовать несуществующие `include.order` / `include.product`.
Cross-schema lookup --- batch/findMany/Map, без N+1.

## 6. Customer ownership ≠ Partner ownership

Не менять исправленную Customer Payment authority:

``` text
Payment.customerId
OR Payment.orderId → Order.customerId
```

Partner attribution --- отдельная ось. Не смешивать Customer и Partner
subject semantics.

## 7. Partner Activity API

Audit существующего endpoint. Если canonical endpoint отсутствует ---
реализовать минимальный route по repository conventions (semantic
equivalent `GET /partners/:partnerId/activity`).

Поддержать existing Activity contract:

``` text
cursor
limit
sourceType
dateFrom
dateTo
```

Не создавать второй Activity engine.

Backend обязан server-side:

-   валидировать Partner;
-   применять RBAC;
-   фильтровать exact Partner subject;
-   не доверять frontend filtering.

Acceptance:

``` text
wrong-partner events = 0
cross-partner leakage = 0
```

## 8. Historical + Live Projection

Для supported sources доказать historical Partner attribution. Если
existing rows неполны --- исправить adapters/projection и выполнить
controlled reconciliation без DB reset/reseed.

После reconciliation:

``` text
missing expected = 0
wrong Partner = 0
orphans = 0
duplicates = 0
errors = 0
```

Новый supported live event должен появляться в Partner Activity **без
manual rebuild**.

Сохранить backfill concurrency protection.

## 9. Partner 360 UI

Добавить `Activity` в actual Partner 360 tabs, не переименовывая
unrelated tabs.

Использовать Customer Activity UX pattern:

-   source/event labels;
-   timestamp;
-   reference/link;
-   Source + date filters;
-   cursor `Load more`;
-   loading;
-   empty;
-   error.

Report previous/new tab order и позицию Activity.

## 10. Filters + Cursor

Filters server-side:

``` text
sourceType
dateFrom
dateTo
```

При filter/Partner change:

``` text
cursor reset
items reset/isolated
correct request
```

Cursor proof:

``` text
P1/P2/P3
unique IDs
overlap = 0
stable ordering
Load more append
correct end state
```

## 11. Partner A → B → A Isolation

Обязательный runtime test:

``` text
Partner A → Activity
Partner B → Activity
Partner A → Activity
```

Проверить route partnerId, request partnerId, rendered events, filters,
cursor, stale response.

Acceptance:

``` text
A events in B = 0
B events in A = 0
stale items = 0
wrong subject requests = 0
```

Использовать AbortController/equivalent stale-response protection.

## 12. I18N / Presentation

RU/AZ/EN:

-   Activity tab;
-   source labels;
-   event labels;
-   filters;
-   All sources;
-   dates;
-   Load more;
-   empty/error.

Acceptance:

``` text
mixed locale = 0
raw enum = 0
raw i18n key = 0
```

Не возвращать persisted RU system title как duplicate presentation
label. Presentation системных событий строить из locale-neutral
`eventType/sourceType/metadata + i18n`.

## 13. Links

Использовать только существующие canonical routes. Не создавать fake
links. Event Partner A не должен вести к объекту другого Partner.

## 14. RBAC

Partner 360 здесь --- **Platform CRM Partner 360**, не Partner
Workspace.

Audit existing CRM Activity permissions:

``` text
authorized internal role → 200
unauthorized → denied
anonymous → denied
```

Не смешивать Platform RBAC и PARTNER workspace entitlements.

## 15. Representative Partners + Global Audit

Выбрать populated Partner A и Partner B; Partner C только если нужен для
покрытия source type.

Зафиксировать IDs/codes и expected sources.

Заполнить:

  ---------------------------------------------------------------------------------
  Source          Canonical     Actual    Missing      Wrong     Orphan   Duplicate
                   expected                          Partner            
  ------------- ----------- ---------- ---------- ---------- ---------- -----------
  ORDER                                                                 

  BOOKING                                                               

  PAYMENT                                                               

  REFUND                                                                

  NOTES/OTHER                                                           
  supported                                                             
  ---------------------------------------------------------------------------------

Unsupported source не считать defect без canonical Partner authority.

## 16. Customer 360 Regression --- обязательный

После Round 2D проверить remediation `990e599`.

Если dataset неизменён:

``` text
CRM-00000089 Payments          = 4/4
CRM-00000089 Activity PAYMENT = 4/4
Payment wrong-customer         = 0
Payment duplicates             = 0
```

Также Customer A→B→A isolation PASS.

## 17. Operational Notes / History Regression

Проверить Customer Notes, Partner Notes, Notes RBAC, live projection.

Если Partner Notes --- supported Activity source, доказать правильную
Partner authority.

Legacy Customer History tab не возвращать. Не создавать отдельный
Partner History timeline.

## 18. Tests

Backend focused tests минимум:

1.  Partner Activity authorized.
2.  Unauthorized denied.
3.  Anonymous denied.
4.  exact Partner filtering.
5.  ORDER → sellerPartnerId.
6.  BOOKING derived authority.
7.  PAYMENT derived authority.
8.  REFUND derived authority.
9.  A/B isolation.
10. cursor.
11. source filter.
12. date filters.
13. combined filters.
14. historical/live projection where changed.
15. no invalid Prisma relation.
16. no duplicate.
17. no obvious N+1.

Frontend tests минимум:

1.  Activity tab.
2.  populated render.
3.  localized labels.
4.  date formatting.
5.  filters.
6.  Load more/cursor append.
7.  empty/error.
8.  A→B subject isolation.
9.  stale response protection.
10. links.
11. no duplicate persisted localized system title.

## 19. Runtime Browser Proof

Нужен populated browser proof:

``` text
Partner A populated Activity
Partner B / isolation
A→B→A
source filter
date filter
Load more
RU
AZ
EN
```

Empty state не считается populated proof.

## 20. Build / Regression Gates

Запустить actual repository commands:

``` text
Backend TSC
Backend build
CRM Activity unit
CRM Activity E2E
Partner Activity tests
Customer Activity regression
Operational Notes tests
Frontend TSC
Frontend build
Frontend tests
```

Последний известный baseline:

``` text
Frontend tests: 164/164
Backend tests: 83/85
2 backend failures заявлены как pre-existing
```

Не объявлять `83/85` полным PASS. Доказать, что baseline failures те же
и новых failures нет.

## 21. Evidence Matrices

### Browser

  Check                   Partner A   Partner B   Result
  ----------------------- ----------- ----------- --------
  Correct route subject                           
  Correct API subject                             
  Populated Activity                              
  ORDER                                           
  BOOKING                                         
  PAYMENT                                         
  REFUND                                          
  Source filter                                   
  Date filter                                     
  Cursor/Load more                                
  No leakage                                      

### I18N

  ----------------------------------------------------------------------------
  Locale   Tab      Sources   Events   Filters   Load     Empty    Raw/mixed
                                                 more              
  -------- -------- --------- -------- --------- -------- -------- -----------
  RU                                                               

  AZ                                                               

  EN                                                               
  ----------------------------------------------------------------------------

### Customer Regression

  Check                           Expected                          Actual   Result
  ------------------------------- --------------------------------- -------- --------
  CRM-00000089 Payments           previous 4 if dataset unchanged            
  CRM-00000089 PAYMENT Activity   previous 4 if unchanged                    
  Payment wrong customer          0                                          
  Payment duplicates              0                                          
  Customer A→B→A                  PASS                                       

## 22. Change Boundary

Не начинать:

``` text
Round 2E
Partner Workspace UI
Marketplace Basic CRM
Storefront Pro CRM
new CRM modules
new commercial lifecycle architecture
```

Только Platform CRM Partner 360 Activity.

## 23. Roadmap

После VERDICT A:

``` text
Round 2C.2R — Payment Customer Ownership Authority Remediation
    ✅ CLOSED (990e599)

Round 2D — Partner 360 Activity UI
    ✅ CLOSED (<SHA>)

NEXT:
Round 2E — Runtime/Security Closure
```

Если canonical roadmap использует другое название следующего round ---
сохранить canonical naming, не переименовывать молча.

## 24. Report

Создать:

``` text
docs/prompts/PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2D_PARTNER_360_ACTIVITY_UI_REPORT.md
```

Строго на русском.

## 25. Git Discipline

``` bash
git diff --check
git status --short
git diff
```

Stage exact files only. Запрещено `git add .` / `git add -A`.

После push:

``` bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

No force push.

## 26. Acceptance Criteria

VERDICT A только если:

1.  Partner 360/CrmActivity audited.
2.  Supported Partner sources defined.
3.  Canonical Partner authority proven per supported source.
4.  ORDER/BOOKING/PAYMENT/REFUND authority correct where supported.
5.  No invented Prisma relations / obvious N+1.
6.  Partner Activity API canonical.
7.  Server-side subject filtering + RBAC.
8.  Unauthorized/anonymous denied.
9.  Wrong Partner = 0.
10. Cross-partner leakage = 0.
11. Missing expected supported events = 0.
12. Orphans = 0.
13. Duplicates = 0.
14. Historical projection correct.
15. Live projection without manual rebuild.
16. Activity tab added.
17. Populated runtime proof.
18. Filters work.
19. Cursor/Load more stable, overlap 0.
20. A→B→A PASS.
21. Async stale-response protection PASS.
22. Links correct/no fake links.
23. RU/AZ/EN PASS.
24. Mixed locale/raw enums/raw keys = 0.
25. History remains removed.
26. Backfill safety preserved.
27. Operational Notes regression PASS.
28. Customer Activity regression PASS.
29. CRM-00000089 Payment remediation not regressed.
30. Backend TSC/build PASS.
31. Partner Activity tests/E2E PASS.
32. Frontend TSC/build PASS.
33. Frontend tests no new failures.
34. Existing backend baseline failures explicitly accounted.
35. Evidence matrices complete.
36. No unresolved P0/P1.
37. Russian report created.
38. Roadmap synchronized additively.
39. `git diff --check` clean.
40. Commit/push complete; HEAD == origin/master.
41. Next round not started.

## 27. Required Final Response

``` text
VERDICT:

РЕПОЗИТОРИЙ
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
Worktree:

PARTNER 360 AUDIT
Existing tabs:
Activity position:
Detail API:
Activity infrastructure:

PARTNER SUBJECT AUTHORITY
ORDER:
BOOKING:
PAYMENT:
REFUND:
NOTES/OTHER:
Unsupported:
Cross-schema strategy:
N+1:

PARTNER ACTIVITY API
Route:
RBAC:
Filters:
Cursor:
Subject authority:

HISTORICAL PROJECTION
Required:
Reconciliation:
Scanned:
Projected:
Errors:

LIVE PROJECTION
Event:
Partner:
Activity:
Manual rebuild:

REPRESENTATIVE PARTNERS
A:
B:
C:

GLOBAL PARTNER CONSISTENCY
...

A→B→A ISOLATION
...

PARTNER 360 UI
Tab:
Filters:
Load more:
Empty:
Error:
Links:

BROWSER PROOF
...

I18N
RU:
AZ:
EN:
Mixed:
Raw enums:
Raw keys:

CUSTOMER REGRESSION
CRM-00000089 Payments:
CRM-00000089 Activity PAYMENT:
Wrong customer:
Duplicates:
Isolation:

OPERATIONAL NOTES
Customer:
Partner:
RBAC:
Live projection:

TESTS / BUILDS
Backend TSC:
Backend build:
CRM Activity:
Partner Activity:
E2E:
Frontend TSC:
Frontend build:
Frontend tests:
Backend baseline failures:
Operational Notes:

FILES CHANGED
...
Schema:
Migration:

ROADMAP
Round 2C.2R:
Round 2D:
Next:

REPORT:
COMMIT:

ОСТАВШИЕСЯ FINDINGS
P0:
P1:
P2:

NEXT:
```

## 28. Verdict Rule

Success only:

``` text
VERDICT A — PHASE 3 STEP 3.5.3 /
CRM COMMUNICATIONS + ACTIVITY TIMELINE /
ROUND 2D — PARTNER 360 ACTIVITY UI /
PARTNER SUBJECT AUTHORITY + UNIFIED ACTIVITY TIMELINE +
FILTERS + CURSOR PAGINATION + I18N + RUNTIME EVIDENCE /
FULLY CLOSED
```

Otherwise:

``` text
VERDICT B — PHASE 3 STEP 3.5.3 /
ROUND 2D — PARTNER 360 ACTIVITY UI /
INCOMPLETE
```

No conditional VERDICT A.

## 29. STOP

После Partner authority + API + historical/live projection + UI +
filters/cursor + isolation + i18n + Customer regression + tests/builds +
browser proof + report + roadmap + commit/push:

**STOP.**

Не начинать следующий round без отдельного задания.
