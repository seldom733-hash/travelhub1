# Sales Analytics — Finance sign-off sheet

Статус: **подготовлено к согласованию, не подписано FINANCE**.

## 1. Что проверяется

| Показатель | Источник | Формула |
|---|---|---|
| Сумма продаж | `order.Order.amount` | заказы периода, кроме `CANCELLED` |
| Фактическая выручка | `finance.Payment` | `status=CAPTURED`, `paidAt` в периоде |
| Возвраты | `finance.Refund` | `status=PROCESSED`, `processedAt` в периоде |
| Корректировки | `finance.OrderFinancialAdjustment` | `occurredAt` в периоде |
| Себестоимость | `finance.SupplierObligation` | последняя obligation на `OrderItem`; fallback `commercialSnapshot.netSupplierCost`; fallback `Booking.amount` |
| Валовая прибыль | расчёт | продажи − себестоимость |
| Средний чек | расчёт | продажи / число заказов |
| Закрытые расчёты | `finance.OrderFinancialSettlement` | `finalCustomerLiability` |
| Расхождение расчёта | расчёт | `Order.amount − finalCustomerLiability` |

## 2. Проверочный срез

Период:

```text
LAST_30_DAYS
```

Фактические значения:

```text
salesAmount          = 3 624.21
capturedRevenue      = 1 262.62
refunds              = 0.00
adjustments          = 0.00
obligationCost       = 2 886.28
grossProfit          = 145.80
orders               = 3
closedSettlements    = 0
settlementVariance   = 0
missingConversionLinks = 0
```

## 3. Что должен подтвердить FINANCE

1. `SupplierObligation.aznAmount` — корректная себестоимость для аналитики.
2. Одна obligation на `OrderItem` — правильная дедупликация версий.
3. `Payment.paidAt` и `Refund.processedAt` — корректные даты финансовых событий.
4. `OrderFinancialAdjustment.occurredAt` — корректная дата корректировки.
5. `finalCustomerLiability` — корректная база для сверки закрытых сделок.
6. Формула валовой прибыли:
   ```text
   sales − supplier obligations
   ```
7. Правило исключения `CANCELLED` заказов из продаж и себестоимости.
8. Мультисервисное распределение:
   ```text
   obligation по OrderItem
   fallback: пропорционально сумме позиции
   ```

## 4. Открытые вопросы

- Учитывать ли `OPEN` obligations как фактическую себестоимость или только `CONFIRMED/PAID`.
- Как учитывать несколько версий obligation, если они относятся к разным услугам одного item.
- Нужно ли включать `PENDING` refunds в финансовый результат.
- Как трактовать заказы без `OrderFinancialSettlement` при закрытии.
- Курсовая разница: использовать `aznAmount` или пересчитывать по курсу на дату события.

## 5. Подписи

```text
FINANCE: ____________________  Дата: __________
Разработка: __________________  Дата: __________
```

До подписания раздел считается функционально готовым, но финансовая методика — **на согласовании**.
