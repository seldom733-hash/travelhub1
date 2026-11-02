# Navitravel — ручной E2E-аудит бизнес-процессов

**Дата:** 2026-11-02  
**Среда:** production `travelhub` (по прямому подтверждению пользователя)  
**Backup до очистки:** `reports/backups/travelhub_before_full_e2e_clear_20261102.dump`

## 1. Подготовка среды

Транзакционные данные очищены: Request, Order, Booking, Payment, Refund, SupplierObligation, SupplierPayout, Ledger и связанные истории. Master data сохранены.

После очистки все счётчики и KPI реестра были нулевыми.

## 2. Тестовое предложение

```text
Product:  PRD-TEST-E2E
URL:      /products/11111111-1111-4111-8111-111111111111
Supplier: TEST
Название: Navitravel E2E Test Tour
Дата:     2026-11-03
Ночей:    7
Цена:     1000 AZN
```

Календарь и повторная проверка цены обслуживаются тестовым адаптером `TEST`, внешние системы не вызываются.

## 3. Сквозной сценарий

| Шаг | Действие в UI | Результат |
|---|---|---|
| 1 | Подача заявки через витрину | PASS — MKT-REQ-00000001 |
| 2 | Данные путешественника: имя, фамилия, телефон, email | PASS |
| 3 | Подтверждение цены поставщиком | PASS |
| 4 | Добавление 2 туристов | PASS |
| 5 | Подтверждение клиентом | PASS |
| 6 | Request → Order | PASS — MKT-ORD-00000001 |
| 7 | Паспортные данные 2 туристов | PASS |
| 8 | Финальное подтверждение заказа | PASS |
| 9 | Заказ взят в работу | PASS |
| 10 | Заказ подготовлен к бронированию | PASS |
| 11 | Order → Booking | PASS — MKT-BKG-00000001 |
| 12 | Заказ исполнен | PASS — FULFILLED |
| 13 | Booking подготовлен, отправлен, подтверждён | PASS — CONFIRMED |
| 14 | SupplierObligation создан | PASS — SBO-00000010 |
| 15 | Частичная оплата клиента 300 AZN | PASS — CAPTURED |
| 16 | Частичная выплата поставщику 300 AZN | PASS — CONFIRMED |

## 4. Второй сквозной сценарий — полная оплата и доход

Тестовое предложение настроено на:

```text
supplierBasePrice = 800 AZN
наценка TEST/tours = 25%
цена витрины = 1000 AZN
```

Создана вторая заявка тем же клиентом:

```text
MKT-REQ-00000002
MKT-ORD-00000002
MKT-BKG-00000002
```

Выполнено вручную:

- подтверждение поставщика;
- подтверждение клиента;
- Request → Order;
- Order → Booking;
- подтверждение Booking;
- исполнение Order;
- полная оплата клиента 1000 AZN;
- полная выплата поставщику 800 AZN.

Фактический результат реестра:

```text
salesAmount      1000.00
costAmount        800.00
clientReceived   1000.00
clientDebt          0.00
supplierPaid      800.00
supplierDebt        0.00
expectedIncome    200.00
currentIncome     200.00
stage            BOOKING
```

Проверка «один клиент — несколько заявок»:

```text
Aysel Mammadova
  MKT-REQ-00000001
  MKT-REQ-00000002
```

Каждая заявка имеет собственный Order и Booking, оплаты не смешаны.

## 5. Третий клиент, KPI и отмена до оплаты

Создана независимая заявка другого клиента:

```text
MKT-REQ-00000003
Elvin Quliyev
MKT-ORD-00000003
MKT-BKG-00000003
```

Проверка KPI при статусе `SENT_TO_BOOKING`:

```text
GET /api/v1/orders
status = SENT_TO_BOOKING
aggregates.lifecycle.SENT_TO_BOOKING = 1
```

То есть KPI считает текущий статус корректно. Значение `0` допустимо только после перехода заказа в `FULFILLED`.

Затем заказ отменён до оплаты и до подтверждения брони:

```text
Order   = CANCELLED
Booking = CANCELLED
clientReceived = 0
clientDebt     = 0
supplierPaid   = 0
supplierDebt   = 0
expectedIncome = 0
currentIncome  = 0
```

Найден и исправлен дефект: отменённая сделка без SupplierObligation показывала `supplierDebt = 800`. Теперь долг перед поставщиком равен 0.

## 6. Фактическое состояние первой сделки

```text
Request:  MKT-REQ-00000001
Order:    MKT-ORD-00000001  FULFILLED
Booking:  MKT-BKG-00000001  CONFIRMED

Customer: Aysel Mammadova
Supplier: TEST
Service:  Navitravel E2E Test Tour
Amount:   1000.00 AZN
```

Финансовый реестр:

```text
salesAmount      1000.00
costAmount       1000.00
clientReceived    300.00
clientDebt        700.00
supplierPaid      300.00
supplierDebt      700.00
expectedIncome      0.00
currentIncome       0.00
stage            BOOKING
```

SupplierObligation:

```text
SBO-00000010
amount 1000.00
remaining 700.00
status PARTIALLY_PAID
```

Client payment:

```text
MKT-PAY-00000001-1
300.00 AZN
CAPTURED
```

Supplier payout:

```text
SPO-00000001
300.00 AZN
CONFIRMED
```

## 7. Исправленные дефекты

| ID | Дефект | Исправление |
|---|---|---|
| DEF-001 | Клиент с заявкой не отображался в CRM | Marketplace scope теперь учитывает Request.customerId |
| DEF-002 | Поставщик не сохранялся в snapshot заявки | supplierCode добавлен в productSnapshot |
| DEF-003 | Карточка Request не показывала поставщика без Partner | fallback на snapshot supplierCode |
| DEF-004 | SupplierPayout не связывался с Order/Booking | payout пишет orderId/bookingId из obligation; старые строки backfill |
| DEF-005 | Форма туров разрешала отправку без имени/email | обязательные поля и inline-ошибки |
| DEF-006 | Отменённая сделка без obligation показывала supplierDebt 800 | для cancelled без obligation supplierDebt = 0 |

## 8. Ограничения

1. Первая тестовая сделка имеет доход 0 (sales = cost); вторая сделка проверяет доход 200.
2. Отмена до оплаты проверена; отмена после оплаты, штрафы и возвраты ещё не выполнены.
3. Универсальный поиск авиабилетов остаётся BLOCKED из-за внешних источников.
4. Разные клиенты, роли и конкурентные операции не завершены.

## 9. Следующий этап

1. Создать второго клиента и независимую заявку.
2. Проверить отмену без штрафа и со штрафом.
3. Проверить возврат клиенту и возврат от поставщика.
4. Проверить роли и защиту от дублирования.
