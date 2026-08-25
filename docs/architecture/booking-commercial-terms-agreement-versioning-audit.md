# Booking Commercial Terms, Payment Schedules, Agreement Versioning & Audit

**Статус документа:** PHASE 3 — Architecture & Roadmap Additive Reconciliation
**Дата актуализации:** 2026-08-25
**Тип:** Documentation-only reconciliation (НЕ production implementation)

------------------------------------------------------------------------

# 1. НАЗНАЧЕНИЕ

Canonical authority для коммерческих условий бронирования, платежных
графиков, версионирования документов и аудит-хвоста определяется в
доменах:

``` text
Catalog / Service
→ Order
→ Booking
→ Customer Payment
→ Supplier Settlement
→ Agreement / Document
→ Audit Trail
```

CRM в будущем только отображает/агрегирует эти состояния и НЕ становится
financial/contract source of truth.

------------------------------------------------------------------------

# 2. SERVICE COMMERCIAL TERMS

Поставщик при создании/редактировании услуги определяет коммерческие
условия бронирования.

Минимальный набор условий:

``` text
payment timing policy
full payment allowed
partial payment allowed
initial payment / deposit
payment schedule
payment deadlines
final payment deadline
grace period
missed-payment policy
cancellation policy
refund policy
```

------------------------------------------------------------------------

# 3. PAYMENT TIMING

Система поддерживает как минимум:

``` text
PAY_AFTER_CONFIRMATION
PAY_IMMEDIATELY
```

Точные enum names определяются на этапе design/implementation.

------------------------------------------------------------------------

# 4. PAY AFTER CONFIRMATION — FLOW

``` text
Customer creates booking/order request
→ Supplier confirms availability/booking
→ Customer payment window starts
→ Customer pays within supplier-defined deadline
→ Booking becomes financially secured
```

Если клиент не платит вовремя:

``` text
deadline reached
→ overdue/grace handling
→ canonical missed-payment policy
→ booking/order may expire/cancel according to agreed terms
```

------------------------------------------------------------------------

# 5. SUPPLIER-DEFINED PAYMENT DEADLINE

Конкретный срок оплаты после подтверждения определяет **поставщик при
публикации услуги**.

TravelHub:

``` text
does not invent the supplier's deadline
does validate allowed system boundaries
does execute the configured policy
```

Conceptually:

``` text
service.paymentDeadlinePolicy
```

После supplier confirmation:

``` text
paymentDeadlineAt = supplierConfirmedAt + snapshotted service payment deadline
```

------------------------------------------------------------------------

# 6. SYSTEM BOUNDARIES

TravelHub устанавливает допустимые системные пределы:

``` text
minimum deadline
maximum deadline
allowed units
validation against service start time
```

Конкретные значения определяются на этапе design/implementation.

------------------------------------------------------------------------

# 7. PARTIAL PAYMENT

Поставщик определяет допустимые варианты:

``` text
Full payment
Partial payment / installment plan
Both options
```

Если разрешены оба варианта, клиент при бронировании выбирает:

``` text
Оплатить полностью
или
Оплатить частично по опубликованному графику
```

------------------------------------------------------------------------

# 8. PAYMENT SCHEDULE

При partial payment поставщик определяет минимум:

``` text
initial installment/deposit amount or percentage
deadline for initial installment
remaining balance
deadline for final payment
optional intermediate installments if architecture allows
grace period
missed-payment policy
```

------------------------------------------------------------------------

# 9. FINAL PAYMENT DEADLINE

Final payment deadline задаётся как правило, пригодное для повторяемой
услуги:

``` text
N hours/days before service start
```

а не обязательно как абсолютная календарная дата.

Invariant:

``` text
final payment deadline < service start
```

если иное специально не допускается типом услуги.

------------------------------------------------------------------------

# 10. MISSED PAYMENT POLICY

Поставщик выбирает допустимую системой политику при нарушении графика.

Policy должна быть из canonical platform-controlled options:

``` text
AUTO_CANCEL_AFTER_GRACE
MANUAL_REVIEW
OTHER_PLATFORM_APPROVED_POLICY
```

Точные enum names определяются на этапе design/implementation.

------------------------------------------------------------------------

# 11. REFUND / CANCELLATION SEPARATION

Payment schedule НЕ определяет судьбу уже полученных денег.
Разделение:

``` text
Payment Schedule
Cancellation Policy
Refund Policy
```

Пример:

``` text
Customer paid deposit
Customer missed final installment
Booking cancelled/expired
→ refund/retention outcome determined by canonical cancellation/refund policy
```

------------------------------------------------------------------------

# 12. SERVICE VERSIONING — INVARIANT

Карточка услуги имеет историю существенных изменений.
Перезапись текущих commercial terms без сохранения предыдущего
состояния ЗАПРЕЩЕНА.

Conceptual model:

``` text
Service
└── ServiceVersion
```

Минимум versioned полей:

``` text
price
currency
payment policy
partial-payment policy
installment schedule template
payment deadlines
grace period
missed-payment policy
cancellation policy
refund policy
availability-related commercial terms
other booking-critical terms
```

------------------------------------------------------------------------

# 13. EXISTING BOOKINGS MUST NOT DRIFT

**Critical invariant:**

``` text
Supplier changes Service after customer booking ≠ existing Booking terms change
```

Пример:

``` text
Service v12: 500 ₼, 30/70 payment, final payment 7 days before service
Customer books → Booking snapshot = v12

Supplier creates v13: 550 ₼, 50/50 payment
Existing booking remains v12. New bookings use v13.
```

------------------------------------------------------------------------

# 14. BOOKING COMMERCIAL SNAPSHOT

При бронировании создаётся immutable snapshot существенных условий.

``` text
BookingCommercialTermsSnapshot (или эквивалент)
```

Минимум:

``` text
serviceId, serviceVersion, supplierId, customer/order/booking reference
price, currency, quantity/participants where relevant
selected payment option, payment schedule, deadlines
grace period, missed-payment policy
cancellation policy, refund policy, other material terms
createdAt
```

------------------------------------------------------------------------

# 15. PAYMENT PLAN SNAPSHOT

Если выбран installment/partial payment:

``` text
Order/Booking Payment Plan
├── total amount
├── installment 1
│   ├── amount
│   ├── due rule / dueAt
│   └── status
├── installment 2...
└── final dueAt
```

Изменение Service payment policy после booking НЕ изменяет этот plan.

------------------------------------------------------------------------

# 16. CUSTOMER PAYMENT STATUS

Архитектура готова к состояниям более детальным, чем boolean paid/unpaid:

``` text
NOT_DUE / PENDING / PARTIALLY_PAID / PAID / OVERDUE / FAILED / PARTIALLY_REFUNDED / REFUNDED
```

Точные enum names определяются на этапе design/implementation.

------------------------------------------------------------------------

# 17. CUSTOMER PAYMENT VS SUPPLIER SETTLEMENT

Это две **независимые финансовые оси**:

``` text
Customer Payment ≠ Supplier Settlement/Payout
```

Пример:

``` text
Customer payment: PAID
Supplier confirmation: PENDING
Supplier settlement: NOT_DUE
```

------------------------------------------------------------------------

# 18. BOOKING AGREEMENT / TERMS DOCUMENT

При бронировании клиент получает документ с зафиксированными условиями:

``` text
BookingTermsAgreement (или BookingContract)
```

Минимум:

``` text
agreement/document ID, Order ID, Booking ID, Service ID, Service Version
Supplier, Customer, service date/time
price, currency, quantity/participants
selected payment method/policy, payment schedule, payment deadlines
grace period, missed-payment consequences
cancellation policy, refund policy, supplier confirmation terms
document version, createdAt, language
```

------------------------------------------------------------------------

# 19. CUSTOMER ACCEPTANCE

Перед final booking submission клиент явно подтверждает условия:

``` text
acceptedAt, acceptedTermsVersion, acceptedDocumentId, acceptedDocumentHash, customer identity/reference
```

------------------------------------------------------------------------

# 20. TWO-STAGE DOCUMENT FLOW

Для PAY_AFTER_CONFIRMATION:

``` text
1. Booking Request Terms → customer accepted conditions when request submitted
2. Confirmed Booking Agreement → supplier confirmed → concrete deadlines finalized
```

Второй документ НЕ должен произвольно менять коммерческие условия первого.

------------------------------------------------------------------------

# 21. SAME DOCUMENT FOR BOTH PARTIES

После формирования booking agreement одна canonical version доступна:

``` text
Customer / Supplier / TravelHub audit/admin
```

Не генерировать разные terms из текущей Service state для разных сторон.

------------------------------------------------------------------------

# 22. DOCUMENT IMMUTABILITY & HASH

Сохранённый agreement immutable. Хранится cryptographic content hash:

``` text
documentHash
```

для доказательства неизменности конкретной версии документа.

------------------------------------------------------------------------

# 23. AMENDMENTS

Если после бронирования стороны согласовали существенное изменение:

``` text
DO NOT overwrite original agreement
Создать Amendment или новую agreement version, связанную с предыдущей.
```

Хранить:

``` text
previousVersion, newVersion, reason, changed terms
accepted/confirmed by required parties, timestamps
```

------------------------------------------------------------------------

# 24. AUDIT TRAIL

Минимальный audit trail:

``` text
Service created
Service terms changed / Service version published
Booking request created / Terms accepted by customer
Supplier confirmed/rejected
Payment schedule instantiated / Payment received / Payment overdue
Booking expired/cancelled / Refund events / Supplier settlement events
Agreement generated / Agreement delivered / Amendment created/accepted
```

------------------------------------------------------------------------

# 25. INARIANTS SUMMARY

``` text
1.  Service commercial terms are versioned
2.  Booking terms are snapshotted
3.  Existing bookings do not drift with service edits
4.  Customer chooses allowed payment mode
5.  Supplier defines payment deadline within platform limits
6.  Partial payment schedules supported
7.  Payment schedule separated from cancellation/refund policy
8.  Customer payment separated from supplier settlement
9.  Agreement is immutable/versioned
10. Same canonical agreement available to both parties
11. Material changes require amendment
12. Audit history preserved
13. CRM is consumer, not authority
```

------------------------------------------------------------------------

# 26. DATA AUTHORITY MAP

| Concept | Authority | Status |
|---|---|---|
| Service commercial terms | Catalog (Product/Tariff) | EXISTS — partial |
| Service versioning | Catalog | EXISTS — partial (Product.version) |
| Booking commercial snapshot | Future (Booking) | MISSING — NOT STARTED |
| Customer payment | Future (Finance) | PARTIAL — Payment exists (2.12) |
| Supplier settlement | Future (Finance) | PARTIAL — Settlement exists (2.10B) |
| Agreement/Document | Future (Order/Booking) | MISSING — NOT STARTED |
| CRM representation | Consumer only | EXISTS — Step 3.5 |

------------------------------------------------------------------------

# 27. EXISTING CAPABILITY MATRIX

| Capability | Exists | Partial | Missing | Future owner |
|---|---|---|---|---|
| Service terms versioning | | Product.version | | Catalog |
| Full payment policy | | | X | Catalog/Order |
| Partial payment | | | X | Catalog/Order |
| Payment schedule | | | X | Order/Booking |
| Payment deadlines | | | X | Booking |
| Booking terms snapshot | | | X | Booking |
| Customer acceptance | | | X | Booking |
| Supplier confirmation | | | X | Booking |
| Agreement document | | | X | Order/Booking |
| Document hash/version | | | X | Order/Booking |
| Amendments | | | X | Order/Booking |
| Audit trail | events.outbox | | X | Audit |
| Customer payment status | finance.Payment | | X | Finance |
| Supplier settlement status | finance.Settlement | | X | Finance |
| CRM representation | crm.* | | | CRM (consumer) |

------------------------------------------------------------------------

# 28. RELATION TO EXISTING DOMAINS

``` text
Catalog / Service: owns commercial terms + versioning
Orders: owns Order-level snapshot, acquisition propagation
Bookings: owns booking-level snapshot, service-time model
Finance: owns Payment, Refund, Settlement, Payout, Commission
CRM: read-only consumer of all above
Communication: notification delivery
Partner workspace: service term editing UI
Customer storefront: service card display, booking acceptance
```

------------------------------------------------------------------------

# 29. DEFERRED DESIGN DECISIONS

| Decision | Why deferred | Must be decided before |
|---|---|---|
| Exact payment-policy enums | Not yet agreed with business | Step implementation |
| Min/max payment deadlines | Business authority required | Step implementation |
| Number of installments allowed | Business/architecture decision | Step implementation |
| Exact grace-period rules | Business authority required | Step implementation |
| Legal acceptance metadata | Jurisdiction-specific | Step implementation |
| Document format (PDF, etc.) | Implementation stage decision | Step implementation |
| Signature requirements | Legal/compliance authority | Step implementation |
| Amendment acceptance rules | Business/legal authority | Step implementation |
| Jurisdiction-specific contract wording | Legal authority | Step implementation |
| Canonical base/list price for mixed pricing | Business decision | Step implementation |

------------------------------------------------------------------------

# 30. SECURITY / COMPLIANCE NOTES

``` text
RBAC for supplier term changes
Tenant/workspace isolation
Immutable audit records
Document access control
PII minimization
No cross-partner agreement visibility
Controlled amendment authority
```
