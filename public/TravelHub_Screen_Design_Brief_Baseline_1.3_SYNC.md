# TravelHub --- Screen Design Brief — Baseline 1.3 SYNC

> **Источник истины:** `TravelHub_Architecture_Master_Baseline_1.3_Final_Audited.docx`.
> При любом расхождении приоритет имеет Master. Изменение domain ownership, lifecycle, ID policy,
> event contract или RBAC допускается только через ADR с последующей синхронизацией всех файлов комплекта.


## 1. Статус

Этот brief описывает официальный UI-контур TravelHub:

-   Public Marketplace;
-   Buyer Cabinet;
-   Partner Cabinet;
-   Moderation;
-   внутренние Work Centers.

UI не может нарушать domain ownership.

## 2. Внутренний shell

Каждый Work Center:

``` text
┌─────────────────────────────────────────────┐
│ Header + Breadcrumbs + Global Search        │
├─────────────────────────────────────────────┤
│ Actions + Filters                           │
├─────────────────────────────────────────────┤
│ KPI                                         │
├─────────────────────────────────────────────┤
│ Work Queues / Main Workspace                │
├────────────────────────────────────┬────────┤
│ Table / Board / Entity Workspace   │ Context│
│                                    │ Panel  │
├────────────────────────────────────┴────────┤
│ AI Assistant / contextual actions           │
└─────────────────────────────────────────────┘
```

## 3. Sales Center

Навигация:

-   Overview;
-   Leads;
-   Opportunities;
-   Quotes;
-   Sales.

KPI:

-   New Leads;
-   Active Opportunities;
-   Quotes pending;
-   Sales;
-   Conversion;
-   Forecast;
-   Overdue actions.

Карточка Sale показывает linked Order после `OrderRequested`, но не дает
менять Order lifecycle.

## 4. Order Center

Навигация:

-   All Orders;
-   New;
-   In Processing;
-   Waiting Data;
-   Ready for Booking;
-   Sent to Booking;
-   Partial Fulfillment;
-   Problems;
-   Ready to Close;
-   Closed.

Карточка:

-   summary;
-   services;
-   OrderTraveler;
-   linked Bookings;
-   Finance summary read-only;
-   documents;
-   tasks;
-   history;
-   blockers;
-   next action;
-   lifecycle timeline.

Главное действие в `Готов к бронированию`:

``` text
Передать в Booking Center
```

Оно вызывает `BookingRequested`.

Навигационные вкладки — рабочие представления, а не полный enum lifecycle. Статусы `FULFILLED`, `CANCELLED`, `SUSPENDED` и другие канонические состояния, не вынесенные в отдельную вкладку, доступны через All Orders/фильтры/контекстные очереди.

Backend Order codes: `NEW`, `IN_PROCESSING`, `WAITING_FOR_DATA`, `READY_FOR_BOOKING`, `SENT_TO_BOOKING`, `PARTIALLY_FULFILLED`, `FULFILLED`, `READY_TO_CLOSE`, `CLOSED`, `CANCELLED`, `PROBLEM`, `SUSPENDED`.

## 5. Booking Center

Навигация:

-   All;
-   New;
-   Preparing;
-   Sent to Supplier;
-   Awaiting Confirmation;
-   Confirmed;
-   Problems;
-   Change Requests;
-   Cancellation Requests;
-   Completed.

Карточка:

-   Booking data;
-   linked Order read-only;
-   Passenger;
-   supplier;
-   reservation;
-   confirmation;
-   SLA;
-   change/cancel flow;
-   history.

Навигационные вкладки Booking также являются рабочими представлениями. `NEEDS_CLARIFICATION`, `SUPPLIER_REJECTED`, `CANCELLED` и другие состояния могут агрегироваться в Problems/Change/Cancellation queues и всегда доступны через All + filters.

Backend Booking codes: `NEW`, `PREPARING_REQUEST`, `SENT_TO_SUPPLIER`, `AWAITING_CONFIRMATION`, `CONFIRMED`, `IN_SERVICE`, `COMPLETED`, `NEEDS_CLARIFICATION`, `SUPPLIER_REJECTED`, `CHANGE_REQUESTED`, `CANCELLATION_REQUESTED`, `CANCELLED`, `PROBLEM`.

## 6. Catalog Center

Внутренний Catalog:

-   Products;
-   Drafts;
-   Moderation state;
-   Published;
-   Archived.

Partner создает/редактирует только собственные drafts.

Moderator approve/reject/change request.

## 7. Finance Center

Экраны:

-   Payments;
-   Refunds;
-   Invoices;
-   Commissions;
-   Currency;
-   Exchange Rates;
-   Tax / Tax Rules;
-   Exceptions.

Currency/Tax не размещать как master CRUD в Settings.

## 8. Dashboard

- role-aware KPI/widgets;
- tasks/notifications/AI recommendations;
- configurable `DashboardLayout (DSH-*)`;
- quick actions open owner Work Center or invoke permissioned owner command;
- widget failure uses isolated degraded state.

## 9. Business Intelligence / Analytics

- Overview;
- Sales analytics;
- Order analytics;
- Booking analytics;
- Finance analytics;
- supplier/partner/support/marketplace analytics;
- MetricDefinition (`MET-*`) and metric metadata for authorized users;
- drill-down never bypasses source RBAC.

## 10. CRM Center

- Customers;
- Contacts;
- Companies;
- Partners;
- Suppliers;
- Communication timeline;
- merge/history/audit;
- IDs: CUS-*, CNT-*, COM-*, PAR-*, SUP-*, CML-*.

## 11. Marketing Center

- Campaigns (`CMP-*`);
- segments/read models;
- calendar/schedule;
- consent checks;
- performance;
- AI recommendations.

## 12. Support Center

- Ticket/Case registry (`TCK-*`);
- queues/SLA/escalations;
- linked Customer/Order/Booking/Payment/Product read context;
- OPERATOR commands;
- history/audit.

## 13. Users & Access

- Users (`USR-*`);
- role bindings;
- permissions;
- security/session events;
- object scope;
- audit.

## 14. Documents Center

- Documents (`DOC-*`);
- Templates (`TPL-*`);
- Vouchers (`VCH-*`);
- Contract/Receipt/Confirmation/Attachment are document types/metadata, not lost standalone ownership;
- versions and generation history.

## 15. Calendar Center

- CalendarEvent (`CAL-*`);
- tasks/meetings/deadlines/SLA/trip dates;
- owner/source link;
- RBAC and audit;
- Calendar does not own Order/Booking.

## 16. Reports Center

- Reports (`RPT-*`);
- saved definitions;
- execution history;
- export;
- schedule;
- source/freshness;
- uses Analytics/read models, not duplicate operational storage.

## 17. Integrations Center

- connectors;
- mappings;
- sync jobs;
- retries/DLQ;
- webhooks;
- rate limits;
- secrets references;
- observability.

## 18. AI Center

- contextual recommendations;
- prompt/model configuration;
- risk/anomaly/summary/next action;
- no critical execution outside permissioned command/policy.

## 19. System Center

- Audit Log;
- logs/traces;
- health;
- jobs;
- DLQ;
- incidents/security events;
- no invented business ID; technical identifiers/correlationId only.

## 20. Settings Center

- organization/platform configuration;
- locale/formats;
- feature flags;
- default references;
- no Currency/ExchangeRate/Tax/TaxRule master CRUD.

## 21. Public Marketplace

Без авторизации:

-   search;
-   categories;
-   filters;
-   product cards;
-   product detail;
-   locale;
-   display currency.

Показывать только опубликованные Catalog products.

CTA покупки запускает Sales checkout:

``` text
Checkout Sale → OrderRequested → Order
```

не прямой Order.

## 22. Buyer Cabinet

Разделы:

-   My Trips / Orders;
-   Bookings;
-   Payments;
-   Documents;
-   Support;
-   Profile.

Buyer видит только свои объекты.

## 23. Partner Cabinet

Разделы:

-   Dashboard;
-   My Products;
-   Drafts;
-   Moderation;
-   Performance;
-   Profile/Company.

Никакого доступа к чужим Partner resources.

## 24. Moderation

Очередь:

-   New submissions;
-   Needs review;
-   Changes requested;
-   Approved;
-   Rejected.

Review screen:

-   product preview;
-   changed fields;
-   partner;
-   validation;
-   comments;
-   approve/reject/request changes.

## 25. Status UX

Статусы не редактируются обычным dropdown.

UI показывает только допустимые actions.

Недоступное действие:

-   hidden, либо
-   disabled с причиной.

Пример:

``` text
Передать в Booking Center — недоступно
Причина: отсутствуют паспортные данные 2 туристов
```

## 26. IDs in UI

Показывать пользователю:

-   Order: `TH-2026-000154`;
-   Booking: `BKG-00000001`;
-   Sale: `SAL-00000001`.

Внутренний `ORD-*` может быть доступен в technical details/audit, но
основной номер Order для пользователя --- TH-\*.

## 27. AI

AI располагается контекстно.

Разрешено:

-   summary;
-   next action;
-   risk;
-   anomaly;
-   explanation.

Критическое действие всегда проходит через permissioned command.

## 28. Responsive behavior

Internal Work Centers ориентированы на desktop, но должны корректно
работать на tablet.

Public Marketplace и Buyer/Partner cabinets --- mobile-first responsive.

Не пытаться уместить desktop data table на мобильный экран; использовать
cards/compact views.

## 29. Accessibility

Обязательно:

-   keyboard navigation;
-   focus states;
-   semantic labels;
-   contrast;
-   status not by color alone;
-   accessible dialogs;
-   table headers;
-   screen-reader labels.

## 30. Design acceptance

Экран считается корректным только если:

1.  понятно, какой домен владеет объектом;
2.  виден текущий статус;
3.  видно следующее действие;
4.  видны blockers;
5.  действия соответствуют RBAC;
6.  чужие сущности read-only либо открываются в своем Work Center;
7.  public/partner/buyer/internal контуры не смешаны.
