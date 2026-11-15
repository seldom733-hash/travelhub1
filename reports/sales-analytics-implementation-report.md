# Отчёт по разделу «Аналитика продаж» — текущий срез

## 1. Созданные страницы

```text
/app/analytics/sales              Общая аналитика
/app/analytics/sales/managers     Менеджеры
/app/analytics/sales/managers/:id Карточка менеджера
/app/analytics/sales/activity     Активность и контроль заявок
/app/analytics/sales/funnel       Воронка продаж
/app/analytics/sales/deals        Завершённые и закрытые сделки
/app/analytics/sales/distribution Распределение заявок
```

## 2. API

```text
GET /api/v1/sales-analytics/dashboard
GET /api/v1/sales-analytics/managers/:id
GET /api/v1/sales-analytics/drilldown?metric=...
```

Параметры:

```text
preset, startDate, endDate, timezone,
managerId, serviceType, source, status
```

## 3. Модели и таблицы

```text
order.Request
order.RequestHistory
order.Order
order.OrderHistory
booking.Booking
booking.BookingHistory
finance.Payment
finance.Refund
crm.Customer
security.User
```

Новых таблиц для аналитики не создавалось. Sales Register не дублируется.

## 4. Формулы

```text
Request → Order       = заявки с convertedOrderId / заявки когорты
Order → Booking       = заказы с confirmed Booking / заказы когорты
Request → Booking     = такие заявки / все заявки
Request → завершено   = заявки, чей Order имеет fulfilledAt или Booking.completedAt
Request → закрыто     = заявки, чей Order имеет closedAt

Сумма продаж          = Σ Order.amount по заказам периода, кроме CANCELLED
Фактическая выручка   = Σ Payment.amount (CAPTURED, paidAt в периоде)
Себестоимость         = SupplierObligation.aznAmount (one per OrderItem)
                        fallback: Request.commercialSnapshot.netSupplierCost
                        fallback: Σ Booking.amount (не CANCELLED/SUPPLIER_REJECTED)
Валовая прибыль       = сумма продаж − себестоимость
Средний чек           = сумма продаж / число заказов
Возвраты              = Σ Refund.amount (PROCESSED, processedAt в периоде)
Фин. результат        = Order.amount − себестоимость − возвраты
```

## 5. Периоды

```text
TODAY, YESTERDAY, LAST_7_DAYS, LAST_30_DAYS,
CURRENT_WEEK, PREVIOUS_WEEK,
CURRENT_MONTH, PREVIOUS_MONTH,
CURRENT_QUARTER, PREVIOUS_QUARTER,
CURRENT_YEAR, PREVIOUS_YEAR, CUSTOM
```

Даты считаются в IANA timezone. Сравнение с предыдущим календарным периодом для месяца, квартала, года и недели.

## 6. RBAC

Право:

```text
sales.kpi.read
```

```text
ADMIN / DIRECTOR — полный отдел
SALES_HEAD — отдел
SALES_MANAGER — только свой assignedManagerId
FINANCE — только в рамках финансовых прав
```

Новые роли не создавались. Проверка выполняется на backend.

## 7. Локализация

Раздел локализован на RU / AZ / EN:

```text
frontend/lib/sales-analytics-i18n.ts
```

Покрыты заголовки, фильтры, KPI, статусы, таблицы, сделки, распределение, карточка менеджера, пустые состояния, а также форматы дат и денег для RU/AZ/EN.

## 8. Тесты

```text
sales-analytics.period.spec.ts  5 passed
sales-analytics.service.spec.ts 5 passed
reports/sales-analytics-smoke.ps1 — OK dashboard/manager/drilldown
reports/sales-analytics-e2e.ps1 — OK API + all frontend routes
reports/sales-analytics-e2e-isolated.md — isolated travelhub1_test: 4 requests / 5 orders / 3 managers, OK
```

Проверено:

- период TODAY;
- текущий месяц;
- прошлый квартал;
- произвольный период;
- CUSTOM без дат;
- принудительный scope менеджера;
- запрет чужой карточки менеджера.

## 8. Проверка API

```text
GET /sales-analytics/dashboard?preset=CURRENT_MONTH
→ 200

GET /sales-analytics/managers/:id
→ 200

/app/analytics/sales/*
→ 200
```

## 9. Ограничения

1. Мультисервисная себестоимость использует общий `netSupplierCost`; требуется распределение по услугам.
2. Причины отказов сгруппированы из `Request.rejectionReason`; для legacy-заявок без причины используется статус.
3. Нет отдельного SLA-справочника; используется `Request.slaDueAt`.
4. Ожидание клиента/поставщика реализовано упрощённо по статусам.
5. Детализация KPI открывает модальное окно с первичными записями, но для части финансовых и бронных KPI выборка ограничена связанными заявками.
6. Динамика выводится компактными CSS-барами и таблицей; полноценные chart-компоненты не подключены.
7. Нет e2e-тестов с реальной БД.
8. Нет проверки RBAC для реальной учётной записи `DIRECTOR` (проверен ADMIN и unit-scope).
9. Полный отчёт по 18 пунктам ТЗ пока не закрыт.
