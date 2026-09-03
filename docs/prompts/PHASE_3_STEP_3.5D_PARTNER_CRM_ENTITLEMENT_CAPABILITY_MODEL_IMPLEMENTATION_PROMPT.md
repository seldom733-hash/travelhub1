# PHASE 3 --- STEP 3.5D --- PARTNER CRM ENTITLEMENT & CAPABILITY MODEL

## PLATFORM CRM vs PARTNER WORKSPACE + MARKETPLACE BASIC vs STOREFRONT PRO

### CAPABILITY AUTHORITY / SERVER-SIDE ENFORCEMENT / UI VISIBILITY / RUNTIME SECURITY CLOSURE

**Все ответы разработчика, implementation notes, evidence, отчёты и
roadmap updates --- строго на русском.**

------------------------------------------------------------------------

## 1. CURRENT BASELINE

``` text
PHASE 3 — STEP 3.5.3 — FULLY CLOSED
PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION — FULLY CLOSED
PHASE 3 — STEP 3.5B — CUSTOMER IDENTITY ↔ PARTNER CRM RELATIONSHIP — FULLY CLOSED
PHASE 3 — STEP 3.5C — PARTNER CRM LEAD & DIRECT CUSTOMER INTAKE — FULLY CLOSED

Step 3.5C Final HEAD: 43e0e69
origin/master: 43e0e69
Backend: 1247/1247 PASS
Frontend: 243/243 PASS
Skipped: 0
Schema: 0
Migration: 0
```

Canonical NEXT:

``` text
PHASE 3 — STEP 3.5D — PARTNER CRM ENTITLEMENT & CAPABILITY MODEL
```

## 2. PRIMARY GOAL

Создать/квалифицировать единую canonical authority:

``` text
Identity
→ Workspace Context (PLATFORM | PARTNER)
→ Partner/Tenant Scope
→ Entitlement Tier
→ Business Capability
→ Role/Permission
→ Server-side authorization
→ Frontend navigation/page/action visibility
```

Критические границы:

``` text
PLATFORM CRM ≠ PARTNER WORKSPACE
Marketplace Basic ≠ Storefront Pro
Entitlement ≠ Permission
PARTNER role ≠ Storefront Pro entitlement
Frontend hidden ≠ Security
```

## 3. REPO-FIRST --- MANDATORY

До изменений прочитать actual repository и canonical roadmap. Найти:

-   Partner / PartnerStorefront;
-   subscription / plan / entitlement models;
-   capability/feature definitions;
-   workspace context resolution;
-   tenant/partner scope;
-   Platform roles / PARTNER role / permissions;
-   backend guards/decorators;
-   frontend sidebar/navigation/route gates;
-   CRM, Orders, Bookings, Messages, Finance, Analytics;
-   Employees/Roles, Marketing, Storefront settings --- если уже
    существуют;
-   migrations, seeds, tests, architecture docs/ADRs.

Не создавать второй entitlement framework, пока не доказано, что
существующий недостаточен.

## 4. REPOSITORY BASELINE

Выполнить:

``` bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -150
git diff
git diff --check
```

Зафиксировать:

``` text
Starting HEAD
origin/master
HEAD == origin/master
43e0e69 reachable
bd6aee3 reachable
737de35 reachable
27b2653 reachable
e4b38a3 reachable
worktree
```

Unexpected local changes → STOP.

## 5. ROADMAP AUTHORITY

Прочитать exact Step 3.5D и привести в отчёте:

``` text
exact scope
dependencies
acceptance criteria
explicit exclusions
exact NEXT
```

Roadmap имеет приоритет над предположениями prompt.

## 6. BUSINESS CONTEXT AUTHORITY

``` text
PLATFORM
= TravelHub operator/admin context

PARTNER
= Partner business workspace
```

Platform CRM не зависит от подписки Partner.

Storefront Pro Partner user не получает Platform CRM authority.

## 7. PARTNER TIERS

Canonical tiers:

``` text
Marketplace Basic
Storefront Pro
```

Ранее установленная архитектурная модель должна быть сверена с actual
repository:

``` text
active PartnerStorefront + active entitlement
→ Storefront Pro

otherwise
→ Marketplace Basic
```

Не hardcode до repo verification.

## 8. MARKETPLACE BASIC BOUNDARY

Marketplace Basic может иметь необходимый operational customer context и
canonical baseline:

``` text
Orders
Bookings
Messages
Basic Finance
Basic Analytics
minimal operational customer context
```

Не выдавать автоматически:

``` text
Full CRM
advanced segmentation
marketing automation
Employees
Roles & Permissions administration
Advanced Finance
Full Analytics
Omnichannel
```

если roadmap не говорит обратное.

## 9. STOREFRONT PRO BOUNDARY

Storefront Pro --- expanded Partner business-management layer:

``` text
expanded Command Center
Full Analytics
Full CRM
Employees
Roles & Permissions
Marketing
Advanced Finance
Storefront/Company Settings
future Omnichannel
```

Step 3.5D определяет authority, а не реализует все будущие modules.

Обязательно различать:

``` text
NOT_ENTITLED
ENTITLED_NOT_IMPLEMENTED
ENTITLED_AVAILABLE
```

или canonical equivalent.

## 10. ENTITLEMENT INVENTORY

Составить:

  Concept             Actual entity/service   Authority   Current use   Gap
  ------------------- ----------------------- ----------- ------------- -----
  Partner plan                                                          
  PartnerStorefront                                                     
  Subscription                                                          
  Entitlement                                                           
  Capability                                                            
  Permission                                                            
  Workspace context                                                     
  Partner scope                                                         

## 11. CAPABILITY INVENTORY

Audit actual Partner Workspace:

``` text
Command Center
Orders
Bookings
Customers / CRM
Messages
Finance
Analytics
Employees
Roles & Permissions
Marketing
Storefront
Settings
```

Для каждого:

``` text
implemented?
route?
API?
permission?
entitlement gate?
Basic?
Pro?
future only?
```

## 12. CANONICAL CAPABILITY MATRIX

Обязательно:

  -----------------------------------------------------------------------------------------
  Capability      Platform   Marketplace   Storefront   Implemented Permission       Server
                                   Basic          Pro          now?                    gate
  ------------- ---------- ------------- ------------ ------------- ------------ ----------
  Platform CRM                                                                   

  Orders                                                                         

  Bookings                                                                       

  Customer                                                                       
  context                                                                        

  Full CRM                                                                       

  Messages                                                                       

  Basic Finance                                                                  

  Advanced                                                                       
  Finance                                                                        

  Basic                                                                          
  Analytics                                                                      

  Full                                                                           
  Analytics                                                                      

  Employees                                                                      

  Roles &                                                                        
  Permissions                                                                    

  Marketing                                                                      

  Storefront                                                                     
  Settings                                                                       

  Omnichannel                                                                    
  -----------------------------------------------------------------------------------------

Заполнять только по actual code + roadmap.

## 13. SINGLE SOURCE OF TRUTH

Forbidden:

``` text
sidebar → own plan logic
page → another plan logic
API → another plan logic
service → subscription name string
```

Target:

``` text
canonical entitlement/capability resolver
→ backend authorization
→ safe session/workspace exposure
→ navigation/page/action gates
```

Не использовать presentation string вроде
`plan.name === "Storefront Pro"` как security authority, если это не
canonical enum.

## 14. SAFE TIER RESOLUTION

Проверить applicable states:

``` text
no storefront
inactive storefront
active storefront
no subscription
inactive subscription
expired subscription
active entitlement
cancelled entitlement
```

Safe default:

``` text
cannot prove Pro
→ deny Pro-only capability
```

При этом canonical Basic access не должен ломаться.

## 15. ENTITLEMENT × PERMISSION

Mandatory matrix:

``` text
Basic + Basic capability + permission → ALLOW
Basic + Pro permission → DENY by entitlement
Pro + Pro capability + permission → ALLOW
Pro + Pro capability + no permission → DENY
```

Entitlement определяет product capability. Permission определяет user
action within capability.

## 16. SERVER-SIDE AUTHORITY

Все sensitive capabilities должны проверяться server-side.

Mandatory:

``` text
Basic direct API → Pro-only endpoint = DENY
Pro + permission = ALLOW
Pro without permission = DENY
Partner user → Platform CRM = DENY
Platform authorized user → Platform CRM = ALLOW
```

Frontend visibility --- только UX.

## 17. PAGE / ACTION / DATA LEVEL

Проверить отдельно:

``` text
page-level entitlement
action-level entitlement/permission
data-level projection
```

Basic не должен получать Pro-only data в API с последующим frontend
hiding.

Если Basic и Pro делят страницу, не блокировать весь page, когда
ограничена только отдельная action/capability.

## 18. NAVIGATION

Sidebar/menu должен выводиться из canonical capability authority:

``` text
Basic → entitled + implemented Basic capabilities
Pro → Basic + entitled + implemented Pro capabilities
```

Не показывать dead menu items для будущих не реализованных modules.

Direct URL должен быть защищён независимо от menu.

## 19. PLATFORM CRM REGRESSION

Tier Partner не должен влиять на:

``` text
Platform CRM Customers
Platform CRM Partners
Customer 360
Partner 360
Partner CRM intake
Activity
Operational Notes
```

## 20. PARTNER CRM / INTAKE REGRESSION

Preserve Step 3.5C behavior:

``` text
POST /partners/:partnerId/intake
POST /partner/customers/intake
```

according to actual context/permissions.

Не расширять Platform intake authority на Partner users.

## 21. ANALYTICS / FINANCE / EMPLOYEES

Preserve architectural distinctions:

``` text
Basic Analytics ≠ Full Analytics
Basic Finance ≠ Advanced Finance
```

One Analytics Engine principle remains where applicable; different tiers
may have different read depth.

Employees/Roles may be Storefront Pro capability, but Step 3.5D не
реализует Workforce.

## 22. PERFORMANCE MANAGEMENT PRESERVATION

Canonical roadmap содержит:

``` text
Step 3.50 — Workforce / Employee Performance Management
```

Сохранить без изменений.

Не реализовывать performance scoring.

Не смешивать:

``` text
Assignment
Action
Outcome
```

## 23. SUPPLIER / PROCUREMENT PRESERVATION

Не реализовывать в Step 3.5D:

``` text
Supplier
Purchase
PurchaseItem
SupplierPayment
CostAllocation
COGS
Payables
```

Но capability framework должен позволять позднее добавить procurement
как Storefront Pro capability без redesign entitlement system.

## 24. SESSION / WORKSPACE / CACHE

Audit как frontend получает:

``` text
workspace
partner
permissions
entitlements/capabilities
```

Не плодить per-component entitlement requests, если canonical
session/workspace payload может содержать resolved capabilities.

Если capability resolution кешируется --- документировать
invalidation/staleness. Entitlement loss не должен оставлять бессрочный
Pro access.

## 25. MULTI-PARTNER ISOLATION

Если user/workspace switching поддерживается:

``` text
Partner A = Pro
Partner B = Basic
```

A capabilities не должны утекать B.

Mandatory A→B→A runtime test where applicable.

## 26. UPGRADE / DOWNGRADE

Если upgrade UX уже существует --- reuse.

Если нет --- не строить billing flow в Step 3.5D.

Downgrade principle:

``` text
access changes
≠ business data deletion
```

Не удалять CRM/employee/etc data при потере entitlement.

## 27. API CONTRACT

Если frontend получает capabilities, использовать stable identifiers.

Conceptual only:

``` text
workspace: PARTNER
tier: MARKETPLACE_BASIC | STOREFRONT_PRO
capabilities: [...]
permissions: [...]
```

Use actual repository naming.

Unknown capability → DENY.

## 28. SCHEMA POLICY

Начальная гипотеза --- existing entitlement/subscription models
достаточны.

Не начинать с migration.

Если недостаточны --- STOP до migration и представить:

``` text
current schema
missing invariant
minimal additive proposal
backfill
compatibility
downgrade semantics
```

No destructive migration.

## 29. SECURITY FORBIDDEN PATTERNS

Forbidden:

``` text
hardcoded partner IDs
localStorage plan as authority
query-param tier
frontend-only role gate
hidden menu as security
global PARTNER permission broadening
```

## 30. I18N / DISPLAY REGRESSION

Any new UI strings:

``` text
RU
AZ
EN
raw keys = 0
raw enums = 0
mixed locale = 0
```

Preserve:

``` text
visible label = human-readable business value
href/internal identity = UUID/ID
```

Resolvable UUID visible labels = 0.

## 31. BACKEND TEST MATRIX

Minimum applicable:

``` text
Platform authorized → Platform CRM ALLOW
Partner user → Platform CRM DENY

Basic + Basic capability → ALLOW
Basic + Pro capability → DENY
Basic + accidental Pro permission → DENY

Pro + permission → ALLOW
Pro + no permission → DENY

inactive/invalid entitlement → Pro DENY
unknown capability → DENY

Partner A Pro / Partner B Basic isolation
A→B→A isolation

direct API Basic→Pro endpoint → DENY
downgrade/access loss does not delete data
```

## 32. FRONTEND TEST MATRIX

``` text
Basic sidebar
Pro sidebar
Basic direct URL → Pro page
Pro direct URL
Pro user without permission
access-required/upgrade state if implemented
workspace switch isolation
RU/AZ/EN
```

No snapshot-only evidence.

## 33. REPRESENTATIVE RUNTIME ACTORS

Use at least:

``` text
Platform authorized user
Marketplace Basic Partner user
Storefront Pro Partner user
```

Where possible:

``` text
Storefront Pro user with permission
Storefront Pro user without permission
```

## 34. RUNTIME ACTOR MATRIX

  -------------------------------------------------------------------------------------
  Actor      Workspace   Tier       Capability   Permission       Expected   Actual
  ---------- ----------- ---------- ------------ ---------------- ---------- ----------
  Platform   PLATFORM    N/A        Platform CRM allow            ALLOW      
  user                                                                       

  Basic      PARTNER     Basic      Basic        allow            ALLOW      
  Partner                           capability                               

  Basic      PARTNER     Basic      Pro          assigned/allow   DENY       
  Partner                           capability                               

  Pro        PARTNER     Pro        Pro          allow            ALLOW      
  Partner                           capability                               

  Pro        PARTNER     Pro        Pro          deny             DENY       
  Partner                           capability                               
  -------------------------------------------------------------------------------------

Use actual capability identifiers.

## 35. API SECURITY MATRIX

  ---------------------------------------------------------------------------------
  Endpoint       Basic          Pro+permission   Pro-no-permission   Platform if
                                                                     applicable
  -------------- -------------- ---------------- ------------------- --------------
                 DENY/ALLOW by                                       
                 canonical                                           
                 matrix                                              

  ---------------------------------------------------------------------------------

Every Pro-sensitive endpoint affected by Step 3.5D must be covered.

## 36. NAVIGATION MATRIX

  Navigation item     Platform   Basic   Pro   Implemented? Result
  ----------------- ---------- ------- ----- -------------- --------
                                                            

Only actual items.

## 37. CLEAN RUNTIME / BROWSER

Mandatory:

``` text
backend build
frontend build
stop stale processes
restart current checkout
hard reload
```

Browser validate:

``` text
Platform workspace
Marketplace Basic workspace
Storefront Pro workspace
sidebar/menu
direct URL
allowed page
denied page
allowed/denied action where applicable
workspace isolation
RU/AZ/EN
```

Browser/runtime evidence outranks source-only claims.

## 38. FULL REGRESSION

Run canonical commands:

``` text
Backend TSC
Backend build
Backend full tests
Frontend TSC
Frontend build
Frontend full tests
```

Previous baseline:

``` text
Backend 1247/1247 PASS
Frontend 243/243 PASS
Skipped 0
```

Required:

``` text
0 FAIL
0 new skipped
```

## 39. PREVIOUS CRM REGRESSION

Smoke:

``` text
Step 3.5.3
Step 3.5A
Step 3.5B
Step 3.5C
Customer 360
Partner 360
Partner 360 Customers
Customer 360 Partners
Partner CRM intake
Customer Activity
Partner Activity
Customer Notes
Partner Notes
Customer Payment ownership
Partner attribution
status filters
crm.col.partner
UUID leakage = 0
History remains removed
```

## 40. REQUIRED REPORT

Create:

``` text
docs/prompts/PHASE_3_STEP_3.5D_PARTNER_CRM_ENTITLEMENT_CAPABILITY_MODEL_IMPLEMENTATION_REPORT.md
```

Report strictly in Russian and include:

``` text
repository baseline
roadmap scope
entitlement inventory
capability inventory
tier resolution
canonical capability matrix
entitlement vs permission
authority flow
server enforcement
frontend enforcement
navigation matrix
API security matrix
runtime actor matrix
Platform vs Partner isolation
Basic vs Pro isolation
upgrade/downgrade semantics
cache/staleness
i18n
tests
regressions
schema/migration decision
files changed
roadmap update
git evidence
verdict
exact NEXT
```

## 41. ROADMAP UPDATE

After all gates pass:

``` text
Step 3.5D — COMPLETE
```

Update additively.

Preserve:

``` text
Step 3.5.3 closure
Step 3.5A closure
Step 3.5B closure
Step 3.5C closure
Step 3.50 Workforce / Employee Performance Management
e4b38a3 history
```

No silent renumbering.

Reread roadmap and output exact NEXT. Do not start it.

## 42. GIT DISCIPLINE

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
worktree clean
```

## 43. VERDICT A GATES

VERDICT A only if all applicable gates pass:

1.  baseline captured and `43e0e69`, `bd6aee3`, `737de35`, `27b2653`,
    `e4b38a3` preserved/reachable;
2.  exact Step 3.5D roadmap scope read;
3.  entitlement inventory complete;
4.  capability inventory complete;
5.  Platform vs Partner boundary preserved;
6.  Basic vs Pro boundary documented;
7.  canonical tier/capability resolver identified or implemented;
8.  entitlement ≠ permission preserved;
9.  PARTNER role ≠ Pro preserved;
10. Platform role ≠ Partner tier preserved;
11. one source of truth for capability authority;
12. no presentation-string authorization;
13. invalid/unknown entitlement safely handled;
14. unknown capability denied;
15. Basic operational capabilities preserved;
16. Basic Pro-only access denied even with accidental permission;
17. Pro + permission allowed;
18. Pro without permission denied;
19. Platform CRM independent of Partner subscription;
20. Partner user → Platform CRM denied;
21. server-side enforcement PASS;
22. direct API Basic→Pro denial PASS;
23. direct URL Basic→Pro denial PASS;
24. action/data-level gates PASS where applicable;
25. navigation uses canonical authority;
26. no dead future menu items;
27. entitled-not-implemented distinction preserved;
28. Partner A Pro / Partner B Basic isolation PASS;
29. downgrade does not delete data;
30. cache/staleness documented;
31. no client-only security;
32. no hardcoded Partner IDs;
33. Marketplace Basic customer context preserved;
34. Full CRM boundary documented;
35. Basic/Advanced Finance boundary documented;
36. Basic/Full Analytics boundary documented;
37. Employees/Roles boundary documented where applicable;
38. Step 3.50 preserved;
39. Supplier/Procurement not implemented;
40. future procurement capability remains extensible;
41. Steps 3.5.3/A/B/C regressions PASS;
42. Payment ownership preserved;
43. Partner attribution preserved;
44. Activity/Notes regressions PASS;
45. History remains removed;
46. UUID visible-label leakage = 0;
47. RU/AZ/EN PASS;
48. raw keys/enums/mixed locale = 0;
49. schema/migration decision justified;
50. no destructive DB operation;
51. backend targeted/full/TSC/build PASS;
52. frontend targeted/full/TSC/build PASS;
53. new skipped = 0;
54. clean runtime from current checkout;
55. stale processes excluded;
56. Platform/Basic/Pro runtime actors PASS;
57. browser validation PASS;
58. capability/API/navigation/runtime matrices complete;
59. production scope limited to Step 3.5D;
60. future stages not auto-started;
61. report created;
62. roadmap updated additively;
63. exact staging;
64. HEAD == origin/master;
65. worktree clean;
66. P0 = 0;
67. P1 = 0;
68. no unresolved in-scope P2.

## 44. VERDICT RULE

Success only:

``` text
VERDICT A — PHASE 3 — STEP 3.5D /
PARTNER CRM ENTITLEMENT & CAPABILITY MODEL /
PLATFORM vs PARTNER + MARKETPLACE BASIC vs STOREFRONT PRO /
FULLY CLOSED
```

Otherwise:

``` text
VERDICT B — PHASE 3 — STEP 3.5D /
PARTNER CRM ENTITLEMENT & CAPABILITY MODEL /
INCOMPLETE
```

No conditional VERDICT A.

## 45. REQUIRED FINAL RESPONSE FORMAT

``` text
VERDICT:

REPOSITORY
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
43e0e69 preserved:
bd6aee3 preserved:
737de35 preserved:
27b2653 preserved:
e4b38a3 preserved:
Worktree:

ROADMAP
Canonical Step 3.5D scope:
Dependencies:
Deferred:
Exact NEXT:

ENTITLEMENT INVENTORY
Partner plan:
PartnerStorefront:
Subscription:
Entitlement:
Capability:
Permission:
Workspace:
Partner scope:

TIER RESOLUTION
Marketplace Basic:
Storefront Pro:
Inactive/invalid:
Safe fallback:

CAPABILITY AUTHORITY
Resolver:
Source of truth:
Frontend exposure:
Cache/staleness:

CAPABILITY MATRIX
[complete matrix]

AUTHORITY FLOW
[actual flow]

ENTITLEMENT vs PERMISSION
Basic + Basic permission:
Basic + Pro permission:
Pro + Pro permission:
Pro + missing permission:

PLATFORM vs PARTNER
Platform authorized:
Partner user → Platform CRM:
Platform CRM subscription independence:

API SECURITY MATRIX
[complete matrix]

NAVIGATION MATRIX
[complete matrix]

RUNTIME ACTOR MATRIX
[complete matrix]

BROWSER
Platform:
Marketplace Basic:
Storefront Pro:
Direct URL denial:
Action denial:
Workspace isolation:

PARTNER CRM REGRESSION
Step 3.5.3:
Step 3.5A:
Step 3.5B:
Step 3.5C:
Intake:
Activity:
Notes:
Payment ownership:
Partner attribution:
History:
UUID leakage:

LOCALIZATION
RU:
AZ:
EN:
Raw keys:
Raw enums:
Mixed locale:

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
Reason:

STEP 3.50 PRESERVED:
SUPPLIER / PROCUREMENT:
FUTURE CAPABILITY EXTENSIBILITY:

FILES CHANGED:

P0:
P1:
P2:

REPORT:
ROADMAP UPDATE:
COMMIT:
PUSH:
HEAD == origin/master:
Worktree:

NEXT:
```

## 46. STOP

После успешного закрытия:

``` text
PHASE 3 — STEP 3.5D —
PARTNER CRM ENTITLEMENT & CAPABILITY MODEL —
FULLY CLOSED
```

Перечитать canonical roadmap и вывести exact NEXT.

**STOP. Не начинать следующий этап без отдельного задания.**
