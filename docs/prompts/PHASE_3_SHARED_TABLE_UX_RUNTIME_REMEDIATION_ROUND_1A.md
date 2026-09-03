# PHASE 3 — SHARED TABLE UX + OPERATIONAL NOTES
## RUNTIME REMEDIATION — ROUND 1A
### CATALOG + ORDERS + BOOKINGS + USERS + CRM OPERATIONAL NOTES
### LOCALIZATION + KPI AUTHORITY + DATE RANGE + USER DATE + COLUMN GEOMETRY + ALIGNMENT + NOTES REGRESSION
### ЯЗЫК ОТЧЁТА: РУССКИЙ

## 1. ЦЕЛЬ И СТАТУС
Baseline: Shared Table UX Consistency Closure, commit `8124509`.

Developer verdict по `8124509` был A, но пользовательская runtime-проверка выявила незакрытые дефекты. Поэтому текущая квалификация этого closure: `VERDICT B — REMEDIATION REQUIRED`.

Не откатывать `8124509`. Не переписывать работающие части. Не начинать CRM Activity Round 2C.

## 2. ПОДТВЕРЖДЁННЫЕ FINDINGS
1. Catalog / Orders / Bookings: карточки, кнопки, поиск, фильтры, заголовки и содержимое таблиц не локализованы полностью для RU/AZ/EN.
2. Catalog / Orders / Bookings: 3 последние KPI-карточки из 4 считают текущую страницу вместо полного matching dataset.
3. Orders / Bookings: заголовок `Сумма` визуально не согласован по horizontal alignment с денежными cells.
4. Основные таблицы не имеют стабильной фиксированной геометрии колонок.
5. Users: карточки, кнопки, поиск, фильтры, table headers/cells не локализованы; отсутствует дата регистрации/создания пользователя.
6. CRM Operational Notes стали недоступны — требуется regression re-qualification существующей реализации, НЕ повторная реализация.
7. Новое согласованное требование: date-range filtering `С — По`.

## 3. GIT SYNC GATE
До любых изменений:
```bash
git fetch origin
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/master
git log --oneline --decorate -25
```
Требования: `master`, tracked worktree clean, `HEAD == origin/master`, `8124509` присутствует в history. При divergence — STOP, не merge/rebase/reset/force автоматически.

## 4. ROOT CAUSE FIRST
До patching заполнить:
| Finding | Runtime reproduced | Root cause | Layer/files | Fix |
|---|---|---|---|---|
| Catalog localization | | | | |
| Orders localization | | | | |
| Bookings localization | | | | |
| Catalog KPI | | | | |
| Orders KPI | | | | |
| Bookings KPI | | | | |
| Amount alignment | | | | |
| Stable widths | | | | |
| Users localization | | | | |
| Users date | | | | |
| Operational Notes | | | | |

Наличие i18n keys/backend params не является runtime proof.

## 5. RU/AZ/EN LOCALIZATION CLOSURE
Для `/app/catalog`, `/app/orders`, `/app/bookings`, `/app/users` локализовать и runtime-проверить:
- KPI/cards: titles, labels, subtitles/tooltips;
- buttons/actions;
- search placeholder/label/clear;
- filter labels, `Все`, options, selected values;
- table headers;
- table cell enums/status/type/payment status/role;
- loading/empty/no-results/error states;
- pagination/actions/accessibility labels.

Raw enums (`PUBLISHED`, `IN_PROCESSING`, `ACTIVE`, `SALES_MANAGER` и т.п.) не должны показываться пользователю вместо localized labels.

Переключить реально в браузере RU → AZ → EN.

Матрица:
| Page | Cards | Buttons | Search | Filters | Headers | Cells | RU | AZ | EN | PASS |
|---|---|---|---|---|---|---|---|---|---|---|
| Catalog | | | | | | | | | | |
| Orders | | | | | | | | | | |
| Bookings | | | | | | | | | | |
| Users | | | | | | | | | | |

## 6. KPI DATA AUTHORITY — P0/P1 CORRECTNESS
Для Catalog / Orders / Bookings провести audit всех 4 KPI.

Запрещено:
```text
KPI = currentPageRows.filter(...).length
```

Нужно:
```text
current authorization + search + business filters
                ↓
       FULL MATCHING DATASET
          ├── aggregates/KPI
          └── paginated table rows
```

`page/pageSize/cursor` не должны менять KPI.

Search/filter могут менять KPI только согласно бизнес-семантике текущей выборки, но всегда по полному matching dataset.

Предпочтительно backend aggregate/summary query или list response с server-side aggregates. Запрещено fetch-all на frontend, огромный pageSize, client loop по страницам и N+1.

Матрица:
| Page | KPI | Old source | Canonical authority | Filter-aware | Page-independent | PASS |
|---|---|---|---|---|---|---|
| Catalog | KPI 1–4 | | | | | |
| Orders | KPI 1–4 | | | | | |
| Bookings | KPI 1–4 | | | | | |

Runtime proof: page 1 → page 2 → last page при тех же filters: KPI неизменны. Затем применить filter/search: KPI пересчитываются по всей filtered selection. Минимум один KPI на страницу сверить независимым DB/API aggregate proof.

## 7. DATE RANGE FILTERING
Добавить server-side `С — По`:

- Catalog → canonical publication timestamp (`publishedAt` только если реально authority; не маскировать `createdAt` под публикацию).
- Orders → `createdAt`, если schema подтверждает.
- Bookings → `createdAt`, если schema подтверждает.
- Users → canonical registration/creation timestamp после semantic audit.
- CRM Customers / Partners → провести audit. Если canonical creation timestamps существуют и это естественный list filter — включить; иначе `N/A` с причиной.

Поддержать: from only, to only, both, neither. `from > to` → validation error, не silent swap.

`dateTo` должен быть inclusive calendar date: предпочтительно `timestamp < startOfNextDay(dateTo)` с корректной timezone authority.

Filtering server-side. URL сохраняет date range. Range комбинируется с search/status/type/paymentStatus/role/sort/page. Изменение range → page 1. Проверить refresh, copied URL, Back/Forward.

Матрица:
| Page | Field | From | To | Inclusive end | Server-side | URL | PASS |
|---|---|---|---|---|---|---|---|
| Catalog | | | | | | | |
| Orders | | | | | | | |
| Bookings | | | | | | | |
| Users | | | | | | | |
| CRM Customers | | | | | | | |
| CRM Partners | | | | | | | |

## 8. USERS DATE
Определить semantic authority:
- если `User.createdAt` честно соответствует созданию/регистрации аккаунта → label `Дата регистрации`;
- если нет → label `Дата создания`;
- если существует canonical `registeredAt` → использовать его.

Не добавлять migration без доказанной необходимости.

Колонка должна быть localized, sortable server-side при наличии canonical field, null=`—`, иметь date-range filter.

В report:
```text
Canonical field:
Semantic rationale:
User-facing label RU/AZ/EN:
Sort:
Filter:
```

## 9. AMOUNT HEADER ALIGNMENT
Orders и Bookings: header `Сумма` и monetary cells должны иметь единый horizontal alignment. Исправить shared root cause, если проблема в SortableHeader/header API, а не случайным локальным hack.

## 10. STABLE COLUMN GEOMETRY
Для Catalog, Orders, Bookings, Users и regression-check CRM Customers/Partners.

`fixed` означает stable widths, НЕ sticky/frozen.

Требования:
- width не зависит от текущих данных;
- ASC/DESC не меняет width;
- filters/search/page не меняют width;
- RU/AZ/EN не вызывают jumping;
- sort arrow не меняет geometry;
- widths осмыслены по типам данных;
- long name/title/email/code → controlled nowrap/ellipsis с доступом к полному значению;
- narrow viewport → horizontal scroll, а не разрушение сетки.

Использовать shared mechanism (`table-layout: fixed` + `colgroup`/shared column definitions/semantic width tokens) в соответствии с текущей архитектурой. Не назначать всем колонкам одинаковую ширину.

Матрица:
| Table | Initial | ASC | DESC | Filter | Page 2 | RU/AZ/EN | Narrow | PASS |
|---|---|---|---|---|---|---|---|---|
| Catalog | | | | | | | | |
| Orders | | | | | | | | |
| Bookings | | | | | | | | |
| Users | | | | | | | | |
| CRM Customers | | | | | | | | |
| CRM Partners | | | | | | | | |

## 11. OPERATIONAL NOTES — REGRESSION RE-QUALIFICATION
НЕ создавать заново модель, migration, API, permissions или parallel component.

Проверить существующие:
- Prisma model/migrations;
- module/controller/service;
- GET/POST/PATCH/DELETE parent-scoped API;
- canonical `operational-notes.*` permissions;
- Permission/RolePermission rows;
- frontend API client;
- shared OperationalNotes component;
- detail-page wiring;
- frontend permission gates;
- current authenticated actor/role.

Классифицировать:
`REAL_REGRESSION / EXPECTED_RBAC_DENIAL / FRONTEND_VISIBILITY_BUG / PERMISSION_SEED_MIGRATION_BUG / API_RUNTIME_BUG`.

Runtime surfaces:
| Surface | Visible | GET | Create | Edit | Delete | RBAC correct | PASS |
|---|---|---|---|---|---|---|---|
| Customer 360 | | | | | | | |
| Partner 360 | | | | | | | |
| Order detail | | | | | | | |
| Booking detail | | | | | | | |
| Product detail | | | | | | | |

Если действие роли не разрешено — `N/A / expected deny`, а не FAIL.

Не ослаблять security: authorUserId/timestamps/visibility/entityType/entityId server authority, parent scope, ownership + ADMIN override, audit logging, max 5000, plain-text/XSS safety. Notes не меняют business state parent.

Определить root cause и по возможности first bad SHA (`exact / likely / not determinable`). Если defect подтверждён — минимальный fix + regression test.

## 12. FILTER/SORT REGRESSION
После remediation реально видны:
- Catalog: Тип + Статус + Дата публикации С/По;
- Orders: Статус заказа + Статус оплаты + Дата создания С/По;
- Bookings: Статус + Дата создания С/По;
- Users: Статус + Роль + Дата регистрации/создания С/По;
- CRM: согласно date audit.

Сохранить shared sorting: single-column; None→ASC→DESC→ASC; new sort replaces old; sort/filter→page 1; server-side; stable tie-breaker; URL persistence.

## 13. API/RUNTIME PROOF
Для каждого date range:
- unfiltered total;
- from-only;
- to-only;
- full range;
- boundary-day example;
- invalid from>to.

Для KPI:
- page 1 values;
- page 2 values;
- same filters → same KPI;
- filtered KPI;
- independent aggregate proof.

Для Notes:
- authorized role;
- unauthorized role;
- API status;
- browser visibility;
- CRUD according to permissions.

## 14. ACCESSIBILITY
Проверить filter/date labels, localized aria-labels, `aria-sort`, keyboard sorting, focus visibility, overflow full-value accessibility.

## 15. TESTS
Добавить focused behavior tests:
- localization/enum rendering where project style supports;
- KPI pagination independence + filter-aware aggregates + authorization scope;
- dateFrom/dateTo/both/inclusive end/invalid range/timezone boundary;
- URL persistence;
- Users date column/sort/filter;
- shared geometry/alignment where testable;
- Operational Notes actual regression + existing CRUD/RBAC.

Не заменять behavior tests snapshot-only tests.

## 16. REGRESSION GATES
Обязательно:
```text
Backend TSC
Backend build
relevant backend tests
Catalog/Orders/Bookings/Users relevant tests
Operational Notes tests
CRM relevant tests
full backend suite

Frontend TSC
Frontend build
relevant frontend tests
full frontend suite
```
Дать exact counts. Historical perf flaky не blanket waiver. Каждый fail классифицировать.

Отдельно зафиксировать frontend test count; ранее наблюдались 199/199 и затем 243/243. Не допускать необъяснимого исчезновения suites/tests.

## 17. BROWSER RUNTIME VERIFICATION
Обязательно browser/runtime:
- Catalog RU/AZ/EN + filters/date + KPI page1/page2 + widths;
- Orders RU/AZ/EN + filters/date + KPI + Amount alignment + widths;
- Bookings аналогично;
- Users RU/AZ/EN + date column/filter + widths;
- Customer/Partner/Order/Booking/Product Notes;
- narrow viewport для таблиц.

Source-code inspection без runtime proof недостаточен.

## 18. CHANGE BOUNDARY
Разрешено менять только необходимое: Catalog/Orders/Bookings/Users list backend/frontend, CRM list только если нужен date filter, существующий Operational Notes wiring/RBAC при доказанном defect, shared table/i18n/API types, focused tests, report/roadmap.

Запрещено: unrelated redesign, duplicate Notes architecture, unrelated schema refactor, CRM Activity Round 2C.

## 19. REPORT
Создать:
`docs/prompts/PHASE_3_SHARED_TABLE_UX_RUNTIME_REMEDIATION_ROUND_1A_REPORT.md`

Отчёт полностью на русском.

Roadmap должен честно зафиксировать:
```text
8124509 — initial developer VERDICT A
runtime re-qualification found gaps
Round 1A remediation required
```
После успешного Round 1A:
`Shared Table UX Consistency + Runtime Remediation — FINAL CLOSED`.

Operational Notes отмечать как `runtime regression re-qualified/restored`, не как новую реализацию.

## 20. ACCEPTANCE
VERDICT A только если:
1. Git sync PASS, master, HEAD==origin/master.
2. Все 4 list pages реально локализованы RU/AZ/EN: cards/buttons/search/filters/headers/cells.
3. Raw user-facing enums/i18n keys отсутствуют.
4. Catalog/Orders/Bookings KPI считаются по full matching dataset, не current page.
5. KPI не меняются от pagination и корректно реагируют на filters/search.
6. Catalog/Orders/Bookings/Users date authority доказана.
7. Users date column добавлена с честной семантикой.
8. Date range from/to/both/inclusive end/invalid range работает server-side и сохраняется в URL.
9. Orders/Bookings Amount alignment исправлен.
10. Stable widths доказаны для Catalog/Orders/Bookings/Users и regression-check CRM.
11. Sort/filter/search/pagination не меняют widths.
12. Narrow viewport horizontal scroll работает.
13. Operational Notes root cause классифицирован.
14. Customer/Partner/Order/Booking/Product Notes contract runtime-проверен.
15. Notes RBAC/security не ослаблены.
16. Если regression был реальным — minimal fix + regression test.
17. Нет duplicate Notes schema/API/permissions.
18. Browser evidence есть.
19. Backend TSC/build/relevant/full tests выполнены честно.
20. Frontend TSC/build/relevant/full tests выполнены честно.
21. Test count объяснён, accidental loss отсутствует.
22. Report и final response на русском.
23. Commit/push выполнен.
24. Final HEAD == origin/master.
25. Нет unresolved P0/P1 в scope.
26. Round 2C не начат.

## 21. VERDICT
Успех только:
```text
VERDICT A — PHASE 3 /
SHARED TABLE UX + OPERATIONAL NOTES /
RUNTIME REMEDIATION ROUND 1A /
CATALOG + ORDERS + BOOKINGS + USERS + CRM /
FULL RU/AZ/EN LOCALIZATION +
FULL-DATASET KPI AUTHORITY +
SERVER-SIDE DATE RANGE FILTERING +
USER REGISTRATION/CREATION DATE +
STABLE COLUMN GEOMETRY +
MONEY HEADER ALIGNMENT +
OPERATIONAL NOTES REGRESSION CLOSURE /
FULLY IMPLEMENTED AND RUNTIME-VERIFIED
```

Иначе:
```text
VERDICT B — PHASE 3 /
SHARED TABLE UX + OPERATIONAL NOTES /
RUNTIME REMEDIATION ROUND 1A /
IMPLEMENTATION OR RUNTIME EVIDENCE INCOMPLETE
```

No conditional VERDICT A.

## 22. FINAL RESPONSE — ТОЛЬКО НА РУССКОМ
Вернуть:
```text
VERDICT:

GIT SYNC GATE
Repository:
Branch:
Starting HEAD:
origin/master:
HEAD == origin/master:
Worktree:

ROOT CAUSE MATRIX
...

ИСПРАВЛЕНИЯ
Catalog:
Orders:
Bookings:
Users:
Operational Notes:

LOCALIZATION MATRIX
...
KPI AUTHORITY MATRIX
...
KPI RUNTIME PROOF
...
DATE AUTHORITY MATRIX
...
DATE RANGE MATRIX
...

USERS DATE DECISION
Canonical field:
Semantic rationale:
Label RU/AZ/EN:
Sort:
Filter:

HEADER ALIGNMENT
Orders Amount:
Bookings Amount:

COLUMN GEOMETRY MATRIX
...

OPERATIONAL NOTES ROOT CAUSE
Classification:
First bad SHA:
Cause:
Fix:

OPERATIONAL NOTES RUNTIME MATRIX
...
OPERATIONAL NOTES SECURITY
...

URL PERSISTENCE
...
PERFORMANCE / QUERY AUTHORITY
...
ACCESSIBILITY
...
BROWSER RUNTIME EVIDENCE
...

РЕГРЕССИЯ
Backend TSC:
Backend build:
Relevant backend:
Operational Notes:
Full backend:
Frontend TSC:
Frontend build:
Relevant frontend:
Full frontend:
Frontend test count:

ИЗМЕНЁННЫЕ ФАЙЛЫ
...
ROADMAP UPDATE
...
Report:
Commit:
Final HEAD:
origin/master:
HEAD == origin/master:

ОСТАВШИЕСЯ ПРОБЛЕМЫ
P0:
P1:
P2:

FINAL STATUS:
NEXT:
```

## 23. NEXT / STOP
Только после VERDICT A вернуться к:
`PHASE 3 — STEP 3.5.3 — ROUND 2C — CUSTOMER 360 ACTIVITY UI + LEGACY HISTORY MIGRATION/REPLACEMENT + FILTER/CURSOR UX + EXACT ENTITY NAVIGATION`.

После implementation + runtime verification + report + roadmap sync + commit + push + `HEAD == origin/master` — STOP. Round 2C в этом run не начинать.
