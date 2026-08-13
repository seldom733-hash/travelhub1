# PHASE 2 — STEP 2.8A — BOOKING SERVICE DATE / TIME MODEL — STRICT REVIEW

**Project:** TravelHub
**Mode:** STRICT REVIEW / REVIEW FIXES ONLY
**Entering status:** `PHASE 2 STEP 2.8A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
**Expected NEXT only if approved:** `PHASE 2 — STEP 2.9 — BOOKING LIFECYCLE COMPLETION` (по Roadmap после 2.8A)
**Hard stop:** do not implement Step 2.9 in this pass.

## 1. Verdict

**`PHASE 2 STEP 2.8A STRICT REVIEW COMPLETED — APPROVED`**

Независимый adversarial-аудит не выявил ни одного дефекта (кода/инвариантов/
безопасности). Три наблюдения зафиксированы как задокументированные решения
(секция 40); код не менялся в ходе ревью (docs-only clarifications).

## 2. Mission

Verify the actual Step 2.8A implementation: canonical temporal vocabulary,
timezone authority (IANA, не offset/browser/locale), DST handling, frozen
service-date authority end-to-end, date-only «no midnight» semantics,
local↔UTC invariant, single derivation point, mass-assignment (422), price
freeze, no second Availability hold, no speculative TimeSlot entity,
idempotency/cardinality preservation, legacy compatibility, migration safety,
and the 2.8A ↔ 2.9 boundary. Do not approve from the implementation report
alone.

## 3. Sources

- Prompt `docs/prompts/PHASE_2_STEP_2.8A_BOOKING_SERVICE_DATE_TIME_MODEL.md`
  (§5–§34 hard gates; §35/§36 test matrices; §39 adversarial checklist);
- Implementation report `PHASE_2_STEP_2.8A_BOOKING_SERVICE_DATE_TIME_MODEL_REPORT.md`;
- Architecture artifact `docs/architecture/booking-service-time-model.md`;
- Code: `shared/service-time.ts` (+spec), `booking.subscribers.ts`,
  `sales.service.ts` (checkout create / setCheckoutServiceDate / completeSale),
  `checkout.controller.ts`, `order.service.ts` (assertValidOrderRequestedPayload
  + createOrderFromRequested), `order-requested.consumer.ts`, `domain-events.ts`,
  `booking.validation.ts` / `order.validation.ts` / `sales.validation.ts`,
  `account.service.ts`, `catalog.service.ts`/`controller.ts`, schema.prisma,
  migrations `20260812212139_add_booking_service_time_model` +
  `…add_product_draft_service_time_zone`;
- Tests: `booking-service-time-model.e2e-spec.ts` (40), `service-time.spec.ts`
  (16), 2.8 suite (concurrency/P2002), buyer-cabinet, order-creation-consumer,
  acquisition-source-propagation, full e2e 949/949 + unit 475/475.

## 4. Baseline

Branch `master`, WIP (не коммитится в этом пасе). Migrations 45/45 applied,
drift 0 (`migrate status` up to date; `migrate diff --from-migrations
--to-schema-datamodel --exit-code` = 0). Roadmap 2.8A был
`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`; Step 2.9 не начат.

## 5. Domain ownership — HARD GATE

Catalog = authority timezone (`Product.serviceTimeZone`, `Intl`-валидация);
Sales = freeze (CheckoutIntent binding + OrderRequested verbatim); Order =
frozen fulfillment intent; Booking = operational occurrence derived один раз
из frozen фактов. Repository-аудит: `serviceStartsAt` пишется ТОЛЬКО в
`booking.subscribers.ts:98` (единственная точка деривации); все прочие
упоминания — forbidden-key списки, проекции (serialization), helper, тесты.
**PASS.**

## 6. Timezone authority — HARD GATE

- IANA via `Intl.supportedValuesOf("timeZone")` — никаких ручных списков;
  offset-строки (`UTC+4`, `+04:00`) отклоняются (unit).
- Zone frozen при checkout create: `zones.size === 1 ? zone : null` (mixed →
  NULL → exact-time недоступен, 422). Forged zone/instant на любой команде →
  422 (e2e 35.3/35.4/35.6).
- Никакого browser/locale/IP/server-zone inference (grep-аудит §39).
**PASS.**

## 7. DST — HARD REQUIREMENT

`localToUtc` — Intl-оффсеты, без ручной арифметики. Математика верифицирована
для реальных переходов Europe/Paris: ambiguous (2026-10-25 02:30) → ранний
instant 00:30Z (два валидных кандидата, `min`); nonexistent (2026-03-29 02:30)
→ 01:30Z = 03:30 local (post-offset + gap shift). Unit 16/16 (summer/winter
offsets, Baku non-DST); e2e 36.6 (не-naive-UTC). `Math.max`/`Math.abs`
order-independent (Set-итерация безопасна). **PASS.**

## 8. Date-only semantics — HARD REQUIREMENT

`serviceStartsAt` = NULL для date-only (00:00 НЕ фабрикуется, §7);
`serviceTimeType = DATE_ONLY` — default корректно классифицирует legacy.
e2e 35.18/36.1. **PASS.**

## 9. Frozen service-date authority — HARD GATE

Booking потребляет frozen факты из Order (READ-only, ADR-0001); никакого
query текущего Catalog при создании Booking. Seller-редакция zone (e2e 35.9)
и цены (35.10) НЕ мутируют существующую Booking. **PASS.**

## 10. Price freeze / Availability isolation — HARD GATES

`Booking.amount` = frozen `OrderItem.amount` (e2e 35.10/36.12). Consumer
НЕ обращается к availability/reservation таблицам вообще (grep: 0 совпадений
в `booking.subscribers.ts`); hold — ровно один на Sale (e2e 35.19). **PASS.**

## 11. BookingRequested / BookingCreated contracts

`BookingRequested` payload НЕ расширен (minimal §11) — temporal факты читаются
consumer-ом из Order. `BookingCreated` НЕ расширен (§30); correlation/causation
наследуются (e2e 36.15+16). **PASS.**

## 12. Mass assignment — HARD REQUIREMENT

`booking.validation.ts` покрывает ВСЕ server-owned Booking-колонки + оба
casing'а (`serviceTimeZone`/`serviceTimezone`); `order.validation.ts` —
Order-колонки; `sales.validation.ts` — checkout create/service-date/
travelers/payment-terms (включая `serviceStartsAt`/`serviceEndsAt`/
`serviceTimeType`). Forged → 422 (e2e 35.4/35.6/35.7), не silent-strip. **PASS.**

## 13. OrderRequested temporal contract + validation

Payload +`serviceTime`/`serviceEndTime`/`serviceTimeZone` (frozen verbatim из
CheckoutIntent; completeSale содержит defensive guard time-без-zone →
ValidationDomainError). Consumer-валидация: time требует valid IANA zone AND
serviceDate (review fix, e2e 35.15 b); endTime требует time; zone — IANA.
Дефект ленты → событие FAILED, никакого Order (e2e 35.15 a/b). **PASS.**

## 14. Local ↔ UTC invariant / single derivation

`local date + time + IANA zone ↔ UTC instant` enforced при записи (одна
деривация в consumer-е). Item-даты не могут разойтись с order-level time в
каноническом flow (consumer Order пишет один serviceDate на все items).
Defensive throw (time-без-zone) достижим только тест-only malformed fixture —
честный FAILED. **PASS.**

## 15. Multi-day semantics

`TIME_SLOT` + `serviceEndTime`; end ≤ start → следующий local день
(cross-midnight, e2e 36.7 + unit). Второго duration-авторитета нет;
`DATE_RANGE` зарезервирован, не продуцируется. **PASS.**

## 16. Idempotency / cardinality — HARD GATE

`1 OrderItem → 1 Booking` (DB unique `Booking.orderItemId`) + inbox dedup +
business dedup (existing>0) + P2002 allowlist строго
(`Booking_orderItemId_key`, `InboxEvent_consumerId_eventId_key`; unknown →
проброс/FAILED — 2.8 suite tests 3/12). e2e 35.12/35.13. **PASS.**

## 17. Concurrency / failure atomicity

2.8 suite test 12 (concurrent delivery, DB unique + inbox) + тест 3 (P2002
shape-agnostic). Весь consumer-обработка — одна транзакция (Booking +
Passenger + History + Inbox + result-event + temporal). **PASS.**

## 18. Legacy compatibility / migration

Additive nullable миграции (enum schema-scoped `@@schema("booking")`; default
`DATE_ONLY` точно классифицирует legacy; без backfill/fabrication). Legacy
rows читаемы/управляемы (e2e 35.17). Fresh replay — изолированная test DB в
каждой e2e-сессии; drift 0. **PASS.**

## 19. No-second-engine / no speculative entity — HARD GATE

Нет второго pricing/restrictions/availability engine; POST /bookings → 404
(e2e 35.20); прямого Order→Booking write нет; TimeSlot entity не создавалась
(гейт §19); reschedule не вводился (§21/§23). **PASS.**

## 20. Projections / serialization / PII

Buyer Cabinet: `serviceDate` (ISO — конвенция isoOrNull), `serviceTime`
(HH:mm), `serviceTimeZone` (IANA), `serviceStartsAt` (ISO instant). Staff
GET /bookings/:id — полные temporal колонки. PII не затрагивается (2.8
boundary сохранён); events/history без temporal PII. **PASS.**

## 21. §39 adversarial checklist (repo-wide)

- `new Date("YYYY-MM-DD")` traps: НЕТ — все date-only конверсии через явный
  UTC-суффикс `${v}T00:00:00.000Z` (grep-аудит: date-only.ts, order.service,
  sales.checkout, period/proposal validation);
- server-local timezone assumptions: НЕТ — только Intl с явным `timeZone`;
- fabricated midnight: НЕТ (e2e 35.18, unit);
- raw offset authority: НЕТ (IANA only);
- duplicate date/time logic: НЕТ (одна точка деривации);
- Catalog re-resolution при Booking: НЕТ;
- repricing / second hold: НЕТ;
- mutable frozen temporal fields: НЕТ (422 + immutability);
- unsafe P2002 swallowing: НЕТ (allowlist);
- legacy-null crashes: НЕТ (e2e 35.17);
- silent DTO stripping вместо 422: НЕТ для реальных полей (списки покрывают
  все колонки);
- direct Order→Booking writes: НЕТ;
- speculative TimeSlot/calendar entities: НЕТ.
**PASS.**

## 22. Independent verification performed

Повторно запущены (после review-фиксов): tsc, build, unit 475/475,
e2e 949/949 (54 suites, serial), frontend tsc/vitest 135/build, migrate 45/45
drift 0. Дополнительно в ходе ревью: grep-аудит точек деривации,
availability-изоляции, `new Date`-trap, casing forbidden-keys, чтение SQL
миграций, проверка DST-математики для двух зон.

## 23. Findings

**Дефектов: 0.**

## 24. Observations (задокументированы, не требуют кода)

1. **Mixed/no-zone quote → order-level zone freeze** (`sales.service.ts:1105`):
   один product с zone + один без zone → zone объявленная product-ом
   замораживается; date-only product-а item получает TIME_SLOT (order-level
   occurrence model). Конфликтующих зон не бывает (mixed → NULL).
2. **Clear-time требует явный `serviceEndTime: null`**
   (`sales.service.ts` setCheckoutServiceDate): `{ serviceTime: null }` при
   живом endTime → 422 (никакого silent-clear/ambiguous state).
3. **±12h candidate window** (`service-time.ts`): покрывает все реальные DST
   переходы; теоретический лимит — исторические >12h jump (Samoa 2011),
   для сервисных дат недостижим.

Все три зафиксированы в `docs/architecture/booking-service-time-model.md`
(§14 STRICT REVIEW clarifications). Код не менялся.

## 25. Boundary

2.8A ↔ 2.9 boundary соблюдён: temporal факты immutable (reschedule — 2.9+);
Booking lifecycle-переходы не расширены; BookingCreated не расширен. Step 2.9
не начат.

## 26. Final verdict

**`PHASE 2 STEP 2.8A STRICT REVIEW COMPLETED — APPROVED`**

NEXT (по Roadmap): `PHASE 2 — STEP 2.9 — BOOKING LIFECYCLE COMPLETION`.
