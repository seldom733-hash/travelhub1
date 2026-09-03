# PHASE 3 — PRE-STEP 3.12 — REQUEST CENTER UI/UX + SEARCH + ENTITY DISPLAY + DETAIL PAGE + TABLE LAYOUT + PLATFORM SIDEBAR IA — REMEDIATION

## Цель

Выполнить единый узкий remediation текущего **Platform Request Center** (`/app/requests`) по фактически обнаруженным runtime/UI дефектам.

Этот этап **не является redesign бизнес-процесса Request → Order → Booking → Payment** и не должен ломать уже реализованный Shared Commerce Sequence, SLA/TTL, tenant isolation, canonical references или Platform/Storefront scope.

Нельзя объявлять `VERDICT A` только потому, что код компилируется или unit tests проходят. Требуется authenticated browser runtime evidence для каждого пользовательского сценария ниже.

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**, включая Implementation/Remediation/Strict Review/Evidence Reports, Gap Audit, findings, root cause analysis, architecture/security decisions, runtime evidence, conclusions и verdict explanations.

Английский разрешён только для технических идентификаторов: file paths, class/method/DTO/model/table names, API endpoints, HTTP methods/status codes, CLI/Git commands, commit messages, enums, permission identifiers, code snippets и стандартизированных строк `VERDICT`.

**Hard acceptance criterion:** преимущественно английский отчёт = задача незавершена до исправления отчёта.

Не помещать plaintext passwords, secrets, tokens или credentials в отчёты. Использовать placeholders/redaction.

## 1. PRE-FLIGHT

До изменений зафиксировать `git status`, `git rev-parse HEAD`, `git rev-parse origin/master`, текущую ветку и не потерять пользовательские изменения.

Проверить фактическую реализацию `/app/requests`, Request API/DTO/query, search backend, Request routing, Workspace sidebar manifest/config и CSV/XLSX export.

Зафиксировать authenticated runtime `/app/requests`. Runtime имеет приоритет над устаревшими отчётами: страница `/app/requests` фактически существует.

## 2. SCOPE GUARD

Сохранить:

```text
Request → Order → Booking → Payment
```

Hard invariants:

```text
Supplier CONFIRMED ≠ automatic final Booking creation
Price change → explicit customer acceptance → no silent higher-price Order
Internal UUID ≠ Business Identifier ≠ Primary Display Value
Partner → PRN-*
Customer → CRM-*
```

Не смешивать Storefront customer commerce с Platform Marketplace commerce.

## 3. КОНТРАСТ REQUEST CENTER

Исправить фактически наблюдаемый крайне низкий контраст основной области `/app/requests`: заголовок, KPI, labels, таблица и данные почти белые на светлом фоне.

Найти root cause: inherited colors, theme tokens, opacity, overlays, table/card styles, dark/light theme leakage, shared components. Не накладывать бессистемные локальные CSS hacks.

После исправления читаемы page title, KPI, filters, table headers/cells, pagination, auxiliary text и buttons. Dark sidebar не ломать.

## 4. SEARCH INPUT

Исправить белый/почти белый typed text на белом фоне. Проверить typed text, placeholder, caret, focus/hover/disabled states и clear control/icon.

## 5. ENTITY DISPLAY — НИКАКИХ TRUNCATED UUID

Сейчас `Клиент / Услуга / Поставщик` визуально показывают фрагменты внутренних UUID. Это запрещённый primary display.

### Клиент

```text
ФИО / display name
CRM-* как secondary identity, где полезно
```

### Услуга

```text
Название услуги/продукта
business/catalog code, если существует
```

### Поставщик

```text
Название партнёра/поставщика
PRN-* как secondary identity
```

Если Request DTO отдаёт только FK/UUID, расширить server-side projection/DTO. **Не создавать frontend N+1 fetch pattern.** Tenant isolation и permission checks сохранить server-side.

## 6. SEARCH CONTRACT

Доказать и обеспечить server-side поиск минимум по:

1. `MKT-REQ-*`;
2. customer display name;
3. `CRM-*`;
4. service/product title;
5. service/catalog code, если применимо;
6. supplier/company name;
7. `PRN-*`.

Partial textual search для names/titles, case-insensitive где уместно. Pagination работает на filtered result. Не делать поиск только по текущей UI page.

Добавить backend integration/e2e tests для каждой search dimension.

## 7. КЛИК ПО НОМЕРУ ЗАЯВКИ

`MKT-REQ-*` должен быть интерактивным business identifier:

```text
/app/requests
→ click MKT-REQ-XXXXXXXX
→ dedicated Request Detail page
```

No-op запрещён.

## 8. HARD UX CONTRACT — НИКАКОЙ ПРАВОЙ ПАНЕЛИ

Принятый project-wide pattern:

```text
Operational registry
→ canonical business reference click
→ dedicated full-page entity screen
```

Для Request использовать `/app/requests/{requestId-or-safe-route-key}` и полноценную страницу.

Основной detail flow **не реализовывать** через right drawer, side panel, modal или overlay.

## 9. REQUEST DETAIL PAGE — MINIMUM

Показать:

- canonical Request reference, status, createdAt;
- customer display name + `CRM-*`;
- service/product title + relevant code + service date/options snapshot;
- supplier name + `PRN-*`;
- витринную цену/валюту;
- подтверждённую цену;
- supplier confirmation/response timestamp;
- indication of price change;
- supplier SLA deadline/response;
- customer TTL/accepted timestamp/timeout where applicable;
- реальные lifecycle milestones;
- для converted Request связанные Order → Booking → Payment(s) canonical references.

Связи определять по FK/UUID, а не парсингом reference strings. Ссылки на CRM/Partner/Order/Booking/Payment делать только если соответствующий route реально существует.

## 10. НОВАЯ КОЛОНКА «ДАТА ПОДТВЕРЖДЕНИЯ»

Порядок:

```text
№ заявки
Клиент
Услуга
Поставщик
Цена витрины
Подтверждённая цена
Дата подтверждения
Дата услуги
Статус
Создана
SLA дедлайн
```

`Дата подтверждения` ≠ `updatedAt`.

Использовать существующий canonical supplier response/confirmation timestamp. Если подтверждения нет — `—`. Не добавлять DB field, если корректный timestamp уже существует.

## 11. HORIZONTAL TABLE SCROLL

Таблица шире viewport — это нормально. Контракт:

```text
PAGE
├ title/KPI/filter/export — в viewport
└ TABLE CONTAINER
   └ overflow-x: auto
      └ table with sensible min-width
```

Запрещены whole-page horizontal scroll, нечитаемое сжатие всех колонок и скрытие важных desktop columns только ради overflow.

## 12. CSV / XLSX

Сохранить exports и проверить после DTO/search/table remediation.

Если canonical export = filtered population:

```text
current filters/search → filtered total = CSV rows = XLSX rows
```

В export должны быть human-readable customer/service/supplier identities и canonical references; truncated UUID не должен быть primary operator-facing value.

## 13. PLATFORM SIDEBAR IA — NAMING

Оставить специальное название `Центр управления`.

Переименовать:

```text
Центр заявок → Заявки
```

Не вводить `Центр заказов` и `Центр бронирований`.

Принцип:

```text
Центр управления = cross-domain Command Center
Заявки / Заказы / Бронирования = domain registries/workspaces
```

## 14. PLATFORM SIDEBAR — ПОРЯДОК И ГРУППЫ

Целевая IA текущих существующих Platform modules:

```text
Рабочий стол
Центр управления
Аналитика

ОПЕРАЦИИ
  Заявки
  Заказы
  Бронирования

КОММЕРЧЕСКОЕ УПРАВЛЕНИЕ
  Каталог
  CRM
  Маркетинг

ПАРТНЁРСКАЯ СЕТЬ
  Партнёры
  Продавцы

СЕРВИС
  Поддержка

АДМИНИСТРИРОВАНИЕ
  Пользователи
```

Перед финальным закреплением `Партнёры` и `Продавцы` проверить фактическую domain semantics routes. Не объединять/переименовывать вслепую.

Не показывать future modules. Не добавлять Finance Center ради полноты меню.

## 15. SIDEBAR VISUAL CONTRACT

Group headings должны быть компактными, muted, явно не clickable и иметь разумные отступы.

Active state должен корректно работать для `/app/requests` и `/app/requests/*`, включая Request Detail.

Сохранить существующую collapsible/shared sidebar architecture. Не создавать второй sidebar framework.

## 16. SECURITY / TENANT ISOLATION

Проверить Platform permission enforcement, tenant/scope isolation shared services, direct URL protection, search scope и detail endpoint scope.

Frontend hiding не является security control. `acquisitionSource` не использовать как единственный authorization boundary.

## 17. TESTS — MANDATORY

Backend минимум:

- search by Request reference;
- customer name / `CRM-*`;
- service title/code;
- supplier name / `PRN-*`;
- scope/permission isolation;
- detail endpoint;
- human-readable DTO projection;
- confirmation timestamp semantics;
- pagination under search/filter.

Frontend минимум:

- human-readable Client/Service/Supplier;
- no truncated UUID as primary value;
- Request reference link;
- dedicated detail navigation;
- no drawer primary flow;
- new confirmation-date column;
- sidebar `Заявки` + headings/order + detail active state;
- horizontal table container behavior where testable.

Не изменять tests для маскировки regression.

## 18. AUTHENTICATED BROWSER RUNTIME — HARD GATE

`VERDICT A` запрещён без authenticated browser verification.

На `/app/requests` доказать:

- normal contrast;
- readable search input;
- customer names;
- service titles;
- supplier names;
- secondary canonical codes where intended;
- `Дата подтверждения`;
- horizontal table scroll;
- отсутствие whole-page horizontal overflow;
- usable CSV/XLSX.

Search runtime scenarios:

1. `MKT-REQ-*`;
2. customer name;
3. `CRM-*`;
4. service title;
5. supplier name;
6. `PRN-*`.

Detail:

```text
click MKT-REQ-* → dedicated page → refresh → same detail page
```

Проверить direct URL, client navigation, refresh и отсутствие right drawer.

Sidebar: новое `Заявки`, headings/order, active state list/detail.

## 19. EXPORT RUNTIME EVIDENCE

Применить representative search/filter, зафиксировать filtered total, реально скачать CSV и XLSX, проверить data-row counts, canonical references и human-readable customer/service/supplier values.

Наличие кнопки ≠ доказательство рабочего export.

## 20. НЕ СМЕШИВАТЬ С SEED CLOSURE

Не использовать этот remediation для скрытого изменения Shared Commerce Sequence, seed chronology, currency/refund/payment ordinal rules, Request lifecycle или Product Freshness.

Настоящий domain blocker оформить отдельным finding, без незапрошенного redesign.

## 21. REGRESSION

Запустить backend/frontend typecheck/build/tests и targeted suites. Отчёт содержит реальные `PASS / FAIL / SKIP` и counts.

Нельзя писать только `pre-existing` без exact failing tests/suites, baseline evidence и сравнения Starting SHA vs Final SHA.

Если общий suite красный, `VERDICT A` разрешён только при доказанном project acceptance contract, допускающем неизменившийся baseline failure. Иначе `VERDICT B`.

## 22. IMPLEMENTATION REPORT

Создать отдельный Markdown report преимущественно на русском языке с разделами:

```text
Starting SHA
Final SHA
origin/master
Scope
Findings
Root Cause
Implementation
API/DTO Changes
Search Contract
Entity Display Contract
Request Detail Routing
Request Detail Page
Table Layout
Confirmation Date Semantics
Sidebar IA
Security / Scope
Tests
Authenticated Browser Runtime
Export Evidence
Residual Gaps
Roadmap Update
Final Verdict
```

Использовать реальные routes, HTTP results, screenshots/evidence и test counts. Secrets/passwords redacted.

## 23. ROADMAP

Обновить `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` только additive update. Не переписывать историю и не ставить `COMPLETED — VERDICT A` до прохождения всех hard gates. Использовать реальные commit SHA.

## 24. ACCEPTANCE MATRIX

`VERDICT A` разрешён только если одновременно:

```text
[ ] /app/requests readable
[ ] Search input text readable
[ ] Customer human-readable
[ ] Service human-readable
[ ] Supplier human-readable
[ ] No truncated UUID as primary identity
[ ] Search by Request reference PASS
[ ] Search by customer PASS
[ ] Search by CRM-* PASS
[ ] Search by service PASS
[ ] Search by supplier PASS
[ ] Search by PRN-* PASS
[ ] Request reference click PASS
[ ] Dedicated Request Detail page PASS
[ ] No right drawer/modal as primary detail PASS
[ ] Direct detail URL PASS
[ ] Detail refresh PASS
[ ] Confirmation date column PASS
[ ] Correct confirmation timestamp semantics PASS
[ ] Horizontal table scroll PASS
[ ] No whole-page horizontal overflow PASS
[ ] CSV export runtime PASS
[ ] XLSX export runtime PASS
[ ] Sidebar "Заявки" PASS
[ ] Sidebar grouping/order PASS
[ ] Active sidebar state on detail PASS
[ ] Scope/permission tests PASS
[ ] Targeted backend tests PASS
[ ] Targeted frontend tests PASS
[ ] Authenticated browser runtime PASS
[ ] Report predominantly Russian PASS
[ ] Real Final SHA recorded
[ ] origin/master state recorded
[ ] Roadmap additive update completed
```

Любой недоказанный hard item → `VERDICT B`.

## 25. FINAL VERDICT FORMAT

Только:

```text
VERDICT A — REQUEST CENTER UI/UX + SEARCH + ENTITY DISPLAY + DETAIL PAGE + TABLE LAYOUT + PLATFORM SIDEBAR IA — COMPLETED
```

или:

```text
VERDICT B — REQUEST CENTER UI/UX + SEARCH + ENTITY DISPLAY + DETAIL PAGE + TABLE LAYOUT + PLATFORM SIDEBAR IA — INCOMPLETE
```

При `VERDICT B` перечислить конкретные blockers.

## 26. STOP RULE

После implementation → tests → authenticated browser runtime → export verification → report → roadmap update → commit/final SHA → verdict: **STOP**.

Не начинать автоматически Product Freshness, Partner Performance Attribution, Booking KPI Semantics, Finance Center, PRE-STEP 3.12 final requalification, STEP 3.12 или следующие roadmap stages.
