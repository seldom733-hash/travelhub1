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
| Catalog | `catalog.product.read` | `catalog.product.write` | publish: `catalog.product.publish`; категории: `catalog.category.write`; availability: `catalog.availability.write`; Service Unit publish/archive: `catalog.service_unit.publish` (Step 1.8A) |
| CRM | `crm.customer.read` | `crm.customer.write`, `crm.contact.write`, `crm.company.write`, `crm.partner.write`, `crm.supplier.write` | — |
| Order | `order.read` | по action: `order.accept`, `order.edit_noncritical`, `order.request_booking`, `order.suspend`, `order.cancel`, `order.close` | создание только канонически: `OrderRequested` → consumer (Step 2.6; bootstrap-путь удалён) |
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

## Reverse Marketplace — Buyer selection → canonical Opportunity (Step 2.2F, DD-030)

Единственная публичная конверсионная команда Reverse Marketplace: Buyer выбирает
Seller Proposal СВОЕГО запроса → атомарное создание canonical Sales Opportunity
(`OPP-*`, acquisition source `BUYER_REQUEST`). Документация архитектуры:
`docs/architecture/reverse-proposal-to-sales-conversion.md`.

```text
POST   /api/v1/buyer/requests/:requestId/proposals/:proposalId/select   — reverse.proposal.select_own (BUYER)
GET    /api/v1/buyer/requests/:requestId/proposals                      — reverse.proposal.read_own (BUYER, own request)
GET    /api/v1/buyer/requests/:requestId/proposals/:proposalId          — reverse.proposal.read_own (BUYER, own request)
```

Select-contract (request body — ТОЛЬКО concurrency input):

```jsonc
{ "expectedVersion": 3 }   // CAS по версии BuyerRequest (int ≥ 1)
```

Правила (Step 2.2F):

- **own-scope**: только Buyer, владеющий BuyerRequest (`actor.customerId` ==
  `buyerId`); чужой request / Proposal чужого request → neutral 404
  (анти-enumeration); PARTNER → 403; anonymous → 401;
- **eligibility**: request `SUBMITTED` (DRAFT/CANCELLED → 422); Proposal
  `SUBMITTED` (DRAFT/WITHDRAWN → 422) и принадлежит этому request;
- **server-derived**: buyerId/customerId/sellerId, `acquisitionSource =
  BUYER_REQUEST`, `opportunityId`, provenance refs (`buyerRequestId`/
  `proposalId`/`sellerId`), timestamps — клиент передаёт ТОЛЬКО
  `expectedVersion`; любые forged поля (`buyerId`, `customerId`, `sellerId`,
  `opportunityId`, `leadId`, `quoteId`, `amount`, `currency`, `acquisitionSource`,
  `selected`/`converted`, `selectedAt`/`convertedAt`, `convertedOpportunityId`,
  `salesOwner`, `assignedToId`, `contactDisclosed`, actor/correlation) → 422 (loud);
- **one winner per request**: один выбранный Proposal → одна canonical
  Opportunity (DB `selectedProposalId @unique` + row-lock); другой Proposal
  после выбора → 409; concurrent A/B → ровно один победитель (201 + 409);
- **idempotency**: повторный select того же Proposal (в т.ч. со СТАРОЙ
  `expectedVersion` после response-loss) → 201 с `idempotent: true` и тем же
  `opportunity` (никакого дублирования Opportunity/history/audit);
- **error semantics**: 401/403/404 (neutral)/409 (one-winner, stale CAS)/422
  (eligibility, forged поля); неудача → полный rollback (никакого partial state);
- **response** (BUYER-safe, без контактов):

```jsonc
{
  "requestId": "...",
  "proposalId": "...",
  "proposalCode": "PRP-*",
  "selected": true,
  "idempotent": false,
  "opportunity": { "id": "...", "code": "OPP-*" }
}
```

- **privacy boundary**: конверсия НЕ раскрывает контакты (MATCHED ≠ CONTACT
  DISCLOSED; CONVERTED ≠ CONTACT DISCLOSED); не создаёт Lead (DD-030), Quote,
  Checkout, Sale, Order, Booking, Payment, Communication, Catalog entities;
  Proposal money остаётся non-binding (Opportunity без money); история/audit
  без PII и без контента Proposal;
- **acquisition chain**: Opportunity `BUYER_REQUEST` → Quote (наследует) →
  CheckoutIntent (server-derived) → Sale → OrderRequested → Order → Booking
  (frozen snapshot; DIRECT-пути остаются DIRECT, см. acquisition-source-
  propagation);
- права: `reverse.proposal.select_own`/`read_own` — только BUYER (staff -
  без этих прав → 403; сама конверсия запускается строго Buyer-ом).

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

**Product `serviceTimeZone` (Step 2.8A — canonical timezone authority):**
Product create/update принимает опциональный `serviceTimeZone` — IANA ID
(`Asia/Baku`, `Europe/Berlin`; ≤64; формат/валюта не влияют). Является
**авторитетным источником timezone** для exact-time услуг: zone замораживается
в CheckoutIntent при binding и далее verbatim в Sale → OrderRequested → Order →
Booking (§8: никакого browser/locale/IP/offset authority). Не-IANA значение
(`UTC+4`, `UTC+5:30`, несуществующий ID) → **422** при create/update (в т.ч.
через change-proposal/draft для PUBLISHED). NULL = date-only услуга (exact
время недоступно: выбор `serviceTime` в checkout без zone → 422). Изменение
zone НЕ мутирует уже созданные Booking (frozen при создании Booking).

## Service Unit (Step 1.8A — владелец catalog.*, UNI-*, DD-025 B)

Seller Commercial / Service Unit — персистентная коммерческая/сервисная единица
ВНУТРИ Product (комната отеля, вариант трансфера, пакет тура и т.п.). Структура
и идентичность (structure-only): никаких price/availability полей в юните.
Документация архитектуры: `docs/architecture/service-unit-foundation.md`.

```text
POST   /api/v1/products/:productId/service-units   создание (UNI-*, DRAFT) — PARTNER: catalog.product.create_own; staff/ADMIN: catalog.product.write
GET    /api/v1/products/:productId/service-units   список (детерминированный order, limit/offset) — PARTNER: catalog.product.read_own; staff: catalog.product.read
GET    /api/v1/service-units/:id                   карточка — PARTNER: catalog.product.read_own; staff: catalog.product.read
GET    /api/v1/service-units/:id/history           audit-история — PARTNER: catalog.product.read_own; staff: catalog.product.read
PATCH  /api/v1/service-units/:id                   правка name/attributes — PARTNER: catalog.product.update_own_draft (только СВОЙ DRAFT); staff/ADMIN: catalog.product.write
POST   /api/v1/service-units/:id/publish           публикация (гейт: Product PUBLISHED) — catalog.service_unit.publish (staff/ADMIN)
POST   /api/v1/service-units/:id/archive           архивация (soft) — catalog.service_unit.publish (staff/ADMIN)
```

Create-contract:

```jsonc
{
  "name": "Deluxe Room Sea View",   // обязательное, verbatim, ≤200 (только trim)
  "attributes": { "occupancy": 2, "bedType": "double" },  // optional, валидируется по CategorySchema Product
  "source": "CHANNEL_MANAGER",     // optional — ТОЛЬКО staff/ADMIN (trusted import identity); PARTNER → 422
  "externalKey": "RM-101"          // optional — требует source; server/trusted
}
```

Правила (Step 1.8A):

- **ownership**: юнит принадлежит Product; `partnerId`/`categoryId`/
  `categorySchemaId` наследуются из Product (server-derived, без FK — ADR-0001);
  PARTNER — только СВОИ Product; чужой Product/unit → 403 (managed deny, как
  Product);
- **verbatim name**: Seller-название сохраняется как есть (case/порядок слов не
  нормализуются, не переводятся); TravelHub стандартизирует атрибуты, не имена;
- **schema snapshot**: attributes валидируются по CategorySchema-снапшоту Product
  (`categorySchemaId`) — изменение CategorySchema не переинтерпретирует
  исторические юниты; forged attributes → 422;
- **forbidden keys** (create/update, 422 loud): id/code/productId/categoryId/
  categorySchemaId/partnerId/ownerId/status/version/publishedAt/timestamps/actor;
  update дополнительно: source/externalKey (immutable — смена = delete + create);
- **import identity** (DD-025): `(source, externalKey)` — server/trusted;
  PARTNER не может задавать (422); externalKey без source → 422; уникальность
  в ownership scope `(partnerId, productId, source, externalKey)` — повторный
  import → 409 (reconcile), concurrency → ровно один юнит; manual units без
  externalKey валидны;
- **lifecycle**: DRAFT → PUBLISHED → ARCHIVED; PUBLISHED разрешён ТОЛЬКО если
  родительский Product PUBLISHED (иначе 409) — юнит не может сделать
  неопубликованный Product публично bookable; PARTNER не имеет publish (403);
  idempotent re-publish/archive (no-op при том же состоянии);
- **mutability**: PARTNER правит СВОЙ DRAFT; staff/ADMIN — любые не-ARCHIVED;
  ARCHIVED immutable (409);
- **no side effects**: create не создаёт Tariff/Availability/Reservation/
  Quote/Checkout/Sale/Order/Booking; Reverse Marketplace данные не мутируются;
  событий нет (нет consumer-а — §37);
- **audit**: `ServiceUnitHistory` + AuditLog (`service_unit.created/updated/
  published/archived`) без PII/атрибутов;
- MODERATOR/BUYER — без прав (403); public read юнитов отсутствует (1.8A —
  structure-only, frontend не затронут).

## Rate Plan (Step 1.8B — владелец catalog.*, Tariff IS Rate Plan, TRF-*, DD-024)

Tariff → canonical Rate Plan foundation: коммерческий план ВНУТРИ Product, опционально
привязан к ServiceUnit. Канонический граф: `Product → ServiceUnit → Tariff/Rate Plan →
CommercialPeriod (1.8C, НЕ реализован)`. Документация архитектуры:
`docs/architecture/rate-plan-foundation.md`, `docs/architecture/universal-pricing-model.md`.

```text
POST   /api/v1/products/:productId/tariffs   создание (TRF-*, ACTIVE) — PARTNER: catalog.product.create_own (только СВОЙ DRAFT Product); staff/ADMIN: catalog.product.write
GET    /api/v1/products/:productId/tariffs   список (детерминированный order, limit/offset) — PARTNER: catalog.product.read_own; staff: catalog.product.read
GET    /api/v1/tariffs/:id                   карточка — PARTNER: catalog.product.read_own; staff: catalog.product.read
GET    /api/v1/tariffs/:id/history           audit-история — PARTNER: catalog.product.read_own; staff: catalog.product.read
PATCH  /api/v1/tariffs/:id                   правка — PARTNER: catalog.product.update_own_draft (только под DRAFT Product); staff/ADMIN: catalog.product.write
POST   /api/v1/tariffs/:id/archive           soft-снятие (ACTIVE → ARCHIVED) — catalog.rate_plan.publish (staff/ADMIN)
POST   /api/v1/tariffs/:id/activate          восстановление (ARCHIVED → ACTIVE) — catalog.rate_plan.publish (staff/ADMIN)
```

Create/Update-contract:

```jsonc
{
  "name": "Breakfast Included — Non-refundable",  // обязательное, verbatim, ≤200 (только trim)
  "price": 150,                                    // Decimal(12,2), неотрицательный; 0 — бесплатная услуга
  "currency": "AZN",                              // optional, ISO 4217 (default USD); immutable после создания
  "serviceUnitId": "<UNI-*>",                     // optional — юнит того же Product + того же Seller (иначе 422); null — отвязка
  "priceBasis": "PER_NIGHT",                      // optional — одиночный тег; category allowlist (CategorySchema.tariffRules.allowedBases)
  "refundability": "REFUNDABLE",                  // optional: REFUNDABLE | NON_REFUNDABLE
  "pricingMode": "FIXED",                         // optional: FIXED (default) | PRICE_ON_REQUEST (явное inquiry-only состояние)
  "inclusions": { "mealPlan": "Half Board", "includedServices": ["Transfer"] },  // optional, whitelist-ключи
  "restrictions": { "minStay": 1, "maxStay": 7, "advanceBookingDays": 3 },        // optional, metadata (engine — 1.8D)
  "validFrom": "2026-06-01", "validTo": "2026-08-31"   // optional legacy booking/commercial validity window (НЕ stay-period)
}
```

Правила (Step 1.8B):

- **ownership**: Rate Plan принадлежит Product; PARTNER — только СВОИ Product;
  чужой Product → 403; ServiceUnit-привязка сервер-валидируется (unit.productId ==
  tariff.productId, unit.partnerId == product.partnerId, unit НЕ ARCHIVED) — forged/
  foreign/cross-Product unit → 422;
- **verbatim name**: Seller-название как есть (только trim); не нормализуется/не переводится;
- **basis**: одиночный семантический тег (PER_UNIT/PER_ROOM/PER_PERSON/PER_NIGHT/
  PER_DAY/PER_HOUR/PER_TRIP/PER_SERVICE/PACKAGE_TOTAL); НЕ compound-строки; если
  CategorySchema.tariffRules.allowedBases задан — basis обязан быть member (иначе 422),
  но basis НЕ обязателен (legacy Product-only планы валидны);
- **PRICE_ON_REQUEST**: явное состояние плана «inquiry-only»; НЕ выводится из null/нуля
  цены (missing ≠ POR); legacy price остаётся base/FIXED fallback (до 1.8C);
  публично POR-план ВИДИМ как inquiry-only offer (price:null, pricingMode в DTO), но
  НЕ вносит цену в priceFrom/price-sort и не bindable (STRICT REVIEW §22 — visibility
  отделена от цены/bindability);
- **currency**: одна canonical валюта на план (DD-029); ISO 4217; immutable после
  создания (смена = новый Rate Plan);
- **legacy validFrom/validTo**: booking/commercial validity window — НЕ stay-период,
  не переинтерпретируется как CommercialPeriod (1.8C);
- **forbidden keys** (create/update, 422 loud): id/code/productId/partnerId/ownerId/
  status/version/timestamps/actor/commercialPeriods/calendar/overrides/availability/
  reservation/sales-refs; update дополнительно: currency (immutable);
- **lifecycle**: status ACTIVE/ARCHIVED (soft commercial state); публикация НЕ отдельный
  lifecycle — eligibility наследуется из родительской цепочки (Product PUBLISHED +
  ServiceUnit PUBLISHED если attached; план на DRAFT/ARCHIVED unit публично скрыт —
  STRICT REVIEW §42); публично ACTIVE планы под eligible unit (ARCHIVED скрыт;
  unit-less legacy план публичен); archive/activate — catalog.rate_plan.publish
  (staff/ADMIN; PARTNER → 403); idempotent no-op при том же состоянии;
- **mutability**: PARTNER правит Rate Plans только под СВОИ DRAFT Product (коммерческие
  правки опубликованного контента — через change proposal/модерацию); staff/ADMIN —
  любые не-ARCHIVED; ARCHIVED immutable (409); атомарный conditional update по status
  + version-CAS (STRICT REVIEW §39): два параллельных PATCH с разными полями —
  второй получает 409 (никакого last-write-wins/lost update);
- **delete-safety (STRICT REVIEW §52)**: Rate Plan с аудит-историей (TariffHistory)
  НЕ может быть удалён физически (FK ON DELETE RESTRICT + явный гейт в legacy
  tariffs-replacement → 409); управление такими планами — через Rate Plan API
  (archive/activate/update);
- **no side effects**: create/update не создаёт CommercialPeriod/calendar/overrides/
  Availability/Reservation/Quote/Checkout/Sale/Order/Booking; Reverse данные не
  мутируются; событий нет (нет consumer-а — §34);
- **audit**: `TariffHistory` + AuditLog (`rate_plan.created/updated/archived/activated`)
  без PII/inclusions/restrictions;
- MODERATOR/BUYER — без прав (403).

## Commercial Period (Step 1.8C — владелец catalog.*, CPR-*, DD-026/DD-027)

```text
POST   /api/v1/tariffs/:tariffId/commercial-periods           создание (CPR-*, ACTIVE) — PARTNER: catalog.product.update_own_draft (СВОЙ DRAFT); staff/ADMIN: catalog.product.write
POST   /api/v1/tariffs/:tariffId/commercial-periods/bulk      годовой календарь (all-or-nothing, advisory lock) — те же permissions
GET    /api/v1/tariffs/:tariffId/commercial-periods           список (?status=ACTIVE|ARCHIVED|ALL, limit/offset) — PARTNER: catalog.product.read_own; staff: catalog.product.read
GET    /api/v1/commercial-periods/:id                         карточка — PARTNER: catalog.product.read_own; staff: catalog.product.read
GET    /api/v1/commercial-periods/:id/history                 audit-история — те же permissions
PATCH  /api/v1/commercial-periods/:id                         правка (version-CAS, 409 на stale) — PARTNER: update_own_draft (DRAFT); staff: catalog.product.write
POST   /api/v1/commercial-periods/:id/archive                 soft-снятие — catalog.rate_plan.publish (staff/ADMIN)
POST   /api/v1/commercial-periods/:id/activate                восстановление — catalog.rate_plan.publish (staff/ADMIN)
```

- kind `PERIOD`/`DATE_OVERRIDE`; date-only inclusive `[startDate, endDate]` (UTC midnight);
- price Decimal(12,2) в валюте Tariff (наследуется, не передаётся); `sellable=false` = stop-sell периода;
- precedence: DATE_OVERRIDE > narrower PERIOD > DAY_OF_WEEK > base (same-priority overlap → 422);
- MODERATOR/BUYER — 403.

## Commercial Restriction (Step 1.8D — владелец catalog.*, CRS-*, DD-026/DD-028)

```text
POST   /api/v1/tariffs/:tariffId/commercial-restrictions      создание (CRS-*, ACTIVE) — PARTNER: catalog.product.update_own_draft (СВОЙ DRAFT); staff/ADMIN: catalog.product.write
GET    /api/v1/tariffs/:tariffId/commercial-restrictions      список (?status=ACTIVE|ARCHIVED|ALL, limit/offset) — PARTNER: catalog.product.read_own; staff: catalog.product.read
GET    /api/v1/commercial-restrictions/:id                    карточка — PARTNER: catalog.product.read_own; staff: catalog.product.read
GET    /api/v1/commercial-restrictions/:id/history            audit-история — те же permissions
PATCH  /api/v1/commercial-restrictions/:id                    правка (version-CAS, 409 на stale) — PARTNER: update_own_draft (DRAFT); staff: catalog.product.write
POST   /api/v1/commercial-restrictions/:id/archive            soft-снятие — catalog.rate_plan.publish (staff/ADMIN)
POST   /api/v1/commercial-restrictions/:id/activate           восстановление — catalog.rate_plan.publish (staff/ADMIN)
```

- body: `scope` PERIOD|DATE, `type` STOP_SELL|MIN_STAY|ADVANCE_BOOKING|CLOSED_TO_ARRIVAL|CLOSED_TO_DEPARTURE, `value` (MIN_STAY 1..365, ADVANCE_BOOKING 0..365), `commercialPeriodId` (PERIOD-scope), `startDate==endDate` (DATE-scope);
- base-факты живут в `Tariff.restrictions` (1.8B) — единый authority на уровне; TARIFF-scope в entity запрещён;
- precedence: DATE > PERIOD-attached (resolved period 1.8C) > BASE; same-tier duplicate → 422;
- STOP_SELL — DATE-scope only (периодный stop-sell = `CommercialPeriod.sellable`);
- CategorySchema `tariffRules.allowedRestrictions` (DD-028) — unsupported dimension → 422;
- Quote path: серверный evaluator (pre-binding 422), `QuoteItem.restrictionSnapshot` — frozen provenance;
- MODERATOR/BUYER — 403.

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

> Создание Order — ТОЛЬКО канонический путь (Step 2.6): `Quote → CheckoutIntent →
> Sale → OrderRequested → Outbox/EventBus → Order-owned consumer → Order → OrderCreated`.
> Никакого HTTP direct-create эндпоинта не существует.

```text
GET    /api/v1/orders             список: ?status=&customerId=&search=&page=&pageSize= — order.read
GET    /api/v1/orders/:id         карточка + items + travelers + fulfillment + история — order.read
PATCH  /api/v1/orders/:id         action: process | markWaitingData | resumeProcessing |
                                  confirm | send | complete | close | cancel | problem | suspend
PATCH  /api/v1/orders/:id/travelers  обновление паспортных данных — order.edit_noncritical
```

Действия и события (Step 1.14/2.7 — canonical Order events):
`confirm` → `OrderReadyForBooking` (факт); `send` («Передать в Booking Center») →
`BookingRequested` (command); `complete` → `OrderFulfilled` (факт);
`close` → `OrderClosed` (факт); `cancel` → `OrderCancelled` (факт);
прочие (process/markWaitingData/resumeProcessing/problem/suspend) →
`OrderStatusChanged` (технический). События пишутся атомарно с переходом
(state + OrderHistory + outbox в одной транзакции).

Статусы (Step 2.7, stable backend codes — Screen Design Baseline):
`NEW` → `IN_PROCESSING` ⇄ `WAITING_FOR_DATA` → `READY_FOR_BOOKING` →
`SENT_TO_BOOKING` → `PARTIALLY_FULFILLED` → `FULFILLED` → `CLOSED`;
`CANCELLED`/`PROBLEM`/`SUSPENDED` — marker-состояния. `READY_TO_CLOSE` —
зарезервированный код без producer-а (close каноничен из `FULFILLED`).
Невалидные переходы → 409 (from-guard, CAS); неполные данные туристов на
`confirm` → 422; forged server-owned поля (status/amount/version/milestones/
customerId/saleId/acquisitionSource/… на PATCH /orders/:id; id/orderId/version/
dataCompleteness/… на PATCH /orders/:id/travelers) → **422** (`assertNoForbiddenKeys`,
STRICT REVIEW 2.7 §28 — конвенция Sales/Reverse/Catalog, не silent-strip).

**Order temporal факты (Step 2.8A):** Order/OrderItem несут frozen local
service occurrence — `serviceDate` (date-only) + опциональные `serviceTime`/
`serviceEndTime` (local HH:mm) + `serviceTimeZone` (IANA), verbatim из
OrderRequested (Sales freezes; Order не пере-резолвит Catalog). PATCH
`/orders/:id` с forged temporal полями (serviceTime/serviceTimeZone/
serviceStartsAt/…) → **422** (server-owned, конвенция §28).
`READY_FOR_BOOKING` требует `OrderTraveler.dataCompleteness =
COMPLETE`; `send` — только из `READY_FOR_BOOKING`; Booking создаёт ТОЛЬКО
consumer `BookingRequested` (Order-модуль не пишет в booking.*, Step 2.8 boundary).

Milestone-времена (2.5A): `confirmedAt`/`fulfilledAt`/`closedAt`/`cancelledAt` +
`submittedAt` — server-owned, immutable, ставятся атомарно с переходом. SLA
(Step 2.7): детерминированно вычислимо из milestone-времён и OrderHistory
(persisted SLA-политика/дедлайны не введены — нет канонического источника;
см. `docs/architecture/order-lifecycle-completion.md`).

## Booking Center (владелец Booking/Reservation/SupplierConfirmation/Passenger)

```text
GET    /api/v1/bookings          список: ?status=&orderId=&search=&page=&pageSize= — booking.read
GET    /api/v1/bookings/:id      карточка + passengers + confirmations + история — booking.read
PATCH  /api/v1/bookings/:id      action: prepare | send | requestClarification | resume |
                                 confirm | reject | service | requestChange | resolveChange |
                                 requestCancellation | complete | cancel | problem
```

**Lifecycle (Step 2.9 — единственный authority `BookingService.bookingAction`,
Screen Design codes verbatim):**

| Действие | From → To | Право | Событие |
|---|---|---|---|
| `prepare` | NEW → PREPARING_REQUEST | booking.send_supplier | BookingStatusChanged (техн.) |
| `send` | NEW/PREPARING_REQUEST → SENT_TO_SUPPLIER | booking.send_supplier | BookingStatusChanged (техн.) |
| `requestClarification` | SENT_TO_SUPPLIER/AWAITING_CONFIRMATION → NEEDS_CLARIFICATION | booking.confirm | BookingStatusChanged (техн.) |
| `resume` | NEEDS_CLARIFICATION → SENT_TO_SUPPLIER | booking.confirm | BookingStatusChanged (техн.) |
| `confirm` | SENT_TO_SUPPLIER/AWAITING_CONFIRMATION → CONFIRMED | booking.confirm | **BookingConfirmed** |
| `reject` | SENT_TO_SUPPLIER/AWAITING_CONFIRMATION → SUPPLIER_REJECTED (терм.) | booking.confirm | **BookingRejected** |
| `service` | CONFIRMED → IN_SERVICE | booking.confirm | BookingStatusChanged (техн.) |
| `requestChange` | CONFIRMED/IN_SERVICE → CHANGE_REQUESTED | booking.request_change | BookingStatusChanged (техн.) |
| `resolveChange` | CHANGE_REQUESTED → CONFIRMED | booking.request_change | BookingStatusChanged (техн.) |
| `requestCancellation` | CONFIRMED/IN_SERVICE/CHANGE_REQUESTED/NEEDS_CLARIFICATION → CANCELLATION_REQUESTED | booking.cancel | BookingStatusChanged (техн.) |
| `complete` | IN_SERVICE → COMPLETED (терм.) | booking.confirm | **BookingCompleted** + BookingStatusChanged (техн.) |
| `cancel` | любой активный → CANCELLED (терм.) | booking.cancel | **BookingCancelled** |
| `problem` | любой активный → PROBLEM | booking.confirm | BookingStatusChanged (техн.) |

- Терминальные: `SUPPLIER_REJECTED`, `COMPLETED`, `CANCELLED` — не reopen-аются (409).
- `AWAITING_CONFIRMATION` — резервный код без producer-а (legacy-источник для
  `confirm`/`reject`; как `READY_TO_CLOSE` в Order).
- `NEEDS_CLARIFICATION`/`CHANGE_REQUESTED`/`CANCELLATION_REQUESTED` —
  operational marker-состояния (screen queues); НЕ меняют frozen money,
  acquisitionSource, service occurrence (2.8A), availability, Finance.
- Невалидный переход → 409 (from-guard + CAS `updateMany where id+status+version`;
  concurrent/retry — ровно один победитель, остальные 409, без duplicate
  history/event). Malformed/forged → 400/422. Unknown Booking → нейтральный 404.
- **Order-status guard (STRICT REVIEW 2.9):** lifecycle-команды (кроме `cancel`)
  на брони заказа `CANCELLED`/`CLOSED` → 409 (READ-only Order check; инвариант
  «нет активной Booking под отменённым заказом»); `problem` из PROBLEM — 409
  (нет self-transition).
- RBAC: только staff-роли с каталоговыми правами (OPERATOR/ADMIN и др.);
  BUYER/PARTNER/MODERATOR/SALES_MANAGER — 403 (матрица §4).
- События: state + BookingHistory + outbox — атомарно в одной транзакции;
  HTTP-команды — correlation = server UUID, causation = null.
- **Компенсация (Step 2.9 §15):** `OrderCancelled` → Booking-консьюмер
  (`booking-order-cancelled-consumer`) отменяет активные Booking заказа
  (CANCELLED + history `cancelled_order` + result-event `BookingCancelled`);
  терминальные не трогаются; гонка Order-cancel vs Booking-create в обоих
  порядках детерминирована (создание сразу в CANCELLED при уже отменённом
  заказе); никакого hard delete / refund / Finance / availability-release.

**Создания через POST нет** — Booking создаётся только consumer-ом
`BookingRequested` (Step 2.8 canonical: `Order → BookingRequested →
Booking-owned consumer → Booking`; POST /bookings → 404). Кардинальность:
`1 OrderItem → ровно 1 Booking` (DB-level unique `Booking.orderItemId`;
legacy NULL). Initial status `NEW`, коды `BKG-*`; Passenger — из COMPLETE
OrderTraveler (non-traveler заказ — Booking без Passenger); frozen
acquisitionSource verbatim (DIRECT/BUYER_REQUEST/null); amount = item.amount
(без reprice); availability hold не дублируется. `PATCH /bookings/:id` —
только `action`; forged server-owned поля (id/code/orderId/orderItemId/
productId/status/amount/acquisitionSource/version/…) → **422**
(`assertNoForbiddenKeys`, STRICT REVIEW 2.8 §28).

**Booking temporal модель (Step 2.8A):** Booking хранит frozen service
occurrence, verbatim из Order: `serviceTimeType` (`DATE_ONLY` default — точная
классификация legacy | `TIME_SLOT` | `OPEN_DATE` | `DATE_RANGE` зарезервирован),
`serviceTime`/`serviceEndTime` (local HH:mm), `serviceTimeZone` (IANA),
`serviceStartsAt`/`serviceEndsAt` — деривированные UTC instants (одна деривация
при создании consumer-ом; дата-only → NULL, 00:00 НЕ фабрикуется; инвариант
local↔UTC enforced). Неизменяемы на lifecycle (reschedule не входит в 2.8A);
forged temporal PATCH (`serviceTime/serviceStartsAt/…`) → **422**. Сериализация:
`serviceDate` — date-only/ISO по конвенции проекции; `serviceTime` — `HH:mm`;
zone — IANA ID; `serviceStartsAt` — ISO-8601 instant. `confirm` →
`BookingConfirmed`; `reject` → `BookingRejected`; `cancel` →
`BookingCancelled`; прочие → `BookingStatusChanged` (Order слушает их для
реконсиляции агрегата; сам факт создания Booking НЕ меняет статус Order).

**Booking milestone-времена (Step 2.9A):** Booking несёт сервер-owned
milestones: `requestedAt` (момент отправки запроса поставщику — transition
`send`), `confirmedAt`, `rejectedAt`, `cancelledAt`, `completedAt`.
Каждый milestone устанавливается **ровно один раз** внутри того же
CAS-transaction, что и переход статуса (first-only); повторный переход не
перезаписывает. born-CANCELLED (компенсация при отменённом Order до создания)
несёт `cancelledAt` = момент создания. Компенсация Order-cancel пишет
`cancelledAt` в CAS-обновлении существующей активной брони. Все значения —
UTC instants, сервер-generated; `updatedAt` НЕ используется как бизнес-дата.
forged PATCH любого milestone (requestedAt/confirmedAt/rejectedAt/
cancelledAt/completedAt) → **422** (`assertNoForbiddenKeys`). Сериализация:
ISO-8601 instants; lifecycle-порядок enforcement: `confirmedAt` может
существовать только при CONFIRMED (исторически — до `cancelledAt`, если бронь
была подтверждена до компенсации); терминальный milestone ровно один.

## Finance Center (Step 2.10 — владелец Finance master data; CUR-/FXR-/TAX-/TXR-)

Finance domain FOUNDATION: master-data CRUD. Payment/Refund/Invoice/Settlement/
Payout/LedgerTransaction **write-пути отсутствуют** в Step 2.10 (foundation) —
агрегатные модели в схеме, клиентские write-endpoints → 404 (реализуются
2.12–2.14). Finance — единственный владелец master data; Settings/иные модули
не дублируют.

RBAC: `finance.currency.manage`, `finance.exchange_rate.manage`,
`finance.tax.manage` — только FINANCE/ADMIN; DIRECTOR — read-only Finance
(read-права finance.payment/refund/invoice/commission без manage); BUYER/
PARTNER/OPERATOR/SALES_MANAGER/MODERATOR/MARKETER/ANALYST → 403.

- `GET /api/v1/finance/currencies` / `GET /api/v1/finance/currencies/:code`
- `POST /api/v1/finance/currencies` — `{ isoCode (ISO 4217, 3 буквы), name, symbol, decimals? }`
- `PATCH /api/v1/finance/currencies/:code` — `{ name?, symbol?, decimals?, isActive? }`; isoCode неизменяем
- `GET /api/v1/finance/exchange-rates` / `GET /api/v1/finance/exchange-rates/:code`
- `POST /api/v1/finance/exchange-rates` — `{ baseCurrencyIso, quoteCurrencyIso, rate (Decimal string), validFrom, validTo? }`; base≠quote
- `PATCH /api/v1/finance/exchange-rates/:code` — `{ rate?, validFrom?, validTo?, isActive? }`
- `GET /api/v1/finance/taxes` / `GET /api/v1/finance/taxes/:code`
- `POST /api/v1/finance/taxes` — `{ name, rate (Decimal 12,2), countryIso? (ISO 3166-1 alpha-2) }`
- `PATCH /api/v1/finance/taxes/:code` — `{ name?, rate?, countryIso?, isActive? }`
- `GET /api/v1/finance/tax-rules` / `GET /api/v1/finance/tax-rules/:code`
- `POST /api/v1/finance/tax-rules` — `{ taxId (UUID), productType?, countryIso?, effectiveFrom, effectiveTo? }`; unknown taxId → 422
- `PATCH /api/v1/finance/tax-rules/:code` — `{ productType?, countryIso?, effectiveFrom?, effectiveTo?, isActive? }`

Деньги: Decimal строки (никогда float); rate ≤ 6 знаков, tax rate ≤ 2 знака.
`countryIso` — 2-буквенный ISO 3166-1 alpha-2 (AZ/RU/…); locale-строки и
3-буквенные коды отклоняются. Forged server-owned поля
(`id/code/createdAt/updatedAt/version`) → **422** (`assertNoForbiddenKeys` по
raw body). Дубликат isoCode → 409; неизвестный код → 404. Audit: каждая
master-data запись пишет `finance.*.created/updated` в AuditLog (без PII).

## Finance — LedgerTransaction (Step 2.10A — immutable ledger foundation)

Append-only immutable финансовый факт (`LTX-########`). Публичного write-API
**НЕТ** (создание — только внутренний `LedgerService`, canonical Finance
creation path; update/delete эндпоинты не существуют → 404; модель не имеет
`updatedAt`). Read — Finance Center ledger view.

RBAC: `finance.ledger.read` — FINANCE/DIRECTOR/ANALYST/ADMIN; BUYER/PARTNER/
OPERATOR/SALES_MANAGER/MODERATOR/MARKETER → 403; anonymous → 401.

- `GET /api/v1/finance/ledger-transactions` — whitelist-фильтры
  `{ sourceType?, type?, currency? }` + `{ page?, pageSize? (≤100) }` →
  `{ items, total, page, pageSize, hasMore }`, детерминированная сортировка
  (createdAt desc, code asc).
- `GET /api/v1/finance/ledger-transactions/:code` — деталь; неизвестный → 404.

Факт: `{ id, code, amount (Decimal string > 0, ≤2dp), currency (ISO 4217,
валидируется против finance.Currency), type, sourceType, sourceId,
sourceEventId?, businessRef?, correlationId?, causationId?, actorType?,
actorId?, createdAt (UTC) }`. `amount/currency/type/source/provenance`
неизменяемы после create; исправление — только будущий compensating факт
(одобренный шаг). Idempotency invariant: один факт данного `type` на
`(sourceType, sourceId)` — replay/конкурентный duplicate возвращает
существующий факт (no-op), никогда не дубликат и не raw 500. НЕ эмитит
событий; НЕ трогает Order.paymentStatus/paidAmount/Payment/Refund/
Commission/Booking/Availability.
