# PHASE 3 — PRE-STEP 3.12 — ORDERS / BOOKINGS DIAGNOSTIC EXPORT FOR PRIMARY-DATA RECONCILIATION

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация по этой задаче должны быть преимущественно **на русском языке**.

К этому относятся:
- Implementation Report
- Remediation Report
- Strict Review Report
- Evidence / Runtime Report
- Gap Audit
- explanations of findings
- root cause analysis
- architecture decisions
- security findings
- runtime evidence descriptions
- conclusions/recommendations
- verdict explanations

Английский допускается только для технических идентификаторов:
- file paths
- class / method / DTO / model / table names
- API endpoints
- HTTP methods/status codes
- CLI / Git commands
- commit messages
- enums
- permission identifiers
- code snippets
- standardized VERDICT strings

**Hard acceptance criterion:** если итоговый отчёт преимущественно написан на английском языке, задача считается незавершённой. Сначала исправить язык отчёта, затем выдавать финальный verdict.

Не включать в отчёты plaintext secrets, токены, пароли или иные credential values. Использовать redaction/placeholders.

---

## STATUS

Diagnostic implementation task.

**Starting SHA:** `eaa48e4`

Не начинать следующий roadmap stage после выполнения этой задачи.

---

## 1. CONTEXT

После Round 2 для `Baku Tours Pro` была достигнута агрегатная сверка между Analytics Partner Performance и Partner 360:

```text
Analytics Partner Performance:
Orders   = 86
Bookings = 10

Partner 360 after MARKETPLACE scope:
Orders   = 86
Bookings = 10
```

Однако ручная проверка первичных строк в таблицах показывает, что в выбранном периоде пользователь визуально видит больше записей, в частности для bookings ранее наблюдались **12 записей**, соответствующих выбранным датам.

Поэтому дальнейшая подгонка агрегатов запрещена.

Нужно получить **первичные данные из Orders и Bookings registries**, чтобы провести построчную reconciliation и установить, какие записи включаются/исключаются и по какой причине.

---

## 2. GOAL

Добавить диагностически надёжный экспорт в:

```text
Orders Center
Bookings Center
```

Экспорт должен позволить проверить:

```text
Filtered table population
        =
Exported primary rows
```

а затем сравнить эти строки с population, используемой Analytics Partner Performance.

Эта задача **не должна менять** формулы Analytics Partner Performance, counts `86 / 10`, бизнес-семантику payment-based metrics или текущие filters до получения primary-data evidence.

---

## 3. REQUIRED EXPORT FORMATS

Поддержать минимум:

```text
CSV
XLSX
```

Если архитектурно разумнее сначала реализовать один общий server-side export endpoint с двумя serializers — использовать этот подход.

Не создавать client-side export только из строк текущей страницы.

---

## 4. HARD EXPORT CONTRACT

Экспорт обязан использовать тот же authoritative server-side filter/query contract, который формирует registry.

### 4.1 Full filtered population

Если:

```text
page size = 20
filtered total = 86
```

то export должен содержать:

```text
86 data rows
```

а не 20 строк текущей страницы.

Hard invariant:

```text
Registry filtered total
=
Export row count
```

Для CSV/XLSX header row не считается data row.

### 4.2 Filter equivalence

Экспорт должен учитывать текущие:

- `from`
- `to`
- preset/custom period
- partner filter
- customer filter, если применимо
- status
- `acquisitionSource`
- currency, если применимо
- search
- other active registry filters
- workspace / tenant scope

Нельзя реализовывать отдельную семантику фильтров для export.

Предпочтительно:

```text
Registry query builder
        ↓
shared filter contract
        ↓
pagination for UI
        └──── no pagination for export
```

а не две независимые реализации.

---

## 5. ORDERS EXPORT — REQUIRED PRIMARY FIELDS

Экспорт Orders должен содержать максимум доступных authoritative primary/relation fields, необходимых для сверки.

Минимум:

```text
id
referenceNumber
createdAt
updatedAt
status

partnerId
partner Code/referenceNumber
partner Name

customerId
customer Code/referenceNumber
customer Name, если доступно и допустимо

acquisitionSource

booking.id / bookingIds
booking.referenceNumber / bookingReferenceNumbers

related payment ids
related payment referenceNumbers
payment statuses
paidAt values

currency
order total / amount fields relevant to authoritative model
```

Если `Order` связан с несколькими Payments или Bookings, не терять связь.

Допустимо:
- повторять Order в нескольких rows для child relations, если это явно документировано;
- либо сериализовать related ids/referenceNumbers/statuses в стабильные delimiter-separated columns.

Главное — обеспечить однозначную reconciliation.

---

## 6. BOOKINGS EXPORT — REQUIRED PRIMARY FIELDS

Минимум:

```text
id
referenceNumber

createdAt
updatedAt

authoritative booking business date
если существует отдельное поле start/service/booking date — экспортировать его явно

status

orderId
order.referenceNumber

partnerId
partner Code/referenceNumber
partner Name

customerId
customer Code/referenceNumber
customer Name, если доступно и допустимо

acquisitionSource

related payment ids
related payment referenceNumbers
payment statuses
paidAt values

currency
amount / booking amount fields, если существуют
```

Особенно важно не скрывать:

```text
acquisitionSource
createdAt
business/service date
status
order reference
payment status
paidAt
```

Именно эти поля могут объяснить расхождение `12 → 10`.

---

## 7. DATE SEMANTICS — MUST BE EXPLICIT

В export обязательно указать реальные date fields, а в отчёте доказать:

```text
какое поле используется registry period filter
какое поле используется Analytics Partner Performance
```

Например:

```text
Orders registry period → createdAt ?
Bookings registry period → createdAt / serviceDate / bookingDate ?
Analytics Partner Performance Orders → ?
Analytics Partner Performance Bookings → ?
Payments → paidAt ?
```

Не предполагать.

Доказать исходным кодом + runtime / query evidence.

Для текущего canonical calendar period использовать:

```text
[from, to)
```

где `from` inclusive, `to` exclusive.

Контрольный период:

```text
from = 2026-09-01
to   = 2026-10-01
preset = MONTH
```

---

## 8. CONTROL ENTITY — BAKU TOURS PRO

Обязательная runtime verification:

```text
Partner:
Baku Tours Pro

partnerId:
aad76dd9-93ad-4d1c-107a-54b4b5adc8a2

Period:
2026-09-01 → 2026-10-01
preset=MONTH
```

Для Orders:

1. открыть registry / Partner 360 Orders с теми же filters;
2. зафиксировать displayed filtered total;
3. выполнить export;
4. посчитать data rows;
5. доказать:

```text
UI filtered total = export row count
```

Для Bookings — аналогично.

---

## 9. DIAGNOSTIC RECONCILIATION — REQUIRED

После того как export работает, провести первичную reconciliation.

Нужно сформировать множества:

```text
A = все Orders из registry export для Baku Tours Pro за period
B = Orders population, используемая Analytics Partner Performance

C = все Bookings из registry export для Baku Tours Pro за period
D = Bookings population, используемая Analytics Partner Performance
```

Вывести:

```text
A ∩ B
A \ B
B \ A

C ∩ D
C \ D
D \ C
```

Сравнение выполнять по authoritative internal id.

Дополнительно показывать `referenceNumber`.

Для каждой записи из difference set объяснить конкретный predicate, из-за которого запись включена/исключена.

Пример формата:

| Entity | id | referenceNumber | Registry | Analytics | Exclusion reason |
|---|---|---|---:|---:|---|
| Booking | ... | MKT-BKG-... | YES | NO | `acquisitionSource=STOREFRONT` |
| Booking | ... | MKT-BKG-... | YES | NO | date field mismatch |
| Booking | ... | MKT-BKG-... | YES | NO | status predicate |
| Booking | ... | MKT-BKG-... | YES | NO | no qualifying relation |

Не использовать guessed reasons.

---

## 10. SUCCESSFUL PAYMENT QUALIFICATION — OBSERVE, DO NOT ASSUME

Нужно дополнительно вычислить diagnostic sets:

```text
Marketplace Orders linked to CAPTURED Payments
Marketplace Bookings linked to CAPTURED Payments
CAPTURED Payments
```

для Baku Tours Pro и того же периода.

Но:

**не менять Partner Performance автоматически на payment-based semantics.**

Цель — получить evidence и понять, что реально представляют текущие `86 Orders / 10 Bookings`.

Зафиксировать counts:

```text
all Marketplace Orders                     = ?
Marketplace Orders linked to CAPTURED      = ?

all Marketplace Bookings                   = ?
Marketplace Bookings linked to CAPTURED    = ?

CAPTURED Marketplace Payments              = ?
```

И отдельно показать exact predicate каждого count.

---

## 11. UI REQUIREMENTS

Добавить понятную кнопку:

```text
Экспорт
```

с выбором:

```text
CSV
XLSX
```

или эквивалентным компактным UX.

Не нарушать существующую пагинацию.

Экспорт должен отражать текущие active filters.

Если export может занять заметное время, показать корректное loading state.

Ошибки export не должны silently fail.

---

## 12. SECURITY

Export является отдельным read surface и обязан соблюдать те же server-authoritative ограничения, что registry:

```text
workspace
tenant
role
permissions
partner scope
```

Нельзя доверять client-provided `partnerId` без server-side access validation.

`referenceNumber`, Code и prefix не являются authorization mechanism.

Не допустить cross-tenant leakage через export endpoint.

Если internal UUID экспортируется, это допустимо только для соответствующего internal/admin workspace и только при существующих permission boundaries.

---

## 13. I18N

UI export controls и user-facing errors должны работать минимум:

```text
RU
AZ
EN
```

Не оставлять raw i18n keys.

---

## 14. TESTS

Обязательные automated tests минимум:

### Backend

- export uses same filters as registry
- export ignores pagination but preserves filters
- partner filter
- period `[from,to)`
- `acquisitionSource`
- status filter
- search/filter combination, если supported
- tenant/workspace isolation
- unauthorized export denied
- zero rows → valid empty export
- row count matches filtered count

### Frontend

- export action preserves current query/filter state
- CSV action
- XLSX action
- loading/error state
- RU/AZ/EN labels

### Regression

Не ломать существующие registries.

---

## 15. TEST REPORTING — TRUTHFULNESS

Нельзя писать PASS для частично failing suite.

Если:

```text
282/283
```

то писать:

```text
Frontend Tests: FAIL — 282/283
1 failing test: ...
classification: pre-existing / introduced by this task
```

`pre-existing` не превращает FAIL в PASS.

---

## 16. RUNTIME EVIDENCE

Обязательная browser/runtime матрица:

### Orders

```text
Baku Tours Pro
2026-09-01 → 2026-10-01
displayed filtered total = ?
CSV data rows = ?
XLSX data rows = ?
```

### Bookings

```text
Baku Tours Pro
2026-09-01 → 2026-10-01
displayed filtered total = ?
CSV data rows = ?
XLSX data rows = ?
```

Также проверить:

- direct page load
- active filters retained
- export after changing period
- export after changing status
- export after changing partner
- pagination page != 1
- download still contains full filtered population

---

## 17. REQUIRED EVIDENCE REPORT

Создать:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_ORDERS_BOOKINGS_DIAGNOSTIC_EXPORT_PRIMARY_DATA_RECONCILIATION_REPORT.md
```

Отчёт должен содержать:

1. Starting SHA
2. implementation SHA
3. final HEAD
4. `HEAD == origin/master`
5. changed files
6. architecture of shared filter/export contract
7. exact date predicates
8. exact registry predicates
9. exact Analytics Partner Performance predicates
10. Baku Tours Pro UI totals
11. CSV/XLSX row counts
12. Orders set reconciliation
13. Bookings set reconciliation
14. CAPTURED-payment diagnostic counts
15. exact difference rows with reasons
16. security evidence
17. RU/AZ/EN evidence
18. complete test results
19. known remaining findings
20. final verdict

---

## 18. ACCEPTANCE CRITERIA

Task может получить `VERDICT A` только если одновременно выполнено:

```text
[ ] Orders export реализован
[ ] Bookings export реализован
[ ] CSV работает
[ ] XLSX работает
[ ] full filtered population, not current page
[ ] UI total = CSV data row count
[ ] UI total = XLSX data row count
[ ] registry and export use same authoritative filter contract
[ ] Baku Tours Pro runtime evidence captured
[ ] exact primary rows available for reconciliation
[ ] Analytics Orders set diff produced
[ ] Analytics Bookings set diff produced
[ ] each difference has proven cause
[ ] CAPTURED diagnostic sets/counts produced
[ ] no Analytics formula changed without evidence
[ ] tenant/workspace isolation proven
[ ] RU/AZ/EN proven
[ ] tests reported truthfully
[ ] report predominantly Russian
[ ] real Git SHA recorded
[ ] HEAD == origin/master
```

Если хотя бы один critical пункт не доказан:

```text
VERDICT B
```

с конкретным списком remaining findings.

---

## 19. NON-GOALS

В этой задаче НЕ:

- менять `86` на другое число только ради совпадения;
- менять `10` на `12` без row-level evidence;
- переводить Partner Performance на CAPTURED-based semantics автоматически;
- переписывать Analytics formulas;
- создавать новый Finance Center;
- выполнять Step 3.12;
- делать полный project-wide export framework для всех таблиц;
- начинать следующую roadmap implementation stage.

Сначала получить authoritative primary-data evidence.

---

## 20. FINAL EXECUTION RULE

Правильная последовательность:

```text
1. Audit existing registry filter/query implementation
2. Reuse/share filter contract
3. Implement full filtered export
4. Verify UI total == export row count
5. Export Baku Tours Pro primary rows
6. Build exact ID sets
7. Compare registry vs Analytics population
8. Prove why each differing row differs
9. Only report findings
10. Do NOT silently change business semantics
```

Основная цель этой задачи — перестать сравнивать только агрегатные числа и перейти к доказуемой сверке по первичным строкам.
