# Navitravel — Lifecycle Graph Audit

Дата: 2026-11-07  
Режим: реальные API-вызовы на рабочей БД + Jest.  
Статус: **ЧАСТИЧНО ЗАВЕРШЕНО** — основные маршруты пройдены, полный обход всех боковых ветвей и полный зелёный прогон тестов не достигнуты.

## 1. Карта жизненного цикла

```mermaid
stateDiagram-v2
  [*] --> RequestNew: create request

  state Request {
    RequestNew --> Checking: start
    RequestNew --> Confirmed: confirm price
    RequestNew --> PriceChanged: propose price
    RequestNew --> Rejected: reject
    RequestNew --> Unavailable: unavailable
    Checking --> Confirmed: confirm price
    Checking --> PriceChanged: propose price
    Checking --> Rejected: reject
    Checking --> Unavailable: unavailable
    Confirmed --> CustomerAccepted: customer accept
    Confirmed --> CancelledByCustomer: customer decline
    PriceChanged --> CustomerAccepted: customer accept
    PriceChanged --> CancelledByCustomer: customer decline
    CustomerAccepted --> Converted: convert
  }

  Converted --> OrderNew: create Order

  state Order {
    OrderNew --> InProcessing: process
    InProcessing --> WaitingData: mark waiting
    WaitingData --> InProcessing: resume
    InProcessing --> ReadyForBooking: confirm
    WaitingData --> ReadyForBooking: confirm
    ReadyForBooking --> SentToBooking: send
    ReadyForBooking --> WaitingFirstPayment: wait payment
    WaitingFirstPayment --> SentToBooking: send
    SentToBooking --> Fulfilled: complete
    SentToBooking --> PartiallyFulfilled: partial return
    PartiallyFulfilled --> Fulfilled: complete
    SentToBooking --> CancellationRequested: request cancellation
    InProcessing --> CancellationRequested: request cancellation
    CancellationRequested --> CancellationApproved: finance approval
    CancellationRequested --> InProcessing: reject cancellation
    CancellationApproved --> Cancelled: cancel
    Fulfilled --> Closed: close
    Cancelled --> Closed: close
    OrderNew --> Problem: problem
    InProcessing --> Problem: problem
    SentToBooking --> Problem: problem
    Problem --> InProcessing: resume
    OrderNew --> Suspended: suspend
    InProcessing --> Suspended: suspend
    Suspended --> InProcessing: resume
    Active --> Cancelled: returnToRequest
  }

  state Booking {
    BookingNew --> Preparing: prepare
    BookingNew --> SentToSupplier: send
    Preparing --> SentToSupplier: send
    SentToSupplier --> Confirmed: confirm
    SentToSupplier --> SupplierRejected: reject
    SentToSupplier --> Clarification: request clarification
    Clarification --> SentToSupplier: resume
    Confirmed --> InService: service
    InService --> Completed: complete
    Confirmed --> ChangeRequested: request change
    ChangeRequested --> Confirmed: resolve change
    Confirmed --> CancellationRequestedBooking: request cancellation
    BookingNew --> CancelledBooking: cancel
    SentToSupplier --> CancelledBooking: cancel
    SentToSupplier --> ProblemBooking: problem
    Completed --> [*]
    CancelledBooking --> [*]
  }

  Closed --> [*]
  Cancelled --> [*]
```

Примечание: `Active` — агрегированное обозначение активного диапазона Order; фактические статусы перечислены в `TRANSITIONS`.

## 2. Матрица проверенных переходов

| № | Начальный статус | Действие | Следующий статус | Проверка | Результат |
|---|---|---|---|---|---|
| 1 | Request NEW | confirm price | CONFIRMED | API | PASS |
| 2 | Request CONFIRMED | customer accept | CUSTOMER_ACCEPTED | API | PASS |
| 3 | Request CUSTOMER_ACCEPTED | convert | CONVERTED + Order NEW | API/DB | PASS |
| 4 | Order NEW | process | IN_PROCESSING | API | PASS |
| 5 | Order IN_PROCESSING | complete without active booking/debts | 409 | API | PASS (guard) |
| 6 | Order IN_PROCESSING | final-confirm travelers | finalConfirmedAt set | API | PASS |
| 7 | Order IN_PROCESSING (confirmed data) | confirm | READY_FOR_BOOKING | API | PASS |
| 8 | Order READY_FOR_BOOKING | send | SENT_TO_BOOKING + Booking NEW | API/DB | PASS |
| 9 | Booking NEW | send | SENT_TO_SUPPLIER | API | PASS |
| 10 | Booking SENT_TO_SUPPLIER | confirm | CONFIRMED | API | PASS |
| 11 | Booking CONFIRMED | service | IN_SERVICE | API | PASS |
| 12 | Booking IN_SERVICE | complete | COMPLETED | API | PASS |
| 13 | Order SENT_TO_BOOKING | request cancellation | CANCELLATION_REQUESTED | API | PASS |
| 14 | Cancellation CANCELLATION_REQUESTED | self-approve | 409 self-approval | API | PASS |
| 15 | Cancellation CANCELLATION_REQUESTED | finance approve | CANCELLATION_APPROVED | API | PASS (after fix) |
| 16 | Order CANCELLATION_APPROVED | cancel | CANCELLED | API | PASS |
| 17 | Order CANCELLED | close | CLOSED | API | PASS |
| 18 | Order CLOSED (cancelledAt) | KPI projection | cancelled, not completed | API | PASS (after fix) |
| 19 | Active Booking present | complete/close projection | actions hidden | Jest | PASS |
| 20 | Payment notification unit path | create/confirm | no crash on minimal mocks | Jest | PASS |

## 3. Найденные и исправленные дефекты

### D1. Тупик согласования отмены

**Причина:** `approveCancellationApproval` вызывал `confirm()` финансового расчёта, а `confirm()` разрешён только для `CANCELLED/COMPLETED`. Заказ в `CANCELLATION_REQUESTED` не мог быть ни согласован, ни отменён.

**Исправление:** согласование теперь фиксирует `CancellationApproval=APPROVED` и переводит Order `CANCELLATION_REQUESTED → CANCELLATION_APPROVED`; финансовый расчёт выполняется после фактической отмены.

**Повторная проверка:** finance-пользователь получил `APPROVED`, Order перешёл в `CANCELLATION_APPROVED`, затем `cancel → CANCELLED`, `close → CLOSED` — PASS.

### D2. Завершение/закрытие при активной брони

**Причина:** guards `complete/close` проверяли только долги, но не активные Booking.

**Исправление:** добавлена проверка `booking.status notIn BOOKING_TERMINAL`; проекция скрывает `complete/close` при активной брони.

**Повторная проверка:** новый Jest-тест `order-actions.active-booking.spec.ts` — 2/2 PASS.

### D3. Отменённая закрытая сделка выглядела как выполненная

**Причина:** `COMPLETED` бронь делала stage `BOOKING`, а `status` брался из брони, поэтому закрытая отменённая сделка не получала признак «Отменена и закрыта».

**Исправление:** терминальные брони (`COMPLETED/CANCELLED/SUPPLIER_REJECTED`) больше не определяют stage; UI использует `isCancelledDeal` для метки.

**Повторная проверка:** API: `stage=ORDER`, `status=CLOSED`, `isCancelledDeal=true`, `expectedIncome=0`, `currentIncome=0` — PASS.

### D4. Падение Jest из-за Font.register

**Причина:** `Font.register` вызывался на верхнем уровне и падал в тестовом окружении, где `Font` не определён.

**Исправление:** регистрация защищена проверкой `Font && typeof Font.register === "function"`.

**Повторная проверка:** `documents.service.spec.ts` PASS.

### D5. Unit-моки PaymentService не содержали notification-моделей

**Причина:** новый код уведомлений обращался к `tx.user/userNotification` в тестах без этих моков.

**Исправление:** безопасные проверки наличия делегатов; production-поведение не изменено.

**Повторная проверка:** `payment.service.spec.ts` — 26/27 PASS; оставшийся FAIL относится к старому ожиданию «CANCELLED нельзя оплачивать», тогда как по текущему требованию оплата отменённого заказа разрешена до закрытия.

## 4. Покрытие и тесты

Полный Jest-прогон (до последних правок):

```text
Test Suites: 11 failed, 177 passed, 188 total
Tests:       20 failed, 2829 passed, 2849 total
```

После исправлений точечно:

```text
order-actions.active-booking.spec.ts   2/2 PASS
documents.service.spec.ts              PASS
payment.service.spec.ts                26/27 PASS
cancellation e2e                       не выполнен: в БД нет подготовленной cancelled-сделки с PENDING approval
```

### Причины оставшихся FAIL

1. `cancellation-close-guard.e2e.spec.ts` — тест зависит от наличия cancelled-сделки в main DB; после очистки тестовых данных фикстуры нет.
2. `order-to-request.projection.spec.ts` — устаревшие ожидания: тест ожидает `cancel`, lifecycle использует `requestCancellation`; CANCELLED теперь имеет `close`.
3. `tour-request.service.spec.ts` — mock ожидает вызов `assign("r1")`, код вызывает `assign("r1", undefined, {respectMode:true})`.
4. `whatsapp.module.spec.ts` — тест ожидает `WHATSAPP_ENABLED=false`, но `.env` содержит `true`.
5. `azal.controller.spec.ts`, `date-param.registry-matrix.spec.ts` — не обновлены конструкторы после добавления зависимостей.
6. `request-travelers.spec.ts` — тест ожидает только FIO+birthDate, код теперь принимает passport-поля.
7. `shared/pii.spec.ts` — тест ожидает redaction для SALES_MANAGER, текущая политика разрешает PII sales-ролям.
8. `hotel-category.spec.ts` — расхождение правил категорий 1–3* (вне lifecycle).

## 5. Финансовая проверка

Проверено на тестовой отменённой сделке:

```text
Сумма продажи        100.00
Получено клиента       0.00
Возвращено клиенту     0.00
Оплачено поставщику    0.00
Возврат поставщика     0.00
Ожидаемый доход        0.00
Текущий доход          0.00
Отменённые продажи   100.00
Отменённых сделок        1
```

Формула отмены в KPI использует:

```text
F = (P − Rt) − (S − Rs)
```

Сделка с `cancelledAt` и статусом `CLOSED` остаётся отменённой и не попадает в выполненные/текущий доход — PASS.

Не проверены на реальных данных:
- частичные возвраты и штрафы;
- несколько поставщиков;
- разные валюты;
- списания;
- возврат раньше поставщика;
- отмена после частичного выполнения.

## 6. Технические изменения

- `backend/src/modules/finance/order-financial-settlement.service.ts` — устранён тупик согласования отмены.
- `backend/src/modules/order/order.service.ts` — guard активной брони для complete/close + проекция.
- `backend/src/modules/finance/deals.service.ts` — терминальные брони не определяют stage.
- `frontend/app/app/finance/deals/page.tsx` — метка «Отменена и закрыта» по `isCancelledDeal`.
- `backend/src/modules/documents/document-renderer.service.ts` — безопасная регистрация Font.
- `backend/src/modules/finance/payment.service.ts` — безопасные notification-вызовы для unit-моков.
- `backend/src/modules/order/order-actions.active-booking.spec.ts` — новый тест.
- `backend/src/modules/finance/finance.controller.ts` — PATCH refund (сопутствующая незакоммиченная правка).

Коммиты:

```text
e5d58cb fix: close lifecycle gaps in cancellation, completion and deal stage
48da1d8 test: keep payment unit mocks compatible with notifications
```

## 7. Итоговый статус

| Направление | Статус |
|---|---|
| Request lifecycle (базовый маршрут) | PASS |
| Request → Order conversion | PASS |
| Order NEW → SENT_TO_BOOKING | PASS |
| Booking NEW → COMPLETED | PASS |
| Cancellation approval → CANCELLED → CLOSED | PASS (после исправления) |
| KPI отменённой закрытой сделки | PASS |
| Guard активной брони | PASS (unit projection) |
| PROBLEM / SUSPENDED | FAIL — не проверены реальными API-вызовами |
| Booking reject/change/cancel/return | FAIL — не проверены |
| Частичные оплаты/возвраты/штрафы/списания | FAIL — не проверены |
| Полный Jest suite | FAIL — 20 тестов, причины выше |
| RBAC всех переходов | PARTIAL — проверены finance-approval и self-approval |

**Общий вывод:** базовый граф Request → Order → Booking → cancellation → close теперь проходим, ключевой тупик отмены устранён. Полная приёмка по всем боковым ветвям и всем 2849 тестам не достигнута.
