# PHASE 3 --- POST-STAGE-H / PRE-STAGE-I

# COMMAND CENTER WIDGET REGISTRY & MARKETPLACE ENRICHMENT RECONCILIATION

## SETTINGS ↔ RUNTIME SINGLE SOURCE OF TRUTH

## PRE-STAGE-I BLOCKING GATE

## 1. Язык ответа

Все ответы разработчика, findings, таблицы, runtime evidence, результаты
тестов, отчёт и финальный VERDICT должны быть **НА РУССКОМ ЯЗЫКЕ**. Код,
identifiers, paths, enums, API fields, команды, SHA и commit messages
можно сохранять в оригинале.

## 2. Entry status

``` text
Stage C — WHAT                                      COMPLETE
Stage D — WHY                                       COMPLETE
Stage E — IMPACT                                    COMPLETE
Stage F — ACTION                                    COMPLETE
Stage G — AI Decision Feed                          COMPLETE
Stage H — Executive/Operational/Financial Enrichment COMPLETE

Current gate:
Settings ↔ Command Center reconciliation             IMPLEMENT NOW

Stage I/J                                            DO NOT START
```

## 3. Исходная проблема

В Settings сейчас существует registry:

``` text
GMV
Collected GMV
Outstanding
Completed GMV
Revenue
Net Revenue
Orders
Bookings
AOV
Conversion
Orders Fulfilled
Bookings Confirmed
Bookings Completed
Payments Captured
Refunds Processed
Conversion Funnel
Commission
Reconciliation (mandatory)
Payments
Net Payments
Sessions
Storefront Sessions
Marketplace Partners
Storefront Partners
Marketplace Buyers
Storefront Buyers
```

После Stages B--H этот список больше не полностью соответствует runtime
Command Center. При этом часть legacy-показателей потенциально полезна и
не должна удаляться без semantic/data audit.

## 4. Цель

Выполнить одновременно:

1.  Полную сверку Settings ↔ фактический Command Center.
2.  Re-qualification полезных legacy metrics.
3.  Добавление authoritative Marketplace/Storefront metrics в Command
    Center, если данные позволяют.
4.  Создание **единого canonical widget registry**, от которого зависят
    Settings, runtime rendering, RBAC, workspace applicability и
    defaults.

Целевая архитектура:

``` text
                 Canonical Widget Registry
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   Command Center     Settings      RBAC/Entitlements
      rendering      show/hide         filtering
```

Не сохранять два независимых вручную поддерживаемых списка.

## 5. Обязательный audit legacy registry

Классифицировать каждый item:

``` text
A — canonical active widget
B — useful metric requiring runtime inclusion
C — useful only if authoritative source exists
D — superseded/obsolete
E — invalid semantic / must not return
F — mandatory/non-hideable control
```

Вернуть таблицу:

  -----------------------------------------------------------------------------
  Settings item    Class         Runtime exists?   Authoritative? Final
                                                                  disposition
  ---------------- ------------ ---------------- ---------------- -------------
  GMV                                                             

  Collected GMV                                                   

  Outstanding                                                     

  Completed GMV                                                   

  Revenue                                                         

  Net Revenue                                                     

  Orders                                                          

  Bookings                                                        

  AOV                                                             

  Conversion                                                      

  Orders Fulfilled                                                

  Bookings                                                        
  Confirmed                                                       

  Bookings                                                        
  Completed                                                       

  Payments                                                        
  Captured                                                        

  Refunds                                                         
  Processed                                                       

  Conversion                                                      
  Funnel                                                          

  Commission                                                      

  Reconciliation                                                  

  Payments                                                        

  Net Payments                                                    

  Sessions                                                        

  Storefront                                                      
  Sessions                                                        

  Marketplace                                                     
  Partners                                                        

  Storefront                                                      
  Partners                                                        

  Marketplace                                                     
  Buyers                                                          

  Storefront                                                      
  Buyers                                                          
  -----------------------------------------------------------------------------

## 6. Frozen financial semantics

Не нарушать:

``` text
GMV              → Qualified GMV
Collected GMV    → Оплачено по GMV; cohort-based Order.paidAmount
Outstanding      → Остаток к оплате
Completed GMV    → Исполненный GMV
Payments         → Объём платежей; CAPTURED Payment event-period
Net Payments     → Чистый объём платежей
Commission       → Начисленная комиссия
```

`Revenue` и `Net Revenue` **не возвращать автоматически**. Customer
payments ≠ TravelHub Revenue, GMV ≠ Revenue, Payment Volume ≠ Revenue.
Если audit не обнаружит новую доказуемую authority:

``` text
Revenue     → obsolete/invalid legacy widget
Net Revenue → obsolete/invalid legacy widget
```

Не alias `Revenue` → `Payments`.

## 7. Stage H Refunds gap

Stage H добавил monetary KPI:

``` text
Refunds / Возвраты
```

Legacy Settings имеет:

``` text
Refunds Processed
```

Это разные semantics:

``` text
Refunds Processed → operational count
Refunds           → financial amount
```

Если оба runtime widgets существуют, registry обязан иметь разные IDs и
metadata.

## 8. Executive target inventory

Сверить минимум:

``` text
GMV
Оплачено по GMV
Остаток к оплате
Исполненный GMV
Orders
Bookings
AOV
Conversion
```

## 9. Operational target inventory

Сверить:

``` text
Orders Fulfilled
Bookings Confirmed
Bookings Completed
Payments Captured
Refunds Processed
Conversion Funnel
```

Operational cards остаются прежде всего counts/state indicators. Не
добавлять сумму на каждую карточку автоматически.

## 10. Financial target inventory

После Stage H минимум:

``` text
Payments / Объём платежей
Refunds / Возвраты
Net Payments / Чистый объём платежей
Commission / Начисленная комиссия
Reconciliation
```

## 11. Reconciliation mandatory

Проверить, почему `Reconciliation` mandatory. Если policy
подтверждается:

``` text
visible = always when section permitted
hide/remove = prohibited
API/manual payload cannot hide it
```

RBAC section authority сохраняется.

## 12. Marketplace / Storefront enrichment candidates

Не удалять до data audit:

``` text
Sessions
Storefront Sessions
Marketplace Partners
Storefront Partners
Marketplace Buyers
Storefront Buyers
```

### Marketplace Partners

Определить authoritative definition:

``` text
all registered?
active?
with published services?
with orders in period?
with sales in period?
```

Для Command Center предпочтительна decision-useful metric, но definition
нельзя выбирать произвольно.

### Storefront Partners

Проверить:

``` text
all storefront workspaces?
active storefront partners?
trial?
subscription?
with customer activity?
```

Не использовать paid-subscription semantics, если billing engine не
authoritative.

### Marketplace Buyers

Предпочтительный кандидат --- unique marketplace buyers за выбранный
период, **только если channel attribution доказуема**. Не считать всех
registered customers Marketplace Buyers.

### Storefront Buyers

Определить unique Storefront buyers/customers за период. Проверить
tenant/channel attribution и исключить undocumented double counting.

## 13. Sessions / Storefront Sessions --- strict authority gate

Включать только при реальном authoritative traffic/session source.

Audit:

``` text
source table/service
session identity
bot filtering
authenticated/anonymous semantics
channel/workspace attribution
date authority
timezone
period comparison
```

Если это placeholder, synthetic, mock или derived через arbitrary
coefficient:

``` text
DO NOT IMPLEMENT
```

Запрещено:

``` text
orders × coefficient
buyers × coefficient
random demo value
seed-only fake traffic
```

Если authoritative session events отсутствуют, результат
`unsupported for now` является корректным.

## 14. Marketplace section presentation

Если data authority подтверждена, рассмотреть:

  Metric              Marketplace   Storefront
  ----------------- ------------- ------------
  Active Partners                 
  Unique Buyers                   
  Sessions                        

Не обязательно создавать 6 одинаковых независимых cards. Сохранить
текущий Command Center design language и не делать большой redesign.

## 15. Period semantics

Для каждой новой metric определить:

``` text
SNAPSHOT / COHORT / EVENT_PERIOD
date field
timezone
comparison period
```

Если `% ↑/↓` не имеет meaningful comparable semantics --- comparison не
показывать.

## 16. Canonical widget registry contract

Registry должен содержать минимум:

``` text
widgetId
section
labelKey
customizable
mandatory
requiredPermission
workspace applicability
entitlement applicability
render type/capability
default order
default visibility / role default
```

Business formula не дублировать во frontend registry, если backend
является authority.

## 17. Widget IDs

IDs:

``` text
stable
unique
semantic
consistent with i18n convention
```

Учитывая прошлый camelCase/kebab-case defect, выбрать/сохранить
canonical convention и защитить invariant tests.

Не менять stable IDs без необходимости.

## 18. Settings и runtime должны использовать один registry

Нельзя оставлять отдельный:

``` text
const SETTINGS_WIDGETS = [...]
```

если runtime использует другой source.

После closure должны быть невозможны состояния:

``` text
Settings widget exists but runtime cannot render it
customizable runtime widget missing from Settings
```

## 19. Visibility ≠ Permission

Критический принцип:

``` text
user-hidden ≠ RBAC-denied
```

Visibility preference применяется только после authoritative
permission/section/entitlement filtering.

Settings не может включить запрещённый widget.

Сохранить фактические permissions, включая:

``` text
analytics.read
dashboard.executive.read
dashboard.operational.read
dashboard.financial.read
dashboard.marketplace.read
dashboard.customize
```

или canonical equivalents repository.

## 20. Role defaults / workspace / entitlements

Не делать все widgets visible всем ролям после reconciliation.

Сохранить Safe Default Role Matrix и существующую возможность admin
управлять permissions.

Registry обязан учитывать:

``` text
PLATFORM
PARTNER
tenant scope
Marketplace Basic
Storefront Pro
```

Platform-wide Marketplace/Storefront metrics не должны утекать в Partner
workspace.

## 21. Decision Queue / AI Decision Feed

Отдельно определить status:

``` text
Decision Queue
AI Decision Feed
```

Это не обычные KPI widgets.

Не смешивать их с KPI show/hide list без architecture rationale.

Предпочтительно сохранить их как отдельные section/block capabilities,
если current architecture не определяет иное.

## 22. Drag & drop / ordering

Проверить:

``` text
reorder supported?
within section only?
cross-section allowed?
mandatory widget movable?
```

Не позволять drag-and-drop нарушать semantic section ownership.

## 23. Legacy saved preferences

Обязательно проверить старые сохранённые IDs:

``` text
Revenue
Net Revenue
unknown/deleted widget IDs
old aliases
```

Нельзя допустить crash, blank card или raw key.

Policy:

``` text
obsolete IDs → safely ignored/removed
exact semantic aliases → migrate only when truly equivalent
new widgets → documented default policy
```

Не alias Revenue → Payments.

## 24. Localization

Settings должен использовать те же semantic i18n labels, что runtime,
где metric одна и та же.

Canonical RU labels минимум:

``` text
GMV
Оплачено по GMV
Остаток к оплате
Исполненный GMV
Объём платежей
Возвраты
Чистый объём платежей
Начисленная комиссия
```

RU/AZ/EN:

``` text
raw widget IDs = 0
raw cc.* keys = 0
mixed-language system labels = 0
```

## 25. Backend validation

Если preferences сохраняются через API:

``` text
unknown widget ID → reject or safely normalize per contract
forbidden widget → cannot enable
mandatory widget → cannot hide
invalid cross-section move → reject
```

Server-side validation mandatory.

## 26. Data reconciliation for accepted new metrics

Для каждого реально добавленного:

``` text
Marketplace Partners
Storefront Partners
Marketplace Buyers
Storefront Buyers
Sessions
Storefront Sessions
```

предоставить:

``` text
business definition
source model/table
formula/query
date authority
scope
period type
DB result
API result
UI result
```

DB = API = UI.

Для period metrics проверить минимум MONTH и YEAR. Для snapshot --- N/A
с объяснением допустимо.

## 27. Existing 2026 dataset

Использовать текущий demo dataset. Не reseed только ради красивых новых
KPI.

Если session authority отсутствует --- не генерировать fake sessions.

## 28. Performance

Вернуть:

``` text
Command Center before
Command Center after
additional queries
N+1 YES/NO
```

Не делать отдельный uncontrolled aggregate query на каждый новый widget.

## 29. Regression gates

Сохранить Stage H:

``` text
GMV
Collected GMV
Outstanding
Completed GMV
Payment Volume
Refunds
Net Payments
Commission
AZN/₼
rounding reconciliation
```

Сохранить C--G:

``` text
Decision Queue
WHAT / WHY / IMPACT / ACTION
AI Decision Feed
No-Fabrication
```

## 30. Tests --- registry invariants

Добавить tests:

``` text
every customizable runtime widget exists in canonical registry
every Settings widget maps to renderable/applicable widget
widget IDs unique
i18n key exists RU/AZ/EN
mandatory widgets cannot be hidden
Revenue/Net Revenue cannot re-enter runtime
```

## 31. Tests --- RBAC / legacy preferences

Проверить:

``` text
hidden permitted widget
forbidden widget
dashboard.customize denied
section permission denied
saved Revenue
saved Net Revenue
unknown ID
new Refunds absent from old preferences
```

Dashboard должен безопасно загрузиться.

## 32. Browser runtime --- mandatory

Проверить Settings в:

``` text
RU
AZ
EN
```

И реальные interactions:

``` text
hide widget → disappears
show widget → appears
mandatory widget → cannot disappear
forbidden widget → cannot be enabled
reload → preference preserved
```

Если Marketplace metrics accepted --- показать actual runtime values.

## 33. Required deliverables

### A --- Legacy inventory

Полная classification table всех текущих Settings items.

### B --- Final canonical registry

  -----------------------------------------------------------------------------------
  widgetId   Section   RU label    Customizable    Mandatory Permission   Workspace
  ---------- --------- --------- -------------- ------------ ------------ -----------

  -----------------------------------------------------------------------------------

### C --- Removed/superseded

``` text
Revenue:
Net Revenue:
other obsolete:
legacy preference handling:
```

### D --- Marketplace data audit

  -----------------------------------------------------------------------------
  Metric        Authority   Definition   Period type   Implemented? Reason
  ------------- ----------- ------------ ----------- -------------- -----------
  Marketplace                                                       
  Partners                                                          

  Storefront                                                        
  Partners                                                          

  Marketplace                                                       
  Buyers                                                            

  Storefront                                                        
  Buyers                                                            

  Sessions                                                          

  Storefront                                                        
  Sessions                                                          
  -----------------------------------------------------------------------------

### E --- Before/After

``` text
Settings before:
Settings after:
Command Center before:
Command Center after:
```

### F --- RBAC / preferences

``` text
Customization storage:
Validation authority:
Mandatory handling:
Permission handling:
Entitlement handling:
Legacy IDs:
New widget default policy:
```

### G --- DB/API/UI

Для каждой accepted new metric.

### H --- Localization

``` text
RU raw/mixed:
AZ raw/mixed:
EN raw/mixed:
```

### I --- Performance

``` text
Before:
After:
Delta:
Queries:
N+1:
```

### J --- Tests

``` text
New tests:
Backend:
Frontend:
Backend TSC:
Frontend TSC:
Backend build:
Frontend build:
Browser Settings:
Browser Command Center:
```

### K --- Git

``` text
Starting HEAD:
Final HEAD:
Files changed:
New files:
Migrations:
Commit:
Pushed:
Working tree clean:
```

## 34. Documentation

Создать:

``` text
docs/prompts/PHASE_3_POST_STAGE_H_COMMAND_CENTER_WIDGET_REGISTRY_MARKETPLACE_ENRICHMENT_RECONCILIATION_REPORT.md
```

Отчёт полностью на русском.

Canonical roadmap обновить additively только после VERDICT A:

``` text
Post-Stage-H / Pre-Stage-I
Command Center Widget Registry & Marketplace Enrichment Reconciliation
→ COMPLETE
```

## 35. Out of scope

Не реализовывать:

``` text
Stage I
Stage J
Storefront billing engine
commission reversal
Employee Performance
new accounting model
AI forecasting
automatic actions
large Command Center redesign
synthetic Sessions
```

## 36. Acceptance criteria

VERDICT A только если:

1.  Все legacy Settings widgets проаудированы.
2.  Settings/runtime используют единый canonical registry/source of
    truth.
3.  Revenue/Net Revenue не возвращены без authority.
4.  Stage H Refunds amount корректно представлен в Settings, если
    customizable.
5.  Refunds amount и Refunds Processed count разделены.
6.  Marketplace Partners re-qualified.
7.  Storefront Partners re-qualified.
8.  Marketplace Buyers re-qualified.
9.  Storefront Buyers re-qualified.
10. Sessions добавлены только при authoritative source.
11. Storefront Sessions добавлены только при authoritative attribution.
12. Synthetic traffic отсутствует.
13. Каждый customizable runtime widget существует в registry/Settings.
14. Каждый Settings widget renderable/applicable.
15. IDs unique/stable.
16. RU/AZ/EN i18n PASS.
17. Mandatory Reconciliation enforced.
18. Visibility не обходит RBAC.
19. `dashboard.customize` enforced.
20. Section permissions server-side preserved.
21. Workspace/entitlement scope preserved.
22. Legacy preferences безопасно обработаны.
23. New widget defaults documented.
24. Ordering не нарушает section semantics.
25. DB/API/UI reconciliation PASS для новых metrics.
26. Performance acceptable.
27. Stage H regression PASS.
28. Decision Loop regression PASS.
29. AI Feed No-Fabrication PASS.
30. Browser Settings/Command Center interactions PASS.
31. Tests/TSC/build PASS.
32. Stage I/J не запускались.
33. Отчёт на русском.

## 37. Final verdict

Вернуть ровно один:

### VERDICT A --- COMMAND CENTER WIDGET REGISTRY RECONCILED / SETTINGS-RUNTIME SINGLE SOURCE OF TRUTH VERIFIED / MARKETPLACE ENRICHMENT CLOSED / STAGE I READY

или:

### VERDICT B --- WIDGET REGISTRY / MARKETPLACE ENRICHMENT REMEDIATION REQUIRED

Разделить gaps:

``` text
Legacy inventory:
Canonical registry:
Settings/runtime:
Revenue legacy:
Refunds:
Marketplace partners:
Storefront partners:
Marketplace buyers:
Storefront buyers:
Sessions:
RBAC:
Preferences:
Localization:
Runtime:
Performance:
Tests:
```

или:

### VERDICT C --- BLOCKED / AUTHORITATIVE DATA OR CUSTOMIZATION ARCHITECTURE GAP

## 38. STOP

После отчёта **STOP**.

Stage I/J автоматически не запускать. Дождаться review и отдельного
разрешения.
