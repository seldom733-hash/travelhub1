# PHASE 3 --- STEP 3.5.3 --- PLATFORM CRM

## POST-CLOSURE ROUND 2E.2R --- CUSTOMER 360 + PARTNER 360 FILTER / I18N / RELATED-ENTITY DISPLAY INTEGRITY REMEDIATION

### STATUS FILTER CORRECTION + PARTNER 360 FILTER PARITY + RAW I18N KEY CLOSURE + UUID/TECHNICAL-ID LEAKAGE AUDIT

**Все ответы разработчика, evidence, отчёт и roadmap updates --- строго
на русском.**

------------------------------------------------------------------------

# 1. PURPOSE

Это **исправленная и заменяющая предыдущий Round 2E.2 версия**.

Предыдущий prompt Round 2E.2 считать superseded, потому что после его
подготовки пользователь уточнил фактическое runtime-состояние:

-   в `Partner 360 → Заказы` Status filter **уже есть**;
-   в `Partner 360 → Платежи` Status filter **уже есть**;
-   в `Partner 360 → Брони` Status filter отсутствует;
-   в `Partner 360 → Пользователи` Status filter отсутствует;
-   дополнительно обнаружен класс дефектов отображения связанных
    сущностей: вместо human-readable business labels могут показываться
    UUID/system IDs;
-   этот класс необходимо проверить системно в Customer 360 и Partner
    360, а не исправлять одну строку.

Не реализовывать требования superseded prompt буквально, если они
противоречат этому документу.

------------------------------------------------------------------------

# 2. BASELINE / REPOSITORY STATE

Известная история:

``` text
Step 3.5.3 previously fully closed after Round 2E.1
accepted closure SHA: 1a3aa23
Backend: 1236/1236 PASS
Frontend: 243/243 PASS
```

После этого был выполнен **architecture/roadmap-only** update:

``` text
Workforce / Employee Performance Management
Final HEAD: e4b38a3
HEAD == origin/master
Production code delta: 0
Schema: 0
Migration: 0
```

Поэтому remediation должен стартовать от **actual current HEAD**,
ожидаемо `e4b38a3` или более нового descendant.

Не откатывать Workforce roadmap update.

------------------------------------------------------------------------

# 3. STATUS OF STEP 3.5.3

Из-за новых runtime findings:

``` text
STEP 3.5.3 — POST-CLOSURE REOPENED
ROUND 2E.2R — CURRENT
STEP 3.5A — BLOCKED / NOT STARTED
```

Это targeted post-closure remediation, а не повторная реализация CRM
Activity architecture.

------------------------------------------------------------------------

# 4. USER-OBSERVED FINDINGS --- CURRENT SOURCE OF TRUTH

## Finding 1

``` text
CRM → Customer 360 → Заказы
```

Status filter существует, но его `Статус` / status UI не локализован
корректно.

## Finding 2

``` text
CRM → Customer 360 → Брони
```

Status filter существует, но его `Статус` / status UI не локализован
корректно.

## Finding 3

``` text
CRM → Customer 360 → Платежи
```

Status filter существует, но его `Статус` / status UI не локализован
корректно.

## Finding 4 --- CORRECTED

``` text
CRM → Partner 360 → Заказы
```

Status filter **УЖЕ ЕСТЬ**.

Не добавлять второй filter.

Требуется проверить:

``` text
localization
status options
canonical enum values
actual filtering
pagination interaction
subject authority
```

## Finding 5

``` text
CRM → Partner 360 → Брони
```

Status filter **ОТСУТСТВУЕТ**.

Нужно добавить filter parity по существующим CRM conventions.

## Finding 6 --- CORRECTED

``` text
CRM → Partner 360 → Платежи
```

Status filter **УЖЕ ЕСТЬ**.

Не добавлять второй filter.

Требуется проверить:

``` text
localization
status options
canonical enum values
actual filtering
pagination interaction
subject authority
```

## Finding 7

``` text
CRM → Partner 360 → Пользователи
```

Status filter **ОТСУТСТВУЕТ**.

Нужно определить canonical User status field/enum и добавить filter
только на реальном domain contract.

Не изобретать новый статус, если domain model его не имеет.

## Finding 8

``` text
CRM → Partner 360 → Заказы
```

Внутри строк таблицы связанные пользователи/партнёры могут отображаться
**системными UUID вместо human-readable names**.

Наблюдаемый пример:

``` text
aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
```

UUID может оставаться canonical route/internal identifier, но не должен
быть primary visible label, если связанная сущность разрешается.

## Finding 9

``` text
CRM → Customer 360 → Партнёры
```

Заголовок колонки партнёра отображается как raw i18n key:

``` text
crm.col.partner
```

вместо локализованного label.

## Finding 10 --- SYSTEMIC RELATED-ENTITY AUDIT

Пользователь отдельно потребовал проверить:

``` text
CRM → Customer 360 → Брони
CRM → Customer 360 → Платежи
```

на корректность отображения связанных:

``` text
пользователей / клиентов
партнёров
заказов
услуг / продуктов
```

где такие связи реально присутствуют в presentation/domain contract.

Эта проверка должна быть расширена на affected commercial tables
Customer 360 / Partner 360, чтобы закрыть класс UUID/system-ID leakage
системно.

------------------------------------------------------------------------

# 5. PRIMARY OBJECTIVES

Закрыть четыре класса дефектов:

``` text
A. Status filter i18n
B. Missing Partner 360 filter parity
C. raw i18n key leakage
D. related-entity display integrity / UUID leakage
```

Не расширять scope на unrelated CRM redesign.

------------------------------------------------------------------------

# 6. REPOSITORY-FIRST AUDIT

До production changes:

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
e4b38a3 reachable
1a3aa23 reachable
worktree
```

Если current HEAD выше `e4b38a3`, продолжить от него при условии, что
это canonical descendant.

------------------------------------------------------------------------

# 7. IMPLEMENTATION INVENTORY

Найти actual implementation для:

``` text
Customer 360
Partner 360
Orders tabs
Bookings tabs
Payments tabs
Customer Partners tab
Partner Users tab
shared filters
shared tables
status badges
entity/reference cells
deep-link components
CRM API client
backend CRM endpoints
DTO/query contracts
Prisma queries
i18n RU/AZ/EN
tests
```

Сначала установить reuse/divergence.

Не предполагать shared implementation без доказательства.

------------------------------------------------------------------------

# 8. STATUS FILTER --- I18N CONTRACT

Для каждого существующего Status filter проверить:

``` text
visible label
placeholder
"All statuses" option
individual status options
status badges
accessible label
query value
```

Принцип:

``` text
VISIBLE TEXT = localized human-readable value
API VALUE = canonical enum/value
```

Запрещено отправлять локализованные strings вместо enum.

------------------------------------------------------------------------

# 9. CUSTOMER 360 --- ORDERS STATUS

Required:

``` text
filter already exists
do not duplicate
RU/AZ/EN localized label
RU/AZ/EN localized options
canonical enum query
filter works
clear works
pagination/reset works
stale response protection works
```

------------------------------------------------------------------------

# 10. CUSTOMER 360 --- BOOKINGS STATUS

Required:

``` text
filter already exists
do not duplicate
RU/AZ/EN localized label
RU/AZ/EN localized options
canonical enum query
filter works
clear works
```

------------------------------------------------------------------------

# 11. CUSTOMER 360 --- PAYMENTS STATUS

Required:

``` text
filter already exists
do not duplicate
RU/AZ/EN localized label/options
canonical enum query
filter works
clear works
```

Preserve canonical Customer Payment ownership:

``` text
Payment.customerId
OR
Payment.orderId → Order.customerId
```

Нельзя вернуть first-N Orders truncation.

------------------------------------------------------------------------

# 12. PARTNER 360 --- ORDERS STATUS

**Filter exists.**

Не создавать новый.

Audit:

``` text
RU/AZ/EN
All statuses
status options
canonical enum
server-side/client-side actual contract
pagination
reset
subject isolation
```

Canonical Partner Order authority remains:

``` text
Order.sellerPartnerId
```

------------------------------------------------------------------------

# 13. PARTNER 360 --- BOOKINGS STATUS --- MISSING

Добавить Status filter.

Сначала определить actual Booking status enum and Partner attribution.

Не придумывать relation.

Если canonical path existing architecture использует:

``` text
Booking → Order → Order.sellerPartnerId
```

сохранить его.

Если actual repository authority отличается --- документировать evidence
и использовать canonical current model.

Для paginated dataset filtering должен происходить до page slicing.

------------------------------------------------------------------------

# 14. PARTNER 360 --- PAYMENTS STATUS

**Filter exists.**

Не создавать новый.

Audit:

``` text
localization
options
canonical enum
filter correctness
pagination
Partner attribution
subject isolation
```

Не смешивать:

``` text
Customer Payment ownership
```

и:

``` text
Partner Payment attribution
```

------------------------------------------------------------------------

# 15. PARTNER 360 --- USERS STATUS --- MISSING

Проверить actual domain model:

``` text
что означает "Пользователь" в этой вкладке
какая entity является source
есть ли canonical status
какой enum/field является authority
какой backend endpoint используется
есть ли pagination
```

Только после этого добавить Status filter.

Если canonical user status существует:

``` text
subject Partner
AND
User status
→ ordering
→ pagination
```

Если status semantic неоднозначен, STOP для этого finding и предоставить
evidence вместо создания выдуманного filter contract.

Но VERDICT A невозможен, пока user-observed requirement не reconciled.

------------------------------------------------------------------------

# 16. FILTER SERVER-SIDE MATRIX

Заполнить:

  -----------------------------------------------------------------------------------
  Surface    Endpoint   Subject     Status     Query      Server-side?   Pagination
                        authority   field      param                     after
                                                                         filter?
  ---------- ---------- ----------- ---------- ---------- -------------- ------------
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

  Partner                                                                
  Users                                                                  
  -----------------------------------------------------------------------------------

No blank cells.

Если конкретный surface intentionally client-side из-за bounded embedded
dataset, объяснить и доказать, что filtering не ломается на \>page-size
records.

------------------------------------------------------------------------

# 17. FILTER ORDER OF OPERATIONS

Для paginated server data:

``` text
subject authority
→ status predicate
→ deterministic ordering
→ pagination
```

Запрещено:

``` text
take:20
→ status filter
```

или:

``` text
page 1
→ browser filter
```

для unbounded dataset.

------------------------------------------------------------------------

# 18. INVALID STATUS

Для новых/изменённых backend status contracts проверить:

``` text
?status=INVALID_VALUE
```

Expected:

``` text
4xx according to project validation convention
not 500
not silently ALL
not authority bypass
```

------------------------------------------------------------------------

# 19. RELATED-ENTITY DISPLAY INTEGRITY --- CORE RULE

В CRM 360 primary visible value связанной сущности должен быть
human-readable business/display value.

Correct model:

``` text
visible label → canonical display/business value
link target → canonical ID/UUID
internal identity → UUID/ID
```

Не путать identity и presentation.

------------------------------------------------------------------------

# 20. UUID / TECHNICAL-ID LEAKAGE RULE

При наличии resolvable entity запрещено показывать как primary label:

``` text
UUID
database ID
foreign-key ID
raw technical key
raw enum
```

Пример incorrect:

``` text
aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
```

Expected:

``` text
Baku Tours Pro
```

при этом link может оставаться:

``` text
/app/crm/partners/aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
```

------------------------------------------------------------------------

# 21. CANONICAL DISPLAY VALUE RESOLUTION

Для каждого relation type определить canonical display value.

Примерный принцип, но repository/schema is authority:

``` text
Customer/User → display name / full name / canonical user label
Partner → company/partner display name
Order → business order code, e.g. ORD-...
Booking → business booking code, e.g. BKG-...
Payment → business payment code, e.g. PAY-...
Service/Product → canonical service/product/listing title
```

Не hardcode эти правила, если actual domain has a different canonical
business code/name.

Зафиксировать actual source field.

------------------------------------------------------------------------

# 22. NO FAKE FALLBACK

Не исправлять UUID leakage через:

``` text
hide UUID
substring UUID
"Unknown"
"-"
"Partner"
"User"
```

если entity реально разрешяется.

Если relation cannot be resolved, distinguish:

``` text
legitimate missing relation
deleted entity
unauthorized relation
data integrity defect
API projection defect
frontend mapping defect
```

Fallback допустим только как controlled UX for truly unavailable data и
должен быть локализован.

------------------------------------------------------------------------

# 23. CUSTOMER 360 --- RELATED ENTITY AUDIT SCOPE

Обязательно проверить:

``` text
Customer 360 → Orders
Customer 360 → Bookings
Customer 360 → Payments
Customer 360 → Partners
```

Для каждой реально отображаемой relation:

``` text
Customer/User
Partner
Order
Booking
Payment
Service/Product
```

где applicable.

Не добавлять новые columns только ради audit.

Проверять existing visible relation cells.

------------------------------------------------------------------------

# 24. CUSTOMER 360 → BOOKINGS --- MANDATORY AUDIT

Пользователь отдельно потребовал проверить эту вкладку.

Audit all existing relation cells:

``` text
user/customer
partner
order
service/product
other linked business entities
```

Required:

``` text
UUID leakage = 0 where display value resolvable
wrong entity label = 0
wrong deep link = 0
cross-customer relation leakage = 0
```

------------------------------------------------------------------------

# 25. CUSTOMER 360 → PAYMENTS --- MANDATORY AUDIT

Пользователь отдельно потребовал проверить эту вкладку.

Audit existing relation cells:

``` text
user/customer
partner
order
service/product if actual presentation contract contains it
other linked business entities
```

Важно:

Payment может не иметь прямой Service relation.

Если display path требует:

``` text
Payment → Order → OrderItem/Product/Service
```

проверить actual schema/ADR before implementation.

Не вводить invalid Prisma relation.

Не делать N+1.

Если service is not part of current Payment presentation contract,
зафиксировать N/A с repository evidence; не добавлять unrelated column.

------------------------------------------------------------------------

# 26. CUSTOMER 360 → ORDERS --- RELATED ENTITY AUDIT

Хотя finding был визуально обнаружен в Partner 360 Orders, проверить
Customer 360 Orders тоже.

Audit existing:

``` text
partner
customer/user
service/product
other linked refs
```

Expected:

``` text
business labels/codes
canonical links
UUID leakage = 0
```

------------------------------------------------------------------------

# 27. CUSTOMER 360 → PARTNERS

Два gates:

## 27.1 Header i18n

Raw:

``` text
crm.col.partner
```

must disappear.

Required:

``` text
RU → Партнёр
AZ → canonical project translation
EN → Partner
```

## 27.2 Partner cell display

Проверить, что строки показывают canonical Partner name, а не UUID.

------------------------------------------------------------------------

# 28. PARTNER 360 --- RELATED ENTITY AUDIT SCOPE

Обязательно проверить existing relation cells в:

``` text
Partner 360 → Orders
Partner 360 → Bookings
Partner 360 → Payments
Partner 360 → Users
```

Для реально присутствующих:

``` text
Customer/User
Partner
Order
Booking
Payment
Service/Product
```

------------------------------------------------------------------------

# 29. PARTNER 360 → ORDERS --- MANDATORY UUID DEFECT

Это observed runtime defect.

Для representative rows установить:

``` text
что именно сейчас показывает UUID
какая entity скрыта за UUID
какой API field приходит
какой display field должен приходить/использоваться
какой canonical deep link
```

Root cause должен быть доказан.

Возможные классы, не предполагать заранее:

``` text
backend returns only FK
backend projection omits display name
frontend uses id instead of name
fallback order wrong
wrong entity mapping
cross-schema resolution missing
```

Исправить root cause, не симптом.

------------------------------------------------------------------------

# 30. PARTNER 360 → BOOKINGS --- ENTITY DISPLAY

После добавления Status filter также проверить existing relation cells.

No UUID leakage for resolvable:

``` text
Customer/User
Order
Service/Product
other linked entities
```

------------------------------------------------------------------------

# 31. PARTNER 360 → PAYMENTS --- ENTITY DISPLAY

Проверить:

``` text
Customer/User
Order
Partner if displayed
Service/Product if actually represented
other references
```

Не нарушить Payment attribution.

------------------------------------------------------------------------

# 32. PARTNER 360 → USERS --- ENTITY DISPLAY

Проверить, что Users table использует canonical user display identity:

``` text
name
email if canonical secondary identity
status localized
role/type localized if present
```

UUID не должен быть primary user label.

------------------------------------------------------------------------

# 33. RELATION RESOLUTION --- PERFORMANCE

Запрещено решать display names через N+1.

Если backend должен enrich rows:

``` text
collect IDs
→ batch query
→ Map<ID, display entity>
→ project rows
```

или использовать valid existing Prisma relation where it truly exists.

Соблюдать ADR-0001 / actual schema constraints.

No invalid:

``` text
include.order
include.product
```

если relation в Prisma schema отсутствует.

------------------------------------------------------------------------

# 34. RELATION AUTHORITY / SECURITY

Display enrichment не должен расширять data authority.

Например:

``` text
Partner A row
```

не должен получить display details Partner B/User B, если relation не
принадлежит canonical subject result.

Проверить:

``` text
cross-customer leakage = 0
cross-partner leakage = 0
```

ID resolution is not permission bypass.

------------------------------------------------------------------------

# 35. DEEP LINKS

Для displayed linked entities проверить:

``` text
visible label correct
href uses canonical ID
target 360/details page correct
no route built from display name
no wrong entity type
```

UUID в URL допустим и ожидаем.

UUID как visible primary label --- нет, если entity resolvable.

------------------------------------------------------------------------

# 36. RELATED-ENTITY DISPLAY MATRIX

Заполнить фактическими данными.

  ------------------------------------------------------------------------------------
  Surface    Relation          Before     Canonical   After      Deep link  Result
                               visible    display     visible               
                               value      source      value                 
  ---------- ----------------- ---------- ----------- ---------- ---------- ----------
  Customer   Partner                                                        
  Orders                                                                    

  Customer   User/Customer                                                  
  Orders                                                                    

  Customer   Service/Product                                                
  Orders                                                                    

  Customer   Partner                                                        
  Bookings                                                                  

  Customer   Order                                                          
  Bookings                                                                  

  Customer   Service/Product                                                
  Bookings                                                                  

  Customer   Partner                                                        
  Payments                                                                  

  Customer   Order                                                          
  Payments                                                                  

  Customer   Service/Product                                                
  Payments                                                                  

  Customer   Partner                                                        
  Partners                                                                  

  Partner    User/Customer                                                  
  Orders                                                                    

  Partner    Partner                                                        
  Orders                                                                    

  Partner    Service/Product                                                
  Orders                                                                    

  Partner    User/Customer                                                  
  Bookings                                                                  

  Partner    Order                                                          
  Bookings                                                                  

  Partner    Service/Product                                                
  Bookings                                                                  

  Partner    User/Customer                                                  
  Payments                                                                  

  Partner    Order                                                          
  Payments                                                                  

  Partner    User                                                           
  Users                                                                     
  ------------------------------------------------------------------------------------

Если relation/column не существует по actual presentation contract:

``` text
N/A — <repository evidence>
```

Не оставлять blank.

------------------------------------------------------------------------

# 37. RAW TECHNICAL VALUE AUDIT

В affected tables искать visible patterns:

``` text
UUID
raw enum
raw i18n key
foreign-key-like identifiers
internal database IDs
```

Не считать business codes technical leakage:

``` text
ORD-...
BKG-...
PAY-...
CRM-...
```

если это canonical user-facing code.

Required:

``` text
unintended UUID/system-ID primary labels = 0
raw i18n keys = 0
raw enums = 0
```

------------------------------------------------------------------------

# 38. I18N --- RU / AZ / EN

Browser qualification required for all affected surfaces.

Matrix:

  Surface                    RU   AZ   EN
  -------------------------- ---- ---- ----
  Customer Orders Status               
  Customer Bookings Status             
  Customer Payments Status             
  Partner Orders Status                
  Partner Bookings Status              
  Partner Payments Status              
  Partner Users Status                 
  Customer Partners header             
  related entity labels                

Required:

``` text
raw key = 0
raw enum = 0
mixed locale = 0
```

------------------------------------------------------------------------

# 39. REPRESENTATIVE RUNTIME DATA

Prefer populated known records if still present:

``` text
Customer: CRM-00000089
Partner: Baku Tours Pro
```

Do not hardcode if dataset changed.

Report actual:

``` text
visible code/name
UUID
counts per affected tab
available statuses
representative related entity IDs + display values
```

No secrets.

------------------------------------------------------------------------

# 40. CUSTOMER PAYMENT OWNERSHIP REGRESSION

If dataset unchanged:

``` text
CRM-00000089
Payments = 4
Activity PAYMENT = 4
```

If changed, recalculate from canonical ownership.

Invariant:

``` text
Payment.customerId
OR
Payment.orderId → Order.customerId
```

must remain correct.

Display enrichment must not alter set membership.

------------------------------------------------------------------------

# 41. PARTNER ATTRIBUTION REGRESSION

Preserve:

``` text
Order.sellerPartnerId
```

and existing canonical Booking/Payment derivation.

Display-name resolution must not redefine partner ownership.

------------------------------------------------------------------------

# 42. ACTIVITY REGRESSION

Focused only:

``` text
Customer Activity loads
Partner Activity loads
subject correct
cross-subject leakage 0
History remains removed
```

No Activity redesign.

------------------------------------------------------------------------

# 43. NOTES REGRESSION

Focused:

``` text
Customer Notes loads
Partner Notes loads
i18n correct
RBAC unchanged
```

No Notes redesign.

------------------------------------------------------------------------

# 44. FILTER STALE-REQUEST PROTECTION

For affected async filters:

``` text
Status A
→ immediately Status B
→ final rows = B
```

Use existing AbortController/request identity pattern where applicable.

No stale A overwrite.

------------------------------------------------------------------------

# 45. FILTER EMPTY STATE

Selected status with zero rows:

``` text
localized filtered empty state
filter remains usable
clear restores rows
no false global "no data" semantics
```

------------------------------------------------------------------------

# 46. TESTS --- FRONTEND TARGETED

Add/update behavior tests for:

``` text
Customer Orders Status localization
Customer Bookings Status localization
Customer Payments Status localization

Partner Orders existing filter remains single + works
Partner Bookings Status appears + works
Partner Payments existing filter remains single + works
Partner Users Status appears + works

Customer Partners header localization

related entity display:
  canonical label shown
  UUID not primary visible text
  canonical href preserved

RU/AZ/EN key coverage
```

Avoid snapshot-only acceptance.

------------------------------------------------------------------------

# 47. TESTS --- BACKEND TARGETED

If backend changes:

``` text
Partner Booking status filter
Partner User status filter
subject + status predicate
filter before pagination
invalid status
cross-subject isolation
display projection/enrichment
batch relation resolution
```

For Orders/Payments existing filter contract, add tests only where
missing or modified.

Do not create meaningless duplicate tests.

------------------------------------------------------------------------

# 48. \>PAGE-SIZE REGRESSION

For every modified paginated server-side filter, test dataset larger
than page size.

Required:

``` text
matching record beyond first page
select status
record discoverable under filtered pagination
```

This prevents recurrence of first-N truncation bugs.

------------------------------------------------------------------------

# 49. N+1 / QUERY SANITY

For relation enrichment:

``` text
no query per row
no query per relation cell
```

Provide query strategy evidence.

If query-count instrumentation exists, use it.

Otherwise provide code-level/batched evidence plus representative
runtime sanity.

------------------------------------------------------------------------

# 50. FULL REGRESSION

Run actual repo commands:

``` text
Backend TSC
Backend build
Backend full tests
Frontend TSC
Frontend build
Frontend full tests
```

Accepted pre-round baseline:

``` text
Backend: 1236/1236 PASS
Frontend: 243/243 PASS
```

Counts may increase.

Acceptance:

``` text
0 failed
0 new skipped
```

No silent baseline rewrite.

------------------------------------------------------------------------

# 51. CLEAN RUNTIME / BROWSER AUTHORITY

After changes:

``` text
restart changed services
hard browser reload
```

These are user-observed runtime defects.

Therefore:

``` text
source code PASS ≠ closure
tests PASS ≠ closure
browser runtime PASS required
```

------------------------------------------------------------------------

# 52. NETWORK PROOF

Required for:

``` text
Partner Bookings Status
Partner Users Status
```

and revalidate existing:

``` text
Partner Orders Status
Partner Payments Status
```

Record:

``` text
endpoint
query param
HTTP status
subject
returned statuses
pagination behavior
```

Do not include auth secrets.

------------------------------------------------------------------------

# 53. BEFORE / AFTER FINDING MATRIX

  \#   Finding                                       Before    Root Cause   Fix   Browser After
  ---- --------------------------------------------- --------- ------------ ----- ---------------
  1    Customer Orders Status i18n                                                
  2    Customer Bookings Status i18n                                              
  3    Customer Payments Status i18n                                              
  4    Partner Orders existing Status audit          exists                       
  5    Partner Bookings Status missing               missing                      
  6    Partner Payments existing Status audit        exists                       
  7    Partner Users Status missing                  missing                      
  8    Partner Orders UUID/system labels                                          
  9    `crm.col.partner`                             raw key                      
  10   Customer Bookings/Payments related entities                                

No blank Root Cause/Fix/After.

------------------------------------------------------------------------

# 54. PROHIBITED SHORTCUTS

Forbidden:

``` text
replace UUID with "-"
replace UUID with generic "User"/"Partner"
substring UUID
frontend-only lookup per row
N+1 backend lookup
load all records just to filter
increase take:20 to take:1000
filter only current page
localized enum sent to backend
duplicate Status filter
invent User status
invent Prisma relation
restore History
reset/reseed DB to make evidence pass
```

------------------------------------------------------------------------

# 55. OUT OF SCOPE

Do not implement:

``` text
Step 3.5A Partner CRM Foundation
Partner Workspace
new CRM tabs unrelated to findings
Workforce implementation
new Orders/Bookings creation
payment-method redesign
Activity redesign
Notes redesign
global i18n rewrite
global table redesign
new analytics
new schema unless proven blocker
```

Expected:

``` text
Schema change = 0
Migration = 0
```

If schema/migration appears necessary: STOP and report blocker before
creating it.

------------------------------------------------------------------------

# 56. ROADMAP UPDATE

Preserve history additively.

Record:

``` text
Step 3.5.3 previously closed at 1a3aa23
Workforce roadmap update at e4b38a3 preserved
post-closure runtime findings discovered
Round 2E.2R opened
```

On full success:

``` text
Round 2E.2R — FULLY CLOSED
Step 3.5.3 — RE-CLOSED
Final closure SHA: <SHA>
```

Do not erase prior closures.

------------------------------------------------------------------------

# 57. EXACT NEXT

After closure reread actual canonical roadmap.

Expected if unchanged:

``` text
PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION
```

Report exact canonical NEXT.

Do not start it.

------------------------------------------------------------------------

# 58. REPORT FILE

Create:

``` text
docs/prompts/PHASE_3_STEP_3.5.3_POST_CLOSURE_ROUND_2E_2R_CUSTOMER_PARTNER_360_FILTER_I18N_RELATED_ENTITY_DISPLAY_REMEDIATION_REPORT.md
```

Report in Russian.

------------------------------------------------------------------------

# 59. GIT DISCIPLINE

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

# 60. ACCEPTANCE CRITERIA

VERDICT A only if all are true:

1.  Actual current HEAD audited.

2.  `e4b38a3` preserved/reachable.

3.  All current user findings reproduced/reconciled.

4.  Customer Orders Status localized RU/AZ/EN.

5.  Customer Bookings Status localized RU/AZ/EN.

6.  Customer Payments Status localized RU/AZ/EN.

7.  Customer status options localized.

8.  Partner Orders existing Status not duplicated.

9.  Partner Orders Status works and is localized.

10. Partner Bookings Status exists and works.

11. Partner Payments existing Status not duplicated.

12. Partner Payments Status works and is localized.

13. Partner Users Status exists on canonical domain status.

14. Partner Users Status works and is localized.

15. Canonical enums remain API values.

16. Server-side filters precede pagination where required.

17. page-size regression PASS.

18. Invalid status safe/validated.

19. Filter reset PASS.

20. Filter empty state PASS.

21. Stale response protection PASS.

22. `crm.col.partner` raw key = 0.

23. Customer Partners header localized RU/AZ/EN.

24. Partner Orders observed UUID defect root cause proven.

25. Partner Orders resolvable entity UUID primary labels = 0.

26. Customer Orders related-entity audit complete.

27. Customer Bookings related-entity audit complete.

28. Customer Payments related-entity audit complete.

29. Customer Partners related-entity audit complete.

30. Partner Orders related-entity audit complete.

31. Partner Bookings related-entity audit complete.

32. Partner Payments related-entity audit complete.

33. Partner Users related-entity audit complete.

34. Resolvable Customer/User labels human-readable.

35. Resolvable Partner labels human-readable.

36. Resolvable Order references use canonical business code.

37. Resolvable Booking references use canonical business code where
    displayed.

38. Resolvable Payment references use canonical business code where
    displayed.

39. Resolvable Service/Product labels human-readable where displayed.

40. Canonical UUID remains in href/internal identity where appropriate.

41. Wrong deep links = 0.

42. Raw technical IDs as unintended primary labels = 0.

43. Raw i18n keys = 0 in affected surfaces.

44. Raw enums = 0 in affected surfaces.

45. Mixed locale = 0.

46. No N+1 introduced.

47. No invalid Prisma relation.

48. Customer Payment ownership regression PASS.

49. Partner attribution regression PASS.

50. Customer Activity PASS.

51. Partner Activity PASS.

52. History remains removed.

53. Customer Notes PASS.

54. Partner Notes PASS.

55. Cross-customer leakage = 0.

56. Cross-partner leakage = 0.

57. Targeted frontend tests PASS.

58. Targeted backend tests PASS where backend changed.

59. Backend full suite = 0 FAIL.

60. Frontend full suite = 0 FAIL.

61. New skipped tests = 0.

62. Backend TSC PASS.

63. Backend build PASS.

64. Frontend TSC PASS.

65. Frontend build PASS.

66. Clean runtime performed.

67. Browser proof covers all findings.

68. Browser proof RU/AZ/EN complete.

69. Network filter proof complete.

70. Filter matrix complete.

71. Related-entity display matrix complete.

72. Before/After matrix complete.

73. Schema = 0.

74. Migration = 0.

75. Workforce roadmap update preserved.

76. Roadmap updated additively.

77. Report created.

78. P0 = 0.

79. P1 = 0.

80. No unresolved in-scope P2.

81. Exact staging.

82. Commit/push complete.

83. HEAD == origin/master.

84. Step 3.5A not started.

------------------------------------------------------------------------

# 61. VERDICT RULE

Success only:

``` text
VERDICT A — PHASE 3 STEP 3.5.3 /
POST-CLOSURE ROUND 2E.2R /
CUSTOMER 360 + PARTNER 360 /
FILTER + I18N + RELATED-ENTITY DISPLAY INTEGRITY REMEDIATION /
STATUS FILTER PARITY +
RAW KEY CLOSURE +
UUID/TECHNICAL-ID LEAKAGE CLOSURE /
FULLY CLOSED

STEP 3.5.3 — RE-CLOSED
```

Otherwise:

``` text
VERDICT B — PHASE 3 STEP 3.5.3 /
POST-CLOSURE ROUND 2E.2R /
CUSTOMER 360 + PARTNER 360 /
FILTER + I18N + RELATED-ENTITY DISPLAY INTEGRITY REMEDIATION /
INCOMPLETE
```

No conditional VERDICT A.

------------------------------------------------------------------------

# 62. REQUIRED FINAL RESPONSE FORMAT

``` text
VERDICT:

REPOSITORY
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
Worktree:
e4b38a3 preserved:

FINDINGS
1 Customer Orders Status:
2 Customer Bookings Status:
3 Customer Payments Status:
4 Partner Orders existing Status:
5 Partner Bookings Status:
6 Partner Payments existing Status:
7 Partner Users Status:
8 Partner Orders UUID/display:
9 Customer Partners crm.col.partner:
10 Customer Bookings/Payments relation audit:

FILTER AUTHORITY
Customer Orders:
Customer Bookings:
Customer Payments:
Partner Orders:
Partner Bookings:
Partner Payments:
Partner Users:

RELATED ENTITY DISPLAY
Customer Orders:
Customer Bookings:
Customer Payments:
Customer Partners:
Partner Orders:
Partner Bookings:
Partner Payments:
Partner Users:
UUID/system-ID leakage:
Wrong deep links:
N+1:

LOCALIZATION
RU:
AZ:
EN:
Raw keys:
Raw enums:
Mixed locale:

NETWORK
Partner Orders:
Partner Bookings:
Partner Payments:
Partner Users:

RUNTIME
Customer:
Partner:
Browser findings closed:
A→B→A / isolation:

REGRESSIONS
Customer Payment ownership:
Partner attribution:
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

ROADMAP
Workforce update e4b38a3:
Round 2E.2R:
Step 3.5.3:
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

# 63. STOP

После успешного remediation:

``` text
Round 2E.2R — FULLY CLOSED
Step 3.5.3 — RE-CLOSED
```

**STOP.**

Не начинать `PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION` без
отдельного задания.
