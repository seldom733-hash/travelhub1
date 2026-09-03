# D3 Request Flow Integration — Evidence Manifest

Phase: `PHASE_3_PRE_STEP_3.12_D3_REQUEST_FLOW_INTEGRATION_FINAL_EVIDENCE_CLOSURE`
Stack: `frontend :3000` → proxy `/api/v1` → `backend :4000` (live dev), headless Chromium (Playwright, RU).

## Permanent visual cases (dev DB, сохраняются)

| CASE | Request | Order | State | Назначение |
|------|---------|-------|-------|------------|
| A | `MKT-REQ-09000547` | `MKT-ORD-09000547` | NEW, 2 OrderTraveler, acceptance + pin, no booking | **editable** — Request detail → linked order → traveler cards → save/resume |
| B | `MKT-REQ-09000548` | `MKT-ORD-09000548` | SENT_TO_BOOKING, 2 OrderTraveler, final confirmed, 1 Booking `MKT-BKG-00000084` (COMPLETED), 2 Passenger | **completed** — locked panel, booking created |

Disposable CASE C chains (`MKT-REQ-090007xx`/`0900065x`) создаются на время browser-прогона и **удаляются** после него (dev DB чистая: 1000 seeded Orders + A/B только).

## Browser runtime evidence (13/13 checks PASS)

| # | Screenshot | Check(s) | Что доказывает |
|---|-----------|----------|----------------|
| 1 | `tmp_d3rf_browser_1_request_detail_linked.png` | A1 (4 checks) | Request detail (RU): CUSTOMER_ACCEPTED + linked Order, progress «Ожидаются данные туристов», кнопка «Продолжить оформление» |
| 2 | `tmp_d3rf_browser_2_order_traveler_cards.png` | A2 | 2 traveler cards на Order, pinned requirements (REQUIRED/OPTIONAL/NOT_REQUESTED) |
| 3 | `tmp_d3rf_browser_3_final_confirm_denied.png` | A3 | Финальное подтверждение с пустыми REQUIRED → отклонено (server gate) |
| 4 | `tmp_d3rf_browser_4_save_resume.png` | A4 | save → hard refresh → resume: значение персистится на сервере |
| 5 | `tmp_d3rf_browser_5_booking_gate_denied.png` | E | Booking (confirm/send) до final confirmation → отклонено (gate SR R3) |
| 6 | `tmp_d3rf_browser_6_final_locked.png` | F (part) | После final confirm: панель locked (immutable), `finalConfirmedAt` на сервере |
| 7 | `tmp_d3rf_browser_7_caseC_booking.png` | F (3 checks) | confirm → READY_FOR_BOOKING → send → SENT_TO_BOOKING → Booking виден в «Связанные брони» UI (fix `orderId` filter) |
| 8 | `tmp_d3rf_browser_8_caseB_completed.png` | B | CASE B: locked panel + booking (completed case) |

## DB/API/UI/event reconciliation

- API `GET /bookings?orderId=X` возвращает **только** брони заказа X (fix: явный `orderId` больше не перезаписывается channel scope) — regression test в `d3-traveler-collection.e2e-spec.ts` (11/11).
- Booking `MKT-BKG-00000084` (CASE B): 2 Passenger = 2 confirmed OrderTraveler (name/passport matched).
- Events: OrderRequested → OrderCreated (payload frozen: `acceptedAt = Sale.completedAt`, pinned requirements), BookingRequested → BookingCreated.
- Request: CUSTOMER_ACCEPTED → `customerAcceptedAt` → convert (idempotent, HTTP 200 replay) → `convertedAt`/`convertedOrderId` back-link.

## Scripts (disposable, не коммитятся)

- `backend/tmp_d3rf_seed.mjs` — создаёт CASE A/B через live API.
- `backend/tmp_d3rf_cases.json` — идентификаторы A/B (для browser-прогона).
- `frontend/tmp_d3rf_browser.mjs` — полный browser-прогон A–F (13 checks) + скриншоты.