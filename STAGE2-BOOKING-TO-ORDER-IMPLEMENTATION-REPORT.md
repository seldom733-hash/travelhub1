# STAGE 2 IMPLEMENTATION REPORT — BOOKING → ORDER (round-trip «назад в заказ»)

## 1. Executive summary

Реализована **стадия 2** владельского требования — обратная ветка
**Booking → Order**, закрывшая LIFECYCLE FAIL M4-аудита (обе обратные ветки
`Request ⇄ Order ⇄ Booking` теперь существуют; см.
`STAGE1-ORDER-TO-REQUEST-IMPLEMENTATION-REPORT.md` и
`BOOKING-TO-ORDER-DESIGN-PASS.md`):

- новая lifecycle-команда `returnToOrder` в state machine Booking
  (`PATCH /api/v1/bookings/:id {action:"returnToOrder", reason?}`) —
  **одна** команда со стейт-зависимыми под-gates (решение по Q2),
  оркестрация в `booking.service` (вариант В1 из design pass: booking-домен
  владеет booking-CAS, Order-переход — атомарно в той же транзакции),
- матрица возврата (как построено):
  - **direct** (NEW / PREPARING_REQUEST / SENT_TO_SUPPLIER /
    AWAITING_CONFIRMATION / NEEDS_CLARIFICATION / PROBLEM) → бронь
    терминализируется в `CANCELLED` (CAS + milestone `cancelledAt`);
  - **phase-2** (CANCELLED / SUPPLIER_REJECTED — уже терминальны) → статус
    брони не меняется, возврат = агрегатная операция над Order; повтор
    при «ничего не меняется» → **409** (идемпотентность отказом);
  - CONFIRMED / IN_SERVICE / CANCELLATION_REQUESTED / CHANGE_REQUESTED →
    **409** «сначала подтверждённая отмена» (двухфазный кейс: `requestCancellation
    → cancel`, затем возврат);
  - COMPLETED → **409** (никогда не возвращается);
  - PROBLEM: direct-recovery работает, только если бронь **никогда** не была
    CONFIRMED/IN_SERVICE (проверка по BookingHistory);
- агрегат Order (Q1/Q5, V2.2 «каждая бронь отдельно»): активных броней после
  возврата > 0 → `PARTIALLY_FULFILLED`, иначе → `READY_FOR_BOOKING`
  (Order CAS по id+status+version; from-список
  `SENT_TO_BOOKING | PARTIALLY_FULFILLED | PROBLEM`; терминальный
  CANCELLED/CLOSED → 409),
- деньги-гвард (Q4): `Payment ∈ {AUTHORIZED, CAPTURED}` по Order → **409
  «refund first»** — никаких auto-refund, `OrderPaymentStatus` не трогается
  (lifecycle-команда остаётся «чистой», деньги — отдельный bounded context),
- история/аудит/события в одной транзакции:
  - `BookingHistory action = returned_to_order` (from/to/actorId/actorName/reason),
  - `OrderHistory action = returnFromBooking` (только при фактическом
    изменении статуса Order),
  - `AuditLog action = booking.returned_to_order` (оба ref, from/to,
    activeBookingsAfter, commissionReversedId, reason),
  - события: `BookingCancelled` (только direct-переход), `OrderStatusChanged`
    (только если Order изменился), `CommissionReversed` (Q8);
    `BookingStatusChanged` **не** эмитится (canonical возврат — BookingCancelled),
- Q8 **CommissionReversed**: новый доменный факт — CAS `ACCRUED → REVERSED`
  у `Commission` и `CommissionAccrual` (ровно один факт на выигранную гонку;
  ledger НЕ переписывается, 0 consumer-ов), enum-типы расширены значением
  `REVERSED` (обе миграции),
- Q9 **повторная отправка**: partial-уникальность
  `Booking_orderItemId_key (status <> 'CANCELLED' AND rejectedAt IS NULL)` —
  активная бронь занимает OrderItem, возврат/reject освобождает; consumer
  `BookingRequested` перешёл с order-level «existing > 0» на **per-item
  occupancy** — повторный `send` после возврата создаёт брони только по
  свободным items (B2), `order.service` получил gate повторного `send`,
- defensive release удержания: `Reservation HELD → RELEASED` (идемпотентно;
  продьюсеров Reservation сегодня нет), Q6 — паспортные данные **не**
  отзываются/не удаляются, факт передачи фиксируется history/audit,
- RBAC (Q7): granular-право `booking.return_to_order` — **отдельно** от
  `booking.cancel` (round-trip ≠ отмена поставщику); granted OPERATOR
  (зеркало booking.cancel) + ADMIN (ALL_PERMISSIONS); миграция идемпотентна,
- фронтенд: кнопка «Вернуть в заказ» в `BookingActionBar` из
  сервер-авторитетной проекции `availableActions` (confirm-диалог,
  ru/az/en), Order-side — read-only индикатор через history-лейбл
  (`order.action.returnFromBooking` в `commerce-history-labels`),
- тесты: unit-проекция 7/7 + e2e `booking-to-order` **7/7** (round-trip,
  матрица Q2, PROBLEM-recovery, order-guards/фин-гвард, phase-2,
  partial+повторный send, Q8 commission).

Коммитов нет (HEAD остаётся `0d7de62`), push не выполнялся.

## 2. Exact baseline commit

- HEAD (не тронут): `0d7de62` — docs(m4): pre-coding architecture decision, audit prompt and completed audit
- Сравнительный worktree: `D:\travelhub_baseline` @ `0d7de62` (чистый) —
  повторные прогоны тех же e2e-сьютов для доказательства pre-existing падений
  (сверка через `--json`).

## 3. Key architecture decisions (as built; Q1–Q9 из design pass)

1. **Точка входа (В1)**: команда на стороне Booking — `applyReturnToOrder`
   в `booking.service.ts` (booking-домен владеет booking-CAS; запись в
   order-таблицы — prisma-only cross-domain, прецедент Stage 1
   `order.service → Request`; без новых DI).
2. **Q2 — одна команда** `returnToOrder` со стейт-зависимыми под-gates
   (не отдельные pre/post-confirm команды): `TRANSITIONS.returnToOrder.from`
   управляет серверной проекцией (8 direct/phase-2 статусов), execution-матрица
   (`RETURN_DIRECT` / `RETURN_PHASE2` / `RETURN_PHASE2_ACTIVE`) — в
   `applyReturnToOrder` до каких-либо мутаций.
3. **Q1/Q5 — V2.2**: каждая Booking возвращается независимо; Order
   агрегирует: активных > 0 → `PARTIALLY_FULFILLED`, иначе →
   `READY_FOR_BOOKING`. Каскадной отмены всех броней (V2.3) нет.
4. **Q4 — 409 «сначала refund»** (рекомендация design pass принята): guard
   `Payment.count(AUTHORIZED/CAPTURED) > 0` до мутаций; auto-refund /
   `withFinancialSettlement` не реализовывались.
5. **Q3 — cancellation fee**: модели штрафов в кодовой базе нет → vacuous
   guard задокументирован в коде (никаких fee-вычислений в lifecycle-команде).
6. **Q6 — PII**: возврат не трогает `Passenger`/`Booking`/`OrderTraveler`
   (durable history); факт фактической передачи паспортных данных поставщику
   зафиксирован в history/audit-комментариях; автоматических «удалений у
   поставщика» нет.
7. **Q7 — granular-право** `booking.return_to_order` (новый ключ в
   `PERMISSIONS`, `ROLE_PERMISSIONS.OPERATOR`, `PERMISSION_DESCRIPTIONS`;
   ADMIN — по ALL_PERMISSIONS convention). Идемпотентная миграция
   `20261005100000_...` (INSERT … ON CONFLICT DO NOTHING + RolePermission
   add-missing; ничего не отзывает).
8. **Q8 — CommissionReversed**: новый факт-событие
   (`DomainEvents.CommissionReversed` + `CommissionReversedPayload`,
   PII-free, frozen money), CAS только из `ACCRUED` (и Commission, и
   Accrual), ledger не переписывается; enum `REVERSED` в
   `CommissionStatus`/`CommissionAccrualStatus`
   (миграция `20261005100200_...`, PG12 `ADD VALUE IF NOT EXISTS`).
9. **Q9 — partial unique + per-item occupancy**:
   - схема: `orderItemId String? @unique` →
     `@@unique([orderItemId], where: { status: { not: "CANCELLED" }, rejectedAt: null }, map: "Booking_orderItemId_key")`
     (имя сохранено → P2002-контракт `booking-requested-consumer` не меняется;
     COMPLETED занимает item — исполненный не переотправляется);
   - consumer: вместо «есть брони → skip-all» — per-item occupancy; занятые
     items пропускаются, свободные (после возврата) получают B2; legacy-бронь
     (`orderItemId NULL`) активна → консервативный skip-all; отменённый Order
     с бронями → skip-all (без воскрешений);
   - `order.service`: gate повторного `send` (открыт только при наличии
     свободных/возвращаемых items — Q9-follow-up).
10. **События — ровно три канала**: `BookingCancelled` (direct), 
    `OrderStatusChanged` (orderChanged), `CommissionReversed` (CAS выигран).
    `BookingReturnedToOrder` из design pass **не** вводился — canonical-факты
    покрывают round-trip (зеркально философии Stage 1: один факт на переход).
11. **Проекция зеркалит execution**: `computeAvailableBookingActions`
    (from-список ∩ gates ∩ `ACTION_PERMISSIONS.returnToOrder =
    booking.return_to_order`); Order-side — только history-лейбл (read-only
    индикатор, как в design pass §8: команда живёт на Booking-стороне).
12. **actor**: controller передаёт `actor.id` → `BookingHistory.actorId` /
    `OrderHistory.actorId` = UUID (конвенция Stage 1), username — в
    actor-колонки вторым полем.

## 4. Files changed (Stage 2 scope)

### Backend — продукт
| File | Change |
|---|---|
| `src/modules/booking/booking.service.ts` | `BookingAction += returnToOrder`; `TRANSITIONS/ACTION_LABELS/ACTION_PERMISSIONS`; матрица `RETURN_DIRECT/RETURN_PHASE2/RETURN_PHASE2_ACTIVE/ORDER_RETURNABLE/ORDER_TERMINAL_GUARD/BOOKING_TERMINAL`; `applyReturnToOrder` (guards → booking CAS → Order CAS → history ×2 → reservation release → commission CAS → audit → события); ветвление в `bookingAction` до generic-путей |
| `src/modules/booking/booking.controller.ts` | allowed-action `returnToOrder` + permission-map `returnToOrder → booking.return_to_order` |
| `src/modules/booking/booking.subscribers.ts` | per-item occupancy (Q9): занятые items пропускаются, свободные → новая Booking; legacy skip-all; отменённый Order → skip-all |
| `src/modules/order/order.service.ts` | Q9-follow-up: gate повторного `send` (+комментарии Stage 2) |
| `src/eventbus/domain-events.ts` | `DomainEvents.CommissionReversed` + `CommissionReversedPayload` (30 строк) |
| `src/security/permissions.constants.ts` | `PERMISSIONS["booking.return_to_order"]` + `ROLE_PERMISSIONS.OPERATOR` (+6) |
| `src/security/security.service.ts` | `PERMISSION_DESCRIPTIONS["booking.return_to_order"]` (boot-seed каталога прав) |

### Backend — схема/миграции
| Migration | Change |
|---|---|
| `prisma/migrations/20261005100000_stage2_booking_return_to_order_permissions` | Permission `booking.return_to_order` + RolePermission (OPERATOR, ADMIN add-missing); идемпотентна, ничего не отзывает |
| `prisma/migrations/20261005100100_stage2_booking_order_item_partial_unique` | `Booking.orderItemId`: обычный unique → partial unique (status<>CANCELLED AND rejectedAt IS NULL); имя `Booking_orderItemId_key` сохранено |
| `prisma/migrations/20261005100200_stage2_commission_reversed_status` | `ALTER TYPE "finance"."CommissionStatus"/"CommissionAccrualStatus" ADD VALUE IF NOT EXISTS 'REVERSED'` |
| `prisma/schema.prisma` | `Booking.orderItemId` → partial `@@unique` (+`@@index([orderItemId])`); enum `REVERSED` в обоих commission-типах |

### Backend — тесты
| File | Change |
|---|---|
| `src/modules/booking/booking-to-order.projection.spec.ts` | **NEW** — unit-матрица проекции returnToOrder (7 тестов) |
| `test/booking-to-order.e2e-spec.ts` | **NEW** — e2e round-trip R→O→B→O (7 сценариев) |
| `test/rbac-actions.e2e-spec.ts` | `returnToOrder` добавлен в канонический список Booking-действий (+4) |

### Frontend
| File | Change |
|---|---|
| `components/booking/BookingActionBar.tsx` | `ACTION_UI.returnToOrder` (label/confirmKey/цвет) |
| `lib/i18n.tsx` | +4 Stage-2 ключа ru/az/en: `booking.action_short.returnToOrder`, `booking.action_confirm.returnToOrder`, `booking.action.returned_to_order`, `order.action.returnFromBooking` |
| `lib/commerce-detail-system.spec.tsx` | `returnToOrder` в каноническом списке действий Booking + тесты кнопки/локализации |

## 5. API surface added/changed

- `PATCH /api/v1/bookings/:id` — новая allowed-команда
  `{"action":"returnToOrder","reason"?:string}` (reason ≤255 →
  comment обеих history + AuditLog details):
  - 200: тело = Booking (direct → status CANCELLED, version+1;
    phase-2 → статус/версия не меняются при фактическом возврате);
  - 403: нет `booking.return_to_order`;
  - 409: матрица Q2 / терминальный Order / Order вне from-списка /
    AUTHORIZED-CAPTURED payments («refund first») / повтор phase-2
    («already returned») / concurrent CAS (retry);
  - 404: storefront-изоляция (чужой/неизвестный booking — как у всех
    booking-команд);
  - 422: неизвестные ключи тела / неверный action.
- Без изменений: все read-эндпоинты (shape `availableActions` не менялся —
  массив строк; в него добавился элемент `returnToOrder`),
  `POST /orders`/`send` (кроме Q9-gate повторного send — внутренний guard,
  контракты не меняются).

## 6. State machine / projection deltas

- `TRANSITIONS.returnToOrder = {from: [NEW, PREPARING_REQUEST,
  SENT_TO_SUPPLIER, AWAITING_CONFIRMATION, NEEDS_CLARIFICATION, PROBLEM,
  CANCELLED, SUPPLIER_REJECTED], to: CANCELLED}` — from-список управляет
  только проекцией; execution дополнительно гейтится под-gates
  (PROBLEM-everConfirmed, ORDER_RETURNABLE, phase-2-идемпотентность).
- Order-side: статусных команд не добавлено; read-only индикатор —
  `OrderHistory.returnFromBooking` (лейбл в detail-view через
  `commerce-history-labels → order.action.returnFromBooking`).
- `booking-requested-consumer`: dedup-логика order-level → per-item occupancy
  (partial-unique контракт; P2002 `isUniqueViolation` сохранён).
- Другие машины состояний (Order/Request/sales) не менялись.

## 7. Tests added

### Unit (backend) — новые
- `booking-to-order.projection.spec.ts` (7): direct-статусы →
  returnToOrder в проекции при granular-праве; PROBLEM → есть; phase-2
  (CANCELLED/SUPPLIER_REJECTED) → есть; подтверждённые/активные → скрыт;
  COMPLETED → скрыт; без права → скрыт; `ACTION_PERMISSIONS.returnToOrder
  = booking.return_to_order`.

### E2E — новый сьют `booking-to-order.e2e-spec.ts` (7/7)
1. **Direct round-trip**: NEW → CANCELLED (CAS, cancelledAt, version+1),
   Order `SENT_TO_BOOKING → READY_FOR_BOOKING` (CAS, version+1);
   `BookingHistory returned_to_order` (actorId UUID/username/reason),
   `OrderHistory returnFromBooking`, `AuditLog booking.returned_to_order`
   (оба ref); события `BookingCancelled` (direct) + `OrderStatusChanged`
   (только на изменившийся Order), `BookingStatusChanged` не эмитится;
   проекция после действия: `send` снова доступен (Q9);
   RBAC: OPERATOR видит команду, ANALYST — нет (гранулярный).
2. **Матрица Q2**: подтверждённая/активная → 409 «сначала подтверждённая
   отмена»; COMPLETED → 409; все direct-статусы → 200; при 409 —
   0 history/audit-записей (guards до мутаций).
3. **PROBLEM**: с history CONFIRMED/IN_SERVICE → 409; без подтверждений →
   direct-recovery 200.
4. **Order-guards**: Order вне from-списка → 409; терминальный Order → 409;
   `Payment AUTHORIZED/CAPTURED` → 409 «refund first» (0 мутаций) → refund
   удалён → 200; PROBLEM-order recovery работает.
5. **Phase-2 (SUPPLIER_REJECTED)**: бронь не терминализируется повторно;
   Order возвращается; повтор → 409 «already returned»; history ровно 1.
6. **Q1/Q5/Q9 partial**: две брони → возврат первой → Order
   `PARTIALLY_FULFILLED`, повторный send создаёт B2 **только для свободных
   items**; возврат второй → `READY_FOR_BOOKING`; повторы → 409.
7. **Q8**: Commission `ACCRUED → REVERSED` (CAS, version+1) + Accrual
   `→ REVERSED`; outbox `CommissionReversed` ровно один, payload
   (commissionId/orderId/partnerId/frozen money/bookingRef); повторный
   возврат не создаёт второй факт; 0 новых Ledger/Commission-строк.

## 8. Regression results & pre-existing failures

### Новые/целевые
| Gate | Result |
|---|---|
| backend `tsc --noEmit` (включая `test/**/*`) | **OK (exit 0)** |
| backend unit `jest` (полный) | **138/138 suites, 2208/2208 tests** (первый прогон: 24 transient `beforeAll` DB-hook timeouts под нагрузкой — перепрогон зелёный) |
| e2e `booking-to-order` (Stage 2) | **7/7 passed** |
| e2e `order-to-request` (Stage 1) | **4/4 passed** |
| frontend `tsc --noEmit` | **OK (exit 0)** |
| frontend `vitest run` | **54 файла, 940/940 tests** |
| frontend `next build` | **OK (exit 0)** |
| frontend `npm run lint` | pre-existing сломан: скрипт `eslint`, пакета нет в devDependencies (`command not found` на чистом baseline тоже) |
| `prisma migrate status` (dev `travelhub1`) | **up to date**, 112 миграций (включая 3 stage-2) |

### E2E против baseline — 46 сьютов, 686 тестов
| Batch | Сьюты (кол-во) | Tests | Failed (мой прогон) | Baseline (тот же прогон в `D:\travelhub_baseline`) |
|---|---|---|---|---|
| 1 | дейтлайн-сьюты «19» + rbac-actions + order-to-request + d6 (8) | 128 | 21 | 19 (бейзлайн-«19») + rbac-actions 2 (pre-existing вне «19», подтверждён в Stage 1) |
| 2 | commission/finance/temporal/envelope/rbac-parity/outbox (10) | 163 | 34 | **34 — идентично** (проверено baseline-прогоном) |
| 3 | auth-rbac, d4-closure, d13, payment-flow, checkout, dashboards (8) | 130 | 30 | **30 — идентично** (baseline-прогон) |
| 4 | order-canonical/temporal/sale-completion/refund/chargeback/idempotency/d4-chain/booking-to-order… (10) | 124 | 92 | **92 — идентично** (90 baseline-прогоном + d4-representative-chain 2 pre-existing из Stage 1) |
| 5 | provider-fee, d7, d5-fullpage, d3-traveler, payment-terms, pricing… (10) | 141 | 29 | **29 — идентично** (baseline-прогон) |

Итог: **ни одного регресса** — каждое падение в 46 сьютах воспроизведено
чистым checkout `0d7de62` с теми же заголовками/количествами
(сверка `--json`: `numFailedTests` и наборы failed-тестов совпадают).

**Системный pre-existing (не чинился, вне Stage 2):** admin
`POST /products` → 403 (глобальный cascade: `createProduct/buildOrder`
хелперы десятков e2e-сьютов) — тот же класс, что baseline-«19»
(`booking-requested-consumer` test 1 и др.), доказан на чистом
`D:\travelhub_baseline`. Источник — не-Sage-2 код прав
(`ROLE_PERMISSIONS.ADMIN` без `catalog.product.write` в constants).

### Live-окружение
- dev-БД `travelhub1`: все 3 stage-2 миграции применены
  (`prisma migrate status` — up to date).

## 9. Known gaps / follow-ups (out of Stage 2 scope)

- **Двухфазный возврат post-confirm**: CONFIRMED/IN_SERVICE →
  `requestCancellation → cancel → returnToOrder` работает штатными
  командами, но **автоматической оркестрации** (один вызов, cancellation
  request поставщику + ожидание подтверждения) нет — отдельная инициатива.
- **Supplier-notify best-effort** при возврате из SENT_TO_SUPPLIER —
  не реализован (design §5.1 «notify, не влияющий на атомарность»): сегодня
  возврат терминализирует бронь без исходящего уведомления поставщику.
- **Cancellation fee (Q3)**: модели штрафов нет — guard vacuous; появление
  fee-модели потребует отдельного фин-guard'а.
- **Order-side read-only флаг** в DTO проекции (В3-вариант C) не вводился —
  индикатор через history (достаточно для UX-шаблона Stage 1).
- **Multi-order forward** (O2 поверх вернувшейся цепочки) — тема Stage 1
  follow-up, не закрыта.
- Pre-existing падения (вне Stage 2, идентично baseline): системный admin
  product-403 cascade, `d4-remediation-closure` 1, `d4-representative-chain`
  2, `auth-rbac` 1, `d13` 1.
- Остальные ~60 e2e-сьютов (whatsapp/m4/reverse/storefront-домены) не
  прогонялись в этой сессии — домены не затронуты Stage-2 diff'ом;
  по желанию — полный прогон для полной карты.

## 10. How to re-run the gates

```powershell
# backend
npx tsc --noEmit
npx jest --silent                             # unit: 138/138, 2208/2208
npx jest src/modules/booking/booking-to-order.projection.spec.ts   # 7/7

$env:NODE_OPTIONS="--max-old-space-size=4096"
npx jest --config test/jest-e2e.json --runInBand booking-to-order  # 7/7
npx jest --config test/jest-e2e.json --runInBand order-to-request  # 4/4

# baseline-контроль (та же БД-топология, чистый worktree)
npx --prefix D:\travelhub_baseline\backend jest --config D:\travelhub_baseline\backend\test\jest-e2e.json --rootDir D:\travelhub_baseline\backend --runInBand <batch>

# схема
npx prisma migrate status                      # up to date, 112

# frontend
npx tsc --noEmit
npx vitest run                                 # 54/940
npm run build                                  # exit 0 (npm run lint — pre-existing сломан)
```
