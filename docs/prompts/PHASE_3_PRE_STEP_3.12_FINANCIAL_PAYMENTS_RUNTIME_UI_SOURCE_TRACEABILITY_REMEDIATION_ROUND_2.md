# PHASE 3 — PRE-STEP 3.12 — FINANCIAL PAYMENTS RUNTIME UI & SOURCE TRACEABILITY REMEDIATION — ROUND 2

## ЦЕЛЬ

Выполнить **узкую runtime-driven remediation** страницы реестра платежей после проверки Financial Payments Source Traceability. Не перепроектировать Payments architecture и не изменять доказанную семантику Financial Summary.

Сохранить контракт:

```text
Успешный платёж = Payment.status = CAPTURED AND paidAt ∈ selected period
Financial Summary → Payments сохраняет period + currency + status=CAPTURED
AZN 118→118; EUR 1→1; USD 18→18 (либо доказать актуальные числа, если dataset изменился)
```

Предыдущий `VERDICT A` отменяется runtime-наблюдениями до закрытия этого Round 2.

## LANGUAGE REQUIREMENT — MANDATORY

Все Implementation/Remediation/Strict Review/Evidence Runtime Reports, findings, root cause, architecture/security decisions, conclusions и verdict explanations писать преимущественно **на русском языке**. Английский разрешён только для технических идентификаторов: paths, классов/методов/DTO/model/table names, endpoints, HTTP, CLI/Git, commit messages, enums, permissions, code и стандартизированных VERDICT strings.

**Hard gate:** преимущественно английский отчёт = задача незавершена.

## 0. STARTING POINT

Последний заявленный SHA:

```text
8f156ce
```

Перед работой:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
```

Если HEAD отличается — использовать фактический HEAD и указать его в отчёте. Unrelated refactoring запрещён.

## 1. FP-R2-01 — RAW PAYMENT STATUS

Runtime: фильтр показывает локализованное `Зачислен`, но строки таблицы — raw `CAPTURED`.

Исправить через единый shared/canonical payment-status presentation resolver. API/query/backend продолжают использовать canonical enums. Проверить все существующие Payment statuses, RU/AZ/EN, table/filter/badge/detail render paths. Не делать локальный hardcode только для `CAPTURED`.

**Gate:** visible raw enums в локализованном UI отсутствуют.

## 2. FP-R2-02 — SORTING ПО ЗАГОЛОВКАМ КОЛОНОК

Runtime не подтверждает заявленную сортировку: пользователь не имеет очевидных clickable sortable headers.

Минимально поддержать при наличии canonical backend mapping:

```text
Дата
Сумма
Валюта
Статус
```

`Код / Заказ / Метод` — только если существует корректное backend sort field.

Использовать существующий shared `SortableHeader` / DataTable contract, а не второй framework. Должны быть hover/click affordance, активная колонка и индикатор ASC/DESC.

Обязательный pipeline:

```text
FILTER → SORT → deterministic tie-breaker → PAGINATION
```

Запрещена сортировка только текущих 20 строк. Проверить URL/state, request `sortBy/sortDirection`, F5, back/forward согласно shared contract.

Runtime matrix минимум: DATE ASC/DESC, AMOUNT ASC/DESC, CURRENCY ASC/DESC, STATUS ASC/DESC.

## 3. FP-R2-03 — RAW I18N KEYS `common.from` / `common.to`

Runtime показывает:

```text
common.from
common.to
```

Исправить RU/AZ/EN. Выполнить полный Payments-page localization sweep: breadcrumbs, title, Aggregate Summary, filters, dates, search, columns, statuses, sorting UI/tooltips, pagination, empty/loading/error states и Payment Detail.

Любой visible raw i18n key = FAIL.

## 4. FP-R2-04 — ПУСТАЯ КОЛОНКА `МЕТОД`: SOURCE AUDIT

Колонка `Метод` показывает `—`. Сначала доказать canonical source через DB/model/API/DTO/service/PSP metadata/frontend mapping.

### Если source существует

Вывести реальные безопасные данные и локализовать. Допустимы только реально существующие безопасные representations (`Visa •••• 4242`, wallet/bank type и т.п.). Не показывать PAN/CVV/secrets и не генерировать fake/demo values.

### Если source отсутствует

Удалить колонку `Метод` из Payments Registry до появления Payment Method Data Contract. В отчёте зафиксировать capability как deferred.

Нельзя оставлять полностью фиктивную колонку из `—`.

## 5. FP-R2-05 — PAYMENT RECORDS НЕ КЛИКАБЕЛЬНЫ

Текущая цепочка обрывается:

```text
Financial Summary → Payments Registry → PAY-... → тупик
```

Нужна цепочка:

```text
Financial Summary
→ Payments Registry
→ конкретный Payment
→ Payment Detail / Transaction Detail
→ canonical source + связанные сущности
```

Минимум кликабельным должен быть canonical payment code `PAY-...`. Row-click допустим, если это shared pattern проекта. Не делать каждую ячейку отдельной ссылкой без необходимости.

Перед реализацией проверить существующий Payment Detail/Transaction Detail/entity-detail framework и переиспользовать его. Если detail отсутствует — создать минимальный detail в рамках существующей архитектуры, не новый параллельный framework.

Payment Detail показывает только доказанные canonical данные: Payment code/ID, date/time, amount, currency, localized status; Order/Booking/customer/partner/payment method/refund/provider reference — только если реальные связи/поля существуют и безопасны.

Связанный Order должен вести в canonical Order Detail, если такой shared drill-down поддерживается.

**Exact reconciliation:** ID/amount/currency/status/date в detail должны совпадать с выбранной Payment record.

## 6. SHARED SOURCE TRACEABILITY

Не делать Payments-only hack. Сохранить общий принцип:

```text
Shared Metric Card
→ Shared DrillDown Contract
→ Payments Registry
→ Shared Record/Entity Detail Contract
```

Контекст: period, currency, statusScope, workspace, tenant/partner scope. Query/ID не могут расширять разрешённый scope.

## 7. SECURITY — MANDATORY

Payment Detail/API: authentication, workspace scope, tenant/partner scope где применимо, RBAC/permission, server-authoritative access. Изменение ID в URL не должно давать доступ к чужой записи. Frontend hiding не является security. Sensitive payment credentials не возвращать.

Добавить targeted unauthorized/forbidden/cross-scope tests при создании/изменении detail endpoint.

## 8. REGRESSION GATES

Не сломать:

- successful-payment semantics `CAPTURED + paidAt period`;
- currency/status/period server-side filters;
- first request from Financial Summary уже scoped;
- Aggregate Summary по **всей filtered population**, не текущей странице;
- native-currency totals отдельно, без FX;
- `DEFAULT_PAGE_SIZE=20`;
- pagination после filtering/sorting;
- AZN/EUR/USD source→destination reconciliation.

Проверить filters + sorting + pagination совместно.

## 9. FIRST NAVIGATION / HYDRATION

Financial Summary → AZN successful payments: **первый** network request уже содержит правильные period, `currency=AZN`, `status=CAPTURED`. Не допускается сначала unfiltered request, затем corrective request.

Проверить first navigation, direct URL, F5, back, forward.

## 10. LOCALIZATION MATRIX

Обязательный browser/runtime PASS для RU/AZ/EN по: breadcrumbs, title, summary, from/to, filters, statuses, headers, sorting UX, pagination, empty/loading/error, detail. Raw i18n key = FAIL.

## 11. PAYMENT METHOD EVIDENCE

В отчёте привести либо:

```text
DB/model field
API/DTO field
service mapping
frontend mapping
real examples
```

либо доказанный audit отсутствия source и решение удалить колонку. Фраза «данных нет» без source audit недостаточна.

## 12. PAYMENT DETAIL EVIDENCE

По возможности проверить реальные AZN/USD/EUR CAPTURED records. Для каждой: registry row → click → exact ID/amount/currency/status match. Если актуальный dataset не содержит нужной валюты — не создавать fake production data, а явно указать ограничение.

## 13. TARGETED TESTS

Минимум:

- status localization resolver/render path;
- `common.from/common.to`;
- allowed sort fields + ASC/DESC + invalid sort handling + deterministic tie-breaker + sort-before-pagination;
- Payment Method mapping либо отсутствие колонки;
- Payment Detail correct ID/not-found/unauthorized/forbidden/cross-scope;
- successful filter, currency, period, Aggregate Summary, pagination regressions.

Tests не заменяют browser/runtime evidence.

## 14. BROWSER / NETWORK EVIDENCE — MANDATORY

Минимум доказать:

```text
1 Financial Summary → AZN successful payments
2 destination count reconciles
3 no raw CAPTURED
4 no common.from/common.to
5 RU clean
6 AZ clean
7 EN clean
8 DATE ASC/DESC
9 AMOUNT ASC/DESC
10 CURRENCY ASC/DESC
11 STATUS ASC/DESC
12 sorting survives pagination
13 Aggregate Summary unchanged across pages
14 Payment Method source decision proven
15 PAY-... click works
16 Payment Detail exact record
17 F5 detail works
18 unauthorized/cross-scope denied
19 back to registry preserves context where contract supports it
20 no unexpected 4xx/5xx in normal flow
```

Привести ключевые network requests.

## 15. HARD ACCEPTANCE GATES

`VERDICT A` разрешён только если одновременно PASS:

```text
A raw Payment enums removed from localized visible UI
B common.from/common.to fixed
C RU/AZ/EN localization clean
D clickable sortable headers actually work
E server-side sort before pagination
F ASC/DESC + deterministic ordering proven
G Payment Method canonical source shown OR column removed after audit
H Payment records drill down to canonical detail
I Payment Detail exact reconciliation
J Payment Detail RBAC/scope protection
K Aggregate Summary full-population
L pagination server-consistent
M successful-payment reconciliation preserved
N first request already scoped
O tests/typecheck/build PASS
P browser/network evidence PASS
```

Любой обязательный FAIL → `VERDICT B`. Source/tests не могут перекрыть противоречащий runtime.

## 16. OUT OF SCOPE — HARD STOP

Не выполнять: Finance Center, FX/multi-currency conversion, Treasury, Partner Settlement, Guarantee Hold, Payout architecture, Booking KPI Semantics, global redesign, Step 3.12, unrelated Analytics changes.

Payments остаётся самостоятельной destination. Не создавать несуществующий Finance Center.

Если breadcrumb искусственно выглядит как:

```text
TravelHub / Финансовая сводка / Платежи
```

не использовать `Финансовая сводка` как фиктивный parent section. До Finance Center предпочтительно нейтральное `TravelHub / Платежи`, если это согласуется с Workspace Shell.

## 17. FINAL REPORT — MANDATORY

Отчёт на русском:

```text
# FINANCIAL PAYMENTS RUNTIME UI & SOURCE TRACEABILITY — ROUND 2
Starting SHA:
Implementation SHA:
Final HEAD:
origin/master:
HEAD == origin:

FP-R2-01 Raw Payment Status — Root Cause / Fix / Evidence / PASS|FAIL
FP-R2-02 Missing Header Sorting — Root Cause / Fix / Evidence / PASS|FAIL
FP-R2-03 common.from/common.to — Root Cause / Fix / Evidence / PASS|FAIL
FP-R2-04 Payment Method Source Audit — Source / Decision / Evidence / PASS|FAIL
FP-R2-05 Payment Record Drill-down — Destination / Security / Reconciliation / Evidence / PASS|FAIL

Financial Summary Reconciliation: AZN/EUR/USD
Sorting Matrix
Localization Matrix RU/AZ/EN
Aggregate Summary / Pagination
Security
Tests / Typecheck / Build
Browser / Network Evidence
Residual Gaps
VERDICT A | VERDICT B
```

После реализации проверить реальные SHA и `HEAD == origin`. Следующий этап автоматически не начинать. Остановиться для отдельной runtime/strict re-qualification.
