# TRAVELHUB — PAYMENTS CREATE / ORDER / BOOKING READ-ONLY AUDIT

## Цель

Проведи строгий **READ-ONLY аудит** текущего раздела «Платежи» TravelHUB.

Нужно установить, почему в UI нет кнопки **«Создать платеж»**, и что фактически требуется для сценариев:

- Payments → + Создать платеж → привязать к Order;
- Payments → + Создать платеж → привязать к Booking;
- Order → Платежи → + Создать платеж;
- Booking → Платежи → + Создать платеж.

## Строго запрещено

Во время аудита не изменять:

- код;
- Prisma schema;
- БД;
- migrations;
- UI;
- API;
- тесты;
- конфигурацию.

Не создавать реальные/тестовые платежи.  
Не делать data repair.  
Не делать commit/push/staging.

---

## 1. Prisma / Data Model

Найди фактическую модель `Payment` и зафиксируй все поля.

Особенно проверить:

- `orderId`;
- `bookingId`;
- amount;
- currency;
- status;
- method;
- type;
- reason;
- timestamps;
- все реальные relations.

Проверить связи:

```text
Payment → Order
Payment → Booking
Order → Payment
Booking → Payment
```

Для каждой связи определить:

- required/nullable;
- one-to-one или one-to-many;
- foreign key;
- cascade/restrict;
- может ли Payment существовать без Order;
- может ли Payment существовать без Booking;
- может ли Order иметь несколько платежей;
- может ли Booking иметь несколько платежей.

Не придумывать отсутствующие поля.

---

## 2. Payment Status

Найди реальные enum/const/type статусов Payment.

Зафиксируй все значения и фактические переходы.

Проверить:

- кто меняет статус;
- какие endpoints это делают;
- guards/state machine;
- PaymentHistory/audit.

---

## 3. Payment API

Найди все существующие endpoints:

```text
POST .../payments
PATCH .../payments/:id
GET .../payments
GET .../payments/:id
```

Для каждого указать:

- method;
- URL;
- DTO;
- request body;
- response;
- service;
- RBAC;
- guards.

Если endpoint отсутствует — написать `NOT FOUND`.

Отдельно проверить существующий manual/offline payment flow.

---

## 4. Manual Payment

Проверить фактическую реализацию ручного платежа:

- существует ли;
- endpoint;
- RBAC;
- как определяется amount;
- может ли клиент передать amount;
- или amount определяется сервером;
- требуется ли reason;
- seller/actor attribution;
- PaymentHistory;
- защита от неправильной суммы.

Особенно проверить, доверяет ли backend `client-supplied amount`.

Ничего не менять.

---

## 5. Order Financial Logic

Исследовать Order:

- total;
- payable amount;
- paid amount;
- outstanding amount;
- payment status;
- `OrderPaymentStatus`;
- места, где Payment влияет на Order.

Построить фактическую цепочку:

```text
Order total
   ↓
Payments
   ↓
Paid
   ↓
Outstanding
   ↓
Order payment status
```

Если такой логики нет — зафиксировать.

---

## 6. Booking Financial Logic

Исследовать Booking:

- есть ли amount;
- payment status;
- financial obligation;
- связь с Order;
- существующее использование Payment;
- можно ли по текущей модели привязать Payment напрямую к Booking.

Ключевой вопрос:

```text
Нужен ли реально Payment → Booking
или достаточно Payment → Order
при наличии Booking → Order?
```

Ответить только по коду/schema.

---

## 7. Payment History / Audit

Найти:

- PaymentHistory;
- audit events;
- actor;
- timestamp;
- reason;
- status transition events.

Проверить, что фиксируется при:

- создании;
- изменении статуса;
- capture;
- cancel;
- refund.

---

## 8. RBAC

Найти реальные permissions для payments/finance.

Зафиксировать:

- кто видит платежи;
- кто создаёт;
- кто capture;
- кто cancel;
- кто refund;
- кто редактирует.

Не придумывать новые permissions.

---

## 9. Frontend — Payments

Найди страницу и компоненты Payments.

Проверить наличие:

- списка платежей;
- кнопки создания;
- modal/drawer;
- payment form;
- API client;
- Order selector;
- Booking selector;
- amount;
- currency;
- method;
- reason;
- validation;
- permission guard.

Зафиксировать реальные пути файлов.

---

## 10. Frontend — Order

Найди страницу Order.

Проверить:

- секцию «Платежи»;
- список платежей;
- кнопку `+ Создать платеж`;
- существующий payment context;
- передачу `orderId`.

---

## 11. Frontend — Booking

Найди страницу Booking.

Проверить:

- отображение платежей;
- кнопку создания;
- наличие `bookingId`;
- наличие родительского `orderId`;
- возможность открыть payment form из Booking.

---

## 12. Текущая архитектура

Построить фактическую схему:

```text
Customer
   ↓
Order
   ├── Booking
   └── Payment
```

или, если schema действительно поддерживает:

```text
Customer
   ↓
Order
   ├── Booking
   │     └── Payment
   └── Payment
```

Не использовать предполагаемую схему — только фактическую.

---

## 13. Exact Gaps

Разделить результат на:

### Backend EXISTS

Что уже реализовано.

### Backend MISSING

Что отсутствует.

### Frontend MISSING

Что отсутствует.

### Schema Change Required

Только если действительно требуется.

### Owner Decision Required

Только вопросы, которые нельзя определить по существующему коду.

---

## 14. Owner Decisions

Если нужны решения владельца, вынести отдельно:

### P1
Payment привязывается:

```text
Order only
```

или

```text
Order + optional Booking
```

### P2
Если есть Booking, должен ли `orderId` также быть обязательным?

### P3
Можно ли создать Payment только для Order?

### P4
Источник payable amount:

```text
Order
Booking
Payment form
```

### P5
Может ли менеджер вручную менять amount?

### P6
Какие payment methods поддерживаются?

### P7
Какие payment statuses влияют на financial/lifecycle logic?

Ответы не придумывать.

---

## 15. Scope Isolation

Не менять и не анализировать как часть этого задания:

- Supplier Markup;
- Supplier Pricing;
- Request lifecycle;
- Booking lifecycle;
- Traveler data;
- WhatsApp;
- supplier integrations.

Только Payment и необходимые связи Order/Booking.

---

## 16. Финальный отчёт

Создай:

`TRAVELHUB_PAYMENTS_CREATE_READ_ONLY_AUDIT_REPORT.md`

Структура:

```text
# PAYMENT CREATE READ-ONLY AUDIT

## 1. Verdict
## 2. Current Payment Model
## 3. Payment → Order
## 4. Payment → Booking
## 5. Payment Statuses
## 6. Payment API
## 7. Manual Payment
## 8. Order Financial Logic
## 9. Booking Financial Logic
## 10. Payment History / Audit
## 11. RBAC
## 12. Payments UI
## 13. Order UI
## 14. Booking UI
## 15. Exact Gaps
## 16. Recommended Implementation Boundary
## 17. Owner Decisions Required
## 18. Existing Tests
## 19. Safety / Scope
## 20. Final Verdict
```

В финале дать однозначный статус для каждого сценария:

```text
Payments → Create → Order
YES
NO
YES — FRONTEND ONLY
YES — BACKEND CHANGE REQUIRED
BLOCKED — OWNER DECISION
```

и отдельно:

```text
Payments → Create → Booking
YES
NO
YES — FRONTEND ONLY
YES — BACKEND CHANGE REQUIRED
BLOCKED — OWNER DECISION
```

После аудита — только отчёт. Никаких изменений и commit/push.
