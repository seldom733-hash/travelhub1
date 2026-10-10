# TRAVELHUB — PAYMENTS CREATE FRONTEND IMPLEMENTATION PROMPT

## Цель

Реализовать frontend-сценарий создания платежа на базе уже существующего backend API.

Backend contract:
- `POST /api/v1/finance/payments`
- `orderId` — required
- `reason` — required, 1..255
- `paymentMethod` — optional
- `initialNote` — optional, <=5000
- `amount` и `currency` — server-owned, НЕ отправлять frontend
- permission: `finance.payment.create`

Read-only audit: `TRAVELHUB_PAYMENTS_CREATE_READ_ONLY_AUDIT_REPORT.md`.

---

## 1. Центр управления → Платежи

Платежи находятся в **Центре управления**.

В существующий Payments registry:

`frontend/app/app/payments/page.tsx`

добавить:

**`+ Создать платеж`**

Использовать существующий `OperationsToolbarSlot`, а не создавать новый toolbar.

Кнопка доступна только при:

`finance.payment.create`

Использовать существующий permission mechanism проекта.

Форма должна быть modal/drawer в стиле существующего TravelHUB UI.

---

## 2. Форма

Поля:

```text
Заказ              [ выбрать Order ]
Сумма              [ 1 250.00 AZN ]  READ ONLY
Способ оплаты      [ Наличные ▼ ]
Причина *          [................]
Примечание         [................]
                    [Отмена] [Создать платеж]
```

### Способы оплаты

Согласованный allowlist:

```text
Наличные            → cash
Банковская карта    → card
Банковский перевод  → bank_transfer
Другое              → other
```

Перед использованием проверить существующие internal values проекта. Если стандартизированные значения уже существуют — использовать их.

### Критично

Frontend **никогда не отправляет**:

```text
amount
currency
status
customerId
partnerId
providerRef
version
id
code
timestamps
```

Payload:

```json
{
  "orderId": "...",
  "paymentMethod": "cash",
  "reason": "...",
  "initialNote": "..."
}
```

Сумма только отображается. Backend сам берёт `Order.amount/currency`.

---

## 3. Payments page

Встроить create mutation в существующий frontend API abstraction.

Не создавать новый backend endpoint и не дублировать API client.

После `201`:
- закрыть форму;
- показать success feedback;
- обновить Payments registry;
- сохранить текущие filters/search/pagination, насколько позволяет существующий механизм.

Ошибки:
- `403` — нет права;
- `404` — Order не найден;
- `409` — активный платеж уже существует;
- `422` — validation error.

---

## 4. Order detail

Файл:

`frontend/app/app/orders/[id]/page.tsx`

Добавить:

**`+ Создать платеж`**

в существующий финансовый контекст.

При открытии:

```text
orderId = currentOrder.id
```

Order нельзя случайно заменить на другой.

После успешного создания обновить существующую финансовую историю/данные Order.

Не менять Order lifecycle или backend.

---

## 5. Booking detail

Файл:

`frontend/app/app/bookings/[id]/page.tsx`

Добавить:

**`+ Создать платеж`**

Booking является контекстом, но Payment принадлежит Order.

Использовать:

```text
booking.linkedOrder.id
```

Payload:

```json
{
  "orderId": "booking.linkedOrder.id",
  ...
}
```

**Никогда не отправлять `bookingId`.**

После создания обновить существующие:

```text
financialSummary
activePayment
```

---

## 6. Аналитика

В **Аналитике уже существуют карточки оплат**.

Перед изменением найти их фактические компоненты, data source и navigation.

Обязательно сохранить существующий контракт.

Не создавать:
- новый payment dashboard;
- новые KPI;
- новый financial aggregate;
- второй payment registry;
- второй API.

Если существующие payment cards ведут в `/app/payments`, navigation не ломать.

Не менять расчёт карточек и backend aggregates.

Проверить тестами, что существующая navigation Analytics → Payments продолжает работать.

---

## 7. i18n

Добавить RU/AZ/EN ключи для:

- Создать платеж
- Заказ
- Сумма
- Способ оплаты
- Наличные
- Банковская карта
- Банковский перевод
- Другое
- Причина
- Примечание
- Создать
- Отмена
- Платёж успешно создан
- Нет прав
- Активный платёж уже существует
- Заказ не найден

Не использовать hardcoded user-facing strings.

---

## 8. UX

Состояния:

```text
idle
loading order
submitting
success
error
```

Во время submit:
- disable submit;
- предотвратить double-click;
- не запускать два POST из одного действия.

Использовать существующие TravelHUB UI components.

---

## 9. Backend / schema — НЕ ТРОГАТЬ

Запрещено менять:

- Payment model;
- Prisma;
- migrations;
- PaymentService;
- FinanceController;
- CreatePaymentDto;
- payment state machine;
- PaymentHistory;
- Refund;
- Order financial projection;
- Booking financial logic;
- lifecycle;
- Supplier Pricing/Markup.

Backend уже готов.

Schema `Payment.bookingId` добавлять **не нужно**.

Архитектура:

```text
Booking
   ↓
linkedOrder.id
   ↓
Payment.orderId
```

---

## 10. Tests

Добавить frontend tests:

### Payments
- permission shows/hides button;
- form opens;
- Order selector;
- amount read-only;
- amount/currency отсутствуют в POST;
- reason required;
- payment method;
- initialNote;
- successful POST;
- refresh;
- 403;
- 404;
- 409;
- 422.

### Order
Проверить:

```text
Order → Create payment → orderId=currentOrder.id
```

### Booking
Проверить:

```text
Booking → Create payment
→ orderId=booking.linkedOrder.id
→ bookingId отсутствует
```

### Analytics
Проверить, что существующая payment-card navigation не сломана.

---

## 11. Acceptance Criteria

### AC-1
В Центре управления → Платежи есть `+ Создать платеж`.

### AC-2
Без `finance.payment.create` кнопка отсутствует.

### AC-3
Можно выбрать Order.

### AC-4
Amount/currency отображаются read-only.

### AC-5
Amount/currency не отправляются frontend.

### AC-6
Reason обязателен.

### AC-7
Payment methods:

```text
cash
card
bank_transfer
other
```

### AC-8
POST:

`/api/v1/finance/payments`

### AC-9
После 201 Payments registry обновляется.

### AC-10
Order detail имеет `+ Создать платеж` с автоматически выбранным Order.

### AC-11
Booking detail имеет `+ Создать платеж` с `booking.linkedOrder.id`.

### AC-12
`bookingId` не отправляется.

### AC-13
Booking после создания обновляет `financialSummary/activePayment`.

### AC-14
Analytics payment cards/navigation не сломаны.

### AC-15
RU/AZ/EN работают.

### AC-16
Frontend typecheck проходит.

### AC-17
Все новые/затронутые frontend tests проходят.

### AC-18
Backend/schema не изменены.

---

## 12. Git policy

До отдельной команды владельца:

```text
NO COMMIT
NO PUSH
```

Изменять только необходимые frontend-файлы.

Если обнаружена backend/schema проблема — остановиться и зафиксировать её в отчёте, не менять backend.

---

## 13. Final report

Создать:

`TRAVELHUB_PAYMENTS_CREATE_FRONTEND_IMPLEMENTATION_REPORT.md`

Структура:

```text
1. Verdict
2. Files changed
3. Payments UI
4. Order UI
5. Booking UI
6. Analytics verification
7. API integration
8. Permission handling
9. i18n
10. Tests
11. Typecheck
12. Backend untouched confirmation
13. Schema untouched confirmation
14. Git status
15. Known limitations
16. Final acceptance matrix
```

Verdict:

```text
PASS
PASS WITH BLOCKER
FAIL
```

PASS невозможен, если:
- amount стал редактируемым;
- frontend отправляет amount/currency;
- frontend отправляет bookingId;
- permission bypass возможен;
- Analytics payment cards/navigation сломаны;
- Order/Booking context не работает;
- backend/schema изменены без отдельного разрешения.
