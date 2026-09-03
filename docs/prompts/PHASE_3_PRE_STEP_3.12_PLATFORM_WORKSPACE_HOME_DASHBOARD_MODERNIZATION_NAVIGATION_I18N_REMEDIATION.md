# PHASE 3 — PRE-STEP 3.12 — PLATFORM WORKSPACE HOME / DASHBOARD MODERNIZATION & NAVIGATION I18N REMEDIATION

## ЦЕЛЬ

Привести `/app/dashboard` («Рабочий стол») в соответствие с **фактически реализованной текущей архитектурой TravelHub**.

Текущий экран является устаревшим technical/developer landing:

- содержит `CRM mini`, хотя в системе уже существует полноценный CRM;
- показывает старые technical/domain descriptions;
- содержит пользовательски нерелевантный блок `Архитектурные принципы (Baseline)`;
- не отражает существующие рабочие центры платформы;
- в левом меню остаётся нелокализованный `Command Center`.

Задача — превратить `/app/dashboard` в **Platform Workspace Home**: навигационный рабочий стол внутреннего пользователя, который даёт быстрый доступ к реально существующим центрам системы.

Не превращать его во второй Command Center и не дублировать Analytics.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**.

Это относится к:

- Implementation Report;
- Remediation Report;
- Strict Review Report;
- Evidence / Runtime Report;
- findings explanations;
- root cause analysis;
- architecture decisions;
- security findings;
- runtime evidence descriptions;
- conclusions/recommendations;
- verdict explanations.

Английский допустим только для технических идентификаторов: paths, class/method/DTO/model/table names, endpoints, HTTP methods/status codes, CLI/Git commands, commit messages, enums, permissions, code snippets и стандартизированных `VERDICT`.

Если итоговый отчёт преимущественно английский — задача считается незавершённой.

---

# 0. STARTING POINT

Последний заявленный синхронизированный SHA:

```text
966582d
```

Перед началом:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
```

Использовать фактический HEAD как Starting SHA, если он отличается.

Не выполнять unrelated refactoring.

---

# 1. ЗАФИКСИРОВАТЬ РОЛИ ТРЁХ ВЕРХНЕУРОВНЕВЫХ СТРАНИЦ

Нельзя снова смешать Dashboard, Command Center и Analytics.

Каноническое разделение:

```text
Рабочий стол
/app/dashboard
→ куда перейти / с чем работать
→ Workspace Home / navigation hub

Центр управления
/app/command-center
→ что происходит сейчас
→ operational/executive summary, KPI, alerts, key trends

Аналитика
/app/analytics
→ почему это происходит
→ deep BI, comparison, structure, trends, drill-down
```

Hard gate:

```text
Dashboard ≠ Command Center
Dashboard ≠ Analytics
Command Center ≠ Analytics
```

Не переносить на Рабочий стол большие KPI/BI-блоки из Command Center или Analytics.

---

# 2. AUDIT BEFORE IMPLEMENTATION — MANDATORY

До изменения карточек выполнить repo/runtime inventory всех **реально существующих** Platform Workspace destinations.

Проверить:

- sidebar manifest/config;
- routes;
- RBAC/permissions;
- implemented pages;
- entitlement/workspace gates;
- current navigation labels;
- breadcrumbs;
- mobile/alternate navigation, если существует.

Минимально проверить существование и фактические routes для:

```text
Command Center
Analytics
Catalog
Orders
Bookings
CRM
Marketing
Support
Partners / onboarding
Sellers
Users
Payments
```

Не создавать карточку для будущего раздела только потому, что он есть в roadmap.

Особенно:

```text
Finance Center
```

сейчас НЕ создавать и не показывать как существующий рабочий центр, если полноценного Finance Center нет.

Payments page сама по себе не означает наличие Finance Center.

---

# 3. УДАЛИТЬ DEVELOPER-ORIENTED CONTENT ИЗ WORKSPACE HOME

Текущий `/app/dashboard` содержит блок:

```text
Архитектурные принципы (Baseline)
```

и technical content вида:

```text
Product → Order → Booking
PostgreSQL
transactional outbox
canonical IDs
domain schemas
RBAC implementation details
```

Это архитектурная документация разработчика, а не содержимое пользовательского рабочего интерфейса.

## Требование

Удалить этот блок с Platform Workspace Home.

Не удалять архитектурную документацию из repository/docs, если она существует отдельно.

UI не должен объяснять внутреннему бизнес-пользователю техническое устройство PostgreSQL/outbox/domain schemas.

---

# 4. `CRM mini` → ПОЛНОЦЕННАЯ CRM

Текущая карточка:

```text
CRM mini
Customer / Contact / Company / Partner / Supplier
```

устарела.

Система уже имеет полноценный CRM Center.

## Требование

Заменить карточку на:

```text
CRM
```

с актуальным пользовательским описанием возможностей, подтверждённых текущей реализацией.

Не использовать старый `mini`.

Не придумывать CRM capabilities, которых ещё нет.

Карточка должна вести на canonical CRM destination.

---

# 5. АКТУАЛЬНЫЕ КАРТОЧКИ WORKSPACE HOME

На основании обязательного inventory сформировать карточки **только реально существующих рабочих центров**.

Ожидаемый conceptual set, который необходимо сверить с repo:

```text
Каталог
CRM
Заказы
Бронирования
Аналитика
Маркетинг
Поддержка
Партнёры
Продавцы
Пользователи
```

Допускается отдельная карточка `Центр управления`, если это соответствует итоговой IA и не создаёт визуальное дублирование sidebar.

Не копировать список механически — repo/runtime является authority.

## Каждая карточка

Должна содержать:

```text
icon
localized title
краткое business-oriented описание
canonical destination
permission/access metadata
```

Описание должно объяснять назначение центра пользователю, а не внутренние entity names.

Плохо:

```text
Order / OrderItem / OrderTraveler / Fulfillment
```

Хороший тип формулировки:

```text
Заказы
Управление заказами, обработкой и исполнением
```

Финальный текст должен быть локализован через i18n, а не hardcoded только на RU.

---

# 6. НЕ ПРЕВРАЩАТЬ WORKSPACE HOME В ЕЩЁ ОДИН DASHBOARD KPI

Рабочий стол — прежде всего navigation/work hub.

Не добавлять без отдельного доказанного требования:

- GMV charts;
- Revenue charts;
- Analytics funnels;
- Partner Performance;
- Financial Summary;
- большие KPI grids.

Эти данные принадлежат Command Center / Analytics.

Допустимы только лёгкие contextual indicators в будущем, например:

```text
12 новых
5 требуют внимания
```

но **в этом remediation не вводить новую counters architecture**, если для неё нет уже существующего shared/canonical source.

Не создавать fake/demo counters.

---

# 7. COMMAND CENTER — NAVIGATION I18N CLEANUP

В RU runtime sidebar сейчас отображается:

```text
Command Center
```

при том что остальные основные пункты локализованы.

Сохранить route/code identifiers:

```text
/app/command-center
CommandCenter
commandCenter
```

Но пользовательский label локализовать.

Канонические labels:

```text
RU → Центр управления
AZ → İdarəetmə Mərkəzi
EN → Command Center
```

Использовать один shared i18n/navigation label во всех применимых местах:

```text
sidebar
breadcrumb
page title
navigation search
mobile navigation
```

если эти поверхности используют одно и то же название сущности.

Не переводить route/class identifiers.

---

# 8. NAVIGATION / I18N SWEEP

Выполнить targeted sweep Platform Workspace navigation для RU/AZ/EN.

Проверить минимум:

```text
Рабочий стол
Центр управления
Аналитика
Каталог
Заказы
Бронирования
CRM
Маркетинг
Поддержка
Партнёры
Продавцы
Пользователи
```

Требования:

- 0 raw i18n keys;
- 0 случайных английских пользовательских labels в RU/AZ, если это не бренд/общепринятый термин;
- одинаковое название одного раздела в sidebar/card/breadcrumb/page title;
- route identifiers не локализуются.

Не проводить глобальную перепись всей терминологии проекта вне данного navigation scope.

---

# 9. RBAC / PERMISSION-AWARE WORKSPACE HOME

Рабочий стол не должен показывать пользователю центры, к которым у него нет доступа.

Архитектурная цепочка:

```text
Workspace
→ Role / Permissions
→ Navigation manifest
→ Workspace Home cards
```

Предпочтительно, чтобы sidebar и Workspace Home использовали **один canonical navigation/capability source**, а не две независимо захардкоженные матрицы.

Если shared navigation manifest уже существует — переиспользовать его.

Не создавать второй параллельный permission map только для Dashboard.

## Security

Скрытие карточки — только UX.

Server-side route/API authorization остаётся authoritative.

Прямой URL не должен обходить permission checks.

---

# 10. CARD ORDER / INFORMATION ARCHITECTURE

Карточки должны быть сгруппированы/упорядочены по рабочему смыслу, а не по внутренней истории разработки.

Предпочтительная логика:

```text
Core Operations
→ Каталог
→ Заказы
→ Бронирования

Customer / Commercial
→ CRM
→ Маркетинг

Management / Insight
→ Центр управления
→ Аналитика

Ecosystem / Administration
→ Партнёры
→ Продавцы
→ Поддержка
→ Пользователи
```

Это conceptual guidance, не требование создавать обязательные визуальные section headings.

Сначала проверить существующий Design System и layout.

---

# 11. VISUAL CONTRACT

Сохранить существующий Platform Workspace visual language.

Не делать глобальный redesign в рамках этой задачи.

Карточки должны иметь:

- единый размер/spacing;
- одинаковую title hierarchy;
- единый icon treatment;
- hover/focus state;
- кликабельность всей карточки либо shared card navigation pattern;
- keyboard accessibility;
- responsive layout.

Не оставлять смешение старых developer cards и новых business cards.

---

# 12. ACCESSIBILITY

Проверить:

```text
keyboard navigation
visible focus
semantic links/buttons
icon accessibility
sufficient text labels
no click-only inaccessible divs
```

Если карточка является navigation destination — предпочтительно semantic link/shared navigation component.

---

# 13. ROUTE / DESTINATION RECONCILIATION

Для каждой отображаемой карточки доказать:

```text
Workspace Home card
→ canonical route
→ expected page
→ no redirect to unrelated center
→ no 404/500
```

Особенно проверить:

```text
CRM
Orders
Bookings
Analytics
Command Center
Partners
Sellers
```

Не повторять ошибку прошлой IA, когда разные центры фактически указывали на одну страницу.

---

# 14. LOCALIZATION MATRIX

Browser/runtime proof:

| Surface | RU | AZ | EN |
|---|---|---|---|
| Workspace Home title | PASS | PASS | PASS |
| Card titles | PASS | PASS | PASS |
| Card descriptions | PASS | PASS | PASS |
| Command Center label | PASS | PASS | PASS |
| Sidebar | PASS | PASS | PASS |
| Breadcrumbs | PASS | PASS | PASS |
| No raw keys | PASS | PASS | PASS |

Отдельно доказать:

```text
RU: Центр управления
AZ: İdarəetmə Mərkəzi
EN: Command Center
```

---

# 15. BROWSER EVIDENCE — MANDATORY

Проверить минимум:

```text
1. /app/dashboard opens successfully
2. technical Baseline block отсутствует
3. CRM mini отсутствует
4. CRM card присутствует
5. CRM card → canonical CRM
6. Orders card → canonical Orders
7. Bookings card → canonical Bookings
8. Analytics card → /app/analytics
9. Command Center card/navigation → /app/command-center
10. Command Center ≠ Analytics
11. Command Center ≠ Dashboard
12. all visible cards lead to valid implemented destinations
13. RU navigation clean
14. AZ navigation clean
15. EN navigation clean
16. role with reduced permissions does not see forbidden cards
17. direct forbidden route remains server-authorized/denied according to existing contract
18. responsive/card layout has no obvious breakage
19. keyboard navigation works
20. no unexpected 4xx/5xx in normal flow
```

---

# 16. TESTS

Добавить/обновить targeted tests минимум для:

- Workspace Home card manifest/rendering;
- `CRM mini` absence;
- CRM canonical destination;
- permission-aware card visibility;
- Command Center localization RU/AZ/EN;
- route mapping;
- no duplicate Dashboard/Command Center/Analytics destination;
- navigation i18n keys.

Выполнить применимые:

```text
frontend tests
frontend typecheck
frontend build
targeted backend/security tests, если backend затронут
```

Не использовать tests как замену browser evidence.

---

# 17. HARD ACCEPTANCE GATES

`VERDICT A` разрешён только если:

```text
A. /app/dashboard остаётся отдельным Workspace Home
B. Dashboard не дублирует Command Center
C. Dashboard не дублирует Analytics
D. developer Baseline content удалён из пользовательского UI
E. CRM mini заменён на актуальный CRM
F. карточки соответствуют реально существующим centers/routes
G. отсутствуют карточки несуществующих future centers
H. все карточки имеют корректные canonical destinations
I. card visibility permission-aware
J. sidebar/card access используют shared/canonical access model либо доказанно согласованы
K. Command Center локализован:
   RU Центр управления
   AZ İdarəetmə Mərkəzi
   EN Command Center
L. RU/AZ/EN runtime i18n clean
M. no raw i18n keys
N. tests/typecheck/build PASS
O. browser/runtime evidence PASS
P. no unexpected 4xx/5xx
```

При провале любого обязательного gate:

```text
VERDICT B
```

---

# 18. OUT OF SCOPE — HARD STOP

Не выполнять в этой задаче:

- Finance Center;
- FX / Multi-Currency;
- Treasury;
- Partner Settlement;
- Booking KPI semantics;
- новый Analytics implementation;
- Command Center redesign;
- глобальный Design System redesign;
- public marketplace redesign;
- Step 3.12;
- fake counters/KPI;
- новые backend business domains без необходимости.

Payments не добавлять как `Finance Center`, если такого центра ещё нет.

---

# 19. ROADMAP / DOCUMENTATION

Если canonical roadmap требует фиксации remediation:

- обновление только additive;
- не переписывать историю;
- использовать реальные SHA;
- не менять NEXT stage самовольно;
- не объявлять Step 3.12 начатым.

Не считать implementation автоматически прошедшим отдельный Strict Review.

---

# 20. FINAL REPORT

Итоговый отчёт преимущественно на русском языке.

Структура:

```text
# PLATFORM WORKSPACE HOME / DASHBOARD MODERNIZATION

Starting SHA:
Implementation SHA:
Final HEAD:
origin/master:
HEAD == origin:

## Runtime / Repo Inventory
...

## Dashboard vs Command Center vs Analytics
...

## Removed Legacy Content
...

## Workspace Home Cards
Card:
Route:
Permission:
Evidence:

## CRM mini → CRM
...

## Command Center Localization
RU:
AZ:
EN:

## RBAC / Navigation Manifest
...

## Localization Matrix
...

## Route Reconciliation
...

## Accessibility
...

## Tests
...

## Browser Evidence
...

## Residual Gaps
...

## VERDICT
VERDICT A / VERDICT B
```

---

# 21. COMPLETION / GIT

После реализации:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
```

Указать реальные SHA.

Не начинать следующий этап автоматически.

После implementation остановиться для отдельной runtime/strict re-qualification.

---

# EXPECTED RESULT

```text
PLATFORM WORKSPACE

Рабочий стол
/app/dashboard
│
├── Каталог
├── Заказы
├── Бронирования
├── CRM
├── Маркетинг
├── Центр управления
├── Аналитика
├── Поддержка
├── Партнёры
├── Продавцы
└── Пользователи
     (только реально существующие и разрешённые пользователю)

Центр управления
/app/command-center
→ operational/executive view

Аналитика
/app/analytics
→ deep BI
```

Без:

```text
CRM mini
Архитектурные принципы (Baseline)
PostgreSQL/outbox explanations
старых entity-list descriptions
raw Command Center в RU/AZ
future Finance Center card
duplicate access matrices
fake KPI
```
