# TravelHub --- Implementation Prompt Phase 2 — Baseline 1.3 SYNC

> **Источник истины:** `TravelHub_Architecture_Master_Baseline_1.3_Final_Audited.docx`.
> При любом расхождении приоритет имеет Master. Изменение domain ownership, lifecycle, ID policy,
> event contract или RBAC допускается только через ADR с последующей синхронизацией всех файлов комплекта.


## 1. Цель

Phase 2 превращает bootstrap Phase 1 в канонический коммерческий процесс
и добавляет Sales Center, расширенный CRM и Finance.

После этой фазы прямое пользовательское создание Order перестает быть
основным сценарием.

Канонический flow:

``` text
Lead
→ Opportunity
→ Quote
→ Sale
→ OrderRequested
→ Order
→ BookingRequested
→ Booking
```

## 2. Нельзя нарушать

-   Catalog владеет Product.
-   CRM владеет Customer/Contact/Company/Partner/Supplier.
-   Sales владеет Lead/Opportunity/Quote/Sale.
-   Order владеет Order/OrderItem/OrderTraveler/Fulfillment.
-   Booking владеет Booking/Reservation/Passenger/SupplierConfirmation.
-   Finance владеет
    Payment/Refund/Invoice/Commission/Currency/ExchangeRate/Tax/TaxRule.
-   никакой прямой записи между БД доменов.

## 3. Sales Center

### Entities and IDs

``` text
Lead        LED-00000001
Opportunity OPP-00000001
Quote       QTE-00000001
Sale        SAL-00000001
```

Не использовать один `SAL-*` для всех четырех сущностей.

### Lead

Хранит:

-   source;
-   customer/contact reference;
-   interest;
-   owner;
-   qualification;
-   status;
-   nextAction;
-   SLA;
-   history.

Успешная квалификация создает Opportunity.

### Opportunity

Хранит:

-   customerId;
-   owner;
-   need/context;
-   products by reference;
-   budget;
-   expectedCloseDate;
-   probability;
-   stage;
-   nextAction;
-   risks.

### Quote

Quote содержит собственные коммерческие условия и ссылки на Product.

Поддержать:

-   items;
-   versions;
-   currency reference;
-   discount;
-   fees;
-   validity period;
-   approval;
-   accepted/rejected state.

Quote не копирует Catalog ownership.

### Sale

Sale фиксирует завершенную сделку.

После успешного завершения:

``` text
SaleCompleted
OrderRequested
```

`OrderRequested` должен иметь eventId, correlationId, saleId и
достаточный payload для создания Order.

## 4. OrderRequested consumer

Order Center:

1.  проверяет idempotency;
2.  создает `ORD-*`;
3.  создает `TH-YYYY-######`;
4.  создает OrderItems;
5.  создает/связывает OrderTraveler data;
6.  сохраняет saleId/customerId references;
7.  ставит `Новый`;
8.  публикует `OrderCreated`.

Повторное событие не создает второй Order.

Bootstrap endpoint Phase 1:

-   убрать из обычного UI;
-   оставить только как ADMIN/import/integration exception либо удалить,
    если он больше не нужен;
-   любое исключение обязательно аудитируется.

## 5. Sales → Order ownership boundary

После OrderRequested:

Sales Manager может:

-   открыть связанный Order read-only;
-   видеть его номер/статус;
-   добавить разрешенный комментарий;
-   инициировать предусмотренный change request.

Sales Manager не может:

-   произвольно менять OrderItems;
-   менять Order lifecycle;
-   создавать Booking;
-   подтверждать Booking;
-   менять Payment.

## 6. CRM expansion

Доработать:

-   Customer;
-   Contact;
-   Company;
-   Partner;
-   Supplier;
-   Communication.

IDs:

``` text
CUS-*
CNT-*
COM-*  Company only
PAR-*
SUP-*
CML-*  internal Communication record if ID needed
```

Communication timeline должен быть доступен Sales и Support через
API/read model, но CRM остается владельцем.

## 7. Finance Center

### Владеет

-   Payment;
-   Refund;
-   Invoice;
-   Commission;
-   Currency;
-   ExchangeRate;
-   Tax;
-   TaxRule.

### Важно

Settings **не** является владельцем Currency/Tax.

Finance API должен предоставлять другим доменам:

-   supported currencies;
-   current/historical exchange rates;
-   tax rules;
-   financial status by Order;
-   payment/refund summaries.

### IDs

``` text
Payment       PAY-*
Refund        RFD-*
Invoice       INV-*
Commission    CMS-*
Currency      CUR-*
ExchangeRate  FXR-*
Tax           TAX-*
TaxRule       TXR-*
```

Эти префиксы канонические. Не придумывать новые и не переиспользовать PAY/INV для других Finance entities.

### Payment flow

Finance может создавать Payment на основании утвержденного
бизнес-триггера Order/Sale, но не изменяет Order напрямую.

События:

``` text
PaymentCreated
PaymentReceived
PaymentFailed
RefundRequested
RefundCompleted
InvoiceIssued
```

Order читает/агрегирует финансовое состояние через события/API.

## 8. Sales Center UI

Полноценный рабочий центр:

``` text
Header
Filters
KPI
Pipeline / work queues
Lead/Opportunity/Quote/Sale registry
Context panel
AI Assistant
```

KPI:

-   new leads;
-   active opportunities;
-   quotes pending;
-   sales;
-   conversion;
-   average check;
-   forecast;
-   overdue next actions.

Карточки Lead/Opportunity/Quote/Sale должны сохранять коммерческий
контекст и linked Order.

## 9. Finance UI

Рабочий центр Finance:

-   payment queue;
-   refunds;
-   invoices;
-   financial exceptions;
-   Order financial context;
-   currencies/rates/tax admin для FINANCE;
-   audit.

Не помещать Currency/Tax master editing в Settings.

## 10. Events and contracts

Обязательная цепочка тестируется end-to-end:

``` text
QuoteAccepted
→ SaleCompleted
→ OrderRequested
→ OrderCreated
→ OrderReadyForBooking
→ BookingRequested
→ BookingCreated
```

Каждый consumer идемпотентен.

Использовать schema versioning.

## 11. RBAC Phase 2

Использовать только канонические роли:

``` text
ADMIN
DIRECTOR
FINANCE
MARKETER
ANALYST
MODERATOR
SALES_MANAGER
OPERATOR
PARTNER
BUYER
```

Phase 2 минимум:

-   SALES_MANAGER --- Sales CRUD/commands;
-   OPERATOR --- Order/Booking operational commands;
-   FINANCE --- Finance;
-   DIRECTOR --- broad read/management analytics;
-   ADMIN --- configuration/admin;
-   ANALYST --- analytics read.

## 12. Tests

Обязательно:

1.  Lead → Opportunity.
2.  Opportunity → versioned Quote.
3.  Quote accepted → Sale.
4.  Sale publishes OrderRequested.
5.  Order created once.
6.  IDs LED/OPP/QTE/SAL distinct.
7.  Order has ORD-\* and TH-\*.
8.  Sales Manager cannot mutate Order lifecycle.
9.  Booking still created only by BookingRequested.
10. Currency/Tax CRUD belongs to Finance.
11. Settings cannot create Currency/Tax.
12. Communication does not use COM-\*.
13. Finance IDs соответствуют PAY/RFD/INV/CMS/CUR/FXR/TAX/TXR.
14. OrderReadyForBooking публикуется при READY_FOR_BOOKING до BookingRequested.
15. Full audit trail exists.

## 13. Definition of Done

Phase 2 закончена, когда основной пользовательский flow больше не
зависит от bootstrap Order creation:

``` text
Sales Center
→ completed Sale
→ OrderRequested
→ Order Center
→ validation
→ BookingRequested
→ Booking Center
```
