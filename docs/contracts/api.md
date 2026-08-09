# REST API — /api/v1/{domain}/...

Каждый эндпоинт принадлежит **ровно одному домену**. Глобальный префикс
`/api/v1`. Ошибки: единая форма `{ statusCode, message, requestId }`.

## Request ID (Step 1.15)

Каждый HTTP response (включая ошибки и public anonymous endpoints) возвращает
канонический заголовок `X-Request-Id` — server-authoritative UUID v4.

- Входной `X-Request-Id` от клиента принимается **только** если это валидный
  UUID v4 (≤64 симв.) — documented diagnostic contract (ADR-0009): он становится
  requestId запроса. Невалидный/oversized/дубликат — сервер генерирует свой.
- `X-Correlation-Id` от клиента НЕ принимается как authoritative: сервер сам
  назначает correlation (см. `docs/contracts/events.md`, ADR-0009).
- Тело ошибки содержит `requestId` для связи с server logs (без stack/internal
  leakage, без PII).
- `requestId` ≠ behavioral `eventId` ≠ `sessionId`.

## Аутентификация и RBAC (Phase 2)

```text
POST   /api/v1/auth/register    самозапись → { accessToken, user } (роль BUYER)
POST   /api/v1/auth/login       вход → { accessToken, user: { ..., permissions } }
GET    /api/v1/auth/me          текущий пользователь + актуальные права (Bearer)
POST   /api/v1/auth/logout      выход (аудит) — Bearer
GET    /api/v1/users            список пользователей — settings.write (ADMIN)
POST   /api/v1/users            создание персонала (роль из тела) — settings.write
PATCH  /api/v1/users/:id/role   смена роли (аудит) — settings.write
PATCH  /api/v1/users/:id/status блокировка/активация (аудит) — settings.write
```

- Все эндпоинты (кроме `register`/`login`) требуют заголовок
  `Authorization: Bearer <jwt>`.
- Права — granular permissions (см. `backend/src/security/permissions.constants.ts`),
  роль → права по RBAC Matrix §2; права читаются из БД на каждый запрос.
- Ошибки: `401` (нет/неверный токен), `403` (нет права, в ответе перечислены
  недостающие permissions).

### Права по доменам (применено)

| Домен | Чтение | Запись | Особое |
|---|---|---|---|
| Catalog | `catalog.product.read` | `catalog.product.write` | publish: `catalog.product.publish`; категории: `catalog.category.write`; availability: `catalog.availability.write` |
| CRM | `crm.customer.read` | `crm.customer.write`, `crm.contact.write`, `crm.company.write`, `crm.partner.write`, `crm.supplier.write` | — |
| Order | `order.read` | по action: `order.accept`, `order.edit_noncritical`, `order.request_booking`, `order.suspend`, `order.cancel`, `order.close` | `POST /orders/bootstrap` — только `order.import` (ADMIN exception) |
| Booking | `booking.read` | по action: `booking.send_supplier`, `booking.confirm`, `booking.cancel` | создание только через событие `BookingRequested` |

## Catalog Center (владелец Product/Tariff/Availability/Category)

```text
POST   /api/v1/products                  создание (PRD-*, DRAFT) + тарифы — catalog.product.write
GET    /api/v1/products                  список: ?type=&status=&search=&page=&pageSize= — catalog.product.read
GET    /api/v1/products/:id              карточка + тарифы + availability + история — catalog.product.read
PATCH  /api/v1/products/:id              правка — catalog.product.write
POST   /api/v1/products/:id/publish      публикация — catalog.product.publish
POST   /api/v1/products/:id/archive      архивация — catalog.product.publish
GET    /api/v1/products/:id/availability — catalog.product.read
POST   /api/v1/products/:id/availability upsert слотов — catalog.availability.write
GET    /api/v1/categories                — catalog.product.read
POST   /api/v1/categories                — catalog.category.write
```

## CRM mini (владелец Customer/Contact/Company/Partner/Supplier)

```text
POST   /api/v1/customers        создание (CUS-*; CustomerCreated) — crm.customer.write
GET    /api/v1/customers        список: ?search=&status=&page=&pageSize= — crm.customer.read
GET    /api/v1/customers/:id    карточка + контакты + история — crm.customer.read
PATCH  /api/v1/customers/:id    правка — crm.customer.write
GET    /api/v1/customers/:id/contacts — crm.customer.read
POST   /api/v1/customers/:id/contacts — crm.contact.write
GET    /api/v1/companies        — crm.customer.read
POST   /api/v1/companies        — crm.company.write
POST   /api/v1/partners         — crm.partner.write
GET    /api/v1/suppliers        — crm.customer.read
POST   /api/v1/suppliers        — crm.supplier.write
```

## Order Center (владелец Order/OrderItem/OrderTraveler/Fulfillment)

```text
POST   /api/v1/orders/bootstrap   служебное создание (ADMIN exception): ORD-* + TH-* — order.import
GET    /api/v1/orders             список: ?status=&customerId=&search=&page=&pageSize= — order.read
GET    /api/v1/orders/:id         карточка + items + travelers + fulfillment + история — order.read
PATCH  /api/v1/orders/:id         action: process | markWaitingData | resumeProcessing |
                                  confirm | send | complete | close | cancel | problem | suspend
PATCH  /api/v1/orders/:id/travelers  обновление паспортных данных — order.edit_noncritical
```

Действия и события (Step 1.14 — canonical Order events):
`confirm` → `OrderReadyForBooking` (факт); `send` («Передать в Booking Center») →
`BookingRequested` (command); `complete` → `OrderFulfilled` (факт);
`close` → `OrderClosed` (факт); `cancel` → `OrderCancelled` (факт);
прочие (process/markWaitingData/resumeProcessing/problem/suspend) →
`OrderStatusChanged` (технический). События пишутся атомарно с переходом
(state + OrderHistory + outbox в одной транзакции).

## Booking Center (владелец Booking/Reservation/SupplierConfirmation/Passenger)

```text
GET    /api/v1/bookings          список: ?status=&orderId=&search=&page=&pageSize= — booking.read
GET    /api/v1/bookings/:id      карточка + passengers + confirmations + история — booking.read
PATCH  /api/v1/bookings/:id      action: send | confirm | reject | service | complete | cancel | problem
```

**Создания через POST нет** — Booking создаётся только consumer-ом
`BookingRequested`. `confirm` → `BookingConfirmed`; `reject` →
`BookingRejected`; `cancel` → `BookingCancelled`; прочие →
`BookingStatusChanged` (Order слушает их для реконсиляции агрегата).
