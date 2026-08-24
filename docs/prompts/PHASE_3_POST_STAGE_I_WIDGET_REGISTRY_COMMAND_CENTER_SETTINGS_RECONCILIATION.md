# PHASE 3 --- POST-STAGE-I WIDGET REGISTRY RECONCILIATION GATE

## COMMAND CENTER ↔ WIDGET_REGISTRY ↔ SETTINGS

## FINAL CARD / SETTINGS CONSISTENCY BEFORE STAGE J

------------------------------------------------------------------------

## 1. ЯЗЫК

Все ответы разработчика, findings, evidence, таблицы, отчёт и финальный
VERDICT --- **НА РУССКОМ ЯЗЫКЕ**.

Код, identifiers, paths, widget IDs, permission IDs, commands, SHA и
commit messages можно сохранять в оригинале.

------------------------------------------------------------------------

# 2. ENTRY STATUS

``` text
Stage C — WHAT                                  COMPLETE
Stage D — WHY                                   COMPLETE
Stage E — IMPACT                                COMPLETE
Stage F — ACTION                                COMPLETE
Stage G — AI Decision Feed                      COMPLETE
Stage H — Financial Enrichment                  COMPLETE
Post-H Widget Registry Reconciliation           COMPLETE
Step 3.29D — Billing Foundation                 COMPLETE
Stage I — Storefront Revenue Semantic Fix       COMPLETE

Post-Stage-I Widget Reconciliation              RUN NOW
Stage J                                         DO NOT START
```

Stage I добавил новые Storefront financial widgets, поэтому прежний
Post-H reconciliation необходимо повторно квалифицировать.

------------------------------------------------------------------------

# 3. ЦЕЛЬ

Доказать, что существует **одна canonical widget model**:

``` text
Command Center rendered widget
            ↕
      WIDGET_REGISTRY
            ↕
       Settings item
```

Ни Command Center, ни Settings не должны иметь независимый hardcoded
inventory.

------------------------------------------------------------------------

# 4. FROZEN PRINCIPLE --- SINGLE SOURCE

Canonical source:

``` text
backend WIDGET_REGISTRY
```

или фактически существующий единый registry, подтверждённый repository.

Не создавать второй registry.

------------------------------------------------------------------------

# 5. STAGE I NEW WIDGETS --- MANDATORY AUDIT

Проверить минимум:

``` text
storefront-mrr
storefront-arr
storefront-collected
storefront-outstanding
```

Для каждого подтвердить:

``` text
exists in registry
exists in Command Center
exists in Settings when customizable
correct section
correct metric mapping
correct permission
correct label
correct subtitle if applicable
correct default visibility
correct workspace scope
show/hide works
persistence works
```

------------------------------------------------------------------------

# 6. FULL INVENTORY --- NOT ONLY STAGE I

Не ограничиваться четырьмя новыми widgets.

Построить полный inventory всех Command Center widgets после Stage I.

Источник должен быть извлечён из production code/runtime, а не из
старого отчёта.

------------------------------------------------------------------------

# 7. INVENTORY A --- COMMAND CENTER

Сформировать:

  widgetId   UI label   Section   API metric path     Rendered?
  ---------- ---------- --------- ----------------- -----------

Включить все sections.

------------------------------------------------------------------------

# 8. INVENTORY B --- WIDGET_REGISTRY

Сформировать:

  ---------------------------------------------------------------------------------
  widgetId   Registry    Section   Permission      Required   Removable     Default
             title/key                                                  
  ---------- ----------- --------- ------------ ----------- ----------- -----------

  ---------------------------------------------------------------------------------

Использовать actual fields.

------------------------------------------------------------------------

# 9. INVENTORY C --- SETTINGS

Сформировать runtime Settings inventory:

  -------------------------------------------------------------------------------
  widgetId   Display          Visible      Can hide    Can remove Section/group
             label                                                
  ---------- ---------- ------------- ------------- ------------- ---------------

  -------------------------------------------------------------------------------

Не считать registry entry автоматически доказательством UI Settings
presence.

------------------------------------------------------------------------

# 10. THREE-WAY DIFF

Автоматически/детерминированно построить:

``` text
CommandCenter - Registry
Registry - CommandCenter

Settings - Registry
Registry - Settings

CommandCenter - Settings
Settings - CommandCenter
```

Для customizable widgets ожидается согласованность.

Для intentionally non-customizable/mandatory widgets документировать
исключение.

------------------------------------------------------------------------

# 11. ORPHAN DETECTION

Найти:

``` text
registry entries with no runtime widget
settings items with no runtime widget
runtime widgets with no registry
legacy widget IDs
obsolete aliases
duplicate semantic metrics
```

Каждый orphan должен быть:

``` text
removed
migrated
or explicitly justified
```

------------------------------------------------------------------------

# 12. DUPLICATE SEMANTICS

Проверить не только IDs, но и meaning.

Например недопустимо иметь два разных widget IDs, которые фактически
показывают один и тот же metric без осознанной причины.

Особенно проверить:

``` text
GMV variants
Payments
Refunds
Commission
Storefront revenue
Partners
Customers
Sessions
```

------------------------------------------------------------------------

# 13. CURRENT EXPECTED CORE INVENTORY

Предыдущий Post-H inventory содержал legacy/canonical items примерно
следующего состава:

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
Reconciliation
Payments
Refunds
Net Payments

Sessions
Storefront Sessions
Marketplace Partners
Storefront Partners
Marketplace Buyers
Storefront Buyers
```

Не считать этот список truth.

Сверить с **текущим repository/runtime**.

------------------------------------------------------------------------

# 14. LEGACY `Revenue / Net Revenue`

Повторно проверить:

``` text
Revenue
Net Revenue
```

Если они legacy и не имеют canonical metric после Stage H/I:

``` text
remove/deprecate
```

Если реально используются:

доказать semantic authority.

Не оставлять карточку только потому, что entry исторически существует.

------------------------------------------------------------------------

# 15. REFUNDS --- REVERIFY

Предыдущий defect:

``` text
refunds → executive.refunds
```

был исправлен на:

``` text
financial.totalRefunds
```

Повторно доказать:

``` text
registry mapping
Settings mapping
Command Center mapping
label
permission
```

------------------------------------------------------------------------

# 16. RECONCILIATION --- MANDATORY

Предыдущая policy:

``` text
Reconciliation
required = true
removable = false
```

Проверить, что Stage I не нарушил это.

Если hide также запрещён --- доказать runtime.

------------------------------------------------------------------------

# 17. STAGE I STOREFRONT METRICS

Expected semantics:

``` text
storefront-mrr
→ contracted recurring run-rate

storefront-arr
→ MRR × 12

storefront-collected
→ successful SubscriptionPayment event metric

storefront-outstanding
→ invoice outstanding
```

Settings labels не должны превращать эти metrics друг в друга.

------------------------------------------------------------------------

# 18. MRR VS COLLECTED LABEL CLARITY

Поскольку на текущем dataset:

``` text
MRR = 1,930 ₼
Collected = 1,930 ₼
```

совпадают численно, UI должен особенно ясно различать meaning.

Проверить RU/AZ/EN labels/subtitles.

Недопустимо:

``` text
MRR → "Получено"
Collected → "MRR"
```

------------------------------------------------------------------------

# 19. SECTION AUTHORITY

Для каждого widget проверить section.

Expected conceptual grouping:

``` text
Executive
Operational
Financial
Marketplace / Storefront
```

Не менять section только ради визуального удобства, если permission
architecture зависит от section.

------------------------------------------------------------------------

# 20. PERMISSION CONSISTENCY

Для каждого widget:

``` text
registry permission
API section permission
runtime rendering permission
Settings permission
```

должны быть совместимы.

Settings не может раскрывать existence/data widget пользователю без
server-side permission.

------------------------------------------------------------------------

# 21. ROLE DEFAULTS

Не сбросить ранее согласованные default widgets по ролям.

Проверить:

``` text
ADMIN
DIRECTOR
ANALYST
MARKETER
FINANCE
MODERATOR
SALES_MANAGER
OPERATOR
```

на базе actual current matrix.

Stage I widgets не должны автоматически появляться у всех ролей без
policy.

------------------------------------------------------------------------

# 22. PLATFORM / PARTNER SCOPE

Новые Storefront SaaS aggregate widgets относятся к PLATFORM view, если
именно так реализован Stage I.

Проверить:

``` text
Platform can see aggregate Storefront metrics
Partner cannot see platform-wide MRR/ARR
```

Registry applicability должна это отражать.

------------------------------------------------------------------------

# 23. ENTITLEMENT SCOPE

Не путать:

``` text
Storefront billing metric
```

с:

``` text
Storefront partner entitlement
```

Проверить workspace/plan gates.

------------------------------------------------------------------------

# 24. SETTINGS --- SHOW/HIDE

Для каждого customizable widget:

``` text
visible → hide → disappears
hidden → show → appears
```

Это должно менять реальный Command Center, а не только Settings state.

------------------------------------------------------------------------

# 25. PERSISTENCE

Browser/runtime test:

``` text
hide widget
reload
widget remains hidden

show widget
reload
widget remains visible
```

Проверить минимум 4 Stage I widgets и representative widgets из других
sections.

------------------------------------------------------------------------

# 26. REQUIRED / NON-REMOVABLE

Для mandatory widgets:

``` text
cannot remove
cannot bypass via malformed request
```

Если hide permitted отдельно от remove --- документировать.

Не полагаться только на disabled UI button.

------------------------------------------------------------------------

# 27. ORDERING

Если Settings поддерживает drag-and-drop/order:

проверить, что order:

``` text
persists
maps to actual Command Center order
does not duplicate/drop widgets
```

Минимум representative test.

------------------------------------------------------------------------

# 28. STALE USER PREFERENCES

Критический migration case.

Проверить сохранённые настройки, созданные до Stage I:

``` text
new widgets absent from old preference payload
legacy widget IDs present
removed widgets present
```

System должен deterministic решить:

``` text
default new widget visibility
ignore/remove obsolete IDs
preserve valid existing choices
```

------------------------------------------------------------------------

# 29. NEW WIDGET DEFAULT POLICY

Для новых:

``` text
storefront-mrr
storefront-arr
storefront-collected
storefront-outstanding
```

зафиксировать:

``` text
default visible?
for which roles?
for which workspace?
```

Не зависеть от случайного отсутствия ID в старом preference record.

------------------------------------------------------------------------

# 30. UNKNOWN WIDGET ID SECURITY

Попытка сохранить:

``` text
widgetId = arbitrary/nonexistent
```

должна быть rejected/ignored согласно API contract.

Не позволять client создавать arbitrary registry entries.

------------------------------------------------------------------------

# 31. DUPLICATE IDS

Registry должен гарантировать unique widget IDs.

Добавить/подтвердить test.

------------------------------------------------------------------------

# 32. API METRIC PATH VALIDATION

Каждый registry widget должен маппиться на реально существующий API
metric.

Не повторить старый defect:

``` text
executive.refunds
```

которого не существовало.

------------------------------------------------------------------------

# 33. ZERO VALUES

Widget с legitimate:

``` text
0
```

не должен исчезать как "missing".

Особенно:

``` text
storefront-outstanding = 0 ₼
Storefront Sessions may be 0
```

Проверить.

------------------------------------------------------------------------

# 34. NULL / UNAVAILABLE

Различать:

``` text
0
null
unavailable
permission denied
```

Settings не должен считать unavailable metric обычным zero без policy.

------------------------------------------------------------------------

# 35. SESSIONS

Ранее:

``` text
Marketplace Sessions = real BehavioralEvent
Storefront Sessions = 0
```

Повторно проверить source.

Не synthetic.

Если Storefront Sessions всё ещё 0 --- это допустимо при реальном
source.

------------------------------------------------------------------------

# 36. PARTNERS / CUSTOMERS

Проверить:

``` text
Marketplace Partners
Storefront Partners
Marketplace Buyers/Customers
Storefront Buyers/Customers
```

на current API field names.

Не допустить старого interface mismatch.

------------------------------------------------------------------------

# 37. LABEL TERMINOLOGY

Выбрать единые user-facing термины.

Например:

``` text
Marketplace Buyers
vs
Marketplace Customers
```

Registry, Settings и Command Center не должны использовать разные
бизнес-термины без причины.

------------------------------------------------------------------------

# 38. LOCALIZATION RU/AZ/EN

Для всех Settings labels и Command Center labels:

``` text
RU
AZ
EN
```

Проверить:

``` text
raw keys = 0
CJK = 0
mixed RU in AZ = 0
mixed EN in RU/AZ system labels = 0
```

Product names/data могут оставаться согласно data localization policy;
речь о system UI labels.

------------------------------------------------------------------------

# 39. STAGE I LOCALIZATION

Минимум:

``` text
MRR Storefront
ARR Storefront
Collected Storefront Revenue
Outstanding Storefront Billing
```

в RU/AZ/EN.

------------------------------------------------------------------------

# 40. SUBTITLES

Если Command Center card имеет subtitle, Settings может показывать
только title.

Но semantic meaning должен совпадать.

Проверить, что subtitle не противоречит title.

------------------------------------------------------------------------

# 41. CURRENCY DISPLAY

Stage I widgets:

``` text
₼
```

Unexpected:

``` text
$
USD
```

= 0 в runtime labels/values.

------------------------------------------------------------------------

# 42. SETTINGS UI RAW SYSTEM IDS

Settings не должен показывать:

``` text
storefront-mrr
cc.kpi.*
dashboard.financial.read
```

как user-facing label.

------------------------------------------------------------------------

# 43. COMMAND CENTER RAW SYSTEM IDS

Command Center аналогично:

``` text
raw widget IDs = 0
raw i18n keys = 0
```

------------------------------------------------------------------------

# 44. AUTOMATED CONTRACT TEST

Добавить test, который строит inventory программно и fail-ит при
рассогласовании.

Минимум:

``` text
all rendered configurable widget IDs exist in WIDGET_REGISTRY
all Settings widget IDs exist in WIDGET_REGISTRY
all required registry widgets map to valid runtime widget
registry IDs unique
```

Предпочтительно не snapshot огромного массива, а semantic assertions.

------------------------------------------------------------------------

# 45. STAGE I REGRESSION TEST

Отдельно assert:

``` text
storefront-mrr exists
storefront-arr exists
storefront-collected exists
storefront-outstanding exists
```

во всех необходимых слоях.

------------------------------------------------------------------------

# 46. BROWSER TEST MATRIX

Минимум browser runtime:

### Stage I

``` text
hide storefront-mrr
reload
verify hidden
show storefront-mrr
reload
verify visible
```

Повторить хотя бы для:

``` text
storefront-collected
storefront-outstanding
```

ARR можно покрыть automated UI test, если full browser repetition
избыточен.

### Existing

Representative:

``` text
GMV
Refunds
Operational widget
Marketplace/Session widget
```

------------------------------------------------------------------------

# 47. SETTINGS VS PERMISSION BROWSER CHECK

Под ролью без section permission:

``` text
widget unavailable in Command Center
Settings cannot enable it to bypass permission
```

Обязательный negative test.

------------------------------------------------------------------------

# 48. SETTINGS VS WORKSPACE CHECK

Под PARTNER workspace:

``` text
platform-wide Stage I aggregate widget cannot be enabled
```

если Stage I определил его PLATFORM-only.

------------------------------------------------------------------------

# 49. DB/API/UI VALUE RECONCILIATION

Этот gate прежде всего structural, но для 4 Stage I widgets подтвердить:

``` text
MRR         1,930 ₼
ARR        23,160 ₼
Collected   1,930 ₼
Outstanding     0 ₼
```

или current values на момент проверки.

Не hardcode expected dataset values в production tests.

------------------------------------------------------------------------

# 50. NO NEW FINANCIAL SEMANTICS

Этот gate **не должен менять формулы Stage I**, если не обнаружен
defect.

Если обнаружена semantic ошибка:

``` text
VERDICT B
```

и исправить минимально с evidence.

Не redesign billing.

------------------------------------------------------------------------

# 51. NO NEW FEATURES

Не добавлять:

``` text
new KPI concepts
Stage J work
new billing features
MRR forecast
refund/credit-note
VAT
Employee Performance
```

------------------------------------------------------------------------

# 52. REGRESSION

После remediation выполнить relevant full suites.

Минимум:

``` text
backend TSC
backend build
backend relevant unit
frontend TSC
frontend build
frontend tests
widget registry tests
Command Center tests
i18n tests
```

Если full suite feasible --- выполнить full suite.

------------------------------------------------------------------------

# 53. PERFORMANCE

Settings/registry reconciliation не должен добавить N+1 или отдельные
per-widget API calls.

Проверить:

``` text
Command Center request count
Settings request count
```

до/после, если production code менялся.

------------------------------------------------------------------------

# 54. REQUIRED DELIVERABLE A --- THREE INVENTORIES

Предоставить:

``` text
A. Command Center inventory
B. WIDGET_REGISTRY inventory
C. Settings inventory
```

с total count каждого.

------------------------------------------------------------------------

# 55. REQUIRED DELIVERABLE B --- DIFF

``` text
CommandCenter - Registry:
Registry - CommandCenter:
Settings - Registry:
Registry - Settings:
Duplicates:
Orphans:
Legacy:
```

------------------------------------------------------------------------

# 56. REQUIRED DELIVERABLE C --- STAGE I MATRIX

  --------------------------------------------------------------------------------------------------------
  widgetId                        CC   Registry   Settings    Metric   Permission   Localization   Runtime
                                                             mapping                             
  ------------------------ --------- ---------- ---------- --------- ------------ -------------- ---------
  storefront-mrr                                                                                 

  storefront-arr                                                                                 

  storefront-collected                                                                           

  storefront-outstanding                                                                         
  --------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 57. REQUIRED DELIVERABLE D --- REQUIRED WIDGETS

``` text
Reconciliation:
required:
removable:
hideable:
server enforcement:
```

И другие mandatory widgets, если существуют.

------------------------------------------------------------------------

# 58. REQUIRED DELIVERABLE E --- ROLE / SCOPE

``` text
Role defaults preserved:
Platform scope:
Partner scope:
Entitlements:
Permission bypass attempts:
```

------------------------------------------------------------------------

# 59. REQUIRED DELIVERABLE F --- PERSISTENCE

``` text
Stage I hide/show:
reload:
old preferences:
new widget default:
obsolete IDs:
ordering:
```

------------------------------------------------------------------------

# 60. REQUIRED DELIVERABLE G --- LOCALIZATION

``` text
RU:
AZ:
EN:
raw keys:
raw IDs:
CJK:
mixed locale:
USD/$:
```

------------------------------------------------------------------------

# 61. REQUIRED DELIVERABLE H --- TESTS

``` text
New tests:
Backend:
Frontend:
TSC:
Build:
Browser:
Negative RBAC:
Workspace isolation:
```

------------------------------------------------------------------------

# 62. REQUIRED DELIVERABLE I --- GIT

``` text
Starting HEAD:
Final HEAD:
Files changed:
Migrations:
Commit:
Pushed:
Working tree clean:
```

Если production code changes не понадобились --- так и указать.

------------------------------------------------------------------------

# 63. DOCUMENTATION

Создать:

``` text
docs/prompts/PHASE_3_POST_STAGE_I_WIDGET_REGISTRY_RECONCILIATION_REPORT.md
```

Отчёт полностью на русском.

------------------------------------------------------------------------

# 64. ROADMAP / STATUS

При VERDICT A:

``` text
Post-Stage-I Widget Registry Reconciliation → COMPLETE
Stage J → READY
```

Не объявлять Stage J complete.

------------------------------------------------------------------------

# 65. ACCEPTANCE CRITERIA

VERDICT A только если:

1.  Full current Command Center inventory построен.
2.  Full WIDGET_REGISTRY inventory построен.
3.  Runtime Settings inventory построен.
4.  Three-way diff выполнен.
5.  Command Center orphan widgets = 0.
6.  Settings orphan widgets = 0.
7.  Registry unexplained orphan widgets = 0.
8.  Duplicate widget IDs = 0.
9.  Duplicate unintended semantic widgets = 0.
10. All 4 Stage I widgets exist in required layers.
11. Stage I metric mappings correct.
12. MRR and Collected labels semantically distinct.
13. Refunds mapping remains correct.
14. Reconciliation mandatory policy preserved.
15. Sessions source remains real/non-synthetic.
16. Partners/customers mappings correct.
17. Role defaults preserved.
18. PLATFORM/PARTNER scope preserved.
19. RBAC server-side preserved.
20. Settings cannot bypass permissions.
21. Settings cannot bypass workspace scope.
22. Show/hide changes actual Command Center.
23. Reload persistence works.
24. Old preferences handled deterministically.
25. New Stage I widget defaults explicit.
26. Unknown IDs protected.
27. Zero values render correctly.
28. RU/AZ/EN labels pass.
29. Raw keys/IDs = 0.
30. Unexpected USD/\$ for Stage I widgets = 0.
31. Automated consistency contract test exists.
32. Browser representative tests pass.
33. Relevant regression passes.
34. No new financial semantics fabricated.
35. Stage J not started.

------------------------------------------------------------------------

# 66. FINAL VERDICT

Вернуть ровно один:

## VERDICT A --- POST-STAGE-I WIDGET REGISTRY RECONCILED / COMMAND CENTER & SETTINGS CONSISTENT / STAGE J READY

или:

## VERDICT B --- WIDGET REGISTRY REMEDIATION REQUIRED

Разделить gaps:

``` text
Command Center:
Registry:
Settings:
Stage I widgets:
Legacy:
Mappings:
Required widgets:
Roles:
RBAC:
Workspace:
Persistence:
Localization:
Runtime:
Tests:
```

------------------------------------------------------------------------

# 67. STOP

После VERDICT:

**STOP.**

Stage J автоматически не запускать.
