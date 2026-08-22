# PHASE 3 — STEP 3.2 — STAGE B — PLATFORM COMMAND CENTER UI — IMPLEMENTATION

## Роль

Ты — ведущий full-stack разработчик и архитектор TravelHub. Твоя задача — выполнить **Stage B: Platform Command Center UI** в существующем локальном репозитории TravelHub, проверить результат реальными тестами, опубликовать изменения по принятому в репозитории процессу и выдать доказательный отчёт.

Работай repository-first: документация задаёт контракт, но реальный код, миграции, тесты, история Git и фактические API являются проверяемым источником текущего состояния. При противоречии сначала зафиксируй его, затем выбери решение, сохраняющее безопасность и уже утверждённую архитектуру.

---

## 1. Язык работы и отчёта

Все сообщения о ходе работы, вопросы, решения, пояснения и финальный отчёт должны быть **на русском языке**.

Английский допускается только для:

- исходного кода;
- команд терминала;
- имён файлов и путей;
- имён API, типов, функций, компонентов, permission codes и технических идентификаторов;
- стандартных статусов инструментов и тестов.

Не выдавай англоязычный итоговый отчёт.

---

## 2. Репозиторий и режим выполнения

Работай в **уже существующем локальном клоне**, из которого был выполнен предыдущий этап. Не клонируй проект заново и не начинай работу с чистой копии, если текущий локальный репозиторий доступен.

Идентификатор репозитория для проверки remote:

```text
https://github.com/seldom733-hash/travelhub1
```

Целевая ветка:

```text
master
```

Проверенный baseline на момент подготовки задания:

```text
HEAD:          0f33d034fcc538dfe27e9a267314df0e4b7bf76e
origin/master: 0f33d034fcc538dfe27e9a267314df0e4b7bf76e
Stage A implementation SHA: a69d893b4d96eeccc99cda6d1f9a1906a45d0497
Stage A documentation SHA:  0f33d034fcc538dfe27e9a267314df0e4b7bf76e
```

Успешные CI runs Stage A:

- `32435057755` — SHA `a69d893...`, Backend/Frontend SUCCESS;
- `32436019903` — SHA `0f33d03...`, Backend/Frontend SUCCESS.

GitHub URL здесь нужен только для идентификации upstream и последующей проверки публикации. Основная работа выполняется с текущим состоянием локального репозитория.

### 2.1. Обязательный preflight

До изменений выполни и зафиксируй:

```bash
git rev-parse --show-toplevel
git remote -v
git branch --show-current
git rev-parse HEAD
git rev-parse origin/master
git status --short
git log --oneline --decorate -20
git merge-base --is-ancestor 0f33d034fcc538dfe27e9a267314df0e4b7bf76e HEAD
```

Требования:

1. Подтверди правильный репозиторий и ветку.
2. Если `HEAD` новее указанного baseline, **не откатывай изменения**. Изучи новые коммиты и адаптируй план к актуальному состоянию.
3. Если `HEAD` не содержит baseline в своей истории, остановись с `VERDICT C` и покажи доказательство.
4. Не удаляй и не изменяй предсуществующие untracked-файлы, не относящиеся к Stage B.
5. Не используй destructive commands (`reset --hard`, удаление неизвестных файлов, принудительную перезапись пользовательских изменений).
6. Честно различай:
   - `tracked scope clean`;
   - `repository worktree clean`;
   - наличие предсуществующих untracked-файлов.

---

## 3. Архитектурный контекст, который нельзя менять

TravelHub имеет два разных бизнес-контекста:

| Контекст | Назначение | Монетизация |
|---|---|---|
| `PLATFORM` | TravelHub Marketplace Operator | Комиссия с продаж |
| `PARTNER` | Partner Storefront / Seller | Подписка / SaaS |

Иерархия доступа:

```text
IDENTITY
→ WORKSPACE CONTEXT (PLATFORM | PARTNER)
→ TENANT / PARTNER SCOPE
→ PLAN / ENTITLEMENTS (Basic | Pro)
→ BUSINESS CAPABILITIES
→ ROLE / PERMISSIONS
→ PAGE / WIDGET / ACTION AVAILABILITY
→ USER LAYOUT
```

Этот этап реализует **только Platform Command Center** для внутренних работников TravelHub.

Строго запрещено смешивать в нём:

- Partner Workspace;
- Partner Command Center;
- Storefront subscription onboarding;
- Partner organization switcher;
- Partner storefront navigation;
- Stage C Admin Permission Management;
- Partner entitlements (`Marketplace Basic`, `Storefront Pro`);
- роли `PARTNER` и `BUYER` как пользователей Platform Command Center.

Partner Command Center и Storefront business analytics остаются отдельным будущим scope.

---

## 4. Обязательное repository-first ознакомление

До реализации полностью прочитай и сопоставь с кодом как минимум следующие файлы.

### 4.1. Архитектура и отчёты

```text
docs/architecture/platform-command-center-ui-design-ux-contract-step-3.2.md
docs/architecture/platform-command-center-ui-design-remediation-addendum-step-3.2.md
docs/architecture/platform-command-center-server-side-section-authority-admin-role-permissions-step-3.2.md
docs/architecture/platform-command-center-rbac-seed-admin-override-persistence-contract-step-3.2.md
docs/architecture/platform-vs-partner-workspace-context-model-phase3.md
docs/architecture/global-workspace-constructor-phase3.md
docs/architecture/dashboard-command-center-backend-3.1.md
docs/prompts/PHASE_3_STEP_3.2_STAGE_A_REMEDIATION_EVIDENCE_CLOSURE_REPORT.md
```

### 4.2. Backend authority

```text
backend/src/modules/dashboard/dashboard.controller.ts
backend/src/modules/dashboard/dashboard.service.ts
backend/src/modules/dashboard/dashboard.service.spec.ts
backend/src/modules/workspace/workspace.controller.ts
backend/src/modules/workspace/workspace.service.ts
backend/src/modules/workspace/workspace.types.ts
backend/src/modules/security/permissions.constants.ts
backend/test/dashboard-command-center.e2e-spec.ts
backend/test/workspace-constructor.e2e-spec.ts
backend/test/rbac-parity.e2e-spec.ts
backend/test/e2e-isolated-env.ts
backend/test/e2e.global-setup.ts
backend/test/request-context.e2e-spec.ts
backend/package.json
```

### 4.3. Frontend и существующие паттерны

```text
frontend/app/app/dashboard/page.tsx
frontend/app/app/layout.tsx
frontend/components/Shell.tsx
frontend/components/PageHeader.tsx
frontend/lib/api.ts
frontend/lib/workspace-api.ts
frontend/lib/use-workspace.ts
frontend/lib/use-user.ts
frontend/lib/use-can.ts
frontend/lib/i18n.tsx
frontend/package.json
```

Дополнительно найди через `rg`:

- существующие dashboard, chart, loading, empty, error и permission UI-паттерны;
- все обращения к `command-center`;
- все определения `WidgetDefinition`, `PAGE_REGISTRY`, `WIDGET_REGISTRY`;
- все упоминания 18/19 widgets;
- все permission checks для `analytics.read` и `dashboard.customize`;
- существующие frontend test utilities и accessibility-паттерны.

Не используй каталог `legacy/` как источник решения и не добавляй туда код.

---

## 5. Обязательная коррекция доказательного отчёта Stage A

До production-реализации Stage B исправь фактические неточности в:

```text
docs/prompts/PHASE_3_STEP_3.2_STAGE_A_REMEDIATION_EVIDENCE_CLOSURE_REPORT.md
```

### 5.1. Provenance

Отчёт должен честно фиксировать финальное состояние Round 6:

```text
Implementation SHA: a69d893b4d96eeccc99cda6d1f9a1906a45d0497
Final documentation SHA / HEAD at closure: 0f33d034fcc538dfe27e9a267314df0e4b7bf76e
origin/master at closure: 0f33d034fcc538dfe27e9a267314df0e4b7bf76e
```

Включи оба успешных CI runs, а не только первый.

### 5.2. Retry semantics

Нельзя утверждать `retries = 0`, если в `backend/test/request-context.e2e-spec.ts` реально присутствует последовательный retry-механизм (`MAX_RETRIES = 2` или его актуальный эквивалент).

Сформулируй доказательство честно:

- первоначальная конкурентная партия выполняется один раз;
- неуспешные элементы могут быть повторены последовательно в пределах установленного лимита;
- итоговый контракт требует `finalFailures.length === 0`;
- retries не скрыты и не превращают оставшиеся ошибки в success;
- укажи реальное количество и назначение retry.

Если код уже изменён после baseline, опиши актуальное поведение по факту.

### 5.3. Commit discipline

Сделай эту коррекцию отдельным небольшим docs-only commit до implementation commit, например:

```text
docs(step-3.2): correct Round 6 final provenance and retry semantics
```

Если исправление уже присутствует в актуальном `HEAD`, не делай пустой commit — только покажи доказательство.

---

## 6. Цель Stage B

Создать первый реальный визуальный consumer глобального Workspace Constructor:

```text
/app/command-center
```

Это должен быть production-ready Platform Command Center, который:

- отображает агрегированные marketplace-данные TravelHub;
- получает разрешённые секции только от server-side authority;
- визуально различается для внутренних ролей по effective permissions;
- использует существующий persisted Workspace Layout;
- позволяет авторизованному пользователю настраивать layout;
- не раскрывает unauthorized data ни в UI, ни через лишние backend-вызовы;
- корректно работает на desktop, laptop, tablet и mobile;
- имеет осмысленные loading/empty/error/access-denied состояния;
- интегрирован в левое меню Platform Workspace;
- сохраняет существующий UI language/style и не превращается в отдельный несвязанный дизайн.

После Stage B пользователь должен впервые увидеть реальные визуальные изменения сайта в Platform Workspace.

---

## 7. Утверждённая модель ролей и доступа

### 7.1. Page gate

Главный permission страницы:

```text
analytics.read
```

Без него:

- пункт Command Center не показывается в Platform sidebar;
- прямой переход на `/app/command-center` не должен рендерить страницу с данными;
- backend GET workspace layout/widgets уже обязан вернуть `403`;
- dashboard summary/trends уже защищены page gate.

### 7.2. Section permissions

| Секция | Permission |
|---|---|
| Executive | `dashboard.executive.read` |
| Operational | `dashboard.operational.read` |
| Financial | `dashboard.financial.read` |
| Marketplace | `dashboard.marketplace.read` |

### 7.3. Action permission

```text
dashboard.customize
```

Именно этот permission, а не `widget.permissions` и не наличие layout, определяет доступность действий настройки.

### 7.4. Safe defaults

| Роль | Page | Executive | Operational | Financial | Marketplace | Customize |
|---|---:|---:|---:|---:|---:|---:|
| `ADMIN` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DIRECTOR` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `ANALYST` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `MARKETER` | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `FINANCE` | ❌ | — | — | — | — | — |
| `MODERATOR` | ❌ | — | — | — | — | — |
| `SALES_MANAGER` | ❌ | — | — | — | — | — |
| `OPERATOR` | ❌ | — | — | — | — | — |
| `PARTNER` | ❌ | — | — | — | — | — |
| `BUYER` | ❌ | — | — | — | — | — |

Это default matrix, а не hardcoded role switch в UI. Фактический UI должен опираться на effective permission set пользователя и server response.

Пример: если в БД роли `FINANCE` явно сохранён `analytics.read`, frontend не должен отвергать её только по имени роли. Доступ и секции определяются permissions и ответом сервера.

---

## 8. Server response authority

Используй существующие endpoints:

```http
GET /api/v1/dashboard/command-center
GET /api/v1/dashboard/command-center/trends
```

И существующие Workspace Constructor endpoints для `pageId = command-center`.

### 8.1. Summary

Summary является единым initial data request. Backend возвращает только разрешённые секции и как минимум:

```text
availableSections
availableMetrics
```

Frontend обязан:

- рендерить только секции, реально присутствующие в response и разрешённые `availableSections`;
- не восстанавливать отсутствующие секции из локальной role matrix;
- не считать frontend hiding security mechanism;
- не создавать запрос на отдельный endpoint для каждой карточки;
- не подставлять mock/placeholder values вместо отсутствующей authority.

Unauthorized section должна быть **omitted**, а не отображена заблокированной карточкой с чувствительными названиями или значениями.

### 8.2. Trends

Trends загружаются lazy, только когда соответствующий виджет реально присутствует и metric разрешён сервером.

Фактически поддерживаемый backend allowlist на baseline:

| Metric | Section |
|---|---|
| `orders` | Executive |
| `bookings` | Executive |
| `payments` | Financial |
| `customers` | Marketplace |
| `commissions` | Financial |

Не вызывай unsupported metric.

Критический случай:

```text
WIDGET_REGISTRY содержит revenue-trend,
но backend baseline не поддерживает metric=revenue.
```

Stage B **не должен** тайно подменять revenue другой метрикой и не должен расширять backend analytics authority без отдельного решения.

Безопасный контракт Stage B:

- сопоставлять trend widget с metric из его `dataSource`;
- сверять metric с `availableMetrics` summary response;
- не показывать/не запрашивать trend widget с unsupported metric;
- зафиксировать `revenue-trend` как registry item, временно недоступный из-за отсутствия backend authority;
- покрыть это тестом `revenue trend does not trigger API call`.

Unknown trend metric: `404`. Unauthorized known metric: `403` без вызова analytics provider. Это поведение не ослаблять.

### 8.3. Cancellation and stale responses

Для summary/trends обеспечь:

- отмену устаревшего запроса через `AbortController` или эквивалент существующего API layer;
- защиту от race condition при быстрой смене period/comparison;
- отсутствие обновления state после unmount;
- повторный запрос только по реальному изменению query state;
- отдельный error state для failed trend без разрушения уже загруженной summary.

---

## 9. Данные и визуальные секции

Реализуй четыре секции. Не добавляй секции без backend authority.

### 9.1. Executive Summary

| Widget | Summary field | Назначение |
|---|---|---|
| `gmv` | `gmv` | Gross Merchandise Value |
| `revenue` | `revenue` | Platform Revenue |
| `net-revenue` | `netRevenue` | Net Revenue |
| `orders` | `ordersCreated` | Created Orders |
| `bookings` | `bookingsRequested` | Requested Bookings |
| `aov` | `averageOrderValue` | Average Order Value |
| `conversion` | `conversionRate` | Conversion Rate |

### 9.2. Operational

Используй aggregate widget `funnel`, но внутри него честно покажи доступные operational показатели:

| Summary field | Назначение |
|---|---|
| `ordersFulfilled` | Fulfilled Orders |
| `bookingsConfirmed` | Confirmed Bookings |
| `bookingsCompleted` | Completed Bookings |
| `paymentsCaptured` | Captured Payments |
| `refundsProcessed` | Processed Refunds |
| `funnelConversion` | Funnel Conversion |

Не превращай их в шесть несуществующих registry widgets, если архитектура использует один composite widget.

### 9.3. Financial

| Widget | Summary field |
|---|---|
| `commission` | `commissionAccrued` |
| `reconciliation` | `reconciliationStatus` |
| `payments` | `totalPayments` |
| `net-payments` | `netPayments` |

`reconciliation` является required widget **только внутри авторизованной financial section**.

Это означает:

- пользователь без `dashboard.financial.read` не получает и не видит widget;
- пользователь с financial authority не может навсегда удалить required widget из effective layout;
- reset/restore должен сохранять conditional required semantics;
- frontend не должен самовольно добавлять его пользователю без server authority.

### 9.4. Marketplace

| Widget | Summary field |
|---|---|
| `sessions` | `marketplaceSessions` |
| `storefront-sessions` | `storefrontSessions` |
| `partners` | `activePartners` |
| `customers` | `newCustomers` |

### 9.5. 18/19 widget discrepancy — закрыть в Stage B

На baseline backend registry содержит 18 Command Center widgets, а утверждённый UX contract предусматривает 19. Отсутствует:

```text
storefront-sessions
```

В Stage B разрешено минимальное backend-изменение registry:

```ts
{
  id: 'storefront-sessions',
  section: 'marketplace',
  sectionPermission: 'dashboard.marketplace.read',
  dataSource: 'dashboard.summary.storefrontSessions',
  // остальные поля — по реальному типу и паттернам репозитория
}
```

Точные layout coordinates и размеры выбери по фактической сетке и существующим ограничениям, не создавая overlap.

Обязательно:

- довести Command Center registry до 19 widgets;
- добавить/обновить unit/E2E tests registry filtering и defaults;
- добавить `sectionPermission` в соответствующий frontend type;
- не создавать новый KPI formula;
- не менять dashboard response: поле `storefrontSessions` уже существует;
- не добавлять migration или permission code;
- не менять Stage A section authority.

Это единственное заранее разрешённое backend production change Stage B. Любое другое backend изменение должно быть минимальным, доказанно необходимым для совместимости и отдельно объяснено в отчёте.

---

## 10. Route и Platform navigation

### 10.1. Route

Добавь production route:

```text
frontend/app/app/command-center/page.tsx
```

Разрешается декомпозировать UI на компоненты и hooks в существующих каталогах проекта. Не помещай всю логику в один огромный `page.tsx`.

### 10.2. Sidebar

В `frontend/components/Shell.tsx` добавь Platform menu item:

```text
Command Center → /app/command-center → analytics.read
```

Учитывай фактический механизм NAV и direct-route permission map. Пункт должен:

- быть виден только при effective `analytics.read`;
- корректно подсвечиваться на активном route;
- не появляться у `PARTNER`/`BUYER`;
- не заменять текущий `/app/dashboard`, если архитектура по-прежнему использует dashboard как work-center hub;
- не создавать Partner navigation.

### 10.3. Header

Используй существующий `PageHeader` или расширь его совместимым способом:

- breadcrumb: Platform / Command Center;
- заголовок;
- краткий subtitle;
- period controls;
- comparison toggle;
- `Customize` action только при `dashboard.customize`;
- явный indicator `UTC` без timezone selector.

---

## 11. Period, comparison и URL state

Поддержи presets, согласованные с backend contract:

```text
TODAY
LAST_3_DAYS
LAST_7_DAYS
MONTH
LAST_6_MONTHS
YEAR
CUSTOM
```

### 11.1. Требования

- Default preset определи по архитектурному документу или существующему API contract; зафиксируй выбор в отчёте.
- Comparison включён по умолчанию, если это соответствует текущему contract.
- Query state должен быть воспроизводим через URL: preset, comparison, custom start/end.
- URL не должен содержать секреты или role data.
- Некорректный URL state нормализуется к безопасному default.
- Для `CUSTOM` обязательны start/end.
- `start <= end`.
- Ограничения диапазона должны соответствовать backend validation; не отправляй заведомо недопустимый query.
- Не вызывай API до прохождения client validation custom range.
- Back/forward browser navigation восстанавливает dashboard state.

### 11.2. Timezone

Stage B использует только:

```text
UTC
```

Покажи `UTC` в интерфейсе как fixed reporting timezone. Не создавай:

- timezone dropdown;
- browser-local silent conversion, меняющий границы периода;
- user-selectable timezone;
- настройку timezone в layout.

---

## 12. KPI presentation и comparison semantics

Каждая KPI-card должна различать:

```text
ZERO
NO DATA
NOT APPLICABLE
FORBIDDEN
FAILED
```

Правила:

- числовой `0` показывается как реальное значение `0`, не как empty state;
- `null`/отсутствующее значение не превращается автоматически в `0`;
- unauthorized section вообще не рендерится;
- failure конкретной lazy trend не скрывает summary KPI;
- currency/percent/count форматируются единообразно и locale-aware;
- raw numeric values не мутируются форматтером;
- не выводи `NaN`, `Infinity`, `undefined` или `[object Object]`.

Comparison indicator должен учитывать polarity:

| Metric type | Рост | Падение |
|---|---|---|
| Revenue/GMV/orders/bookings/conversion | positive | negative |
| Refunds | negative | positive |
| Reconciliation status | neutral/state-based | neutral/state-based |

Если backend response не содержит надёжного previous/delta для конкретного поля, не выдумывай процент изменения. Покажи корректный neutral/no-comparison state.

---

## 13. Charts

Установи chart library, уже утверждённую Design Contract:

```text
recharts
```

Обнови `package.json` и lockfile через package manager, принятый в проекте.

Требования к графикам:

- lazy data loading;
- только разрешённые `availableMetrics`;
- responsive container без layout overflow;
- осмысленные axis labels/tooltips;
- доступное текстовое summary или data table/description для screen reader;
- отсутствие animation, вызывающей нестабильные тесты или ухудшающей reduced-motion;
- empty state при пустом series;
- retry только для конкретной failed trend;
- никакого per-point или per-widget request fan-out;
- запрет запроса `revenue`, пока его нет в backend allowlist.

Не добавляй новый analytics engine и не пересчитывай бизнес-метрики на frontend.

---

## 14. Layout customization и DnD

Используй существующий Workspace Constructor и persisted layout endpoints для `pageId = command-center`.

Установи согласованный DnD stack:

```text
@dnd-kit/core
@dnd-kit/sortable
@dnd-kit/utilities
```

Если после repository inspection достаточно меньшего набора пакетов, объясни и докажи это. Не подключай вторую DnD library.

### 14.1. Stage B customization scope

Разрешено:

- reorder widgets;
- hide/remove optional widget;
- add/restore authorized available widget;
- reset layout to role defaults;
- save persisted layout;
- cancel unsaved draft changes;
- dirty-state indication;
- keyboard-accessible reorder.

Deferred:

- resize widgets;
- arbitrary free-form canvas;
- cross-page widgets;
- shared layouts;
- admin-enforced layouts;
- Partner layouts.

Даже если registry содержит `resizable`, **не реализуй resize в Stage B** и не показывай неработающий resize handle.

### 14.2. Authorization

UI настройки доступен только при:

```text
analytics.read AND dashboard.customize
```

Не используй текущий frontend helper, если он ошибочно делает вывод о customization из `widget.permissions`. Исправь/замени его так, чтобы authority исходила из effective permission set.

При отсутствии `dashboard.customize`:

- данные разрешённых секций читаются;
- `Customize`, save/reset/add/remove/reorder controls отсутствуют;
- frontend не вызывает PUT/DELETE;
- read-only layout остаётся работоспособным.

### 14.3. Server reconciliation

После save/reset используй server response как authoritative effective layout. Не считай локальный draft окончательной истиной.

Обработай:

- stale/invalid widget IDs;
- unavailable widget after permission change;
- conditional required reconciliation;
- duplicate widgets;
- rejected PUT/DELETE;
- отмену draft;
- refresh после сохранения;
- смену permissions между sessions.

---

## 15. UX states

Обязательны отдельные состояния:

### 15.1. Initial loading

- skeletons повторяют приблизительную геометрию dashboard;
- нет fake KPI values;
- sidebar/header сохраняют стабильную компоновку;
- не должно быть layout jump из-за каждого widget.

### 15.2. No authorized sections

Если page gate есть, но ни одной section permission фактически нет:

- не показывай пустую сетку;
- выдай нейтральное сообщение об отсутствии доступных разделов;
- не раскрывай названия запрещённых секций;
- не отправляй trends/workspace mutation requests.

### 15.3. No data

- объясни, что за выбранный период данных нет;
- оставь period controls доступными;
- не подменяй no data ошибкой.

### 15.4. Errors

- `401`: использовать существующий auth/session flow;
- `403`: понятный access denied, без утечки section data;
- `404` trend: unsupported/not available, без падения страницы;
- `5xx/network`: retry summary или конкретной trend;
- ошибка layout не должна автоматически скрывать доступные summary data, если возможно безопасное fallback default layout;
- не делай бесконечных automatic retries.

---

## 16. Responsive design

Минимально проверь:

| Viewport | Ожидание |
|---|---|
| 1440px desktop | Полная grid-компоновка, controls в header |
| 1280px laptop | Без horizontal overflow и обрезки KPI |
| 768px tablet | Перестроение grid/controls, usable DnD |
| 390px mobile | Одна колонка или безопасная компактная сетка, touch targets |

Требования:

- отсутствие горизонтального scroll всей страницы;
- длинные локализованные labels не ломают card;
- charts не выходят за container;
- touch targets не менее принятого accessible размера;
- Customize mode остаётся понятным на mobile;
- sidebar behavior соответствует существующему `Shell`.

---

## 17. Accessibility

Минимум:

- semantic headings и regions для секций;
- доступные названия controls;
- keyboard navigation;
- keyboard reorder через `@dnd-kit` sensors;
- focus management при открытии/закрытии customization panel;
- видимый focus;
- `aria-live` для результата save/reset и ошибок, где уместно;
- цвет не является единственным носителем positive/negative state;
- tooltip content доступен без обязательного hover;
- поддержка `prefers-reduced-motion`;
- недоступные actions не маскируются только CSS;
- no axe/obvious role/name violations в компонентных тестах.

---

## 18. Localization

Используй фактический provider и паттерны из:

```text
frontend/lib/i18n.tsx
```

Не создавай параллельную i18n-систему.

Добавь пользовательские строки Command Center минимум для поддерживаемых приложением языков. Технические ID и API enums не локализуются на уровне wire contract.

Форматирование:

- currency — через единый formatter;
- percent — единообразно;
- count — locale-aware;
- date range — locale-aware, но границы и запросы остаются UTC;
- status labels — через translation keys, не через случайные inline strings.

---

## 19. Performance и data orchestration

Контракт:

- один initial summary request;
- workspace layout/widgets могут быть загружены параллельно с summary, если это безопасно;
- lazy trends;
- no per-widget summary fan-out;
- no duplicate request из-за Strict Mode/effect dependency errors;
- memoization только там, где измеримо полезна;
- тяжёлые chart/DnD components допускается грузить динамически, если это улучшает bundle и не ломает SSR;
- period change не должен сбрасывать весь shell/layout;
- stale trend cache не должен отображаться как данные нового диапазона;
- production build не должен содержать client-side secrets.

Не проводи преждевременную архитектурную перестройку всего frontend data layer.

---

## 20. Предполагаемая структура реализации

Точные имена адаптируй к репозиторию, но поддерживай разделение ответственности. Ожидаемый change map может включать:

```text
frontend/app/app/command-center/page.tsx
frontend/components/Shell.tsx
frontend/components/command-center/*
frontend/lib/dashboard-api.ts                  # если нет подходящего клиента
frontend/lib/workspace-api.ts
frontend/lib/use-workspace.ts
frontend/lib/i18n.tsx
frontend/package.json
frontend/package-lock.json
frontend/**/*.test.ts(x)

backend/src/modules/workspace/workspace.types.ts
backend/src/modules/workspace/*.spec.ts
backend/test/workspace-constructor.e2e-spec.ts  # только если нужно для 19-го widget contract

docs/prompts/PHASE_3_STEP_3.2_STAGE_A_REMEDIATION_EVIDENCE_CLOSURE_REPORT.md
docs/prompts/PHASE_3_STEP_3.2_STAGE_B_PLATFORM_COMMAND_CENTER_UI_IMPLEMENTATION_REPORT.md
```

Не создавай файлы только ради соответствия списку. Сначала найди реальные project patterns.

---

## 21. Запрещённый scope

Не выполнять в этом задании:

- Stage C Admin Permission Management UI/API;
- Partner Command Center;
- Partner onboarding/subscription/contract/payment flow;
- organization switcher;
- workspace context schema;
- employee membership model;
- entitlement model;
- resize;
- создание новых dashboard permissions;
- изменение safe default role matrix;
- runtime synchronization `RolePermission` с `ROLE_PERMISSIONS`;
- новую Prisma migration;
- новые KPI formulas;
- замену backend analytics authority;
- fake data, случайные demo numbers или production mocks;
- release/deploy в production;
- изменение `legacy/`;
- широкую переработку несвязанных страниц;
- автоматический переход к следующему этапу после отчёта.

---

## 22. Обязательные тесты Stage B

Добавь тесты, которые проверяют поведение, а не только snapshots.

### 22.1. Frontend API и query state

Проверь:

1. корректное формирование summary query для каждого preset;
2. `CUSTOM` требует valid start/end;
3. invalid URL state нормализуется;
4. comparison отражается в query;
5. fixed UTC и отсутствие timezone selector;
6. stale request отменяется/игнорируется;
7. trend вызывается только для supported `availableMetrics`;
8. `revenue-trend` не вызывает API;
9. error одной trend не уничтожает summary;
10. zero не превращается в empty.

### 22.2. RBAC и section filtering

Проверь effective behavior:

| Actor/permissions | Ожидаемый UI |
|---|---|
| `ADMIN` defaults | 4 секции, customize |
| `DIRECTOR` defaults | 4 секции, customize |
| `ANALYST` defaults | 4 секции, customize |
| `MARKETER` defaults | только Executive + Marketplace, customize |
| `FINANCE` defaults | нет sidebar item / route denied |
| пользователь с `analytics.read`, без sections | page shell + no available sections state |
| пользователь с section permissions, без `dashboard.customize` | read-only, no mutation controls |

Не хардкодь проверку только по имени роли — в тестах используй permission fixtures.

### 22.3. Widget/layout

Проверь:

1. registry содержит ровно 19 Command Center widgets после remediation;
2. `storefront-sessions` относится к Marketplace и фильтруется section authority;
3. add/remove/reorder optional widgets;
4. keyboard reorder;
5. cancel откатывает draft;
6. save использует server effective response;
7. reset использует server effective response;
8. `reconciliation` нельзя окончательно удалить при financial authority;
9. `reconciliation` не восстанавливается без financial authority;
10. unauthorized/stale widget не рендерится;
11. duplicate widget IDs безопасно обрабатываются;
12. resize controls отсутствуют.

### 22.4. UX/accessibility/navigation

Проверь:

- Shell показывает новый item только при `analytics.read`;
- active route;
- semantic section headings;
- accessible names для period/comparison/customize controls;
- loading skeleton;
- no data;
- no authorized sections;
- `401`, `403`, `5xx` states по существующему auth/error contract;
- responsive class/structure для узких экранов;
- отсутствие очевидных accessibility violations доступными project tools.

### 22.5. Backend regression для минимального registry change

Проверь:

- `storefront-sessions` присутствует;
- marketplace permission filtering;
- role defaults после добавления widget;
- 19-widget parity;
- conditional reconciliation не изменён;
- persisted layout reconciliation не сломан.

---

## 23. Верификация

Используй реальные команды из `package.json` и существующей CI configuration. Ниже — обязательный минимум; если scripts называются иначе, покажи фактические команды.

### 23.1. Static checks

```bash
git diff --check
```

Frontend:

```bash
cd frontend
npm ci
npx tsc --noEmit
npm test -- --run
npm run build
```

Backend:

```bash
cd backend
npm ci
npx tsc --noEmit
npm run build
```

### 23.2. Targeted tests

Запусти:

- новые frontend Command Center tests;
- существующие workspace hooks/API tests;
- backend unit tests registry/workspace/dashboard;
- targeted E2E `dashboard-command-center`;
- targeted E2E `workspace-constructor`;
- RBAC parity, если registry/default change затрагивает соответствующий contract.

### 23.3. Full regression

После targeted green:

- весь backend unit suite;
- весь frontend Vitest suite;
- frontend production build;
- full serial backend E2E в существующей per-suite isolated DB environment;
- Prisma migration status;
- schema drift check;
- CI workflow после push.

Не отменяй per-suite DB isolation и не возвращай общую E2E DB ради ускорения. Не меняй serial/parallel strategy без доказательства. Не скрывай flaky/failing tests retries, exclusions, `|| true`, waivers или уменьшением assertions.

### 23.4. Migration evidence

Ожидается:

```text
Migration count: 60
New migrations: 0
Pending migrations: 0
Schema drift: 0
```

Если фактический baseline уже изменился, укажи реальные значения и происхождение новых миграций. Stage B сам миграцию создавать не должен.

---

## 24. Визуальная проверка

Это визуальный этап. Одних unit tests недостаточно.

Запусти production-like frontend или preview с реальным backend/test fixture способом, принятым в проекте, и проверь минимум:

| Role/profile | Viewports |
|---|---|
| ADMIN/full authority | 1440, 1280, 768, 390 |
| MARKETER/default authority | 1440, 768, 390 |
| read-only analytics user | минимум 1440 и 390 |

Проверь:

- фактическую видимость секций;
- отсутствие Financial/Operational у MARKETER;
- отсутствие unauthorized data в DOM;
- период и comparison;
- fixed UTC;
- chart rendering;
- customize flow;
- keyboard reorder;
- mobile overflow;
- loading/empty/error state;
- сохранение layout после reload.

Сохрани доказательства способом, принятым в репозитории. Не коммить большие бинарные файлы без необходимости. В отчёте укажи:

- точный способ запуска;
- URL;
- viewport;
- role/permission fixture;
- что было проверено;
- пути к screenshots, если они созданы.

Если screenshot/browser tooling реально недоступен, не выдумывай результат: зафиксируй ограничение и выполни максимально доступную DOM/component/build проверку. Для `VERDICT A` всё равно требуется убедительное visual acceptance evidence, а не фраза «должно работать».

---

## 25. Security negative checks

Обязательно докажи:

- unauthorized section отсутствует в response/DOM;
- frontend не вызывает trends для unauthorized/unsupported metric;
- `MARKETER` не инициирует financial provider/trend requests;
- пользователь без `dashboard.customize` не инициирует PUT/DELETE;
- прямой route без `analytics.read` не раскрывает dashboard;
- Partner/Buyer не получают Platform Command Center menu;
- ошибки не выводят token, stack trace, connection string или raw server payload пользователю;
- никакие client bundles не содержат secrets;
- frontend hiding не описывается как security boundary.

---

## 26. Commit, push и CI

Используй последовательность независимых commits:

1. docs correction Stage A evidence — если требуется;
2. Stage B implementation + tests;
3. Stage B evidence closure report.

Примерные сообщения:

```text
docs(step-3.2): correct Round 6 final provenance and retry semantics
feat(step-3.2): implement Platform Command Center UI
docs(step-3.2): add Stage B implementation evidence report
```

Не используй `--force` и не переписывай опубликованную историю.

После локальных green gates:

1. закоммить только файлы scope;
2. проверь commit diff и parentage;
3. push по текущему принятому repository workflow;
4. дождись CI именно для финального SHA;
5. если CI failed — получи реальные logs/artifacts, исправь root cause, повтори проверки и push;
6. не опрашивай GitHub через длинные блокирующие `sleep 600`; используй короткий/разумный polling и сообщай статус;
7. не объявляй success, пока final SHA CI не завершился успешно;
8. в конце проверь:

```bash
git rev-parse HEAD
git rev-parse origin/master
git ls-remote origin refs/heads/master
git status --short
git diff --check HEAD^ HEAD
```

Не удаляй предсуществующие untracked files.

---

## 27. Evidence report

Создай:

```text
docs/prompts/PHASE_3_STEP_3.2_STAGE_B_PLATFORM_COMMAND_CENTER_UI_IMPLEMENTATION_REPORT.md
```

Отчёт должен содержать:

1. Repository State с полными SHA;
2. исследованный baseline;
3. коррекцию Stage A evidence;
4. реализованные UI sections/widgets;
5. route/navigation;
6. API orchestration;
7. RBAC/section behavior;
8. 18→19 widget reconciliation;
9. DnD/customization behavior;
10. accessibility/responsive/localization evidence;
11. performance/security negative checks;
12. все запущенные команды и честные результаты;
13. targeted/full E2E counts;
14. migration/drift evidence;
15. visual acceptance evidence;
16. список изменённых файлов по типам;
17. commits;
18. final CI URL, SHA, jobs и conclusions;
19. tracked/untracked worktree state;
20. deferred scope и следующий этап.

Запрещены:

- pending placeholders;
- выдуманные screenshots;
- округлённые test counts, если доступны точные;
- `PASS` для не запускавшейся команды;
- «pre-existing» без доказательства ancestry/reproduction;
- `worktree clean`, если есть untracked files;
- waiver при реально не закрытом blocking defect.

---

## 28. Условия verdict

### VERDICT A — STAGE B COMPLETED

Допустим только если одновременно:

- route и визуальный Platform Command Center реально реализованы;
- четыре секции работают по server authority;
- MARKETER видит только разрешённые секции;
- 19-widget discrepancy закрыта;
- unsupported revenue trend не запрашивается;
- customization работает и защищена `dashboard.customize`;
- resize не реализован;
- frontend/backend targeted tests green;
- полный frontend suite/build green;
- полный backend unit/E2E green;
- migration/drift green;
- visual acceptance выполнен;
- финальный CI SHA завершился SUCCESS;
- commits pushed и remote SHA проверен;
- blocking defects отсутствуют.

### VERDICT B — SYSTEM/INFRA FAILURE

Только при доказанном внешнем/инфраструктурном сбое, не вызванном изменениями Stage B. Нужны команды, logs и reproduction evidence.

### VERDICT C — BLOCKED / NOT COMPLETED

Если:

- baseline несовместим;
- CI final SHA failed;
- blocking tests failed;
- visual UI не реализован;
- security contract нарушен;
- потребовалось расширение scope, которое нельзя безопасно принять без нового решения.

Не выдавай `VERDICT A` с исключениями или обещанием «исправить позже».

---

## 29. Точный формат финального ответа

Финальный ответ — **только на русском языке**, в Markdown, в следующем формате:

````markdown
## PHASE 3 — STEP 3.2 — STAGE B — PLATFORM COMMAND CENTER UI — VERDICT [A/B/C]

### Repository State

| Field | Value |
|---|---|
| Repository | `https://github.com/seldom733-hash/travelhub1` |
| Branch | `master` |
| Base SHA | `<full SHA>` |
| Final implementation SHA | `<full SHA>` |
| Final report SHA | `<full SHA>` |
| HEAD | `<full SHA>` |
| origin/master | `<full SHA>` |
| ls-remote master | `<full SHA>` |
| Tracked scope | `<state>` |
| Untracked files | `<honest state>` |

### Stage A Evidence Correction

| Item | Result |
|---|---|
| Final provenance | `<result>` |
| Both CI runs | `<result>` |
| Retry semantics | `<result>` |

### Implemented Platform Command Center

| Area | Result |
|---|---|
| Route and navigation | `<result>` |
| Executive section | `<result>` |
| Operational section | `<result>` |
| Financial section | `<result>` |
| Marketplace section | `<result>` |
| Period/comparison/UTC | `<result>` |
| Trends | `<result>` |
| Customization/DnD | `<result>` |
| Responsive/a11y/i18n | `<result>` |

### RBAC Evidence

| Actor / permission set | Visible sections | Customize | Result |
|---|---|---:|---|
| ADMIN defaults | `<sections>` | `<yes/no>` | `<result>` |
| DIRECTOR defaults | `<sections>` | `<yes/no>` | `<result>` |
| ANALYST defaults | `<sections>` | `<yes/no>` | `<result>` |
| MARKETER defaults | `<sections>` | `<yes/no>` | `<result>` |
| Without analytics.read | `<state>` | `<state>` | `<result>` |
| analytics.read without customize | `<sections>` | `No` | `<result>` |

### Widget Registry Reconciliation

| Check | Result |
|---|---|
| Before | `18` |
| After | `19` |
| Added widget | `storefront-sessions` |
| Section authority | `dashboard.marketplace.read` |
| Unsupported revenue trend API calls | `0` |

### Test and Build Evidence

| Gate | Result |
|---|---|
| Backend typecheck | `<result>` |
| Backend build | `<result>` |
| Backend unit | `<exact suites/tests/result>` |
| Targeted E2E | `<exact suites/tests/result>` |
| Full serial E2E | `<exact suites/tests/result>` |
| Frontend typecheck | `<result>` |
| Frontend Vitest | `<exact suites/tests/result>` |
| Frontend production build | `<result>` |
| DB migrations | `<count/status>` |
| Schema drift | `<result>` |
| git diff --check | `<result>` |

### Visual Acceptance

| Profile | Viewports | Result |
|---|---|---|
| ADMIN/full authority | `<viewports>` | `<result/evidence>` |
| MARKETER/default | `<viewports>` | `<result/evidence>` |
| Read-only analytics user | `<viewports>` | `<result/evidence>` |

### CI Evidence

| Run | SHA | Backend | Frontend | Conclusion |
|---|---|---|---|---|
| `<URL/ID>` | `<SHA>` | `<result>` | `<result>` | `<result>` |

### Files Changed

| Type | Count | Files |
|---|---:|---|
| Production frontend | `<count>` | `<files>` |
| Production backend | `<count>` | `<files>` |
| Tests | `<count>` | `<files>` |
| Dependencies | `<count>` | `<files>` |
| Documentation | `<count>` | `<files>` |

### Commits

| SHA | Description |
|---|---|
| `<sha>` | `<description>` |

### Deferred

- Stage C Admin Permission Management.
- Partner Command Center.
- Partner Storefront subscription/onboarding/analytics.
- Resize and advanced layout capabilities.
- Unsupported trends without backend authority.

### NEXT

```text
NEXT: PHASE 3 — STEP 3.2 — STAGE B — STRICT REVIEW & VISUAL ACCEPTANCE
```
````

Если verdict не `A`, секция `NEXT` должна указывать устранение конкретного blocker, а не следующий архитектурный этап.

---

## 30. Главное правило завершения

Stage B — это не очередной design document. Результатом должны быть **видимые production code changes** в сайте, реальные server-authorized данные, role-aware UI, тесты, visual evidence и успешный CI.

Не переходи к Stage C и не начинай Partner Workspace. После финального отчёта остановись и дождись отдельного промпта на строгий review.
