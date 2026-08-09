# TravelHub --- Implementation Prompt Phase 2 — Baseline 1.6 PAYMENTS FINAL

> **Источник истины:** `TravelHub_Architecture_Master_Baseline_1.6_Marketplace_Payments_Final.docx`.
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
-   Finance владеет Payment/PaymentTerms/ProviderFee/Refund/Invoice/Commission/CommissionAccrual/Settlement/Payout/LedgerTransaction/Currency/ExchangeRate/Tax/TaxRule.
-   никакой прямой записи между БД доменов.


## 2.1 Catalog / category / media contract нельзя ломать

Phase 2 не реализует заново Catalog и не меняет принятый Marketplace foundation Phase 1.

Обязательные правила:

- один `Catalog.Product` обслуживает все категории туристических услуг;
- category schema остается источником category-specific attributes/filters/availability/Tariff/PDP sections;
- Product media остается Catalog-owned;
- PARTNER/MODERATOR publication boundary не переносится в Sales;
- Sales читает опубликованный/разрешенный Product и его коммерческие параметры по reference/version;
- Quote/Sale не копируют Catalog как второй SSOT.

При формировании Quote/Sale и `OrderRequested` сохраняй только необходимый для коммерческого/операционного исполнения snapshot/reference:

- productId / product version reference;
- category/type reference;
- выбранный Tariff/Option;
- согласованные параметры услуги;
- цена/валюта/скидки;
- необходимые dates/availability confirmation references;
- public title/description snapshot только если это требуется документу/истории;
- media — только reference/version/primary public asset при реальной необходимости, но не полную независимую копию медиагалереи.

Изменение Product, category schema или media после Sale не должно ретроспективно менять уже согласованный Order snapshot.


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
3.  создает `TH-YYYY-######`: `YYYY` = `Order.createdAt` UTC year, `######` = atomic yearly sequence; UNIQUE(Order.number);
4.  создает OrderItems;
5.  создает/связывает OrderTraveler data;
6.  сохраняет saleId/customerId references;
7.  ставит `Новый`;
8.  публикует `OrderCreated`.

Повторное событие не создает второй Order.

Bootstrap endpoint Phase 1:

-   после успешного ввода канонического `OrderRequested` flow удалить `/orders/bootstrap` полностью;
-   не сохранять его как ADMIN/import/integration exception;
-   будущий import/admin-create use case, если он будет отдельно утвержден, реализовать отдельной command/API с отдельным permission, reason/source/correlationId, idempotency и Audit Log.

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
-   PaymentTerms;
-   ProviderFee;
-   Refund;
-   Invoice;
-   Commission;
-   CommissionAccrual;
-   Settlement;
-   Payout;
-   LedgerTransaction;
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
PaymentTerms  PMT-*
ProviderFee   PFE-*
Refund        RFD-*
Invoice       INV-*
Commission    CMS-*
CommissionAccrual CAA-*
Settlement    STL-*
Payout        POT-*
LedgerTransaction LTX-*
Currency      CUR-*
ExchangeRate  FXR-*
Tax           TAX-*
TaxRule       TXR-*
```

Эти префиксы канонические. Не придумывать новые и не переиспользовать PAY/INV для других Finance entities.


### Marketplace settlement modes

Реализуй provider-agnostic financial model:

``` text
SPLIT_AT_PAYMENT
PLATFORM_COLLECT
PARTNER_COLLECT
```

`SPLIT_AT_PAYMENT` — preferred when provider capability allows it. PSP должен фактически split-ить каждый Buyer Payment на Partner share и TravelHub fee; нельзя имитировать split только внутренней записью.

`PLATFORM_COLLECT` — Finance получает/контролирует funds и после Settlement инициирует Payout Partner.

`PARTNER_COLLECT` — Buyer платит Partner; TravelHub создает CommissionAccrual/receivable и агрегирует задолженность Partner для последующего settlement/invoice/collection.

### PaymentTerms

Поддержать FULL_PREPAYMENT, PARTIAL_PREPAYMENT, DEPOSIT, PAY_LATER, PAY_AT_SERVICE. Partner выбирает только разрешенные terms для Product/Tariff; Sale/Order сохраняет immutable financial snapshot. Для partial payment каждый фактический платеж — отдельный Payment и отдельная allocation.

### Provider fees and ledger

ProviderFee хранит фактическую PSP/bank fee отдельно от TravelHub Commission. Не хардкодить единую ставку. Fee allocation policy определяет сторону расходов. LedgerTransaction хранит immutable movements/adjustments. Refund/chargeback/FX/payout reversal создают корректирующие записи.

### Settlement and Payout

Settlement рассчитывает gross payments, refunds, TravelHub commission, provider fees, taxes/adjustments и partner payable. Payout является отдельным объектом от Payment и обычно может идти банковским переводом на verified Partner payout account. Один Payout может агрегировать несколько Settlement.

### Provider abstraction

Finance не зависит от Stripe/Adyen/другого PSP. Используй PaymentProvider/MarketplacePaymentProvider/PayoutProvider adapters и capability matrix country/currency/method/split/payout.

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
-   ANALYST --- analytics read;
-   PARTNER --- own Product/media write only within Catalog workflow; без Sales/Order write;
-   MODERATOR --- moderation review/approve/reject/request changes; без редактирования Product content от имени PARTNER.

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
16. SPLIT_AT_PAYMENT фактически подтверждается provider allocation/webhook и идемпотентно отражается в Commission/Settlement.
17. PARTIAL_PREPAYMENT 30/70 создает два Payment и две allocation без двойной комиссии при retry.
18. ProviderFee хранится отдельно от TravelHub Commission.
19. PARTNER_COLLECT создает CommissionAccrual/receivable, а не фиктивный Payout.
20. PLATFORM_COLLECT создает Settlement → Payout без смешения Payment/Payout.
21. Refund/chargeback создают reverse/adjustment ledger entries.
22. Payout bank rail не привязан к card PSP domain model.
16. Sales/Quote/Sale сохраняют Product/category references без создания второго Catalog SSOT.
17. Изменение опубликованного Product/media не меняет исторический Sale/Order snapshot.
18. SALES_MANAGER не получает права редактировать Product media.
19. PARTNER и MODERATOR сохраняют разделенные permissions на Product/media/moderation.

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
