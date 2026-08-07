# REST API (Phase 1) — /api/v1/{domain}/...

Каждый эндпоинт принадлежит **ровно одному домену**. Глобальный префикс
`/api/v1`. Ошибки: единая форма `{ statusCode, message }`.

## Catalog Center (владелец Product/Tariff/Availability/Category)

```text
POST   /api/v1/products                  создание (PRD-*, DRAFT) + тарифы
GET    /api/v1/products                  список: ?type=&status=&search=&page=&pageSize=
GET    /api/v1/products/:id              карточка + тарифы + availability + история
PATCH  /api/v1/products/:id              правка (только DRAFT/COMPLETE/REVIEWED/CHANGED)
POST   /api/v1/products/:id/publish      публикация (событие ProductPublished)
POST   /api/v1/products/:id/archive      архивация (событие ProductArchived)
GET    /api/v1/products/:id/availability
POST   /api/v1/products/:id/availability upsert слотов
GET    /api/v1/categories
POST   /api/v1/categories
```

## CRM mini (владелец Customer/Contact/Company/Partner/Supplier)

```text
POST   /api/v1/customers        создание (CUS-*; событие CustomerCreated)
GET    /api/v1/customers        список: ?search=&status=&page=&pageSize=
GET    /api/v1/customers/:id    карточка + контакты + история
PATCH  /api/v1/customers/:id    правка (событие CustomerUpdated)
GET    /api/v1/customers/:id/contacts
POST   /api/v1/customers/:id/contacts
GET    /api/v1/companies · POST /api/v1/companies
POST   /api/v1/partners · GET /api/v1/suppliers · POST /api/v1/suppliers
```

## Order Center (владелец Order/OrderItem/OrderTraveler/Fulfillment)

```text
POST   /api/v1/orders/bootstrap   служебное создание (Phase 1): ORD-* + TH-*, items+travelers
GET    /api/v1/orders             список: ?status=&customerId=&search=&page=&pageSize=
GET    /api/v1/orders/:id         карточка + items + travelers + fulfillment + история
PATCH  /api/v1/orders/:id         action: process | markWaitingData | resumeProcessing |
                                  confirm | send | complete | close | cancel | problem | suspend
PATCH  /api/v1/orders/:id/travelers  обновление паспортных данных (COMPLETE/INCOMPLETE)
```

Действия и события:
`confirm` → `OrderApproved`; `send` («Передать в Booking Center») →
`BookingRequested`; `cancel` → `OrderCancelled`; прочие → `OrderStatusChanged`.

## Booking Center (владелец Booking/Reservation/SupplierConfirmation/Passenger)

```text
GET    /api/v1/bookings          список: ?status=&orderId=&search=&page=&pageSize=
GET    /api/v1/bookings/:id      карточка + passengers + confirmations + история
PATCH  /api/v1/bookings/:id      action: send | confirm | reject | service | complete | cancel | problem
```

**Создания через POST нет** — Booking создаётся только consumer-ом
`BookingRequested`. `confirm` → `BookingConfirmed`; `reject` →
`BookingRejected`; `cancel` → `BookingCancelled`; прочие →
`BookingStatusChanged` (Order слушает их для реконсиляции агрегата).
