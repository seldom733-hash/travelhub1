# PHASE 3 — PRE-STEP 3.12 — ANALYTICS NAVIGATION IA REMEDIATION — ROUND 2

## STATUS

Текущий результат предыдущей remediation считается **неполным по IA-смыслу**.

Исходный baseline:

- Starting SHA: `301a19a`
- Previous remediation SHA: `612cd69`
- Current HEAD baseline for this task: `612cd69`

Зафиксированный runtime-факт:

- в левом меню появился пункт **«Аналитика»**;
- однако top-level Analytics ведёт на существующий `Command Center`;
- `/app/analytics` реализован как redirect на `/app/command-center`;
- существующий `Command Center` был фактически переименован в «Аналитика» вместо разделения двух разных рабочих центров.

Следовательно, предыдущий:

`VERDICT A — ANALYTICS NAVIGATION / IA REMEDIATION APPROVED`

считать отменённым.

Текущий статус:

`VERDICT B — IA REMEDIATION INCOMPLETE`

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые или обновляемые отчёты и текстовая документация по этой задаче должны быть преимущественно **на русском языке**.

Это относится к:

- Implementation Report;
- Remediation Report;
- Strict Review Report;
- Runtime / Browser Evidence;
- Gap Audit;
- описанию findings;
- root cause analysis;
- архитектурным решениям;
- security findings;
- runtime evidence descriptions;
- conclusions;
- recommendations;
- verdict explanations.

Английский допустим только для технических идентификаторов:

- file paths;
- class / method / DTO / model / table names;
- API endpoints;
- HTTP methods / statuses;
- CLI / Git commands;
- commit messages;
- enums;
- permission identifiers;
- code snippets;
- стандартизированных строк `VERDICT`.

**Hard acceptance criterion:** если итоговый отчёт преимущественно написан на английском, задача считается незавершённой и отчёт должен быть исправлен до выставления финального verdict.

---

# 1. PURPOSE

Исправить неверную интерпретацию предыдущей задачи.

Требование заключалось **не** в переименовании существующего `Command Center` в «Аналитика».

Необходимо обеспечить архитектурное и навигационное разделение двух разных функциональных центров:

```text
Command Center / Рабочий стол
→ оперативное состояние бизнеса
→ KPI
→ краткие тренды
→ что происходит сейчас / за выбранный период

Analytics Center / Аналитика
→ глубокий анализ
→ сравнение периодов
→ структура данных
→ воронки
→ сегменты
→ причины изменений
→ drill-down
```

Также должен сохраниться отдельный контекст:

```text
CRM → Аналитика
→ только контекстная CRM analytics
```

---

# 2. HARD IA CONTRACT

После remediation целевая навигация должна быть концептуально такой:

```text
PLATFORM WORKSPACE

├ Рабочий стол / Command Center
│  └ собственный route
│
├ Аналитика
│  └ /app/analytics
│
├ Продажи
├ Бронирования
├ CRM
│  ├ Клиенты
│  ├ Партнёры
│  └ Аналитика
│     └ контекстная CRM analytics
└ ...
```

Критический invariant:

```text
/app/analytics
≠ redirect to /app/command-center
```

И наоборот:

```text
Command Center
≠ Analytics Center
```

---

# 3. FIRST ACTION — ROOT CAUSE CONFIRMATION

До внесения изменений выполнить audit фактического состояния `612cd69`.

Проверить минимум:

- sidebar manifest / `Shell.tsx`;
- текущий label `nav.analytics`;
- route `/app/analytics`;
- route `/app/command-center`;
- page title / heading обоих центров;
- существующие Command Center components;
- существующие analytics-related components;
- CRM Analytics implementation;
- permissions / route guards;
- tests, которые после предыдущей remediation могли закрепить неправильное поведение.

В отчёте явно подтвердить:

1. был ли `Command Center` только переименован;
2. действительно ли `/app/analytics` делает redirect;
3. существует ли отдельная Analytics page;
4. какие компоненты являются shared и какие принадлежат Command Center;
5. что именно должно быть изменено минимально, без создания второго Analytics Engine.

---

# 4. IMPLEMENTATION REQUIREMENTS

## 4.1 Restore Command Center as a separate center

Существующий `Command Center` должен снова иметь собственную семантику и пользовательское название.

Необходимо определить по текущей архитектуре, какой label является каноничным:

- `Рабочий стол`, если именно так закреплено в текущей IA;
- либо `Command Center`, если локализованное название ещё не зафиксировано.

Не вводить новое название произвольно.

Главное требование:

- этот пункт не должен называться «Аналитика»;
- его route не должен принадлежать top-level Analytics.

---

## 4.2 Create a real top-level Analytics route/page

`/app/analytics` должен быть самостоятельным route/page.

Запрещено:

```text
/app/analytics
→ redirect
→ /app/command-center
```

Допустимо переиспользование уже существующих компонентов, если они действительно аналитические.

Необходимо придерживаться принципа:

```text
one Analytics Engine
→ multiple views / projections
```

Не создавать второй Analytics backend/domain только ради новой страницы.

---

## 4.3 Do not overbuild Analytics

Эта remediation является **IA remediation**, а не полной реализацией будущего BI.

Не требуется сейчас создавать весь будущий Analytics Center с нуля.

Необходимо:

- обеспечить самостоятельный route;
- обеспечить самостоятельную page semantics;
- вынести/переиспользовать существующий аналитический контент настолько, насколько это позволяет текущая архитектура;
- не дублировать Command Center целиком;
- не создавать фиктивную пустую страницу только ради route.

Если текущего аналитического контента недостаточно для полноценной страницы:

- использовать минимально честный Analytics shell/page;
- показывать только реально существующие аналитические данные;
- явно зафиксировать недостающие будущие capabilities как deferred/gap;
- не имитировать реализованные функции.

---

## 4.4 Preserve CRM Analytics

`CRM → Аналитика` должна остаться.

Но необходимо убедиться, что это:

```text
CRM-context analytics
```

а не полный top-level Analytics Center.

Она может показывать:

- customer metrics;
- segments;
- customer activity;
- CRM trends;
- retention;
- sources;
- другие CRM-domain metrics, которые реально существуют.

Не переносить CRM Analytics в top-level Analytics как замену общего Analytics Center.

---

# 5. ROUTE OWNERSHIP

После remediation должно быть доказано:

```text
/app/command-center
→ Command Center / Рабочий стол

/app/analytics
→ Analytics Center / Аналитика
```

Каждый route:

- открывается напрямую;
- bookmark-safe;
- не зависит от случайной последовательности navigation;
- имеет правильный page title / heading;
- соблюдает server/client access rules;
- не маскируется redirect-ом в другой функциональный центр.

---

# 6. PERMISSIONS AND ACCESS

Не ломать существующую permission architecture.

Проверить:

- кто имеет право видеть top-level Analytics;
- кто имеет право открывать `/app/analytics` напрямую;
- кто имеет право открывать Command Center;
- отсутствие privilege bypass через direct URL.

Скрытие sidebar item не считается контролем доступа.

Если обе страницы используют один существующий permission gate по текущей архитектуре — не создавать новый permission без необходимости.

Если аудит показывает, что для раздельной семантики уже существует отдельный permission — использовать каноничный.

Не менять RBAC scope Step 3.12 в рамках этой remediation.

---

# 7. SIDEBAR REQUIREMENTS

В левом меню Platform Workspace должны существовать два независимых navigation intent:

```text
Рабочий стол / Command Center
Аналитика
```

Порядок определить по текущей каноничной IA.

Проверить:

- active state;
- route highlighting;
- keyboard/navigation behavior;
- i18n;
- role projection;
- responsive/sidebar collapsed state, если это уже поддерживается Shell.

Запрещено наличие двух menu items, которые фактически ведут в одну и ту же страницу.

---

# 8. I18N

Проверить и при необходимости исправить локализацию:

- sidebar labels;
- page title;
- heading;
- access denied / auth hints;
- breadcrumbs, если существуют.

Не использовать `Command Center` как пользовательский русский label, если в проекте закреплён `Рабочий стол`.

Не оставлять raw i18n keys.

---

# 9. TEST REQUIREMENTS

Обновить/добавить тесты так, чтобы они ловили именно предыдущую ошибку.

Минимум проверить:

1. sidebar содержит отдельный пункт Analytics;
2. sidebar содержит отдельный Command Center / Рабочий стол;
3. `/app/analytics` не redirect-ит на `/app/command-center`;
4. Analytics page имеет собственную page semantics;
5. `/app/command-center` остаётся доступным отдельно;
6. CRM Analytics сохранён;
7. direct-route access checks;
8. active nav state правильный для каждого route;
9. i18n не содержит raw keys в затронутых местах.

Особенно важно:

**не переписывать тесты только под новое неправильное поведение**, как это произошло в предыдущем раунде.

Тест должен подтверждать архитектурный контракт, а не просто текущее DOM-состояние.

---

# 10. RUNTIME / BROWSER VERIFICATION — MANDATORY

Source/tests/build сами по себе недостаточны.

После implementation необходимо проверить реальный runtime в браузере.

Минимальная browser matrix:

### ADMIN

Проверить:

- [ ] sidebar показывает отдельный Command Center / Рабочий стол;
- [ ] sidebar показывает отдельную «Аналитику»;
- [ ] click Command Center открывает его собственную страницу;
- [ ] click «Аналитика» открывает `/app/analytics`;
- [ ] `/app/analytics` не превращается в `/app/command-center`;
- [ ] page heading/title Analytics соответствует Analytics;
- [ ] page heading/title Command Center соответствует своему центру;
- [ ] back/forward navigation работает корректно;
- [ ] direct bookmark `/app/analytics` работает;
- [ ] direct bookmark `/app/command-center` работает;
- [ ] active sidebar state правильный;
- [ ] CRM → Аналитика остаётся доступной и контекстной;
- [ ] нет raw i18n keys;
- [ ] browser console без новых ошибок;
- [ ] Network не показывает неожиданных auth/route ошибок.

Если существуют другие роли, для которых Analytics скрыт/запрещён, проверить минимум одну такую роль direct-route способом.

---

# 11. NEXT.JS RUNTIME HYGIENE

Так как на предыдущем раунде фактический runtime сначала не отражал sidebar changes, перед финальной browser qualification убедиться, что приложение действительно обслуживает новый SHA.

Зафиксировать:

```text
git rev-parse HEAD
git rev-parse origin/master
```

При необходимости:

- остановить старый frontend process/container;
- очистить `.next`;
- пересобрать / перезапустить Next.js;
- убедиться, что браузер смотрит именно на актуальный runtime.

Не использовать очистку кэша как замену root cause analysis.

---

# 12. NON-GOALS

В этой задаче запрещено:

- начинать Step 3.12 Users & Access;
- создавать новый Analytics backend/domain без необходимости;
- реализовывать весь будущий BI;
- менять Finance;
- менять Payment / Settlement / Payout;
- добавлять Departments / Teams / Management Groups;
- менять Partner Workspace IA;
- перерабатывать Storefront;
- смешивать сюда будущую Analytics Visualization & Period Model architecture;
- opportunistic refactoring вне непосредственного scope.

---

# 13. REQUIRED REPORT

Создать remediation report преимущественно на русском языке.

Он должен содержать:

## 13.1 Baseline

```text
Starting SHA: 612cd69
```

## 13.2 Root Cause

Явно объяснить, почему предыдущая remediation создала:

```text
Analytics label
→ existing Command Center
```

вместо двух независимых центров.

## 13.3 Files Changed

Полный перечень затронутых файлов и краткое назначение каждого изменения.

## 13.4 Route Contract Before / After

Пример:

```text
BEFORE

/app/analytics
→ redirect
→ /app/command-center


AFTER

/app/analytics
→ Analytics Center

/app/command-center
→ Command Center / Рабочий стол
```

## 13.5 Tests

Указать фактические результаты:

- frontend tests;
- frontend TSC;
- frontend build;
- targeted tests;
- backend status, если backend не затрагивался.

## 13.6 Runtime / Browser Evidence

Для каждого browser assertion:

```text
PASS / FAIL
```

с кратким evidence.

## 13.7 Regressions

Отдельно перечислить:

- найденные regressions;
- pre-existing issues;
- почему они относятся или не относятся к этой remediation.

Не маскировать FAIL как PRE-EXISTING без доказательства.

## 13.8 Final SHA

Указать:

```text
Remediation SHA:
Final HEAD:
origin/master:
```

Все значения должны быть реальными.

---

# 14. ACCEPTANCE CRITERIA

Task может получить `VERDICT A` только если одновременно выполнено всё:

- [ ] Command Center и Analytics существуют как разные IA centers;
- [ ] top-level Analytics не является rename существующего Command Center;
- [ ] `/app/analytics` не redirect-ит на `/app/command-center`;
- [ ] Command Center имеет собственный route/page;
- [ ] Analytics имеет собственный route/page;
- [ ] sidebar показывает два независимых navigation intents;
- [ ] CRM Analytics сохранён как contextual analytics;
- [ ] permission/direct-route behavior не ухудшен;
- [ ] tests подтверждают разделение;
- [ ] TSC PASS;
- [ ] frontend build PASS;
- [ ] browser/runtime qualification PASS;
- [ ] runtime обслуживает финальный SHA;
- [ ] отчёт преимущественно на русском;
- [ ] canonical roadmap не объявляет Step 3.12 начатым автоматически.

Если хотя бы одно критическое условие не выполнено:

```text
VERDICT B — REMEDIATION INCOMPLETE
```

---

# 15. FINAL VERDICT FORMAT

При успешном результате:

```text
PHASE 3 — PRE-STEP 3.12 — ANALYTICS NAVIGATION IA REMEDIATION — ROUND 2 — ЗАВЕРШЕНА

Starting SHA:        612cd69
Remediation SHA:     <REAL_SHA>
Final HEAD:          <REAL_SHA>
origin/master:       <REAL_SHA>

VERDICT A — COMMAND CENTER AND ANALYTICS IA SEPARATION APPROVED

Canonical NEXT:
Step 3.12 — Users & Access Completion

DO NOT AUTO-START
```

При неуспешном результате:

```text
VERDICT B — ANALYTICS IA SEPARATION INCOMPLETE
```

с точным перечнем блокирующих findings.

---

# 16. STOP CONDITION

После завершения этой remediation:

**НЕ НАЧИНАТЬ Step 3.12 автоматически.**

Остановиться после:

1. commit;
2. runtime/browser qualification;
3. remediation report;
4. final verdict;
5. canonical roadmap sync, только если он действительно требуется для фиксации результата.

Дождаться отдельной команды на продолжение.
