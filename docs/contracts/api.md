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

## Communication (Step 1.16 — владелец communication.*, CML-*, ADR-0011)

Каноническая cross-domain Communication: единый факт коммуникации, связанный с
business context (CUSTOMER/PARTNER/ORDER/BOOKING) через typed reference
(contextType+contextId, БЕЗ FK). Один bounded context `communication.*`
(ADR-0011); legacy chat-таблиц нет; `/account/support` остаётся controlled
empty (Support domain — Phase 3).

```text
POST   /api/v1/communications            создать (CML-*) — communication.create (internal staff)
GET    /api/v1/communications            список: ?contextType=&contextId=&type=&direction=&page=&pageSize= — communication.read
GET    /api/v1/communications/own        own-scope (BUYER: свой Customer; PARTNER: свой Partner) — communication.read_own
GET    /api/v1/communications/:code      detail: staff → любой; BUYER/PARTNER → own-scope, иначе neutral 404
```

Create-contract (whitelist DTO + raw-body forbidden keys → 422):

```jsonc
{
  "type": "MESSAGE | NOTE",        // NOTE ⇒ direction INTERNAL (внутренняя заметка)
  "direction": "INBOUND | OUTBOUND | INTERNAL",
  "subject": "?",                  // ≤200, plain text
  "body": "...",                   // 1..4000, plain text, БЕЗ HTML (422)
  "contextType": "CUSTOMER | PARTNER | ORDER | BOOKING",
  "contextId": "<canonical id>",   // server-side existence check (422)
  "sender": { "type": "USER|CUSTOMER|PARTNER|SYSTEM", "id": "?" },
  "recipient": { "type": "USER|CUSTOMER|PARTNER", "id": "..." }
}
```

Правила (Step 1.16):

- клиент НЕ может передать `code/id/status/actorUserId/actorId/createdBy/occurredAt/
  createdAt/requestId/correlationId/customerId/partnerId/system` (forbidden → 422,
  whitelist → 400);
- `occurredAt` всегда server-side UTC (= createdAt для server-created record);
- объектный scope: BUYER видит только context=CUSTOMER==actor.customerId,
  PARTNER — context=PARTNER==actor.partnerId, и только не-NOTE/не-INTERNAL;
  внутренние заметки (NOTE) клиентам не отдаются (neutral 404). Communications
  по собственным ORDER/BOOKING BUYER/PARTNER сейчас не видят — intentional
  limitation foundation (ADR-0011 Amendment §4);
- контекст и participants проверяются server-side (cross-domain READ по ID,
  ADR-0001); forged context/participant → 422;
- **direction ↔ participant policy (impersonation closure)**: NOTE — sender
  внутренний USER, без recipient; MESSAGE INBOUND — sender внешний
  (CUSTOMER/PARTNER), recipient внутренний USER; MESSAGE OUTBOUND — sender
  внутренний USER, recipient внешний (CUSTOMER/PARTNER). SYSTEM participant
  из HTTP — 422;
- **participant ↔ context consistency (existence ≠ authorization)**: CUSTOMER/
  PARTNER refs должны соответствовать контексту (CUSTOMER-контекст == contextId,
  PARTNER-контекст == contextId, ORDER — владелец заказа, BOOKING — владелец
  брони); нарушение → 422;
- DTO whitelist: БЕЗ actorUserId/requestId/correlationId/updatedAt/version;
  own-view режет internal USER ids;
- AuditLog: `communication.created` (без body — PII minimization);
- событие `CommunicationCreated` НЕ эмитится (нет consumer-а, §19);
- пагинация: page/pageSize (cap 50), total, hasMore, детерминированный порядок
  (occurredAt desc, code asc);
- права: `communication.read` (DIRECTOR/OPERATOR/SALES_MANAGER/ADMIN),
  `communication.create` (OPERATOR/SALES_MANAGER/ADMIN),
  `communication.read_own` (BUYER/PARTNER). MODERATOR/FINANCE и др. — без прав.

### Pre-sale conversations (Step 2.2E — владелец communication.*, CML-*, ADR-0011)

Изолированная переписка Buyer↔Seller по Reverse Marketplace контексту
`BuyerRequest + Buyer + Seller [+ Proposal]`. Тот же Communication bounded context
(никакого второго chat-домена): комната — `communication.CommunicationThread`,
сообщения — строки `communication.Communication` (contextType=BUYER_REQUEST,
threadId). Reverse.* остаётся владельцем BuyerRequest/Distribution/SellerProposal.

```text
POST   /api/v1/communications/reverse/conversations                    open/get (get-or-create) — communication.write_own
GET    /api/v1/communications/reverse/conversations                    list own — communication.read_own
GET    /api/v1/communications/reverse/conversations/:id                detail — communication.read_own
GET    /api/v1/communications/reverse/conversations/:id/messages       сообщения (?page=&pageSize=) — communication.read_own
POST   /api/v1/communications/reverse/conversations/:id/messages       send — communication.write_own
```

Open-contract: `{ "buyerRequestId": "...", "sellerPublicId": "SELL-*" }` —
`sellerPublicId` ТОЛЬКО для BUYER (сервер резолвит crm.Partner id через
PublicSellerProfile, ADR-0005); для PARTNER identity = actor.partnerId.
Send-contract: `{ "body": 1..4000 plain text, "subject": "?" ≤200 }` — ТОЛЬКО
эти поля (авторство/direction/ownership server-derived).

Правила (Step 2.2E):

- ровно один поток на `(buyerRequestId, sellerPartnerId)` — DB unique + get-or-create
  (повторный/конкурентный open → один CML, §19/§21);
- eligibility: Buyer владеет request (иначе 404); Seller имеет каноническую
  Distribution (иначе neutral 422); open ТОЛЬКО для SUBMITTED request;
- membership = ровно 2 server-derived участника (колонки потока); generic
  add/remove-member API отсутствует; forged sellerId/buyerId/memberIds/proposalId/
  status/version/timestamps/contactDisclosed → 422 (loud);
- cross-Seller изоляция: отдельный поток на Seller; Seller A не видит/не пишет
  в поток B (neutral 404); Buyer общается с каждым Seller отдельно;
- send re-read живой `reverse.BuyerRequest.status` (FOR UPDATE): CANCELLED → 422,
  история durable; Proposal WITHDRAWN НЕ блокирует переписку; Proposal не
  мутируется чатом;
- CHAT EXISTS ≠ CONTACT DISCLOSED: body/subject проходят единую анти-
  disintermediation (email/phone/URL/мессенджеры/social → 422; ISO-даты — ок);
- сообщения: только `side` (BUYER/SELLER) — без внутренних UUID сторон;
  buyer-view потока: `seller` = PublicSellerProfile (SELL-*, без raw partnerId);
  seller-view: только requestCode (BRQ-*) — без Buyer контактного PII;
- direction для thread-сообщений: автор BUYER → INBOUND, автор SELLER → OUTBOUND;
- аудит: `conversation.opened` / `conversation.message.sent` (без body); события
  НЕ эмитятся; zero Sales/Order/Booking/Payment/Catalog fan-out;
- пагинация: page/pageSize (cap 50), threads — createdAt desc, сообщения —
  occurredAt asc (хронология); права: `communication.read_own`/`write_own`
  (BUYER/PARTNER). Staff peer-записи не имеют (write_own отсутствует → 403).

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
