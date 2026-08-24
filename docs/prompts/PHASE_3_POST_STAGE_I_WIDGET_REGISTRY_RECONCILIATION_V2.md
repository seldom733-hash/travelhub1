# PHASE 3 --- POST-STAGE-I WIDGET REGISTRY RECONCILIATION --- V2

## COMMAND CENTER ↔ WIDGET_REGISTRY ↔ SETTINGS

## USEFULNESS + AUTHORITY REVIEW / SETTINGS-ONLY PRESERVATION

## REPLACEMENT PROMPT --- PREVIOUS RUN WAS INTERRUPTED

------------------------------------------------------------------------

# 1. ЯЗЫК

Все ответы разработчика, findings, evidence, таблицы, implementation
report и финальный VERDICT --- **НА РУССКОМ ЯЗЫКЕ**.

Код, identifiers, paths, widget IDs, permission IDs, commands, SHA и
commit messages можно сохранять в оригинале.

------------------------------------------------------------------------

# 2. ВАЖНО --- ЭТОТ PROMPT ЗАМЕНЯЕТ ПРЕДЫДУЩИЙ

Предыдущий:

``` text
PHASE_3_POST_STAGE_I_WIDGET_REGISTRY_COMMAND_CENTER_SETTINGS_RECONCILIATION
```

был остановлен до завершения.

Его результат:

``` text
NOT ACCEPTED
NOT A COMPLETED GATE
NO VERDICT
```

Этот V2 является authoritative replacement.

------------------------------------------------------------------------

# 3. FIRST GATE --- INTERRUPTED RUN WORKTREE AUDIT

До любых новых изменений:

``` bash
git status
git diff
git diff --cached
git log -5 --oneline
```

Зафиксировать:

``` text
Current HEAD:
origin/master:
Modified files:
Untracked files:
Staged files:
Commits created by interrupted run:
```

Не выполнять автоматически:

``` text
git reset --hard
git clean -fd
revert
checkout .
```

Сначала классифицировать изменения.

------------------------------------------------------------------------

# 4. INTERRUPTED CHANGES CLASSIFICATION

Каждое изменение предыдущего запуска классифицировать:

``` text
KEEP
REWORK
DISCARD
UNKNOWN
```

Критерии:

``` text
KEEP    → соответствует этому V2 и canonical architecture
REWORK  → идея корректна, реализация неполная/неверная
DISCARD → противоречит V2
UNKNOWN → недостаточно evidence
```

Никакие пользовательские/предыдущие корректные изменения не терять.

------------------------------------------------------------------------

# 5. ENTRY STATUS

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

Post-Stage-I Widget Reconciliation V2           RUN NOW
Stage J                                         DO NOT START
```

------------------------------------------------------------------------

# 6. ЦЕЛЬ

Создать и доказать одну согласованную модель:

``` text
Command Center
      ↕
WIDGET_REGISTRY
      ↕
Settings
```

Но согласование **НЕ означает механическое удаление всего, чего сейчас
нет в Command Center**.

------------------------------------------------------------------------

# 7. КРИТИЧЕСКИЙ FROZEN PRINCIPLE

## SETTINGS-ONLY ≠ ORPHAN

Если widget существует в Settings/registry, но отсутствует в Command
Center:

``` text
НЕ УДАЛЯТЬ АВТОМАТИЧЕСКИ.
```

Сначала выполнить:

``` text
USEFULNESS REVIEW
        ↓
AUTHORITY REVIEW
        ↓
SEMANTIC UNIQUENESS REVIEW
        ↓
DECISION
```

------------------------------------------------------------------------

# 8. SETTINGS-ONLY DECISION TREE

Для каждого Settings-only widget:

``` text
1. Полезен ли KPI для управленческого решения?
2. Есть ли authoritative real data source?
3. Не дублирует ли он существующий KPI?
4. Есть ли корректная section placement?
5. Есть ли permission/workspace authority?
```

Результат:

``` text
USEFUL + AUTHORITATIVE + UNIQUE
→ ADD/ENABLE IN COMMAND CENTER
→ KEEP IN WIDGET_REGISTRY
→ KEEP IN SETTINGS

DUPLICATE
→ merge/deprecate with evidence

NOT USEFUL
→ deprecate/remove with rationale

NO AUTHORITY
→ do not fabricate;
  classify as blocked/deferred
```

------------------------------------------------------------------------

# 9. VERDICT A PROHIBITION

VERDICT A запрещён, если разработчик просто:

``` text
Settings-only → orphan → delete
```

без usefulness/authority review.

------------------------------------------------------------------------

# 10. PREVIOUSLY AGREED USEFUL CANDIDATES

Следующие widgets уже были определены как потенциально полезные и
требуют **preserve/include-first review**, а не deletion-first:

``` text
Sessions
Storefront Sessions

Marketplace Partners
Storefront Partners

Marketplace Buyers / Marketplace Customers
Storefront Buyers / Storefront Customers

Refunds — amount
Refunds Processed — count
```

Для них требуется повышенный стандарт evidence перед removal.

------------------------------------------------------------------------

# 11. SESSIONS

Ранее подтверждался реальный source:

``` text
BehavioralEvent
```

Проверить заново текущий repository/runtime.

Если authority сохранилась:

``` text
Sessions → должен быть доступен как реальный KPI
```

Не synthetic.

------------------------------------------------------------------------

# 12. STOREFRONT SESSIONS

Нулевое значение:

``` text
0
```

не является основанием для удаления.

Если source реальный, widget полезен и semantic корректен:

``` text
0 = legitimate business value
```

------------------------------------------------------------------------

# 13. MARKETPLACE PARTNERS

Проверить authoritative DB source.

Если real:

``` text
Marketplace Partners
```

сохранить/включить в Command Center.

Определить:

``` text
total?
active?
period?
snapshot?
```

Label должен отражать формулу.

------------------------------------------------------------------------

# 14. STOREFRONT PARTNERS

Аналогично:

``` text
Storefront Partners
```

Проверить:

``` text
workspace/partner authority
active semantics
snapshot semantics
```

------------------------------------------------------------------------

# 15. MARKETPLACE CUSTOMERS / BUYERS

Ранее существовало терминологическое расхождение:

``` text
Buyers
Customers
```

Определить canonical business term.

Не создавать две карточки для одного metric.

------------------------------------------------------------------------

# 16. STOREFRONT CUSTOMERS / BUYERS

То же правило:

``` text
one metric
one widget ID
one canonical user-facing term
```

если semantics одинаковы.

------------------------------------------------------------------------

# 17. REFUNDS --- TWO DIFFERENT METRICS

Обязательно сохранить semantic distinction:

``` text
Refunds
→ monetary amount
→ financial metric

Refunds Processed
→ count
→ operational metric
```

Это **НЕ duplicates**.

------------------------------------------------------------------------

# 18. REFUNDS AMOUNT

Проверить current mapping.

Ранее defect:

``` text
executive.refunds
```

был исправлен на:

``` text
financial.totalRefunds
```

Повторно доказать.

------------------------------------------------------------------------

# 19. REFUNDS PROCESSED

Проверить count authority:

``` text
number of processed refunds
```

Не подменять monetary amount.

------------------------------------------------------------------------

# 20. STAGE I NEW WIDGETS

Обязательная проверка:

``` text
storefront-mrr
storefront-arr
storefront-collected
storefront-outstanding
```

Они уже реализованы Stage I и не являются Settings-only candidates.

Для каждого:

``` text
Command Center
Registry
Settings if customizable
mapping
permission
section
scope
localization
persistence
```

------------------------------------------------------------------------

# 21. STAGE I SEMANTICS

``` text
storefront-mrr
→ recurring run-rate from SubscriptionContract

storefront-arr
→ MRR × 12

storefront-collected
→ successful SubscriptionPayment

storefront-outstanding
→ invoice outstanding
```

Не менять formulas в этом gate без обнаруженного defect.

------------------------------------------------------------------------

# 22. MRR ≠ COLLECTED

Даже если current dataset:

``` text
MRR = 1,930 ₼
Collected = 1,930 ₼
```

они должны иметь разные labels/subtitles.

Числовое совпадение не означает semantic duplication.

------------------------------------------------------------------------

# 23. FULL CURRENT INVENTORY

Не использовать старый список как truth.

Из текущего production code/runtime построить:

``` text
A. Command Center widgets
B. WIDGET_REGISTRY entries
C. Settings widgets
```

------------------------------------------------------------------------

# 24. INVENTORY A --- COMMAND CENTER

  widgetId   Label   Section   API metric     Rendered Scope
  ---------- ------- --------- ------------ ---------- -------

------------------------------------------------------------------------

# 25. INVENTORY B --- REGISTRY

  --------------------------------------------------------------------------------------
  widgetId   labelKey   Section   Permission     Required   Removable    Default Scope
  ---------- ---------- --------- ------------ ---------- ----------- ---------- -------

  --------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 26. INVENTORY C --- SETTINGS

  widgetId   Display label     Visible   Hideable   Removable Group
  ---------- --------------- --------- ---------- ----------- -------

Runtime evidence required.

------------------------------------------------------------------------

# 27. FOUR-WAY CLASSIFICATION

Каждый registry/settings widget классифицировать:

``` text
A — ACTIVE_CANONICAL
B — USEFUL_TO_ADD_TO_COMMAND_CENTER
C — INTENTIONAL_SETTINGS_CONTROL
D — DUPLICATE
E — LEGACY_OBSOLETE
F — BLOCKED_NO_AUTHORITY
G — REQUIRED_MANDATORY
```

------------------------------------------------------------------------

# 28. CATEGORY B IS IMPORTANT

`B — USEFUL_TO_ADD_TO_COMMAND_CENTER` означает:

``` text
НЕ удалять.
```

В рамках этого gate реализовать его в Command Center, если:

``` text
source already exists
formula is clear
scope/permission known
implementation is bounded
```

------------------------------------------------------------------------

# 29. BLOCKED_NO_AUTHORITY

Если widget полезен, но real source отсутствует:

``` text
не fabricate
не удалять silently
```

Вернуть:

``` text
DEFERRED / BLOCKED_NO_AUTHORITY
```

и rationale.

Если такой widget критичен для agreed Command Center --- VERDICT может
быть B.

------------------------------------------------------------------------

# 30. LEGACY REVENUE / NET REVENUE

Проверить:

``` text
Revenue
Net Revenue
```

Не сохранять только из-за historical registry entry.

После Stage H/I существуют более точные financial metrics.

Если Revenue/Net Revenue не имеют отдельной canonical authority:

``` text
E — LEGACY_OBSOLETE
```

с evidence.

------------------------------------------------------------------------

# 31. NO DUPLICATE FINANCIAL TRUTH

Проверить:

``` text
GMV
Collected GMV
Outstanding
Completed GMV
Payment Volume
Refunds
Net Payments
Commission
Storefront MRR
Storefront ARR
Storefront Collected
Storefront Outstanding
```

Каждый должен иметь distinct semantics.

------------------------------------------------------------------------

# 32. FULL THREE-WAY DIFF

После usefulness classification построить:

``` text
CommandCenter - Registry
Registry - CommandCenter
Settings - Registry
Registry - Settings
CommandCenter - Settings
Settings - CommandCenter
```

Но diff сам по себе не определяет deletion.

------------------------------------------------------------------------

# 33. EXPLAIN EVERY DIFFERENCE

Каждая строка diff должна иметь:

``` text
classification
reason
action
evidence
```

------------------------------------------------------------------------

# 34. COMMAND CENTER PLACEMENT REVIEW

Для Category B widgets определить section:

``` text
Executive
Operational
Financial
Marketplace
Storefront / Marketplace context
```

Использовать существующую architecture.

------------------------------------------------------------------------

# 35. CARD DENSITY

Не добавлять полезный KPI в Executive только потому, что он полезен.

Проверить:

``` text
decision value
section fit
density
```

------------------------------------------------------------------------

# 36. PARTNERS / CUSTOMERS SECTION

Предпочтительно Marketplace/Storefront analytical section, если current
architecture это поддерживает.

Не менять permission hierarchy без необходимости.

------------------------------------------------------------------------

# 37. SESSIONS SECTION

Sessions --- engagement/marketplace metric.

Разместить в наиболее подходящей существующей section.

Не создавать новую section только ради двух cards без необходимости.

------------------------------------------------------------------------

# 38. OPERATIONAL COUNT VS MONEY

Сохранять ранее обсуждённый принцип:

``` text
Operational cards primarily show operational counts/status.
Financial amounts live in financial/executive context unless amount materially improves operational decision.
```

Не дублировать суммы без необходимости.

------------------------------------------------------------------------

# 39. SINGLE REGISTRY SOURCE

Settings и Command Center должны использовать canonical registry
metadata.

Не создавать:

``` text
SETTINGS_WIDGETS
COMMAND_CENTER_WIDGETS
```

как независимые hardcoded lists.

------------------------------------------------------------------------

# 40. API METRIC PATH CONTRACT

Для каждого active/add widget доказать:

``` text
registry widgetId
→ valid API field
→ runtime card
```

No dead mapping.

------------------------------------------------------------------------

# 41. REQUIRED RECONCILIATION WIDGET

Ранее:

``` text
Reconciliation
required = true
removable = false
```

Повторно проверить.

Не нарушать.

------------------------------------------------------------------------

# 42. ZERO VALUES

Legitimate zero must render:

``` text
Storefront Sessions = 0
Storefront Outstanding = 0 ₼
```

Не считать missing.

------------------------------------------------------------------------

# 43. NULL VS ZERO

Различать:

``` text
0
null
not available
not authorized
```

------------------------------------------------------------------------

# 44. ROLE DEFAULTS

Проверить current roles:

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

Не выдавать новые cards всем ролям автоматически.

------------------------------------------------------------------------

# 45. ROLE DEFAULT DECISION FOR CATEGORY B

Для каждого нового полезного widget определить:

``` text
default roles
```

на базе business relevance.

Admin может управлять доступом согласно existing architecture.

------------------------------------------------------------------------

# 46. RBAC

Registry visibility не является security boundary.

Server-side section/data authority mandatory.

------------------------------------------------------------------------

# 47. PLATFORM VS PARTNER

Platform aggregate metrics:

``` text
Marketplace Partners
Storefront Partners
Marketplace Customers
Storefront Customers
Storefront MRR/ARR
```

не должны утекать в individual partner workspace без policy.

------------------------------------------------------------------------

# 48. ENTITLEMENTS

Сохранить:

``` text
Marketplace Basic
Storefront Pro
```

и current workspace capability gates.

------------------------------------------------------------------------

# 49. SETTINGS SHOW/HIDE

Для каждого customizable active widget:

``` text
show
hide
```

должно реально влиять на Command Center.

------------------------------------------------------------------------

# 50. PERSISTENCE

Test:

``` text
hide
reload
still hidden

show
reload
still visible
```

------------------------------------------------------------------------

# 51. CATEGORY B NEW CARD PERSISTENCE

Если в рамках V2 добавляются cards из Settings:

обязательно проверить их show/hide + reload.

------------------------------------------------------------------------

# 52. OLD USER PREFERENCES

Проверить preferences до Stage I/V2.

Новые widget IDs должны иметь deterministic default.

Legacy IDs не должны ломать page.

------------------------------------------------------------------------

# 53. UNKNOWN IDS

Malformed/unknown widget IDs:

``` text
reject or safely ignore
```

по contract.

------------------------------------------------------------------------

# 54. ORDERING

Если drag-and-drop поддерживается:

``` text
reorder
reload
same order
```

и no duplicates.

------------------------------------------------------------------------

# 55. LOCALIZATION

Все active/new widgets:

``` text
RU
AZ
EN
```

Проверить Settings и Command Center.

------------------------------------------------------------------------

# 56. RAW SYSTEM TEXT

Expected:

``` text
raw cc.kpi.* = 0
raw widget IDs = 0
raw permission IDs = 0
CJK = 0
```

в user-facing UI.

------------------------------------------------------------------------

# 57. TERMINOLOGY

Согласовать:

``` text
Customers vs Buyers
Partners
Sessions
Refunds
MRR
ARR
Collected
Outstanding
```

между Settings и Command Center.

------------------------------------------------------------------------

# 58. CURRENCY

Financial cards:

``` text
AZN / ₼
```

согласно existing display policy.

Stage I Storefront billing:

``` text
unexpected USD/$ = 0
```

------------------------------------------------------------------------

# 59. AUTOMATED CONSISTENCY CONTRACT TEST

Добавить/усилить test:

``` text
registry IDs unique
all active rendered widgets registered
all Settings controls registered
all active registry metric paths valid
all required widgets enforced
```

------------------------------------------------------------------------

# 60. USEFULNESS CLASSIFICATION TEST

Предпочтительно создать explicit metadata/status вместо brittle test,
если architecture позволяет.

Но не overengineer production solely for test.

Отчёт должен содержать classification независимо.

------------------------------------------------------------------------

# 61. BROWSER --- STAGE I

Проверить минимум:

``` text
storefront-mrr hide/show/reload
storefront-collected hide/show/reload
storefront-outstanding zero rendering
```

------------------------------------------------------------------------

# 62. BROWSER --- CATEGORY B

Для каждого newly-added useful Settings widget выполнить runtime
verification.

Минимум representative:

``` text
Sessions
one Partner card
one Customer card
Refunds/Refunds Processed if newly surfaced
```

------------------------------------------------------------------------

# 63. BROWSER --- NEGATIVE RBAC

Role without permission:

``` text
cannot display restricted widget
cannot enable via Settings
```

------------------------------------------------------------------------

# 64. BROWSER --- WORKSPACE ISOLATION

Partner workspace:

``` text
cannot enable platform aggregate widget
```

------------------------------------------------------------------------

# 65. CURRENT VALUES ARE NOT HARD CONTRACT

Current dataset values могут меняться.

Не hardcode:

``` text
MRR 1930
ARR 23160
```

в production logic.

Использовать DB/API reconciliation.

------------------------------------------------------------------------

# 66. DB/API/UI RECONCILIATION

Для всех newly-added Category B cards:

``` text
DB = API = UI
```

Для Stage I cards --- representative recheck.

------------------------------------------------------------------------

# 67. SESSIONS AUTHORITY EVIDENCE

Вернуть:

``` text
source table/model:
event filter:
marketplace/storefront attribution:
period:
DB value:
API:
UI:
```

------------------------------------------------------------------------

# 68. PARTNERS AUTHORITY EVIDENCE

Для Marketplace/Storefront:

``` text
source:
status filter:
snapshot/period:
DB:
API:
UI:
```

------------------------------------------------------------------------

# 69. CUSTOMERS AUTHORITY EVIDENCE

Аналогично.

Не смешивать customer counts между marketplace/storefront.

------------------------------------------------------------------------

# 70. REFUNDS EVIDENCE

Вернуть отдельно:

``` text
Refund amount:
source:
formula:
DB/API/UI:

Refund processed count:
source:
formula:
DB/API/UI:
```

------------------------------------------------------------------------

# 71. NO SYNTHETIC DATA

Запрещено добавлять fake values только чтобы cards не были zero.

------------------------------------------------------------------------

# 72. NO NEW BUSINESS METRICS WITHOUT REVIEW

Если разработчик обнаружит ещё Settings-only widget, который кажется
полезным:

классифицировать по decision tree.

Можно добавить только при clear authority и bounded implementation.

------------------------------------------------------------------------

# 73. NO STAGE J

Не выполнять:

``` text
Stage J
```

даже если V2 PASS.

------------------------------------------------------------------------

# 74. REGRESSION

Минимум:

``` text
backend TSC
backend build
backend relevant tests
frontend TSC
frontend build
frontend tests
Command Center tests
Settings tests
registry tests
i18n tests
```

Full suite --- если feasible.

------------------------------------------------------------------------

# 75. PERFORMANCE

Не создавать per-card API calls.

Проверить Command Center request behavior после добавления Category B
cards.

------------------------------------------------------------------------

# 76. REQUIRED DELIVERABLE A --- INTERRUPTED RUN

``` text
HEAD before V2:
origin:
dirty files:
previous-run changes:
KEEP:
REWORK:
DISCARD:
```

------------------------------------------------------------------------

# 77. REQUIRED DELIVERABLE B --- FULL INVENTORIES

``` text
Command Center total:
Registry total:
Settings total:
```

-   полные таблицы.

------------------------------------------------------------------------

# 78. REQUIRED DELIVERABLE C --- SETTINGS-ONLY REVIEW

  --------------------------------------------------------------------------------
  widgetId         Useful?    Authority?       Unique? Classification   Decision
  ---------- ------------- ------------- ------------- ---------------- ----------

  --------------------------------------------------------------------------------

**Обязательно для каждого Settings-only item.**

------------------------------------------------------------------------

# 79. REQUIRED DELIVERABLE D --- AGREED CANDIDATES

  Candidate                      Authority     Before CC?   After CC? Decision
  ------------------------------ ----------- ------------ ----------- ----------
  Sessions                                                            
  Storefront Sessions                                                 
  Marketplace Partners                                                
  Storefront Partners                                                 
  Marketplace Customers/Buyers                                        
  Storefront Customers/Buyers                                         
  Refunds amount                                                      
  Refunds Processed count                                             

------------------------------------------------------------------------

# 80. REQUIRED DELIVERABLE E --- STAGE I

  ------------------------------------------------------------------------------------------------
  widgetId                        CC   Registry   Settings   Mapping     Scope      i18n   Runtime
  ------------------------ --------- ---------- ---------- --------- --------- --------- ---------
  storefront-mrr                                                                         

  storefront-arr                                                                         

  storefront-collected                                                                   

  storefront-outstanding                                                                 
  ------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 81. REQUIRED DELIVERABLE F --- DIFF

``` text
CommandCenter - Registry:
Registry - CommandCenter:
Settings - Registry:
Registry - Settings:
Duplicates:
Legacy:
Blocked:
```

------------------------------------------------------------------------

# 82. REQUIRED DELIVERABLE G --- RBAC / SCOPE

``` text
Role defaults:
Platform:
Partner:
Entitlements:
Settings bypass:
Unknown IDs:
```

------------------------------------------------------------------------

# 83. REQUIRED DELIVERABLE H --- PERSISTENCE

``` text
Existing widgets:
Stage I:
New Category B:
reload:
ordering:
old preferences:
```

------------------------------------------------------------------------

# 84. REQUIRED DELIVERABLE I --- LOCALIZATION

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

# 85. REQUIRED DELIVERABLE J --- RECONCILIATION

Для newly surfaced cards:

``` text
DB:
API:
UI:
PASS:
```

------------------------------------------------------------------------

# 86. REQUIRED DELIVERABLE K --- TESTS

``` text
New tests:
Backend:
Frontend:
TSC:
Build:
Browser:
RBAC:
Workspace:
Performance:
```

------------------------------------------------------------------------

# 87. REQUIRED DELIVERABLE L --- GIT

``` text
Starting HEAD:
Final HEAD:
Files changed:
Migrations:
Commit:
Pushed:
Working tree clean:
```

------------------------------------------------------------------------

# 88. REPORT

Создать:

``` text
docs/prompts/PHASE_3_POST_STAGE_I_WIDGET_REGISTRY_RECONCILIATION_V2_REPORT.md
```

Отчёт полностью на русском.

------------------------------------------------------------------------

# 89. ACCEPTANCE CRITERIA

VERDICT A только если:

1.  Interrupted-run worktree audited.
2.  No correct prior work lost.
3.  Full current CC inventory built.
4.  Full registry inventory built.
5.  Runtime Settings inventory built.
6.  Every Settings-only widget reviewed for usefulness.
7.  Every Settings-only widget reviewed for authority.
8.  Settings-only was NOT treated as automatic orphan.
9.  Useful + authoritative + unique candidates were added/enabled in
    Command Center.
10. Previously agreed Sessions candidate explicitly resolved.
11. Storefront Sessions explicitly resolved; zero not treated as
    absence.
12. Marketplace Partners explicitly resolved.
13. Storefront Partners explicitly resolved.
14. Marketplace Customers/Buyers explicitly resolved.
15. Storefront Customers/Buyers explicitly resolved.
16. Refund amount preserved as financial metric.
17. Refund processed count preserved as distinct operational metric.
18. Revenue/Net Revenue legacy status evidence-based.
19. All 4 Stage I widgets aligned across layers.
20. MRR ≠ Collected semantics preserved.
21. Registry remains single source.
22. Unexplained Command Center orphans = 0.
23. Unexplained Settings orphans = 0.
24. Duplicate IDs = 0.
25. Unintended semantic duplicates = 0.
26. All active metric paths valid.
27. Reconciliation mandatory policy preserved.
28. Zero values render.
29. Role defaults preserved.
30. RBAC server-side preserved.
31. Settings cannot bypass RBAC.
32. Platform/Partner scope preserved.
33. Settings cannot bypass workspace scope.
34. Show/hide works.
35. Reload persistence works.
36. Old preferences handled.
37. New widget defaults explicit.
38. RU/AZ/EN PASS.
39. Raw keys/IDs = 0.
40. Stage I USD/\$ leakage = 0.
41. Newly-added cards DB/API/UI reconcile.
42. No synthetic data.
43. No fabricated metrics.
44. Tests/TSC/build PASS.
45. Stage J not started.

------------------------------------------------------------------------

# 90. FINAL VERDICT

Вернуть ровно один:

## VERDICT A --- POST-STAGE-I WIDGET REGISTRY V2 RECONCILED / USEFUL SETTINGS WIDGETS PRESERVED OR SURFACED / COMMAND CENTER & SETTINGS CONSISTENT / STAGE J READY

или:

## VERDICT B --- POST-STAGE-I WIDGET REGISTRY V2 REMEDIATION REQUIRED

Разделить:

``` text
Interrupted run:
Command Center:
Registry:
Settings:
Settings-only review:
Useful candidates:
Stage I widgets:
Legacy:
Mappings:
RBAC:
Workspace:
Persistence:
Localization:
Reconciliation:
Tests:
```

------------------------------------------------------------------------

# 91. STOP

После VERDICT:

**STOP.**

Stage J автоматически не запускать.
