# PHASE 3 --- STEP 3.5.3 --- PLATFORM CRM

## CRM COMMUNICATIONS + ACTIVITY TIMELINE

## ROUND 2C.1 --- FINAL RUNTIME + I18N + HISTORY + BACKFILL OPERATIONAL CLOSURE

**Финальный отчёт и ответ разработчика --- строго на русском.**

## 1. Цель

Одним финальным remediation-round закрыть все оставшиеся вопросы
Customer 360 Activity после Round 2C.

Уже доказанный baseline:

``` text
CrmActivity backfill: 3416 projected / 0 errors
Customer Activity API: items > 0
Customer 360: populated Activity timeline
CUS-00000067: 47 activity items
Cursor P1/P2/P3: по 10 items, overlap = 0
sourceType=PAYMENT: PASS
dateFrom/dateTo: PASS
combined source/date filter: PASS
Order/Booking links: clickable
HEAD validation milestone: d9401fd
```

Не переделывать работающие cursor/filter/API mechanics.

Открытые вопросы:

1.  mixed-locale / persisted Russian presentation text в Activity;
2.  History → Activity reconciliation;
3.  production-safe backfill execution authority;
4.  сохранение исправленных cross-schema adapters;
5.  historical rebuild + live projection proof;
6.  финальная RU/AZ/EN runtime-валидация;
7.  regression + roadmap synchronization.

------------------------------------------------------------------------

## 2. Repository-first

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

Проверить `d9401fd` на reachable, но не считать его автоматически
current HEAD. Не reset/revert legitimate newer work.

Зафиксировать Repository, Branch, Starting HEAD, origin/master,
Worktree.

------------------------------------------------------------------------

# PART A --- ACTIVITY LANGUAGE AUTHORITY

## 3. Runtime finding

На **EN locale** реальный populated timeline показывает:

``` text
Order
Order created
Заказ создан          ← WRONG / locale leak

Booking
Booking created
Бронирование создано  ← WRONG / locale leak
```

При этом `Activity`, `All sources`, `From`, `To`, `Order`, `Booking`,
`Order created`, `Booking created` уже корректны для EN.

Это не обычный missing i18n key. Классифицировать exact root cause,
ожидаемо:

``` text
LOCALE_LEAKING_PERSISTED_PRESENTATION_TEXT
```

или более точный repository-derived вариант.

## 4. Trace second line

Для реального Activity item проследить:

``` text
sourceType
eventType
title
description
metadata
frontend localized event label
frontend secondary text
```

Точно доказать, откуда приходят `Заказ создан` / `Бронирование создано`:
`CrmActivity.title`, `description`, metadata, adapter, legacy source
field или другое.

Не скрывать строку CSS и не удалять её вслепую.

## 5. Canonical language model

Если persisted text является locale-specific presentation, привести
contract к locale-neutral semantics:

``` text
CrmActivity
├── sourceType
├── sourceId
├── eventType
├── occurredAt
├── subject/customer/partner refs
└── structured locale-neutral metadata
          ↓
frontend active locale
          ↓
RU / AZ / EN presentation
```

Не хранить единственный canonical смысл события только строкой
`"Заказ создан"`.

Если secondary line просто дублирует localized event label --- устранить
бессмысленное дублирование. Если содержит отдельную полезную business
information --- сохранить её семантику структурированно и локализовать
presentation.

## 6. Existing rows

Если data contract меняется, reconcile уже существующие rows. При
необходимости выполнить controlled rebuild:

``` text
0 errors
no duplicates
correct subjects
canonical occurredAt
no locale leakage
```

Не оставлять 3416 старых locale-leaking rows.

## 7. RU/AZ/EN populated proof

На одних и тех же реальных событиях заполнить:

  Element           RU   AZ   EN     Raw enum?   Mixed locale?
  ----------------- ---- ---- ---- ----------- ---------------
  Activity tab                                 
  Source filter                                
  From / To                                    
  Order source                                 
  Booking source                               
  Payment source                               
  Order created                                
  Booking created                              
  Payment event                                
  Secondary text                               
  Load more                                    
  Empty state                                  

Acceptance:

``` text
raw known enums = 0
raw i18n keys = 0
mixed-locale Activity text = 0
```

## 8. Date/time

Проверить locale-aware форматирование `occurredAt`.

EN `12/19/2026 04:00 AM` само по себе не является finding. Требование
--- формат соответствует active locale RU/AZ/EN. Не hardcode один формат
для всех.

------------------------------------------------------------------------

# PART B --- HISTORY → ACTIVITY RECONCILIATION

## 9. Finding

Runtime Customer 360 одновременно содержит `Activity` и `History`, хотя
архитектурное решение Step 3.5.3:

``` text
Customer History → MIGRATE into Activity tab
```

Нельзя автоматически удалить History без аудита и нельзя оставить два
конкурирующих canonical timeline без обоснования.

## 10. Audit History

Проверить actual:

``` text
History component
API/source
displayed fields
events
actions
pagination
RBAC
links
unique data
CustomerHistory adapter
CrmActivity backfill coverage
```

Ответить:

1.  Что показывает History?
2.  Есть ли данные, которых нет в Activity?
3.  Есть ли unique actions?
4.  Проецируется ли CustomerHistory в CrmActivity?
5.  Потеряется ли информация/функция при удалении History?

## 11. Reconciliation rule

Если History --- legacy read-only feed и его canonical data уже
представлены в Activity:

``` text
remove legacy History tab
Activity = canonical timeline
```

Если History содержит unique data/actions --- не удалять молча.
Перенести семантику в Activity либо зафиксировать blocking architecture
conflict → VERDICT B.

## 12. URL compatibility

Проверить legacy `?tab=history` или equivalent. После migration не
должно быть broken/blank state. Использовать repository-consistent
redirect/map/fallback.

Проверить final Customer 360 tab model в browser.

------------------------------------------------------------------------

# PART C --- BACKFILL OPERATIONAL AUTHORITY

## 13. Known facts

Во время remediation добавлен:

``` text
POST /crm-activity/backfill
```

Он позволил получить `3416 projected / 0 errors`, но production
qualification ещё не завершена.

Known `rebuildAll()` properties:

  Criterion              Known state
  ---------------------- -----------------------------------
  Idempotency            `deleteMany({})` + full reproject
  Deduplication          in-memory Set + DB unique
  Batching               500 + transaction chunks
  Canonical timestamps   implemented
  Source adapters        10
  Subject mapping        fixed/verified
  Concurrency lock       absent
  Strategy               destructive clear then reproject

`Idempotent` не означает `safe under concurrent/live execution`.

## 14. Decide final invocation mechanism

Repository-aware выбрать один вариант:

``` text
A. controlled CLI / maintenance command
B. protected internal/admin maintenance endpoint
C. existing project job/worker mechanism, only if already appropriate
```

Не строить новую большую job infrastructure без необходимости.

## 15. If REST endpoint remains

Mandatory:

``` text
authentication
dedicated authorization
ADMIN/internal maintenance authority
audit
re-entry/concurrency protection
clear locked/409 semantics
error reporting
no anonymous access
no ordinary CRM read-role access
```

Отдельно квалифицировать read availability во время
`deleteMany({}) → reproject`.

`crm.activity.read` **не является** rebuild permission.

## 16. If REST endpoint is removed

Предпочтительный controlled CLI/maintenance contract должен:

``` text
reuse service logic
return non-zero exit on errors
print scanned/projected/errors/duration
not expose secrets
be documented
not expose production REST attack surface
```

## 17. Concurrency/read availability

Проверить:

``` text
rebuild starts
→ deleteMany({})
→ reprojection
→ Activity API receives reads
```

Если timeline временно пуст --- честно документировать
maintenance-window semantics и обеспечить controlled invocation. Не
заявлять zero-downtime, если его нет.

------------------------------------------------------------------------

# PART D --- ADAPTER / PROJECTION FINALIZATION

## 18. Preserve fixed schema authority

Уже установлено:

``` text
Order.sellerPartnerId exists
OrderItem.product Prisma relation does NOT exist
Booking/Payment/Refund do NOT have Prisma @relation to Order
cross-schema references follow ADR-0001 / ID lookup pattern
```

Не возвращать invalid:

``` text
include.product
include.order
```

где schema relation отсутствует.

## 19. No N+1

Проверить Booking/Payment/Refund cross-schema lookup. Не допускать:

``` text
for every row → findUnique(Order)
```

Предпочтительно:

``` text
batch rows
→ unique orderIds
→ findMany Orders
→ Map<orderId, Order>
→ project
```

или repository-equivalent batched strategy.

## 20. Final source matrix

  ---------------------------------------------------------------------------------------
  Source                   Scanned   Projected      Errors Subject   Timestamp   Status
                                                           mapping               
  -------------------- ----------- ----------- ----------- --------- ----------- --------
  OperationalNote                                                                

  Order                                                                          

  Booking                                                                        

  Payment                                                                        

  Refund                                                                         

  Message                                                                        

  Audit                                                                          

  CustomerHistory                                                                

  BuyerRequest                                                                   

  PartnerApplication                                                             
  ---------------------------------------------------------------------------------------

`0 projected` допустимо только при отсутствии relevant source rows или
документированной canonical reason.

------------------------------------------------------------------------

# PART E --- LIVE PROJECTION

## 21. Critical requirement

Historical rebuild недостаточен. Проверить, что новые canonical business
events попадают в `CrmActivity` **без полного manual rebuild**.

Через существующий business flow создать controlled test event,
например:

``` text
Order
Booking
Operational Note
Payment where canonical flow supports it
```

Доказать:

``` text
business event
→ CrmActivity row appears
→ Customer Activity API returns it
→ Customer 360 browser shows it
→ full rebuild NOT required
```

Если новые события появляются только после manual backfill --- P1,
VERDICT B.

Не создавать обходные direct-create endpoints для Order/Booking, если
архитектура определяет их system-created.

------------------------------------------------------------------------

# PART F --- RUNTIME REGRESSION

## 22. Cursor

Повторить на `CUS-00000067` или другом existing customer с достаточным
количеством events:

``` text
P1
P2
intersection IDs = 0
occurredAt DESC, id DESC preserved
```

Не нужно заново искусственно создавать 47 events.

## 23. Filters

Повторить populated server-side:

``` text
sourceType=PAYMENT
dateFrom/dateTo
sourceType + date range
```

Frontend filtering вместо server-side запрещён.

## 24. RBAC

Проверить:

``` text
authorized CRM actor → Activity allowed
unauthenticated → 401
unauthorized → 403 / canonical hidden-tab behavior
source-specific item authority preserved
maintenance/backfill authority separate
```

## 25. Operational Notes

Не регрессировать уже закрытое:

``` text
Customer Notes authorized access
Partner Notes authorized access
RolePermission persistence
create/edit/delete canonical authority
```

## 26. State boundaries

Сохранить:

``` text
200 + items → data
200 + []    → empty
403         → forbidden
5xx/network → error
loading     → loading
```

Не преобразовывать 403 в empty.

------------------------------------------------------------------------

# PART G --- TESTS

## 27. Backend

Focused coverage по actual changes:

-   adapter projection без invalid Prisma relations;
-   batched cross-schema Order lookup;
-   subject mapping;
-   rebuild 0-error path;
-   backfill auth/re-entry if REST remains;
-   unauthorized rebuild denial;
-   live projection;
-   existing CRM Activity RBAC/cursor/filter regression.

Тесты должны ловить Prisma shape regression, а не только mocked happy
path.

## 28. Frontend

Проверить/добавить:

-   EN populated event без русского duplicate;
-   RU presentation;
-   AZ presentation;
-   source/event mappings;
-   secondary text semantics;
-   History reconciliation;
-   legacy history URL if applicable;
-   cursor/filter regression;
-   no raw keys/enums.

## 29. Gates

Запустить:

``` text
Backend TSC
Backend build
CRM Activity unit tests
CRM Activity RBAC E2E
new adapter/backfill/live-projection tests
Frontend TSC
Frontend build
Frontend tests
Operational Notes relevant regression
```

Исторический frontend baseline: `243/243`. Если count изменился
legitimate образом --- report exact count/reason.

------------------------------------------------------------------------

# PART H --- REQUIRED EVIDENCE

## 30. API runtime matrix

  Scenario                        Actor                 HTTP Result       Status
  ------------------------------- ------------------- ------ ------------ --------
  Populated activity              authorized                 items \> 0   
  Cursor P1                       authorized                              
  Cursor P2                       authorized                              
  PAYMENT filter                  authorized                              
  Date filter                     authorized                              
  Combined filter                 authorized                              
  Activity unauthorized           unauthorized                            
  Maintenance allowed             maintenance actor                       
  Maintenance ordinary CRM role   CRM role                   denied       
  Maintenance unauthenticated     none                       denied       

Если REST backfill удалён --- заменить последние строки CLI/maintenance
evidence.

## 31. Browser runtime matrix

  Scenario                         RU   AZ   EN   Mixed? Status
  ------------------------------ ---- ---- ---- -------- --------
  Order event                                            
  Booking event                                          
  Payment event                                          
  Secondary text                                         
  Source filter                                          
  Date filters                                           
  Load more                                              
  Empty state                                            
  Final History/Activity model                           

## 32. History matrix

  Question                   Evidence   Decision
  -------------------------- ---------- ----------
  History source                        
  Unique data?                          
  Unique actions?                       
  CustomerHistory adapter?              
  Backfilled to Activity?               
  Tab removed/retained?                 
  Reason                                
  Legacy URL behavior                   

## 33. Backfill operational matrix

  Criterion                   Before            Final   Evidence
  --------------------------- ----------------- ------- ----------
  Invocation                  REST endpoint             
  AuthN                                                 
  AuthZ                                                 
  Dedicated authority                                   
  Audit                                                 
  Re-entry protection         none                      
  Batching                    500                       
  Dedupe                      Set + DB unique           
  Destructive clear           yes                       
  Read availability           gap possible              
  Error reporting                                       
  Production recommendation   unresolved                

No blank applicable rows.

------------------------------------------------------------------------

# PART I --- ROADMAP / REPORT / GIT

## 34. Roadmap

После VERDICT A синхронизировать canonical roadmap:

``` text
Round 2C — Customer 360 Activity UI
    ✅ FULLY CLOSED

Round 2C.1 — Final Runtime/I18N/History/Backfill Closure
    ✅ CLOSED (<SHA>)

Round 2D — Partner 360 Activity UI
    ⏭ NEXT
```

Не закрывать весь Step 3.5.3.

## 35. Report

Создать:

``` text
docs/prompts/PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2C_1_FINAL_RUNTIME_I18N_HISTORY_BACKFILL_CLOSURE_REPORT.md
```

На русском.

## 36. Git discipline

Перед staging:

``` bash
git diff --check
git status --short
git diff
```

Stage exact files only. Запрещено `git add .` / `git add -A`. Normal
push, never force-push.

После push проверить HEAD == upstream и clean worktree.

------------------------------------------------------------------------

# 37. ACCEPTANCE CRITERIA

VERDICT A только если:

1.  exact origin русского secondary text доказан;
2.  locale leak устранён не CSS workaround;
3.  duplicate event presentation устранён либо semantic secondary text
    сохранён корректно;
4.  existing rows reconciled if needed;
5.  final rebuild = 0 errors;
6.  source projection matrix complete;
7.  Order/Booking/Payment/Refund projection PASS;
8.  invalid Prisma includes не возвращены;
9.  cross-schema lookup не создаёт очевидный N+1;
10. subject/partner mapping correct;
11. canonical timestamps preserved;
12. RU populated timeline PASS;
13. AZ populated timeline PASS;
14. EN populated timeline PASS;
15. raw known enums = 0;
16. raw i18n keys = 0;
17. mixed-locale Activity = 0;
18. date/time locale-aware;
19. History actual behavior audited;
20. unique History data/actions not lost;
21. CustomerHistory → Activity coverage verified;
22. duplicate canonical History + Activity resolved according to
    architecture;
23. legacy History URL safe;
24. final Customer 360 tab model browser-verified;
25. backfill invocation mechanism explicitly qualified;
26. ordinary CRM read role has no rebuild authority;
27. unauthenticated rebuild impossible;
28. concurrency/re-entry risk controlled;
29. destructive-clear availability semantics documented honestly;
30. errors surfaced;
31. historical rebuild PASS;
32. live projection PASS without manual rebuild;
33. cursor P1/P2 PASS;
34. cursor overlap = 0;
35. ordering preserved;
36. PAYMENT filter PASS;
37. date filter PASS;
38. combined filter PASS;
39. Activity RBAC PASS;
40. source-specific authority preserved;
41. Operational Notes regression PASS;
42. state boundaries preserved;
43. Backend TSC/build PASS;
44. CRM Activity unit/E2E PASS;
45. new adapter/backfill/live projection tests PASS;
46. Frontend TSC/build/tests PASS;
47. populated browser proof exists;
48. all evidence matrices complete;
49. no Round 2D implementation;
50. no unrelated redesign;
51. report in Russian;
52. roadmap synchronized;
53. `git diff --check` clean;
54. committed + pushed;
55. HEAD == origin/master;
56. no unresolved P0/P1;
57. verdict based on actual runtime, not source inspection alone.

------------------------------------------------------------------------

# 38. FINAL RESPONSE --- STRICTLY RUSSIAN

``` text
VERDICT:

РЕПОЗИТОРИЙ
Repository:
Branch:
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
Worktree:

BASELINE
Backfill:
Cursor:
Filters:
Populated timeline:

FINDING A — MIXED LOCALE
Root cause:
Persisted fields:
Fix:
Existing rows reconciliation:

I18N RUNTIME
RU:
AZ:
EN:
Raw enums:
Raw keys:
Mixed locale:
Date/time:

FINDING B — HISTORY
History source:
Unique data/actions:
CustomerHistory adapter:
Migration to Activity:
Final tab model:
Legacy URL:

FINDING C — BACKFILL AUTHORITY
Previous mechanism:
Final mechanism:
AuthN:
AuthZ:
Audit:
Concurrency/re-entry:
Read availability:
Operational recommendation:

ADAPTER / PROJECTION
Order:
Booking:
Payment:
Refund:
Cross-schema lookup:
N+1:
Final projected:
Final errors:

LIVE PROJECTION
Created canonical event:
CrmActivity row:
API:
Browser:
Manual rebuild required?:

CURSOR REGRESSION
P1:
P2:
Overlap:
Ordering:

FILTER REGRESSION
Payment:
Date:
Combined:

RBAC / SECURITY
Activity read:
Source item authority:
Backfill authority:
Unauthorized:
Unauthenticated:

API RUNTIME MATRIX
...

BROWSER RUNTIME MATRIX
...

HISTORY MATRIX
...

BACKFILL OPERATIONAL MATRIX
...

TESTS / BUILDS
Backend TSC:
Backend build:
CRM Activity unit:
CRM Activity E2E:
Backfill/adapter/live:
Frontend TSC:
Frontend build:
Frontend tests:
Operational Notes:

FILES CHANGED
...

Schema changed:
Migration changed:
Backend production changed:
Frontend production changed:
Operational tooling changed:

ROADMAP
Round 2C:
Round 2C.1:
Next:

Report:
Commit:

ОСТАВШИЕСЯ FINDINGS
P0:
P1:
P2:

NEXT:
```

------------------------------------------------------------------------

# 39. VERDICT RULE

Success only:

``` text
VERDICT A — PHASE 3 STEP 3.5.3 PLATFORM CRM /
CRM COMMUNICATIONS + ACTIVITY TIMELINE /
ROUND 2C.1 — FINAL RUNTIME + I18N + HISTORY +
BACKFILL OPERATIONAL CLOSURE /
POPULATED TIMELINE LANGUAGE AUTHORITY +
HISTORY RECONCILIATION + SAFE BACKFILL +
LIVE PROJECTION + REGRESSION EVIDENCE /
FULLY CLOSED
```

Otherwise:

``` text
VERDICT B — PHASE 3 STEP 3.5.3 PLATFORM CRM /
CRM ACTIVITY ROUND 2C.1 /
FINAL CUSTOMER ACTIVITY CLOSURE INCOMPLETE
```

No conditional VERDICT A.

------------------------------------------------------------------------

# 40. STOP

После implementation + rebuild/live projection proof + RU/AZ/EN
populated browser proof + History reconciliation + backfill hardening +
tests/builds + report + roadmap sync + commit/push --- **STOP**.

Не начинать:

``` text
ROUND 2D — PARTNER 360 ACTIVITY UI
```

без отдельного задания.
