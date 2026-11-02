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

## 6. Отмена после оплаты — PASS

На подтверждённой брони MKT-BKG-00000001 выполнена прямая отмена через UI.

Фактический результат:

```text
Booking        CANCELLED
Order          FULFILLED
clientReceived 300.00
clientDebt     700.00
clientRefunded   0.00
supplierPaid   300.00
supplierDebt   700.00
supplierRefunded 0.00
```

Ожидаемый результат для отмены без штрафа:

```text
clientDebt      0.00
clientRefunded 300.00
supplierDebt    0.00
supplierRefunded 300.00
```

Дефект CRITICAL:

- прямая отмена Booking не создаёт финансовый settlement;
- остаётся долг клиента 700 AZN;
- оплата клиента 300 AZN не возвращается;
- выплата поставщику 300 AZN не возвращается;
- Order остаётся FULFILLED при отменённой Booking.

Сценарий отмены после оплаты считается **FAIL** и требует исправления финансового контура отмены.

После обнаружения добавлен защитный гейт: прямая отмена Booking при родительском Order в статусе `FULFILLED`/`CLOSED` теперь блокируется с 409 и требует refund/settlement flow. Историческая несогласованная сделка MKT-ORD-00000001 сохранена как доказательство дефекта.

### Проверка отмены Order с оплатой 300 AZN

Создана сделка:

```text
MKT-REQ-00000004
MKT-ORD-00000004
Оплата клиента 300 AZN CAPTURED
```

Заказ отменён через UI. Панель финансового расчёта появилась. До исправления:

```text
confirm settlement → 409 REMAINING_TO_REFUND
```

Причина: перед закрытием settlement требуется фактический Refund на 300 AZN.

После добавления действия «Вернуть клиенту» выполнено:

```text
RFD-00000016  PROCESSED  300.00 AZN
SET-00000001  FINANCIALLY_SETTLED_FULL_REFUND
finalCustomerLiability = 0
remainingToRefund = 0
```

Фактическое состояние после возврата:

```text
Order           CANCELLED
clientReceived   300.00
clientDebt         0.00
clientRefunded   300.00
supplierPaid       0.00
supplierDebt       0.00
expectedIncome     0.00
currentIncome      0.00
```

**Результат:** отмена оплаченного заказа с полным возвратом клиенту — PASS.  
Отмена после выплаты поставщику и возврат от поставщика ещё не проверены.

### Отмена со штрафом 10%

Сделка:

```text
MKT-REQ-00000005
MKT-ORD-00000005
Оплата клиента 300 AZN
```

В финансовом расчёте указано:

```text
Окончательное обязательство клиента: 30.00
Штраф: 30.00
Доля платформы: 30.00
```

Создан и исполнен возврат:

```text
RFD-00000017  PROCESSED  270.00 AZN
SET-00000002  FINANCIALLY_SETTLED_WITH_PENALTY
```

Результат:

```text
clientReceived   300.00
clientRefunded   270.00
clientDebt         0.00
expectedIncome    30.00
currentIncome     30.00
```

**Результат:** отмена со штрафом 10% — PASS.

### Возврат от поставщика — PARTIAL

В UI выплат поставщикам добавлены поля:

```text
direction = OUTGOING | INCOMING
orderId (для INCOMING)
```

Создан возврат от поставщика:

```text
SPO-00000001-2
direction = INCOMING
amount = 300 AZN
status = PENDING → CONFIRMED
```

Реестр показывает:

```text
supplierPaid     300.00
supplierRefunded 300.00
```

Проверена отмена сделки с выплатой поставщику и возвратом:

```text
MKT-REQ-00000007
clientReceived   300.00
clientRefunded   300.00
supplierPaid     300.00
supplierRefunded 300.00
supplierDebt       0.00
```

`SupplierObligation SBO-00000012` закрыт:

```text
status = CANCELLED
remainingAmount = 0.00
```

Исправление: `cancelObligation` теперь разрешает отмену, если выплата полностью перекрыта подтверждённым INCOMING-возвратом (net paid = 0), и обнуляет остаток. В UI обязательств добавлено действие «Отменить обязательство».

Статус: **PASS** — отмена после выплаты поставщику с возвратом и закрытием обязательства.

### Защита от дублирования — PASS

Выполнена двойная отправка формы заявки.

Результат:

```text
MKT-REQ-00000006 — одна заявка
дубликат не создан
```

Повторный клик после первого создания не приводит к второй заявке.

Исправлен вспомогательный дефект: `GET financial-settlement` возвращал расчётный preview как уже существующий settlement и скрывал форму подтверждения. Теперь при отсутствии записи возвращается `null`, и форма отображается.

## 7. KPI: валовая разница и ожидаемый доход

Добавлена отдельная KPI-карточка **«Валовая разница»**.

Исправлено: для отменённых сделок в KPI включаются только признанные штрафы:

```text
Сумма продаж   = штраф клиента
Себестоимость  = штраф поставщика
Валовая разница = штраф клиента − штраф поставщика
```

Первоначальные цена витрины и себестоимость отменённой услуги в эти KPI не входят.

Признанным считается штраф в статусе:

```text
FINANCIALLY_SETTLED_WITH_PENALTY
```

Предварительный `PENDING_SETTLEMENT` в KPI не входит.

Текущая проверка:

```text
salesAmount      2030.00
costAmount       1600.00
grossMargin       430.00
expectedIncome    430.00
clientPenalty      30.00
```

То есть:

```text
активные продажи:            2000.00
штраф клиента по отменённой:   30.00
итого сумма продаж:          2030.00

активная себестоимость:      1600.00
штраф поставщика:                0.00
итого себестоимость:         1600.00

валовая разница = 430.00
ожидаемый доход = 430.00
```

KPI теперь сходится с правилами признания штрафов.

### Штраф поставщика — FAIL

## 8. Штраф поставщика — FAIL

Сделка:

```text
MKT-REQ-00000008
client paid 300 AZN
```

Расчёт:

```text
Окончательное обязательство клиента: 300.00
Штраф: 80.00
Доля платформы: 0.00
Доля поставщика: 80.00
```

Фактический результат:

```text
clientPenalty    80.00
supplierPenalty  80.00
expectedIncome    0.00
salesAmount      80.00
costAmount       80.00
```

Ожидалось по ТЗ:

```text
clientPenalty     0.00
supplierPenalty  80.00
expectedIncome  -80.00
salesAmount       0.00
costAmount       80.00
```

Причина: `DealRow.clientPenalty` берётся из `settlement.penaltyAmount` (общий штраф), а не из фактически удержанного с клиента. При штрафе только поставщика клиентский штраф ошибочно равен 80.

Статус: **FAIL (HIGH)**. Требуется раздельное хранение client penalty и supplier penalty.

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

## 9. Исправленные дефекты

| ID | Дефект | Исправление |
|---|---|---|
| DEF-001 | Клиент с заявкой не отображался в CRM | Marketplace scope теперь учитывает Request.customerId |
| DEF-002 | Поставщик не сохранялся в snapshot заявки | supplierCode добавлен в productSnapshot |
| DEF-003 | Карточка Request не показывала поставщика без Partner | fallback на snapshot supplierCode |
| DEF-004 | SupplierPayout не связывался с Order/Booking | payout пишет orderId/bookingId из obligation; старые строки backfill |
| DEF-005 | Форма туров разрешала отправку без имени/email | обязательные поля и inline-ошибки |
| DEF-006 | Отменённая сделка без obligation показывала supplierDebt 800 | для cancelled без obligation supplierDebt = 0 |
| DEF-007 | Отмена Booking у FULFILLED Order оставляла финансовую несогласованность | прямая отмена при FULFILLED/CLOSED теперь блокируется 409 |
| DEF-008 | После отмены Order с оплатой не было UI-создания Refund; settlement блокировался REMAINING_TO_REFUND | добавлено действие «Вернуть клиенту» → Refund PROCESSED → settlement закрыт |
| DEF-009 | Нет UI для возврата от поставщика (INCOMING supplier payment) | добавлены direction/orderId; INCOMING 300 AZN создан и подтверждён |
| DEF-010 | Отменённые сделки попадали в KPI «Сумма продаж» и «Себестоимость» | отменённые входят только признанным штрафом: clientPenalty / supplierPenalty |
| DEF-011 | Отмена заказа не закрывала SupplierObligation | добавлено закрытие при net paid=0 и UI-действие «Отменить обязательство» |
| DEF-012 | Штраф только поставщика записывается и как штраф клиента | OPEN — clientPenalty берётся из общего penaltyAmount |

## 10. Ограничения

1. Отмена после выплаты поставщику проверена с полным возвратом и закрытием обязательства.
2. Штраф только поставщика рассчитывается неверно: clientPenalty = 80 вместо 0; требуется раздельное хранение штрафов.
3. Универсальный поиск авиабилетов остаётся BLOCKED из-за внешних источников.
4. Роли и конкурентные операции не завершены.

## 11. Следующий этап

1. Исправить отмену оплаченной Booking: создавать OrderFinancialSettlement, закрывать долг и создавать Refund.
2. Проверить возврат клиенту и возврат от поставщика.
3. Проверить штраф клиента/поставщика.
4. Проверить роли и защиту от дублирования.
