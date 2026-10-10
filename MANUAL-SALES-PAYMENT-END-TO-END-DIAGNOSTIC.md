# MANUAL SALES → ORDER → PAYMENT → BOOKING
# END-TO-END DIAGNOSTIC AND ARCHITECTURE RECONCILIATION

**Mode:** READ-ONLY диагностика (`docs/prompts/MANUAL-SALES-PAYMENT-END-TO-END-DIAGNOSTIC.md`).
**Дата:** 2026-10-05. Код, schema, migrations, тесты, seeds, UI — **не изменялись**. Commit/push не выполнялись. Order/Payment в runtime DB не создавались (только SELECT).
**Runtime:** backend `:4000`, frontend `:3000`, DB `postgresql://…/travelhub1`.

---

## 1. Executive Summary

1. **Request `801c9f13…` не конвертируется, потому что у неё нет принятой цены**: `displayedPrice = null`, `confirmedPrice = null`, `supplierPriceProposal = null` (валюта `AZN` есть). Конверсионный гейт `order.service.ts:661` требует `confirmedPrice ?? displayedPrice` и отвечает ровно той 422-ошибкой, что видит пользователь.
2. **Кнопка «Создать заказ» показывается ошибочно**: проекция `computeRequestAvailableActions` (`request.service.ts:40-86`) объявляет `availableActions.convert = true` **без money-гейта** — проверено live на `GET /api/v1/requests/801c9f13…`. Это UI/server-authority defect (§6): серверный контракт «convert доступен» противоречит серверному же execution-гейту.
3. **Причиной null-цены является пропуск цены в supplier/customer-ветке**: `customerAccept` (`request.service.ts:673`) замораживает `confirmedPrice = supplierPriceProposal ?? displayedPrice` **без проверки, что результат не null**, а гистория показывает `supplier_confirmed` без `propose-price` (значит — ни proposal, ни displayedPrice). Guest-checkout намеренно создаёт Request без цены (`guest-checkout.service.ts:105-116`).
4. **Ручной платёж: backend существует полностью, frontend — полностью отсутствует.** Есть Payment агрегат (`schema.prisma:4111`), статусная машина PENDING→CAPTURED/FAILED/CANCELLED, `POST/PATCH /api/v1/finance/payments…`, RBAC (`finance.payment.create` / `finance.payment.manage` / `finance.payment.read`), server-derived amount, обязательный `reason`, `PaymentHistory`. **Не существует ни одного UI-действия** «Принять оплату» / «Зарегистрировать оплату» (нет вызовов POST к payments во всём frontend, нет i18n-ключей). → missing layer = **Frontend** (§10).
5. **Прямой Manual Order command не существует** (нет `POST /orders`; bootstrap удалён в 2.6; `/api/admin/orders` живёт только в `legacy/`). Ручной вход реализован wrapper’ом `ManualCreateForm` (commit `f68a1a5`) через цепочку Request → Order; при этом конвертация хардкодит `acquisitionSource: "MARKETPLACE"` (`order.service.ts:702`) — нарушение контракта attribution для staff-created заказов.
6. **Authority-конфликт (§4/Q12) реален и точен**: governance (roadmap v3, Phase 3.6C.1) фиксирует «Platform Create Order → DOES NOT EXIST», тогда как `PHASE_2_STEP_2.6…` stop-condition #4 декларирует «MANUAL/DIRECT canonically requires direct Order creation **and this is unresolved**», а `acquisition-source-propagation.md:52` — «staff-создание заказа = MANUAL/DIRECT канал». Conflict не был закрыт ни одним более поздним документом.
7. Runtime-состояние: **1 Request, 0 Orders, 0 Payments, 0 Bookings, 6 Customers** — end-to-end сегодня негде выполнить даже технически.

**Текущий поток нигде не замкнут**: для `801c9f13` первая блокирующая точка — `Request → Order` (422, деньги); для корректно оценённой заявки первая блокирующая точка — `Order → Payment` (UI отсутствует; API доступен только raw-вызовом).

---

## 2. Current Runtime Problem

Пользователь нажал «Создать заказ» (`frontend/components/request/RequestActionBar.tsx:75`, label `reqflow.convert_action` = «Создать заказ», `i18n.tsx:2374`), backend вернул:

```text
Request 801c9f13-05a7-4e6b-92ec-768c6a13a275
has no accepted price/currency;
conversion requires commercial terms
```

Источник текста — `createOrderFromRequest` (`backend/src/modules/order/order.service.ts:605-705`):

- `:656` gate `customerAcceptedAt != null` — проходит;
- `:661` `money = r.confirmedPrice ?? r.displayedPrice` → `null` → `BadRequestException` с текстом выше — **падает здесь**;
- `:664` gate `travelerCount >= 1` — проходил бы (`travelerCount = 1`).

Вторая, более фундаментальная проблема: в интерфейсе отсутствует любое действие ручной регистрации фактически полученного платежа (см. §8).

---

## 3. Request 801c9f13 State

Фактические поля (`order."Request"`, SELECT из `travelhub1`; имена — реальные из `schema.prisma:2368-2442`):

| Поле (фактическое) | Значение | Комментарий §5 промпта (ориентировочное имя) |
|---|---|---|
| `id` / `code` | `801c9f13-05a7-4e6b-92ec-768c6a13a275` / `REQ-00000001` | Request.id ✅ |
| `commerceSequence` | `00000001` (unique) | Request.commerceSequence ✅ |
| `referenceNumber` | `MKT-REQ-00000001` | — |
| `status` | `CUSTOMER_ACCEPTED` | ✅ |
| `customerId` | `004aef66-…` → `CUS-00000202` «Guest Smoke», `ACTIVE` | ✅ |
| `displayedPrice` / `displayedCurrency` | **`null`** / `AZN` | ≡ «price/currency» — price null, currency есть |
| `confirmedPrice` / `confirmedCurrency` | **`null`** / `AZN` | ≡ «acceptedPrice/acceptedCurrency» — price null, currency есть |
| `supplierDecision` / `supplierPriceProposal` | `CONFIRMED` / **`null`** | supplier confirmation без ценового предложения |
| `supplierRespondedAt` | `2026-10-05T11:04:46Z` | supplier confirmation data ✅ |
| `customerAcceptedAt` / `customerDecision` | `2026-10-05T11:04:49Z` / `ACCEPTED` | acceptance timestamp ✅ |
| `travelerCount` / `quantity` | `1` / `1` | frozen traveler count ✅ |
| `pinnedRequirements` | `{firstName: REQUIRED, lastName: REQUIRED, birthDate: OPTIONAL, gender/citizenship/passport*: NOT_REQUESTED}` | commercial/requirements snapshot ✅ |
| `productSnapshot` | `{productId: 89ef38f6-…, productCode: KAZUNION-2791-23788, productType: TOUR, productTitle: "Movenpick Living Istanbul… Баку"}` | product/service ✅ |
| `requestedServiceDate` | `null` | — |
| `convertedOrderId` / `convertedAt` | **`null` / `null`** | ✅ |

**Ответы:**
- **accepted commercial snapshot?** — ЧАСТИЧНО: зафиксированы acceptance-инстанс, traveler count, pinned requirements, product snapshot; **но денежная часть snapshot’а пуста** (`confirmedPrice = null`).
- **accepted price?** — **НЕТ** (ни displayed, ни confirmed, ни supplier proposal).
- **accepted currency?** — **ДА** (`AZN`, `confirmedCurrency = "AZN"` — единственный непустой элемент коммерческих условий; ошибка упоминает «price/currency» потому что money-гейт падает первым).

История (`RequestHistory`): `created` (actor `guest-checkout`, 2026-10-04, «Заявка создана (Shared Commerce Sequence)») → `supplier_confirmed` (actor `admin`, «Поставщик: CONFIRMED», **без цены**) → `customer_accepted` (actor `admin`, D3-комментарий про 1 туриста). Event `supplier_proposed_price` отсутствует — цена никогда не была задана.

---

## 4. Request → Order Diagnosis

**Conversion contract (`order.service.ts:605-705`) — фактические обязательные условия:**

| Условие | Код | Для 801c9f13 |
|---|---|---|
| `customerAcceptedAt != null` (D3 acceptance boundary → `Order.termsAcceptedAt`) | `:656` | ✅ |
| **money: `confirmedPrice ?? displayedPrice` не null + currency** | `:661` | ❌ **422 здесь** |
| `travelerCount >= 1` (integer) | `:664` | ✅ |
| product/service: берётся из `productSnapshot` (не из mutable Product) | `:670+` | ✅ (snapshot есть) |
| price authority: **только Request snapshot** — mutable Product price не читается | весь метод | ✅ (прочерк не возможен — gate падает раньше) |

Currency берётся `confirmedCurrency ?? displayedCurrency` — здесь `AZN` (не null). Значит единственное отсутствующее коммерческое условие — **цена**.

**Откуда цена должна была взяться (единственные два легальных источника):**
1. `displayedPrice` при создании Request (`createRequest`) — guest-checkout его **намеренно не передаёт** (`guest-checkout.service.ts:105`: «displayedPrice остаётся null — коммерческие условия фиксирует supplier flow (confirm/propose) до customer-accept freeze по D3»); `ManualCreateForm` в режиме order/booking цену **требует** (client-side `needsMoney = mode !== "request"`).
2. `supplierPriceProposal` через `POST /requests/:id/propose-price` (`request.controller.ts:196-204`, `price` обязателен; `request.service.ts:560-596` → status `PRICE_CHANGED`).
   В заявке admin выполнил `confirm-price` (`request.service.ts:553-555`) — этот action **не принимает цену вообще** (только note) → ветка ушла в `customerAccept` с `supplierPriceProposal = null` при `displayedPrice = null`.

**Дефект №1 (проекция):** `computeRequestAvailableActions` (`request.service.ts:40-86`) для `convert` проверяет лишь status/customer/canEdit и **не содержит money-гейт** → live `GET /api/v1/requests/801c9f13…` возвращает `availableActions.convert = true` при `displayedPrice/confirmedPrice = null` → UI показывает кнопку → execution падает. Проверено live с токеном `POST /api/v1/auth/login` (admin/admin123 — дефолты `security.service.ts:19-20`).

**Дефект №2 (отсутствие раннего гейта):** `customerAccept` (`request.service.ts:626-691`) валидирует status, deadline, product, traveler count — но **не валидирует, что `supplierPriceProposal ?? displayedPrice` не null** (:673) → D3 замораживает `confirmedPrice = null` и переводит в `CUSTOMER_ACCEPTED`, создавая «принятые условия без условий». Оба гейта (прогноз и исполнение) должны бить в одну точку.

**Итог:** conversion contract по деньгам — строго snapshot Request; Product-цена нигде не используется (§7 соблюдено); «примерной цены» нигде нет — наоборот, не хватает цены.

---

## 5. Manual Sales Architecture

Фактический ручной путь (commit `f68a1a5`, `frontend/components/commerce/ManualCreateForm.tsx`, страницы `/app/orders/new`, `/app/requests/new`, `/app/bookings/new`):

```text
ManualCreateForm (mode: request|order|booking)
 → POST /api/v1/requests            (order.edit_noncritical; price обязателен client-side для order/booking)
 → POST /requests/:id/confirm-price | propose-price   (ценовое предложение, если цена не задана)
 → POST /requests/:id/customer-accept                 (D3 freeze)
 → POST /requests/:id/convert       → Order           (order.service.ts createOrderFromRequest)
 → PATCH /orders/:id/action process                   (order.accept)
 → PATCH /orders/:id/travelers                          (composition)
 → POST /orders/:id/final-confirm                      (order.edit_noncritical)
 → PATCH /orders/:id/action confirm | send             (D3 finalConfirmedAt gate; send → BookingRequested)
 → Booking (booking.subscribers.ts consumer)
```

- **Payment-шага в цепочке нет вообще** — форма заканчивается на `send`/Booking (см. §8).
- Клиент в форме **опционален**: `customerId` может быть пустым («— без клиента —») → Request без клиента; для §3-требования «employee → resolve/create Customer» это несоответствие формулировки, но конвертация клиентом не блокируется.
- Customer resolver/создание: `POST /api/v1/crm/customers` (`crm.controller.ts:176-177`) → `crm.customer.write` — существует, без self-registration (§20 выполняется: `Customer ≠ User ≠ Traveler ≠ Payer`, все — отдельные сущности/снимки; payer-роль отсутствует как сущность, деньги идут через Order/Payment).
- Mode `request` формы **не требует цену** → можно повторить тот же сломанный состояния, что у `801c9f13` (MEDIUM, §14).

---

## 6. Manual Order Diagnosis

**Прямого Manual Order command не существует:**

- `POST /api/v1/orders` — **не зарегистрирован**; `POST /orders/bootstrap` — удалён (Phase 2.6, «REMOVE BOOTSTRAP ORDER CREATION»).
- Единственные writers canonical Order: (a) `createOrderFromRequest` (Request conversion), (b) внутренние consumers/consumers (`OrderRequested` из Quote/Sale цепочки; `legacy`-пути убраны).
- `/api/admin/orders` + `CreateOrderModal` существуют **только в `legacy/`** (`legacy/src/components/admin/SalesExecution.tsx:4484`) — отдельная legacy-система, не текущий backend.
- `chapter-7-order-center.md:468` («POST /api/admin/orders — Создание заказа») описывает **легаси**-контракт, а не текущий backend.

**Source attribution:**
- Enum существует: `SalesAcquisitionSource = MARKETPLACE | PARTNER_STOREFRONT | DIRECT | BUYER_REQUEST` + catalog `AcquisitionSource` (`schema.prisma:1640`) — механизм канала **подтверждён архитектурой** (§19 разрешает использовать его, не создавая новых сущностей).
- Но `createOrderFromRequest` хардкодит `acquisitionSource: "MARKETPLACE"` (`order.service.ts:702`) для **любой** конверсии — включая staff-created заявки, у которых по `acquisition-source-propagation.md:52` канал = `MANUAL/DIRECT`, а request-led должен унаследовать `BUYER_REQUEST`/прямой источник. → misattribution (MEDIUM/HIGH, §14).
- Цена в ручном заказе: только через snapshot Request (§4) — отдельного «commercial terms input» для прямого command нет, потому что command нет.
- Permission на создание заказа: отдельного `order.create` **нет** (создание происходит через `order.edit_noncritical` на Request-этапе + conversion-код); `ACTION_PERMISSIONS` (`order.service.ts:149-160`) покрывает только действия со статусом.

**Вывод по §18:** flow `Employee → Customer → Manual Order (без Request)` — **GAP**. Однако вход для сотрудника *частично* существует как wrapper поверх Request-цепочки (`ManualCreateForm`), то есть полное отсутствие ручного входа — неверная формулировка; фактический GAP — **прямой command** + **payment-шаг** + **attribution**. Искусственную замену Request-цепочкой уже внедрил репозиторий (f68a1a5) — диагностика фиксирует это как существующее состояние и как предмет authority-конфликта (§11/Q12), а не одобряет/не отменяет самостоятельно.

---

## 7. Payment Architecture

**Модель (`schema.prisma:4096-4190`):**
- `enum PaymentStatus`: `PENDING | AUTHORIZED | CAPTURED | FAILED | CANCELLED | REFUNDED`.
- `model Payment` (`:4111`): `code PAY-*`, `referenceNumber`, `orderId` (ref, no FK — ADR-0001), `amount Decimal(12,2)`, `currency`, `status` (default `PENDING`), **`paymentMethod String?` — свободная строка, НЕ enum** (`:4130`), `providerRef`, milestones `paidAt/failedAt/cancelledAt/authorizedAt/capturedAt`, `isActivePayment` + частичный unique `Payment_one_active_per_order` (`:4166`) — **≤1 активного Payment на Order** (overpayment protection; комментарий :4159 откладывает partial/installments в 2.12F).
- `model PaymentHistory` (`:4176`): `action, from, to, actorId, actorName, comment, createdAt` — аудит без PII.

**Эндпоинты (controller `@Controller("finance")` — `finance.controller.ts:64`):**

| Endpoint | Permission | Назначение |
|---|---|---|
| `POST /api/v1/finance/payments` | `finance.payment.create` | initiation → `PENDING` |
| `POST /api/v1/finance/payments/:code/confirm` | `finance.payment.manage` | `PENDING → CAPTURED` |
| `POST /api/v1/finance/payments/:code/fail` | `finance.payment.manage` | `PENDING → FAILED` |
| `POST /api/v1/finance/payments/:code/cancel` | `finance.payment.manage` | `PENDING → CANCELLED` |
| `GET /api/v1/finance/payments` (+ `/:code`) | `finance.payment.read` | list/detail |

**Проверено live:** `GET /api/v1/payments` → **404** (префикс finance отсутствует — ожидаемо: промпт §8 называет «POST /payments», фактический контракт — `/api/v1/finance/payments`); `GET /api/v1/finance/payments` → 200, `total = 0` (платежей в runtime DB нет).

**Service (`payment.service.ts`):**
- `:91-101` — `reason` обязателен: trim → пустое/whitespace-only → `ValidationDomainError` (**HTTP 422**, `shared/errors.ts:26-31`); пустая строка ещё на DTO-уровне → 400 (`@MinLength(1)`, `finance.validation.ts:490-494`).
- `:115-125` — **amount/currency server-derived из frozen Order snapshot** (`order.amount/order.currency` verbatim, `validateFrozenMoneyFact`); в `CreatePaymentDto` поля amount **нет вообще** → клиент «Order = 1000, Payment = 1» невозможен (§12 выполняется).
- `:148-163` — создание `PENDING` + `PaymentHistory` с `comment = "Платёж инициирован по заказу {code}: {reason}"`.
- `:201` — второй активный Payment → `ConflictError` 409 (`Payment_one_active_per_order`).
- `:258-317` — единственный CAS-переход `PENDING → CAPTURED/FAILED/CANCELLED` (from-guard + version); capture пишет `PaymentHistory.action = "captured"`, `comment = "Оплата получено (подтверждение Finance)"`, actor, + `security.audit` + outbox-событие `PaymentCaptured`.

**DTO (`finance.validation.ts:474-498`):** `orderId!`, `paymentMethod?` (≤64, «manual/provider-neutral descriptive label», не authority), `reason!` (1-255, «mandatory reason for manual/offline payment initiation»), `initialNote?` (≤5000). `@Idempotent("payment.create")`, `assertNoForbiddenKeys`.

---

## 8. Manual Payment Diagnosis

По чек-листу §10:

| Слой | Есть? | Evidence |
|---|---|---|
| Domain (агрегат, статусы, transition PENDING→CAPTURED) | ✅ | `schema.prisma:4096-4172`, `payment.service.ts:241-317` |
| API (create/confirm/fail/cancel) | ✅ | `finance.controller.ts:255-348` → `/api/v1/finance/payments…` (live 200) |
| RBAC | ✅ | `finance.payment.create` / `finance.payment.manage` / `finance.payment.read` (`permissions.constants.ts:391-394`); ADMIN=ALL; FINANCE=create/manage; DIRECTOR/ANALYST/SALES_MANAGER=read-only; OPERATOR — без payment-прав |
| Projection (Order.paymentStatus) | ✅ | `order.subscribers.ts:41, 225+` (`PaymentCaptured → PAID`), `financial-history` на Order Detail |
| PaymentHistory | ✅ | `schema.prisma:4176` + запись при create/capture |
| **UI action** | ❌ | **нет** `api.post` к payments нигде во frontend; `/app/payments`, `/app/payments/[code]` — только чтение; `/app/finance/payments` — redirect; Order Detail (`frontend/app/app/orders/[id]/page.tsx`) — только read-only financial history; в i18n отсутствуют «Принять оплату»/«Зарегистрировать оплату»; `computeAvailableOrderActions` (`order.service.ts:173+`) не содержит payment-действий |

**→ Missing layer = Frontend.** Backend-часть (Domain/API/RBAC/Projection) живая и проверяемая; кнопка и форма регистрации платежа отсутствуют как класс. «Не считать это автоматически frontend-only problem» — да: проверено, что backend существует, но обнаружен **дополнительный** backend-дефект §4 (проекция/гейт) и **attribution**-дефект §6, поэтому чисто «frontend-only» версия неверна в части полного ручного flow: в UI нет ещё и payment-шага в `ManualCreateForm`.

---

## 9. Order → Payment

- **Связь:** `Payment.orderId` → `order.Order.id` (без FK, ADR-0001); `Order.paymentStatus` (`OrderPaymentStatus = UNPAID | PARTIALLY_PAID | PAID | REFUNDED`) — **Order-owned projection**, обновляется только через consumer: `order.subscribers.ts:41` подписка на `DomainEvents.PaymentCaptured` → `onPaymentCaptured` (`:225+`, inbox-идемпотентность `ORDER_PAYMENT_CONSUMER_ID`, отсутствие Order → пометить processed, не ретраить вечно). Finance **не пишет** `order.*` напрямую (комментарий `:42-43`).
- **Деньги frozen:** payment amount = `Order.amount` snapshot; пересчёта из mutable-источников нет.
- **Кардинальность:** ≤1 активный Payment на Order (`isActivePayment` + partial unique); FAILED/CANCELLED → повторная инициация легальна; REFUNDED/CAPTURED — блок (overpayment protection).
- **Partial/multiple/remaining balance/overpayment:** **не поддерживаются** — один Payment = полная сумма Order; аддитивные installments отложены в Phase 2.12F (документированный комментарий `schema.prisma:4159-4161`). Новых правил не вводится — фактический state зафиксирован как есть (§12).

---

## 10. Payment → Booking

- **Does payment create Booking?** — **Нет.** Booking создаётся единственным creator — `booking.subscribers.ts` (consumer `BookingRequested`, публикуется экшеном Order `send`); `POST /bookings` не существует. Кардинальность 1 OrderItem → 1 Booking.
- **Does payment block Booking?** — **Нет.** D3-гейт для `confirm`/`send` — только `finalConfirmedAt` (`order.service.ts:189-190, 1474-1478`). Payment влияет исключительно на `Order.paymentStatus` (§9). Единственная payment-зависимость в booking-ветке — **voucher consumer требует `Order.paymentStatus == PAID`** (`voucher.consumer.ts`), т.е. документ идёт после `PaymentCaptured`.
- **Does payment merely change payment status?** — **Да**: `Payment.status` + milestone + `PaymentHistory` + проекция `Order.paymentStatus`; `OrderStatus`/`BookingStatus` не мутируются.
- **Фактический lifecycle-порядок** (по коду): `Order (finalConfirmedAt) → send → BookingRequested → Booking` параллельно `Order → Payment(PENDING) → confirm → CAPTURED → Order.paymentStatus=PAID → voucher`. То есть Payment **не входит** в обязательную цепочочку создания брони — это отдельная, но связанная через voucher ось.

---

## 11. Authority / RBAC Reconciliation

| Ресурс | Создание | Lifecycle | Чтение | Субъекты |
|---|---|---|---|---|
| Payment | `finance.payment.create` | `finance.payment.manage` (confirm/fail/cancel) | `finance.payment.read` | ADMIN=ALL; FINANCE=create/manage; DIRECTOR/ANALYST/SALES_MANAGER=read-only; OPERATOR=нет |
| Request (все действия, включая convert/confirm-price/customer-accept) | `order.edit_noncritical` | то же | `order.request.read` (детали) | ADMIN/SALES/OPERATOR (по `ROLE_PERMISSIONS`) |
| Order actions | `ACTION_PERMISSIONS`: process=`order.accept`, send=`order.request_booking`, confirm/complete/waiting=`order.edit_noncritical`, close/cancel/suspend=соответствующие (`order.service.ts:149-160`) | | `order.read` | ADMIN/финансы/SALES по роли |
| Customer | `crm.customer.write` (`crm.controller.ts:176-177`) | `crm.customer.write` | `crm.customer.read` | ADMIN/CRM/SALES |

- Имена `finance.payment.create ≠ finance.payment.manage` **фактически совпадают** с target-концепцией §11 (initiation ≠ lifecycle management) — не «введены предположительно», а найдены в `permissions.constants.ts`.
- **Диагноз §11:** разделение инициации и управления уже реализовано на API/RBAC; пробела «permission missing» нет (проверено live: GET работает под ADMIN, list/create определены).

---

## 12. UI/API/Domain Gap Matrix (§21)

| Layer | Exists? | Working? | Evidence | Gap |
|---|:---:|:---:|---|---|
| Customer resolution | ✅ | ✅ | `crm.controller.ts:176` `POST /crm/customers` (`crm.customer.write`); `Customer ≠ User` (отдельные сущности; `CUS-*` в DB: 6) | нет (форма допускает пустого клиента — LOW) |
| Manual Sale entry | ✅ | частично | `ManualCreateForm.tsx` (f68a1a5), `/app/{orders,requests,bookings}/new` | mode `request` без цены → воспроизводит broken state; **payment-шага нет** |
| Request commercial acceptance | ✅ | ⚠️ | `request.service.ts:626-691` (`customerAccept`, D3 freeze) | **нет money-гейта** → фиксирует `confirmedPrice = null` |
| Request → Order | ✅ | ⚠️ | `order.service.ts:605-705` | execution-гейт работает; **проекция `convert` без money-гейта** (`request.service.ts:40-86`) → кнопка ведёт в 422 |
| Manual Order creation | ❌ | — | нет `POST /orders`; bootstrap удалён (2.6); `/api/admin/orders` только в `legacy/` (§18 GAP) | прямой command отсутствует (предмет Q12) |
| Order commercial amount | ✅ | ✅ | frozen `Order.amount/currency`; snapshot Request (`order.service.ts:661+`), mutable Product не читается | нет |
| Payment creation API | ✅ | ✅ | `POST /api/v1/finance/payments` (live 200 на list; e2e `d4-representative-chain.e2e-spec.ts:284`) | prefix отличается от `/payments` из промпта (косметика) |
| Payment manual UI | ❌ | ❌ | нет POST-вызовов payments во frontend; нет i18n «Принять/Зарегистрировать оплату»; Order Detail — read-only history | **missing layer: Frontend** (главный GAP §10) |
| Payment permission | ✅ | ✅ | `finance.payment.create/manage/read` (`permissions.constants.ts:391-394`) | нет |
| Payment reason | ✅ | ✅ | DTO `reason!` (`finance.validation.ts:490-494`) + service trim/422 (`payment.service.ts:99-101`) + `PaymentHistory.comment` с actor/timestamp/paymentId/orderId (`:163`) | нет |
| Payment amount authority | ✅ | ✅ | server-derived из frozen Order (`payment.service.ts:115-125`), поля amount в DTO нет; ≤1 активный Payment | partial/installments — deferred 2.12F (документировано) |
| Payment confirmation | ✅ | ✅ | CAS `PENDING→CAPTURED` (`payment.service.ts:258-317`), comment «Оплата получено (подтверждение Finance)», outbox `PaymentCaptured` | **нет UI confirm** (там же, где нет create UI) |
| Order → Booking | ✅ | ✅ | `send` → `BookingRequested` → `booking.subscribers.ts`; D3 `finalConfirmedAt` гейт | нет |
| Payment → Booking relation | ✅ | ✅ | payment **не блокирует** и не создаёт бронь; voucher требует `PAID` (`voucher.consumer.ts`) | нет (связь только через voucher — осознанный контракт) |

---

## 13. Root Causes (§22 классификация)

```text
A. Current Request conversion error      → HIGH   (двойной дефект: нет money-гейта в
                                                   customerAccept + нет money-гейта в проекции convert;
                                                   первопричина — supplier-ветка confirm-price без цены)
B. Missing manual payment UX            → HIGH   (Domain/API/RBAC/Projection существуют;
                                                   отсутствует ровно Frontend-слой + payment-шаг в ManualCreateForm)
C. Missing manual payment backend       → НЕ ЯВЛЯЕТСЯ ПРОБЛЕЙ — backend существует полностью (§7-§11)
D. Missing manual Order flow            → HIGH   (прямой Platform Manual/Direct Order command отсутствует;
                                                   частичная замена через Request-цепочку уже внедрена f68a1a5)
E. Authority conflict                   → OWNER DECISION (см. Q12 — точные источники обоих сторон)
F. Documentation-only gap               → LOW/FOLLOW-UP (roadmap/governance не отражают существующую
                                                   staff-цепочку f68a1a5; chapter-7 описывает legacy API)
```

Прочее: runtime-данные показывают, что обе поломки уже произошли на живом контуре (1 заявка без цены, 0 заказов/платежей) — PRE-EXISTING, не регрессия конкретного коммита.

---

## 14. Critical/High/Medium/Low Findings

| # | Уровень | Находка | Evidence |
|---|---|---|---|
| F1 | **HIGH** | UI/server-authority mismatch: `availableActions.convert = true` при отсутствии денег, execution → 422. Проверено live. | `request.service.ts:40-86` vs `order.service.ts:661`; `RequestActionBar.tsx:75` |
| F2 | **HIGH** | Полное отсутствие manual payment UX (нет create/confirm UI нигде) при живом backend | поиск `api.post` payments = 0; i18n-ключи отсутствуют; `orders/[id]/page.tsx` read-only |
| F3 | **HIGH** | Authority-конфликт §4/Q12 не закрыт (stop-condition #4 «unresolved» живёт рядом с «DOES NOT EXIST») | `PHASE_2_STEP_2.6…PROMPT.md:464` vs `TravelHub_CANONICAL_ROADMAP_V3.md:2540` (+ 3.6C.1:47,922) |
| F4 | **MEDIUM** | `customerAccept` морозит `confirmedPrice = null` (нет D3 money-гейта) → «принятые условия без условий» | `request.service.ts:673` |
| F5 | **MEDIUM** | Attribution misattribution: `acquisitionSource: "MARKETPLACE"` хардкод для всех конверсий, включая staff-created (канон — MANUAL/DIRECT/BUYER_REQUEST) | `order.service.ts:702`; `acquisition-source-propagation.md:52` |
| F6 | **MEDIUM** | `ManualCreateForm` mode `request` не требует цену → воспроизводимое состояние 801c9f13; форма без payment-шага | `ManualCreateForm.tsx` (`needsMoney = mode !== "request"`) |
| F7 | **LOW** | `paymentMethod` — свободная строка; фактические значения репозитория (`CARD/BANK_TRANSFER/MOBILE_PAYMENT` seed, `MANUAL` e2e) не совпадают с canonical-таксономией §9 (есть только `BANK_TRANSFER`; `CASH/BANK_CARD/POS_TERMINAL/ONLINE` не встречаются) | `demo-seed.ts:858`; `d4…e2e-spec.ts:284`; `schema.prisma:4130` |
| F8 | **LOW** | Prefix mismatch: промпт/ожидание `POST /payments` vs факт `/api/v1/finance/payments` (404 на `/payments`) | `finance.controller.ts:64` (live проверено) |
| F9 | **PRE-EXISTING** | Legacy `/api/admin/orders` + `CreateOrderModal` существуют только в `legacy/`; docs (chapter-7) продолжают описывать legacy API как актуальный | `legacy/src/components/admin/SalesExecution.tsx:4484`; `chapter-7:468` |
| F10 | **FOLLOW-UP** | Partial/multiple payments не реализованы — документировано как отложенное в 2.12F; не вводить сейчас | `schema.prisma:4159-4161` |
| F11 | **FOLLOW-UP** | Guest-checkout намеренно создаёт Request без цены — корректно по замыслу, но в связке с F4/F1 даёт сквозной null-путь до 422 | `guest-checkout.service.ts:105-116` |

---

## 15. Canonical Recommended Flow

**Один рекомендуемый путь (без второй commerce-engine, все существующие агрегаты сохраняются):**

```text
Employee
 → resolve/create Customer            (существующий POST /crm/customers, crm.customer.write)
 → ManualCreateForm (существующая цепочка f68a1a5)
     → POST /requests (с обязательной ценой для order/booking — уже так)
     → propose-price / confirm-price  (единственные легальные price sources)
     → customer-accept  + НОВЫЙ money-гейт (confirmedPrice ?? displayedPrice не null)
     → convert        + СИНХРОНИЗИРОВАННЫЙ money-гейт в проекции availableActions
     → Order (canonical, attribution: источник унаследован от заявки/актора — см. §16 item 4)
 → Order Detail → «Зарегистрировать оплату» (НОВОЕ UI)
     → POST /api/v1/finance/payments   { orderId, paymentMethod, reason }   → PENDING
     → «Подтвердить получение»          POST …/confirm                       → CAPTURED
     → PaymentCaptured → Order.paymentStatus = PAID (существующий consumer)
 → send → Booking (существующий consumer; voucher требует PAID)
```

Сохраняются без изменений: Order aggregate, Payment aggregate (≤1 активный, frozen amount), Booking lifecycle (D3 `finalConfirmedAt`), Request lifecycle (D3 acceptance), Customer resolver, RBAC (`finance.payment.*`, `order.*`), audit/history (`PaymentHistory`, `RequestHistory`, `security.audit`).

Рекомендация **не выбирает** вопрос Q12 — она работает внутри контракта «прямой command отсутствует» и потому требует ратификации owner (см. §18): если owner утвердит прямой Manual/Direct command, пункты 4–5 §16 заменяются на его контракт, остальная часть scope не меняется.

---

## 16. Implementation Scope

1. **Money-gate parity (Backend, HIGH):** `request.service.ts` — `computeRequestAvailableActions.convert` добавить условие `(confirmedPrice ?? displayedPrice) != null && (confirmedCurrency ?? displayedCurrency) != null`; `customerAccept` — отказывать в `CUSTOMER_ACCEPTED` при null-money (ранний 422 с внятным текстом вместо отложенной ошибки конверсии). Execution-гейт `order.service.ts:661` остаётся как defence-in-depth.
2. **Manual payment UI (Frontend, HIGH):** Order Detail → действие «Зарегистрировать оплату» (диалог: method-селект + обязательный reason ≤255) → `POST /api/v1/finance/payments`; затем «Подтвердить получение» → `…/confirm` (+ fail/cancel). Видимость по `finance.payment.create` / `finance.payment.manage`; i18n-ключи; показ `PaymentHistory` в financial history (уже есть read).
3. **Payment-шаг в ManualCreateForm (Frontend, MEDIUM):** после успешной конверсии — опциональный шаг регистрации платежа (та же форма), либо ссылка на созданный Order Detail с предложенным действием.
4. **Attribution (Backend, MEDIUM — зависит от решения Q12):** убрать хардкод `acquisitionSource: "MARKETPLACE"` (`order.service.ts:702`) — источник должен определяться каналом заявки/актора через существующий enum (`DIRECT` для staff-created / `BUYER_REQUEST` для request-led), без новых сущностей и без изменения enum.
5. **Документация (F):** закрыть/актуализировать stop-condition #4 (2.6), roadmap v3 «Platform Create Order → DOES NOT EXIST» и `acquisition-source-propagation.md` так, чтобы отражать утверждённый owner’ом ручной путь (после решения Q12).

**Вне scope:** новые статусы Payment, partial/installments (2.12F), ONLINE/provider-провайдер, изменение enum методов (§9 запрещает автоматический rename), любые schema/migration-изменения (не требуются — всё покрыто существующей моделью).

---

## 17. Tests Required

1. **Backend e2e — conversion parity:** Request без денег → `GET /:id` показывает `availableActions.convert = false`; `POST /:id/convert` → 422. С `supplierPriceProposal` (после propose-price) → convert → 201 и `Order.acquisitionSource` соответствует каналу (не `MARKETPLACE` для staff-заявки).
2. **Backend e2e — customerAccept gate:** `confirm-price` без цены → `customer-accept` → 422 «нет коммерческих условий» (не «принято» с null).
3. **Payment API e2e (по образцу `d4-representative-chain.e2e-spec.ts:284`):** create без `reason` → 400; `reason = "   "` → 422; method `CASH`/`BANK_TRANSFER`/`BANK_CARD`/`POS_TERMINAL` → 201 PENDING; повторный active → 409; confirm → CAPTURED + `PaymentHistory` comment/actor; `GET /finance/payments` отражает запись; `Order.paymentStatus` после `PaymentCaptured` = `PAID`.
4. **RBAC:** SALES_MANAGER/DIRECTOR/OPERATOR → 403 на create/confirm; FINANCE/ADMIN → 2xx.
5. **Frontend vitest:** Order Detail показывает «Зарегистрировать оплату» только при `finance.payment.create`; диалог требует reason; request page не показывает «Создать заказ» при `convert: false` (компонент по данным проекции).
6. **Regression:** существующая `RequestActionBar`/request-flow тесты (продвинутые действия) — на неизменность прочих availableActions.

---

## 18. Final Verdict

### Ответы Q1–Q12

**Q1. Почему Request `801c9f13…` не конвертируется?**
У неё нет принятой цены: `displayedPrice = null`, `confirmedPrice = null`, `supplierPriceProposal = null`. Гейт `order.service.ts:661` (`confirmedPrice ?? displayedPrice`) бросает ровно эту 422. Происхождение null: guest-checkout создаёт Request без цены (по замыслу), а admin прошёл `confirm-price` (не принимает цену) вместо `propose-price`, после чего `customerAccept` заморозил `confirmedPrice = null` без проверки.

**Q2. Есть ли accepted price/currency?**
Accepted **price — нет** (оба поля null). Accepted **currency — да** (`confirmedCurrency = "AZN"`, `displayedCurrency = "AZN"`). Accepted snapshot частичный: есть acceptance-инстанс, traveler count (1), pinned requirements, product snapshot — нет денежной части.

**Q3. Почему UI показывает «Создать заказ»?**
Проекция `computeRequestAvailableActions` (`request.service.ts:40-86`) объявляет `convert` по статусу/правам и **не проверяет деньги**, в то execution-гейт их требует. Live-проверка: `GET /api/v1/requests/801c9f13…` → `availableActions.convert = true` при null-ценах. Кнопка: `RequestActionBar.tsx:75`, label `reqflow.convert_action` (`i18n.tsx:2374`). Отдельный UI/server-authority defect — да.

**Q4. Существует ли сейчас рабочий Manual Payment flow?**
Только на уровне API: `POST /api/v1/finance/payments` (+ confirm) с RBAC и domain-машиной работает. **В интерфейсе — нет** (нет ни одной кнопки/формы). Полноценный рабочий flow для сотрудника не существует до реализации Frontend-слоя.

**Q5. Где кнопка/command «Зарегистрировать оплату»?**
Кнопки/UI-команды **не существует нигде** (в т.ч. в `ManualCreateForm`). Server-команда: `POST /api/v1/finance/payments` (permission `finance.payment.create`), подтверждение — `POST /api/v1/finance/payments/:code/confirm` (`finance.payment.manage`).

**Q6. Order → register CASH payment сегодня?**
API — **да** (метод свободная строка ≤64, enum нет; `reason` обязателен → PENDING → confirm → CAPTURED). UI — **нет**. Значения `CASH` в репозитории не встречаются — оно было бы принято как descriptive label, но канонического значения/валидации нет.

**Q7. BANK_TRANSFER?** — То же самое: API **да**, UI **нет**; `BANK_TRANSFER` — единственное значение из canonical-списка, реально встречающееся в репозитории (`demo-seed.ts:858`).

**Q8. BANK_CARD?** — API **да**, UI **нет**; значения `BANK_CARD` в репозитории нет (seed использует `CARD`, e2e — `MANUAL`; enum не проверяет).

**Q9. POS_TERMINAL?** — API **да**, UI **нет**; значения `POS_TERMINAL` в репозитории нет. Для всех Q6–Q9 действует общий блокер: **UI отсутствует**, и paymentMethod нигде не валидируется против канон-таксономии (§9: не переименовывать — фактический state: свободная строка).

**Q10. Manual Sale → Order → Payment → Booking сегодня?**
**НЕТ.** Две первые блокирующие точки:
1. Для `801c9f13`: `Request → Order` — 422 (нет денег; см. Q1).
2. Для корректно оценённой заявки: `Order → Payment` — endpoint существует, но **UI отсутствует** (зарегистрировать можно только raw API-вызовом); `Payment → Booking` — не блокируется, но voucher требует CAPTURED/PAID. Также `0 Orders` в runtime DB — сквозной прогон сейчас невозможен.

**Q11. Есть ли отдельный canonical Manual Order command?**
**Нет.** `POST /orders` не зарегистрирован; bootstrap удалён в Phase 2.6; `/api/admin/orders` существует только в `legacy/`. Ручной вход реализован исключительно цепочкой Request → Order (`ManualCreateForm`, f68a1a5) с attribution-дефектом (MARKETPLACE-хардкод, `order.service.ts:702`).

**Q12. Есть ли конфликт между «Platform cannot create normal commercial Orders» и «Manual/Direct sales require Employee → Create Order»?**
**Да, конфликт есть — точные источники:**

*Сторона «Platform не создаёт заказы» (утверждённая governance, Aug 2026):*
- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_V3.md:2540` — «Platform Create Order → **DOES NOT EXIST**» (Platform — Partner authority boundary);
- `PHASE_3_CANONICAL_ROADMAP_SYNC_AFTER_3.6A_TO_3.6C.1.md:294` — «Platform **cannot create normal commercial Orders**»;
- `PHASE_3_STEP_3.6C.1_FINAL_REMEDIATION_EVIDENCE_CLOSURE.md:47, 922` — «Platform Create Order → **ABSENT / remains absent**»;
- `PHASE_3_STEP_3.6C.1…REMEDIATION.md:62, 1245` — то же.

*Сторона «Manual/Direct требует прямого создания» (зарегистрированное, НЕ закрытое требование):*
- `PHASE_2_STEP_2.6_REMOVE_BOOTSTRAP_ORDER_CREATION_IMPLEMENTATION_PROMPT.md:464` (stop-condition #4) — «**MANUAL/DIRECT canonically requires direct Order creation and this is unresolved**»; `…_STRICT_REVIEW.md:788` — то же;
- `docs/architecture/acquisition-source-propagation.md:52` — «staff-создание заказа = **MANUAL/DIRECT** канал» (канонический attribution-контракт, несовместимый с фактическим MARKETPLACE-хардкодом);
- `docs/chapter-7-order-center.md:468` — `POST /api/admin/orders` (описывает ручное создание заказа; фактически — legacy);
- операционная реальность: staff-форма `ManualCreateForm` (f68a1a5) порождает заказы сотрудников, но **только через Request и с неверным каналом**.

Ни один документ после 2.6 не закрыл stop-condition #4; roadmap-сторона фиксирует отсутствие прямого command **by design**, требование-сторона — что он **нужен** для Manual/Direct. Решение не может быть выбрано диагностикой самостоятельно (§4) — поэтому owner must decide: (а) ратифицировать существующую Request→Order-цепочку как канонический ручной путь (закрыть stop-4, поправить attribution на DIRECT/BUYER_REQUEST), либо (б) утвердить отдельный Platform Manual/Direct Order command поверх существующего enum `SalesAcquisitionSource` (что потребует снятия формулировки «DOES NOT EXIST» из roadmap/governance).

### FINAL VERDICT

```text
ARCHITECTURE CONFLICT — OWNER DECISION REQUIRED
```

Диагностика завершена (все пункты §1–§23 закрыты доказательствами, включая live read-only проверку). Конфликт ограничен вопросом Q12/attribution (§16 items 4–5); исправления §16 items 1–3 (money-gate parity, manual payment UI, payment-шаг формы) не зависят от него и могут быть одобрены к реализации отдельно.

**STOP.** Не исправлять. Не создавать Order/Payment. Не миграции. Не commit. Не push. Ждать owner approval на implementation.
