# PHASE 3 — D8 FINAL RE-QUALIFICATION
## Evidence Closure & Final Verdict

## 1. Назначение

Этот этап является **только финальной re-qualification / evidence closure** для уже реализованного D8 — Global Temporal Visibility.

Не расширять функциональный scope D8. Не добавлять новые temporal features, schema changes, migrations, RBAC changes или lifecycle-authority changes.

Цель: закрыть доказательный пробел текущего `VERDICT B — VALID SYSTEM FAIL` и определить окончательный статус D8.

Текущий implementation qualification report:
`docs/reports/PHASE_3_D8_GLOBAL_TEMPORAL_VISIBILITY_IMPLEMENTATION_QUALIFICATION_REPORT.md`

Текущий отчёт указывает:
- backend qualification: 5 suites / 114 tests passed;
- production frontend build passed;
- отсутствовало authenticated browser/runtime smoke testing;
- отсутствовало полное security/tenant qualification evidence;
- текущий verdict: `B — VALID SYSTEM FAIL`.

## 2. Обязательная governance-последовательность

Перед началом:

1. Прочитать:
   - `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
   - `docs/prompts/TRAVELHUB_MASTER_ROADMAP.md`
   - `docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md`
   - `docs/architecture/temporal-readiness.md`
   - текущий D8 implementation qualification report.
2. Проверить `git status` и текущий HEAD.
3. Зафиксировать baseline SHA.
4. Не менять canonical roadmap и не переименовывать/перенумеровывать существующие этапы.
5. Не выбирать следующий этап до окончательного D8 verdict.

## 3. Frozen D8 contract

Проверять реализацию строго против уже принятых контрактов.

### 3.1 Date query parameters

Для поддержанных registry/query filters:
- `dateFrom`
- `dateTo`

Должны:
- принимать только реальные календарные даты `YYYY-MM-DD`;
- разрешать отсутствие/пустое значение как отсутствие соответствующей границы;
- резолвиться сервером в UTC midnight;
- отклонять malformed/invalid dates до database read;
- возвращать canonical HTTP 400 через `BadRequestException`;
- сообщение должно соответствовать `<paramName> must be a valid date`;
- сохранять стандартную форму exception response и `X-Request-Id`.

Особенно проверить:
- Requests
- Orders
- Bookings
- Payments
- CRM Activity
- CRM customers
- Catalog
- поддержанные exports, где D8 contract применим.

Проверить отдельно, что изменение Payments query-param boundary на 400 **не изменяет Finance payload validation**, где 422 остается доменным контрактом.

### 3.2 Operations Period

Проверить:
- URL-authoritative period;
- серверное разрешение;
- UTC-midnight boundaries;
- полуинтервал `[from,to)`;
- единый scope для Requests KPI и Requests table;
- browser local timezone не должен сдвигать бизнес-границу.

### 3.3 Global temporal vocabulary

Проверить, что implementation соответствует зафиксированной терминологии в:
`docs/architecture/temporal-readiness.md`

Не создавать конкурирующий temporal contract/document.

### 3.4 Cross-domain semantics

Проверить только существующие frozen semantics:
- Requests / Orders / Bookings: default `createdAt`;
- Booking upcoming: `serviceDate`;
- Payments: default `createdAt`, explicit `paidAt`;
- CRM Activity: `occurredAt`;
- CRM customers: related `Order.createdAt` activity;
- Catalog: `publishedAt`.

Intentional Catalog end-of-day и CRM Activity inclusive event-feed behavior не считать дефектом.

### 3.5 Timezone

Проверить, что D8 не изменил frozen timezone authority.

Должно сохраняться:
- UTC storage для instant values;
- Product IANA service timezone как frozen service-time authority;
- browser/runtime timezone только для display;
- существующий `shared/service-time.ts` не изменён без доказанного дефекта.

DST и cross-midnight поведение проверяется как evidence, а не расширяется новым алгоритмом.

## 4. Обязательное authenticated browser/runtime testing

Поднять необходимый stack и выполнить реальную authenticated smoke-проверку.

Минимально проверить UI/API surfaces:
1. Requests
2. Orders
3. Bookings
4. Payments
5. CRM Activity
6. CRM customers
7. Catalog
8. Analytics

Для каждой поверхности проверить, где применим temporal filter:
- initial/default state;
- explicit `dateFrom`;
- explicit `dateTo`;
- оба параметра;
- invalid `dateFrom`;
- invalid `dateTo`;
- boundary behavior;
- обновление URL;
- серверное применение filter;
- отсутствие timezone-induced off-by-one.

Не ограничиваться unit tests или static inspection. Нужен runtime evidence.

Для каждого проверенного surface записать:
- route;
- authenticated role/user;
- input;
- expected result;
- actual result;
- pass/fail;
- при необходимости screenshot/log/API evidence.

## 5. RBAC / tenant / security qualification

Проверить, что D8 temporal predicates являются additive к существующим policy/scope predicates.

Обязательно проверить:
- разрешённый пользователь получает только разрешённый temporal-filtered dataset;
- отсутствие permission не даёт bypass через temporal query params;
- tenant isolation не нарушается;
- смена `dateFrom/dateTo` не позволяет получить данные другого tenant/scope;
- malformed dates не доходят до database reads;
- existing guards/policies остаются активны.

Не менять permissions, roles, guards или tenant model.

## 6. Regression checks

Выполнить:
- focused D8 tests;
- существующие relevant frontend/backend tests;
- production build;
- `git diff --check`;
- `git diff --stat`;
- `git diff --name-only`.

Отдельно зафиксировать известный locale discrepancy с `az-AZ` и `₼`, если он по-прежнему воспроизводится. Не исправлять его в рамках D8, если он не связан с temporal implementation.

## 7. Scope discipline

В рамках этой re-qualification запрещены:
- новые schema fields;
- migrations;
- изменение lifecycle authority;
- изменение RBAC model;
- новый Settings/Reference Data функционал;
- изменение Finance PSP milestone design;
- реализация KPI formulas;
- изменение D9 export standardisation;
- новый temporal algorithm без отдельного доказанного defect.

Если обнаружен реальный defect, связанный именно с D8, не маскировать его и не расширять произвольно scope. Зафиксировать его отдельно с severity, reproduction и ownership.

## 8. Git closure

После validation:
1. показать changed files;
2. показать diff summary;
3. подтвердить отсутствие неожиданных изменений;
4. создать commit только для необходимых D8 qualification/report changes;
5. push в canonical branch;
6. подтвердить:
   - final SHA;
   - `HEAD == origin/<canonical-branch>`;
   - clean working tree.

Не считать этап закрытым без Git evidence.

## 9. Final Qualification Report

Создать:
`docs/reports/PHASE_3_D8_FINAL_REQUALIFICATION_REPORT.md`

Документ должен содержать:

### 9.1 Executive Summary
Что квалифицировалось и какой был исходный evidence gap.

### 9.2 Baseline / Final SHA
Baseline SHA, final SHA, branch и origin parity.

### 9.3 Environment
Backend/frontend/runtime/DB/authenticated test setup.

### 9.4 Browser Smoke Matrix
Таблица по всем требуемым surfaces:
route / role / temporal case / expected / actual / result / evidence.

### 9.5 API / Validation Matrix
dateFrom/dateTo validity, HTTP status, error shape, DB-read prevention.

### 9.6 Operations Period Evidence
`[from,to)`, UTC boundary, URL authority, KPI/table consistency.

### 9.7 Temporal Semantics Evidence
Cross-domain semantics и timezone authority.

### 9.8 Security / Tenant / RBAC Evidence
Policy/scope preservation и negative tests.

### 9.9 Regression / Build Evidence
Tests, build, diff checks.

### 9.10 Known Non-blocking Issues
Только реально воспроизведённые и не относящиеся к D8 блокеры.

### 9.11 Final Verdict

Использовать только один из:
- **VERDICT A — D8 CLOSED**
- **VERDICT B — VALID SYSTEM FAIL**
- **VERDICT C — IMPLEMENTATION DEFECT**

Для `A` должны быть закрыты именно текущие evidence gaps. Нельзя ставить `A`, если authenticated browser/runtime или security/tenant evidence реально не выполнены.

## 10. Exit criteria

D8 можно объявить закрытым только при одновременном выполнении:
- implementation соответствует frozen D8 contract;
- authenticated browser/runtime smoke выполнен;
- API validation evidence выполнен;
- Operations Period evidence выполнен;
- RBAC/tenant/security evidence выполнен;
- relevant regression/build checks выполнены;
- Git state clean;
- final commit pushed;
- final report создан и сохранён в `docs/reports/`;
- final verdict однозначно зафиксирован.

## 11. Следующий этап

Не определять и не реализовывать следующий функциональный этап в рамках этой задачи.

После `VERDICT A — D8 CLOSED` отдельно выполнить **TRUE NEXT re-qualification** на основании canonical roadmap.

До этого момента D8 является текущим незакрытым этапом.
