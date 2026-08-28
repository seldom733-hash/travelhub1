# PHASE 3 --- STEP 3.5.3 --- PLATFORM CRM

## ROUND 2E --- RUNTIME + SECURITY + BACKFILL/REBUILD CLOSURE

### END-TO-END RUNTIME QUALIFICATION + RBAC/SUBJECT ISOLATION + REBUILD SAFETY + DATA CONSISTENCY + FINAL STEP 3.5.3 CLOSURE

**Все ответы разработчика, отчёт и roadmap updates --- строго на
русском.**

## 1. Canonical basis

Canonical roadmap задаёт этап именно как:

``` text
Round 2E — Runtime + Security + Backfill/Rebuild Closure
```

Предыдущие ключевые closures:

``` text
Round 2C.2R — Payment Ownership Remediation   CLOSED (990e599)
Round 2D    — Partner 360 Activity UI         CLOSED (2ac80b6)
Round 2E    — Runtime + Security + Backfill/Rebuild Closure  CURRENT
```

Round 2E --- final qualification/closure Step 3.5.3, не новый feature
round.

## 2. Цель

Финально квалифицировать весь
`STEP 3.5.3 — CRM COMMUNICATIONS + ACTIVITY TIMELINE` по:

``` text
A. Runtime
B. Security / Subject Authority / RBAC
C. Backfill / Rebuild
D. Global data consistency
E. Customer + Partner regression
```

VERDICT A --- только по DB/API/browser/runtime evidence.

## 3. Repository-first

``` bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -150
git diff
git diff --check
```

Зафиксировать repository/branch/Starting HEAD/origin/worktree, reachable
`990e599` и `2ac80b6`. Не reset/revert legitimate work.

## 4. Source-first audit

До production changes проверить actual:

-   CrmActivity schema/migrations;
-   service/controller;
-   Customer/Partner Activity endpoints;
-   source adapters;
-   historical rebuild/backfill;
-   live projectors;
-   Operational Notes projection;
-   RBAC/guards;
-   subject authority;
-   cursor/filters;
-   CustomerActivity/PartnerActivity UI;
-   i18n/deep links;
-   maintenance execution path.

Production delta может быть 0, если все gates реально PASS. Не делать
speculative refactor.

## 5. Clean runtime

Зафиксировать processes/ports и выполнить clean application restart без:

``` text
DB reset
reseed
volume deletion
dataset replacement
```

После restart: backend/frontend available, DB preserved, hard browser
reload.

## 6. Customer final runtime

Использовать populated Customer. Если dataset не изменён, обязательный
regression subject:

``` text
CRM-00000089
0c534877-7dee-4d33-1078-68e39c8fe785
```

Проверить populated Activity, source/date filters, cursor/Load more,
links, RU/AZ/EN, A→B→A.

Критическая regression из `990e599`:

``` text
Customer Payments canonical set
↔ expected PAYMENT events
↔ CrmActivity
↔ API/UI
```

Предыдущий evidence был 4/4 Payments и 4/4 Activity; сначала сверить
current DB, не hardcode count.

## 7. Partner final runtime

Использовать populated Partner. Предыдущий representative:

``` text
Baku Tours Pro
previous Activity count: 1964
```

Сверить current count, затем проверить supported
ORDER/BOOKING/PAYMENT/REFUND/other sources, filters, cursor, links,
RU/AZ/EN, A→B→A.

## 8. Subject security

Customer:

``` text
A endpoint returns only A
B endpoint returns only B
A→B→A
wrong/nonexistent subject
route/query tampering
cross-customer leakage = 0
```

Partner:

``` text
A endpoint returns only A
B endpoint returns only B
A→B→A
wrong/nonexistent subject
route/query tampering
cross-partner leakage = 0
```

Customer ownership и Partner attribution --- разные axes. Для
representative commercial source доказать обе authority независимо.

## 9. RBAC matrix

Audit actual permissions. Не придумывать roles.

  Endpoint/action                   Authorized   Unauthorized   Anonymous   Result
  --------------------------------- ------------ -------------- ----------- --------
  Customer Activity                                                         
  Partner Activity                                                          
  Backfill/Rebuild                                                          
  Operational Notes relevant path                                           

Frontend-hidden не security proof.

## 10. Backfill/Rebuild authority

Определить:

``` text
how invoked
who can invoke
authentication
authorization
concurrency protection
batching/transaction behavior
failure reporting
```

Maintenance operation не должна быть anonymously/publicly destructive.
Не создавать новый maintenance API без необходимости.

## 11. Rebuild concurrency

Проверить:

``` text
Rebuild A starts
Rebuild B attempts concurrently
```

Expected existing contract: B denied/conflict (например 409, если это
actual contract), A remains consistent, no duplicate
execution/corruption.

## 12. Rebuild idempotency

На неизменённом dataset:

``` text
S0
rebuild #1 → S1
rebuild #2 → S2
```

Canonical semantics S1 == S2:

``` text
duplicates = 0
missing = 0
wrong subject = 0
```

## 13. Rebuild failure safety

Audit batching/transactions. Controlled failure --- только
безопасно/test environment. Проверить error surfaced, no false success,
subsequent rebuild recovers, final state canonical. Не повреждать
preserved runtime dataset.

## 14. Global source coverage

  ----------------------------------------------------------------------------------
  Source     Registered   Historical   Live       Customer    Partner     Errors
                                                  authority   authority   
  ---------- ------------ ------------ ---------- ----------- ----------- ----------
                                                                          

  ----------------------------------------------------------------------------------

Особенно ORDER/BOOKING/PAYMENT/REFUND и Operational Notes. Unsupported
Partner source не считать defect без canonical Partner authority.

## 15. Global Customer consistency

Для supported customer-owned events:

``` text
expected
actual
missing
wrong customer
orphan
duplicate
sourceId/code mismatch
```

Acceptance: все defect counters = 0.

## 16. Global Partner consistency

Для supported Partner events:

``` text
expected
actual
missing
wrong Partner
orphan
duplicate
sourceId/code mismatch
```

Acceptance: все defect counters = 0.

## 17. Payment regression

Исторический Round 2C.2R evidence:

``` text
816/816 Activities with customerId
null customerId: 0 (was 787)
```

Пересчитать current dataset. Не считать 816 вечной константой.

Report:

``` text
total relevant
customer-resolvable
correctly projected
null/unresolved
wrong customer
duplicates
```

## 18. Live projection

Без rebuild доказать минимум:

``` text
Operational Note → Activity
commercial event → Activity
```

Где применимо --- Customer и Partner subject.

Зафиксировать exact sourceId/eventType/occurredAt/Customer
authority/Partner authority.

## 19. Historical ↔ Live parity

  ----------------------------------------------------------------------------
  Source/Event   Historical   Live        Historical   Live        Result
                 Customer     Customer    Partner      Partner     
  -------------- ------------ ----------- ------------ ----------- -----------
                                                                   

  ----------------------------------------------------------------------------

Одинаковый event type не должен иметь разные subject semantics.

## 20. Cursor/filter security

Customer + Partner:

``` text
P1/P2/P3
overlap = 0
stable ordering
same subject
same filters
cursor from A cannot leak B
```

Server-side sourceType/dateFrom/dateTo/combined filters. Invalid inputs
--- actual validation contract.

## 21. Deep links + I18N

Deep links: correct entity/ID/code/route, no fake links, no
wrong-subject destination.

RU/AZ/EN Customer + Partner:

``` text
mixed locale = 0
raw source enum = 0
raw event enum = 0
raw i18n key = 0
duplicate persisted system label = 0
```

History tab не возвращать.

## 22. Operational Notes regression

Проверить Customer Notes, Partner Notes, RBAC/audit behavior,
Notes→Activity live projection, correct subject. Не регрессировать
existing Notes closure.

## 23. Query/performance sanity

Не нужен новый benchmark без evidence, но исключить:

``` text
obvious N+1
unbounded accidental fetch
first-N ownership truncation
per-row cross-schema lookup
```

Report query/batch strategy.

## 24. Backend baseline failures --- обязательный разбор

Последний Round 2D:

``` text
Frontend: 243/243 PASS
Backend: 83/85
2 failures заявлены pre-existing
```

Round 2E обязан назвать оба:

``` text
suite
test
error
baseline evidence
relation to Step 3.5.3
classification
```

Классификация:

``` text
A caused/affected by Step 3.5.3
B unrelated repository regression
C obsolete/broken test
D environment-only
```

Если A → исправить до VERDICT A.

Для B/C/D --- доказать и явно оставить baseline; не называть backend
full suite PASS.

Новых failures = 0.

## 25. Required tests/builds

Запустить actual repository commands:

``` text
Backend TSC
Backend build
Backend full/relevant tests
CRM Activity unit/E2E
Customer Activity tests
Partner Activity tests
Security/RBAC tests
Backfill/Rebuild tests
Operational Notes tests
Frontend TSC
Frontend build
Frontend full tests
```

Report exact counts.

## 26. Evidence matrices

### Runtime

  Check                Customer   Partner   Result
  -------------------- ---------- --------- --------
  Populated Activity                        
  Correct subject                           
  Source filter                             
  Date filter                               
  Combined filter                           
  Cursor/Load more                          
  Deep links                                
  A→B→A                                     
  Live event                                
  RU/AZ/EN                                  

### Security

  Gate                       Customer   Partner   Result
  -------------------------- ---------- --------- --------
  Authorized                                      
  Unauthorized                                    
  Anonymous                                       
  Wrong subject                                   
  Cross-subject leakage                           
  Route/query tampering                           
  Cursor subject isolation                        

### Rebuild

  Gate                     Evidence   Result
  ------------------------ ---------- --------
  Invocation authority                
  Unauthorized denial                 
  Concurrency protection              
  Idempotency                         
  Batching                            
  Errors surfaced                     
  Recovery                            
  Final missing                       
  Final wrong subject                 
  Final orphan                        
  Final duplicate                     

## 27. Change boundary

Разрешено только:

``` text
Step 3.5.3 runtime/security/rebuild defects
focused tests
report
roadmap
```

Не начинать Partner Workspace CRM, Marketplace Basic CRM, Storefront Pro
CRM, новые commercial flows, unrelated redesign/schema/auth refactor.

## 28. Roadmap finalization

После VERDICT A additively зафиксировать:

``` text
Round 2C.2R CLOSED (990e599)
Round 2D    CLOSED (2ac80b6)
Round 2E    CLOSED (<FINAL_SHA>)

STEP 3.5.3 — CRM COMMUNICATIONS + ACTIVITY TIMELINE
FULLY CLOSED
```

Не объявлять весь Step 3.5 / Platform CRM закрытым, если roadmap
содержит дальнейшие незавершённые substeps.

## 29. Exact NEXT

После Round 2E прочитать actual:

``` text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

и вывести **точный canonical NEXT** после Step 3.5.3.

Не придумывать следующий этап и не начинать его.

## 30. Report

Создать:

``` text
docs/prompts/PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2E_RUNTIME_SECURITY_BACKFILL_REBUILD_CLOSURE_REPORT.md
```

Строго на русском.

## 31. Git discipline

Перед staging:

``` bash
git diff --check
git status --short
git diff
```

Stage exact files only. Запрещено `git add .` / `git add -A`.

После commit/push:

``` bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

No force push.

## 32. Acceptance Criteria

VERDICT A только если:

1.  Canonical Round 2E scope preserved.
2.  Repository evidence captured.
3.  `990e599` + `2ac80b6` reachable.
4.  Clean runtime qualification complete, DB preserved.
5.  Customer populated runtime PASS.
6.  Partner populated runtime PASS.
7.  Customer/Partner subject authority PASS.
8.  Cross-customer leakage = 0.
9.  Cross-partner leakage = 0.
10. Customer↔Partner authority axes remain distinct.
11. RBAC authorized/unauthorized/anonymous gates PASS.
12. Rebuild authority audited and secured.
13. Rebuild concurrency PASS.
14. Rebuild idempotency PASS.
15. Failure/recovery behavior proven.
16. Global source matrix complete.
17. Customer missing/wrong/orphan/duplicate/source mismatch = 0.
18. Partner missing/wrong/orphan/duplicate/source mismatch = 0.
19. Payment remediation not regressed.
20. Current Payment audit recalculated.
21. Live projection works without rebuild.
22. Historical/live parity PASS.
23. Customer/Partner cursor PASS; overlap = 0.
24. Cursor subject isolation PASS.
25. Server-side filters PASS.
26. Deep links correct.
27. RU/AZ/EN PASS; mixed/raw = 0.
28. History remains removed.
29. Operational Notes regression PASS.
30. No obvious N+1/first-N regression.
31. Backend TSC/build PASS.
32. Relevant backend/Activity/security/rebuild tests PASS.
33. Frontend TSC/build/full tests PASS.
34. Two backend baseline failures individually identified/classified.
35. No new backend failures.
36. No unresolved Step 3.5.3 P0/P1.
37. Runtime/Security/Rebuild matrices complete.
38. Russian report created.
39. Roadmap synchronized additively.
40. Step 3.5.3 marked FULLY CLOSED only after all gates.
41. Exact canonical NEXT read from roadmap.
42. `git diff --check` clean.
43. Exact staging, commit, push complete.
44. HEAD == origin/master.
45. NEXT not started.

## 33. Required Final Response

``` text
VERDICT:

РЕПОЗИТОРИЙ
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
Worktree:

ROUND 2E SCOPE
Canonical title:
Production code changed:
Why:

RUNTIME TOPOLOGY
Backend:
Frontend:
Database:
Dataset preserved:
Clean restart:
Hard reload:

CUSTOMER FINAL RUNTIME
Representative:
Activity:
Filters:
Cursor:
Deep links:
A→B→A:
Payments regression:
PAYMENT Activity regression:

PARTNER FINAL RUNTIME
Representative:
Activity:
Sources:
Filters:
Cursor:
Deep links:
A→B→A:

SUBJECT SECURITY
Customer:
Partner:
Customer↔Partner axis:
Cross-customer:
Cross-partner:

RBAC
Customer authorized:
Customer unauthorized:
Partner authorized:
Partner unauthorized:
Anonymous:

BACKFILL / REBUILD
Invocation:
Authorization:
Concurrency:
Idempotency:
Batching:
Failure:
Recovery:
Errors:

GLOBAL SOURCE COVERAGE
...

GLOBAL CUSTOMER CONSISTENCY
Expected:
Actual:
Missing:
Wrong:
Orphans:
Duplicates:
Source mismatch:

GLOBAL PARTNER CONSISTENCY
Expected:
Actual:
Missing:
Wrong:
Orphans:
Duplicates:
Source mismatch:

PAYMENT REGRESSION
Total:
Resolvable:
Correct:
Null/unresolved:
Wrong:
Duplicates:

LIVE PROJECTION
Notes:
Commercial:
Manual rebuild required:

HISTORICAL/LIVE PARITY
...

CURSOR / FILTER SECURITY
...

I18N
RU:
AZ:
EN:
Mixed:
Raw enums:
Raw keys:

OPERATIONAL NOTES
...

BACKEND BASELINE FAILURES
Failure 1:
Classification:
Evidence:
Failure 2:
Classification:
Evidence:
New failures:

TESTS / BUILDS
Backend TSC:
Backend build:
Backend full:
Activity:
E2E:
Security:
Rebuild:
Operational Notes:
Frontend TSC:
Frontend build:
Frontend full:

RUNTIME MATRIX
...
SECURITY MATRIX
...
REBUILD MATRIX
...

FILES CHANGED
...
Schema:
Migration:
Production code:

ROADMAP
Round 2E:
Step 3.5.3:
Platform CRM:
Exact canonical NEXT:

REPORT:
COMMIT:

ОСТАВШИЕСЯ FINDINGS
P0:
P1:
P2:

NEXT:
```

## 34. Verdict Rule

Success only:

``` text
VERDICT A — PHASE 3 STEP 3.5.3 /
CRM COMMUNICATIONS + ACTIVITY TIMELINE /
ROUND 2E — RUNTIME + SECURITY + BACKFILL/REBUILD CLOSURE /
END-TO-END RUNTIME + SUBJECT SECURITY + RBAC +
REBUILD SAFETY + DATA CONSISTENCY /
FULLY CLOSED
```

После этого:

``` text
STEP 3.5.3 — CRM COMMUNICATIONS + ACTIVITY TIMELINE
FULLY CLOSED
```

Если есть runtime mismatch, leakage, RBAC defect, unsafe rebuild,
missing/wrong/orphan/duplicate Activity, regression `990e599`/`2ac80b6`,
unresolved Step 3.5.3 P0/P1 или недостаточное evidence:

``` text
VERDICT B — PHASE 3 STEP 3.5.3 /
ROUND 2E — RUNTIME + SECURITY + BACKFILL/REBUILD CLOSURE /
INCOMPLETE
```

No conditional VERDICT A.

## 35. STOP

После runtime + security + rebuild qualification, global consistency,
regressions, tests/builds, browser evidence, report, roadmap,
commit/push:

**STOP.**

Не начинать следующий canonical stage без отдельного задания.
