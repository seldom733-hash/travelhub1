# PHASE 2 — STEP 2.8A — BOOKING SERVICE DATE / TIME MODEL — REPORT

## 1. Verdict

**`PHASE 2 STEP 2.8A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`**

## 2. Repository baseline

- Branch `master`, work-in-progress (не коммитится в этом шаге).
- Migrations: 45/45 applied, drift 0 (`prisma migrate status` up to date;
  `prisma migrate diff --from-migrations --to-schema-datamodel --exit-code` = 0).
- 2.8 status: STRICT REVIEW COMPLETED — APPROVED. 2.8A не был начат до этого шага.

## 3. Sources inspected

Roadmap v3 (2.8A wording), implementation prompt, `schema.prisma`,
`shared/date-only.ts`, `shared/temporal.ts`, `shared/service-time.ts` (new),
Sales (`sales.service.ts`, `checkout.controller.ts`, `sales.validation.ts`,
`sales.contracts.ts`, `sales.checkout.ts`), Order (`order.service.ts`,
`order.controller.ts`, `order.validation.ts`, `order-requested.consumer.ts`),
Booking (`booking.subscribers.ts`, `booking.service.ts`, `booking-query.service.ts`,
`booking.controller.ts`, `booking.validation.ts`), Catalog (`catalog.service.ts`,
`catalog.controller.ts`, period/restriction validations), Buyer Cabinet
(`account.service.ts`), events (`domain-events.ts`, `docs/contracts/events.md`),
e2e suites 2.5B/2.8/buyer-cabinet, test fixture `create-order.fixture.ts`.

## 4. Current → Target temporal mapping

До 2.8A единственный temporal факт в цепочке — `serviceDate` (date-only):
QuoteItem → CheckoutIntent → Sale → OrderRequested → Order/OrderItem → Booking.
2.8A добавляет/пропагирует: `serviceTime` (local HH:mm), `serviceEndTime`
(local HH:mm), `serviceTimeZone` (IANA), и деривирует `serviceStartsAt`/
`serviceEndsAt` (UTC instants) + `serviceTimeType` на Booking. Отложено:
duration/end-авторитет, time-slot capacity, reschedule.

## 5. Architecture / domain ownership

Catalog = authority timezone (`Product.serviceTimeZone`); Sales = freeze
(CheckoutIntent binding + verbatim в OrderRequested); Order = ordered
fulfillment intent (frozen facts); Booking = operational occurrence derived
from frozen facts (ОДИН раз при создании, никакого live-резолва Catalog).

## 6. Canonical temporal vocabulary

`serviceDate` (date-only) + `serviceTime`/`serviceEndTime` (local HH:mm) +
`serviceTimeZone` (IANA) + `serviceStartsAt`/`serviceEndsAt` (derived UTC) +
`serviceTimeType` (`DATE_ONLY` | `TIME_SLOT` | `OPEN_DATE` | `DATE_RANGE`
зарезервирован).

## 7. Date-only semantics

Date-only услуга: `serviceStartsAt` = NULL (00:00 НЕ фабрикуется, §7);
e2e 35.18/36.1. `serviceTimeType = DATE_ONLY` — default корректно
классифицирует legacy.

## 8. Timezone authority

Только IANA через `Product.serviceTimeZone` (валидация
`Intl.supportedValuesOf("timeZone")`). Zone frozen в CheckoutIntent при
binding, verbatim дальше. Forged zone/instant → 422 (e2e 35.3/35.4/35.6).

## 9. DST semantics

`shared/service-time.ts` — Intl-оффсеты, без ручной арифметики:
ambiguous → ранний instant; nonexistent → сразу после разрыва. Unit-тесты
16/16 (вкл. фиксированные DST-даты Europe/Berlin); e2e 36.6 (zone-aware,
не naive UTC).

## 10. Service-date authority

Booking потребляет frozen факты из Order (READ-only, ADR-0001). Seller
редакция zone (e2e 35.9) и цены (e2e 35.10) НЕ мутируют созданную Booking.

## 11. BookingRequested temporal contract

НЕ расширен (minimal §11) — consumer читает frozen факты из Order по orderId.

## 12. Booking persistence model

`serviceTimeType` (enum, default DATE_ONLY) + `serviceTime` +
`serviceEndTime` + `serviceTimeZone` + `serviceStartsAt` + `serviceEndsAt`
(все nullable, additive). Semantics/authority/nullability/immutability/legacy
— в `docs/architecture/booking-service-time-model.md`.

## 13. Local fact ↔ UTC instant invariant

Enforced при записи (одна деривация, детерминированно, Intl). Date-only →
NULL instant.

## 14. Multi-day semantics

`TIME_SLOT` + `serviceEndTime`; end ≤ start → следующий local день
(cross-midnight). Отдельный duration-авторитет НЕ создавался (§14); `DATE_RANGE`
зарезервирован. e2e 36.7.

## 15. CommercialPeriod boundary

НЕ изменялся; Booking не rerun-ит period selection (frozen facts).

## 16. CommercialRestriction boundary

НЕ изменялся; restriction edits не переписывают bound Booking (нет
post-binding rewrite path; e2e 35.10/35.11).

## 17. Price freeze

`Booking.amount` = frozen `OrderItem.amount`; никакого reprice (e2e 35.10/36.12).

## 18. Availability ownership

Никакого второго hold: hold создаётся ровно один раз (Sale completion);
Booking consumer availability не трогает (e2e 35.19 — hold count неизменен).

## 19. Time-slot decision

Roadmap требует только факты — **TimeSlot entity/table НЕ создавалась**
(§19 CRITICAL). slot-capacity — вне 2.8A.

## 20. Category compatibility

Категорийно-нейтральный shared модель (service occurrence, не «departure»);
e2e 36.8 (TOUR + TRANSFER в одном Order).

## 21. Seller mutation boundary

Seller Catalog edits не мутируют существующие Booking (frozen); e2e 35.9/35.10.

## 22. Buyer mutation boundary

Buyer не может overwrite frozen occurrence: RBAC 403 (e2e 35.8) + forged
temporal PATCH → 422 (e2e 35.7).

## 23. Mass assignment

Loud forbidden-key convention: `CHECKOUT_SERVICE_DATE_FORBIDDEN_KEYS`,
`ORDER_ACTION_FORBIDDEN_KEYS`, `BOOKING_ACTION_FORBIDDEN_KEYS` extended;
forge → 422 (не silent-strip).

## 24. Booking lifecycle interaction

Temporal факты immutable на текущем lifecycle (reschedule вне 2.8A);
статус-переходы не затрагиваются (e2e 35.17 — legacy управляется).

## 25. Legacy compatibility

Additive nullable колонки; legacy date-only строки — `DATE_ONLY` (default);
legacy без даты читаемы/управляемы (e2e 35.17); без fake backfill.

## 26. Migration

Две аддитивные Prisma-миграции (enum + колонки; ProductDraft zone).
`migrate dev --create-only` → reviewed SQL → apply; 45/45, drift 0, replay OK
(изолированная test DB fresh-apply в каждой e2e-сессии).

## 27. IDs / indexes

Новых ID/индексов нет (value object, не entity; нет calendar/reporting engine).

## 28. API projections

Buyer Cabinet: `serviceDate` (ISO — конвенция проекции), `serviceTime`
(HH:mm), `serviceTimeZone` (IANA), `serviceStartsAt` (ISO instant). Staff
`GET /bookings/:id` — полные temporal колонки. Без внутренних refs/PII.

## 29. Serialization

date-only → ISO (кабинетная конвенция isoOrNull); time → `HH:mm`; zone →
IANA ID; instant → ISO-8601.

## 30. Validation

`shared/service-time.ts` (pure): ISO date, HH:mm, IANA, DST-детерминизм.
OrderRequested payload: time требует zone + serviceDate (STRICT REVIEW fix),
endTime требует time, zone — IANA; дефект ленты → FAILED (e2e 35.15 a/b).

## 31. Concurrency

CAS сохранены; consumer-транзакция атомарна (Booking + Passenger + History +
Inbox + result-event + temporal факты).

## 32. Idempotency

Сохранены: inbox dedup, business dedup (existing>0), DB unique
`Booking_orderItemId_key`; e2e 35.12/35.13 (re-delivery + logically-duplicate).

## 33. Failure atomicity

Весь consumer-обработка в одной транзакции; unknown unique → проброс (FAILED),
не проглатывание.

## 34. BookingCreated event

НЕ расширен (§30). Correlation = BookingRequested.correlation, causation =
BookingRequested.eventId (e2e 36.15+16).

## 35. Correlation / causation

Сохранены и доказаны e2e (36.15+16).

## 36. Acquisition source

DIRECT / BUYER_REQUEST / legacy null пропагируются verbatim без мутации
temporal (e2e 36.9/36.10/36.11).

## 37. PII

Passenger PII не входит в события/history/audit (2.8 STRICT REVIEW сохранён);
новые temporal факты PII-free.

## 38. Audit / history

`created` BookingHistory entry корректен (e2e 36.18); temporal факты
immutable → истории достаточно.

## 39. Query paths

Дополнительных индексов не добавлялось (нет обоснованных query paths).

## 40. Public/catalog regression

`priceFrom`/period/availability пути не изменены (полный e2e 949/949).

## 41. Reverse Marketplace regression

Reverse→Booking цепочка не изменена (полный e2e: reverse suites зелёные;
никакого Reverse-specific Booking writer).

## 42. No-second-engine audit

Нет: второго pricing/restrictions/availability engine, второго Booking writer
(POST /bookings → 404, e2e 35.20), прямого Order→Booking write, speculative
TimeSlot entity.

## 43. Negative tests

e2e 35.1–35.21 (матрица §35): invalid date/time/zone, offset-as-zone,
time-without-zone, forged instant/zone, forged Booking PATCH, Buyer 403,
Seller edit не мутирует, no-reprice, duplicates (re-delivery + logical),
malformed payload FAILED, legacy null, no-midnight, no-second-hold,
no-direct-writer, no raw 500. Inapplicable cases (35.11/35.14/35.16/35.21)
marked with reason.

## 44. Positive tests

e2e 36.1–36.23 (матрица §36): date-only, exact-time, zone-aware,
local→UTC (Baku детерминированно), non-DST (Baku), DST (Berlin),
cross-midnight, категорийная нейтральность, DIRECT/BUYER_REQUEST/legacy null
acquisition, frozen money, E2E propagation, cardinality, один BookingCreated,
correlation/causation, Passenger, history, hold, buyer/staff projections.

## 45. Unit tests

`service-time.spec.ts` 16/16 (HH:mm, IANA, DST ambiguous/nonexistent, offset,
local→UTC, date-only, cross-midnight end-date).

## 46. Targeted regression

2.8 consumer 14/14, 2.5B acquisition 13/13, buyer-cabinet 8/8,
order-creation-consumer 14/14, order-lifecycle-completion, remove-bootstrap-order,
order-temporal-contract, order-canonical-events — все зелёные.

## 47. Full backend regression

`tsc --noEmit` OK; `npm run build` OK; unit 475/475 (39 suite);
e2e 949/949 (54 suite, serial).

## 48. Frontend regression

`tsc --noEmit` OK; vitest 135/135 (23 files); `next build` OK (backend-only
step, frontend untouched).

## 49. DB regression

`prisma migrate status` 45/45 up to date; `prisma migrate diff
--from-migrations --to-schema-datamodel --exit-code` = 0 (drift 0);
fresh replay — каждая e2e-сессия применяет миграции в изолированную test DB.

## 50. Issues found and fixed

1. STRICT REVIEW (independent review): `OrderRequested` payload допускал
   `serviceTime` без `serviceDate` → потенциально несогласованные факты
   (OPEN_DATE + time) на Booking. FIX: валидация «time requires serviceDate»
   + регрессия e2e 35.15(b).
2. Review robustness: regex offset `\d{2}` → `\d{1,2}` (ICU-варианты).
3. Тестовые находки в ходе разработки: Booking confirm требует
   SENT_TO_SUPPLIER (409); BookingCreated.aggregateId = booking id (payload
   lookup); Decimal `.toString()` без trailing zeros (`.toFixed(2)`);
   кабинетная сериализация serviceDate — ISO (конвенция isoOrNull);
   buyer-cabinet exact-keys обновлены (+serviceTime/serviceTimeZone на Order,
   item-level дублирование убрано).

## 51. Architecture decision status

Архитектурных стоп-условий (§40) НЕ возникло; ADR не требовались.

## 52. Documentation changes

`docs/architecture/booking-service-time-model.md` (new);
`docs/contracts/events.md` (OrderRequested +3 поля; BookingRequested/
Booking consumer temporal note);
`docs/contracts/api.md` (Catalog zone authority; Order/Booking temporal
контракты);
Roadmap v3 (статус 2.8A, активный item → 2.8A STRICT REVIEW, header).

## 53. Roadmap update

Step 2.8A → `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`;
Active/NEXT → `PHASE 2 — STEP 2.8A — STRICT REVIEW`.

## 54. Deferred / extension points

TimeSlot entity + slot-capacity (Availability slot-model gate); reschedule;
DATE_RANGE продуцирование (duration/end-авторитет); category-specific time
требования (CategorySchema, вне 2.8A).

## 55. Out-of-scope confirmation

2.9 (Booking Lifecycle Completion) и 2.9A НЕ начаты; 2.8A Strict Review в этом
пасе не проводится (§44 STOP).

## 56. Exact files changed

- `backend/prisma/schema.prisma` (+BookingServiceTimeType; temporal колонки
  Product/ProductDraft/CheckoutIntent/Sale/Order/Booking)
- `backend/prisma/migrations/20260812212139_add_booking_service_time_model/`
  (new), `…add_product_draft_service_time_zone/` (new)
- `backend/src/shared/service-time.ts` (new), `service-time.spec.ts` (new)
- `backend/src/modules/catalog/catalog.service.ts`, `catalog.controller.ts`
- `backend/src/modules/sales/sales.service.ts`, `checkout.controller.ts`,
  `sales.validation.ts`, `sales.contracts.ts`
- `backend/src/modules/order/order.service.ts`, `order.validation.ts`
- `backend/src/eventbus/domain-events.ts`
- `backend/src/modules/booking/booking.subscribers.ts`, `booking.validation.ts`
- `backend/src/security/account/account.service.ts`
- `backend/test/fixtures/create-order.fixture.ts`
- `backend/test/booking-service-time-model.e2e-spec.ts` (new, 40 тестов)
- `backend/test/buyer-cabinet.e2e-spec.ts` (projection keys)
- `docs/contracts/events.md`, `docs/contracts/api.md`,
  `docs/architecture/booking-service-time-model.md` (new),
  `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`,
  `docs/prompts/PHASE_2_STEP_2.8A_BOOKING_SERVICE_DATE_TIME_MODEL_REPORT.md` (new)

## 57. Exact NEXT item

`PHASE 2 — STEP 2.8A — STRICT REVIEW`
