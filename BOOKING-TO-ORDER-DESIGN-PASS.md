# BOOKING → ORDER DESIGN PASS (стадия 2) — ТОЛЬКО ПРОЕКТИРОВАНИЕ

**Статус: STOP после документа.** Код стадии 2 не писался, схема/миграции не
менялись, коммитов нет. Документ — входная точка для ревью владельцем:
реализация начинается только после явного «ок» по открытым вопросам (§9).

Контекст: Stage 1 (Order → Request) реализован и отчитан в
`STAGE1-ORDER-TO-REQUEST-IMPLEMENTATION-REPORT.md`; полная бизнес-модель —
`Request ⇄ Order ⇄ Booking`; сегмент `Booking → Order` остаётся единственной
нереализованной обратной стадией (M4-аудит: `M4-LIFECYCLE-VERIFICATION-REPORT.md`,
вердикт LIFECYCLE FAIL — обе обратные ветки отсутствуют).

---

## 1. Рамки проектирования

Что ДОЛЖНО покрыть решение (по задаче владельца): **платежи, поставщик и
наличие, подтверждение, данные путешественника, финансовые операции, статусы
Booking** — плюс сквозное: связи/история/аудит/RBAC/события/тесты.

Что уже НЕ обсуждается (принято в Stage 1 и не откатывается):
- действие «назад» реализуется как **первая команда state machine** с
  guards до мутаций, атомарным CAS в одной транзакции, immutable history,
  единым canonical-событием и явной 409-идемпотентностью повтора;
- `convertedOrderId/convertedAt`, `customerId`, `commerceSequence` —
  неприкосновенны; новые сущности при возврате не создаются;
- сервер-авторитетная проекция `availableActions` = state machine + gates +
  granular permissions; фронтенд только рендерит.

## 2. Текущее состояние (факты кодовой базы, HEAD 0d7de62)

### 2.1 Forward-цепочка (реализована)
```
Request (CUSTOMER_ACCEPTED) ─convert─▶ Order (NEW, MKT-ORD-{SEQ} @unique)
Order: NEW → process → IN_PROCESSING → confirm → READY_FOR_BOOKING
     → send ─BookingRequested─▶ Booking (NEW) → prepare/send → SENT_TO_SUPPLIER
     → confirm → CONFIRMED → service → IN_SERVICE → complete → COMPLETED
```
- `Order.referenceNumber = MKT-ORD-{commerceSequence}` **@unique** — инвариант
  «один Order на commerce chain» (Stage 1 сделал повторный convert → явный 409).
- `Booking.orderId` — plain String без FK (ADR-0001), каскадного удаления нет.
- `ReservationStatus` = HELD / CONFIRMED / RELEASED — удержания наличия.

### 2.2 Обратные ветки (отсутствуют)
- **Booking → Order**: нет ни команды, ни эндпоинта, ни статусного маппинга.
  Order остаётся в `SENT_TO_BOOKING` навсегда, пока не исполнится/не закроется
  штатным forward'ом.
- Стадия 1 закрыла `returnToRequest` для заказов с bookings/payments
  (409) — намеренно: эти случаи и есть предмет данного документа.

### 2.3 Релевантные машины состояний
**BookingStatus** (13): `NEW, PREPARING_REQUEST, SENT_TO_SUPPLIER,
AWAITING_CONFIRMATION, CONFIRMED, IN_SERVICE, COMPLETED, NEEDS_CLARIFICATION,
SUPPLIER_REJECTED, CHANGE_REQUESTED, CANCELLATION_REQUESTED, CANCELLED,
PROBLEM`. Терминальные (конвенция `TERMINAL_BOOKING_STATUSES`):
`COMPLETED, CANCELLED, SUPPLIER_REJECTED`.

**Booking action-переходы** (`booking.service TRANSITIONS`):
prepare, send, requestClarification, resume, confirm, reject, service,
requestChange, resolveChange, requestCancellation, complete, cancel, problem.

**OrderStatus** (12): `NEW, IN_PROCESSING, WAITING_FOR_DATA, READY_FOR_BOOKING,
SENT_TO_BOOKING, PARTIALLY_FULFILLED, FULFILLED, READY_TO_CLOSE, CLOSED,
CANCELLED, PROBLEM, SUSPENDED`.

**Платежи**: `PaymentStatus = PENDING, AUTHORIZED, CAPTURED, FAILED, CANCELLED,
REFUNDED`; `OrderPaymentStatus` (UNPAID/PARTIALLY_PAID/PAID/… + refund-flow →
REFUNDED, см. d4-representative S15–S16); refund-сценарии уже существуют
(`refund-flow` e2e, D7 payment history по `orderId`).

**Финансы-события**: `OrderCreated` → `CommissionAccrualConsumer` (признание
PARTNER_COLLECT commission атомарно с созданием Order); payment-события
проецируются на Order (paidAmount/paymentStatus, `order.subscribers`);
`OrderCancelled` → `BookingSubscribers.onOrderCancelled` компенсирует активные
брони (CAS + `BookingHistory.cancelled_order` + `BookingCancelled`);
**подписчика Order на `BookingCancelled` нет** — возврат из Booking обязан это
исправить/учесть.

### 2.4 Что Stage 1 уже поставил на пути
- `returnToRequest` guards: linked Request = CONVERTED; bookings = 0;
  payments + refunds = 0; active-диапазон статусов.
- Любое решение стадии 2 должно либо **расширить** эти guards
  (branch «вернуть в Order», а не в Request), либо переадресовать заказ
  в Request сначала (нецелесообразно при активных бронях).

## 3. Ключевые развилки (решить до кода)

### В1. Точка входа и владелец операции
- **A (рекомендуется): команда на стороне Booking** — `returnToOrder`
  (или `cancelAndReturn`) в Booking state machine, оркестрация в
  `booking.service`, Order-переход — атомарный внутри той же транзакции
  (зеркало Stage 1, но «наоборот»: booking-домен владеет booking-CAS).
  Плюс: permissions/проекция/история Booking уже существуют; меньше новых
  surface. Минус: BookingService пишет в order-сущности (как order.service
  писал Request в Stage 1 — прецедент внутри одного prisma-схемного мира
  order/booking, допустимо тем же способом — prisma-only, без новых DI).
- **B: команда на стороне Order** — `returnFromBooking` в Order TRANSITIONS.
  Плюс: единая таблица Order-переходов. Минус: 1 Order → N Bookings —
  команда обязана агрегировать брони (какая именно вернулась?), что ломает
  today-модель «1 action = 1 aggregate CAS».
- **C: гибрид** — booking-команда + проекция Order получает отдельный
  read-only флаг «возврат возможен/выполнен».

### В2. Агрегация «1 Order → N Bookings»
Order может иметь несколько броней (стандартная отправка Booking Center'у
создаёт брони на каждый OrderItem; `PARTIALLY_FULFILLED` существует именно
из-за частичного исполнения). Варианты политики:
- **V2.1 «всё или ничего»**: возврат разрешён, только пока ни одна бронь не
  активна/не подтверждена (самое дешёвое, но почти бесполезно — подтверждённые
  брони и есть главный кейс).
- **V2.2 «возврат подтверждённой брони отдельно»**: каждая Booking возвращается
  независимо; Order агрегирует: все брони в terminal/cancelled → Order может
  уйти в `READY_FOR_BOOKING` (или `SENT_TO_BOOKING` без броней); часть
  активных → остаётся `PARTIALLY_FULFILLED`.
- **V2.3 «возврат всего заказа»**: одна операция отменяет все активные брони
  (каскадный cancel с supplier-уведомлениями) и возвращает Order одним CAS.

### В3. Статусная матрица (черновик на ревью)

| Состояние Booking | Кандидат возврата в Order | Смысл | Ставня/условие |
|---|---|---|---|
| NEW / PREPARING_REQUEST | не нужен (booking отменяется, Order остаётся SENT_TO_BOOKING→READY_FOR_BOOKING) | бронь не ушла поставщику | free |
| SENT_TO_SUPPLIER / AWAITING_CONFIRMATION | `returnToOrder` → Order `READY_FOR_BOOKING` | отказ от отправки/переотправка | free (до подтверждения поставщиком) |
| NEEDS_CLARIFICATION / CHANGE_REQUESTED / PROBLEM | `returnToOrder` → Order `PROBLEM` или `READY_FOR_BOOKING` | проблема на уровне заказа | решение по SLA |
| CONFIRMED / IN_SERVICE / CANCELLATION_REQUESTED | **самый дорогой кейс**: отмена у поставщика + возврат в `SENT_TO_BOOKING` (переоформление) | штрафы/политики отмены | требует §5 и §6 |
| SUPPLIER_REJECTED | Order `PROBLEM` (или `READY_FOR_BOOKING` для переотправки) | естественный возврат | free |
| COMPLETED | Order `FULFILLED` → `READY_TO_CLOSE` | исполнен — закрывающие операции | финансы §6 |
| CANCELLED | агрегат: активных нет → Order по §В2 | уже возвращён | — |

Открытая развилка: **отдельная команда для pre-confirm vs post-confirm**
(разные guard'ы и обязательные компенсации) или одна команда со
стейт-зависимыми под-gates.

### В4. Подтверждение (re-confirmation)
- Данные D3 на Order (`finalConfirmedAt`, `travelerCount`, pinned snapshot) —
  переживают возврат или сбрасываются? Кандидат: **не сбрасывать** (immutable
  snapshot-философия D3), но для повторной отправки Booking Center'у требовать
  **операторское re-confirm** (новая команда или reuse `confirm` после
  перевода Order в `READY_FOR_BOOKING`).
- Клиентское re-accept (Request-уровень) при возврате из Booking —
  НЕ предлагать: клиент уже принял условия; возврат — операционное решение.
  Исключение: если изменилась цена → это уже price-change цикл на Request,
  но Request в CONVERTED → ветка «вернуть в Request» (Stage 1) сначала.
- Проверка наличия (availability re-check) перед повторной отправкой —
  обязательный шаг, если возврат из `CONFIRMED/IN_SERVICE` (см. §5).

### В5. Данные путешественника
- OrderTraveler (D3, immutable после final-confirm) vs Booking Passenger
  (frozen копия при создании брони). Возврат НЕ должен трогать обе таблицы.
- **PII**: паспортные данные уже уходили поставщику через бронь; возврат не
  « отзывает » их — зафиксировать в отчёте/аудите фактическую передачу;
  никаких автоматических «удалений у поставщика» не проектировать без
  юридического требования (открытый вопрос §9-Q6).
- Сверка travelerCount на Order ↔ число пассажиров в возвращаемых бронях —
  guard: расхождение → 409 (данные не согласованы, ручное решение).

## 4. Платежи (§ по задаче владельца)

Текущее: платежи привязаны к Order (`Payment.orderId`, finance-схема);
Stage 1 блокирует `returnToRequest` при payments/refunds > 0; D7-история
платежей читается по Order.

Проектируемое:
1. Возврат Booking → Order **не трогает** платежи автоматически (никаких
   auto-refund внутри lifecycle-команды) — деньги отдельный bounded context.
2. Гварди: если `Payment ∈ {AUTHORIZED, CAPTURED}` по возвращаемому Order →
   команда возврата **доступна только** с явным финансовым precondition'ом:
   либо 409 («сначала refund»), либо флаг `withFinancialSettlement` в отдельной
   фин-оркестровке (см. В6/§6). Рекомендация: **409 + подсказка** —
   lifecycle-команда остаётся «чистой».
3. `OrderPaymentStatus` при возврате не меняется (он отражает деньги, а не
   операционную стадию).
4. Провайдерские `PaymentStatus` (AUTHORIZED) — рекомендация: void до capture
   остаётся платёжной операцией, не Booking-возвратом.

## 5. Поставщик и наличие (§)

1. **Уведомление поставщика**: возврат из `SENT_TO_SUPPLIER/AWAITING_CONFIRMATION`
   — notify (best-effort, не влияет на атомарность); из `CONFIRMED/IN_SERVICE` —
   cancellation request по существующему `requestCancellation`-пути, затем
   возврат Order после подтверждения отмены (двухфазный кейс!).
2. **Наличие/резервы**: `Reservation (HELD/CONFIRMED)` — на возврате должен
   сработать RELEASE (если ещё HELD); сейчас владелец Reservation — booking-
   домен → освобождение в той же транзакции возврата (CAS HELD→RELEASED,
   идемпотентно).
3. **Штрафы/политики отмены post-confirm**: вычисление cancellation fee —
   НЕ встраивать в lifecycle-команду; сначала guard «нет штрафов к учёту» либо
   fee-квота как входной параметр фин-модуля (открытый вопрос §9-Q3).
4. **Повторная отправка**: после возврата в `READY_FOR_BOOKING` штатный `send`
   создаёт НОВУЮ бронь — проверить инвариант «1 OrderItem → ≤1 Booking»
   (`orderItemId @unique`): старая бронь обязана быть terminal/CANCELLED до
   новой, иначе unique-conflict. Добавить guard.

## 6. Финансовые операции (§)

1. **Commission** (PARTNER_COLLECT, признан на OrderCreated): при возврате с
   последующим `Order.CANCELLED`/`REFUNDED` нужен reversal/reversal-квота —
   сегодня reversal-цепочки нет в коде → проектировать **новый доменный факт**
   `CommissionReversed` (не писать в леджер «молча»).
2. **Refund-ы**: существующий refund-flow (partial/full, over-refund 409) —
   возврат из Booking НЕ создаёт refund автоматически; связка только через
   guard (§4.2) и через фин-панель оператора.
3. **Ledger/провайдерские сборы**: provider-fee settlement/payout — касаются
   payout-циклов; возврат брони не должен трогать payouts, кроме явного
   full-cancel Order'а (открытый вопрос §9-Q4: partial payout hold?).
4. **Chargeback**: не в скоупе — отдельная инициатива (chargeback-dispute уже
   имеет фундамент).

## 7. История, события, аудит

- **BookingHistory**: новая action `returned_to_order` (from → to, actor,
  reason) — конвенция Stage 1.
- **OrderHistory**: новая action `returnFromBooking`
  (`SENT_TO_BOOKING|PARTIALLY_FULFILLED|… → READY_FOR_BOOKING|PROBLEM|…` по §В3).
- **События**: расширить семейство — кандидаты `BookingReturnedToOrder`
  (canonical факт) и обязательно **`OrderStatusChanged`** для уже
  существующих projection-подписчиков; если итоговый Order-статус CANCELLED —
  штатный `OrderCancelled` (уже компенсирует брони — согласованность).
  Слушатели, которых НЕ хватает сегодня: подписчик Order на
  `BookingCancelled` (§2.3) — добавить в design-реализацию.
- **AuditLog**: `booking.return_to_order` + детали (orderId, bookingId(s),
  from/to, reason, financials guard-решения) — тот же контракт, что
  `order.returned_to_request`.
- **Outbox/inbox**: ровно один outbox-запись на фактический переход (паттерн
  canonical consumer), идемпотентность через InboxEvent + unique aggregate.

## 8. Связи, RBAC, проекции, UX

- `Booking.orderId` — НЕ трогать (историческая ссылка сохраняется, как
  `convertedOrderId` в Stage 1).
- Permission: новая granular-ключ (кандидат `booking.return_to_order`,
  приоритет — отделить от `booking.cancel`, т.к. это не отмена, а возврат в
  заказ; альтернатива — переиспользовать `order.request_booking`/`order.cancel`
  — вопрос §9-Q7).
- Проекция `availableActions` Booking: добавить флаг по той же схеме
  (status ∈ from ∧ gates ∧ permission); Order-проекция — read-only индикатор.
- Фронтенд: новая кнопка в `OrderActionBar`/`BookingActionBar` по
  сервер-проекции + confirm-диалог + ru/az/en ключи (шаблон Stage 1).

## 9. Открытые вопросы к владельцу (решить до кода)

1. **Q1 Агрегация**: политика V2.1/V2.2/V2.3 (§В2) для нескольких броней?
2. **Q2 Матрица §В3**: одобрить строки статусов; нужны ли отдельные команды
   pre-confirm vs post-confirm?
3. **Q3 Штрафы поставщика**: учитывать cancellation fee в возврате — где и
   когда (отдельная фин-операция до возврата / после)?
4. **Q4 Деньги-гвард**: 409 «сначала refund» (рекомендую) или авто-ветка
   `withFinancialSettlement` внутри операции?
5. **Q5 Partial**: `PARTIALLY_FULFILLED`-поведение — возврат одной брони
   оставляет заказ активным? (следует из Q1)
6. **Q6 PII поставщика**: фиксировать факт передачи паспортных данных возвратом
   или дополнительные обязательства (уведомление/запрос удаления)?
7. **Q7 Право действия**: новый `booking.return_to_order` vs существующее
   `order.cancel` / `booking.cancel`?
8. **Q8 Commission reversal**: новый доменный факт сейчас или только guard
   «комиссия не подтверждена» на возврат?
9. **Q9 Повторная отправка**: подтвердить инвариант ожидания terminal-брони
   перед новым `send` (§5.4).

## 10. Тестовая стратегия (design-level)

- Unit: статусная матрица (from/to × guards × permissions) — таблицей;
  агрегационные гварди (§В2, travelerCount-сверка, reservation release).
- E2E: новая цепочка `R→O→B→O` (возврат pre-confirm), `→CONFIRMED→return`
  (с compensation'ом), partial-кейс (Q1/Q5), фин-гвард 409 (Q4),
  идемпотентность повтора 409, history/audit/outbox-ассерты (шаблон Stage 1).
- Регрессия: обязательный прогон бейзлайна «19» + затронутых сьютов
  (командословие Stage 1 §8), сравнение с `D:\travelhub_baseline`.

## 11. Следующие шаги

1. Владелец отвечает на §9 (Q1–Q9) → фиксируются решения в этом документе.
2. Уточняющая сверка кода по ответам (reservation-владелец, commission-
   reversal, payout-циклы) — без правок.
3. Только затем — план реализации (файлы/миграции/тесты) и повторное ревью.

**STOP. Реализация Booking → Order не начата.**
