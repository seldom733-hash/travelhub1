# PHASE 3 — POST-STAGE-J
# RUNTIME WIDGET INVENTORY & SETTINGS RECONCILIATION REMEDIATION
## COMMAND CENTER ↔ WIDGET_REGISTRY ↔ SETTINGS
## FACTUAL DOM INVENTORY / CATALOG HEALTH / CHANNEL HEALTH / STAGE I WIDGETS
## BLOCKING GATE BEFORE CRM STEP 3.5

## 1. ЯЗЫК

Все ответы разработчика, findings, таблицы, DOM evidence, root-cause analysis, implementation notes, тесты, отчёт и финальный VERDICT должны быть предоставлены **НА РУССКОМ ЯЗЫКЕ**.

Technical identifiers, code, paths, widget IDs, permission IDs, commands, SHA, API paths и commit messages можно сохранять в оригинальном виде.

## 2. ВАЖНО — ЭТО RUNTIME REMEDIATION

Предыдущие отчёты утверждали:

```text
Command Center ↔ WIDGET_REGISTRY ↔ Settings
consistent
```

Но текущий фактический UI показывает расхождение.

Этот gate обязан исходить из:

```text
ACTUAL RUNTIME DOM
```

а не из старых отчётов.

Если runtime и документация расходятся:

```text
RUNTIME TRUTH WINS
```

## 3. BLOCKING STATUS

До closure этого remediation:

```text
CRM Step 3.5 → DO NOT START / PAUSE
```

Причина:

```text
Command Center runtime/widget/settings consistency
must be trusted before leaving the domain.
```

## 4. AUTHORITATIVE RUNTIME EVIDENCE — COMMAND CENTER

Текущий фактический Command Center содержит минимум следующие KPI/cards.

### Executive / Сводные показатели

```text
GMV
Оплачено по GMV
Остаток к оплате
Исполненный GMV
Объём платежей
Заказы
Бронирования
Средний чек
Конверсия
```

### Operational / Операционная деятельность

```text
Выполненные заказы
Подтверждённые бронирования
Завершённые бронирования
Полученные платежи
Возвраты [count]
Конверсия воронки
```

### Financial / Финансы

```text
Возвраты [amount]
Комиссия
Сверка
Платежи
Чистые платежи
```

### Marketplace

```text
Сеансы Marketplace
Сеансы Storefront
Партнёры Marketplace
Партнёры Storefront
Покупатели Marketplace
Покупатели Storefront
```

### Catalog Health / Здоровье каталога

```text
Опубликованные услуги
Архивные услуги
Без продаж
Высокий спрос
Низкая конверсия
Категории
```

### Channel Health / Здоровье каналов

```text
GMV Marketplace
GMV Storefront
Выручка Marketplace
Подписки Storefront
Заказы Marketplace
Заказы Storefront
Конверсия Marketplace
Конверсия Storefront
```

## 5. AUTHORITATIVE RUNTIME EVIDENCE — SETTINGS

Фактический список Settings сейчас:

```text
GMV
Collected GMV
Outstanding
Completed GMV
Revenue
Refunds
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
Net Payments
Sessions
Storefront Sessions
Marketplace Partners
Storefront Partners
Marketplace Buyers
Storefront Buyers
```

Итого:

```text
26 visible Settings items
```

## 6. FIRST HARD FINDING

Текущее визуальное соответствие:

```text
Command Center KPI inventory
≠
Settings inventory
```

Следовательно предыдущий `VERDICT A` по полной runtime consistency должен быть **re-qualified**.

## 7. CORE OBJECTIVE

Получить фактический contract:

```text
Renderable configurable KPI
            ↕
      WIDGET_REGISTRY
            ↕
         Settings
```

с ясными исключениями только для:

```text
Decision Queue
AI Decision Feed
mandatory/non-configurable blocks
unsupported/deferred widgets
```

## 8. НЕ ПУТАТЬ KPI И BLOCKS

Следующие области **НЕ считать обычными KPI widgets** автоматически:

```text
Decision Queue
AI Decision Feed
```

Отсутствие их внутренних cards/signals в Settings допустимо.

## 9. FULL RUNTIME INVENTORY — MANDATORY

Снять фактический DOM inventory из browser runtime:

```text
section
card title
widgetId if available
value
subtitle
permission/context if detectable
```

Не строить inventory только по code arrays.

## 10. FULL SETTINGS INVENTORY — MANDATORY

Снять фактический Settings DOM inventory:

```text
display label
widgetId
section/group
visible state
hideable
removable
required
```

## 11. FULL WIDGET_REGISTRY INVENTORY — MANDATORY

Снять из backend canonical registry:

```text
widgetId
labelKey/title
section
metric mapping
permission
workspace applicability
required
removable
default visibility
supported/renderable
```

## 12. THREE-WAY DIFF

Построить:

```text
Runtime CC - Registry
Registry - Runtime CC
Settings - Registry
Registry - Settings
Runtime CC - Settings
Settings - Runtime CC
```

Каждую разницу объяснить.

## 13. CATALOG HEALTH — MANDATORY RECONCILIATION

Следующие 6 cards существуют в runtime и должны быть отдельно классифицированы:

```text
Published Services
Archived Services
Without Sales
High Demand
Low Conversion
Categories
```

Для каждой:

```text
widgetId
registry entry
settings entry
configurable?
permission
source
```

Если это обычные configurable KPI cards:

```text
добавить в Settings
```

через canonical registry.

Если intentionally non-configurable:

```text
доказать architecture reason
```

## 14. CHANNEL HEALTH — MANDATORY RECONCILIATION

Следующие 8 runtime cards:

```text
Marketplace GMV
Storefront GMV
Marketplace Revenue
Storefront Subscriptions
Marketplace Orders
Storefront Orders
Marketplace Conversion
Storefront Conversion
```

Для каждой выполнить тот же audit.

## 15. STAGE I WIDGETS — CRITICAL FINDING

Ранее Stage I сообщил implementation:

```text
storefront-mrr
storefront-arr
storefront-collected
storefront-outstanding
```

Но в текущем Command Center они визуально отсутствуют.

Для каждого определить:

```text
exists in registry?
exists in API?
exists in frontend mapping?
exists in runtime DOM?
exists in Settings?
hidden by default?
hidden by saved preference?
wrong section?
permission denied?
not rendered because mapping missing?
```

## 16. STAGE I WIDGET RESTORATION POLICY

Если widgets действительно implemented и canonical:

```text
не удалять их ради соответствия Settings.
```

Нужно:

```text
restore/enable runtime rendering
align Settings
preserve RBAC
preserve workspace scope
```

## 17. `Revenue` IN SETTINGS — CRITICAL SEMANTIC AUDIT

Current Settings:

```text
Revenue
```

Current Command Center:

```text
Объём платежей
```

Проверить mapping.

Если `Revenue` widget фактически указывает на Payment Volume, label semantic wrong.

Canonical:

```text
Payment Volume / Объём платежей
```

а не `Revenue`.

## 18. `Refunds` DUAL SEMANTICS

Сохранить:

```text
Refunds amount → Financial
Refunds Processed count → Operational
```

Это два разных widgets.

## 19. CATALOG/CHANNEL SETTINGS POLICY

Для каждого Catalog/Channel card определить:

```text
configurable = YES/NO
```

Если YES:

```text
Settings item mandatory
```

Если NO:

```text
architecture rationale mandatory
```

## 20. CHANNEL HEALTH P2 — STOREFRONT REVENUE

Known deferred finding:

```text
Channel Health "Storefront Revenue"
uses priceUsd list price
```

Текущий runtime показывает:

```text
Подписки Storefront
0 AZN
```

Проверить exact mapping и source. Нельзя просто добавить этот widget в Settings и считать closure.

## 21. CHANNEL HEALTH CURRENCY FORMATTING

Current runtime показывает:

```text
8021.95 AZN
7216.1 AZN
779.47 AZN
0 AZN
```

Привести к canonical user-facing `₼` presentation.

## 22. CHANNEL HEALTH PERCENT FORMAT

Current runtime:

```text
74.68
83.33
```

Если это conversion percentage — отображать как percent с locale-aware formatting.

## 23. SETTINGS LOCALIZATION

Current RU Settings содержит English labels. Это regression.

Все Settings labels должны быть локализованы RU/AZ/EN.

Если card = `Оплачено по GMV`, Settings RU должен использовать тот же semantic label или canonical equivalent.

## 24. SAME LABELKEY WHERE SAME METRIC

Settings и Command Center должны использовать один semantic labelKey, если это один metric.

## 25. SECTION CONSISTENCY

Для каждого widget проверить:

```text
registry section
runtime section
Settings grouping
permission section
```

## 26. SETTINGS COUNT EXPECTATION

Не hardcode total заранее.

После reconciliation вернуть:

```text
Total runtime configurable KPI cards:
Total registry configurable entries:
Total Settings items:
Intentional exceptions:
```

## 27. `qualified-gmv` LEGACY

Проверить, не влияет ли он на текущий discrepancy.

Не добавлять в Settings/runtime.

## 28. UNSUPPORTED TREND

Если registry содержит unsupported trend entry — не считать его полноценным configurable card, если он не renderable.

## 29. SHOW/HIDE — RUNTIME TEST

Для newly aligned Catalog/Channel/Stage I widgets:

```text
hide → card disappears
show → card appears
reload → preference persists
```

## 30. RBAC / WORKSPACE

Settings не может включить widget без section/data permission.

Platform aggregate widgets не должны утекать в Partner workspace.

## 31. ZERO VALUES

Legitimate zero values:

```text
Storefront Sessions = 0
Storefront Outstanding = 0 ₼
Storefront Subscriptions = 0 ₼
```

не считать absent/missing.

## 32. API PATH VALIDATION

Для каждого runtime card:

```text
widgetId → API metric path
```

должен существовать.

## 33. DB/API/UI RECONCILIATION

Обязательно:

- все 4 Stage I cards;
- все 6 Catalog Health cards;
- все 8 Channel Health cards.

Особенно проверить semantic authority `Marketplace Revenue` и `Storefront Subscriptions`.

## 34. AUTOMATED CONSISTENCY TEST

Добавить invariant:

```text
all configurable rendered cards exist in registry
all configurable registry cards appear in Settings
all Settings items map to renderable/configurable registry entries
```

с explicit exclusions list.

## 35. FULL BROWSER INVENTORY EVIDENCE

Предоставить actual DOM text dump:

```text
Command Center card titles
Settings item titles
```

после fix.

Проверить RU/AZ/EN.

## 36. RAW KEY / SYSTEM ID GATE

Runtime:

```text
raw cc.* keys = 0
raw widget IDs = 0
raw permission IDs = 0
CJK = 0
mixed locale = 0
```

## 37. NO NEW FEATURES

Не добавлять новые KPI beyond reconciliation.

Не запускать CRM Step 3.5.

## 38. REQUIRED DELIVERABLE A — RUNTIME INVENTORY

| Section | Card title | widgetId | Registry | Settings | Configurable |
|---|---|---|---:|---:|---:|

## 39. REQUIRED DELIVERABLE B — SETTINGS INVENTORY

Полный runtime Settings list RU/AZ/EN.

## 40. REQUIRED DELIVERABLE C — THREE-WAY DIFF

```text
CC - Registry:
Registry - CC:
Settings - Registry:
Registry - Settings:
CC - Settings:
Settings - CC:
```

## 41. REQUIRED DELIVERABLE D — CATALOG HEALTH

| widget | Registry | Settings | Source | DB/API/UI | Final |
|---|---:|---:|---|---:|---|

Все 6.

## 42. REQUIRED DELIVERABLE E — CHANNEL HEALTH

Та же таблица для 8 cards.

## 43. REQUIRED DELIVERABLE F — STAGE I

| widgetId | Registry | CC | Settings | API path | DB/API/UI | Final |
|---|---:|---:|---:|---|---:|---|

## 44. REQUIRED DELIVERABLE G — LABEL / FORMAT FIXES

```text
Revenue:
Payment Volume:
Refund amount:
Refund count:
Marketplace Revenue:
Storefront Subscription metric:
AZN → ₼:
percent:
locale decimals:
```

## 45. REQUIRED DELIVERABLE H — RBAC / SHOW-HIDE

Representative:

```text
Stage I widget
Catalog Health widget
Channel Health widget
Marketplace widget
Financial widget
```

с reload и negative RBAC case.

## 46. REQUIRED DELIVERABLE I — TESTS

```text
New tests:
Backend:
Frontend:
Registry:
Settings:
Command Center:
i18n:
TSC:
Build:
Browser:
```

## 47. REQUIRED DELIVERABLE J — GIT

```text
Starting HEAD:
Final HEAD:
Files changed:
Migrations:
Commit:
Pushed:
Working tree clean:
```

## 48. REPORT

Создать:

```text
docs/prompts/PHASE_3_POST_STAGE_J_RUNTIME_WIDGET_SETTINGS_RECONCILIATION_REMEDIATION_REPORT.md
```

Отчёт полностью на русском.

## 49. ACCEPTANCE CRITERIA

VERDICT A только если:

1. Actual browser Command Center inventory построен.
2. Actual browser Settings inventory построен.
3. Registry inventory построен.
4. Three-way diff выполнен.
5. All ordinary configurable KPI cards reconciled.
6. Catalog Health 6 cards explicitly resolved.
7. Channel Health 8 cards explicitly resolved.
8. Stage I 4 widgets explicitly resolved.
9. Stage I widgets appear in runtime if canonical.
10. Stage I widgets appear in Settings if configurable.
11. `Revenue` Settings semantic mismatch resolved.
12. Payment Volume label correct.
13. Refund amount/count remain distinct.
14. Channel Health monetary formatting uses canonical ₼ presentation.
15. Channel conversion cards use percent formatting.
16. Channel Health Storefront metric source audited.
17. Known priceUsd P2 preserved or minimally remediated with evidence.
18. Settings labels localized RU/AZ/EN.
19. Settings labels semantically match runtime cards.
20. Widget IDs unique.
21. API metric paths valid.
22. Unexplained registry orphan = 0.
23. Unexplained Settings orphan = 0.
24. Unexplained runtime card without registry = 0.
25. Explicit exclusions documented.
26. Show/hide works.
27. Reload persistence works.
28. RBAC cannot be bypassed.
29. Workspace scope cannot be bypassed.
30. Zero values render correctly.
31. DB/API/UI reconciliation passes for Stage I/Catalog/Channel metrics.
32. Raw keys/IDs = 0.
33. RU/AZ/EN runtime PASS.
34. Tests/TSC/build PASS.
35. CRM Step 3.5 not started/continued during this remediation.
36. Report delivered in Russian.

## 50. FINAL VERDICT

Вернуть ровно один:

### VERDICT A — POST-STAGE-J RUNTIME WIDGET INVENTORY RECONCILED / COMMAND CENTER, REGISTRY & SETTINGS FULLY ALIGNED / CRM STEP 3.5 READY

или:

### VERDICT B — RUNTIME WIDGET / SETTINGS REMEDIATION REQUIRED

Разделить:

```text
Runtime inventory:
Registry:
Settings:
Catalog Health:
Channel Health:
Stage I:
Revenue semantics:
Formatting:
RBAC:
Persistence:
Localization:
Reconciliation:
Tests:
```

или:

### VERDICT C — BLOCKED / WIDGET ARCHITECTURE OR METRIC AUTHORITY GAP

## 51. STOP

После VERDICT:

**STOP.**

CRM Step 3.5 автоматически не запускать.
