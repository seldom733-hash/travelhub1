# TravelHub --- Implementation Prompt Phase 3 — Baseline 1.4 FINAL

> **Источник истины:** `TravelHub_Architecture_Master_Baseline_1.4_Final_Corrected.docx`.
> При любом расхождении приоритет имеет Master. Изменение domain ownership, lifecycle, ID policy,
> event contract или RBAC допускается только через ADR с последующей синхронизацией всех файлов комплекта.


## 1. Цель

Завершить enterprise-контур TravelHub поверх работающих Phase 1--2:

-   Users & Security;
-   Settings;
-   Documents;
-   Marketing;
-   Support;
-   Calendar;
-   Analytics;
-   Dashboard;
-   Reports;
-   Integrations;
-   AI Center;
-   System/Observability;
-   Public Marketplace;
-   Buyer Cabinet;
-   Partner Cabinet;
-   Moderation.

Не изменять ownership уже реализованных
Sales/Order/Booking/CRM/Finance/Catalog.

### Канонические IDs Phase 3

``` text
User              USR-*
Ticket/Case       TCK-*
Campaign          CMP-*
CalendarEvent     CAL-*
Report            RPT-*
DashboardLayout   DSH-*
MetricDefinition  MET-*
Document          DOC-*
Template          TPL-*
Voucher           VCH-*
```

System не получает отдельный business ID без ADR. Technical identifiers/correlationId не являются business ID.

## 2. Users & Security

Канонические роли:

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

Не создавать:

``` text
Booking Agent
Support Agent
Finance Officer
```

без отдельного изменения архитектуры.

Реализовать:

-   JWT/session model согласно текущему стеку;
-   refresh/revocation;
-   permission middleware;
-   object scope;
-   partner/buyer tenant-like scoping;
-   audit of sensitive actions;
-   login/security events.

## 3. Settings

Settings владеет только конфигурацией.

Разрешено:

-   locale;
-   formats;
-   feature flags;
-   default references;
-   organization settings;
-   UI/config parameters.

Запрещено создавать в Settings:

-   Currency;
-   ExchangeRate;
-   Tax;
-   TaxRule;
-   Product;
-   Customer;
-   Order;
-   Booking.

Для валют/налогов Settings хранит ссылки на Finance entities.

## 4. Documents

Владеет:

-   Document;
-   Template;
-   Voucher.

Документы создаются по событиям/commands, например:

``` text
BookingConfirmed
→ Generate Voucher

InvoiceIssued
→ Generate Invoice Document
```

Documents не меняет Booking/Finance.

Версии документов неизменяемы после публикации; корректировка создает
новую версию.

## 5. Support

Support владеет Case/Ticket workflow.

OPERATOR выполняет операционные Support функции.

Case может ссылаться на:

-   Customer;
-   Order;
-   Booking;
-   Payment;
-   Product.

Но Support не меняет эти объекты напрямую.

Эскалация выполняется через task/event/approved command.

## 6. Marketing

MARKETER работает с Campaign и marketing automation.

Marketing читает разрешенные CRM segments/read models, но не становится
владельцем Customer.

Consent/communication preferences должны соблюдаться.

## 7. Calendar

Calendar агрегирует:

-   tasks;
-   meetings;
-   deadlines;
-   SLA dates;
-   trip/service dates.

Calendar не становится владельцем Order/Booking.

## 8. Integrations

Создать единый integration layer:

-   connector configuration;
-   external IDs mapping;
-   sync jobs;
-   retry;
-   DLQ;
-   rate limits;
-   webhooks;
-   secrets via secure config;
-   observability.

Supplier integrations работают через Booking/Integrations boundary.

Нельзя позволять внешнему webhook напрямую менять Order DB.

## 9. AI Center

AI --- advisory/orchestration layer.

Возможности:

-   next action;
-   risk scoring;
-   SLA risk;
-   anomaly detection;
-   summarization;
-   classification;
-   recommendations.

AI не должен скрыто:

-   закрывать Sale;
-   создавать Order в обход OrderRequested;
-   создавать Booking в обход BookingRequested;
-   подтверждать/отменять Booking;
-   проводить Refund;
-   менять RBAC.

Автоматические AI actions разрешены только через формально утвержденный
command/policy с audit.

## 10. System / Observability

Реализовать:

-   Audit Log;
-   application logs;
-   event logs;
-   metrics;
-   traces/correlationId;
-   health checks;
-   job status;
-   integration failures;
-   DLQ viewer;
-   security events.

## 11. Public Marketplace

Это официальный контур, не эксперимент.

Anonymous:

-   browse/search published products;
-   filters;
-   product detail;
-   locale/currency display.

Public Marketplace читает Catalog и разрешенные Partner data.

Кнопка покупки не создает Order напрямую.

Self-service flow:

``` text
Buyer checkout
→ automated Sale
→ OrderRequested
→ Order
→ BookingRequested
→ Booking
```

## 12. Buyer Cabinet

BUYER видит только свои:

-   profile;
-   orders;
-   bookings;
-   payments;
-   documents;
-   support cases.

Никакого доступа к внутренним рабочим центрам.

## 13. Partner Cabinet

PARTNER видит только свои:

-   profile/company;
-   products/offers;
-   drafts;
-   moderation state;
-   permitted performance data.

Partner не публикует Product напрямую, если продукт требует moderation.

## 14. Moderation

MODERATOR работает с отдельной внутренней очередью.

Flow:

``` text
Draft
→ Submitted for moderation
→ Approved / Rejected / Changes requested
→ Published
```

Фиксировать:

-   moderator;
-   reason;
-   comments;
-   timestamps;
-   versions.

## 15. Analytics / Dashboard / Reports

### Analytics

Analytics владеет `MetricDefinition (MET-*)`, определениями KPI и аналитическими read models. Он читает события/read models и не становится владельцем операционных сущностей.

Основные измерения:

-   Sales funnel;
-   Order lifecycle;
-   Booking SLA;
-   Finance;
-   Supplier performance;
-   Marketplace conversion;
-   Partner performance;
-   Support SLA.

Каждая метрика имеет формальное определение, source, grain, dimensions, period, version/effective policy и правила валютной нормализации.

### Dashboard

Dashboard владеет `DashboardLayout (DSH-*)`, персональной/ролевой компоновкой виджетов и dashboard read configuration. Dashboard не владеет бизнес-KPI и не создает альтернативные расчеты: значения получает из Analytics/read models.

Обязательные свойства:

-   role-aware widgets;
-   RBAC/object scope;
-   degraded state одного виджета не блокирует весь экран;
-   lazy loading/caching;
-   quick action открывает домен-владелец или вызывает его permissioned command.

### Reports

Reports владеет `Report (RPT-*)`, report definition/execution/export metadata. Reports использует Analytics/read models и не копирует операционные таблицы как новый SSOT.

Определения KPI во всех трех слоях должны совпадать с Master.
## 16. RBAC scopes

Обязательно проверить:

-   BUYER cannot read another buyer;
-   PARTNER cannot read another partner;
-   MODERATOR can moderate but not Finance;
-   SALES_MANAGER cannot mutate Order lifecycle;
-   OPERATOR can work Order/Booking/Support but not Finance master data;
-   FINANCE owns finance operations;
-   ANALYST read-only;
-   DIRECTOR management read and explicitly granted commands;
-   ADMIN does not bypass audit.

## 17. UI

Внутренние центры используют:

``` text
Header
Filters/Actions
KPI
Work queues
Workspace
Context panel
AI Assistant
```

Внешние кабинеты используют отдельную navigation shell, но те же API
ownership и RBAC rules.

## 18. Tests

Минимум:

1.  Marketplace shows only published products.
2.  Buyer checkout goes through Sale → OrderRequested.
3.  Partner sees only own products.
4.  Moderation required before publish where configured.
5.  Currency/Tax are edited in Finance, not Settings.
6.  Buyer cannot access internal APIs.
7.  Sales Manager cannot change Order status.
8.  AI recommendation cannot bypass command permissions.
9.  Supplier webhook is idempotent.
10. Documents react to events without writing foreign DBs.
11. Audit contains all sensitive actions.
12. Correlation ID traces Sale → Order → Booking.
13. MetricDefinition uses MET-*; DashboardLayout uses DSH-*; Report uses RPT-*.
14. Dashboard does not calculate an alternative KPI definition.
15. Calendar/Support/Marketing use CAL-*/TCK-*/CMP-*.
16. System technical records do not receive an invented business prefix.

## 19. Definition of Done

TravelHub считается архитектурно завершенным, когда внутренний и внешний
контуры используют одни и те же domain boundaries:

``` text
Marketplace / Sales
        ↓
       Sale
        ↓
 OrderRequested
        ↓
       Order
        ↓
 BookingRequested
        ↓
      Booking
```

а Finance, Documents, Support, Integrations, Analytics и AI
взаимодействуют через API/events без нарушения ownership.
