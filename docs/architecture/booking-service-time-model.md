# PHASE 2 STEP 2.8A — BOOKING SERVICE DATE / TIME MODEL — ARCHITECTURE

**Status:** IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW
**Prompt:** `docs/prompts/PHASE_2_STEP_2.8A_BOOKING_SERVICE_DATE_TIME_MODEL.md`
**Roadmap:** v3, item `PHASE 2 — STEP 2.8A — Booking Service Date / Time Model`
**Previous gate:** `PHASE 2 STEP 2.8 STRICT REVIEW COMPLETED — APPROVED`

---

## 1. Mission and boundary

Закрыть date/time boundary, намеренно отложенный в Steps 1.8C/1.8D: Booking
должна нести **frozen service occurrence** (календарная дата + опциональное
точное локальное время + IANA timezone + деривированные UTC instants),
пропагированные канонической цепочкой `Catalog → Quote → CheckoutIntent →
Sale → OrderRequested → Order/OrderItem → BookingRequested → Booking`.

Вне scope 2.8A (не вводить — гейты из Roadmap/prompt §19/§21/§23):
- reusable TimeSlot entity/table — Roadmap требует только факты, не слот-модель;
- slot-level capacity — Availability не имеет approved slot model;
- rescheduling после binding — отсутствует в 2.8A (temporal факты immutable);
- второй scheduling/pricing/availability authority.

## 2. Canonical temporal vocabulary (§6)

| Факт | Семантика | Хранение | Кто владеет |
|---|---|---|---|
| `serviceDate` | local calendar date, когда услуга начинается/потребляется | date-only (UTC midnight) | Sales (freeze), Order/Booking (verbatim) |
| `serviceTime` | local wall-clock start `HH:mm` | String `HH:mm` | Sales (freeze), Order/Booking (verbatim) |
| `serviceEndTime` | local wall-clock end `HH:mm` (только с `serviceTime`; end ≤ start = cross-midnight) | String `HH:mm` | Sales (freeze), Order/Booking (verbatim) |
| `serviceTimeZone` | authoritative IANA zone | String (IANA ID) | **Catalog** (authority) → frozen в Sales → verbatim дальше |
| `serviceStartsAt` / `serviceEndsAt` | деривированные UTC instants | DateTime | Booking (derived ОДИН раз при создании) |
| `serviceTimeType` | `DATE_ONLY` \| `TIME_SLOT` \| `OPEN_DATE` \| `DATE_RANGE` | enum | Booking (derived из presence-фактов) |

`DATE_RANGE` зарезервирован и НЕ продуцируется текущим flow: требует
canonical duration/end-авторитета (§14), которого нет — multi-day обслуживается
как `TIME_SLOT` с `serviceEndTime` на следующем local дне (cross-midnight),
без отдельного duration-авторитета.

## 3. Timezone authority (§8) — HARD GATE

- Единственный источник: `Product.serviceTimeZone` (IANA), задаваемый Seller
  (staff/ADMIN) при create/update Product (в т.ч. через change-proposal/draft).
- Валидация: `Intl.supportedValuesOf("timeZone")` (Node ≥ 18.12 full-icu) —
  никаких ручных списков, никакого browser/locale/IP/server-zone/offset authority.
- Zone **замораживается** в `CheckoutIntent` при binding (читается из продуктов
  Quote-items, server-derived). Клиент не может передать/forge zone на checkout
  (forbidden key → 422).
- `serviceTime` без zone невозможен: checkout service-date → 422 («no service
  timezone»); дефект ленты (time без zone в OrderRequested) → событие FAILED,
  никакого Order (defensive, честный FAILED).

## 4. DST semantics (§9)

Конверсия local → UTC — чистая функция `shared/service-time.ts` через
`Intl.DateTimeFormat` offset'ы (никакой ручной offset-арифметики):

- **нормальный день** — единственный валидный instant;
- **ambiguous** (fall-back, время встречается дважды) — детерминированный выбор
  **раннего** instant (pre-transition offset);
- **nonexistent** (spring-forward gap) — instant сразу после разрыва: wall time
  в пост-переходном offset + сдвиг на величину gap.

Covered: 16 unit-тестов (вкл. фиксированные даты для DST-зоны Europe/Berlin) +
e2e DST-zone (не-naive-UTC проверка).

## 5. Service-date authority (§10) — frozen, не live

Booking создаётся ТОЛЬКО consumer-ом `BookingRequested` и потребляет frozen
факты из Order/OrderItem (READ-only, ADR-0001). Никакого query текущего Catalog
при создании Booking: seller-редакции zone/цены/restrictions не переписывают
созданную Booking (доказано e2e 35.9/35.10).

## 6. Price freeze (§17) / Availability (§18) — HARD GATES

- `Booking.amount` = `OrderItem.amount` frozen (no reprice path; e2e 35.10/36.12).
- Никакого второго capacity hold: hold создаётся ровно один раз (Sale
  completion, `availabilityReservation.sourceSaleId`); Booking consumer
  availability не трогает (e2e 35.19 — hold count неизменен после Booking).

## 7. Local ↔ UTC invariant (§13)

`local date + local time + IANA zone ↔ UTC instant` enforced при записи
(деривация один раз, детерминированно). Для date-only: UTC instant = NULL
(00:00 НЕ фабрикуется — §7; e2e 35.18).

## 8. Booking persistence (§12) и legacy (§24)

- Additive nullable колонки; `serviceTimeType @default(DATE_ONLY)` корректно
  классифицирует legacy date-only строки; legacy без даты — читаемы/управляемы
  (e2e 35.17), никакого fake backfill.
- Immutability: temporal факты неизменяемы на текущем lifecycle (reschedule
  вне 2.8A); forged temporal PATCH (Booking/Order/Checkout) → 422 (конвенция
  `assertNoForbiddenKeys`, §22/§28).

## 9. Idempotency / cardinality (§28/§29) — сохранены

`1 OrderItem → 1 Booking` (`Booking.orderItemId @unique`), inbox dedup,
business-invariant dedup (existing>0), DB unique; P2002 allowlist строго
`Booking_orderItemId_key` + `InboxEvent_consumerId_eventId_key` (unknown unique
→ проброс, FAILED). Доказано: 2.8 suite + e2e 35.12/35.13.

## 10. Events (§11/§30)

- `BookingRequested` payload НЕ расширен (minimal) — temporal факты читаются
  consumer-ом из Order.
- `OrderRequested` payload + `serviceTime`/`serviceEndTime`/`serviceTimeZone`
  (frozen verbatim; валидируются consumer-ом Order).
- `BookingCreated` НЕ расширен (нет consumer-а требующего temporal);
  correlation/causation сохранены.

## 11. Query paths / projections (§26/§32)

- Buyer Cabinet (`/account/bookings`, `/account/orders`): `serviceDate`
  (ISO — устоявшаяся конвенция проекции isoOrNull), `serviceTime` (HH:mm),
  `serviceTimeZone` (IANA), `serviceStartsAt` (ISO instant).
- Staff `GET /bookings/:id`: полные temporal колонки.
- Индексов НЕ добавлено сверх нужды (нет calendar/reporting engine в 2.8A).

## 12. No-second-engine audit (§34)

2.8A не вводит: второй pricing engine, второй restrictions engine, второй
Availability engine, второй Booking writer (POST /bookings → 404; прямой
Order→Booking write отсутствует), второй calendar authority, speculative
TimeSlot entity. Репозитарная проверка: e2e 35.20 + grep-аудит.

## 13. Migrations

- `20260812212139_add_booking_service_time_model` (enum + Booking/Order/
  OrderItem/CheckoutIntent/Sale колонки; additive, nullable, default enum);
- `…add_product_draft_service_time_zone` (ProductDraft.serviceTimeZone —
  change-proposal path для PUBLISHED).
- 45/45 applied, drift 0; clean replay.

## 14. STRICT REVIEW clarifications (2026-08-13, APPROVED — 0 дефектов)

Задокументированные решения по итогам независимого adversarial-аудита:

1. **Mixed/no-zone quote → order-level zone freeze.** Zone замораживается если
   РОВНО ОДИН non-null IANA zone у всех quote-items; mixed (A vs B) → NULL
   (exact-time недоступен, 422). Кейс «один product с zone + один без zone»:
   zone объявленная product-ом замораживается (order-level occurrence model) —
   item date-only product-а становится TIME_SLOT вместе с order-level time.
   Осознанная семантика (product без zone не «вето», а «не ограничивает»);
   конфликтующих зон никогда не бывает — только единая или NULL.
2. **Clear-time требует явный `serviceEndTime: null`.** `{ serviceTime: null }`
   при живом `serviceEndTime` → 422 «serviceEndTime requires serviceTime»
   (никакого silent-clear/ambiguous state); дата-only возврат = оба null.
3. **±12h candidate window** в `localToUtc` — покрывает все реальные DST-
   переходы; теоретический лимит — исторические переходы >12h (Samoa 2011
   skip суток), для сервисных дат (текущие/будущие) недостижим. Принято.

## 15. Deferred / extension points

- Reusable TimeSlot + slot-capacity (требует Availability slot-model —
  Roadmap gate);
- rescheduling (пост-binding мутация temporal — отсутствует в 2.8A);
- DATE_RANGE продуцирование (требует duration/end-авторитета);
- category-specific time требования (например hotel check-in time) — через
  CategorySchema, вне 2.8A.
