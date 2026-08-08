# TravelHub --- Architecture Overview v3 FINAL

> **Статус:** канонический архитектурный overview для implementation
> prompts.\
> **Источник истины:** `TravelHub_Architecture_Master_Baseline_1.5_Marketplace_Catalog_Final.docx`.
> При любом расхождении приоритет имеет Master. Изменение domain ownership, lifecycle, ID policy,
> event contract или RBAC допускается только через ADR с последующей синхронизацией всех файлов комплекта.

## 1. Архитектурная модель

TravelHub --- модульная Enterprise SaaS-платформа для продажи и
исполнения туристических услуг. Платформа разделена на bounded contexts.
Каждый домен владеет своими сущностями, API, бизнес-правилами и
событиями.

Обязательные принципы:

-   Single Source of Truth;
-   Domain Ownership;
-   Event-Driven Integration;
-   Loose Coupling;
-   API Ownership;
-   Idempotency;
-   Auditability;
-   RBAC;
-   Observability;
-   запрет прямой записи в БД другого домена.

## 2. Канонический сквозной процесс

``` text
Lead
  → Opportunity
  → Quote
  → Sale
  → OrderRequested
  → Order
  → BookingRequested
  → Booking
  → Fulfillment
  → Order Closed
```

Sales заканчивает коммерческий процесс. Order Center начинает
операционное исполнение. Booking Center отвечает за резервирование и
подтверждение услуг.

Ни Catalog, ни Public Marketplace, ни Sales не создают Booking напрямую.

## 3. Владение ключевыми сущностями

| Домен | Владеет |
|---|---|
| Dashboard | DashboardLayout (`DSH-*`), пользовательская/ролевая компоновка виджетов и dashboard read configuration |
| Analytics | MetricDefinition (`MET-*`), определения KPI/метрик и аналитические read models |
| Sales | Lead, Opportunity, Quote, Sale |
| Catalog | Product, Tariff, Availability |
| Order | Order, OrderItem, OrderTraveler, Fulfillment |
| Booking | Booking, Reservation, Passenger, SupplierConfirmation |
| CRM | Customer, Contact, Company, Partner, Supplier, Communication |
| Finance | Payment, Refund, Invoice, Commission, Currency, ExchangeRate, Tax, TaxRule |
| Documents | Document, Template, Voucher |
| Users | User, role bindings, profile/security data |
| Support | Ticket/Case и support workflow |
| Marketing | Campaign и marketing workflow |
| Calendar | CalendarEvent / scheduling model |
| Reports | Report (`RPT-*`), report definition/execution/export metadata; не владеет операционными данными |
| Integrations | Connector configuration, sync jobs, external mappings |
| AI Center | AI orchestration, recommendations, model/prompt configuration |
| System | Audit, logs, health, monitoring; отдельный business ID Baseline не вводит |
| Settings | Platform/organization configuration; только ссылки на справочники доменов-владельцев |

Dashboard, Analytics и Reports являются самостоятельными доменами. Dashboard не рассчитывает собственную альтернативную бизнес-истину: он отображает разрешенные read models. Analytics определяет метрики; Reports формирует отчеты поверх Analytics/read models.

### Catalog media ownership

Изображения/медиа Product принадлежат Catalog. Master не вводит отдельный media bounded context. Реализация может использовать внутреннюю entity/record `ProductMedia`, но это техническая модель Catalog, а не новый домен.

PARTNER изменяет только собственные Product/media; MODERATOR проверяет конкретную версию и не редактирует Product за PARTNER. Draft/unpublished media не попадает в public read.


## 4. Order и Booking --- строгая граница

Order Center владеет составом заказа и его исполнением.

`OrderTraveler` существует до Booking и используется для проверки
готовности туристов к бронированию.

Booking Center владеет `Passenger` только в контексте конкретного
Booking.

``` text
OrderTraveler ──source data──> Passenger
```

Это разные сущности. Booking не становится владельцем OrderTraveler.

## 5. Канонический жизненный цикл Order

``` text
Новый
  → В обработке
  → Ожидает данных
  → Готов к бронированию
  → Передан в Booking Center
  → Частично исполнен
  → Исполнен
  → Готов к закрытию
  → Закрыт
```

Дополнительные состояния/ветви:

-   Отменен;
-   Проблемный;
-   Приостановлен.

Переход в Booking инициируется только явным действием/правилом, которое
публикует `BookingRequested`.

## 6. Канонический жизненный цикл Booking

Базовый процесс:

``` text
Новый
  → Подготовка запроса
  → Отправлен поставщику
  → Ожидает подтверждения
  → Подтвержден
  → Исполняется
  → Завершен
```

Дополнительные состояния:

-   Требует уточнения;
-   Отклонен поставщиком;
-   Изменение запрошено;
-   Отмена запрошена;
-   Отменен;
-   Проблемный.

### Backend status codes

Backend хранит стабильные codes, UI показывает локализованные RU/AZ/EN labels.

Order:

``` text
NEW
IN_PROCESSING
WAITING_FOR_DATA
READY_FOR_BOOKING
SENT_TO_BOOKING
PARTIALLY_FULFILLED
FULFILLED
READY_TO_CLOSE
CLOSED
CANCELLED
PROBLEM
SUSPENDED
```

Booking:

``` text
NEW
PREPARING_REQUEST
SENT_TO_SUPPLIER
AWAITING_CONFIRMATION
CONFIRMED
IN_SERVICE
COMPLETED
NEEDS_CLARIFICATION
SUPPLIER_REJECTED
CHANGE_REQUESTED
CANCELLATION_REQUESTED
CANCELLED
PROBLEM
```

UI label никогда не используется как backend enum/event contract.


## 7. ID Policy

Канонические business IDs Baseline 1.5:

``` text
Lead             LED-*
Opportunity      OPP-*
Quote            QTE-*
Sale             SAL-*
Product           PRD-*
Order             ORD-*
Booking           BKG-*
Customer          CUS-*
Contact           CNT-*
Company           COM-*
Communication     CML-*
Partner           PAR-*
Supplier          SUP-*
Payment           PAY-*
Refund            RFD-*
Invoice           INV-*
Commission        CMS-*
Currency          CUR-*
ExchangeRate      FXR-*
Tax               TAX-*
TaxRule           TXR-*
Document          DOC-*
Template          TPL-*
Voucher           VCH-*
Ticket/Case       TCK-*
Campaign          CMP-*
CalendarEvent     CAL-*
Report            RPT-*
DashboardLayout   DSH-*
MetricDefinition  MET-*
User              USR-*
```

Order дополнительно имеет пользовательский номер `TH-YYYY-######`.
`COM-*` зарезервирован только для Company. System не получает искусственный business ID, если он не определен отдельным ADR.
## 8. Finance vs Settings

Finance --- единственный владелец:

-   Currency;
-   ExchangeRate;
-   Tax;
-   TaxRule.

Settings не дублирует эти сущности. Он может хранить только:

-   default currency reference;
-   разрешенные валюты по ссылкам;
-   locale;
-   display formats;
-   выбранные tax-rule references;
-   feature/config flags.

## 9. Канонические события

Минимальный обязательный каталог:

``` text
LeadCreated
OpportunityCreated
QuoteCreated
QuoteAccepted
SaleCompleted
OrderRequested
OrderCreated
OrderReadyForBooking
BookingRequested
BookingCreated
BookingConfirmed
BookingRejected
BookingChanged
BookingCancelled
PaymentReceived
RefundCompleted
DocumentGenerated
OrderFulfilled
OrderClosed
```

Критическое правило:

``` text
OrderApproved != Create Booking
```

Создание Booking инициирует только `BookingRequested`.

Все consumer handlers должны быть идемпотентны.

## 10. RBAC

Канонический базовый набор ролей:

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

Не создавать роли `Booking Agent`, `Support Agent`, `Finance Officer`,
если отдельное архитектурное решение не добавит их позднее.

`SALES_MANAGER` не имеет универсального `order:write` после передачи
продажи в Order Center.

`OPERATOR` --- основная внутренняя операционная роль Order / Booking /
Support.

## 11. Marketplace-контур

Официальный внешний контур:

``` text
Public Marketplace
  → Buyer Cabinet
  → Partner Cabinet
  → Moderation
  → Internal Work Centers
```

Public Marketplace читает опубликованный Catalog. Покупка проходит через
Sales flow и затем через `OrderRequested`.

Partner управляет только своими предложениями в рамках разрешенного
workflow.

Moderator работает с очередью проверки/публикации Catalog.

Buyer видит только собственные данные.

## 12. UI-принцип

Каждый внутренний рабочий центр строится как единый рабочий экран:

``` text
Header / Breadcrumbs
Filters / Actions
KPI
Work queues / Workspace
Main table or board
Context side panel
AI Assistant
```

Карточка сущности не должна превращаться в отдельную несвязанную
систему. Она сохраняет контекст рабочего центра.

## 13. Правила реализации

Запрещено:

-   прямые FK-зависимости между БД разных доменов как способ владения;
-   прямое обновление чужих таблиц;
-   создание Order из Catalog;
-   создание Booking из Sales;
-   хранение Passenger как замены OrderTraveler;
-   хранение Currency/Tax в Settings как мастер-данных;
-   один `SAL-*` для Lead/Opportunity/Quote/Sale;
-   скрытые статусные переходы без аудита;
-   неидемпотентные event consumers.

Обязательно:

-   API contracts;
-   event contracts;
-   outbox/inbox или эквивалент;
-   correlationId/causationId;
-   Audit Log;
-   permission checks;
-   optimistic locking/version;
-   server-side pagination/filter/sort;
-   structured logs and metrics.

## Marketplace и Catalog — обязательный внешний контур

`/` для anonymous открывает Public Marketplace. Internal Dashboard расположен только во внутреннем `/app/*` контуре.

Catalog.Product — универсальная продаваемая туристическая услуга. Канонические верхнеуровневые категории: Tours; Accommodation; Excursions; Activities & Entertainment; Flights; Rail; Bus/Ground transport; Transfers; Car Rental; Other Vehicle Rental; Guides; Cruises; Tickets & Events; Gastronomy; Wellness & SPA; Travel Insurance; Visa Services; Ancillary Travel Services. Категория задает schema специфических атрибутов, фильтров, availability, tariffs/options, media requirements и Product Detail sections.

Публичный flow: `Marketplace Home → Search/Category Results → Product Detail Page → Checkout → automated Sale → OrderRequested → Order → BookingRequested → Booking`.

Product Detail Page обязана показывать опубликованные media/gallery, description, category-specific contents/itinerary, included/excluded, options/tariffs, availability, price, policies, partner public info и CTA.

Partner/Catalog поддерживает image multi-upload, ordering, primary image, captions/alt text, replace/delete, server-side validation/optimization/thumbnails и moderation/publication boundary.
