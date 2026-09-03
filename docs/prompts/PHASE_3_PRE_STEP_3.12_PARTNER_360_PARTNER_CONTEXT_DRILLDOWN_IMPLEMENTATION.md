# PHASE 3 — PRE-STEP 3.12 — PARTNER 360 / PARTNER-CONTEXT DRILL-DOWN ARCHITECTURE & IMPLEMENTATION

## STATUS

**Starting SHA:** `3d76953`  
**Goal:** заменить потерю partner context при переходах из `Partner Performance` на канонический `Partner 360`, сохранив глобальные Orders/Booking Centers и единые authoritative APIs.  
**Do not auto-start:** `MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT`, Step 3.12.

## LANGUAGE REQUIREMENT — MANDATORY

Все Implementation/Remediation/Strict Review/Evidence reports, findings, root cause analysis, architecture decisions, runtime evidence, conclusions и verdict explanations должны быть преимущественно **на русском языке**.

English допустим только для технических идентификаторов: paths, classes, methods, DTO/model/table names, API endpoints, HTTP methods/status codes, commands, SHA, enums, permissions, code snippets и стандартизированных `VERDICT` strings.

Если итоговый report преимущественно на английском — задача не завершена.

---

# 1. АРХИТЕКТУРНАЯ ЦЕЛЬ

Создать/расширить canonical `Partner 360` в:

```text
CRM
└── Партнёры
    └── <Partner>
        ├── Обзор
        ├── Заказы
        ├── Бронирования
        ├── Финансы
        ├── Комиссии
        ├── Услуги
        ├── Клиенты
        └── Активность
```

`Partner 360` не должен создавать вторую систему Orders/Bookings.

Он обязан использовать те же authoritative data/query layers:

```text
Orders API / Query Engine
        ├── Orders Center       partnerId optional
        └── Partner 360/Orders  partnerId fixed by context

Bookings API / Query Engine
        ├── Booking Center          partnerId optional
        └── Partner 360/Bookings    partnerId fixed by context
```

---

# 2. CONFIRMED RUNTIME PROBLEM

В `Analytics → Производительность партнёров`:

```text
Baku Tours Pro
Заказы = 129
```

Клик по `129` сейчас приводит в общий Orders Center, где отображается:

```text
Всего заказов = 214
```

Partner scope теряется/не воспроизводится.

Аналогичная проблема обнаружена для колонки `Бронирования`: переход идёт в общий Booking Center, где нет видимого canonical фильтра/поиска по партнёру.

Это нельзя исправлять только hardcoded URL.

---

# 3. FIRST — REPOSITORY GAP AUDIT

Перед изменениями установить:

- что уже существует в `CRM → Партнёры`;
- есть ли Partner Detail / Partner Profile / Partner 360;
- canonical `Partner.id`;
- relations Order → Partner и Booking → Partner;
- API support `partnerId`;
- существующие reusable table/filter/pagination components;
- shared `MetricTableCell` / drill-down resolver;
- existing Partner Performance destinations.

Не создавать дублирующую архитектуру, если нужные primitives уже существуют.

Зафиксировать audit findings в Implementation Report.

---

# 4. PARTNER 360 — OVERVIEW

Partner detail должен иметь стабильный route по canonical ID, например:

```text
/app/crm/partners/:partnerId
```

или существующий canonical equivalent.

Header:

```text
Baku Tours Pro
Статус
ID партнёра
Тип
Контактные/компанийные данные
```

Overview показывает period-aware KPI:

```text
GMV
Платежи клиентов
Комиссия
Заказы
Бронирования
Completion
Эффективная ставка
Клиенты
```

Не придумывать новые формулы. Использовать те же canonical metric semantics, что Partner Performance.

---

# 5. PARTNER 360 — ORDERS TAB

`Заказы` — таблица заказов только текущего партнёра.

Минимум:

```text
ID заказа
Клиент
Услуга/позиции
Дата
Сумма
Валюта
Оплата
Статус
```

Filters:

```text
Период
Статус
Оплата
Клиент
Валюта
Поиск
```

`partnerId` здесь является **фиксированным page context**, а не пользовательским случайным filter.

Обязательно:

```text
Partner Performance
Baku Tours Pro
Orders = 129
    ↓ click
Partner 360 → Заказы
same partnerId
same period
Всего заказов = 129
table total = 129
```

Фактическое число сверять runtime; `129` — обязательный текущий control case, но не hardcode.

Pagination: canonical project rule, default 20.

---

# 6. PARTNER 360 — BOOKINGS TAB

`Бронирования` — таблица только бронирований текущего партнёра.

Использовать authoritative Booking source.

Минимум:

```text
Booking ID
Order ID
Клиент
Услуга
Дата
Сумма/валюта — если canonical
Статус
Payment state — если canonical
```

Filters:

```text
Период
Статус бронирования
Клиент
Поиск
```

Обязательно:

```text
Partner Performance
Baku Tours Pro
Bookings = Y
    ↓ click
Partner 360 → Бронирования
same partnerId
same period
Bookings = Y
table total = Y
```

`Y` взять из runtime, не hardcode.

---

# 7. FINANCE / COMMISSION CONTEXT

Предусмотреть Partner 360 destinations для:

```text
GMV
Customer Payments
Commission
Effective rate
```

Если полноценные Finance/Commission tabs уже можно корректно построить из authoritative source — использовать их.

Если source/detail architecture ещё не готова, не создавать fake reconciliation. Зафиксировать gap и использовать корректный dedicated detail только там, где source traceability доказуема.

FX remediation в этом task запрещён.

---

# 8. PARTNER PERFORMANCE DESTINATION CONTRACT

Обновить destinations:

| Source | Destination |
|---|---|
| Partner name | Partner 360 → Обзор |
| Orders | Partner 360 → Заказы |
| Bookings | Partner 360 → Бронирования |
| GMV | Partner 360 → Финансы/GMV detail, если authoritative |
| Customer Payments | Partner 360 → Финансы/Payments |
| Commission | Partner 360 → Комиссии |
| Completion | Partner 360 → Overview/performance detail |
| Effective rate | Partner 360 → Commission/calculation detail |

Никаких links в общий registry, теряющих `partnerId`.

---

# 9. PERIOD CONTEXT TRANSFER

При переходе из Analytics обязательно переносить canonical:

```text
from
to
preset
timezone — если используется contract
```

Partner 360 должен показывать тот же period.

Нельзя:

```text
Analytics August
→ Partner 360 ALL_TIME
```

---

# 10. GLOBAL ORDERS / BOOKING CENTERS REMAIN

Не удалять и не заменять глобальные Centers.

Они нужны для cross-partner operations.

Дополнительно провести gap assessment: должны ли global Orders/Booking Centers иметь обычный filter:

```text
Партнёр / Компания
```

Рекомендуемый canonical behavior:

```text
display/search by company name
→ resolve canonical partnerId
→ API filter by partnerId
```

Если реализация безопасна и соответствует существующей architecture — добавить shared filter.

Если это существенно расширяет scope — зафиксировать как follow-up, но Partner 360 не должен зависеть от отсутствия глобального selector.

---

# 11. SHARED QUERY / NO DUPLICATION

Запрещено копировать business queries в Partner 360.

Нужно переиспользовать canonical query/service с параметром:

```text
partnerId
```

Expected:

```text
getOrders({ ..., partnerId })
getBookings({ ..., partnerId })
```

или существующий equivalent.

Filters/search/sort применяются **до pagination**.

---

# 12. SHARED DRILL-DOWN FRAMEWORK

Не делать локальные `href` на каждую ячейку.

Использовать/расширить:

```text
MetricCard / MetricTableCell
        ↓
Shared DrillDown Contract
        ↓
Destination Resolver
        ↓
Context Transfer
```

Context минимум:

```text
metricId
workspace
partnerId
from
to
preset
currencyScope
statusScope
metric-specific filters
```

---

# 13. SECURITY

`partnerId` из route/query не является authority.

Backend должен enforce:

```text
workspace
tenant scope
RBAC
entitlement
partner visibility
```

Проверить negative case с недоступным/несуществующим partnerId.

---

# 14. FULFILLED — DO NOT LOSE PREVIOUS AUDIT REQUIREMENT

Отдельный обнаруженный вопрос `Order.status = FULFILLED` остаётся открытым.

В рамках этой работы провести evidence check:

- где объявлен `FULFILLED`;
- кто его присваивает;
- exact transition guard;
- отличие от `CLOSED`;
- входит ли `FULFILLED` в ordinary Orders population;
- почему `Выполнен` отсутствовал в обычном status dropdown;
- корректна ли связь `FULFILLED/CLOSED` с `GMV (выполненные)`.

Если обнаружен semantic defect — не маскировать его Partner 360 implementation. Зафиксировать finding и STOP для отдельной remediation, если исправление выходит за scope.

---

# 15. REQUIRED RUNTIME RECONCILIATION

Обязательные browser cases:

### Case A — Partner name

```text
Baku Tours Pro
→ Partner 360 → Обзор
→ correct partner ID/name
```

### Case B — Orders

```text
Partner Performance Orders = 129
→ Partner 360 → Заказы
→ same period
→ total = 129
→ pagination total = 129
```

### Case C — Bookings

```text
Partner Performance Bookings = Y
→ Partner 360 → Бронирования
→ same period
→ total = Y
```

### Case D — Refresh

Refresh Partner 360 route: partner + tab + period context preserved.

### Case E — Filter interaction

Изменение status/payment/customer filter не должно терять fixed `partnerId`.

### Case F — Cross-check API

```text
Analytics source metric
=
API partner-filtered total
=
Partner 360 tab total
=
table pagination total
```

---

# 16. UX REQUIREMENTS

Partner 360 должен выглядеть как единый рабочий центр партнёра, а не набор случайных embedded tables.

Минимальная IA:

```text
Breadcrumb:
CRM → Партнёры → Baku Tours Pro

Partner header

Tabs:
Обзор | Заказы | Бронирования | Финансы | Комиссии | Услуги | Клиенты | Активность
```

Не показывать пустые/fake tabs как реализованные capabilities. Если данные/architecture отсутствуют — скрыть/отложить согласно entitlement/capability contract.

---

# 17. TESTS

Добавить regression coverage минимум:

```text
Partner Performance Orders destination carries partnerId
Partner Performance Bookings destination carries partnerId
Partner 360 Orders uses fixed partnerId
Partner 360 Bookings uses fixed partnerId
period context preserved
filters do not drop partnerId
pagination totals reconcile
unauthorized partnerId denied
refresh/hydration preserves context
```

Проверить existing suites без regression.

---

# 18. REQUIRED REPORT

Создать русский report:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_PARTNER_360_IMPLEMENTATION_REPORT.md
```

Содержимое:

1. Starting SHA;
2. repo gap audit;
3. architecture decision;
4. reused components/services;
5. routes;
6. API/filter changes;
7. Partner 360 tabs implemented;
8. Shared Drill-down changes;
9. Baku Tours Pro Orders reconciliation;
10. Baku Tours Pro Bookings reconciliation;
11. FULFILLED audit result;
12. security evidence;
13. tests;
14. browser/network evidence;
15. residual gaps;
16. Final SHA/origin;
17. verdict.

---

# 19. VERDICT

`VERDICT A` разрешён только если:

```text
Baku Tours Pro Orders source = destination
Baku Tours Pro Bookings source = destination
partnerId never lost
period never lost
Partner 360 uses authoritative shared queries
no duplicate Orders/Bookings business logic
security enforced server-side
browser/runtime evidence PASS
tests PASS
```

Если source traceability не доказана:

```text
VERDICT B — PARTNER 360 / PARTNER TRACEABILITY REMEDIATION REQUIRED
```

---

# 20. HARD STOP

После завершения:

**STOP.**

Не начинать автоматически:

```text
MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT
Step 3.12
```

Не объявлять весь PRE-STEP закрытым только по факту появления Partner 360.
