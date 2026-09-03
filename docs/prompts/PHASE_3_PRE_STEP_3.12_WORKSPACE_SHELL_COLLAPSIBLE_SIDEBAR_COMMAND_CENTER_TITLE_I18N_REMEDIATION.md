# PHASE 3 — PRE-STEP 3.12 — WORKSPACE SHELL COLLAPSIBLE SIDEBAR + COMMAND CENTER TITLE I18N — TARGETED REMEDIATION

## ЦЕЛЬ

Выполнить небольшой targeted remediation после `PLATFORM WORKSPACE HOME / DASHBOARD MODERNIZATION`.

Текущий implementation в целом сохраняется. Не перепроектировать Workspace Home.

Нужно закрыть два вопроса:

1. runtime-дефект локализации заголовка `/app/command-center`;
2. добавить **единый collapsible sidebar** на уровне общего `WorkspaceShell`, работающий на всех внутренних Platform Workspace routes.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все Implementation / Remediation / Evidence / Strict Review reports, root cause analysis, findings, architecture decisions, conclusions и verdict explanations должны быть преимущественно **на русском языке**.

Английский разрешён для technical identifiers, paths, API/code identifiers, enums, commands, commit messages и стандартизированных `VERDICT`.

Если итоговый отчёт преимущественно английский — задача не завершена.

---

# 0. STARTING POINT

Последний заявленный SHA:

```text
34bec86
```

Перед началом:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
```

Если фактический HEAD отличается — использовать его как Starting SHA и явно указать это в отчёте.

---

# 1. WS-R1-01 — COMMAND CENTER PAGE H1 ОСТАЛСЯ НА АНГЛИЙСКОМ

## Runtime evidence

При RU locale:

```text
Sidebar:
Центр управления        PASS

/app/command-center H1:
Command Center           FAIL
```

Предыдущий `VERDICT A` поэтому не является полностью подтверждённым runtime.

## Требование

Один canonical presentation contract:

```text
RU → Центр управления
AZ → İdarəetmə Mərkəzi
EN → Command Center
```

Проверить и синхронизировать применимые поверхности:

```text
sidebar
Workspace Home card
page H1
breadcrumb
navigation search
mobile navigation
document/page title — если используется shared title contract
```

Не менять:

```text
/app/command-center
CommandCenter
commandCenter
```

Не создавать отдельный hardcoded перевод только для H1, если уже существует canonical i18n key.

### Gate

В browser:

```text
RU H1 = Центр управления
AZ H1 = İdarəetmə Mərkəzi
EN H1 = Command Center
```

0 raw i18n keys.

---

# 2. WS-R1-02 — SHARED COLLAPSIBLE SIDEBAR

## Архитектурный принцип

Collapsible sidebar — это **Workspace Shell capability**, а не feature конкретной страницы.

Правильно:

```text
WorkspaceShell
    ↓
Shared Sidebar
    ↓
expanded / collapsed state
    ↓
Dashboard
Command Center
Analytics
Catalog
Orders
Bookings
CRM
Marketing
Support
Partners
Sellers
Users
и другие routes, использующие этот Shell
```

Запрещено создавать отдельный `isCollapsed` state/реализацию внутри каждой страницы.

Перед реализацией определить фактический shared shell/sidebar component и существующий navigation manifest.

---

# 3. DESKTOP SIDEBAR STATES

Поддержать два устойчивых состояния.

## Expanded

Текущий полноценный sidebar:

```text
[TravelHub]

🏠 Рабочий стол
📊 Центр управления
📈 Аналитика
...
```

Показываются:

- logo/brand согласно текущему shell;
- icon;
- localized label;
- active state;
- нижний user/account area согласно существующей реализации.

## Collapsed

Компактная панель:

```text
[T]

🏠
📊
📈
...
```

Ориентировочная ширина:

```text
64–72 px
```

но использовать design tokens/current shell dimensions, если они уже существуют. Не hardcode произвольную ширину вопреки Design System.

В collapsed state:

- текстовые labels скрыты;
- icons остаются;
- active item остаётся визуально очевидным;
- navigation functionality полностью сохраняется;
- content area корректно занимает освободившееся пространство;
- никаких пустых резервов под expanded sidebar.

---

# 4. TOGGLE CONTROL

Добавить понятный control сворачивания/раскрытия.

Предпочтительно:

```text
верхняя часть sidebar
или
граница sidebar/content
```

в соответствии с текущим Shell.

Требования:

- визуально понятная иконка;
- expanded → collapse;
- collapsed → expand;
- не перекрывает navigation;
- не вызывает layout jump;
- доступна keyboard;
- имеет localized accessible name;
- `aria-expanded` отражает фактическое состояние;
- target area достаточного размера.

Не использовать текстовую кнопку, которая ломает compact mode.

---

# 5. TOOLTIPS В COLLAPSED MODE

Когда labels скрыты, каждый navigation item должен иметь tooltip/accessibility label.

Пример:

```text
hover/focus 📊
→ "Центр управления"
```

Tooltip должен использовать тот же i18n key, что и navigation label.

Проверить RU/AZ/EN.

Не создавать отдельный набор tooltip translations.

Tooltip должен работать не только mouse hover, но и keyboard focus, если shared tooltip component это поддерживает.

---

# 6. ACTIVE ROUTE

Collapsed mode не должен ухудшать ориентацию пользователя.

Для текущего route:

```text
/app/command-center
```

иконка `Центр управления` должна иметь тот же понятный active state, что и expanded item.

Проверить nested/detail routes, например:

```text
/app/finance/payments/...
/app/orders/...
/app/crm/...
```

согласно существующему route matching contract.

Не менять navigation IA в этой задаче.

---

# 7. STATE PERSISTENCE

Выбор пользователя должен сохраняться между страницами и после refresh.

Ожидаемый контракт:

```text
collapse
→ navigate Command Center → Analytics → CRM
→ sidebar остаётся collapsed
→ F5
→ sidebar остаётся collapsed
```

Допустимо использовать:

```text
localStorage
```

или уже существующий project-wide preference mechanism.

Требования:

- browser-only API не должен ломать SSR/hydration;
- отсутствие сохранённого значения → canonical default;
- corrupted/unknown value → safe fallback;
- state не должен мигать expanded → collapsed после hydration, если этого можно избежать существующей shell architecture.

Не вводить backend preference storage только ради этой задачи.

---

# 8. DEFAULT STATE

Если в проекте нет существующего пользовательского preference:

```text
desktop default = expanded
```

Не менять привычное состояние всем пользователям после deployment без сохранённого выбора.

---

# 9. MOBILE / RESPONSIVE — НЕ СМЕШИВАТЬ ДВА ПАТТЕРНА

Desktop collapse и mobile navigation — разные UX-механизмы.

На mobile/tablet использовать существующий responsive contract:

```text
drawer / off-canvas / existing mobile sidebar
```

если он уже реализован.

Не превращать mobile sidebar автоматически в desktop-style 64px icon rail, если это противоречит текущему responsive shell.

Обязательно проверить breakpoints и отсутствие:

- horizontal overflow;
- content overlap;
- inaccessible menu;
- floating toggle вне viewport.

---

# 10. CONTENT LAYOUT

При изменении sidebar width основной content должен корректно reflow.

Проверить минимум:

```text
/app/dashboard
/app/command-center
/app/analytics
/app/orders
/app/bookings
/app/crm
/app/finance/payments
```

Требования:

```text
expanded → correct content width
collapsed → content expands
toggle → no broken cards/tables
no horizontal page jump caused by stale margin-left
```

Использовать shared shell layout variables/classes вместо page-specific offsets.

---

# 11. RBAC / NAVIGATION MANIFEST — REGRESSION GATE

Collapsing sidebar не должен менять список доступных пунктов.

```text
permission filtering
→ same navigation items
→ only presentation changes
```

Не создавать второй navigation manifest для collapsed mode.

Expanded и collapsed sidebar должны использовать один canonical filtered item set.

---

# 12. ACCESSIBILITY

Обязательно:

```text
toggle keyboard reachable
Enter/Space works
aria-expanded
localized aria-label
navigation icons have accessible names
tooltips/focus labels available
visible focus state
semantic navigation links preserved
```

Collapsed sidebar не должен превращаться в набор безымянных icon-only controls для screen reader.

---

# 13. I18N

Проверить RU/AZ/EN:

```text
toggle accessible label
tooltips
sidebar labels
Command Center H1
```

Предлагаемая семантика toggle:

```text
RU:
Свернуть меню
Развернуть меню

AZ:
Menyunu yığ
Menyunu genişləndir

EN:
Collapse menu
Expand menu
```

Если проект использует другую утверждённую терминологию — следовать существующему словарю.

0 raw i18n keys.

---

# 14. DO NOT OVER-ANIMATE

Допустим короткий transition ширины/opacity labels согласно существующему UI.

Не добавлять тяжёлые animations.

Учитывать `prefers-reduced-motion`, если shared motion system проекта это поддерживает.

Не допускать задержки navigation из-за animation.

---

# 15. BROWSER / RUNTIME EVIDENCE — MANDATORY

Проверить минимум:

```text
1. RU /app/command-center H1 = Центр управления
2. AZ H1 = İdarəetmə Mərkəzi
3. EN H1 = Command Center

4. sidebar expanded initially/default
5. click collapse → compact icon rail
6. content expands correctly
7. active route remains obvious
8. hover/focus icon → localized tooltip
9. navigate Dashboard → Command Center → Analytics → CRM
10. collapsed state persists
11. F5 preserves collapsed state
12. expand → full labels return
13. F5 preserves expanded state
14. reduced-permission role keeps same allowed item set
15. Orders layout works expanded/collapsed
16. Bookings layout works expanded/collapsed
17. Analytics layout works expanded/collapsed
18. Payments table works expanded/collapsed
19. keyboard toggle works
20. no unexpected console/runtime errors
21. no unexpected 4xx/5xx
22. responsive/mobile navigation remains usable
```

Screenshots/evidence должны включать как минимум:

```text
expanded RU
collapsed RU
collapsed with tooltip
AZ Command Center H1
EN Command Center H1
```

---

# 16. TESTS

Добавить/обновить targeted tests:

```text
default expanded state
collapse action
expand action
persisted collapsed state
persisted expanded state
invalid persisted value fallback
same navigation manifest in both states
permission filtering unchanged
active item rendering collapsed
localized tooltip/accessibility label
Command Center H1 RU/AZ/EN
```

Выполнить:

```text
frontend typecheck
frontend tests
frontend build
```

Backend не менять без необходимости.

---

# 17. HARD ACCEPTANCE GATES

`VERDICT A` разрешён только если:

```text
A. Command Center H1 локализован RU/AZ/EN
B. Sidebar collapse реализован в shared WorkspaceShell
C. Не существует page-specific duplicate collapse implementations
D. Expanded/collapsed используют один navigation manifest
E. Permission filtering не изменён
F. Collapsed mode сохраняет icons + active state
G. Tooltips/accessibility labels работают
H. Toggle keyboard accessible + aria-expanded
I. State persists across navigation
J. State persists after F5
K. Content reflows without stale sidebar offset
L. Dashboard/Command Center/Analytics/Orders/Bookings/CRM/Payments smoke PASS
M. Mobile/responsive navigation не сломана
N. RU/AZ/EN i18n clean
O. Tests/typecheck/build PASS
P. Browser/runtime evidence PASS
```

Любой обязательный FAIL:

```text
VERDICT B
```

Source/tests без runtime evidence недостаточны.

---

# 18. OUT OF SCOPE — HARD STOP

Не выполнять:

- новый sidebar redesign;
- новую navigation IA;
- Finance Center;
- FX/Treasury/Settlement;
- Booking KPI semantics;
- Analytics redesign;
- Command Center KPI remediation;
- public marketplace redesign;
- global Design System redesign;
- Step 3.12;
- backend user-preference storage;
- новые counters/badges;
- unrelated page refactoring.

Сохраняем текущую визуальную систему sidebar; добавляем capability collapse/expand.

---

# 19. FINAL REPORT FORMAT

Отчёт преимущественно на русском:

```text
# WORKSPACE SHELL COLLAPSIBLE SIDEBAR + COMMAND CENTER TITLE I18N

Starting SHA:
Implementation SHA:
Final HEAD:
origin/master:
HEAD == origin:

## WS-R1-01 Command Center H1
Root Cause:
Fix:
RU:
AZ:
EN:
Evidence:
Result:

## WS-R1-02 Shared Collapsible Sidebar
Shared component:
State owner:
Persistence:
Default:
Evidence:
Result:

## Navigation Manifest / RBAC
...

## Accessibility
...

## Responsive
...

## Localization
...

## Runtime Matrix
...

## Tests
...

## Residual Gaps
...

## VERDICT
VERDICT A / VERDICT B
```

---

# 20. GIT / COMPLETION

После реализации:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
```

Указать реальные SHA.

Не начинать следующий этап автоматически.

---

# EXPECTED FINAL STATE

```text
EXPANDED

TravelHub
────────────────
🏠 Рабочий стол
📊 Центр управления
📈 Аналитика
📚 Каталог
...

        [collapse]
```

```text
COLLAPSED

[T]
───
🏠
📊  ← active
📈
📚
...

[expand]
```

```text
hover/focus 📊
→ Центр управления
```

И во всех состояниях:

```text
RU H1 → Центр управления
AZ H1 → İdarəetmə Mərkəzi
EN H1 → Command Center
```
