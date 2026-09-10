# PHASE 3 — DETAIL ROUTE IDENTIFIER CONTRACT AUDIT & NORMALIZATION PROMPT

## 0. Режим работы

Работать **audit-first**.

Цель этого задания — не просто заменить UUID на business code или наоборот, а сначала установить **canonical contract** для detail URL и только после доказанного контракта выполнять нормализацию.

Нельзя:
- придумывать новый identifier contract без архитектурного обоснования;
- считать `id`, `code`, `referenceNumber` взаимозаменяемыми;
- унифицировать маршруты только ради визуального единообразия;
- менять database schema без доказанной необходимости;
- менять RBAC/authentication/tenant isolation;
- затрагивать другие доменные сущности вне scope;
- переопределять ранее утверждённые архитектурные решения.

Если canonical contract уже существует в repository documentation, implementation и tests должны быть приведены именно к нему.

Если canonical contract **не существует или противоречив**, сначала зафиксировать GAP и провести reconciliation. Не делать speculative implementation.

---

# 1. Context

В текущем TravelHub замечено потенциальное расхождение detail routes:

- Payment detail использует business code, например:
  `/app/payments/PAY-00000084`
- Orders detail реализован через:
  `/app/orders/[id]`
- Bookings detail реализован через:
  `/app/bookings/[id]`

При этом внутри системы могут одновременно существовать:

- internal UUID / database primary key;
- business code;
- reference number;
- public slug;
- human-readable display identifier.

Нельзя предполагать, что один из этих вариантов является canonical для всех сущностей.

---

# 2. Canonical sources — ОБЯЗАТЕЛЬНО ПРОВЕРИТЬ ПЕРВЫМИ

Перед анализом кода прочитать актуальные canonical documents:

1. `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
2. `docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md`
3. `docs/prompts/TRAVELHUB_MASTER_ROADMAP.md`
4. соответствующие domain/architecture documents для:
   - Requests
   - Orders
   - Bookings
   - Payments
   - identifiers / references / public IDs / routing
5. ранее утверждённые implementation prompts и qualification reports, если они явно относятся к identifier/routing contract.

Отдельно выполнить поиск по repository по терминам:

```text
businessCode
referenceNumber
reference
publicId
externalId
identifier
UUID
:id
[id]
slug
request code
order code
booking code
payment code
PAY-
ORD-
BOOK-
REQ-
```

Также искать формулировки:

```text
canonical identifier
external identifier
business identifier
URL identifier
detail route
route contract
public identifier
human-readable identifier
```

**Не считать имя файла достаточным доказательством.** Извлечь конкретные утверждения и их источник.

---

# 3. Scope

Анализировать только четыре домена:

### 3.1 Requests

Проверить:
- Request entity/model;
- API detail endpoint;
- frontend route;
- links/navigation;
- DTO;
- service methods;
- query/repository lookup;
- tests;
- отображаемый business identifier.

### 3.2 Orders

Проверить:
- Order entity/model;
- API detail endpoint;
- frontend route;
- links/navigation;
- DTO;
- service methods;
- query/repository lookup;
- tests;
- отображаемый business identifier.

### 3.3 Bookings

Проверить:
- Booking entity/model;
- API detail endpoint;
- frontend route;
- links/navigation;
- DTO;
- service methods;
- query/repository lookup;
- tests;
- отображаемый business identifier.

### 3.4 Payments

Проверить:
- Payment entity/model;
- API detail endpoint;
- frontend route;
- links/navigation;
- DTO;
- service methods;
- query/repository lookup;
- tests;
- `PAY-*` contract;
- distinction between payment internal ID and payment business code.

---

# 4. Identifier taxonomy — ОБЯЗАТЕЛЬНО ЗАФИКСИРОВАТЬ

Для каждой сущности построить таблицу:

| Entity | Internal DB ID | Business Code | Reference Number | Public ID | URL identifier | Display identifier |
|---|---|---|---|---|---|---|
| Request | | | | | | |
| Order | | | | | | |
| Booking | | | | | | |
| Payment | | | | | | |

Для каждого поля ответить:

1. Где создаётся?
2. Где хранится?
3. Является ли unique?
4. Является ли immutable?
5. Используется ли во внешних API?
6. Используется ли в frontend URL?
7. Используется ли как display label?
8. Может ли измениться?
9. Разрешён ли lookup напрямую по нему?
10. Есть ли security/privacy implication?

---

# 5. Canonical URL rule

Необходимо определить для каждой сущности один из вариантов:

### Option A — internal UUID

```text
/app/orders/<uuid>
/app/bookings/<uuid>
```

### Option B — business code

```text
/app/orders/ORD-00000123
/app/bookings/BOOK-00000123
/app/payments/PAY-00000084
```

### Option C — entity-specific canonical identifier

Например:

```text
Request  → REQ-...
Order    → ORD-...
Booking  → BOOK-...
Payment  → PAY-...
```

### Option D — другой уже утверждённый контракт

Использовать только при наличии repository evidence.

**Нельзя вводить Option C только ради эстетической симметрии.**

---

# 6. Основной принцип

Нужно различать:

```text
Internal ID
        ↓
database relation / authorization / joins

Business Identifier
        ↓
domain reference / human recognition / operational workflows

URL Identifier
        ↓
frontend route / external navigation / deep links

Display Identifier
        ↓
table / card / header / search results
```

Они могут совпадать, но **не обязаны совпадать**.

---

# 7. Audit текущего состояния

Для каждого домена построить цепочку:

```text
UI list/card
   ↓
click/link
   ↓
frontend route
   ↓
route parameter
   ↓
frontend API request
   ↓
backend controller
   ↓
service
   ↓
repository/query
   ↓
database identifier
```

Зафиксировать фактический путь без предположений.

Пример:

```text
Payment row
→ /app/payments/PAY-00000084
→ GET /finance/payments/PAY-00000084
→ controller param = code
→ service.findByCode(code)
```

Аналогично для Request, Order и Booking.

---

# 8. Особое внимание — UI links

Найти все места, которые создают detail links:

```text
/app/requests/*
/app/orders/*
/app/bookings/*
/app/payments/*
```

Проверить:

- таблицы;
- карточки;
- command center;
- dashboards;
- search results;
- notifications;
- breadcrumbs;
- related entities;
- CRM references;
- sales;
- bookings;
- orders;
- payment screens;
- mobile/responsive UI;
- deep links.

Нельзя исправить только сам `[id]` route и оставить старые ссылки.

---

# 9. Backend contract

Для каждой сущности установить:

### Variant 1

```http
GET /resource/:id
```

где `:id` = UUID.

### Variant 2

```http
GET /resource/:code
```

где `:code` = business code.

### Variant 3

Endpoint умеет оба варианта.

Если backend умеет оба варианта, определить:

- какой canonical;
- какой legacy;
- какой должен использовать frontend;
- нужно ли сохранять backward compatibility.

Не расширять API «на всякий случай», если существующий контракт однозначен.

---

# 10. Security / tenancy

Для любого URL identifier обязательно проверить:

- authorization;
- permission checks;
- tenant/workspace isolation;
- object ownership;
- IDOR resistance;
- cross-tenant access;
- existence leakage;
- not-found behavior;
- enumeration risk.

Особенно важно:

**Замена UUID на business code не должна ослабить object-level authorization.**

Backend должен проверять authorization независимо от того, какой identifier используется в URL.

Проверить сценарии:

```text
valid identifier + authorized user
valid identifier + unauthorized user
other tenant identifier
non-existent identifier
malformed identifier
valid format but wrong entity
```

---

# 11. Backward compatibility

Если текущие URL уже могли использоваться пользователями, нельзя просто ломать маршруты.

Нужно определить:

### Case A — URL ещё internal-only / development

Можно сделать controlled normalization.

### Case B — URL уже используется

Нужна migration strategy:

```text
old UUID URL
    ↓
resolve old URL
    ↓
redirect / canonical route
```

или другой repository-approved механизм.

Не вводить redirect без доказательства необходимости.

---

# 12. Search / lookup semantics

Проверить различие между:

```text
findById()
findByCode()
findByReferenceNumber()
```

и не делать опасную универсализацию:

```text
findByAnyIdentifier(param)
```

если она может:
- скрывать ошибки;
- создавать ambiguous lookup;
- ухудшать authorization;
- усложнять индексы;
- нарушать domain contract.

Если polymorphic lookup уже существует, доказать его безопасность тестами.

---

# 13. Frontend naming

Если canonical URL использует business code, рекомендуется устранить misleading naming типа:

```text
[id]
```

если фактически параметр означает:

```text
code
```

Например:

```text
/app/payments/[code]
```

Но переименование делать только вместе с фактическим contract update и ссылками.

Если canonical contract использует UUID — оставить `[id]` или использовать repository-approved naming.

---

# 14. Не смешивать URL и display

Например:

```text
URL:
 /app/orders/ORD-00001234

Header:
 Order ORD-00001234

Database:
 8e6...uuid

Relationship:
 orderId = 8e6...uuid
```

Это нормально, если именно так определён canonical contract.

Не менять database relations только ради URL.

---

# 15. Acceptance criteria

Работа считается выполненной только если для Requests, Orders, Bookings и Payments:

1. Canonical identifier определён документально или подтверждён существующим contract.
2. Frontend route соответствует canonical identifier.
3. Все primary navigation links используют canonical route.
4. Backend detail endpoint принимает canonical identifier.
5. Repository/service lookup соответствует contract.
6. Display identifier не перепутан с internal ID.
7. Authorization/tenant isolation сохраняются.
8. Legacy behavior обработан, если он реально существует.
9. Tests покрывают happy path и negative/security cases.
10. Нет параллельного competing identifier contract.

---

# 16. Обязательная матрица результата

В qualification report создать:

| Entity | Current URL | Current backend lookup | Canonical identifier | Required change | Risk | Tests |
|---|---|---|---|---|---|---|
| Request | | | | | | |
| Order | | | | | | |
| Booking | | | | | | |
| Payment | | | | | | |

Отдельная таблица:

| Contract | Source | Evidence | Status |
|---|---|---|---|
| Request URL identifier | | | |
| Order URL identifier | | | |
| Booking URL identifier | | | |
| Payment URL identifier | | | |
| Backward compatibility | | | |

---

# 17. Результаты аудита

Использовать только один из статусов:

### VERDICT A — CANONICAL CONTRACT CONFIRMED

Canonical rules однозначны, implementation соответствует или изменения очевидны.

### VERDICT B — CONTRACT GAP / RECONCILIATION REQUIRED

Документация недостаточна или contradictory.

В этом случае:

- не выполнять массовую normalization;
- сформулировать exact architecture gap;
- указать conflicting sources;
- предложить минимальное решение;
- остановиться до утверждения contract.

### VERDICT C — IMPLEMENTATION DEFECT

Contract существует и однозначен, но code/UI не соответствует.

В этом случае можно переходить к targeted implementation.

---

# 18. Если contract gap найден

Если обнаружено, что TravelHub нигде явно не определяет URL identifier policy, создать только:

```text
docs/reports/PHASE_3_DETAIL_ROUTE_IDENTIFIER_CONTRACT_AUDIT.md
```

и не менять код.

В отчёте обязательно сформулировать proposed contract:

```text
Internal ID:
Business Identifier:
URL Identifier:
Display Identifier:
Lookup method:
Authorization boundary:
Backward compatibility:
```

Но пометить его как:

```text
PROPOSED — NOT YET CANONICAL
```

Не называть proposed decision canonical до отдельного acceptance.

---

# 19. Если contract подтверждён

Только в этом случае выполнить targeted implementation.

Изменять только то, что необходимо:

- frontend dynamic routes;
- API lookup parameter;
- frontend API calls;
- navigation links;
- route tests;
- relevant e2e tests;
- documentation of already-established contract, если она неполная.

Не затрагивать:

- schema;
- migrations;
- RBAC model;
- permissions;
- business lifecycle;
- unrelated domains;
- D8 temporal work;
- finance PSP architecture;
- CRM architecture.

---

# 20. Required tests

Минимально:

### Functional

```text
open Request detail
open Order detail
open Booking detail
open Payment detail
```

### Identifier

```text
canonical identifier resolves
invalid identifier → correct 4xx
non-existing identifier → 404
wrong identifier type → correct validation/not-found behavior
```

### Security

```text
same-tenant authorized → allowed
same-tenant unauthorized → denied
cross-tenant → denied / neutral not-found according to contract
```

### Navigation

Проверить переходы из:

- list;
- table;
- card;
- dashboard;
- related entity;
- search;
- notification, если существует.

### Regression

```text
npm run typecheck
npm run lint
npm run build
```

и repository-approved test suite.

---

# 21. Browser/runtime verification

Обязательно проверить реальный runtime, а не только source code.

Для каждой сущности зафиксировать:

```text
List page
→ click detail
→ resulting URL
→ network request
→ backend response
→ detail rendered
```

Проверить минимум:

```text
Request
Order
Booking
Payment
```

---

# 22. Documentation

Если итоговый contract уже существовал, не создавать новую competing architecture document.

Обновить только canonical documentation, если qualification выявила documentation gap.

Отдельный report:

```text
docs/reports/PHASE_3_DETAIL_ROUTE_IDENTIFIER_QUALIFICATION_REPORT.md
```

В report обязательно указать:

- baseline SHA;
- canonical sources;
- audit evidence;
- final contract;
- changed files;
- tests;
- browser verification;
- security verification;
- final SHA;
- GitHub sync status;
- explicit verdict.

---

# 23. Git governance

Перед изменением:

```text
git status
git rev-parse HEAD
git log -1 --oneline
```

После изменения:

```text
git status
git diff --check
git diff --stat
git diff
```

Затем:

```text
git add ...
git commit -m "fix: normalize detail route identifiers"
git push
```

Если contract gap найден и implementation не выполняется, commit должен содержать только audit/qualification documentation.

После push обязательно проверить:

```text
HEAD == origin/master
working tree clean
```

---

# 24. Final report format

В конце отчёта использовать:

```text
# FINAL VERDICT

VERDICT: A / B / C

Canonical identifier policy:
- Request:
- Order:
- Booking:
- Payment:

Implementation:
- changed:
- unchanged:

Security:
- authorization:
- tenant isolation:
- IDOR:

Compatibility:
- legacy URLs:
- migration/redirect:

Tests:
- unit:
- integration:
- e2e:
- typecheck:
- build:

Browser verification:
- Request:
- Order:
- Booking:
- Payment:

Git:
- baseline SHA:
- final SHA:
- origin/master:
- clean tree:

Next action:
...
```

---

# 25. Ключевое правило

**Не исходить из предположения, что все четыре сущности должны использовать одинаковый тип identifier.**

Правильный результат может быть:

```text
Request  → UUID
Order    → ORD-...
Booking  → BOOK-...
Payment  → PAY-...
```

или:

```text
Request  → REQ-...
Order    → ORD-...
Booking  → BOOK-...
Payment  → PAY-...
```

или любой другой вариант — **но только если это подтверждено canonical architecture/domain contract**.

Сначала установить истину.

Потом менять implementation.

Не наоборот.
