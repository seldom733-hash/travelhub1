# STAGE 1 IMPLEMENTATION REPORT — ORDER → REQUEST (только назад)

## 1. Executive summary

Реализована **только стадия 1** владельского требования — переход **Order → Request
(назад)**, round-trip `R1 → O1 → R1` c **той же Request**:

- новый lifecycle-командный `returnToRequest` в state machine Order
  (`PATCH /api/v1/orders/:id {action:"returnToRequest", reason?}`),
- атомарный возврат в одной транзакции: `Order → CANCELLED` (cancelledAt +
  OrderHistory + canonical-событие `OrderCancelled`) **и**
  `Request CONVERTED → CHECKING` (CAS по version, RequestHistory
  `returned_from_order`, AuditLog `order.returned_to_request`),
- **ничего не пересоздаётся**: та же Request (id/customerId/commerceSequence/
  code не меняются), `convertedOrderId`/`convertedAt` **не трогаются** — связь
  Request ↔ Order сохраняется, Order остаётся исторической стадией,
- guards **до каких-либо мутаций**: linked Request существует; Request =
  `CONVERTED`; bookings = 0; payments = refunds = 0; статус ∈ active-диапазона,
- повторный вызов → **409** (статус CANCELLED вне from-списка) —
  «идемпотентность отклонением»: второй Request не создаётся, версии не
  инкрементируются, history/audit не дублируются,
- supplier-цикл снова открыт: `CHECKING` входит в гейты
  `proposePrice`/`confirmPrice` (NEW/CHECKING); customer-окно и проекции
  приведены в паритет с execution,
- коммуникационная непрерывность: `resolveContext` снова отдаёт REQUEST для
  вернувшейся заявки (link-фильтр снят, терминальный статус CONVERTED отсекает
  уже конвертированные),
- фронтенд: кнопка «Вернуть в заявку» из сервер-авторитетной проекции, с
  confirm-диалогом, ru/az/en локализацией; dispatch не менялся.

**Booking → Order НЕ реализовывался** — отдельный design-pass документ
(`BOOKING-TO-ORDER-DESIGN-PASS.md`), реализация остановлена до ревью.

Коммитов нет (HEAD остаётся `0d7de62`), push не выполнялся.

## 2. Exact baseline commit

- HEAD (не тронут): `0d7de62` — docs(m4): pre-coding architecture decision, audit prompt and completed audit
- Сравнительный worktree: `D:\travelhub_baseline` @ `0d7de62` (чистый, без
  немодульных изменений) — использовался для доказательства pre-existing
  падений.

## 3. Key architecture decisions (as built)

1. **`returnToRequest` — первоклассная команда** в `OrderAction`
   (`TRANSITIONS.from = ACTIVE_STATUSES → CANCELLED`, permission `order.cancel`
   — деструктивная операция), а не отдельный эндпоинт: проекция
   `availableActions`, RBAC-матрица, DTO-валидация и фронтенд-рендеринг
   включаются штатно через существующие таблицы.
2. **Атомарность round-trip**: реактивация Request выполняется внутри того же
   `$transaction`, что и CAS Order → CANCELLED (см.
   `order.service.ts orderAction`, блок `action === "returnToRequest"`).
   Проигрыш concurrent-claimer'а Request → `ConflictError` → полный rollback:
   ничего не остаётся «половинчатым».
3. **Событие**: `OrderCancelled` (единый факт «Order ушёл в CANCELLED», тот же,
   что у `cancel`); единственный подписчик `BookingSubscribers.onOrderCancelled`
   при bookings = 0 — no-op (проверено readers'ом и e2e-ассертом).
4. **Guard-политика (все ДО мутаций)**:
   - linked Request не найден → 409 (`has no linked Request`);
   - `Request.status ≠ CONVERTED` → 409 (`requires CONVERTED`);
   - `Booking.count(orderId) > 0` → 409 (граница pre-send: Booking→Order —
     design pass);
   - `Payment.count + Refund.count > 0` → 409 (финансовые операции откладываются);
   - статус вне active-диапазона (повтор) → 409 штатным from-списком.
5. **Целевая статура Request = `CHECKING`** (не NEW): не засоряет KPI «новых»,
   открывает supplier-цикл (гейты NEW/CHECKING), фиксирует состояние
   «работы над возвращённой заявкой».
6. **Повторная конвертация возвращённой заявки — явный 409**, а не падение:
   `Order.referenceNumber = MKT-ORD-{commerceSequence} @unique` — инвариант
   «один Order на commerce chain»; без гейта повторный `convert` падал бы
   P2002 (500). Гейт добавлен в `convertRequestToOrder` **после** идемпотентной
   fast-path (CONVERTED+link → 200 не тронут) и зеркален в проекции
   (`convert = status CUSTOMER_ACCEPTED ∧ link = null`).
   Multi-order forward (O2 поверх истории) — тема Booking→Order design pass.
7. **Проекции зеркалят execution** (сервер-авторитетность):
   `customerAccept`/`customerDecline` больше не гейтятся
   `convertedOrderId === null` (execution всегда был status-only);
   `resolveContext` фильтрует по терминальному статусу, а не по link.
8. **actor**: controller передаёт `actor.id` в `orderAction` —
   `RequestHistory.actorId` = UUID (конвенция convert-цепочки),
   `OrderHistory` продолжает писать username в actor-колонки (существующая
   конвенция домена, не менялась).

## 4. Files changed (Stage 1 scope)

### Backend
| File | Change |
|---|---|
| `src/modules/order/order.service.ts` | `OrderAction += returnToRequest`; `TRANSITIONS/ACTION_LABELS/ACTION_PERMISSIONS`; `SecurityService` в ctor; `orderAction(..., actorId?)`; guards linked-Request/bookings/payments; milestone `cancelledAt`; реактивация Request CAS + `RequestHistory returned_from_order` + `AuditLog order.returned_to_request`; `case returnToRequest` → `OrderCancelled` |
| `src/modules/order/order.controller.ts` | `OrderActionDto.action` IsEnum += `returnToRequest`; вызов `orderAction(..., actor.id)` |
| `src/modules/order/request.service.ts` | проекция `customerAccept`/`customerDecline` — link-gate снят; `convert` — status+link паритет; execution-гейт повторной конвертации (409 после fast-path) |
| `src/integrations/whatsapp/conversations/conversations.service.ts` | `resolveContext`: изъят `convertedOrderId: null` (CONVERTED отсекается терминальным статусом) |
| `src/shared/date-param.registry-matrix.spec.ts` | мок 5-го аргумента `OrderService` (SecurityService) |
| `src/modules/order/order-to-request.projection.spec.ts` | **NEW** — unit-тесты обеих проекций (11 тестов) |
| `src/integrations/whatsapp/conversations/conversations.service.spec.ts` | +3 теста `resolveContext` (Stage 1) |
| `test/order-to-request.e2e-spec.ts` | **NEW** — e2e round-trip (4 сценария) |

### Frontend
| File | Change |
|---|---|
| `components/order/OrderActionBar.tsx` | `ACTION_UI.returnToRequest` (label/цвет/confirmKey) |
| `lib/i18n.tsx` | +5 ключей ru/az/en: `order.action_short.returnToRequest`, `order.action_confirm.returnToRequest`, `order.action.returnToRequest`, `request.action.returned_from_order` (+существующие не тронуты) |
| `lib/commerce-detail-system.spec.tsx` | +1 тест: кнопка из проекции, confirm да/нет, локализация ru/az/en |

### Инфраструктурное (не продуктовое)
- Удалён повреждённый сгенерированный артефакт Next.js
  `.next/dev/types/{routes.d.ts,validator.ts}` (оборванная запись dev-сервером;
  перегенерируется автоматически; `tsc` чист после удаления).
- Бэкенд-инстанс перезапущен (`ts-node` без watch) — running-инстанс на
  `:4000` содержит код Stage 1 (live-check: `PATCH {action:"returnToRequest"}`
  проходит DTO → 404 по несуществующему id; фронтенд `:3000` → 200).

## 5. API surface added/changed

- `PATCH /api/v1/orders/:id` — новая allowed-команда
  `{"action":"returnToRequest","reason"?:string}` (reason ≤255, попадает в
  comment OrderHistory + RequestHistory + AuditLog details).
  - 200: тело = Order (status CANCELLED, version+1);
  - 403: нет `order.cancel`;
  - 409: любой guard / повторный вызов / concurrent-claimer;
  - 422: неизвестные ключи тела (`assertNoForbiddenKeys`) / неверный action.
- Без изменений: `POST /requests/:id/convert` (повтор — 409, fast-path — 200),
  все supplier/customer-команды, все read-эндпоинты
  ( shapes `availableActions` не менялись: Order — массив, Request — объект с
  теми же 7 ключами).

## 6. State machine / projection deltas

- `TRANSITIONS.returnToRequest = {from: ACTIVE_STATUSES, to: CANCELLED}`
  (NEW, IN_PROCESSING, WAITING_FOR_DATA, READY_FOR_BOOKING, SENT_TO_BOOKING,
  PARTIALLY_FULFILLED, PROBLEM, SUSPENDED → активные bookings/payments
  отсекаются data-guards'ами).
- Request projection: `convert = canEdit ∧ hasD3 ∧ status=CUSTOMER_ACCEPTED ∧
  link=null`; `customerAccept/customerDecline` — status+deadline (без link).
- Order projection: `returnToRequest` выдаётся из active-статуса при праве
  `order.cancel`; D3-gates (confirm/send) не затронуты.

## 7. Tests added

### Unit (backend) — новые
- `order-to-request.projection.spec.ts` (11): CHECKING+link → цикл открыт,
  convert/accept закрыты; PRICE_CHANGED+link → customer-окно открыто;
  CUSTOMER_ACCEPTED+link → convert закрыт (409-гейт); CUSTOMER_ACCEPTED без
  link → convert открыт; без прав → всё false; NEW без link → не меняется;
  Order-проекция: active+order.cancel → есть; без права → нет; CANCELLED/
  FULFILLED/CLOSED → нет; `ACTION_PERMISSIONS.returnToRequest = order.cancel`.
- `conversations.service.spec.ts` (+3): CHECKING+link → REQUEST-контекст;
  CONVERTED+link → CUSTOMER (терминальный статус, link-фильтр снят);
  активный Order приоритетнее Request.

### E2E — новый сьют `order-to-request.e2e-spec.ts` (4/4)
1. **Round-trip**: R1→O1→R1 — Order CANCELLED (+cancelledAt, version+1,
   OrderHistory from/to/actor/reason), Request CHECKING (+version+1,
   link/convertedAt/customerId/commerceSequence/code сохранены), Request
   count без изменений (R2 нет), `RequestHistory returned_from_order`
   (actorId = op UUID), `AuditLog order.returned_to_request` (оба ref),
   outbox `OrderCancelled`, bookings=0, проекции обеих сущностей,
   RBAC: ANALYST → 403 без применения.
2. **Повторы**: 2×409, Request count/version стабильны, ровно по 1 записи
   в каждой history + 1 audit.
3. **Guards (все до мутаций)**: нет linked Request → 409; Payment → 409 →
   удалён → 200; Booking → 409 → удалён → 200; Request ≠ CONVERTED → 409 →
   восстановлен → 200; после снятия guards — тот же round-trip (Request одна).
4. **После возврата**: `confirm-price` 201 → `customer-accept` 201
   (supplier/customer-цикл жив), проекция `convert=false`,
   `convert` → **409** (`already converted`), link = O1, O1 CANCELLED,
   Orders count = 1 (O2 не создан).

## 8. Regression results & pre-existing failures

### Новые/целевые
| Gate | Result |
|---|---|
| backend `tsc --noEmit` | OK |
| backend unit `jest --runInBand` | **137/137 suites, 2201/2201 tests** |
| e2e `order-to-request` | **4/4 passed** (27 s) |
| frontend `tsc --noEmit` | OK |
| frontend `vitest run` | **54 файлов, 940/940 tests** |

### Бейзлайн-контроль (5 сьютов «19 падений»)
`d3-request-flow, order-lifecycle-completion, booking-lifecycle-completion,
order-creation-consumer, booking-requested-consumer` →
**19 failed / 90 passed / 109 total** — точное совпадение бейзлайна
(распределение 1+2+1+14+1, те же заголовки). Не чинились (по инструкции).

### Затронутые области (должны быть зелёными)
- **Зелёные**: `d5-order-fullpage-audit`, `d6-booking-fullpage`,
  `ui-c6-request-server-authority`, `m4-guest-checkout`,
  `whatsapp-m2`, `whatsapp-m3`, `whatsapp-m5-sessions`.
- **Падали — доказано pre-existing**: `checkout-commercial-intent` (14×403 —
  тот же fixture-403 класс, что и 18 baseline), `d4-remediation-closure` (1),
  `d4-representative-chain` (2), `rbac-actions` (2).
  Проверка: прогон **тех же сьютов в чистом worktree `D:\travelhub_baseline`
  @ 0d7de62` → идентичные 17 (и 2) падения, множество заголовков
  **IDENTICAL** (сверка через `--json` compare-object). В официальный бейзлайн
  «19» они не входили и не чинились.

### Live-окружение
- backend `:4000` перезапущен, лог чист (outbox-циклы, без ошибок),
  live-DTO-check → 404 (не 422 ⇒ команда валидна);
- frontend `:3000` → 200.

## 9. Known gaps / follow-ups (out of Stage 1 scope)

- **Booking → Order (стадия 2)** — design-pass документ, STOP до ревью;
  поэтому `returnToRequest` заблокирован на активных bookings/payments.
- **Multi-order forward** (O2 поверх вернувшейся R1) — инвариант
  «один Order на commerceSequence» (unique referenceNumber); новые схемы
  нумерации/истории — в design pass.
- Order → Request для `SENT_TO_BOOKING` **с активными bookings** возможен только
  data-guard'ом (409) — точная политика partial-fulfillment/cancel-at-supplier —
  design pass.
- Дополнительно обнаруженные pre-existing (вне «19», не тронуты):
  `checkout-commercial-intent` 14, `d4-remediation-closure` 1,
  `d4-representative-chain` 2, `rbac-actions` 2 — идентично baseline worktree.
- Схема/миграции не менялись (новых колонок/таблиц нет — используются
  существующие status/history/audit).

## 10. How to re-run the gates

```powershell
# backend
npx tsc --noEmit
npx jest --runInBand                       # unit: 137/137
$env:NODE_OPTIONS="--max-old-space-size=4096"
npx jest --config test/jest-e2e.json --runInBand order-to-request
npx jest --config test/jest-e2e.json --runInBand d3-request-flow order-lifecycle-completion booking-lifecycle-completion order-creation-consumer booking-requested-consumer   # baseline = 19/109

# frontend
npx tsc --noEmit
npx vitest run                             # 54/940
```
