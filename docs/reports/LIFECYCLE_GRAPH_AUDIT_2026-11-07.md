# Navitravel — аудит жизненного цикла сделки

Дата: 2026-11-08  
Статус: **ЧАСТИЧНО ЗАВЕРШЕНО**. Основные маршруты, отмена, частичные финансы, мультипоставщик, USD, порядок возвратов, нумерация и lifecycle-уведомления проверены. Полный Jest suite не зелёный.

## 1. Граф

```mermaid
stateDiagram-v2
  [*] --> RequestNEW
  RequestNEW --> CONFIRMED: Подтвердить цену
  CONFIRMED --> CUSTOMER_ACCEPTED: Клиент принял
  CUSTOMER_ACCEPTED --> OrderNEW: Конвертировать
  OrderNEW --> IN_PROCESSING: В работу
  IN_PROCESSING --> READY_FOR_BOOKING: Подтвердить
  READY_FOR_BOOKING --> SENT_TO_BOOKING: Отправить поставщику
  SENT_TO_BOOKING --> FULFILLED: Все услуги Completed
  SENT_TO_BOOKING --> PARTIALLY_FULFILLED: Часть услуг выполнена
  SENT_TO_BOOKING --> CANCELLATION_REQUESTED: Инициировать отмену
  CANCELLATION_REQUESTED --> CANCELLATION_APPROVED: Согласование
  CANCELLATION_REQUESTED --> IN_PROCESSING: Отклонить отмену
  CANCELLATION_APPROVED --> CANCELLED: Отменить
  CANCELLED --> CLOSED: Закрыть после расчётов
  FULFILLED --> CLOSED: Закрыть после расчётов
  OrderNEW --> PROBLEM
  IN_PROCESSING --> PROBLEM
  SENT_TO_BOOKING --> PROBLEM
  PROBLEM --> IN_PROCESSING: Возобновить
  OrderNEW --> SUSPENDED
  IN_PROCESSING --> SUSPENDED
  SUSPENDED --> IN_PROCESSING: Возобновить
```

## 2. Матрица проверенных переходов

| № | Переход | Проверка | Результат |
|---|---|---|---|
| 1 | Request NEW → CONFIRMED | API | PASS |
| 2 | CONFIRMED → CUSTOMER_ACCEPTED | API | PASS |
| 3 | CUSTOMER_ACCEPTED → Order NEW | API/DB | PASS |
| 4 | Order NEW → IN_PROCESSING | API | PASS |
| 5 | IN_PROCESSING → READY_FOR_BOOKING | API | PASS |
| 6 | READY_FOR_BOOKING → SENT_TO_BOOKING | API/DB | PASS |
| 7 | Booking NEW → SENT_TO_SUPPLIER → CONFIRMED → IN_SERVICE → COMPLETED | API | PASS |
| 8 | Booking reject → returnToOrder → re-send | API | PASS |
| 9 | Booking change → resolve change | API | PASS |
| 10 | Booking cancel → все отменены → Order READY_FOR_BOOKING | API/DB | PASS |
| 11 | Одна Booking COMPLETED + одна CANCELLED → PARTIALLY_FULFILLED | API/DB | PASS |
| 12 | Order PROBLEM → resume | API | PASS |
| 13 | Order SUSPENDED → resume | API | PASS |
| 14 | SUSPENDED → close/cancel | API 409 | PASS |
| 15 | Cancellation request → finance approve → CANCELLED → CLOSED | API | PASS |
| 16 | Self-approval отмены | API 409 | PASS |
| 17 | Close с долгами | API 409 | PASS |
| 18 | Complete с долгами | API | PASS |
| 19 | Multi-supplier: 2 услуги / 2 terms | API/DB | PASS |
| 20 | USD: 100 / 40 / 60 / 20 | API/DB | PASS |
| 21 | Возврат клиенту раньше поставщика | API/KPI | PASS |
| 22 | Нумерация двух броней: base, -1 | API/DB | PASS |
| 23 | Номер платежа: MKT-PAY-{seq} без дубля | API | PASS |
| 24 | Lifecycle notifications problem/resume | API/UI | PASS |

## 3. Исправленные дефекты

- **D1.** Тупик согласования отмены: approval требовал terminal-статус. Согласование теперь переводит Order в CANCELLATION_APPROVED, расчёт — после отмены.
- **D2.** Complete/close при активной брони: добавлен guard.
- **D3.** Закрытая отменённая сделка выглядела выполненной: stage больше не определяется терминальной бронью.
- **D4.** Font.register ломал Jest: добавлена защита.
- **D5.** Unit-моки PaymentService: notification-вызовы защищены.
- **D6.** Complete ошибочно требовал погашения долгов: разделены complete/close.
- **D7.** Close guard и KPI считали supplierDebt по-разному: единая формула.
- **D8.** Resume терял предыдущий статус: восстановление из history.
- **D9.** CLOSED отменённая сделка получала supplierDebt: учёт по `cancelledAt`.
- **D10.** Дубль sequence в номере платежа: `MKT-PAY-{seq}` / `-1`.
- **D11.** Нумерация броней начиналась с -1: первая base, вторая -1.
- **D12.** Все отменённые брони переводили Order в FULFILLED: FULFILLED только при всех COMPLETED; все отменены → READY_FOR_BOOKING.
- **D13.** BookingCancelled не реконсилировал Order: обработчик игнорировал отмену и payload без `to`. Добавлена подписка и определение `to=CANCELLED`.

## 4. Финансовые проверки

### Частичная отмена, AZN
```text
Продажа 100; получено 100; возврат клиенту 40
Оплачено поставщику 60; возврат 20
F = (100 − 40) − (60 − 20) = 20
После списания 40: supplierDebt=0, clientDebt=0
```

### USD, возврат клиенту раньше поставщика
```text
После возврата клиенту 40: F = (100−40)−60 = 0; supplierDebt=60
После возврата поставщика 20: F=20; supplierDebt=40
После списания 40: supplierDebt=0; clientDebt=0; CLOSED
```

## 5. Уведомления

```text
ORDER_PROBLEM, ORDER_SUSPENDED, ORDER_RESUMED,
ORDER_CANCELLATION_REQUESTED, ORDER_CANCELLATION_APPROVED,
ORDER_CANCELLED, ORDER_FULFILLED, ORDER_CLOSED
```

Проверка: problem/resume → `orderEvents=2`; UI показывает разные иконки/цвета и ведёт в карточку сделки.

## 6. Тесты

```text
order-actions.active-booking.spec.ts            2/2 PASS
deals.kpi.spec.ts                               PASS
order-financial-settlement.calculator.spec.ts   PASS
booking-to-order.projection.spec.ts             PASS
```

Полный suite после правок:

```text
Test Suites: 189 passed, 189 total
Tests:       2924 passed, 2924 total
```

Важно: `cancellation-close-guard.e2e.spec.ts` в текущей БД не находит cancelled-сделку и завершается без выполнения assertions (return). Поэтому его PASS не подтверждает реальный guard в этом прогоне; сам guard проверялся вручную ранее.

## 7. Round 8 — возврат поставщика раньше клиента

```text
USD 100; клиент оплатил 100; поставщику 60
Сначала возврат поставщика 20 → F = 100 − (60 − 20) = 60
Затем возврат клиенту 40     → F = (100 − 40) − (60 − 20) = 20
После списания 40            → supplierDebt = 0, status = CLOSED
```

KPI на промежуточном шаге:

```text
cancellationIncome = 60.00
clientRefunded      = 0.00
supplierRefunded    = 20.00
supplierDebt        = 40.00
```

После возврата клиенту:

```text
cancellationIncome = 20.00
clientRefunded      = 40.00
supplierRefunded    = 20.00
```

Результат: **PASS**.

## 8. Ограничения

### Мультивалютная сделка — FAIL (не исправлено)

Код `DealsService` суммирует суммы без проверки валюты:

```text
supplierPaid    = Σ supplierPayout.amount   (direction OUTGOING)
supplierRefunded = Σ supplierPayout.amount  (direction INCOMING)
clientReceived  = Σ payment.amount
```

При этом `Payment` не хранит AZN-эквивалент, а `SupplierPayout` имеет `amount`, `currency`, `aznAmount`. Если поставщику оплачено в EUR, а продажа в USD, KPI сложит 60 EUR и 100 USD как числа.

Это не исправлено, потому что политика пересчёта в валюту сделки не определена однозначно. Нельзя молча выбрать курс или валюту. Требуется решение:

- запретить разные валюты в одной сделке; или
- пересчитывать все операции в валюту сделки по зафиксированному курсу.

До решения multi-currency **FAIL**.

- Не проверено частичное выполнение до отмены (только partial fulfillment после completed/cancelled).
- E2E cancellation guard выполнен без фикстуры (vacuous pass).

## 9. Итог

```text
Request → Order → Booking              PASS
Booking complete / reject / change     PASS
Все брони отменены → READY             PASS
Partial fulfillment                    PASS
Problem / Suspend / Resume             PASS
Cancellation → financial close         PASS
Partial finance / penalties / writeoff PASS
Multi-supplier                         PASS
USD + refund ordering                  PASS
Supplier refund before client          PASS
Multi-currency in one deal             FAIL — суммы разных валют складываются без FX
Booking/payment numbering              PASS
Lifecycle notifications                PASS
Full Jest suite                         PASS — 2924/2924
Cancellation e2e fixture                PARTIAL — vacuous pass без cancelled-сделки
```

Коммиты:

```text
e5d58cb fix: close lifecycle gaps in cancellation, completion and deal stage
48da1d8 test: keep payment unit mocks compatible with notifications
73aa0b8 fix: cancelled closed debt and uniform payment reference
803b200 fix: sequential booking reference numbering across order items
6725057 feat: lifecycle order notifications and booking numbering verification
9437eb4 fix: cancelled bookings no longer fulfill order
0ad018e fix: reconcile order to ready when all bookings cancelled
4f05a39 fix: reconcile booking cancellations without status payload
```
