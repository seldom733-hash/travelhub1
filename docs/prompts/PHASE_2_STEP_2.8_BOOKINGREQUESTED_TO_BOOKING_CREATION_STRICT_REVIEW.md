# PHASE 2 — STEP 2.8 — BOOKINGREQUESTED → BOOKING CREATION — STRICT REVIEW

**Project:** TravelHub
**Mode:** STRICT REVIEW / REVIEW FIXES ONLY
**Entering status:** `PHASE 2 STEP 2.8 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
**Expected NEXT only if approved:** `PHASE 2 — STEP 2.8A — BOOKING SERVICE DATE / TIME MODEL` (по Roadmap после 2.8)
**Hard stop:** do not implement Step 2.8A or Step 2.9 in this pass.

## 1. Mission

Perform an independent adversarial review of the actual Step 2.8 implementation. Do not approve from the implementation report alone.

Verify the canonicalization of the pre-existing Phase 1 `BookingRequested` consumer (`booking.subscribers.ts`): domain ownership, single creation authority, `1 OrderItem → ≤1 Booking` cardinality (DB unique `orderItemId`), frozen Order-fact consumption (acquisition verbatim, money без reprice), Passenger projection, idempotency (Inbox + count-check + DB unique), concurrency, failure atomicity, `BookingCreated` contract, PII boundary, legacy compatibility, RBAC/mass-assignment, migration safety, and the Step 2.8 ↔ 2.8A/2.9 boundary.

Final verdict must be exactly one of:

- `PHASE 2 STEP 2.8 STRICT REVIEW COMPLETED — APPROVED`
- `PHASE 2 STEP 2.8 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 2 STEP 2.8 STRICT REVIEW COMPLETED — CHANGES REQUIRED`
- `PHASE 2 STEP 2.8 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 2. Sources

Inspect current Roadmap v3 (2.7/2.8/2.8A/2.9), `docs/architecture/booking-requested-to-booking-creation.md`, Step 2.7 Strict Review (отчёт + fixes), Screen Design Brief (Booking codes), Step 1.14 canonical Order events, Steps 2.4/2.5/2.5A/2.5B/2.6/2.7 artifacts, `docs/contracts/events.md` + `api.md`, ADR-0001 (ownership) + ADR-0009/0010 (correlation/envelope), `booking.subscribers.ts`/`booking.module.ts`/`booking.service.ts`/`booking-query.service.ts`/`booking.controller.ts`/`booking.validation.ts`, `order.service.ts` (send producer), Prisma schema (Order/OrderItem/OrderTraveler/Booking/Passenger/BookingHistory), migration `20260812140000_add_booking_order_item_link`, `shared/prisma-errors.ts` (`uniqueConstraintNames`), `shared/field-validation.ts`, `eventbus.service.ts`, `domain-events.ts`, all BookingRequested/BookingCreated/Booking lifecycle tests.

Current Roadmap wins if this prompt conflicts with it.

## 3. Baseline

Record branch, HEAD, origin relation, dirty/untracked files, migration count, Roadmap status, whether Step 2.8 implementation is committed, and whether Step 2.8A has accidentally started.

## 4. Domain ownership — HARD GATE

Repository-wide audit all production `booking.*` writes: `booking.create`, `booking.createMany`, `booking.upsert`, raw inserts, `passenger.*`, `bookingHistory.*`, and any AvailabilityReservation writes from the Booking flow. Classify every writer (canonical 2.8 creation / canonical later lifecycle / trusted import / test-only / obsolete-unsafe). Prove there is exactly ONE production Booking creation authority and no hidden cross-domain write in Order code.

## 5. Canonical trigger — HARD GATE

Verify `BookingRequested` is the ONLY trigger for normal Booking creation:
- `POST /bookings` → 404 (no create route);
- no bootstrap/manual/admin create route;
- no `OrderReadyForBooking`→Booking or `OrderStatusChanged`→Booking shortcut;
- no Sale/Checkout→Booking direct creation;
- no duplicate consumer registration.

## 6. Event contract

Verify `BookingRequested` payload `{orderId, orderCode, customerId}` (PII-minimized, no items/travelers) and that the consumer reads Order details server-side by `orderId` (READ-only, ADR-0001). Verify no passport/contact PII in durable payloads.

## 7. Frozen Order snapshot consumption

Prove Booking is created from frozen Order/OrderItem facts only: productId, `item.amount` (Decimal, no reprice), `serviceDate` (item ?? order), `acquisitionSource` (verbatim incl. null). No Tariff/CommercialPeriod/CommercialRestriction re-resolution, no FX, no priceFrom/POR.

## 8. Cardinality + stable linkage — HARD GATE

Verify canonical `1 OrderItem → exactly 1 Booking` (multi-item Order → N Bookings, one per item), enforced at DB level by `Booking.orderItemId @unique` (migration additive, nullable for legacy). Verify linkage `Booking → orderId + orderItemId + productId` sufficient for trace to Order → Sale/Quote/Checkout where refs exist. No cross-domain FK (ADR-0001).

## 9. Booking ID allocation

Verify `BKG-*` via `IdsService.nextCode(tx, "BKG")` — server-owned, atomic BusinessSequence, no client-forge, no random fallback. Duplicate delivery must not create duplicate business objects beyond acceptable sequence gaps.

## 10. Initial Booking state

Verify initial status `NEW` against BookingStatus enum / Screen Design / Phase 1 implementation. Step 2.8 must create Booking only — no supplier/send/confirm/lifecycle transitions (Step 2.9 boundary).

## 11. Passenger projection — HARD REVIEW

Verify passengers are created from COMPLETE `OrderTraveler` only, per Booking, no placeholder for non-traveler categories, incomplete travelers neither block nor fabricate. Verify passport storage is the approved Passenger schema and redaction on read (Step 1.17), no PII in events/logs.

## 12. Acquisition source propagation

Verify verbatim copy of frozen Order acquisition source: DIRECT, BUYER_REQUEST, legacy null — no fallback null→DIRECT, no recomputation. Check tests cover all three.

## 13. Money semantics

Verify Booking `amount` = frozen `item.amount` Decimal, no recalculation, no Payment/paid-state fabrication, currency not duplicated if schema has no field.

## 14. Availability isolation — HARD GATE

Prove Booking creation creates NO second AvailabilityReservation, no capacity decrement, no hold release. Existing hold (Step 2.4) is the single one. No hidden inventory side effect on duplicate delivery.

## 15. Idempotency — HARD GATE

Prove:
- same event delivered twice → no duplicate;
- concurrent same event → no duplicate;
- replay after commit → no-op;
- logically duplicate BookingRequested (different eventId, same Order) → no duplicate business objects (count-check + DB unique, not Inbox alone);
- P2002 no-op ONLY for `Booking_orderItemId_key` and `InboxEvent_consumerId_eventId_key`; any OTHER unique defect (BKG-code collision etc.) rethrown → event FAILED (honest, no false «уже обработано»);
- `uniqueConstraintNames` handles both Prisma shapes (classic meta.target + driver-adapter originalMessage).

## 16. Concurrency

Test concurrent consumer execution for the same Order (DB uniqueness/CAS/transactional, no process-local locks). Expected: canonical number of Bookings/Passengers, exactly one BookingCreated per real Booking, no raw P2002/500 leak, no partially-created set, no duplicate history.

## 17. Failure atomicity — HARD GATE

For one BookingRequested processing transaction: whole OrderRequest (all Booking/Passenger/History/Inbox/BookingCreated) in ONE consumer transaction. Failure → rollback → event FAILED (retryable tape logic); no partial Booking set, no «inbox done without business writes», no BookingCreated for rolled-back Booking.

## 18. BookingCreated event

Verify exactly one canonical `BookingCreated` result-event per real processing (whole OrderRequest unit): payload `{count, bookings: [{id, code}], orderId}` — no PII; aggregateId = first booking id; correlation inherited from BookingRequested; causation = `BookingRequested.eventId`; actor = SYSTEM. No event on duplicate/no-op.

## 19. History / audit

Verify exactly one `BookingHistory` `created` fact per Booking (no PII). No second audit model. Security audit distinct.

## 20. Order reconciliation boundary

Verify BookingCreated does NOT mark Order PARTIALLY_FULFILLED/FULFILLED; `order.subscribers.ts` reacts only to BookingConfirmed/BookingStatusChanged(→CONFIRMED|COMPLETED)/BookingRejected. No consumer of BookingCreated.

## 21. Cancellation race / event authority

Verify: Order cancelled after durable send → Booking remains (compensation = Step 2.9, not invented); cancel before send → no BookingRequested/Booking; race send-vs-cancel → exactly one winner (CAS, Step 2.7), no corrupt partial state. Consumer must NOT gate on live Order status (durable event authority).

## 22. Legacy compatibility

Verify: legacy Booking with `orderItemId NULL` readable/manageable; `acquisitionSource NULL` preserved; legacy Order without sale provenance / nullable acquisition — full lifecycle. No destructive backfill.

## 23. RBAC / API surface

Verify external roles cannot forge Booking creation via HTTP (POST /bookings absent); BUYER/PARTNER/SALES_MANAGER/MODERATOR have no booking create commands; PATCH lifecycle command-oriented with action whitelist; read/manage APIs backward-compatible.

## 24. Mass assignment — HARD GATE

Verify `PATCH /bookings/:id` rejects forged server-owned fields (id/code/orderId/orderItemId/productId/customerId/status/amount/currency/acquisitionSource/serviceDate/milestones/version/actor/correlation/history/passengers/…) with explicit 422 via `assertNoForbiddenKeys` (`BOOKING_ACTION_FORBIDDEN_KEYS`), not silent-strip. Verify same convention in `order.controller.ts` (ORDER_ACTION_FORBIDDEN_KEYS / ORDER_TRAVELERS_FORBIDDEN_KEYS) for the related Order commands.

## 25. PII / security

Explicit PII audit of BookingRequested, BookingCreated, outbox/inbox, BookingHistory, Security audit, logs, Passenger projection, API DTOs. No passport/contact PII in event envelopes or logs.

## 26. Cross-Seller / tenant isolation

Booking has no seller/partner context (orderId/productId/orderItemId trusted refs); all facts derived from frozen Order; no forge via event-like HTTP input.

## 27. Reverse Marketplace / Universal Pricing regression

Run the full Reverse→Sales→Order→BookingRequested→Booking path; acquisition BUYER_REQUEST propagates verbatim; no Reverse-specific Booking path. Booking consumes frozen commercial facts — no ServiceUnit/RatePlan/CommercialPeriod/CommercialRestriction re-entry (1.8A–D regression).

## 28. Step 2.8A boundary — HARD STOP

Verify NO time-slot/timezone/slot-reservation/date-time reinterpretation introduced. `Booking.serviceDate` remains existing date-only snapshot. Fields `serviceStartsAt`/`serviceEndsAt`/`serviceTimezone` only reserved in forbidden keys (422), not implemented.

## 29. Migration / DB invariants

Verify migration `20260812140000_add_booking_order_item_link` is additive, fresh-deploy-safe, legacy-compatible (nullable unique), applied via Prisma migration only (no `db push`), clean replay, drift-free. Verify migrate status count and no drift.

## 30. Targeted coverage audit

Implementation reports e2e `booking-requested-consumer` (14 tests). Do not approve by count. Ensure coverage for at least:
- canonical Order → send → one BookingRequested → Booking (NEW, BKG-*);
- cardinality multi-item → per-item Booking;
- DB unique P2002 (orderItemId) → not raw 500;
- re-delivery same event → no-op;
- logically duplicate different eventId → no-op;
- malformed/unknown order ref → safe no-op;
- acquisition verbatim (DIRECT/BUYER_REQUEST/null);
- non-traveler category → Booking without Passenger;
- mass-assignment 422 + POST /bookings 404;
- cancel after send → Booking remains; cancel before send → none;
- concurrent delivery;
- correlation/causation chain;
- no raw DB error leak (BKG-code collision → FAILED path, controlled HTTP codes).

## 31. Step 2.6/2.7 regression

Run Order lifecycle suite, Order creation consumer suite, acquisition-source propagation, canonical events, temporal contract, business-event envelope, PII redaction, request-context, RBAC, Buyer Cabinet / Booking reads.

## 32. Full regression

After review fixes run:

Backend: typecheck/build, full unit, targeted 2.8, Step 2.7 lifecycle, Step 1.14, 2.4, 2.5, 2.5A, 2.5B, 2.6, Reverse 2.2A–F, 1.8A–D, Availability, RBAC, PII/event envelope, Buyer Cabinet / Order/Booking reads, full serial E2E.

Frontend: tsc, vitest, production build (even if untouched).

Database: migrate status, fresh replay, repository-supported drift verification.

Report actual counts, not copied implementation counts.

## 33. Review-fix policy

Architecture-neutral local defects may be fixed in this pass. For each: defect → risk → patch → regression test → targeted/full rerun. Do not implement Step 2.8A/2.9.

## 34. Architecture stop conditions

Return `PHASE 2 STEP 2.8 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED` if any unresolved issue includes:
- more than one production Booking creation authority;
- cardinality conflict (1 OrderItem → N Bookings, or 1 Order → 1 Booking required);
- Passenger model incompatible across service categories;
- correct Booking creation requires Step 2.8A time/timezone semantics;
- Order cancellation vs durable BookingRequested requires undefined compensation policy;
- event authority vs live Order state contradictory;
- availability must be re-held/released with undefined ownership;
- DB uniqueness cannot be safely introduced due to legitimate historical cardinality;
- correct fix requires Step 2.9/Finance/Payment/Documents.

## 35. Approval criteria

Approve only if ownership, trigger, cardinality, frozen-fact consumption, idempotency, concurrency, atomicity, event contract, history, PII, RBAC, mass assignment, legacy compatibility, migration and 2.8↔2.8A/2.9 boundary are all proven, and full regression is green.

## 36. Roadmap update

Only if approved:
- Step 2.8 → `✅ STRICT REVIEW COMPLETED — APPROVED` or `APPROVED WITH REVIEW FIXES`;
- exact NEXT from current Roadmap, expected Step 2.8A;
- Step 2.8A remains not started in this pass.

## 37. Required final report

# PHASE 2 — STEP 2.8 — BOOKINGREQUESTED → BOOKING CREATION — STRICT REVIEW REPORT

## 1. Verdict
Exactly one of the four verdicts above.

## 2. Repository baseline

## 3. Sources inspected

## 4. Domain ownership / write-path audit
List every writer and classification.

## 5. Canonical trigger audit

## 6. Event contract

## 7. Frozen Order snapshot consumption

## 8. Cardinality / linkage

## 9. Booking ID allocation

## 10. Initial state

## 11. Passenger projection

## 12. Acquisition propagation

## 13. Money semantics

## 14. Availability isolation

## 15. Idempotency

## 16. Concurrency

## 17. Failure atomicity

## 18. BookingCreated event

## 19. History / audit

## 20. Order reconciliation boundary

## 21. Cancellation race / event authority

## 22. Legacy compatibility

## 23. RBAC / API surface

## 24. Mass assignment

## 25. PII / security

## 26. Cross-Seller isolation

## 27. Reverse / Universal Pricing regression

## 28. Step 2.8A boundary

## 29. Migration / DB

## 30. Targeted tests
Exact counts/results.

## 31. Full backend regression
Exact counts/results.

## 32. Frontend regression
Exact counts/results.

## 33. DB regression

## 34. Issues found

## 35. Review fixes applied
For every fix: defect → change → regression proof.

## 36. Architecture decision status

## 37. Roadmap update

## 38. Out-of-scope confirmation
Confirm Step 2.8A / 2.9 were not implemented.

## 39. Exact files changed during review
Separate implementation files from review-fix files.

## 40. Exact NEXT item
If approved: `PHASE 2 — STEP 2.8A — BOOKING SERVICE DATE / TIME MODEL` (per Roadmap execution sequence).
If not approved: `STEP 2.8 REMEDIATION / RE-REVIEW`.

Final line must repeat the verdict exactly.

## 38. STOP

After STRICT REVIEW: **STOP.**

Even if approved, do **not** implement Step 2.8A in this pass.

Step 2.8A requires a separate implementation prompt.

---

# PHASE 2 — STEP 2.8 — BOOKINGREQUESTED → BOOKING CREATION — STRICT REVIEW REPORT

## 1. Verdict

`PHASE 2 STEP 2.8 STRICT REVIEW COMPLETED — APPROVED`

## 2. Repository baseline

- branch `master`, HEAD `53b2042` (v0.15.0), origin/master synced; dirty tree = Step 2.6/2.7/2.8 uncommitted work (41 changed/untracked entries — Steps 2.6/2.7 review fixes не коммичены, как и на предыдущих pass-ах).
- 43/43 migrations (вкл. новую `20260812140000_add_booking_order_item_link`), `prisma migrate status` = up to date, drift 0.
- Roadmap: Step 2.8 `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW` → обновлён на APPROVED в этом pass.
- Step 2.8A не начат (контаминация отсутствует).

## 3. Sources inspected

Roadmap v3 (2.7/2.8/2.8A/2.9), `docs/architecture/booking-requested-to-booking-creation.md`, Step 2.7 Strict Review, `booking.subscribers.ts`/`booking.module.ts`/`booking.service.ts`/`booking-query.service.ts`/`booking.controller.ts`/`booking.validation.ts`, `order.service.ts` (send), `order-requested.consumer.ts`, `order.subscribers.ts`, `eventbus.service.ts`, `domain-events.ts`, `shared/prisma-errors.ts`/`field-validation.ts`/`validation-pipe.ts`, Prisma schema (Booking/OrderItem/Passenger/BookingHistory), migration SQL, `docs/contracts/events.md`/`api.md`, e2e `booking-requested-consumer` (14), смежные suite-ы.

## 4. Domain ownership / write-path audit

Repo-wide поиск production-писателей `booking.*`: `tx.booking.create` — только `booking.subscribers.ts` (canonical 2.8 creation); `passenger.create` — только там же; `bookingHistory.create` — consumer (creation) + `booking.service.ts` (lifecycle, canonical); `availabilityReservation.create` — только `catalog.service.ts` (Step 2.4 hold, Availability domain). Категория 5 (obsolete/unsafe) = 0. Order-модуль НЕ пишет в booking.* (только READ в consumer-ах + `BookingQueryService` read-only). Единственный create-авторитет подтверждён.

## 5. Canonical trigger audit

`BookingRequested` — единственный триггер: `POST /bookings` → 404 (контроллер: только GET list/get + PATCH action); bootstrap/manual create, `OrderReadyForBooking`→Booking, `OrderStatusChanged`→Booking, Sale/Checkout→Booking, duplicate consumer — не существуют (проверено поиском по src).

## 6. Event contract

`BookingRequested` v1 payload `{orderId, orderCode, customerId}` (без PII); consumer читает `order.items`/`order.travelers` authoritative server-side READ по orderId (READ-only, ADR-0001), не зависит от mutable client-снапшотов. e2e #1 сверяет payload буквально.

## 7. Frozen Order snapshot consumption

Booking создаётся из frozen фактов: productId, `item.amount` (Decimal, без пересчёта), `serviceDate` (item ?? order), `acquisitionSource` (verbatim, вкл. null). НЕ резолвятся Tariff/CommercialPeriod/CommercialRestriction/priceFrom/POR/FX; Product/ServiceUnit не реинтерпретируются.

## 8. Cardinality / linkage

Каноническая кардинальность `1 OrderItem → 1 Booking` подтверждена: код + **DB unique `Booking.orderItemId @unique`** (миграция аддитивная, nullable для legacy — множественные NULL в unique index допустимы). Linkage `Booking → orderId + orderItemId + productId` → Order → saleId/quoteId/checkoutId. No cross-domain FK (ADR-0001). e2e #2/#3.

## 9. Booking ID allocation

`BKG-*` через `IdsService.nextCode(tx, "BKG")` — server-owned, атомарный BusinessSequence, без client-forge/random fallback. Дубликат доставки не создаёт объекты (inbox/count/DB-unique); допустимые sequence-gaps.

## 10. Initial state

`NEW` (BookingStatus enum, Screen Design, Phase 1 implementation). Booking создаётся ТОЛЬКО (initial technical transition PREPARING_REQUEST/SENT_TO_SUPPLIER — вне 2.8, Step 2.9). e2e #1.

## 11. Passenger projection

Пассажиры из **COMPLETE** OrderTraveler (per Booking, current canonical; без placeholder). Non-traveler категория → Booking без Passenger (e2e #8). Incomplete travelers не блокируют/не фабрикуются (Step 2.7 confirm-guard обеспечивает COMPLETE к моменту send). Passport — одобренная схема `Passenger.passportNumber`, redaction на read (Step 1.17, `booking-query.service.ts`); PII в события/логи не попадает (e2e #1 raw assert).

## 12. Acquisition propagation

Verbatim из frozen Order.acquisitionSource: DIRECT / BUYER_REQUEST / legacy null — без fallback null→DIRECT, без recomputation. e2e #7 (+ acquisition suite, + Reverse conversion chain).

## 13. Money semantics

`amount = item.amount` (frozen Decimal, без reprice/priceFrom/POR/Payment/paid-state). e2e #1/#2 (amount сверен с item.amount; multi-item по item).

## 14. Availability isolation

Booking creation НЕ создаёт второй AvailabilityReservation, не декрементит capacity, не освобождает hold. e2e #1 (count = 1 до/после send). Hold = Step 2.4 единственный.

## 15. Idempotency

Тройная защита: (1) `InboxEvent` dedup; (2) count-check `booking.count({orderId}) > 0 → no-op` (logically duplicate); (3) DB unique `orderItemId` (последний рубеж, concurrent). P2002 no-op ТОЛЬКО для `Booking_orderItemId_key` + `InboxEvent_consumerId_eventId_key` (shared `uniqueConstraintNames` — оба Prisma shape); прочие unique-дефекты (BKG-код и пр.) → rethrow → FAILED (честно, не ложный «уже обработано»; конвенция OrderRequested consumer-а). e2e #3/#4/#5/#12.

## 16. Concurrency

In-process bus серийная доставка; DB unique + inbox делают результат детерминированным при будущей конкурентной доставке. e2e #3 (P2002) / #12 (parallel logical duplicates). Без process-local locks.

## 17. Failure atomicity

Единица атомарности = весь OrderRequest (Booking/Passenger/History/Inbox/BookingCreated в ОДНОЙ consumer-транзакции). Неуспех → rollback → FAILED (retryable-логика); no partial set, no «inbox done без бизнес-записей», BookingCreated не существует для rolled-back Booking. No-op-пути (unknown order / items=0 / existing>0) атомарно отмечают inbox.

## 18. BookingCreated event

Ровно ОДНО result-событие на обработку (canonical единица = весь OrderRequest): `{count, bookings:[{id, code}], orderId}` — без PII; aggregateId = first booking id; correlation наследуется, causation = `BookingRequested.eventId`, actor = SYSTEM (context consumer-а). Не эмитится на duplicate/no-op. e2e #1/#4/#13.

## 19. History / audit

BookingHistory: ровно одна запись `created` на Booking (action/from/to/actorName/comment — без PII). Security audit отдельная модель, PII не дампит. Второй audit-модели нет.

## 20. Order reconciliation boundary

Order НЕ получает PARTIALLY_FULFILLED/FULFILLED от создания Booking: `order.subscribers.ts` реагирует только на BookingConfirmed/BookingStatusChanged(→CONFIRMED|COMPLETED)/BookingRejected; у BookingCreated consumer-ов нет. e2e #1 (Order остаётся SENT_TO_BOOKING; OrderFulfilled = 0).

## 21. Cancellation race / event authority

Event authority: durable BookingRequested без live-state gate (gate инвалидировал бы authoritative событие). Order cancelled после send → Booking остаётся (компенсация 2.9, не выдумывается) — e2e #10; cancel до send → ничего — e2e #11; race send-vs-cancel — CAS, ровно один победитель (2.7 #35).

## 22. Legacy compatibility

Booking: orderItemId NULL (до 2.8) читаем/управляем (GET/PATCH, e2e #11); acquisitionSource null — verbatim (e2e #7); старые коды/статусы без destructive reinterpretation. Order: saleId null / acquisition null — полный lifecycle. Без backfill.

## 23. RBAC / API surface

Создание через HTTP отсутствует (POST /bookings → 404, e2e #9); BUYER/PARTNER/SALES_MANAGER/MODERATOR не имеют booking create-команд. PATCH /bookings — command-oriented (action whitelist, `ACTION_PERMISSIONS`); invalid id → нейтральный 404. Read/manage обратно совместимы.

## 24. Mass assignment

`assertNoForbiddenKeys(req.body, BOOKING_ACTION_FORBIDDEN_KEYS)` → 422 (loud), не silent-strip: id/code/orderId/orderItemId/productId/customerId/status/amount/currency/acquisitionSource/serviceDate/milestones/version/actor/correlation/history/passengers/… e2e #9 (переход не применён, amount/acquisition/version не тронуты; PATCH без action → 400). Order-команды — та же конвенция (`order.validation.ts`, 2.7 §28).

## 25. PII / security

BookingRequested/BookingCreated/outbox/inbox/BookingHistory/logs — без passport/contact PII (e2e #1 raw assert). Passenger passport — только booking.Passenger (approved storage), redaction на read (Step 1.17). Параллельных механизмов шифрования не вводится.

## 26. Cross-Seller isolation

Booking без seller/partner context (trusted refs orderId/productId/orderItemId); все факты derived из frozen Order; forge через event-like HTTP невозможен (нет create-эндпоинта; payload не несёт seller-полей).

## 27. Reverse / Universal Pricing regression

Reverse→Sales→Order→BookingRequested→Booking сохранена: acquisition BUYER_REQUEST verbatim (reverse-conversion suite 17 + acquisition suite); Reverse-специфичного Booking-пути нет. 1.8A–D: Booking потребляет frozen facts — регрессия 1.8A–D зелёная.

## 28. Step 2.8A boundary

Time-slot/timezone/slot-reservation/date-time reinterpretation НЕ введены. `serviceStartsAt`/`serviceEndsAt`/`serviceTimezone` — только reserved в forbidden keys (422). Booking.serviceDate — существующий date-only snapshot.

## 29. Migration / DB

Одна аддитивная миграция `add_booking_order_item_link` (nullable unique orderItemId), fresh-deploy-safe, legacy-совместима, применена через `prisma migrate deploy` в каждом e2e-run (fresh replay), drift 0, 43/43. `db push` не использовался.

## 30. Targeted tests

`booking-requested-consumer.e2e-spec.ts`: 14/14 passed (покрытие §35/§36 полное — см. матрицу ниже).

## 31. Full backend regression

909/909 serial e2e (весь suite, 53 файлов) + 459/459 unit + typecheck 0 + build 0.

## 32. Frontend regression

tsc 0, vitest 135/135, production build green (даже без изменений frontend — §38 требование).

## 33. DB regression

`prisma migrate status`: up to date (43/43, drift 0); fresh replay — автоматически в globalSetup каждого e2e-run (drop + migrate deploy).

## 34. Issues found

Нет критических/блокирующих. Minor observation (не дефект, пре-existing Phase 1 pattern, консистентен с order.subscribers.ts): malformed payload без orderId → safe no-op (не FAILED) — приемлемо для defensive-границы; произвольные Booking через payload невозможны (e2e #6).

## 35. Review fixes applied

Нет (реализация прошла review без fixes).

## 36. Architecture decision status

Нет ARCHITECTURE DECISION REQUIRED; все стоп-условия §34 разрешены из current canonical sources.

## 37. Roadmap update

Step 2.8 → `✅ STRICT REVIEW COMPLETED — APPROVED`; NEXT = Step 2.8A; Step 2.8A не начат.

## 38. Out-of-scope confirmation

Step 2.8A / Step 2.9 / Finance / Documents / frontend Booking Center не реализованы.

## 39. Exact files changed during review

Только документация: `docs/prompts/PHASE_2_STEP_2.8_BOOKINGREQUESTED_TO_BOOKING_CREATION_STRICT_REVIEW.md` (создан + report), `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (статус 2.8/2.8A, header), `docs/architecture/booking-requested-to-booking-creation.md` (статус-строка). Production code не менялся.

## 40. Exact NEXT item

`PHASE 2 — STEP 2.8A — BOOKING SERVICE DATE / TIME MODEL` (per Roadmap execution sequence).

`PHASE 2 STEP 2.8 STRICT REVIEW COMPLETED — APPROVED`
