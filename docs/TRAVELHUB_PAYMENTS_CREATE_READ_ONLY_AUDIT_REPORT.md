# PAYMENT CREATE READ-ONLY AUDIT

**Audit date:** 2026-10-08
**Scope:** раздел «Платежи» TravelHUB — сценарии создания платежа из Payments / Order / Booking
**Method:** READ-ONLY (код/schema/БД/UI/API/тесты не изменялись; платежи не создавались; commit/push не выполнялись)
**Source prompt:** `docs/prompts/TRAVELHUB_PAYMENTS_CREATE_READ_ONLY_AUDIT_PROMPT.md`

---

## 1. Verdict

**Backend для сценария «Payments → Создать платеж → Order» ПОЛНОСТЬЮ реализован** (`POST /api/v1/finance/payments` + RBAC + amount freeze + idempotency + history/audit/events + confirm/fail/cancel).

**Кнопки «Создать платеж» нет НИГДЕ во фронтенде** — ни в Payments registry, ни в Order detail, ни в Booking detail. Поиск по всему `frontend/` (`.ts/.tsx`) не находит ни `Создать платеж`, ни единого POST/мутации на `/finance/payments` (только GET + export). Фронтенд вообще не имеет API-клиента для создания платежа.

**Привязка Payment напрямую к Booking невозможна по текущей schema** — поля `bookingId` у `Payment` нет. Booking уже связан с деньгами через обязательный `Booking.orderId` → `Order` → `Payment` (read-side цепочка уже реализована в `booking-query.service.ts:79-135`).

Итоговые статусы сценариев — в §20.

---

## 2. Current Payment Model

`backend/prisma/schema.prisma:4158` — `model Payment` (schema `finance`):

| Поле | Тип | Null | Default | Примечание |
|---|---|---|---|---|
| `id` | String | no | uuid | PK |
| `code` | String | no | — | unique, `PAY-00000001` |
| `referenceNumber` | String | no | — | unique, tenant-scoped (MKT-PAY-*/SF-PAY-*) |
| `commerceSequence` | String? | yes | — | derived from parent Order |
| `paymentOrdinal` | Int? | yes | — | ordinal в commerce chain |
| **`orderId`** | **String** | **no** | — | ref `order.Order`, **без FK (ADR-0001)** |
| `customerId` | String? | yes | — | ref `crm.Customer`, без FK; NULL = internal assisted flow |
| `partnerId` | String? | yes | — | ref `crm.Partner`, без FK; NULL = платформенный платёж |
| **`amount`** | **Decimal(12,2)** | **no** | — | frozen Order snapshot |
| `currency` | String | no | `"USD"` | frozen Order snapshot |
| `status` | `PaymentStatus` | no | `PENDING` | enum §5 |
| `paymentMethod` | String? | yes | — | свободная строка ≤64 (валидация в сервисе) |
| `providerRef` | String? | yes | — | внешняя ссылка, НЕ authority |
| `version` | Int | no | `1` | optimistic lock (CAS) |
| `createdAt` / `updatedAt` | DateTime | no | now / @updatedAt | |
| `paidAt` / `failedAt` / `cancelledAt` | DateTime? | yes | — | milestones, immutable после установки |
| **`isActivePayment`** | **Boolean** | **no** | `true` | managed projection: `status NOT IN (FAILED, CANCELLED)` |
| `history` | PaymentHistory[] | — | — | relation 1:N, `onDelete: Cascade` |

**Полей, которых НЕТ** (не выдумывать): **`bookingId` — отсутствует**; `type` — отсутствует; `reason` — отсутствует как колонка (живёт в `PaymentHistory.comment`); `refundedAmount` на Payment — отсутствует (refund — отдельный aggregate `Refund`).

**Частичный unique-индекс** `schema.prisma:4213`:
`@@unique([orderId], where: { isActivePayment: true }, map: "Payment_one_active_per_order")`
→ **на Order ≤1 активный Payment** (overpayment protection). FAILED/CANCELLED сбрасывают `isActivePayment=false` → повторная инициация (attempt 2) легальна. Комментарий в schema:2196-4208 фиксирует, что 2.12F (partial/installments) переработает этот индекс в будущей аддитивной миграции.

### Связи (фактические, без предположений)

```
Payment → Order     required (orderId NOT NULL), one-to-many (многие платежи на Order),
                    FK НЕТ (ADR-0001, logical reference, нет cascade/restrict),
                    ограничение «≤1 активный» — только частичным unique-индексом.
                    Payment БЕЗ Order существовать НЕ МОЖЕТ.

Payment → Booking   СВЯЗИ НЕ СУЩЕСТВУЕТ (нет bookingId, нет relation).
                    Payment БЕЗ Booking существует всегда; Booking без Payment — тоже.

Order → Payment     обратной explicit relation в schema нет (нет поля/массива),
                    фактически 1:N через Payment.orderId.

Booking → Payment   обратной связи нет; доступ через Booking.orderId → Order → Payment
                    (реализовано read-side: booking-query.service.ts:116-135).
```

Ответы на вопросы §1 промпта:
- может ли Order иметь несколько платежей — **да** (исторически: FAILED/CANCELLED + новый активный; инвариант — только один активный);
- может ли Booking иметь несколько платежей — **прямых платежей у Booking нет вообще** (см. §6);
- Payment существует без Booking — **да всегда**.

---

## 3. Payment → Order

**Требование:** привязка обязательная. `Payment.orderId` NOT NULL (`schema.prisma:4169`).

Создание (`payment.service.ts:91-195`):
1. `orderId` обязателен, trim → иначе `ValidationDomainError`;
2. Order читается (`findUnique`), отсутствует → 404;
3. `order.status ∈ ORDER_NOT_PAYABLE ["CANCELLED","CLOSED"]` → 422 `"... payment cannot be initiated"` (`payment.service.ts:70,111-113`);
4. `validateFrozenMoneyFact(order.amount, order.currency, ...)` — платформенный контракт `sales.money` (`:117`);
5. в транзакции: idempotency (активный Payment существует → no-op возврат существующего `:132-135`), `nextCode("PAY")`, commerce reference, `payment.create` копией `order.amount`/`order.currency` **verbatim** (`:148-149`);
6. параллельный дубль → P2002 → controlled 409.

Соответствие в тестах: `test/payment-flow.e2e-spec.ts` T1 (frozen verbatim), T2 (смена цены Order после freeze не repric-ит Payment), T6 (identical retry no-op), T7 (concurrent duplicate → один факт + 409).

---

## 4. Payment → Booking

**Связи нет.** `Payment.bookingId` отсутствует (`schema.prisma:4158-4219`), эндпоинт принимает только `orderId` (§6).

Что есть у Booking:
- `Booking.orderId String` — **required** (`schema.prisma`, model Booking ~:2556);
- `Booking.amount Decimal` (default 0) и `Booking.currency String?` — собственные поля, НЕ источник payment amount;
- Booking **не имеет** `paymentStatus` и **не имеет** relation к Payment.

Read-side цепочка УЖЕ работает (`backend/src/modules/booking/booking-query.service.ts:72-135`):
```
Booking.orderId → Order { amount, paidAmount, refundedAmount, paymentStatus }
                → financialSummary { totalAmount, paidAmount, dueAmount, refundableAmount, paymentStatus }
                → activePayment = Payment.findFirst({ orderId, isActivePayment: true })
```
То есть Booking уже «видит» свой платёж — через Order.

**Ответ на ключевой вопрос §6 (только по коду/schema):**

```text
Payment → Booking НЕ НУЖЕН. Достаточно Payment → Order при наличии Booking → Order,
поскольку Booking.orderId обязателен и цепочка Booking→Order→Payment уже
реализована (booking-query.service.ts:79-135). Прямое поле bookingId добавляло бы
двусмысленность двух источников истины для одних и тех же денег.
```

---

## 5. Payment Statuses

Enum `PaymentStatus` (`schema.prisma:4143`, `@@schema("finance")`):

```
PENDING · AUTHORIZED · CAPTURED · FAILED · CANCELLED · REFUNDED
```

Канонический порядок для registry-агрегатов: `payments-registry.ts:40-47`.

### Реализованные переходы (`payment.service.ts`)

| Переход | Endpoint | Метод сервиса | Milestone | History action | Audit action | Domain event |
|---|---|---|---|---|---|---|
| (create) → `PENDING` | `POST /payments` | `createPayment:91` | — | `created` | `finance.payment.created` | `PaymentCreated` |
| `PENDING` → `CAPTURED` | `POST /payments/:code/confirm` | `confirmPayment:243` | `paidAt` | `captured` | `finance.payment.captured` | `PaymentCaptured` |
| `PENDING` → `FAILED` | `POST /payments/:code/fail` | `failPayment:248` | `failedAt` | `failed` | `finance.payment.failed` | `PaymentFailed` |
| `PENDING` → `CANCELLED` | `POST /payments/:code/cancel` | `cancelPayment:253` | `cancelledAt` | `cancelled` | `finance.payment.cancelled` | `PaymentCancelled` |

**Guards/state machine** (`payment.service.ts:265-338`, общий `transition()`):
- не `PENDING`-источник → controlled **409** (`cannot transition from X to Y`);
- повтор того же статуса → **409** (`already ...`);
- CAS: `updateMany where { id, status: PENDING, version }` → ровно 1 победитель, иначе 409 «modified concurrently»;
- `isActivePayment` обновляется атомарно: `false` для FAILED/CANCELLED (attempt 2), `true` для CAPTURED (overpayment protection);
- история + audit + outbox-событие — **в одной транзакции** с переходом, затем `publishPending()`.

**Кто меняет статус:** только `PaymentService` (единственный writer; комментарий schema:4201-4202). Вызывают только 3 эндпоинта confirm/fail/cancel, все под `finance.payment.manage`.

**Не достижимые/резервные значения:**
- `AUTHORIZED` — нет ни одного перехода/эндпоинта (PSP authorize/capture отложены в 2.12B);
- `REFUNDED` — **зарезервирован и недостижим по design**: `refund.service.ts:32-33` — «Payment НЕ мутируется (остаётся CAPTURED; REFUNDED reserved unreachable — partial refund делает одиночный Payment.REFUNDED семантически неверным)».

---

## 6. Payment API

Контроллер: `backend/src/modules/finance/finance.controller.ts`, базовый путь `/api/v1/finance`.

| Method | URL | DTO | RBAC | Service | Ответ |
|---|---|---|---|---|---|
| GET | `/payments` (`:255`) | `PaymentListQueryDto` | `finance.payment.read` | `paymentService.list:350` | `{ items, total, page, pageSize, hasMore, aggregates }` |
| GET | `/payments/export` (`:261`) | query (те же фильтры) | `finance.payment.read` | list → CSV | файл |
| GET | `/payments/:code` (`:313`) | path `code` | `finance.payment.read` | `getByCode` | Payment DTO; неизвестный → 404 |
| **POST** | **`/payments`** (`:319`) | **`CreatePaymentDto`** | **`finance.payment.create`** | `createPayment:91` | **201** Payment DTO |
| POST | `/payments/:code/confirm` (`:333`) | — | `finance.payment.manage` | `confirmPayment:243` | 201 |
| POST | `/payments/:code/fail` (`:339`) | — | `finance.payment.manage` | `failPayment:248` | 201 |
| POST | `/payments/:code/cancel` (`:345`) | — | `finance.payment.manage` | `cancelPayment:253` | 201 |
| **PATCH** | **`/payments/:id`** | — | — | — | **NOT FOUND** (PATCH в finance-контроллере есть только для currencies / exchange-rates / taxes / tax-rules / commission-policies) |

Связанные refund-эндпоинты (отдельный aggregate, не Payment): `GET/POST /refunds`, `POST /refunds/:code/{approve,process,fail}` (`finance.refund.read|write|approve|execute`, `finance.controller.ts:357-395`).

**DTO создания** — `CreatePaymentDto` (`finance.validation.ts:474`):

```
orderId          string  required, 1..64
paymentMethod?   string  ≤64
reason           string  required, 1..255   ← Step 3.6C.1 (mandatory для manual initiation)
initialNote?     string  ≤5000              ← OperationalNote в той же транзакции
```

**Запрещённые ключи** — `PAYMENT_CREATE_FORBIDDEN_KEYS` (`finance.validation.ts:454`): `id, code, status, amount, currency, customerId, partnerId, providerRef, version, createdAt, updatedAt, paidAt, failedAt, cancelledAt, isActivePayment`. Проверка `assertNoForbiddenKeys` в `finance.controller.ts:326` → **любая попытка клиента передать amount/currency/status = 422**.

**Ответ DTO** — `paymentDto` (`payment.service.ts:728-765`): `id, code, referenceNumber, orderId, customerId, partnerId, amount (string), currency, status, paymentMethod, providerRef, version, createdAt, paidAt, failedAt, cancelledAt` — без PII/secrets (подтверждено e2e T12).

**Idempotency:** внешний контракт идемпотентности для `POST /api/v1/finance/payments` — `src/shared/idempotency/idempotency.constants.ts:6`.

### Manual/offline payment flow — СУЩЕСТВУЕТ

`POST /payments` И есть ручной/офлайн-флоу (Step 3.6C.1): серверная валидация `reason` обязательна (`payment.service.ts:98-102` — `reason is required for manual payment initiation`), история фиксирует причину в `comment` (`:163`).

---

## 7. Manual Payment

| Вопрос | Ответ (по коду) |
|---|---|
| Существует ли | **Да** — `POST /api/v1/finance/payments` |
| Endpoint | `finance.controller.ts:319` |
| RBAC | `finance.payment.create` (ADMIN + FINANCE) |
| Как определяется amount | **Только сервером**: `order.amount` verbatim из frozen snapshot Order (`payment.service.ts:148`) |
| Может ли клиент передать amount | **Нет** — `amount` в `PAYMENT_CREATE_FORBIDDEN_KEYS` → 422 |
| Требуется ли reason | **Да**, обязательный (service-level, `:98-102`) |
| Seller/actor attribution | `security.audit { userId, username }` (`:166-173`) + `paymentHistory { actorId, actorName }` (`:156-165`) |
| PaymentHistory | запись `action: "created"`, `to: PENDING`, `comment: "Платёж инициирован по заказу {code}: {reason}"` |
| Защита от неправильной суммы | 4 уровня: (1) forbidden keys 422, (2) `validateFrozenMoneyFact` контракт `sales.money`, (3) копирование с одного источника без пересчёта, (4) `Payment_one_active_per_order` — второй платёж невозможно создать, пока активный не FAILED/CANCELLED |
| Доверяет ли backend client-supplied amount | **НЕТ** — проверено и подтверждено e2e `payment-flow.e2e-spec.ts` T4: «forged server-owned поля на create (amount/currency/status/…) → 422» |

Дополнительно: `paymentMethod` — свободная строка (без enum/allowlist) — см. Owner Decision P6 (§17).

---

## 8. Order Financial Logic

Модель Order (`schema.prisma` ~:2131): `amount` (frozen total), `currency`, `paidAmount`, `refundedAmount`, **`paymentStatus: OrderPaymentStatus @default(UNPAID)`** (`:2143`), `paidAmount` (`:2146`).

Enum `OrderPaymentStatus` (`schema.prisma:2094`): `UNPAID · PARTIALLY_PAID · PAID · REFUNDED`.

### Фактическая цепочка

```
Order.amount (frozen, verbatim copy в Payment при create)
   ↓  POST /payments (createPayment — amount НЕ пересчитывается)
Payment(PENDING, amount = order.amount)
   ↓  POST /payments/:code/confirm → CAS transition → CAPTURED, paidAt
   ↓  outbox: DomainEvents.PaymentCaptured
order.subscribers.ts:225 onPaymentCaptured (inbox-idempotent, CAS по version)
   → Order.paymentStatus = "PAID", Order.paidAmount = payload.amount (:262)
   → guard: paymentStatus === "PAID" уже → no-op (:243); отрицательный/битый amount → throw (:253,:256)
Outstanding = max(0, amount − paidAmount)   ← вычисляется read-side, НЕ колонка
   (booking-query.service.ts:100 dueAmount; order detail financial-history)
REFUNDED: refund.service → событие RefundProcessed → order.subscribers.ts:295-344
   → refundedAmount += …; если refundedAmount ≥ paidAmount → paymentStatus = "REFUNDED" (:337)
```

**Важные находки:**
- **`PARTIALLY_PAID` не имеет runtime-писателя.** Единственные упоминания — demo seed (`src/seed/demo-seed.ts:516,562,612`). Писать его нечему: инвариант «≤1 активный Payment на Order» + захват полной суммы Order → сразу `PAID`. Логики частичных платежей в projection нет.
- Finance **не пишет** `order.*` напрямую — только через Order-owned subscribers (`order.subscribers.ts:39-43`, комментарий: Order-owned projection, Finance пишет только Payment/Refund).
- `Order.availableActions` (`order.service.ts:183-213`) не содержит ни одного payment-действия — payment-кнопок из Order lifecycle не предусмотрено.

---

## 9. Booking Financial Logic

| Вопрос | Ответ |
|---|---|
| Есть ли amount у Booking | **Да** — `Booking.amount Decimal @default(0)`, `currency String?` (но это НЕ источник payment amount) |
| Payment status у Booking | **Нет поля** `paymentStatus` у Booking |
| Financial obligation | Денежная obligation живёт у **Order**; Booking читает её через `booking.orderId` |
| Связь с Order | `Booking.orderId` **required** (без FK, ADR-0001); V1 — 1:1 (`order.service.ts:1203-1206` «exactly linked Booking») |
| Существующее использование Payment | Только read-side: `booking-query.service.ts:116-135` → `activePayment = Payment.findFirst({ orderId: booking.orderId, isActivePayment: true })` |
| Можно ли привязать Payment напрямую к Booking по текущей модели | **НЕТ** — нет `bookingId`, API принимает только `orderId` |

**Ключевой вопрос §6 — ответ:** прямой связи `Payment → Booking` **не нужна**; достаточна `Payment → Order` при наличии `Booking → Order` (обязательный `booking.orderId`), потому что иначе два источника истины про одни деньги. Прямая привязка потребовала бы schema-миграции + изменения API + решения, какой `amount` авторитетен (Order или Booking) — см. §15/§17.

---

## 10. Payment History / Audit

Три независимых слоя, все пишутся **атомарно с мутацией** в одной транзакции:

**1. `PaymentHistory`** (`schema.prisma:4223`) — журнал переходов:
`paymentId (FK, Cascade), action, from, to, actorId, actorName, comment, createdAt`.
- create → `action: "created"`, `to: PENDING`, comment содержит **reason** (`payment.service.ts:156-165`);
- transitions → `captured` / `failed` / `cancelled`, `from: PENDING`, `to: <статус>`, comment для captured: «Оплата получена (подтверждение Finance)» (`:300-310`).
- Без PII/provider-payload dump (комментарий schema:4222).

**2. `security.audit`** (`securityService.audit`):
- `finance.payment.created` — details `{ code, orderId, amount, currency }` (`:166-173`);
- `finance.payment.captured|failed|cancelled` — details `{ code, from: PENDING, to }` (`:311-318`);
- refund → свои audit-действия в `refund.service.ts:169,310-313`.
- actor: `userId` + `username` везде.

**3. Outbox-события** (`eventBus.emit` в той же транзакции, публикация после `commit` через `publishPending()`):
`PaymentCreated / PaymentCaptured / PaymentFailed / PaymentCancelled` c payload `{ paymentId, code, orderId, customerId, amount (string), currency, method }` (`:119-127,174-179,319-332`).

**Refund:** отдельный `RefundHistory` + audit + `RefundProcessed` event (`refund.service.ts:159,169,299,310`); **Payment при refund НЕ мутируется** (остаётся CAPTURED, `refund.service.ts:32-33`).

Что фиксируется по §7 промпта: создание ✔, смена статуса ✔, capture ✔, cancel ✔, refund ✔ (отдельным aggregate). Timestamps — `createdAt` везде + milestone-поля на самом Payment (`paidAt/failedAt/cancelledAt`).

---

## 11. RBAC

Каталог прав: `backend/src/security/permissions.constants.ts:122-130` (и зеркально `security.service.ts:635-636`):

```
finance.payment.read    — Чтение платежей
finance.payment.write   — Управление платежами (legacy-каталог; НЕ используется в @RequirePermissions)
finance.payment.create  — Создание платежа (инициация, Step 2.12H)
finance.payment.manage  — Управление платежом (confirm/fail/cancel)
finance.refund.write / finance.refund.approve / finance.refund.execute
```

Матрица (`ROLE_PERMISSIONS`, `permissions.constants.ts:317+`; ADMIN = `ALL_PERMISSIONS`):

| Роль | read | create | manage (confirm/fail/cancel) | refund.write/approve/execute |
|---|---|---|---|---|
| **ADMIN** | ✔ (ALL) | ✔ | ✔ | ✔ |
| **FINANCE** | ✔ (:405) | ✔ (:407) | ✔ (:408) | ✔ (:410-412) |
| **DIRECTOR** | ✔ (:339, read-only) | ✘ | ✘ | ✘ |
| **ANALYST** | ✔ (:508) | ✘ | ✘ | ✘ |
| **SALES_MANAGER** | ✔ (:600) | ✘ | ✘ | ✘ |
| OPERATOR | ✘ | ✘ | ✘ | ✘ |
| MARKETER / MODERATOR | ✘ | ✘ | ✘ | ✘ |
| PARTNER / BUYER | ✘ (explicitly revoked, :712, :760) | ✘ | ✘ | ✘ |

Фактические `@RequirePermissions` (`finance.controller.ts`): read → `:256,:262,:314`; create → `:320`; manage → `:334,:340,:346`. Контроллер-докстрока `:9` подтверждает: «только FINANCE/ADMIN (DIRECTOR — read-only finance.payment/…)».

**Редактирование платежа:** нет ни endpoint (PATCH NOT FOUND), ни роли — **редактирование не предусмотрено вовсе** (изменение статусов — только 3 управляющих перехода).

Подтверждено e2e: `payment-flow.e2e-spec.ts` T9 — SALES_MANAGER → 403 на create (201 для FINANCE), DIRECTOR → 403 на create, аноним → 401.

---

## 12. Payments UI

**Каноническая страница:** `frontend/app/app/payments/page.tsx` (649 строк).

Что есть:
- KPI-агрегаты + таблица через `OperationsRegistrySlot`/`OperationsToolbarSlot` (`:423,458`);
- поиск (`searchDraft`/`search`), кнопка «Сбросить фильтры» (`:433-440`), `TableExportButton` → `/api/v1/finance/payments/export` (`:442-452`);
- список загружается `GET /finance/payments?…` (`:319`);
- строки → деталь `/app/payments/[code]`.

Чего **НЕТ** (проверено grep-поиском по всем `.ts/.tsx` фронтенда):
- **кнопки «Создать платеж»** — строка `Создать платеж` не встречается **ни разу**;
- modal / drawer / payment form;
- Order selector / Booking selector;
- полей amount/currency/method/reason form;
- **любой мутации** — `api.post(` на `/finance/payments` отсутствует; во всём фронтенде к payments идут только GET и export;
- `useCan("finance.payment.create")` / permission guard на создание — отсутствует (нечего.guard-ить).

Деталь платежа: `frontend/app/app/payments/[code]/page.tsx` — только `GET /finance/payments/${code}` (`:65`), просмотр статуса/истории.

Legacy-маршруты: `app/app/finance/payments/page.tsx` и `app/app/finance/payments/[id]/page.tsx` — **compatibility redirect** на `/app/payments` (ADR-OPS-001), контракт закреплён в `lib/operations-center-shell.spec.tsx:246-254`.

**Вывод §12:** Payments UI — строго read-only registry. Create UI отсутствует целиком (кнопка + форма + клиент + guard).

---

## 13. Order UI

**Файл:** `frontend/app/app/orders/[id]/page.tsx`.

Что есть (финансовый контекст):
- `EntityFinanceCell` со статусом оплаты из `order.paymentStatus` (`:262`);
- секция **«Финансовая история»** — read-only, state `finHistory` (`:115`), загрузка `GET /orders/${id}/financial-history` (`:154`), рендер payments + refunds (`:350-363`);
- финансовые ячейки оплачено/к оплате и т.п. в header-блоке.

Чего **НЕТ**:
- секции «Платежи» с управлением (только история);
- **кнопки `+ Создать платеж`**;
- payment form / modal;
- какой-либо передачи `orderId` в payment-создание (хотя `order.id` в контексте доступен — используется для financial-history).

`order.availableActions` (`order.service.ts:183-213`) содержит только lifecycle-действия Order (accept/edit/send/confirm/suspend/cancel/close/returnToRequest) — **payment-действий в политике Order нет**.

---

## 14. Booking UI

**Файл:** `frontend/app/app/bookings/[id]/page.tsx`.

Что есть:
- `financialSummary` (`:55,:194`) — оплачено / due / refunded / refundable / paymentStatus (`:247-253`);
- `activePayment` (`:56,:195`) — метод и статус активного платежа связанного Order (`:257-260`);
- оба поля приходят **сервером** из Booking detail (`booking-query.service.ts:72-135`), не вычисляются на клиенте.

Чего **НЕТ**:
- кнопки создания платежа;
- payment form / modal;
- отдельной секции «Платежи» со списком (только сводка по связанному Order).

**`bookingId` и родительский `orderId`** — в ответе есть `linkedOrder { id, referenceNumber, status }` (`booking-query.service.ts:77,88`), т.е. фронтенд **уже получает `orderId`**, необходимый для `POST /finance/payments` — но не использует его для создания.

---

## 15. Exact Gaps

### Backend EXISTS
- `POST /api/v1/finance/payments` — ручная инициация (orderId + reason + method + note);
- RBAC `finance.payment.create` / `.manage` / `.read` (матрица назначена, guard'ы на месте);
- server-owned amount (forbidden keys → 422, frozen verbatim, `validateFrozenMoneyFact`);
- инвариант ≤1 активный Payment на Order (частичный unique + isActivePayment CAS);
- idempotency (повторный create → no-op; конкурентный → controlled 409; внешний Idempotency-Key контракт);
- confirm / fail / cancel — CAS state machine, milestones, history, audit, outbox-события;
- Order projection `paymentStatus`/`paidAmount`/`refundedAmount` через subscribers (включая REFUNDED);
- refunds как отдельный aggregate (create/approve/process/fail) с ≤over-refund защитой;
- read-side связка Booking → Order → Payment (financialSummary + activePayment);
- registry read-model с KPI-агрегатами, фильтрами, CSV export;
- подробное e2e/unit покрытие (§18).

### Backend MISSING
- **Для сценария Order — ничего** (всё, что нужно, есть);
- прямой эндпоинт/поле `Payment.bookingId` — отсутствует (§4/§6: **и не требуется**, если привязка идёт через orderId);
- writer для `PARTIALLY_PAID` — отсутствует (частичные платежи не поддерживаются; инвариант ≤1 активный Payment);
- `AUTHORIZED`/`REFUNDED` на Payment — зарезервированы/недостижимы (design, не баг);
- PATCH/edit payment — отсутствует (design: платёж не редактируется, только переходы);
- allowlist payment methods — отсутствует (`paymentMethod` — свободная строка).

### Frontend MISSING
- кнопка «Создать платеж» в Payments toolbar (в т.ч. permission-gated по `finance.payment.create`);
- payment form / modal (selector orderId + optional Booking-контекст, paymentMethod, **reason (обязателен)**, initialNote);
- API-клиент-мутация `POST /finance/payments` (в frontend не существует вообще);
- permission guard (`useCan`) на создание;
- кнопка «+ Создать платеж» в Order detail (финансовая секция) — с передачей `order.id`;
- кнопка «+ Создать платеж» в Booking detail — с передачей `booking.linkedOrder.id`;
- i18n-ключи для формы (ru/az/en);
- unit-тесты новой UI (существующие покрывают только registry/redirect).

### Schema Change Required
**НЕ требуется** для обоих сценариев при привязке через `orderId`:
- `Payments → Create → Order` — нет;
- `Payments/Create → Booking` — нет, если платёж создаётся с `orderId` родительского Order (цепочка Booking→Order→Payment уже работает, §4/§9).

Schema-миграция (`Payment.bookingId`) потребовалась бы **только** при решении владельца сделать прямую привязку — это не рекомендуется (§4) и не требуется ни одним из четырёх сценариев.

### Owner Decision Required
См. §17 (P1, P2, P3, P6 — частично; P4/P5/P7 — определены кодом).

---

## 16. Recommended Implementation Boundary

Рекомендуемая граница реализации — **только фронтенд**:

```
1. Frontend API client: мутация POST /finance/payments (orderId, reason, paymentMethod?, initialNote?)
2. Payments page: кнопка в OperationsToolbarSlot, gated by useCan("finance.payment.create")
3. Payment form (modal): обязательный Order-selector (или предзаполненный orderId из deep-link),
   paymentMethod (select), reason (обязательное поле, 1..255), initialNote (≤5000)
4. Order detail: кнопка «+ Создать платеж» в финансовой секции → form с предзаполненным order.id
5. Booking detail: кнопка «+ Создать платеж» → form с предзаполненным booking.linkedOrder.id
   (НЕ bookingId — его не существует в API/schema)
6. Обработка ответов: 201 → refresh list/history; 403 → показ отсутствия права;
   409 → «активный платёж уже существует»; 422 → validation (в т.ч. forbidden keys / нет reason);
   404 → Order не найден
7. i18n ru/az/en + unit-тесты (page.spec / registry spec по образцу существующих)
```

**Backend-изменения НЕ нужны** ни для одного из четырёх сценариев.
**Schema-изменения НЕ нужны.**
**Data repair НЕ нужен.**

Единственные вопросы, требующие решения до реализации — §17 (P1/P2/P3/P6).

---

## 17. Owner Decisions Required

### P1 — Payment привязывается: `Order only` или `Order + optional Booking`?

**По коду сейчас: `Order only`** (единственное обязательное поле — `orderId`; `bookingId` не существует).
Доступ через Booking возможен только косвенно (Booking → Order → Payment).
Рекомендация: оставить **Order only** — прямая связь создаёт второй источник истины для денег (§4).

### P2 — Если есть Booking, должен ли `orderId` также быть обязательным?

**По коду: `orderId` ВСЕГДА обязателен** (`schema.prisma:4169` NOT NULL; service бросает `orderId is required`). Booking не влияет на это требование — у Booking нет собственного payment-пути.
Для UI-сценария «создать из Booking»: брать `booking.linkedOrder.id` и передавать его как `orderId` — тогда P2 не нуждается в изменении.

### P3 — Можно ли создать Payment только для Order?

**Да — это единственная поддерживаемая форма.** Создать Payment без Order невозможно (NOT NULL), создать Payment только для Booking — невозможно (нет bookingId).

### P4 — Источник payable amount: `Order` / `Booking` / `Payment form`

**По коду: `Order` — единственный источник.** `amount = order.amount` verbatim; form-поле amount не существует и отклоняется (422 forbidden keys); `Booking.amount` в создании не участвует.
**Решение владельца не требуется** — код однозначен. (Если захочется редактировать сумму — это новый продуктый запрос в противоречие с текущим design.)

### P5 — Может ли менеджер вручную менять amount?

**По коду: НЕТ.** Ни endpoint (PATCH NOT FOUND), ни DTO-поле (forbidden → 422). Ручной флоу задаёт только `reason`.
**Решение не требуется** — код однозначен.

### P6 — Какие payment methods поддерживаются?

**По коду: НЕ ОГРАНИЧЕНО** — `paymentMethod` это свободная строка ≤64 (`payment.service.ts:94-97`), без enum/allowlist. В UI-форме это будет произвольный текст, если владелец не задаст список.
→ **РЕШЕНИЕ ВЛАДЕЛЬЦА НУЖНО**: какой allowlist (например cash/card/transfer/bank) показывать в селекте формы. Технически backend не помешает любому значению.

### P7 — Какие payment statuses влияют на financial/lifecycle logic?

**По коду однозначно:**
- `CAPTURED` → `PaymentCaptured` → `Order.paymentStatus = PAID`, `paidAmount = amount`;
- `FAILED` / `CANCELLED` → освобождают `isActivePayment` → разрешают повторную инициацию (attempt 2); на Order **не** влияют (остаётся UNPAID);
- `REFUNDED` на Payment — **не влияет** (недостижим); фактический `REFUNDED` Order приходит через refund-flow (`RefundProcessed`);
- `PENDING` — активный платёж блокирует второй create;
- `AUTHORIZED` — не используется.
**Решение не требуется** (это описание фактического состояния; вопрос о partial payments — см. §15 Backend MISSING / 2.12F).

---

## 18. Existing Tests

### Backend — unit (`src/modules/finance/`)

| Файл | Кол-во `it()` | Что покрывает |
|---|---|---|
| `payment.service.spec.ts` | 17 | createPayment/transition-логика, guards, DTO |
| `payments-registry.spec.ts` | 17 | KPI-агрегаты, фильтры, статус-порядок, zero-count |
| `financial-integrity-checker.spec.ts` | 36 | «amount = order.total verbatim», инварианты денег |
| `refund.service.spec.ts` | 19 | refund-flow, over-refund protection |

### Backend — e2e (`backend/test/`)

| Файл | `it()` | Релевантность |
|---|---|---|
| **`payment-flow.e2e-spec.ts`** | **14** | **основной**: T1 frozen verbatim, T2 no-repricing, T3 confirm→CAPTURED→Order PAID, **T4 forged amount→422**, T5 fail/attempt 2, T6 idempotent no-op, T7 concurrent→409, T8 повторные переходы→409, **T9 RBAC (401/403/201)**, T10 cancel+retry, T11 ноль побочных сущностей, **T12 нет PII в DTO**, T13 BUYER_REQUEST ортогонален |
| `external-idempotency-contract.e2e-spec.ts` | 26 | Idempotency-Key контракт `POST /finance/payments` |
| `finance-domain-foundation.e2e-spec.ts` | 13 | foundation-модель finance |
| `d7-financial-qualification.e2e-spec.ts` | 29 | D7 financial authority |
| `refund-flow.e2e-spec.ts` | — | refund create/approve/process → Order REFUNDED |
| `chargeback-dispute-foundation.e2e-spec.ts` | — | disputes |
| `d4-representative-chain.e2e-spec.ts` | — | chain-контекст |
| `payment-provider-abstraction.e2e-spec.ts` | — | PSP abstraction (2.12A) |

### Frontend (`frontend/lib/`)

| Файл | Что покрывает |
|---|---|
| `payments-registry.spec.tsx` | URL контракта `GET /finance/payments?…`, `exportUrl`, колонки/фильтры |
| `operations-center-shell.spec.tsx` | `/app/finance/payments` → `/app/payments` redirect contract |

**Пробел покрытия:** ни один тест не покрывает create-UI (его не существует), i18n-ключи формы, permission-кнопку. Backend-покрытие create-flow — **полное**.

---

## 19. Safety / Scope

Проверено соблюдение ограничений промпта:

- **Код не изменялся** — аудит выполнен только чтением (Read/Grep/Glob);
- **Prisma schema / БД / migrations не изменялись**;
- **UI / API не изменялись**;
- **Тесты / конфигурация не изменялись**;
- **Платежи не создавались** (ни реальных, ни тестовых — POST /payments не выполнялся);
- **Data repair не выполнялся**;
- **Commit / push / staging не выполнялись**;
- Scope isolation (§15 промпта) соблюдён: Supplier Markup/Pricing, Request/Booking lifecycle, Traveler data, WhatsApp, supplier integrations — **не анализировались**; затронуты только Payment и необходимые связи Order/Booking.

Побочные наблюдения вне scope зафиксированы в §5/§7 только постольку, поскольку это прямые связи Payment↔Order/Booking.

---

## 20. Final Verdict

### Сценарий 1

```text
Payments → Create → Order
YES — FRONTEND ONLY
```

Backend готов полностью (`POST /api/v1/finance/payments`, RBAC `finance.payment.create`, server-owned amount, reason обязателен, idempotency, history/audit/events). Отсутствует **только** фронтенд: кнопка, форма, API-клиент, permission guard, i18n, тесты. Schema-изменений и backend-изменений не требуется.

### Сценарий 2

```text
Payments → Create → Booking
YES — FRONTEND ONLY
```

Прямой привязки `Payment → Booking` по схеме нет и **не требуется**: UI-форма из Booking должна принимать **`booking.linkedOrder.id`** и отправлять его как обязательный `orderId` (цепочка Booking → Order → Payment уже реализована в `booking-query.service.ts:79-135` и API ничего иного не принимает). Backend-изменений и schema-изменений не требуется; нужен только фронтенд (форма + предзаполнение из Booking context).

**Отдельное замечание для Owner (не блокирующее обоих сценариев):** P6 — зафиксировать allowlist payment methods для селекта в форме (§17); P1 — подтвердить, что прямой `bookingId` не нужен (§4/§6, рекомендация: не нужен).

---

**Статус аудита:** завершён. Изменений в репозитории не произведено; commit/push не выполнялись.
