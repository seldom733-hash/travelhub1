# Sales Analytics — аудит и методика (v1)

## 1. Источники данных

Раздел не создаёт параллельных сущностей и читает существующие таблицы:

| Показатель | Источник | Поле/логика |
|---|---|---|
| Новая заявка | `order.Request` | `createdAt` |
| Назначение менеджеру | `order.Request` + `order.RequestHistory` | `assignedAt`, `assignedManagerId`, action `ASSIGNED` |
| Первый ответ | `order.Request` | `firstContactAt` (fallback `processingStartedAt`) |
| Взятие в работу | `order.Request` | `processingStartedAt` |
| Отправка предложения | `order.RequestHistory` | `supplier_confirmed` / `PRICE_CHANGED` |
| Потерянная заявка | `order.Request` | `REJECTED`, `UNAVAILABLE`, `EXPIRED`, `CUSTOMER_PAYMENT_TIMEOUT`, `CANCELLED_BY_CUSTOMER` |
| Просрочка | `order.Request` | `slaDueAt < now` и заявка не терминальная |
| Создание заказа | `order.Order` | `createdAt` |
| Подтверждение брони | `booking.Booking` | `confirmedAt` |
| Завершение услуги | `order.Order` / `booking.Booking` | `fulfilledAt` / `completedAt` |
| Закрытие сделки | `order.Order` | `closedAt` |
| Отмена | `order.Order` / `booking.Booking` | `cancelledAt` |
| Платёж | `finance.Payment` | `status=CAPTURED`, `paidAt` |
| Возврат | `finance.Refund` | `status=PROCESSED`, `processedAt` |
| Клиент | `crm.Customer` | `id`, имя, телефон |
| Менеджер | `security.User` | `id`, `fullName` |

## 2. Ответственный менеджер

Ответственный определяется по:

```text
Request.assignedManagerId
```

Заказы и брони связываются с заявкой через:

```text
Request.convertedOrderId -> Order.id
Order.id -> Booking.orderId
```

Если заказ не связан с заявкой, он попадает в общие продажи, но не в атрибуцию менеджера.

## 3. Формулы v1

```text
Request → Order       = заявки с convertedOrderId / все заявки когорты
Order → Booking       = заказы хотя бы с одной confirmed Booking / заказы когорты
Request → Booking     = заявки, чей заказ имеет confirmed Booking / заявки
Request → завершено   = заявки, чей Order имеет fulfilledAt или Booking.completedAt / заявки
Request → закрыто     = заявки, чей Order имеет closedAt / заявки

Сумма продаж          = Σ Order.amount по заказам периода, кроме CANCELLED
Фактическая выручка   = Σ Payment.amount (CAPTURED, paidAt в периоде)
Себестоимость         = commercialSnapshot.netSupplierCost (fallback: Σ Booking.amount)
Валовая прибыль       = сумма продаж − себестоимость
Средний чек           = сумма продаж / количество заказов
Возвраты              = Σ Refund.amount (PROCESSED, processedAt в периоде)
Фин. результат        = Order.amount − Booking.amount − Refund.amount
```

## 4. Периоды

Поддержаны:

```text
TODAY, YESTERDAY, LAST_7_DAYS, LAST_30_DAYS,
CURRENT_WEEK, PREVIOUS_WEEK,
CURRENT_MONTH, PREVIOUS_MONTH,
CURRENT_QUARTER, PREVIOUS_QUARTER,
CURRENT_YEAR, PREVIOUS_YEAR, CUSTOM
```

Границы считаются в IANA timezone, переданной клиентом. Сравнение:

- текущий месяц → прошлый календарный месяц;
- текущий квартал → прошлый квартал;
- текущий год → прошлый год;
- текущая неделя → прошлая неделя;
- остальные периоды → сдвиг на длину периода.

## 5. RBAC

Используется существующее право:

```text
sales.kpi.read
```

- `ADMIN`, `DIRECTOR` — полный отдел.
- `SALES_HEAD` — отдел.
- `SALES_MANAGER` — backend принудительно подставляет `assignedManagerId = user.id`; чужой `managerId` игнорируется.
- `FINANCE` — доступ только в рамках существующих финансовых прав; отдельная управленческая аналитика не выдаётся.
- Новые роли не создавались.

## 6. Ограничения v1

1. Себестоимость берётся из `Request.commercialSnapshot.netSupplierCost`; fallback — `Booking.amount`. Нужна сверка с финансовой моделью для мультисервисных заказов.
2. Причины отказов и потерянных заявок ещё не сгруппированы.
3. Нет отдельной таблицы распределения `RequestAssignmentHistory`; используются `RequestHistory.action=ASSIGNED` и текущие поля.
4. Нет SLA-настроек: используется существующий `Request.slaDueAt`.
5. Детализация KPI открывает вкладку, но не всегда фильтрует первичный список по конкретному KPI.
6. Нет отдельного API для полной карточки менеджера с историей назначений/действий.
7. Нет графических chart-компонентов; динамика выводится таблицей.
8. Нет тестов сервиса на реальной БД; есть unit-тесты периода.
