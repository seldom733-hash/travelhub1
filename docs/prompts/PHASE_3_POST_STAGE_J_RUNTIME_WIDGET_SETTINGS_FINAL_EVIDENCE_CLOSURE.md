# PHASE 3 — POST-STAGE-J
# RUNTIME WIDGET & SETTINGS — FINAL EVIDENCE CLOSURE
## BROWSER DOM → SHOW/HIDE PERSISTENCE → GIT CLOSURE
## MINIMAL CLOSURE GATE BEFORE CRM STEP 3.5

---

# 1. ЯЗЫК

Все ответы разработчика, evidence, findings, таблицы, browser/runtime результаты,
Git closure и финальный VERDICT — **НА РУССКОМ ЯЗЫКЕ**.

Technical identifiers, widget IDs, commands, paths, SHA и commit messages можно
оставлять в оригинале.

---

# 2. КОНТЕКСТ

Основной remediation уже выполнен локально и сообщил:

```text
Catalog Health (6 cards)     → added/aligned
Channel Health (8 cards)     → added/aligned
Stage I (4 widgets)          → added to defaultWidgets
Revenue semantic             → Revenue → Payment Volume
Formatting                   → KpiCard currency/percent formatting
RU/AZ/EN i18n                → added
Registry                     → 48 entries
Visible KPI cards            → 45
Available trend widgets      → 3
Unexplained orphans          → 0
Tests                        → 70/70 PASS
TSC                          → 0 errors
```

Но финальный closure пока недостаточно доказан.

Не повторять основной remediation и не переписывать production code без
обнаруженного runtime defect.

---

# 3. CURRENT STATUS

Текущий provisional status:

```text
Implementation reconciliation       ✅
Registry reconciliation             ✅
Automated tests                     ✅
TSC                                 ✅

Actual browser DOM acceptance       NOT YET PROVEN
Show/hide persistence               NOT YET PROVEN
Git closure                         NOT YET CLOSED
```

Поэтому этот prompt является **минимальным evidence closure gate**.

---

# 4. BLOCKING RULE

До успешного завершения этого gate:

```text
CRM Step 3.5 → DO NOT START
```

После VERDICT A:

```text
CRM Step 3.5 → READY
```

Но автоматически его не запускать.

---

# 5. FIRST — WORKTREE SAFETY

До любых действий выполнить:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git diff --stat
git diff
```

Зафиксировать:

```text
Starting HEAD:
origin/master:
Working tree:
Modified files:
Untracked files:
```

Не терять текущие remediation changes.

---

# 6. NO BLIND CODE CHANGES

Если browser evidence проходит:

```text
production code changes = NONE beyond already completed remediation
```

Если browser обнаруживает дефект:

1. зафиксировать exact defect;
2. выполнить только минимальное исправление;
3. повторить affected tests;
4. повторить browser evidence.

---

# 7. START RUNTIME

Запустить актуальные backend/frontend приложения в обычном development/runtime
режиме проекта.

Проверить:

```text
backend healthy
frontend healthy
authenticated session available
Command Center loads
Settings loads
```

---

# 8. BROWSER DOM INVENTORY — COMMAND CENTER

Снять фактический browser DOM inventory после remediation.

Вернуть таблицу:

| Section | Runtime card title | widgetId if available | Visible |
|---|---|---|---:|

Обязательно проверить:

```text
Executive
Operational
Financial
Marketplace
Catalog Health
Channel Health
Storefront Revenue / Stage I widgets
```

---

# 9. EXPECTED CATALOG HEALTH — 6/6

В browser DOM должны присутствовать canonical cards:

```text
Опубликованные услуги
Архивные услуги
Без продаж
Высокий спрос
Низкая конверсия
Категории
```

Для RU locale:

```text
6/6 visible when enabled
```

---

# 10. EXPECTED CHANNEL HEALTH — 8/8

Проверить:

```text
GMV Marketplace
GMV Storefront
Выручка Marketplace / canonical reconciled label
Подписки Storefront / canonical reconciled label
Заказы Marketplace
Заказы Storefront
Конверсия Marketplace
Конверсия Storefront
```

Если remediation изменил canonical labels — использовать фактические
reconciled semantic labels и явно их указать.

---

# 11. EXPECTED STAGE I — 4/4

В actual browser DOM найти:

```text
storefront-mrr
storefront-arr
storefront-collected
storefront-outstanding
```

и их localized titles.

Вернуть:

| widgetId | RU title | Runtime value | Visible |
|---|---|---:|---:|

Все canonical Stage I widgets должны быть реально renderable.

---

# 12. SETTINGS DOM INVENTORY

Открыть Settings в браузере.

Снять фактический DOM inventory:

```text
title
widgetId if available
visibility state
required/removable state
```

Не использовать только backend registry dump.

---

# 13. COMMAND CENTER ↔ SETTINGS DOM DIFF

После remediation выполнить фактический browser-level diff.

Вернуть:

```text
Configurable CC cards missing in Settings:
Settings items without configurable CC card:
Intentional exceptions:
```

Acceptance:

```text
unexplained CC → Settings orphans = 0
unexplained Settings → CC orphans = 0
```

---

# 14. REGISTRY COUNT RECONCILIATION

Подтвердить фактические заявленные числа:

```text
Registry entries:              48
Visible KPI cards:             45
Available trend widgets:        3
```

Если actual counts отличаются:

не подгонять их под отчёт.

Объяснить реальную структуру и определить, является ли отличие defect.

---

# 15. EXPLICIT EXCEPTIONS

Не считать обычными configurable KPI:

```text
Decision Queue
AI Decision Feed
unsupported/non-rendered trend entries
other explicitly documented non-configurable blocks
```

Любое другое исключение должно быть названо явно.

---

# 16. SETTINGS LOCALIZATION — RU

В русском Settings не должно оставаться:

```text
Collected GMV
Outstanding
Completed GMV
Payment Volume
Orders
Bookings
...
```

если для них существуют RU labels.

Проверить фактический DOM.

Acceptance:

```text
English widget labels in RU Settings = 0
raw i18n keys = 0
```

Исключения только для universally accepted identifiers вроде `GMV`, `MRR`, `ARR`,
если именно это canonical UI policy.

---

# 17. SETTINGS LOCALIZATION — AZ

Проверить representative полный список.

Acceptance:

```text
RU fragments = 0
raw i18n keys = 0
CJK = 0
```

---

# 18. SETTINGS LOCALIZATION — EN

Проверить:

```text
raw i18n keys = 0
RU/AZ fragments = 0
```

---

# 19. PAYMENT VOLUME SEMANTIC EVIDENCE

В Settings и Command Center проверить фактический label.

Ожидаемый semantic contract:

```text
metric = Payment Volume
RU = Объём платежей
```

Не должно быть старого ошибочного mapping:

```text
Revenue → Payment Volume
```

как semantic alias.

---

# 20. REFUNDS DUAL SEMANTICS

В browser подтвердить различие:

```text
Operational:
Возвраты / Refunds Processed → count

Financial:
Возвраты / Refund amount → currency
```

Settings должен позволять однозначно понять, какой widget управляется.

Если два одинаковых display labels создают ambiguity — это defect и требуется
минимальное label remediation.

---

# 21. CURRENCY FORMAT — CHANNEL HEALTH

Проверить actual DOM.

Не должно быть presentation вида:

```text
8021.95 AZN
7216.1 AZN
```

Ожидается canonical locale-aware presentation с:

```text
₼
```

---

# 22. PERCENT FORMAT — CHANNEL HEALTH

Не должно быть bare:

```text
74.68
83.33
```

для conversion percentage.

Должен присутствовать `%` и locale-aware formatting.

---

# 23. STAGE I CURRENCY FORMAT

MRR / ARR / Collected / Outstanding:

```text
currency authority = AZN
UI = ₼
```

---

# 24. SHOW/HIDE REPRESENTATIVE MATRIX

Не требуется вручную переключать все 45 cards.

Проверить representative matrix минимум:

| Domain | Representative widget |
|---|---|
| Executive | GMV |
| Financial | Net Payments или Refund amount |
| Marketplace | Marketplace Partners |
| Catalog Health | Published Services |
| Channel Health | Marketplace GMV |
| Stage I | Storefront MRR |

---

# 25. HIDE TEST

Для каждого representative widget:

```text
1. card visible in Command Center
2. open Settings
3. hide widget
4. return/open Command Center
5. card absent
```

Зафиксировать PASS/FAIL.

---

# 26. HIDE PERSISTENCE

После hide:

```text
reload page
```

Acceptance:

```text
card remains hidden
```

---

# 27. SHOW TEST

После этого:

```text
1. enable/show widget in Settings
2. return to Command Center
3. card visible
```

---

# 28. SHOW PERSISTENCE

После show:

```text
reload
```

Acceptance:

```text
card remains visible
```

---

# 29. REQUIRED WIDGET

Проверить:

```text
Reconciliation
required = true
removable = false
```

В Settings пользователь не должен иметь возможность удалить mandatory widget.

---

# 30. RBAC NEGATIVE TEST

Representative restricted role:

проверить, что Settings не позволяет получить card/data, для которой отсутствует
server-side permission.

Frontend hide/show не является security authority.

---

# 31. WORKSPACE NEGATIVE TEST

Если доступен Partner workspace:

проверить, что Platform aggregate widgets не появляются только потому, что
пользователь манипулировал Settings/preferences.

---

# 32. ZERO VALUE TEST

Проверить хотя бы один legitimate zero widget, например:

```text
Storefront Sessions = 0
```

или Stage I Outstanding, если фактически 0.

Acceptance:

```text
0 renders as valid value
not missing
not unsupported
not hidden accidentally
```

---

# 33. BROWSER CONSOLE

На проверенных страницах:

```text
unexpected runtime errors = 0
React key errors = 0
i18n errors = 0
widget mapping errors = 0
```

Если есть unrelated warnings — перечислить отдельно.

---

# 34. NETWORK/API SANITY

Для Command Center и Settings:

```text
unexpected 4xx/5xx = 0
```

Проверить, что Stage I/Catalog/Channel data реально приходит из API, а не только
существует в frontend registry.

---

# 35. AUTOMATED TESTS — DO NOT OVER-REPEAT

Если production code после основного remediation не менялся:

не нужно бессмысленно повторять все suites несколько раз.

Но подтвердить текущий результат:

```text
70/70 suites PASS
TSC clean
```

и выполнить targeted tests, если browser closure потребовал дополнительный fix.

---

# 36. BUILD

Если основной remediation ещё не прошёл production build — выполнить.

Если build уже доказан в текущем remediation run — сослаться на evidence.

---

# 37. NO NEW FEATURES

В этом closure запрещено:

```text
new KPI
CRM implementation
billing extension
Employee Performance
new Decision Signals
new Command Center section
```

---

# 38. GIT COMMIT — ONLY AFTER PASS

После browser acceptance и необходимых targeted fixes:

проверить:

```bash
git diff
git status
```

Убедиться, что commit содержит только remediation/closure changes.

---

# 39. COMMIT

Создать один понятный commit для remediation closure.

Рекомендуемый смысл commit message:

```text
fix(command-center): reconcile runtime widgets with settings
```

Допустима другая точная формулировка.

---

# 40. PUSH

После commit:

```bash
git push origin master
```

Проверить:

```text
HEAD == origin/master
```

---

# 41. FINAL WORKTREE

Обязательно:

```bash
git status
```

Acceptance:

```text
working tree clean
```

Если остались unrelated pre-existing files — не удалять; явно документировать.

---

# 42. REQUIRED DELIVERABLE A — BROWSER COMMAND CENTER

Вернуть:

```text
Total visible KPI cards:
Catalog Health: 6/6
Channel Health: 8/8
Stage I: 4/4
Runtime mapping errors: 0
```

с DOM evidence.

---

# 43. REQUIRED DELIVERABLE B — BROWSER SETTINGS

Вернуть:

```text
Total configurable Settings items:
Required items:
Intentional non-configurable exceptions:
Unexplained orphans:
```

---

# 44. REQUIRED DELIVERABLE C — DOM DIFF

```text
CC → Settings unexplained: 0
Settings → CC unexplained: 0
Registry → runtime unexplained: 0
```

Если не 0 — VERDICT A запрещён.

---

# 45. REQUIRED DELIVERABLE D — SHOW/HIDE MATRIX

| Widget | Hide | Reload hidden | Show | Reload visible |
|---|---:|---:|---:|---:|

Минимум 6 representative widgets из раздела 24.

---

# 46. REQUIRED DELIVERABLE E — PRESENTATION

```text
Payment Volume semantic:
Refund count/amount:
Channel currency:
Channel percent:
Stage I currency:
RU Settings:
AZ Settings:
EN Settings:
```

---

# 47. REQUIRED DELIVERABLE F — SECURITY

```text
RBAC negative:
Workspace negative:
Required Reconciliation:
```

---

# 48. REQUIRED DELIVERABLE G — TESTS

```text
Automated suites:
Targeted tests:
TSC:
Build:
Browser:
Console:
Network:
```

---

# 49. REQUIRED DELIVERABLE H — GIT CLOSURE

```text
Starting HEAD:
Final HEAD:
origin/master:
Commit:
Pushed:
Working tree clean:
Production code changed during closure:
Migrations:
```

---

# 50. REPORT UPDATE

Обновить существующий report:

```text
docs/prompts/PHASE_3_POST_STAGE_J_RUNTIME_WIDGET_SETTINGS_RECONCILIATION_REMEDIATION_REPORT.md
```

Добавить отдельный раздел:

```text
FINAL EVIDENCE CLOSURE
```

с browser и Git evidence.

Не создавать второй противоречащий completion report без необходимости.

---

# 51. ACCEPTANCE CRITERIA

VERDICT A разрешён только если:

1. Command Center browser DOM проверен.
2. Settings browser DOM проверен.
3. Catalog Health = 6/6.
4. Channel Health = 8/8.
5. Stage I = 4/4.
6. Registry/runtime counts reconciled.
7. Unexplained CC → Settings orphan = 0.
8. Unexplained Settings → CC orphan = 0.
9. Unexplained Registry → runtime orphan = 0.
10. Payment Volume semantic correct.
11. Refund count/amount distinction correct.
12. Channel currency formatting correct.
13. Channel percent formatting correct.
14. Stage I currency formatting correct.
15. RU Settings localization PASS.
16. AZ Settings localization PASS.
17. EN Settings localization PASS.
18. Raw i18n keys = 0.
19. CJK = 0.
20. Representative hide test PASS.
21. Hidden state survives reload.
22. Representative show test PASS.
23. Visible state survives reload.
24. Reconciliation remains mandatory.
25. RBAC negative PASS.
26. Workspace negative PASS where applicable.
27. Legitimate zero renders correctly.
28. Unexpected browser console errors = 0.
29. Unexpected API 4xx/5xx = 0.
30. Automated regression remains green.
31. TSC clean.
32. Build clean or current build evidence supplied.
33. Changes committed.
34. Changes pushed to `origin/master`.
35. `HEAD == origin/master`.
36. Working tree clean, excluding explicitly documented unrelated pre-existing state.
37. CRM Step 3.5 not started.
38. Existing remediation report updated with final evidence.

---

# 52. FINAL VERDICT

Вернуть ровно один:

## VERDICT A — POST-STAGE-J RUNTIME WIDGET INVENTORY RECONCILED / COMMAND CENTER, REGISTRY & SETTINGS FULLY ALIGNED / FINAL EVIDENCE CLOSED / CRM STEP 3.5 READY

или:

## VERDICT B — FINAL WIDGET EVIDENCE CLOSURE INCOMPLETE

Обязательно указать незакрытые gates:

```text
Browser DOM:
Settings DOM:
Catalog Health:
Channel Health:
Stage I:
Show/hide:
Persistence:
Localization:
Formatting:
RBAC:
Workspace:
Tests:
Git:
```

или:

## VERDICT C — RUNTIME DEFECT DISCOVERED / REMEDIATION REOPENED

Если browser evidence обнаружил реальный production defect, который требует
нового substantive remediation.

---

# 53. STOP

После VERDICT:

**STOP.**

CRM Step 3.5 автоматически не запускать.
