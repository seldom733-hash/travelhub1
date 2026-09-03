# D4 — REPRESENTATIVE COMMERCE CASES — MANIFEST

PHASE 3 — PRE-STEP 3.12 — D4 — TRAVELER SECURITY + REPRESENTATIVE DATA + REPRESENTATIVE END-TO-END COMMERCE CHAIN COVERAGE.

Все representative case'ы созданы **additively через реальные API-команды** (Request → supplier confirm → customer accept → convert → traveler collection → final confirm → Booking → Payment/Refund), **без прямых INSERT финальных статусов** (D4 §14). Synthetic personas, PII-safe (§26).

Общие постоянные fixtures (D3RF permanent): Product `PRD-00000121` «Baku Night Photography Tour» (TOUR, owner-partner `PRN-00000002` Caspian Adventures), Customer `CRM-00000077` Giovanni Tran, партнёр-продавец `PRN-00000002`.

---

## CASE A — D3 permanent (preserved, D4 §24)

| Поле | Значение |
|---|---|
| Scenario | S6 — Order с traveler data incomplete (editable, final confirmation НЕ выполнена) |
| Business meaning | D3 CASE A — редактируемый заказ, 2 traveler'а, данные неполные/редактируемые |
| Workspace / Acquisition | Platform Marketplace (`MARKETPLACE`) |
| Product | PRD-00000121 «Baku Night Photography Tour» |
| Request | MKT-REQ-09000547 (`006e94b4-62e7-447a-9cab-84ca62d74758`), status `CONVERTED` |
| Order | MKT-ORD-09000547 (ORD-00001501, `83eb7738-01ac-4506-9af8-3504b989bfc6`), status `NEW`, `finalConfirmedAt NULL`, 2 travelers |
| Booking / Payment / Refund | NONE |
| Traveler count / state | 2 / editable (`finalConfirmedAt == NULL`) |
| Direct URLs | `/app/orders/83eb7738-01ac-4506-9af8-3504b989bfc6`, `/app/requests/006e94b4-62e7-447a-9cab-84ca62d74758` |
| Evidence | `docs/evidence/d4/tmp_d4_browser_01_d3_caseA_order.png` (browser PASS) |

## CASE B — D3 permanent (preserved, D4 §24)

| Поле | Значение |
|---|---|
| Scenario | S8/S9 — Booking requested, confirmed, locked |
| Business meaning | D3 CASE B — completed/locked заказ (final confirmation), Booking существует |
| Workspace / Acquisition | Platform Marketplace (`MARKETPLACE`) |
| Order | MKT-ORD-09000548 (ORD-00001502, `a31783db-55a5-4221-ada4-dcb538c9731e`), status `SENT_TO_BOOKING`, `finalConfirmedAt NOT NULL`, 2 travelers |
| Booking | существует (D3RF evidence) |

## C1 — READY_FOR_BOOKING (S7)

| Поле | Значение |
|---|---|
| Scenario | S7 — Ready for Booking: все REQUIRED traveler данные собраны → final confirm → `READY_FOR_BOOKING` |
| Business meaning | Полная Request-цепочка до точки отправки в Booking; 2 traveler'а COMPLETE, immutable |
| Workspace / Acquisition | Platform Marketplace (`MARKETPLACE`) |
| Product | PRD-00000121 «Baku Night Photography Tour» (TOUR) |
| Customer | CRM-00000077 Giovanni Tran |
| Request | MKT-REQ-09000847 (`09965373-83cd-46da-a0d8-9b1c08baa37d`) → `CONVERTED` |
| Order | MKT-ORD-09000847 (ORD-00001801, `1e1ab156-8b7f-4e28-b3cb-27f3b70d6b98`), status `READY_FOR_BOOKING`, amount 340.00 AZN, `finalConfirmedAt NOT NULL`, `commerceSequence 09000847` |
| Booking / Payment / Refund | NONE (ещё не отправлен в Booking) |
| Traveler count / state | 2 / COMPLETE, final-confirmed (immutable) |
| Direct URLs | `/app/orders/1e1ab156-8b7f-4e28-b3cb-27f3b70d6b98`, `/app/requests/09965373-83cd-46da-a0d8-9b1c08baa37d` |
| Evidence | `docs/evidence/d4/tmp_d4_browser_02_c1_order_ready_for_booking.png` (browser PASS); e2e representative-chain test 1 (S7/S8/S9) |

## C2 — Supplier confirmed, customer pending (S2)

| Поле | Значение |
|---|---|
| Scenario | S2 — supplier price/availability confirmed, customer ещё не принял; Order отсутствует |
| Business meaning | Заявка `CONFIRMED`, deadline ожидания клиента в будущем |
| Request | MKT-REQ-09000848 (`c93de74e-e695-4d57-a3a5-d85c0f962b6c`), status `CONFIRMED` |
| Order / Booking / Payment / Refund | NONE |
| Direct URLs | `/app/requests/c93de74e-e695-4d57-a3a5-d85c0f962b6c` |
| Evidence | `docs/evidence/d4/tmp_d4_browser_03_c2_request.png` (Request Center search PASS) |

## C3 — Request waiting supplier (S1)

| Поле | Значение |
|---|---|
| Scenario | S1 — Request `NEW`, supplier SLA deadline в будущем |
| Request | MKT-REQ-09000849 (`037f7372-b0e0-4e7a-a4c2-0926927b2246`), status `NEW` |
| Order / Booking / Payment / Refund | NONE |
| Direct URLs | `/app/requests/037f7372-b0e0-4e7a-a4c2-0926927b2246` |
| Evidence | `docs/evidence/d4/tmp_d4_browser_03_c3_request.png` (Request Center search PASS) |

## C4 — Supplier rejection / unavailable (S4)

| Поле | Значение |
|---|---|
| Scenario | S4 — terminal Request state `UNAVAILABLE` через реальную команду `/requests/:id/unavailable`, без Order |
| Request | MKT-REQ-09000850 (`34a0bec0-f7ad-4688-8f92-6c79f26ad6d9`), status `UNAVAILABLE` |
| Order / Booking / Payment / Refund | NONE |
| Direct URLs | `/app/requests/34a0bec0-f7ad-4688-8f92-6c79f26ad6d9` |
| Evidence | `docs/evidence/d4/tmp_d4_browser_03_c4_request.png`, `tmp_d4_browser_04_c4_request_unavailable.png` (PASS) |

## C5 — Booking CONFIRMED, unpaid (S9)

| Поле | Значение |
|---|---|
| Scenario | S9 — Booking `CONFIRMED`, Payment отсутствует |
| Request | MKT-REQ-09000861 → `CONVERTED` |
| Order | MKT-ORD-09000861 (ORD-00001806, `3fd18f00-28f6-4f5f-8eb8-07b74d4c91c1`), status `PARTIALLY_FULFILLED` (Booking CONFIRMED reconcile), 300.00 AZN, `paymentStatus UNPAID`, 2 travelers |
| Booking | MKT-BKG-09000861 (BKG-00001702, `fdfbcb49-a711-4c95-8a44-53a01d1f6c9c`), status `CONFIRMED`, `confirmedAt NOT NULL`, 2 Passenger |
| Payment / Refund | NONE |
| Direct URLs | `/app/bookings/fdfbcb49-a711-4c95-8a44-53a01d1f6c9c`, `/app/orders/3fd18f00-28f6-4f5f-8eb8-07b74d4c91c1` |
| Evidence | `docs/evidence/d4/tmp_d4_browser_05_c5_booking_confirmed.png`, `tmp_d4_browser_10_marketplace_scope_bookings.png` (PASS) |

## C6 — Paid → cancellation after payment → full refund (S11+S14+S16)

| Поле | Значение |
|---|---|
| Scenario | S11 (fully paid) → S14 (cancellation after payment) → S16 (full refund PROCESSED) |
| Request | MKT-REQ-09000949 → `CONVERTED` (commerceSequence `09000949`) |
| Order | MKT-ORD-09000949 (ORD-00001903, `aa8e510d-c88c-4ab1-9826-469fae722395`), status `CANCELLED`, 300.00 AZN, `paidAmount 300.00`, `refundedAmount 300.00`, `paymentStatus REFUNDED`, 2 travelers |
| Booking | MKT-BKG-09000949 (BKG-00001801, `31f2fdfc-e483-4cd4-a750-c36faa16a46e`), status `CANCELLED` (компенсация OrderCancelled), 2 Passenger |
| Payment | MKT-PAY-09000949-1 (PAY-00001202, `dde9185b-66f9-48a9-9de7-7ebcec3380ef`), status `CAPTURED`, 300.00 AZN (frozen из Order) |
| Refund | MKT-REF-00000001 (`381e5ef8-338e-4664-9ef4-468fdfe7e474`), status `PROCESSED`, 300.00 AZN, `refunded >= paid → REFUNDED` |
| Direct URLs | `/app/orders/aa8e510d-c88c-4ab1-9826-469fae722395`, `/app/bookings/31f2fdfc-e483-4cd4-a750-c36faa16a46e`, `/app/finance/payments/PAY-00001202` |
| Evidence | `docs/evidence/d4/tmp_d4_browser_06_c6_booking_cancelled.png`, `tmp_d4_browser_07_c6_order_cancelled.png`, `tmp_d4_browser_08_c6_payment_captured.png` (PASS); e2e representative-chain tests 2–3 (finance legs, D4 F3 fix) |

---

## Scenario coverage summary (permanent dev cases + e2e chain suites)

| Scenario | Status | Permanent dev case | e2e (d4-representative-chain) |
|---|---|---|---|
| S1 Request waiting supplier | SUPPORTED | C3 (MKT-REQ-09000849 NEW) | — |
| S2 Supplier confirmed, customer pending | SUPPORTED | C2 (MKT-REQ-09000848 CONFIRMED) | — |
| S3 Price changed → accepted | SUPPORTED (через accept) | (не выделен отдельный dev case; covered D3RF историческими) | — |
| S4 Supplier rejection/unavailable | SUPPORTED | C4 (MKT-REQ-09000850 UNAVAILABLE) | — |
| S5A Customer declined | SUPPORTED — реальная команда `/requests/:id/customer-decline` → `CANCELLED_BY_CUSTOMER`, Order не создаётся | — (permanent не выделен) | d4-remediation-closure (S5 decline test) |
| S5B Customer action expired | `auto-EXPIRED` НЕ IMPLEMENTED — enum `EXPIRED` существует, `customerActionDeadline` есть, но scheduler/auto-transition отсутствует (честно задокументировано) | — | — |
| S6 Order travelers incomplete | SUPPORTED | D3 CASE A (MKT-ORD-09000547 NEW, editable) | — |
| S7 Ready for Booking | SUPPORTED | C1 (MKT-ORD-09000847 READY_FOR_BOOKING) | test 1 |
| S8 Sent to Booking | SUPPORTED | D3 CASE B (MKT-ORD-09000548 SENT_TO_BOOKING) | test 1 (переход) |
| S9 Booking confirmed unpaid | SUPPORTED | C5 (MKT-BKG-09000861 CONFIRMED) | test 1 |
| S10 Partial payment | NOT SUPPORTED (финансовая модель = единый capture; partial payment отсутствует как архитектурный gap) | — | — |
| S11 Fully paid | SUPPORTED | C6 (MKT-PAY-09000949-1 CAPTURED) | test 2 |
| S12 Booking completed | SUPPORTED — natural chain доказана isolated e2e (Booking COMPLETED → Order FULFILLED → Order CLOSED, реальные команды, без прямой инъекции статусов) | — | d4-remediation-closure (S12 natural completion) |
| S13 Cancellation before payment | SUPPORTED | — | test 4 |
| S14 Cancellation after payment | SUPPORTED | C6 (order cancel → Booking CANCELLED) | — |
| S15 Partial refund | SUPPORTED | — | test 3 (⅓ refund) |
| S16 Full refund | SUPPORTED | C6 (MKT-REF-00000001 PROCESSED) | test 3 (remainder → REFUNDED) |
| S17 Authoritative no-Request flow | SUPPORTED (legacy Marketplace Orders без Request) | D3 legacy | — |
| S18 Marketplace flow | SUPPORTED | C1/C5/C6 (`MARKETPLACE`) | — |
| S19 Storefront Partner flow | negative isolation PROVEN (platform scope = 0 exposure: list/export filter deny, direct reads 404, DB rows сохранены); owning-partner positive commerce path NOT IMPLEMENTED / DEFERRED | SF001-ORD-00000001 / SF001-BKG-00000001 (fixtures в e2e) | d4-traveler-security + d4-remediation-closure (F2 negatives) |

## Browser runtime evidence

`docs/evidence/d4/d4_browser_runtime_results.json` — 18/18 PASS:
login, D3 CASE A, C1 order READY_FOR_BOOKING + travelers, C2/C3/C4 Request Center, C4 detail, C5 booking CONFIRMED, C6 booking/order CANCELLED + payment CAPTURED, Marketplace visibility, Storefront direct-GET 404, Storefront registry exclusion.
