# TRAVELHUB — MULTI / PARTIAL PAYMENTS STRICT IMPLEMENTATION PROMPT

## Цель

Реализовать новую бизнес-модель платежей TravelHUB:

> Один Order может иметь **неограниченное количество платежей**, каждый платеж имеет собственную сумму, а Order постепенно погашается суммой подтверждённых платежей.

Пример:

```text
Order = 1 300 AZN
Payment #1 = 300
Payment #2 = 500
Payment #3 = 400
Payment #4 = 100
Paid = 1 300
Due = 0
Order.paymentStatus = PAID
```

Предыдущая frontend-реализация Create Payment была рассчитана на старую модель полного платежа и не является достаточной для этой задачи.

## 1. Перед изменениями

Изучи текущий repository state и существующий Multi/Partial Payments audit, если он уже есть.

Проверить:
- Payment_one_active_per_order;
- server-owned amount;
- Order.paymentStatus;
- Order.paidAmount;
- Order.refundedAmount;
- PARTIALLY_PAID;
- Payment.isActivePayment;
- payment transitions;
- refunds;
- PaymentHistory;
- payment registry;
- Analytics payment cards;
- уже реализованный CreatePaymentForm.

Не ломать ранее принятые owner decisions.

## 2. Бизнес-правила

### Unlimited payments

Количество платежей для одного Order не ограничено.

Не вводить maxPayments и не сохранять ограничение one-active-payment как бизнес-правило.

### Partial payment

Каждый Payment имеет собственную сумму:

```text
Order = 1300
300 + 500 + 400 + 100 = 1300
```

### Amount

В Create Payment появляется редактируемое поле:

```text
Сумма платежа [ 300.00 ] AZN
```

Backend обязан самостоятельно валидировать сумму.

Правило:

```text
0 < paymentAmount <= currentDue
```

Нельзя доверять client supplied:
- remaining;
- paidAmount;
- orderTotal.

### Status Order

```text
paidAmount == 0           → UNPAID
0 < paidAmount < total    → PARTIALLY_PAID
paidAmount >= total       → PAID
```

Не считать PENDING/FAILED/CANCELLED фактически оплаченными.

### CAPTURED

Только подтверждённый платеж увеличивает paidAmount.

FAILED/CANCELLED не увеличивают его.

PENDING не увеличивает его.

## 3. Убрать старое ограничение

Текущее ограничение `Payment_one_active_per_order`, если оно запрещает несколько одновременно существующих платежей, должно быть безопасно устранено/изменено.

Цель:

```text
Order
 ├── Payment 1
 ├── Payment 2
 ├── Payment 3
 └── Payment N
```

Количество не ограничено.

Не удалять историю.

## 4. Concurrency

Защитить от race condition.

Пример:

```text
Due = 500
A пытается 400
B одновременно пытается 200
```

Нельзя допустить подтверждённый итог 600.

Проверка остатка должна быть transaction-safe/atomic.

Добавить соответствующий тест.

## 5. Financial calculation

Канонически:

```text
paidAmount =
sum of applicable successfully captured payments
```

```text
dueAmount =
max(0, order.amount - paidAmount - applicable adjustments)
```

Использовать существующую financial/refund authority. Не создавать второй источник истины.

## 6. Refund

Изучить существующий Refund aggregate и не ломать его.

Не переводить Payment в REFUNDED автоматически, если текущая архитектура использует отдельный Refund aggregate.

После refund financial summary должна оставаться математически корректной.

## 7. Payment table

Таблица платежей должна быть доступна в:
- Payments registry;
- Order financial/payment section;
- Booking financial context, если существующий UI показывает платежи Order.

Колонки обязательны:

```text
№
Дата
Сумма
Остаток
Форма оплаты
Статус
Кто принял
```

Пример:

| № | Дата | Сумма | Остаток | Форма оплаты | Статус | Кто принял |
|---|---|---:|---:|---|---|---|
| 1 | 08.10.2026 10:15 | 300 AZN | 1000 AZN | Наличные | CAPTURED | Manager |
| 2 | 10.10.2026 14:20 | 500 AZN | 500 AZN | Карта | CAPTURED | Manager |
| 3 | 15.10.2026 11:05 | 400 AZN | 100 AZN | Перевод | CAPTURED | Manager |
| 4 | 20.10.2026 16:40 | 100 AZN | 0 AZN | Наличные | CAPTURED | Manager |

### Остаток

Для каждой строки:

```text
remainingAfterPayment =
orderTotal - cumulativeApplicableCapturedPaymentsThroughThisPayment
```

Исторический остаток строки не должен подменяться текущим остатком Order.

## 8. Payment date

Проверить, является ли `createdAt` единственной датой или существует отдельная business payment date.

Не придумывать поле без проверки.

Если нужна отдельная дата и это требует schema change — явно зафиксировать migration и влияние на существующие данные.

## 9. Create Payment UI

Форма:

```text
Создать платеж

Заказ
[ ORD-00000201 ]

Стоимость заказа
1 300.00 AZN

Оплачено
800.00 AZN

Осталось
500.00 AZN

Сумма платежа
[ 300.00 ] AZN

Форма оплаты
[ Наличные ▼ ]

Причина *
[........................]

Примечание
[........................]

[Отмена] [Создать платеж]
```

Amount editable.

Total/Paid/Due readonly.

## 10. Entry points

### Payments

```text
Центр управления → Платежи → + Создать платеж
```

Order selector.

### Order

```text
Order → + Создать платеж
```

Order автоматически выбран.

### Booking

```text
Booking → + Создать платеж
```

Использовать:

```text
booking.linkedOrder.id
```

Не отправлять bookingId, если текущая domain model не требует прямой связи.

## 11. Payment methods

Сохранить согласованный allowlist:

```text
cash
card
bank_transfer
other
```

Labels RU/AZ/EN.

Если repository уже содержит canonical values — использовать их.

## 12. API

Create payload должен включать:

```json
{
  "orderId": "...",
  "amount": "300.00",
  "paymentMethod": "cash",
  "reason": "...",
  "initialNote": "..."
}
```

Frontend не передаёт:
- paidAmount;
- dueAmount;
- orderTotal;
- paymentStatus.

Backend authority проверяет amount.

## 13. Idempotency

Сохранить существующий idempotency contract.

Повтор одного и того же create request не должен создавать дубликат.

Но разные легальные платежи:

```text
300
500
400
```

должны создаваться как отдельные Payment records.

## 14. RBAC

Сохранить:
- finance.payment.create;
- finance.payment.manage;
- finance.payment.read.

Не обходить backend authority.

## 15. Analytics

Платежи находятся в Центре управления.

В Аналитике уже существуют payment cards.

Не создавать вторую payment analytics system.

Не менять KPI без необходимости.

Проверить, что multi-payment корректно работает с существующими:
- payment count;
- captured payments;
- payment amount;
- navigation.

## 16. Tests

### Backend

Обязательно проверить:

1. create 300 from Order 1300;
2. create 500;
3. create 400;
4. create 100;
5. final PAID;
6. unlimited count;
7. zero rejected;
8. negative rejected;
9. amount > due rejected;
10. FAILED не увеличивает paid;
11. CANCELLED не увеличивает paid;
12. PENDING не увеличивает paid;
13. CAPTURED увеличивает paid;
14. PARTIALLY_PAID;
15. PAID;
16. remaining balance;
17. concurrent overpayment protection;
18. idempotent retry;
19. refund interaction;
20. history/audit.

### E2E

Полная цепочка:

```text
Order 1300
→ Payment 300
→ PARTIALLY_PAID / due 1000
→ Payment 500
→ PARTIALLY_PAID / due 500
→ Payment 400
→ PARTIALLY_PAID / due 100
→ Payment 100
→ PAID / due 0
```

### Frontend

Проверить:
- create button;
- permission;
- amount editable;
- total/paid/due readonly;
- amount payload;
- validation;
- method;
- reason;
- Order context;
- Booking context;
- no bookingId;
- payment table;
- remaining column;
- refresh;
- Analytics navigation;
- RU/AZ/EN.

## 17. Browser smoke

Проверить реальный UI:
- Payments;
- Order;
- Booking;
- таблицу платежей;
- остаток;
- форму partial payment.

Не создавать платежи в production. Для dev/test использовать только контролируемые тестовые данные.

## 18. Safety

Не менять:
- Supplier Markup/Pricing;
- Request lifecycle;
- Booking lifecycle;
- Traveler;
- WhatsApp;
- supplier adapters;
- unrelated Analytics.

До отдельной команды владельца:

```text
NO COMMIT
NO PUSH
```

Не выполнять массовый data repair.

## 19. Final report

Создать:

`TRAVELHUB_MULTI_PARTIAL_PAYMENTS_IMPLEMENTATION_REPORT.md`

Разделы:

```text
1. Verdict
2. Business model
3. Payment model changes
4. Order financial logic
5. Partial payment logic
6. Unlimited payment logic
7. Overpayment protection
8. Concurrency
9. Refund interaction
10. Payment table
11. Remaining calculation
12. Payment date decision
13. Payments UI
14. Order UI
15. Booking UI
16. Analytics
17. API
18. RBAC
19. Tests
20. Browser smoke
21. Typecheck
22. Migration/schema
23. Git status
24. Known limitations
25. Final acceptance matrix
```

## 20. Final acceptance

PASS только если:

```text
Order = 1300

300 → valid
500 → valid
400 → valid
100 → valid

Paid = 1300
Due = 0
Status = PAID
```

и:

```text
количество платежей = unlimited
```

При Due=300:

```text
300 → valid
300.01 → rejected
0 → rejected
-1 → rejected
```

Таблица содержит:

```text
№ | Дата | Сумма | Остаток | Форма оплаты | Статус | Кто принял
```

Работают:

```text
Центр управления → Платежи → Создать платеж
Order → Создать платеж
Booking → Создать платеж
```

Booking использует `linkedOrder.id`.

Analytics payment cards продолжают работать.

Backend остаётся financial authority.

NO COMMIT / NO PUSH до отдельного разрешения владельца.
