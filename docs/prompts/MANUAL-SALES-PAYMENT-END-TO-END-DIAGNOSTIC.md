# MANUAL SALES → ORDER → PAYMENT → BOOKING
# END-TO-END DIAGNOSTIC AND ARCHITECTURE RECONCILIATION

## MODE

READ-ONLY DIAGNOSTIC / ARCHITECTURE RECONCILIATION.

НЕ НАЧИНАТЬ IMPLEMENTATION ДО ЗАВЕРШЕНИЯ ДИАГНОСТИКИ.

НЕ ДЕЛАТЬ:

- production code changes;
- schema changes;
- migrations;
- test changes;
- seed changes;
- UI changes;
- commit;
- push.

Не создавать тестовый Order или Payment в production/runtime DB.

---

# 1. CURRENT USER-OBSERVED PROBLEM

В Platform Workspace существует реальная Request:

```text
801c9f13-05a7-4e6b-92ec-768c6a13a275
```

Пользователь нажал:

```text
Создать заказ
```

Backend вернул:

```text
Request 801c9f13-05a7-4e6b-92ec-768c6a13a275
has no accepted price/currency;
conversion requires commercial terms
```

При этом пользователь обнаружил более фундаментальную проблему:

> В текущем интерфейсе/процессе нет нормальной возможности ручного занесения / регистрации фактически полученного платежа.

Нужно исследовать не только эту ошибку, а весь canonical business flow.

---

# 2. BUSINESS FLOW TO VERIFY

Проверить фактическую реализацию:

```text
Manual / Office / Direct Sale
        ↓
Customer
        ↓
Commercial terms
        ↓
Order
        ↓
Register / Accept Payment
        ↓
Payment
        ↓
Booking
        ↓
Fulfillment
```

Для Request-origin flow:

```text
Request
        ↓
accepted commercial terms
        ↓
Order
        ↓
manual/offline Payment
        ↓
Booking
```

Не предполагать, что эти два flow уже корректно соединены.

Найти фактическую реализацию.

---

# 3. CANONICAL ARCHITECTURE — PRESERVE

В существующей архитектуре уже зафиксированы следующие принципы.

Не переопределять их без contradictory repository evidence.

## Manual / Direct

Целевой бизнес-flow:

```text
Employee
→ resolve/create Customer
→ Create Order manually
→ create Booking from Order when required
→ register/accept Payment
→ continue fulfillment
```

Manual Order — это тот же canonical Order, а не отдельная сущность.

Manual/Direct должен использовать существующий canonical source/attribution mechanism.

## Payment

Platform имеет legitimate authority для manual/offline Payment.

Целевой flow:

```text
Order Detail
→ Register / Accept Payment
→ Payment linked to exact Order
```

Payment amount должен быть server-derived от canonical Order.

Manual Platform Payment требует reason.

---

# 4. CRITICAL AUTHORITY RECONCILIATION

Есть потенциальное противоречие в ранее зафиксированных архитектурных материалах:

Одна часть architecture/roadmap говорит:

```text
Platform Orders
→ Create Order
→ REQUIRED for Manual/Direct sales
```

Другая financial/governance remediation фиксирует:

```text
Platform cannot create normal commercial Orders
```

Нельзя просто выбрать один вариант по предположению.

Нужно исследовать repository и установить фактический canonical contract.

Ответить:

### A

Запрещено ли Platform создавать Order вообще?

или

### B

Запрещено только создавать обычный seller-owned/commercial Order напрямую,
но разрешён отдельный:

```text
Platform Manual/Direct Order command
```

с явным:

```text
source = MANUAL / DIRECT / OFFICE
actor = Platform employee
customer = canonical Customer
commercial terms = explicit
```

или

### C

существующий Request → Order является единственным разрешённым путём,
а Manual Sale flow фактически ещё не реализован.

Не исправлять это самостоятельно.

Доказать repository evidence.

---

# 5. REQUEST 801c9f13 — RUNTIME DIAGNOSIS

Для:

```text
801c9f13-05a7-4e6b-92ec-768c6a13a275
```

проверить read-only:

```text
Request.id
Request.status
Request.customerId
Request.commerceSequence
Request.price
Request.currency
acceptedPrice
acceptedCurrency
customerAcceptedAt
supplier confirmation data
commercial acceptance snapshot
pinned requirements
traveler count
convertedOrderId
convertedAt
```

Названия полей должны быть фактическими.

Не придумывать поля.

Определить:

```text
есть ли accepted commercial snapshot?
```

и:

```text
есть ли accepted price?
есть ли accepted currency?
```

---

# 6. REQUEST AVAILABLE ACTIONS

Проверить:

```text
GET /api/v1/requests/:id
```

и фактическое:

```text
availableActions.convert
```

Сопоставить:

```text
UI:
[Создать заказ]
```

с:

```text
server:
availableActions.convert
```

Найти источник кнопки.

Критически проверить:

```text
UI показывает Create Order
BUT
server says conversion unavailable
```

Если такое происходит — это отдельный UI/server-authority defect.

---

# 7. REQUEST → ORDER CONVERSION CONTRACT

Проверить фактический conversion gate.

Установить:

```text
какие именно commercial terms обязательны?
```

Минимально проверить:

```text
price
currency
accepted commercial snapshot
customer acceptance
acceptance timestamp
product/service
traveler count
```

Определить точный источник:

```text
Request price
Product price
Supplier offer
accepted snapshot
Checkout/Sale
```

Нельзя брать текущую mutable Product price вместо принятой цены.

Нельзя создавать Order с "примерной" или текущей ценой.

---

# 8. MAIN QUESTION — WHY IS THERE NO MANUAL PAYMENT?

Исследовать фактическую payment architecture.

Найти:

```text
Payment model
PaymentStatus
PaymentMethod
Payment controller
Payment service
Payment create endpoint
Payment confirmation endpoint
Payment UI
Order → Payment relation
PaymentHistory
availableActions
permissions
```

Проверить существование:

```text
POST /payments
```

и его реальный contract.

---

# 9. MANUAL PAYMENT METHODS

Проверить фактические enum/values.

Canonical business taxonomy предполагает:

```text
CASH
BANK_TRANSFER
BANK_CARD
POS_TERMINAL
ONLINE
```

Но НЕ переименовывать существующие enums автоматически.

Сопоставить actual repository values.

Для manual/offline проверить:

```text
CASH
BANK_TRANSFER
BANK_CARD
POS_TERMINAL
```

ONLINE должен оставаться provider/system controlled.

---

# 10. MANUAL PAYMENT UX

Найти, существует ли на Order Detail:

```text
Принять оплату
```

или:

```text
Зарегистрировать оплату
```

или equivalent action.

Если отсутствует:

не считать это автоматически frontend-only problem.

Сначала проверить:

```text
backend endpoint exists?
permission exists?
service exists?
domain transition exists?
PaymentHistory exists?
UI action exists?
```

Определить точную missing layer:

```text
Domain
API
RBAC
Projection
Frontend
```

---

# 11. PAYMENT CREATION AUTHORITY

Проверить:

```text
who can create Payment?
```

Найти permission фактически используемый repository.

Ранее architecture remediation разделяла:

```text
Payment initiation
≠
Payment lifecycle management
```

Target concept:

```text
finance.payment.create
≠
finance.payment.manage
```

Но не вводить эти literal names автоматически.

Проверить actual permissions.

---

# 12. PAYMENT AMOUNT — HARD RULE

Для manual Payment:

```text
Payment amount
=
server-derived canonical Order amount
```

Проверить:

```text
client amount ignored/validated?
server derives amount?
```

Клиент не должен иметь возможность сделать:

```text
Order = 1000
Payment = 1
```

если domain требует полного payment.

Также определить, поддерживаются ли:

```text
partial payments
multiple payments
remaining balance
overpayment
```

Не вводить новый business rule.

Зафиксировать фактический state.

---

# 13. PAYMENT REASON

Проверить:

```text
manual/offline Payment
→ reason REQUIRED
```

Проверить серверную валидацию:

```text
missing reason → 4xx
blank reason → 4xx
whitespace → 4xx
valid reason → success
```

Проверить persistence:

```text
PaymentHistory.comment
```

или фактическое canonical поле.

Reason должен сохраняться вместе с:

```text
actor
timestamp
Payment ID
Order ID
```

---

# 14. PAYMENT METHOD SEMANTICS

Проверить:

```text
Payment Method != Payment Status
```

Примеры ожидаемой модели:

```text
CASH + CAPTURED
BANK_TRANSFER + CAPTURED
BANK_CARD + CAPTURED
POS_TERMINAL + CAPTURED
ONLINE + provider-controlled status
```

Не смешивать method/status.

---

# 15. MANUAL PAYMENT BUSINESS SEMANTICS

Проверить, что:

```text
register payment
```

означает:

> деньги реально получены/подтверждены сотрудником,

а не:

> создать Payment record.

То есть определить actual transition:

```text
Payment creation
→ pending?
→ captured?
→ paid?
```

Для CASH/BANK_TRANSFER/POS/BANK_CARD определить canonical status transition.

Не придумывать новый статус.

---

# 16. ORDER → PAYMENT → BOOKING

После установления фактических contracts проверить lifecycle:

```text
Order
 ↓
Payment
 ↓
Booking
```

Особенно:

```text
Does payment block Booking?
Does payment create Booking?
Does payment merely change payment status?
Does Booking require finalConfirmedAt?
```

Не смешивать:

```text
OrderStatus
PaymentStatus
BookingStatus
```

---

# 17. REQUEST → ORDER → PAYMENT

Проверить конкретный intended flow:

```text
Request
 ↓
accepted commercial terms
 ↓
Order
 ↓
Register Payment
 ↓
Payment
```

Ответить:

### Can this flow be completed today?

Если НЕТ:

указать первую блокирующую точку.

Например:

```text
Request → Order blocked
```

или:

```text
Order created
→ Payment UI missing
```

или:

```text
Payment endpoint exists
→ permission missing
```

или:

```text
Payment created
→ lifecycle cannot reach CAPTURED
```

---

# 18. MANUAL / DIRECT ORDER

Отдельно проверить возможность:

```text
Employee
→ Customer
→ Manual Order
```

без Request.

Найти:

```text
manual order endpoint
manual order command
source attribution
customer resolver
commercial terms input
price authority
currency
order creation permission
```

Если такого flow нет — это GAP.

Не пытаться использовать Request как искусственную замену Manual Order.

---

# 19. DO NOT CREATE A SECOND COMMERCE ENGINE

Если Manual Order отсутствует, НЕ создавать:

```text
ManualOrder
OfficeOrder
OfflineOrder
```

как отдельные сущности.

Target:

```text
same canonical Order
+
source/attribution = MANUAL/DIRECT/OFFICE
```

если repository architecture подтверждает такой mechanism.

---

# 20. CUSTOMER

Manual sale должен использовать canonical:

```text
Customer
```

а не:

```text
User
```

Проверить:

```text
Customer ≠ User
Customer ≠ Traveler
Customer ≠ Payer
```

Manual sale не должен требовать website self-registration.

---

# 21. FINAL DIAGNOSTIC MATRIX

В отчёте обязательно создать:

| Layer | Exists? | Working? | Evidence | Gap |
|---|---:|---:|---|---|
| Customer resolution | | | | |
| Manual Sale entry | | | | |
| Request commercial acceptance | | | | |
| Request → Order | | | | |
| Manual Order creation | | | | |
| Order commercial amount | | | | |
| Payment creation API | | | | |
| Payment manual UI | | | | |
| Payment permission | | | | |
| Payment reason | | | | |
| Payment amount authority | | | | |
| Payment confirmation | | | | |
| Order → Booking | | | | |
| Payment → Booking relation | | | | |

---

# 22. ROOT CAUSE CLASSIFICATION

Все найденные проблемы классифицировать:

```text
CRITICAL
HIGH
MEDIUM
LOW
PRE-EXISTING
FOLLOW-UP
```

Особенно отдельно выделить:

```text
A. Current Request conversion error
B. Missing manual payment UX
C. Missing manual payment backend
D. Missing manual Order flow
E. Authority conflict
F. Documentation-only gap
```

---

# 23. REQUIRED FINAL ANSWERS

В конце отчёта дать прямые ответы:

### Q1
Почему Request
`801c9f13-05a7-4e6b-92ec-768c6a13a275`
не конвертируется?

### Q2
Есть ли у неё accepted price/currency?

### Q3
Почему UI показывает «Создать заказ»?

### Q4
Существует ли сейчас рабочий Manual Payment flow?

### Q5
Где находится кнопка/command:

```text
Зарегистрировать оплату
```

### Q6
Можно ли сегодня:

```text
Order → register CASH payment
```

### Q7
Можно ли сегодня:

```text
Order → register BANK_TRANSFER payment
```

### Q8
Можно ли сегодня:

```text
Order → register BANK_CARD payment
```

### Q9
Можно ли сегодня:

```text
Order → register POS_TERMINAL payment
```

### Q10
Можно ли сегодня:

```text
Manual Sale
→ Order
→ Payment
→ Booking
```

### Q11
Есть ли отдельный canonical Manual Order command?

### Q12
Есть ли конфликт между:

```text
Platform cannot create normal commercial Orders
```

и:

```text
Manual/Direct sales require Employee → Create Order
```

Если конфликт есть — показать exact source-of-truth conflict.

---

# 24. IMPLEMENTATION RECOMMENDATION

После диагностики предложить НЕ более одного canonical implementation path.

Не предлагать несколько конкурирующих архитектур.

Рекомендация должна показать:

```text
Manual Sale
→ canonical Order
→ canonical Payment
→ canonical Booking
```

и сохранить:

```text
existing Order aggregate
existing Payment aggregate
existing Booking lifecycle
existing Request lifecycle
existing Customer resolver
existing RBAC
existing audit/history
```

---

# 25. REPORT

Создать:

```text
MANUAL-SALES-PAYMENT-END-TO-END-DIAGNOSTIC.md
```

Отчёт преимущественно на русском языке.

Структура:

1. Executive Summary
2. Current Runtime Problem
3. Request 801c9f13 State
4. Request → Order Diagnosis
5. Manual Sales Architecture
6. Manual Order Diagnosis
7. Payment Architecture
8. Manual Payment Diagnosis
9. Order → Payment
10. Payment → Booking
11. Authority / RBAC Reconciliation
12. UI/API/Domain Gap Matrix
13. Root Causes
14. Critical/High/Medium/Low Findings
15. Canonical Recommended Flow
16. Implementation Scope
17. Tests Required
18. Final Verdict

---

# 26. STOP CONDITION

После диагностики:

STOP.

Не исправлять найденные проблемы.

Не создавать Order/Payment.

Не делать migration.

Не commit.

Не push.

Ждать owner approval на implementation.

FINAL VERDICT:

```text
READY FOR IMPLEMENTATION
```

или:

```text
ARCHITECTURE CONFLICT — OWNER DECISION REQUIRED
```

или:

```text
DIAGNOSTIC INCOMPLETE
```
